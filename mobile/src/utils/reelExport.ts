import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";

import { uploadLocalClipForRender } from "../api/clips";
import { getAllClipLocalUris } from "../storage/clipFileStore";
import { requestJson } from "../api/http";
import type { Clip } from "../types/clip";
import type { ChapterTrailerMoment } from "./progress";

export type ExportReelInput = {
  chapterNumber: number;
  trailerMoments: ChapterTrailerMoment[] | null | undefined;
  sourceClips?: Clip[] | null;
  fallbackClip: Clip | null;
  milestoneLengthDays?: number;
  progressDays?: number;
  currentStreak?: number;
  storylineHeadline?: string | null;
  storylineCaption?: string | null;
  storylineReflection?: string | null;
  token?: string;
  journeyId?: string | null;
};

export type ReelActionCode =
  | "ok"
  | "no_clip"
  | "share_unavailable"
  | "permission_denied"
  | "prepare_failed"
  | "share_failed"
  | "save_failed";

export type ExportReelResult = {
  success: boolean;
  message: string;
  code: ReelActionCode;
  sourceKind: "rendered" | "trailer" | "fallback" | "none";
  cacheHit: boolean | null;
};

type ResolvedReelAsset = {
  uri: string;
  mimeType: string;
  captureType: Clip["captureType"];
  cacheKey: string;
  sourceKind: "rendered" | "trailer" | "fallback";
  cacheHit: boolean;
};

type RenderedRevealResponse = {
  renderUrl: string;
  cacheHit: boolean;
  renderedClipCount: number;
};

function inferExtension(uri: string, captureType: Clip["captureType"]) {
  const cleanUri = uri.split("?")[0] ?? uri;
  const tail = cleanUri.split("/").pop() ?? "";
  const dotIndex = tail.lastIndexOf(".");
  if (dotIndex > -1 && dotIndex < tail.length - 1) {
    const ext = tail.slice(dotIndex + 1).toLowerCase();
    if (ext) return ext;
  }
  return captureType === "photo" ? "jpg" : "mp4";
}

function inferMimeType(extension: string, captureType: Clip["captureType"]) {
  if (captureType === "photo") {
    if (extension === "png") return "image/png";
    return "image/jpeg";
  }
  if (extension === "mov") return "video/quicktime";
  return "video/mp4";
}

async function materializeShareFile(params: { sourceUri: string; targetUri: string }) {
  const { sourceUri, targetUri } = params;
  const exportDir = `${FileSystem.cacheDirectory}exports/`;
  await FileSystem.makeDirectoryAsync(exportDir, { intermediates: true });
  const existingFile = await FileSystem.getInfoAsync(targetUri);
  if (existingFile.exists) {
    return { uri: targetUri, cacheHit: true };
  }

  if (sourceUri.startsWith("file://")) {
    await FileSystem.copyAsync({ from: sourceUri, to: targetUri });
    return { uri: targetUri, cacheHit: false };
  }

  const downloaded = await FileSystem.downloadAsync(sourceUri, targetUri);
  if (downloaded.status >= 400) {
    throw new Error(`DOWNLOAD_FAILED_${downloaded.status}`);
  }
  return { uri: downloaded.uri, cacheHit: false };
}

function resolvePrimaryClip(input: ExportReelInput): { clip: Clip | null; sourceKind: "trailer" | "fallback" | "none" } {
  const trailerClips = (input.trailerMoments ?? []).map((entry) => entry.clip);
  if (trailerClips.length > 0) {
    // Prefer richer export source when possible.
    return {
      clip: [...trailerClips].sort((a, b) => b.durationMs - a.durationMs)[0] ?? trailerClips[0],
      sourceKind: "trailer"
    };
  }
  if (input.fallbackClip) {
    return {
      clip: input.fallbackClip,
      sourceKind: "fallback"
    };
  }
  // Fall back to most recent sourceClip when no comparison/trailer exists yet.
  const sourceClips = input.sourceClips ?? [];
  if (sourceClips.length > 0) {
    const sorted = [...sourceClips].sort(
      (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
    );
    return {
      clip: sorted[0],
      sourceKind: "fallback"
    };
  }
  return {
    clip: null,
    sourceKind: "none"
  };
}

function sanitizeFileSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || "clip";
}

