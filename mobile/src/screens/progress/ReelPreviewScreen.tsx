import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { ResizeMode, Video, type AVPlaybackStatus } from "expo-av";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { LogoMorphLoader } from "../../components/LogoMorphLoader";
import { PaywallModal } from "../../components/PaywallModal";
import { TactilePressable } from "../../components/TactilePressable";
import { triggerSelectionHaptic, triggerMilestoneHaptic, playRevealSound } from "../../utils/feedback";
import { hasRevealExportPurchase } from "../../utils/purchases";
import { renderTimelapseVideo } from "../../utils/reelExport";
import type { Clip } from "../../types/clip";

type ReelPreviewScreenProps = {
  visible: boolean;
  /** URI for the day 1 clip */
  firstClipUri: string | null;
  /** URI for the latest clip */
  latestClipUri: string | null;
  daySpan: number;
  chapterNumber?: number;
  goalText?: string | null;
  darkMode?: boolean;
  onClose: () => void;
  // Timelapse props
  mode?: "video" | "timelapse";
  timelapsePhotos?: Array<{ uri: string; label: string }>;
  timelapseClips?: Clip[];
  // For timelapse export
  token?: string;
  journeyId?: string;
  /** Skip the "building your reveal..." loading animation */
  skipLoading?: boolean;
};

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
const LIGHT_PILL_BG = "rgba(0,0,0,0.04)";
const LIGHT_PILL_TEXT = "rgba(0,0,0,0.3)";

// Dark mode palette
const DARK_BG = "#0a0a0a";
const DARK_TEXT_PRIMARY = "#f6f1e8";
const DARK_TEXT_SECONDARY = "rgba(255,255,255,0.35)";
const DARK_TEXT_MUTED = "rgba(255,255,255,0.3)";
const DARK_CLOSE_BG = "rgba(255,255,255,0.1)";
const DARK_VIDEO_BG = "#1a1816";
const DARK_PILL_BG = "rgba(255,255,255,0.08)";
const DARK_PILL_TEXT = "rgba(255,255,255,0.3)";

type SpeedPreset = "slow" | "medium" | "fast" | "rapid";
const SPEED_MAP: Record<SpeedPreset, number> = {
  slow: 1000,
  medium: 500,
  fast: 250,
  rapid: 100,
};
const SPEED_PRESETS: SpeedPreset[] = ["slow", "medium", "fast", "rapid"];

type Phase = "loading" | "intention" | "playing" | "error";

