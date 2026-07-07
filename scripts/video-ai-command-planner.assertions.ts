import assert from "node:assert/strict";

import {
  planVideoAiCommand,
  type VideoAiCommandContext,
} from "../app/lib/editor/video-ai-command-planner";
import {
  buildVideoAiCommandSuggestions,
} from "../app/lib/editor/video-ai-command-suggestions";
import {
  planVideoAiCommandWithService,
} from "../app/lib/editor/video-ai-service-planner";
import type { CachedCommandHistoryRecord } from "../app/lib/editor/editor-cache";
import {
  applyVideoOperationBatch,
  type VideoOperation,
} from "../app/lib/editor/video-operations";
import {
  createMockVideoProjectDocument,
  type VideoProjectDocument,
} from "../app/lib/editor/video-document";

const now = "2026-02-03T10:00:00.000Z";
const commandId = "command-test";

async function main(): Promise<void> {
  assertTrimCommands();
  assertSplitCommands();
  assertDeleteMoveTextVolumeAndSpeedCommands();
  assertTargetResolution();
  assertCommandSuggestions();
  assertUnsupportedAndInvalidCommandsAreNonDestructive();
  await assertServicePlannerMapsActions();
  await assertServicePlannerFallsBackWhenUnavailable();
}

function assertTrimCommands(): void {
  const range = plan("trim clip 1 from 4s to 10s");
  assert.equal(range.ok, true, !range.ok ? range.error : undefined);
  assert.equal(range.ok && range.batch.source, "ai");
  assert.equal(range.ok && range.batch.commandId, commandId);
  assert.equal(range.ok && range.batch.forceCheckpoint, true);
  const rangeOperation = onlyOperation(range.ok ? range.batch.operations : []);
  assert.equal(rangeOperation.type, "trimItem");
  assert.equal(rangeOperation.type === "trimItem" && rangeOperation.itemId, "tl-beach");
  assert.equal(rangeOperation.type === "trimItem" && rangeOperation.timelineStart, 4);
  assert.equal(rangeOperation.type === "trimItem" && rangeOperation.duration, 6);
  assert.equal(rangeOperation.type === "trimItem" && rangeOperation.sourceIn, 2);
  assert.equal(rangeOperation.type === "trimItem" && rangeOperation.sourceOut, 8);

  const duration = plan("trim tl-city to 8s");
  assert.equal(duration.ok, true, !duration.ok ? duration.error : undefined);
  const durationOperation = onlyOperation(duration.ok ? duration.batch.operations : []);
  assert.equal(durationOperation.type, "trimItem");
  assert.equal(durationOperation.type === "trimItem" && durationOperation.itemId, "tl-city");
  assert.equal(durationOperation.type === "trimItem" && durationOperation.timelineStart, 23.8);
  assert.equal(durationOperation.type === "trimItem" && durationOperation.duration, 8);
}

function assertSplitCommands(): void {
  const split = plan("split clip 3 at 50s");
  assert.equal(split.ok, true, !split.ok ? split.error : undefined);
  const operation = onlyOperation(split.ok ? split.batch.operations : []);
  assert.equal(operation.type, "splitItem");
  assert.equal(operation.type === "splitItem" && operation.itemId, "tl-mountain");
  assert.equal(operation.type === "splitItem" && operation.items[0].duration, 8.6);
  assert.equal(operation.type === "splitItem" && operation.items[1].timelineStart, 50);

  const here = plan("split here", {
    playback: { currentTime: 8 },
    selection: { selectedItemIds: ["tl-beach"], activeItemId: "tl-beach" },
  });
  assert.equal(here.ok, true, !here.ok ? here.error : undefined);
  const hereOperation = onlyOperation(here.ok ? here.batch.operations : []);
  assert.equal(hereOperation.type, "splitItem");
  assert.equal(hereOperation.type === "splitItem" && hereOperation.itemId, "tl-beach");
}