function clampNonNegativeInteger(value: number | undefined) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value ?? 0));
}

function buildProgressSegment(input: ExportReelInput) {
  const targetDays = clampNonNegativeInteger(input.milestoneLengthDays);
  if (!targetDays) return null;
  const loggedDays = Math.min(clampNonNegativeInteger(input.progressDays), targetDays);
  return `${loggedDays}of${targetDays}`;
}

function buildShareDialogTitle(input: ExportReelInput) {
  const chapterLabel = `Share Chapter ${Math.max(1, clampNonNegativeInteger(input.chapterNumber))} reveal`;
  const progressSegment = buildProgressSegment(input);
  const streakDays = clampNonNegativeInteger(input.currentStreak);
  const details: string[] = [];
  if (progressSegment) details.push(`${progressSegment} days`);
  if (streakDays > 0) details.push(`${streakDays}-day streak`);
  if (!details.length) return chapterLabel;
  return `${chapterLabel} • ${details.join(" • ")}`;
}

function buildRenderClipIds(input: ExportReelInput) {
  const clipIds = (input.sourceClips ?? []).map((clip) => clip.id);
  if (!clipIds.length) {
    clipIds.push(...(input.trailerMoments ?? []).map((entry) => entry.clip.id));
  }
  if (input.fallbackClip) {
    clipIds.push(input.fallbackClip.id);
  }
  const deduped: string[] = [];
  for (const id of clipIds) {
    if (!id || deduped.includes(id)) continue;
    deduped.push(id);
    if (deduped.length >= 4) break;
  }
  return deduped;
}

async function uploadLocalClipsForRender(input: ExportReelInput): Promise<void> {
  if (!input.token || !input.journeyId) return;
  const localUris = await getAllClipLocalUris();
  const allClips = [
    ...(input.sourceClips ?? []),
    ...(input.trailerMoments ?? []).map((m) => m.clip),
    ...(input.fallbackClip ? [input.fallbackClip] : [])
  ];
  // Dedupe by clip ID
  const seen = new Set<string>();
  const uniqueClips: Clip[] = [];
  for (const clip of allClips) {
    if (!clip?.id || seen.has(clip.id)) continue;
    seen.add(clip.id);
    uniqueClips.push(clip);
  }

  for (const clip of uniqueClips) {
    const localUri = localUris[clip.id];
    if (!localUri) continue; // No local file — might already be on server
    try {
      await uploadLocalClipForRender(
        input.token,
        input.journeyId,
        {
          id: clip.id,
          captureType: clip.captureType,
          durationMs: clip.durationMs,
          recordedAt: clip.recordedAt,
          recordedOn: clip.recordedOn
        },
        localUri
      );
    } catch (error) {
      if (__DEV__) console.warn(`[reelExport] Failed to upload clip ${clip.id} for render:`, error);
    }
  }
}

async function resolveRenderedReelAsset(input: ExportReelInput): Promise<ResolvedReelAsset | null> {
  if (!input.token || !input.journeyId) {
    if (__DEV__) console.warn("[reelExport] resolveRendered: missing token or journeyId");
    return null;
  }
  const clipIds = buildRenderClipIds(input);
  if (!clipIds.length) {
    if (__DEV__) console.warn("[reelExport] resolveRendered: no clipIds to send");
    return null;
  }

  try {
    // Upload local clips to server so the renderer can access them
    await uploadLocalClipsForRender(input);

    if (__DEV__) console.log("[reelExport] resolveRendered: requesting render with", clipIds.length, "clipIds");
    const response = await requestJson<RenderedRevealResponse>(`/journeys/${input.journeyId}/reveal/render`, {
      token: input.token,
      method: "POST",
      body: {
        chapterNumber: input.chapterNumber,
        milestoneLengthDays: input.milestoneLengthDays,
        progressDays: input.progressDays,
        currentStreak: input.currentStreak,
        storylineHeadline: input.storylineHeadline,
        storylineCaption: input.storylineCaption,
        storylineReflection: input.storylineReflection,
        clipIds
      }
    });

    if (!response.renderUrl) {
      if (__DEV__) console.warn("[reelExport] resolveRendered: server returned no renderUrl");
      return null;
    }
    if (__DEV__) console.log("[reelExport] resolveRendered: got renderUrl, downloading...");
    const extension = inferExtension(response.renderUrl, "video");
    const mimeType = inferMimeType(extension, "video");
    const remoteName = response.renderUrl.split("/").at(-1) ?? `chapter-${input.chapterNumber}`;
    const cacheKey = sanitizeFileSegment(remoteName.replace(/\.[a-z0-9]+$/i, ""));
    const targetUri = `${FileSystem.cacheDirectory}exports/hone-rendered-${cacheKey}.${extension}`;
    const exportFile = await materializeShareFile({
      sourceUri: response.renderUrl,
      targetUri
    });

    return {
      uri: exportFile.uri,
      mimeType,
      captureType: "video",
      cacheKey,
      sourceKind: "rendered",
      cacheHit: response.cacheHit ? exportFile.cacheHit : false
    };
  } catch (error) {
    if (__DEV__) console.warn("[reelExport] resolveRendered FAILED:", error);
    return null;
  }
}

