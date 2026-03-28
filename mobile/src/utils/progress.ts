import type { Clip } from "../types/clip";
import type { SkillPack } from "../types/journey";

type ComparisonPreset = "day1" | "week" | "month";

export const milestoneLengthOptions = [7, 14, 30, 100] as const;
export type MilestoneLengthOption = (typeof milestoneLengthOptions)[number];

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

export type ChapterTrailerMoment = {
  clip: Clip;
  label: string;
};

export type ChapterComparisonPlan = {
  comparison: ComparisonPair;
  strategyLabel: string;
  reason: string;
  consistencyScore: number;
  trailerMoments: ChapterTrailerMoment[];
};

export type RevealStoryline = {
  arcLabel: string;
  headline: string;
  caption: string;
  reflection: string;
};

export type RevealProtocolCompliance = {
  totalClips: number;
  compliantClips: number;
  compliancePct: number;
  targetDurationSeconds: number;
};

export type RevealRangeDescriptor = {
  chapterNumber: number;
  milestoneLengthDays: number;
  startDayIndex: number;
  endDayIndex: number;
};

export type MilestoneChapterConfig = {
  milestoneLengthDays: number;
  milestoneStartDay: number;
  milestoneChapter: number;
};

export type ChapterCaptureRule = {
  captureMode: "video" | "photo";
};

export type MilestoneChapterProgress = {
  milestoneLengthDays: number;
  milestoneStartDay: number;
  milestoneChapter: number;
  progressDays: number;
  remainingDays: number;
  endDayTarget: number;
  completedRatio: number;
  reachedReveal: boolean;
};

export type PracticeHeatmapCell = {
  key: string;
  dateKey: string;
  dayShort: string;
  practiced: boolean;
  isToday: boolean;
};

export type ProtocolConsistencyTrend = {
  totalClips: number;
  compliantClips: number;
  consistencyPct: number;
  compliantDayStreak: number;
  recentPct: number | null;
  previousPct: number | null;
  trendDeltaPct: number | null;
  trendLabel: "up" | "down" | "flat" | null;
  targetDurationSeconds: number;
};

type CaptureProtocolProfile = {
  recommendedMinDurationMs: number;
};

function getCaptureProtocolProfile(skillPack: SkillPack, captureType: "video" | "photo"): CaptureProtocolProfile {
  if (captureType === "photo") {
    return {
      recommendedMinDurationMs: 0
    };
  }
  if (skillPack === "fitness") {
    return {
      recommendedMinDurationMs: 6000
    };
  }
  if (skillPack === "drawing") {
    return {
      recommendedMinDurationMs: 7000
    };
  }
  return {
    recommendedMinDurationMs: 8000
  };
}

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

function dayKeyFromLocalDate(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
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
  const today = dayKeyFromLocalDate(now);
  return clips.some((clip) => clip.recordedOn.slice(0, 10) === today);
}

export function uniquePracticeDays(clips: Clip[]) {
  const days = new Set<string>();
  for (const clip of clips) {
    days.add(clip.recordedOn.slice(0, 10));
  }
  return days;
}

function qualifiedDaySetFromRule(clips: Clip[], rule: ChapterCaptureRule) {
  const qualified = new Set<string>();
  for (const clip of clips) {
    if (clip.captureType === rule.captureMode) {
      qualified.add(clip.recordedOn.slice(0, 10));
    }
  }
  return qualified;
}

export function getChapterDayCount(clips: Clip[], rule: ChapterCaptureRule) {
  return qualifiedDaySetFromRule(clips, rule).size;
}

export function hasChapterClipToday(clips: Clip[], rule: ChapterCaptureRule, now = new Date()) {
  const today = dayKeyFromLocalDate(now);
  return qualifiedDaySetFromRule(clips, rule).has(today);
}

