import type { Clip } from "../types/clip";

type ComparisonPreset = "day1" | "week" | "month";

export type MilestoneDefinition = {
  day: number;
  title: string;
  description: string;
};

export type MilestoneState = MilestoneDefinition & {
  unlocked: boolean;
  remainingDays: number;
};

export type ComparisonPair = {
  thenClip: Clip;
  nowClip: Clip;
  thenLabel: string;
  nowLabel: string;
  title: string;
};

export type PracticeHeatmapCell = {
  key: string;
  dateKey: string;
  dayShort: string;
  practiced: boolean;
  isToday: boolean;
};

export const milestoneDefinitions: MilestoneDefinition[] = [
  {
    day: 3,
    title: "First Reflection",
    description: "Notice how your consistency already shifts your confidence."
  },
  {
    day: 7,
    title: "Week 1 Reel",
    description: "Your first milestone reel unlocks after one week of practice."
  },
  {
    day: 14,
    title: "Two-Week Comparison",
    description: "Compare your early form to your current flow."
  },
  {
    day: 30,
    title: "Month 1 Montage",
    description: "Your first major progress montage is ready to review."
  },
  {
    day: 100,
    title: "100-Day Breakthrough",
    description: "Three digits of consistency. This is where mastery accelerates."
  },
  {
    day: 365,
    title: "Year of Practice",
    description: "A full year of showing up. Your long-term journey reel unlocks."
  }
];

function dayKeyFromDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function clipDate(value: Clip) {
  return new Date(value.recordedAt);
}

export function sortClipsAscending(clips: Clip[]) {
  return [...clips].sort((a, b) => clipDate(a).getTime() - clipDate(b).getTime());
}

export function latestClip(clips: Clip[]) {
  if (!clips.length) return null;
  return sortClipsAscending(clips)[clips.length - 1] ?? null;
}

export function hasClipToday(clips: Clip[], now = new Date()) {
  const today = dayKeyFromDate(now);
  return clips.some((clip) => clip.recordedOn.slice(0, 10) === today);
}

export function uniquePracticeDays(clips: Clip[]) {
  const days = new Set<string>();
  for (const clip of clips) {
    days.add(clip.recordedOn.slice(0, 10));
  }
  return days;
}

export function getDayCount(clips: Clip[]) {
  return uniquePracticeDays(clips).size;
}

export function getMilestoneStates(dayCount: number) {
  return milestoneDefinitions.map((milestone) => ({
    ...milestone,
    unlocked: dayCount >= milestone.day,
    remainingDays: Math.max(0, milestone.day - dayCount)
  }));
}

export function getNextMilestone(dayCount: number) {
  return getMilestoneStates(dayCount).find((milestone) => !milestone.unlocked) ?? null;
}

export function getUnlockedMilestone(dayCount: number) {
  return milestoneDefinitions.find((milestone) => milestone.day === dayCount) ?? null;
}

export function getCurrentStreak(clips: Clip[], now = new Date()) {
  const days = uniquePracticeDays(clips);
  let streak = 0;
  const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  while (days.has(dayKeyFromDate(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

function findLatestClipAtOrBefore(clipsAscending: Clip[], targetDate: Date) {
  const targetMs = targetDate.getTime();
  let match: Clip | null = null;
  for (const clip of clipsAscending) {
    if (clipDate(clip).getTime() <= targetMs) {
      match = clip;
    } else {
      break;
    }
  }
  return match;
}

function dayNumberOfClip(clipsAscending: Clip[], clip: Clip) {
  const dayKeys = new Set<string>();
  for (const candidate of clipsAscending) {
    dayKeys.add(candidate.recordedOn.slice(0, 10));
    if (candidate.id === clip.id) break;
  }
  return dayKeys.size;
}

function formatDayLabel(clipsAscending: Clip[], clip: Clip) {
  const dayNumber = dayNumberOfClip(clipsAscending, clip);
  const formatted = new Date(clip.recordedAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  });
  return `Day ${dayNumber} • ${formatted}`;
}

export function buildComparisonPair(clips: Clip[], preset: ComparisonPreset): ComparisonPair | null {
  if (clips.length < 2) return null;
  const clipsAscending = sortClipsAscending(clips);
  const nowClip = clipsAscending[clipsAscending.length - 1];
  const nowDate = clipDate(nowClip);

  let thenClip: Clip | null = null;
  let title = "";

  if (preset === "day1") {
    thenClip = clipsAscending[0];
    title = "Day 1 vs Today";
  } else if (preset === "week") {
    const target = new Date(nowDate);
    target.setDate(target.getDate() - 7);
    thenClip = findLatestClipAtOrBefore(clipsAscending, target);
    title = "7 Days Ago vs Today";
  } else {
    const target = new Date(nowDate);
    target.setDate(target.getDate() - 30);
    thenClip = findLatestClipAtOrBefore(clipsAscending, target);
    title = "30 Days Ago vs Today";
  }

  if (!thenClip || thenClip.id === nowClip.id) return null;

  return {
    thenClip,
    nowClip,
    thenLabel: formatDayLabel(clipsAscending, thenClip),
    nowLabel: formatDayLabel(clipsAscending, nowClip),
    title
  };
}

export function buildPracticeHeatmap(clips: Clip[], weeks = 8, now = new Date()) {
  const totalDays = Math.max(1, weeks * 7);
  const practicedDays = uniquePracticeDays(clips);
  const cells: PracticeHeatmapCell[] = [];
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(today);
  start.setUTCDate(today.getUTCDate() - (totalDays - 1));

  for (let index = 0; index < totalDays; index += 1) {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    const dateKey = dayKeyFromDate(date);
    const dayShort = date.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 1);
    cells.push({
      key: `${dateKey}-${index}`,
      dateKey,
      dayShort,
      practiced: practicedDays.has(dateKey),
      isToday: dateKey === dayKeyFromDate(today)
    });
  }

  return cells;
}
