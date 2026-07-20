import type { AlbumDto, MediaDto, PagedResult } from "~/lib/api";

export interface ProjectMediaPickerData {
  media: MediaDto[];
  albums: AlbumDto[];
}

export async function loadProjectMediaPickerData(studioId?: string | null): Promise<ProjectMediaPickerData> {
  const workspaceQuery = new URLSearchParams({ page: "1", pageSize: "100" });
  if (studioId) workspaceQuery.set("studioId", studioId);

  const [workspaceMedia, sharedMedia, workspaceAlbums, sharedAlbums] = await Promise.all([
    listAllPagedMedia(`/bff/media/library?${workspaceQuery}`),
    listAllPagedMedia("/bff/media/shared?page=1&pageSize=100"),
    fetchJson<AlbumDto[]>(`/bff/albums/library${studioId ? `?studioId=${encodeURIComponent(studioId)}` : ""}`),
    fetchJson<AlbumDto[]>("/bff/albums/shared"),
  ]);

  return {
    media: uniqueById([...workspaceMedia, ...sharedMedia]),
    albums: uniqueById([...workspaceAlbums, ...sharedAlbums]),
  };
}

export async function loadPickerAlbumMedia(albumId: string): Promise<MediaDto[]> {
  const result = await fetchJson<PagedResult<MediaDto>>(
    `/bff/albums/${encodeURIComponent(albumId)}/media`,
  );
  return result.items;
}

async function listAllPagedMedia(initialUrl: string): Promise<MediaDto[]> {
  const first = await fetchJson<PagedResult<MediaDto>>(initialUrl);
  const items = [...first.items];
  if (first.totalPages <= 1) return items;

  const url = new URL(initialUrl, window.location.origin);
  for (let page = 2; page <= first.totalPages; page += 1) {
    url.searchParams.set("page", String(page));
    const next = await fetchJson<PagedResult<MediaDto>>(`${url.pathname}${url.search}`);
    items.push(...next.items);
  }
  return items;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(errorMessage(body) ?? `Request failed with status ${response.status}.`);
  }
  return body as T;
}

function errorMessage(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value;
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  return errorMessage(record.detail)
    ?? errorMessage(record.message)
    ?? errorMessage(record.error)
    ?? errorMessage(record.title);
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const byId = new Map<string, T>();
  for (const item of items) byId.set(item.id, item);
  return Array.from(byId.values());
}