export function getChapterStreak(clips: Clip[], rule: ChapterCaptureRule, now = new Date()) {
  const days = qualifiedDaySetFromRule(clips, rule);
  const cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);
  // If no clip today, start counting from yesterday so the streak
  // doesn't drop to 0 before the user has a chance to practice.
  if (!days.has(dayKeyFromLocalDate(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let streak = 0;
  while (days.has(dayKeyFromLocalDate(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
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

export function getLongestStreak(clips: Clip[]) {
  const days = uniquePracticeDays(clips);
  if (days.size === 0) return 0;
  const sorted = [...days].sort();
  let best = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1] + "T00:00:00");
    const curr = new Date(sorted[i] + "T00:00:00");
    const diffMs = curr.getTime() - prev.getTime();
    if (diffMs === 86400000) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 1;
    }
  }
  return best;
}

export function getCurrentStreak(clips: Clip[], now = new Date()) {
  const days = uniquePracticeDays(clips);
  const cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);
  if (!days.has(dayKeyFromLocalDate(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let streak = 0;
  while (days.has(dayKeyFromLocalDate(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
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

function getHourOfClip(clip: Clip) {
  return new Date(clip.recordedAt).getHours();
}

function circularHourDistance(a: number, b: number) {
  const distance = Math.abs(a - b);
  return Math.min(distance, 24 - distance);
}

function selectTrailerIndices(total: number) {
  if (total <= 1) return [0];
  if (total === 2) return [0, 1];
  if (total === 3) return [0, 1, 2];
  const end = total - 1;
  const indices = [0, Math.round(end * 0.33), Math.round(end * 0.66), end];
  return [...new Set(indices)].sort((a, b) => a - b);
}

function buildTrailerMoments(chapterClips: Clip[]) {
  if (!chapterClips.length) return [] as ChapterTrailerMoment[];
  const indices = selectTrailerIndices(chapterClips.length);
  const labelsByCount: Record<number, string[]> = {
    1: ["NOW"],
    2: ["THEN", "NOW"],
    3: ["THEN", "MOMENT", "NOW"],
    4: ["THEN", "MOMENT 1", "MOMENT 2", "NOW"]
  };
  const labels = labelsByCount[indices.length] ?? labelsByCount[4];
  return indices.map((index, labelIndex) => ({
    clip: chapterClips[index],
    label: labels[labelIndex] ?? `MOMENT ${labelIndex + 1}`
  }));
}

function scoreAnchorCandidate(params: {
  candidate: Clip;
  nowClip: Clip;
  candidateIndex: number;
  totalCandidates: number;
  milestoneLengthDays: number;
}) {
  const { candidate, nowClip, candidateIndex, totalCandidates, milestoneLengthDays } = params;
  const nowMs = new Date(nowClip.recordedAt).getTime();
  const thenMs = new Date(candidate.recordedAt).getTime();
  const dayGap = Math.max(1, Math.round((nowMs - thenMs) / 86400000));

  const durationDeltaRatio = Math.abs(candidate.durationMs - nowClip.durationMs) / Math.max(1000, nowClip.durationMs);
  const durationScore = 1 - Math.min(1, durationDeltaRatio);

  const hourDistance = circularHourDistance(getHourOfClip(candidate), getHourOfClip(nowClip));
  const timeWindowScore = 1 - hourDistance / 12;

  const targetGap = Math.max(2, Math.round(milestoneLengthDays * 0.55));
  const changeDistanceScore = Math.min(1, dayGap / targetGap);

  const earlyAnchorScore = totalCandidates <= 1 ? 1 : 1 - candidateIndex / (totalCandidates - 1);
  const totalScore =
    durationScore * 0.44 +
    timeWindowScore * 0.24 +
    changeDistanceScore * 0.22 +
    earlyAnchorScore * 0.1;

  return {
    totalScore,
    durationScore,
    timeWindowScore,
    dayGap
  };
}

export function buildChapterComparisonPlan(clips: Clip[], config: MilestoneChapterConfig): ChapterComparisonPlan | null {
  if (clips.length < 2) return null;
  const clipsAscending = sortClipsAscending(clips);
  const startIndex = Math.max(0, Math.min(clipsAscending.length - 1, (config.milestoneStartDay || 1) - 1));
  const chapterClips = clipsAscending.slice(startIndex);
  if (chapterClips.length < 2) return null;

  const nowClip = chapterClips[chapterClips.length - 1];
  const candidateEndIndex = Math.max(1, Math.floor((chapterClips.length - 1) * 0.55));
  const anchorCandidates = chapterClips.slice(0, candidateEndIndex + 1).filter((clip) => clip.id !== nowClip.id);
  if (!anchorCandidates.length) return null;

  let bestIndex = 0;
  let bestScore = Number.NEGATIVE_INFINITY;
  let bestDiagnostics = { durationScore: 0, timeWindowScore: 0, dayGap: 1 };

  for (let index = 0; index < anchorCandidates.length; index += 1) {
    const diagnostics = scoreAnchorCandidate({
      candidate: anchorCandidates[index],
      nowClip,
      candidateIndex: index,
      totalCandidates: anchorCandidates.length,
      milestoneLengthDays: config.milestoneLengthDays
    });
    if (diagnostics.totalScore > bestScore) {
      bestScore = diagnostics.totalScore;
      bestIndex = index;
      bestDiagnostics = diagnostics;
    }
  }

  const thenClip = anchorCandidates[bestIndex];
  if (!thenClip || thenClip.id === nowClip.id) return null;

  const consistencyScore = Math.max(0, Math.min(100, Math.round((bestDiagnostics.durationScore * 0.62 + bestDiagnostics.timeWindowScore * 0.38) * 100)));
  const strategyLabel = bestIndex === 0 ? "Day 1 Anchor" : consistencyScore >= 72 ? "Consistency-Matched Anchor" : "Early Chapter Anchor";
  const reason =
    bestIndex === 0
      ? `Paired your first chapter take with the latest for maximum visible change (${bestDiagnostics.dayGap} day gap).`
      : `Paired an early chapter take with strong consistency match and a ${bestDiagnostics.dayGap}-day gap.`;

  return {
    comparison: {
      thenClip,
      nowClip,
      thenLabel: formatDayLabel(clipsAscending, thenClip),
      nowLabel: formatDayLabel(clipsAscending, nowClip),
      title: `Chapter ${Math.max(1, config.milestoneChapter || 1)} Reveal`
    },
    strategyLabel,
    reason,
    consistencyScore,
    trailerMoments: buildTrailerMoments(chapterClips)
  };
}

export function buildRevealComparisonPlanFromRange(params: {
  clips: Clip[];
  reveal: RevealRangeDescriptor;
  captureMode: "video" | "photo";
}): ChapterComparisonPlan | null {
  const filteredClips = sortClipsAscending(params.clips).filter((clip) => clip.captureType === params.captureMode);
  if (filteredClips.length < 2) return null;

  const dayNumbered: Array<{ clip: Clip; dayNumber: number }> = [];
  const dayKeys = new Set<string>();
  for (const clip of filteredClips) {
    dayKeys.add(clip.recordedOn.slice(0, 10));
    dayNumbered.push({ clip, dayNumber: dayKeys.size });
  }

  let chapterClips = dayNumbered
    .filter((entry) => entry.dayNumber >= params.reveal.startDayIndex && entry.dayNumber <= params.reveal.endDayIndex)
    .map((entry) => entry.clip);

  if (chapterClips.length < 2) {
    const startCandidate = [...dayNumbered].sort(
      (a, b) => Math.abs(a.dayNumber - params.reveal.startDayIndex) - Math.abs(b.dayNumber - params.reveal.startDayIndex)
    )[0]?.clip;
    const endCandidate = [...dayNumbered].sort(
      (a, b) => Math.abs(a.dayNumber - params.reveal.endDayIndex) - Math.abs(b.dayNumber - params.reveal.endDayIndex)
    )[0]?.clip;

    if (!startCandidate || !endCandidate || startCandidate.id === endCandidate.id) return null;
    chapterClips = sortClipsAscending([startCandidate, endCandidate]);
  }

  const plan = buildChapterComparisonPlan(chapterClips, {
    milestoneLengthDays: params.reveal.milestoneLengthDays,
    milestoneStartDay: 1,
    milestoneChapter: params.reveal.chapterNumber
  });
  if (!plan) return null;

  return {
    ...plan,
    reason: `History replay: ${plan.reason}`
  };
}

export function buildRevealProtocolComplianceFromRange(params: {
  clips: Clip[];
  reveal: RevealRangeDescriptor;
  captureMode: "video" | "photo";
  skillPack: SkillPack;
}): RevealProtocolCompliance | null {
  const filteredClips = sortClipsAscending(params.clips).filter((clip) => clip.captureType === params.captureMode);
  if (!filteredClips.length) return null;

  const dayNumbered: Array<{ clip: Clip; dayNumber: number }> = [];
  const dayKeys = new Set<string>();
  for (const clip of filteredClips) {
    dayKeys.add(clip.recordedOn.slice(0, 10));
    dayNumbered.push({ clip, dayNumber: dayKeys.size });
  }

  const chapterClips = dayNumbered
    .filter((entry) => entry.dayNumber >= params.reveal.startDayIndex && entry.dayNumber <= params.reveal.endDayIndex)
    .map((entry) => entry.clip);
  if (!chapterClips.length) return null;

  const profile = getCaptureProtocolProfile(params.skillPack, params.captureMode);
  const isCompliant = (clip: Clip) =>
    params.captureMode === "photo" ? true : clip.durationMs >= profile.recommendedMinDurationMs;
  const compliantClips = chapterClips.filter(isCompliant).length;
  const compliancePct = Math.round((compliantClips / chapterClips.length) * 100);

  return {
    totalClips: chapterClips.length,
    compliantClips,
    compliancePct,
    targetDurationSeconds: Math.max(0, Math.round(profile.recommendedMinDurationMs / 1000))
  };
}

function formatRevealCompletionDate(value: string | null | undefined) {
  if (!value) return "recently";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "recently";
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function buildRevealStoryline(params: {
  chapterNumber: number;
  milestoneLengthDays: number;
  recordedDays: number;
  completedAt?: string | null;
  consistencyScore?: number | null;
  trailerMomentCount?: number;
}): RevealStoryline {
  const chapterNumber = Math.max(1, Math.trunc(params.chapterNumber || 1));
  const milestoneLengthDays = Math.max(1, Math.trunc(params.milestoneLengthDays || 7));
  const recordedDays = Math.max(0, Math.trunc(params.recordedDays || 0));
  const completedAt = formatRevealCompletionDate(params.completedAt);
  const consistencyScore =
    typeof params.consistencyScore === "number" && Number.isFinite(params.consistencyScore)
      ? Math.max(0, Math.min(100, Math.round(params.consistencyScore)))
      : null;
  const trailerMomentCount = Math.max(0, Math.trunc(params.trailerMomentCount || 0));
  const progress = `${Math.min(recordedDays, milestoneLengthDays)}/${milestoneLengthDays}`;

  let arcLabel = "Momentum Arc";
  if (consistencyScore !== null && consistencyScore >= 85) {
    arcLabel = "Precision Arc";
  } else if (consistencyScore !== null && consistencyScore >= 70) {
    arcLabel = "Control Arc";
  } else if (recordedDays >= milestoneLengthDays) {
    arcLabel = "Consistency Arc";
  } else if (trailerMomentCount >= 4) {
    arcLabel = "Build Arc";
  }

  const headline = `Chapter ${chapterNumber}: ${arcLabel}`;
  const caption = `${progress} days captured • ${Math.max(1, trailerMomentCount)}-moment reel • Completed ${completedAt}`;
  const reflection =
    consistencyScore !== null && consistencyScore >= 85
      ? "Clean execution across the chapter. Keep this protocol and scale challenge next."
      : consistencyScore !== null && consistencyScore >= 70
        ? "Visible progression with stable form. Next chapter should tighten consistency under fatigue."
        : recordedDays >= milestoneLengthDays
          ? "Strong completion discipline. The next unlock is sharper alignment, not more effort."
          : "Momentum is building. Protect daily reps to make the next reveal more dramatic.";

  return {
    arcLabel,
    headline,
    caption,
    reflection
  };
}

export function getMilestoneChapterProgress(dayCount: number, config: MilestoneChapterConfig): MilestoneChapterProgress {
  const milestoneLengthDays = milestoneLengthOptions.includes(config.milestoneLengthDays as MilestoneLengthOption)
    ? config.milestoneLengthDays
    : 7;
  const milestoneStartDay = Math.max(1, config.milestoneStartDay || 1);
  const milestoneChapter = Math.max(1, config.milestoneChapter || 1);
  const progressDays = Math.max(0, dayCount - milestoneStartDay + 1);
  const remainingDays = Math.max(0, milestoneLengthDays - progressDays);
  const endDayTarget = milestoneStartDay + milestoneLengthDays - 1;
  const completedRatio = milestoneLengthDays <= 0 ? 0 : Math.min(1, progressDays / milestoneLengthDays);
  return {
    milestoneLengthDays,
    milestoneStartDay,
    milestoneChapter,
    progressDays,
    remainingDays,
    endDayTarget,
    completedRatio,
    reachedReveal: progressDays >= milestoneLengthDays
  };
}

export function buildChapterComparisonPair(clips: Clip[], config: MilestoneChapterConfig): ComparisonPair | null {
  return buildChapterComparisonPlan(clips, config)?.comparison ?? null;
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
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(today.getDate() - (totalDays - 1));

  for (let index = 0; index < totalDays; index += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const dateKey = dayKeyFromLocalDate(date);
    const dayShort = date.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 1);
    cells.push({
      key: `${dateKey}-${index}`,
      dateKey,
      dayShort,
      practiced: practicedDays.has(dateKey),
      isToday: dateKey === dayKeyFromLocalDate(today)
    });
  }

  return cells;
}

export function buildProtocolConsistencyTrend(params: {
  clips: Clip[];
  captureMode: "video" | "photo";
  skillPack: SkillPack;
  now?: Date;
}): ProtocolConsistencyTrend {
  const { clips, captureMode, skillPack, now = new Date() } = params;
  const profile = getCaptureProtocolProfile(skillPack, captureMode);
  const relevant = sortClipsAscending(clips).filter((clip) => clip.captureType === captureMode);
  if (!relevant.length) {
    return {
      totalClips: 0,
      compliantClips: 0,
      consistencyPct: 0,
      compliantDayStreak: 0,
      recentPct: null,
      previousPct: null,
      trendDeltaPct: null,
      trendLabel: null,
      targetDurationSeconds: Math.max(0, Math.round(profile.recommendedMinDurationMs / 1000))
    };
  }

  const isCompliant = (clip: Clip) => {
    if (captureMode === "photo") return true;
    return clip.durationMs >= profile.recommendedMinDurationMs;
  };
  const compliantClips = relevant.filter(isCompliant).length;
  const consistencyPct = Math.round((compliantClips / relevant.length) * 100);
  const compliantDaySet = new Set<string>();
  for (const clip of relevant) {
    if (!isCompliant(clip)) continue;
    compliantDaySet.add(clip.recordedOn.slice(0, 10));
  }
  let compliantDayStreak = 0;
  const streakCursor = new Date(now);
  streakCursor.setHours(0, 0, 0, 0);
  while (compliantDaySet.has(dayKeyFromLocalDate(streakCursor))) {
    compliantDayStreak += 1;
    streakCursor.setDate(streakCursor.getDate() - 1);
  }

  const windowSize = 7;
  const recentWindow = relevant.slice(-windowSize);
  const previousWindow = relevant.slice(Math.max(0, relevant.length - windowSize * 2), Math.max(0, relevant.length - windowSize));
  const recentPct =
    recentWindow.length > 0 ? Math.round((recentWindow.filter(isCompliant).length / recentWindow.length) * 100) : null;
  const previousPct =
    previousWindow.length > 0 ? Math.round((previousWindow.filter(isCompliant).length / previousWindow.length) * 100) : null;

  let trendDeltaPct: number | null = null;
  let trendLabel: "up" | "down" | "flat" | null = null;
  if (recentPct !== null && previousPct !== null) {
    trendDeltaPct = recentPct - previousPct;
    if (trendDeltaPct >= 8) trendLabel = "up";
    else if (trendDeltaPct <= -8) trendLabel = "down";
    else trendLabel = "flat";
  }

  return {
    totalClips: relevant.length,
    compliantClips,
    consistencyPct,
    compliantDayStreak,
    recentPct,
    previousPct,
    trendDeltaPct,
    trendLabel,
    targetDurationSeconds: Math.max(0, Math.round(profile.recommendedMinDurationMs / 1000))
  };
}
