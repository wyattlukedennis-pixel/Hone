import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "hone.darkMode";

export async function readDarkMode(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(KEY);
    return value === "true";
  } catch {
    return false;
  }
}

export async function saveDarkMode(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(KEY, String(enabled));
}
