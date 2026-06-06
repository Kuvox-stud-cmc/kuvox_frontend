import { CommunityHero, NewsCard, SectionHeader } from "./community-components";
import { NEWS_POSTS } from "./community-data";
import type { Route } from "./+types/news";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "News and announcements | Kuvox" },
    {
      name: "description",
      content:
        "Read Kuvox product updates, community announcements, and release notes.",
    },
  ];
}

export default function News() {
  const featured = NEWS_POSTS.find((post) => post.featured);
  const rest = NEWS_POSTS.filter((post) => !post.featured);

  return (
    <div className="w-full max-w-5xl mx-auto mt-4 flex flex-col gap-4">
      <CommunityHero
        eyebrow="News"
        title="Product updates and community announcements."
        description="Follow the releases, events, and workflow improvements that matter to Kuvox creators and teams."
      />

      {featured && (
        <section className="mt-4">
          <SectionHeader title="Featured update" />
          <NewsCard post={featured} />
        </section>
      )}

      <section className="mt-4">
        <SectionHeader
          title="Latest posts"
          description="A running log of community events, product changes, and release notes."
        />
        <div className="grid grid-cols-1 gap-3 sm:gap-4">
          {rest.map((post) => (
            <NewsCard key={post.title} post={post} />
          ))}
        </div>
      </section>
    </div>
  );
}
