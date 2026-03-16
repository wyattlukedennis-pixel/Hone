import AsyncStorage from "@react-native-async-storage/async-storage";

const MORE_ACTIONS_HINT_SEEN_KEY = "hone.ui.moreActionsHintSeen.v1";

export async function readMoreActionsHintSeen() {
  try {
    const value = await AsyncStorage.getItem(MORE_ACTIONS_HINT_SEEN_KEY);
    return value === "1";
  } catch {
    return false;
  }
}

export async function markMoreActionsHintSeen() {
  await AsyncStorage.setItem(MORE_ACTIONS_HINT_SEEN_KEY, "1");
}

