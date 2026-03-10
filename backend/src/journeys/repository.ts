import type { Pool } from "pg";

type JourneyRow = {
  id: string;
  user_id: string;
  title: string;
  category: string | null;
  color_theme: string | null;
  goal_text: string | null;
  started_at: Date | string;
  archived_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

export type Journey = {
  id: string;
  userId: string;
  title: string;
  category: string | null;
  colorTheme: string | null;
  goalText: string | null;
  startedAt: Date;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type JourneyUpdates = {
  title?: string;
  category?: string | null;
  colorTheme?: string | null;
  goalText?: string | null;
};

function toDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

function mapJourney(row: JourneyRow): Journey {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    category: row.category,
    colorTheme: row.color_theme,
    goalText: row.goal_text,
    startedAt: toDate(row.started_at),
    archivedAt: row.archived_at ? toDate(row.archived_at) : null,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at)
  };
}

export async function listActiveJourneysByUser(pool: Pool, userId: string) {
  const result = await pool.query<JourneyRow>(
    `
      SELECT id, user_id, title, category, color_theme, goal_text, started_at, archived_at, created_at, updated_at
      FROM journeys
      WHERE user_id = $1 AND archived_at IS NULL
      ORDER BY created_at DESC
    `,
    [userId]
  );

  return result.rows.map(mapJourney);
}

export async function createJourney(
  pool: Pool,
  params: {
    userId: string;
    title: string;
    category: string | null;
    colorTheme: string | null;
    goalText: string | null;
  }
) {
  const result = await pool.query<JourneyRow>(
    `
      INSERT INTO journeys (user_id, title, category, color_theme, goal_text)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, user_id, title, category, color_theme, goal_text, started_at, archived_at, created_at, updated_at
    `,
    [params.userId, params.title, params.category, params.colorTheme, params.goalText]
  );

  return mapJourney(result.rows[0]);
}

export async function findJourneyByIdForUser(
  pool: Pool,
  params: { journeyId: string; userId: string; includeArchived?: boolean }
) {
  const includeArchived = Boolean(params.includeArchived);
  const result = await pool.query<JourneyRow>(
    `
      SELECT id, user_id, title, category, color_theme, goal_text, started_at, archived_at, created_at, updated_at
      FROM journeys
      WHERE id = $1 AND user_id = $2
      ${includeArchived ? "" : "AND archived_at IS NULL"}
      LIMIT 1
    `,
    [params.journeyId, params.userId]
  );

  return result.rows[0] ? mapJourney(result.rows[0]) : null;
}

export async function updateJourney(
  pool: Pool,
  params: {
    journeyId: string;
    userId: string;
    updates: JourneyUpdates;
  }
) {
  const setFragments: string[] = [];
  const values: Array<string | null> = [];
  let index = 1;

  if (params.updates.title !== undefined) {
    setFragments.push(`title = $${index++}`);
    values.push(params.updates.title);
  }

  if (params.updates.category !== undefined) {
    setFragments.push(`category = $${index++}`);
    values.push(params.updates.category);
  }

  if (params.updates.colorTheme !== undefined) {
    setFragments.push(`color_theme = $${index++}`);
    values.push(params.updates.colorTheme);
  }

  if (params.updates.goalText !== undefined) {
    setFragments.push(`goal_text = $${index++}`);
    values.push(params.updates.goalText);
  }

  if (setFragments.length === 0) return null;

  setFragments.push("updated_at = NOW()");

  values.push(params.journeyId);
  values.push(params.userId);

  const result = await pool.query<JourneyRow>(
    `
      UPDATE journeys
      SET ${setFragments.join(", ")}
      WHERE id = $${index++} AND user_id = $${index++} AND archived_at IS NULL
      RETURNING id, user_id, title, category, color_theme, goal_text, started_at, archived_at, created_at, updated_at
    `,
    values
  );

  return result.rows[0] ? mapJourney(result.rows[0]) : null;
}

export async function archiveJourney(pool: Pool, params: { journeyId: string; userId: string }) {
  const result = await pool.query<JourneyRow>(
    `
      UPDATE journeys
      SET archived_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND user_id = $2 AND archived_at IS NULL
      RETURNING id, user_id, title, category, color_theme, goal_text, started_at, archived_at, created_at, updated_at
    `,
    [params.journeyId, params.userId]
  );

  return result.rows[0] ? mapJourney(result.rows[0]) : null;
}
