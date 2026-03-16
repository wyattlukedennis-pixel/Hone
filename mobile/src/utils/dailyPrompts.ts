const DAILY_PRACTICE_PROMPTS = [
  "Slow it down and keep each rep clean.",
  "Keep your posture steady from start to finish.",
  "Focus on timing before speed.",
  "Repeat the hardest section three extra times.",
  "Stay relaxed. Smooth beats force.",
  "Match your framing so tomorrow's comparison is clearer.",
  "Do one take that feels 10% more controlled.",
  "Practice transitions, not just highlights.",
  "Keep it short and consistent. Show up.",
  "Prioritize clarity over complexity today.",
  "Use fewer mistakes as your win condition.",
  "Give yourself one focused minute before recording."
];

function getDayOfYear(date: Date) {
  const start = new Date(date.getFullYear(), 0, 1);
  const diffMs = date.getTime() - start.getTime();
  return Math.floor(diffMs / 86400000) + 1;
}

export function getDailyPracticePrompt(date: Date) {
  const index = (getDayOfYear(date) - 1) % DAILY_PRACTICE_PROMPTS.length;
  return DAILY_PRACTICE_PROMPTS[index];
}

