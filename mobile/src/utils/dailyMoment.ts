import type { Clip } from "../types/clip";
import type { DailyMomentSettings } from "../types/dailyMoment";

type DailyWindow = {
  start: Date;
  end: Date;
};

function pad(value: number) {
  return `${value}`.padStart(2, "0");
}

export function formatDailyMomentTime(settings: DailyMomentSettings) {
  const date = new Date();
  date.setHours(settings.hour, settings.minute, 0, 0);
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  }).toLowerCase();
}

export function getDailyMomentWindow(now: Date, settings: DailyMomentSettings): DailyWindow {
  const start = new Date(now);
  start.setHours(settings.hour, settings.minute, 0, 0);
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + settings.windowMinutes);
  return { start, end };
}

export function isInDailyMomentWindow(now: Date, settings: DailyMomentSettings) {
  if (!settings.enabled) return false;
  const { start, end } = getDailyMomentWindow(now, settings);
  const nowMs = now.getTime();
  return nowMs >= start.getTime() && nowMs <= end.getTime();
}

export function isClipDailyMoment(clip: Clip, settings: DailyMomentSettings) {
  if (!settings.enabled) return false;
  const recordedAt = new Date(clip.recordedAt);
  if (Number.isNaN(recordedAt.getTime())) return false;
  return isDateInDailyMoment(recordedAt, settings);
}

export function isDateInDailyMoment(value: Date, settings: DailyMomentSettings) {
  if (!settings.enabled) return false;
  const { start, end } = getDailyMomentWindow(value, settings);
  const valueMs = value.getTime();
  return valueMs >= start.getTime() && valueMs <= end.getTime();
}

export function getDailyMomentLabel(now: Date, settings: DailyMomentSettings, practicedToday: boolean) {
  if (!settings.enabled) return null;
  if (practicedToday) return "Daily Moment captured";
  if (isInDailyMomentWindow(now, settings)) return "Daily Moment window open";
  return `Daily Moment at ${formatDailyMomentTime(settings)}`;
}

export function getDailyMomentKey(now: Date) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
