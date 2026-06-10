import { Outlet } from "react-router";

import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

/**
 * Layout for the public, SSR-rendered marketing pages (landing, pricing,
 * enterprise, help, community, about/privacy/terms).
 */
export default function MarketingLayout() {
  return (
    <div className="bg-surface text-on-surface font-sans min-h-screen flex flex-col">
      <SiteHeader />

      <main className="flex-grow pt-20 sm:pt-24 pb-10 sm:pb-16 px-4 sm:px-6 lg:px-container-padding flex flex-col items-center relative overflow-clip">
        {/* Subtle Background Glow — scaled down on mobile */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] sm:w-[450px] sm:h-[450px] lg:w-[600px] lg:h-[600px] bg-primary/5 rounded-full blur-[80px] sm:blur-[100px] pointer-events-none -z-10" />

        <Outlet />
      </main>

      <SiteFooter />
    </div>
  );
}
