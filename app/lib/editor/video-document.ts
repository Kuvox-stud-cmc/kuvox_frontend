import type { TimelineEditorToolId } from "./editor-tools";

export const VIDEO_PROJECT_DOCUMENT_SCHEMA_VERSION = 1;

export type VideoDocumentSchemaVersion = typeof VIDEO_PROJECT_DOCUMENT_SCHEMA_VERSION;

export type VideoMediaKind = "video" | "audio" | "image";
export type VideoTrackKind = "video" | "audio" | "text" | "overlay";
export type VideoPreviewQuality = "draft" | "balanced" | "full";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface VideoProjectSeed {
  id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface VideoProjectDocument {
  schemaVersion: VideoDocumentSchemaVersion;
  projectId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  settings: VideoProjectSettings;
  media: Record<string, VideoMediaReference>;
  tracks: VideoTrack[];
  transitions: VideoTransition[];
  effects: VideoEffect[];
  history: VideoDocumentHistory;
}

export interface VideoProjectSettings {
  width: number;
  height: number;
  aspectRatio: string;
  frameRate: number;
  previewQuality: VideoPreviewQuality;
  defaultTransitionDuration: number;
  exportPreset: string;
}

export interface VideoMediaReference {
  id: string;
  kind: VideoMediaKind;
  name: string;
  duration?: number;
  width?: number;
  height?: number;
  mimeType?: string;
  sourceUrl?: string;
  thumbnailUrl?: string;
  objectUrls?: Partial<Record<"proxy" | "canonical" | "raw", string>>;
}

export interface VideoTrack {
  id: string;
  kind: VideoTrackKind;
  label: string;
  locked: boolean;
  hidden: boolean;
  muted: boolean;
  items: VideoTimelineItem[];
}

export type VideoTimelineItem =
  | VideoClipTimelineItem
  | AudioTimelineItem
  | TextTimelineItem
  | ImageOverlayTimelineItem;

interface VideoTimelineItemBase {
  id: string;
  timelineStart: number;
  duration: number;
}

export interface VideoClipTimelineItem extends VideoTimelineItemBase {
  type: "video";
  mediaId: string;
  shotId?: string;
  sourceIn: number;
  sourceOut: number;
  speed: number;
  linkedGroupId?: string;
  transform: VideoTransform;
  crop: VideoCrop;
  opacity: number;
}

export interface AudioTimelineItem extends VideoTimelineItemBase {
  type: "audio";
  mediaId: string;
  sourceIn: number;
  sourceOut: number;
  volume: number;
  muted: boolean;
  fades: VideoAudioFades;
  linkedGroupId?: string;
}

export interface TextTimelineItem extends VideoTimelineItemBase {
  type: "text";
  text: string;
  style: VideoTextStyle;
  transform: VideoTransform;
  layerOrder: number;
}

export interface ImageOverlayTimelineItem extends VideoTimelineItemBase {
  type: "image" | "overlay";
  mediaId: string;
  transform: VideoTransform;
  opacity: number;
  layerOrder: number;
}

export interface VideoTransform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
}

