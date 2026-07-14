import { GuidedTour, type GuidedTourStep } from "~/components/editor/guided-tour";

const dashboardTourSteps: GuidedTourStep[] = [
  {
    id: "sidebar",
    target: '[data-tour="dashboard-sidebar"], [data-tour="dashboard-mobile-menu"]',
    title: "Find your workspace",
    body: "Use the navigation to move between projects, media, albums, AI tools, shared work, and brand kits.",
    placement: "right",
  },
  {
    id: "new-project",
    target: '[data-tour="dashboard-new-project"]',
    title: "Start a new project",
    body: "Create a video or image project from here when you are ready to begin editing.",
    placement: "right",
  },
  {
    id: "search",
    target: '[data-tour="dashboard-search"]',
    title: "Search across Kuvox",
    body: "Quickly find projects, assets, albums, and workspace items without digging through pages.",
    placement: "bottom",
  },
  {
    id: "metrics",
    target: '[data-tour="dashboard-metrics"]',
    title: "Check your workspace at a glance",
    body: "These cards summarize projects, media, shared items, and trash so new users know where they stand.",
    placement: "bottom",
  },
  {
    id: "recent-projects",
    target: '[data-tour="dashboard-recent-projects"]',
    title: "Continue recent work",
    body: "Open a recent project to jump into the editor. The editor tour will appear there for first-time guidance.",
    placement: "top",
  },
  {
    id: "recent-assets",
    target: '[data-tour="dashboard-recent-assets"]',
    title: "Review imported assets",
    body: "Your latest photos, videos, and audio show here after import so you can preview and organize them.",
    placement: "top",
  },
];

export function DashboardGuidedTour({ userId }: { userId: string }) {
  return (
    <GuidedTour
      steps={dashboardTourSteps}
      storageKey="kuvox.dashboard.onboardingTour.completed.v1"
      storageScope={userId}
    />
  );
}
