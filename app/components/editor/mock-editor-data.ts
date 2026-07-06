import type { LibraryTab } from "~/store/slices/editor-slice";
import { MediaKind, OwnerKind, type MediaDto } from "~/lib/api";
import {
  createMockVideoProjectDocument,
  type VideoProjectDocument,
  type VideoTimelineItem,
  type VideoTrack,
} from "~/lib/editor/video-document";

export interface EditorProjectMock {
  id: string;
  name: string;
  label: string;
  duration: string;
  currentTime: string;
  previewTitle: string;
  previewGradient: string;
}

export interface MediaAssetMock {
  id: string;
  type: LibraryTab;
  title: string;
  duration: string;
  icon: string;
  gradient: string;
}

export interface TimelineClipMock {
  id: string;
  label: string;
  start: number;
  width: number;
  tone: "video" | "audio" | "text";
}

export interface TimelineTrackMock {
  id: string;
  label: string;
  icon: string;
  height: number;
  clips: TimelineClipMock[];
}

export interface AssistantMessageMock {
  id: string;
  role: "assistant" | "user";
  text: string;
  actions?: string[];
}

export interface AssistantSuggestionMock {
  id: string;
  icon: string;
  label: string;
}

export const editorProject: EditorProjectMock = {
  id: "summer-highlights",
  name: "Summer Highlights",
  label: "Project",
  duration: "00:05:00:00",
  currentTime: "00:01:23:14",
  previewTitle: "Beach opening frame",
  previewGradient:
    "linear-gradient(135deg, #0b1820 0%, #17465a 42%, #83633b 100%)",
};

export const mockVideoProjectDocument = createMockVideoProjectDocument(
  editorProject.id,
  editorProject.name,
);

export const mediaAssets: MediaAssetMock[] = [
  {
    id: "clip-beach",
    type: "clips",
    title: "Beach_01.mp4",
    duration: "00:15",
    icon: "movie",
    gradient: "linear-gradient(135deg, #102a33 0%, #2f6c7c 55%, #9b7b4b 100%)",
  },
  {
    id: "clip-city",
    type: "clips",
    title: "City_Night.mp4",
    duration: "00:08",
    icon: "movie",
    gradient: "linear-gradient(135deg, #11131b 0%, #30324a 54%, #6e4b7e 100%)",
  },
  {
    id: "clip-mountain",
    type: "clips",
    title: "Mountain_View.mp4",
    duration: "00:22",
    icon: "movie",
    gradient: "linear-gradient(135deg, #15191d 0%, #3f4a52 55%, #89909a 100%)",
  },
  {
    id: "clip-street",
    type: "clips",
    title: "Street_Broll.mp4",
    duration: "01:05",
    icon: "movie",
    gradient: "linear-gradient(135deg, #18181b 0%, #3a3a42 55%, #59614f 100%)",
  },
  {
    id: "audio-main",
    type: "audio",
    title: "Main ambience.wav",
    duration: "04:52",
    icon: "graphic_eq",
    gradient: "linear-gradient(135deg, #0f2a23 0%, #1f6b56 55%, #435f51 100%)",
  },
  {
    id: "audio-music",
    type: "audio",
    title: "Upbeat bed.mp3",
    duration: "02:35",
    icon: "music_note",
    gradient: "linear-gradient(135deg, #241a32 0%, #5a426e 56%, #80638b 100%)",
  },
  {
    id: "still-poster",
    type: "stills",
    title: "Poster frame",
    duration: "Still",
    icon: "imagesmode",
    gradient: "linear-gradient(135deg, #3d2818 0%, #805b32 48%, #a28555 100%)",
  },
  {
    id: "still-logo",
    type: "stills",
    title: "Logo lockup",
    duration: "Still",
    icon: "image",
    gradient: "linear-gradient(135deg, #1e2130 0%, #424765 52%, #777b9a 100%)",
  },
];

