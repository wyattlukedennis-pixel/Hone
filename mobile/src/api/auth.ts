import { requestJson } from "./http";
import type { AuthResponse, MeResponse } from "../types/auth";

export function signup(payload: { email: string; password: string; displayName: string }) {
  return requestJson<AuthResponse>("/auth/signup", {
    method: "POST",
    body: payload
  });
}

export function login(payload: { email: string; password: string }) {
  return requestJson<AuthResponse>("/auth/login", {
    method: "POST",
    body: payload
  });
}

export function appleAuth(payload: { appleUserId: string; email: string | null; displayName: string | null; identityToken: string | null }) {
  return requestJson<AuthResponse>("/auth/apple", {
    method: "POST",
    body: payload
  });
}

export function fetchMe(token: string) {
  return requestJson<MeResponse>("/auth/me", {
    token
  });
}

export function logout(token: string) {
  return requestJson<{ success: boolean }>("/auth/logout", {
    method: "POST",
    token
  });
}

export function deleteAccount(token: string) {
  return requestJson<{ success: boolean }>("/auth/account", {
    method: "DELETE",
    token
  });
}
