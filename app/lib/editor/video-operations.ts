import type {
  AudioTimelineItem,
  ImageOverlayTimelineItem,
  JsonValue,
  TextTimelineItem,
  VideoAudioFades,
  VideoAdvancedItemState,
  VideoClipTimelineItem,
  VideoCrop,
  VideoMediaReference,
  VideoProjectDocument,
  VideoProjectSettings,
  VideoEffect,
  VideoTextStyle,
  VideoTimelineItem,
  VideoTransition,
  VideoTrack,
  VideoTrackKind,
  VideoTransform,
  VideoItemProperties,
  AudioItemProperties,
  ImageItemProperties,
  TextItemProperties,
} from "./video-document";
import { normalizeVideoTransform, validateVideoProjectDocument } from "./video-document";
import { validateAudioFadesForDuration } from "./editor-audio";

export type VideoOperationSource = "manual" | "ai";

export interface VideoOperationMetadata {
  id: string;
  source: VideoOperationSource;
  timestamp: string;
  label: string;
  affectedEntityIds: string[];
  commandId?: string;
  forceCheckpoint?: boolean;
}

export type VideoOperation =
  | AddMediaToTimelineOperation
  | AddAudioItemOperation
  | AddTextItemOperation
  | MoveItemOperation
  | TrimItemOperation
  | SplitItemOperation
  | DeleteItemOperation
  | ReorderItemOperation
  | ReorderTrackOperation
  | UpdateTrackOperation
  | UpdateTextOperation
  | UpdateAudioOperation
  | UpdateSpeedOperation
  | UpdateTransformCropOperation
  | UpdateAdvancedItemOperation
  | UpsertEffectOperation
  | RemoveEffectOperation
  | UpsertTransitionOperation
  | RemoveTransitionOperation
  | SetProjectSettingsOperation;

export interface AddMediaToTimelineOperation extends VideoOperationMetadata {
  type: "addMediaToTimeline";
  trackId: string;
  item: VideoClipTimelineItem | ImageOverlayTimelineItem;
}

export interface AddAudioItemOperation extends VideoOperationMetadata {
  type: "addAudioItem";
  trackId: string;
  item: AudioTimelineItem;
}

export interface AddTextItemOperation extends VideoOperationMetadata {
  type: "addTextItem";
  trackId: string;
  item: TextTimelineItem;
}

export interface MoveItemOperation extends VideoOperationMetadata {
  type: "moveItem";
  itemId: string;
  timelineStart: number;
  targetTrackId?: string;
}

export interface TrimItemOperation extends VideoOperationMetadata {
  type: "trimItem";
  itemId: string;
  edge?: "start" | "end";
  timelineStart: number;
  duration: number;
  sourceIn?: number;
  sourceOut?: number;
}

export interface SplitItemOperation extends VideoOperationMetadata {
  type: "splitItem";
  itemId: string;
  items: [VideoTimelineItem, VideoTimelineItem];
}

export interface DeleteItemOperation extends VideoOperationMetadata {
  type: "deleteItem";
  itemIds: string[];
}

export interface ReorderItemOperation extends VideoOperationMetadata {
  type: "reorderItem";
  itemId: string;
  targetTrackId?: string;
  targetIndex: number;
}

export interface UpdateTrackOperation extends VideoOperationMetadata {
  type: "updateTrack";
  trackId: string;
  trackLabel?: string;
  locked?: boolean;
  hidden?: boolean;
  muted?: boolean;
}

export interface ReorderTrackOperation extends VideoOperationMetadata {
  type: "reorderTrack";
  trackId: string;
  targetIndex: number;
}

export interface UpdateTextOperation extends VideoOperationMetadata {
  type: "updateText";
  itemId: string;
  text?: string;
  style?: VideoTextStyle;
  transform?: VideoTransform;
  layerOrder?: number;
  timelineStart?: number;
  duration?: number;
  properties?: TextItemProperties | null;
}

export interface UpdateAudioOperation extends VideoOperationMetadata {
  type: "updateAudio";
  itemId: string;
  volume?: number;
  muted?: boolean;
  fades?: VideoAudioFades;
  properties?: AudioItemProperties | null;
}

export interface UpdateSpeedOperation extends VideoOperationMetadata {
  type: "updateSpeed";
  itemId: string;
  speed: number;
  duration?: number;
  sourceOut?: number;
}

export interface UpdateTransformCropOperation extends VideoOperationMetadata {
  type: "updateTransformCrop";
  itemId: string;
  transform?: VideoTransform;
  crop?: VideoCrop;
  opacity?: number;
  layerOrder?: number;
  properties?: VideoItemProperties | ImageItemProperties | null;
}

export interface SetProjectSettingsOperation extends VideoOperationMetadata {
  type: "setProjectSettings";
  settings: Partial<VideoProjectSettings>;
}

export interface UpdateAdvancedItemOperation extends VideoOperationMetadata {
  type: "updateAdvancedItem";
  itemId: string;
  advanced: VideoAdvancedItemState | null;
}

export interface UpsertEffectOperation extends VideoOperationMetadata {
  type: "upsertEffect";
  effect: VideoEffect;
}

export interface RemoveEffectOperation extends VideoOperationMetadata {
  type: "removeEffect";
  effectId: string;
}

export interface UpsertTransitionOperation extends VideoOperationMetadata {
  type: "upsertTransition";
  transition: VideoTransition;
}

export interface RemoveTransitionOperation extends VideoOperationMetadata {
  type: "removeTransition";
  transitionId: string;
}

export interface VideoOperationBatch extends VideoOperationMetadata {
  operations: VideoOperation[];
}

export interface CreateVideoOperationBatchInput {
  id?: string;
  source: VideoOperationSource;
  timestamp?: string;
  label: string;
  operations: VideoOperation[];
  affectedEntityIds?: string[];
  commandId?: string;
  forceCheckpoint?: boolean;
}

export interface VideoHistoryEntry {
  id: string;
  source: VideoOperationSource;
  timestamp: string;
  label: string;
  operationIds: string[];
  affectedEntityIds: string[];
  revision: number;
  commandId?: string;
  undo: VideoOperationUndoPayload;
}

export type VideoOperationUndoPayload =
  | { type: "inverseOperations"; inverseOperations: VideoOperation[] }
  | { type: "checkpoint"; checkpoint: VideoProjectDocument };

export type VideoChangedEntityKind = "project" | "settings" | "track" | "item" | "transition" | "effect";

export interface VideoChangedEntity {
  id: string;
  kind: VideoChangedEntityKind;
  change: "added" | "updated" | "deleted" | "moved";
}

export type VideoOperationValidationResult =
  | { ok: true; warnings: string[]; skippedEntities: [] }
  | { ok: false; errors: string[]; warnings: string[]; skippedEntities: string[] };

export interface VideoOperationApplyResult {
  ok: boolean;
  document: VideoProjectDocument;
  changedEntities: VideoChangedEntity[];
  warnings: string[];
  skippedEntities: string[];
  appliedOperationIds: string[];
  undo?: VideoOperationUndoPayload;
  historyEntry?: VideoHistoryEntry;
  errors?: string[];
}

type OperationApplication = {
  document: VideoProjectDocument;
  changedEntities: VideoChangedEntity[];
  inverseOperations: VideoOperation[];
};

type TimelineItemLocation = {
  track: VideoTrack;
  trackIndex: number;
  item: VideoTimelineItem;
  itemIndex: number;
};

const operationTypes = [
  "addMediaToTimeline",
  "addAudioItem",
  "addTextItem",
  "moveItem",
  "trimItem",
  "splitItem",
  "deleteItem",
  "reorderItem",
  "reorderTrack",
  "updateTrack",
  "updateText",
  "updateAudio",
  "updateSpeed",
  "updateTransformCrop",
  "updateAdvancedItem",
  "upsertEffect",
  "removeEffect",
  "upsertTransition",
  "removeTransition",
  "setProjectSettings",
] as const;

const updateOperationTypes = new Set<VideoOperation["type"]>([
  "updateText",
  "updateAudio",
  "updateSpeed",
  "updateTransformCrop",
  "updateAdvancedItem",
]);

/*
AI schema compatibility for V-003:
- AI trim maps conceptually to trimItem.
- AI concatenate maps to addMediaToTimeline and/or moveItem/reorderItem batches.
- AI transition remains future work; V-003 does not mutate document transitions.
*/

