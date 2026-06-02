import { Link } from "react-router";

import type { Route } from "./+types/home";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Kuvox — Intelligent Video Editing" },
    {
      name: "description",
      content:
        "Upload videos, edit on a timeline, and direct edits with natural language.",
    },
  ];
}

export default function Home() {
  return (
    <section className="py-12">
      <h1 className="text-4xl font-bold tracking-tight">
        Edit video with words.
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-gray-600">
        Kuvox analyzes your footage into a semantic scene graph and lets you edit
        through both a conventional timeline and natural-language commands.
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          to="/signup"
          className="rounded bg-gray-900 px-5 py-2.5 text-white"
        >
          Get started
        </Link>
        <Link
          to="/pricing"
          className="rounded border border-gray-300 px-5 py-2.5"
        >
          See pricing
        </Link>
      </div>
    </section>
  );
}
