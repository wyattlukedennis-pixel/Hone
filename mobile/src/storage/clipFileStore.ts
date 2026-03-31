import * as FileSystem from "expo-file-system/legacy";
import AsyncStorage from "@react-native-async-storage/async-storage";

const LOCAL_URIS_KEY = "hone.clips.localUris.v1";
const CLIPS_DIR = `${FileSystem.documentDirectory}clips/`;

/** The relative prefix stored in the map — everything under Documents/clips/ */
const RELATIVE_PREFIX = "clips/";

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
 * Convert an absolute file URI to a relative path under documentDirectory.
 * Handles stale container UUIDs from previous dev builds.
 */
function toRelativePath(uri: string): string {
  // Already relative
  if (!uri.startsWith("file://") && !uri.startsWith("/")) return uri;

  // Try stripping current documentDirectory
  const docDir = FileSystem.documentDirectory ?? "";
  if (uri.startsWith(docDir)) {
    return uri.slice(docDir.length);
  }

  // Handle stale absolute paths with old container UUIDs:
  // file:///var/mobile/Containers/Data/Application/{OLD-UUID}/Documents/clips/...
  const marker = "/Documents/";
  const markerIndex = uri.indexOf(marker);
  if (markerIndex >= 0) {
    return uri.slice(markerIndex + marker.length);
  }

  return uri;
}

/**
 * Resolve a stored path (relative or absolute) to the current absolute URI.
 */
function toAbsoluteUri(stored: string): string {
  // Already a full file URI pointing to current container — use as-is
  const docDir = FileSystem.documentDirectory ?? "";
  if (stored.startsWith(docDir)) return stored;

  // Relative path — prepend current documentDirectory
  if (!stored.startsWith("file://") && !stored.startsWith("/")) {
    return `${docDir}${stored}`;
  }

  // Stale absolute path — rebase to current container
  const marker = "/Documents/";
  const markerIndex = stored.indexOf(marker);
  if (markerIndex >= 0) {
    const relativePart = stored.slice(markerIndex + marker.length);
    return `${docDir}${relativePart}`;
  }

  return stored;
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
  const map = await readMapRaw();
  // Store as relative path so it survives container UUID changes
  map[clipId] = toRelativePath(localUri);
  await AsyncStorage.setItem(LOCAL_URIS_KEY, JSON.stringify(map));
}

/** Look up the local file URI for a clip ID. */
export async function getClipLocalUri(clipId: string): Promise<string | null> {
  const map = await readMapRaw();
  const stored = map[clipId];
  if (!stored) return null;
  return toAbsoluteUri(stored);
}

/** Bulk read — used to overlay local URIs onto clips from the API. */
export async function getAllClipLocalUris(): Promise<Record<string, string>> {
  const raw = await readMapRaw();
  const resolved: Record<string, string> = {};
  for (const [id, stored] of Object.entries(raw)) {
    resolved[id] = toAbsoluteUri(stored);
  }
  return resolved;
}

/** Remove mapping for a clip (used on delete/archive). */
export async function removeClipLocalUri(clipId: string): Promise<void> {
  const map = await readMapRaw();
  delete map[clipId];
  await AsyncStorage.setItem(LOCAL_URIS_KEY, JSON.stringify(map));
}

/** Remove all mappings for a journey and delete the local files. */
export async function clearLocalClipsForJourney(journeyId: string): Promise<void> {
  const map = await readMapRaw();
  const journeyRelativePrefix = `${RELATIVE_PREFIX}${journeyId}/`;
  const dir = `${CLIPS_DIR}${journeyId}/`;

  // Remove mappings whose value matches this journey's directory
  const updated: Record<string, string> = {};
  for (const [id, uri] of Object.entries(map)) {
    const relative = toRelativePath(uri);
    if (!relative.startsWith(journeyRelativePrefix)) {
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

/**
 * Download a clip from a remote URL if no local file exists.
 * Used to restore clips after app reinstall.
 */
export async function downloadClipIfMissing(
  clipId: string,
  remoteUrl: string,
  journeyId: string,
  captureType: "video" | "photo"
): Promise<string | null> {
  // Check if we already have it locally
  const existing = await getClipLocalUri(clipId);
  if (existing) {
    const info = await FileSystem.getInfoAsync(existing);
    if (info.exists) return existing;
  }

  try {
    const dir = `${CLIPS_DIR}${journeyId}/`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });

    const ext = captureType === "photo" ? "jpg" : "mp4";
    const destUri = `${dir}${makeId()}.${ext}`;

    const result = await FileSystem.downloadAsync(remoteUrl, destUri);
    if (result.status >= 200 && result.status < 300) {
      await registerClipLocalUri(clipId, destUri);
      return destUri;
    }
    return null;
  } catch {
    return null;
  }
}

async function readMapRaw(): Promise<Record<string, string>> {
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
