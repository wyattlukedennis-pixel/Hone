import AsyncStorage from "@react-native-async-storage/async-storage";

const JOURNEY_FINALE_UNLOCK_KEY_PREFIX = "hone.journey_finale.unlock.v1";

type JourneyFinaleUnlockRecord = {
  version: 1;
  unlockedAt: number;
};

function buildJourneyFinaleUnlockKey(params: { journeyId: string | null }) {
  const journeySegment = params.journeyId?.trim() || "none";
  return `${JOURNEY_FINALE_UNLOCK_KEY_PREFIX}:${journeySegment}`;
}

export async function readJourneyFinaleUnlockSeen(params: { journeyId: string | null }) {
  try {
    const value = await AsyncStorage.getItem(buildJourneyFinaleUnlockKey(params));
    if (!value) return false;
    const parsed = JSON.parse(value) as Partial<JourneyFinaleUnlockRecord>;
    if (parsed.version !== 1 || typeof parsed.unlockedAt !== "number") {
      await AsyncStorage.removeItem(buildJourneyFinaleUnlockKey(params));
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function writeJourneyFinaleUnlockSeen(params: { journeyId: string | null }) {
  const payload: JourneyFinaleUnlockRecord = {
    version: 1,
    unlockedAt: Date.now()
  };
  try {
    await AsyncStorage.setItem(buildJourneyFinaleUnlockKey(params), JSON.stringify(payload));
  } catch {
    // Best-effort persistence for one-time unlock celebration.
  }
}
