import { redirect } from "react-router";

import {
  canManageStudioAccess,
  canWriteStudioContent,
  type StudioDto,
} from "~/lib/api";
import { listMyStudios } from "~/lib/api.server";
import type { RequestLogger } from "~/lib/logger.server";

export interface StudioAccess {
  studios: StudioDto[];
  studio: StudioDto;
  role: number;
  canWriteContent: boolean;
  canManageAccess: boolean;
}

export async function getStudioAccess(
  accessToken: string,
  studioId: string,
  log?: RequestLogger,
): Promise<StudioAccess | null> {
  const studios = await listMyStudios(accessToken, log);
  const studio = studios.find((item) => item.id === studioId);
  if (!studio) return null;

  return {
    studios,
    studio,
    role: studio.role,
    canWriteContent: canWriteStudioContent(studio.role),
    canManageAccess: canManageStudioAccess(studio.role),
  };
}

export async function requireStudioAccess(
  accessToken: string,
  studioId: string,
  log?: RequestLogger,
): Promise<StudioAccess> {
  const access = await getStudioAccess(accessToken, studioId, log);
  if (!access) throw redirect("/dashboard");
  return access;
}

export async function requireStudioAdminAccess(
  accessToken: string,
  studioId: string,
  log?: RequestLogger,
): Promise<StudioAccess> {
  const access = await requireStudioAccess(accessToken, studioId, log);
  if (!access.canManageAccess) {
    throw redirect(`/teams/${studioId}/access-management`);
  }
  return access;
}
