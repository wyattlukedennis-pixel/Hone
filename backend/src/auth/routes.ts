import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";

import { config } from "../config.js";
import { getPool } from "../db/pool.js";
import { sendPasswordResetEmail } from "../email/resend.js";
import { ensureDatabase, requireAuth } from "./guard.js";
import { hashPassword, verifyPassword } from "./password.js";
import {
  type AuthUser,
  createPasswordResetToken,
  createSession,
  createUser,
  deleteUser,
  findUserByAppleId,
  findUserByEmail,
  findValidResetToken,
  invalidateResetTokensForUser,
  linkAppleId,
  markResetTokenUsed,
  revokeSession,
  toPublicUser,
  updatePasswordHash
} from "./repository.js";
import { signAuthToken } from "./token.js";

type SignupBody = {
  email?: string;
  password?: string;
  displayName?: string;
};

type LoginBody = {
  email?: string;
  password?: string;
};

type AppleAuthBody = {
  appleUserId?: string;
  email?: string;
  displayName?: string;
  identityToken?: string;
};

type ForgotPasswordBody = {
  email?: string;
};

type ResetPasswordBody = {
  email?: string;
  code?: string;
  newPassword?: string;
};

function generateResetCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

function hashResetCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(input: string) {
  return input.trim().toLowerCase();
}

function validateSignupBody(body: SignupBody) {
  const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
  const password = typeof body.password === "string" ? body.password : "";
  const normalizedDisplayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
  const displayName = normalizedDisplayName.length > 0 ? normalizedDisplayName : null;

  if (!EMAIL_REGEX.test(email)) return { error: "INVALID_EMAIL" as const };
  if (password.length < 8) return { error: "PASSWORD_TOO_SHORT" as const };
  if (password.length > 1000) return { error: "PASSWORD_TOO_LONG" as const };
  if (displayName && displayName.length > 80) return { error: "DISPLAY_NAME_TOO_LONG" as const };

  return { email, password, displayName };
}

function validateLoginBody(body: LoginBody) {
  const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!EMAIL_REGEX.test(email)) return { error: "INVALID_CREDENTIALS" as const };
  if (!password) return { error: "INVALID_CREDENTIALS" as const };

  return { email, password };
}

function isUniqueViolation(error: unknown): error is { code: string } {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "23505";
}

const authRateLimit = {
  config: {
    rateLimit: {
      max: 10,
      timeWindow: "1 minute"
    }
  }
};

