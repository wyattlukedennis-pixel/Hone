import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "hone.bestStreak";

export async function readBestStreak(): Promise<number> {
  try {
    const value = await AsyncStorage.getItem(KEY);
    return value ? parseInt(value, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

export async function saveBestStreak(streak: number): Promise<void> {
  await AsyncStorage.setItem(KEY, String(streak));
}
