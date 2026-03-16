import type { FastifyInstance } from "fastify";

import { requireAuth } from "../auth/guard.js";
import { getPool } from "../db/pool.js";
import {
  archiveJourney,
  createJourney,
  findJourneyByIdForUser,
  listActiveJourneysByUser,
  listJourneyReveals,
  startNextMilestoneChapter,
  updateJourney
} from "./repository.js";

const milestoneLengthOptions = new Set([7, 14, 30, 100]);
const captureModeOptions = new Set(["video", "photo"] as const);

type CreateJourneyBody = {
  title?: string;
  category?: string | null;
  colorTheme?: string | null;
  goalText?: string | null;
  captureMode?: "video" | "photo";
  milestoneLengthDays?: number;
};

type UpdateJourneyBody = {
  title?: string;
  category?: string | null;
  colorTheme?: string | null;
  goalText?: string | null;
  captureMode?: "video" | "photo";
  milestoneLengthDays?: number;
};

type NextMilestoneBody = {
  milestoneLengthDays?: number;
};

type JourneyParams = {
  journeyId: string;
};

function validateJourneyTitle(value: unknown) {
  if (typeof value !== "string") return { error: "TITLE_REQUIRED" as const };
  const normalized = value.trim();
  if (!normalized) return { error: "TITLE_REQUIRED" as const };
  if (normalized.length > 120) return { error: "TITLE_TOO_LONG" as const };
  return { value: normalized };
}

function normalizeOptionalText(value: unknown, maxLength: number) {
  if (value === undefined) return { present: false as const };
  if (value === null) return { present: true as const, value: null as string | null };
  if (typeof value !== "string") return { error: "INVALID_FIELD_TYPE" as const };

  const normalized = value.trim();
  if (!normalized) return { present: true as const, value: null as string | null };
  if (normalized.length > maxLength) return { error: "FIELD_TOO_LONG" as const };

  return { present: true as const, value: normalized as string | null };
}

function normalizeMilestoneLength(value: unknown, { required }: { required: boolean }) {
  if (value === undefined || value === null) {
    if (required) return { error: "MILESTONE_LENGTH_REQUIRED" as const };
    return { present: false as const };
  }

  if (typeof value !== "number" || !Number.isInteger(value)) {
    return { error: "INVALID_MILESTONE_LENGTH" as const };
  }

  if (!milestoneLengthOptions.has(value)) {
    return { error: "INVALID_MILESTONE_LENGTH" as const };
  }

  return {
    present: true as const,
    value
  };
}

function normalizeCaptureMode(value: unknown, { required }: { required: boolean }) {
  if (value === undefined || value === null) {
    if (required) return { error: "CAPTURE_MODE_REQUIRED" as const };
    return { present: false as const };
  }

  if (typeof value !== "string") {
    return { error: "INVALID_CAPTURE_MODE" as const };
  }

  const normalized = value.trim().toLowerCase();
  if (!captureModeOptions.has(normalized as "video" | "photo")) {
    return { error: "INVALID_CAPTURE_MODE" as const };
  }

  return {
    present: true as const,
    value: normalized as "video" | "photo"
  };
}

