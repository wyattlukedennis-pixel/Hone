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
  captureType?: "video" | "photo";
};

type CreateClipBody = {
  uploadId?: string;
  durationMs?: number;
  recordedAt?: string;
  recordedOn?: string;
  captureType?: "video" | "photo";
};

function sanitizeExtension(input: string) {
  const normalized = input.trim().toLowerCase();
  if (!normalized) return "mp4";
  return normalized.replace(/[^a-z0-9]/g, "") || "mp4";
}

function normalizeCaptureType(value: unknown) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "video" || normalized === "photo") return normalized;
  return null;
}

function getBaseUrl(protocol: string, host: string | undefined) {
  if (config.baseUrl) return config.baseUrl;
  const resolvedHost = host ?? `localhost:${config.port}`;
  return `${protocol}://${resolvedHost}`;
}

function normalizeRecordedOn(value: unknown) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  return normalized;
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

    const requestedCaptureType = normalizeCaptureType(request.body?.captureType);
    if (request.body?.captureType !== undefined && !requestedCaptureType) {
      return reply.code(400).send({ error: "INVALID_CAPTURE_TYPE" });
    }
    const captureType = requestedCaptureType ?? (journey.captureMode === "photo" ? "photo" : "video");
    if (journey.captureMode !== captureType) {
      return reply.code(400).send({ error: "CAPTURE_TYPE_NOT_ALLOWED" });
    }
    const defaultMimeType = captureType === "photo" ? "image/jpeg" : "video/mp4";
    const defaultFileExtension = captureType === "photo" ? "jpg" : "mp4";
    const mimeType =
      typeof request.body?.mimeType === "string" && request.body.mimeType.trim() ? request.body.mimeType.trim() : defaultMimeType;
    const extension = sanitizeExtension(
      typeof request.body?.fileExtension === "string" ? request.body.fileExtension : mimeType.split("/")[1] ?? defaultFileExtension
    );

    const upload = await createClipUpload(pool, {
      journeyId: journey.id,
      userId: auth.user.id,
      objectKey: `${auth.user.id}/${journey.id}/${randomUUID()}.${extension}`,
      mimeType,
      captureType
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

    const absolutePath = path.resolve(config.uploads.dir, upload.objectKey);
    if (!absolutePath.startsWith(config.uploads.dir)) {
      return reply.code(400).send({ error: "INVALID_UPLOAD_PATH" });
    }
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

    const rawDurationMs = Number(request.body?.durationMs ?? NaN);
    const defaultDurationMs = upload.captureType === "photo" ? 1000 : NaN;
    const durationMs = Number.isFinite(rawDurationMs) ? rawDurationMs : defaultDurationMs;
    if (!Number.isFinite(durationMs) || durationMs <= 0 || durationMs > 60_000) {
      return reply.code(400).send({ error: "INVALID_DURATION_MS" });
    }

    const recordedAtRaw = typeof request.body?.recordedAt === "string" ? request.body.recordedAt : null;
    const recordedAt = recordedAtRaw ? new Date(recordedAtRaw) : new Date();
    if (Number.isNaN(recordedAt.getTime())) {
      return reply.code(400).send({ error: "INVALID_RECORDED_AT" });
    }
    const normalizedRecordedOn = normalizeRecordedOn(request.body?.recordedOn);
    if (request.body?.recordedOn !== undefined && !normalizedRecordedOn) {
      return reply.code(400).send({ error: "INVALID_RECORDED_ON" });
    }
    const recordedOn = normalizedRecordedOn ?? recordedAt.toISOString().slice(0, 10);

    const baseUrl = getBaseUrl(request.protocol, request.headers.host);
    const clip = await upsertClipFromUpload(pool, {
      journeyId: journey.id,
      recordedOn,
      recordedAt,
      durationMs: Math.round(durationMs),
      captureType: upload.captureType,
      videoUrl: `${baseUrl}/media/${upload.objectKey}`
    });

    return reply.code(201).send({ clip });
  });

  // Metadata-only clip creation — file stays on device, no server upload needed.
  app.post<{ Params: JourneyParams; Body: CreateClipBody }>("/journeys/:journeyId/clips/local", async (request, reply) => {
    const auth = await requireAuth(request, reply);
    if (!auth) return;

    const pool = getPool();
    const journey = await findJourneyByIdForUser(pool, {
      journeyId: request.params.journeyId,
      userId: auth.user.id
    });
    if (!journey) return reply.code(404).send({ error: "JOURNEY_NOT_FOUND" });

    const rawCaptureType = normalizeCaptureType(request.body?.captureType);
    const captureType = rawCaptureType ?? journey.captureMode;

    const rawDurationMs = Number(request.body?.durationMs ?? NaN);
    const defaultDurationMs = captureType === "photo" ? 1000 : NaN;
    const durationMs = Number.isFinite(rawDurationMs) ? rawDurationMs : defaultDurationMs;
    if (!Number.isFinite(durationMs) || durationMs <= 0 || durationMs > 60_000) {
      return reply.code(400).send({ error: "INVALID_DURATION_MS" });
    }

    const recordedAtRaw = typeof request.body?.recordedAt === "string" ? request.body.recordedAt : null;
    const recordedAt = recordedAtRaw ? new Date(recordedAtRaw) : new Date();
    if (Number.isNaN(recordedAt.getTime())) {
      return reply.code(400).send({ error: "INVALID_RECORDED_AT" });
    }
    const normalizedRecordedOn = normalizeRecordedOn(request.body?.recordedOn);
    if (request.body?.recordedOn !== undefined && !normalizedRecordedOn) {
      return reply.code(400).send({ error: "INVALID_RECORDED_ON" });
    }
    const recordedOn = normalizedRecordedOn ?? recordedAt.toISOString().slice(0, 10);

    const clip = await upsertClipFromUpload(pool, {
      journeyId: journey.id,
      recordedOn,
      recordedAt,
      durationMs: Math.round(durationMs),
      captureType,
      videoUrl: "local://device"
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

    // Reset milestone progress back to chapter 1 when all clips are cleared (dev tools)
    await pool.query(
      `UPDATE journeys SET milestone_chapter = 1, milestone_start_day = 1, milestone_started_on = CURRENT_DATE WHERE id = $1`,
      [journey.id]
    );

    return reply.send({ success: true, deletedCount });
  });
}
