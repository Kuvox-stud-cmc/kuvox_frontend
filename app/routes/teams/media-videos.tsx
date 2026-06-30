import { MediaKind } from "~/lib/api";

import {
  createTeamMediaKindLoader,
  teamMediaKindAction,
} from "./media-kind-route.server";
import { TeamMediaKindView } from "./media-kind-route";
import type { Route } from "./+types/media-videos";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Studio videos · Kuvox" }];
}

export const loader = createTeamMediaKindLoader(MediaKind.Video);
export const action = teamMediaKindAction;

export default function TeamVideos({ loaderData, actionData }: Route.ComponentProps) {
  return (
    <TeamMediaKindView
      media={loaderData.media}
      error={loaderData.error}
      actionData={actionData}
      kind={MediaKind.Video}
      title="Videos"
      subtitle="Video assets owned by this Studio."
    />
  );
}