function assertDeleteMoveTextVolumeAndSpeedCommands(): void {
  const deleted = plan("delete", {
    selection: { selectedItemIds: ["tl-caption", "tl-audio-bed"], activeItemId: "tl-caption" },
  });
  assert.equal(deleted.ok, true, !deleted.ok ? deleted.error : undefined);
  const deleteOperation = onlyOperation(deleted.ok ? deleted.batch.operations : []);
  assert.equal(deleteOperation.type, "deleteItem");
  assert.deepEqual(deleteOperation.type === "deleteItem" && deleteOperation.itemIds, ["tl-caption", "tl-audio-bed"]);

  const moved = plan("move text 1 to 12s");
  assert.equal(moved.ok, true, !moved.ok ? moved.error : undefined);
  const moveOperation = onlyOperation(moved.ok ? moved.batch.operations : []);
  assert.equal(moveOperation.type, "moveItem");
  assert.equal(moveOperation.type === "moveItem" && moveOperation.itemId, "tl-caption");
  assert.equal(moveOperation.type === "moveItem" && moveOperation.timelineStart, 12);

  const text = plan('add text "Hello cut" at 15s');
  assert.equal(text.ok, true, !text.ok ? text.error : undefined);
  const textOperation = onlyOperation(text.ok ? text.batch.operations : []);
  assert.equal(textOperation.type, "addTextItem");
  assert.equal(textOperation.type === "addTextItem" && textOperation.item.text, "Hello cut");
  assert.equal(textOperation.type === "addTextItem" && textOperation.item.timelineStart, 15);

  const volume = plan("set volume audio 1 to 35%");
  assert.equal(volume.ok, true, !volume.ok ? volume.error : undefined);
  const volumeOperation = onlyOperation(volume.ok ? volume.batch.operations : []);
  assert.equal(volumeOperation.type, "updateAudio");
  assert.equal(volumeOperation.type === "updateAudio" && volumeOperation.itemId, "tl-audio-main");
  assert.equal(volumeOperation.type === "updateAudio" && volumeOperation.volume, 0.35);

  const speed = plan("change speed clip 2 to 2x");
  assert.equal(speed.ok, true, !speed.ok ? speed.error : undefined);
  const speedOperation = onlyOperation(speed.ok ? speed.batch.operations : []);
  assert.equal(speedOperation.type, "updateSpeed");
  assert.equal(speedOperation.type === "updateSpeed" && speedOperation.itemId, "tl-city");
  assert.equal(speedOperation.type === "updateSpeed" && speedOperation.speed, 2);
  assert.equal(speedOperation.type === "updateSpeed" && speedOperation.duration, 8);
}

function assertTargetResolution(): void {
  const selectedDefault = plan("move to 20s", {
    selection: { selectedItemIds: ["tl-city"], activeItemId: "tl-city" },
  });
  assert.equal(selectedDefault.ok, true, !selectedDefault.ok ? selectedDefault.error : undefined);
  const operation = onlyOperation(selectedDefault.ok ? selectedDefault.batch.operations : []);
  assert.equal(operation.type === "moveItem" && operation.itemId, "tl-city");

  const activeDefault = plan("move to 20s", {
    selection: { selectedItemIds: ["tl-beach", "tl-city"], activeItemId: "tl-city" },
  });
  assert.equal(activeDefault.ok, true, !activeDefault.ok ? activeDefault.error : undefined);
  const activeOperation = onlyOperation(activeDefault.ok ? activeDefault.batch.operations : []);
  assert.equal(activeOperation.type === "moveItem" && activeOperation.itemId, "tl-city");

  const ambiguous = plan("move tl to 10s");
  assert.equal(ambiguous.ok, false);
  assert.match(!ambiguous.ok ? ambiguous.error : "", /ambiguous/i);
}

