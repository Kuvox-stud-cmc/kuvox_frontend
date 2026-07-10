import { Outlet, useLoaderData } from "react-router";

import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { getOptionalUser } from "~/lib/auth.server";
import { createRequestLogger } from "~/lib/logger.server";
import type { SessionUser } from "~/lib/session.server";

export async function loader({ request }: { request: Request }) {
  const log = createRequestLogger(request);
  const user = await getOptionalUser(request, log);
  return { user };
}

/**
 * Layout for the public, SSR-rendered marketing pages (landing, pricing,
 * enterprise, help, community, about/privacy/terms).
 */
export default function MarketingLayout() {
  const { user } = useLoaderData() as { user: SessionUser | null };

  return (
    <div className="bg-surface text-on-surface font-sans min-h-screen flex flex-col">
      <SiteHeader user={user} />

      <main
        className="flex-grow pt-24 sm:pt-28 pb-10 sm:pb-16 px-4 sm:px-6 lg:px-container-padding flex flex-col items-center relative overflow-clip"
        style={{
          background:
            "radial-gradient(42% 26% at 50% 2%, rgba(232,108,181,0.10), transparent 62%), radial-gradient(24% 18% at 84% 12%, rgba(247,168,211,0.055), transparent 68%), radial-gradient(70% 42% at 50% 18%, rgba(35,126,143,0.28), transparent 66%), radial-gradient(58% 38% at 8% 8%, rgba(201,169,98,0.10), transparent 64%), linear-gradient(180deg, #120f0c 0%, #17130f 18%, #101813 42%, #062532 72%, #0c0c0e 100%)",
        }}
      >
        {/* Subtle Background Glow — scaled down on mobile */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] sm:w-[450px] sm:h-[450px] lg:w-[600px] lg:h-[600px] bg-primary/5 rounded-full blur-[80px] sm:blur-[100px] pointer-events-none -z-10" />

        <Outlet />
      </main>

      <SiteFooter />
    </div>
  );
}
