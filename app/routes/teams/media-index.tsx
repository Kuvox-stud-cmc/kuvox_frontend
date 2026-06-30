import { redirect } from "react-router";

import type { Route } from "./+types/media-index";

export function loader({ params }: Route.LoaderArgs) {
  throw redirect(`/teams/${params.studioId}/media/videos`);
}

export default function TeamMediaIndex() {
  return null;
}
