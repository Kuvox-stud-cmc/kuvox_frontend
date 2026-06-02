/**
 * Server-rendered placeholder for the client-only editor route. React Router
 * renders this as the route's `HydrateFallback` on the server and during initial
 * hydration; the real `<EditorWorkspace>` (with Redux) mounts only on the client.
 */
export function EditorSkeleton() {
  return (
    <div className="flex h-screen w-full animate-pulse flex-col bg-gray-50">
      <div className="h-12 border-b border-gray-200 bg-white" />
      <div className="flex flex-1">
        <div className="w-72 border-r border-gray-200 bg-white" />
        <div className="flex-1 bg-gray-100" />
        <div className="w-80 border-l border-gray-200 bg-white" />
      </div>
      <div className="h-40 border-t border-gray-200 bg-white" />
    </div>
  );
}
