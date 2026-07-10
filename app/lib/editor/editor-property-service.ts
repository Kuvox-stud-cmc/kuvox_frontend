import type { VideoTimelineItem } from "./video-document";
import {
  updateTransformCropOperation,
  updateAudioOperation,
  updateTextOperation,
} from "./video-operations";

export interface PropertyMetadata {
  id: string;
  label: string;
  group: "adjust" | "filters" | "color" | "mask" | "animation" | "speed" | "audio" | "audioSettings" | "crop" | "textStyle";
  min?: number;
  max?: number;
  step?: number;
  defaultValue: any;
  suffix?: string;
  precision?: number;
}

export const PROPERTY_REGISTRY: Record<string, PropertyMetadata> = {
  // Adjust
  exposure: { id: "exposure", label: "Exposure", group: "adjust", min: -100, max: 100, step: 1, defaultValue: 0 },
  brightness: { id: "brightness", label: "Brightness", group: "adjust", min: 0, max: 200, step: 1, defaultValue: 100, suffix: "%" },
  contrast: { id: "contrast", label: "Contrast", group: "adjust", min: 0, max: 200, step: 1, defaultValue: 100, suffix: "%" },
  highlights: { id: "highlights", label: "Highlights", group: "adjust", min: 0, max: 200, step: 1, defaultValue: 100, suffix: "%" },
  shadows: { id: "shadows", label: "Shadows", group: "adjust", min: 0, max: 200, step: 1, defaultValue: 100, suffix: "%" },
  whites: { id: "whites", label: "Whites", group: "adjust", min: -100, max: 100, step: 1, defaultValue: 0 },
  blacks: { id: "blacks", label: "Blacks", group: "adjust", min: -100, max: 100, step: 1, defaultValue: 0 },
  temperature: { id: "temperature", label: "Temperature", group: "adjust", min: -100, max: 100, step: 1, defaultValue: 0 },
  tint: { id: "tint", label: "Tint", group: "adjust", min: -100, max: 100, step: 1, defaultValue: 0 },
  saturation: { id: "saturation", label: "Saturation", group: "adjust", min: 0, max: 200, step: 1, defaultValue: 100, suffix: "%" },
  vibrance: { id: "vibrance", label: "Vibrance", group: "adjust", min: 0, max: 200, step: 1, defaultValue: 100, suffix: "%" },
  sharpness: { id: "sharpness", label: "Sharpness", group: "adjust", min: 0, max: 100, step: 1, defaultValue: 0 },

  // Filters
  intensity: { id: "intensity", label: "Intensity", group: "filters", min: 0, max: 100, defaultValue: 100, suffix: "%" },
  blend: { id: "blend", label: "Blend", group: "filters", min: 0, max: 100, defaultValue: 100, suffix: "%" },

  // Color
  lift: { id: "lift", label: "Lift", group: "color", min: -100, max: 100, step: 1, defaultValue: 0 },
  gamma: { id: "gamma", label: "Gamma", group: "color", min: -100, max: 100, step: 1, defaultValue: 0 },
  gain: { id: "gain", label: "Gain", group: "color", min: -100, max: 100, step: 1, defaultValue: 0 },
  vignette: { id: "vignette", label: "Vignette", group: "color", min: 0, max: 100, step: 1, defaultValue: 0 },
  grain: { id: "grain", label: "Grain", group: "color", min: 0, max: 100, step: 1, defaultValue: 0 },

  // Crop
  top: { id: "top", label: "Top", group: "crop", min: 0, max: 100, step: 1, defaultValue: 0, suffix: "%" },
  bottom: { id: "bottom", label: "Bottom", group: "crop", min: 0, max: 100, step: 1, defaultValue: 0, suffix: "%" },
  left: { id: "left", label: "Left", group: "crop", min: 0, max: 100, step: 1, defaultValue: 0, suffix: "%" },
  right: { id: "right", label: "Right", group: "crop", min: 0, max: 100, step: 1, defaultValue: 0, suffix: "%" },
  cornerRadius: { id: "cornerRadius", label: "Corner Rad.", group: "crop", min: 0, max: 100, step: 1, defaultValue: 0 },
  feather: { id: "feather", label: "Feather", group: "crop", min: 0, max: 100, step: 1, defaultValue: 0 },

  // Mask
  expansion: { id: "expansion", label: "Expansion", group: "mask", min: -100, max: 100, step: 1, defaultValue: 0 },
  maskFeather: { id: "maskFeather", label: "Feather", group: "mask", min: 0, max: 100, step: 1, defaultValue: 10 },
  maskSize: { id: "maskSize", label: "Size", group: "mask", min: 0, max: 100, step: 1, defaultValue: 50, suffix: "%" },

  // Speed
  speed: { id: "speed", label: "Speed", group: "speed", min: 0.01, max: 10.0, step: 0.05, defaultValue: 1.0, suffix: "x", precision: 2 },
  speedMultiplier: { id: "speedMultiplier", label: "Multiplier", group: "speed", min: 0.25, max: 4.0, step: 0.05, defaultValue: 1.0, suffix: "x" },

  // Animation
  duration: { id: "duration", label: "Duration", group: "animation", min: 0.1, max: 60, step: 0.1, defaultValue: 5, suffix: "s" },
  fadeIn: { id: "fadeIn", label: "Fade In", group: "animation", min: 0.0, max: 10.0, step: 0.1, defaultValue: 0.0, suffix: "s" },
  fadeOut: { id: "fadeOut", label: "Fade Out", group: "animation", min: 0.0, max: 10.0, step: 0.1, defaultValue: 0.0, suffix: "s" },
  scaleAnim: { id: "scaleAnim", label: "Scale Anim", group: "animation", min: 0, max: 100, step: 1, defaultValue: 0 },
  rotationAnim: { id: "rotationAnim", label: "Rot. Anim", group: "animation", min: 0, max: 360, step: 1, defaultValue: 0, suffix: "deg" },

  // Audio Settings
  volume: { id: "volume", label: "Volume", group: "audio", min: 0.0, max: 1.0, step: 0.01, defaultValue: 1.0, precision: 3 },
  balance: { id: "balance", label: "Balance", group: "audio", min: -50, max: 50, step: 1, defaultValue: 0 },
  level: { id: "level", label: "Level", group: "audio", min: 0, max: 100, step: 1, defaultValue: 50, suffix: "%" },
  low: { id: "low", label: "Low Gain", group: "audio", min: -12, max: 12, step: 1, defaultValue: 0, suffix: "dB" },
  mid: { id: "mid", label: "Mid Gain", group: "audio", min: -12, max: 12, step: 1, defaultValue: 0, suffix: "dB" },
  high: { id: "high", label: "High Gain", group: "audio", min: -12, max: 12, step: 1, defaultValue: 0, suffix: "dB" },
  normalize: { id: "normalize", label: "Normalize", group: "audioSettings", defaultValue: false },
  noiseRem: { id: "noiseRem", label: "Noise Rem.", group: "audioSettings", defaultValue: false },
  voiceEnhance: { id: "voiceEnhance", label: "Voice Enhance", group: "audioSettings", defaultValue: false },
  compressor: { id: "compressor", label: "Compressor", group: "audioSettings", defaultValue: false },
  limiter: { id: "limiter", label: "Limiter", group: "audioSettings", defaultValue: false },
};