export interface VideoCrop {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface VideoAudioFades {
  fadeInDuration: number;
  fadeOutDuration: number;
}

export interface VideoTextStyle {
  fontFamily: string;
  fontSize: number;
  color: string;
  backgroundColor?: string;
  fontWeight?: "normal" | "medium" | "semibold" | "bold";
  fontStyle?: "normal" | "italic";
  textAlign?: "left" | "center" | "right";
}

export interface VideoTransition {
  id: string;
  type: string;
  targetItemIds: string[];
  duration: number;
  easing?: string;
}

export interface VideoEffect {
  id: string;
  type: string;
  targetItemIds: string[];
  enabled: boolean;
  parameters: Record<string, JsonValue>;
}

export interface VideoDocumentHistory {
  revision: number;
  lastSavedAt?: string;
  lastOperationId?: string;
  canUndo: boolean;
  canRedo: boolean;
}

export interface VideoEditorSelection {
  selectedTrackIds: string[];
  selectedItemIds: string[];
  selectedTransitionIds: string[];
  selectedEffectIds: string[];
  activeItemId?: string;
}

export interface VideoPlaybackState {
  playing: boolean;
  currentTime: number;
  volume: number;
  muted: boolean;
  loop: boolean;
}

export interface VideoEditorUiState {
  selection: VideoEditorSelection;
  playback: VideoPlaybackState;
  activeTool: TimelineEditorToolId;
  timelineZoom: number;
  timelineScrollLeft: number;
  timelineScrollTop: number;
  openPanel: "media" | "effects" | "transitions" | "text" | "export" | null;
}

export type VideoProjectDocumentValidationResult =
  | { ok: true; document: VideoProjectDocument; errors: [] }
  | { ok: false; errors: string[]; document?: undefined };

const defaultTransform: VideoTransform = {
  x: 0,
  y: 0,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
};

const defaultCrop: VideoCrop = {
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};

const defaultSettings: VideoProjectSettings = {
  width: 1920,
  height: 1080,
  aspectRatio: "16:9",
  frameRate: 30,
  previewQuality: "balanced",
  defaultTransitionDuration: 0.4,
  exportPreset: "h264-1080p",
};

export function createEmptyVideoProjectDocument(project: VideoProjectSeed): VideoProjectDocument {
  const now = new Date().toISOString();

  return {
    schemaVersion: VIDEO_PROJECT_DOCUMENT_SCHEMA_VERSION,
    projectId: project.id,
    name: project.name,
    createdAt: project.createdAt ?? now,
    updatedAt: project.updatedAt ?? now,
    settings: { ...defaultSettings },
    media: {},
    tracks: [
      createTrack("v1", "video", "V1"),
      createTrack("a1", "audio", "A1"),
      createTrack("t1", "text", "T1"),
    ],
    transitions: [],
    effects: [],
    history: {
      revision: 0,
      canUndo: false,
      canRedo: false,
    },
  };
}

export function createMockVideoProjectDocument(
  projectId: string,
  projectName = "Summer Highlights",
): VideoProjectDocument {
  const document = createEmptyVideoProjectDocument({
    id: projectId,
    name: projectName,
    createdAt: "2026-01-05T09:00:00.000Z",
    updatedAt: "2026-01-05T09:12:00.000Z",
  });

  return {
    ...document,
    media: {
      "clip-beach": createMedia(
        "clip-beach",
        "video",
        "Beach_01.mp4",
        32,
        1920,
        1080,
        "video/mp4",
      ),
      "clip-city": createMedia(
        "clip-city",
        "video",
        "City_Night.mp4",
        24,
        1920,
        1080,
        "video/mp4",
      ),
      "clip-mountain": createMedia(
        "clip-mountain",
        "video",
        "Mountain_View.mp4",
        35,
        1920,
        1080,
        "video/mp4",
      ),
      "audio-main": createMedia(
        "audio-main",
        "audio",
        "Main ambience.wav",
        38,
        undefined,
        undefined,
        "audio/wav",
      ),
      "audio-music": createMedia(
        "audio-music",
        "audio",
        "Music bed",
        25,
        undefined,
        undefined,
        "audio/mpeg",
      ),
    },
    tracks: [
      {
        ...createTrack("v1", "video", "V1"),
        items: [
          createVideoClip(
            "tl-beach",
            "clip-beach",
            2,
            21,
            0,
            21,
            "shot-beach-opening",
            "linked-beach",
          ),
          createVideoClip(
            "tl-city",
            "clip-city",
            23.8,
            16,
            0,
            16,
            "shot-city-middle",
            "linked-city",
          ),
          createVideoClip(
            "tl-mountain",
            "clip-mountain",
            41.4,
            25,
            0,
            25,
            "shot-mountain-ending",
          ),
        ],
      },
      {
        ...createTrack("a1", "audio", "A1"),
        items: [
          createAudioItem("tl-audio-main", "audio-main", 2, 37.8, 0, 37.8, "linked-beach"),
          createAudioItem("tl-audio-bed", "audio-music", 41.4, 25, 0, 25),
        ],
      },
      {
        ...createTrack("t1", "text", "T1"),
        items: [
          {
            id: "tl-caption",
            type: "text",
            timelineStart: 7,
            duration: 11.6,
            text: "Welcome to summer",
            style: {
              fontFamily: "Inter",
              fontSize: 48,
              color: "#ffffff",
              fontWeight: "semibold",
              textAlign: "center",
            },
            transform: { ...defaultTransform, y: 320 },
            layerOrder: 10,
          },
        ],
      },
    ],
    transitions: [
      {
        id: "transition-beach-city",
        type: "crossfade",
        targetItemIds: ["tl-beach", "tl-city"],
        duration: 0.4,
        easing: "ease-in-out",
      },
    ],
    effects: [
      {
        id: "effect-city-speed-ramp",
        type: "speed-ramp",
        targetItemIds: ["tl-city"],
        enabled: true,
        parameters: { peakSpeed: 4 },
      },
    ],
    history: {
      revision: 1,
      lastSavedAt: "2026-01-05T09:12:00.000Z",
      lastOperationId: "mock-operation-1",
      canUndo: false,
      canRedo: false,
    },
  };
}

export function validateVideoProjectDocument(value: unknown): VideoProjectDocumentValidationResult {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return { ok: false, errors: ["Document must be an object."] };
  }

