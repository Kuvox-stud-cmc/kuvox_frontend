import { Outlet } from "react-router";

import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

/**
 * Layout for the public, SSR-rendered marketing pages (landing, pricing,
 * enterprise, help, community, about/privacy/terms).
 */
export default function MarketingLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}
