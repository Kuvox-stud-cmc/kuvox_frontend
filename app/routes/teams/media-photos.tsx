import { MediaKind } from "~/lib/api";

import {
  createTeamMediaKindLoader,
  teamMediaKindAction,
} from "./media-kind-route.server";
import { TeamMediaKindView } from "./media-kind-route";
import type { Route } from "./+types/media-photos";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Studio photos · Kuvox" }];
}

export const loader = createTeamMediaKindLoader(MediaKind.Image);
export const action = teamMediaKindAction;

export default function TeamPhotos({ loaderData, actionData, params }: Route.ComponentProps) {
  return (
    <TeamMediaKindView
      media={loaderData.media}
      error={loaderData.error}
      actionData={actionData}
      kind={MediaKind.Image}
      title="Photos"
      subtitle="Photo assets owned by this Studio."
      studioId={params.studioId}
    />
  );
}