export function createVideoOperationBatch(input: CreateVideoOperationBatchInput): VideoOperationBatch {
  const timestamp = input.timestamp ?? new Date().toISOString();
  const affectedEntityIds =
    input.affectedEntityIds ?? Array.from(new Set(input.operations.flatMap((operation) => operation.affectedEntityIds)));

  return omitUndefined({
    id: input.id ?? createBatchId(timestamp),
    source: input.source,
    timestamp,
    label: input.label,
    affectedEntityIds,
    commandId: input.commandId,
    forceCheckpoint: input.forceCheckpoint,
    operations: input.operations,
  });
}

export function isVideoOperation(value: unknown): value is VideoOperation {
  return validateOperationShape(value).length === 0;
}

export function isVideoOperationBatch(value: unknown): value is VideoOperationBatch {
  if (!isRecord(value)) return false;
  return validateMetadataShape(value).length === 0 && Array.isArray(value.operations) && value.operations.every(isVideoOperation);
}

export function validateVideoOperation(
  document: VideoProjectDocument,
  operation: unknown,
): VideoOperationValidationResult {
  const errors = validateOperationShape(operation);
  const warnings: string[] = [];
  const skippedEntities: string[] = [];

  if (errors.length > 0 || !isVideoOperation(operation)) {
    return { ok: false, errors, warnings, skippedEntities };
  }

  const documentValidation = validateVideoProjectDocument(document);
  if (!documentValidation.ok) {
    return {
      ok: false,
      errors: documentValidation.errors.map((error) => `Document is invalid: ${error}`),
      warnings,
      skippedEntities,
    };
  }

  validateOperationSemantics(document, operation, errors, warnings, skippedEntities);

  if (errors.length > 0) {
    return { ok: false, errors, warnings, skippedEntities };
  }

  return { ok: true, warnings, skippedEntities: [] };
}

export function applyVideoOperation(
  document: VideoProjectDocument,
  operation: VideoOperation,
): VideoOperationApplyResult {
  const batch = createVideoOperationBatch({
    id: operation.id,
    source: operation.source,
    timestamp: operation.timestamp,
    label: operation.label,
    operations: [operation],
    affectedEntityIds: operation.affectedEntityIds,
    commandId: operation.commandId,
    forceCheckpoint: operation.forceCheckpoint,
  });

  return applyVideoOperationBatch(document, batch);
}

export function applyVideoOperationBatch(
  document: VideoProjectDocument,
  batch: VideoOperationBatch,
): VideoOperationApplyResult {
  if (!isVideoOperationBatch(batch)) {
    return failedApply(document, ["Operation batch is invalid or unsupported."], [], []);
  }

  const operations = coalesceVideoOperationBatch(batch).operations;
  let workingDocument = document;
  const warnings: string[] = [];
  const skippedEntities: string[] = [];
  const changedEntities: VideoChangedEntity[] = [];
  const inverseOperations: VideoOperation[] = [];

  for (const operation of operations) {
    const validation = validateVideoOperation(workingDocument, operation);
    warnings.push(...validation.warnings);

    if (!validation.ok) {
      return failedApply(document, validation.errors, warnings, validation.skippedEntities);
    }

    const applied = applyRawVideoOperation(workingDocument, operation);
    workingDocument = applied.document;
    changedEntities.push(...applied.changedEntities);
    inverseOperations.unshift(...applied.inverseOperations);

    const resultingValidation = validateVideoProjectDocument(workingDocument);
    if (!resultingValidation.ok) {
      return failedApply(
        document,
        resultingValidation.errors.map((error) => `Resulting document is invalid after ${operation.type}: ${error}`),
        warnings,
        skippedEntities,
      );
    }
  }

  const finalDocument = withOperationMetadata(workingDocument, batch.id, batch.timestamp);
  const finalValidation = validateVideoProjectDocument(finalDocument);
  if (!finalValidation.ok) {
    return failedApply(
      document,
      finalValidation.errors.map((error) => `Resulting document is invalid: ${error}`),
      warnings,
      skippedEntities,
    );
  }

  const undo = shouldCheckpoint(batch, operations)
    ? { type: "checkpoint" as const, checkpoint: cloneJson(document) }
    : { type: "inverseOperations" as const, inverseOperations };

  return {
    ok: true,
    document: finalDocument,
    changedEntities: dedupeChangedEntities(changedEntities),
    warnings,
    skippedEntities,
    appliedOperationIds: operations.map((operation) => operation.id),
    undo,
    historyEntry: omitUndefined({
      id: batch.id,
      source: batch.source,
      timestamp: batch.timestamp,
      label: batch.label,
      operationIds: operations.map((operation) => operation.id),
      affectedEntityIds: batch.affectedEntityIds,
      revision: finalDocument.history.revision,
      commandId: batch.commandId,
      undo,
    }),
  };
}

export function coalesceVideoOperationBatch(batch: VideoOperationBatch): VideoOperationBatch {
  const operations: VideoOperation[] = [];

  for (const operation of batch.operations) {
    const previous = operations[operations.length - 1];
    const merged = previous ? coalesceOperations(previous, operation) : undefined;

    if (merged) {
      operations[operations.length - 1] = merged;
    } else {
      operations.push(operation);
    }
  }

  return {
    ...batch,
    operations,
    affectedEntityIds: Array.from(new Set(operations.flatMap((operation) => operation.affectedEntityIds))),
  };
}

function validateOperationShape(value: unknown): string[] {
  const errors: string[] = [];

  if (!isJsonValue(value)) {
    return ["Operation must be plain JSON data."];
  }

  if (!isRecord(value)) {
    return ["Operation must be an object."];
  }

  validateMetadataShape(value).forEach((error) => errors.push(error));

  if (!isOneOf(value.type, operationTypes)) {
    errors.push("Operation type is unsupported.");
    return errors;
  }

  if (value.type === "addMediaToTimeline") {
    validateRequiredString(value.trackId, "trackId", errors);
    validateObject(value.item, "item", errors);
  } else if (value.type === "addAudioItem") {
    validateRequiredString(value.trackId, "trackId", errors);
    validateObject(value.item, "item", errors);
  } else if (value.type === "addTextItem") {
    validateRequiredString(value.trackId, "trackId", errors);
    validateObject(value.item, "item", errors);
  } else if (value.type === "moveItem") {
    validateRequiredString(value.itemId, "itemId", errors);
    validateNonNegativeNumber(value.timelineStart, "timelineStart", errors);
    validateOptionalString(value.targetTrackId, "targetTrackId", errors);
  } else if (value.type === "trimItem") {
    validateRequiredString(value.itemId, "itemId", errors);
    if (value.edge !== undefined && !isOneOf(value.edge, ["start", "end"])) {
      errors.push("edge must be start or end when provided.");
    }
    validateNonNegativeNumber(value.timelineStart, "timelineStart", errors);
    validatePositiveNumber(value.duration, "duration", errors);
    validateOptionalNonNegativeNumber(value.sourceIn, "sourceIn", errors);
    validateOptionalPositiveNumber(value.sourceOut, "sourceOut", errors);
  } else if (value.type === "splitItem") {
    validateRequiredString(value.itemId, "itemId", errors);
    if (!Array.isArray(value.items) || value.items.length !== 2) {
      errors.push("items must contain exactly two target timeline items.");
    }
  } else if (value.type === "deleteItem") {
    if (!Array.isArray(value.itemIds) || value.itemIds.length === 0) {
      errors.push("itemIds must be a non-empty array.");
    } else {
      value.itemIds.forEach((itemId, index) => validateRequiredString(itemId, `itemIds.${index}`, errors));
    }
  } else if (value.type === "reorderItem") {
    validateRequiredString(value.itemId, "itemId", errors);
    validateOptionalString(value.targetTrackId, "targetTrackId", errors);
    validateNonNegativeInteger(value.targetIndex, "targetIndex", errors);
  } else if (value.type === "reorderTrack") {
    validateRequiredString(value.trackId, "trackId", errors);
    validateNonNegativeInteger(value.targetIndex, "targetIndex", errors);
  } else if (value.type === "updateTrack") {
    validateRequiredString(value.trackId, "trackId", errors);
    validateOptionalString(value.trackLabel, "trackLabel", errors);
    if (value.locked !== undefined && typeof value.locked !== "boolean") {
      errors.push("locked must be a boolean when provided.");
    }
    if (value.hidden !== undefined && typeof value.hidden !== "boolean") {
      errors.push("hidden must be a boolean when provided.");
    }
    if (value.muted !== undefined && typeof value.muted !== "boolean") {
      errors.push("muted must be a boolean when provided.");
    }
  } else if (value.type === "updateText") {
    validateRequiredString(value.itemId, "itemId", errors);
    validateOptionalString(value.text, "text", errors);
    validateOptionalObject(value.style, "style", errors);
    validateOptionalObject(value.transform, "transform", errors);
    validateOptionalInteger(value.layerOrder, "layerOrder", errors);
    validateOptionalNonNegativeNumber(value.timelineStart, "timelineStart", errors);
    validateOptionalPositiveNumber(value.duration, "duration", errors);
  } else if (value.type === "updateAudio") {
    validateRequiredString(value.itemId, "itemId", errors);
    validateOptionalUnitNumber(value.volume, "volume", errors);
    if (value.muted !== undefined && typeof value.muted !== "boolean") {
      errors.push("muted must be a boolean when provided.");
    }
    validateOptionalObject(value.fades, "fades", errors);
  } else if (value.type === "updateSpeed") {
    validateRequiredString(value.itemId, "itemId", errors);
    validatePositiveNumber(value.speed, "speed", errors);
    validateOptionalPositiveNumber(value.duration, "duration", errors);
    validateOptionalPositiveNumber(value.sourceOut, "sourceOut", errors);
  } else if (value.type === "updateTransformCrop") {
    validateRequiredString(value.itemId, "itemId", errors);
    validateOptionalObject(value.transform, "transform", errors);
    validateOptionalObject(value.crop, "crop", errors);
    validateOptionalUnitNumber(value.opacity, "opacity", errors);
    validateOptionalInteger(value.layerOrder, "layerOrder", errors);
  } else if (value.type === "updateAdvancedItem") {
    validateRequiredString(value.itemId, "itemId", errors);
    if (value.advanced !== null) validateObject(value.advanced, "advanced", errors);
  } else if (value.type === "upsertEffect") {
    validateObject(value.effect, "effect", errors);
  } else if (value.type === "removeEffect") {
    validateRequiredString(value.effectId, "effectId", errors);
  } else if (value.type === "upsertTransition") {
    validateObject(value.transition, "transition", errors);
  } else if (value.type === "removeTransition") {
    validateRequiredString(value.transitionId, "transitionId", errors);
  } else if (value.type === "setProjectSettings") {
    validateObject(value.settings, "settings", errors);
  }

  return errors;
}

