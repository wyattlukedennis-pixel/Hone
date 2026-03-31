import { env } from "../env";
import { getAllClipLocalUris, clearLocalClipsForJourney, downloadClipIfMissing } from "../storage/clipFileStore";
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

function upgradeToHttps(url: string) {
  if (url.startsWith("http://localhost") || url.startsWith("http://127.0.0.1")) return url;
  return url.replace(/^http:\/\//, "https://");
}

function replaceLocalMediaOrigin(url: string, origin: string) {
  try {
    const parsed = new URL(url);
    if (!isLocalHost(parsed.hostname)) return upgradeToHttps(url);
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

/**
 * Upload a local clip file to the server and update the clip's videoUrl.
 * Used to make local clips available for server-side rendering.
 */
export async function uploadLocalClipForRender(
  token: string,
  journeyId: string,
  clip: { id: string; captureType: "video" | "photo"; durationMs: number; recordedAt: string; recordedOn: string },
  localFileUri: string
) {
  const mimeType = clip.captureType === "photo" ? "image/jpeg" : "video/mp4";
  const fileExtension = clip.captureType === "photo" ? "jpg" : "mp4";

  // Get an upload URL from the server
  const uploadInfo = await requestClipUploadUrl(token, journeyId, {
    mimeType,
    fileExtension,
    captureType: clip.captureType
  });

  // Upload the file
  await uploadClipFile({
    token,
    uploadUrl: uploadInfo.uploadUrl,
    fileField: uploadInfo.fileField,
    fileUri: localFileUri,
    mimeType
  });

  // Create/update the clip record with the server media URL
  const result = await createClip(token, journeyId, {
    uploadId: uploadInfo.uploadId,
    durationMs: clip.durationMs,
    recordedAt: clip.recordedAt,
    recordedOn: clip.recordedOn,
    captureType: clip.captureType
  });

  return result;
}

/** Create a clip record on the backend without uploading a file. */
export function createClipLocal(
  token: string,
  journeyId: string,
  payload: { durationMs: number; recordedAt: string; recordedOn: string; captureType: "video" | "photo" }
) {
  return requestJson<ClipResponse>(`/journeys/${journeyId}/clips/local`, {
    token,
    method: "POST",
    body: payload
  });
}

export async function listClips(token: string, journeyId: string) {
  const [response, localUris] = await Promise.all([
    requestJson<ClipsResponse>(`/journeys/${journeyId}/clips`, { token }),
    getAllClipLocalUris()
  ]);
  const clips = response.clips.map((clip) => {
    const localUri = localUris[clip.id];
    if (localUri) {
      return { ...clip, videoUrl: localUri };
    }
    return normalizeClipMediaUrl(clip);
  });

  // Background-download clips that exist in cloud but not locally (e.g. after reinstall)
  for (const clip of clips) {
    if (!localUris[clip.id] && clip.videoUrl !== "local://device" && clip.videoUrl.startsWith("http")) {
      downloadClipIfMissing(clip.id, clip.videoUrl, clip.journeyId, clip.captureType).catch(() => {});
    }
  }

  return { ...response, clips };
}

export async function clearJourneyClips(token: string, journeyId: string) {
  const result = await requestJson<{ success: boolean; deletedCount: number }>(`/journeys/${journeyId}/clips`, {
    token,
    method: "DELETE"
  });
  await clearLocalClipsForJourney(journeyId);
  return result;
}