  if (value.schemaVersion !== VIDEO_PROJECT_DOCUMENT_SCHEMA_VERSION) {
    errors.push("Unsupported video document schemaVersion.");
  }

  validateRequiredString(value.projectId, "projectId", errors);
  validateRequiredString(value.name, "name", errors);
  validateIsoDateString(value.createdAt, "createdAt", errors);
  validateIsoDateString(value.updatedAt, "updatedAt", errors);
  validateSettings(value.settings, errors);
  validateMedia(value.media, errors);

  const mediaById = isRecord(value.media) ? value.media : {};
  const mediaIds = new Set(Object.keys(mediaById));
  const itemIds = validateTracks(value.tracks, mediaById, mediaIds, errors);

  validateTargetedList(value.transitions, "transitions", itemIds, errors, validateTransition);
  validateTargetedList(value.effects, "effects", itemIds, errors, validateEffect);
  validateHistory(value.history, errors);

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, document: value as unknown as VideoProjectDocument, errors: [] };
}

export function isVideoProjectDocument(value: unknown): value is VideoProjectDocument {
  return validateVideoProjectDocument(value).ok;
}

function createTrack(id: string, kind: VideoTrackKind, label: string): VideoTrack {
  return {
    id,
    kind,
    label,
    locked: false,
    hidden: false,
    muted: false,
    items: [],
  };
}

function createMedia(
  id: string,
  kind: VideoMediaKind,
  name: string,
  duration: number,
  width?: number,
  height?: number,
  mimeType?: string,
): VideoMediaReference {
  const media: VideoMediaReference = {
    id,
    kind,
    name,
    duration,
  };

  if (width !== undefined) media.width = width;
  if (height !== undefined) media.height = height;
  if (mimeType !== undefined) media.mimeType = mimeType;

  return media;
}

function createVideoClip(
  id: string,
  mediaId: string,
  timelineStart: number,
  duration: number,
  sourceIn: number,
  sourceOut: number,
  shotId?: string,
  linkedGroupId?: string,
): VideoClipTimelineItem {
  const item: VideoClipTimelineItem = {
    id,
    type: "video",
    mediaId,
    sourceIn,
    sourceOut,
    timelineStart,
    duration,
    speed: 1,
    transform: { ...defaultTransform },
    crop: { ...defaultCrop },
    opacity: 1,
  };

  if (shotId !== undefined) item.shotId = shotId;
  if (linkedGroupId !== undefined) item.linkedGroupId = linkedGroupId;

  return item;
}

function createAudioItem(
  id: string,
  mediaId: string,
  timelineStart: number,
  duration: number,
  sourceIn: number,
  sourceOut: number,
  linkedGroupId?: string,
): AudioTimelineItem {
  const item: AudioTimelineItem = {
    id,
    type: "audio",
    mediaId,
    sourceIn,
    sourceOut,
    timelineStart,
    duration,
    volume: 1,
    muted: false,
    fades: {
      fadeInDuration: 0,
      fadeOutDuration: 0,
    },
  };

  if (linkedGroupId !== undefined) item.linkedGroupId = linkedGroupId;

  return item;
}

