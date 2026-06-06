import { Link } from "react-router";

import type {
  ForumThread,
  LearningResource,
  NewsPost,
  ShowcaseProject,
} from "./community-data";

export function CommunityHero({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="w-full text-center">
      <span className="text-primary text-label-md font-semibold uppercase tracking-widest">
        {eyebrow}
      </span>
      <h1 className="mt-3 text-3xl sm:text-4xl lg:text-display font-semibold text-on-surface tracking-tight">
        {title}
      </h1>
      <p className="mt-4 text-body-lg text-on-surface-variant max-w-2xl mx-auto">
        {description}
      </p>
      {children}
    </section>
  );
}

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: { label: string; to: string };
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
      <div>
        <h2 className="text-headline-lg-mobile sm:text-headline-lg font-semibold text-on-surface tracking-tight">
          {title}
        </h2>
        {description && (
          <p className="mt-2 text-body-sm text-on-surface-variant max-w-2xl">
            {description}
          </p>
        )}
      </div>
      {action && (
        <Link
          to={action.to}
          className="inline-flex items-center gap-2 text-body-sm text-primary hover:underline"
        >
          {action.label}
          <span className="material-symbols-outlined text-[18px]">
            arrow_forward
          </span>
        </Link>
      )}
    </div>
  );
}

export function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-2.5 py-1 rounded-full bg-surface-container text-label-sm font-semibold text-on-surface-variant">
      {children}
    </span>
  );
}

export function ThreadCard({ thread }: { thread: ForumThread }) {
  return (
    <Link
      to={`/community/forums/${thread.id}`}
      className="block bg-surface-container-lowest border border-outline-variant rounded-xl p-5 sm:p-6 hover:border-primary/50 hover:bg-surface-container-low transition-colors"
    >
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-3">
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
          <h3 className="text-headline-md font-semibold text-on-surface">
            {thread.title}
          </h3>
          <p className="mt-2 text-body-sm text-on-surface-variant">
            {thread.excerpt}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center lg:min-w-56">
          <MetaStat label="Replies" value={String(thread.replies)} />
          <MetaStat label="Views" value={thread.views} />
          <MetaStat label="Active" value={thread.lastActive} />
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {thread.tags.map((tag) => (
          <Tag key={tag}>{tag}</Tag>
        ))}
      </div>
    </Link>
  );
}

export function ShowcaseCard({ project }: { project: ShowcaseProject }) {
  return (
    <Link
      to={`/community/showcase/${project.id}`}
      className="group block bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden hover:border-primary/50 transition-colors"
    >
      <div className="aspect-video bg-surface-container relative overflow-hidden">
        <img
          src={project.image}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-65 group-hover:scale-105 transition-transform duration-300"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-surface/80 to-transparent" />
        {project.featured && (
          <span className="absolute top-3 left-3 bg-primary text-on-primary text-label-sm font-semibold px-2.5 py-1 rounded-full">
            Featured
          </span>
        )}
      </div>
      <div className="p-5">
        <span className="text-label-md font-semibold text-primary">
          {project.category}
        </span>
        <h3 className="mt-2 text-headline-md font-semibold text-on-surface">
          {project.title}
        </h3>
        <p className="mt-2 text-body-sm text-on-surface-variant">
          {project.description}
        </p>
        <div className="mt-4 flex items-center justify-between text-label-md text-on-surface-variant">
          <span>{project.creator}</span>
          <span>
            {project.likes} likes | {project.views} views
          </span>
        </div>
      </div>
    </Link>
  );
}

export function LearningCard({ resource }: { resource: LearningResource }) {
  return (
    <article className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <span className="material-symbols-outlined text-primary text-3xl">
          {resource.icon}
        </span>
        <span className="text-label-sm font-semibold text-on-surface-variant bg-surface-container px-2 py-1 rounded-full">
          {resource.level}
        </span>
      </div>
      <h3 className="mt-5 text-headline-md font-semibold text-on-surface">
        {resource.title}
      </h3>
      <p className="mt-2 text-body-sm text-on-surface-variant">
        {resource.description}
      </p>
      <div className="mt-5 flex items-center justify-between text-label-md text-on-surface-variant">
        <span>{resource.category}</span>
        <span>{resource.duration}</span>
      </div>
    </article>
  );
}

export function NewsCard({ post }: { post: NewsPost }) {
  return (
    <article
      className={`border border-outline-variant rounded-xl p-5 sm:p-6 ${
        post.featured
          ? "bg-primary-container/20"
          : "bg-surface-container-lowest"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2 text-label-md">
        <span className="text-primary font-semibold">{post.category}</span>
        <span className="text-on-surface-variant">|</span>
        <span className="text-on-surface-variant">{post.date}</span>
        <span className="text-on-surface-variant">|</span>
        <span className="text-on-surface-variant">{post.readTime}</span>
      </div>
      <h3 className="mt-3 text-headline-md font-semibold text-on-surface">
        {post.title}
      </h3>
      <p className="mt-2 text-body-sm text-on-surface-variant">
        {post.excerpt}
      </p>
    </article>
  );
}

export function MetaStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-body-sm font-semibold text-on-surface">{value}</div>
      <div className="text-label-sm text-on-surface-variant">{label}</div>
    </div>
  );
}

export function NotFoundPanel({
  title,
  description,
  to,
  action,
}: {
  title: string;
  description: string;
  to: string;
  action: string;
}) {
  return (
    <section className="w-full max-w-2xl mx-auto text-center bg-surface-container-lowest border border-outline-variant rounded-xl p-8 sm:p-10">
      <span className="material-symbols-outlined text-primary text-4xl">
        search_off
      </span>
      <h1 className="mt-4 text-2xl font-semibold text-on-surface">{title}</h1>
      <p className="mt-2 text-body-sm text-on-surface-variant">
        {description}
      </p>
      <Link
        to={to}
        className="mt-6 inline-flex bg-primary text-on-primary px-4 py-2 rounded-lg text-label-md font-medium hover:bg-primary-fixed transition-colors"
      >
        {action}
      </Link>
    </section>
  );
}
