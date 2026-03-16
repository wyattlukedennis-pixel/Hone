export function formatClipDay(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 10);
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

export function formatDurationMs(ms: number) {
  return `${Math.max(1, Math.round(ms / 1000))}s`;
}

export function toJourneyErrorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : "Unexpected error";
  if (raw === "UNAUTHORIZED") return "Session expired. Please login again.";
  if (raw === "BACKEND_MIGRATION_REQUIRED") return "Backend schema is outdated. Restart backend and run migrations.";
  if (raw === "Internal Server Error") return "Backend error. Check backend logs and restart the API.";
  if (raw === "TITLE_REQUIRED") return "Title is required.";
  if (raw === "TITLE_TOO_LONG") return "Title must be 120 characters or fewer.";
  if (raw === "INVALID_MILESTONE_LENGTH") return "Choose 7, 14, 30, or 100 days.";
  if (raw === "MILESTONE_LENGTH_REQUIRED") return "Choose a milestone length.";
  if (raw === "JOURNEY_NOT_FOUND") return "Journey no longer exists.";
  if (raw === "UPLOAD_NOT_READY") return "Upload is still processing. Please retry.";
  if (raw.startsWith("Network request failed")) return raw;
  return raw;
}

const dailyPrompts = [
  "Today's focus: slow it down and keep your form clean.",
  "Today's focus: smoother transitions between movements.",
  "Today's focus: one clean take, not a perfect take.",
  "Today's focus: repeat the hardest part three extra times.",
  "Today's focus: relax your shoulders and breathe while practicing.",
  "Today's focus: keep the same framing so progress is easier to see."
];

function pickLine(lines: string[], seed: number) {
  if (!lines.length) return "";
  const index = Math.abs(seed) % lines.length;
  return lines[index];
}

export function buildHeroMessage(practicedToday: boolean, streak: number, dayCount: number) {
  if (practicedToday) {
    return pickLine(
      [
        "Nice work. You showed up today.",
        "Momentum building. Keep this rhythm tomorrow.",
        `Day ${Math.max(dayCount, 1)} is logged. Progress is building.`
      ],
      dayCount + streak
    );
  }

  if (streak > 0) {
    return pickLine(
      [
        `Show up today to protect your ${streak} Day Practice Streak.`,
        "Small progress today keeps your momentum alive.",
        "Consistency builds mastery. Record today's session."
      ],
      streak + dayCount
    );
  }

  return pickLine(
    [
      "Show up today. Sharpen your skill.",
      "Small progress today builds long-term mastery.",
      "Your next clip is the next step forward."
    ],
    dayCount
  );
}

export function buildSaveMessage(dayCount: number, streak: number, unlockedMilestoneTitle: string | null) {
  if (unlockedMilestoneTitle) {
    return `Nice. Day ${dayCount} recorded. ${unlockedMilestoneTitle} unlocked.`;
  }
  if (streak > 1) {
    return `Nice. Day ${dayCount} recorded. ${streak} Day Practice Streak.`;
  }
  return `Nice. Day ${dayCount} recorded. Momentum building.`;
}

export function buildSaveCelebration(dayCount: number, streak: number, unlockedMilestoneTitle: string | null) {
  const title = `Day ${dayCount} added`;
  if (unlockedMilestoneTitle) {
    return {
      title,
      subtitle: `${unlockedMilestoneTitle} reached`
    };
  }
  if (streak > 1) {
    return {
      title,
      subtitle: `${streak} Day Practice Streak`
    };
  }
  return {
    title,
    subtitle: "Another step in this chapter"
  };
}

export function getPracticeIdentity(dayCount: number) {
  if (dayCount >= 365) return "Year of Practice";
  if (dayCount >= 100) return "Dedicated Practitioner";
  if (dayCount >= 30) return "Consistent Practitioner";
  if (dayCount >= 14) return "Two-Week Practitioner";
  if (dayCount >= 7) return "Week One Practitioner";
  if (dayCount >= 3) return "Getting Started";
  return "Day One Starter";
}

export function getTodayPrompt(dayCount: number, journeyId: string | null) {
  const dayOfMonth = Number(new Date().toISOString().slice(8, 10)) || 1;
  const seed = dayOfMonth + dayCount + (journeyId?.length ?? 0);
  return pickLine(dailyPrompts, seed);
}
