import { editorProject, type EditorProjectMock } from "../mock-editor-data";
import { EditorIcon, EditorIconButton } from "../editor-ui";

interface PreviewPanelProps {
  project: EditorProjectMock;
}

/**
 * Preview playback panel — renders the current timeline output. Stub for now.
 */
export function PreviewPanel({ project = editorProject }: Partial<PreviewPanelProps>) {
  return (
    <main className="flex min-w-0 flex-1 flex-col bg-surface-container-lowest">
      <div className="relative flex flex-1 items-center justify-center p-5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(192,193,255,0.05),transparent_48%)]" />
        <div className="relative aspect-video w-full max-w-5xl overflow-hidden rounded-[6px] border border-outline-variant bg-black shadow-[0_18px_50px_rgba(0,0,0,0.38)]">
          <div className="absolute inset-[1px]" style={{ background: project.previewGradient }} />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_58%_24%,rgba(255,255,255,0.18),transparent_27%),linear-gradient(to_top,rgba(0,0,0,0.5),rgba(0,0,0,0.08)_46%,rgba(0,0,0,0.22))]" />
          <div className="absolute bottom-4 left-4 rounded-[4px] border border-white/15 bg-black/35 px-2 py-1 text-label-sm font-semibold uppercase tracking-[0.08em] text-white/75">
            Program monitor
          </div>
          <div className="absolute bottom-4 right-4 rounded-[4px] border border-white/15 bg-black/35 px-2 py-1 font-mono text-[10px] text-white/75">
            {project.previewTitle}
          </div>
          <div className="absolute inset-4 grid grid-cols-3 grid-rows-3 border border-outline/30 opacity-0 transition-opacity hover:opacity-100">
            {Array.from({ length: 9 }).map((_, index) => (
              <div
                key={index}
                className={`${index % 3 !== 2 ? "border-r border-outline/30" : ""} ${
                  index < 6 ? "border-b border-outline/30" : ""
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="grid h-16 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-t border-outline-variant bg-surface px-5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="rounded-[4px] border border-outline-variant bg-surface-container-high px-2 py-1 font-mono text-label-md font-semibold tracking-widest text-primary">
            {project.currentTime}
          </span>
          <span className="hidden truncate text-label-md text-on-surface-variant sm:block">/ {project.duration}</span>
        </div>

        <div className="flex items-center justify-center gap-2 sm:gap-3">
          <EditorIconButton icon="skip_previous" label="Previous" className="h-8 w-8" />
          <EditorIconButton icon="fast_rewind" label="Rewind" className="h-8 w-8" />
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-on-primary shadow-sm transition-opacity hover:opacity-90"
            aria-label="Play"
          >
            <EditorIcon filled>play_arrow</EditorIcon>
          </button>
          <EditorIconButton icon="fast_forward" label="Forward" className="h-8 w-8" />
          <EditorIconButton icon="skip_next" label="Next" className="h-8 w-8" />
        </div>

        <div className="flex items-center justify-end gap-2">
          <EditorIconButton icon="volume_up" label="Volume" className="h-8 w-8" />
          <EditorIconButton icon="fullscreen" label="Fullscreen" className="h-8 w-8" />
        </div>
      </div>
    </main>
  );
}