export default function ReelPreviewScreen({
  visible,
  firstClipUri,
  latestClipUri,
  daySpan: _daySpan,
  chapterNumber,
  goalText,
  darkMode = false,
  onClose,
  mode,
  timelapsePhotos,
  timelapseClips,
  token,
  journeyId,
  skipLoading = false,
}: ReelPreviewScreenProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>("loading");
  const [showingNow, setShowingNow] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [purchaseBump, setPurchaseBump] = useState(0);
  const purchaseUnlocked = hasRevealExportPurchase() || purchaseBump > 0;

  // Theme colors
  const bg = darkMode ? DARK_BG : LIGHT_BG;
  const textPrimary = darkMode ? DARK_TEXT_PRIMARY : LIGHT_TEXT_PRIMARY;
  const textSecondary = darkMode ? DARK_TEXT_SECONDARY : LIGHT_TEXT_SECONDARY;
  const textMuted = darkMode ? DARK_TEXT_MUTED : LIGHT_TEXT_MUTED;
  const closeBg = darkMode ? DARK_CLOSE_BG : LIGHT_CLOSE_BG;
  const videoBg = darkMode ? DARK_VIDEO_BG : LIGHT_VIDEO_BG;
  const pillBg = darkMode ? DARK_PILL_BG : LIGHT_PILL_BG;
  const pillText = darkMode ? DARK_PILL_TEXT : LIGHT_PILL_TEXT;

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;
  const intentionAnim = useRef(new Animated.Value(1)).current;
  const switchAnim = useRef(new Animated.Value(0)).current;
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

  const effectiveMode = mode ?? "video";
  const [speedPreset, setSpeedPreset] = useState<SpeedPreset>("medium");
  const [timelapseIndex, setTimelapseIndex] = useState(0);
  const [prevTimelapseIndex, setPrevTimelapseIndex] = useState(0);
  const [timelapseReady, setTimelapseReady] = useState(false);

  // Video frame sizing
  const framePadding = 20;
  const maxFrameHeight = height - insets.top - insets.bottom - 240;
  const idealFrameHeight = ((width - framePadding * 2) * 16) / 9;
  const frameHeight = Math.min(idealFrameHeight, maxFrameHeight);
  const frameWidth = (frameHeight * 9) / 16;

  const currentUri = showingNow ? latestClipUri : firstClipUri;

  // Orchestrate loading animation sequence
  useEffect(() => {
    if (!visible) return;

    // Reset all state
    setShowingNow(false);
    setTimelapseIndex(0);
    setTimelapseReady(false);
    setSpeedPreset("medium");
    setExporting(false);
    revealSoundPlayed.current = false;
    firstVideoLoaded.current = false;
    latestVideoLoaded.current = false;

    // Skip loading animation — go straight to playing
    if (skipLoading) {
      setPhase("playing");
      fadeAnim.setValue(1);
      contentAnim.setValue(1);
      videoEntryScale.setValue(1);
      videoEntryOpacity.setValue(1);
      loadingExitOpacity.setValue(0);
      return;
    }

    setPhase(goalText ? "intention" : "loading");

    // Reset all animation values
    fadeAnim.setValue(0);
    contentAnim.setValue(0);
    intentionAnim.setValue(1);
    switchAnim.setValue(0);
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

      return () => {
        clearTimeout(intentionTimer);
        clearTimeout(loadingSequenceTimer);
        breatheLoop.stop();
      };
    }

    // No intention — start loading sequence immediately
    runLoadingSequence();

    return () => {
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
  }, [visible]);

  // Prefetch timelapse images during loading phase, filtering out failures
  const [loadedPhotos, setLoadedPhotos] = useState<Array<{ uri: string; label: string }>>([]);
  useEffect(() => {
    if (!visible || effectiveMode !== "timelapse" || !timelapsePhotos?.length) return;

    Promise.all(
      timelapsePhotos.map((p) =>
        Image.prefetch(p.uri).then(() => p).catch(() => null)
      )
    ).then((results) => {
      const valid = results.filter((r): r is { uri: string; label: string } => r !== null);
      setLoadedPhotos(valid.length > 0 ? valid : timelapsePhotos);
      setTimelapseReady(true);
    });

    return () => {
      setTimelapseReady(false);
      setLoadedPhotos([]);
    };
  }, [visible, effectiveMode, timelapsePhotos]);

  // Trigger transition when content is ready
  const transitionTriggered = useRef(false);
  useEffect(() => {
    if (!visible) {
      transitionTriggered.current = false;
      return;
    }
    if (transitionTriggered.current) return;
    if (phase !== "loading") return;

    const isReady = effectiveMode === "timelapse" ? timelapseReady : true;
    if (!isReady) return;

    // Wait at least LOADING_MS before transitioning
    const timer = setTimeout(() => {
      if (transitionTriggered.current) return;
      transitionTriggered.current = true;
      triggerTransition();
    }, LOADING_MS);

    return () => clearTimeout(timer);
  }, [visible, phase, timelapseReady, effectiveMode]);

  function triggerTransition() {
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
  }

  // Play sound and animate content when entering playing phase
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

  // Cycle through timelapse photos (only when playing)
  // First and last photos hold for 2s, middle photos use speed preset
  const timelapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (phase !== "playing" || effectiveMode !== "timelapse" || !timelapseReady || !loadedPhotos.length)
      return;

    const total = loadedPhotos.length;
    const intervalMs = SPEED_MAP[speedPreset];
    const HOLD_MS = 2000;

    function scheduleNext(current: number) {
      const isFirst = current === 0;
      const isLast = current === total - 1;
      const delay = isFirst || isLast ? HOLD_MS : intervalMs;

      timelapseTimerRef.current = setTimeout(() => {
        const next = (current + 1) % total;
        // When looping back to 0, set prev to 0 to avoid flash of last photo behind first
        setPrevTimelapseIndex(next === 0 ? 0 : current);
        setTimelapseIndex(next);
        scheduleNext(next);
      }, delay);
    }

    scheduleNext(timelapseIndex);

    return () => {
      if (timelapseTimerRef.current) clearTimeout(timelapseTimerRef.current);
    };
  }, [phase, effectiveMode, timelapseReady, speedPreset, loadedPhotos]);

  const firstVideoLoaded = useRef(false);
  const latestVideoLoaded = useRef(false);

  function handleFirstPlaybackStatus(status: AVPlaybackStatus) {
    if (!status.isLoaded) return;
    if (!firstVideoLoaded.current) {
      firstVideoLoaded.current = true;
    }
  }

  function handleLatestPlaybackStatus(status: AVPlaybackStatus) {
    if (!status.isLoaded) return;
    if (!latestVideoLoaded.current) {
      latestVideoLoaded.current = true;
    }
  }

  function toggleClip() {
    triggerSelectionHaptic();
    const next = !showingNow;
    setShowingNow(next);
    Animated.spring(switchAnim, {
      toValue: next ? 1 : 0,
      tension: 80,
      friction: 10,
      useNativeDriver: true,
    }).start();
  }

  async function renderTimelapse(): Promise<string | null> {
    if (!token || !journeyId) return null;
    setExporting(true);
    try {
      const uri = await renderTimelapseVideo(token, journeyId, SPEED_MAP[speedPreset], 2000, timelapseClips);
      return uri;
    } finally {
      setExporting(false);
    }
  }

  async function handleShare() {
    if (!purchaseUnlocked) { setPaywallVisible(true); return; }
    triggerSelectionHaptic();

    if (effectiveMode === "timelapse") {
      const videoUri = await renderTimelapse();
      if (!videoUri) return;
      try {
        await Sharing.shareAsync(videoUri, { mimeType: "video/mp4", dialogTitle: "share your progress" });
      } catch { /* user cancelled */ }
      return;
    }

    // Video mode — share current clip
    if (!currentUri) return;
    try {
      let localUri = currentUri;
      if (currentUri.startsWith("http")) {
        const dest = `${FileSystem.cacheDirectory}hone-share-${Date.now()}.mp4`;
        const { uri: downloaded } = await FileSystem.downloadAsync(currentUri, dest);
        localUri = downloaded;
      }
      await Sharing.shareAsync(localUri, { mimeType: "video/mp4", dialogTitle: "share your progress" });
    } catch { /* user cancelled */ }
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

  if (!visible) return null;

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
            <Text style={[styles.loadingChapterLabel, { color: textSecondary }]}>
              {chapterNumber ? `chapter ${chapterNumber}` : "your journey"}
            </Text>
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

      {/* Playing phase */}
      {phase === "playing" ? (
        <Animated.View style={[
          styles.content,
          { paddingTop: insets.top + 48, paddingBottom: Math.max(insets.bottom + 12, 28) },
        ]}>
          {/* Header label */}
          {effectiveMode === "timelapse" ? (
            <Animated.View style={[styles.dayLabelRow, { opacity: videoEntryOpacity }]}>
              <Text style={[styles.dayLabel, { color: ACCENT }]}>
                {loadedPhotos[timelapseIndex]?.label ?? ""}
              </Text>
              <Text style={[styles.dayLabelDivider, { color: textMuted }]}>·</Text>
              <Text style={[styles.dayLabel, { color: textMuted }]}>{loadedPhotos.length} photos</Text>
            </Animated.View>
          ) : (
            <Animated.Text style={[
              styles.chapterLabel,
              { color: textSecondary, opacity: videoEntryOpacity },
            ]}>
              {chapterNumber ? `chapter ${chapterNumber} reveal` : "your reveal"}
            </Animated.Text>
          )}

          {/* Video/Photo frame with scale-up entrance */}
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
            {effectiveMode === "timelapse" && loadedPhotos.length ? (
              <>
                <Image
                  source={{ uri: loadedPhotos[prevTimelapseIndex]?.uri }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                  fadeDuration={0}
                />
                <Image
                  source={{ uri: loadedPhotos[timelapseIndex]?.uri }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                  fadeDuration={0}
                />
              </>
            ) : (
              <>
                {firstClipUri ? (
                  <View style={[StyleSheet.absoluteFill, showingNow && { opacity: 0 }]} pointerEvents={showingNow ? "none" : "auto"}>
                    <Video
                      source={{ uri: firstClipUri }}
                      style={StyleSheet.absoluteFill}
                      resizeMode={ResizeMode.COVER}
                      isLooping
                      isMuted={!purchaseUnlocked}
                      shouldPlay={visible && phase === "playing" && !showingNow}
                      onPlaybackStatusUpdate={handleFirstPlaybackStatus}
                      onError={() => {}}
                    />
                  </View>
                ) : null}
                {latestClipUri ? (
                  <View style={[StyleSheet.absoluteFill, !showingNow && { opacity: 0 }]} pointerEvents={showingNow ? "auto" : "none"}>
                    <Video
                      source={{ uri: latestClipUri }}
                      style={StyleSheet.absoluteFill}
                      resizeMode={ResizeMode.COVER}
                      isLooping
                      isMuted={!purchaseUnlocked}
                      shouldPlay={visible && phase === "playing" && showingNow}
                      onPlaybackStatusUpdate={handleLatestPlaybackStatus}
                      onError={() => {}}
                    />
                  </View>
                ) : null}
              </>
            )}
          </Animated.View>

          {/* Bottom content */}
          <Animated.View
            style={[
              styles.bottomSection,
              { opacity: contentAnim, transform: [{ translateY: contentTranslateY }] },
            ]}
          >
            {effectiveMode === "timelapse" ? (
              <View style={styles.speedControlRow}>
                {SPEED_PRESETS.map((preset) => (
                  <TactilePressable
                    key={preset}
                    style={[styles.speedPill, { backgroundColor: pillBg }, speedPreset === preset && styles.speedPillActive]}
                    pressScale={0.95}
                    onPress={() => {
                      triggerSelectionHaptic();
                      setSpeedPreset(preset);
                    }}
                  >
                    <Text
                      style={[
                        styles.speedPillText,
                        { color: pillText },
                        speedPreset === preset && styles.speedPillTextActive,
                      ]}
                    >
                      {preset}
                    </Text>
                  </TactilePressable>
                ))}
              </View>
            ) : (
              <>
                <TactilePressable style={[styles.togglePill, { backgroundColor: pillBg }]} pressScale={0.95} onPress={toggleClip}>
                  <View style={[styles.toggleOption, !showingNow && styles.toggleOptionActive]}>
                    <Text style={[styles.toggleText, { color: pillText }, !showingNow && styles.toggleTextActive]}>
                      day 1
                    </Text>
                  </View>
                  <View style={[styles.toggleOption, showingNow && styles.toggleOptionActive]}>
                    <Text style={[styles.toggleText, { color: pillText }, showingNow && styles.toggleTextActive]}>
                      now
                    </Text>
                  </View>
                </TactilePressable>
                <Text style={[styles.tapHint, { color: textMuted }]}>tap video to switch</Text>
              </>
            )}

            {/* Share/Save or Unlock */}
            {purchaseUnlocked ? (
              <View style={styles.exportRow}>
                <TactilePressable
                  style={styles.shareButton}
                  stretch
                  pressScale={0.96}
                  onPress={() => { void handleShare(); }}
                >
                  <Text style={styles.shareButtonText}>{exporting ? "rendering..." : "share"}</Text>
                </TactilePressable>
              </View>
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
  dayLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  dayLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
  dayLabelDivider: {
    fontSize: 14,
    fontWeight: "600",
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
  speedControlRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  speedPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
  },
  speedPillActive: {
    backgroundColor: ACCENT,
  },
  speedPillText: {
    fontSize: 13,
    fontWeight: "700",
  },
  speedPillTextActive: {
    color: "#ffffff",
  },
  togglePill: {
    flexDirection: "row",
    borderRadius: 20,
    padding: 3,
  },
  toggleOption: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 17,
  },
  toggleOptionActive: {
    backgroundColor: ACCENT,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: "700",
  },
  toggleTextActive: {
    color: "#ffffff",
  },
  tapHint: {
    fontSize: 12,
    fontWeight: "500",
  },
  exportRow: {
    width: "100%",
    alignItems: "center",
    gap: 4,
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
  shareButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "800",
  },
});
