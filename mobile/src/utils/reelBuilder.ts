import type { Clip } from "../types/clip";
import { listClips } from "../api/clips";
import { sortClipsAscending } from "./progress";

export type ReelClip = {
  clip: Clip;
  dayNumber: number;
  label: string;
};

/**
 * Selects 5-6 clips for a TikTok-style reel: day 1, clips at ~25/50/75%
 * of total progress, and the most recent clip. Deduplicates and handles
 * journeys with fewer than 5 clips by returning all available clips.
 */
export async function buildTikTokReelClips(
  token: string,
  journeyId: string
): Promise<ReelClip[]> {
  const { clips } = await listClips(token, journeyId);

  const videoClips = clips.filter((c) => c.captureType === "video");
  const ascending = sortClipsAscending(videoClips);

  if (ascending.length === 0) return [];

  if (ascending.length <= 5) {
    return ascending.map((clip, index) => toReelClip(clip, index + 1));
  }

  const last = ascending.length - 1;
  const targetIndices = [
    0,
    Math.round(last * 0.25),
    Math.round(last * 0.5),
    Math.round(last * 0.75),
    last,
  ];

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
 * there are only 6-7 clips and 25%/50% round to the same index),
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
