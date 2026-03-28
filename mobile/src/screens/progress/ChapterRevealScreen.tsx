import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import * as Sharing from "expo-sharing";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LogoMorphLoader } from "../../components/LogoMorphLoader";
import { PaywallModal } from "../../components/PaywallModal";
import { SequentialReelPlayer } from "../../components/SequentialReelPlayer";
import { TactilePressable } from "../../components/TactilePressable";
import { triggerSelectionHaptic, playRevealSound } from "../../utils/feedback";
import { hasRevealExportPurchase } from "../../utils/purchases";
import { composeReel } from "../../utils/reelComposer";
import type { ExportReelInput } from "../../utils/reelExport";
import type { Clip } from "../../types/clip";
import type { ReelClipEntry } from "../../components/SequentialReelPlayer";

type ChapterRevealScreenProps = {
  visible: boolean;
  reelExportInput: ExportReelInput;
  daySpan: number;
  chapterNumber: number;
  goalText?: string | null;
  onClose: () => void;
};

type Phase = "loading" | "intention" | "playing" | "error";

const ACCENT = "#E8450A";
const VIDEO_RADIUS = 20;
const LOADING_MS = 2500;

/**
 * Build clip durations matching the reveal spec:
 * - First clip: 2s
 * - Middle clips: 1.5s each
 * - Final clip: 5s (capped at actual clip duration)
 */
function computeClipHoldMs(clipCount: number, clips: Clip[]): number[] {
  if (clipCount <= 1) {
    const actual = clips[0]?.durationMs ?? 5000;
    return [Math.min(10000, Math.max(5000, actual))];
  }
  if (clipCount === 2) {
    const lastActual = clips[1]?.durationMs ?? 5000;
    return [2000, Math.min(10000, Math.max(5000, lastActual))];
  }

  const durations: number[] = [2000]; // First clip: 2s
  for (let i = 1; i < clipCount - 1; i++) {
    const actual = clips[i]?.durationMs ?? 1500;
    durations.push(Math.min(1500, actual)); // Middle: 1.5s
  }
  const lastActual = clips[clipCount - 1]?.durationMs ?? 5000;
  durations.push(Math.min(10000, Math.max(5000, lastActual))); // Final: 5-10s
  return durations;
}

/**
 * Determine clip count based on journey days.
 */
function clipCountForDays(journeyDays: number): number {
  if (journeyDays <= 14) return 5;
  if (journeyDays <= 30) return 7;
  if (journeyDays <= 60) return 9;
  if (journeyDays <= 100) return 11;
  return 13;
}

function selectSpread<T>(arr: T[], count: number): T[] {
  if (arr.length <= count) return arr;
  const last = arr.length - 1;
  const indices: number[] = [0]; // always include first
  const middleSlots = count - 2;
  for (let i = 0; i < middleSlots; i++) {
    indices.push(Math.round(((i + 1) / (middleSlots + 1)) * last));
  }
  indices.push(last); // always include last
  return [...new Set(indices)].sort((a, b) => a - b).map((idx) => arr[idx]);
}

function buildReelClips(clips: Clip[]): ReelClipEntry[] {
  const sorted = [...clips].sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
  );

  // Calculate journey span
  let journeyDays = 1;
  if (sorted.length >= 2) {
    const firstDate = new Date(sorted[0].recordedAt).getTime();
    const lastDate = new Date(sorted[sorted.length - 1].recordedAt).getTime();
    journeyDays = Math.max(1, Math.ceil((lastDate - firstDate) / (1000 * 60 * 60 * 24)) + 1);
  }

  const targetCount = clipCountForDays(journeyDays);
  const selected = selectSpread(sorted, targetCount);
  const holdDurations = computeClipHoldMs(selected.length, selected);
  const days = [...new Set(sorted.map((c) => c.recordedOn))].sort();

  return selected.map((clip, i) => {
    const dayIdx = days.indexOf(clip.recordedOn);
    return {
      uri: clip.videoUrl,
      label: `day ${(dayIdx >= 0 ? dayIdx : i) + 1}`,
      holdMs: holdDurations[i] ?? 1500,
      captureType: clip.captureType,
    };
  });
}