function validateMetadataShape(value: Record<string, unknown>): string[] {
  const errors: string[] = [];
  validateRequiredString(value.id, "id", errors);
  if (!isOneOf(value.source, ["manual", "ai"])) {
    errors.push("source must be manual or ai.");
  }
  validateIsoDateString(value.timestamp, "timestamp", errors);
  validateRequiredString(value.label, "label", errors);
  if (!Array.isArray(value.affectedEntityIds)) {
    errors.push("affectedEntityIds must be an array.");
  } else {
    value.affectedEntityIds.forEach((entityId, index) =>
      validateRequiredString(entityId, `affectedEntityIds.${index}`, errors),
    );
  }
  validateOptionalString(value.commandId, "commandId", errors);
  if (value.forceCheckpoint !== undefined && typeof value.forceCheckpoint !== "boolean") {
    errors.push("forceCheckpoint must be a boolean when provided.");
  }
  return errors;
}

function validateOperationSemantics(
  document: VideoProjectDocument,
  operation: VideoOperation,
  errors: string[],
  warnings: string[],
  skippedEntities: string[],
): void {
  if (operation.type === "addMediaToTimeline") {
    validateAddItem(document, operation.trackId, operation.item, ["video", "image"], errors, warnings);
    return;
  }

  if (operation.type === "addAudioItem") {
    validateAddItem(document, operation.trackId, operation.item, ["audio"], errors, warnings);
    return;
  }

  if (operation.type === "addTextItem") {
    validateAddItem(document, operation.trackId, operation.item, [], errors, warnings);
    return;
  }

  if (operation.type === "setProjectSettings") {
    validatePotentialDocument(document, { ...document, settings: { ...document.settings, ...operation.settings } }, errors);
    return;
  }

  if (operation.type === "upsertEffect") {
    validatePotentialDocument(document, {
      ...document,
      effects: upsertById(document.effects, operation.effect),
    }, errors);
    return;
  }

  if (operation.type === "removeEffect") {
    if (!document.effects.some((effect) => effect.id === operation.effectId)) {
      errors.push(`Effect ${operation.effectId} does not exist.`);
      skippedEntities.push(operation.effectId);
    }
    return;
  }

  if (operation.type === "upsertTransition") {
    validatePotentialDocument(document, {
      ...document,
      transitions: upsertById(document.transitions, operation.transition),
    }, errors);
    return;
  }

  if (operation.type === "removeTransition") {
    if (!document.transitions.some((transition) => transition.id === operation.transitionId)) {
      errors.push(`Transition ${operation.transitionId} does not exist.`);
      skippedEntities.push(operation.transitionId);
    }
    return;
  }

  if (operation.type === "updateTrack") {
    const track = findTrack(document, operation.trackId);
    if (!track) {
      errors.push(`Track ${operation.trackId} does not exist.`);
      skippedEntities.push(operation.trackId);
      return;
    }

    const updatedTrack = { ...track, ...pickDefinedTrackUpdate(operation) };
    validatePotentialDocument(
      document,
      {
        ...document,
        tracks: document.tracks.map((candidate) =>
          candidate.id === operation.trackId ? updatedTrack : candidate,
        ),
      },
      errors,
    );
    return;
  }

  if (operation.type === "reorderTrack") {
    const track = findTrack(document, operation.trackId);
    if (!track) {
      errors.push(`Track ${operation.trackId} does not exist.`);
      skippedEntities.push(operation.trackId);
      return;
    }
    if (operation.targetIndex >= document.tracks.length) {
      errors.push("targetIndex must be within the track list.");
    }
    return;
  }

  if (operation.type === "deleteItem") {
    const uniqueIds = new Set(operation.itemIds);
    if (uniqueIds.size !== operation.itemIds.length) {
      errors.push("deleteItem itemIds must be unique.");
    }
    for (const itemId of uniqueIds) {
      const location = findItem(document, itemId);
      if (!location) {
        errors.push(`Timeline item ${itemId} does not exist.`);
        skippedEntities.push(itemId);
      } else {
        validateTrackWritable(location.track, errors);
      }
    }
    return;
  }

  const location = findItem(document, operation.itemId);
  if (!location) {
    errors.push(`Timeline item ${operation.itemId} does not exist.`);
    skippedEntities.push(operation.itemId);
    return;
  }

  validateTrackWritable(location.track, errors);

  if (operation.type === "moveItem") {
    const targetTrack = operation.targetTrackId ? findTrack(document, operation.targetTrackId) : location.track;
    validateTargetTrack(document, targetTrack, operation.targetTrackId ?? location.track.id, location.item, errors, warnings);
    return;
  }

  if (operation.type === "trimItem") {
    validateTrimOperation(document, location.item, operation, errors);
    return;
  }

  if (operation.type === "splitItem") {
    validateSplitOperation(document, location, operation, errors);
    return;
  }

  if (operation.type === "reorderItem") {
    const targetTrack = operation.targetTrackId ? findTrack(document, operation.targetTrackId) : location.track;
    validateTargetTrack(document, targetTrack, operation.targetTrackId ?? location.track.id, location.item, errors, warnings);
    if (targetTrack && operation.targetIndex > targetTrack.items.length) {
      errors.push("targetIndex must not exceed the target track item count.");
    }
    return;
  }

  if (operation.type === "updateText") {
    if (location.item.type !== "text") {
      errors.push("updateText can only target text items.");
      return;
    }
    const updated: TextTimelineItem = { ...location.item, ...pickDefinedTextUpdate(operation, location.item) };
    validatePotentialItem(document, location, updated, errors);
    return;
  }

  if (operation.type === "updateAudio") {
    if (location.item.type !== "audio") {
      errors.push("updateAudio can only target audio items.");
      return;
    }
    const updated: AudioTimelineItem = { ...location.item, ...pickDefinedAudioUpdate(operation, location.item) };
    validatePotentialItem(document, location, updated, errors);
    return;
  }

  if (operation.type === "updateSpeed") {
    if (location.item.type !== "video") {
      errors.push("updateSpeed can only target video items.");
      return;
    }
    const updated: VideoClipTimelineItem = {
      ...location.item,
      speed: operation.speed,
      ...(operation.duration !== undefined ? { duration: operation.duration } : {}),
      ...(operation.sourceOut !== undefined ? { sourceOut: operation.sourceOut } : {}),
    };
    validateMediaRange(document, updated, errors);
    validatePotentialItem(document, location, updated, errors);
    return;
  }

  if (operation.type === "updateTransformCrop") {
    if (!isVisualTransformItem(location.item)) {
      errors.push("updateTransformCrop can only target visual timeline items.");
      return;
    }
    if (operation.crop !== undefined && location.item.type === "text") {
      errors.push("updateTransformCrop crop can only target media-backed visual items.");
      return;
    }
    const updated = { ...location.item, ...pickDefinedTransformCropUpdate(operation, location.item) } as VideoTimelineItem;
    validatePotentialItem(document, location, updated, errors);
    return;
  }

  if (operation.type === "updateAdvancedItem") {
    const updated = {
      ...location.item,
      ...(operation.advanced === null ? {} : { advanced: operation.advanced }),
    } as VideoTimelineItem;
    if (operation.advanced === null) delete updated.advanced;
    validatePotentialItem(document, location, updated, errors);
  }
}

