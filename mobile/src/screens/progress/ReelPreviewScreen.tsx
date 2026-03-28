import { useEffect, useRef, useState } from "react";
import {
  Animated,
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
import * as MediaLibrary from "expo-media-library";
import { PaywallModal } from "../../components/PaywallModal";
import { TactilePressable } from "../../components/TactilePressable";
import { triggerSelectionHaptic, triggerMilestoneHaptic, playRevealSound } from "../../utils/feedback";
import { hasRevealExportPurchase } from "../../utils/purchases";
import { renderTimelapseVideo } from "../../utils/reelExport";

type ReelPreviewScreenProps = {
  visible: boolean;
  /** URI for the day 1 clip */
  firstClipUri: string | null;
  /** URI for the latest clip */
  latestClipUri: string | null;
  daySpan: number;
  goalText?: string | null;
  onClose: () => void;
  // Timelapse props
  mode?: "video" | "timelapse";
  timelapsePhotos?: Array<{ uri: string; label: string }>;
  // For timelapse export
  token?: string;
  journeyId?: string;
};

const ACCENT_ORANGE = "#E8450A";
const VIDEO_BORDER_RADIUS = 20;

type SpeedPreset = "slow" | "medium" | "fast" | "rapid";
const SPEED_MAP: Record<SpeedPreset, number> = {
  slow: 1000,
  medium: 500,
  fast: 250,
  rapid: 100,
};
const SPEED_PRESETS: SpeedPreset[] = ["slow", "medium", "fast", "rapid"];

export default function ReelPreviewScreen({
  visible,
  firstClipUri,
  latestClipUri,
  daySpan,
  goalText,
  onClose,
  mode,
  timelapsePhotos,
  token,
  journeyId,
}: ReelPreviewScreenProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [showingNow, setShowingNow] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [showIntention, setShowIntention] = useState(!!goalText);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [exporting, setExporting] = useState(false);
  const [purchaseBump, setPurchaseBump] = useState(0);
  const purchaseUnlocked = hasRevealExportPurchase() || purchaseBump > 0;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;
  const intentionAnim = useRef(new Animated.Value(1)).current;
  const switchAnim = useRef(new Animated.Value(0)).current; // 0 = day 1, 1 = now

  const effectiveMode = mode ?? "video";
  const [speedPreset, setSpeedPreset] = useState<SpeedPreset>("medium");
  const [timelapseIndex, setTimelapseIndex] = useState(0);
  const [timelapseReady, setTimelapseReady] = useState(false);
  const [firstLoopDone, setFirstLoopDone] = useState(false);

  // Video frame sizing
  const videoPadding = 20;
  const frameWidth = width - videoPadding * 2;
  const frameHeight = (frameWidth * 16) / 9;
  const maxFrameHeight = height - insets.top - insets.bottom - 240;
  const finalFrameHeight = Math.min(frameHeight, maxFrameHeight);
  const finalFrameWidth = (finalFrameHeight * 9) / 16;

  const currentUri = showingNow ? latestClipUri : firstClipUri;

  useEffect(() => {
    if (visible) {
      setShowingNow(false);
      setVideoReady(false);
      setShowIntention(!!goalText);
      setTimelapseIndex(0);
      setTimelapseReady(false);
      setSpeedPreset("medium");
      setFirstLoopDone(false);
      setSaveState("idle");
      setExporting(false);
      fadeAnim.setValue(0);
      contentAnim.setValue(0);
      intentionAnim.setValue(1);
      switchAnim.setValue(0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 320,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, fadeAnim, contentAnim, goalText, intentionAnim, switchAnim]);

  // Auto-dismiss intention after 3s
  useEffect(() => {
    if (!visible || !showIntention || !goalText) return;
    const timer = setTimeout(dismissIntention, 3000);
    return () => clearTimeout(timer);
  }, [visible, showIntention, goalText]);

  function dismissIntention() {
    Animated.timing(intentionAnim, {
      toValue: 0,
      duration: 500,
      useNativeDriver: true,
    }).start(() => setShowIntention(false));
  }

  // Prefetch timelapse images
  useEffect(() => {
    if (!visible || effectiveMode !== "timelapse" || !timelapsePhotos?.length) return;

    Promise.all(timelapsePhotos.map((p) => Image.prefetch(p.uri)))
      .then(() => setTimelapseReady(true))
      .catch(() => setTimelapseReady(true)); // proceed even if some fail

    return () => setTimelapseReady(false);
  }, [visible, effectiveMode, timelapsePhotos]);

  // Cycle through timelapse photos
  useEffect(() => {
    if (!visible || effectiveMode !== "timelapse" || !timelapseReady || !timelapsePhotos?.length)
      return;

    const intervalMs = SPEED_MAP[speedPreset];
    const interval = setInterval(() => {
      setTimelapseIndex((prev) => {
        const next = (prev + 1) % timelapsePhotos.length;
        if (next === 0 && !firstLoopDone) setFirstLoopDone(true);
        return next;
      });
    }, intervalMs);

    return () => clearInterval(interval);
  }, [visible, effectiveMode, timelapseReady, speedPreset, timelapsePhotos, firstLoopDone]);

  // Kick off reveal when timelapse is ready
  useEffect(() => {
    if (timelapseReady && effectiveMode === "timelapse") {
      setVideoReady(true);
      playRevealSound();
      setTimeout(() => setFirstLoopDone(true), 800);
    }
  }, [timelapseReady, effectiveMode]);

  // Show content after video loads
  useEffect(() => {
    if (videoReady) {
      Animated.spring(contentAnim, {
        toValue: 1,
        tension: 50,
        friction: 9,
        useNativeDriver: true,
      }).start();
    }
  }, [videoReady, contentAnim]);

  function handlePlaybackStatus(status: AVPlaybackStatus) {
    if (!status.isLoaded) return;
    if (!videoReady) {
      setVideoReady(true);
      playRevealSound();
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
      const uri = await renderTimelapseVideo(token, journeyId, SPEED_MAP[speedPreset]);
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
        await Sharing.shareAsync(videoUri, { mimeType: "video/mp4" });
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
      await Sharing.shareAsync(localUri, { mimeType: "video/mp4" });
    } catch { /* user cancelled */ }
  }

  async function handleSave() {
    if (!purchaseUnlocked) { setPaywallVisible(true); return; }
    if (saveState !== "idle") return;
    triggerSelectionHaptic();
    const { status } = await MediaLibrary.requestPermissionsAsync(true);
    if (status !== "granted") return;
    setSaveState("saving");
    try {
      let localUri: string | null = null;

      if (effectiveMode === "timelapse") {
        localUri = await renderTimelapse();
      } else if (currentUri) {
        localUri = currentUri;
        if (currentUri.startsWith("http")) {
          const dest = `${FileSystem.cacheDirectory}hone-save-${Date.now()}.mp4`;
          const { uri: downloaded } = await FileSystem.downloadAsync(currentUri, dest);
          localUri = downloaded;
        }
      }

      if (localUri) {
        await MediaLibrary.saveToLibraryAsync(localUri);
        setSaveState("saved");
        triggerMilestoneHaptic();
      } else {
        setSaveState("idle");
      }
    } catch {
      setSaveState("idle");
    }
  }

  const contentTranslateY = contentAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0],
  });

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="none" transparent statusBarTranslucent onRequestClose={onClose}>
    <Animated.View style={[styles.root, { opacity: fadeAnim }]}>
      {/* Close button */}
      <Pressable
        style={[styles.closeButton, { top: insets.top + 4 }]}
        onPress={() => {
          triggerSelectionHaptic();
          onClose();
        }}
        hitSlop={16}
      >
        <Text style={styles.closeButtonText}>✕</Text>
      </Pressable>

      {/* Intention overlay */}
      {showIntention && goalText ? (
        <Pressable style={StyleSheet.absoluteFill} onPress={dismissIntention}>
          <Animated.View style={[styles.intentionOverlay, { opacity: intentionAnim }]}>
            <Text style={styles.intentionPreamble}>you said you wanted to...</Text>
            <Text style={styles.intentionText}>{goalText}</Text>
            <Text style={styles.intentionCta}>watch what happened.</Text>
          </Animated.View>
        </Pressable>
      ) : null}

      {/* Main content */}
      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + 48,
            paddingBottom: Math.max(insets.bottom + 12, 28),
          },
        ]}
      >
        {/* Day label above video */}
        {effectiveMode === "timelapse" ? (
          <Animated.View style={[styles.dayLabelRow, { opacity: contentAnim }]}>
            <Text style={[styles.dayLabel, styles.dayLabelActive]}>
              {timelapsePhotos?.[timelapseIndex]?.label ?? ""}
            </Text>
            <Text style={styles.dayLabelDivider}>·</Text>
            <Text style={styles.dayLabel}>{timelapsePhotos?.length ?? 0} photos</Text>
          </Animated.View>
        ) : (
          <Animated.View style={[styles.dayLabelRow, { opacity: contentAnim }]}>
            <Text style={[styles.dayLabel, !showingNow && styles.dayLabelActive]}>day 1</Text>
            <Text style={styles.dayLabelDivider}>→</Text>
            <Text style={[styles.dayLabel, showingNow && styles.dayLabelActive]}>
              day {daySpan}
            </Text>
          </Animated.View>
        )}

        {/* Video frame — tap to toggle */}
        <TactilePressable
          style={[styles.videoFrame, { width: finalFrameWidth, height: finalFrameHeight }]}
          pressScale={0.98}
          onPress={effectiveMode === "video" ? toggleClip : undefined}
        >
          {effectiveMode === "timelapse" && timelapsePhotos?.length ? (
            <>
              <Image
                key={timelapseIndex}
                source={{ uri: timelapsePhotos[timelapseIndex]?.uri }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
                fadeDuration={0}
              />
              {/* Day label removed — shown above the frame instead */}
            </>
          ) : currentUri ? (
            <Video
              key={currentUri}
              source={{ uri: currentUri }}
              style={StyleSheet.absoluteFill}
              resizeMode={ResizeMode.COVER}
              isLooping
              isMuted={!purchaseUnlocked}
              shouldPlay={visible}
              onPlaybackStatusUpdate={handlePlaybackStatus}
            />
          ) : null}
        </TactilePressable>

        {/* Toggle + info below video */}
        {videoReady ? (
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
                    style={[styles.speedPill, speedPreset === preset && styles.speedPillActive]}
                    pressScale={0.95}
                    onPress={() => {
                      triggerSelectionHaptic();
                      setSpeedPreset(preset);
                    }}
                  >
                    <Text
                      style={[
                        styles.speedPillText,
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
                {/* Toggle pill */}
                <TactilePressable style={styles.togglePill} pressScale={0.95} onPress={toggleClip}>
                  <View style={[styles.toggleOption, !showingNow && styles.toggleOptionActive]}>
                    <Text style={[styles.toggleText, !showingNow && styles.toggleTextActive]}>
                      day 1
                    </Text>
                  </View>
                  <View style={[styles.toggleOption, showingNow && styles.toggleOptionActive]}>
                    <Text style={[styles.toggleText, showingNow && styles.toggleTextActive]}>
                      now
                    </Text>
                  </View>
                </TactilePressable>

                <Text style={styles.tapHint}>tap video to switch</Text>
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
                  <Text style={styles.shareButtonText}>{exporting ? "rendering..." : "share to tiktok"}</Text>
                </TactilePressable>
                <TactilePressable
                  style={styles.saveLink}
                  pressScale={0.97}
                  onPress={() => { void handleSave(); }}
                  disabled={saveState === "saving"}
                >
                  <Text style={styles.saveLinkText}>
                    {saveState === "idle" ? "save to camera roll" : saveState === "saving" ? "saving..." : "saved ✓"}
                  </Text>
                </TactilePressable>
              </View>
            ) : (
              <TactilePressable
                style={styles.unlockPill}
                stretch
                pressScale={0.96}
                onPress={() => {
                  triggerSelectionHaptic();
                  setPaywallVisible(true);
                }}
              >
                <Text style={styles.unlockPillText}>🔇 unlock audio + export</Text>
              </TactilePressable>
            )}
          </Animated.View>
        ) : null}
      </View>

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
  content: {
    flex: 1,
    alignItems: "center",
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
  dayLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  dayLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "rgba(0,0,0,0.2)",
  },
  dayLabelActive: {
    color: ACCENT_ORANGE,
    fontSize: 18,
  },
  dayLabelDivider: {
    fontSize: 14,
    color: "rgba(0,0,0,0.15)",
    fontWeight: "600",
  },
  videoFrame: {
    borderRadius: VIDEO_BORDER_RADIUS,
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
    paddingHorizontal: 24,
    gap: 4,
  },
  togglePill: {
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.04)",
    borderRadius: 20,
    padding: 3,
  },
  toggleOption: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 17,
  },
  toggleOptionActive: {
    backgroundColor: ACCENT_ORANGE,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: "700",
    color: "rgba(0,0,0,0.3)",
  },
  toggleTextActive: {
    color: "#ffffff",
  },
  tapHint: {
    fontSize: 12,
    fontWeight: "500",
    color: "rgba(0,0,0,0.15)",
  },
  unlockPill: {
    width: "100%",
    height: 54,
    borderRadius: 27,
    backgroundColor: ACCENT_ORANGE,
    alignItems: "center",
    justifyContent: "center",
  },
  unlockPillText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "800",
  },
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
  speedControlRow: {
    flexDirection: "row",
    gap: 8,
  },
  speedPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.04)",
  },
  speedPillActive: {
    backgroundColor: ACCENT_ORANGE,
  },
  speedPillText: {
    fontSize: 13,
    fontWeight: "700",
    color: "rgba(0,0,0,0.3)",
  },
  speedPillTextActive: {
    color: "#ffffff",
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
    backgroundColor: ACCENT_ORANGE,
    alignItems: "center",
    justifyContent: "center",
  },
  shareButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "800",
  },
  saveLink: {
    alignSelf: "center",
    paddingVertical: 8,
  },
  saveLinkText: {
    color: "rgba(0,0,0,0.3)",
    fontSize: 13,
    fontWeight: "600",
  },
  timelapseLabelWrap: {
    position: "absolute",
    bottom: 16,
    left: 16,
  },
  timelapseLabel: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
