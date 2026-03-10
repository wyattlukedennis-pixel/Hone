import type { FastifyInstance } from "fastify";

import { requireAuth } from "../auth/guard.js";
import { getPool } from "../db/pool.js";
import {
  archiveJourney,
  createJourney,
  findJourneyByIdForUser,
  listActiveJourneysByUser,
  updateJourney
} from "./repository.js";

type CreateJourneyBody = {
  title?: string;
  category?: string | null;
  colorTheme?: string | null;
  goalText?: string | null;
};

type UpdateJourneyBody = {
  title?: string;
  category?: string | null;
  colorTheme?: string | null;
  goalText?: string | null;
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

    const pool = getPool();
    const journey = await createJourney(pool, {
      userId: auth.user.id,
      title: title.value,
      category: category.present ? category.value : null,
      colorTheme: colorTheme.present ? colorTheme.value : null,
      goalText: goalText.present ? goalText.value : null
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