function applyRawVideoOperation(document: VideoProjectDocument, operation: VideoOperation): OperationApplication {
  if (operation.type === "addMediaToTimeline" || operation.type === "addAudioItem" || operation.type === "addTextItem") {
    return applyAddItem(document, operation);
  }

  if (operation.type === "moveItem") {
    return applyMoveItem(document, operation);
  }

  if (operation.type === "trimItem") {
    return applyTrimItem(document, operation);
  }

  if (operation.type === "splitItem") {
    return applySplitItem(document, operation);
  }

  if (operation.type === "deleteItem") {
    return applyDeleteItem(document, operation);
  }

  if (operation.type === "reorderItem") {
    return applyReorderItem(document, operation);
  }

  if (operation.type === "reorderTrack") {
    return applyReorderTrack(document, operation);
  }

  if (operation.type === "updateTrack") {
    return applyUpdateTrack(document, operation);
  }

  if (operation.type === "updateText") {
    const loc = findItem(document, operation.itemId);
    return applyUpdateItem(document, operation, pickDefinedTextUpdate(operation, loc?.item));
  }

  if (operation.type === "updateAudio") {
    const loc = findItem(document, operation.itemId);
    return applyUpdateItem(document, operation, pickDefinedAudioUpdate(operation, loc?.item));
  }

  if (operation.type === "updateSpeed") {
    return applyUpdateItem(document, operation, {
      speed: operation.speed,
      ...(operation.duration !== undefined ? { duration: operation.duration } : {}),
      ...(operation.sourceOut !== undefined ? { sourceOut: operation.sourceOut } : {}),
    });
  }

  if (operation.type === "updateTransformCrop") {
    const loc = findItem(document, operation.itemId);
    return applyUpdateItem(document, operation, pickDefinedTransformCropUpdate(operation, loc?.item));
  }

  if (operation.type === "updateAdvancedItem") {
    const loc = findItem(document, operation.itemId);
    const fields = operation.advanced === null ? {} : { advanced: operation.advanced };
    const applied = applyUpdateItem(document, operation, fields);
    if (operation.advanced === null && loc) {
      const tracks = applied.document.tracks.map((track) => ({
        ...track,
        items: track.items.map((item) => {
          if (item.id !== operation.itemId) return item;
          const { advanced: _advanced, ...withoutAdvanced } = item;
          return withoutAdvanced as VideoTimelineItem;
        }),
      }));
      return { ...applied, document: { ...applied.document, tracks } };
    }
    return applied;
  }

  if (operation.type === "upsertEffect") {
    const previous = document.effects.find((effect) => effect.id === operation.effect.id);
    return {
      document: { ...document, effects: upsertById(document.effects, cloneJson(operation.effect)) },
      changedEntities: [{ id: operation.effect.id, kind: "effect", change: previous ? "updated" : "added" }],
      inverseOperations: [previous
        ? createInverse(operation, { type: "upsertEffect", effect: previous })
        : createInverse(operation, { type: "removeEffect", effectId: operation.effect.id })],
    };
  }

  if (operation.type === "removeEffect") {
    const previous = document.effects.find((effect) => effect.id === operation.effectId);
    if (!previous) throw new Error("removeEffect was applied without validation.");
    return {
      document: { ...document, effects: document.effects.filter((effect) => effect.id !== operation.effectId) },
      changedEntities: [{ id: operation.effectId, kind: "effect", change: "deleted" }],
      inverseOperations: [createInverse(operation, { type: "upsertEffect", effect: previous })],
    };
  }

  if (operation.type === "upsertTransition") {
    const previous = document.transitions.find((transition) => transition.id === operation.transition.id);
    return {
      document: { ...document, transitions: upsertById(document.transitions, cloneJson(operation.transition)) },
      changedEntities: [{ id: operation.transition.id, kind: "transition", change: previous ? "updated" : "added" }],
      inverseOperations: [previous
        ? createInverse(operation, { type: "upsertTransition", transition: previous })
        : createInverse(operation, { type: "removeTransition", transitionId: operation.transition.id })],
    };
  }

  if (operation.type === "removeTransition") {
    const previous = document.transitions.find((transition) => transition.id === operation.transitionId);
    if (!previous) throw new Error("removeTransition was applied without validation.");
    return {
      document: { ...document, transitions: document.transitions.filter((transition) => transition.id !== operation.transitionId) },
      changedEntities: [{ id: operation.transitionId, kind: "transition", change: "deleted" }],
      inverseOperations: [createInverse(operation, { type: "upsertTransition", transition: previous })],
    };
  }

  return applySetProjectSettings(document, operation);
}

function applyAddItem(
  document: VideoProjectDocument,
  operation: AddMediaToTimelineOperation | AddAudioItemOperation | AddTextItemOperation,
): OperationApplication {
  const item = normalizeTimelineItemForWrite(cloneJson(operation.item));
  let tracks = document.tracks;

  // Auto-create a dedicated overlay track when it doesn't exist yet.
  const targetTrackExists = tracks.some((track) => track.id === operation.trackId);
  const isOverlayItem =
    operation.type === "addMediaToTimeline" &&
    item.type === "overlay";

  if (!targetTrackExists && isOverlayItem) {
    const overlayCount = tracks.filter((track) => track.kind === "overlay").length;
    const newTrack: VideoTrack = {
      id: operation.trackId,
      kind: "overlay",
      label: `O${overlayCount + 1}`,
      locked: false,
      hidden: false,
      muted: false,
      items: [],
    };
    // Insert before audio and text tracks to maintain visual stacking order.
    const insertIndex = tracks.findIndex((track) => track.kind === "audio" || track.kind === "text");
    if (insertIndex >= 0) {
      tracks = [...tracks.slice(0, insertIndex), newTrack, ...tracks.slice(insertIndex)];
    } else {
      tracks = [...tracks, newTrack];
    }
  }

  tracks = tracks.map((track) =>
    track.id === operation.trackId ? { ...track, items: [...track.items, item] } : track,
  );
  const inverseOperations: VideoOperation[] = [createDeleteInverse(operation, [item.id])];

  return {
    document: { ...document, tracks },
    changedEntities: [{ id: item.id, kind: "item", change: "added" }],
    inverseOperations,
  };
}

function normalizeTimelineItemForWrite(item: VideoTimelineItem): VideoTimelineItem {
  if (!isVisualTransformItem(item)) return item;

  const transform = normalizeVideoTransform((item.properties as any)?.transform ?? item.transform);
  const properties = omitUndefined({
    ...(item.properties || {}),
    transform,
    opacity: "opacity" in item ? ((item.properties as any)?.opacity ?? item.opacity) : undefined,
    crop: item.type === "video" ? ((item.properties as any)?.crop ?? item.crop) : undefined,
  });

  return { ...item, transform, properties } as VideoTimelineItem;
}
function applyMoveItem(document: VideoProjectDocument, operation: MoveItemOperation): OperationApplication {
  const location = findItem(document, operation.itemId);
  if (!location) throw new Error("moveItem was applied without validation.");

  const targetTrackId = operation.targetTrackId ?? location.track.id;
  const movedItem = { ...cloneJson(location.item), timelineStart: operation.timelineStart };

  if (targetTrackId === location.track.id) {
    const tracks = document.tracks.map((track) =>
      track.id === location.track.id
        ? {
            ...track,
            items: track.items.map((item) => (item.id === operation.itemId ? movedItem : item)),
          }
        : track,
    );

    return {
      document: { ...document, tracks },
      changedEntities: [{ id: operation.itemId, kind: "item", change: "moved" }],
      inverseOperations: [
        createInverse(operation, {
          type: "moveItem",
          itemId: operation.itemId,
          timelineStart: location.item.timelineStart,
          targetTrackId: location.track.id,
        }),
      ],
    };
  }

  const tracksWithoutItem = document.tracks.map((track) =>
    track.id === location.track.id
      ? { ...track, items: track.items.filter((item) => item.id !== operation.itemId) }
      : track,
  );
  const tracks = tracksWithoutItem.map((track) =>
    track.id === targetTrackId ? { ...track, items: [...track.items, movedItem] } : track,
  );

  return {
    document: { ...document, tracks },
    changedEntities: [{ id: operation.itemId, kind: "item", change: "moved" }],
    inverseOperations: [
      createInverse(operation, {
        type: "moveItem",
        itemId: operation.itemId,
        timelineStart: location.item.timelineStart,
        targetTrackId: location.track.id,
      }),
    ],
  };
}

