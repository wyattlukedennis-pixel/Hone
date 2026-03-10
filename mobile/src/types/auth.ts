export type AuthMode = "login" | "signup";

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