function validateSettings(value: unknown, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push("settings must be an object.");
    return;
  }

  validatePositiveNumber(value.width, "settings.width", errors);
  validatePositiveNumber(value.height, "settings.height", errors);
  validateRequiredString(value.aspectRatio, "settings.aspectRatio", errors);
  validatePositiveNumber(value.frameRate, "settings.frameRate", errors);

  if (!isOneOf(value.previewQuality, ["draft", "balanced", "full"])) {
    errors.push("settings.previewQuality must be draft, balanced, or full.");
  }

  validateNonNegativeNumber(
    value.defaultTransitionDuration,
    "settings.defaultTransitionDuration",
    errors,
  );
  validateRequiredString(value.exportPreset, "settings.exportPreset", errors);
}

function validateMedia(value: unknown, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push("media must be an object keyed by media id.");
    return;
  }

  for (const [mediaId, media] of Object.entries(value)) {
    const path = `media.${mediaId}`;
    if (!isRecord(media)) {
      errors.push(`${path} must be an object.`);
      continue;
    }

    if (media.id !== mediaId) {
      errors.push(`${path}.id must match its media key.`);
    }

    if (!isOneOf(media.kind, ["video", "audio", "image"])) {
      errors.push(`${path}.kind must be video, audio, or image.`);
    }

    validateRequiredString(media.id, `${path}.id`, errors);
    validateRequiredString(media.name, `${path}.name`, errors);
    validateOptionalNonNegativeNumber(media.duration, `${path}.duration`, errors);
    validateOptionalPositiveNumber(media.width, `${path}.width`, errors);
    validateOptionalPositiveNumber(media.height, `${path}.height`, errors);
    validateOptionalString(media.mimeType, `${path}.mimeType`, errors);
    validateOptionalString(media.sourceUrl, `${path}.sourceUrl`, errors);
    validateOptionalString(media.thumbnailUrl, `${path}.thumbnailUrl`, errors);
    validateObjectUrls(media.objectUrls, `${path}.objectUrls`, errors);
  }
}

function validateObjectUrls(value: unknown, path: string, errors: string[]): void {
  if (value === undefined) {
    return;
  }

  if (!isRecord(value)) {
    errors.push(`${path} must be an object when provided.`);
    return;
  }

  for (const variant of ["proxy", "canonical", "raw"] as const) {
    validateOptionalString(value[variant], `${path}.${variant}`, errors);
  }
}

function validateTracks(
  value: unknown,
  mediaById: Record<string, unknown>,
  mediaIds: Set<string>,
  errors: string[],
): Set<string> {
  const itemIds = new Set<string>();
  const trackIds = new Set<string>();

  if (!Array.isArray(value)) {
    errors.push("tracks must be an array.");
    return itemIds;
  }

  value.forEach((track, trackIndex) => {
    const trackPath = `tracks.${trackIndex}`;
    if (!isRecord(track)) {
      errors.push(`${trackPath} must be an object.`);
      return;
    }

    validateRequiredString(track.id, `${trackPath}.id`, errors);
    if (typeof track.id === "string") {
      addUnique(trackIds, track.id, `${trackPath}.id`, "track id", errors);
    }

    if (!isOneOf(track.kind, ["video", "audio", "text", "overlay"])) {
      errors.push(`${trackPath}.kind must be video, audio, text, or overlay.`);
    }

    validateRequiredString(track.label, `${trackPath}.label`, errors);
    validateBoolean(track.locked, `${trackPath}.locked`, errors);
    validateBoolean(track.hidden, `${trackPath}.hidden`, errors);
    validateBoolean(track.muted, `${trackPath}.muted`, errors);

    if (!Array.isArray(track.items)) {
      errors.push(`${trackPath}.items must be an array.`);
      return;
    }

    track.items.forEach((item, itemIndex) => {
      validateTimelineItem(
        item,
        `${trackPath}.items.${itemIndex}`,
        isOneOf(track.kind, ["video", "audio", "text", "overlay"]) ? track.kind : undefined,
        mediaById,
        mediaIds,
        itemIds,
        errors,
      );
    });
  });

  return itemIds;
}