export function registerJourneyRoutes(app: FastifyInstance) {
  app.get("/journeys", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;

    const pool = getPool();
    const journeys = await listActiveJourneysByUser(pool, auth.user.id);
    return reply.send({ journeys });
  });

  app.post<{ Body: CreateJourneyBody }>("/journeys", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;

    const title = validateJourneyTitle(request.body?.title);
    if ("error" in title) {
      return reply.code(400).send({ error: title.error });
    }

    const category = normalizeOptionalText(request.body?.category, 80);
    if ("error" in category) return reply.code(400).send({ error: "INVALID_CATEGORY" });

    const colorTheme = normalizeOptionalText(request.body?.colorTheme, 40);
    if ("error" in colorTheme) return reply.code(400).send({ error: "INVALID_COLOR_THEME" });

    const goalText = normalizeOptionalText(request.body?.goalText, 300);
    if ("error" in goalText) return reply.code(400).send({ error: "INVALID_GOAL_TEXT" });

    const milestoneLength = normalizeMilestoneLength(request.body?.milestoneLengthDays, { required: false });
    if ("error" in milestoneLength) return reply.code(400).send({ error: milestoneLength.error });
    const captureMode = normalizeCaptureMode(request.body?.captureMode, { required: false });
    if ("error" in captureMode) return reply.code(400).send({ error: captureMode.error });
    const resolvedCaptureMode = captureMode.present ? captureMode.value : "video";

    const pool = getPool();
    const journey = await createJourney(pool, {
      userId: auth.user.id,
      title: title.value,
      category: category.present ? category.value : null,
      colorTheme: colorTheme.present ? colorTheme.value : null,
      goalText: goalText.present ? goalText.value : null,
      captureMode: resolvedCaptureMode,
      milestoneLengthDays: milestoneLength.present ? milestoneLength.value : 7
    });

    return reply.code(201).send({ journey });
  });

  app.get<{ Params: JourneyParams }>("/journeys/:journeyId", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;

    const pool = getPool();
    const journey = await findJourneyByIdForUser(pool, {
      journeyId: request.params.journeyId,
      userId: auth.user.id
    });

    if (!journey) {
      return reply.code(404).send({ error: "JOURNEY_NOT_FOUND" });
    }

    return reply.send({ journey });
  });

  app.get<{ Params: JourneyParams }>("/journeys/:journeyId/reveals", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;

    const pool = getPool();
    const journey = await findJourneyByIdForUser(pool, {
      journeyId: request.params.journeyId,
      userId: auth.user.id
    });

    if (!journey) {
      return reply.code(404).send({ error: "JOURNEY_NOT_FOUND" });
    }

    const reveals = await listJourneyReveals(pool, {
      journeyId: request.params.journeyId,
      userId: auth.user.id
    });

    return reply.send({ reveals });
  });

  app.patch<{ Params: JourneyParams; Body: UpdateJourneyBody }>("/journeys/:journeyId", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;

    const updates: UpdateJourneyBody = {};
    let hasUpdate = false;

    if (request.body?.title !== undefined) {
      const title = validateJourneyTitle(request.body.title);
      if ("error" in title) return reply.code(400).send({ error: title.error });
      updates.title = title.value;
      hasUpdate = true;
    }

    const category = normalizeOptionalText(request.body?.category, 80);
    if ("error" in category) return reply.code(400).send({ error: "INVALID_CATEGORY" });
    if (category.present) {
      updates.category = category.value;
      hasUpdate = true;
    }

    const colorTheme = normalizeOptionalText(request.body?.colorTheme, 40);
    if ("error" in colorTheme) return reply.code(400).send({ error: "INVALID_COLOR_THEME" });
    if (colorTheme.present) {
      updates.colorTheme = colorTheme.value;
      hasUpdate = true;
    }

    const goalText = normalizeOptionalText(request.body?.goalText, 300);
    if ("error" in goalText) return reply.code(400).send({ error: "INVALID_GOAL_TEXT" });
    if (goalText.present) {
      updates.goalText = goalText.value;
      hasUpdate = true;
    }

    const milestoneLength = normalizeMilestoneLength(request.body?.milestoneLengthDays, { required: false });
    if ("error" in milestoneLength) return reply.code(400).send({ error: milestoneLength.error });
    if (milestoneLength.present) {
      updates.milestoneLengthDays = milestoneLength.value;
      hasUpdate = true;
    }
    const captureMode = normalizeCaptureMode(request.body?.captureMode, { required: false });
    if ("error" in captureMode) return reply.code(400).send({ error: captureMode.error });
    if (captureMode.present) {
      updates.captureMode = captureMode.value;
      hasUpdate = true;
    }

    if (!hasUpdate) {
      return reply.code(400).send({ error: "NO_UPDATES_PROVIDED" });
    }

    const pool = getPool();
    const journey = await updateJourney(pool, {
      journeyId: request.params.journeyId,
      userId: auth.user.id,
      updates
    });

    if (!journey) {
      return reply.code(404).send({ error: "JOURNEY_NOT_FOUND" });
    }

    return reply.send({ journey });
  });

  app.post<{ Params: JourneyParams; Body: NextMilestoneBody }>("/journeys/:journeyId/next-milestone", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;

    const milestoneLength = normalizeMilestoneLength(request.body?.milestoneLengthDays, { required: true });
    if ("error" in milestoneLength) {
      return reply.code(400).send({ error: milestoneLength.error });
    }
    if (!milestoneLength.present) {
      return reply.code(400).send({ error: "MILESTONE_LENGTH_REQUIRED" });
    }

    const pool = getPool();
    const result = await startNextMilestoneChapter(pool, {
      journeyId: request.params.journeyId,
      userId: auth.user.id,
      nextMilestoneLengthDays: milestoneLength.value
    });

    if (result.status === "journey_not_found") {
      return reply.code(404).send({ error: "JOURNEY_NOT_FOUND" });
    }

    if (result.status === "milestone_not_reached") {
      return reply.code(400).send({
        error: "MILESTONE_NOT_REACHED",
        progressDays: result.progressDays,
        targetDays: result.targetDays
      });
    }

    return reply.send({
      journey: result.journey,
      reveal: result.reveal,
      progressDays: result.progressDays
    });
  });

  app.delete<{ Params: JourneyParams }>("/journeys/:journeyId", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;

    const pool = getPool();
    const journey = await archiveJourney(pool, {
      journeyId: request.params.journeyId,
      userId: auth.user.id
    });

    if (!journey) {
      return reply.code(404).send({ error: "JOURNEY_NOT_FOUND" });
    }

    return reply.send({ success: true });
  });
}
