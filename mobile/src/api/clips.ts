import { env } from "../env";
import { requestJson } from "./http";
import type { ClipResponse, ClipsResponse, UploadUrlResponse } from "../types/clip";

type ApiErrorPayload = {
  error?: string;
  message?: string;
};

function isLocalHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function preferredApiOrigin() {
  for (const candidate of env.apiBaseUrlCandidates) {
    try {
      const parsed = new URL(candidate);
      if (!isLocalHost(parsed.hostname)) {
        return parsed.origin;
      }
    } catch {
      // Ignore malformed candidate and continue.
    }
  }
  try {
    return new URL(env.apiBaseUrl).origin;
  } catch {
    return env.apiBaseUrl;
  }
}

function replaceLocalMediaOrigin(url: string, origin: string) {
  try {
    const parsed = new URL(url);
    if (!isLocalHost(parsed.hostname)) return url;
    const fallback = new URL(origin);
    parsed.protocol = fallback.protocol;
    parsed.host = fallback.host;
    return parsed.toString();
  } catch {
    return url;
  }
}

function normalizeClipMediaUrl<T extends { videoUrl: string; thumbnailUrl: string | null }>(clip: T): T {
  const origin = preferredApiOrigin();
  return {
    ...clip,
    videoUrl: replaceLocalMediaOrigin(clip.videoUrl, origin),
    thumbnailUrl: clip.thumbnailUrl ? replaceLocalMediaOrigin(clip.thumbnailUrl, origin) : null
  };
}

export function requestClipUploadUrl(
  token: string,
  journeyId: string,
  params: { mimeType: string; fileExtension: string; captureType: "video" | "photo" }
) {
  return requestJson<UploadUrlResponse>(`/journeys/${journeyId}/clips/upload-url`, {
    token,
    method: "POST",
    body: params
  });
}

export async function uploadClipFile(params: {
  token: string;
  uploadUrl: string;
  fileField: string;
  fileUri: string;
  mimeType: string;
  fileName?: string;
}) {
  const uploadOrigin = (() => {
    try {
      return new URL(params.uploadUrl).origin;
    } catch {
      return env.apiBaseUrl;
    }
  })();

  const form = new FormData();
  form.append(params.fileField, {
    uri: params.fileUri,
    type: params.mimeType,
    name: params.fileName ?? "clip.mp4"
  } as unknown as Blob);

  let response: Response;
  try {
    response = await fetch(params.uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.token}`
      },
      body: form
    });
  } catch {
    throw new Error(`Network request failed (${uploadOrigin})`);
  }

  if (!response.ok) {
    let payload: ApiErrorPayload | null = null;
    try {
      payload = (await response.json()) as ApiErrorPayload;
    } catch {
      payload = null;
    }
    throw new Error(payload?.error ?? payload?.message ?? `HTTP_${response.status}`);
  }
}

export function createClip(
  token: string,
  journeyId: string,
  payload: { uploadId: string; durationMs: number; recordedAt: string; recordedOn: string; captureType?: "video" | "photo" }
) {
  return requestJson<ClipResponse>(`/journeys/${journeyId}/clips`, {
    token,
    method: "POST",
    body: payload
  }).then((response) => ({
    ...response,
    clip: normalizeClipMediaUrl(response.clip)
  }));
}

export async function listClips(token: string, journeyId: string) {
  const response = await requestJson<ClipsResponse>(`/journeys/${journeyId}/clips`, {
    token
  });
  return {
    ...response,
    clips: response.clips.map((clip) => normalizeClipMediaUrl(clip))
  };
}

export function clearJourneyClips(token: string, journeyId: string) {
  return requestJson<{ success: boolean; deletedCount: number }>(`/journeys/${journeyId}/clips`, {
    token,
    method: "DELETE"
  });
}
