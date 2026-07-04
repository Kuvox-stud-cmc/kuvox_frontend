import { MediaView } from "~/components/dashboard/workspace/media-view";
import type { MediaDto } from "~/lib/api";

export function TeamMediaKindView({
  media,
  error,
  actionData,
  kind,
  title,
  subtitle,
  studioId,
  canWrite,
}: {
  media: MediaDto[];
  error: string | null;
  actionData?: { ok?: boolean; intent?: string; error?: string };
  kind: number;
  title: string;
  subtitle: string;
  studioId: string;
  canWrite: boolean;
}) {
  return (
    <MediaView
      media={media}
      loadError={error}
      actionData={actionData}
      fixedKind={kind}
      title={title}
      subtitle={subtitle}
      studioId={studioId}
      canWrite={canWrite}
    />
  );
}
