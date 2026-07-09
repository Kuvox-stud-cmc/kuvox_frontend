import { useState, useMemo, useRef, useEffect } from "react";
import { HexColorPicker } from "react-colorful";
import {
  FormActions,
  GradientThumbnail,
  MetricCard,
  PageHeader,
  SectionHeader,
} from "~/components/dashboard/layout/DashboardPageLayout";
import { Modal, primaryButtonClass, ErrorBanner } from "~/components/dashboard/section";

export function meta() {
  return [{ title: "Brand Kits · Kuvox" }];
}

/* ── Type Definitions ────────────────────────────────────────────────────── */

interface ColorPalette {
  name: string;
  colors: string[];
}

interface BrandAsset {
  id: string;
  name: string;
  size: string;
  type: string;
  url?: string; // used for image/svg preview
}

interface BrandKit {
  id: string;
  name: string;
  projects: number;
  updatedAgo: string;
  palettes: ColorPalette[];
  fonts: BrandAsset[];
  logos: BrandAsset[];
  images: BrandAsset[];
  illustrations: BrandAsset[];
  icons: BrandAsset[];
  audio: BrandAsset[];
  templates: BrandAsset[];
  isDefault?: boolean;
}

/* ── Initial Mock Data ───────────────────────────────────────────────────── */

const INITIAL_KITS: BrandKit[] = [
  {
    id: "bk1",
    name: "Kuvox Default",
    projects: 8,
    updatedAgo: "Just now",
    isDefault: true,
    palettes: [
      { name: "Primary Colors", colors: ["#6C5CE7", "#00B894", "#FDCB6E", "#2D3436"] },
      { name: "Accent Gradients", colors: ["#FF7675", "#74B9FF", "#A29BFE"] }
    ],
    fonts: [
      { id: "f1", name: "Inter-Regular.woff2", size: "124 KB", type: ".woff2" },
      { id: "f2", name: "Outfit-Bold.ttf", size: "380 KB", type: ".ttf" }
    ],
    logos: [
      { id: "l1", name: "Kuvox-Full-Logo.svg", size: "12 KB", type: ".svg" },
      { id: "l2", name: "Kuvox-Icon.png", size: "48 KB", type: ".png" }
    ],
    images: [
      { id: "im1", name: "Hero-Banner.webp", size: "1.2 MB", type: ".webp" },
      { id: "im2", name: "Office-Culture.jpg", size: "840 KB", type: ".jpg" }
    ],
    illustrations: [
      { id: "il1", name: "Tech-Stack-Illustration.svg", size: "185 KB", type: ".svg" }
    ],
    icons: [
      { id: "ic1", name: "play-circle.svg", size: "4 KB", type: ".svg" },
      { id: "ic2", name: "settings-gear.svg", size: "6 KB", type: ".svg" }
    ],
    audio: [
      { id: "au1", name: "Intro-Sonic-Jingle.mp3", size: "420 KB", type: ".mp3" }
    ],
    templates: [
      { id: "t1", name: "Vlog-Intro-Preset.fig", size: "2.4 MB", type: ".fig" }
    ]
  },
  {
    id: "bk2",
    name: "Studio Noir",
    projects: 3,
    updatedAgo: "1 week ago",
    palettes: [
      { name: "Noir Themes", colors: ["#1A1A2E", "#E94560", "#F5F5F5", "#533483"] }
    ],
    fonts: [
      { id: "f3", name: "PlayfairDisplay-Medium.ttf", size: "210 KB", type: ".ttf" }
    ],
    logos: [
      { id: "l3", name: "Noir-Logo-Outline.eps", size: "1.8 MB", type: ".eps" }
    ],
    images: [],
    illustrations: [],
    icons: [],
    audio: [],
    templates: []
  },
  {
    id: "bk3",
    name: "Travel Channel",
    projects: 5,
    updatedAgo: "3 days ago",
    palettes: [
      { name: "Ocean & Sand", colors: ["#0984E3", "#00CEC9", "#FFEAA7", "#2D3436"] }
    ],
    fonts: [
      { id: "f4", name: "WorkSans-Regular.woff", size: "98 KB", type: ".woff" }
    ],
    logos: [
      { id: "l4", name: "Travel-Wave-Icon.svg", size: "18 KB", type: ".svg" }
    ],
    images: [],
    illustrations: [],
    icons: [],
    audio: [],
    templates: []
  }
];

const ALLOWED_EXTENSIONS: Record<string, string[]> = {
  logos: [".svg", ".png", ".ai", ".eps", ".pdf"],
  graphics: [".svg", ".ai", ".eps", ".png"],
  images: [".jpg", ".jpeg", ".png", ".webp"],
  icons: [".svg", ".png", ".ico"],
  audio: [".mp3", ".wav", ".m4a", ".aac", ".flac"],
  fonts: [".ttf", ".otf", ".woff", ".woff2"],
  templates: [".fig", ".sketch", ".psd", ".zip", ".json"]
};

/* ── Helper: Format file size ───────────────────────────────────────────── */
function formatBytes(bytes: number, decimals = 1) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

