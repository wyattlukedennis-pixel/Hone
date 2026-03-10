import type { FastifyReply, FastifyRequest } from "fastify";

import { config } from "../config.js";
import { getPool } from "../db/pool.js";
import { findSessionById, findUserById, type AuthSession, type AuthUser } from "./repository.js";
import { verifyAuthToken } from "./token.js";

export type AuthContext = {
  session: AuthSession;
  user: AuthUser;
};

function readBearerToken(request: FastifyRequest) {
  const authorization = request.headers.authorization;
  if (!authorization) return null;

  const [scheme, token] = authorization.split(" ");
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") return null;
  return token;
}

export function ensureDatabase(reply: FastifyReply) {
  if (config.databaseUrl) return true;
  reply.code(500).send({ error: "SERVER_MISCONFIGURED", message: "Database is not configured." });
  return false;
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<AuthContext | null> {
  if (!ensureDatabase(reply)) return null;

  const token = readBearerToken(request);
  if (!token) {
    reply.code(401).send({ error: "UNAUTHORIZED", message: "Missing bearer token." });
    return null;
  }

  const payload = verifyAuthToken(token);
  if (!payload) {
    reply.code(401).send({ error: "UNAUTHORIZED", message: "Invalid token." });
    return null;
  }

  const pool = getPool();
  const session = await findSessionById(pool, payload.sessionId);
  if (!session || session.userId !== payload.userId || session.revokedAt || session.expiresAt <= new Date()) {
    reply.code(401).send({ error: "UNAUTHORIZED", message: "Session is not active." });
    return null;
  }

  const user = await findUserById(pool, payload.userId);
  if (!user) {
    reply.code(401).send({ error: "UNAUTHORIZED", message: "User not found." });
    return null;
  }

  return { session, user };
}
