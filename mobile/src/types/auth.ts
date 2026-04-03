export type AuthMode = "login" | "signup" | "forgot" | "reset-code" | "reset-password";

export type User = {
  id: string;
  email: string;
  displayName: string | null;
};

export type AuthResponse = {
  token: string;
  expiresAt: string;
  user: User;
};

export type MeResponse = {
  user: User;
};
