import {
  CommunityHero,
  SectionHeader,
  ThreadCard,
} from "./community-components";
import { FORUM_CATEGORIES, FORUM_THREADS } from "./community-data";
import type { Route } from "./+types/forums";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Discussion forums | Kuvox" },
    {
      name: "description",
      content:
        "Browse Kuvox community discussions about AI editing workflows, prompts, product feedback, and team collaboration.",
    },
  ];
}

export default function Forums() {
  const popularThreads = FORUM_THREADS.filter((thread) => thread.popular);

  return (
    <div className="w-full max-w-7xl mx-auto mt-4 flex flex-col gap-4">
      <CommunityHero
        eyebrow="Discussion forums"
        title="Get answers from editors, creators, and the Kuvox team."
        description="Browse practical discussions about prompts, audio cleanup, social exports, workspace setup, and collaboration workflows."
      />

      <section id="discussion-forum" className="scroll-mt-24 mt-4">
        <SectionHeader
          title="Forum categories"
          description="Navigate through specialized zones: from AI agent scripting and advanced color grading, to hardware setups and collaborative workflows."
          action={{ label: "View all categories", to: "/community/forums#categories" }}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {FORUM_CATEGORIES.map((category) => (
            <article
              key={category.id}
              className={`bg-surface-container-lowest border ${category.accent} rounded-xl p-5 sm:p-6`}
            >
              <div className="flex items-start gap-4">
                <span className="material-symbols-outlined text-primary text-3xl">
                  {category.icon}
                </span>
                <div>
                  <h2 className="text-headline-md font-semibold text-on-surface">
                    {category.title}
                  </h2>
                  <p className="mt-2 text-body-sm text-on-surface-variant">
                    {category.description}
                  </p>
                  <div className="mt-4 flex gap-4 text-label-md text-on-surface-variant">
                    <span>{category.threads} threads</span>
                    <span>{category.posts} posts</span>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="popular-discussions" className="scroll-mt-24 mt-4">
        <SectionHeader
          title="Popular discussions"
          description="Dive into our most upvoted threads, featuring masterclass prompt engineering techniques and deeply technical VFX breakdowns."
          action={{ label: "Browse trending", to: "/community/forums?sort=popular" }}
        />
        <div className="grid grid-cols-1 gap-3 sm:gap-4">
          {popularThreads.map((thread) => (
            <ThreadCard key={thread.id} thread={thread} />
          ))}
        </div>
      </section>

      <section className="mt-4">
        <SectionHeader
          title="Recent threads"
          description="Join the ongoing conversations. Help fellow creators troubleshoot timeline issues or share your latest project exports."
          action={{ label: "Start new thread", to: "/community/forums/new" }}
        />
        <div className="flex flex-wrap gap-2 mb-5">
          {["All", "Help", "AI Editing", "Feedback", "Announcements"].map(
            (filter) => (
              <span
                key={filter}
                className="px-3 py-1.5 rounded-full bg-surface-container text-label-md font-semibold text-on-surface-variant"
              >
                {filter}
              </span>
            ),
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:gap-4">
          {FORUM_THREADS.map((thread) => (
            <ThreadCard key={thread.id} thread={thread} />
          ))}
        </div>
      </section>
    </div>
  );
}