function validateTimelineItem(
  value: unknown,
  path: string,
  trackKind: VideoTrackKind | undefined,
  mediaById: Record<string, unknown>,
  mediaIds: Set<string>,
  itemIds: Set<string>,
  errors: string[],
): void {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object.`);
    return;
  }

  validateRequiredString(value.id, `${path}.id`, errors);
  if (typeof value.id === "string") {
    addUnique(itemIds, value.id, `${path}.id`, "timeline item id", errors);
  }

  validateNonNegativeNumber(value.timelineStart, `${path}.timelineStart`, errors);
  validatePositiveNumber(value.duration, `${path}.duration`, errors);

  if (!isOneOf(value.type, ["video", "audio", "text", "image", "overlay"])) {
    errors.push(`${path}.type must be video, audio, text, image, or overlay.`);
    return;
  }

  if (trackKind && !isItemAllowedOnTrack(value.type, trackKind)) {
    errors.push(`${path}.type ${value.type} is not valid on a ${trackKind} track.`);
  }

  if (value.type === "video") {
    validateMediaItemFields(value, path, "video", mediaById, mediaIds, errors);
    validatePositiveNumber(value.speed, `${path}.speed`, errors);
    validateOptionalString(value.shotId, `${path}.shotId`, errors);
    validateOptionalString(value.linkedGroupId, `${path}.linkedGroupId`, errors);
    validateTransform(value.transform, `${path}.transform`, errors);
    validateCrop(value.crop, `${path}.crop`, errors);
    validateUnitNumber(value.opacity, `${path}.opacity`, errors);
    return;
  }

  if (value.type === "audio") {
    validateMediaItemFields(value, path, "audio", mediaById, mediaIds, errors);
    validateUnitNumber(value.volume, `${path}.volume`, errors);
    validateBoolean(value.muted, `${path}.muted`, errors);
    validateAudioFades(value.fades, `${path}.fades`, errors);
    validateOptionalString(value.linkedGroupId, `${path}.linkedGroupId`, errors);
    return;
  }

  if (value.type === "text") {
    validateRequiredString(value.text, `${path}.text`, errors);
    validateTextStyle(value.style, `${path}.style`, errors);
    validateTransform(value.transform, `${path}.transform`, errors);
    validateInteger(value.layerOrder, `${path}.layerOrder`, errors);
    return;
  }

  validateRequiredString(value.mediaId, `${path}.mediaId`, errors);
  if (typeof value.mediaId === "string" && !mediaIds.has(value.mediaId)) {
    errors.push(`${path}.mediaId references missing media ${value.mediaId}.`);
  }
  validateMediaKind(value.mediaId, "image", mediaById, `${path}.mediaId`, errors);
  validateTransform(value.transform, `${path}.transform`, errors);
  validateUnitNumber(value.opacity, `${path}.opacity`, errors);
  validateInteger(value.layerOrder, `${path}.layerOrder`, errors);
}

function validateMediaItemFields(
  value: Record<string, unknown>,
  path: string,
  expectedKind: VideoMediaKind,
  mediaById: Record<string, unknown>,
  mediaIds: Set<string>,
  errors: string[],
): void {
  validateRequiredString(value.mediaId, `${path}.mediaId`, errors);
  if (typeof value.mediaId === "string" && !mediaIds.has(value.mediaId)) {
    errors.push(`${path}.mediaId references missing media ${value.mediaId}.`);
  }
  validateMediaKind(value.mediaId, expectedKind, mediaById, `${path}.mediaId`, errors);
  validateNonNegativeNumber(value.sourceIn, `${path}.sourceIn`, errors);
  validatePositiveNumber(value.sourceOut, `${path}.sourceOut`, errors);

  if (
    typeof value.sourceIn === "number" &&
    typeof value.sourceOut === "number" &&
    value.sourceOut <= value.sourceIn
  ) {
    errors.push(`${path}.sourceOut must be greater than sourceIn.`);
  }

  const media = typeof value.mediaId === "string" ? mediaById[value.mediaId] : undefined;
  if (
    isRecord(media) &&
    typeof media.duration === "number" &&
    typeof value.sourceOut === "number" &&
    value.sourceOut > media.duration
  ) {
    errors.push(`${path}.sourceOut must not exceed the media duration.`);
  }
}

function validateMediaKind(
  mediaId: unknown,
  expectedKind: VideoMediaKind,
  mediaById: Record<string, unknown>,
  path: string,
  errors: string[],
): void {
  if (typeof mediaId !== "string") {
    return;
  }

  const media = mediaById[mediaId];
  if (isRecord(media) && media.kind !== expectedKind) {
    errors.push(`${path} must reference ${expectedKind} media.`);
  }
}

function validateTransform(value: unknown, path: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object.`);
    return;
  }

  validateFiniteNumber(value.x, `${path}.x`, errors);
  validateFiniteNumber(value.y, `${path}.y`, errors);
  validatePositiveNumber(value.scaleX, `${path}.scaleX`, errors);
  validatePositiveNumber(value.scaleY, `${path}.scaleY`, errors);
  validateFiniteNumber(value.rotation, `${path}.rotation`, errors);
}

