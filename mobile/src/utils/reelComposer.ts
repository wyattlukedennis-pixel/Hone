import { FFmpegKit, ReturnCode } from "ffmpeg-kit-react-native";
import * as FileSystem from "expo-file-system/legacy";
import type { ReelClip } from "./reelBuilder";

const OUTPUT_WIDTH = 1080;
const OUTPUT_HEIGHT = 1920;
const FIRST_CLIP_DURATION = 3;
const MIDDLE_CLIP_DURATION = 0.8;
const LAST_CLIP_DURATION = 3;
const FLASH_FRAMES = 2;
const FPS = 30;
const FLASH_DURATION = FLASH_FRAMES / FPS;
const CRF = 23;

// Ken Burns: subtle 3% zoom over each clip's duration
const KB_SCALE_START = 1.0;
const KB_SCALE_END = 1.03;

type ValidatedClip = ReelClip & { duration: number };

function clipDuration(index: number, total: number): number {
  if (index === 0) return FIRST_CLIP_DURATION;
  if (index === total - 1) return LAST_CLIP_DURATION;
  return MIDDLE_CLIP_DURATION;
}

function escapeDrawtext(text: string): string {
  return text
    .replace(/\\/g, "\\\\\\\\")
    .replace(/'/g, "'\\\\\\''")
    .replace(/:/g, "\\\\:");
}

/**
 * Build the FFmpeg filter graph for composing a TikTok reel.
 *
 * Each clip is:
 * - Scaled/cropped to fill 1080x1920
 * - Trimmed to its target duration
 * - Given a subtle Ken Burns (1.0→1.03x zoom)
 * - Overlaid with clean "day X" text + drop shadow (no pill)
 *
 * Clips are joined with 2-frame white flash hard cuts (not crossfades).
 */
function buildFilterGraph(clips: ValidatedClip[]): string {
  const parts: string[] = [];

  // Pre-scale to slightly larger than output for Ken Burns headroom
  const kbW = Math.ceil(OUTPUT_WIDTH * KB_SCALE_END);
  const kbH = Math.ceil(OUTPUT_HEIGHT * KB_SCALE_END);

  for (let i = 0; i < clips.length; i++) {
    const dur = clips[i].duration;
    const label = escapeDrawtext(clips[i].label.toLowerCase());

    // Scale up with headroom, trim, then animate crop position for Ken Burns zoom
    // zoompan: zoom from 100 to ~103 linearly, centered, over the clip duration
    const totalFrames = Math.ceil(dur * FPS);

    parts.push(
      `[${i}:v]` +
        `scale=${kbW}:${kbH}:force_original_aspect_ratio=increase,` +
        `crop=${kbW}:${kbH},` +
        `setsar=1,` +
        `trim=duration=${dur},setpts=PTS-STARTPTS,` +
        `fps=${FPS},` +
        // Ken Burns via zoompan: subtle zoom in, centered
        `zoompan=z='${KB_SCALE_START}+on*(${KB_SCALE_END}-${KB_SCALE_START})/${totalFrames}':` +
        `x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':` +
        `d=${totalFrames}:s=${OUTPUT_WIDTH}x${OUTPUT_HEIGHT}:fps=${FPS},` +
        // Text overlay: drop shadow first, then white text. No pill.
        `drawtext=text='${label}':` +
        `fontsize=48:fontcolor=black@0.4:` +
        `x=62:y=h-158:` +
        `font=Sans,` +
        `drawtext=text='${label}':` +
        `fontsize=48:fontcolor=white:` +
        `x=60:y=h-160:` +
        `font=Sans` +
        `[v${i}]`
    );
  }

  if (clips.length === 1) {
    parts.push(`[v0]null[outv]`);
    return parts.join("; ");
  }

  // Hard cuts with 2-frame white flash between clips
  // Each transition gets its own color source (FFmpeg needs separate inputs for concat)
  const concatSegments: string[] = [];
  for (let i = 0; i < clips.length; i++) {
    concatSegments.push(`[v${i}]`);
    if (i < clips.length - 1) {
      const flashLabel = `fl${i}`;
      parts.push(
        `color=c=white:s=${OUTPUT_WIDTH}x${OUTPUT_HEIGHT}:r=${FPS}:d=${FLASH_DURATION}[${flashLabel}]`
      );
      concatSegments.push(`[${flashLabel}]`);
    }
  }

  const totalSegments = clips.length + (clips.length - 1);
  parts.push(
    `${concatSegments.join("")}concat=n=${totalSegments}:v=1:a=0[outv]`
  );

  return parts.join("; ");
}

/**
 * Compose a TikTok-native vertical reel from selected clips.
 *
 * Takes the ReelClip[] output of buildTikTokReelClips() and produces an
 * H.264 mp4 at 1080x1920 with:
 * - Clean "day X" text overlays with drop shadow
 * - 2-frame white flash hard cuts between clips
 * - Subtle Ken Burns zoom on each clip
 * - Day 1 = 3s, middle clips = 0.8s, latest = 3s
 *
 * Returns the output file path on success, or null on failure.
 */
export async function composeReel(clips: ReelClip[]): Promise<string | null> {
  if (clips.length < 2) {
    console.error("[reelComposer] Need at least 2 clips to compose a reel");
    return null;
  }

  // Validate that clip files exist on device
  const validated: ValidatedClip[] = [];
  for (let i = 0; i < clips.length; i++) {
    const uri = clips[i].clip.videoUrl;
    if (uri.startsWith("file://")) {
      try {
        const info = await FileSystem.getInfoAsync(uri);
        if (!info.exists) {
          console.warn(`[reelComposer] Clip file missing, skipping: ${uri}`);
          continue;
        }
      } catch {
        console.warn(`[reelComposer] Cannot stat clip file, skipping: ${uri}`);
        continue;
      }
    }
    validated.push({ ...clips[i], duration: 0 });
  }

  if (validated.length < 2) {
    console.error("[reelComposer] Fewer than 2 valid clips after filtering");
    return null;
  }

  // Assign durations based on final position after filtering
  for (let i = 0; i < validated.length; i++) {
    validated[i].duration = clipDuration(i, validated.length);
  }

  const outputPath = `${FileSystem.cacheDirectory}reel_${Date.now()}.mp4`;
  const filterGraph = buildFilterGraph(validated);

  const inputs = validated.map((c) => `-i '${c.clip.videoUrl}'`).join(" ");
  const command = [
    inputs,
    `-filter_complex '${filterGraph}'`,
    `-map '[outv]'`,
    `-an`,
    `-c:v libx264`,
    `-preset fast`,
    `-crf ${CRF}`,
    `-pix_fmt yuv420p`,
    `-movflags +faststart`,
    `-y '${outputPath}'`,
  ].join(" ");

  try {
    const session = await FFmpegKit.execute(command);
    const returnCode = await session.getReturnCode();

    if (ReturnCode.isSuccess(returnCode)) {
      return outputPath;
    }

    const output = await session.getOutput();
    console.error(
      `[reelComposer] FFmpeg failed with code ${returnCode}:\n${output}`
    );
    return null;
  } catch (error) {
    console.error("[reelComposer] FFmpeg execution error:", error);
    return null;
  }
}
