const ICONIFY_SEARCH_URL = "https://api.iconify.design/search";

const allowedPrefixes = new Set([
  "lucide",
  "tabler",
  "heroicons",
  "ph",
  "material-symbols",
]);

interface IconifySearchResponse {
  icons?: unknown;
}

export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const query = normalizeQuery(url.searchParams.get("query"));
  const limit = clampLimit(url.searchParams.get("limit"));

  if (!query) {
    return Response.json({ icons: [] });
  }

  const upstream = new URL(ICONIFY_SEARCH_URL);
  upstream.searchParams.set("query", query);
  upstream.searchParams.set("limit", String(Math.min(limit * 3, 150)));

  try {
    const response = await fetch(upstream, {
      headers: { accept: "application/json" },
    });

    if (!response.ok) {
      return Response.json({ icons: [], error: "Icon search is unavailable." }, { status: 502 });
    }

    const payload = await response.json() as IconifySearchResponse;
    const icons = Array.isArray(payload.icons)
      ? payload.icons
        .filter((icon): icon is string => typeof icon === "string")
        .filter(isAllowedIconName)
        .slice(0, limit)
      : [];

    return Response.json({ icons, allowedPrefixes: Array.from(allowedPrefixes) });
  } catch {
    return Response.json({ icons: [], error: "Icon search is unavailable." }, { status: 502 });
  }
}

function normalizeQuery(value: string | null): string {
  return (value ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
}

function clampLimit(value: string | null): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 48;
  return Math.max(1, Math.min(Math.floor(numeric), 96));
}

function isAllowedIconName(icon: string): boolean {
  const [prefix, name] = icon.split(":");
  return Boolean(prefix && name && allowedPrefixes.has(prefix));
}
