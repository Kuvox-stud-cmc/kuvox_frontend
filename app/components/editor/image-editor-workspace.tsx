import { useMemo, useState, type ReactNode } from "react";

import type { ProjectDto } from "~/lib/api";

import { EditorIcon, EditorIconButton } from "./editor-ui";

interface ImageEditorWorkspaceProps {
  projectId: string;
  project?: ProjectDto;
}

const templates = [
  { id: "thumb", label: "Thumbnail", icon: "smart_display" },
  { id: "poster", label: "Poster", icon: "crop_portrait" },
  { id: "social", label: "Social post", icon: "dashboard" },
];

const layers = [
  { id: "title", label: "Title text", icon: "title", active: true },
  { id: "photo", label: "Hero image", icon: "image", active: false },
  { id: "bg", label: "Background", icon: "texture", active: false },
];

export function ImageEditorWorkspace({ projectId, project }: ImageEditorWorkspaceProps) {
  const [editorMode, setEditorMode] = useState<"manual" | "ai">("manual");
  const projectTitle = project?.name?.trim() || `Image project ${projectId.slice(0, 8)}`;
  const artboardLabel = useMemo(() => projectTitle.slice(0, 2).toUpperCase(), [projectTitle]);

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-[#101113] text-[#f2f3f5]">
      <header className="grid h-12 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b border-white/10 bg-[#18191c] px-3">
        <div className="flex min-w-0 items-center gap-3">
          <EditorIcon className="text-[22px] text-primary">image</EditorIcon>
          <div className="min-w-0">
            <h1 className="truncate text-body-sm font-semibold">{projectTitle}</h1>
            <p className="text-label-sm uppercase tracking-wide text-white/45">Image editor</p>
          </div>
        </div>

        <div className="flex items-center rounded-[6px] border border-white/10 bg-black/20 p-1">
          {(["manual", "ai"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setEditorMode(mode)}
              className={`flex h-8 items-center gap-1 rounded-[4px] px-3 text-label-md font-semibold transition-colors ${
                editorMode === mode
                  ? "bg-white/12 text-white"
                  : "text-white/55 hover:text-white"
              }`}
            >
              {mode === "ai" ? <EditorIcon className="text-[16px]">auto_awesome</EditorIcon> : null}
              {mode === "ai" ? "AI" : "Manual"}
            </button>
          ))}
        </div>

        <div className="flex justify-end gap-1">
          <EditorIconButton icon="undo" label="Undo" className="h-8 w-8" />
          <EditorIconButton icon="redo" label="Redo" className="h-8 w-8" />
          <button
            type="button"
            className="ml-2 inline-flex h-8 items-center gap-2 rounded-[4px] bg-primary px-3 text-label-md font-semibold text-on-primary"
          >
            <EditorIcon className="text-[16px]">ios_share</EditorIcon>
            Export
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[280px_minmax(0,1fr)_320px]">
        <aside className="min-h-0 border-r border-white/10 bg-[#151619]">
          <PanelTitle icon="perm_media" title="Media and templates" />
          <div className="space-y-5 p-3">
            <section>
              <h2 className="mb-2 text-label-sm font-semibold uppercase tracking-wide text-white/45">
                Templates
              </h2>
              <div className="grid grid-cols-3 gap-2">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    className="flex aspect-square flex-col items-center justify-center gap-2 rounded-[6px] border border-white/10 bg-white/[0.04] text-label-sm text-white/70 hover:border-primary/50 hover:text-white"
                  >
                    <EditorIcon className="text-[22px]">{template.icon}</EditorIcon>
                    <span className="max-w-full truncate px-1">{template.label}</span>
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h2 className="mb-2 text-label-sm font-semibold uppercase tracking-wide text-white/45">
                Project media
              </h2>
              <div className="space-y-2">
                {["Cover_photo.png", "Product_cutout.png", "Brand_texture.jpg"].map((asset, index) => (
                  <button
                    key={asset}
                    type="button"
                    className="flex w-full items-center gap-3 rounded-[6px] border border-white/10 bg-white/[0.035] p-2 text-left hover:border-primary/50"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[4px] bg-gradient-to-br from-primary/35 via-secondary/20 to-tertiary/30">
                      <EditorIcon className="text-[20px] text-white/70">{index === 1 ? "category" : "image"}</EditorIcon>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-label-md font-semibold text-white/85">{asset}</p>
                      <p className="text-label-sm text-white/45">Ready</p>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </aside>

        <main className="relative min-h-0 overflow-hidden bg-[#0d0e10]">
          <div className="absolute inset-x-0 top-0 z-10 flex h-10 items-center justify-center gap-1 border-b border-white/10 bg-[#141518]/90">
            {["select_all", "title", "imagesmode", "crop", "tune"].map((icon) => (
              <EditorIconButton key={icon} icon={icon} label={icon.replace("_", " ")} className="h-8 w-8" />
            ))}
          </div>
          <div className="flex h-full items-center justify-center p-10 pt-16">
            <div className="relative aspect-[4/5] h-[min(72vh,760px)] max-h-full overflow-hidden rounded-[8px] bg-[#f6f1e9] shadow-2xl shadow-black/40">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(192,193,255,0.32),transparent_30%),linear-gradient(150deg,#f6f1e9_0%,#d7eef0_52%,#f5d3c8_100%)]" />
              <div className="absolute left-[12%] top-[12%] flex h-[34%] w-[76%] items-center justify-center rounded-[8px] bg-black/80 text-[clamp(2rem,8vh,5rem)] font-bold text-white">
                {artboardLabel}
              </div>
              <div className="absolute bottom-[18%] left-[10%] right-[10%]">
                <p className="text-[clamp(1.2rem,4vh,3rem)] font-black leading-none text-[#17191f]">
                  {projectTitle}
                </p>
                <p className="mt-3 max-w-[80%] text-[clamp(0.75rem,1.8vh,1rem)] font-semibold uppercase tracking-wide text-[#4f5965]">
                  Composition scaffold
                </p>
              </div>
            </div>
          </div>
        </main>

        <aside className="min-h-0 border-l border-white/10 bg-[#151619]">
          <PanelTitle icon="layers" title="Layers and properties" />
          <div className="border-b border-white/10 p-3">
            <h2 className="mb-2 text-label-sm font-semibold uppercase tracking-wide text-white/45">Layers</h2>
            <div className="space-y-1">
              {layers.map((layer) => (
                <button
                  key={layer.id}
                  type="button"
                  className={`flex h-9 w-full items-center gap-2 rounded-[4px] px-2 text-left text-label-md ${
                    layer.active
                      ? "bg-primary/20 text-white"
                      : "text-white/65 hover:bg-white/[0.05] hover:text-white"
                  }`}
                >
                  <EditorIcon className="text-[18px]">{layer.icon}</EditorIcon>
                  <span className="min-w-0 flex-1 truncate">{layer.label}</span>
                  <EditorIcon className="text-[16px] text-white/35">drag_indicator</EditorIcon>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4 p-3">
            <PropertyGroup title="Transform">
              <PropertyRow label="X" value="120 px" />
              <PropertyRow label="Y" value="96 px" />
              <PropertyRow label="Scale" value="100%" />
              <PropertyRow label="Rotate" value="0deg" />
            </PropertyGroup>
            <PropertyGroup title={editorMode === "ai" ? "AI edit" : "Appearance"}>
              {editorMode === "ai" ? (
                <textarea
                  rows={4}
                  className="w-full resize-none rounded-[6px] border border-white/10 bg-black/20 p-2 text-body-sm text-white outline-none placeholder:text-white/35 focus:border-primary/60"
                  placeholder="Describe the image edit..."
                />
              ) : (
                <>
                  <PropertyRow label="Opacity" value="100%" />
                  <PropertyRow label="Blend" value="Normal" />
                  <PropertyRow label="Shadow" value="Soft" />
                </>
              )}
            </PropertyGroup>
          </div>
        </aside>
      </div>
    </div>
  );
}

function PanelTitle({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex h-12 items-center gap-2 border-b border-white/10 px-3">
      <EditorIcon className="text-[18px] text-primary">{icon}</EditorIcon>
      <h2 className="text-label-md font-semibold uppercase tracking-wide text-white/70">{title}</h2>
    </div>
  );
}

function PropertyGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-label-sm font-semibold uppercase tracking-wide text-white/45">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function PropertyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[1fr_96px] items-center gap-3">
      <span className="text-label-md text-white/55">{label}</span>
      <div className="rounded-[4px] border border-white/10 bg-black/20 px-2 py-1 text-right text-label-md text-white/80">
        {value}
      </div>
    </div>
  );
}
