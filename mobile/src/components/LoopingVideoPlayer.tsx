import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { ResizeMode, Video, type AVPlaybackStatus } from "expo-av";
import type { StyleProp, ViewStyle } from "react-native";

type LoopingVideoPlayerProps = {
  uri: string;
  style: StyleProp<ViewStyle>;
  resizeMode?: ResizeMode;
  autoPlay?: boolean;
  active?: boolean;
  loop?: boolean;
  muted?: boolean;
  showControls?: boolean;
};

type OverlayState = "play" | "pause" | null;

export function LoopingVideoPlayer({
  uri,
  style,
  resizeMode = ResizeMode.COVER,
  autoPlay = true,
  active = true,
  loop = true,
  muted = true,
  showControls = false
}: LoopingVideoPlayerProps) {
  const [desiredPlaying, setDesiredPlaying] = useState(autoPlay && active);
  const [isMuted, setIsMuted] = useState(muted);
  const [progress, setProgress] = useState(0);
  const [overlayState, setOverlayState] = useState<OverlayState>(null);
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const lastProgressUpdateAtRef = useRef(0);

  useEffect(() => {
    setIsMuted(muted);
  }, [muted, uri]);

  useEffect(() => {
    setDesiredPlaying(autoPlay && active);
    setProgress(0);
    setOverlayState(null);
    overlayOpacity.setValue(0);
  }, [active, autoPlay, uri, overlayOpacity]);

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
    setDesiredPlaying((current) => {
      const next = !current;
      showTapFeedback(next ? "pause" : "play");
      return next;
    });
  }

  function handlePlaybackStatus(status: AVPlaybackStatus) {
    if (!status.isLoaded) return;
    const now = Date.now();
    if (now - lastProgressUpdateAtRef.current < 120) return;
    lastProgressUpdateAtRef.current = now;

    const duration = status.durationMillis ?? 0;
    const position = status.positionMillis ?? 0;
    setProgress(duration > 0 ? Math.min(1, Math.max(0, position / duration)) : 0);
  }

  return (
    <View style={[styles.frame, style]}>
      <Video
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        resizeMode={resizeMode}
        isLooping={loop}
        isMuted={isMuted}
        shouldPlay={desiredPlaying}
        progressUpdateIntervalMillis={showControls ? 180 : 500}
        onPlaybackStatusUpdate={showControls ? handlePlaybackStatus : undefined}
      />

      {showControls ? (
        <>
          <Pressable style={StyleSheet.absoluteFill} onPress={togglePlayback} />

          {overlayState ? (
            <Animated.View style={[styles.tapFeedback, { opacity: overlayOpacity }]}>
              <Text style={styles.tapFeedbackText}>{overlayState === "pause" ? "II" : ">"}</Text>
            </Animated.View>
          ) : null}

          <View style={styles.bottomOverlay}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.max(3, progress * 100)}%` }]} />
            </View>
            <Pressable
              style={styles.soundChip}
              onPress={() => {
                setIsMuted((current) => !current);
              }}
            >
              <Text style={styles.soundChipText}>{isMuted ? "Sound Off" : "Sound On"}</Text>
            </Pressable>
          </View>
        </>
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
    backgroundColor: "#0e63ff"
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
  }
});
