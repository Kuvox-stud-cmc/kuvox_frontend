import { Link } from "react-router";

import { NotFoundPanel, Tag } from "./community-components";
import { FORUM_THREADS, getThread } from "./community-data";
import type { Route } from "./+types/thread";

export function meta({ params }: Route.MetaArgs) {
  const thread = getThread(params.threadId);

  return [
    { title: `${thread?.title ?? "Thread"} | Kuvox` },
    {
      name: "description",
      content:
        thread?.excerpt ??
        "Read a Kuvox community discussion about AI-assisted video editing.",
    },
  ];
}

export default function Thread({ params }: Route.ComponentProps) {
  const thread = getThread(params.threadId);
  const related = FORUM_THREADS.filter((item) => item.id !== params.threadId).slice(
    0,
    2,
  );

  if (!thread) {
    return (
      <NotFoundPanel
        title="Thread not found"
        description="This discussion may have moved, or the link may be incorrect."
        to="/community/forums"
        action="Back to forums"
      />
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto mt-4 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
      <article className="min-w-0">
        <Link
          to="/community/forums"
          className="inline-flex items-center gap-2 text-body-sm text-primary hover:underline mb-6"
        >
          <span className="material-symbols-outlined text-[18px]">
            arrow_back
          </span>
          Back to forums
        </Link>

        <header className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="text-label-md font-semibold text-primary">
              {thread.category}
            </span>
            {thread.solved && (
              <span className="inline-flex items-center gap-1 text-label-sm font-semibold text-on-surface bg-primary/15 px-2 py-1 rounded-full">
                <span className="material-symbols-outlined text-[15px]">
                  check_circle
                </span>
                Solved
              </span>
            )}
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold text-on-surface tracking-tight">
            {thread.title}
          </h1>
          <p className="mt-4 text-body-lg text-on-surface-variant">
            {thread.excerpt}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {thread.tags.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </div>
        </header>

        <div className="mt-4 grid grid-cols-1 gap-4">
          {thread.posts.map((post) => (
            <section
              key={`${post.author}-${post.time}`}
              className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 sm:p-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                <div>
                  <h2 className="text-body-lg font-semibold text-on-surface">
                    {post.author}
                  </h2>
                  <p className="text-label-md text-on-surface-variant">
                    {post.role}
                  </p>
                </div>
                <span className="text-label-md text-on-surface-variant">
                  {post.time}
                </span>
              </div>
              <p className="text-body-sm sm:text-body-lg text-on-surface-variant">
                {post.content}
              </p>
            </section>
          ))}
        </div>
      </article>

      <aside className="space-y-4 lg:sticky lg:top-24 self-start">
        <section className="mt-4 bg-surface-container-lowest border border-outline-variant rounded-xl p-5">
          <h2 className="text-headline-md font-semibold text-on-surface">
            Thread stats
          </h2>
          <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div>
              <dt className="text-label-sm text-on-surface-variant">Replies</dt>
              <dd className="text-body-lg font-semibold text-on-surface">
                {thread.replies}
              </dd>
            </div>
            <div>
              <dt className="text-label-sm text-on-surface-variant">Views</dt>
              <dd className="text-body-lg font-semibold text-on-surface">
                {thread.views}
              </dd>
            </div>
            <div>
              <dt className="text-label-sm text-on-surface-variant">Active</dt>
              <dd className="text-body-lg font-semibold text-on-surface">
                {thread.lastActive}
              </dd>
            </div>
          </dl>
        </section>

        <section className="mt-4 bg-surface-container-lowest border border-outline-variant rounded-xl p-5">
          <h2 className="text-headline-md font-semibold text-on-surface">
            Related threads
          </h2>
          <div className="mt-4 space-y-3">
            {related.map((item) => (
              <Link
                key={item.id}
                to={`/community/forums/${item.id}`}
                className="block rounded-lg border border-outline-variant bg-surface-container p-4 hover:border-primary/50 transition-colors"
              >
                <span className="text-label-md font-semibold text-primary">
                  {item.category}
                </span>
                <h3 className="mt-2 text-body-sm font-semibold text-on-surface">
                  {item.title}
                </h3>
              </Link>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