async function tryResolveRenderedReelAsset(input: ExportReelInput): Promise<{ asset: ResolvedReelAsset | null; hardFailure: boolean }> {
  if (!input.token || !input.journeyId) return { asset: null, hardFailure: false };
  const clipIds = buildRenderClipIds(input);
  if (!clipIds.length) return { asset: null, hardFailure: false };
  try {
    const response = await requestJson<RenderedRevealResponse>(`/journeys/${input.journeyId}/reveal/render`, {
      token: input.token,
      method: "POST",
      body: {
        chapterNumber: input.chapterNumber,
        milestoneLengthDays: input.milestoneLengthDays,
        progressDays: input.progressDays,
        currentStreak: input.currentStreak,
        storylineHeadline: input.storylineHeadline,
        storylineCaption: input.storylineCaption,
        storylineReflection: input.storylineReflection,
        clipIds
      }
    });
    if (!response.renderUrl) return { asset: null, hardFailure: true };
    const extension = inferExtension(response.renderUrl, "video");
    const mimeType = inferMimeType(extension, "video");
    const remoteName = response.renderUrl.split("/").at(-1) ?? `chapter-${input.chapterNumber}`;
    const cacheKey = sanitizeFileSegment(remoteName.replace(/\.[a-z0-9]+$/i, ""));
    const targetUri = `${FileSystem.cacheDirectory}exports/hone-rendered-${cacheKey}.${extension}`;
    const exportFile = await materializeShareFile({
      sourceUri: response.renderUrl,
      targetUri
    });

    return {
      asset: {
        uri: exportFile.uri,
        mimeType,
        captureType: "video",
        cacheKey,
        sourceKind: "rendered",
        cacheHit: response.cacheHit ? exportFile.cacheHit : false
      },
      hardFailure: false
    };
  } catch {
    return { asset: null, hardFailure: true };
  }
}

async function resolveReelAsset(input: ExportReelInput): Promise<ResolvedReelAsset | null> {
  const renderedAsset = await resolveRenderedReelAsset(input);
  if (renderedAsset) {
    return renderedAsset;
  }

  if (__DEV__) console.log("[reelExport] resolveReelAsset: server render failed, trying fallback clip");
  const primaryClipResult = resolvePrimaryClip(input);
  const primaryClip = primaryClipResult.clip;
  if (!primaryClip) {
    if (__DEV__) console.warn("[reelExport] resolveReelAsset: no primary clip available",
      { trailerMoments: (input.trailerMoments ?? []).length, fallbackClip: !!input.fallbackClip, sourceClips: (input.sourceClips ?? []).length });
    return null;
  }

  if (__DEV__) console.log("[reelExport] resolveReelAsset: fallback clip found, videoUrl:", primaryClip.videoUrl?.slice(0, 60));
  const extension = inferExtension(primaryClip.videoUrl, primaryClip.captureType);
  const mimeType = inferMimeType(extension, primaryClip.captureType);
  const clipVersion = sanitizeFileSegment(primaryClip.updatedAt ?? "v1");
  const clipSegment = sanitizeFileSegment(primaryClip.id);
  const progressSegment = buildProgressSegment(input);
  const streakDays = clampNonNegativeInteger(input.currentStreak);
  const chapterSegment = `ch${Math.max(1, clampNonNegativeInteger(input.chapterNumber))}`;
  const streakSegment = streakDays > 0 ? `s${streakDays}` : null;
  const cacheKeyParts = [chapterSegment, progressSegment, streakSegment, clipSegment, clipVersion].filter(Boolean) as string[];
  const cacheKey = cacheKeyParts.join("-");
  const targetUri = `${FileSystem.cacheDirectory}exports/hone-reveal-${cacheKey}.${extension}`;
  const exportFile = await materializeShareFile({
    sourceUri: primaryClip.videoUrl,
    targetUri
  });

  return {
    uri: exportFile.uri,
    mimeType,
    captureType: primaryClip.captureType,
    cacheKey,
    sourceKind: primaryClipResult.sourceKind === "none" ? "fallback" : primaryClipResult.sourceKind,
    cacheHit: exportFile.cacheHit
  };
}

