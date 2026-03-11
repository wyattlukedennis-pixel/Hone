import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { randomUUID } from "node:crypto";

import type { FastifyInstance } from "fastify";

import { requireAuth } from "../auth/guard.js";
import { config } from "../config.js";
import { getPool } from "../db/pool.js";
import { findJourneyByIdForUser } from "../journeys/repository.js";
import {
  createClipUpload,
  deleteClipsForJourney,
  findClipUploadById,
  listClipsForJourney,
  markClipUploadUploaded,
  upsertClipFromUpload
} from "./repository.js";

type JourneyParams = {
  journeyId: string;
};

type UploadParams = {
  uploadId: string;
};

type CreateUploadUrlBody = {
  mimeType?: string;
  fileExtension?: string;
};

type CreateClipBody = {
  uploadId?: string;
  durationMs?: number;
  recordedAt?: string;
};

function sanitizeExtension(input: string) {
  const normalized = input.trim().toLowerCase();
  if (!normalized) return "mp4";
  return normalized.replace(/[^a-z0-9]/g, "") || "mp4";
}

function getBaseUrl(protocol: string, host: string | undefined) {
  const resolvedHost = host ?? "localhost:4000";
  return `${protocol}://${resolvedHost}`;
}

export function registerClipRoutes(app: FastifyInstance) {
  app.post<{ Params: JourneyParams; Body: CreateUploadUrlBody }>("/journeys/:journeyId/clips/upload-url", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;

    const pool = getPool();
    const journey = await findJourneyByIdForUser(pool, {
      journeyId: request.params.journeyId,
      userId: auth.user.id
    });
    if (!journey) return reply.code(404).send({ error: "JOURNEY_NOT_FOUND" });

    const mimeType =
      typeof request.body?.mimeType === "string" && request.body.mimeType.trim() ? request.body.mimeType.trim() : "video/mp4";
    const extension = sanitizeExtension(
      typeof request.body?.fileExtension === "string" ? request.body.fileExtension : mimeType.split("/")[1] ?? "mp4"
    );

    const upload = await createClipUpload(pool, {
      journeyId: journey.id,
      userId: auth.user.id,
      objectKey: `${auth.user.id}/${journey.id}/${randomUUID()}.${extension}`,
      mimeType
    });

    const baseUrl = getBaseUrl(request.protocol, request.headers.host);
    return reply.code(201).send({
      uploadId: upload.id,
      uploadUrl: `${baseUrl}/uploads/${upload.id}`,
      uploadMethod: "POST",
      fileField: "file",
      mediaUrl: `${baseUrl}/media/${upload.objectKey}`
    });
  });

  app.post<{ Params: UploadParams }>("/uploads/:uploadId", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;

    const pool = getPool();
    const upload = await findClipUploadById(pool, request.params.uploadId);
    if (!upload || upload.userId !== auth.user.id) {
      return reply.code(404).send({ error: "UPLOAD_NOT_FOUND" });
    }
    if (upload.uploadStatus === "uploaded") {
      return reply.send({ success: true, alreadyUploaded: true });
    }

    const file = await request.file();
    if (!file) return reply.code(400).send({ error: "FILE_REQUIRED" });

    const absolutePath = path.join(config.uploads.dir, upload.objectKey);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await pipeline(file.file, createWriteStream(absolutePath));

    await markClipUploadUploaded(pool, upload.id);

    const baseUrl = getBaseUrl(request.protocol, request.headers.host);
    return reply.send({
      success: true,
      mediaUrl: `${baseUrl}/media/${upload.objectKey}`
    });
  });

  app.post<{ Params: JourneyParams; Body: CreateClipBody }>("/journeys/:journeyId/clips", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;

    const uploadId = typeof request.body?.uploadId === "string" ? request.body.uploadId : "";
    if (!uploadId) return reply.code(400).send({ error: "UPLOAD_ID_REQUIRED" });

    const durationMs = Number(request.body?.durationMs ?? 0);
    if (!Number.isFinite(durationMs) || durationMs <= 0 || durationMs > 60_000) {
      return reply.code(400).send({ error: "INVALID_DURATION_MS" });
    }

    const pool = getPool();
    const journey = await findJourneyByIdForUser(pool, {
      journeyId: request.params.journeyId,
      userId: auth.user.id
    });
    if (!journey) return reply.code(404).send({ error: "JOURNEY_NOT_FOUND" });

    const upload = await findClipUploadById(pool, uploadId);
    if (!upload || upload.userId !== auth.user.id || upload.journeyId !== journey.id) {
      return reply.code(404).send({ error: "UPLOAD_NOT_FOUND" });
    }
    if (upload.uploadStatus !== "uploaded") {
      return reply.code(409).send({ error: "UPLOAD_NOT_READY" });
    }

    const recordedAtRaw = typeof request.body?.recordedAt === "string" ? request.body.recordedAt : null;
    const recordedAt = recordedAtRaw ? new Date(recordedAtRaw) : new Date();
    if (Number.isNaN(recordedAt.getTime())) {
      return reply.code(400).send({ error: "INVALID_RECORDED_AT" });
    }
    const recordedOn = recordedAt.toISOString().slice(0, 10);

    const baseUrl = getBaseUrl(request.protocol, request.headers.host);
    const clip = await upsertClipFromUpload(pool, {
      journeyId: journey.id,
      recordedOn,
      recordedAt,
      durationMs: Math.round(durationMs),
      videoUrl: `${baseUrl}/media/${upload.objectKey}`
    });

    return reply.code(201).send({ clip });
  });

  app.get<{ Params: JourneyParams }>("/journeys/:journeyId/clips", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;

    const pool = getPool();
    const journey = await findJourneyByIdForUser(pool, {
      journeyId: request.params.journeyId,
      userId: auth.user.id
    });
    if (!journey) return reply.code(404).send({ error: "JOURNEY_NOT_FOUND" });

    const clips = await listClipsForJourney(pool, journey.id);
    return reply.send({ clips });
  });

  app.delete<{ Params: JourneyParams }>("/journeys/:journeyId/clips", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;

    const pool = getPool();
    const journey = await findJourneyByIdForUser(pool, {
      journeyId: request.params.journeyId,
      userId: auth.user.id
    });
    if (!journey) return reply.code(404).send({ error: "JOURNEY_NOT_FOUND" });

    const deletedCount = await deleteClipsForJourney(pool, journey.id);
    return reply.send({ success: true, deletedCount });
  });
}
