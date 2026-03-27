import AsyncStorage from "@react-native-async-storage/async-storage";

const WEEKLY_PROOF_CARD_DISMISSED_KEY_PREFIX = "hone.weeklyProofCard.dismissed.v1";

function buildKey(params: { journeyId: string | null; weekKey: string }) {
  const journeySegment = params.journeyId?.trim() || "none";
  return `${WEEKLY_PROOF_CARD_DISMISSED_KEY_PREFIX}:${journeySegment}:${params.weekKey}`;
}

export async function readWeeklyProofCardDismissed(params: { journeyId: string | null; weekKey: string }) {
  try {
    const value = await AsyncStorage.getItem(buildKey(params));
    return value === "1";
  } catch {
    return false;
  }
}

export async function writeWeeklyProofCardDismissed(params: { journeyId: string | null; weekKey: string }) {
  try {
    await AsyncStorage.setItem(buildKey(params), "1");
  } catch {
    // Best-effort persistence for non-critical presentation state.
  }
}

