import { Link } from "react-router";

import { NotFoundPanel, ShowcaseCard, Tag } from "./community-components";
import { SHOWCASE_PROJECTS, getShowcaseProject } from "./community-data";
import type { Route } from "./+types/showcase-detail";

export function meta({ params }: Route.MetaArgs) {
  const project = getShowcaseProject(params.showcaseId);

  return [
    { title: `${project?.title ?? "Showcase"} | Kuvox` },
    {
      name: "description",
      content:
        project?.description ??
        "Explore a project shared by the Kuvox creator community.",
    },
  ];
}

export default function ShowcaseDetail({ params }: Route.ComponentProps) {
  const project = getShowcaseProject(params.showcaseId);

  if (!project) {
    return (
      <NotFoundPanel
        title="Showcase project not found"
        description="This project may have been removed, or the showcase link may be incorrect."
        to="/community/showcase"
        action="Back to showcase"
      />
    );
  }

  const related = SHOWCASE_PROJECTS.filter((item) => item.id !== project.id).slice(
    0,
    2,
  );

  return (
    <div className="w-full max-w-7xl mx-auto mt-4 flex flex-col gap-4">
      <Link
        to="/community/showcase"
        className="inline-flex items-center gap-2 text-body-sm text-primary hover:underline self-start"
      >
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Back to showcase
      </Link>

      <section className="mt-4 grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6 lg:gap-8 items-center">
        <div className="aspect-video bg-surface-container border border-outline-variant rounded-xl overflow-hidden relative">
          <img
            src={project.image}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-70"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-surface/75 to-transparent" />
        </div>

        <div>
          <span className="text-primary text-label-md font-semibold uppercase tracking-widest">
            {project.category}
          </span>
          <h1 className="mt-3 text-3xl sm:text-4xl lg:text-display font-semibold text-on-surface tracking-tight">
            {project.title}
          </h1>
          <p className="mt-4 text-body-lg text-on-surface-variant">
            {project.description}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {project.tags.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </div>
          <div className="mt-6 grid grid-cols-3 gap-3 text-center">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4">
              <div className="text-body-lg font-semibold text-on-surface">
                {project.creator}
              </div>
              <div className="text-label-sm text-on-surface-variant">
                Creator
              </div>
            </div>
            <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4">
              <div className="text-body-lg font-semibold text-on-surface">
                {project.likes}
              </div>
              <div className="text-label-sm text-on-surface-variant">Likes</div>
            </div>
            <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4">
              <div className="text-body-lg font-semibold text-on-surface">
                {project.views}
              </div>
              <div className="text-label-sm text-on-surface-variant">Views</div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-4 bg-surface-container-lowest border border-outline-variant rounded-xl p-6 sm:p-8">
        <h2 className="text-headline-lg-mobile sm:text-headline-lg font-semibold text-on-surface">
          Workflow highlights
        </h2>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
          {project.highlights.map((highlight, index) => (
            <div
              key={highlight}
              className="bg-surface-container border border-outline-variant rounded-lg p-4"
            >
              <span className="text-primary text-label-md font-semibold">
                {String(index + 1).padStart(2, "0")}
              </span>
              <p className="mt-3 text-body-sm text-on-surface-variant">
                {highlight}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-4">
        <div className="flex items-end justify-between mb-6">
          <h2 className="text-headline-lg-mobile sm:text-headline-lg font-semibold text-on-surface">
            Related showcases
          </h2>
          <Link
            to="/community/showcase"
            className="hidden sm:inline-flex text-body-sm text-primary hover:underline"
          >
            View all
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {related.map((item) => (
            <ShowcaseCard key={item.id} project={item} />
          ))}
        </div>
      </section>
    </div>
  );
}