export default function ChapterRevealScreen({
  visible,
  reelExportInput,
  daySpan,
  chapterNumber,
  goalText,
  onClose,
}: ChapterRevealScreenProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>("loading");
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [purchaseBump, setPurchaseBump] = useState(0);
  const purchaseUnlocked = hasRevealExportPurchase() || purchaseBump > 0;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;
  const intentionAnim = useRef(new Animated.Value(1)).current;
  const revealSoundPlayed = useRef(false);

  // Video frame sizing — constrain so buttons fit below
  const framePadding = 20;
  const maxFrameHeight = height - insets.top - insets.bottom - 240;
  const idealFrameHeight = ((width - framePadding * 2) * 16) / 9;
  const frameHeight = Math.min(idealFrameHeight, maxFrameHeight);
  const frameWidth = (frameHeight * 9) / 16;

  // Build reel clips from local sourceClips
  const reelClips = useMemo(() => {
    const allClips = reelExportInput.sourceClips ?? [];
    const trailerClips = (reelExportInput.trailerMoments ?? []).map((m) => m.clip);
    const fallback = reelExportInput.fallbackClip ? [reelExportInput.fallbackClip] : [];
    // Prefer sourceClips (full timeline), fall back to trailer moments, then single clip
    const clips = allClips.length > 0 ? allClips : trailerClips.length > 0 ? trailerClips : fallback;
    if (!clips.length) return [];
    const built = buildReelClips(clips);
    if (__DEV__) console.log("[ChapterReveal] reelClips:", built.map((c) => ({ uri: c.uri?.slice(0, 80), type: c.captureType, label: c.label })));
    return built;
  }, [reelExportInput.sourceClips, reelExportInput.trailerMoments, reelExportInput.fallbackClip]);

  // Resolve the reel when visible
  useEffect(() => {
    if (!visible) return;

    // Reset state
    setPhase(goalText ? "intention" : "loading");
    revealSoundPlayed.current = false;
    fadeAnim.setValue(0);
    contentAnim.setValue(0);
    intentionAnim.setValue(1);

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    const loadingTimer = setTimeout(() => {
      if (reelClips.length > 0) {
        setPhase("playing");
      } else {
        setPhase("error");
      }
    }, goalText ? LOADING_MS + 3000 : LOADING_MS);

    // Show intention first if goalText exists
    if (goalText) {
      const intentionTimer = setTimeout(() => {
        Animated.timing(intentionAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }).start(() => setPhase("loading"));
      }, 3000);

      return () => {
        clearTimeout(intentionTimer);
        clearTimeout(loadingTimer);
      };
    }

    return () => clearTimeout(loadingTimer);
  }, [visible]);

  // Animate content in and play sound when entering playing phase
  useEffect(() => {
    if (phase === "playing" && !revealSoundPlayed.current) {
      revealSoundPlayed.current = true;
      playRevealSound();
      Animated.spring(contentAnim, {
        toValue: 1,
        tension: 50,
        friction: 9,
        useNativeDriver: true,
      }).start();
    }
  }, [phase, contentAnim]);

  // Pre-compose the reel in the background as soon as the screen opens.
  // By the time the user watches the preview and taps share, it's ready.
  const [composedUri, setComposedUri] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const composeStarted = useRef(false);

  useEffect(() => {
    if (!visible || composeStarted.current) return;
    if (!reelExportInput.token || !reelExportInput.journeyId) return;

    const allClips = reelExportInput.sourceClips ?? [];
    const trailerClips = (reelExportInput.trailerMoments ?? []).map((m) => m.clip);
    const fallback = reelExportInput.fallbackClip ? [reelExportInput.fallbackClip] : [];
    const sourceClips = allClips.length > 0 ? allClips : trailerClips.length > 0 ? trailerClips : fallback;
    if (!sourceClips.length) return;

    composeStarted.current = true;
    setComposing(true);
    if (__DEV__) console.log("[ChapterReveal] Pre-composing reel in background...");

    composeReel({
      token: reelExportInput.token,
      journeyId: reelExportInput.journeyId,
      clips: sourceClips,
      chapterNumber,
      milestoneLengthDays: reelExportInput.milestoneLengthDays,
      progressDays: reelExportInput.progressDays,
      currentStreak: reelExportInput.currentStreak,
    }).then((uri) => {
      if (uri) {
        setComposedUri(uri);
        if (__DEV__) console.log("[ChapterReveal] Pre-compose done:", uri.slice(0, 80));
      }
    }).catch((error) => {
      if (__DEV__) console.error("[ChapterReveal] Pre-compose failed:", error);
    }).finally(() => {
      setComposing(false);
    });
  }, [visible, reelExportInput]);

  // Reset pre-compose state when screen closes
  useEffect(() => {
    if (!visible) {
      composeStarted.current = false;
      setComposedUri(null);
    }
  }, [visible]);

  async function handleShare() {
    triggerSelectionHaptic();
    if (!purchaseUnlocked) {
      setPaywallVisible(true);
      return;
    }

    // If pre-compose is done, share instantly
    if (composedUri) {
      try {
        await Sharing.shareAsync(composedUri, {
          mimeType: "video/mp4",
          dialogTitle: "share your progress",
        });
      } catch (error) {
        if (__DEV__) console.error("[ChapterReveal] Share failed:", error);
      }
      return;
    }

    // Still composing — button already shows "composing..."
    if (composing) return;

    // Edge case: compose never started or failed — try again
    if (!reelClips.length) return;
    const allClips = reelExportInput.sourceClips ?? [];
    const trailerClips = (reelExportInput.trailerMoments ?? []).map((m) => m.clip);
    const fallback = reelExportInput.fallbackClip ? [reelExportInput.fallbackClip] : [];
    const sourceClips = allClips.length > 0 ? allClips : trailerClips.length > 0 ? trailerClips : fallback;

    if (!sourceClips.length || !reelExportInput.token || !reelExportInput.journeyId) return;

    setComposing(true);
    try {
      const uri = await composeReel({
        token: reelExportInput.token,
        journeyId: reelExportInput.journeyId,
        clips: sourceClips,
        chapterNumber,
        milestoneLengthDays: reelExportInput.milestoneLengthDays,
        progressDays: reelExportInput.progressDays,
        currentStreak: reelExportInput.currentStreak,
      });
      if (uri) {
        setComposedUri(uri);
        await Sharing.shareAsync(uri, {
          mimeType: "video/mp4",
          dialogTitle: "share your progress",
        });
      }
    } catch (error) {
      if (__DEV__) console.error("[ChapterReveal] Share failed:", error);
    } finally {
      setComposing(false);
    }
  }

  const contentTranslateY = contentAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0],
  });

  return (
    <Modal visible={visible} animationType="none" transparent={false} statusBarTranslucent onRequestClose={onClose}>
    <Animated.View style={[styles.root, { opacity: fadeAnim }]}>
      {/* Close button */}
      <Pressable
        style={[styles.closeButton, { top: insets.top + 8 }]}
        onPress={() => { triggerSelectionHaptic(); onClose(); }}
        hitSlop={16}
      >
        <Text style={styles.closeButtonText}>✕</Text>
      </Pressable>

      {/* Intention phase */}
      {phase === "intention" && goalText ? (
        <Animated.View style={[styles.intentionOverlay, { opacity: intentionAnim }]}>
          <Text style={styles.intentionPreamble}>you said you wanted to...</Text>
          <Text style={styles.intentionText}>{goalText}</Text>
          <Text style={styles.intentionCta}>watch what happened.</Text>
        </Animated.View>
      ) : null}

      {/* Loading phase */}
      {phase === "loading" ? (
        <View style={styles.loadingContainer}>
          <LogoMorphLoader size={100} color={ACCENT} duration={900} />
          <Text style={styles.loadingText}>building your reveal...</Text>
        </View>
      ) : null}

      {/* Error phase */}
      {phase === "error" ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>couldn't build your reveal</Text>
          <Text style={styles.errorSubtext}>record a few more clips to unlock your reel</Text>
        </View>
      ) : null}

      {/* Playing phase — fully local via SequentialReelPlayer */}
      {phase === "playing" && reelClips.length > 0 ? (
        <View style={[styles.content, { paddingTop: insets.top + 48, paddingBottom: Math.max(insets.bottom + 12, 28) }]}>
          {/* Chapter label */}
          <Text style={styles.chapterLabel}>chapter {chapterNumber} reveal</Text>

          {/* Video frame */}
          <View style={[styles.videoFrame, { width: frameWidth, height: frameHeight, borderRadius: VIDEO_RADIUS }]}>
            <SequentialReelPlayer
              clips={reelClips}
              style={StyleSheet.absoluteFill}
              loop
              muted={!purchaseUnlocked}
              autoPlay
            />
          </View>

          {/* Bottom content */}
          <Animated.View
            style={[
              styles.bottomSection,
              { opacity: contentAnim, transform: [{ translateY: contentTranslateY }] },
            ]}
          >
            <Text style={styles.dayCount}>{daySpan} days</Text>

            {purchaseUnlocked ? (
              <TactilePressable
                style={[styles.shareButton, composing && styles.shareButtonComposing]}
                stretch
                pressScale={composing ? 1 : 0.96}
                onPress={composing ? undefined : () => { void handleShare(); }}
              >
                <Text style={styles.shareButtonText}>{composing ? "composing..." : "share to tiktok"}</Text>
              </TactilePressable>
            ) : (
              <TactilePressable
                style={styles.unlockButton}
                stretch
                pressScale={0.96}
                onPress={() => {
                  triggerSelectionHaptic();
                  setPaywallVisible(true);
                }}
              >
                <Text style={styles.shareButtonText}>unlock audio + export</Text>
              </TactilePressable>
            )}
          </Animated.View>
        </View>
      ) : null}

      <PaywallModal
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        onPurchased={() => {
          setPaywallVisible(false);
          setPurchaseBump((v) => v + 1);
        }}
      />
    </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#f4efe6",
  },
  closeButton: {
    position: "absolute",
    left: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.06)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  closeButtonText: {
    color: "#101010",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 18,
  },
  // Intention phase
  intentionOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#f4efe6",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    zIndex: 50,
  },
  intentionPreamble: {
    color: "rgba(0,0,0,0.35)",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 16,
    textAlign: "center",
  },
  intentionText: {
    color: "#101010",
    fontSize: 24,
    fontWeight: "400",
    fontStyle: "italic",
    textAlign: "center",
    lineHeight: 34,
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
  },
  intentionCta: {
    color: "rgba(0,0,0,0.25)",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 24,
    textAlign: "center",
  },
  // Loading phase
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  loadingText: {
    color: "rgba(0,0,0,0.3)",
    fontSize: 14,
    fontWeight: "600",
  },
  // Error phase
  errorText: {
    color: "#101010",
    fontSize: 18,
    fontWeight: "700",
  },
  errorSubtext: {
    color: "rgba(0,0,0,0.35)",
    fontSize: 14,
    fontWeight: "500",
  },
  // Playing phase
  content: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 20,
  },
  chapterLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "rgba(0,0,0,0.35)",
    marginBottom: 12,
  },
  videoFrame: {
    overflow: "hidden",
    backgroundColor: "#e8e2d8",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  bottomSection: {
    alignItems: "center",
    alignSelf: "stretch",
    paddingTop: 20,
    paddingHorizontal: 4,
    gap: 4,
  },
  dayCount: {
    color: ACCENT,
    fontSize: 28,
    fontWeight: "900",
    marginBottom: 14,
  },
  shareButton: {
    width: "100%",
    height: 54,
    borderRadius: 27,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  unlockButton: {
    width: "100%",
    height: 54,
    borderRadius: 27,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  shareButtonComposing: {
    opacity: 0.7,
  },
  shareButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "800",
  },
});
