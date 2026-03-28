import type { FastifyInstance } from "fastify";

import { requireAuth } from "../auth/guard.js";
import { listClipsForJourney } from "../clips/repository.js";
import { getPool } from "../db/pool.js";
import { findJourneyByIdForUser } from "../journeys/repository.js";
import { renderRevealMontage, renderPhotoTimelapse } from "./revealRenderer.js";
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

type RenderRevealBody = {
  chapterNumber?: number;
  milestoneLengthDays?: number;
  progressDays?: number;
  currentStreak?: number;
  clipIds?: string[];
  storylineHeadline?: string;
  storylineCaption?: string;
  storylineReflection?: string;
};

function parseComparisonType(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (comparisonTypes.has(normalized as "day1_vs_latest" | "day7_vs_latest" | "day30_vs_latest")) {
    return normalized as "day1_vs_latest" | "day7_vs_latest" | "day30_vs_latest";
  }
  return null;
}

function normalizePositiveInt(value: unknown, fallback: number, max = 9999) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const normalized = Math.floor(value);
  if (normalized < 1) return fallback;
  return Math.min(normalized, max);
}

function normalizeNonNegativeInt(value: unknown, fallback: number, max = 99999) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const normalized = Math.floor(value);
  if (normalized < 0) return fallback;
  return Math.min(normalized, max);
}

function normalizeClipIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function normalizeStorylineText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

function dedupeClipOrder<T extends { id: string }>(clips: T[]) {
  const seen = new Set<string>();
  const deduped: T[] = [];
  for (const clip of clips) {
    if (seen.has(clip.id)) continue;
    seen.add(clip.id);
    deduped.push(clip);
  }
  return deduped;
}

function getBaseUrl(protocol: string, host: string | undefined) {
  const resolvedHost = host ?? "localhost:4000";
  return `${protocol}://${resolvedHost}`;
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
  app.post<{ Params: JourneyParams; Body: RenderRevealBody }>("/journeys/:journeyId/reveal/render", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;

    const chapterNumber = normalizePositiveInt(request.body?.chapterNumber, 1, 1000);
    const milestoneLengthDays = normalizePositiveInt(request.body?.milestoneLengthDays, 7, 365);
    const progressDays = normalizeNonNegativeInt(request.body?.progressDays, 0, 3650);
    const currentStreak = normalizeNonNegativeInt(request.body?.currentStreak, 0, 3650);
    const requestedClipIds = normalizeClipIds(request.body?.clipIds);
    const storylineHeadline = normalizeStorylineText(request.body?.storylineHeadline, 96);
    const storylineCaption = normalizeStorylineText(request.body?.storylineCaption, 132);
    const storylineReflection = normalizeStorylineText(request.body?.storylineReflection, 180);

    const pool = getPool();
    const journey = await findJourneyByIdForUser(pool, {
      journeyId: request.params.journeyId,
      userId: auth.user.id
    });
    if (!journey) return reply.code(404).send({ error: "JOURNEY_NOT_FOUND" });

    const clips = await listClipsForJourney(pool, journey.id);
    const clipMap = new Map(clips.map((clip) => [clip.id, clip]));
    const requestedClips =
      requestedClipIds.length > 0
        ? requestedClipIds.map((clipId) => clipMap.get(clipId)).filter((clip): clip is NonNullable<typeof clip> => Boolean(clip))
        : [];
    const fallbackRecent = [...clips].sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime()).slice(-12);
    const selectedClips =
      requestedClips.length >= 2
        ? dedupeClipOrder(requestedClips).slice(0, 12)
        : dedupeClipOrder([...requestedClips, ...fallbackRecent]).slice(0, 12);

    if (!selectedClips.length) {
      return reply.code(400).send({ error: "NO_CLIPS_AVAILABLE" });
    }

    try {
      const render = await renderRevealMontage({
        journeyId: journey.id,
        journeyTitle: journey.title,
        chapterNumber,
        milestoneLengthDays,
        progressDays,
        currentStreak,
        storylineHeadline,
        storylineCaption,
        storylineReflection,
        clips: selectedClips
      });

      const baseUrl = getBaseUrl(request.protocol, request.headers.host);
      return reply.code(201).send({
        renderUrl: `${baseUrl}/media/${render.outputRelativePath}`,
        cacheHit: render.cacheHit,
        renderedClipCount: render.clipCount,
        skippedClipCount: render.skippedClipCount
      });
    } catch (error) {
      request.log.error({ err: error }, "reveal render failed");
      return reply.code(500).send({ error: "REVEAL_RENDER_FAILED" });
    }
  });

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

  // -----------------------------------------------------------------------
  // Photo timelapse render
  // -----------------------------------------------------------------------
  app.post<{
    Params: { journeyId: string };
    Body: { holdMs?: number };
  }>("/journeys/:journeyId/timelapse/render", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;

    const pool = getPool();
    const journey = await findJourneyByIdForUser(pool, {
      journeyId: request.params.journeyId,
      userId: auth.user.id
    });
    if (!journey) return reply.code(404).send({ error: "JOURNEY_NOT_FOUND" });

    const holdMs = Number(request.body?.holdMs) || 500;
    const clips = await listClipsForJourney(pool, request.params.journeyId);
    const photoClips = clips.filter((c) => c.captureType === "photo");

    if (!photoClips.length) {
      return reply.code(400).send({ error: "NO_PHOTO_CLIPS" });
    }

    const result = await renderPhotoTimelapse({
      journeyId: request.params.journeyId,
      clips: photoClips,
      holdMs,
    });

    return reply.send({
      url: `/media/${result.outputRelativePath}`,
      cacheHit: result.cacheHit,
      photoCount: result.photoCount,
    });
  });
}
