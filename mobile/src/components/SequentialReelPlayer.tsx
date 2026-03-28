import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { ResizeMode, Video, type AVPlaybackStatus } from "expo-av";
import type { StyleProp, ViewStyle } from "react-native";

type ReelClipEntry = {
  uri: string;
  label: string;
  /** How long to show this clip in ms. First/last = 3000, middle = 800. */
  holdMs: number;
};

type SequentialReelPlayerProps = {
  clips: ReelClipEntry[];
  style: StyleProp<ViewStyle>;
  loop?: boolean;
  muted?: boolean;
  autoPlay?: boolean;
};

const FLASH_DURATION_MS = 80;

/**
 * Plays a sequence of video clips back-to-back with white flash transitions,
 * simulating a stitched montage without FFmpeg.
 */
export function SequentialReelPlayer({
  clips,
  style,
  loop = true,
  muted = false,
  autoPlay = true,
}: SequentialReelPlayerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState(autoPlay);
  const [showFlash, setShowFlash] = useState(false);
  const [ready, setReady] = useState(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const labelOpacity = useRef(new Animated.Value(1)).current;

  const clip = clips[currentIndex];

  const advanceClip = useCallback(() => {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= clips.length) {
      if (!loop) {
        setPlaying(false);
        return;
      }
      // Flash then loop
      setShowFlash(true);
      flashTimerRef.current = setTimeout(() => {
        setShowFlash(false);
        setCurrentIndex(0);
        labelOpacity.setValue(0);
        Animated.timing(labelOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }, FLASH_DURATION_MS);
      return;
    }

    // Flash transition
    setShowFlash(true);
    flashTimerRef.current = setTimeout(() => {
      setShowFlash(false);
      setCurrentIndex(nextIndex);
      labelOpacity.setValue(0);
      Animated.timing(labelOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }, FLASH_DURATION_MS);
  }, [currentIndex, clips.length, loop, labelOpacity]);

  // When a clip becomes ready, start the hold timer
  const onClipReady = useCallback(() => {
    if (!ready) setReady(true);
    if (!playing || !clip) return;
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = setTimeout(advanceClip, clip.holdMs);
  }, [playing, clip, advanceClip, ready]);

  function handlePlaybackStatus(status: AVPlaybackStatus) {
    if (!status.isLoaded) return;
    onClipReady();
  }

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  // Reset hold timer when index changes
  useEffect(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, [currentIndex]);

  if (!clip) return null;

  return (
    <View style={[styles.container, style]}>
      <Video
        key={`reel-${currentIndex}-${clip.uri}`}
        source={{ uri: clip.uri }}
        style={StyleSheet.absoluteFill}
        resizeMode={ResizeMode.COVER}
        shouldPlay={playing}
        isMuted={muted}
        isLooping={false}
        onPlaybackStatusUpdate={handlePlaybackStatus}
      />

      {/* Day label overlay */}
      <Animated.View style={[styles.labelWrap, { opacity: labelOpacity }]}>
        <Text style={styles.labelShadow}>{clip.label}</Text>
        <Text style={styles.labelText}>{clip.label}</Text>
      </Animated.View>

      {/* White flash transition */}
      {showFlash ? <View style={styles.flash} /> : null}

      {/* Loading state */}
      {!ready ? (
        <View style={styles.loadingOverlay}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    borderRadius: 12,
    backgroundColor: "#0a0a0a",
  },
  labelWrap: {
    position: "absolute",
    bottom: 24,
    left: 20,
  },
  labelShadow: {
    position: "absolute",
    fontSize: 42,
    fontWeight: "800",
    color: "rgba(0,0,0,0.4)",
    left: 2,
    top: 2,
  },
  labelText: {
    fontSize: 42,
    fontWeight: "800",
    color: "#ffffff",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  flash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#ffffff",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(5,12,22,0.16)",
  },
  loadingText: {
    color: "#d6e7fb",
    fontWeight: "700",
    fontSize: 12,
  },
});
