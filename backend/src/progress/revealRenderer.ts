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
  const rendererVersion = "v10";
  const signature = {
    rendererVersion,
    journeyId: input.journeyId,
    chapterNumber: input.chapterNumber,
    milestoneLengthDays: input.milestoneLengthDays,
    progressDays: input.progressDays,
    currentStreak: input.currentStreak,
    storylineHeadline: input.storylineHeadline ?? null,
    storylineCaption: input.storylineCaption ?? null,
    storylineReflection: input.storylineReflection ?? null,
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

async function buildClipSegment(params: {
  sourcePath: string;
  outputPath: string;
  captureType: "video" | "photo";
  durationSeconds: number;
}) {
  // Clean fullscreen — no text, no overlays. User adds their own in TikTok/CapCut.
  const baseFilter = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1";

  const inputArgs =
    params.captureType === "photo"
      ? ["-loop", "1", "-t", params.durationSeconds.toFixed(2), "-i", params.sourcePath]
      : ["-i", params.sourcePath, "-t", params.durationSeconds.toFixed(2)];

  const audioArgs = params.captureType === "photo" ? ["-an"] : [];

  await runFfmpeg([
    "-y",
    ...inputArgs,
    "-vf", baseFilter,
    "-r", "30",
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "23",
    "-pix_fmt", "yuv420p",
    ...audioArgs,
    params.outputPath
  ]);
}

async function buildFlashSegment(outputPath: string) {
  // 2-frame white flash (≈0.067s at 30fps)
  await runFfmpeg([
    "-y",
    "-f", "lavfi", "-i", "color=c=white:s=1080x1920:r=30:d=0.067",
    "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "18",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-shortest",
    outputPath
  ]);
}

async function concatSegments(segmentPaths: string[], outputPath: string, tempDir: string) {
  // Insert white flash between each clip segment
  const flashPath = path.join(tempDir, "flash.mp4");
  await buildFlashSegment(flashPath);

  const withFlashes: string[] = [];
  for (let i = 0; i < segmentPaths.length; i++) {
    withFlashes.push(segmentPaths[i]);
    if (i < segmentPaths.length - 1) {
      withFlashes.push(flashPath);
    }
  }

  const concatListPath = path.join(tempDir, "segments.txt");
  const concatLines = withFlashes.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n");
  await writeFile(concatListPath, `${concatLines}\n`, "utf8");

  try {
    await runFfmpeg(["-y", "-f", "concat", "-safe", "0", "-i", concatListPath, "-c", "copy", outputPath]);
  } catch {
    await runFfmpeg([
      "-y",
      "-f", "concat",
      "-safe", "0",
      "-i", concatListPath,
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "23",
      "-pix_fmt", "yuv420p",
      "-r", "30",
      outputPath
    ]);
  }
}

/**
 * Compute per-clip durations that feel like a TikTok progress reel.
 *
 * Pattern: day 1 lingers → middle clips accelerate → last clip is the payoff.
 * Target total: 15-25s depending on clip count.
 *
 *   first clip:  3.0s  (let the cringe breathe)
 *   middle early: 1.5s → accelerates to 0.6s near the end
 *   last clip:   4.5s  (the payoff — let it land)
 */
function computeClipDurations(clipCount: number): number[] {
  if (clipCount <= 1) return [5.0];
  if (clipCount === 2) return [3.5, 4.5];
  if (clipCount === 3) return [3.0, 1.5, 4.5];

  const durations: number[] = [];
  const middleCount = clipCount - 2;

  // First clip: let day 1 breathe
  durations.push(3.0);

  // Middle clips: decelerate-to-accelerate curve
  // Early middle clips are ~1.5s, ramp down to ~0.6s
  for (let i = 0; i < middleCount; i++) {
    const progress = i / Math.max(1, middleCount - 1); // 0 → 1
    // Ease from 1.5 → 0.6 with a slight curve
    const dur = 1.5 - progress * 0.9;
    durations.push(Math.max(0.5, Math.round(dur * 100) / 100));
  }

  // Last clip: the payoff
  durations.push(4.5);

  return durations;
}

/**
 * TikTok-native reveal montage renderer.
 *
 * - No title card — jumps straight into day 1
 * - Fullscreen clips, no borders or boxes
 * - Minimal lowercase "day X" text bottom-left with drop shadow
 * - White flash hard cuts between clips
 * - Up to 12 clips for a real progression arc
 * - Pacing: day 1 lingers → middle accelerates → last clip pays off
 * - Target duration: 15-25 seconds
 */
export async function renderRevealMontage(input: RevealRenderInput): Promise<RevealRenderResult> {
  const chapterNumber = clampPositiveInt(input.chapterNumber, 1);
  const milestoneLengthDays = clampPositiveInt(input.milestoneLengthDays, 7);
  const progressDays = clampNonNegativeInt(input.progressDays, 0);
  const currentStreak = clampNonNegativeInt(input.currentStreak, 0);
  // Pull up to 12 clips for a real progression arc
  const clipCandidates = selectTimelineClips(input.clips, 12);
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

  const tempDir = await mkdtemp(path.join(tmpdir(), "hone-reveal-render-"));

  const durations = computeClipDurations(clipCandidates.length);

  try {
    const clipSegments: string[] = [];
    let skippedClipCount = 0;
    for (let index = 0; index < clipCandidates.length; index += 1) {
      const clip = clipCandidates[index];
      const durationSeconds = durations[index] ?? 1.0;

      try {
        const sourcePath = await resolveClipSourcePath(clip, tempDir, index);
        const segmentPath = path.join(tempDir, `segment-${index + 1}.mp4`);
        await buildClipSegment({
          sourcePath,
          outputPath: segmentPath,
          captureType: clip.captureType,
          durationSeconds
        });
        clipSegments.push(segmentPath);
      } catch {
        skippedClipCount += 1;
      }
    }

    if (!clipSegments.length) {
      throw new Error("RENDER_NO_VALID_CLIPS");
    }

    // No title card — straight into clips with white flash transitions
    await concatSegments(clipSegments, outputAbsolutePath, tempDir);
    return {
      outputRelativePath,
      cacheHit: false,
      clipCount: clipSegments.length,
      skippedClipCount
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
