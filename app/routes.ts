import {
  type RouteConfig,
  index,
  layout,
  prefix,
  route,
} from "@react-router/dev/routes";

export default [
  // ── Public marketing pages (SSR) under a shared header/footer ──────────────
  layout("components/marketing/marketing-layout.tsx", [
    index("routes/home.tsx"),

    ...prefix("pricing", [
      index("routes/pricing/index.tsx"),
      route("student-verification", "routes/pricing/student-verification.tsx"),
      route("checkout", "routes/pricing/checkout.tsx"),
    ]),

    ...prefix("enterprise", [
      index("routes/enterprise/index.tsx"),
      route("contact-sales", "routes/enterprise/contact-sales.tsx"),
      route("request-demo", "routes/enterprise/request-demo.tsx"),
    ]),

    route("about", "routes/about.tsx"),
    route("privacy", "routes/privacy.tsx"),
    route("terms", "routes/terms.tsx"),
    route("mobile", "routes/download-mobile.tsx"),

    layout("components/help/help-center-layout.tsx", [
      ...prefix("help", [
        index("routes/help/index.tsx"),
        route("getting-started", "routes/help/getting-started.tsx"),
        route("upload-processing", "routes/help/upload-processing.tsx"),
        route("editing-guide", "routes/help/editing-guide.tsx"),
        route("ai-agent-guide", "routes/help/ai-agent-guide.tsx"),
        route("rendering-export", "routes/help/rendering-export.tsx"),
        route("faq", "routes/help/faq.tsx"),
        route("contact-support", "routes/help/contact-support.tsx"),
        route("report-issue", "routes/help/report-issue.tsx"),
      ])
    ]),

    ...prefix("community", [
      index("routes/community/index.tsx"),
      route("forums", "routes/community/forums.tsx"),
      route("forums/:threadId", "routes/community/thread.tsx"),
      route("showcase", "routes/community/showcase.tsx"),
      route("showcase/:showcaseId", "routes/community/showcase-detail.tsx"),
      route("learn", "routes/community/learn.tsx"),
      route("news", "routes/community/news.tsx"),
    ]),
  ]),

  // ── Authentication ─────────────────────────────────────────────────────────
  layout("routes/auth/layout.tsx", [
    route("login", "routes/auth/login.tsx"),
    route("signup", "routes/auth/signup.tsx"),
    route("forgot-password", "routes/auth/forgot-password.tsx"),
    route("reset-password", "routes/auth/reset-password.tsx"),
    route("verify-email", "routes/auth/verify-email.tsx"),
    route("verify-pending", "routes/auth/verify-pending.tsx"),
  ]),
  // Action-only route (no UI) — destroys the session cookie.
  route("logout", "routes/auth/logout.tsx"),
  // Action-only route (no UI) — creates a team.
  route("create-studio", "routes/auth/create-studio.tsx"),

  // ── Onboarding ──────────────────────────────────────────────────────────────
  layout("routes/onboarding/layout.tsx", [
    ...prefix("onboarding", [
      route("welcome", "routes/onboarding/welcome.tsx"),
      route("personalize", "routes/onboarding/personalize.tsx"),
      route("import-media", "routes/onboarding/import-media.tsx"),
      route("first-project", "routes/onboarding/first-project.tsx"),
    ]),
  ]),

  // ── Dashboard (authenticated app shell) ─────────────────────────────────────
  layout("routes/dashboard/layout.tsx", [
    ...prefix("dashboard", [
      index("routes/dashboard/home.tsx"),
      route("photos", "routes/dashboard/photos.tsx"),
      route("videos", "routes/dashboard/videos.tsx"),
      route("audio", "routes/dashboard/audio.tsx"),
      route("templates", "routes/dashboard/templates.tsx"),
      route("ai-tools", "routes/dashboard/ai-tools.tsx"),
      route("projects", "routes/dashboard/projects.tsx"),
      route("team", "routes/dashboard/team.tsx"),
      route("reviews", "routes/dashboard/reviews.tsx"),
      route("shared-assets", "routes/dashboard/shared-assets.tsx"),
      route("brand-kits", "routes/dashboard/brand-kits.tsx"),
      route("recycle-bin", "routes/dashboard/recycle-bin.tsx"),
    ]),
  ]),

  // ── Team (Studio) workspace ─────────────────────────────────────────────────
  ...prefix("teams/:studioId", [
    layout("routes/teams/layout.tsx", [
      index("routes/teams/home.tsx"),
      route("projects", "routes/teams/projects.tsx"),
      route("media", "routes/teams/media.tsx"),
      route("members", "routes/teams/members.tsx"),
      route("settings", "routes/teams/settings.tsx"),
      route("trash", "routes/teams/trash.tsx"),
    ]),
  ]),

  // ── Project detail ──────────────────────────────────────────────────────────
  ...prefix("projects/:projectId", [
    layout("routes/projects/layout.tsx", [
      index("routes/projects/overview.tsx"),
      route("versions", "routes/projects/versions.tsx"),
      route("share", "routes/projects/share.tsx"),
    ]),
  ]),

  // ── Editor (CLIENT-ONLY: clientLoader + HydrateFallback, Redux-scoped) ──────
  route("editor/:projectId", "routes/editor/editor.tsx"),

  // ── Settings ────────────────────────────────────────────────────────────────
  layout("routes/settings/layout.tsx", [
    ...prefix("settings", [
      index("routes/settings/index.tsx"),
      route("account", "routes/settings/account.tsx"),
      route("billing", "routes/settings/billing.tsx"),
      route("preferences", "routes/settings/preferences.tsx"),
      route("security", "routes/settings/security.tsx"),
      route("integrations", "routes/settings/integrations.tsx"),
    ]),
  ]),

  // ── Standalone authenticated pages ──────────────────────────────────────────
  route("notifications", "routes/notifications.tsx"),
  route("search", "routes/search.tsx"),

  // ── User profile ────────────────────────────────────────────────────────────
  ...prefix("u/:username", [
    layout("routes/profile/layout.tsx", [
      index("routes/profile/public-profile.tsx"),
      route("followers", "routes/profile/followers.tsx"),
      route("following", "routes/profile/following.tsx"),
    ]),
  ]),

  // ── 404 / catch-all ─────────────────────────────────────────────────────────
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
