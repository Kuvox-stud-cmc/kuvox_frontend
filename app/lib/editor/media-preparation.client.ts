import type { PreparedMediaMetadata, MediaPreparationRequest } from "./media-preparation";

type PreparedEntry = {
  element: HTMLMediaElement | HTMLImageElement;
  metadata: PreparedMediaMetadata;
};

const preparedMediaCache = new Map<string, PreparedEntry>();

export function getPreparedMedia(key: string): PreparedEntry | undefined {
  return preparedMediaCache.get(key);
}

export function clearPreparedMediaCache(): void {
  for (const entry of preparedMediaCache.values()) {
    if (entry.element instanceof HTMLMediaElement) {
      entry.element.pause();
      entry.element.removeAttribute("src");
      entry.element.load();
    }
  }
  preparedMediaCache.clear();
}

export async function prepareMediaResource(
  request: MediaPreparationRequest,
  signal: AbortSignal,
): Promise<PreparedMediaMetadata> {
  const cached = preparedMediaCache.get(request.key);
  if (cached) return cached.metadata;
  const entry = request.kind === "image"
    ? await prepareImage(request, signal)
    : await prepareTimedMedia(request, signal);
  preparedMediaCache.set(request.key, entry);
  return entry.metadata;
}

function prepareImage(request: MediaPreparationRequest, signal: AbortSignal): Promise<PreparedEntry> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const cleanup = () => {
      image.onload = null;
      image.onerror = null;
      signal.removeEventListener("abort", abort);
    };
    const abort = () => {
      cleanup();
      image.src = "";
      reject(new DOMException("Media preparation was cancelled.", "AbortError"));
    };
    image.onload = async () => {
      try {
        if (typeof image.decode === "function") await image.decode();
        if (image.naturalWidth <= 0 || image.naturalHeight <= 0) throw new Error("Image has invalid dimensions.");
        cleanup();
        resolve({ element: image, metadata: { width: image.naturalWidth, height: image.naturalHeight } });
      } catch (error) {
        cleanup();
        reject(error);
      }
    };
    image.onerror = () => {
      cleanup();
      reject(new Error("Image could not be decoded."));
    };
    signal.addEventListener("abort", abort, { once: true });
    image.src = request.objectUrl;
  });
}

function prepareTimedMedia(request: MediaPreparationRequest, signal: AbortSignal): Promise<PreparedEntry> {
  return new Promise((resolve, reject) => {
    const element = document.createElement(request.kind === "audio" ? "audio" : "video");
    let metadataReady = false;
    let seekReady = false;
    let dataReady = false;
    const timeout = window.setTimeout(() => fail(new Error("Media preparation timed out.")), 15_000);
    const cleanup = () => {
      window.clearTimeout(timeout);
      signal.removeEventListener("abort", abort);
      element.removeEventListener("loadedmetadata", metadata);
      element.removeEventListener("seeked", seeked);
      element.removeEventListener(request.kind === "audio" ? "canplay" : "loadeddata", decoded);
      element.removeEventListener("error", errored);
    };
    const fail = (error: Error | DOMException) => {
      cleanup();
      element.removeAttribute("src");
      element.load();
      reject(error);
    };
    const finish = () => {
      if (!metadataReady || !seekReady || !dataReady) return;
      const duration = element.duration;
      const video = request.kind === "video" ? element as HTMLVideoElement : null;
      if (!Number.isFinite(duration) || duration <= 0) return fail(new Error("Media has an invalid duration."));
      if (video && (video.videoWidth <= 0 || video.videoHeight <= 0)) return fail(new Error("Video has invalid dimensions."));
      cleanup();
      resolve({
        element,
        metadata: {
          duration,
          ...(video ? { width: video.videoWidth, height: video.videoHeight } : {}),
        },
      });
    };
    const metadata = () => {
      metadataReady = true;
      const duration = Number.isFinite(element.duration) ? element.duration : request.sourceTime;
      const target = Math.max(0, Math.min(request.sourceTime, Math.max(0, duration - 0.001)));
      try {
        if (Math.abs(element.currentTime - target) <= 0.02) seekReady = true;
        else element.currentTime = target;
      } catch (error) {
        fail(error instanceof Error ? error : new Error(String(error)));
        return;
      }
      finish();
    };
    const seeked = () => { seekReady = true; finish(); };
    const decoded = () => { dataReady = true; finish(); };
    const errored = () => fail(new Error(`${request.kind === "audio" ? "Audio" : "Video"} could not be decoded.`));
    const abort = () => fail(new DOMException("Media preparation was cancelled.", "AbortError"));
    element.preload = "auto";
    element.addEventListener("loadedmetadata", metadata);
    element.addEventListener("seeked", seeked);
    element.addEventListener(request.kind === "audio" ? "canplay" : "loadeddata", decoded);
    element.addEventListener("error", errored);
    signal.addEventListener("abort", abort, { once: true });
    element.src = request.objectUrl;
    element.load();
  });
}