function applyTrimItem(document: VideoProjectDocument, operation: TrimItemOperation): OperationApplication {
  const location = findItem(document, operation.itemId);
  if (!location) throw new Error("trimItem was applied without validation.");

  const nextFields = omitUndefined({
    timelineStart: operation.timelineStart,
    duration: operation.duration,
    sourceIn: operation.sourceIn,
    sourceOut: operation.sourceOut,
  });

  const inverseFields = isMediaTimelineItem(location.item)
    ? {
        sourceIn: location.item.sourceIn,
        sourceOut: location.item.sourceOut,
      }
    : {};

  return applyUpdateItem(document, operation, nextFields, [
    createInverse(operation, {
      type: "trimItem",
      itemId: operation.itemId,
      edge: operation.edge,
      timelineStart: location.item.timelineStart,
      duration: location.item.duration,
      ...inverseFields,
    }),
  ]);
}

function applySplitItem(document: VideoProjectDocument, operation: SplitItemOperation): OperationApplication {
  const location = findItem(document, operation.itemId);
  if (!location) throw new Error("splitItem was applied without validation.");

  const replacementItems = operation.items.map((item) => cloneJson(item)) as [VideoTimelineItem, VideoTimelineItem];
  const tracks = document.tracks.map((track) =>
    track.id === location.track.id
      ? {
          ...track,
          items: track.items.flatMap((item) => (item.id === operation.itemId ? replacementItems : [item])),
        }
      : track,
  );

  return {
    document: removeTargetedEntries({ ...document, tracks }, new Set([operation.itemId])),
    changedEntities: [
      { id: operation.itemId, kind: "item", change: "deleted" },
      { id: replacementItems[0].id, kind: "item", change: "added" },
      { id: replacementItems[1].id, kind: "item", change: "added" },
    ],
    inverseOperations: [],
  };
}

function applyDeleteItem(document: VideoProjectDocument, operation: DeleteItemOperation): OperationApplication {
  const itemIds = new Set(operation.itemIds);
  const tracksAfterDelete = document.tracks.map((track) => ({
    ...track,
    items: track.items.filter((item) => !itemIds.has(item.id)),
  }));

  // Clean up empty dedicated overlay tracks (those auto-created per element).
  // Keep the default "o1" overlay track even when empty.
  const tracks = tracksAfterDelete.filter((track) => {
    if (track.kind !== "overlay") return true;
    if (track.id === "o1") return true;
    return track.items.length > 0;
  });

  return {
    document: removeTargetedEntries({ ...document, tracks }, itemIds),
    changedEntities: operation.itemIds.map((itemId) => ({ id: itemId, kind: "item", change: "deleted" })),
    inverseOperations: [],
  };
}

function applyReorderItem(document: VideoProjectDocument, operation: ReorderItemOperation): OperationApplication {
  const location = findItem(document, operation.itemId);
  if (!location) throw new Error("reorderItem was applied without validation.");

  const targetTrackId = operation.targetTrackId ?? location.track.id;
  const item = cloneJson(location.item);
  const tracksWithoutItem = document.tracks.map((track) =>
    track.id === location.track.id
      ? { ...track, items: track.items.filter((trackItem) => trackItem.id !== operation.itemId) }
      : track,
  );
  const tracks = tracksWithoutItem.map((track) => {
    if (track.id !== targetTrackId) return track;
    const items = [...track.items];
    const targetIndex = Math.min(operation.targetIndex, items.length);
    items.splice(targetIndex, 0, item);
    return { ...track, items };
  });

  return {
    document: { ...document, tracks },
    changedEntities: [{ id: operation.itemId, kind: "item", change: "moved" }],
    inverseOperations: [
      createInverse(operation, {
        type: "reorderItem",
        itemId: operation.itemId,
        targetTrackId: location.track.id,
        targetIndex: location.itemIndex,
      }),
    ],
  };
}

function applyReorderTrack(document: VideoProjectDocument, operation: ReorderTrackOperation): OperationApplication {
  const currentIndex = document.tracks.findIndex((track) => track.id === operation.trackId);
  if (currentIndex < 0) throw new Error("reorderTrack was applied without validation.");

  const tracks = [...document.tracks];
  const [track] = tracks.splice(currentIndex, 1);
  tracks.splice(operation.targetIndex, 0, track);

  return {
    document: { ...document, tracks },
    changedEntities: [{ id: operation.trackId, kind: "track", change: "moved" }],
    inverseOperations: [
      createInverse(operation, {
        type: "reorderTrack",
        trackId: operation.trackId,
        targetIndex: currentIndex,
      }),
    ],
  };
}

function applyUpdateTrack(document: VideoProjectDocument, operation: UpdateTrackOperation): OperationApplication {
  const track = findTrack(document, operation.trackId);
  if (!track) throw new Error("updateTrack was applied without validation.");

  const fields = pickDefinedTrackUpdate(operation);
  const tracks = document.tracks.map((candidate) =>
    candidate.id === operation.trackId ? { ...candidate, ...cloneJson(fields) } : candidate,
  );
  const inverseFields: Omit<UpdateTrackOperation, keyof VideoOperationMetadata | "type" | "trackId"> = {};

  if (operation.trackLabel !== undefined) inverseFields.trackLabel = track.label;
  if (operation.locked !== undefined) inverseFields.locked = track.locked;
  if (operation.hidden !== undefined) inverseFields.hidden = track.hidden;
  if (operation.muted !== undefined) inverseFields.muted = track.muted;

  return {
    document: { ...document, tracks },
    changedEntities: [{ id: operation.trackId, kind: "track", change: "updated" }],
    inverseOperations: [
      createInverse(operation, {
        type: "updateTrack",
        trackId: operation.trackId,
        ...inverseFields,
      }),
    ],
  };
}

function applyUpdateItem(
  document: VideoProjectDocument,
  operation: VideoOperation & { itemId: string },
  fields: Partial<VideoTimelineItem>,
  explicitInverseOperations?: VideoOperation[],
): OperationApplication {
  const location = findItem(document, operation.itemId);
  if (!location) throw new Error(`${operation.type} was applied without validation.`);

  let updatedItem = { ...location.item, ...cloneJson(fields) } as VideoTimelineItem;
  if ((fields as any).properties === null) {
    const { properties: _removedProperties, ...itemWithoutProperties } = updatedItem as any;
    updatedItem = itemWithoutProperties as VideoTimelineItem;
  }
  const tracks = document.tracks.map((track) =>
    track.id === location.track.id
      ? {
          ...track,
          items: track.items.map((item) => (item.id === operation.itemId ? updatedItem : item)),
        }
      : track,
  );

  return {
    document: { ...document, tracks },
    changedEntities: [{ id: operation.itemId, kind: "item", change: "updated" }],
    inverseOperations: explicitInverseOperations ?? [createUpdateInverse(operation, location.item)],
  };
}

function applySetProjectSettings(
  document: VideoProjectDocument,
  operation: SetProjectSettingsOperation,
): OperationApplication {
  const previousSettings = document.settings;
  const changedKeys = Object.keys(operation.settings) as Array<keyof VideoProjectSettings>;
  const inverseSettings: Partial<VideoProjectSettings> = {};

  for (const key of changedKeys) {
    inverseSettings[key] = previousSettings[key] as never;
  }

  return {
    document: { ...document, settings: { ...document.settings, ...operation.settings } },
    changedEntities: [{ id: document.projectId, kind: "settings", change: "updated" }],
    inverseOperations: [
      createInverse(operation, {
        type: "setProjectSettings",
        settings: inverseSettings,
      }),
    ],
  };
}