export const workspaceMediaAssets: MediaDto[] = mediaAssets.map((asset, index) => ({
  id: asset.id,
  ownerId: "mock-user",
  ownerKind: OwnerKind.User,
  ownerEmail: "mock@example.com",
  ownerDisplayName: "Mock User",
  kind: mediaKindFromTab(asset.type),
  filename: asset.title,
  storageKey: `mock/${asset.id}`,
  sizeBytes: 1024 * (index + 1),
  status: "Ready",
  canonicalStorageKey: null,
  proxyStorageKey: null,
  thumbnailStorageKey: null,
  errorMessage: null,
  durationSeconds: asset.type === "stills" ? null : secondsFromLabel(asset.duration),
  width: asset.type === "audio" ? null : 1920,
  height: asset.type === "audio" ? null : 1080,
  codec: null,
  frameRate: asset.type === "clips" ? 30 : null,
  createdAt: new Date(Date.UTC(2026, 0, index + 1, 10, 0, 0)).toISOString(),
  isFavorite: false,
  pipeline: {
    stage: "ready",
    label: "Ready to edit",
    detail: "Import and processing completed.",
    step: 4,
    stepCount: 4,
    terminal: true,
  },
}));

const timelinePixelsPerSecond = 10;

const trackIcons: Record<VideoTrack["kind"], string> = {
  video: "video_camera_front",
  audio: "graphic_eq",
  text: "subtitles",
  overlay: "filter",
};

export function createTimelineTracksFromVideoDocument(
  document: VideoProjectDocument,
): TimelineTrackMock[] {
  return document.tracks.map((track) => ({
    id: track.id,
    label: track.label,
    icon: trackIcons[track.kind],
    height: track.kind === "text" ? 48 : 64,
    clips: track.items.map((item) => ({
      id: item.id,
      label: timelineItemLabel(document, item),
      start: Math.round(item.timelineStart * timelinePixelsPerSecond),
      width: Math.round(item.duration * timelinePixelsPerSecond),
      tone: timelineItemTone(item),
    })),
  }));
}

export const timelineTracks: TimelineTrackMock[] =
  createTimelineTracksFromVideoDocument(mockVideoProjectDocument);

function timelineItemTone(item: VideoTimelineItem): TimelineClipMock["tone"] {
  if (item.type === "audio") return "audio";
  if (item.type === "text") return "text";
  return "video";
}

function timelineItemLabel(
  document: VideoProjectDocument,
  item: VideoTimelineItem,
): string {
  if (item.type === "text") {
    return item.text;
  }

  const media = document.media[item.mediaId];
  if (!media) {
    return item.id;
  }

  if (item.type === "audio") {
    return media.name.replace(/\.[^/.]+$/, "");
  }

  return media.name;
}

export const assistantMessages: AssistantMessageMock[] = [
  {
    id: "m1",
    role: "assistant",
    text: "I am ready to help with your summer highlights cut. What would you like to adjust?",
  },
  {
    id: "m2",
    role: "user",
    text: "Speed up the middle section by 4x and keep the beach opening calm.",
  },
  {
    id: "m3",
    role: "assistant",
    text: "I drafted a speed change for the city section and preserved the opening pacing. The muted audio segment can be replaced with music.",
    actions: ["Accept", "Modify", "Dismiss"],
  },
];

export const assistantSuggestions: AssistantSuggestionMock[] = [
  { id: "s1", icon: "subtitles", label: "Add captions" },
  { id: "s2", icon: "palette", label: "Color grade for a cinematic look" },
  { id: "s3", icon: "content_cut", label: "Trim ending to 30s" },
];

function mediaKindFromTab(tab: LibraryTab): number {
  if (tab === "audio") return MediaKind.Audio;
  if (tab === "stills") return MediaKind.Image;
  return MediaKind.Video;
}

function secondsFromLabel(label: string): number {
  const parts = label.split(":").map((part) => Number(part));
  if (parts.some((part) => !Number.isFinite(part))) return 5;
  if (parts.length === 2) return (parts[0] * 60) + parts[1];
  if (parts.length === 3) return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
  return parts[0] || 5;
}
