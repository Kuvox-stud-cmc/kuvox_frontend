import {
  type RouteConfig,
  index,
  layout,
  prefix,
  route,
} from "@react-router/dev/routes";

import { routesFolder } from './const/routes-name';

export default [
  // ── Public marketing pages (SSR) under a shared header/footer ──────────────
  layout("components/marketing/marketing-layout.tsx", [
    index("routes/home.tsx"),

    ...prefix("pricing", [
      index(`${routesFolder.PRICING}/index.tsx`),
      route("student-verification", `${routesFolder.PRICING}/student-verification.tsx`),
      route("checkout", `${routesFolder.PRICING}/checkout.tsx`),
    ]),

    ...prefix("enterprise", [
      index(`${routesFolder.ENTERPRISE}/index.tsx`),
      route("contact-sales", `${routesFolder.ENTERPRISE}/contact-sales.tsx`),
      route("request-demo", `${routesFolder.ENTERPRISE}/request-demo.tsx`),
    ]),

    route("about", "routes/about.tsx"),
    route("privacy", "routes/privacy.tsx"),
    route("terms", "routes/terms.tsx"),
    route("mobile", "routes/download-mobile.tsx"),

    layout("components/help/help-center-layout.tsx", [
      ...prefix("help", [
        index(`${routesFolder.HELP}/index.tsx`),
        route("getting-started", `${routesFolder.HELP}/getting-started.tsx`),
        route("upload-processing", `${routesFolder.HELP}/upload-processing.tsx`),
        route("editing-guide", `${routesFolder.HELP}/editing-guide.tsx`),
        route("ai-agent-guide", `${routesFolder.HELP}/ai-agent-guide.tsx`),
        route("rendering-export", `${routesFolder.HELP}/rendering-export.tsx`),
        route("faq", `${routesFolder.HELP}/faq.tsx`),
        route("contact-support", `${routesFolder.HELP}/contact-support.tsx`),
        route("report-issue", `${routesFolder.HELP}/report-issue.tsx`),
      ])
    ]),

    ...prefix("community", [
      index(`${routesFolder.COMMUNITY}/index.tsx`),
      route("forums", `${routesFolder.COMMUNITY}/forums.tsx`),
      route("forums/:threadId", `${routesFolder.COMMUNITY}/thread.tsx`),
      route("showcase", `${routesFolder.COMMUNITY}/showcase.tsx`),
      route("showcase/:showcaseId", `${routesFolder.COMMUNITY}/showcase-detail.tsx`),
      route("learn", `${routesFolder.COMMUNITY}/learn.tsx`),
      route("news", `${routesFolder.COMMUNITY}/news.tsx`),
    ]),
  ]),

  // ── Authentication ─────────────────────────────────────────────────────────
  layout(`${routesFolder.AUTH}/layout.tsx`, [
    route("login", `${routesFolder.AUTH}/login.tsx`),
    route("signup", `${routesFolder.AUTH}/signup.tsx`),
    route("forgot-password", `${routesFolder.AUTH}/forgot-password.tsx`),
    route("reset-password", `${routesFolder.AUTH}/reset-password.tsx`),
    route("verify-email", `${routesFolder.AUTH}/verify-email.tsx`),
    route("verify-pending", `${routesFolder.AUTH}/verify-pending.tsx`),
  ]),
  // Action-only route (no UI) — destroys the session cookie.
  route("logout", `${routesFolder.AUTH}/logout.tsx`),
  route("create-studio", `${routesFolder.AUTH}/create-studio.tsx`),

  // ── Onboarding ──────────────────────────────────────────────────────────────
  layout(`${routesFolder.ONBOARDING}/layout.tsx`, [
    ...prefix("onboarding", [
      route("welcome", `${routesFolder.ONBOARDING}/welcome.tsx`),
      route("personalize", `${routesFolder.ONBOARDING}/personalize.tsx`),
      route("import-media", `${routesFolder.ONBOARDING}/import-media.tsx`),
      route("first-project", `${routesFolder.ONBOARDING}/first-project.tsx`),
    ]),
  ]),

  // ── Dashboard (authenticated app shell) ─────────────────────────────────────
  layout(`${routesFolder.DASHBOARD}/layout.tsx`, [
    ...prefix("dashboard", [
      index(`${routesFolder.DASHBOARD}/home.tsx`),
      route("photos", `${routesFolder.DASHBOARD}/photos.tsx`),
      route("videos", `${routesFolder.DASHBOARD}/videos.tsx`),
      route("audio", `${routesFolder.DASHBOARD}/audio.tsx`),
      route("templates", `${routesFolder.DASHBOARD}/templates.tsx`),
      route("ai-tools", `${routesFolder.DASHBOARD}/ai-tools.tsx`),
      route("projects", `${routesFolder.DASHBOARD}/projects.tsx`),
      route("team", `${routesFolder.DASHBOARD}/team.tsx`),
      route("reviews", `${routesFolder.DASHBOARD}/reviews.tsx`),
      route("shared-assets", `${routesFolder.DASHBOARD}/shared-assets.tsx`),
      route("brand-kits", `${routesFolder.DASHBOARD}/brand-kits.tsx`),
      route("recycle-bin", `${routesFolder.DASHBOARD}/recycle-bin.tsx`),
    ]),
    route("search", "routes/search.tsx"),
  ]),

  // ── Team (Studio) workspace ─────────────────────────────────────────────────
  ...prefix("teams/:studioId", [
    layout(`${routesFolder.TEAMS}/layout.tsx`, [
      index(`${routesFolder.TEAMS}/home.tsx`),
      route("projects", `${routesFolder.TEAMS}/projects.tsx`),
      route("media", `${routesFolder.TEAMS}/media.tsx`),
      route("members", `${routesFolder.TEAMS}/members.tsx`),
      route("settings", `${routesFolder.TEAMS}/settings.tsx`),
      route("trash", `${routesFolder.TEAMS}/trash.tsx`),
    ]),
  ]),

  // ── Editor (CLIENT-ONLY: clientLoader + HydrateFallback, Redux-scoped) ──────
  route("editor/:projectId", `${routesFolder.EDITOR}/editor.tsx`),

  // ── Settings ────────────────────────────────────────────────────────────────
  layout(`${routesFolder.SETTINGS}/layout.tsx`, [
    ...prefix("settings", [
      index(`${routesFolder.SETTINGS}/index.tsx`),
      route("account", `${routesFolder.SETTINGS}/account.tsx`),
      route("billing", `${routesFolder.SETTINGS}/billing.tsx`),
      route("preferences", `${routesFolder.SETTINGS}/preferences.tsx`),
      route("security", `${routesFolder.SETTINGS}/security.tsx`),
      route("integrations", `${routesFolder.SETTINGS}/integrations.tsx`),
    ]),
  ]),

  // ── Standalone authenticated pages ──────────────────────────────────────
  route("notifications", "routes/notifications.tsx"),

  // ── User profile ────────────────────────────────────────────────────────────
  ...prefix("u/:username", [
    layout(`${routesFolder.PROFILE}/layout.tsx`, [
      index(`${routesFolder.PROFILE}/public-profile.tsx`),
      route("followers", `${routesFolder.PROFILE}/followers.tsx`),
      route("following", `${routesFolder.PROFILE}/following.tsx`),
    ]),
  ]),

  // ── 404 / catch-all ─────────────────────────────────────────────────────────
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