function validateCrop(value: unknown, path: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object.`);
    return;
  }

  validateUnitNumber(value.top, `${path}.top`, errors);
  validateUnitNumber(value.right, `${path}.right`, errors);
  validateUnitNumber(value.bottom, `${path}.bottom`, errors);
  validateUnitNumber(value.left, `${path}.left`, errors);
}

function validateAudioFades(value: unknown, path: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object.`);
    return;
  }

  validateNonNegativeNumber(value.fadeInDuration, `${path}.fadeInDuration`, errors);
  validateNonNegativeNumber(value.fadeOutDuration, `${path}.fadeOutDuration`, errors);
}

function validateTextStyle(value: unknown, path: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object.`);
    return;
  }

  validateRequiredString(value.fontFamily, `${path}.fontFamily`, errors);
  validatePositiveNumber(value.fontSize, `${path}.fontSize`, errors);
  validateRequiredString(value.color, `${path}.color`, errors);
  validateOptionalString(value.backgroundColor, `${path}.backgroundColor`, errors);

  if (value.fontWeight !== undefined && !isOneOf(value.fontWeight, ["normal", "medium", "semibold", "bold"])) {
    errors.push(`${path}.fontWeight must be normal, medium, semibold, or bold.`);
  }

  if (value.fontStyle !== undefined && !isOneOf(value.fontStyle, ["normal", "italic"])) {
    errors.push(`${path}.fontStyle must be normal or italic.`);
  }

  if (value.textAlign !== undefined && !isOneOf(value.textAlign, ["left", "center", "right"])) {
    errors.push(`${path}.textAlign must be left, center, or right.`);
  }
}

function validateTargetedList(
  value: unknown,
  path: "transitions" | "effects",
  itemIds: Set<string>,
  errors: string[],
  validateEntry: (entry: Record<string, unknown>, path: string, itemIds: Set<string>, errors: string[]) => void,
): void {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array.`);
    return;
  }

  const ids = new Set<string>();
  value.forEach((entry, index) => {
    const entryPath = `${path}.${index}`;
    if (!isRecord(entry)) {
      errors.push(`${entryPath} must be an object.`);
      return;
    }

    validateRequiredString(entry.id, `${entryPath}.id`, errors);
    if (typeof entry.id === "string") {
      addUnique(ids, entry.id, `${entryPath}.id`, `${path} id`, errors);
    }

    validateEntry(entry, entryPath, itemIds, errors);
  });
}

function validateTransition(
  value: Record<string, unknown>,
  path: string,
  itemIds: Set<string>,
  errors: string[],
): void {
  validateRequiredString(value.type, `${path}.type`, errors);
  validateTargetItemIds(value.targetItemIds, `${path}.targetItemIds`, itemIds, errors);
  validatePositiveNumber(value.duration, `${path}.duration`, errors);
  validateOptionalString(value.easing, `${path}.easing`, errors);
}

function validateEffect(
  value: Record<string, unknown>,
  path: string,
  itemIds: Set<string>,
  errors: string[],
): void {
  validateRequiredString(value.type, `${path}.type`, errors);
  validateTargetItemIds(value.targetItemIds, `${path}.targetItemIds`, itemIds, errors);
  validateBoolean(value.enabled, `${path}.enabled`, errors);

  if (!isRecord(value.parameters)) {
    errors.push(`${path}.parameters must be an object.`);
    return;
  }

  Object.entries(value.parameters).forEach(([key, parameter]) => {
    if (!isJsonValue(parameter)) {
      errors.push(`${path}.parameters.${key} must be a JSON value.`);
    }
  });
}

function validateTargetItemIds(
  value: unknown,
  path: string,
  itemIds: Set<string>,
  errors: string[],
): void {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push(`${path} must be a non-empty array.`);
    return;
  }

  const targetIds = new Set<string>();
  value.forEach((targetId, index) => {
    const targetPath = `${path}.${index}`;
    validateRequiredString(targetId, targetPath, errors);
    if (typeof targetId !== "string") {
      return;
    }

    addUnique(targetIds, targetId, targetPath, "target item id", errors);
    if (!itemIds.has(targetId)) {
      errors.push(`${targetPath} references missing timeline item ${targetId}.`);
    }
  });
}

