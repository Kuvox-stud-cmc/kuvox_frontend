import { API_ROUTES } from "~/const/api-routes";
import type { NotificationDto, PagedResult, UnreadCountDto } from "../api";
import type { RequestLogger } from "../logger.server";
import { apiClient, bearerAuth } from "./api-client.server";

export class NotificationsApi {
  listMine(
    token: string,
    params?: { page?: number; pageSize?: number },
    log?: RequestLogger,
  ): Promise<PagedResult<NotificationDto>> {
    const query = new URLSearchParams();
    query.set("page", String(params?.page ?? 1));
    query.set("pageSize", String(params?.pageSize ?? 20));
    return apiClient.get<PagedResult<NotificationDto>>(
      `${API_ROUTES.NOTIFICATIONS}?${query}`,
      { auth: bearerAuth(token), log },
    );
  }

  unreadCount(token: string, log?: RequestLogger): Promise<UnreadCountDto> {
    return apiClient.get<UnreadCountDto>(`${API_ROUTES.NOTIFICATIONS}/unread-count`, {
      auth: bearerAuth(token),
      log,
    });
  }

  markRead(token: string, id: string, log?: RequestLogger): Promise<NotificationDto> {
    return apiClient.post<NotificationDto>(
      `${API_ROUTES.NOTIFICATIONS}/${id}/read`,
      {},
      { auth: bearerAuth(token), log },
    );
  }

  markAllRead(token: string, log?: RequestLogger): Promise<void> {
    return apiClient.postVoid(`${API_ROUTES.NOTIFICATIONS}/read-all`, {}, {
      auth: bearerAuth(token),
      log,
    });
  }

  archive(token: string, id: string, log?: RequestLogger): Promise<NotificationDto> {
    return apiClient.post<NotificationDto>(
      `${API_ROUTES.NOTIFICATIONS}/${id}/archive`,
      {},
      { auth: bearerAuth(token), log },
    );
  }

  delete(token: string, id: string, log?: RequestLogger): Promise<void> {
    return apiClient.deleteVoid(`${API_ROUTES.NOTIFICATIONS}/${id}`, {
      auth: bearerAuth(token),
      log,
    });
  }
}

export const notificationsApi = new NotificationsApi();

export const listNotifications = (
  token: string,
  params?: { page?: number; pageSize?: number },
  log?: RequestLogger,
) => notificationsApi.listMine(token, params, log);
export const getUnreadNotificationCount = (token: string, log?: RequestLogger) =>
  notificationsApi.unreadCount(token, log);
export const markNotificationRead = (token: string, id: string, log?: RequestLogger) =>
  notificationsApi.markRead(token, id, log);
export const markAllNotificationsRead = (token: string, log?: RequestLogger) =>
  notificationsApi.markAllRead(token, log);
export const archiveNotification = (token: string, id: string, log?: RequestLogger) =>
  notificationsApi.archive(token, id, log);
export const deleteNotification = (token: string, id: string, log?: RequestLogger) =>
  notificationsApi.delete(token, id, log);
