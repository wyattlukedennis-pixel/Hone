type AnalyticsProps = Record<string, string | number | boolean | null | undefined>;

export function trackEvent(name: string, props: AnalyticsProps = {}) {
  if (!__DEV__) return;
  // Dev-safe event sink until production analytics is wired.
  console.log(`[analytics] ${name}`, props);
}