function createUpdateInverse(operation: VideoOperation & { itemId: string }, previousItem: VideoTimelineItem): VideoOperation {
  if (operation.type === "updateText" && previousItem.type === "text") {
    return createInverse(operation, {
      type: "updateText",
      itemId: operation.itemId,
      ...(operation.text !== undefined ? { text: previousItem.text } : {}),
      ...(operation.style !== undefined ? { style: previousItem.style } : {}),
      ...(operation.transform !== undefined ? { transform: previousItem.transform } : {}),
      ...(operation.layerOrder !== undefined ? { layerOrder: previousItem.layerOrder } : {}),
      ...(operation.timelineStart !== undefined ? { timelineStart: previousItem.timelineStart } : {}),
      ...(operation.duration !== undefined ? { duration: previousItem.duration } : {}),
      ...(operation.properties !== undefined || operation.transform !== undefined ? { properties: previousItem.properties ?? null } : {}),
    });
  }

  if (operation.type === "updateAudio" && previousItem.type === "audio") {
    return createInverse(operation, {
      type: "updateAudio",
      itemId: operation.itemId,
      ...(operation.volume !== undefined ? { volume: previousItem.volume } : {}),
      ...(operation.muted !== undefined ? { muted: previousItem.muted } : {}),
      ...(operation.fades !== undefined ? { fades: previousItem.fades } : {}),
      ...(operation.properties !== undefined ? { properties: previousItem.properties ?? null } : {}),
    });
  }

  if (operation.type === "updateSpeed" && previousItem.type === "video") {
    return createInverse(operation, {
      type: "updateSpeed",
      itemId: operation.itemId,
      speed: previousItem.speed,
      ...(operation.duration !== undefined ? { duration: previousItem.duration } : {}),
      ...(operation.sourceOut !== undefined ? { sourceOut: previousItem.sourceOut } : {}),
    });
  }

  if (operation.type === "updateTransformCrop" && isVisualTransformItem(previousItem)) {
    return createInverse(operation, {
      type: "updateTransformCrop",
      itemId: operation.itemId,
      ...(operation.transform !== undefined ? { transform: previousItem.transform } : {}),
      ...(operation.crop !== undefined && previousItem.type !== "text" ? { crop: previousItem.crop } : {}),
      ...(operation.opacity !== undefined && previousItem.type !== "text" ? { opacity: previousItem.opacity } : {}),
      ...(operation.layerOrder !== undefined && "layerOrder" in previousItem ? { layerOrder: previousItem.layerOrder } : {}),
      ...(operation.properties !== undefined || operation.transform !== undefined || operation.crop !== undefined || operation.opacity !== undefined ? { properties: previousItem.properties ?? null } : {}),
    });
  }

  if (operation.type === "updateAdvancedItem") {
    return createInverse(operation, {
      type: "updateAdvancedItem",
      itemId: operation.itemId,
      advanced: previousItem.advanced ?? null,
    });
  }

  throw new Error(`Cannot create inverse operation for ${operation.type}.`);
}

function createDeleteInverse(operation: VideoOperation, itemIds: string[]): DeleteItemOperation {
  return createInverse(operation, {
    type: "deleteItem",
    itemIds,
  }) as DeleteItemOperation;
}

function createInverse<T extends Omit<VideoOperation, keyof VideoOperationMetadata>>(
  operation: VideoOperation,
  payload: T,
): VideoOperation {
  return omitUndefined({
    id: `${operation.id}:undo`,
    source: operation.source,
    timestamp: operation.timestamp,
    label: `Undo ${operation.label}`,
    affectedEntityIds: operation.affectedEntityIds,
    commandId: operation.commandId,
    ...payload,
  }) as unknown as VideoOperation;
}

function validateAddItem(
  document: VideoProjectDocument,
  trackId: string,
  item: VideoTimelineItem,
  expectedMediaKinds: Array<VideoMediaReference["kind"]>,
  errors: string[],
  warnings: string[],
): void {
  const targetTrack = findTrack(document, trackId);

  // For overlay items targeting a not-yet-existing track, skip track
  // validation — the track will be auto-created during application.
  const isAutoCreatedOverlayTrack =
    !targetTrack && item.type === "overlay";

  if (!isAutoCreatedOverlayTrack) {
    validateTargetTrack(document, targetTrack, trackId, item, errors, warnings);
    if (targetTrack) {
      validateTrackWritable(targetTrack, errors);
    }
  }

  if (findItem(document, item.id)) {
    errors.push(`Timeline item ${item.id} already exists.`);
  }

  if (isMediaBackedTimelineItem(item)) {
    const media = document.media[item.mediaId];
    if (!media) {
      errors.push(`Media ${item.mediaId} does not exist.`);
    } else if (expectedMediaKinds.length > 0 && !expectedMediaKinds.includes(media.kind)) {
      errors.push(`Media ${item.mediaId} must be ${expectedMediaKinds.join(" or ")} media.`);
    }
    if (isMediaTimelineItem(item)) {
      validateMediaRange(document, item, errors);
    }
    if (item.type === "audio") {
      errors.push(...validateAudioFadesForDuration(item, `${item.id}.fades`));
    }
  } else if (expectedMediaKinds.length > 0) {
    errors.push("Item must reference media.");
  }

  // Build potential document including the auto-created track for validation.
  let potentialTracks = document.tracks;
  if (isAutoCreatedOverlayTrack) {
    const overlayCount = potentialTracks.filter((track) => track.kind === "overlay").length;
    const newTrack: VideoTrack = {
      id: trackId,
      kind: "overlay",
      label: `O${overlayCount + 1}`,
      locked: false,
      hidden: false,
      muted: false,
      items: [],
    };
    const insertIndex = potentialTracks.findIndex((track) => track.kind === "audio" || track.kind === "text");
    if (insertIndex >= 0) {
      potentialTracks = [...potentialTracks.slice(0, insertIndex), newTrack, ...potentialTracks.slice(insertIndex)];
    } else {
      potentialTracks = [...potentialTracks, newTrack];
    }
  }

  validatePotentialDocument(
    document,
    {
      ...document,
      tracks: potentialTracks.map((track) =>
        track.id === trackId ? { ...track, items: [...track.items, item] } : track,
      ),
    },
    errors,
  );
}

function validateTargetTrack(
  document: VideoProjectDocument,
  targetTrack: VideoTrack | undefined,
  targetTrackId: string,
  item: VideoTimelineItem,
  errors: string[],
  warnings: string[],
): void {
  if (!targetTrack) {
    errors.push(`Track ${targetTrackId} does not exist.`);
    return;
  }

  if (!isItemAllowedOnTrack(item.type, targetTrack.kind)) {
    errors.push(`Timeline item type ${item.type} is not valid on a ${targetTrack.kind} track.`);
  }

  validateTrackWritable(targetTrack, errors);

  if (targetTrack.hidden && isVisualTrack(targetTrack.kind)) {
    warnings.push(`Track ${targetTrack.id} is hidden; visual changes will not be visible until it is shown.`);
  }

  if (targetTrack.muted && targetTrack.kind === "audio") {
    warnings.push(`Track ${targetTrack.id} is muted; audio changes will not be audible until it is unmuted.`);
  }

  const duplicateTrackIds = document.tracks.filter((track) => track.id === targetTrack.id);
  if (duplicateTrackIds.length > 1) {
    errors.push(`Track ${targetTrack.id} is duplicated.`);
  }
}

function validateTrimOperation(
  document: VideoProjectDocument,
  item: VideoTimelineItem,
  operation: TrimItemOperation,
  errors: string[],
): void {
  const updatedItem = {
    ...item,
    timelineStart: operation.timelineStart,
    duration: operation.duration,
    ...(operation.sourceIn !== undefined ? { sourceIn: operation.sourceIn } : {}),
    ...(operation.sourceOut !== undefined ? { sourceOut: operation.sourceOut } : {}),
  } as VideoTimelineItem;

  if (isMediaTimelineItem(item)) {
    if (operation.sourceIn === undefined || operation.sourceOut === undefined) {
      errors.push("trimItem must set sourceIn and sourceOut for audio and video items.");
    } else if (operation.sourceOut <= operation.sourceIn) {
      errors.push("trimItem sourceOut must be greater than sourceIn.");
    }
    validateMediaRange(document, updatedItem, errors);
  } else if (operation.sourceIn !== undefined || operation.sourceOut !== undefined) {
    errors.push("trimItem source ranges can only be used with audio or video items.");
  }
}

