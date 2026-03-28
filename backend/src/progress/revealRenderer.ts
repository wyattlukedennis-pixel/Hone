import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import type { Clip } from "../clips/repository.js";
import { config } from "../config.js";

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
const ffmpegPath = require("ffmpeg-static") as string | null;

// ---------------------------------------------------------------------------
// Render queue — limits concurrent FFmpeg processes to avoid OOM
// ---------------------------------------------------------------------------
const MAX_CONCURRENT_RENDERS = 1;
const MAX_QUEUED = 10;
let activeRenders = 0;
const waitQueue: Array<{ resolve: () => void; reject: (err: Error) => void }> = [];

async function acquireRenderSlot(): Promise<void> {
  if (activeRenders < MAX_CONCURRENT_RENDERS) {
    activeRenders++;
    return;
  }
  if (waitQueue.length >= MAX_QUEUED) {
    throw new Error("RENDER_QUEUE_FULL");
  }
  return new Promise<void>((resolve, reject) => {
    waitQueue.push({ resolve, reject });
  });
}

function releaseRenderSlot(): void {
  const next = waitQueue.shift();
  if (next) {
    next.resolve();
  } else {
    activeRenders--;
  }
}

type RevealRenderInput = {
  journeyId: string;
  journeyTitle: string;
  chapterNumber: number;
  milestoneLengthDays: number;
  progressDays: number;
  currentStreak: number;
  storylineHeadline?: string | null;
  storylineCaption?: string | null;
  storylineReflection?: string | null;
  clips: Clip[];
};

export type RevealRenderResult = {
  outputRelativePath: string;
  cacheHit: boolean;
  clipCount: number;
  skippedClipCount: number;
};

function clampPositiveInt(value: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.floor(value));
}

function clampNonNegativeInt(value: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value));
}

function sanitizeRelativeMediaPath(value: string) {
  const normalized = path.normalize(value).replace(/\\/g, "/");
  if (normalized.startsWith("../") || normalized === "..") return null;
  return normalized.replace(/^\/+/, "");
}

function inferExtensionFromPath(value: string, fallback: string) {
  const clean = value.split("?")[0] ?? value;
  const ext = path.extname(clean).toLowerCase().replace(".", "");
  return ext || fallback;
}

function mediaRelativePathFromUrl(url: string) {
  if (url.startsWith("/media/")) {
    return sanitizeRelativeMediaPath(decodeURIComponent(url.slice("/media/".length)));
  }
  try {
    const parsed = new URL(url);
    if (!parsed.pathname.startsWith("/media/")) return null;
    return sanitizeRelativeMediaPath(decodeURIComponent(parsed.pathname.slice("/media/".length)));
  } catch {
    return null;
  }
}

function createRenderKey(input: RevealRenderInput) {
  const rendererVersion = "v11"; // bumped for new spec: hard cuts, audio, no text
  const signature = {
    rendererVersion,
    journeyId: input.journeyId,
    chapterNumber: input.chapterNumber,
    milestoneLengthDays: input.milestoneLengthDays,
    progressDays: input.progressDays,
    currentStreak: input.currentStreak,
    clips: input.clips.map((clip) => ({
      id: clip.id,
      captureType: clip.captureType,
      durationMs: clip.durationMs,
      updatedAt: clip.updatedAt.toISOString(),
      videoUrl: clip.videoUrl
    }))
  };
  return createHash("sha1").update(JSON.stringify(signature)).digest("hex").slice(0, 16);
}

function sortClipsByTimeAscending(clips: Clip[]) {
  return [...clips].sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
}

function selectTimelineIndices(total: number, maxCount: number) {
  if (total <= 1) return [0];
  if (total <= maxCount) {
    return Array.from({ length: total }, (_, index) => index);
  }
  const lastIndex = total - 1;
  const indices: number[] = [];
  for (let index = 0; index < maxCount; index += 1) {
    const scaled = Math.round((index * lastIndex) / (maxCount - 1));
    indices.push(scaled);
  }
  return [...new Set(indices)].sort((a, b) => a - b);
}

function selectTimelineClips(clips: Clip[], maxCount: number) {
  if (!clips.length) return [];
  const clipsAscending = sortClipsByTimeAscending(clips);
  const indices = selectTimelineIndices(clipsAscending.length, maxCount);
  return indices.map((index) => clipsAscending[index]).filter((clip): clip is Clip => Boolean(clip));
}

async function runFfmpeg(args: string[]) {
  if (!ffmpegPath) {
    throw new Error("FFMPEG_NOT_AVAILABLE");
  }

  try {
    await execFileAsync(ffmpegPath, args, {
      maxBuffer: 1024 * 1024 * 16
    });
  } catch (error) {
    const stderr =
      typeof error === "object" && error !== null && "stderr" in error ? String((error as { stderr?: unknown }).stderr ?? "") : "";
    throw new Error(`FFMPEG_FAILED ${stderr.slice(-8000)}`);
  }
}

