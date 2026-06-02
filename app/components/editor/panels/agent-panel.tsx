/**
 * AI agent (verbal commands) panel — the conversational command interface where
 * the user types concrete or abstract editing directions. Stub for now.
 */
export function AgentPanel() {
  return (
    <section className="flex h-full flex-col p-4">
      <h2 className="text-sm font-semibold text-gray-700">AI Agent</h2>
      <p className="mt-1 text-xs text-gray-500">
        Type a command — "trim clip 3 from 5 to 12s" or "make this more engaging".
      </p>
      <div className="mt-auto">
        <input
          type="text"
          disabled
          placeholder="Command input (stub)"
          className="w-full rounded border border-gray-200 px-3 py-2 text-sm"
        />
      </div>
    </section>
  );
}