function assertCommandSuggestions(): void {
  const historySuggestions = buildVideoAiCommandSuggestions({
    ...suggestionContext({
      commandHistory: [
        historyRecord("history-old", "trim clip 1 to 8s", "2026-02-02T09:00:00.000Z", "applied"),
        historyRecord("history-new", "move clip 1 to 12s", "2026-02-02T10:00:00.000Z", "applied"),
        historyRecord("history-duplicate", "MOVE   CLIP 1 TO 12S", "2026-02-02T11:00:00.000Z", "applied"),
        historyRecord("history-failed", "delete", "2026-02-02T12:00:00.000Z", "failed"),
        historyRecord("history-queued", "split here", "2026-02-02T13:00:00.000Z", "queued"),
      ],
    }),
  });
  assert.equal(historySuggestions[0].source, "history");
  assert.equal(historySuggestions[0].command, "MOVE   CLIP 1 TO 12S");
  assert.equal(historySuggestions[1].command, "trim clip 1 to 8s");
  assert.equal(historySuggestions.some((suggestion) => suggestion.command === "delete"), false);
  assert.equal(
    historySuggestions.some((suggestion) => suggestion.command === "split here" && suggestion.source === "history"),
    false,
  );

  const videoSuggestions = buildVideoAiCommandSuggestions(suggestionContext({
    playback: { currentTime: 6.1234 },
    selection: { selectedItemIds: ["tl-beach"], activeItemId: "tl-beach" },
  }));
  assert.ok(videoSuggestions.some((suggestion) => suggestion.command === "split tl-beach at 6.123s"));
  assert.ok(videoSuggestions.some((suggestion) => suggestion.command === "change speed tl-beach to 2x"));
  assert.ok(videoSuggestions.some((suggestion) => suggestion.command === 'add text "New caption" at 6.123s'));

  const audioSuggestions = buildVideoAiCommandSuggestions(suggestionContext({
    selection: { selectedItemIds: ["tl-audio-main"], activeItemId: "tl-audio-main" },
  }));
  assert.ok(audioSuggestions.some((suggestion) => suggestion.command === "set volume tl-audio-main to 50%"));

  const textSuggestions = buildVideoAiCommandSuggestions(suggestionContext({
    selection: { selectedItemIds: ["tl-caption"], activeItemId: "tl-caption" },
  }));
  assert.ok(textSuggestions.some((suggestion) => suggestion.command === "delete tl-caption"));

  const filtered = buildVideoAiCommandSuggestions(suggestionContext({
    commandHistory: [historyRecord("history-case", "Move Clip 1 To 12s", "2026-02-02T10:00:00.000Z", "applied")],
    currentInput: "clip 1",
  }));
  assert.ok(filtered.length > 0);
  assert.ok(filtered.every((suggestion) => suggestion.command.toLowerCase().includes("clip 1")));
}

function assertUnsupportedAndInvalidCommandsAreNonDestructive(): void {
  const document = createMockVideoProjectDocument("video-ai", "Video AI");
  const unsupported = plan("make this cinematic", { document });
  assert.equal(unsupported.ok, false);
  assert.deepEqual(document, createMockVideoProjectDocument("video-ai", "Video AI"));

  const invalid = plan("trim clip 1 from 2s to 80s", { document });
  assert.equal(invalid.ok, false);
  assert.deepEqual(document, createMockVideoProjectDocument("video-ai", "Video AI"));

  const valid = plan("move clip 1 to 12s", { document });
  assert.equal(valid.ok, true, !valid.ok ? valid.error : undefined);
  if (valid.ok) {
    const applied = applyVideoOperationBatch(document, valid.batch);
    assert.equal(applied.ok, true, applied.errors?.join("; "));
    assert.equal(applied.undo?.type, "checkpoint");
    assert.equal(applied.historyEntry?.source, "ai");
    assert.equal(applied.historyEntry?.commandId, commandId);
    assert.deepEqual(document, createMockVideoProjectDocument("video-ai", "Video AI"));
  }
}

function plan(
  prompt: string,
  overrides: Omit<Partial<VideoAiCommandContext>, "selection" | "playback"> & {
    selection?: Partial<VideoAiCommandContext["selection"]>;
    playback?: Partial<VideoAiCommandContext["playback"]>;
  } = {},
) {
  const document = overrides.document ?? createMockVideoProjectDocument("video-ai", "Video AI");
  const context: VideoAiCommandContext = {
    document,
    selection: {
      selectedTrackIds: [],
      selectedItemIds: ["tl-beach"],
      selectedTransitionIds: [],
      selectedEffectIds: [],
      activeItemId: "tl-beach",
      ...overrides.selection,
    },
    playback: {
      playing: false,
      currentTime: 6,
      volume: 1,
      muted: false,
      loop: false,
      ...overrides.playback,
    },
    selectedItem: null,
    mediaReferences: document.media,
  };

  return planVideoAiCommand(context, prompt, { commandId, now });
}

