import type { Route } from "./+types/ai-agent-guide";

export function meta(_: Route.MetaArgs) {
  return [{ title: "AI agent guide · Kuvox" }];
}

export default function AiAgentGuide() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">AI agent guide</h1>
      <p className="mt-2 text-gray-600">Editing with natural-language commands (stub).</p>
    </section>
  );
}
