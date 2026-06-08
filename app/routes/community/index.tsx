import { Link } from "react-router";

import type { Route } from "./+types/index";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Community | Kuvox" },
    {
      name: "description",
      content:
        "Connect with creators, share your work, learn new techniques, and stay updated with the latest from Kuvox.",
    },
  ];
}

export default function Community() {
  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-16">
      {/* Hero Section */}
      <section className="relative hero-gradient pb-8 border-b border-outline-variant/10">
        <div className="max-w-4xl">
          <h1 className="font-display-lg text-display-lg mb-6 leading-[1.1] tracking-tight text-on-surface">
            Community
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant mb-10 max-w-2xl">
            Connect with creators, share your work, learn new techniques, and
            stay updated with the latest from Kuvox. Your gateway to
            professional AI video creation.
          </p>
          <div className="flex flex-wrap gap-4 mb-16">
            <button className="bg-primary text-on-primary px-8 py-3 rounded-xl font-headline-sm text-headline-sm hover:opacity-90 transition-all flex items-center gap-2">
              <span
                className="material-symbols-outlined"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                forum
              </span>
              Join Discussion
            </button>
            <button className="border border-outline text-on-surface px-8 py-3 rounded-xl font-headline-sm text-headline-sm hover:bg-white/5 transition-all flex items-center gap-2">
              <span className="material-symbols-outlined">upload</span>
              Share Your Project
            </button>
          </div>

          {/* Stats Bento */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-gutter">
            <div className="glass-card p-6 rounded-2xl">
              <p className="font-label-mono text-label-mono text-primary mb-2 uppercase tracking-widest">
                Active Creators
              </p>
              <p className="font-display-lg text-headline-md text-on-surface">
                12.4k+
              </p>
            </div>
            <div className="glass-card p-6 rounded-2xl">
              <p className="font-label-mono text-label-mono text-secondary mb-2 uppercase tracking-widest">
                Discussions
              </p>
              <p className="font-display-lg text-headline-md text-on-surface">
                840
              </p>
            </div>
            <div className="glass-card p-6 rounded-2xl">
              <p className="font-label-mono text-label-mono text-tertiary mb-2 uppercase tracking-widest">
                Projects Shared
              </p>
              <p className="font-display-lg text-headline-md text-on-surface">
                3.2k
              </p>
            </div>
            <div className="glass-card p-6 rounded-2xl">
              <p className="font-label-mono text-label-mono text-surface-tint mb-2 uppercase tracking-widest">
                Tutorials
              </p>
              <p className="font-display-lg text-headline-md text-on-surface">
                150+
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Community Navigation Grid */}
      <section>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter">
          <Link
            to="/community/forums"
            className="glass-card group p-8 rounded-3xl relative overflow-hidden block"
          >
            <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <span className="material-symbols-outlined text-[120px]">
                forum
              </span>
            </div>
            <span className="material-symbols-outlined text-primary text-4xl mb-6 block">
              forum
            </span>
            <h3 className="font-headline-md text-headline-md mb-2 text-on-surface">
              DISCUSSIONS
            </h3>
            <p className="text-on-surface-variant text-body-md">
              Connect and solve problems.
            </p>
          </Link>

          <Link
            to="/community/showcase"
            className="glass-card group p-8 rounded-3xl relative overflow-hidden block"
          >
            <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <span className="material-symbols-outlined text-[120px]">
                movie_filter
              </span>
            </div>
            <span className="material-symbols-outlined text-secondary text-4xl mb-6 block">
              movie_filter
            </span>
            <h3 className="font-headline-md text-headline-md mb-2 text-on-surface">
              SHOWCASE
            </h3>
            <p className="text-on-surface-variant text-body-md">
              Get inspired by the best work.
            </p>
          </Link>

          <Link
            to="/community/learn"
            className="glass-card group p-8 rounded-3xl relative overflow-hidden block"
          >
            <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <span className="material-symbols-outlined text-[120px]">
                school
              </span>
            </div>
            <span className="material-symbols-outlined text-tertiary text-4xl mb-6 block">
              school
            </span>
            <h3 className="font-headline-md text-headline-md mb-2 text-on-surface">
              LEARNING
            </h3>
            <p className="text-on-surface-variant text-body-md">
              Master the Kuvox toolset.
            </p>
          </Link>

          <Link
            to="/community/news"
            className="glass-card group p-8 rounded-3xl relative overflow-hidden block"
          >
            <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <span className="material-symbols-outlined text-[120px]">
                campaign
              </span>
            </div>
            <span className="material-symbols-outlined text-surface-tint text-4xl mb-6 block">
              campaign
            </span>
            <h3 className="font-headline-md text-headline-md mb-2 text-on-surface">
              UPDATES
            </h3>
            <p className="text-on-surface-variant text-body-md">
              Latest news and releases.
            </p>
          </Link>
        </div>
      </section>

      {/* Main Content Area: Trending Discussions & Leaderboard */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-gutter">
        {/* Trending Discussions (Left 2/3) */}
        <div className="xl:col-span-2">
          <div className="flex items-center justify-between mb-8">
            <h2 className="font-headline-md text-headline-md text-on-surface">
              Trending Discussions
            </h2>
            <Link
              to="/community/forums"
              className="text-primary font-label-mono text-label-mono hover:underline uppercase tracking-wider"
            >
              View All
            </Link>
          </div>
          <div className="space-y-4">
            {/* Discussion Item 1 */}
            <div className="glass-panel p-5 rounded-2xl flex items-center gap-6 hover:bg-surface-container-high transition-colors cursor-pointer group">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded font-bold uppercase">
                    Workflow
                  </span>
                  <span className="text-on-surface-variant text-label-mono font-label-mono">
                    Updated 2h ago
                  </span>
                </div>
                <h4 className="font-headline-sm text-headline-sm text-on-surface group-hover:text-primary transition-colors">
                  Best workflow for short-form content?
                </h4>
                <p className="text-on-surface-variant text-body-md line-clamp-1">
                  I'm struggling with efficient color grading for vertical videos. Any presets recommended?
                </p>
              </div>
              <div className="flex items-center gap-6 text-on-surface-variant">
                <div className="text-center">
                  <p className="font-headline-sm text-headline-sm text-on-surface">42</p>
                  <p className="text-[10px] uppercase font-bold tracking-tighter opacity-60">
                    Replies
                  </p>
                </div>
                <div className="text-center">
                  <p className="font-headline-sm text-headline-sm text-on-surface">1.2k</p>
                  <p className="text-[10px] uppercase font-bold tracking-tighter opacity-60">
                    Views
                  </p>
                </div>
              </div>
            </div>

            {/* Discussion Item 2 */}
            <div className="glass-panel p-5 rounded-2xl flex items-center gap-6 hover:bg-surface-container-high transition-colors cursor-pointer group">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="bg-secondary/10 text-secondary text-[10px] px-2 py-0.5 rounded font-bold uppercase">
                    AI Agent
                  </span>
                  <span className="text-on-surface-variant text-label-mono font-label-mono">
                    Updated 5h ago
                  </span>
                </div>
                <h4 className="font-headline-sm text-headline-sm text-on-surface group-hover:text-primary transition-colors">
                  AI Agent tips: Maximizing prompt precision
                </h4>
                <p className="text-on-surface-variant text-body-md line-clamp-1">
                  Testing the new agent updates and found some interesting syntax hacks.
                </p>
              </div>
              <div className="flex items-center gap-6 text-on-surface-variant">
                <div className="text-center">
                  <p className="font-headline-sm text-headline-sm text-on-surface">128</p>
                  <p className="text-[10px] uppercase font-bold tracking-tighter opacity-60">
                    Replies
                  </p>
                </div>
                <div className="text-center">
                  <p className="font-headline-sm text-headline-sm text-on-surface">4.5k</p>
                  <p className="text-[10px] uppercase font-bold tracking-tighter opacity-60">
                    Views
                  </p>
                </div>
              </div>
            </div>

            {/* Discussion Item 3 */}
            <div className="glass-panel p-5 rounded-2xl flex items-center gap-6 hover:bg-surface-container-high transition-colors cursor-pointer group">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="bg-tertiary/10 text-tertiary text-[10px] px-2 py-0.5 rounded font-bold uppercase">
                    Feature Request
                  </span>
                  <span className="text-on-surface-variant text-label-mono font-label-mono">
                    Updated 8h ago
                  </span>
                </div>
                <h4 className="font-headline-sm text-headline-sm text-on-surface group-hover:text-primary transition-colors">
                  Multiple timeline support in V2?
                </h4>
                <p className="text-on-surface-variant text-body-md line-clamp-1">
                  Would love to hear if the team is considering nested sequences or tabbed timelines.
                </p>
              </div>
              <div className="flex items-center gap-6 text-on-surface-variant">
                <div className="text-center">
                  <p className="font-headline-sm text-headline-sm text-on-surface">89</p>
                  <p className="text-[10px] uppercase font-bold tracking-tighter opacity-60">
                    Replies
                  </p>
                </div>
                <div className="text-center">
                  <p className="font-headline-sm text-headline-sm text-on-surface">3.1k</p>
                  <p className="text-[10px] uppercase font-bold tracking-tighter opacity-60">
                    Views
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Community Leaderboard (Right 1/3) */}
        <div className="xl:col-span-1">
          <div className="flex items-center justify-between mb-8">
            <h2 className="font-headline-md text-headline-md text-on-surface">
              Top Contributors
            </h2>
          </div>
          <div className="glass-panel rounded-3xl p-6 space-y-6">
            {/* User 1 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-surface-container-high border border-outline-variant/30 flex items-center justify-center font-bold text-on-surface">
                    AR
                  </div>
                  <div className="absolute -bottom-1 -right-1 bg-primary text-on-primary w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold">
                    1
                  </div>
                </div>
                <div>
                  <p className="font-headline-sm text-body-md font-bold text-on-surface">
                    Alex Rivera
                  </p>
                  <p className="text-on-surface-variant text-label-mono">
                    542 Contributions
                  </p>
                </div>
              </div>
              <span
                className="material-symbols-outlined text-primary"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                stars
              </span>
            </div>

            {/* User 2 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-surface-container-high border border-outline-variant/30 flex items-center justify-center font-bold text-on-surface">
                    SC
                  </div>
                  <div className="absolute -bottom-1 -right-1 bg-outline-variant text-on-surface w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold">
                    2
                  </div>
                </div>
                <div>
                  <p className="font-headline-sm text-body-md font-bold text-on-surface">
                    Sarah Chen
                  </p>
                  <p className="text-on-surface-variant text-label-mono">
                    381 Contributions
                  </p>
                </div>
              </div>
              <span className="material-symbols-outlined text-on-surface-variant">
                verified
              </span>
            </div>

            {/* User 3 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-surface-container-high border border-outline-variant/30 flex items-center justify-center font-bold text-on-surface">
                    MT
                  </div>
                  <div className="absolute -bottom-1 -right-1 bg-outline-variant text-on-surface w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold">
                    3
                  </div>
                </div>
                <div>
                  <p className="font-headline-sm text-body-md font-bold text-on-surface">
                    Marcus Thorne
                  </p>
                  <p className="text-on-surface-variant text-label-mono">
                    295 Contributions
                  </p>
                </div>
              </div>
              <span className="material-symbols-outlined text-on-surface-variant">
                workspace_premium
              </span>
            </div>

            <button className="w-full py-3 mt-4 border border-outline-variant/30 rounded-xl font-label-mono text-label-mono text-on-surface uppercase tracking-widest hover:bg-white/5 transition-colors">
              View All Leaders
            </button>
          </div>
        </div>
      </section>

      {/* Creator Showcase Section */}
      <section>
        <div className="flex items-end justify-between mb-12">
          <div>
            <h2 className="font-headline-md text-headline-md mb-2 text-on-surface">
              Creator Showcase
            </h2>
            <p className="text-on-surface-variant">Projects made with Kuvox AI</p>
          </div>
          <div className="flex gap-2">
            <button className="bg-surface-container-high text-on-surface-variant p-2 rounded-lg hover:bg-surface-container-highest transition-colors">
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            <button className="bg-surface-container-high text-on-surface-variant p-2 rounded-lg hover:bg-surface-container-highest transition-colors">
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
          {/* Showcase Card 1 */}
          <Link to="/community/showcase" className="group cursor-pointer block">
            <div className="relative aspect-video rounded-2xl overflow-hidden mb-4 bg-surface-container border border-outline-variant/10">
              {/* Project Thumbnail Placeholder */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-surface-container to-secondary/20 group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute inset-0 flex items-center justify-center opacity-30">
                <span className="material-symbols-outlined text-6xl text-on-surface">video_file</span>
              </div>

              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-6">
                <button className="bg-white/20 backdrop-blur-md text-white p-3 rounded-full flex items-center justify-center">
                  <span
                    className="material-symbols-outlined"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    play_arrow
                  </span>
                </button>
              </div>
              <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full text-label-mono text-[10px] text-white">
                REEL
              </div>
            </div>
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-headline-sm text-body-lg font-bold text-on-surface group-hover:text-primary transition-colors">
                  Cyberpunk Atmosphere Vol 1
                </h4>
                <p className="text-on-surface-variant text-label-mono mt-1">
                  by @luna_designs
                </p>
              </div>
              <div className="flex items-center gap-3 text-on-surface-variant text-label-mono mt-1">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">
                    favorite
                  </span>{" "}
                  842
                </span>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">
                    visibility
                  </span>{" "}
                  2.4k
                </span>
              </div>
            </div>
          </Link>

          {/* Showcase Card 2 */}
          <Link to="/community/showcase" className="group cursor-pointer block">
            <div className="relative aspect-video rounded-2xl overflow-hidden mb-4 bg-surface-container border border-outline-variant/10">
              {/* Project Thumbnail Placeholder */}
              <div className="absolute inset-0 bg-gradient-to-br from-secondary/20 via-surface-container to-tertiary/20 group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute inset-0 flex items-center justify-center opacity-30">
                <span className="material-symbols-outlined text-6xl text-on-surface">motion_photos_auto</span>
              </div>

              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-6">
                <button className="bg-white/20 backdrop-blur-md text-white p-3 rounded-full flex items-center justify-center">
                  <span
                    className="material-symbols-outlined"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    play_arrow
                  </span>
                </button>
              </div>
              <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full text-label-mono text-[10px] text-white">
                MUSIC VIDEO
              </div>
            </div>
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-headline-sm text-body-lg font-bold text-on-surface group-hover:text-primary transition-colors">
                  Abstract Motion Study
                </h4>
                <p className="text-on-surface-variant text-label-mono mt-1">
                  by @motion_lab
                </p>
              </div>
              <div className="flex items-center gap-3 text-on-surface-variant text-label-mono mt-1">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">
                    favorite
                  </span>{" "}
                  1.2k
                </span>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">
                    visibility
                  </span>{" "}
                  5.1k
                </span>
              </div>
            </div>
          </Link>

          {/* Showcase Card 3 */}
          <Link to="/community/showcase" className="group cursor-pointer block">
            <div className="relative aspect-video rounded-2xl overflow-hidden mb-4 bg-surface-container border border-outline-variant/10">
              {/* Project Thumbnail Placeholder */}
              <div className="absolute inset-0 bg-gradient-to-br from-tertiary/20 via-surface-container to-primary/20 group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute inset-0 flex items-center justify-center opacity-30">
                <span className="material-symbols-outlined text-6xl text-on-surface">architecture</span>
              </div>

              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-6">
                <button className="bg-white/20 backdrop-blur-md text-white p-3 rounded-full flex items-center justify-center">
                  <span
                    className="material-symbols-outlined"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    play_arrow
                  </span>
                </button>
              </div>
              <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full text-label-mono text-[10px] text-white">
                COMMERCIAL
              </div>
            </div>
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-headline-sm text-body-lg font-bold text-on-surface group-hover:text-primary transition-colors">
                  Minimalist Living Concepts
                </h4>
                <p className="text-on-surface-variant text-label-mono mt-1">
                  by @spatial_arch
                </p>
              </div>
              <div className="flex items-center gap-3 text-on-surface-variant text-label-mono mt-1">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">
                    favorite
                  </span>{" "}
                  560
                </span>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">
                    visibility
                  </span>{" "}
                  1.8k
                </span>
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* Learning Center Section */}
      <section>
        <h2 className="font-headline-md text-headline-md text-on-surface mb-8">
          Learning Center
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
          {/* Tutorial Card 1 */}
          <Link
            to="/community/learn"
            className="glass-card flex flex-col sm:flex-row rounded-3xl overflow-hidden group border border-outline-variant/20 hover:border-primary/50 transition-colors"
          >
            <div className="w-full sm:w-48 relative overflow-hidden bg-surface-container">
              {/* Project Thumbnail Placeholder */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-surface-container group-hover:scale-110 transition-transform duration-500" />
              <div className="absolute inset-0 flex items-center justify-center opacity-30">
                <span className="material-symbols-outlined text-5xl text-on-surface">tune</span>
              </div>

              <div className="absolute inset-0 bg-primary/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="material-symbols-outlined text-4xl text-white">
                  school
                </span>
              </div>
            </div>
            <div className="p-6 flex-1 flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-3">
                <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                  Beginner
                </span>
                <span className="text-on-surface-variant text-label-mono font-label-mono flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">
                    schedule
                  </span>{" "}
                  15 mins
                </span>
              </div>
              <h4 className="font-headline-sm text-headline-sm text-on-surface mb-2 group-hover:text-primary transition-colors">
                Kuvox AI: Beginner's Guide
              </h4>
              <p className="text-on-surface-variant text-body-md mb-4">
                Learn the basics of the timeline, asset library, and your first
                AI render.
              </p>
              <div className="text-primary font-bold text-label-mono uppercase flex items-center gap-2 group-hover:translate-x-1 transition-transform">
                Start Learning{" "}
                <span className="material-symbols-outlined text-sm">
                  arrow_forward
                </span>
              </div>
            </div>
          </Link>

          {/* Tutorial Card 2 */}
          <Link
            to="/community/learn"
            className="glass-card flex flex-col sm:flex-row rounded-3xl overflow-hidden group border border-outline-variant/20 hover:border-secondary/50 transition-colors"
          >
            <div className="w-full sm:w-48 relative overflow-hidden bg-surface-container">
              {/* Project Thumbnail Placeholder */}
              <div className="absolute inset-0 bg-gradient-to-br from-secondary/10 to-surface-container group-hover:scale-110 transition-transform duration-500" />
              <div className="absolute inset-0 flex items-center justify-center opacity-30">
                <span className="material-symbols-outlined text-5xl text-on-surface">smart_toy</span>
              </div>

              <div className="absolute inset-0 bg-secondary/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="material-symbols-outlined text-4xl text-white">
                  psychology
                </span>
              </div>
            </div>
            <div className="p-6 flex-1 flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-3">
                <span className="bg-secondary/10 text-secondary text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                  Advanced
                </span>
                <span className="text-on-surface-variant text-label-mono font-label-mono flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">
                    schedule
                  </span>{" "}
                  45 mins
                </span>
              </div>
              <h4 className="font-headline-sm text-headline-sm text-on-surface mb-2 group-hover:text-secondary transition-colors">
                AI Agent Masterclass
              </h4>
              <p className="text-on-surface-variant text-body-md mb-4">
                Deep dive into custom agent scripting and automated
                post-production pipelines.
              </p>
              <div className="text-secondary font-bold text-label-mono uppercase flex items-center gap-2 group-hover:translate-x-1 transition-transform">
                Start Learning{" "}
                <span className="material-symbols-outlined text-sm">
                  arrow_forward
                </span>
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* News & Announcements */}
      <section>
        <h2 className="font-headline-md text-headline-md text-on-surface mb-8">
          News & Announcements
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-gutter">
          <div className="glass-panel p-8 rounded-3xl border-l-4 border-l-primary flex flex-col sm:flex-row items-start gap-6">
            <div className="bg-primary/10 p-3 rounded-2xl text-primary shrink-0">
              <span className="material-symbols-outlined text-3xl">
                rocket_launch
              </span>
            </div>
            <div>
              <span className="text-on-surface-variant text-label-mono mb-2 block uppercase font-bold tracking-widest">
                New Release
              </span>
              <h3 className="font-headline-md text-headline-md text-on-surface mb-4">
                New AI Features: Real-time Roto and Deep Depth
              </h3>
              <p className="text-on-surface-variant text-body-md mb-6">
                We've just rolled out two of our most requested features. See how
                these tools will revolutionize your VFX workflow.
              </p>
              <Link
                to="/community/news"
                className="inline-block bg-surface-container-high hover:bg-surface-container-highest text-on-surface px-6 py-2 rounded-xl transition-colors font-label-mono text-label-mono uppercase"
              >
                Read More
              </Link>
            </div>
          </div>

          <div className="glass-panel p-8 rounded-3xl border-l-4 border-l-secondary flex flex-col sm:flex-row items-start gap-6">
            <div className="bg-secondary/10 p-3 rounded-2xl text-secondary shrink-0">
              <span className="material-symbols-outlined text-3xl">
                construction
              </span>
            </div>
            <div>
              <span className="text-on-surface-variant text-label-mono mb-2 block uppercase font-bold tracking-widest">
                Update
              </span>
              <h3 className="font-headline-md text-headline-md text-on-surface mb-4">
                Platform Improvements: V2.4 Performance Patch
              </h3>
              <p className="text-on-surface-variant text-body-md mb-6">
                Significant rendering speed improvements for Windows and MacOS.
                Native Apple Silicon optimization is now at 100%.
              </p>
              <Link
                to="/community/news"
                className="inline-block bg-surface-container-high hover:bg-surface-container-highest text-on-surface px-6 py-2 rounded-xl transition-colors font-label-mono text-label-mono uppercase"
              >
                Changelog
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Guidelines Section */}
      <section className="border-t border-outline-variant/10 pt-16">
        <div className="glass-card p-10 rounded-[40px] max-w-5xl mx-auto text-center border-outline-variant/20">
          <h2 className="font-headline-md text-headline-md text-on-surface mb-8">
            Community Guidelines
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <span className="material-symbols-outlined text-primary mb-3 text-3xl">
                volunteer_activism
              </span>
              <h4 className="font-bold text-body-md text-on-surface mb-1">Respect</h4>
              <p className="text-on-surface-variant text-label-mono">
                Support each other's creative journey.
              </p>
            </div>
            <div>
              <span className="material-symbols-outlined text-secondary mb-3 text-3xl">
                share
              </span>
              <h4 className="font-bold text-body-md text-on-surface mb-1">Share</h4>
              <p className="text-on-surface-variant text-label-mono">
                Help the community grow by sharing knowledge.
              </p>
            </div>
            <div>
              <span className="material-symbols-outlined text-tertiary mb-3 text-3xl">
                rate_review
              </span>
              <h4 className="font-bold text-body-md text-on-surface mb-1">Feedback</h4>
              <p className="text-on-surface-variant text-label-mono">
                Provide constructive and honest critiques.
              </p>
            </div>
            <div>
              <span className="material-symbols-outlined text-surface-tint mb-3 text-3xl">
                policy
              </span>
              <h4 className="font-bold text-body-md text-on-surface mb-1">Policies</h4>
              <p className="text-on-surface-variant text-label-mono">
                Keep it professional and original.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="text-center pb-8">
        <h2 className="font-display-lg text-display-lg text-on-surface mb-6 tracking-tight">
          Join thousands of creators <br />
          building with Kuvox
        </h2>
        <p className="text-on-surface-variant text-body-lg mb-12 max-w-2xl mx-auto">
          Access the world's most advanced AI video editing community and
          elevate your projects to cinema standards.
        </p>
        <button className="bg-primary text-on-primary px-10 py-4 rounded-2xl font-headline-md text-headline-md hover:scale-105 active:scale-95 transition-all shadow-xl shadow-primary/20">
          Create Free Account
        </button>
      </section>
    </div>
  );
}
