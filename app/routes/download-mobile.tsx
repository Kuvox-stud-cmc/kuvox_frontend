import type { Route } from "./+types/home";

export function meta(_: Route.MetaArgs) {
    return [
        { title: "Kuvox — Download Mobile App" },
        {
            name: "description",
            content:
                "Review footage, accept smart suggestions, and make light edits wherever you are — the perfect companion to the Kuvox desktop editor.",
        },
    ];
}

/* ── Feature data ────────────────────────────────────────────────────────── */
const FEATURES = [
    {
        icon: "play_circle",
        title: "Review Anywhere",
        description:
            "Instantly access your desktop projects and playback footage on the go.",
    },
    {
        icon: "auto_awesome",
        title: "Smart Suggestions",
        description:
            "Receive and approve AI-driven edit suggestions from your mobile device.",
    },
    {
        icon: "sync",
        title: "Seamless Sync",
        description:
            "Every change you make on mobile syncs perfectly with your desktop workspace.",
    },
] as const;

export default function DownloadMobile() {
    return (
        <div className="w-full max-w-7xl mx-auto flex flex-col gap-16 sm:gap-20 lg:gap-24">
            {/* ── Hero Section ───────────────────────────────────────────────── */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-16 items-center animate-fade-in-up">
                {/* Left – Copy */}
                <div className="flex flex-col gap-5 sm:gap-6 text-center md:text-left">
                    <h1 className="text-3xl sm:text-4xl lg:text-display font-semibold text-on-surface tracking-tight leading-tight">
                        Kuvox for Mobile:
                        <br />
                        Your Creative Companion
                    </h1>

                    <p className="text-body-lg text-on-surface-variant max-w-lg mx-auto md:mx-0">
                        Now rolling out. Review footage, accept smart suggestions, and make
                        light edits wherever you are — a perfect companion to the Kuvox
                        desktop editor.
                    </p>

                    {/* Store badges */}
                    <div className="flex flex-col gap-3 mt-2">
                        <div className="flex gap-3 sm:gap-4 justify-center md:justify-start">
                            <a
                                href="#"
                                className="group h-12 sm:h-14 px-5 sm:px-6 bg-surface-container-lowest border border-outline-variant rounded-xl flex items-center gap-2.5 hover:border-primary/60 hover:shadow-[0_0_20px_rgba(192,193,255,0.12)] transition-all duration-300"
                            >
                                <span className="material-symbols-outlined text-on-surface text-[22px] group-hover:text-primary transition-colors duration-300">
                                    phone_iphone
                                </span>
                                <div className="flex flex-col">
                                    <span className="text-[10px] leading-none text-on-surface-variant font-medium">
                                        Download on the
                                    </span>
                                    <span className="text-body-sm font-semibold text-on-surface leading-tight">
                                        App Store
                                    </span>
                                </div>
                            </a>

                            <a
                                href="#"
                                className="group h-12 sm:h-14 px-5 sm:px-6 bg-surface-container-lowest border border-outline-variant rounded-xl flex items-center gap-2.5 hover:border-primary/60 hover:shadow-[0_0_20px_rgba(192,193,255,0.12)] transition-all duration-300"
                            >
                                <span className="material-symbols-outlined text-on-surface text-[22px] group-hover:text-primary transition-colors duration-300">
                                    shop
                                </span>
                                <div className="flex flex-col">
                                    <span className="text-[10px] leading-none text-on-surface-variant font-medium">
                                        Get it on
                                    </span>
                                    <span className="text-body-sm font-semibold text-on-surface leading-tight">
                                        Google Play
                                    </span>
                                </div>
                            </a>
                        </div>

                        <p className="text-label-md text-outline text-center md:text-left">
                            Available on iOS 16+ and Android 10+.
                        </p>
                    </div>
                </div>

                {/* Right – Phone Mockup */}
                <div className="relative flex justify-center md:justify-end">
                    <div className="w-full max-w-sm rounded-2xl overflow-hidden border border-outline-variant bg-surface-container shadow-2xl animate-float">
                        <img
                            alt="Kuvox Mobile App — Video editing interface"
                            className="w-full h-auto object-cover block"
                            src="/images/mobile-app-mockup.png"
                        />
                    </div>

                    {/* Glow behind phone */}
                    <div className="absolute inset-0 bg-primary/6 blur-[80px] -z-10 rounded-full w-3/4 h-3/4 mx-auto my-auto pointer-events-none" />
                </div>
            </section>

            {/* ── Features Grid ──────────────────────────────────────────────── */}
            <section
                className="animate-fade-in-up"
                style={{ animationDelay: "0.15s" }}
            >
                <div className="border-t border-outline-variant/60 pt-10 sm:pt-12 lg:pt-16">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-element-gap">
                        {FEATURES.map((feature) => (
                            <div
                                key={feature.title}
                                className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 sm:p-6 lg:p-8 flex flex-col group hover:border-primary/50 transition-colors duration-300"
                            >
                                {/* Icon */}
                                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-surface-container-high flex items-center justify-center mb-4 sm:mb-6">
                                    <span className="material-symbols-outlined text-primary text-[20px] sm:text-[24px]">
                                        {feature.icon}
                                    </span>
                                </div>

                                {/* Title & Description */}
                                <h3 className="text-body-lg sm:text-headline-md font-medium text-on-surface mb-2 sm:mb-3">
                                    {feature.title}
                                </h3>
                                <p className="text-body-sm sm:text-body-lg text-on-surface-variant">
                                    {feature.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Scan to Download ───────────────────────────────────────────── */}
            <section
                className="animate-fade-in-up"
                style={{ animationDelay: "0.3s" }}
            >
                <div className="flex flex-col md:flex-row items-center justify-center gap-8 sm:gap-10 lg:gap-14 py-10 sm:py-14 lg:py-16 px-6 sm:px-10 lg:px-16 bg-surface-container-lowest rounded-2xl border border-outline-variant">
                    {/* QR Code */}
                    <div className="p-3 sm:p-4 bg-surface-container rounded-xl border border-outline-variant/60 shadow-lg shrink-0 group">
                        <img
                            alt="QR Code — Scan to download Kuvox mobile app"
                            className="w-36 h-36 sm:w-44 sm:h-44 lg:w-48 lg:h-48 rounded-lg object-cover group-hover:scale-105 transition-transform duration-300"
                            src="/images/qr-download.png"
                        />
                    </div>

                    {/* Copy */}
                    <div className="max-w-md text-center md:text-left flex flex-col gap-3 sm:gap-4">
                        <h2 className="text-headline-lg-mobile sm:text-headline-lg font-semibold text-on-surface tracking-tight">
                            Scan to Download
                        </h2>
                        <p className="text-body-lg text-on-surface-variant">
                            Scan this QR code with your phone camera to go straight to the app
                            store for your device.
                        </p>

                        <div className="mt-1 flex items-center justify-center md:justify-start text-primary gap-2">
                            <span className="material-symbols-outlined text-[18px]">
                                qr_code_scanner
                            </span>
                            <span className="text-label-md font-semibold tracking-wide">
                                Ready to scan
                            </span>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}