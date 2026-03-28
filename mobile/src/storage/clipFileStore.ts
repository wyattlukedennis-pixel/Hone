import * as FileSystem from "expo-file-system/legacy";
import AsyncStorage from "@react-native-async-storage/async-storage";

const LOCAL_URIS_KEY = "hone.clips.localUris.v1";
const CLIPS_DIR = `${FileSystem.documentDirectory}clips/`;

function inferExtension(fileUri: string, captureType: "video" | "photo") {
  const lower = fileUri.split("?")[0].toLowerCase();
  if (captureType === "photo") {
    if (lower.endsWith(".png")) return "png";
    if (lower.endsWith(".heic") || lower.endsWith(".heif")) return "heic";
    return "jpg";
  }
  if (lower.endsWith(".mov") || lower.endsWith(".qt")) return "mov";
  if (lower.endsWith(".m4v")) return "m4v";
  return "mp4";
}

function makeId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Copy a recorded clip from its temp camera URI to a permanent local directory.
 * Returns the permanent file:// URI.
 */
export async function persistClipFile(
  fileUri: string,
  journeyId: string,
  captureType: "video" | "photo"
): Promise<string> {
  const dir = `${CLIPS_DIR}${journeyId}/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });

  const ext = inferExtension(fileUri, captureType);
  const destUri = `${dir}${makeId()}.${ext}`;

  await FileSystem.copyAsync({ from: fileUri, to: destUri });
  return destUri;
}

/** Store the mapping from a server-assigned clip ID to its local file URI. */
export async function registerClipLocalUri(clipId: string, localUri: string): Promise<void> {
  const map = await readMap();
  map[clipId] = localUri;
  await AsyncStorage.setItem(LOCAL_URIS_KEY, JSON.stringify(map));
}

/** Look up the local file URI for a clip ID. */
export async function getClipLocalUri(clipId: string): Promise<string | null> {
  const map = await readMap();
  return map[clipId] ?? null;
}

/** Bulk read — used to overlay local URIs onto clips from the API. */
export async function getAllClipLocalUris(): Promise<Record<string, string>> {
  return readMap();
}

/** Remove mapping for a clip (used on delete/archive). */
export async function removeClipLocalUri(clipId: string): Promise<void> {
  const map = await readMap();
  delete map[clipId];
  await AsyncStorage.setItem(LOCAL_URIS_KEY, JSON.stringify(map));
}

/** Remove all mappings for a journey and delete the local files. */
export async function clearLocalClipsForJourney(journeyId: string): Promise<void> {
  const map = await readMap();
  const dir = `${CLIPS_DIR}${journeyId}/`;

  // Remove mappings whose value starts with this journey's directory
  const updated: Record<string, string> = {};
  for (const [id, uri] of Object.entries(map)) {
    if (!uri.startsWith(dir)) {
      updated[id] = uri;
    }
  }
  await AsyncStorage.setItem(LOCAL_URIS_KEY, JSON.stringify(updated));

  // Delete the directory
  try {
    const info = await FileSystem.getInfoAsync(dir);
    if (info.exists) {
      await FileSystem.deleteAsync(dir, { idempotent: true });
    }
  } catch {
    // Best effort cleanup
  }
}

async function readMap(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_URIS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}
