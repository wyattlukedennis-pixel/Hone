import type { Pool } from "pg";

type UserRow = {
  id: string;
  email: string;
  password_hash: string | null;
  display_name: string | null;
  apple_id: string | null;
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
  passwordHash: string | null;
  displayName: string | null;
  appleId: string | null;
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
    displayName: row.display_name,
    appleId: row.apple_id
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
      SELECT id, email, password_hash, display_name, apple_id
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
      SELECT id, email, password_hash, display_name, apple_id
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [userId]
  );
  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

export async function findUserByAppleId(pool: Pool, appleId: string) {
  const result = await pool.query<UserRow>(
    `
      SELECT id, email, password_hash, display_name, apple_id
      FROM users
      WHERE apple_id = $1
      LIMIT 1
    `,
    [appleId]
  );
  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

export async function createUser(pool: Pool, params: { email: string; passwordHash: string | null; displayName: string | null; appleId?: string | null }) {
  const result = await pool.query<UserRow>(
    `
      INSERT INTO users (email, password_hash, display_name, apple_id)
      VALUES ($1, $2, $3, $4)
      RETURNING id, email, password_hash, display_name, apple_id
    `,
    [params.email, params.passwordHash, params.displayName, params.appleId ?? null]
  );

  return mapUser(result.rows[0]);
}

export async function linkAppleId(pool: Pool, userId: string, appleId: string) {
  await pool.query(
    `UPDATE users SET apple_id = $1, updated_at = NOW() WHERE id = $2`,
    [appleId, userId]
  );
}

export async function deleteUser(pool: Pool, userId: string) {
  // auth_sessions, journeys, clips etc. cascade via FK ON DELETE CASCADE
  await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
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

export async function updatePasswordHash(pool: Pool, userId: string, passwordHash: string) {
  await pool.query(
    `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
    [passwordHash, userId]
  );
}

export async function createPasswordResetToken(pool: Pool, params: { userId: string; tokenHash: string; expiresAt: Date }) {
  await pool.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [params.userId, params.tokenHash, params.expiresAt.toISOString()]
  );
}

export async function findValidResetToken(pool: Pool, userId: string, tokenHash: string) {
  const result = await pool.query<{ id: string; user_id: string; expires_at: Date }>(
    `
      SELECT id, user_id, expires_at
      FROM password_reset_tokens
      WHERE user_id = $1 AND token_hash = $2 AND used_at IS NULL AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [userId, tokenHash]
  );
  return result.rows[0] ?? null;
}

export async function markResetTokenUsed(pool: Pool, tokenId: string) {
  await pool.query(
    `UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`,
    [tokenId]
  );
}

export async function invalidateResetTokensForUser(pool: Pool, userId: string) {
  await pool.query(
    `UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL`,
    [userId]
  );
}