function validateHistory(value: unknown, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push("history must be an object.");
    return;
  }

  validateNonNegativeInteger(value.revision, "history.revision", errors);
  validateOptionalIsoDateString(value.lastSavedAt, "history.lastSavedAt", errors);
  validateOptionalString(value.lastOperationId, "history.lastOperationId", errors);
  validateBoolean(value.canUndo, "history.canUndo", errors);
  validateBoolean(value.canRedo, "history.canRedo", errors);
}

function isItemAllowedOnTrack(itemType: string, trackKind: VideoTrackKind): boolean {
  if (trackKind === "video") return itemType === "video" || itemType === "image";
  if (trackKind === "audio") return itemType === "audio";
  if (trackKind === "text") return itemType === "text";
  return itemType === "overlay" || itemType === "image" || itemType === "text";
}

function addUnique(
  seen: Set<string>,
  value: string,
  path: string,
  label: string,
  errors: string[],
): void {
  if (seen.has(value)) {
    errors.push(`${path} duplicates ${label} ${value}.`);
    return;
  }

  seen.add(value);
}

function validateRequiredString(value: unknown, path: string, errors: string[]): void {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${path} must be a non-empty string.`);
  }
}

function validateOptionalString(value: unknown, path: string, errors: string[]): void {
  if (value !== undefined && typeof value !== "string") {
    errors.push(`${path} must be a string when provided.`);
  }
}

function validateIsoDateString(value: unknown, path: string, errors: string[]): void {
  validateRequiredString(value, path, errors);
  if (typeof value === "string" && Number.isNaN(Date.parse(value))) {
    errors.push(`${path} must be an ISO date string.`);
  }
}

function validateOptionalIsoDateString(value: unknown, path: string, errors: string[]): void {
  if (value === undefined) {
    return;
  }

  validateIsoDateString(value, path, errors);
}

function validateBoolean(value: unknown, path: string, errors: string[]): void {
  if (typeof value !== "boolean") {
    errors.push(`${path} must be a boolean.`);
  }
}

function validateFiniteNumber(value: unknown, path: string, errors: string[]): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    errors.push(`${path} must be a finite number.`);
  }
}

function validatePositiveNumber(value: unknown, path: string, errors: string[]): void {
  validateFiniteNumber(value, path, errors);
  if (typeof value === "number" && value <= 0) {
    errors.push(`${path} must be greater than 0.`);
  }
}

function validateOptionalPositiveNumber(value: unknown, path: string, errors: string[]): void {
  if (value !== undefined) {
    validatePositiveNumber(value, path, errors);
  }
}

function validateNonNegativeNumber(value: unknown, path: string, errors: string[]): void {
  validateFiniteNumber(value, path, errors);
  if (typeof value === "number" && value < 0) {
    errors.push(`${path} must be greater than or equal to 0.`);
  }
}

function validateOptionalNonNegativeNumber(value: unknown, path: string, errors: string[]): void {
  if (value !== undefined) {
    validateNonNegativeNumber(value, path, errors);
  }
}

function validateUnitNumber(value: unknown, path: string, errors: string[]): void {
  validateFiniteNumber(value, path, errors);
  if (typeof value === "number" && (value < 0 || value > 1)) {
    errors.push(`${path} must be between 0 and 1.`);
  }
}

function validateInteger(value: unknown, path: string, errors: string[]): void {
  validateFiniteNumber(value, path, errors);
  if (typeof value === "number" && !Number.isInteger(value)) {
    errors.push(`${path} must be an integer.`);
  }
}

function validateNonNegativeInteger(value: unknown, path: string, errors: string[]): void {
  validateInteger(value, path, errors);
  if (typeof value === "number" && value < 0) {
    errors.push(`${path} must be greater than or equal to 0.`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOneOf<const T extends readonly unknown[]>(value: unknown, candidates: T): value is T[number] {
  return candidates.includes(value);
}

function isJsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }

  if (!isRecord(value) || value instanceof Date) {
    return false;
  }

  return Object.values(value).every(isJsonValue);
}
