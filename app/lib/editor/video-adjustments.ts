import type {
  ImageOverlayTimelineItem,
  VideoClipTimelineItem,
  VideoTimelineItem,
} from "./video-document";

export const VIDEO_ADJUSTMENT_REGISTRY_VERSION = 1 as const;

export const VIDEO_FILTER_PRESETS = [
  "Original",
  "Cinematic",
  "Film",
  "Vintage",
  "Warm",
  "Cold",
  "Dreamy",
  "Noir",
  "Vivid",
] as const;

export type VideoFilterPreset = (typeof VIDEO_FILTER_PRESETS)[number];
export type VideoStyledVisualItem = VideoClipTimelineItem | ImageOverlayTimelineItem;

export interface VideoResolvedAdjustments {
  exposure: number;
  brightness: number;
  contrast: number;
  temperature: number;
  tint: number;
  saturation: number;
  vibrance: number;
  lift: number;
  gamma: number;
  gain: number;
}

export interface VideoResolvedFilterValues {
  brightness: number;
  contrast: number;
  saturation: number;
  hueRotate: number;
  sepia: number;
}

export interface VideoResolvedVisualStyle {
  registryVersion: typeof VIDEO_ADJUSTMENT_REGISTRY_VERSION;
  preset: VideoFilterPreset;
  intensity: number;
  blend: number;
  adjustments: VideoResolvedAdjustments;
  filter: VideoResolvedFilterValues;
}

type AdjustmentDefinition = {
  neutral: number;
  min: number;
  max: number;
};

export const VIDEO_ADJUSTMENT_REGISTRY: Record<keyof VideoResolvedAdjustments, AdjustmentDefinition> = {
  exposure: { neutral: 0, min: -100, max: 100 },
  brightness: { neutral: 100, min: 0, max: 200 },
  contrast: { neutral: 100, min: 0, max: 200 },
  temperature: { neutral: 0, min: -100, max: 100 },
  tint: { neutral: 0, min: -100, max: 100 },
  saturation: { neutral: 100, min: 0, max: 200 },
  vibrance: { neutral: 100, min: 0, max: 200 },
  lift: { neutral: 0, min: -100, max: 100 },
  gamma: { neutral: 0, min: -100, max: 100 },
  gain: { neutral: 0, min: -100, max: 100 },
};

const presetAdjustments: Record<VideoFilterPreset, Partial<VideoResolvedAdjustments>> = {
  Original: {},
  Cinematic: {
    exposure: -4,
    brightness: 98,
    contrast: 118,
    temperature: -6,
    tint: 2,
    saturation: 106,
    vibrance: 110,
    lift: -4,
    gamma: 8,
    gain: 4,
  },
  Film: {
    exposure: 2,
    contrast: 108,
    temperature: 8,
    tint: 4,
    saturation: 88,
    vibrance: 95,
    lift: 6,
    gamma: -4,
    gain: -3,
  },
  Vintage: {
    brightness: 104,
    contrast: 92,
    temperature: 18,
    tint: 8,
    saturation: 78,
    vibrance: 86,
    lift: 12,
    gamma: -8,
    gain: -6,
  },
  Warm: {
    brightness: 103,
    temperature: 25,
    tint: 3,
    saturation: 108,
    vibrance: 106,
  },
  Cold: {
    brightness: 101,
    temperature: -25,
    tint: -3,
    saturation: 104,
    vibrance: 108,
  },
  Dreamy: {
    exposure: 8,
    brightness: 108,
    contrast: 88,
    temperature: 6,
    tint: 8,
    saturation: 96,
    vibrance: 112,
    lift: 10,
    gamma: -8,
    gain: 4,
  },
  Noir: {
    brightness: 96,
    contrast: 132,
    saturation: 0,
    vibrance: 0,
    gamma: 12,
    gain: 4,
  },
  Vivid: {
    brightness: 102,
    contrast: 116,
    saturation: 125,
    vibrance: 135,
    gain: 8,
  },
};

