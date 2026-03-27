import type { Pool } from "pg";

type JourneyRow = {
  id: string;
  user_id: string;
  title: string;
  skill_pack: "fitness" | "drawing" | "instrument";
  category: string | null;
  color_theme: string | null;
  goal_text: string | null;
  capture_mode: "video" | "photo";
  started_at: Date | string;
  archived_at: Date | string | null;
  milestone_length_days: number;
  milestone_started_on: Date | string;
  milestone_chapter: number;
  milestone_start_day: number;
  created_at: Date | string;
  updated_at: Date | string;
};

type JourneyRevealRow = {
  id: string;
  journey_id: string;
  user_id: string;
  chapter_number: number;
  milestone_length_days: number;
  start_day_index: number;
  end_day_index: number;
  recorded_days: number;
  completed_at: Date | string;
  created_at: Date | string;
};

type JourneyWeeklyQuestRow = {
  id: string;
  journey_id: string;
  user_id: string;
  week_key: string;
  quest_id: string;
  reward_xp: number;
  completed_at: Date | string;
  created_at: Date | string;
};

export type Journey = {
  id: string;
  userId: string;
  title: string;
  skillPack: "fitness" | "drawing" | "instrument";
  category: string | null;
  colorTheme: string | null;
  goalText: string | null;
  captureMode: "video" | "photo";
  startedAt: Date;
  archivedAt: Date | null;
  milestoneLengthDays: number;
  milestoneStartedOn: string;
  milestoneChapter: number;
  milestoneStartDay: number;
  createdAt: Date;
  updatedAt: Date;
};

export type JourneyReveal = {
  id: string;
  journeyId: string;
  userId: string;
  chapterNumber: number;
  milestoneLengthDays: number;
  startDayIndex: number;
  endDayIndex: number;
  recordedDays: number;
  completedAt: Date;
  createdAt: Date;
};

export type JourneyWeeklyQuestCompletion = {
  id: string;
  journeyId: string;
  userId: string;
  weekKey: string;
  questId: string;
  rewardXp: number;
  completedAt: Date;
  createdAt: Date;
};

type JourneyUpdates = {
  title?: string;
  skillPack?: "fitness" | "drawing" | "instrument";
  category?: string | null;
  colorTheme?: string | null;
  goalText?: string | null;
  captureMode?: "video" | "photo";
  milestoneLengthDays?: number;
};

export type StartNextMilestoneResult =
  | { status: "journey_not_found" }
  | {
      status: "milestone_not_reached";
      progressDays: number;
      targetDays: number;
    }
  | {
      status: "ok";
      journey: Journey;
      reveal: JourneyReveal;
      progressDays: number;
    };

function toDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

