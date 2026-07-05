import { MediaKind } from "~/lib/api";

import {
  createTeamMediaKindAction,
  createTeamMediaKindLoader,
} from "./media-kind-route.server";
import { TeamMediaKindView } from "./media-kind-route";
import type { Route } from "./+types/media-audio";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Studio audio · Kuvox" }];
}

export const loader = createTeamMediaKindLoader(MediaKind.Audio);
export const action = createTeamMediaKindAction(MediaKind.Audio);

export default function TeamAudio({ loaderData, actionData, params }: Route.ComponentProps) {
  return (
    <TeamMediaKindView
      media={loaderData.media}
      albums={loaderData.albums}
      albumMediaCounts={loaderData.albumMediaCounts}
      albumMedia={loaderData.albumMedia}
      error={loaderData.error}
      actionData={actionData}
      kind={MediaKind.Audio}
      title="Audio"
      subtitle="Audio assets owned by this Studio."
      studioId={params.studioId}
      canWrite={loaderData.canWrite ?? false}
      canManageAccess={loaderData.canManageAccess ?? false}
    />
  );
}
