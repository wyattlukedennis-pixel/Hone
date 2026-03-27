import AsyncStorage from "@react-native-async-storage/async-storage";

import { env } from "../env";

const QUICK_SHARE_CAP_KEY_PREFIX = "hone.reveal.quick_share_cap.v1";
const QUICK_SHARE_CAP_TTL_MS = env.revealQuickShareCapDays * 24 * 60 * 60 * 1000;

type QuickShareCapRecord = {
  version: 1;
  cappedAt: number;
  expiresAt: number;
};

function buildQuickShareCapKey(params: { journeyId: string | null; chapterNumber: number }) {
  const journeySegment = params.journeyId?.trim() || "none";
  return `${QUICK_SHARE_CAP_KEY_PREFIX}:${journeySegment}:${params.chapterNumber}`;
}

export async function readQuickShareCap(params: { journeyId: string | null; chapterNumber: number }) {
  const key = buildQuickShareCapKey(params);
  try {
    const value = await AsyncStorage.getItem(key);
    if (!value) return false;
    if (value === "1") {
      // Legacy marker from earlier implementation: treat as capped and migrate.
      await writeQuickShareCap(params);
      return true;
    }
    const parsed = JSON.parse(value) as Partial<QuickShareCapRecord>;
    if (parsed.version !== 1 || typeof parsed.expiresAt !== "number") {
      await AsyncStorage.removeItem(key);
      return false;
    }
    if (Date.now() >= parsed.expiresAt) {
      await AsyncStorage.removeItem(key);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function writeQuickShareCap(params: { journeyId: string | null; chapterNumber: number }) {
  const now = Date.now();
  const payload: QuickShareCapRecord = {
    version: 1,
    cappedAt: now,
    expiresAt: now + QUICK_SHARE_CAP_TTL_MS
  };
  try {
    await AsyncStorage.setItem(buildQuickShareCapKey(params), JSON.stringify(payload));
  } catch {
    // Best-effort persistence for non-critical UI experiment.
  }
}