async function servicePlan(
  prompt: string,
  response: unknown,
  overrides: Omit<Partial<VideoAiCommandContext>, "selection" | "playback"> & {
    selection?: Partial<VideoAiCommandContext["selection"]>;
    playback?: Partial<VideoAiCommandContext["playback"]>;
  } = {},
) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}"));
    assert.equal(body.commandId, commandId);
    assert.equal(body.timeline.projectId, "video-ai");
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    return await planVideoAiCommandWithService(contextFor(overrides), prompt, { commandId, now });
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function assertServicePlannerMapsActions(): Promise<void> {
  const planned = await servicePlan("move clip 1 to 12s", {
    ok: true,
    planId: "plan-test",
    commandId,
    explanation: "Moved tl-beach to 12s.",
    confidence: 1,
    warnings: [],
    actions: [{ type: "moveItem", itemId: "tl-beach", timelineStart: 12 }],
  });

  assert.equal(planned.ok, true, !planned.ok ? planned.error : undefined);
  const operation = onlyOperation(planned.ok ? planned.batch.operations : []);
  assert.equal(operation.type, "moveItem");
  assert.equal(operation.type === "moveItem" && operation.itemId, "tl-beach");
  assert.equal(operation.type === "moveItem" && operation.timelineStart, 12);
  assert.equal(planned.ok && planned.summary, "Moved tl-beach to 12s.");
}

async function assertServicePlannerFallsBackWhenUnavailable(): Promise<void> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: "offline" }), { status: 502 });

  try {
    const planned = await planVideoAiCommandWithService(contextFor(), "move clip 1 to 12s", { commandId, now });
    assert.equal(planned.ok, true, !planned.ok ? planned.error : undefined);
    assert.ok(planned.ok && planned.warnings.some((warning) => /local command planning/i.test(warning)));
    const operation = onlyOperation(planned.ok ? planned.batch.operations : []);
    assert.equal(operation.type === "moveItem" && operation.itemId, "tl-beach");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function contextFor(
  overrides: Omit<Partial<VideoAiCommandContext>, "selection" | "playback"> & {
    selection?: Partial<VideoAiCommandContext["selection"]>;
    playback?: Partial<VideoAiCommandContext["playback"]>;
  } = {},
): VideoAiCommandContext {
  const document = overrides.document ?? createMockVideoProjectDocument("video-ai", "Video AI");
  return {
    document,
    selection: {
      selectedTrackIds: [],
      selectedItemIds: ["tl-beach"],
      selectedTransitionIds: [],
      selectedEffectIds: [],
      activeItemId: "tl-beach",
      ...overrides.selection,
    },
    playback: {
      playing: false,
      currentTime: 6,
      volume: 1,
      muted: false,
      loop: false,
      ...overrides.playback,
    },
    selectedItem: null,
    mediaReferences: document.media,
  };
}

function suggestionContext(
  overrides: Omit<Partial<VideoAiCommandContext>, "selection" | "playback"> & {
    selection?: Partial<VideoAiCommandContext["selection"]>;
    playback?: Partial<VideoAiCommandContext["playback"]>;
    commandHistory?: CachedCommandHistoryRecord[];
    currentInput?: string;
  } = {},
) {
  const document = overrides.document ?? createMockVideoProjectDocument("video-ai", "Video AI");
  return {
    document,
    selection: {
      selectedTrackIds: [],
      selectedItemIds: ["tl-beach"],
      selectedTransitionIds: [],
      selectedEffectIds: [],
      activeItemId: "tl-beach",
      ...overrides.selection,
    },
    playback: {
      playing: false,
      currentTime: 6,
      volume: 1,
      muted: false,
      loop: false,
      ...overrides.playback,
    },
    selectedItem: null,
    commandHistory: overrides.commandHistory ?? [],
    currentInput: overrides.currentInput,
  };
}

function historyRecord(
  id: string,
  text: string,
  timestamp: string,
  status: CachedCommandHistoryRecord["status"],
): CachedCommandHistoryRecord {
  return {
    id,
    scopeProjectKey: "scope:project",
    scopeKey: "scope",
    scope: { userId: "user-1", ownerKind: "user", ownerId: "user-1" },
    projectId: "video-ai",
    commandId: id,
    source: "ai",
    text,
    timestamp,
    status,
    cachedAt: 1,
  };
}

function onlyOperation(operations: VideoOperation[]): VideoOperation {
  assert.equal(operations.length, 1);
  return operations[0];
}

void main();