function validateSplitOperation(
  document: VideoProjectDocument,
  location: TimelineItemLocation,
  operation: SplitItemOperation,
  errors: string[],
): void {
  const replacementIds = new Set(operation.items.map((item) => item.id));
  if (replacementIds.size !== operation.items.length) {
    errors.push("splitItem replacement item ids must be unique.");
  }

  for (const item of operation.items) {
    if (!isItemAllowedOnTrack(item.type, location.track.kind)) {
      errors.push(`Split replacement ${item.id} is not valid on a ${location.track.kind} track.`);
    }

    const existing = findItem(document, item.id);
    if (existing && item.id !== operation.itemId) {
      errors.push(`Timeline item ${item.id} already exists.`);
    }

    if (isMediaTimelineItem(item)) {
      validateMediaRange(document, item, errors);
    }
    if (item.type === "audio") {
      errors.push(...validateAudioFadesForDuration(item, `${item.id}.fades`));
    }
  }

  const replacementItems = operation.items.map((item) => cloneJson(item));
  validatePotentialDocument(
    document,
    removeTargetedEntries(
      {
        ...document,
        tracks: document.tracks.map((track) =>
          track.id === location.track.id
            ? {
                ...track,
                items: track.items.flatMap((item) => (item.id === operation.itemId ? replacementItems : [item])),
              }
            : track,
        ),
      },
      new Set([operation.itemId]),
    ),
    errors,
  );
}

function validateMediaRange(document: VideoProjectDocument, item: VideoTimelineItem, errors: string[]): void {
  if (!isMediaTimelineItem(item)) return;

  if (item.sourceOut <= item.sourceIn) {
    errors.push(`Timeline item ${item.id} sourceOut must be greater than sourceIn.`);
  }

  const media = document.media[item.mediaId];
  if (!media) {
    errors.push(`Media ${item.mediaId} does not exist.`);
    return;
  }

  if (media.duration !== undefined && item.sourceOut > media.duration) {
    errors.push(`Timeline item ${item.id} source range exceeds media duration.`);
  }
}

function validatePotentialItem(
  document: VideoProjectDocument,
  location: TimelineItemLocation,
  updatedItem: VideoTimelineItem,
  errors: string[],
): void {
  if (updatedItem.type === "audio") {
    errors.push(...validateAudioFadesForDuration(updatedItem, `${location.item.id}.fades`));
  }

  validatePotentialDocument(
    document,
    {
      ...document,
      tracks: document.tracks.map((track) =>
        track.id === location.track.id
          ? {
              ...track,
              items: track.items.map((item) => (item.id === location.item.id ? updatedItem : item)),
            }
          : track,
      ),
    },
    errors,
  );
}

function validatePotentialDocument(
  originalDocument: VideoProjectDocument,
  potentialDocument: VideoProjectDocument,
  errors: string[],
): void {
  const validation = validateVideoProjectDocument({
    ...potentialDocument,
    history: originalDocument.history,
    updatedAt: originalDocument.updatedAt,
  });
  if (!validation.ok) {
    errors.push(...validation.errors);
  }
}

function validateTrackWritable(track: VideoTrack, errors: string[]): void {
  if (track.locked) {
    errors.push(`Track ${track.id} is locked.`);
  }
}

function removeTargetedEntries(document: VideoProjectDocument, deletedItemIds: Set<string>): VideoProjectDocument {
  return {
    ...document,
    transitions: document.transitions.filter((transition) =>
      transition.targetItemIds.every((itemId) => !deletedItemIds.has(itemId)),
    ),
    effects: document.effects.filter((effect) =>
      effect.targetItemIds.every((itemId) => !deletedItemIds.has(itemId)),
    ),
  };
}

function coalesceOperations(previous: VideoOperation, current: VideoOperation): VideoOperation | undefined {
  if (current.type === "moveItem" && previous.type === "moveItem" && current.itemId === previous.itemId) {
    return { ...current, affectedEntityIds: mergeAffectedEntityIds(previous, current) };
  }

  if (
    current.type === "trimItem" &&
    previous.type === "trimItem" &&
    current.itemId === previous.itemId &&
    current.edge === previous.edge
  ) {
    return { ...current, affectedEntityIds: mergeAffectedEntityIds(previous, current) };
  }

  if (current.type === previous.type && updateOperationTypes.has(current.type)) {
    if ("itemId" in current && "itemId" in previous && current.itemId === previous.itemId) {
      return {
        ...previous,
        ...current,
        affectedEntityIds: mergeAffectedEntityIds(previous, current),
      } as VideoOperation;
    }
  }

  return undefined;
}

function shouldCheckpoint(batch: VideoOperationBatch, operations: VideoOperation[]): boolean {
  return (
    batch.source === "ai" ||
    batch.forceCheckpoint === true ||
    operations.length > 1 ||
    operations.some((operation) =>
      operation.forceCheckpoint === true ||
      operation.type === "deleteItem" ||
      operation.type === "splitItem",
    )
  );
}

function withOperationMetadata(
  document: VideoProjectDocument,
  operationId: string,
  timestamp: string,
): VideoProjectDocument {
  return {
    ...document,
    updatedAt: timestamp,
    history: {
      ...document.history,
      revision: document.history.revision + 1,
      lastOperationId: operationId,
      canUndo: true,
      canRedo: false,
    },
  };
}

function failedApply(
  document: VideoProjectDocument,
  errors: string[],
  warnings: string[],
  skippedEntities: string[],
): VideoOperationApplyResult {
  return {
    ok: false,
    document,
    changedEntities: [],
    warnings,
    skippedEntities,
    appliedOperationIds: [],
    errors,
  };
}

function mergeItemProperties(item: any, properties: any) {
  if (properties === null) return null;
  if (!properties) return item?.properties;
  const existing = item?.properties || {};
  const merged = { ...existing };
  for (const [groupKey, groupVal] of Object.entries(properties)) {
    if (groupVal && typeof groupVal === "object" && !Array.isArray(groupVal)) {
      merged[groupKey] = {
        ...existing[groupKey],
        ...(groupVal as any),
      };
    } else {
      merged[groupKey] = groupVal;
    }
  }
  return merged;
}

function pickDefinedTextUpdate(operation: UpdateTextOperation, item: any): Partial<TextTimelineItem> {
  const transform = operation.transform ? normalizeVideoTransform(operation.transform) : undefined;
  return omitUndefined({
    text: operation.text,
    style: operation.style,
    transform,
    layerOrder: operation.layerOrder,
    timelineStart: operation.timelineStart,
    duration: operation.duration,
    properties: mergeVisualProperties(item, operation.properties, { transform }),
  });
}

function pickDefinedAudioUpdate(operation: UpdateAudioOperation, item: any): Partial<AudioTimelineItem> {
  return omitUndefined({
    volume: operation.volume,
    muted: operation.muted,
    fades: operation.fades,
    properties: mergeItemProperties(item, operation.properties),
  });
}

function pickDefinedTrackUpdate(operation: UpdateTrackOperation): Partial<VideoTrack> {
  return omitUndefined({
    label: operation.trackLabel,
    locked: operation.locked,
    hidden: operation.hidden,
    muted: operation.muted,
  });
}

function pickDefinedTransformCropUpdate(operation: UpdateTransformCropOperation, item: any): Partial<VideoTimelineItem> {
  const transform = operation.transform ? normalizeVideoTransform(operation.transform) : undefined;
  return omitUndefined({
    transform,
    crop: operation.crop,
    opacity: operation.opacity,
    layerOrder: operation.layerOrder,
    properties: mergeVisualProperties(item, operation.properties, {
      transform,
      crop: operation.crop,
      opacity: operation.opacity,
    }),
  }) as Partial<VideoTimelineItem>;
}

function mergeVisualProperties(
  item: any,
  properties: any,
  mirrors: { transform?: VideoTransform; crop?: VideoCrop; opacity?: number },
) {
  const merged = mergeItemProperties(item, properties);
  const hasMirror = mirrors.transform !== undefined || mirrors.crop !== undefined || mirrors.opacity !== undefined;
  if (properties === null) return null;
  if (!hasMirror) return merged;

  return omitUndefined({
    ...(merged || {}),
    transform: mirrors.transform,
    crop: mirrors.crop,
    opacity: mirrors.opacity,
  });
}
function findTrack(document: VideoProjectDocument, trackId: string): VideoTrack | undefined {
  return document.tracks.find((track) => track.id === trackId);
}

function findItem(document: VideoProjectDocument, itemId: string): TimelineItemLocation | undefined {
  for (let trackIndex = 0; trackIndex < document.tracks.length; trackIndex += 1) {
    const track = document.tracks[trackIndex];
    const itemIndex = track.items.findIndex((item) => item.id === itemId);
    if (itemIndex !== -1) {
      return {
        track,
        trackIndex,
        item: track.items[itemIndex],
        itemIndex,
      };
    }
  }

  return undefined;
}

