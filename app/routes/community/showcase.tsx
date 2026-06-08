import { CommunityHero, SectionHeader, ShowcaseCard } from "./community-components";
import { SHOWCASE_PROJECTS } from "./community-data";
import type { Route } from "./+types/showcase";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Showcase and inspiration | Kuvox" },
    {
      name: "description",
      content:
        "Explore AI-assisted video projects shared by the Kuvox creator community.",
    },
  ];
}

export default function Showcase() {
  return (
    <div className="w-full max-w-7xl mx-auto mt-4 flex flex-col gap-4">
      <CommunityHero
        eyebrow="Showcase"
        title="Study real projects made with Kuvox."
        description="Explore launch films, social series, documentaries, and repeatable workflows shared by creators using AI-assisted editing."
      />

      <section className="mt-4">
        <SectionHeader
          title="Project gallery"
          description="Filter by use case, inspect the creative approach, and borrow workflow ideas for your next edit."
        />
        <div className="flex flex-wrap gap-2 mb-5">
          {["All", "Featured", "Product Film", "Documentary", "Social Series"].map(
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {SHOWCASE_PROJECTS.map((project) => (
            <ShowcaseCard key={project.id} project={project} />
          ))}
        </div>
      </section>
    </div>
  );
}
