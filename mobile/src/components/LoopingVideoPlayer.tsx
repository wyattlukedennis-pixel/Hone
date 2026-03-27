import { useEffect, useRef, useState } from "react";
import { Animated, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { ResizeMode, Video, type AVPlaybackStatus } from "expo-av";
import type { StyleProp, ViewStyle } from "react-native";
import { theme } from "../theme";
import { triggerSelectionHaptic } from "../utils/feedback";

type LoopingVideoPlayerProps = {
  uri: string;
  posterUri?: string | null;
  style: StyleProp<ViewStyle>;
  mediaType?: "video" | "photo";
  resizeMode?: ResizeMode;
  autoPlay?: boolean;
  active?: boolean;
  loop?: boolean;
  muted?: boolean;
  showControls?: boolean;
  controlsVariant?: "full" | "minimal";
};

type OverlayState = "play" | "pause" | null;

export function LoopingVideoPlayer({
  uri,
  posterUri,
  style,
  mediaType = "video",
  resizeMode = ResizeMode.COVER,
  autoPlay = true,
  active = true,
  loop = true,
  muted = true,
  showControls = false,
  controlsVariant = "full"
}: LoopingVideoPlayerProps) {
  const [desiredPlaying, setDesiredPlaying] = useState(autoPlay && active);
  const [isMuted, setIsMuted] = useState(muted);
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(true);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [overlayState, setOverlayState] = useState<OverlayState>(null);
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const lastProgressUpdateAtRef = useRef(0);
  const readyRef = useRef(false);
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setIsMuted(muted);
  }, [muted, uri]);

  useEffect(() => {
    setDesiredPlaying(autoPlay && active);
  }, [active, autoPlay]);

  useEffect(() => {
    setProgress(0);
    setErrorMessage(null);
    readyRef.current = false;
    setReady(false);
    setShowLoadingOverlay(true);
    setReloadNonce(0);
    setOverlayState(null);
    overlayOpacity.setValue(0);
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
  }, [uri, overlayOpacity]);

  useEffect(() => {
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, []);

  function markReady() {
    if (readyRef.current) return;
    readyRef.current = true;
    setReady(true);
    setShowLoadingOverlay(false);
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
  }

  function showTapFeedback(state: Exclude<OverlayState, null>) {
    setOverlayState(state);
    overlayOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(overlayOpacity, { toValue: 1, duration: 110, useNativeDriver: true }),
      Animated.delay(240),
      Animated.timing(overlayOpacity, { toValue: 0, duration: 180, useNativeDriver: true })
    ]).start(() => {
      setOverlayState(null);
    });
  }

  function togglePlayback() {
    if (mediaType === "photo") return;
    if (errorMessage) {
      triggerSelectionHaptic();
      setErrorMessage(null);
      setReloadNonce((value) => value + 1);
      setDesiredPlaying(autoPlay && active);
      return;
    }
    triggerSelectionHaptic();
    setDesiredPlaying((current) => {
      const next = !current;
      showTapFeedback(next ? "pause" : "play");
      return next;
    });
  }

  function handlePlaybackStatus(status: AVPlaybackStatus) {
    if (!status.isLoaded) return;
    markReady();
    const now = Date.now();
    if (now - lastProgressUpdateAtRef.current < 120) return;
    lastProgressUpdateAtRef.current = now;

    const duration = status.durationMillis ?? 0;
    const position = status.positionMillis ?? 0;
    setProgress(duration > 0 ? Math.min(1, Math.max(0, position / duration)) : 0);
  }

  return (
    <View style={[styles.frame, style]}>
      {mediaType === "photo" ? (
        <Image
          key={`${uri}:${reloadNonce}`}
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          resizeMode={resizeMode === ResizeMode.CONTAIN ? "contain" : "cover"}
          onLoadStart={() => {
            readyRef.current = false;
            setReady(false);
            setShowLoadingOverlay(true);
            if (loadingTimeoutRef.current) {
              clearTimeout(loadingTimeoutRef.current);
            }
            loadingTimeoutRef.current = setTimeout(() => {
              setShowLoadingOverlay(false);
            }, 2600);
          }}
          onLoad={() => {
            markReady();
            setErrorMessage(null);
          }}
          onError={() => {
            setErrorMessage("IMAGE_LOAD_FAILED");
            readyRef.current = false;
            setReady(false);
            setShowLoadingOverlay(false);
            if (loadingTimeoutRef.current) {
              clearTimeout(loadingTimeoutRef.current);
              loadingTimeoutRef.current = null;
            }
          }}
        />
      ) : (
        <Video
          key={`${uri}:${reloadNonce}`}
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          resizeMode={resizeMode}
          usePoster={Boolean(posterUri)}
          posterSource={posterUri ? { uri: posterUri } : undefined}
          isLooping={loop}
          isMuted={isMuted}
          shouldPlay={desiredPlaying}
          progressUpdateIntervalMillis={showControls ? 180 : 500}
          onLoadStart={() => {
            if (readyRef.current) return;
            readyRef.current = false;
            setReady(false);
            setShowLoadingOverlay(true);
            if (loadingTimeoutRef.current) {
              clearTimeout(loadingTimeoutRef.current);
            }
            loadingTimeoutRef.current = setTimeout(() => {
              // Prevent indefinite spinner if native status callbacks are flaky.
              setShowLoadingOverlay(false);
            }, 2600);
          }}
          onLoad={() => {
            markReady();
          }}
          onReadyForDisplay={() => {
            markReady();
            setErrorMessage(null);
          }}
          onPlaybackStatusUpdate={handlePlaybackStatus}
          onError={(error) => {
            setErrorMessage(error);
            setDesiredPlaying(false);
            readyRef.current = false;
            setReady(false);
            setShowLoadingOverlay(false);
            if (loadingTimeoutRef.current) {
              clearTimeout(loadingTimeoutRef.current);
              loadingTimeoutRef.current = null;
            }
          }}
        />
      )}

      {showControls && mediaType === "video" ? (
        <>
          <Pressable style={StyleSheet.absoluteFill} onPress={togglePlayback} />

          {overlayState ? (
            <Animated.View style={[styles.tapFeedback, { opacity: overlayOpacity }]}>
              <Text style={styles.tapFeedbackText}>{overlayState === "pause" ? "II" : ">"}</Text>
            </Animated.View>
          ) : null}

          {controlsVariant === "full" ? (
            <View style={styles.bottomOverlay}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.max(3, progress * 100)}%` }]} />
              </View>
              <Pressable
                style={styles.soundChip}
                onPress={() => {
                  triggerSelectionHaptic();
                  setIsMuted((current) => !current);
                }}
              >
                <Text style={styles.soundChipText}>{isMuted ? "Sound Off" : "Sound On"}</Text>
              </Pressable>
            </View>
          ) : null}
        </>
      ) : null}

      {errorMessage ? (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorText}>Video unavailable. Tap to retry.</Text>
        </View>
      ) : !ready && showLoadingOverlay ? (
        <View style={styles.loadingOverlay}>
          <Text style={styles.loadingText}>Loading clip...</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: "hidden",
    borderRadius: 12,
    backgroundColor: "#0a1628"
  },
  tapFeedback: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: [{ translateX: -30 }, { translateY: -30 }],
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(7,17,30,0.58)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.42)"
  },
  tapFeedbackText: {
    color: "#eaf5ff",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: 1
  },
  bottomOverlay: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 8
  },
  progressTrack: {
    height: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.2)",
    overflow: "hidden"
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: theme.colors.accent
  },
  soundChip: {
    marginTop: 7,
    alignSelf: "flex-end",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "rgba(7,16,30,0.66)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.36)"
  },
  soundChipText: {
    color: "#e8f2ff",
    fontWeight: "700",
    fontSize: 11
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    backgroundColor: "rgba(5,12,22,0.42)"
  },
  errorText: {
    color: "#d6e7fb",
    fontWeight: "700",
    fontSize: 12,
    textAlign: "center"
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(5,12,22,0.16)"
  },
  loadingText: {
    color: "#d6e7fb",
    fontWeight: "700",
    fontSize: 12
  }
});
