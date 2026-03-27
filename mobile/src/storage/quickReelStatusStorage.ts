import AsyncStorage from "@react-native-async-storage/async-storage";

const QUICK_REEL_STATUS_KEY_PREFIX = "hone.quickReel.status.v1";

export type QuickReelStatusRecord = {
  version: 1;
  chapterNumber: number;
  message: string;
  source: "prewarm" | "share" | "save";
  success: boolean;
  ready: boolean;
  updatedAt: number;
};

function buildQuickReelStatusKey(params: { journeyId: string | null }) {
  const journeySegment = params.journeyId?.trim() || "none";
  return `${QUICK_REEL_STATUS_KEY_PREFIX}:${journeySegment}`;
}

function isValidRecord(value: unknown): value is QuickReelStatusRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<QuickReelStatusRecord>;
  if (record.version !== 1) return false;
  if (typeof record.chapterNumber !== "number") return false;
  if (typeof record.message !== "string") return false;
  if (record.source !== "prewarm" && record.source !== "share" && record.source !== "save") return false;
  if (typeof record.success !== "boolean") return false;
  if (typeof record.ready !== "boolean") return false;
  if (typeof record.updatedAt !== "number") return false;
  return true;
}

export async function readQuickReelStatus(params: { journeyId: string | null }) {
  try {
    const key = buildQuickReelStatusKey(params);
    const value = await AsyncStorage.getItem(key);
    if (!value) return null;
    const parsed = JSON.parse(value) as unknown;
    if (!isValidRecord(parsed)) {
      await AsyncStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function writeQuickReelStatus(
  params: {
    journeyId: string | null;
    chapterNumber: number;
    message: string;
    source: "prewarm" | "share" | "save";
    success: boolean;
    ready: boolean;
  }
) {
  const payload: QuickReelStatusRecord = {
    version: 1,
    chapterNumber: params.chapterNumber,
    message: params.message,
    source: params.source,
    success: params.success,
    ready: params.ready,
    updatedAt: Date.now()
  };
  try {
    await AsyncStorage.setItem(buildQuickReelStatusKey(params), JSON.stringify(payload));
  } catch {
    // Best-effort persistence for quick reel UI state.
  }
}