async function resolveClipSourcePath(clip: Clip, tempDir: string, index: number) {
  const localRelativePath = mediaRelativePathFromUrl(clip.videoUrl);
  if (localRelativePath) {
    const localAbsolutePath = path.join(config.uploads.dir, localRelativePath);
    try {
      await access(localAbsolutePath);
      return localAbsolutePath;
    } catch {
      // Fall through and try network fetch.
    }
  }

  const extension = inferExtensionFromPath(clip.videoUrl, clip.captureType === "photo" ? "jpg" : "mp4");
  const destination = path.join(tempDir, `source-${index}.${extension}`);
  const response = await fetch(clip.videoUrl);
  if (!response.ok || !response.body) {
    throw new Error(`CLIP_FETCH_FAILED_${response.status}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(destination, bytes);
  return destination;
}

/**
 * Single-pass FFmpeg render: all inputs → one filtergraph → one output.
 * Avoids N+1 process spawns and intermediate file I/O.
 */
async function renderSinglePass(
  sources: Array<{ path: string; captureType: "video" | "photo"; durationSeconds: number }>,
  outputPath: string
) {
  const args: string[] = ["-y", "-threads", "2"];
  const filterParts: string[] = [];
  const concatInputs: string[] = [];
  let inputIndex = 0;

  // Add a shared silent audio source for photos
  const hasPhotos = sources.some((s) => s.captureType === "photo");
  let silentInputIndex = -1;
  if (hasPhotos) {
    args.push("-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo");
    silentInputIndex = inputIndex++;
  }

  for (let i = 0; i < sources.length; i++) {
    const src = sources[i];
    const idx = inputIndex++;

    if (src.captureType === "photo") {
      args.push("-loop", "1", "-t", src.durationSeconds.toFixed(2), "-i", src.path);
      // Scale photo, set duration and frame rate
      filterParts.push(
        `[${idx}:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30,setpts=PTS-STARTPTS[v${i}]`
      );
      // Trim silent audio to match photo duration
      filterParts.push(
        `[${silentInputIndex}:a]atrim=0:${src.durationSeconds.toFixed(2)},asetpts=PTS-STARTPTS[a${i}]`
      );
    } else {
      args.push("-i", src.path);
      // Scale and trim video
      filterParts.push(
        `[${idx}:v]trim=0:${src.durationSeconds.toFixed(2)},setpts=PTS-STARTPTS,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30[v${i}]`
      );
      // Trim audio to match, or generate silence if no audio stream
      filterParts.push(
        `[${idx}:a]atrim=0:${src.durationSeconds.toFixed(2)},asetpts=PTS-STARTPTS,aresample=44100,aformat=channel_layouts=stereo[a${i}]`
      );
    }
    concatInputs.push(`[v${i}][a${i}]`);
  }

  // Concat all segments
  filterParts.push(
    `${concatInputs.join("")}concat=n=${sources.length}:v=1:a=1[outv][outa]`
  );

  args.push("-filter_complex", filterParts.join(";\n"));
  args.push("-map", "[outv]", "-map", "[outa]");
  args.push(
    "-c:v", "libx264",
    "-preset", "ultrafast",
    "-crf", "23",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "128k",
    "-movflags", "+faststart",
    outputPath
  );

  try {
    await runFfmpeg(args);
  } catch (error) {
    // If audio stream missing on a video clip, retry without audio mapping
    const stderr = error instanceof Error ? error.message : "";
    if (stderr.includes("does not contain any stream") || stderr.includes("Invalid data")) {
      await renderSinglePassVideoOnly(sources, outputPath);
    } else {
      throw error;
    }
  }
}

/**
 * Fallback: video-only render (no audio) for when source clips lack audio streams.
 */
async function renderSinglePassVideoOnly(
  sources: Array<{ path: string; captureType: "video" | "photo"; durationSeconds: number }>,
  outputPath: string
) {
  const args: string[] = ["-y", "-threads", "2"];
  const filterParts: string[] = [];
  const concatInputs: string[] = [];
  let inputIndex = 0;

  for (let i = 0; i < sources.length; i++) {
    const src = sources[i];
    const idx = inputIndex++;

    if (src.captureType === "photo") {
      args.push("-loop", "1", "-t", src.durationSeconds.toFixed(2), "-i", src.path);
    } else {
      args.push("-i", src.path);
    }

    const trim = src.captureType === "photo"
      ? `[${idx}:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30,setpts=PTS-STARTPTS[v${i}]`
      : `[${idx}:v]trim=0:${src.durationSeconds.toFixed(2)},setpts=PTS-STARTPTS,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30[v${i}]`;
    filterParts.push(trim);
    concatInputs.push(`[v${i}]`);
  }

  filterParts.push(
    `${concatInputs.join("")}concat=n=${sources.length}:v=1:a=0[outv]`
  );

  args.push("-filter_complex", filterParts.join(";\n"));
  args.push("-map", "[outv]");
  args.push(
    "-c:v", "libx264",
    "-preset", "ultrafast",
    "-crf", "23",
    "-pix_fmt", "yuv420p",
    "-an",
    "-movflags", "+faststart",
    outputPath
  );

  await runFfmpeg(args);
}

/**
 * Compute per-clip durations for the reveal montage.
 *
 * Spec:
 * - First clip:   2s
 * - Middle clips:  1.5s each (use actual duration if clip is shorter)
 * - Final clip:   min 5s, max 10s, capped at actual clip duration if shorter
 *
 * The contrast between fast middle cuts and the held final clip IS the
 * emotional moment. The reveal lands because everything was moving fast
 * and then it stops.
 */
function computeClipDurations(clipCount: number, clips: Clip[]): number[] {
  if (clipCount <= 1) {
    // Single clip: hold for 5-10s
    const actualSeconds = (clips[0]?.durationMs ?? 5000) / 1000;
    return [Math.min(10, Math.max(5, actualSeconds))];
  }

  if (clipCount === 2) {
    const lastActual = (clips[1]?.durationMs ?? 5000) / 1000;
    return [2, Math.min(10, Math.max(5, lastActual))];
  }

  const durations: number[] = [];

  // First clip: 2s
  durations.push(2);

  // Middle clips: 1.5s each (capped at actual duration if shorter)
  for (let i = 1; i < clipCount - 1; i++) {
    const actualSeconds = (clips[i]?.durationMs ?? 1500) / 1000;
    durations.push(Math.min(1.5, actualSeconds));
  }

  // Final clip: min 5s, max 10s, capped at actual duration
  const lastClipDuration = (clips[clipCount - 1]?.durationMs ?? 5000) / 1000;
  durations.push(Math.min(10, Math.max(5, lastClipDuration)));

  return durations;
}

/**
 * Determine clip count based on journey length (matches mobile reelBuilder).
 */
function clipCountForJourneyDays(journeyDays: number): number {
  if (journeyDays <= 14) return 5;
  if (journeyDays <= 30) return 7;
  if (journeyDays <= 60) return 9;
  if (journeyDays <= 100) return 11;
  return 13;
}

/**
 * Reveal montage renderer.
 *
 * - Hard cuts only between clips (no fades, no white flash)
 * - Includes original audio from clips
 * - No text overlays — user adds native TikTok text after export
 * - First clip 2s, middle clips 1.5s, final clip 5-10s
 * - Up to 13 clips scaled by journey length
 * - Clean fullscreen 1080x1920 vertical export
 */
export async function renderRevealMontage(input: RevealRenderInput): Promise<RevealRenderResult> {
  const chapterNumber = clampPositiveInt(input.chapterNumber, 1);
  const milestoneLengthDays = clampPositiveInt(input.milestoneLengthDays, 7);
  const progressDays = clampNonNegativeInt(input.progressDays, 0);
  const currentStreak = clampNonNegativeInt(input.currentStreak, 0);

  // Sort all clips chronologically
  const allClipsSorted = sortClipsByTimeAscending(input.clips);

  // Determine journey span and target clip count
  let journeyDays = milestoneLengthDays;
  if (allClipsSorted.length >= 2) {
    const firstDate = allClipsSorted[0].recordedAt;
    const lastDate = allClipsSorted[allClipsSorted.length - 1].recordedAt;
    journeyDays = Math.max(
      1,
      Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
    );
  }

  const maxClips = clipCountForJourneyDays(journeyDays);
  const clipCandidates = selectTimelineClips(allClipsSorted, maxClips);

  if (!clipCandidates.length) {
    throw new Error("RENDER_NO_CLIPS");
  }

  const renderKey = createRenderKey({
    ...input,
    chapterNumber,
    milestoneLengthDays,
    progressDays,
    currentStreak,
    clips: clipCandidates
  });
  const outputRelativePath = `renders/reveal-${renderKey}.mp4`;
  const outputAbsolutePath = path.join(config.uploads.dir, outputRelativePath);
  await mkdir(path.dirname(outputAbsolutePath), { recursive: true });

  try {
    await access(outputAbsolutePath);
    return {
      outputRelativePath,
      cacheHit: true,
      clipCount: clipCandidates.length,
      skippedClipCount: 0
    };
  } catch {
    // No cached render yet.
  }

  // Queue for a render slot (limits concurrent FFmpeg to avoid OOM)
  await acquireRenderSlot();

  const tempDir = await mkdtemp(path.join(tmpdir(), "hone-reveal-render-"));

  const durations = computeClipDurations(clipCandidates.length, clipCandidates);

  try {
    // Resolve all source files first
    const sources: Array<{ path: string; captureType: "video" | "photo"; durationSeconds: number }> = [];
    let skippedClipCount = 0;
    for (let index = 0; index < clipCandidates.length; index += 1) {
      const clip = clipCandidates[index];
      const durationSeconds = durations[index] ?? 1.5;
      try {
        const sourcePath = await resolveClipSourcePath(clip, tempDir, index);
        sources.push({ path: sourcePath, captureType: clip.captureType, durationSeconds });
      } catch {
        skippedClipCount += 1;
      }
    }

    if (!sources.length) {
      throw new Error("RENDER_NO_VALID_CLIPS");
    }

    // Single-pass FFmpeg render — one process, no intermediate files
    await renderSinglePass(sources, outputAbsolutePath);
    return {
      outputRelativePath,
      cacheHit: false,
      clipCount: sources.length,
      skippedClipCount
    };
  } finally {
    releaseRenderSlot();
    await rm(tempDir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Photo timelapse renderer
// ---------------------------------------------------------------------------

export type TimelapseRenderInput = {
  journeyId: string;
  clips: Clip[];
  holdMs: number;
};

export type TimelapseRenderResult = {
  outputRelativePath: string;
  cacheHit: boolean;
  photoCount: number;
};

export async function renderPhotoTimelapse(input: TimelapseRenderInput): Promise<TimelapseRenderResult> {
  if (!ffmpegPath) throw new Error("FFMPEG_NOT_FOUND");

  const photoClips = input.clips
    .filter((c) => c.captureType === "photo")
    .sort((a, b) => a.recordedOn.localeCompare(b.recordedOn));

  if (!photoClips.length) throw new Error("TIMELAPSE_NO_PHOTOS");

  const holdSeconds = Math.max(0.05, input.holdMs / 1000);

  // Cache key
  const keyData = [
    "timelapse-v2",
    input.journeyId,
    String(input.holdMs),
    ...photoClips.map((c) => c.id),
  ].join("|");
  const hash = createHash("sha256").update(keyData).digest("hex").slice(0, 16);
  const outputRelativePath = `renders/timelapse-${hash}.mp4`;
  const outputAbsolutePath = path.join(config.uploads.dir, outputRelativePath);
  await mkdir(path.dirname(outputAbsolutePath), { recursive: true });

  // Check cache
  try {
    await access(outputAbsolutePath);
    return { outputRelativePath, cacheHit: true, photoCount: photoClips.length };
  } catch {
    // not cached
  }

  // Queue for a render slot (limits concurrent FFmpeg to avoid OOM)
  await acquireRenderSlot();

  const tempDir = await mkdtemp(path.join(tmpdir(), "hone-timelapse-"));

  try {
    // Download / resolve each photo (skip missing ones)
    const photoPaths: string[] = [];
    for (let i = 0; i < photoClips.length; i++) {
      try {
        const sourcePath = await resolveClipSourcePath(photoClips[i], tempDir, i);
        photoPaths.push(sourcePath);
      } catch {
        // Skip missing photos — they may not have been uploaded yet
      }
    }

    if (!photoPaths.length) throw new Error("TIMELAPSE_NO_VALID_PHOTOS");

    // Build concat list
    const concatLines: string[] = [];
    for (const p of photoPaths) {
      concatLines.push(`file '${p}'`);
      concatLines.push(`duration ${holdSeconds}`);
    }
    // Repeat last entry so ffmpeg doesn't cut it short
    concatLines.push(`file '${photoPaths[photoPaths.length - 1]}'`);
    concatLines.push(`duration ${holdSeconds}`);

    const concatFile = path.join(tempDir, "list.txt");
    await writeFile(concatFile, concatLines.join("\n"), "utf-8");

    // Render
    await execFileAsync(ffmpegPath, [
      "-threads", "1",
      "-f", "concat",
      "-safe", "0",
      "-i", concatFile,
      "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30",
      "-c:v", "libx264",
      "-crf", "23",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      "-an",
      "-y", outputAbsolutePath,
    ], { maxBuffer: 50 * 1024 * 1024 });

    return { outputRelativePath, cacheHit: false, photoCount: photoPaths.length };
  } finally {
    releaseRenderSlot();
    await rm(tempDir, { recursive: true, force: true });
  }
}
