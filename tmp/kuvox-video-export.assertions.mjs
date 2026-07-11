// scripts/video-export.assertions.ts
import assert from "node:assert/strict";

// app/lib/api.ts
var MediaKind = { Video: 0, Image: 1, Audio: 2 };
var OwnerKind = { User: 0, Studio: 1 };

// app/lib/editor/editor-observability.client.ts
var requestIdHeaderName = "x-request-id";
var editorCorrelationHeaderName = "x-kuvox-editor-correlation-id";
var diagnosticsLimit = 200;
var redacted = "[redacted]";
var sensitiveKeys = /* @__PURE__ */ new Set([
  "authorization",
  "cookie",
  "setcookie",
  "jwt",
  "token",
  "accesstoken",
  "refreshtoken",
  "idtoken",
  "session",
  "secret",
  "password",
  "credential",
  "storagekey",
  "canonicalstoragekey",
  "proxystoragekey",
  "thumbnailstoragekey",
  "filename",
  "filename",
  "objecturl",
  "url",
  "href",
  "src",
  "command",
  "prompt",
  "query",
  "searchquery",
  "text",
  "evidence",
  "documentjson",
  "document",
  "operationsjson"
]);
var mediaUrlPattern = /^(blob:|data:|https?:\/\/|\/bff\/media\/|\/api\/media\/)/i;
var recentLogs = [];
function createEditorCorrelationId(scope) {
  const safeScope = scope.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "editor";
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${safeScope}-${random}`;
}
function logVideoEditorEvent(eventName, fields = {}, level = "info") {
  const snapshot = {
    eventName,
    level,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    fields: sanitizeVideoEditorLogFields(fields)
  };
  if (isDevRuntime()) {
    recentLogs.push(snapshot);
    while (recentLogs.length > diagnosticsLimit) recentLogs.shift();
    installDiagnosticsGlobal();
  }
  const consoleMethod = level === "error" ? "error" : level === "warn" ? "warn" : level === "debug" ? "debug" : "info";
  console[consoleMethod]("[kuvox-video-editor]", snapshot);
}
function sanitizeVideoEditorLogFields(fields) {
  return sanitizeValue(fields, []);
}
function withEditorCorrelationHeaders(headers = {}, correlationId) {
  const next = new Headers(headers);
  if (!next.has(requestIdHeaderName)) {
    next.set(requestIdHeaderName, createEditorCorrelationId("request"));
  }
  if (correlationId && !next.has(editorCorrelationHeaderName)) {
    next.set(editorCorrelationHeaderName, correlationId);
  }
  return next;
}
function sanitizeValue(value, path) {
  const key = path.at(-1) ?? "";
  if (isSensitiveLogKey(key)) {
    return redacted;
  }
  if (typeof value === "string") {
    if (mediaUrlPattern.test(value) || looksLikeToken(value)) return redacted;
    return value.length > 300 ? `${value.slice(0, 300)}...` : value;
  }
  if (typeof value === "number" || typeof value === "boolean" || value === null || value === void 0) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item, index) => sanitizeValue(item, [...path, String(index)]));
  }
  if (typeof value === "object") {
    const record = value;
    return Object.fromEntries(
      Object.entries(record).map(([entryKey, entryValue]) => [
        entryKey,
        sanitizeValue(entryValue, [...path, entryKey])
      ])
    );
  }
  return String(value);
}
function isSensitiveLogKey(key) {
  const normalized = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
  if (sensitiveKeys.has(normalized)) return true;
  if (normalized.endsWith("token") || normalized.endsWith("secret") || normalized.endsWith("storagekey")) return true;
  return normalized.endsWith("objecturl");
}
function looksLikeToken(value) {
  if (/^Bearer\s+/i.test(value)) return true;
  if (/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(value)) return true;
  return value.length > 80 && /^[A-Za-z0-9._~+/=-]+$/.test(value);
}
function installDiagnosticsGlobal() {
  if (!isDevRuntime() || typeof window === "undefined" || window.__KUVOX_VIDEO_EDITOR_DIAGNOSTICS__) {
    return;
  }
  window.__KUVOX_VIDEO_EDITOR_DIAGNOSTICS__ = {
    getRecentLogs: () => recentLogs.map(cloneSnapshot),
    clearRecentLogs: () => {
      recentLogs.length = 0;
    },
    exportSnapshot: () => ({
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      events: recentLogs.map(cloneSnapshot)
    })
  };
}
function cloneSnapshot(snapshot) {
  return JSON.parse(JSON.stringify(snapshot));
}
function isDevRuntime() {
  return Boolean(import.meta.env?.DEV);
}

// app/lib/media-pipeline.ts
function resolveMediaPipeline(media, override) {
  const pipeline = override ?? media.pipeline;
  if (pipeline?.stage) {
    return {
      stage: pipeline.stage,
      label: pipeline.label || fallbackLabel(media),
      detail: pipeline.detail || fallbackDetail(media),
      step: normalizeStep(pipeline.step, 1),
      stepCount: normalizeStep(pipeline.stepCount, 4),
      terminal: Boolean(pipeline.terminal)
    };
  }
  return fallbackPipeline(media);
}
function fallbackPipeline(media) {
  const status = media.status.trim().toLowerCase();
  if (status === "ready" || status === "complete" || status === "completed") {
    return {
      stage: "ready",
      label: "Ready to edit",
      detail: "Import and processing completed.",
      step: 4,
      stepCount: 4,
      terminal: true
    };
  }
  if (status === "failed") {
    return {
      stage: "failed",
      label: "Import failed",
      detail: media.errorMessage || "Kuvox could not finish importing this file.",
      step: 4,
      stepCount: 4,
      terminal: true
    };
  }
  if (status === "processing") {
    return {
      stage: media.kind === MediaKind.Video ? "ingesting" : "optimizing",
      label: media.kind === MediaKind.Video ? "Analyzing video" : "Optimizing media",
      detail: media.kind === MediaKind.Video ? "Kuvox is indexing shots and AI context." : "Kuvox is finalizing optimized media.",
      step: 3,
      stepCount: 4,
      terminal: false
    };
  }
  if (status === "uploaded" || status === "uploading") {
    return {
      stage: "optimizing",
      label: "Optimizing media",
      detail: "Upload saved. Kuvox is generating optimized media and previews.",
      step: 2,
      stepCount: 4,
      terminal: false
    };
  }
  return {
    stage: "queued",
    label: fallbackLabel(media),
    detail: fallbackDetail(media),
    step: 1,
    stepCount: 4,
    terminal: false
  };
}
function fallbackLabel(media) {
  return media.status || "Queued";
}
function fallbackDetail(media) {
  return media.errorMessage || "Import status is being updated.";
}
function normalizeStep(value, fallback) {
  const next = Number(value);
  return Number.isFinite(next) && next > 0 ? next : fallback;
}

// app/lib/editor/editor-timeline.ts
var TIMELINE_FRAME_FLOOR_SECONDS = 1 / 120;
function roundTime(value) {
  return Math.round(value * 1e3) / 1e3;
}

// app/lib/editor/editor-media.ts
function mediaReadiness(media) {
  const pipeline = resolveMediaPipeline(media);
  if (pipeline.stage === "failed") return "failed";
  if (pipeline.stage === "ready") return "ready";
  return pipeline.terminal ? "failed" : "processing";
}

// app/lib/editor/video-document.ts
var VIDEO_PROJECT_DOCUMENT_SCHEMA_VERSION = 1;
var defaultTransform = {
  x: 0,
  y: 0,
  scaleX: 1,
  scaleY: 1,
  rotation: 0
};
var defaultCrop = {
  top: 0,
  right: 0,
  bottom: 0,
  left: 0
};
var defaultSettings = {
  width: 1920,
  height: 1080,
  aspectRatio: "16:9",
  frameRate: 30,
  previewQuality: "balanced",
  defaultTransitionDuration: 0.4,
  exportPreset: "h264-1080p"
};
function createEmptyVideoProjectDocument(project) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
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
      createTrack("t1", "text", "T1")
    ],
    transitions: [],
    effects: [],
    history: {
      revision: 0,
      canUndo: false,
      canRedo: false
    }
  };
}
function createMockVideoProjectDocument(projectId, projectName = "Summer Highlights") {
  const document2 = createEmptyVideoProjectDocument({
    id: projectId,
    name: projectName,
    createdAt: "2026-01-05T09:00:00.000Z",
    updatedAt: "2026-01-05T09:12:00.000Z"
  });
  return {
    ...document2,
    media: {
      "clip-beach": createMedia(
        "clip-beach",
        "video",
        "Beach_01.mp4",
        32,
        1920,
        1080,
        "video/mp4"
      ),
      "clip-city": createMedia(
        "clip-city",
        "video",
        "City_Night.mp4",
        24,
        1920,
        1080,
        "video/mp4"
      ),
      "clip-mountain": createMedia(
        "clip-mountain",
        "video",
        "Mountain_View.mp4",
        35,
        1920,
        1080,
        "video/mp4"
      ),
      "audio-main": createMedia(
        "audio-main",
        "audio",
        "Main ambience.wav",
        38,
        void 0,
        void 0,
        "audio/wav"
      ),
      "audio-music": createMedia(
        "audio-music",
        "audio",
        "Music bed",
        25,
        void 0,
        void 0,
        "audio/mpeg"
      )
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
            "linked-beach"
          ),
          createVideoClip(
            "tl-city",
            "clip-city",
            23.8,
            16,
            0,
            16,
            "shot-city-middle",
            "linked-city"
          ),
          createVideoClip(
            "tl-mountain",
            "clip-mountain",
            41.4,
            25,
            0,
            25,
            "shot-mountain-ending"
          )
        ]
      },
      {
        ...createTrack("a1", "audio", "A1"),
        items: [
          createAudioItem("tl-audio-main", "audio-main", 2, 37.8, 0, 37.8, "linked-beach"),
          createAudioItem("tl-audio-bed", "audio-music", 41.4, 25, 0, 25)
        ]
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
              textAlign: "center"
            },
            transform: { ...defaultTransform, y: 320 },
            layerOrder: 10
          }
        ]
      }
    ],
    transitions: [
      {
        id: "transition-beach-city",
        type: "crossfade",
        targetItemIds: ["tl-beach", "tl-city"],
        duration: 0.4,
        easing: "ease-in-out"
      }
    ],
    effects: [
      {
        id: "effect-city-speed-ramp",
        type: "speed-ramp",
        targetItemIds: ["tl-city"],
        enabled: true,
        parameters: { peakSpeed: 4 }
      }
    ],
    history: {
      revision: 1,
      lastSavedAt: "2026-01-05T09:12:00.000Z",
      lastOperationId: "mock-operation-1",
      canUndo: false,
      canRedo: false
    }
  };
}
function validateVideoProjectDocument(value) {
  const errors = [];
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
  return { ok: true, document: value, errors: [] };
}
function createTrack(id, kind, label) {
  return {
    id,
    kind,
    label,
    locked: false,
    hidden: false,
    muted: false,
    items: []
  };
}
function createMedia(id, kind, name, duration, width, height, mimeType) {
  const media = {
    id,
    kind,
    name,
    duration
  };
  if (width !== void 0) media.width = width;
  if (height !== void 0) media.height = height;
  if (mimeType !== void 0) media.mimeType = mimeType;
  return media;
}
function createVideoClip(id, mediaId, timelineStart, duration, sourceIn, sourceOut, shotId, linkedGroupId) {
  const item = {
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
    opacity: 1
  };
  if (shotId !== void 0) item.shotId = shotId;
  if (linkedGroupId !== void 0) item.linkedGroupId = linkedGroupId;
  return item;
}
function createAudioItem(id, mediaId, timelineStart, duration, sourceIn, sourceOut, linkedGroupId) {
  const item = {
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
      fadeOutDuration: 0
    }
  };
  if (linkedGroupId !== void 0) item.linkedGroupId = linkedGroupId;
  return item;
}
function validateSettings(value, errors) {
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
    errors
  );
  validateRequiredString(value.exportPreset, "settings.exportPreset", errors);
}
function validateMedia(value, errors) {
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
function validateObjectUrls(value, path, errors) {
  if (value === void 0) {
    return;
  }
  if (!isRecord(value)) {
    errors.push(`${path} must be an object when provided.`);
    return;
  }
  for (const variant of ["proxy", "canonical", "raw"]) {
    validateOptionalString(value[variant], `${path}.${variant}`, errors);
  }
}
function validateTracks(value, mediaById, mediaIds, errors) {
  const itemIds = /* @__PURE__ */ new Set();
  const trackIds = /* @__PURE__ */ new Set();
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
        isOneOf(track.kind, ["video", "audio", "text", "overlay"]) ? track.kind : void 0,
        mediaById,
        mediaIds,
        itemIds,
        errors
      );
    });
  });
  return itemIds;
}
function validateTimelineItem(value, path, trackKind, mediaById, mediaIds, itemIds, errors) {
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
function validateMediaItemFields(value, path, expectedKind, mediaById, mediaIds, errors) {
  validateRequiredString(value.mediaId, `${path}.mediaId`, errors);
  if (typeof value.mediaId === "string" && !mediaIds.has(value.mediaId)) {
    errors.push(`${path}.mediaId references missing media ${value.mediaId}.`);
  }
  validateMediaKind(value.mediaId, expectedKind, mediaById, `${path}.mediaId`, errors);
  validateNonNegativeNumber(value.sourceIn, `${path}.sourceIn`, errors);
  validatePositiveNumber(value.sourceOut, `${path}.sourceOut`, errors);
  if (typeof value.sourceIn === "number" && typeof value.sourceOut === "number" && value.sourceOut <= value.sourceIn) {
    errors.push(`${path}.sourceOut must be greater than sourceIn.`);
  }
  const media = typeof value.mediaId === "string" ? mediaById[value.mediaId] : void 0;
  if (isRecord(media) && typeof media.duration === "number" && typeof value.sourceOut === "number" && value.sourceOut > media.duration) {
    errors.push(`${path}.sourceOut must not exceed the media duration.`);
  }
}
function validateMediaKind(mediaId, expectedKind, mediaById, path, errors) {
  if (typeof mediaId !== "string") {
    return;
  }
  const media = mediaById[mediaId];
  if (isRecord(media) && media.kind !== expectedKind) {
    errors.push(`${path} must reference ${expectedKind} media.`);
  }
}
function validateTransform(value, path, errors) {
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
function validateCrop(value, path, errors) {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object.`);
    return;
  }
  validateUnitNumber(value.top, `${path}.top`, errors);
  validateUnitNumber(value.right, `${path}.right`, errors);
  validateUnitNumber(value.bottom, `${path}.bottom`, errors);
  validateUnitNumber(value.left, `${path}.left`, errors);
}
function validateAudioFades(value, path, errors) {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object.`);
    return;
  }
  validateNonNegativeNumber(value.fadeInDuration, `${path}.fadeInDuration`, errors);
  validateNonNegativeNumber(value.fadeOutDuration, `${path}.fadeOutDuration`, errors);
}
function validateTextStyle(value, path, errors) {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object.`);
    return;
  }
  validateRequiredString(value.fontFamily, `${path}.fontFamily`, errors);
  validatePositiveNumber(value.fontSize, `${path}.fontSize`, errors);
  validateRequiredString(value.color, `${path}.color`, errors);
  validateOptionalString(value.backgroundColor, `${path}.backgroundColor`, errors);
  if (value.fontWeight !== void 0 && !isOneOf(value.fontWeight, ["normal", "medium", "semibold", "bold"])) {
    errors.push(`${path}.fontWeight must be normal, medium, semibold, or bold.`);
  }
  if (value.fontStyle !== void 0 && !isOneOf(value.fontStyle, ["normal", "italic"])) {
    errors.push(`${path}.fontStyle must be normal or italic.`);
  }
  if (value.textAlign !== void 0 && !isOneOf(value.textAlign, ["left", "center", "right"])) {
    errors.push(`${path}.textAlign must be left, center, or right.`);
  }
}
function validateTargetedList(value, path, itemIds, errors, validateEntry) {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array.`);
    return;
  }
  const ids = /* @__PURE__ */ new Set();
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
function validateTransition(value, path, itemIds, errors) {
  validateRequiredString(value.type, `${path}.type`, errors);
  validateTargetItemIds(value.targetItemIds, `${path}.targetItemIds`, itemIds, errors);
  validatePositiveNumber(value.duration, `${path}.duration`, errors);
  validateOptionalString(value.easing, `${path}.easing`, errors);
}
function validateEffect(value, path, itemIds, errors) {
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
function validateTargetItemIds(value, path, itemIds, errors) {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push(`${path} must be a non-empty array.`);
    return;
  }
  const targetIds = /* @__PURE__ */ new Set();
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
function validateHistory(value, errors) {
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
function isItemAllowedOnTrack(itemType, trackKind) {
  if (trackKind === "video") return itemType === "video" || itemType === "image";
  if (trackKind === "audio") return itemType === "audio";
  if (trackKind === "text") return itemType === "text";
  return itemType === "overlay" || itemType === "image" || itemType === "text";
}
function addUnique(seen, value, path, label, errors) {
  if (seen.has(value)) {
    errors.push(`${path} duplicates ${label} ${value}.`);
    return;
  }
  seen.add(value);
}
function validateRequiredString(value, path, errors) {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${path} must be a non-empty string.`);
  }
}
function validateOptionalString(value, path, errors) {
  if (value !== void 0 && typeof value !== "string") {
    errors.push(`${path} must be a string when provided.`);
  }
}
function validateIsoDateString(value, path, errors) {
  validateRequiredString(value, path, errors);
  if (typeof value === "string" && Number.isNaN(Date.parse(value))) {
    errors.push(`${path} must be an ISO date string.`);
  }
}
function validateOptionalIsoDateString(value, path, errors) {
  if (value === void 0) {
    return;
  }
  validateIsoDateString(value, path, errors);
}
function validateBoolean(value, path, errors) {
  if (typeof value !== "boolean") {
    errors.push(`${path} must be a boolean.`);
  }
}
function validateFiniteNumber(value, path, errors) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    errors.push(`${path} must be a finite number.`);
  }
}
function validatePositiveNumber(value, path, errors) {
  validateFiniteNumber(value, path, errors);
  if (typeof value === "number" && value <= 0) {
    errors.push(`${path} must be greater than 0.`);
  }
}
function validateOptionalPositiveNumber(value, path, errors) {
  if (value !== void 0) {
    validatePositiveNumber(value, path, errors);
  }
}
function validateNonNegativeNumber(value, path, errors) {
  validateFiniteNumber(value, path, errors);
  if (typeof value === "number" && value < 0) {
    errors.push(`${path} must be greater than or equal to 0.`);
  }
}
function validateOptionalNonNegativeNumber(value, path, errors) {
  if (value !== void 0) {
    validateNonNegativeNumber(value, path, errors);
  }
}
function validateUnitNumber(value, path, errors) {
  validateFiniteNumber(value, path, errors);
  if (typeof value === "number" && (value < 0 || value > 1)) {
    errors.push(`${path} must be between 0 and 1.`);
  }
}
function validateInteger(value, path, errors) {
  validateFiniteNumber(value, path, errors);
  if (typeof value === "number" && !Number.isInteger(value)) {
    errors.push(`${path} must be an integer.`);
  }
}
function validateNonNegativeInteger(value, path, errors) {
  validateInteger(value, path, errors);
  if (typeof value === "number" && value < 0) {
    errors.push(`${path} must be greater than or equal to 0.`);
  }
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isOneOf(value, candidates) {
  return candidates.includes(value);
}
function isJsonValue(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value)) {
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

// app/lib/editor/video-export.ts
var VideoRenderRequestError = class extends Error {
  status;
  response;
  constructor(message, options = {}) {
    super(message);
    this.name = "VideoRenderRequestError";
    this.status = options.status ?? null;
    this.response = options.response ?? null;
  }
};
var exportPresets = ["h264-720p", "h264-1080p", "h264-4k", "prores-master"];
var exportFormats = ["mp4", "mov"];
var exportResolutions = ["1280x720", "1920x1080", "3840x2160", "current"];
var exportQualities = ["draft", "standard", "high"];
var exportFrameRates = [24, 25, 30, 60];
function createDefaultVideoExportSettings(document2, projectName) {
  const preset = isOneOf2(document2?.settings.exportPreset, exportPresets) ? document2.settings.exportPreset : "h264-1080p";
  const dimensions = dimensionsForPreset(preset, document2);
  const frameRate = exportFrameRates.includes(document2?.settings.frameRate) ? document2?.settings.frameRate ?? 30 : 30;
  return {
    preset,
    format: preset === "prores-master" ? "mov" : "mp4",
    resolution: resolutionForDimensions(dimensions.width, dimensions.height, document2),
    width: dimensions.width,
    height: dimensions.height,
    frameRate,
    quality: preset === "h264-720p" ? "draft" : "standard",
    destinationLabel: `${sanitizeLabel(projectName || document2?.name || "Untitled video")} ${preset}`
  };
}
function resolveVideoExportDimensions(document2, resolution) {
  if (resolution === "1280x720") return { width: 1280, height: 720 };
  if (resolution === "1920x1080") return { width: 1920, height: 1080 };
  if (resolution === "3840x2160") return { width: 3840, height: 2160 };
  return {
    width: positiveIntegerOrFallback(document2?.settings.width, 1920),
    height: positiveIntegerOrFallback(document2?.settings.height, 1080)
  };
}
function validateVideoExport(document2, media, settings2, projectMedia) {
  const errors = [];
  const warnings = [];
  const validation = validateVideoProjectDocument(document2);
  if (!validation.ok) {
    collectMissingDocumentMediaIssues(document2, errors);
    errors.push({
      severity: "error",
      code: "invalid-document",
      message: validation.errors.length > 0 ? `Video document is not exportable: ${validation.errors.join(" ")}` : "Video document is missing."
    });
    return { ok: false, errors, warnings };
  }
  validateSettings2(settings2, errors);
  const mediaById = new Map(media.map((item) => [item.id, item]));
  const projectMediaById = new Map((projectMedia ?? []).map((item) => [item.mediaId, item]));
  const enforceProjectMediaAssociation = projectMedia !== void 0;
  for (const track of validation.document.tracks) {
    if (track.hidden) continue;
    if (track.kind === "audio" && track.muted) continue;
    for (const item of track.items) {
      if (item.duration <= 0) continue;
      if (!isMediaBackedItem(item)) continue;
      if (item.type === "audio" && item.muted) continue;
      validateReferencedMedia(
        item,
        track,
        validation.document.media[item.mediaId],
        mediaById.get(item.mediaId),
        projectMediaById.get(item.mediaId),
        enforceProjectMediaAssociation,
        errors
      );
    }
  }
  const manifestResult = buildVideoRenderManifestFromValidDocument(
    validation.document,
    media,
    settings2,
    projectMedia
  );
  errors.push(...manifestResult.errors);
  warnings.push(...manifestResult.warnings);
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    ...errors.length === 0 && manifestResult.ok ? { manifest: manifestResult.manifest } : {}
  };
}
function buildVideoRenderManifestFromValidDocument(document2, media, settings2, projectMedia) {
  const errors = [];
  const warnings = [];
  const loadedMediaById = new Map(media.map((item) => [item.id, item]));
  const projectMediaById = new Map((projectMedia ?? []).map((item) => [item.mediaId, item]));
  const mediaSourcesById = /* @__PURE__ */ new Map();
  const visualItems = [];
  const audioItems = [];
  const textOverlays = [];
  let hasVisibleVisualMediaBackedItem = false;
  for (const transition of document2.transitions) {
    errors.push({
      severity: "error",
      code: "unsupported-transition",
      message: `Transition ${transition.id} is not supported by the V-013 renderer manifest.`
    });
  }
  for (const effect of document2.effects) {
    if (!effect.enabled) continue;
    errors.push({
      severity: "error",
      code: "unsupported-effect",
      message: `Effect ${effect.id} is not supported by the V-013 renderer manifest.`
    });
  }
  document2.tracks.forEach((track, trackIndex) => {
    if (track.items.length > 0 && track.hidden) {
      warnings.push({
        severity: "warning",
        code: "hidden-track-excluded",
        trackId: track.id,
        message: `${track.label} is hidden and will be excluded from export.`
      });
    }
    if (track.hidden) return;
    if (track.kind === "audio" && track.items.length > 0 && track.muted) {
      warnings.push({
        severity: "warning",
        code: "muted-audio-track-excluded",
        trackId: track.id,
        message: `${track.label} is muted and will be excluded from export.`
      });
      return;
    }
    for (const item of track.items) {
      if (item.duration <= 0) continue;
      if (item.type === "text") {
        textOverlays.push({
          itemId: item.id,
          trackId: track.id,
          text: item.text,
          timelineStart: roundTime(item.timelineStart),
          duration: roundTime(item.duration),
          style: { ...item.style },
          transform: renderTransform(item.transform),
          opacity: 1,
          layerOrder: item.layerOrder
        });
        continue;
      }
      if (!isMediaBackedItem(item)) continue;
      const documentMedia = document2.media[item.mediaId];
      const loadedMedia = loadedMediaById.get(item.mediaId);
      const source = canonicalRenderSourceForMedia(
        item.mediaId,
        loadedMedia,
        projectMediaById.get(item.mediaId)
      );
      if (isVisualMediaBackedItem(item)) {
        hasVisibleVisualMediaBackedItem = true;
      }
      if (!documentMedia || !source) {
        errors.push({
          severity: "error",
          code: "missing-canonical-source",
          itemId: item.id,
          trackId: track.id,
          mediaId: item.mediaId,
          message: `${documentMedia?.name ?? item.mediaId} is missing a canonical render source.`
        });
        continue;
      }
      mediaSourcesById.set(item.mediaId, renderMediaSource(documentMedia, source));
      if (item.type === "audio") {
        if (item.muted) {
          warnings.push({
            severity: "warning",
            code: "muted-audio-item-excluded",
            itemId: item.id,
            trackId: track.id,
            mediaId: item.mediaId,
            message: `${documentMedia.name} is muted and will be excluded from export audio.`
          });
          continue;
        }
        audioItems.push({
          itemId: item.id,
          trackId: track.id,
          mediaId: item.mediaId,
          timelineStart: roundTime(item.timelineStart),
          duration: roundTime(item.duration),
          sourceIn: roundTime(item.sourceIn),
          sourceOut: roundTime(item.sourceOut),
          speed: 1,
          volume: roundTime(item.volume),
          muted: false,
          fades: {
            fadeInDuration: roundTime(item.fades.fadeInDuration),
            fadeOutDuration: roundTime(item.fades.fadeOutDuration)
          },
          layerOrder: trackIndex
        });
        continue;
      }
      visualItems.push({
        itemId: item.id,
        trackId: track.id,
        type: item.type,
        mediaId: item.mediaId,
        ...item.type === "video" && item.shotId ? { shotId: item.shotId } : {},
        timelineStart: roundTime(item.timelineStart),
        duration: roundTime(item.duration),
        ...item.type === "video" ? {
          sourceIn: roundTime(item.sourceIn),
          sourceOut: roundTime(item.sourceOut),
          speed: roundTime(item.speed),
          crop: renderCrop(item.crop)
        } : {},
        layerOrder: "layerOrder" in item ? item.layerOrder : trackIndex,
        transform: renderTransform(item.transform),
        opacity: roundTime(item.opacity)
      });
    }
  });
  if (!hasVisibleVisualMediaBackedItem) {
    errors.push({
      severity: "error",
      code: "no-visible-visual-media",
      message: "Add at least one visible video, image, or overlay item before exporting."
    });
  }
  if (errors.length > 0) {
    return { ok: false, errors, warnings };
  }
  const sortedVisualItems = [...visualItems].sort(compareRenderItems);
  const sortedAudioItems = [...audioItems].sort(compareRenderItems);
  const sortedTextOverlays = [...textOverlays].sort(compareRenderItems);
  const durationSeconds = roundTime(Math.max(
    0,
    ...sortedVisualItems.map(itemEnd),
    ...sortedAudioItems.map(itemEnd),
    ...sortedTextOverlays.map(itemEnd)
  ));
  return {
    ok: true,
    errors: [],
    warnings,
    manifest: {
      schemaVersion: 1,
      projectId: document2.projectId,
      settings: { ...settings2 },
      durationSeconds,
      mediaSources: [...mediaSourcesById.values()].sort((a, b) => a.mediaId.localeCompare(b.mediaId)),
      visualItems: sortedVisualItems,
      audioItems: sortedAudioItems,
      textOverlays: sortedTextOverlays
    }
  };
}
async function requestVideoRenderJob(input) {
  let response;
  const correlationId = createEditorCorrelationId("render");
  logVideoEditorEvent("editor.render.request.start", {
    timelineId: input.timelineId,
    revisionNumber: input.revisionNumber,
    correlationId
  });
  try {
    response = await fetch(`/bff/timelines/${encodeURIComponent(input.timelineId)}/render`, {
      method: "POST",
      headers: withEditorCorrelationHeaders({ "Content-Type": "application/json", Accept: "application/json" }, correlationId),
      body: JSON.stringify({
        timelineId: input.timelineId,
        revisionNumber: input.revisionNumber,
        settings: input.settings
      })
    });
  } catch (error) {
    logVideoEditorEvent("editor.render.request.backend-unavailable", {
      timelineId: input.timelineId,
      revisionNumber: input.revisionNumber,
      correlationId,
      reason: error instanceof Error ? error.message : "Render backend could not be reached."
    }, "error");
    throw new VideoRenderRequestError(
      error instanceof Error ? error.message : "Render backend could not be reached.",
      { status: null }
    );
  }
  if (!response.ok) {
    const eventName = [404, 501, 502, 504].includes(response.status) ? "editor.render.request.backend-unavailable" : "editor.render.request.failure";
    logVideoEditorEvent(eventName, {
      timelineId: input.timelineId,
      revisionNumber: input.revisionNumber,
      correlationId,
      status: response.status
    }, "error");
    throw new VideoRenderRequestError(await readRenderJobError(response), {
      status: response.status,
      response
    });
  }
  const job = normalizeVideoRenderJob(await response.json());
  logVideoEditorEvent("editor.render.request.success", {
    timelineId: input.timelineId,
    revisionNumber: input.revisionNumber,
    renderJobId: job.id,
    renderJobStatus: job.status,
    correlationId
  });
  return job;
}
function normalizeVideoRenderJob(payload) {
  const body = isRecord2(payload) ? payload : {};
  const nestedJob = isRecord2(body.job) ? body.job : {};
  const source = Object.keys(nestedJob).length > 0 ? nestedJob : body;
  const rawStatus = String(source.status ?? source.state ?? "queued").toLowerCase();
  const status = normalizeRenderStatus(rawStatus);
  const id = String(source.id ?? source.jobId ?? "");
  const outputAvailable = source.outputAvailable === true;
  return {
    id,
    timelineId: String(source.timelineId ?? body.timelineId ?? ""),
    revisionNumber: numberOrNull(source.revisionNumber ?? body.revisionNumber),
    status,
    outputAvailable,
    outputUrl: status === "completed" && outputAvailable && id ? `/bff/timelines/render-jobs/${encodeURIComponent(id)}/output` : null,
    outputContentType: stringOrNull(source.outputContentType),
    outputSizeBytes: numberOrNull(source.outputSizeBytes),
    errorCode: stringOrNull(source.errorCode),
    errorMessage: stringOrNull(source.errorMessage),
    startedAt: stringOrNull(source.startedAt),
    finishedAt: stringOrNull(source.finishedAt),
    createdAt: stringOrNull(source.createdAt),
    updatedAt: stringOrNull(source.updatedAt ?? source.occurredAt),
    message: typeof source.message === "string" ? source.message : typeof source.errorMessage === "string" ? source.errorMessage : null
  };
}
function isRenderBackendUnavailable(errorOrResponse) {
  if (errorOrResponse instanceof VideoRenderRequestError) {
    return errorOrResponse.status === null || [404, 501, 502, 504].includes(errorOrResponse.status);
  }
  if (typeof Response !== "undefined" && errorOrResponse instanceof Response) {
    return [404, 501, 502, 504].includes(errorOrResponse.status);
  }
  if (errorOrResponse instanceof TypeError) return true;
  if (errorOrResponse instanceof Error && /network|failed to fetch|timeout|timed out/i.test(errorOrResponse.message)) {
    return true;
  }
  if (isRecord2(errorOrResponse) && typeof errorOrResponse.status === "number") {
    return [404, 501, 502, 504].includes(errorOrResponse.status);
  }
  return false;
}
function validateSettings2(settings2, errors) {
  if (!isOneOf2(settings2.preset, exportPresets)) {
    errors.push({ severity: "error", code: "invalid-preset", message: "Choose a supported export preset." });
  }
  if (!isOneOf2(settings2.format, exportFormats)) {
    errors.push({ severity: "error", code: "invalid-format", message: "Choose MP4 or MOV." });
  }
  if (!isOneOf2(settings2.resolution, exportResolutions)) {
    errors.push({ severity: "error", code: "invalid-resolution", message: "Choose a supported export resolution." });
  }
  if (!Number.isInteger(settings2.width) || settings2.width <= 0 || !Number.isInteger(settings2.height) || settings2.height <= 0) {
    errors.push({ severity: "error", code: "invalid-dimensions", message: "Export dimensions must be positive whole pixels." });
  }
  if (!exportFrameRates.includes(settings2.frameRate)) {
    errors.push({ severity: "error", code: "invalid-frame-rate", message: "Choose 24, 25, 30, or 60 fps." });
  }
  if (!isOneOf2(settings2.quality, exportQualities)) {
    errors.push({ severity: "error", code: "invalid-quality", message: "Choose draft, standard, or high quality." });
  }
}
function validateReferencedMedia(item, track, documentMedia, loadedMedia, projectMedia, enforceProjectMediaAssociation, errors) {
  if (!documentMedia) {
    errors.push({
      severity: "error",
      code: "missing-document-media",
      itemId: item.id,
      trackId: track.id,
      mediaId: item.mediaId,
      message: `Timeline item ${item.id} references media ${item.mediaId}, but it is missing from the video document.`
    });
    return;
  }
  if (enforceProjectMediaAssociation && !projectMedia) {
    errors.push({
      severity: "error",
      code: "unassociated-project-media",
      itemId: item.id,
      trackId: track.id,
      mediaId: item.mediaId,
      message: `${documentMedia.name} is not associated with this project.`
    });
    return;
  }
  if (projectMedia?.availability === "deleted") {
    errors.push({
      severity: "error",
      code: "deleted-project-media",
      itemId: item.id,
      trackId: track.id,
      mediaId: item.mediaId,
      message: `${documentMedia.name} was deleted and cannot be exported.`
    });
    return;
  }
  if (projectMedia?.availability === "inaccessible") {
    errors.push({
      severity: "error",
      code: "inaccessible-project-media",
      itemId: item.id,
      trackId: track.id,
      mediaId: item.mediaId,
      message: `${documentMedia.name} is no longer accessible and cannot be exported.`
    });
    return;
  }
  if (projectMedia?.availability === "missing") {
    errors.push({
      severity: "error",
      code: "missing-project-media",
      itemId: item.id,
      trackId: track.id,
      mediaId: item.mediaId,
      message: `${documentMedia.name} is missing from project media and cannot be exported.`
    });
    return;
  }
  if (projectMedia?.availability === "processing") {
    errors.push({
      severity: "error",
      code: "media-processing",
      itemId: item.id,
      trackId: track.id,
      mediaId: item.mediaId,
      message: `${documentMedia.name} is still processing and cannot be exported yet.`
    });
    return;
  }
  if (projectMedia?.availability === "failed") {
    errors.push({
      severity: "error",
      code: "media-failed",
      itemId: item.id,
      trackId: track.id,
      mediaId: item.mediaId,
      message: `${documentMedia.name} failed processing and cannot be exported.`
    });
    return;
  }
  if (!loadedMedia) {
    errors.push({
      severity: "error",
      code: "missing-project-media",
      itemId: item.id,
      trackId: track.id,
      mediaId: item.mediaId,
      message: `${documentMedia.name} is not present in the loaded project media.`
    });
    return;
  }
  const readiness = mediaReadiness(loadedMedia);
  if (readiness === "processing") {
    errors.push({
      severity: "error",
      code: "media-processing",
      itemId: item.id,
      trackId: track.id,
      mediaId: item.mediaId,
      message: `${documentMedia.name} is still processing and cannot be exported yet.`
    });
  }
  if (readiness === "failed") {
    errors.push({
      severity: "error",
      code: "media-failed",
      itemId: item.id,
      trackId: track.id,
      mediaId: item.mediaId,
      message: `${documentMedia.name} failed processing and cannot be exported.`
    });
  }
}
function isMediaBackedItem(item) {
  return "mediaId" in item;
}
function isVisualMediaBackedItem(item) {
  return item.type === "video" || item.type === "image" || item.type === "overlay";
}
function canonicalRenderSourceForMedia(mediaId, loadedMedia, projectMedia) {
  const storageKey = nonEmptyString(loadedMedia?.canonicalStorageKey) ?? nonEmptyString(projectMedia?.canonicalStorageKey);
  if (!storageKey) return null;
  return {
    variant: "canonical",
    storageKey,
    url: mediaObjectUrl(mediaId, "canonical", storageKey)
  };
}
function renderMediaSource(media, canonical) {
  return omitUndefined({
    mediaId: media.id,
    kind: media.kind,
    name: media.name,
    durationSeconds: media.duration === void 0 ? void 0 : roundTime(media.duration),
    width: media.width,
    height: media.height,
    mimeType: media.mimeType,
    canonical
  });
}
function renderTransform(transform) {
  return {
    x: roundTime(transform.x),
    y: roundTime(transform.y),
    scaleX: roundTime(transform.scaleX),
    scaleY: roundTime(transform.scaleY),
    rotation: roundTime(transform.rotation)
  };
}
function renderCrop(crop) {
  return {
    top: roundTime(crop.top),
    right: roundTime(crop.right),
    bottom: roundTime(crop.bottom),
    left: roundTime(crop.left)
  };
}
function compareRenderItems(a, b) {
  return a.timelineStart - b.timelineStart || a.layerOrder - b.layerOrder || a.itemId.localeCompare(b.itemId);
}
function itemEnd(item) {
  return roundTime(item.timelineStart + item.duration);
}
function mediaObjectUrl(mediaId, variant, cacheKey) {
  return `/bff/media/${encodeURIComponent(mediaId)}/object/${variant}?v=${encodeURIComponent(cacheKey)}`;
}
function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
function omitUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== void 0));
}
function collectMissingDocumentMediaIssues(document2, errors) {
  if (!isRecord2(document2) || !isRecord2(document2.media) || !Array.isArray(document2.tracks)) return;
  const mediaIds = new Set(Object.keys(document2.media));
  for (const track of document2.tracks) {
    if (!isRecord2(track) || !Array.isArray(track.items)) continue;
    const trackId = typeof track.id === "string" ? track.id : void 0;
    for (const item of track.items) {
      if (!isRecord2(item) || typeof item.mediaId !== "string" || mediaIds.has(item.mediaId)) continue;
      errors.push({
        severity: "error",
        code: "missing-document-media",
        itemId: typeof item.id === "string" ? item.id : void 0,
        trackId,
        mediaId: item.mediaId,
        message: `Timeline item ${typeof item.id === "string" ? item.id : "unknown"} references media ${item.mediaId}, but it is missing from the video document.`
      });
    }
  }
}
function dimensionsForPreset(preset, document2) {
  if (preset === "h264-720p") return { width: 1280, height: 720 };
  if (preset === "h264-4k") return { width: 3840, height: 2160 };
  if (preset === "prores-master") return resolveVideoExportDimensions(document2, "current");
  return { width: 1920, height: 1080 };
}
function resolutionForDimensions(width, height, document2) {
  if (width === 1280 && height === 720) return "1280x720";
  if (width === 1920 && height === 1080) return "1920x1080";
  if (width === 3840 && height === 2160) return "3840x2160";
  if (width === document2?.settings.width && height === document2.settings.height) return "current";
  return "current";
}
function normalizeRenderStatus(status) {
  if (["rendering", "running", "processing", "in-progress", "in_progress"].includes(status)) return "rendering";
  if (["completed", "complete", "succeeded", "success", "done"].includes(status)) return "completed";
  if (["failed", "error", "cancelled", "canceled"].includes(status)) return "failed";
  return "queued";
}
async function readRenderJobError(response) {
  try {
    const body = await response.json();
    return String(body?.detail || body?.error || body?.message || `Render request failed with ${response.status}.`);
  } catch {
    return `Render request failed with ${response.status}.`;
  }
}
function positiveIntegerOrFallback(value, fallback) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : fallback;
}
function numberOrNull(value) {
  if (value === null || value === void 0 || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}
function stringOrNull(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
function sanitizeLabel(value) {
  return value.trim().replace(/\s+/g, " ") || "Untitled video";
}
function isRecord2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isOneOf2(value, values) {
  return typeof value === "string" && values.includes(value);
}

// scripts/video-export.assertions.ts
async function main() {
  assertEmptyTimelineIsBlocked();
  assertTextOnlyTimelineIsBlocked();
  assertMissingDocumentMediaIsBlocked();
  assertMissingLoadedProjectMediaIsBlocked();
  assertProcessingAndFailedMediaAreBlocked();
  assertSupportedTimelinePasses();
  assertEffectsAndTransitionsAreBlocked();
  assertRenderJobNormalization();
  await assertRenderRequestBodyStaysStable();
  assertBackendUnavailableClassification();
  assertObjectStorageKeysDoNotBecomeOutputUrls();
}
function assertEmptyTimelineIsBlocked() {
  const document2 = createEmptyVideoProjectDocument({ id: "project-export-empty", name: "Empty" });
  const result = validateVideoExport(document2, [], settings(document2));
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((issue) => issue.code === "no-visible-visual-media"));
  assert.equal(result.manifest, void 0);
}
function assertTextOnlyTimelineIsBlocked() {
  const document2 = createEmptyVideoProjectDocument({ id: "project-export-text", name: "Text" });
  document2.tracks = [
    {
      id: "t1",
      kind: "text",
      label: "T1",
      locked: false,
      hidden: false,
      muted: false,
      items: [
        {
          id: "text-1",
          type: "text",
          timelineStart: 0,
          duration: 5,
          text: "Title",
          style: { fontFamily: "Inter", fontSize: 48, color: "#fff" },
          transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
          layerOrder: 1
        }
      ]
    }
  ];
  const result = validateVideoExport(document2, [], settings(document2));
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((issue) => issue.code === "no-visible-visual-media"));
}
function assertMissingDocumentMediaIsBlocked() {
  const document2 = createMockVideoProjectDocument("project-export-missing-document", "Missing document media");
  delete document2.media["clip-beach"];
  const result = validateVideoExport(document2, readyMediaForDocument(createMockVideoProjectDocument("project-export-missing-document")), settings(document2));
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((issue) => issue.code === "missing-document-media" && issue.mediaId === "clip-beach"));
}
function assertMissingLoadedProjectMediaIsBlocked() {
  const document2 = createMockVideoProjectDocument("project-export-missing-loaded", "Missing loaded media");
  const loaded = readyMediaForDocument(document2).filter((item) => item.id !== "clip-beach");
  const result = validateVideoExport(document2, loaded, settings(document2));
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((issue) => issue.code === "missing-project-media" && issue.mediaId === "clip-beach"));
}
function assertProcessingAndFailedMediaAreBlocked() {
  const processingDocument = singleVideoDocument("project-export-processing", "processing-media");
  const processing = validateVideoExport(
    processingDocument,
    [mediaDto("processing-media", MediaKind.Video, { status: "processing", pipelineStage: "optimizing", terminal: false })],
    settings(processingDocument)
  );
  assert.equal(processing.ok, false);
  assert.ok(processing.errors.some((issue) => issue.code === "media-processing"));
  const failedDocument = singleVideoDocument("project-export-failed", "failed-media");
  const failed = validateVideoExport(
    failedDocument,
    [mediaDto("failed-media", MediaKind.Video, { status: "failed", pipelineStage: "failed", terminal: true })],
    settings(failedDocument)
  );
  assert.equal(failed.ok, false);
  assert.ok(failed.errors.some((issue) => issue.code === "media-failed"));
}
function assertSupportedTimelinePasses() {
  const document2 = createMockVideoProjectDocument("project-export-pass", "Supported");
  document2.effects = [];
  document2.transitions = [];
  document2.media["still-poster"] = mediaReference("still-poster", "image", "Poster.png", 5);
  document2.tracks.push({
    id: "o1",
    kind: "overlay",
    label: "O1",
    locked: false,
    hidden: false,
    muted: false,
    items: [imageItem("image-1", "still-poster")]
  });
  const result = validateVideoExport(document2, readyMediaForDocument(document2), settings(document2));
  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);
  assert.equal(result.manifest?.schemaVersion, 1);
  assert.equal(result.manifest?.projectId, document2.projectId);
  assert.ok(result.manifest?.visualItems.some((item) => item.itemId === "image-1"));
}
function assertEffectsAndTransitionsAreBlocked() {
  const document2 = createMockVideoProjectDocument("project-export-blockers", "Blockers");
  const result = validateVideoExport(document2, readyMediaForDocument(document2), settings(document2));
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((issue) => issue.code === "unsupported-effect"));
  assert.ok(result.errors.some((issue) => issue.code === "unsupported-transition"));
  assert.equal(result.manifest, void 0);
}
function assertRenderJobNormalization() {
  assert.equal(normalizeVideoRenderJob({ id: "job-queued", status: "queued" }).status, "queued");
  assert.equal(normalizeVideoRenderJob({ id: "job-running", status: "running" }).status, "rendering");
  assert.equal(normalizeVideoRenderJob({ id: "job-complete", status: "succeeded" }).status, "completed");
  assert.equal(normalizeVideoRenderJob({ id: "job-failed", status: "error" }).status, "failed");
  const backendQueued = normalizeVideoRenderJob({
    id: "job-backend-queued",
    timelineId: "timeline-backend",
    revisionNumber: 3,
    status: "queued",
    outputUrl: null
  });
  assert.equal(backendQueued.timelineId, "timeline-backend");
  assert.equal(backendQueued.revisionNumber, 3);
  assert.equal(backendQueued.outputUrl, null);
}
async function assertRenderRequestBodyStaysStable() {
  const originalFetch = globalThis.fetch;
  let capturedBody = null;
  globalThis.fetch = (async (_input, init) => {
    capturedBody = typeof init?.body === "string" ? JSON.parse(init.body) : null;
    return new Response(JSON.stringify({ id: "job-1", status: "queued" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  });
  try {
    const exportSettings = settings(createEmptyVideoProjectDocument({ id: "project-request", name: "Request" }));
    const job = await requestVideoRenderJob({
      timelineId: "timeline-request",
      revisionNumber: 7,
      settings: exportSettings
    });
    assert.equal(job.id, "job-1");
    assert.deepEqual(capturedBody, {
      timelineId: "timeline-request",
      revisionNumber: 7,
      settings: exportSettings
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
}
function assertBackendUnavailableClassification() {
  assert.equal(isRenderBackendUnavailable(new VideoRenderRequestError("Not implemented", { status: 501 })), true);
  assert.equal(isRenderBackendUnavailable(new VideoRenderRequestError("Not found", { status: 404 })), true);
  assert.equal(isRenderBackendUnavailable(new VideoRenderRequestError("Proxy failed", { status: 502 })), true);
  assert.equal(isRenderBackendUnavailable(new VideoRenderRequestError("Failed to fetch", { status: null })), true);
  assert.equal(isRenderBackendUnavailable(new TypeError("Failed to fetch")), true);
  assert.equal(isRenderBackendUnavailable(new VideoRenderRequestError("Unauthorized", { status: 401 })), false);
  assert.equal(isRenderBackendUnavailable(new VideoRenderRequestError("Forbidden", { status: 403 })), false);
}
function assertObjectStorageKeysDoNotBecomeOutputUrls() {
  const storageOnly = normalizeVideoRenderJob({
    id: "job-storage",
    status: "completed",
    outputStorageKey: "renders/project/video.mp4"
  });
  assert.equal(storageOnly.status, "completed");
  assert.equal(storageOnly.outputUrl, null);
  const completed = normalizeVideoRenderJob({
    id: "job-api",
    status: "completed",
    outputAvailable: true
  });
  assert.equal(completed.outputUrl, "/bff/timelines/render-jobs/job-api/output");
  const objectStoreUrl = normalizeVideoRenderJob({
    id: "job-object-store",
    status: "completed",
    outputAvailable: false,
    outputUrl: "https://objects.example.test/renders/project/video.mp4"
  });
  assert.equal(objectStoreUrl.outputUrl, null);
}
function settings(document2) {
  return createDefaultVideoExportSettings(document2, document2.name);
}
function singleVideoDocument(projectId, mediaId) {
  const document2 = createEmptyVideoProjectDocument({ id: projectId, name: projectId });
  document2.media[mediaId] = mediaReference(mediaId, "video", `${mediaId}.mp4`, 8);
  document2.tracks[0].items = [
    {
      id: `tl-${mediaId}`,
      type: "video",
      mediaId,
      timelineStart: 0,
      duration: 8,
      sourceIn: 0,
      sourceOut: 8,
      speed: 1,
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      crop: { top: 0, right: 0, bottom: 0, left: 0 },
      opacity: 1
    }
  ];
  return document2;
}
function readyMediaForDocument(document2) {
  return Object.values(document2.media).map((item) => {
    const kind = item.kind === "audio" ? MediaKind.Audio : item.kind === "image" ? MediaKind.Image : MediaKind.Video;
    return mediaDto(item.id, kind);
  });
}
function mediaReference(id, kind, name, duration) {
  return {
    id,
    kind,
    name,
    duration,
    width: kind === "audio" ? void 0 : 1920,
    height: kind === "audio" ? void 0 : 1080,
    objectUrls: { raw: `/bff/media/${id}/object/raw?v=${id}-raw` },
    sourceUrl: `/bff/media/${id}/object/raw?v=${id}-raw`
  };
}
function imageItem(id, mediaId) {
  return {
    id,
    type: "image",
    mediaId,
    timelineStart: 1,
    duration: 5,
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    opacity: 1,
    layerOrder: 2
  };
}
function mediaDto(id, kind, options = {}) {
  const status = options.status ?? "ready";
  const stage = options.pipelineStage ?? "ready";
  const terminal = options.terminal ?? true;
  return {
    id,
    ownerId: "owner-1",
    ownerKind: OwnerKind.User,
    ownerEmail: "owner@example.com",
    ownerDisplayName: "Owner",
    kind,
    filename: `${id}.${kind === MediaKind.Audio ? "wav" : kind === MediaKind.Image ? "png" : "mp4"}`,
    storageKey: options.storageKey === null ? "" : options.storageKey ?? `media/${id}/raw`,
    sizeBytes: 1024,
    status,
    canonicalStorageKey: options.canonicalStorageKey === null ? null : options.canonicalStorageKey ?? `media/${id}/canonical`,
    proxyStorageKey: null,
    thumbnailStorageKey: null,
    errorMessage: status === "failed" ? "Processing failed." : null,
    durationSeconds: kind === MediaKind.Image ? null : 8,
    width: kind === MediaKind.Audio ? null : 1920,
    height: kind === MediaKind.Audio ? null : 1080,
    codec: null,
    frameRate: kind === MediaKind.Video ? 30 : null,
    createdAt: "2026-01-01T00:00:00.000Z",
    isFavorite: false,
    pipeline: {
      stage,
      label: stage,
      detail: stage,
      step: terminal ? 4 : 2,
      stepCount: 4,
      terminal
    }
  };
}
await main();
