import { API_ROUTES } from "~/const/api-routes";
import type { RequestLogger } from "../logger.server";
import type { SessionUser } from "../session.server";
import { type ApiClient, apiClient, noAuth, bearerAuth } from "./api-client.server";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

interface ApiUserDto {
  id: string;
  email: string;
  displayName: string;
  role: string;
  plan: string;
  emailVerified: boolean;
  createdAt: string;
}

function toSessionUser(dto: ApiUserDto): SessionUser {
  return {
    id: dto.id,
    email: dto.email,
    displayName: dto.displayName,
    plan: dto.plan,
    emailVerified: dto.emailVerified,
  };
}

export class AuthApi {
  constructor(private client: ApiClient) {}

  async login(email: string, password: string, log?: RequestLogger): Promise<AuthTokens> {
    return this.client.post<AuthTokens>(`${API_ROUTES.AUTH}/login`, { email, password }, { auth: noAuth(), log });
  }

  async register(email: string, password: string, displayName: string, log?: RequestLogger): Promise<void> {
    await this.client.post<ApiUserDto>(`${API_ROUTES.AUTH}/register`, { email, password, displayName }, { auth: noAuth(), log });
  }

  async refresh(refreshToken: string, log?: RequestLogger): Promise<AuthTokens> {
    return this.client.post<AuthTokens>(`${API_ROUTES.AUTH}/refresh`, refreshToken, { auth: noAuth(), log });
  }

  async logout(refreshToken: string, log?: RequestLogger): Promise<void> {
    try {
      await this.client.postVoid(`${API_ROUTES.AUTH}/logout`, refreshToken, { auth: noAuth(), log });
    } catch {
      // Best-effort
    }
  }

  async fetchMe(accessToken: string, log?: RequestLogger): Promise<SessionUser> {
    const dto = await this.client.get<ApiUserDto>(`${API_ROUTES.AUTH}/me`, { auth: bearerAuth(accessToken), log });
    return toSessionUser(dto);
  }

  async verifyEmail(token: string, log?: RequestLogger): Promise<{ tokens: AuthTokens; isNewlyVerified: boolean }> {
    return this.client.post<{ tokens: AuthTokens; isNewlyVerified: boolean }>(`${API_ROUTES.AUTH}/verify-email`, { token }, { auth: noAuth(), log });
  }

  async resendVerification(email: string, log?: RequestLogger): Promise<void> {
    await this.client.postVoid(`${API_ROUTES.AUTH}/resend-verification`, { email }, { auth: noAuth(), log });
  }

  async forgotPassword(email: string, log?: RequestLogger): Promise<void> {
    await this.client.postVoid(`${API_ROUTES.AUTH}/forgot-password`, { email }, { auth: noAuth(), log });
  }

  async resetPassword(token: string, newPassword: string, log?: RequestLogger): Promise<void> {
    await this.client.postVoid(`${API_ROUTES.AUTH}/reset-password`, { token, newPassword }, { auth: noAuth(), log });
  }
}

export const authApi = new AuthApi(apiClient);

// Backward compatible exports
export const loginRequest = (e: string, p: string, l?: RequestLogger) => authApi.login(e, p, l);
export const registerRequest = (e: string, p: string, d: string, l?: RequestLogger) => authApi.register(e, p, d, l);
export const refreshRequest = (t: string, l?: RequestLogger) => authApi.refresh(t, l);
export const logoutRequest = (t: string, l?: RequestLogger) => authApi.logout(t, l);
export const fetchMe = (t: string, l?: RequestLogger) => authApi.fetchMe(t, l);
export const verifyEmailRequest = (t: string, l?: RequestLogger) => authApi.verifyEmail(t, l);
export const resendVerificationRequest = (e: string, l?: RequestLogger) => authApi.resendVerification(e, l);
export const forgotPasswordRequest = (e: string, l?: RequestLogger) => authApi.forgotPassword(e, l);
export const resetPasswordRequest = (t: string, p: string, l?: RequestLogger) => authApi.resetPassword(t, p, l);
