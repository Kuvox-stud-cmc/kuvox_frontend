/**
 * AI suggestion (follow-up actions) panel — surfaces the LLM's recommended next
 * edits after a command runs. Stub for now.
 */
export function SuggestionsPanel() {
  return (
    <section className="flex h-full flex-col p-4">
      <h2 className="text-sm font-semibold text-gray-700">Suggestions</h2>
      <ul className="mt-2 space-y-2 text-xs text-gray-500">
        <li className="rounded border border-gray-200 p-2">Follow-up action (stub)</li>
        <li className="rounded border border-gray-200 p-2">Follow-up action (stub)</li>
      </ul>
    </section>
  );
}
