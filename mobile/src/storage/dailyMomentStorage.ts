import AsyncStorage from "@react-native-async-storage/async-storage";

import { defaultDailyMomentSettings, type DailyMomentSettings } from "../types/dailyMoment";

const DAILY_MOMENT_SETTINGS_KEY = "hone.dailyMoment.settings";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalize(raw: Partial<DailyMomentSettings> | null | undefined): DailyMomentSettings {
  return {
    enabled: raw?.enabled ?? defaultDailyMomentSettings.enabled,
    hour: Number.isFinite(raw?.hour) ? clamp(Math.trunc(raw!.hour as number), 0, 23) : defaultDailyMomentSettings.hour,
    minute: Number.isFinite(raw?.minute) ? clamp(Math.trunc(raw!.minute as number), 0, 59) : defaultDailyMomentSettings.minute,
    windowMinutes: Number.isFinite(raw?.windowMinutes)
      ? clamp(Math.trunc(raw!.windowMinutes as number), 1, 60)
      : defaultDailyMomentSettings.windowMinutes,
    autoOpenRecorder: raw?.autoOpenRecorder ?? defaultDailyMomentSettings.autoOpenRecorder
  };
}

export async function readDailyMomentSettings() {
  try {
    const value = await AsyncStorage.getItem(DAILY_MOMENT_SETTINGS_KEY);
    if (!value) return defaultDailyMomentSettings;
    const parsed = JSON.parse(value) as Partial<DailyMomentSettings>;
    return normalize(parsed);
  } catch {
    return defaultDailyMomentSettings;
  }
}

export async function saveDailyMomentSettings(settings: DailyMomentSettings) {
  await AsyncStorage.setItem(DAILY_MOMENT_SETTINGS_KEY, JSON.stringify(normalize(settings)));
}

export async function clearDailyMomentSettings() {
  await AsyncStorage.removeItem(DAILY_MOMENT_SETTINGS_KEY);
}
