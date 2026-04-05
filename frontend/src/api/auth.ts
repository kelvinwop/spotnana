import {
  type AuthResponse,
  type CurrentUserResponse,
  type UpdateAccountAiSettingsRequest,
  type UpdateAccountAiSettingsResponse,
} from "@/types/chat";
import { requestJson } from "./http";

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
}

export const authApi = {
  login(credentials: LoginCredentials): Promise<AuthResponse> {
    return requestJson<AuthResponse>("/api/v1/auth/login", {
      method: "POST",
      body: credentials,
    });
  },

  register(payload: RegisterPayload): Promise<AuthResponse> {
    return requestJson<AuthResponse>("/api/v1/auth/register", {
      method: "POST",
      body: payload,
    });
  },

  logout(): Promise<{ message: string }> {
    return requestJson<{ message: string }>("/api/v1/auth/logout", {
      method: "POST",
      auth: true,
    });
  },

  getCurrentUser(): Promise<CurrentUserResponse> {
    return requestJson<CurrentUserResponse>("/api/v1/auth/me", {
      method: "GET",
      auth: true,
    });
  },

  updateAiSettings(payload: UpdateAccountAiSettingsRequest): Promise<UpdateAccountAiSettingsResponse> {
    return requestJson<UpdateAccountAiSettingsResponse>("/api/v1/auth/settings/ai", {
      method: "PUT",
      body: payload,
      auth: true,
    });
  },
};
