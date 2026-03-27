import type { Clip } from "../types/clip";

export type WeeklyQuestTier = "foundation" | "momentum" | "elite";

export type WeeklyQuest = {
  id: string;
  weekKey: string;
  tier: WeeklyQuestTier;
  title: string;
  description: string;
  targetDays: number;
  progressDays: number;
  remainingDays: number;
  completed: boolean;
  rewardXp: number;
  rewardLabel: string;
  ctaLabel: string;
};

type BuildWeeklyQuestInput = {
  clips: Clip[];
  captureMode: "video" | "photo";
  now?: Date;
  streak: number;
  chapterCompletions: number;
};

function pad2(value: number) {
  return `${value}`.padStart(2, "0");
}

function dayKeyFromLocalDate(value: Date) {
  return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
}

function resolveWeekStartMonday(value: Date) {
  const start = new Date(value);
  start.setHours(0, 0, 0, 0);
  const offset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - offset);
  return start;
}

function resolveQuestTier(streak: number, chapterCompletions: number) {
  if (streak >= 21 || chapterCompletions >= 8) {
    return {
      id: "quest_elite_7",
      tier: "elite" as const,
      title: "Editorial Consistency",
      description: "Hit a full 7-day chapter rhythm this week.",
      targetDays: 7,
      rewardXp: 120
    };
  }
  if (streak >= 10 || chapterCompletions >= 3) {
    return {
      id: "quest_momentum_5",
      tier: "momentum" as const,
      title: "Consistency Builder",
      description: "Lock 5 chapter takes this week.",
      targetDays: 5,
      rewardXp: 80
    };
  }
  return {
    id: "quest_foundation_3",
    tier: "foundation" as const,
    title: "Momentum Starter",
    description: "Log 3 chapter takes this week.",
    targetDays: 3,
    rewardXp: 50
  };
}

function countQualifiedDaysInWeek(params: {
  clips: Clip[];
  captureMode: "video" | "photo";
  weekStart: Date;
  weekEnd: Date;
}) {
  const { clips, captureMode, weekStart, weekEnd } = params;
  const startKey = dayKeyFromLocalDate(weekStart);
  const endKey = dayKeyFromLocalDate(weekEnd);
  const days = new Set<string>();
  for (const clip of clips) {
    if (clip.captureType !== captureMode) continue;
    const dayKey = clip.recordedOn.slice(0, 10);
    if (dayKey >= startKey && dayKey <= endKey) {
      days.add(dayKey);
    }
  }
  return days.size;
}

export function buildWeeklyQuest(input: BuildWeeklyQuestInput): WeeklyQuest {
  const now = input.now ?? new Date();
  const weekStart = resolveWeekStartMonday(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const weekKey = `${dayKeyFromLocalDate(weekStart)}:${dayKeyFromLocalDate(weekEnd)}`;
  const quest = resolveQuestTier(Math.max(0, input.streak), Math.max(0, input.chapterCompletions));
  const progressDays = countQualifiedDaysInWeek({
    clips: input.clips,
    captureMode: input.captureMode,
    weekStart,
    weekEnd
  });
  const remainingDays = Math.max(0, quest.targetDays - progressDays);
  const completed = progressDays >= quest.targetDays;
  const ctaLabel = completed
    ? `Reward applied - +${quest.rewardXp} XP`
    : `${remainingDays} ${remainingDays === 1 ? "day" : "days"} left this week`;

  return {
    id: quest.id,
    weekKey,
    tier: quest.tier,
    title: quest.title,
    description: quest.description,
    targetDays: quest.targetDays,
    progressDays,
    remainingDays,
    completed,
    rewardXp: quest.rewardXp,
    rewardLabel: `+${quest.rewardXp} XP`,
    ctaLabel
  };
}
