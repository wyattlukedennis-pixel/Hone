import AsyncStorage from "@react-native-async-storage/async-storage";

const AUTH_TOKEN_KEY = "hone.auth.token";

export async function saveAuthToken(token: string) {
  await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
}

export async function readAuthToken() {
  return AsyncStorage.getItem(AUTH_TOKEN_KEY);
}

export async function clearAuthToken() {
  await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
}
