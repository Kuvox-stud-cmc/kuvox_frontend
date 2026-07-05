import { Permission, ProjectRole, type ItemAccessMemberDto } from "./api";
import {
  listAlbumAccess,
  listMediaAccess,
  listProjectAccess,
  shareAlbum,
  shareMedia,
  shareProject,
  updateAlbumAccess,
  updateMediaAccess,
  updateProjectAccess,
} from "./api.server";
import type { RequestLogger } from "./logger.server";

export type ResourceType = "project" | "media" | "album";

export interface ResourceActionData {
  ok?: boolean;
  intent?: string;
  resourceType?: ResourceType;
  id?: string;
  sharedCount?: number;
  access?: ItemAccessMemberDto[];
  error?: string;
}

const RESOURCE_INTENTS = new Set([
  "share-resource",
  "load-resource-access",
  "update-resource-access",
]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function handleResourceAction(
  formData: FormData,
  accessToken: string,
  log?: RequestLogger,
): Promise<ResourceActionData | null> {
  const intent = String(formData.get("intent") ?? "");
  if (!RESOURCE_INTENTS.has(intent)) return null;

  const resourceType = parseResourceType(formData.get("resourceType"));
  const id = String(formData.get("id") ?? "").trim();
  if (!resourceType || !id) {
    return { error: "Choose a valid resource." };
  }

  if (intent === "share-resource") {
    const emails = parseShareEmails(formData);
    const role = Number(formData.get("role") ?? Permission.Viewer);
    if (emails.length === 0) return { error: "Enter at least one email address." };
    if (emails.length > 50) return { error: "Share with 50 people or fewer at a time." };
    if (emails.some((email) => !EMAIL_PATTERN.test(email))) {
      return { error: "Enter valid email addresses." };
    }
    if (!isShareRole(role)) return { error: "Choose Viewer or Editor access." };

    for (const email of emails) {
      await shareResource(accessToken, resourceType, id, { email, role }, log);
    }
    return { ok: true, intent, resourceType, id, sharedCount: emails.length };
  }

  if (intent === "load-resource-access") {
    return {
      ok: true,
      intent,
      resourceType,
      id,
      access: await listResourceAccess(accessToken, resourceType, id, log),
    };
  }

  const userId = String(formData.get("userId") ?? "").trim();
  const roleValue = String(formData.get("role") ?? Permission.Viewer);
  if (!userId) return { error: "Choose a Studio member." };

  const isHidden = roleValue === "hidden";
  const role = isHidden ? null : Number(roleValue);
  if (!isHidden && (role == null || !isShareRole(role))) {
    return { error: "Choose Viewer, Editor, or hidden." };
  }

  return {
    ok: true,
    intent,
    resourceType,
    id,
    access: await updateResourceAccess(
      accessToken,
      resourceType,
      id,
      { userId, role, isHidden },
      log,
    ),
  };
}

function parseResourceType(value: FormDataEntryValue | null): ResourceType | null {
  if (value === "project" || value === "media" || value === "album") return value;
  return null;
}

function isShareRole(role: number): role is typeof Permission.Editor | typeof Permission.Viewer {
  return role === Permission.Editor || role === Permission.Viewer || role === ProjectRole.Editor || role === ProjectRole.Viewer;
}

function parseShareEmails(formData: FormData): string[] {
  const rawValues = [
    ...formData.getAll("emails").map((value) => String(value)),
    String(formData.get("email") ?? ""),
  ];
  const seen = new Set<string>();
  const emails: string[] = [];

  for (const raw of rawValues) {
    for (const token of raw.split(/[\s,;]+/)) {
      const email = token.trim().toLowerCase();
      if (!email || seen.has(email)) continue;
      seen.add(email);
      emails.push(email);
    }
  }

  return emails;
}

function shareResource(
  token: string,
  resourceType: ResourceType,
  id: string,
  input: { email: string; role: number },
  log?: RequestLogger,
) {
  if (resourceType === "project") return shareProject(token, id, input, log);
  if (resourceType === "media") return shareMedia(token, id, input, log);
  return shareAlbum(token, id, input, log);
}

function listResourceAccess(
  token: string,
  resourceType: ResourceType,
  id: string,
  log?: RequestLogger,
) {
  if (resourceType === "project") return listProjectAccess(token, id, log);
  if (resourceType === "media") return listMediaAccess(token, id, log);
  return listAlbumAccess(token, id, log);
}

function updateResourceAccess(
  token: string,
  resourceType: ResourceType,
  id: string,
  input: { userId: string; role: number | null; isHidden: boolean },
  log?: RequestLogger,
) {
  if (resourceType === "project") return updateProjectAccess(token, id, input, log);
  if (resourceType === "media") return updateMediaAccess(token, id, input, log);
  return updateAlbumAccess(token, id, input, log);
}
