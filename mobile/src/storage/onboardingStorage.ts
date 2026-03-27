import AsyncStorage from "@react-native-async-storage/async-storage";

import type { SkillPack } from "../utils/skillPack";

const COMPLETE_KEY = "hone.onboarding.complete.v1";
const DRAFT_KEY = "hone.onboarding.draft.v1";

export type OnboardingDraft = {
  skillPack: SkillPack | "other";
  customSkillName: string | null;
  goalText: string | null;
  clipUri: string | null;
  clipDurationMs: number | null;
  clipRecordedAt: string | null;
  clipRecordedOn: string | null;
  captureType: "video" | "photo";
};

export async function readOnboardingComplete(): Promise<boolean> {
  const value = await AsyncStorage.getItem(COMPLETE_KEY);
  return value === "1";
}

export async function markOnboardingComplete(): Promise<void> {
  await AsyncStorage.setItem(COMPLETE_KEY, "1");
}

export async function saveOnboardingDraft(data: OnboardingDraft): Promise<void> {
  await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(data));
}

export async function readOnboardingDraft(): Promise<OnboardingDraft | null> {
  const raw = await AsyncStorage.getItem(DRAFT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OnboardingDraft;
  } catch {
    return null;
  }
}

export async function clearOnboardingDraft(): Promise<void> {
  await AsyncStorage.removeItem(DRAFT_KEY);
}
