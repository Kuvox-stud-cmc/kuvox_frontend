import { CommunityHero, LearningCard, SectionHeader } from "./community-components";
import { LEARNING_RESOURCES } from "./community-data";
import type { Route } from "./+types/learn";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Learning and tutorials | Kuvox" },
    {
      name: "description",
      content:
        "Learn AI video editing workflows with Kuvox tutorials, prompts, and practical production guides.",
    },
  ];
}

export default function Learn() {
  return (
    <div className="w-full max-w-7xl mx-auto mt-4 flex flex-col gap-4">
      <CommunityHero
        eyebrow="Learning"
        title="Build repeatable AI editing workflows."
        description="Follow focused tutorials that move from first project setup to advanced batch workflows for social, documentary, and product teams."
      />

      <section className="mt-4">
        <SectionHeader
          title="Tutorial library"
          description="Each guide is designed around a concrete production outcome."
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {LEARNING_RESOURCES.map((resource) => (
            <LearningCard key={resource.title} resource={resource} />
          ))}
        </div>
      </section>

      <section className="mt-4 bg-surface-container-lowest border border-outline-variant rounded-xl p-6 sm:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-[0.8fr_1.2fr] gap-8 items-start">
          <div>
            <span className="text-primary text-label-md font-semibold uppercase tracking-widest">
              Suggested path
            </span>
            <h2 className="mt-3 text-headline-lg-mobile sm:text-headline-lg font-semibold text-on-surface">
              From rough footage to approved social package
            </h2>
            <p className="mt-3 text-body-sm text-on-surface-variant">
              A practical sequence for teams that need to turn long footage into
              polished, reviewable clips without rebuilding the workflow each
              time.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              "Import and organize source footage",
              "Generate transcript-based selects",
              "Prompt a first assembly",
              "Review, refine, and batch export",
            ].map((step, index) => (
              <div
                key={step}
                className="bg-surface-container border border-outline-variant rounded-lg p-4"
              >
                <span className="text-primary text-label-md font-semibold">
                  Step {index + 1}
                </span>
                <p className="mt-2 text-body-sm text-on-surface">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
