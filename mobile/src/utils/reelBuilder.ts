import type { Clip } from "../types/clip";
import { listClips } from "../api/clips";
import { sortClipsAscending } from "./progress";

export type ReelClip = {
  clip: Clip;
  dayNumber: number;
  label: string;
};

/**
 * Determine the number of clips to include based on journey length in days.
 *
 * - 1-14 days:   5 clips (first, 3 middle, last)
 * - 15-30 days:  7 clips (first, 5 middle, last)
 * - 31-60 days:  9 clips (first, 7 middle, last)
 * - 61-100 days: 11 clips (first, 9 middle, last)
 * - 100+ days:   13 clips (first, 11 middle, last)
 *
 * Capped at 13 regardless.
 */
function clipCountForJourneyDays(journeyDays: number): number {
  if (journeyDays <= 14) return 5;
  if (journeyDays <= 30) return 7;
  if (journeyDays <= 60) return 9;
  if (journeyDays <= 100) return 11;
  return 13;
}

/**
 * Select clips evenly spread across the full journey timeline.
 *
 * Always includes:
 * - First clip ever recorded
 * - Last clip ever recorded
 * - Evenly-spaced middle clips from the full chronological range
 *
 * Spans ALL chapters, not just the current one.
 */
export async function buildTikTokReelClips(
  token: string,
  journeyId: string
): Promise<ReelClip[]> {
  const { clips } = await listClips(token, journeyId);

  const videoClips = clips.filter((c) => c.captureType === "video");
  const ascending = sortClipsAscending(videoClips);

  if (ascending.length === 0) return [];

  // Calculate journey span in days
  const firstDate = new Date(ascending[0].recordedAt);
  const lastDate = new Date(ascending[ascending.length - 1].recordedAt);
  const journeyDays = Math.max(
    1,
    Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
  );

  const targetCount = clipCountForJourneyDays(journeyDays);

  if (ascending.length <= targetCount) {
    return ascending.map((clip, index) => toReelClip(clip, index + 1));
  }

  // Always include first and last; evenly space middle clips
  const last = ascending.length - 1;
  const middleSlots = targetCount - 2;
  const targetIndices: number[] = [0];

  for (let i = 0; i < middleSlots; i++) {
    // Space evenly between index 1 and index last-1
    const position = (i + 1) / (middleSlots + 1);
    targetIndices.push(Math.round(position * last));
  }

  targetIndices.push(last);

  const deduplicated = deduplicateIndices(targetIndices, last);

  return deduplicated.map((index) => toReelClip(ascending[index], index + 1));
}

function toReelClip(clip: Clip, dayNumber: number): ReelClip {
  return {
    clip,
    dayNumber,
    label: `day ${dayNumber}`,
  };
}

/**
 * Given a list of target indices that may contain duplicates (e.g. when
 * there are only 6-7 clips and positions round to the same index),
 * shift duplicates to nearby unused indices so each slot is unique.
 */
function deduplicateIndices(indices: number[], maxIndex: number): number[] {
  const used = new Set<number>();
  const result: number[] = [];

  for (const target of indices) {
    if (!used.has(target)) {
      used.add(target);
      result.push(target);
      continue;
    }

    const neighbor = findNearestUnused(target, maxIndex, used);
    if (neighbor !== null) {
      used.add(neighbor);
      result.push(neighbor);
    }
  }

  return result.sort((a, b) => a - b);
}

function findNearestUnused(
  target: number,
  maxIndex: number,
  used: Set<number>
): number | null {
  for (let offset = 1; offset <= maxIndex; offset++) {
    const above = target + offset;
    if (above <= maxIndex && !used.has(above)) return above;
    const below = target - offset;
    if (below >= 0 && !used.has(below)) return below;
  }
  return null;
}

/**
 * Returns ALL photo clips for a journey, sorted ascending.
 * Used for photo timelapse reveal — no sampling, every photo appears.
 */
export async function buildTimelapseClips(
  token: string,
  journeyId: string
): Promise<ReelClip[]> {
  const { clips } = await listClips(token, journeyId);
  const photoClips = clips.filter((c) => c.captureType === "photo");
  const ascending = sortClipsAscending(photoClips);
  return ascending.map((clip, index) => toReelClip(clip, index + 1));
}
