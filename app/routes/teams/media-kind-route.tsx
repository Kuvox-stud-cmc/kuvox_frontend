import { MediaView } from "~/components/dashboard/workspace/media-view";
import type { MediaDto } from "~/lib/api";

export function TeamMediaKindView({
  media,
  error,
  actionData,
  kind,
  title,
  subtitle,
}: {
  media: MediaDto[];
  error: string | null;
  actionData?: { ok?: boolean; intent?: string; error?: string };
  kind: number;
  title: string;
  subtitle: string;
}) {
  return (
    <MediaView
      media={media}
      loadError={error}
      actionData={actionData}
      fixedKind={kind}
      title={title}
      subtitle={subtitle}
    />
  );
}
