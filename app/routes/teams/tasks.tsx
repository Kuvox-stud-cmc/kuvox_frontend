import { StudioTasksPage } from "~/components/dashboard/workspace/studio-mock-pages";

export function meta() {
  return [{ title: "Studio tasks · Kuvox" }];
}

export default function TeamTasks() {
  return <StudioTasksPage />;
}
