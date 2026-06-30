import { StudioRendersPage } from "~/components/dashboard/workspace/studio-mock-pages";

export function meta() {
  return [{ title: "Studio renders · Kuvox" }];
}

export default function TeamRenders() {
  return <StudioRendersPage />;
}
