import { randomUUID } from "node:crypto";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useFetcher } from "react-router";

import {
  CacanodeSupportError,
  createApiChatSession,
  createSupportTicket,
  isCacanodeChatConfigured,
  isCacanodeTicketConfigured,
  sendApiChatMessage,
} from "~/lib/cacanode-support.server";
import {
  type CacanodeCitation,
  type CacanodeMessage,
} from "~/lib/cacanode-support";
import { getOptionalUser } from "~/lib/auth.server";

import type { Route } from "./+types/contact-support";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Contact Support · Kuvox Help Center" },
    {
      name: "description",
      content:
        "Contact Kuvox support for help with accounts, billing, product issues, and legal or privacy questions.",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getOptionalUser(request);
  return {
    chatConfigured: isCacanodeChatConfigured(),
    ticketConfigured: isCacanodeTicketConfigured(),
    user,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "create-ticket");
  const user = await getOptionalUser(request);

  if (intent === "send-message") {
    if (!isCacanodeChatConfigured()) {
      return { ok: false as const, intent, error: "AI support is not configured yet.", retryAfter: null };
    }

    const content = String(formData.get("content") ?? "").trim();
    const visitorId = String(formData.get("visitorId") ?? "").trim();
    const locale = String(formData.get("locale") ?? "vi-VN").trim() || "vi-VN";
    let sessionId = String(formData.get("sessionId") ?? "").trim();
    const idempotencyKey = validIdempotencyKey(formData.get("idempotencyKey")) ?? randomUUID();

    if (!content || content.length > 32_000) {
      return { ok: false as const, intent, error: "Messages must contain 1 to 32,000 characters.", retryAfter: null };
    }
    if (!visitorId || visitorId.length > 255) {
      return { ok: false as const, intent, error: "The support visitor identifier is invalid.", retryAfter: null };
    }
    if (locale.length > 20) {
      return { ok: false as const, intent, error: "The support locale is invalid.", retryAfter: null };
    }
    if (sessionId.length > 255) {
      return { ok: false as const, intent, error: "The support session identifier is invalid.", retryAfter: null };
    }

    const createSession = async () => {
      const session = await createApiChatSession({
          externalUserId: visitorId,
          customerName: user?.displayName,
          customerEmail: user?.email,
          locale,
      });
      return session.id;
    };

    try {
      if (!sessionId) sessionId = await createSession();
      try {
        const message = await sendApiChatMessage(sessionId, content, idempotencyKey);
        return { ok: true as const, intent, sessionId, message };
      } catch (error) {
        if (!isMissingCustomerSession(error)) throw error;
        sessionId = await createSession();
        const message = await sendApiChatMessage(sessionId, content, idempotencyKey);
        return { ok: true as const, intent, sessionId, message };
      }
    } catch (error) {
      return actionError(error, intent);
    }
  }

  if (intent !== "create-ticket") {
    return { ok: false as const, intent, error: "Unsupported support action.", retryAfter: null };
  }
  if (!isCacanodeTicketConfigured()) {
    return { ok: false as const, intent, error: "Support ticket creation is not configured yet.", retryAfter: null };
  }

  const sessionId = String(formData.get("sessionId") ?? "").trim();
  const customerEmail = String(formData.get("customerEmail") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const sourceDraftSignature = validTicketDraftSignature(formData.get("draftSignature"));
  const idempotencyKey = validIdempotencyKey(formData.get("idempotencyKey")) ?? randomUUID();

  if (!sessionId || sessionId.length > 255) {
    return { ok: false as const, intent, error: "Start a support conversation before creating a ticket.", retryAfter: null };
  }
  if (!validEmail(customerEmail)) {
    return { ok: false as const, intent, error: "Enter a valid email address.", retryAfter: null };
  }
  if (!title || title.length > 255) {
    return { ok: false as const, intent, error: "Ticket titles must contain 1 to 255 characters.", retryAfter: null };
  }
  if (!description || description.length > 10_000) {
    return { ok: false as const, intent, error: "Ticket descriptions must contain 1 to 10,000 characters.", retryAfter: null };
  }
  // Keep suppressing the source action even when the customer edits its fields.
  // The signature only controls this user's signed-cookie UI state; it grants no access.
  const draftSignature = sourceDraftSignature
    ?? ticketDraftSignature(customerEmail, title, description);

  try {
    const ticket = await createSupportTicket({
      sessionId,
      customerEmail,
      customerName: user?.displayName,
      title,
      description,
    }, idempotencyKey);
    return { ok: true as const, intent, ticket, draftSignature };
  } catch (error) {
    return actionError(error, intent);
  }
}

const CONTACT_OPTIONS = [
  {
    icon: "support_agent",
    title: "Product Support",
    description: "Get help with projects, exports, uploads, and workspace issues.",
    href: "mailto:support@kuvox.ai",
    label: "support@kuvox.ai",
  },
  {
    icon: "payments",
    title: "Billing",
    description: "Questions about subscriptions, invoices, renewals, and refunds.",
    href: "mailto:billing@kuvox.ai",
    label: "billing@kuvox.ai",
  },
  {
    icon: "balance",
    title: "Legal",
    description: "Reach us about terms, policy requests, or compliance questions.",
    href: "mailto:legal@kuvox.ai",
    label: "legal@kuvox.ai",
  },
] as const;

export interface TicketDraft {
  email: string;
  title: string;
  description: string;
  signature: string;
}

export default function ContactSupport({ loaderData }: Route.ComponentProps) {
  const chatFetcher = useFetcher<typeof action>();
  const ticketFetcher = useFetcher<typeof action>();
  const [messages, setMessages] = useState<CacanodeMessage[]>([]);
  const [storageHydrated, setStorageHydrated] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [visitorId, setVisitorId] = useState(loaderData.user?.id ?? "");
  const [draft, setDraft] = useState("");
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatRetryAfter, setChatRetryAfter] = useState<string | null>(null);
  const [ticketIdempotencyKey, setTicketIdempotencyKey] = useState("");
  const [dismissedDraftSignature, setDismissedDraftSignature] = useState<string | null>(null);
  const [ticketDraft, setTicketDraft] = useState<TicketDraft | null>(null);
  const [ticketConfirmation, setTicketConfirmation] = useState<string | null>(null);
  const messagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTicketIdempotencyKey(browserMessageId());
    const stored = readStoredConversation();
    const nextVisitorId = loaderData.user?.id ?? stored?.visitorId ?? `anonymous-${browserMessageId()}`;
    setVisitorId(nextVisitorId);
    if (stored) {
      setSessionId(stored.sessionId);
      setMessages(stored.messages);
      setDismissedDraftSignature(stored.submittedTicketDraftSignature);
      setTicketDraft(ticketDraftFromMessages(
        stored.messages,
        loaderData.user?.email ?? "",
        stored.submittedTicketDraftSignature,
      ));
    }
    setStorageHydrated(true);
  }, [loaderData.user?.email, loaderData.user?.id]);

  useEffect(() => {
    if (!storageHydrated || !visitorId) return;
    persistConversation({
      visitorId,
      sessionId,
      messages,
      submittedTicketDraftSignature: dismissedDraftSignature,
    });
  }, [dismissedDraftSignature, messages, sessionId, storageHydrated, visitorId]);

  useEffect(() => {
    const result = ticketFetcher.data;
    if (!result?.ok || result.intent !== "create-ticket" || !("ticket" in result) || !result.ticket) return;
    setTicketDraft(null);
    setDismissedDraftSignature(result.draftSignature || null);
    setTicketIdempotencyKey(browserMessageId());
    setTicketConfirmation(
      `Ticket ${result.ticket.id.slice(0, 8)} was created successfully. We will follow up by email.`,
    );
  }, [ticketFetcher.data]);

  useEffect(() => {
    const result = chatFetcher.data;
    if (!result || result.intent !== "send-message") return;
    if (!result.ok) {
      setChatError(result.error);
      setChatRetryAfter(result.retryAfter);
      return;
    }
    if (!("message" in result) || !result.message || !("sessionId" in result) || !result.sessionId) return;

    setSessionId(result.sessionId);
    setMessages((current) => [...current, result.message]);
    const nextDraft = ticketDraftFromMessages(
      [result.message],
      loaderData.user?.email ?? "",
      dismissedDraftSignature,
    );
    if (nextDraft) {
      setDismissedDraftSignature(null);
      setTicketDraft(nextDraft);
    }
  }, [chatFetcher.data, loaderData.user?.email]);

  useEffect(() => {
    const element = messagesRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [chatFetcher.state, messages, ticketFetcher.state]);

  function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !loaderData.chatConfigured || chatFetcher.state !== "idle") return;

    const currentVisitorId = visitorId || loaderData.user?.id || `anonymous-${browserMessageId()}`;
    if (!visitorId) setVisitorId(currentVisitorId);
    const userMessage: CacanodeMessage = { role: "user", content, citations: [] };
    setMessages((current) => [...current, userMessage]);
    setDraft("");
    setChatError(null);
    setChatRetryAfter(null);
    setTicketConfirmation(null);

    const formData = new FormData();
    formData.set("intent", "send-message");
    formData.set("content", content);
    formData.set("visitorId", currentVisitorId);
    formData.set("locale", navigator.language || "vi-VN");
    formData.set("sessionId", sessionId ?? "");
    formData.set("idempotencyKey", browserMessageId());
    chatFetcher.submit(formData, { method: "post" });
  }

  function startNewConversation() {
    const nextVisitorId = loaderData.user?.id || visitorId || `anonymous-${browserMessageId()}`;
    setVisitorId(nextVisitorId);
    setSessionId(null);
    setMessages([]);
    setTicketDraft(null);
    setDismissedDraftSignature(null);
    setTicketConfirmation(null);
    setChatError(null);
    clearStoredConversation();
  }

  const displayedMessages = messages;
  const messagesWithConfirmation: CacanodeMessage[] = ticketConfirmation
    ? [...displayedMessages, { role: "assistant", content: ticketConfirmation, citations: [] }]
    : displayedMessages;
  const chatBusy = chatFetcher.state !== "idle";
  const ticketBusy = ticketFetcher.state !== "idle";
  const busy = chatBusy || ticketBusy;
  const ticketError = ticketFetcher.data && !ticketFetcher.data.ok
    ? ticketFetcher.data.error
    : null;
  const ticketRetryAfter = ticketFetcher.data && !ticketFetcher.data.ok
    ? ticketFetcher.data.retryAfter
    : null;

  return (
    <div className="w-full max-w-6xl mx-auto animate-fade-in-up px-6 lg:px-8">
      <section className="text-center mb-10 sm:mb-14">
        <div className="w-14 h-14 rounded-xl bg-primary-container/20 flex items-center justify-center mx-auto mb-5">
          <span className="material-symbols-outlined text-primary text-[32px]">headset_mic</span>
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-display font-semibold text-on-surface tracking-tight mb-4">
          Contact Support
        </h1>
        <p className="text-body-lg text-on-surface-variant max-w-2xl mx-auto">
          Ask Kuvox AI for an immediate answer or contact the right team for personal assistance.
        </p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {CONTACT_OPTIONS.map((option) => (
          <a
            key={option.title}
            href={option.href}
            className="glass rounded-xl p-6 border border-outline-variant/30 hover:border-primary/40 transition-colors duration-200"
          >
            <span className="material-symbols-outlined text-primary text-3xl mb-4 block">{option.icon}</span>
            <h2 className="text-headline-md font-semibold text-on-surface mb-2">{option.title}</h2>
            <p className="text-body-sm text-on-surface-variant mb-5">{option.description}</p>
            <span className="inline-flex items-center gap-2 text-primary text-body-sm font-bold">
              {option.label}
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </span>
          </a>
        ))}
      </section>

      <section className="mt-10 sm:mt-14 glass rounded-2xl p-5 sm:p-6 border border-outline-variant/30 mb-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary-container/20 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-primary text-[28px]">forum</span>
            </div>
            <div>
              <h2 className="text-headline-md font-semibold text-on-surface mb-1">Ask Kuvox AI Support</h2>
              <p className="text-body-sm text-on-surface-variant">
                Answers are generated from Kuvox support knowledge and may include source citations.
              </p>
            </div>
          </div>
          {(sessionId || messages.length > 0) && (
            <button
              type="button"
              onClick={startNewConversation}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-full border border-outline-variant/40 px-4 py-2 text-label-md font-semibold text-on-surface-variant transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[17px]">restart_alt</span>
              New conversation
            </button>
          )}
        </div>

        {!loaderData.chatConfigured && (
          <SupportNotice tone="warning">
            AI support is not configured. Add CACANODE_API_URL and the server-only CACANODE_API_TOKEN.
          </SupportNotice>
        )}
        {chatError && (
          <SupportNotice tone="error">
            {chatError}
            {chatRetryAfter ? ` Try again in ${chatRetryAfter} seconds.` : ""}
          </SupportNotice>
        )}
        {ticketError && (
          <SupportNotice tone="error">
            {ticketError}
            {ticketRetryAfter ? ` Try again in ${ticketRetryAfter} seconds.` : ""}
          </SupportNotice>
        )}

        <div
          ref={messagesRef}
          className="bg-surface/50 rounded-xl p-4 sm:p-6 h-[420px] overflow-y-auto mb-4 border border-outline-variant/20 flex flex-col gap-5"
          aria-live="polite"
        >
          {messagesWithConfirmation.length === 0 ? (
            <ChatMessage
              message={{
                role: "assistant",
                content: loaderData.chatConfigured
                  ? "Hi! I’m Kuvox AI Support. Ask me about accounts, projects, uploads, editing, or exports."
                  : "AI support will be available after the Custom API integration is configured.",
                citations: [],
              }}
            />
          ) : (
            messagesWithConfirmation.map((message, index) => (
              <ChatMessage key={`${message.sequence_number ?? index}-${message.role}`} message={message} />
            ))
          )}
          {chatBusy && (
            <div className="flex items-center gap-2 pl-11 text-label-md text-on-surface-variant">
              <span className="inline-flex gap-1" aria-hidden="true">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:120ms]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:240ms]" />
              </span>
              Searching support knowledge…
            </div>
          )}
        </div>

        {ticketDraft && (
          <TicketDraftForm
            draft={ticketDraft}
            idempotencyKey={ticketIdempotencyKey}
            busy={ticketBusy}
            sessionId={sessionId}
            ticketConfigured={loaderData.ticketConfigured}
            onChange={setTicketDraft}
            onCancel={() => {
              setDismissedDraftSignature(ticketDraft.signature);
              setTicketDraft(null);
            }}
            fetcher={ticketFetcher}
          />
        )}

        <form className="relative flex items-end gap-2" onSubmit={handleSend}>
          <textarea
            name="content"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            rows={1}
            maxLength={32_000}
            required
            disabled={!loaderData.chatConfigured || busy}
            placeholder="Ask a support question…"
            className="min-h-12 max-h-40 flex-1 resize-y rounded-2xl border border-outline-variant/40 bg-surface px-5 py-3 text-body-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/60 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!loaderData.chatConfigured || busy || !draft.trim()}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Send message"
          >
            <span className="material-symbols-outlined text-[20px]">send</span>
          </button>
        </form>
        <p className="mt-3 text-center text-label-sm text-on-surface-variant">
          AI responses can be inaccurate. Verify important account, billing, and legal information with our team.
        </p>
      </section>
    </div>
  );
}

