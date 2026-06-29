/**
 * Server-rendered placeholder for the client-only editor route. React Router
 * renders this as the route's `HydrateFallback` on the server and during initial
 * hydration; the real `<EditorWorkspace>` (with Redux) mounts only on the client.
 */
export function EditorSkeleton() {
  return (
    <div className="flex h-screen w-full animate-pulse flex-col bg-background">
      <div className="h-toolbar-width border-b border-outline-variant bg-surface" />
      <div className="flex min-h-0 flex-1">
        <div className="hidden w-sidebar-width border-r border-outline-variant bg-surface md:block" />
        <div className="flex-1 bg-surface-container-lowest" />
        <div className="hidden w-14 border-l border-outline-variant bg-surface lg:block" />
      </div>
      <div className="h-[292px] border-t border-outline-variant bg-surface" />
    </div>
  );
}