export function resolveVideoVisualStyle(item: VideoStyledVisualItem): VideoResolvedVisualStyle {
  const preset = resolveVideoFilterPreset(item);
  const intensity = clamp(numberProperty(item, "filters", "intensity", 100), 0, 100);
  const blend = clamp(numberProperty(item, "filters", "blend", 100), 0, 100);
  const presetMix = (intensity / 100) * (blend / 100);
  const presetValues = presetAdjustments[preset];
  const adjustments = Object.fromEntries(
    (Object.keys(VIDEO_ADJUSTMENT_REGISTRY) as Array<keyof VideoResolvedAdjustments>).map((name) => {
      const definition = VIDEO_ADJUSTMENT_REGISTRY[name];
      const group = name === "lift" || name === "gamma" || name === "gain" ? "color" : "adjust";
      const userValue = numberProperty(item, group, name, definition.neutral);
      const presetValue = presetValues[name] ?? definition.neutral;
      const combined = userValue + (presetValue - definition.neutral) * presetMix;
      return [name, round(clamp(combined, definition.min, definition.max))];
    }),
  ) as unknown as VideoResolvedAdjustments;

  return {
    registryVersion: VIDEO_ADJUSTMENT_REGISTRY_VERSION,
    preset,
    intensity: round(intensity),
    blend: round(blend),
    adjustments,
    filter: filterValuesForAdjustments(adjustments),
  };
}

export function filterValuesForAdjustments(
  adjustments: VideoResolvedAdjustments,
): VideoResolvedFilterValues {
  return {
    brightness: round(clamp(
      adjustments.brightness / 100 + adjustments.exposure / 240 + adjustments.lift / 320,
      0.08,
      3,
    )),
    contrast: round(clamp(
      adjustments.contrast / 100 + adjustments.gamma / 260 + adjustments.gain / 420,
      0.08,
      3,
    )),
    saturation: round(clamp(
      adjustments.saturation / 100 + (adjustments.vibrance - 100) / 260 + adjustments.gain / 340,
      0,
      3.5,
    )),
    hueRotate: round(clamp(
      adjustments.temperature * -0.18 + adjustments.tint * 0.22,
      -45,
      45,
    )),
    sepia: round(clamp(Math.max(0, adjustments.temperature) / 420, 0, 0.28)),
  };
}

export function videoVisualStyleCssFilter(style: VideoResolvedVisualStyle): string {
  const filter = style.filter;
  if (
    nearlyEqual(filter.brightness, 1)
    && nearlyEqual(filter.contrast, 1)
    && nearlyEqual(filter.saturation, 1)
    && nearlyEqual(filter.hueRotate, 0)
    && nearlyEqual(filter.sepia, 0)
  ) {
    return "none";
  }

  const parts = [
    `brightness(${format(filter.brightness)})`,
    `contrast(${format(filter.contrast)})`,
    `saturate(${format(filter.saturation)})`,
  ];
  if (!nearlyEqual(filter.hueRotate, 0)) parts.push(`hue-rotate(${format(filter.hueRotate)}deg)`);
  if (!nearlyEqual(filter.sepia, 0)) parts.push(`sepia(${format(filter.sepia)})`);
  return parts.join(" ");
}

export function resolveVideoFilterPreset(item: VideoStyledVisualItem): VideoFilterPreset {
  const propertyName = item.type === "video" ? "builtIn" : "filterType";
  const builtIn = stringProperty(item, "filters", propertyName, "Original");
  const lut = stringProperty(item, "filters", "lutLibrary", "Original");
  return normalizePreset(builtIn !== "None" && builtIn !== "Original" ? builtIn : lut);
}

export function videoPropertyValue(
  item: VideoTimelineItem,
  groupName: string,
  propertyName: string,
  fallback: unknown,
): unknown {
  const property = (item as any).properties?.[groupName]?.[propertyName];
  if (property && typeof property === "object" && "value" in property) return property.value;
  return property ?? fallback;
}

export function videoPropertyHasKeyframes(
  item: VideoTimelineItem,
  groupName: string,
  propertyName: string,
): boolean {
  const property = (item as any).properties?.[groupName]?.[propertyName];
  return Boolean(property && typeof property === "object" && Array.isArray(property.keyframes) && property.keyframes.length > 0);
}

function normalizePreset(value: string): VideoFilterPreset {
  const normalized = value === "Cool" ? "Cold" : value === "None" ? "Original" : value;
  return VIDEO_FILTER_PRESETS.includes(normalized as VideoFilterPreset)
    ? normalized as VideoFilterPreset
    : "Original";
}

function numberProperty(
  item: VideoTimelineItem,
  groupName: string,
  propertyName: string,
  fallback: number,
): number {
  const value = videoPropertyValue(item, groupName, propertyName, fallback);
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringProperty(
  item: VideoTimelineItem,
  groupName: string,
  propertyName: string,
  fallback: string,
): string {
  const value = videoPropertyValue(item, groupName, propertyName, fallback);
  return typeof value === "string" ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function nearlyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) < 0.000001;
}

function round(value: number): number {
  return Number(value.toFixed(6));
}

function format(value: number): string {
  return Number(value.toFixed(6)).toString();
}
