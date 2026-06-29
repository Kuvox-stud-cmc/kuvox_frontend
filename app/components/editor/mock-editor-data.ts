import type { LibraryTab } from "~/store/slices/editor-slice";

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

export interface EditorToolMock {
  id: string;
  icon: string;
  label: string;
  active?: boolean;
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

export const editorTools: EditorToolMock[] = [
  { id: "trim", icon: "content_cut", label: "Trim tool", active: true },
  { id: "split", icon: "call_split", label: "Split" },
  { id: "transition", icon: "animation", label: "Transitions" },
  { id: "speed", icon: "speed", label: "Speed" },
  { id: "color", icon: "palette", label: "Color" },
  { id: "captions", icon: "subtitles", label: "Captions" },
];

export const timelineTracks: TimelineTrackMock[] = [
  {
    id: "v1",
    label: "V1",
    icon: "video_camera_front",
    height: 64,
    clips: [
      { id: "tl-beach", label: "Beach_01.mp4", start: 20, width: 210, tone: "video" },
      { id: "tl-city", label: "City_Night.mp4", start: 238, width: 160, tone: "video" },
      { id: "tl-mountain", label: "Mountain_View.mp4", start: 414, width: 250, tone: "video" },
    ],
  },
  {
    id: "a1",
    label: "A1",
    icon: "graphic_eq",
    height: 64,
    clips: [
      { id: "tl-audio-main", label: "Main ambience", start: 20, width: 378, tone: "audio" },
      { id: "tl-audio-bed", label: "Music bed", start: 414, width: 250, tone: "audio" },
    ],
  },
  {
    id: "t1",
    label: "T1",
    icon: "subtitles",
    height: 48,
    clips: [
      { id: "tl-caption", label: "Welcome to summer", start: 70, width: 116, tone: "text" },
    ],
  },
];

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
