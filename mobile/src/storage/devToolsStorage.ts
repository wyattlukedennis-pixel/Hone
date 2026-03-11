import AsyncStorage from "@react-native-async-storage/async-storage";

import { defaultDevDateShiftSettings, type DevDateShiftSettings } from "../types/devTools";

const DEV_DATE_SHIFT_KEY = "hone.dev.dateShift";

function normalize(raw: Partial<DevDateShiftSettings> | null | undefined): DevDateShiftSettings {
  return {
    enabled: Boolean(raw?.enabled),
    dayOffset: Number.isFinite(raw?.dayOffset) ? Math.trunc(raw!.dayOffset as number) : 0,
    autoAdvanceAfterSave: Boolean(raw?.autoAdvanceAfterSave)
  };
}

export async function readDevDateShiftSettings() {
  try {
    const value = await AsyncStorage.getItem(DEV_DATE_SHIFT_KEY);
    if (!value) return defaultDevDateShiftSettings;
    const parsed = JSON.parse(value) as Partial<DevDateShiftSettings>;
    return normalize(parsed);
  } catch {
    return defaultDevDateShiftSettings;
  }
}

export async function saveDevDateShiftSettings(settings: DevDateShiftSettings) {
  await AsyncStorage.setItem(DEV_DATE_SHIFT_KEY, JSON.stringify(normalize(settings)));
}

export async function clearDevDateShiftSettings() {
  await AsyncStorage.removeItem(DEV_DATE_SHIFT_KEY);
}