function TicketDraftForm({
  draft,
  idempotencyKey,
  busy,
  sessionId,
  ticketConfigured,
  onChange,
  onCancel,
  fetcher,
}: {
  draft: TicketDraft;
  idempotencyKey: string;
  busy: boolean;
  sessionId: string | null;
  ticketConfigured: boolean;
  onChange: (draft: TicketDraft) => void;
  onCancel: () => void;
  fetcher: ReturnType<typeof useFetcher>;
}) {
  return (
    <div className="mb-5 rounded-2xl border border-primary/30 bg-primary/5 p-4 sm:p-5">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <span className="material-symbols-outlined text-[22px]">confirmation_number</span>
        </div>
        <div>
          <h3 className="text-title-md font-semibold text-on-surface">Review support ticket draft</h3>
          <p className="mt-1 text-label-md text-on-surface-variant">
            Kuvox AI prepared this structured draft. Review and edit it before creating the ticket.
          </p>
        </div>
      </div>

      <fetcher.Form method="post" className="space-y-4">
        <input type="hidden" name="intent" value="create-ticket" />
        <input type="hidden" name="sessionId" value={sessionId ?? ""} />
        <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
        <input type="hidden" name="draftSignature" value={draft.signature} />
        <label className="block">
          <span className="mb-1.5 block text-label-md font-semibold text-on-surface">Email</span>
          <input
            type="email"
            name="customerEmail"
            required
            maxLength={320}
            value={draft.email}
            onChange={(event) => onChange({ ...draft, email: event.target.value })}
            className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-2.5 text-body-sm text-on-surface focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/60"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-label-md font-semibold text-on-surface">Title</span>
          <input
            name="title"
            required
            maxLength={255}
            value={draft.title}
            onChange={(event) => onChange({ ...draft, title: event.target.value })}
            className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-2.5 text-body-sm text-on-surface focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/60"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-label-md font-semibold text-on-surface">Description</span>
          <textarea
            name="description"
            required
            rows={5}
            maxLength={10_000}
            value={draft.description}
            onChange={(event) => onChange({ ...draft, description: event.target.value })}
            className="w-full resize-y rounded-xl border border-outline-variant/40 bg-surface px-4 py-3 text-body-sm text-on-surface focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/60"
          />
        </label>
        <div className="flex flex-wrap justify-end gap-2">
          {!ticketConfigured && (
            <p className="mr-auto self-center text-label-md text-on-surface-variant">
              Ticket submission is unavailable. Email support@kuvox.ai with this draft.
            </p>
          )}
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-full border border-outline-variant/40 px-4 py-2 text-label-md font-semibold text-on-surface-variant hover:border-primary/40 hover:text-primary disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !idempotencyKey || !sessionId || !ticketConfigured}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-label-md font-semibold text-on-primary hover:opacity-90 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">add_task</span>
            {busy ? "Creating…" : "Create ticket"}
          </button>
        </div>
      </fetcher.Form>
    </div>
  );
}

