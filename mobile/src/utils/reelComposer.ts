import * as FileSystem from "expo-file-system/legacy";
import { getAllClipLocalUris } from "../storage/clipFileStore";
import { uploadLocalClipForRender } from "../api/clips";
import { requestJson } from "../api/http";
import type { Clip } from "../types/clip";
import type { ReelClipEntry } from "../components/SequentialReelPlayer";

type ComposeRenderedResponse = {
  renderUrl: string;
  cacheHit: boolean;
  renderedClipCount: number;
};

/**
 * Compose a reveal montage on the server.
 *
 * 1. Uploads any local-only clips to the server
 * 2. Requests server-side FFmpeg composition
 * 3. Downloads the composed .mp4 to device cache
 * 4. Returns the local file URI
 *
 * Returns null on failure (network issues, no clips, etc.)
 */
export async function composeReel(params: {
  token: string;
  journeyId: string;
  clips: Clip[];
  chapterNumber: number;
  milestoneLengthDays?: number;
  progressDays?: number;
  currentStreak?: number;
}): Promise<string | null> {
  const { token, journeyId, clips, chapterNumber } = params;

  if (!clips.length) {
    if (__DEV__) console.warn("[reelComposer] No clips provided");
    return null;
  }

  try {
    // 1. Upload local clips to server so FFmpeg can access them
    if (__DEV__) console.log("[reelComposer] Uploading local clips...");
    const localUris = await getAllClipLocalUris();

    for (const clip of clips) {
      const localUri = localUris[clip.id];
      if (!localUri) continue; // Already on server or no local file

      try {
        await uploadLocalClipForRender(token, journeyId, {
          id: clip.id,
          captureType: clip.captureType,
          durationMs: clip.durationMs,
          recordedAt: clip.recordedAt,
          recordedOn: clip.recordedOn,
        }, localUri);
      } catch (error) {
        if (__DEV__) console.warn(`[reelComposer] Upload failed for clip ${clip.id}:`, error);
        // Continue — server may already have this clip
      }
    }

    // 2. Request server-side composition
    if (__DEV__) console.log("[reelComposer] Requesting server render...");
    const clipIds = clips.map((c) => c.id);

    const response = await requestJson<ComposeRenderedResponse>(
      `/journeys/${journeyId}/reveal/render`,
      {
        token,
        method: "POST",
        body: {
          chapterNumber,
          milestoneLengthDays: params.milestoneLengthDays,
          progressDays: params.progressDays,
          currentStreak: params.currentStreak,
          clipIds,
        },
      }
    );

    if (!response.renderUrl) {
      if (__DEV__) console.warn("[reelComposer] Server returned no renderUrl");
      return null;
    }

    // 3. Download the composed video to local cache
    if (__DEV__) console.log("[reelComposer] Downloading composed video...");
    const exportDir = `${FileSystem.cacheDirectory}exports/`;
    await FileSystem.makeDirectoryAsync(exportDir, { intermediates: true });

    const outputPath = `${exportDir}hone-reel-${Date.now()}.mp4`;
    const download = await FileSystem.downloadAsync(response.renderUrl, outputPath);

    if (download.status >= 400) {
      if (__DEV__) console.warn("[reelComposer] Download failed:", download.status);
      return null;
    }

    if (__DEV__) console.log("[reelComposer] Composition ready:", outputPath);
    return download.uri;
  } catch (error) {
    if (__DEV__) console.error("[reelComposer] Composition failed:", error);
    return null;
  }
}
