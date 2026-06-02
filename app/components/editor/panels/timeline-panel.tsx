import { useAppSelector } from "~/store/hooks";

/**
 * Manual editing surface — the conventional timeline where shots/operations are
 * arranged. Reads from the editor slice. Stub for now.
 */
export function TimelinePanel() {
  const operations = useAppSelector((state) => state.editor.timeline);

  return (
    <section className="flex h-full flex-col p-3">
      <h2 className="text-sm font-semibold text-gray-700">Timeline</h2>
      <div className="mt-2 flex-1 rounded bg-gray-100 p-2 text-xs text-gray-500">
        {operations.length === 0
          ? "No operations yet (stub)"
          : `${operations.length} operation(s)`}
      </div>
    </section>
  );
}
