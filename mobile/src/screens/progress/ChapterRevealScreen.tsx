import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
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
import { triggerSelectionHaptic, triggerMilestoneHaptic, playRevealSound } from "../../utils/feedback";
import { hasRevealExportPurchase } from "../../utils/purchases";
import { composeReel } from "../../utils/reelComposer";
import type { ExportReelInput } from "../../utils/reelExport";
import type { Clip } from "../../types/clip";
import { theme } from "../../theme";
import type { ReelClipEntry } from "../../components/SequentialReelPlayer";

type ChapterRevealScreenProps = {
  visible: boolean;
  reelExportInput: ExportReelInput;
  daySpan: number;
  chapterNumber: number;
  goalText?: string | null;
  darkMode?: boolean;
  onClose: () => void;
};

type Phase = "loading" | "intention" | "playing" | "error";

const ACCENT = "#E8450A";
const VIDEO_RADIUS = 20;
const LOADING_MS = 3200;

// Light mode palette
const LIGHT_BG = "#f4efe6";
const LIGHT_TEXT_PRIMARY = "#101010";
const LIGHT_TEXT_SECONDARY = "rgba(0,0,0,0.35)";
const LIGHT_TEXT_MUTED = "rgba(0,0,0,0.3)";
const LIGHT_CLOSE_BG = "rgba(0,0,0,0.06)";
const LIGHT_VIDEO_BG = "#e8e2d8";