export async function prepareReelAsset(input: ExportReelInput): Promise<ExportReelResult> {
  const renderedAttempt = await tryResolveRenderedReelAsset(input);
  if (renderedAttempt.asset) {
    return {
      success: true,
      message: "Rendered montage prepared.",
      code: "ok",
      sourceKind: renderedAttempt.asset.sourceKind,
      cacheHit: renderedAttempt.asset.cacheHit
    };
  }

  const primary = resolvePrimaryClip(input);
  if (!primary.clip) {
    return {
      success: false,
      message: "No reel clip is available yet.",
      code: "no_clip",
      sourceKind: "none",
      cacheHit: null
    };
  }
  try {
    const asset = await resolveReelAsset(input);
    if (!asset) {
      return {
        success: false,
        message: "No reel clip is available yet.",
        code: "no_clip",
        sourceKind: primary.sourceKind,
        cacheHit: null
      };
    }
    return {
      success: true,
      message: "Reel prepared.",
      code: "ok",
      sourceKind: asset.sourceKind,
      cacheHit: asset.cacheHit
    };
  } catch {
    return {
      success: false,
      message: "Could not prepare this reel yet.",
      code: "prepare_failed",
      sourceKind: primary.sourceKind,
      cacheHit: null
    };
  }
}

export async function exportAndShareReel(input: ExportReelInput): Promise<ExportReelResult> {
  const primary = resolvePrimaryClip(input);
  const primaryClip = primary.clip;

  if (!primaryClip) {
    return {
      success: false,
      message: "No reel clip is available to share yet.",
      code: "no_clip",
      sourceKind: "none",
      cacheHit: null
    };
  }

  const shareAvailable = await Sharing.isAvailableAsync();
  if (!shareAvailable) {
    return {
      success: false,
      message: "Sharing is not available on this device.",
      code: "share_unavailable",
      sourceKind: primary.sourceKind,
      cacheHit: null
    };
  }

  try {
    const asset = await resolveReelAsset(input);
    if (!asset) {
      return {
        success: false,
        message: "No reel clip is available to share yet.",
        code: "no_clip",
        sourceKind: primary.sourceKind,
        cacheHit: null
      };
    }
    await Sharing.shareAsync(asset.uri, {
      dialogTitle: buildShareDialogTitle(input),
      mimeType: asset.mimeType,
      UTI: asset.captureType === "photo" ? "public.image" : "public.movie"
    });
    const successMessage =
      asset.sourceKind === "rendered"
        ? "Rendered reveal shared."
        : "Shared fallback clip. Rendered montage unavailable for this export.";
    return {
      success: true,
      message: successMessage,
      code: "ok",
      sourceKind: asset.sourceKind,
      cacheHit: asset.cacheHit
    };
  } catch {
    return {
      success: false,
      message: "Could not export this reel yet. Please try again.",
      code: "share_failed",
      sourceKind: primary.sourceKind,
      cacheHit: null
    };
  }
}