function isItemAllowedOnTrack(itemType: VideoTimelineItem["type"], trackKind: VideoTrackKind): boolean {
  if (trackKind === "video") return itemType === "video" || itemType === "image";
  if (trackKind === "audio") return itemType === "audio";
  if (trackKind === "text") return itemType === "text";
  return itemType === "overlay" || itemType === "image" || itemType === "text";
}

function isMediaTimelineItem(
  item: VideoTimelineItem,
): item is VideoClipTimelineItem | AudioTimelineItem {
  return item.type === "video" || item.type === "audio";
}

function isMediaBackedTimelineItem(
  item: VideoTimelineItem,
): item is VideoClipTimelineItem | AudioTimelineItem | ImageOverlayTimelineItem {
  return item.type === "video" || item.type === "audio" || item.type === "image" || item.type === "overlay";
}

function isVisualTransformItem(
  item: VideoTimelineItem,
): item is VideoClipTimelineItem | TextTimelineItem | ImageOverlayTimelineItem {
  return item.type === "video" || item.type === "text" || item.type === "image" || item.type === "overlay";
}

function isVisualTrack(trackKind: VideoTrackKind): boolean {
  return trackKind === "video" || trackKind === "text" || trackKind === "overlay";
}

function dedupeChangedEntities(changedEntities: VideoChangedEntity[]): VideoChangedEntity[] {
  const seen = new Set<string>();
  const deduped: VideoChangedEntity[] = [];

  for (const changedEntity of changedEntities) {
    const key = `${changedEntity.kind}:${changedEntity.id}:${changedEntity.change}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(changedEntity);
    }
  }

  return deduped;
}

function mergeAffectedEntityIds(previous: VideoOperation, current: VideoOperation): string[] {
  return Array.from(new Set([...previous.affectedEntityIds, ...current.affectedEntityIds]));
}

function upsertById<T extends { id: string }>(items: T[], next: T): T[] {
  const index = items.findIndex((item) => item.id === next.id);
  if (index === -1) return [...items, next];
  return items.map((item, itemIndex) => itemIndex === index ? next : item);
}

function createBatchId(timestamp: string): string {
  return `video-operation-batch-${timestamp.replace(/[^a-zA-Z0-9]/g, "")}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function omitUndefined<T extends Record<string, unknown>>(value: T): T {
  const next: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry !== undefined) {
      next[key] = entry;
    }
  }
  return next as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null) return true;
  if (typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (isRecord(value)) return Object.values(value).every(isJsonValue);
  return false;
}

function isOneOf<T extends readonly unknown[]>(value: unknown, allowed: T): value is T[number] {
  return allowed.includes(value);
}

function validateObject(value: unknown, path: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object.`);
  }
}

function validateOptionalObject(value: unknown, path: string, errors: string[]): void {
  if (value !== undefined) {
    validateObject(value, path, errors);
  }
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

function validateNonNegativeNumber(value: unknown, path: string, errors: string[]): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    errors.push(`${path} must be a non-negative finite number.`);
  }
}

function validateOptionalNonNegativeNumber(value: unknown, path: string, errors: string[]): void {
  if (value !== undefined) {
    validateNonNegativeNumber(value, path, errors);
  }
}

function validatePositiveNumber(value: unknown, path: string, errors: string[]): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    errors.push(`${path} must be a positive finite number.`);
  }
}

function validateOptionalPositiveNumber(value: unknown, path: string, errors: string[]): void {
  if (value !== undefined) {
    validatePositiveNumber(value, path, errors);
  }
}

function validateNonNegativeInteger(value: unknown, path: string, errors: string[]): void {
  if (!Number.isInteger(value) || (value as number) < 0) {
    errors.push(`${path} must be a non-negative integer.`);
  }
}

function validateOptionalInteger(value: unknown, path: string, errors: string[]): void {
  if (value !== undefined && !Number.isInteger(value)) {
    errors.push(`${path} must be an integer when provided.`);
  }
}

function validateOptionalUnitNumber(value: unknown, path: string, errors: string[]): void {
  if (value !== undefined && (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1)) {
    errors.push(`${path} must be between 0 and 1 when provided.`);
  }
}

export function operationMetadata(label: string, affectedEntityIds: string[]): VideoOperationMetadata {
  const timestamp = new Date().toISOString();
  return {
    id: `operation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    source: "manual",
    timestamp,
    label,
    affectedEntityIds,
  };
}

export function trimOperation(
  item: VideoTimelineItem,
  fields: Partial<Pick<TrimItemOperation, "timelineStart" | "duration" | "sourceIn" | "sourceOut">>,
  label: string,
): TrimItemOperation {
  const baseFields = {
    timelineStart: item.timelineStart,
    duration: item.duration,
  };

  return {
    ...operationMetadata(label, [item.id]),
    type: "trimItem",
    itemId: item.id,
    ...baseFields,
    ...fields,
  };
}

export function reorderTrackOperation(trackId: string, targetIndex: number, label = "Reorder track"): ReorderTrackOperation {
  return {
    ...operationMetadata(label, [trackId]),
    type: "reorderTrack",
    trackId,
    targetIndex,
  };
}

export function updateTextOperation(
  itemId: string,
  fields: Omit<Partial<UpdateTextOperation>, keyof VideoOperationMetadata | "type" | "itemId">,
  label: string,
  commandId?: string,
): UpdateTextOperation {
  return {
    ...operationMetadata(label, [itemId]),
    type: "updateText",
    itemId,
    ...fields,
    ...(commandId ? { commandId } : {}),
  };
}

export function updateAudioOperation(
  itemId: string,
  fields: Omit<Partial<UpdateAudioOperation>, keyof VideoOperationMetadata | "type" | "itemId">,
  label: string,
): UpdateAudioOperation {
  return {
    ...operationMetadata(label, [itemId]),
    type: "updateAudio",
    itemId,
    ...fields,
  };
}

export function updateSpeedOperation(
  itemId: string,
  fields: Omit<UpdateSpeedOperation, keyof VideoOperationMetadata | "type" | "itemId">,
  label: string,
): UpdateSpeedOperation {
  return {
    ...operationMetadata(label, [itemId]),
    type: "updateSpeed",
    itemId,
    ...fields,
  };
}

export function updateTransformCropOperation(
  itemId: string,
  fields: Omit<Partial<UpdateTransformCropOperation>, keyof VideoOperationMetadata | "type" | "itemId">,
  label: string,
): UpdateTransformCropOperation {
  return {
    ...operationMetadata(label, [itemId]),
    type: "updateTransformCrop",
    itemId,
    ...fields,
    ...(fields.crop ? { crop: roundOperationCrop(fields.crop) } : {}),
  };
}

function roundOperationCrop(crop: VideoCrop): VideoCrop {
  const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000;
  return {
    top: round(crop.top),
    right: round(crop.right),
    bottom: round(crop.bottom),
    left: round(crop.left),
  };
}

export function updateAdvancedItemOperation(
  itemId: string,
  advanced: VideoAdvancedItemState | null,
  label: string,
): UpdateAdvancedItemOperation {
  return {
    ...operationMetadata(label, [itemId]),
    type: "updateAdvancedItem",
    itemId,
    advanced,
  };
}

export function setProjectSettingsOperation(
  settings: Partial<VideoProjectSettings>,
  label: string,
): SetProjectSettingsOperation {
  return {
    ...operationMetadata(label, ["settings"]),
    type: "setProjectSettings",
    settings,
  };
}

export function upsertEffectOperation(effect: VideoEffect, label = "Apply effect"): UpsertEffectOperation {
  return {
    ...operationMetadata(label, [effect.id, ...effect.targetItemIds]),
    type: "upsertEffect",
    effect,
  };
}

export function removeEffectOperation(effectId: string, label = "Remove effect"): RemoveEffectOperation {
  return {
    ...operationMetadata(label, [effectId]),
    type: "removeEffect",
    effectId,
  };
}

export function upsertTransitionOperation(
  transition: VideoTransition,
  label = "Apply transition",
): UpsertTransitionOperation {
  return {
    ...operationMetadata(label, [transition.id, ...transition.targetItemIds]),
    type: "upsertTransition",
    transition,
  };
}

export function removeTransitionOperation(
  transitionId: string,
  label = "Remove transition",
): RemoveTransitionOperation {
  return {
    ...operationMetadata(label, [transitionId]),
    type: "removeTransition",
    transitionId,
  };
}
