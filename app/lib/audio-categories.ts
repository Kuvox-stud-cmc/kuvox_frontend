export type AudioCategoryKey = "music" | "sfx" | "voiceovers";

const AUDIO_CATEGORY_CONFIG: Record<
  AudioCategoryKey,
  { label: string; albumName: string; icon: string; description: string }
> = {
  music: {
    label: "Music",
    albumName: "Music",
    icon: "music_note",
    description: "Songs and background tracks",
  },
  sfx: {
    label: "Sound Effects",
    albumName: "Sound Effects",
    icon: "graphic_eq",
    description: "SFX, foley, and stingers",
  },
  voiceovers: {
    label: "Voiceovers",
    albumName: "Voiceovers",
    icon: "mic",
    description: "Narration and spoken recordings",
  },
};

export const AUDIO_CATEGORY_OPTIONS = (Object.entries(AUDIO_CATEGORY_CONFIG) as Array<
  [AudioCategoryKey, (typeof AUDIO_CATEGORY_CONFIG)[AudioCategoryKey]]
>).map(([value, config]) => ({
  value,
  label: config.label,
  description: config.description,
}));

export function isAudioCategoryKey(value: string): value is AudioCategoryKey {
  return value in AUDIO_CATEGORY_CONFIG;
}
