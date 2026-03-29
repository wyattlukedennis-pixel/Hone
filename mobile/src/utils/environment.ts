/**
 * Show dev tools in development builds or when enabled via
 * the EXPO_PUBLIC_TESTFLIGHT env var (set in EAS build profile).
 */
export function showDevTools(): boolean {
  return __DEV__ || process.env.EXPO_PUBLIC_TESTFLIGHT === "1";
}
