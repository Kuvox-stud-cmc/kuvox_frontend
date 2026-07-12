export type ThemeId = "midnight-jade" | "ink-copper" | "graphite-cyan" | "plum-noir" | "lotus-pond" | "aurora-emerald";

export interface ThemeMetadata {
  id: ThemeId;
  name: string;
  description: string;
  recommended: boolean;
  inspiration: string;
  colors: {
    background: string;
    surface: string;
    primary: string;
    accent: string;
  };
}

export const THEMES: ThemeMetadata[] = [
  {
    id: "midnight-jade",
    name: "Midnight Jade",
    description: "Balanced dark emerald accents for creative editor workspaces.",
    recommended: true,
    inspiration: "Creative Studio",
    colors: {
      background: "#0C0E10",
      surface: "#12181A",
      primary: "#2FA98C",
      accent: "#C7A35A",
    },
  },
  {
    id: "ink-copper",
    name: "Ink & Copper",
    description: "Warm copper accents with a premium analog feel.",
    recommended: false,
    inspiration: "Analog Film",
    colors: {
      background: "#090909",
      surface: "#111111",
      primary: "#A86A3D",
      accent: "#D6A15D",
    },
  },
  {
    id: "graphite-cyan",
    name: "Graphite + Cyan",
    description: "Clean dark graphite surface with vibrant cyan highlights.",
    recommended: false,
    inspiration: "Modern Tech",
    colors: {
      background: "#0F1116",
      surface: "#171A22",
      primary: "#5BC7E8",
      accent: "#9BE7F7",
    },
  },
  {
    id: "plum-noir",
    name: "Plum Noir",
    description: "Elegant deep plum hues for creative styling and design.",
    recommended: false,
    inspiration: "Elegant Dark",
    colors: {
      background: "#09090C",
      surface: "#0F0F13",
      primary: "#8A75FF",
      accent: "#8A75FF",
    },
  },
  {
    id: "lotus-pond",
    name: "Museum Hall",
    description: "Warm organic tones inspired by the main landing page, with soft gold and lotus pink.",
    recommended: false,
    inspiration: "Lotus Warm",
    colors: {
      background: "#120F0C",
      surface: "#111816",
      primary: "#C9A962",
      accent: "#E86CB5",
    },
  },
  {
    id: "aurora-emerald",
    name: "Aurora Emerald",
    description: "Deep forest green and emerald tones inspired by the pricing layout, with light cyan and lotus pink highlights.",
    recommended: false,
    inspiration: "Vibrant Forest",
    colors: {
      background: "#120F0C",
      surface: "#111816",
      primary: "#8ADBE7",
      accent: "#C9A962",
    },
  },
];

type ThemeListener = (theme: ThemeId) => void;

// Preserve listeners across Vite HMR reloads
const globalSymbol: Set<ThemeListener> = typeof window !== "undefined"
  ? ((window as any)[Symbol.for("kuvox_theme_listeners")] as Set<ThemeListener> | undefined) || new Set<ThemeListener>()
  : new Set<ThemeListener>();
if (typeof window !== "undefined") {
  (window as any)[Symbol.for("kuvox_theme_listeners")] = globalSymbol;
}
const listeners: Set<ThemeListener> = globalSymbol;

export const ThemeManager = {
  getTheme(): ThemeId {
    if (typeof window === "undefined") return "midnight-jade";
    try {
      const stored = localStorage.getItem("kuvox_theme");
      if (stored && THEMES.some(t => t.id === stored)) {
        return stored as ThemeId;
      }
    } catch (e) {
      // localStorage security sandbox or empty
    }
    return "midnight-jade";
  },

  setTheme(theme: ThemeId) {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("kuvox_theme", theme);
    } catch (e) {
      // localStorage disabled or full
    }
    this.applyTheme(theme);
    listeners.forEach(listener => listener(theme));
  },

  applyTheme(theme: ThemeId) {
    if (typeof window === "undefined") return;
    document.documentElement.setAttribute("data-theme", theme);
  },

  subscribe(listener: ThemeListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }
};
