export type SkillPack = "fitness" | "drawing" | "instrument";

export type Journey = {
  id: string;
  userId: string;
  title: string;
  skillPack: SkillPack;
  category: string | null;
  colorTheme: string | null;
  goalText: string | null;
  captureMode: "video" | "photo";
  startedAt: string;
  archivedAt: string | null;
  milestoneLengthDays: number;
  milestoneStartedOn: string;
  milestoneChapter: number;
  milestoneStartDay: number;
  createdAt: string;
  updatedAt: string;
};

export type JourneyReveal = {
  id: string;
  journeyId: string;
  userId: string;
  chapterNumber: number;
  milestoneLengthDays: number;
  startDayIndex: number;
  endDayIndex: number;
  recordedDays: number;
  completedAt: string;
  createdAt: string;
};

export type JourneyWeeklyQuestCompletion = {
  id: string;
  journeyId: string;
  userId: string;
  weekKey: string;
  questId: string;
  rewardXp: number;
  completedAt: string;
  createdAt: string;
};

export type JourneysResponse = {
  journeys: Journey[];
};

export type JourneyResponse = {
  journey: Journey;
};

export type JourneyRevealsResponse = {
  reveals: JourneyReveal[];
};

export type NextMilestoneResponse = {
  journey: Journey;
  reveal: JourneyReveal;
  progressDays: number;
};

export type JourneyWeeklyQuestCompletionsResponse = {
  quests: JourneyWeeklyQuestCompletion[];
};

export type JourneyWeeklyQuestCompletionResponse = {
  quest: JourneyWeeklyQuestCompletion;
};
