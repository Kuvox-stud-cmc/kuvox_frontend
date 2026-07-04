import { MediaKind } from "~/lib/api";

import {
  createTeamMediaKindLoader,
  teamMediaKindAction,
} from "./media-kind-route.server";
import { TeamMediaKindView } from "./media-kind-route";
import type { Route } from "./+types/media-audio";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Studio audio · Kuvox" }];
}

export const loader = createTeamMediaKindLoader(MediaKind.Audio);
export const action = teamMediaKindAction;

export default function TeamAudio({ loaderData, actionData, params }: Route.ComponentProps) {
  return (
    <TeamMediaKindView
      media={loaderData.media}
      error={loaderData.error}
      actionData={actionData}
      kind={MediaKind.Audio}
      title="Audio"
      subtitle="Audio assets owned by this Studio."
      studioId={params.studioId}
      canWrite={loaderData.canWrite ?? false}
    />
  );
}
