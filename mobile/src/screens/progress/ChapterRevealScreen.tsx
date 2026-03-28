import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { ResizeMode, Video, type AVPlaybackStatus } from "expo-av";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LogoMorphLoader } from "../../components/LogoMorphLoader";
import { PaywallModal } from "../../components/PaywallModal";
import { TactilePressable } from "../../components/TactilePressable";
import { triggerSelectionHaptic, triggerMilestoneHaptic, playRevealSound } from "../../utils/feedback";
import { hasRevealExportPurchase } from "../../utils/purchases";
import { resolveReelUri, type ExportReelInput } from "../../utils/reelExport";

type ChapterRevealScreenProps = {
  visible: boolean;
  reelExportInput: ExportReelInput;
  daySpan: number;
  chapterNumber: number;
  goalText?: string | null;
  onClose: () => void;
};

type Phase = "loading" | "intention" | "playing" | "error";
type SaveState = "idle" | "saving" | "saved";

const ACCENT = "#E8450A";
const VIDEO_RADIUS = 20;
const MIN_LOADING_MS = 2500;
const RESOLVE_TIMEOUT_MS = 30000;

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
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [purchaseBump, setPurchaseBump] = useState(0);
  const purchaseUnlocked = hasRevealExportPurchase() || purchaseBump > 0;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;
  const intentionAnim = useRef(new Animated.Value(1)).current;

  // Video frame sizing — constrain so buttons fit below
  const framePadding = 20;
  const maxFrameHeight = height - insets.top - insets.bottom - 240;
  const idealFrameHeight = ((width - framePadding * 2) * 16) / 9;
  const frameHeight = Math.min(idealFrameHeight, maxFrameHeight);
  const frameWidth = (frameHeight * 9) / 16;

  // Resolve the reel when visible
  useEffect(() => {
    if (!visible) return;

    // Reset state
    setPhase(goalText ? "intention" : "loading");
    setVideoUri(null);
    setVideoReady(false);
    setSaveState("idle");
    fadeAnim.setValue(0);
    contentAnim.setValue(0);
    intentionAnim.setValue(1);

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // Show intention first if goalText exists
    if (goalText) {
      const intentionTimer = setTimeout(() => {
        Animated.timing(intentionAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }).start(() => setPhase("loading"));
      }, 3000);

      // Start rendering in background during intention
      void resolveVideo();

      return () => clearTimeout(intentionTimer);
    }

    void resolveVideo();
  }, [visible]);

  async function resolveVideo() {
    const startTime = Date.now();
    try {
      const uriPromise = resolveReelUri(reelExportInput);
      const timeoutPromise = new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), RESOLVE_TIMEOUT_MS)
      );
      const uri = await Promise.race([uriPromise, timeoutPromise]);
      // Ensure minimum loading time for the morph animation
      const elapsed = Date.now() - startTime;
      if (elapsed < MIN_LOADING_MS) {
        await new Promise((r) => setTimeout(r, MIN_LOADING_MS - elapsed));
      }
      if (__DEV__) console.log("[ChapterReveal] resolveReelUri result:", uri);
      if (uri) {
        setVideoUri(uri);
        setPhase("playing");
      } else {
        if (__DEV__) console.warn("[ChapterReveal] No URI returned — check backend");
        setPhase("error");
      }
    } catch (error) {
      if (__DEV__) console.error("[ChapterReveal] Resolve failed:", error);
      setPhase("error");
    }
  }

  // Animate content in when video is ready
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

  async function handleSave() {
    if (saveState !== "idle" || !videoUri) return;
    triggerSelectionHaptic();

    if (!purchaseUnlocked) {
      setPaywallVisible(true);
      return;
    }

    const { status } = await MediaLibrary.requestPermissionsAsync(true);
    if (status !== "granted") {
      Alert.alert("permission needed", "hone needs photo library access to save.", [{ text: "ok" }]);
      return;
    }

    setSaveState("saving");
    try {
      await MediaLibrary.saveToLibraryAsync(videoUri);
      setSaveState("saved");
      triggerMilestoneHaptic();
    } catch {
      setSaveState("idle");
      Alert.alert("save failed", "something went wrong. try again.");
    }
  }

  async function handleShare() {
    if (!videoUri) return;
    triggerSelectionHaptic();

    if (!purchaseUnlocked) {
      setPaywallVisible(true);
      return;
    }

    const available = await Sharing.isAvailableAsync();
    if (!available) {
      Alert.alert("sharing unavailable", "sharing isn't available on this device.");
      return;
    }

    try {
      await Sharing.shareAsync(videoUri, {
        mimeType: "video/mp4",
        dialogTitle: "share your progress reel",
      });
    } catch (error) {
      if (__DEV__) console.error("[ChapterReveal] Share failed:", error);
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
          <Text style={styles.errorSubtext}>try recording a few more clips first</Text>
          <TactilePressable
            style={styles.retryButton}
            pressScale={0.96}
            onPress={() => {
              setPhase("loading");
              void resolveVideo();
            }}
          >
            <Text style={styles.retryButtonText}>try again</Text>
          </TactilePressable>
        </View>
      ) : null}

      {/* Playing phase */}
      {phase === "playing" ? (
        <View style={[styles.content, { paddingTop: insets.top + 48, paddingBottom: Math.max(insets.bottom + 12, 28) }]}>
          {/* Chapter label */}
          <Text style={styles.chapterLabel}>chapter {chapterNumber} reveal</Text>

          {/* Video frame */}
          <View style={[styles.videoFrame, { width: frameWidth, height: frameHeight }]}>
            {videoUri ? (
              <Video
                source={{ uri: videoUri }}
                style={StyleSheet.absoluteFill}
                resizeMode={ResizeMode.COVER}
                isLooping
                isMuted={!purchaseUnlocked}
                shouldPlay={visible && phase === "playing"}
                onPlaybackStatusUpdate={handlePlaybackStatus}
              />
            ) : null}

            {!videoReady ? (
              <View style={styles.videoLoading}>
                <ActivityIndicator size="large" color={ACCENT} />
              </View>
            ) : null}
          </View>

          {/* Bottom content */}
          {videoReady ? (
            <Animated.View
              style={[
                styles.bottomSection,
                { opacity: contentAnim, transform: [{ translateY: contentTranslateY }] },
              ]}
            >
              <Text style={styles.dayCount}>{daySpan} days</Text>

              {purchaseUnlocked ? (
                <>
                  <TactilePressable
                    style={styles.shareButton}
                    stretch
                    pressScale={0.96}
                    onPress={() => { void handleShare(); }}
                  >
                    <Text style={styles.shareButtonText}>share to tiktok</Text>
                  </TactilePressable>

                  <TactilePressable
                    style={styles.saveLink}
                    pressScale={0.97}
                    onPress={() => { void handleSave(); }}
                    disabled={saveState === "saving"}
                  >
                    <Text style={styles.saveLinkText}>
                      {saveState === "idle"
                        ? "save to camera roll"
                        : saveState === "saving"
                          ? "saving..."
                          : "saved ✓"}
                    </Text>
                  </TactilePressable>
                </>
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
                  <Text style={styles.shareButtonText}>🔇 unlock audio + export</Text>
                </TactilePressable>
              )}
            </Animated.View>
          ) : null}
        </View>
      ) : null}

      <PaywallModal
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        onPurchased={() => {
          setPaywallVisible(false);
          setPurchaseBump((v) => v + 1);
          setPhase("playing");
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
  retryButton: {
    marginTop: 12,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 22,
    backgroundColor: ACCENT,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
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
    borderRadius: VIDEO_RADIUS,
    overflow: "hidden",
    backgroundColor: "#e8e2d8",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  videoLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e8e2d8",
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
  shareButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "800",
  },
  saveLink: {
    alignSelf: "center",
    paddingVertical: 12,
  },
  saveLinkText: {
    color: "rgba(0,0,0,0.35)",
    fontSize: 14,
    fontWeight: "600",
  },
});
