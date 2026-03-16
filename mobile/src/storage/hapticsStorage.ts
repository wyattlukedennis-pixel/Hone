import AsyncStorage from "@react-native-async-storage/async-storage";

import { defaultHapticsMode, type HapticsMode } from "../types/haptics";

const HAPTICS_MODE_KEY = "hone.haptics.mode";

function normalize(value: unknown): HapticsMode {
  if (value === "off" || value === "subtle" || value === "standard") return value;
  return defaultHapticsMode;
}

export async function readHapticsMode() {
  try {
    const value = await AsyncStorage.getItem(HAPTICS_MODE_KEY);
    return normalize(value);
  } catch {
    return defaultHapticsMode;
  }
}

export async function saveHapticsMode(mode: HapticsMode) {
  await AsyncStorage.setItem(HAPTICS_MODE_KEY, normalize(mode));
}

