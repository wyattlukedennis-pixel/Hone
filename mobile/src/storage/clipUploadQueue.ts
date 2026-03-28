import AsyncStorage from "@react-native-async-storage/async-storage";

import { createClipLocal } from "../api/clips";
import { persistClipFile, registerClipLocalUri } from "./clipFileStore";

const CLIP_UPLOAD_QUEUE_KEY = "hone.clips.uploadQueue.v1";
const MAX_RETRY_BACKOFF_MS = 3 * 60 * 1000;
const BASE_RETRY_BACKOFF_MS = 4000;

export type ClipUploadQueueStatus = "queued" | "uploading" | "uploaded" | "processing" | "ready" | "failed";

export type ClipUploadQueueItem = {
  id: string;
  journeyId: string;
  captureType: "video" | "photo";
  fileUri: string;
  durationMs: number;
  recordedAt: string;
  recordedOn: string;
  status: ClipUploadQueueStatus;
  attempts: number;
  createdAt: string;
  lastAttemptAt: string | null;
  nextRetryAt: string | null;
  lastErrorMessage: string | null;
};

export type ClipUploadQueueEvent =
  | {
      type: "status";
      itemId: string;
      journeyId: string;
      status: ClipUploadQueueStatus;
    }
  | {
      type: "success";
      itemId: string;
      journeyId: string;
    }
  | {
      type: "failed";
      itemId: string;
      journeyId: string;
      attempts: number;
      errorMessage: string;
      nextRetryAt: string;
    };

type ProcessQueueOptions = {
  targetItemId?: string;
  onEvent?: (event: ClipUploadQueueEvent) => void;
};

type ProcessQueueResult = {
  remaining: number;
  succeeded: number;
  failed: number;
  target: { itemId: string; success: boolean; errorMessage?: string } | null;
};

let queueLock: Promise<void> = Promise.resolve();

function toLocalDayKey(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}


function withQueueLock<T>(task: () => Promise<T>) {
  let release!: () => void;
  const waitForTurn = queueLock;
  queueLock = new Promise<void>((resolve) => {
    release = resolve;
  });

  return waitForTurn.then(async () => {
    try {
      return await task();
    } finally {
      release();
    }
  });
}