function toDateOnly(value: Date | string) {
  if (typeof value === "string") {
    return value.includes("T") ? value.slice(0, 10) : value;
  }
  const year = value.getUTCFullYear();
  const month = `${value.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${value.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function mapJourney(row: JourneyRow): Journey {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    skillPack: row.skill_pack,
    category: row.category,
    colorTheme: row.color_theme,
    goalText: row.goal_text,
    captureMode: row.capture_mode,
    startedAt: toDate(row.started_at),
    archivedAt: row.archived_at ? toDate(row.archived_at) : null,
    milestoneLengthDays: row.milestone_length_days,
    milestoneStartedOn: toDateOnly(row.milestone_started_on),
    milestoneChapter: row.milestone_chapter,
    milestoneStartDay: row.milestone_start_day,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at)
  };
}

function mapJourneyReveal(row: JourneyRevealRow): JourneyReveal {
  return {
    id: row.id,
    journeyId: row.journey_id,
    userId: row.user_id,
    chapterNumber: row.chapter_number,
    milestoneLengthDays: row.milestone_length_days,
    startDayIndex: row.start_day_index,
    endDayIndex: row.end_day_index,
    recordedDays: row.recorded_days,
    completedAt: toDate(row.completed_at),
    createdAt: toDate(row.created_at)
  };
}

function mapJourneyWeeklyQuest(row: JourneyWeeklyQuestRow): JourneyWeeklyQuestCompletion {
  return {
    id: row.id,
    journeyId: row.journey_id,
    userId: row.user_id,
    weekKey: row.week_key,
    questId: row.quest_id,
    rewardXp: row.reward_xp,
    completedAt: toDate(row.completed_at),
    createdAt: toDate(row.created_at)
  };
}

export async function listActiveJourneysByUser(pool: Pool, userId: string) {
  const result = await pool.query<JourneyRow>(
    `
      SELECT id, user_id, title, category, color_theme, goal_text,
             skill_pack,
             capture_mode,
             started_at, archived_at,
             milestone_length_days, milestone_started_on, milestone_chapter, milestone_start_day,
             created_at, updated_at
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
    skillPack: "fitness" | "drawing" | "instrument";
    category: string | null;
    colorTheme: string | null;
    goalText: string | null;
    captureMode: "video" | "photo";
    milestoneLengthDays: number;
  }
) {
  const result = await pool.query<JourneyRow>(
    `
      INSERT INTO journeys (user_id, title, skill_pack, category, color_theme, goal_text, capture_mode, milestone_length_days)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, user_id, title, category, color_theme, goal_text,
                skill_pack,
                capture_mode,
                started_at, archived_at,
                milestone_length_days, milestone_started_on, milestone_chapter, milestone_start_day,
                created_at, updated_at
    `,
    [params.userId, params.title, params.skillPack, params.category, params.colorTheme, params.goalText, params.captureMode, params.milestoneLengthDays]
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
      SELECT id, user_id, title, category, color_theme, goal_text,
             skill_pack,
             capture_mode,
             started_at, archived_at,
             milestone_length_days, milestone_started_on, milestone_chapter, milestone_start_day,
             created_at, updated_at
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
  const values: Array<string | number | null> = [];
  let index = 1;

  if (params.updates.title !== undefined) {
    setFragments.push(`title = $${index++}`);
    values.push(params.updates.title);
  }

  if (params.updates.skillPack !== undefined) {
    setFragments.push(`skill_pack = $${index++}`);
    values.push(params.updates.skillPack);
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

  if (params.updates.captureMode !== undefined) {
    setFragments.push(`capture_mode = $${index++}`);
    values.push(params.updates.captureMode);
  }

  if (params.updates.milestoneLengthDays !== undefined) {
    setFragments.push(`milestone_length_days = $${index++}`);
    values.push(params.updates.milestoneLengthDays);
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
      RETURNING id, user_id, title, category, color_theme, goal_text,
                skill_pack,
                capture_mode,
                started_at, archived_at,
                milestone_length_days, milestone_started_on, milestone_chapter, milestone_start_day,
                created_at, updated_at
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
      RETURNING id, user_id, title, category, color_theme, goal_text,
                skill_pack,
                capture_mode,
                started_at, archived_at,
                milestone_length_days, milestone_started_on, milestone_chapter, milestone_start_day,
                created_at, updated_at
    `,
    [params.journeyId, params.userId]
  );

  return result.rows[0] ? mapJourney(result.rows[0]) : null;
}

export async function listJourneyReveals(pool: Pool, params: { journeyId: string; userId: string }) {
  const result = await pool.query<JourneyRevealRow>(
    `
      SELECT id, journey_id, user_id, chapter_number, milestone_length_days,
             start_day_index, end_day_index, recorded_days, completed_at, created_at
      FROM journey_reveals
      WHERE journey_id = $1 AND user_id = $2
      ORDER BY completed_at DESC
    `,
    [params.journeyId, params.userId]
  );

  return result.rows.map(mapJourneyReveal);
}

export async function listJourneyWeeklyQuestCompletions(
  pool: Pool,
  params: { journeyId: string; userId: string; limit?: number }
) {
  const cappedLimit = Math.max(1, Math.min(52, params.limit ?? 16));
  const result = await pool.query<JourneyWeeklyQuestRow>(
    `
      SELECT id, journey_id, user_id, week_key, quest_id, reward_xp, completed_at, created_at
      FROM journey_weekly_quests
      WHERE journey_id = $1 AND user_id = $2
      ORDER BY completed_at DESC
      LIMIT $3
    `,
    [params.journeyId, params.userId, cappedLimit]
  );

  return result.rows.map(mapJourneyWeeklyQuest);
}

export async function completeJourneyWeeklyQuest(
  pool: Pool,
  params: {
    journeyId: string;
    userId: string;
    weekKey: string;
    questId: string;
    rewardXp: number;
  }
) {
  const result = await pool.query<JourneyWeeklyQuestRow>(
    `
      INSERT INTO journey_weekly_quests (journey_id, user_id, week_key, quest_id, reward_xp)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (journey_id, week_key, quest_id)
      DO UPDATE
        SET reward_xp = GREATEST(journey_weekly_quests.reward_xp, EXCLUDED.reward_xp)
      RETURNING id, journey_id, user_id, week_key, quest_id, reward_xp, completed_at, created_at
    `,
    [params.journeyId, params.userId, params.weekKey, params.questId, params.rewardXp]
  );

  return mapJourneyWeeklyQuest(result.rows[0]);
}

export async function startNextMilestoneChapter(
  pool: Pool,
  params: {
    journeyId: string;
    userId: string;
    nextMilestoneLengthDays: number;
  }
): Promise<StartNextMilestoneResult> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const journeyResult = await client.query<JourneyRow>(
      `
        SELECT id, user_id, title, category, color_theme, goal_text,
               skill_pack,
               capture_mode,
               started_at, archived_at,
               milestone_length_days, milestone_started_on, milestone_chapter, milestone_start_day,
               created_at, updated_at
        FROM journeys
        WHERE id = $1 AND user_id = $2 AND archived_at IS NULL
        FOR UPDATE
      `,
      [params.journeyId, params.userId]
    );

    const journeyRow = journeyResult.rows[0];
    if (!journeyRow) {
      await client.query("ROLLBACK");
      return { status: "journey_not_found" };
    }

    const countResult = await client.query<{ count: string }>(
      `
        SELECT COUNT(DISTINCT recorded_on)::text AS count
        FROM clips
        WHERE journey_id = $1
      `,
      [params.journeyId]
    );

    const clipCount = Number.parseInt(countResult.rows[0]?.count ?? "0", 10);
    const progressDays = Math.max(0, clipCount - journeyRow.milestone_start_day + 1);

    if (progressDays < journeyRow.milestone_length_days) {
      await client.query("ROLLBACK");
      return {
        status: "milestone_not_reached",
        progressDays,
        targetDays: journeyRow.milestone_length_days
      };
    }

    const completedEndDay = journeyRow.milestone_start_day + journeyRow.milestone_length_days - 1;

    const revealResult = await client.query<JourneyRevealRow>(
      `
        INSERT INTO journey_reveals (
          journey_id,
          user_id,
          chapter_number,
          milestone_length_days,
          start_day_index,
          end_day_index,
          recorded_days
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, journey_id, user_id, chapter_number, milestone_length_days,
                  start_day_index, end_day_index, recorded_days, completed_at, created_at
      `,
      [
        journeyRow.id,
        journeyRow.user_id,
        journeyRow.milestone_chapter,
        journeyRow.milestone_length_days,
        journeyRow.milestone_start_day,
        completedEndDay,
        progressDays
      ]
    );

    const updateResult = await client.query<JourneyRow>(
      `
        UPDATE journeys
        SET milestone_length_days = $1,
            milestone_started_on = CURRENT_DATE,
            milestone_chapter = milestone_chapter + 1,
            milestone_start_day = $2,
            updated_at = NOW()
        WHERE id = $3
        RETURNING id, user_id, title, category, color_theme, goal_text,
                  skill_pack,
                  capture_mode,
                  started_at, archived_at,
                  milestone_length_days, milestone_started_on, milestone_chapter, milestone_start_day,
                  created_at, updated_at
      `,
      [params.nextMilestoneLengthDays, clipCount + 1, params.journeyId]
    );

    await client.query("COMMIT");

    return {
      status: "ok",
      journey: mapJourney(updateResult.rows[0]),
      reveal: mapJourneyReveal(revealResult.rows[0]),
      progressDays
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
