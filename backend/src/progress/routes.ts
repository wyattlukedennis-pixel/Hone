import type { FastifyInstance } from "fastify";

import { requireAuth } from "../auth/guard.js";
import { listClipsForJourney } from "../clips/repository.js";
import { getPool } from "../db/pool.js";
import { findJourneyByIdForUser } from "../journeys/repository.js";
import {
  createComparisonRender,
  createMilestoneRender,
  findComparisonRenderByIdForUser,
  findMilestoneRenderByIdForUser,
  listComparisonRendersForJourney,
  listMilestoneRendersForJourney
} from "./repository.js";

const comparisonTypes = new Set(["day1_vs_latest", "day7_vs_latest", "day30_vs_latest"] as const);
const milestoneDays = new Set([7, 30, 90, 365]);

type JourneyParams = {
  journeyId: string;
};

type ComparisonParams = {
  comparisonId: string;
};

type MilestoneParams = {
  milestoneId: string;
};

type MilestoneRenderParams = {
  journeyId: string;
  day: string;
};

type QueueComparisonBody = {
  comparisonType?: "day1_vs_latest" | "day7_vs_latest" | "day30_vs_latest";
};

function parseComparisonType(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (comparisonTypes.has(normalized as "day1_vs_latest" | "day7_vs_latest" | "day30_vs_latest")) {
    return normalized as "day1_vs_latest" | "day7_vs_latest" | "day30_vs_latest";
  }
  return null;
}

function uniqueDays(clips: { recordedOn: string }[]) {
  return new Set(clips.map((clip) => clip.recordedOn)).size;
}

function findComparisonPair(
  clips: Array<{ id: string; recordedAt: Date; recordedOn: string }>,
  comparisonType: "day1_vs_latest" | "day7_vs_latest" | "day30_vs_latest"
) {
  if (clips.length < 2) return null;
  const sortedByRecent = [...clips].sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime());
  const sortedByOldest = [...clips].sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
  const latest = sortedByRecent[0];

  if (comparisonType === "day1_vs_latest") {
    const dayOne = sortedByOldest[0];
    if (dayOne.id === latest.id) return null;
    return { thenClipId: dayOne.id, nowClipId: latest.id };
  }

  const targetDays = comparisonType === "day7_vs_latest" ? 7 : 30;
  const targetTimestamp = latest.recordedAt.getTime() - targetDays * 24 * 60 * 60 * 1000;
  const candidate =
    sortedByOldest.filter((clip) => clip.recordedAt.getTime() <= targetTimestamp).at(-1) ??
    sortedByOldest.find((clip) => clip.id !== latest.id) ??
    null;

  if (!candidate || candidate.id === latest.id) return null;
  return { thenClipId: candidate.id, nowClipId: latest.id };
}

export function registerProgressRoutes(app: FastifyInstance) {
  app.post<{ Params: JourneyParams; Body: QueueComparisonBody }>("/journeys/:journeyId/comparisons", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;

    const comparisonType = parseComparisonType(request.body?.comparisonType);
    if (!comparisonType) {
      return reply.code(400).send({ error: "INVALID_COMPARISON_TYPE" });
    }

    const pool = getPool();
    const journey = await findJourneyByIdForUser(pool, {
      journeyId: request.params.journeyId,
      userId: auth.user.id
    });
    if (!journey) return reply.code(404).send({ error: "JOURNEY_NOT_FOUND" });

    const clips = await listClipsForJourney(pool, journey.id);
    const pair = findComparisonPair(clips, comparisonType);
    if (!pair) {
      return reply.code(400).send({ error: "COMPARISON_NOT_AVAILABLE" });
    }

    const render = await createComparisonRender(pool, {
      journeyId: journey.id,
      userId: auth.user.id,
      comparisonType,
      thenClipId: pair.thenClipId,
      nowClipId: pair.nowClipId
    });

    return reply.code(202).send({ comparison: render });
  });

  app.get<{ Params: JourneyParams }>("/journeys/:journeyId/comparisons", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;

    const pool = getPool();
    const journey = await findJourneyByIdForUser(pool, {
      journeyId: request.params.journeyId,
      userId: auth.user.id
    });
    if (!journey) return reply.code(404).send({ error: "JOURNEY_NOT_FOUND" });

    const comparisons = await listComparisonRendersForJourney(pool, {
      journeyId: journey.id,
      userId: auth.user.id
    });
    return reply.send({ comparisons });
  });

  app.get<{ Params: ComparisonParams }>("/comparisons/:comparisonId", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;

    const pool = getPool();
    const comparison = await findComparisonRenderByIdForUser(pool, {
      comparisonRenderId: request.params.comparisonId,
      userId: auth.user.id
    });
    if (!comparison) return reply.code(404).send({ error: "COMPARISON_NOT_FOUND" });
    return reply.send({ comparison });
  });

  app.get<{ Params: JourneyParams }>("/journeys/:journeyId/milestones", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;

    const pool = getPool();
    const journey = await findJourneyByIdForUser(pool, {
      journeyId: request.params.journeyId,
      userId: auth.user.id
    });
    if (!journey) return reply.code(404).send({ error: "JOURNEY_NOT_FOUND" });

    const milestones = await listMilestoneRendersForJourney(pool, {
      journeyId: journey.id,
      userId: auth.user.id
    });
    return reply.send({ milestones });
  });

  app.post<{ Params: MilestoneRenderParams }>("/journeys/:journeyId/milestones/:day/render", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;

    const milestoneDay = Number.parseInt(request.params.day, 10);
    if (!Number.isInteger(milestoneDay) || !milestoneDays.has(milestoneDay)) {
      return reply.code(400).send({ error: "INVALID_MILESTONE_DAY" });
    }

    const pool = getPool();
    const journey = await findJourneyByIdForUser(pool, {
      journeyId: request.params.journeyId,
      userId: auth.user.id
    });
    if (!journey) return reply.code(404).send({ error: "JOURNEY_NOT_FOUND" });

    const clips = await listClipsForJourney(pool, journey.id);
    const recordedDays = uniqueDays(clips);
    if (recordedDays < milestoneDay) {
      return reply.code(400).send({
        error: "MILESTONE_NOT_REACHED",
        progressDays: recordedDays,
        milestoneDay
      });
    }

    const milestone = await createMilestoneRender(pool, {
      journeyId: journey.id,
      userId: auth.user.id,
      milestoneDay
    });

    return reply.code(202).send({ milestone });
  });

  app.get<{ Params: MilestoneParams }>("/milestones/:milestoneId", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;

    const pool = getPool();
    const milestone = await findMilestoneRenderByIdForUser(pool, {
      milestoneRenderId: request.params.milestoneId,
      userId: auth.user.id
    });
    if (!milestone) return reply.code(404).send({ error: "MILESTONE_NOT_FOUND" });
    return reply.send({ milestone });
  });
}
