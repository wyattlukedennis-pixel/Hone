import type { Pool } from "pg";

type ClipUploadRow = {
  id: string;
  journey_id: string;
  user_id: string;
  object_key: string;
  mime_type: string;
  capture_type: "video" | "photo";
  upload_status: string;
  created_at: Date | string;
  uploaded_at: Date | string | null;
};

type ClipRow = {
  id: string;
  journey_id: string;
  recorded_on: Date | string;
  recorded_at: Date | string;
  duration_ms: number;
  capture_type: "video" | "photo";
  video_url: string;
  thumbnail_url: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

export type ClipUpload = {
  id: string;
  journeyId: string;
  userId: string;
  objectKey: string;
  mimeType: string;
  captureType: "video" | "photo";
  uploadStatus: string;
  createdAt: Date;
  uploadedAt: Date | null;
};

export type Clip = {
  id: string;
  journeyId: string;
  recordedOn: string;
  recordedAt: Date;
  durationMs: number;
  captureType: "video" | "photo";
  videoUrl: string;
  thumbnailUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function toDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

function mapClipUpload(row: ClipUploadRow): ClipUpload {
  return {
    id: row.id,
    journeyId: row.journey_id,
    userId: row.user_id,
    objectKey: row.object_key,
    mimeType: row.mime_type,
    captureType: row.capture_type,
    uploadStatus: row.upload_status,
    createdAt: toDate(row.created_at),
    uploadedAt: row.uploaded_at ? toDate(row.uploaded_at) : null
  };
}

function normalizeRecordedOn(value: Date | string) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.includes("T") ? value.slice(0, 10) : value;
}

function mapClip(row: ClipRow): Clip {
  return {
    id: row.id,
    journeyId: row.journey_id,
    recordedOn: normalizeRecordedOn(row.recorded_on),
    recordedAt: toDate(row.recorded_at),
    durationMs: row.duration_ms,
    captureType: row.capture_type,
    videoUrl: row.video_url,
    thumbnailUrl: row.thumbnail_url,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at)
  };
}

export async function createClipUpload(
  pool: Pool,
  params: { journeyId: string; userId: string; objectKey: string; mimeType: string; captureType: "video" | "photo" }
) {
  const result = await pool.query<ClipUploadRow>(
    `
      INSERT INTO clip_uploads (journey_id, user_id, object_key, mime_type, capture_type)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, journey_id, user_id, object_key, mime_type, capture_type, upload_status, created_at, uploaded_at
    `,
    [params.journeyId, params.userId, params.objectKey, params.mimeType, params.captureType]
  );

  return mapClipUpload(result.rows[0]);
}

export async function findClipUploadById(pool: Pool, uploadId: string) {
  const result = await pool.query<ClipUploadRow>(
    `
      SELECT id, journey_id, user_id, object_key, mime_type, capture_type, upload_status, created_at, uploaded_at
      FROM clip_uploads
      WHERE id = $1
      LIMIT 1
    `,
    [uploadId]
  );

  return result.rows[0] ? mapClipUpload(result.rows[0]) : null;
}

export async function markClipUploadUploaded(pool: Pool, uploadId: string) {
  const result = await pool.query<ClipUploadRow>(
    `
      UPDATE clip_uploads
      SET upload_status = 'uploaded', uploaded_at = NOW()
      WHERE id = $1
      RETURNING id, journey_id, user_id, object_key, mime_type, capture_type, upload_status, created_at, uploaded_at
    `,
    [uploadId]
  );

  return result.rows[0] ? mapClipUpload(result.rows[0]) : null;
}

export async function upsertClipFromUpload(
  pool: Pool,
  params: {
    journeyId: string;
    recordedOn: string;
    recordedAt: Date;
    durationMs: number;
    captureType: "video" | "photo";
    videoUrl: string;
  }
) {
  const result = await pool.query<ClipRow>(
    `
      INSERT INTO clips (journey_id, recorded_on, recorded_at, duration_ms, capture_type, video_url)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (journey_id, recorded_on, capture_type)
      DO UPDATE SET
        recorded_at = EXCLUDED.recorded_at,
        duration_ms = EXCLUDED.duration_ms,
        video_url = EXCLUDED.video_url,
        updated_at = NOW()
      RETURNING id, journey_id, recorded_on, recorded_at, duration_ms, capture_type, video_url, thumbnail_url, created_at, updated_at
    `,
    [params.journeyId, params.recordedOn, params.recordedAt.toISOString(), params.durationMs, params.captureType, params.videoUrl]
  );

  return mapClip(result.rows[0]);
}

export async function listClipsForJourney(pool: Pool, journeyId: string) {
  const result = await pool.query<ClipRow>(
    `
      SELECT id, journey_id, recorded_on, recorded_at, duration_ms, capture_type, video_url, thumbnail_url, created_at, updated_at
      FROM clips
      WHERE journey_id = $1
      ORDER BY recorded_at DESC
    `,
    [journeyId]
  );

  return result.rows.map(mapClip);
}

export async function deleteClipsForJourney(pool: Pool, journeyId: string) {
  const result = await pool.query(
    `
      DELETE FROM clips
      WHERE journey_id = $1
    `,
    [journeyId]
  );

  return result.rowCount ?? 0;
}
