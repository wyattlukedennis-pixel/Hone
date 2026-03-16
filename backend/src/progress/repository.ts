import type { Pool } from "pg";

type RenderStatus = "queued" | "processing" | "complete" | "failed";
type ComparisonType = "day1_vs_latest" | "day7_vs_latest" | "day30_vs_latest";

type ComparisonRenderRow = {
  id: string;
  journey_id: string;
  user_id: string;
  comparison_type: ComparisonType;
  then_clip_id: string;
  now_clip_id: string;
  render_status: RenderStatus;
  output_url: string | null;
  error_message: string | null;
  requested_at: Date | string;
  started_at: Date | string | null;
  completed_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type MilestoneRenderRow = {
  id: string;
  journey_id: string;
  user_id: string;
  milestone_day: number;
  render_status: RenderStatus;
  output_url: string | null;
  error_message: string | null;
  requested_at: Date | string;
  started_at: Date | string | null;
  completed_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

export type ComparisonRender = {
  id: string;
  journeyId: string;
  userId: string;
  comparisonType: ComparisonType;
  thenClipId: string;
  nowClipId: string;
  renderStatus: RenderStatus;
  outputUrl: string | null;
  errorMessage: string | null;
  requestedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type MilestoneRender = {
  id: string;
  journeyId: string;
  userId: string;
  milestoneDay: number;
  renderStatus: RenderStatus;
  outputUrl: string | null;
  errorMessage: string | null;
  requestedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function toDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

function mapComparisonRender(row: ComparisonRenderRow): ComparisonRender {
  return {
    id: row.id,
    journeyId: row.journey_id,
    userId: row.user_id,
    comparisonType: row.comparison_type,
    thenClipId: row.then_clip_id,
    nowClipId: row.now_clip_id,
    renderStatus: row.render_status,
    outputUrl: row.output_url,
    errorMessage: row.error_message,
    requestedAt: toDate(row.requested_at),
    startedAt: row.started_at ? toDate(row.started_at) : null,
    completedAt: row.completed_at ? toDate(row.completed_at) : null,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at)
  };
}

function mapMilestoneRender(row: MilestoneRenderRow): MilestoneRender {
  return {
    id: row.id,
    journeyId: row.journey_id,
    userId: row.user_id,
    milestoneDay: row.milestone_day,
    renderStatus: row.render_status,
    outputUrl: row.output_url,
    errorMessage: row.error_message,
    requestedAt: toDate(row.requested_at),
    startedAt: row.started_at ? toDate(row.started_at) : null,
    completedAt: row.completed_at ? toDate(row.completed_at) : null,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at)
  };
}

export async function createComparisonRender(
  pool: Pool,
  params: {
    journeyId: string;
    userId: string;
    comparisonType: ComparisonType;
    thenClipId: string;
    nowClipId: string;
  }
) {
  const result = await pool.query<ComparisonRenderRow>(
    `
      INSERT INTO comparison_renders (journey_id, user_id, comparison_type, then_clip_id, now_clip_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, journey_id, user_id, comparison_type, then_clip_id, now_clip_id, render_status,
                output_url, error_message, requested_at, started_at, completed_at, created_at, updated_at
    `,
    [params.journeyId, params.userId, params.comparisonType, params.thenClipId, params.nowClipId]
  );

  return mapComparisonRender(result.rows[0]);
}

export async function listComparisonRendersForJourney(pool: Pool, params: { journeyId: string; userId: string }) {
  const result = await pool.query<ComparisonRenderRow>(
    `
      SELECT cr.id, cr.journey_id, cr.user_id, cr.comparison_type, cr.then_clip_id, cr.now_clip_id, cr.render_status,
             cr.output_url, cr.error_message, cr.requested_at, cr.started_at, cr.completed_at, cr.created_at, cr.updated_at
      FROM comparison_renders cr
      INNER JOIN journeys j ON j.id = cr.journey_id
      WHERE cr.journey_id = $1 AND j.user_id = $2
      ORDER BY cr.requested_at DESC
    `,
    [params.journeyId, params.userId]
  );

  return result.rows.map(mapComparisonRender);
}

export async function findComparisonRenderByIdForUser(pool: Pool, params: { comparisonRenderId: string; userId: string }) {
  const result = await pool.query<ComparisonRenderRow>(
    `
      SELECT cr.id, cr.journey_id, cr.user_id, cr.comparison_type, cr.then_clip_id, cr.now_clip_id, cr.render_status,
             cr.output_url, cr.error_message, cr.requested_at, cr.started_at, cr.completed_at, cr.created_at, cr.updated_at
      FROM comparison_renders cr
      INNER JOIN journeys j ON j.id = cr.journey_id
      WHERE cr.id = $1 AND j.user_id = $2
      LIMIT 1
    `,
    [params.comparisonRenderId, params.userId]
  );

  return result.rows[0] ? mapComparisonRender(result.rows[0]) : null;
}

export async function createMilestoneRender(pool: Pool, params: { journeyId: string; userId: string; milestoneDay: number }) {
  const result = await pool.query<MilestoneRenderRow>(
    `
      INSERT INTO milestone_renders (journey_id, user_id, milestone_day)
      VALUES ($1, $2, $3)
      RETURNING id, journey_id, user_id, milestone_day, render_status, output_url, error_message,
                requested_at, started_at, completed_at, created_at, updated_at
    `,
    [params.journeyId, params.userId, params.milestoneDay]
  );

  return mapMilestoneRender(result.rows[0]);
}

export async function listMilestoneRendersForJourney(pool: Pool, params: { journeyId: string; userId: string }) {
  const result = await pool.query<MilestoneRenderRow>(
    `
      SELECT mr.id, mr.journey_id, mr.user_id, mr.milestone_day, mr.render_status, mr.output_url, mr.error_message,
             mr.requested_at, mr.started_at, mr.completed_at, mr.created_at, mr.updated_at
      FROM milestone_renders mr
      INNER JOIN journeys j ON j.id = mr.journey_id
      WHERE mr.journey_id = $1 AND j.user_id = $2
      ORDER BY mr.requested_at DESC
    `,
    [params.journeyId, params.userId]
  );

  return result.rows.map(mapMilestoneRender);
}

export async function findMilestoneRenderByIdForUser(pool: Pool, params: { milestoneRenderId: string; userId: string }) {
  const result = await pool.query<MilestoneRenderRow>(
    `
      SELECT mr.id, mr.journey_id, mr.user_id, mr.milestone_day, mr.render_status, mr.output_url, mr.error_message,
             mr.requested_at, mr.started_at, mr.completed_at, mr.created_at, mr.updated_at
      FROM milestone_renders mr
      INNER JOIN journeys j ON j.id = mr.journey_id
      WHERE mr.id = $1 AND j.user_id = $2
      LIMIT 1
    `,
    [params.milestoneRenderId, params.userId]
  );

  return result.rows[0] ? mapMilestoneRender(result.rows[0]) : null;
}