/* ── Helper: Parse bulk color codes ───────────────────────────────────────── */
function parseColors(text: string): string[] {
  let matches: string[] = text.match(/#([a-fA-F0-9]{3,8})/g) || [];
  
  if (matches.length === 0) {
    const tokens = text.split(/[\s,;\-]+/);
    tokens.forEach(token => {
      const cleaned = token.trim().replace(/^#/, "");
      if (/^[a-fA-F0-9]{3}$|^[a-fA-F0-9]{6}$|^[a-fA-F0-9]{8}$/.test(cleaned)) {
        matches.push(`#${cleaned}`);
      }
    });
  }
  return matches;
}


/* ── Main Component ─────────────────────────────────────────────────────── */

export default function BrandKits() {
  const [kits, setKits] = useState<BrandKit[]>(INITIAL_KITS);
  const [selectedKitId, setSelectedKitId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newKitName, setNewKitName] = useState("");
  const [newKitFont, setNewKitFont] = useState("Inter");

  // Palette Creation / Bulk Import States
  const [paletteModalOpen, setPaletteModalOpen] = useState(false);
  const [newPaletteName, setNewPaletteName] = useState("");
  const [paletteImportMode, setPaletteImportMode] = useState<"single" | "bulk">("single");
  const [bulkColorText, setBulkColorText] = useState("");

  const parsedPreviewColors = useMemo(() => {
    if (paletteImportMode !== "bulk") return [];
    return parseColors(bulkColorText);
  }, [bulkColorText, paletteImportMode]);

  // Selected Brand Kit active editing states
  const selectedKit = useMemo(() => {
    return kits.find(k => k.id === selectedKitId) || null;
  }, [kits, selectedKitId]);

  const [activeTab, setActiveTab] = useState<string>("logos");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  interface ColorEditorState {
    paletteIdx: number;
    colorIdx: number;
    color: string;
  }
  const [activeColorEditor, setActiveColorEditor] = useState<ColorEditorState | null>(null);

  // Clear errors when changing tab or closing kit
  useEffect(() => {
    setUploadError(null);
  }, [activeTab, selectedKitId]);

  const handleCreateKit = () => {
    if (!newKitName.trim()) return;
    const newKit: BrandKit = {
      id: "bk_" + Date.now(),
      name: newKitName.trim(),
      projects: 0,
      updatedAgo: "Just now",
      palettes: [
        { name: "Colors Palette", colors: ["#3B82F6", "#10B981", "#EF4444"] }
      ],
      fonts: [
        { id: Math.random().toString(), name: `${newKitFont}-Regular.woff2`, size: "115 KB", type: ".woff2" }
      ],
      logos: [],
      images: [],
      illustrations: [],
      icons: [],
      audio: [],
      templates: []
    };
    setKits(prev => [...prev, newKit]);
    setNewKitName("");
    setCreateOpen(false);
    setSelectedKitId(newKit.id);
  };

  const handleUpdateKit = (updated: BrandKit) => {
    setKits(prev => prev.map(k => k.id === updated.id ? { ...updated, updatedAgo: "Just now" } : k));
  };

  // Palette Actions
  const handleRenamePalette = (paletteIndex: number, newName: string) => {
    if (!selectedKit) return;
    const nextPalettes = [...selectedKit.palettes];
    nextPalettes[paletteIndex] = { ...nextPalettes[paletteIndex], name: newName };
    handleUpdateKit({ ...selectedKit, palettes: nextPalettes });
  };

  const handleAddColor = (paletteIndex: number) => {
    if (!selectedKit) return;
    const nextPalettes = [...selectedKit.palettes];
    const newColor = "#FFFFFF";
    const newColorIndex = nextPalettes[paletteIndex].colors.length;
    nextPalettes[paletteIndex] = {
      ...nextPalettes[paletteIndex],
      colors: [...nextPalettes[paletteIndex].colors, newColor]
    };
    handleUpdateKit({ ...selectedKit, palettes: nextPalettes });
    setActiveColorEditor({
      paletteIdx: paletteIndex,
      colorIdx: newColorIndex,
      color: newColor
    });
  };

  const handleEditColor = (paletteIndex: number, colorIndex: number, hex: string) => {
    if (!selectedKit) return;
    const nextPalettes = [...selectedKit.palettes];
    const nextColors = [...nextPalettes[paletteIndex].colors];
    nextColors[colorIndex] = hex;
    nextPalettes[paletteIndex] = { ...nextPalettes[paletteIndex], colors: nextColors };
    handleUpdateKit({ ...selectedKit, palettes: nextPalettes });
  };

  const handleDeleteColor = (paletteIndex: number, colorIndex: number) => {
    if (!selectedKit) return;
    const nextPalettes = [...selectedKit.palettes];
    const nextColors = nextPalettes[paletteIndex].colors.filter((_, idx) => idx !== colorIndex);
    nextPalettes[paletteIndex] = { ...nextPalettes[paletteIndex], colors: nextColors };
    handleUpdateKit({ ...selectedKit, palettes: nextPalettes });
  };

  const handleOpenAddPalette = () => {
    setNewPaletteName("");
    setBulkColorText("");
    setPaletteImportMode("single");
    setPaletteModalOpen(true);
  };

  const handleCreatePalette = () => {
    if (!selectedKit) return;
    
    let colors: string[] = ["#3B82F6"]; // Default starting color
    
    if (paletteImportMode === "bulk") {
      const parsed = parseColors(bulkColorText);
      if (parsed.length > 0) {
        colors = parsed;
      }
    }
    
    const nextPalettes = [
      ...selectedKit.palettes,
      { 
        name: newPaletteName.trim() || (paletteImportMode === "bulk" ? "Imported Palette" : "New Palette"), 
        colors 
      }
    ];
    
    handleUpdateKit({ ...selectedKit, palettes: nextPalettes });
    setPaletteModalOpen(false);
  };

  const handleDeletePalette = (paletteIndex: number) => {
    if (!selectedKit) return;
    const nextPalettes = selectedKit.palettes.filter((_, idx) => idx !== paletteIndex);
    handleUpdateKit({ ...selectedKit, palettes: nextPalettes });
  };

  // Asset Uploading Actions
  const handleAssetUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedKit || !e.target.files) return;
    setUploadError(null);
    const files = Array.from(e.target.files);
    
    // Map tab to category key & check allowed extensions
    const categoryKey = activeTab === "illustrations" ? "graphics" : activeTab;
    const allowed = ALLOWED_EXTENSIONS[categoryKey] || [];

    const validFiles: BrandAsset[] = [];
    let hasInvalid = false;

    files.forEach(file => {
      const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
      if (!allowed.includes(ext)) {
        hasInvalid = true;
      } else {
        const url = file.type.startsWith("image/") || ext === ".svg"
          ? URL.createObjectURL(file)
          : undefined;
        validFiles.push({
          id: "as_" + Math.random().toString(),
          name: file.name,
          size: formatBytes(file.size),
          type: ext,
          url
        });
      }
    });

    if (hasInvalid) {
      setUploadError(`Some files were rejected. Allowed formats: ${allowed.join(", ")}`);
    }

    if (validFiles.length > 0) {
      const field = activeTab as keyof BrandKit;
      const currentList = (selectedKit[field] as BrandAsset[]) || [];
      handleUpdateKit({
        ...selectedKit,
        [field]: [...currentList, ...validFiles]
      });
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDeleteAsset = (field: keyof BrandKit, assetId: string) => {
    if (!selectedKit) return;
    const currentList = (selectedKit[field] as BrandAsset[]) || [];
    const nextList = currentList.filter(a => a.id !== assetId);
    handleUpdateKit({
      ...selectedKit,
      [field]: nextList
    });
  };

  // Metrics calculations
  const totalKitsCount = kits.length;
  const activeProjectsCount = kits.reduce((acc, k) => acc + k.projects, 0);
  const colorPalettesCount = kits.reduce((acc, k) => acc + k.palettes.length, 0);
  const fontCount = kits.reduce((acc, k) => acc + k.fonts.length, 0);

  /* ── VIEW 1: Editor/Detail View ────────────────────────────────────────── */

  if (selectedKit) {
    const tabsList = [
      { id: "logos", label: "Brand Logos", icon: "qr_code_2", count: selectedKit.logos.length },
      { id: "palettes", label: "Color Palettes", icon: "palette", count: selectedKit.palettes.length },
      { id: "fonts", label: "Typography", icon: "text_fields", count: selectedKit.fonts.length },
      { id: "images", label: "Brand Images", icon: "image", count: selectedKit.images.length },
      { id: "illustrations", label: "Illustrations", icon: "brush", count: selectedKit.illustrations.length },
      { id: "icons", label: "Icons", icon: "emoji_symbols", count: selectedKit.icons.length },
      { id: "audio", label: "Audio Assets", icon: "music_note", count: selectedKit.audio.length },
      { id: "templates", label: "Templates", icon: "view_quilt", count: selectedKit.templates.length }
    ];

    const currentCategoryKey = activeTab === "illustrations" ? "graphics" : activeTab;
    const currentAllowedFormats = ALLOWED_EXTENSIONS[currentCategoryKey] || [];

    return (
      <section className="space-y-6">
        {/* Detail Header */}
        <div className="flex flex-col gap-4 border-b border-outline-variant pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => setSelectedKitId(null)}
              className="group flex items-center gap-1 text-label-md text-on-surface-variant hover:text-on-surface"
            >
              <span className="material-symbols-outlined text-[16px] transition-transform group-hover:-translate-x-0.5">
                arrow_back
              </span>
              Back to Brand Kits
            </button>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={selectedKit.name}
                onChange={(e) => handleUpdateKit({ ...selectedKit, name: e.target.value })}
                className="bg-transparent text-headline-lg font-bold text-on-surface focus:outline-none focus:ring-1 focus:ring-primary focus:rounded px-1.5 -ml-1.5"
                title="Click to rename Brand Kit"
              />
              {selectedKit.isDefault && (
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-label-sm font-semibold text-primary">
                  Default
                </span>
              )}
            </div>
            <p className="text-body-sm text-on-surface-variant">
              Active in {selectedKit.projects} projects · {selectedKit.updatedAgo}
            </p>
          </div>
        </div>

        {/* Dynamic Split Layout */}
        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Side Tabs Navigation */}
          <aside className="w-full shrink-0 lg:w-64">
            <nav className="flex flex-row overflow-x-auto pb-2 gap-1 lg:flex-col lg:overflow-x-visible lg:pb-0">
              {tabsList.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left text-body-sm font-medium transition-colors whitespace-nowrap lg:w-full ${
                    activeTab === tab.id
                      ? "bg-primary text-on-primary shadow-md"
                      : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">{tab.icon}</span>
                  <span className="flex-1">{tab.label}</span>
                  <span className={`rounded-full px-2 py-0.5 text-label-sm ${
                    activeTab === tab.id ? "bg-on-primary/20 text-on-primary" : "bg-surface-container-highest text-on-surface-variant"
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </nav>
          </aside>

          {/* Active Tab Workspace Panel */}
          <div className="flex-1 rounded-2xl border border-outline-variant bg-surface-container-low p-6">
            <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-title-lg font-bold text-on-surface">
                  {tabsList.find(t => t.id === activeTab)?.label}
                </h2>
                <p className="text-label-md text-on-surface-variant">
                  {activeTab === "palettes"
                    ? "Manage, name, and edit your brand's color palettes."
                    : `Upload and manage brand assets in ${currentAllowedFormats.join(", ")} formats.`}
                </p>
              </div>

              {/* Action trigger for Palettes or File Upload trigger */}
              {activeTab === "palettes" ? (
                <button
                  type="button"
                  onClick={handleOpenAddPalette}
                  className={primaryButtonClass()}
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  Add Palette
                </button>
              ) : (
                <div>
                  <input
                    ref={fileInputRef}
                    id="brand-file-uploader"
                    type="file"
                    multiple
                    accept={currentAllowedFormats.map(ext => ext === ".jpg" ? ".jpeg,.jpg" : ext).join(",")}
                    onChange={handleAssetUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={primaryButtonClass()}
                  >
                    <span className="material-symbols-outlined text-[18px]">upload</span>
                    Upload Files
                  </button>
                </div>
              )}
            </div>

            {uploadError && <ErrorBanner message={uploadError} />}

            {/* Render Workspaces based on current Tab */}

            {/* TAB: COLOR PALETTES */}
            {activeTab === "palettes" && (
              <div className="space-y-8">
                {selectedKit.palettes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <span className="material-symbols-outlined text-[48px] text-outline">palette</span>
                    <h3 className="mt-3 text-body-sm font-bold text-on-surface">No palettes yet</h3>
                    <p className="mt-1 text-label-md text-on-surface-variant">Create a custom palette to start.</p>
                  </div>
                ) : (
                  selectedKit.palettes.map((palette, paletteIdx) => (
                    <div key={paletteIdx} className="rounded-xl border border-outline-variant bg-surface-container p-5">
                      <div className="mb-4 flex items-center justify-between gap-4">
                        <input
                          type="text"
                          value={palette.name}
                          onChange={(e) => handleRenamePalette(paletteIdx, e.target.value)}
                          className="bg-transparent font-bold text-on-surface focus:outline-none focus:ring-1 focus:ring-primary focus:rounded px-1.5 -ml-1.5"
                          title="Click to rename palette"
                        />
                        <button
                          type="button"
                          onClick={() => handleDeletePalette(paletteIdx)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-error hover:bg-error/10"
                          title="Delete Palette"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                      
                      {/* Swatches Grid */}
                      <div className="flex flex-wrap gap-4">
                        {palette.colors.map((color, colorIdx) => {
                          const isEditing = activeColorEditor?.paletteIdx === paletteIdx && activeColorEditor?.colorIdx === colorIdx;
                          return (
                            <div
                              key={colorIdx}
                              className="group/swatch relative flex flex-col items-center rounded-lg border border-outline-variant bg-surface-container-high p-2 shadow-sm"
                            >
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isEditing) {
                                    setActiveColorEditor(null);
                                  } else {
                                    setActiveColorEditor({ paletteIdx, colorIdx, color });
                                  }
                                }}
                                className="h-14 w-20 rounded cursor-pointer border border-outline-variant/30 shadow-inner transition-transform hover:scale-105"
                                style={{ background: color }}
                                title="Click to change color"
                              />
                              <div className="mt-2 flex items-center justify-center gap-1.5">
                                <span className="text-label-sm font-mono font-medium text-on-surface-variant">
                                  {color.startsWith("linear-gradient") ? "Gradient" : color.toUpperCase()}
                                </span>
                              </div>
                              {/* Delete swatch on hover */}
                              <button
                                type="button"
                                onClick={() => handleDeleteColor(paletteIdx, colorIdx)}
                                className="absolute -right-1.5 -top-1.5 hidden h-5 w-5 items-center justify-center rounded-full bg-error text-on-error shadow group-hover/swatch:flex"
                                title="Delete Swatch"
                              >
                                <span className="material-symbols-outlined text-[12px] font-bold">close</span>
                              </button>

                              {/* Inline Color Picker Popover */}
                              {isEditing && (
                                <ColorPickerPopover
                                  color={activeColorEditor.color}
                                  paletteName={palette.name}
                                  onColorChange={(newHex) => {
                                    setActiveColorEditor({ ...activeColorEditor, color: newHex });
                                    handleEditColor(paletteIdx, colorIdx, newHex);
                                  }}
                                  onRenamePalette={(newName) => handleRenamePalette(paletteIdx, newName)}
                                  onClose={() => setActiveColorEditor(null)}
                                />
                              )}
                            </div>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => handleAddColor(paletteIdx)}
                          className="flex h-24 w-20 flex-col items-center justify-center rounded-lg border-2 border-dashed border-outline-variant hover:border-primary/50 hover:bg-surface-container-low text-on-surface-variant transition-colors"
                        >
                          <span className="material-symbols-outlined text-[20px]">add</span>
                          <span className="text-[10px] font-medium mt-1">Add color</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB: BRAND LOGOS */}
            {activeTab === "logos" && (
              <div>
                {selectedKit.logos.length === 0 ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-outline-variant bg-surface-container p-12 text-center hover:bg-surface-container-high transition-colors"
                  >
                    <span className="material-symbols-outlined text-[48px] text-primary">qr_code_2</span>
                    <h3 className="mt-4 text-body-sm font-bold text-on-surface">No logos uploaded</h3>
                    <p className="mt-1 text-label-md text-on-surface-variant">
                      Drag and drop your logo files here, or click to browse.
                    </p>
                    <p className="mt-2 text-label-sm text-on-surface-variant/50">
                      Supports SVG, PNG, AI, EPS, PDF
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    {selectedKit.logos.map((logo) => (
                      <div key={logo.id} className="group relative overflow-hidden rounded-xl border border-outline-variant bg-surface-container shadow-sm transition-colors hover:border-primary/30">
                        <div className="flex aspect-video items-center justify-center bg-surface-container-highest p-4">
                          {logo.url ? (
                            <img src={logo.url} alt="" className="max-h-full max-w-full object-contain" />
                          ) : (
                            <span className="material-symbols-outlined text-[36px] text-on-surface-variant">description</span>
                          )}
                        </div>
                        <div className="p-3">
                          <h4 className="truncate text-label-md font-bold text-on-surface" title={logo.name}>
                            {logo.name}
                          </h4>
                          <div className="mt-1 flex items-center justify-between text-[11px] text-on-surface-variant">
                            <span className="font-mono uppercase">{logo.type.replace(".", "")}</span>
                            <span>{logo.size}</span>
                          </div>
                        </div>
                        {/* Hover Overlay Delete Button */}
                        <button
                          type="button"
                          onClick={() => handleDeleteAsset("logos", logo.id)}
                          className="absolute right-2 top-2 hidden h-7 w-7 items-center justify-center rounded-lg bg-surface/75 text-error backdrop-blur hover:bg-error hover:text-on-error shadow group-hover:flex"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: TYPOGRAPHY */}
            {activeTab === "fonts" && (
              <div className="space-y-4">
                {selectedKit.fonts.length === 0 ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-outline-variant bg-surface-container p-12 text-center hover:bg-surface-container-high transition-colors"
                  >
                    <span className="material-symbols-outlined text-[48px] text-primary">text_fields</span>
                    <h3 className="mt-4 text-body-sm font-bold text-on-surface">No custom fonts uploaded</h3>
                    <p className="mt-1 text-label-md text-on-surface-variant">
                      Upload font files to maintain typography consistency.
                    </p>
                    <p className="mt-2 text-label-sm text-on-surface-variant/50">
                      Supports TTF, OTF, WOFF, WOFF2
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedKit.fonts.map((font) => (
                      <div key={font.id} className="group relative flex items-center justify-between gap-4 rounded-xl border border-outline-variant bg-surface-container p-4">
                        <div className="min-w-0 flex-1">
                          <h4 className="truncate text-body-sm font-bold text-on-surface" title={font.name}>
                            {font.name.replace(font.type, "")}
                          </h4>
                          <p className="mt-1 font-mono text-[10px] text-on-surface-variant">
                            {font.type.replace(".", "").toUpperCase()} · {font.size}
                          </p>
                          <div className="mt-3 border-t border-outline-variant/30 pt-3">
                            <span className="text-headline-sm font-semibold text-on-surface" style={{ fontFamily: font.name.replace(font.type, "") }}>
                              AaBbCc - Brand Typography Preview
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteAsset("fonts", font.id)}
                          className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant hover:bg-error/10 hover:text-error"
                          title="Delete Font"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: BRAND IMAGES */}
            {activeTab === "images" && (
              <div>
                {selectedKit.images.length === 0 ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-outline-variant bg-surface-container p-12 text-center hover:bg-surface-container-high transition-colors"
                  >
                    <span className="material-symbols-outlined text-[48px] text-primary">image</span>
                    <h3 className="mt-4 text-body-sm font-bold text-on-surface">No images uploaded</h3>
                    <p className="mt-1 text-label-md text-on-surface-variant">
                      Upload photographic branding assets here.
                    </p>
                    <p className="mt-2 text-label-sm text-on-surface-variant/50">
                      Supports JPG, JPEG, PNG, WEBP
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    {selectedKit.images.map((img) => (
                      <div key={img.id} className="group relative overflow-hidden rounded-xl border border-outline-variant bg-surface-container shadow-sm transition-colors hover:border-primary/30">
                        <div className="relative aspect-square bg-surface-container-highest">
                          {img.url ? (
                            <img src={img.url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <span className="material-symbols-outlined text-[36px] text-on-surface-variant">image</span>
                            </div>
                          )}
                        </div>
                        <div className="p-3">
                          <h4 className="truncate text-label-md font-bold text-on-surface" title={img.name}>
                            {img.name}
                          </h4>
                          <p className="mt-1 text-[11px] text-on-surface-variant">{img.size}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteAsset("images", img.id)}
                          className="absolute right-2 top-2 hidden h-7 w-7 items-center justify-center rounded-lg bg-surface/75 text-error backdrop-blur hover:bg-error hover:text-on-error shadow group-hover:flex"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: ILLUSTRATIONS */}
            {activeTab === "illustrations" && (
              <div>
                {selectedKit.illustrations.length === 0 ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-outline-variant bg-surface-container p-12 text-center hover:bg-surface-container-high transition-colors"
                  >
                    <span className="material-symbols-outlined text-[48px] text-primary">brush</span>
                    <h3 className="mt-4 text-body-sm font-bold text-on-surface">No illustrations uploaded</h3>
                    <p className="mt-1 text-label-md text-on-surface-variant">
                      Upload brand illustrations, icons, and vector graphics.
                    </p>
                    <p className="mt-2 text-label-sm text-on-surface-variant/50">
                      Supports SVG, AI, EPS, transparent PNG
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    {selectedKit.illustrations.map((illus) => (
                      <div key={illus.id} className="group relative overflow-hidden rounded-xl border border-outline-variant bg-surface-container shadow-sm transition-colors hover:border-primary/30">
                        <div className="flex aspect-video items-center justify-center bg-surface-container-highest p-4">
                          {illus.url ? (
                            <img src={illus.url} alt="" className="max-h-full max-w-full object-contain" />
                          ) : (
                            <span className="material-symbols-outlined text-[36px] text-on-surface-variant">brush</span>
                          )}
                        </div>
                        <div className="p-3">
                          <h4 className="truncate text-label-md font-bold text-on-surface" title={illus.name}>
                            {illus.name}
                          </h4>
                          <div className="mt-1 flex items-center justify-between text-[11px] text-on-surface-variant">
                            <span className="font-mono uppercase">{illus.type.replace(".", "")}</span>
                            <span>{illus.size}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteAsset("illustrations", illus.id)}
                          className="absolute right-2 top-2 hidden h-7 w-7 items-center justify-center rounded-lg bg-surface/75 text-error backdrop-blur hover:bg-error hover:text-on-error shadow group-hover:flex"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: ICONS */}
            {activeTab === "icons" && (
              <div>
                {selectedKit.icons.length === 0 ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-outline-variant bg-surface-container p-12 text-center hover:bg-surface-container-high transition-colors"
                  >
                    <span className="material-symbols-outlined text-[48px] text-primary">emoji_symbols</span>
                    <h3 className="mt-4 text-body-sm font-bold text-on-surface">No icons uploaded</h3>
                    <p className="mt-1 text-label-md text-on-surface-variant">
                      Upload brand specific icon libraries.
                    </p>
                    <p className="mt-2 text-label-sm text-on-surface-variant/50">
                      Supports SVG, PNG, ICO
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                    {selectedKit.icons.map((icon) => (
                      <div key={icon.id} className="group relative flex flex-col items-center justify-center rounded-xl border border-outline-variant bg-surface-container p-4 hover:border-primary/30">
                        <div className="flex h-12 w-12 items-center justify-center bg-surface-container-highest rounded-lg p-2">
                          {icon.url ? (
                            <img src={icon.url} alt="" className="h-full w-full object-contain" />
                          ) : (
                            <span className="material-symbols-outlined text-[20px] text-on-surface-variant">emoji_symbols</span>
                          )}
                        </div>
                        <span className="mt-2 block w-full truncate text-center text-[10px] text-on-surface" title={icon.name}>
                          {icon.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteAsset("icons", icon.id)}
                          className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-error text-on-error shadow group-hover:flex"
                        >
                          <span className="material-symbols-outlined text-[12px] font-bold">close</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: AUDIO ASSETS */}
            {activeTab === "audio" && (
              <div className="space-y-4">
                {selectedKit.audio.length === 0 ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-outline-variant bg-surface-container p-12 text-center hover:bg-surface-container-high transition-colors"
                  >
                    <span className="material-symbols-outlined text-[48px] text-primary">music_note</span>
                    <h3 className="mt-4 text-body-sm font-bold text-on-surface">No audio assets uploaded</h3>
                    <p className="mt-1 text-label-md text-on-surface-variant">
                      Upload brand music themes, sfx, or voice recordings.
                    </p>
                    <p className="mt-2 text-label-sm text-on-surface-variant/50">
                      Supports MP3, WAV, M4A, AAC, FLAC
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedKit.audio.map((track) => (
                      <div key={track.id} className="group relative flex flex-col gap-3 rounded-xl border border-outline-variant bg-surface-container p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <span className="material-symbols-outlined">audiotrack</span>
                          </div>
                          <div className="min-w-0">
                            <h4 className="truncate text-body-sm font-bold text-on-surface" title={track.name}>
                              {track.name}
                            </h4>
                            <p className="text-[10px] text-on-surface-variant">{track.size}</p>
                          </div>
                        </div>
                        {track.url ? (
                          <audio src={track.url} controls className="h-8 max-w-full sm:w-64" />
                        ) : (
                          <div className="flex items-center gap-2 rounded-lg bg-surface-container-highest px-3 py-1.5 text-label-sm text-on-surface-variant">
                            <span className="material-symbols-outlined text-[16px] animate-pulse">volume_up</span>
                            Mock Audio Waveform Player
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteAsset("audio", track.id)}
                          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg text-on-surface-variant hover:bg-error/10 hover:text-error sm:static sm:h-8 sm:w-8"
                          title="Delete Audio"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: TEMPLATES */}
            {activeTab === "templates" && (
              <div>
                {selectedKit.templates.length === 0 ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-outline-variant bg-surface-container p-12 text-center hover:bg-surface-container-high transition-colors"
                  >
                    <span className="material-symbols-outlined text-[48px] text-primary">view_quilt</span>
                    <h3 className="mt-4 text-body-sm font-bold text-on-surface">No templates uploaded</h3>
                    <p className="mt-1 text-label-md text-on-surface-variant">
                      Upload brand specific presentation, print, or project layout templates.
                    </p>
                    <p className="mt-2 text-label-sm text-on-surface-variant/50">
                      Supports FIG, SKETCH, PSD, ZIP, JSON
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {selectedKit.templates.map((tpl) => (
                      <div key={tpl.id} className="group relative flex items-center gap-3 rounded-xl border border-outline-variant bg-surface-container p-4 hover:border-primary/30">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface-container-highest text-on-surface-variant">
                          <span className="material-symbols-outlined text-[24px]">grid_view</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="truncate text-label-md font-bold text-on-surface" title={tpl.name}>
                            {tpl.name}
                          </h4>
                          <div className="mt-1 flex items-center gap-2 text-[10px] text-on-surface-variant font-mono">
                            <span className="uppercase">{tpl.type.replace(".", "")}</span>
                            <span>·</span>
                            <span>{tpl.size}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteAsset("templates", tpl.id)}
                          className="shrink-0 flex h-7 w-7 items-center justify-center rounded-lg text-on-surface-variant hover:bg-error/10 hover:text-error"
                          title="Delete Template"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

        {/* CREATE COLOR PALETTE / BULK IMPORT MODAL */}
        <Modal open={paletteModalOpen} onClose={() => setPaletteModalOpen(false)} title="Add Color Palette">
          <p className="mb-4 text-body-sm text-on-surface-variant">
            Create a new color palette manually or bulk import color codes.
          </p>
          <div className="space-y-4">
            <div>
              <label htmlFor="palette-name-input" className="block text-label-md text-on-surface-variant">
                Palette name
              </label>
              <input
                id="palette-name-input"
                type="text"
                value={newPaletteName}
                onChange={(e) => setNewPaletteName(e.target.value)}
                placeholder={paletteImportMode === "bulk" ? "Imported Palette" : "New Palette"}
                className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-high px-3 py-2 text-body-sm text-on-surface focus:border-primary focus:outline-none"
              />
            </div>

            {/* Solid / Bulk Mode Switcher */}
            <div className="flex rounded-lg bg-surface-container-high p-0.5">
              <button
                type="button"
                onClick={() => setPaletteImportMode("single")}
                className={`flex-1 rounded-md py-1.5 text-center text-xs font-semibold transition-colors cursor-pointer ${
                  paletteImportMode === "single" ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                Standard Palette
              </button>
              <button
                type="button"
                onClick={() => setPaletteImportMode("bulk")}
                className={`flex-1 rounded-md py-1.5 text-center text-xs font-semibold transition-colors cursor-pointer ${
                  paletteImportMode === "bulk" ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                Bulk Import Colors
              </button>
            </div>

            {paletteImportMode === "bulk" && (
              <div className="space-y-2">
                <div>
                  <label htmlFor="bulk-colors-input" className="block text-label-md text-on-surface-variant">
                    Paste Color Codes
                  </label>
                  <textarea
                    id="bulk-colors-input"
                    rows={4}
                    value={bulkColorText}
                    onChange={(e) => setBulkColorText(e.target.value)}
                    placeholder="e.g. #6C5CE7, #00B894, #FDCB6E&#10;or 6c5ce7-00b894-fdcb6e&#10;or space separated values"
                    className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-high px-3 py-2 text-body-sm font-mono text-on-surface focus:border-primary focus:outline-none"
                  />
                </div>

                {/* Dynamic Preview */}
                {parsedPreviewColors.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="block text-[10px] uppercase font-bold tracking-wider text-on-surface-variant">
                      Parsed colors preview ({parsedPreviewColors.length})
                    </span>
                    <div className="flex flex-wrap gap-2 rounded-xl border border-outline-variant bg-surface-container-high p-3">
                      {parsedPreviewColors.map((color, idx) => (
                        <div
                          key={idx}
                          className="h-7 w-7 rounded-lg border border-outline-variant/30 shadow-sm animate-fadeIn"
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <FormActions
              onCancel={() => setPaletteModalOpen(false)}
              onSubmit={handleCreatePalette}
              submitLabel="Create Palette"
              submitType="button"
            />
          </div>
        </Modal>

      </section>
    );
  }

  /* ── VIEW 2: Brand Kits Listing Page ────────────────────────────────────── */

  return (
    <section className="space-y-10">
      <PageHeader title="Brand Kits" subtitle="Keep colors, fonts, and assets consistent across every project.">
        <button type="button" onClick={() => setCreateOpen(true)} className={primaryButtonClass()}>
          <span className="material-symbols-outlined text-[18px]">add</span>
          Create brand kit
        </button>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon="palette" label="Total Kits" value={totalKitsCount} />
        <MetricCard icon="folder" label="Active Projects" value={activeProjectsCount} tone="secondary" />
        <MetricCard icon="text_fields" label="Typography Fonts" value={fontCount} tone="tertiary" />
        <MetricCard icon="color_lens" label="Color Palettes" value={colorPalettesCount} />
      </div>

      <section>
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="text-headline-md font-bold text-on-surface">Your Brand Kits</h2>
          <span className="text-label-md text-on-surface-variant">{totalKitsCount} kits</span>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {kits.map((kit, index) => {
            // Flatten colors from all palettes to show in color preview card (up to 4 colors)
            const previewColors = kit.palettes.flatMap(p => p.colors).slice(0, 4);

            return (
              <div
                key={kit.id}
                className="group overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-low transition-all hover:border-primary/30"
              >
                {/* Clicking thumbnail opens colors editor directly */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedKitId(kit.id);
                    setActiveTab("palettes");
                  }}
                  className="w-full relative h-32 flex items-center justify-center cursor-pointer overflow-hidden border-b border-outline-variant bg-surface-container-high hover:opacity-90 transition-opacity"
                  title="Click to edit Color Palettes"
                >
                  <div className="flex gap-2">
                    {previewColors.map((color) => (
                      <div
                        key={color}
                        className="h-8 w-8 rounded-lg border border-outline-variant/30 shadow-sm"
                        style={{ background: color }}
                        title={color}
                      />
                    ))}
                    {previewColors.length === 0 && (
                      <span className="text-label-sm text-on-surface-variant/70 font-medium">No Colors Set</span>
                    )}
                  </div>
                  {kit.isDefault && (
                    <span className="absolute left-3 top-3 rounded-full bg-primary px-2.5 py-0.5 text-label-sm font-bold text-on-primary">
                      Default
                    </span>
                  )}
                </button>
                
                <div className="p-5">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div>
                      {/* Clicking title opens default tab (logos) */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedKitId(kit.id);
                          setActiveTab("logos");
                        }}
                        className="text-body-sm font-bold text-on-surface hover:text-primary transition-colors cursor-pointer text-left focus:outline-none"
                      >
                        {kit.name}
                      </button>
                      <p className="mt-0.5 text-label-md text-on-surface-variant">
                        {kit.projects} projects · Updated {kit.updatedAgo}
                      </p>
                    </div>
                  </div>
                  
                  {/* Clicking sections opens specific editor tabs */}
                  <div className="space-y-1.5 text-label-sm text-on-surface-variant">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedKitId(kit.id);
                        setActiveTab("fonts");
                      }}
                      className="w-full flex justify-between items-center hover:text-primary transition-colors cursor-pointer text-left focus:outline-none"
                    >
                      <span className="font-medium text-on-surface">Typography Fonts</span>
                      <span className="flex items-center gap-1">
                        {kit.fonts.length} uploaded
                        <span className="material-symbols-outlined text-[12px]">chevron_right</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedKitId(kit.id);
                        setActiveTab("logos");
                      }}
                      className="w-full flex justify-between items-center hover:text-primary transition-colors cursor-pointer text-left focus:outline-none"
                    >
                      <span className="font-medium text-on-surface">Logos / Assets</span>
                      <span className="flex items-center gap-1">
                        {kit.logos.length + kit.images.length + kit.illustrations.length} assets
                        <span className="material-symbols-outlined text-[12px]">chevron_right</span>
                      </span>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedKitId(kit.id);
                      setActiveTab("logos");
                    }}
                    className="mt-5 w-full rounded-xl border border-outline-variant py-2.5 text-label-md font-bold text-on-surface-variant transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary cursor-pointer"
                  >
                    Edit brand kit
                  </button>
                </div>
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="flex min-h-[290px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-outline-variant bg-surface-container-low text-on-surface-variant transition-all hover:border-primary/40 hover:bg-surface-container hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-[32px]">add</span>
            <span className="mt-2 text-label-md font-bold">Create brand kit</span>
          </button>
        </div>
      </section>

      {/* CREATE BRAND KIT MODAL */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Brand Kit">
        <p className="mb-4 text-body-sm text-on-surface-variant">
          Define your brand assets and palettes to maintain visual consistency.
        </p>
        <div className="space-y-4">
          <div>
            <label htmlFor="kit-name" className="block text-label-md text-on-surface-variant">
              Kit name
            </label>
            <input
              id="kit-name"
              type="text"
              value={newKitName}
              onChange={(e) => setNewKitName(e.target.value)}
              placeholder="My Brand Name"
              className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-high px-3 py-2 text-body-sm text-on-surface focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="kit-primary-font" className="block text-label-md text-on-surface-variant">
              Default font
            </label>
            <input
              id="kit-primary-font"
              type="text"
              value={newKitFont}
              onChange={(e) => setNewKitFont(e.target.value)}
              placeholder="Inter"
              className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-high px-3 py-2 text-body-sm text-on-surface focus:border-primary focus:outline-none"
            />
          </div>
          <FormActions
            onCancel={() => setCreateOpen(false)}
            onSubmit={handleCreateKit}
            submitLabel="Create"
            submitType="button"
          />
        </div>
      </Modal>


    </section>
  );
}

// ── ColorPickerPopover component for Canva/Figma style color editing ──
interface ColorPickerPopoverProps {
  color: string;
  paletteName: string;
  onColorChange: (newColor: string) => void;
  onRenamePalette: (newName: string) => void;
  onClose: () => void;
}

function ColorPickerPopover({
  color,
  paletteName,
  onColorChange,
  onRenamePalette,
  onClose,
}: ColorPickerPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  // Parse if current color is gradient
  const isCurrentGradient = color.startsWith("linear-gradient");

  const [activeTab, setActiveTab] = useState<"solid" | "gradient">(
    isCurrentGradient ? "gradient" : "solid"
  );

  // Gradient state
  const [gradientStop1, setGradientStop1] = useState("#3B82F6");
  const [gradientStop2, setGradientStop2] = useState("#8B5CF6");
  const [activeStop, setActiveStop] = useState<1 | 2>(1);

  // Initialize gradient stops if color is a gradient
  useEffect(() => {
    if (isCurrentGradient) {
      // Parse linear-gradient(135deg, #hex1, #hex2)
      const matches = color.match(/#[a-fA-F0-9]{6,8}/g);
      if (matches && matches.length >= 2) {
        setGradientStop1(matches[0]);
        setGradientStop2(matches[1]);
      }
    }
  }, [color, isCurrentGradient]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    // Delay adding the event listener to avoid picking up the initial click that opened the popover
    const timer = setTimeout(() => {
      document.addEventListener("click", handleClickOutside);
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", handleClickOutside);
    };
  }, [onClose]);

  // Handle color change from react-colorful
  const handlePickerChange = (newColor: string) => {
    if (activeTab === "solid") {
      onColorChange(newColor);
    } else {
      if (activeStop === 1) {
        setGradientStop1(newColor);
        onColorChange(`linear-gradient(135deg, ${newColor}, ${gradientStop2})`);
      } else {
        setGradientStop2(newColor);
        onColorChange(`linear-gradient(135deg, ${gradientStop1}, ${newColor})`);
      }
    }
  };

  // Switch tabs
  const handleTabChange = (newTab: "solid" | "gradient") => {
    setActiveTab(newTab);
    if (newTab === "solid") {
      onColorChange(gradientStop1);
    } else {
      onColorChange(`linear-gradient(135deg, ${gradientStop1}, ${gradientStop2})`);
    }
  };

  const currentPickerColor = activeTab === "solid" ? color : (activeStop === 1 ? gradientStop1 : gradientStop2);

  // Dynamic positioning state
  const [positionStyle, setPositionStyle] = useState<React.CSSProperties>({
    position: "fixed",
    visibility: "hidden", // Hide initially to prevent flashing before position is calculated
  });

  useEffect(() => {
    const popover = popoverRef.current;
    if (!popover) return;

    const updatePosition = () => {
      const rect = popover.getBoundingClientRect();
      const parentRect = popover.parentElement?.getBoundingClientRect();
      if (!parentRect) return;

      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      // popover dimensions
      const popoverWidth = 288; // w-72 is 18rem = 288px
      const popoverHeight = rect.height || 485;

      // Position vertically centered with the parent swatch, clamped inside viewport
      let top = parentRect.top + parentRect.height / 2 - popoverHeight / 2;
      top = Math.max(80, Math.min(top, viewportHeight - popoverHeight - 16));

      // Try placing on the right side of the swatch
      let left = parentRect.right + 12;

      // If it overflows the right edge of the screen, place on the left side of the swatch
      if (left + popoverWidth > viewportWidth - 16) {
        left = parentRect.left - popoverWidth - 12;
        // If it also overflows the left edge of the screen (e.g. mobile), center it
        if (left < 16) {
          left = Math.max(16, (viewportWidth - popoverWidth) / 2);
        }
      }

      setPositionStyle({
        position: "fixed",
        top: `${top}px`,
        left: `${left}px`,
        visibility: "visible",
        zIndex: 9999, // Ensure it is above headers/sidebar overlays
      });
    };

    updatePosition();
    const timer = setTimeout(updatePosition, 50);

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true); // Capture scroll events in scrollable panels
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, []);

  return (
    <div
      ref={popoverRef}
      onClick={(e) => e.stopPropagation()}
      className="w-72 rounded-2xl border border-outline-variant bg-surface-container p-4 shadow-2xl"
      style={{
        ...positionStyle,
        animation: 'fadeInScale 0.15s ease-out forwards'
      }}
    >
      <style>{`
        @keyframes fadeInScale {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
      {/* Palette Name input */}
      <div className="mb-3 space-y-1">
        <div className="flex items-center justify-between">
          <label className="text-[10px] uppercase font-bold tracking-wider text-on-surface-variant font-bold">Palette Name</label>
          <button 
            type="button" 
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface flex items-center justify-center p-0.5 rounded-full hover:bg-surface-container-high transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
        <input
          type="text"
          value={paletteName}
          onChange={(e) => onRenamePalette(e.target.value)}
          className="w-full rounded-lg border border-outline-variant bg-surface-container-high px-2 py-1 text-xs text-on-surface focus:border-primary focus:outline-none"
        />
      </div>

      {/* Solid / Gradient Tabs */}
      <div className="flex rounded-lg bg-surface-container-high p-0.5 mb-4">
        <button
          type="button"
          onClick={() => handleTabChange("solid")}
          className={`flex-1 rounded-md py-1 text-center text-xs font-semibold transition-colors cursor-pointer ${
            activeTab === "solid" ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          Solid
        </button>
        <button
          type="button"
          onClick={() => handleTabChange("gradient")}
          className={`flex-1 rounded-md py-1 text-center text-xs font-semibold transition-colors cursor-pointer ${
            activeTab === "gradient" ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          Gradient
        </button>
      </div>

      {/* Gradient Stops (shown only in Gradient tab) */}
      {activeTab === "gradient" && (
        <div className="mb-4 space-y-2">
          <label className="block text-[10px] uppercase font-bold tracking-wider text-on-surface-variant font-bold">Gradient Stops</label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveStop(1)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                activeStop === 1 ? "border-primary bg-primary/10 text-primary" : "border-outline-variant bg-surface-container-high text-on-surface"
              }`}
            >
              <span className="h-4 w-4 rounded-full border border-outline-variant/30" style={{ backgroundColor: gradientStop1 }} />
              Start
            </button>
            <button
              type="button"
              onClick={() => setActiveStop(2)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                activeStop === 2 ? "border-primary bg-primary/10 text-primary" : "border-outline-variant bg-surface-container-high text-on-surface"
              }`}
            >
              <span className="h-4 w-4 rounded-full border border-outline-variant/30" style={{ backgroundColor: gradientStop2 }} />
              End
            </button>
          </div>
          {/* Gradient Preview Bar */}
          <div 
            className="h-2 w-full rounded-full border border-outline-variant/30" 
            style={{ background: `linear-gradient(90deg, ${gradientStop1}, ${gradientStop2})` }}
          />
        </div>
      )}

      {/* Color Picker Wheel/Canvas */}
      <div className="flex justify-center py-2">
        <div className="custom-color-picker w-full">
          <HexColorPicker
            color={currentPickerColor.startsWith("linear-gradient") ? "#3B82F6" : currentPickerColor}
            onChange={handlePickerChange}
          />
        </div>
      </div>

      {/* Preview & Hex Input */}
      <div className="mt-4 flex items-center gap-3">
        <div
          className="h-10 w-10 shrink-0 rounded-xl border border-outline-variant shadow-inner transition-colors"
          style={{ background: color }}
        />
        <div className="flex-1 space-y-1">
          <input
            type="text"
            value={color.startsWith("linear-gradient") ? (activeStop === 1 ? gradientStop1 : gradientStop2).toUpperCase() : color.toUpperCase()}
            onChange={(e) => {
              let val = e.target.value;
              if (!val.startsWith("#")) val = "#" + val;
              if (val.length <= 7) {
                handlePickerChange(val);
              }
            }}
            className="w-full rounded-lg border border-outline-variant bg-surface-container-high px-2.5 py-1.5 text-xs text-on-surface font-mono focus:border-primary focus:outline-none"
            placeholder="#FFFFFF"
            maxLength={7}
          />
        </div>
      </div>

      {/* Presets Grid */}
      <div className="mt-4 space-y-1.5">
        <label className="block text-[10px] uppercase font-bold tracking-wider text-on-surface-variant font-bold">Preset Colors</label>
        <div className="grid grid-cols-6 gap-1.5">
          {[
            "#EF4444", "#F97316", "#F59E0B", "#10B981", "#3B82F6", "#6366F1",
            "#8B5CF6", "#EC4899", "#111827", "#6B7280", "#9CA3AF", "#F3F4F6"
          ].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => handlePickerChange(preset)}
              className={`h-6 w-full rounded-md border border-outline-variant/30 transition-transform hover:scale-105 cursor-pointer ${
                currentPickerColor.toLowerCase() === preset.toLowerCase() ? "ring-2 ring-primary ring-offset-2 scale-105" : ""
              }`}
              style={{ backgroundColor: preset }}
              title={preset}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
