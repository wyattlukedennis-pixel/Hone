import jwt from "jsonwebtoken";

import { config } from "../config.js";

export type AuthTokenPayload = {
  userId: string;
  sessionId: string;
  email: string;
};

export function signAuthToken(payload: AuthTokenPayload) {
  return jwt.sign(
    {
      sub: payload.userId,
      sid: payload.sessionId
    },
    config.auth.jwtSecret,
    {
      expiresIn: `${config.auth.tokenTtlDays}d`
    }
  );
}

export function verifyAuthToken(token: string): AuthTokenPayload | null {
  try {
    const decoded = jwt.verify(token, config.auth.jwtSecret);
    if (typeof decoded === "string") return null;

    const userId = typeof decoded.sub === "string" ? decoded.sub : null;
    const sessionId = typeof decoded.sid === "string" ? decoded.sid : null;
    if (!userId || !sessionId) return null;

    // email is no longer stored in the token for privacy — pass empty string
    return { userId, sessionId, email: "" };
  } catch {
    return null;
  }
}
