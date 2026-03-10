import type { FastifyInstance } from "fastify";

import { config } from "../config.js";
import { getPool } from "../db/pool.js";
import { ensureDatabase, requireAuth } from "./guard.js";
import { hashPassword, verifyPassword } from "./password.js";
import {
  type AuthUser,
  createSession,
  createUser,
  findUserByEmail,
  revokeSession,
  toPublicUser
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

export function registerAuthRoutes(app: FastifyInstance) {
  app.post<{ Body: SignupBody }>("/auth/signup", async (request, reply) => {
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

  app.post<{ Body: LoginBody }>("/auth/login", async (request, reply) => {
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
}