/**
 * Validates and clamps a property value against the registry metadata definition.
 */
export function clampPropertyValue(propertyName: string, value: any): any {
  const metadata = PROPERTY_REGISTRY[propertyName];
  if (!metadata) return value;

  if (typeof value === "number" && typeof metadata.defaultValue === "number") {
    let clamped = value;
    if (metadata.min !== undefined && clamped < metadata.min) clamped = metadata.min;
    if (metadata.max !== undefined && clamped > metadata.max) clamped = metadata.max;
    return clamped;
  }

  return value;
}

/**
 * Retrieves the current static value of a property from a timeline item.
 * Unwraps the AnimatableProperty structure if it exists.
 */
export function getTimelineItemPropertyValue(item: VideoTimelineItem, groupName: string, propertyName: string): any {
  const props = (item as any).properties;
  if (props && props[groupName] && props[groupName][propertyName]) {
    return props[groupName][propertyName].value;
  }
  
  // Fallback to legacy schema mappings or defaults
  if (groupName === "transform") {
    if (propertyName === "opacity" && (item.type === "video" || item.type === "image" || item.type === "overlay")) {
      return item.opacity ?? 1.0;
    }
  }
  
  const metadata = PROPERTY_REGISTRY[propertyName];
  return metadata ? metadata.defaultValue : undefined;
}

/**
 * Service to translate high-level command intentions into Redux Operations.
 */
export const EditorPropertyService = {
  createUpdatePropertyOperation(
    item: VideoTimelineItem,
    propertyName: string,
    value: any,
    label?: string,
    groupName?: string
  ): any {
    // 1. Clamp value
    const clampedValue = clampPropertyValue(propertyName, value);
    
    // 2. Identify property metadata group
    const metadata = PROPERTY_REGISTRY[propertyName];
    const resolvedGroup = groupName || (metadata ? metadata.group : "adjust");
    const operationLabel = label || `Update ${metadata?.label || propertyName}`;

    // 3. Translate to correct Redux operation type based on target item
    if (item.type === "text") {
      // Styling is handled in style object for text items, but we can also save under properties
      if (["fontFamily", "fontSize", "color", "backgroundColor", "fontWeight", "fontStyle", "textAlign"].includes(propertyName)) {
        return updateTextOperation(item.id, { style: { ...(item.style || {}), [propertyName]: clampedValue } }, operationLabel);
      }
      
      // Text styling extensions
      if (["strokeColor", "strokeWidth", "shadowColor", "shadowBlur", "shadowOffsetX", "shadowOffsetY", "animType", "animDur"].includes(propertyName)) {
        return updateTextOperation(item.id, { style: { ...(item.style || {}), [propertyName]: clampedValue } }, operationLabel);
      }

      // Generic properties bag
      return updateTextOperation(item.id, {
        properties: {
          [resolvedGroup]: {
            [propertyName]: { value: clampedValue }
          }
        }
      }, operationLabel);
    }
    
    if (item.type === "audio") {
      if (propertyName === "volume") {
        return updateAudioOperation(item.id, { volume: clampedValue }, operationLabel);
      }
      if (propertyName === "muted") {
        return updateAudioOperation(item.id, { muted: clampedValue }, operationLabel);
      }
      
      // Audio custom properties
      return updateAudioOperation(item.id, {
        properties: {
          [resolvedGroup]: {
            [propertyName]: { value: clampedValue }
          }
        }
      }, operationLabel);
    }

    // Default to updateTransformCrop for visual items (video/image/overlay)
    if (propertyName === "opacity") {
      return updateTransformCropOperation(item.id, { opacity: clampedValue }, operationLabel);
    }
    if (propertyName === "layer") {
      return updateTransformCropOperation(item.id, { layerOrder: clampedValue }, operationLabel);
    }

    // Properties bag
    return updateTransformCropOperation(item.id, {
      properties: {
        [resolvedGroup]: {
          [propertyName]: { value: clampedValue }
        }
      } as any
    }, operationLabel);
  }
};
