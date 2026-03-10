import AsyncStorage from "@react-native-async-storage/async-storage";

const ACTIVE_JOURNEY_KEY = "hone.activeJourneyId";

export async function readActiveJourneyId() {
  return AsyncStorage.getItem(ACTIVE_JOURNEY_KEY);
}

export async function saveActiveJourneyId(journeyId: string) {
  await AsyncStorage.setItem(ACTIVE_JOURNEY_KEY, journeyId);
}

export async function clearActiveJourneyId() {
  await AsyncStorage.removeItem(ACTIVE_JOURNEY_KEY);
}