// Dark mode palette
const DARK_BG = "#0a0a0a";
const DARK_TEXT_PRIMARY = "#f6f1e8";
const DARK_TEXT_SECONDARY = "rgba(255,255,255,0.35)";
const DARK_TEXT_MUTED = "rgba(255,255,255,0.3)";
const DARK_CLOSE_BG = "rgba(255,255,255,0.1)";
const DARK_VIDEO_BG = "#1a1816";

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
  darkMode = false,
  onClose,
}: ChapterRevealScreenProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>("loading");
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [purchaseBump, setPurchaseBump] = useState(0);
  const purchaseUnlocked = hasRevealExportPurchase() || purchaseBump > 0;

  // Theme colors
  const bg = darkMode ? DARK_BG : LIGHT_BG;
  const textPrimary = darkMode ? DARK_TEXT_PRIMARY : LIGHT_TEXT_PRIMARY;
  const textSecondary = darkMode ? DARK_TEXT_SECONDARY : LIGHT_TEXT_SECONDARY;
  const textMuted = darkMode ? DARK_TEXT_MUTED : LIGHT_TEXT_MUTED;
  const closeBg = darkMode ? DARK_CLOSE_BG : LIGHT_CLOSE_BG;
  const videoBg = darkMode ? DARK_VIDEO_BG : LIGHT_VIDEO_BG;

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;
  const intentionAnim = useRef(new Animated.Value(1)).current;
  const revealSoundPlayed = useRef(false);

  // Loading phase animations
  const logoScale = useRef(new Animated.Value(0.6)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const glowScale = useRef(new Animated.Value(0.8)).current;
  const loadingTextOpacity = useRef(new Animated.Value(0)).current;
  const chapterTextOpacity = useRef(new Animated.Value(0)).current;
  const chapterTextScale = useRef(new Animated.Value(0.9)).current;

  // Transition animations
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const loadingExitScale = useRef(new Animated.Value(1)).current;
  const loadingExitOpacity = useRef(new Animated.Value(1)).current;
  const videoEntryScale = useRef(new Animated.Value(0.85)).current;
  const videoEntryOpacity = useRef(new Animated.Value(0)).current;

  // Breathing pulse for glow
  const breatheAnim = useRef(new Animated.Value(0)).current;

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
    const clips = allClips.length > 0 ? allClips : trailerClips.length > 0 ? trailerClips : fallback;
    if (!clips.length) return [];
    return buildReelClips(clips);
  }, [reelExportInput.sourceClips, reelExportInput.trailerMoments, reelExportInput.fallbackClip]);

  // Orchestrate loading animation sequence
  useEffect(() => {
    if (!visible) return;

    // Reset all animation values
    setPhase(goalText ? "intention" : "loading");
    revealSoundPlayed.current = false;
    fadeAnim.setValue(0);
    contentAnim.setValue(0);
    intentionAnim.setValue(1);
    logoScale.setValue(0.6);
    logoOpacity.setValue(0);
    glowOpacity.setValue(0);
    glowScale.setValue(0.8);
    loadingTextOpacity.setValue(0);
    chapterTextOpacity.setValue(0);
    chapterTextScale.setValue(0.9);
    flashOpacity.setValue(0);
    loadingExitScale.setValue(1);
    loadingExitOpacity.setValue(1);
    videoEntryScale.setValue(0.85);
    videoEntryOpacity.setValue(0);

    // Fade in the screen
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    // Start breathing pulse loop
    const breatheLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breatheAnim, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    breatheLoop.start();

    const baseDelay = goalText ? 3000 : 0;

    // Show intention first if goalText exists
    if (goalText) {
      const intentionTimer = setTimeout(() => {
        Animated.timing(intentionAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }).start(() => setPhase("loading"));
      }, 3000);

      const loadingSequenceTimer = setTimeout(() => {
        runLoadingSequence();
      }, 3500);

      const loadingTimer = setTimeout(() => {
        triggerTransition();
      }, baseDelay + LOADING_MS);

      return () => {
        clearTimeout(intentionTimer);
        clearTimeout(loadingSequenceTimer);
        clearTimeout(loadingTimer);
        breatheLoop.stop();
      };
    }

    // No intention — start loading sequence immediately
    runLoadingSequence();

    const loadingTimer = setTimeout(() => {
      triggerTransition();
    }, LOADING_MS);

    return () => {
      clearTimeout(loadingTimer);
      breatheLoop.stop();
    };

    function runLoadingSequence() {
      // 1. Chapter text fades in first (0ms)
      Animated.parallel([
        Animated.timing(chapterTextOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.spring(chapterTextScale, {
          toValue: 1,
          tension: 60,
          friction: 10,
          useNativeDriver: true,
        }),
      ]).start();

      // 2. Logo enters with spring (300ms)
      setTimeout(() => {
        Animated.parallel([
          Animated.spring(logoScale, {
            toValue: 1,
            tension: 40,
            friction: 8,
            useNativeDriver: true,
          }),
          Animated.timing(logoOpacity, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
        ]).start();
      }, 300);

      // 3. Glow ring appears (600ms)
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(glowOpacity, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.spring(glowScale, {
            toValue: 1,
            tension: 50,
            friction: 9,
            useNativeDriver: true,
          }),
        ]).start();
      }, 600);

      // 4. "building your reveal..." text fades in (1000ms)
      setTimeout(() => {
        Animated.timing(loadingTextOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      }, 1000);
    }

    function triggerTransition() {
      if (reelClips.length > 0) {
        Animated.parallel([
          Animated.timing(loadingExitOpacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(loadingExitScale, {
            toValue: 0.7,
            duration: 300,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start(() => {
          triggerMilestoneHaptic();
          Animated.sequence([
            Animated.timing(flashOpacity, {
              toValue: 1,
              duration: 100,
              useNativeDriver: true,
            }),
            Animated.timing(flashOpacity, {
              toValue: 0,
              duration: 400,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
          ]).start();

          setPhase("playing");
          Animated.parallel([
            Animated.spring(videoEntryScale, {
              toValue: 1,
              tension: 45,
              friction: 9,
              useNativeDriver: true,
            }),
            Animated.timing(videoEntryOpacity, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }),
          ]).start();
        });
      } else {
        setPhase("error");
      }
    }
  }, [visible]);

  // Play sound when entering playing phase
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

  // Pre-compose the reel in the background for export sharing.
  // This is a best-effort pre-cache — failures are non-blocking.
  const [composedUri, setComposedUri] = useState<string | null>(null);
  const composedUriRef = useRef<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [shareRequested, setShareRequested] = useState(false);
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
        composedUriRef.current = uri;
        setComposedUri(uri);
      }
    }).catch(() => {
      composeFailed.current = true;
    }).finally(() => {
      setComposing(false);
    });
  }, [visible, reelExportInput]);

  // Reset pre-compose state when screen closes
  useEffect(() => {
    if (!visible) {
      composeStarted.current = false;
      composeFailed.current = false;
      composedUriRef.current = null;
      setComposedUri(null);
      setShareRequested(false);
    }
  }, [visible]);

  // Track compose failure so we don't keep retrying
  const composeFailed = useRef(false);

  // Auto-share when background compose finishes and user already tapped share
  useEffect(() => {
    if (shareRequested && composedUri) {
      setShareRequested(false);
      Sharing.shareAsync(composedUri, {
        mimeType: "video/mp4",
        dialogTitle: "share your progress",
      }).catch(() => {});
    }
  }, [shareRequested, composedUri]);

  async function handleShare() {
    triggerSelectionHaptic();
    if (!purchaseUnlocked) {
      setPaywallVisible(true);
      return;
    }

    // Already composed — share immediately (check ref for synchronous access)
    const readyUri = composedUriRef.current ?? composedUri;
    if (readyUri) {
      try {
        await Sharing.shareAsync(readyUri, {
          mimeType: "video/mp4",
          dialogTitle: "share your progress",
        });
      } catch {}
      return;
    }

    // Still composing in background — mark that user wants to share
    if (composing) {
      setShareRequested(true);
      return;
    }

    // Background compose failed or never started — compose on-demand
    const allClips = reelExportInput.sourceClips ?? [];
    const trailerClips = (reelExportInput.trailerMoments ?? []).map((m) => m.clip);
    const fallback = reelExportInput.fallbackClip ? [reelExportInput.fallbackClip] : [];
    const sourceClips = allClips.length > 0 ? allClips : trailerClips.length > 0 ? trailerClips : fallback;

    if (!sourceClips.length || !reelExportInput.token || !reelExportInput.journeyId) return;

    setShareRequested(true);
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
    } catch {} finally {
      setComposing(false);
      setShareRequested(false);
    }
  }

  const contentTranslateY = contentAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0],
  });

  // Breathing glow scale
  const breatheScale = breatheAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.15],
  });
  const breatheOpacityVal = breatheAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.4, 0.8, 0.4],
  });

  return (
    <Modal visible={visible} animationType="none" transparent={false} statusBarTranslucent onRequestClose={onClose}>
    <Animated.View style={[styles.root, { backgroundColor: bg, opacity: fadeAnim }]}>
      {/* Close button */}
      <Pressable
        style={[styles.closeButton, { top: insets.top + 8, backgroundColor: closeBg }]}
        onPress={() => { triggerSelectionHaptic(); onClose(); }}
        hitSlop={16}
      >
        <Text style={[styles.closeButtonText, { color: textPrimary }]}>✕</Text>
      </Pressable>

      {/* Intention phase */}
      {phase === "intention" && goalText ? (
        <Animated.View style={[styles.intentionOverlay, { backgroundColor: bg, opacity: intentionAnim }]}>
          <Text style={[styles.intentionPreamble, { color: textSecondary }]}>you said you wanted to...</Text>
          <Text style={[styles.intentionText, { color: textPrimary }]}>{goalText}</Text>
          <Text style={[styles.intentionCta, { color: textMuted }]}>watch what happened.</Text>
        </Animated.View>
      ) : null}

      {/* Loading phase — cinematic branded sequence */}
      {phase === "loading" ? (
        <Animated.View style={[
          styles.loadingContainer,
          { opacity: loadingExitOpacity, transform: [{ scale: loadingExitScale }] },
        ]}>
          {/* Chapter text */}
          <Animated.View style={{ opacity: chapterTextOpacity, transform: [{ scale: chapterTextScale }] }}>
            <Text style={[styles.loadingChapterLabel, { color: textSecondary }]}>chapter {chapterNumber}</Text>
          </Animated.View>

          {/* Logo with glow ring */}
          <View style={styles.logoContainer}>
            <Animated.View style={[
              styles.glowRing,
              {
                opacity: Animated.multiply(glowOpacity, breatheOpacityVal),
                transform: [{ scale: Animated.multiply(glowScale, breatheScale) }],
              },
            ]} />
            <Animated.View style={{ opacity: logoOpacity, transform: [{ scale: logoScale }] }}>
              <LogoMorphLoader size={120} color={ACCENT} duration={900} />
            </Animated.View>
          </View>

          {/* Loading text */}
          <Animated.View style={{ opacity: loadingTextOpacity }}>
            <Text style={[styles.loadingText, { color: textMuted }]}>building your reveal...</Text>
          </Animated.View>
        </Animated.View>
      ) : null}

      {/* Flash overlay */}
      <Animated.View
        style={[styles.flashOverlay, { opacity: flashOpacity, backgroundColor: darkMode ? "#ffffff" : ACCENT }]}
        pointerEvents="none"
      />

      {/* Error phase */}
      {phase === "error" ? (
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: textPrimary }]}>couldn't build your reveal</Text>
          <Text style={[styles.errorSubtext, { color: textSecondary }]}>record a few more clips to unlock your reel</Text>
        </View>
      ) : null}

      {/* Playing phase — fully local via SequentialReelPlayer */}
      {phase === "playing" && reelClips.length > 0 ? (
        <Animated.View style={[
          styles.content,
          { paddingTop: insets.top + 48, paddingBottom: Math.max(insets.bottom + 12, 28) },
        ]}>
          {/* Chapter label */}
          <Animated.Text style={[
            styles.chapterLabel,
            { color: textSecondary, opacity: videoEntryOpacity },
          ]}>
            chapter {chapterNumber} reveal
          </Animated.Text>

          {/* Video frame with scale-up entrance */}
          <Animated.View style={[
            styles.videoFrame,
            {
              width: frameWidth,
              height: frameHeight,
              borderRadius: VIDEO_RADIUS,
              backgroundColor: videoBg,
              opacity: videoEntryOpacity,
              transform: [{ scale: videoEntryScale }],
            },
          ]}>
            <SequentialReelPlayer
              clips={reelClips}
              style={StyleSheet.absoluteFill}
              loop
              muted={!purchaseUnlocked}
              autoPlay
            />
          </Animated.View>

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
                style={[styles.shareButton, shareRequested && styles.shareButtonComposing]}
                stretch
                pressScale={shareRequested ? 1 : 0.96}
                onPress={() => { void handleShare(); }}
              >
                <Text style={styles.shareButtonText}>{shareRequested ? "composing..." : "share"}</Text>
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
        </Animated.View>
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
  },
  closeButton: {
    position: "absolute",
    left: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 18,
  },
  // Intention phase
  intentionOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    zIndex: 50,
  },
  intentionPreamble: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 16,
    textAlign: "center",
  },
  intentionText: {
    fontSize: 24,
    fontWeight: "400",
    fontStyle: "italic",
    textAlign: "center",
    lineHeight: 34,
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
  },
  intentionCta: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 24,
    textAlign: "center",
  },
  // Loading phase — cinematic
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 28,
    zIndex: 5,
  },
  loadingChapterLabel: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
    fontFamily: Platform.OS === "ios" ? "AvenirNext-Bold" : "sans-serif-medium",
  },
  logoContainer: {
    width: 160,
    height: 160,
    alignItems: "center",
    justifyContent: "center",
  },
  glowRing: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: ACCENT,
    shadowColor: ACCENT,
    shadowOpacity: 0.6,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
  },
  loadingText: {
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  // Flash overlay
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
  },
  // Error phase
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  errorText: {
    fontSize: 18,
    fontWeight: "700",
  },
  errorSubtext: {
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
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  videoFrame: {
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
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
