export type JourneyProgression = {
  totalXp: number;
  level: number;
  levelName: string;
  nextLevel: number | null;
  xpIntoLevel: number;
  xpRequiredForNextLevel: number;
  xpRemaining: number;
  progressRatio: number;
  chapterCompletions: number;
  practiceDays: number;
  streak: number;
};

type BuildJourneyProgressionInput = {
  practiceDays: number;
  streak: number;
  chapterCompletions: number;
  bonusXp?: number;
};

const levelThresholds = [0, 120, 320, 620, 1040, 1620, 2400, 3400, 4700, 6400] as const;
const levelNames = [
  "Starter",
  "Builder",
  "Consistency",
  "Craft",
  "Momentum",
  "Operator",
  "Specialist",
  "Expert",
  "Master",
  "Legend"
] as const;

function clampNonNegative(value: number) {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.floor(value);
}

function resolveLevel(totalXp: number) {
  for (let index = levelThresholds.length - 1; index >= 0; index -= 1) {
    if (totalXp >= levelThresholds[index]) {
      return index + 1;
    }
  }
  return 1;
}

export function buildJourneyProgression(input: BuildJourneyProgressionInput): JourneyProgression {
  const practiceDays = clampNonNegative(input.practiceDays);
  const streak = clampNonNegative(input.streak);
  const chapterCompletions = clampNonNegative(input.chapterCompletions);
  const bonusXp = clampNonNegative(input.bonusXp ?? 0);

  const practiceXp = practiceDays * 12;
  const streakXp = Math.min(streak, 45) * 4;
  const completionXp = chapterCompletions * 180;
  const consistencyXp = Math.floor(practiceDays / 7) * 24;
  const totalXp = practiceXp + streakXp + completionXp + consistencyXp + bonusXp;

  const level = resolveLevel(totalXp);
  const levelIndex = Math.min(level - 1, levelThresholds.length - 1);
  const currentLevelFloor = levelThresholds[levelIndex];
  const nextLevel = level < levelThresholds.length ? level + 1 : null;
  const nextLevelThreshold = nextLevel ? levelThresholds[nextLevel - 1] : null;
  const xpIntoLevel = totalXp - currentLevelFloor;
  const xpRequiredForNextLevel = nextLevelThreshold ? Math.max(1, nextLevelThreshold - currentLevelFloor) : 1;
  const xpRemaining = nextLevelThreshold ? Math.max(0, nextLevelThreshold - totalXp) : 0;
  const progressRatio = nextLevelThreshold ? Math.max(0, Math.min(1, xpIntoLevel / xpRequiredForNextLevel)) : 1;

  return {
    totalXp,
    level,
    levelName: levelNames[Math.min(level - 1, levelNames.length - 1)],
    nextLevel,
    xpIntoLevel,
    xpRequiredForNextLevel,
    xpRemaining,
    progressRatio,
    chapterCompletions,
    practiceDays,
    streak
  };
}
