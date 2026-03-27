import Constants from "expo-constants";
import { NativeModules } from "react-native";

const FALLBACK_API_BASE_URL = __DEV__
  ? "http://localhost:4000"
  : "https://api.hone.app"; // placeholder — set EXPO_PUBLIC_API_BASE_URL for production
const appEnv = process.env.EXPO_PUBLIC_APP_ENV ?? "development";
const DEFAULT_REVEAL_QUICK_SHARE_CAP_DAYS = 7;

type DerivedCandidate = {
  source: string;
  url: string;
};

type ConstantsLike = typeof Constants & {
  linkingUri?: string;
  expoGoConfig?: {
    debuggerHost?: string;
  };
  manifest?: {
    debuggerHost?: string;
    hostUri?: string;
  };
  manifest2?: {
    extra?: {
      expoClient?: {
        hostUri?: string;
      };
    };
  };
  experienceUrl?: string;
};

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function isLocalHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function hostnameFromUrl(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function toHttpStyleUrl(value: string) {
  if (value.startsWith("exp://")) return value.replace(/^exp:\/\//, "http://");
  if (value.startsWith("exps://")) return value.replace(/^exps:\/\//, "https://");
  return value;
}

function extractHostname(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const normalized = toHttpStyleUrl(trimmed);
  const withProtocol = /^[a-z][a-z0-9+\-.]*:\/\//i.test(normalized) ? normalized : `http://${normalized}`;
  try {
    return new URL(withProtocol).hostname;
  } catch {
    const noProtocol = normalized.replace(/^[a-z][a-z0-9+\-.]*:\/\//i, "");
    const hostPort = noProtocol.split("/")[0];
    if (!hostPort) return "";
    if (hostPort.startsWith("[")) {
      const endBracket = hostPort.indexOf("]");
      if (endBracket > 1) return hostPort.slice(1, endBracket);
    }
    return hostPort.split(":")[0] ?? "";
  }
}

function toApiUrlForHost(host: string) {
  return `http://${host}:4000`;
}

function collectDerivedCandidates() {
  const constants = Constants as ConstantsLike;
  const rawCandidates: Array<{ source: string; value: string | undefined }> = [
    {
      source: "bundle.scriptURL",
      value: NativeModules.SourceCode?.scriptURL as string | undefined
    },
    {
      source: "expo.linkingUri",
      value: constants.linkingUri
    },
    {
      source: "expo.expoConfig.hostUri",
      value: constants.expoConfig?.hostUri
    },
    {
      source: "expo.expoGoConfig.debuggerHost",
      value: constants.expoGoConfig?.debuggerHost
    },
    {
      source: "expo.manifest.debuggerHost",
      value: constants.manifest?.debuggerHost
    },
    {
      source: "expo.manifest.hostUri",
      value: constants.manifest?.hostUri
    },
    {
      source: "expo.manifest2.extra.expoClient.hostUri",
      value: constants.manifest2?.extra?.expoClient?.hostUri
    },
    {
      source: "expo.experienceUrl",
      value: constants.experienceUrl
    }
  ];

  const output: DerivedCandidate[] = [];
  const seen = new Set<string>();
  for (const candidate of rawCandidates) {
    if (!candidate.value) continue;
    const host = extractHostname(candidate.value);
    if (!host || isLocalHostname(host)) continue;
    const url = stripTrailingSlash(toApiUrlForHost(host));
    if (seen.has(url)) continue;
    output.push({
      source: candidate.source,
      url
    });
    seen.add(url);
  }
  return output;
}

function dedupe(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    if (!value) continue;
    const trimmed = stripTrailingSlash(value.trim());
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    output.push(trimmed);
  }
  return output;
}

function parsePositiveInteger(input: string | undefined, fallback: number) {
  if (!input) return fallback;
  const parsed = Number.parseInt(input.trim(), 10);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed <= 0) return fallback;
  return parsed;
}

const explicitApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim()
  ? stripTrailingSlash(process.env.EXPO_PUBLIC_API_BASE_URL)
  : null;
const revealQuickShareCapDays = parsePositiveInteger(
  process.env.EXPO_PUBLIC_REVEAL_QUICK_SHARE_CAP_DAYS,
  DEFAULT_REVEAL_QUICK_SHARE_CAP_DAYS
);
const explicitHost = explicitApiBaseUrl ? hostnameFromUrl(explicitApiBaseUrl) || extractHostname(explicitApiBaseUrl) : "";
const explicitIsLocal = Boolean(explicitHost) && isLocalHostname(explicitHost);

const derivedCandidates = collectDerivedCandidates();
const firstDerived = derivedCandidates[0] ?? null;

let selectedApiBaseUrl = FALLBACK_API_BASE_URL;
let apiBaseUrlSource = "fallback";

if (explicitApiBaseUrl && (!explicitIsLocal || !firstDerived)) {
  selectedApiBaseUrl = explicitApiBaseUrl;
  apiBaseUrlSource = "env";
} else if (explicitApiBaseUrl && explicitIsLocal && firstDerived) {
  selectedApiBaseUrl = firstDerived.url;
  apiBaseUrlSource = `${firstDerived.source}-overrode-localhost`;
} else if (firstDerived) {
  selectedApiBaseUrl = firstDerived.url;
  apiBaseUrlSource = firstDerived.source;
}

const apiBaseUrl = stripTrailingSlash(selectedApiBaseUrl);
const apiBaseUrlCandidates = dedupe([
  apiBaseUrl,
  explicitApiBaseUrl,
  ...derivedCandidates.map((candidate) => candidate.url),
  FALLBACK_API_BASE_URL
]);

export const env = {
  appEnv,
  apiBaseUrl,
  apiBaseUrlCandidates,
  apiBaseUrlSource,
  revealQuickShareCapDays
};