export function registerAuthRoutes(app: FastifyInstance) {
  app.post<{ Body: SignupBody }>("/auth/signup", { ...authRateLimit }, async (request, reply) => {
    if (!ensureDatabase(reply)) return;

    const validated = validateSignupBody(request.body ?? {});
    if ("error" in validated) {
      return reply.code(400).send({ error: validated.error });
    }

    const pool = getPool();
    const existingUser = await findUserByEmail(pool, validated.email);
    if (existingUser) {
      return reply.code(409).send({ error: "EMAIL_TAKEN", message: "Email already in use." });
    }

    const passwordHash = await hashPassword(validated.password);
    let user: AuthUser;
    try {
      user = await createUser(pool, {
        email: validated.email,
        passwordHash,
        displayName: validated.displayName
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return reply.code(409).send({ error: "EMAIL_TAKEN", message: "Email already in use." });
      }
      throw error;
    }

    const expiresAt = new Date(Date.now() + config.auth.tokenTtlDays * 24 * 60 * 60 * 1000);
    const session = await createSession(pool, {
      userId: user.id,
      expiresAt
    });

    const token = signAuthToken({
      userId: user.id,
      sessionId: session.id,
      email: user.email
    });

    return reply.code(201).send({
      token,
      expiresAt: session.expiresAt.toISOString(),
      user: toPublicUser(user)
    });
  });

  app.post<{ Body: LoginBody }>("/auth/login", { ...authRateLimit }, async (request, reply) => {
    if (!ensureDatabase(reply)) return;

    const validated = validateLoginBody(request.body ?? {});
    if ("error" in validated) {
      return reply.code(401).send({ error: "INVALID_CREDENTIALS" });
    }

    const pool = getPool();
    const user = await findUserByEmail(pool, validated.email);
    if (!user) {
      return reply.code(401).send({ error: "INVALID_CREDENTIALS" });
    }

    if (!user.passwordHash) {
      // Apple-only account — no password set
      return reply.code(401).send({ error: "INVALID_CREDENTIALS" });
    }

    const passwordMatches = await verifyPassword(validated.password, user.passwordHash);
    if (!passwordMatches) {
      return reply.code(401).send({ error: "INVALID_CREDENTIALS" });
    }

    const expiresAt = new Date(Date.now() + config.auth.tokenTtlDays * 24 * 60 * 60 * 1000);
    const session = await createSession(pool, {
      userId: user.id,
      expiresAt
    });

    const token = signAuthToken({
      userId: user.id,
      sessionId: session.id,
      email: user.email
    });

    return reply.send({
      token,
      expiresAt: session.expiresAt.toISOString(),
      user: toPublicUser(user)
    });
  });

  app.post("/auth/logout", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;

    const pool = getPool();
    await revokeSession(pool, auth.session.id);

    return reply.send({ success: true });
  });

  app.get("/auth/me", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;

    return reply.send({
      user: toPublicUser(auth.user)
    });
  });

  app.post<{ Body: AppleAuthBody }>("/auth/apple", { ...authRateLimit }, async (request, reply) => {
    if (!ensureDatabase(reply)) return;

    const appleUserId = typeof request.body?.appleUserId === "string" ? request.body.appleUserId.trim() : "";
    const email = typeof request.body?.email === "string" ? normalizeEmail(request.body.email) : "";
    const displayName = typeof request.body?.displayName === "string" ? request.body.displayName.trim() : null;

    if (!appleUserId) {
      return reply.code(400).send({ error: "APPLE_USER_ID_REQUIRED" });
    }

    const pool = getPool();

    // Check if we already have a user with this Apple ID
    const existingAppleUser = await findUserByAppleId(pool, appleUserId);
    if (existingAppleUser) {
      const expiresAt = new Date(Date.now() + config.auth.tokenTtlDays * 24 * 60 * 60 * 1000);
      const session = await createSession(pool, { userId: existingAppleUser.id, expiresAt });
      const token = signAuthToken({
        userId: existingAppleUser.id,
        sessionId: session.id,
        email: existingAppleUser.email
      });
      return reply.send({
        token,
        expiresAt: session.expiresAt.toISOString(),
        user: toPublicUser(existingAppleUser)
      });
    }

    // Check if user exists by email — link Apple ID to existing account
    if (email) {
      const existingEmailUser = await findUserByEmail(pool, email);
      if (existingEmailUser) {
        await linkAppleId(pool, existingEmailUser.id, appleUserId);
        const expiresAt = new Date(Date.now() + config.auth.tokenTtlDays * 24 * 60 * 60 * 1000);
        const session = await createSession(pool, { userId: existingEmailUser.id, expiresAt });
        const token = signAuthToken({
          userId: existingEmailUser.id,
          sessionId: session.id,
          email: existingEmailUser.email
        });
        return reply.send({
          token,
          expiresAt: session.expiresAt.toISOString(),
          user: toPublicUser(existingEmailUser)
        });
      }
    }

    // Create new user with Apple ID (no password needed)
    const userEmail = email || `${appleUserId}@privaterelay.appleid.com`;
    let user: AuthUser;
    try {
      user = await createUser(pool, {
        email: userEmail,
        passwordHash: null,
        displayName: displayName && displayName.length > 0 ? displayName : null,
        appleId: appleUserId
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return reply.code(409).send({ error: "EMAIL_TAKEN", message: "Email already in use." });
      }
      throw error;
    }

    const expiresAt = new Date(Date.now() + config.auth.tokenTtlDays * 24 * 60 * 60 * 1000);
    const session = await createSession(pool, { userId: user.id, expiresAt });
    const token = signAuthToken({
      userId: user.id,
      sessionId: session.id,
      email: user.email
    });

    return reply.code(201).send({
      token,
      expiresAt: session.expiresAt.toISOString(),
      user: toPublicUser(user)
    });
  });

  app.delete("/auth/account", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;

    const pool = getPool();
    await deleteUser(pool, auth.user.id);

    return reply.send({ success: true });
  });

  // --- Password Reset ---

  app.post<{ Body: ForgotPasswordBody }>("/auth/forgot-password", { ...authRateLimit }, async (request, reply) => {
    if (!ensureDatabase(reply)) return;

    const email = typeof request.body?.email === "string" ? normalizeEmail(request.body.email) : "";
    if (!EMAIL_REGEX.test(email)) {
      // Always return success to prevent email enumeration
      return reply.send({ success: true });
    }

    const pool = getPool();
    const user = await findUserByEmail(pool, email);
    if (!user) {
      // Don't reveal whether the email exists
      return reply.send({ success: true });
    }

    // Invalidate any previous unused tokens
    await invalidateResetTokensForUser(pool, user.id);

    const code = generateResetCode();
    const tokenHash = hashResetCode(code);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await createPasswordResetToken(pool, {
      userId: user.id,
      tokenHash,
      expiresAt
    });

    await sendPasswordResetEmail(email, code);

    return reply.send({ success: true });
  });

  app.post<{ Body: ResetPasswordBody }>("/auth/reset-password", { ...authRateLimit }, async (request, reply) => {
    if (!ensureDatabase(reply)) return;

    const email = typeof request.body?.email === "string" ? normalizeEmail(request.body.email) : "";
    const code = typeof request.body?.code === "string" ? request.body.code.trim() : "";
    const newPassword = typeof request.body?.newPassword === "string" ? request.body.newPassword : "";

    if (!EMAIL_REGEX.test(email) || !code || code.length !== 6) {
      return reply.code(400).send({ error: "INVALID_RESET_CODE" });
    }
    if (newPassword.length < 8) {
      return reply.code(400).send({ error: "PASSWORD_TOO_SHORT" });
    }
    if (newPassword.length > 1000) {
      return reply.code(400).send({ error: "PASSWORD_TOO_LONG" });
    }

    const pool = getPool();
    const user = await findUserByEmail(pool, email);
    if (!user) {
      return reply.code(400).send({ error: "INVALID_RESET_CODE" });
    }

    const tokenHash = hashResetCode(code);
    const token = await findValidResetToken(pool, user.id, tokenHash);
    if (!token) {
      return reply.code(400).send({ error: "INVALID_RESET_CODE" });
    }

    // Mark token as used
    await markResetTokenUsed(pool, token.id);

    // Update password
    const passwordHash = await hashPassword(newPassword);
    await updatePasswordHash(pool, user.id, passwordHash);

    // Create a new session so user is logged in
    const expiresAt = new Date(Date.now() + config.auth.tokenTtlDays * 24 * 60 * 60 * 1000);
    const session = await createSession(pool, { userId: user.id, expiresAt });
    const authToken = signAuthToken({
      userId: user.id,
      sessionId: session.id,
      email: user.email
    });

    return reply.send({
      token: authToken,
      expiresAt: session.expiresAt.toISOString(),
      user: toPublicUser(user)
    });
  });
}
