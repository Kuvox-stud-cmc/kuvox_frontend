import type { MediaDto } from "./api";

export interface UploadMediaInput {
  file: File;
  kind: number;
  filename?: string;
  studioId?: string | null;
  onProgress?: (progress: number) => void;
  timeoutMs?: number;
}

export function uploadMediaFile({
  file,
  kind,
  filename,
  studioId,
  onProgress,
  timeoutMs = 15 * 60 * 1000,
}: UploadMediaInput): Promise<MediaDto> {
  const params = new URLSearchParams();
  if (studioId) params.set("studioId", studioId);
  const query = params.toString();
  const url = `/bff/media/upload${query ? `?${query}` : ""}`;

  const formData = new FormData();
  formData.append("file", file);
  formData.append("kind", String(kind));
  if (filename?.trim()) {
    formData.append("filename", filename.trim());
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.withCredentials = true;
    xhr.timeout = timeoutMs;

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress?.(Math.round((event.loaded / event.total) * 100));
    };

    xhr.onload = () => {
      const body = parseJson(xhr.responseText);
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve(body as MediaDto);
        return;
      }

      reject(new Error(errorMessage(body) || `Upload failed with status ${xhr.status}.`));
    };

    xhr.onerror = () => reject(new Error("Upload failed before reaching the server."));
    xhr.ontimeout = () => reject(new Error("Upload timed out while waiting for the server to finish importing."));
    xhr.onabort = () => reject(new Error("Upload was cancelled."));
    xhr.send(formData);
  });
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function errorMessage(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  return String(record.error || record.detail || record.title || "") || null;
}