function ChatMessage({ message }: { message: CacanodeMessage }) {
  const assistant = message.role !== "user";
  return (
    <div className={`flex gap-3 ${assistant ? "max-w-[90%] sm:max-w-[82%]" : "max-w-[90%] sm:max-w-[82%] self-end flex-row-reverse"}`}>
      <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center mt-1 ${assistant ? "bg-primary/20" : "bg-outline-variant/20"}`}>
        <span className={`material-symbols-outlined text-[18px] ${assistant ? "text-primary" : "text-on-surface-variant"}`}>
          {assistant ? "smart_toy" : "person"}
        </span>
      </div>
      <div className="min-w-0">
        <div className={`rounded-2xl px-4 py-3 text-body-sm text-on-surface border shadow-sm ${assistant ? "rounded-tl-sm bg-surface border-outline-variant/20" : "rounded-tr-sm bg-primary/10 border-primary/20"}`}>
          {assistant ? (
            <AnswerContent content={message.content} citations={message.citations ?? []} />
          ) : (
            <p className="whitespace-pre-wrap">{message.content}</p>
          )}
        </div>
        {assistant && <SourceCards citations={message.citations ?? []} />}
      </div>
    </div>
  );
}

function AnswerContent({ content, citations }: { content: string; citations: CacanodeCitation[] }) {
  const segments = citationSegments(content, citations);
  return (
    <p className="whitespace-pre-wrap leading-relaxed">
      {segments.map((segment, index) => segment.citation?.public_url ? (
        <a
          key={`${segment.citation.id}-${index}`}
          href={segment.citation.public_url}
          target="_blank"
          rel="noopener noreferrer"
          title={`Open source: ${segment.citation.source_name}`}
          className="mx-1 inline-flex rounded-md bg-primary/10 px-1.5 py-0.5 text-label-sm font-semibold text-primary hover:bg-primary/20"
        >
          {segment.citation.id}
        </a>
      ) : (
        <span key={index}>{segment.text}</span>
      ))}
    </p>
  );
}

function SourceCards({ citations }: { citations: CacanodeCitation[] }) {
  const sources = publicSourceCitations(citations);
  if (sources.length === 0) return null;

  return (
    <div className="mt-3 border-t border-outline-variant/30 pt-3">
      <p className="mb-2 text-label-sm font-semibold uppercase tracking-wide text-on-surface-variant">Sources</p>
      <div className="grid gap-2">
        {sources.map((citation) => (
          <a
            key={citation.document_id}
            href={citation.public_url!}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-3 rounded-xl border border-outline-variant/30 bg-surface-container-low px-3 py-2.5 text-label-md font-medium text-on-surface transition-colors hover:border-primary/40 hover:bg-primary/5"
          >
            <span className="min-w-0 truncate">{citation.source_name}</span>
            <span className="material-symbols-outlined shrink-0 text-[16px] text-primary">open_in_new</span>
          </a>
        ))}
      </div>
    </div>
  );
}

export function citationSegments(content: string, citations: CacanodeCitation[]) {
  const byId = new Map(citations.map((citation) => [citation.id.toUpperCase(), citation]));
  return content.split(/(\[S\d+\])/gi).map((text) => {
    const match = /^\[(S\d+)\]$/i.exec(text);
    return { text, citation: match ? byId.get(match[1].toUpperCase()) : undefined };
  });
}

export function publicSourceCitations(citations: CacanodeCitation[]) {
  const sources = new Map<string, CacanodeCitation>();
  for (const citation of citations) {
    if (citation.public_url && !sources.has(citation.document_id)) {
      sources.set(citation.document_id, citation);
    }
  }
  return Array.from(sources.values());
}

function SupportNotice({ children, tone }: { children: React.ReactNode; tone: "warning" | "error" }) {
  return (
    <div className={`mb-4 rounded-xl border px-4 py-3 text-body-sm ${tone === "error" ? "border-error/30 bg-error-container/15 text-error" : "border-tertiary/30 bg-tertiary-container/10 text-on-surface"}`}>
      {children}
    </div>
  );
}

function actionError(error: unknown, intent: string) {
  const retryAfter = error instanceof CacanodeSupportError ? error.retryAfter : null;
  return { ok: false as const, intent, error: supportErrorMessage(error), retryAfter };
}

function supportErrorMessage(error: unknown) {
  if (error instanceof CacanodeSupportError) {
    if (error.status === 401 || error.status === 403) {
      return "AI support authorization failed. Check the server-side CACANODE_API_TOKEN.";
    }
    if (error.status === 409) return error.message || "That message is already being processed. Please wait and retry.";
    if (error.status === 429) return "AI support is receiving too many requests.";
    if (error.status === 502 || error.status === 503) return "AI support is temporarily unavailable. Please retry the same message.";
    return error.message;
  }
  if (error instanceof Error && error.name === "TimeoutError") {
    return "AI support took too long to respond. Please retry the same message.";
  }
  return "AI support could not complete the request. Please try again.";
}

function isMissingCustomerSession(error: unknown) {
  return error instanceof CacanodeSupportError
    && (error.status === 400 || error.status === 404)
    && /session.*not found/i.test(error.message);
}

function validIdempotencyKey(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= 255 ? normalized : null;
}

function validTicketDraftSignature(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return /^[0-9a-f]{8}$/.test(normalized) ? normalized : null;
}

function validEmail(value: string) {
  return value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function ticketDraftFromMessages(
  messages: CacanodeMessage[],
  fallbackEmail = "",
  submittedSignature: string | null = null,
): TicketDraft | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const action = messages[index]?.action;
    if (!action || action.type !== "ticket_draft") continue;

    const title = typeof action.title === "string" ? action.title.trim() : "";
    const description = typeof action.description === "string" ? action.description.trim() : "";
    if (!title || !description) return null;
    const email = typeof action.customer_email === "string"
      ? action.customer_email.trim()
      : fallbackEmail;
    const signature = ticketDraftSignature(email, title, description);
    if (signature === submittedSignature) return null;
    return { email, title, description, signature };
  }
  return null;
}

export function mergeResponseIntoHistory(
  history: CacanodeMessage[],
  responseMessage: CacanodeMessage,
) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index];
    if (message?.role !== responseMessage.role || message.content !== responseMessage.content) continue;
    const merged = [...history];
    merged[index] = {
      ...message,
      ...responseMessage,
      sequence_number: message.sequence_number ?? responseMessage.sequence_number,
    };
    return merged;
  }
  return [...history, responseMessage];
}

function ticketDraftSignature(email: string, title: string, description: string) {
  const canonical = `${email.trim().toLowerCase()}\u0000${title.trim()}\u0000${description.trim()}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= canonical.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function browserMessageId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const SUPPORT_CONVERSATION_STORAGE_KEY = "kuvox:cacanode-api-support:v1";

interface StoredSupportConversation {
  visitorId: string;
  sessionId: string | null;
  messages: CacanodeMessage[];
  submittedTicketDraftSignature: string | null;
}

function readStoredConversation(): StoredSupportConversation | null {
  try {
    const raw = window.localStorage.getItem(SUPPORT_CONVERSATION_STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<StoredSupportConversation>;
    if (typeof value.visitorId !== "string" || !Array.isArray(value.messages)) return null;
    return {
      visitorId: value.visitorId,
      sessionId: typeof value.sessionId === "string" ? value.sessionId : null,
      messages: value.messages.filter(isStoredMessage),
      submittedTicketDraftSignature: typeof value.submittedTicketDraftSignature === "string"
        ? value.submittedTicketDraftSignature
        : null,
    };
  } catch {
    return null;
  }
}

function persistConversation(conversation: StoredSupportConversation) {
  try {
    window.localStorage.setItem(SUPPORT_CONVERSATION_STORAGE_KEY, JSON.stringify(conversation));
  } catch {
    // Chat remains usable when storage is blocked or full.
  }
}

function clearStoredConversation() {
  try {
    window.localStorage.removeItem(SUPPORT_CONVERSATION_STORAGE_KEY);
  } catch {
    // No-op when browser storage is unavailable.
  }
}

function isStoredMessage(value: unknown): value is CacanodeMessage {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (record.role === "user" || record.role === "assistant")
    && typeof record.content === "string"
    && Array.isArray(record.citations);
}
