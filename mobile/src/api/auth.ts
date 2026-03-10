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
