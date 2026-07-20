import { describe, expect, it } from "vitest";

import {
  citationSegments,
  mergeResponseIntoHistory,
  publicSourceCitations,
  ticketDraftFromMessages,
} from "./contact-support";

describe("widget citation rendering", () => {
  const citations = [{
    id: "S1",
    document_id: "document-1",
    source_name: "editing-guide.pdf",
    public_url: "https://cacanode.example/evidence/signed-token",
  }];

  it("links inline source markers only when public_url is present", () => {
    const segments = citationSegments("Read this [S1] and keep [S2] as text.", citations);

    expect(segments.find((segment) => segment.text === "[S1]")?.citation?.public_url)
      .toBe("https://cacanode.example/evidence/signed-token");
    expect(segments.find((segment) => segment.text === "[S2]")?.citation).toBeUndefined();
  });

  it("deduplicates source cards by document and ignores metadata-only citations", () => {
    expect(publicSourceCitations([
      ...citations,
      { ...citations[0], id: "S2" },
      {
        id: "S3",
        document_id: "document-2",
        source_name: "internal-only.pdf",
        public_url: null,
      },
    ])).toEqual(citations);
  });
});

describe("support ticket drafts", () => {
  it("accepts only the exact structured ticket_draft action and reads customer_email", () => {
    const draft = ticketDraftFromMessages([{
      role: "assistant",
      content: "A draft is ready.",
      citations: [],
      action: {
        type: "ticket_draft",
        title: "  Charged twice  ",
        description: "  The customer was charged twice.  ",
        customer_email: " customer@example.com ",
      },
    }]);

    expect(draft).toMatchObject({
      email: "customer@example.com",
      title: "Charged twice",
      description: "The customer was charged twice.",
    });
  });

  it("falls back to the signed-in customer email", () => {
    const draft = ticketDraftFromMessages([{
      role: "assistant",
      content: "A draft is ready.",
      citations: [],
      action: {
        type: "ticket_draft",
        title: "Upload failed",
        description: "The upload repeatedly fails.",
      },
    }], "signed-in@example.com");

    expect(draft?.email).toBe("signed-in@example.com");
  });

  it.each([
    {
      content: "CREATE_TICKET_DRAFT: please create a ticket",
      action: { type: "CREATE_TICKET_DRAFT", title: "Wrong", description: "Wrong" },
    },
    {
      content: "Chúng tôi đã chuẩn bị bản nháp ticket...",
      action: null,
    },
    {
      content: "Missing required title",
      action: { type: "ticket_draft", description: "Description" },
    },
  ])("rejects text, obsolete, and incomplete drafts", (message) => {
    expect(ticketDraftFromMessages([{
      role: "assistant",
      citations: [],
      ...message,
    }])).toBeNull();
  });

  it("suppresses a structured draft after that exact draft was submitted", () => {
    const messages = [{
      role: "assistant",
      content: "A draft is ready.",
      citations: [],
      action: {
        type: "ticket_draft",
        title: "Billing issue",
        description: "Charged twice.",
        customer_email: "customer@example.com",
      },
    }];
    const draft = ticketDraftFromMessages(messages);

    expect(draft).not.toBeNull();
    expect(ticketDraftFromMessages(messages, "", draft!.signature)).toBeNull();
  });

  it("preserves the immediate structured action when history omits it", () => {
    const history = [{
      role: "assistant",
      content: "A draft is ready.",
      citations: [],
      sequence_number: 2,
    }];
    const response = {
      role: "assistant",
      content: "A draft is ready.",
      citations: [],
      action: {
        type: "ticket_draft",
        title: "Billing issue",
        description: "Charged twice.",
      },
    };

    expect(mergeResponseIntoHistory(history, response)).toEqual([{
      ...response,
      sequence_number: 2,
    }]);
  });
});