function makeQueueId() {
  return `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Unknown upload error";
}

async function readQueue() {
  try {
    const raw = await AsyncStorage.getItem(CLIP_UPLOAD_QUEUE_KEY);
    if (!raw) return [] as ClipUploadQueueItem[];
    const parsed = JSON.parse(raw) as Array<Partial<ClipUploadQueueItem>>;
    if (!Array.isArray(parsed)) return [] as ClipUploadQueueItem[];
    return parsed
      .filter((item) => Boolean(item?.id && item?.journeyId && item?.fileUri))
      .map((item): ClipUploadQueueItem => ({
        id: String(item.id),
        journeyId: String(item.journeyId),
        captureType: item.captureType === "photo" ? "photo" : "video",
        fileUri: String(item.fileUri),
        durationMs: typeof item.durationMs === "number" ? item.durationMs : 1000,
        recordedAt: typeof item.recordedAt === "string" ? item.recordedAt : new Date().toISOString(),
        recordedOn:
          typeof item.recordedOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.recordedOn)
            ? item.recordedOn
            : toLocalDayKey(new Date(typeof item.recordedAt === "string" ? item.recordedAt : Date.now())),
        status:
          item.status === "uploading" ||
          item.status === "uploaded" ||
          item.status === "processing" ||
          item.status === "ready" ||
          item.status === "failed"
            ? item.status
            : "queued",
        attempts: typeof item.attempts === "number" ? item.attempts : 0,
        createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString(),
        lastAttemptAt: typeof item.lastAttemptAt === "string" ? item.lastAttemptAt : null,
        nextRetryAt: typeof item.nextRetryAt === "string" ? item.nextRetryAt : null,
        lastErrorMessage: typeof item.lastErrorMessage === "string" ? item.lastErrorMessage : null
      }));
  } catch {
    return [] as ClipUploadQueueItem[];
  }
}

async function writeQueue(queue: ClipUploadQueueItem[]) {
  await AsyncStorage.setItem(CLIP_UPLOAD_QUEUE_KEY, JSON.stringify(queue));
}

function shouldRetryNow(item: ClipUploadQueueItem) {
  if (!item.nextRetryAt) return true;
  const next = new Date(item.nextRetryAt);
  if (Number.isNaN(next.getTime())) return true;
  return Date.now() >= next.getTime();
}

function calcNextRetryAt(attempts: number) {
  const backoff = Math.min(MAX_RETRY_BACKOFF_MS, BASE_RETRY_BACKOFF_MS * 2 ** Math.max(0, attempts - 1));
  return new Date(Date.now() + backoff).toISOString();
}

export async function enqueueClipUpload(input: {
  journeyId: string;
  captureType: "video" | "photo";
  fileUri: string;
  durationMs: number;
  recordedAt: string;
  recordedOn: string;
}) {
  return withQueueLock(async () => {
    const queue = await readQueue();
    const item: ClipUploadQueueItem = {
      id: makeQueueId(),
      journeyId: input.journeyId,
      captureType: input.captureType,
      fileUri: input.fileUri,
      durationMs: input.durationMs,
      recordedAt: input.recordedAt,
      recordedOn: input.recordedOn,
      status: "queued",
      attempts: 0,
      createdAt: new Date().toISOString(),
      lastAttemptAt: null,
      nextRetryAt: null,
      lastErrorMessage: null
    };
    queue.push(item);
    await writeQueue(queue);
    return item;
  });
}

export async function getPendingClipUploadCount() {
  const queue = await readQueue();
  return queue.length;
}

export async function processClipUploadQueue(token: string, options: ProcessQueueOptions = {}): Promise<ProcessQueueResult> {
  return withQueueLock(async () => {
    let queue = await readQueue();
    const orderedIds = queue.map((item) => item.id);
    let targetResult: ProcessQueueResult["target"] = null;
    let succeeded = 0;
    let failed = 0;

    for (const itemId of orderedIds) {
      const currentIndex = queue.findIndex((item) => item.id === itemId);
      if (currentIndex < 0) continue;
      const item = queue[currentIndex];

      if (!shouldRetryNow(item) && item.id !== options.targetItemId) {
        continue;
      }

      const emit = (event: ClipUploadQueueEvent) => {
        options.onEvent?.(event);
      };

      const updateItem = async (updates: Partial<ClipUploadQueueItem>) => {
        queue = queue.map((entry) => (entry.id === item.id ? { ...entry, ...updates } : entry));
        await writeQueue(queue);
      };

      try {
        await updateItem({
          status: "uploading",
          lastAttemptAt: new Date().toISOString(),
          lastErrorMessage: null
        });
        emit({ type: "status", itemId: item.id, journeyId: item.journeyId, status: "uploading" });

        // Save file to permanent local storage
        const localUri = await persistClipFile(item.fileUri, item.journeyId, item.captureType);

        await updateItem({ status: "uploaded" });
        emit({ type: "status", itemId: item.id, journeyId: item.journeyId, status: "uploaded" });

        await updateItem({ status: "processing" });
        emit({ type: "status", itemId: item.id, journeyId: item.journeyId, status: "processing" });

        // Create metadata record on backend (no file upload)
        const response = await createClipLocal(token, item.journeyId, {
          durationMs: item.durationMs,
          recordedAt: item.recordedAt,
          recordedOn: item.recordedOn,
          captureType: item.captureType
        });

        // Map the server-assigned clip ID to the local file
        await registerClipLocalUri(response.clip.id, localUri);

        await updateItem({ status: "ready" });
        emit({ type: "status", itemId: item.id, journeyId: item.journeyId, status: "ready" });

        queue = queue.filter((entry) => entry.id !== item.id);
        await writeQueue(queue);

        emit({ type: "success", itemId: item.id, journeyId: item.journeyId });
        succeeded += 1;
        if (options.targetItemId === item.id) {
          targetResult = { itemId: item.id, success: true };
        }
      } catch (error) {
        const errorMessage = toErrorMessage(error);
        const attempts = item.attempts + 1;
        const nextRetryAt = calcNextRetryAt(attempts);

        await updateItem({
          status: "failed",
          attempts,
          lastErrorMessage: errorMessage,
          lastAttemptAt: new Date().toISOString(),
          nextRetryAt
        });
        emit({
          type: "failed",
          itemId: item.id,
          journeyId: item.journeyId,
          attempts,
          errorMessage,
          nextRetryAt
        });
        failed += 1;
        if (options.targetItemId === item.id) {
          targetResult = { itemId: item.id, success: false, errorMessage };
        }
      }
    }

    if (!targetResult && options.targetItemId) {
      const pending = queue.find((item) => item.id === options.targetItemId) ?? null;
      if (pending) {
        targetResult = {
          itemId: pending.id,
          success: false,
          errorMessage: pending.lastErrorMessage ?? "Upload still pending."
        };
      }
    }

    return {
      remaining: queue.length,
      succeeded,
      failed,
      target: targetResult
    };
  });
}
