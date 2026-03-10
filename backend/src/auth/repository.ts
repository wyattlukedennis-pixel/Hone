import type { Pool } from "pg";

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  display_name: string | null;
};

type SessionRow = {
  id: string;
  user_id: string;
  expires_at: Date | string;
  revoked_at: Date | string | null;
};

export type AuthUser = {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string | null;
};

export type PublicUser = {
  id: string;
  email: string;
  displayName: string | null;
};

export type AuthSession = {
  id: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
};

function toDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

function mapUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    displayName: row.display_name
  };
}

function mapSession(row: SessionRow): AuthSession {
  return {
    id: row.id,
    userId: row.user_id,
    expiresAt: toDate(row.expires_at),
    revokedAt: row.revoked_at ? toDate(row.revoked_at) : null
  };
}

export function toPublicUser(user: Pick<AuthUser, "id" | "email" | "displayName">): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName
  };
}

export async function findUserByEmail(pool: Pool, email: string) {
  const result = await pool.query<UserRow>(
    `
      SELECT id, email, password_hash, display_name
      FROM users
      WHERE email = $1
      LIMIT 1
    `,
    [email]
  );
  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

export async function findUserById(pool: Pool, userId: string) {
  const result = await pool.query<UserRow>(
    `
      SELECT id, email, password_hash, display_name
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [userId]
  );
  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

export async function createUser(pool: Pool, params: { email: string; passwordHash: string; displayName: string | null }) {
  const result = await pool.query<UserRow>(
    `
      INSERT INTO users (email, password_hash, display_name)
      VALUES ($1, $2, $3)
      RETURNING id, email, password_hash, display_name
    `,
    [params.email, params.passwordHash, params.displayName]
  );

  return mapUser(result.rows[0]);
}

export async function createSession(pool: Pool, params: { userId: string; expiresAt: Date }) {
  const result = await pool.query<SessionRow>(
    `
      INSERT INTO auth_sessions (user_id, expires_at)
      VALUES ($1, $2)
      RETURNING id, user_id, expires_at, revoked_at
    `,
    [params.userId, params.expiresAt.toISOString()]
  );

  return mapSession(result.rows[0]);
}

export async function findSessionById(pool: Pool, sessionId: string) {
  const result = await pool.query<SessionRow>(
    `
      SELECT id, user_id, expires_at, revoked_at
      FROM auth_sessions
      WHERE id = $1
      LIMIT 1
    `,
    [sessionId]
  );

  return result.rows[0] ? mapSession(result.rows[0]) : null;
}

export async function revokeSession(pool: Pool, sessionId: string) {
  await pool.query(
    `
      UPDATE auth_sessions
      SET revoked_at = NOW()
      WHERE id = $1
    `,
    [sessionId]
  );
}