export async function exportAndSaveReel(input: ExportReelInput): Promise<ExportReelResult> {
  const primary = resolvePrimaryClip(input);
  const primaryClip = primary.clip;
  if (!primaryClip) {
    return {
      success: false,
      message: "No reel clip is available to save yet.",
      code: "no_clip",
      sourceKind: "none",
      cacheHit: null
    };
  }

  try {
    const permission = await MediaLibrary.getPermissionsAsync();
    if (!permission.granted) {
      const requested = await MediaLibrary.requestPermissionsAsync();
      if (!requested.granted) {
        return {
          success: false,
          message: "Library permission is required to save reels.",
          code: "permission_denied",
          sourceKind: primary.sourceKind,
          cacheHit: null
        };
      }
    }

    const asset = await resolveReelAsset(input);
    if (!asset) {
      return {
        success: false,
        message: "No reel clip is available to save yet.",
        code: "no_clip",
        sourceKind: primary.sourceKind,
        cacheHit: null
      };
    }
    const mediaAsset = await MediaLibrary.createAssetAsync(asset.uri);
    const albumName = "Hone Reels";
    const existingAlbum = await MediaLibrary.getAlbumAsync(albumName);
    if (existingAlbum) {
      await MediaLibrary.addAssetsToAlbumAsync([mediaAsset], existingAlbum, false);
    } else {
      await MediaLibrary.createAlbumAsync(albumName, mediaAsset, false);
    }
    const successMessage =
      asset.sourceKind === "rendered"
        ? "Rendered reveal saved to your library (Hone Reels)."
        : "Saved fallback clip to your library (Hone Reels).";
    return {
      success: true,
      message: successMessage,
      code: "ok",
      sourceKind: asset.sourceKind,
      cacheHit: asset.cacheHit
    };
  } catch {
    return {
      success: false,
      message: "Could not save this reel yet. Please try again.",
      code: "save_failed",
      sourceKind: primary.sourceKind,
      cacheHit: null
    };
  }
}

export async function resolveReelUri(input: ExportReelInput): Promise<string | null> {
  try {
    if (__DEV__) console.log("[reelExport] resolveReelUri called",
      { token: !!input.token, journeyId: input.journeyId, sourceClips: (input.sourceClips ?? []).length,
        trailerMoments: (input.trailerMoments ?? []).length, fallbackClip: !!input.fallbackClip });
    const asset = await resolveReelAsset(input);
    if (__DEV__) console.log("[reelExport] resolveReelUri result:", asset ? asset.uri?.slice(0, 80) : "NULL");
    return asset?.uri ?? null;
  } catch (error) {
    if (__DEV__) console.error("[reelExport] resolveReelUri FAILED:", error);
    return null;
  }
}

/**
 * Render a photo timelapse video on the server and download it locally.
 * Uploads local photo clips first, then requests server render.
 * Returns a local file URI on success, null on failure.
 */
export async function renderTimelapseVideo(
  token: string,
  journeyId: string,
  holdMs: number,
  clips?: Clip[],
): Promise<string | null> {
  try {
    // Upload local photo clips so the server can access them
    if (clips?.length) {
      const localUris = await getAllClipLocalUris();
      const uploadPromises = clips
        .filter((clip) => localUris[clip.id])
        .map((clip) =>
          uploadLocalClipForRender(token, journeyId, {
            id: clip.id,
            captureType: clip.captureType,
            durationMs: clip.durationMs,
            recordedAt: clip.recordedAt,
            recordedOn: clip.recordedOn,
          }, localUris[clip.id]!).catch((error) => {
            if (__DEV__) console.warn(`[reelExport] Upload failed for clip ${clip.id}:`, error);
          })
        );
      await Promise.all(uploadPromises);
    }

    const response = await requestJson<{ url: string; photoCount: number }>(
      `/journeys/${journeyId}/timelapse/render`,
      { method: "POST", token, body: { holdMs } },
    );

    if (!response.url) return null;

    // The URL is relative — build full URL
    const { env } = await import("../env");
    const fullUrl = `${env.apiBaseUrl}${response.url}`;
    const localPath = `${FileSystem.cacheDirectory}hone-timelapse-${Date.now()}.mp4`;
    const { uri } = await FileSystem.downloadAsync(fullUrl, localPath);
    return uri;
  } catch (error) {
    if (__DEV__) console.error("[reelExport] renderTimelapseVideo failed:", error);
    return null;
  }
}
