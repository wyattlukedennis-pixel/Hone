import AsyncStorage from "@react-native-async-storage/async-storage";

const AUTO_REMINDER_SETUP_COMPLETED_KEY = "hone.autoReminderSetup.completed.v1";

export async function readAutoReminderSetupCompleted() {
  try {
    const value = await AsyncStorage.getItem(AUTO_REMINDER_SETUP_COMPLETED_KEY);
    return value === "1";
  } catch {
    return false;
  }
}

export async function writeAutoReminderSetupCompleted() {
  try {
    await AsyncStorage.setItem(AUTO_REMINDER_SETUP_COMPLETED_KEY, "1");
  } catch {
    // Best-effort persistence for onboarding hint state.
  }
}

