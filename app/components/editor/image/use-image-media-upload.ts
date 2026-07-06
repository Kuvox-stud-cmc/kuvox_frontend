import { useEffect, useState } from "react";

import { MediaKind, type MediaDto } from "~/lib/api";
import { createImageDocumentId } from "~/lib/editor/image/document/operations";
import { uploadMediaFile } from "~/lib/media-upload.client";

export type UploadQueueStatus = "queued" | "uploading" | "uploaded" | "failed";

export interface UploadQueueItem {
  id: string;
  fileName: string;
  progress: number;
  status: UploadQueueStatus;
  error: string | null;
  uploadedMedia: MediaDto | null;
}

interface UseImageMediaUploadInput {
  imageMedia: MediaDto[];
  uploadStudioId?: string | null;
  onAddUploadedMedia: (media: MediaDto) => void;
}

export function useImageMediaUpload({
  imageMedia,
  uploadStudioId = null,
  onAddUploadedMedia,
}: UseImageMediaUploadInput) {
  const [editorImageMedia, setEditorImageMedia] = useState<MediaDto[]>(imageMedia);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);

  useEffect(() => {
    setEditorImageMedia((current) => mergeMediaLists(imageMedia, current));
  }, [imageMedia]);

  const uploadImageFiles = async (files: File[], addLayerAfterUpload: boolean) => {
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    const rejectedFiles = files.filter((file) => !file.type.startsWith("image/"));

    if (rejectedFiles.length > 0) {
      setUploadQueue((current) => [
        ...rejectedFiles.map((file) => ({
          id: createImageDocumentId("upload"),
          fileName: file.name || "Unsupported file",
          progress: 0,
          status: "failed" as const,
          error: "Only image files can be imported.",
          uploadedMedia: null,
        })),
        ...current,
      ]);
    }

    for (const file of imageFiles) {
      const uploadId = createImageDocumentId("upload");
      setUploadQueue((current) => [
        {
          id: uploadId,
          fileName: file.name || "Untitled image",
          progress: 0,
          status: "queued",
          error: null,
          uploadedMedia: null,
        },
        ...current,
      ]);

      try {
        setUploadQueue((current) =>
          updateUploadQueueItem(current, uploadId, { status: "uploading", progress: 1 }),
        );
        const uploadedMedia = await uploadMediaFile({
          file,
          kind: MediaKind.Image,
          filename: file.name,
          studioId: uploadStudioId,
          onProgress: (progress) => {
            setUploadQueue((current) =>
              updateUploadQueueItem(current, uploadId, {
                progress,
                status: "uploading",
              }),
            );
          },
        });

        setEditorImageMedia((current) => mergeMediaLists([uploadedMedia], current));
        setUploadQueue((current) =>
          updateUploadQueueItem(current, uploadId, {
            status: "uploaded",
            progress: 100,
            uploadedMedia,
          }),
        );

        if (addLayerAfterUpload) {
          onAddUploadedMedia(uploadedMedia);
        }
      } catch (error) {
        setUploadQueue((current) =>
          updateUploadQueueItem(current, uploadId, {
            status: "failed",
            error: error instanceof Error ? error.message : "Upload failed.",
          }),
        );
      }
    }
  };

  return { editorImageMedia, uploadQueue, uploadImageFiles };
}

function updateUploadQueueItem(
  items: UploadQueueItem[],
  id: string,
  patch: Partial<UploadQueueItem>,
) {
  return items.map((item) => (item.id === id ? { ...item, ...patch } : item));
}

function mergeMediaLists(primary: MediaDto[], secondary: MediaDto[]) {
  const seen = new Set<string>();
  const merged: MediaDto[] = [];
  for (const item of [...primary, ...secondary]) {
    if (!item?.id || seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }
  return merged;
}
