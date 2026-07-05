import { MediaKind } from "~/lib/api";

import {
  createTeamMediaKindAction,
  createTeamMediaKindLoader,
} from "./media-kind-route.server";
import { TeamMediaKindView } from "./media-kind-route";
import type { Route } from "./+types/media-videos";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Studio videos · Kuvox" }];
}

export const loader = createTeamMediaKindLoader(MediaKind.Video);
export const action = createTeamMediaKindAction(MediaKind.Video);

export default function TeamVideos({ loaderData, actionData, params }: Route.ComponentProps) {
  return (
    <TeamMediaKindView
      media={loaderData.media}
      albums={loaderData.albums}
      albumMediaCounts={loaderData.albumMediaCounts}
      albumMedia={loaderData.albumMedia}
      error={loaderData.error}
      actionData={actionData}
      kind={MediaKind.Video}
      title="Videos"
      subtitle="Video assets owned by this Studio."
      studioId={params.studioId}
      canWrite={loaderData.canWrite ?? false}
      canManageAccess={loaderData.canManageAccess ?? false}
    />
  );
}
