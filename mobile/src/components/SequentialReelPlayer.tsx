import { useCallback, useEffect, useRef, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { ResizeMode, Video, type AVPlaybackStatus } from "expo-av";
import type { StyleProp, ViewStyle } from "react-native";

export type ReelClipEntry = {
  uri: string;
  label: string;
  holdMs: number;
  captureType: "video" | "photo";
};

type SequentialReelPlayerProps = {
  clips: ReelClipEntry[];
  style: StyleProp<ViewStyle>;
  loop?: boolean;
  muted?: boolean;
  autoPlay?: boolean;
};

/**
 * Plays a sequence of video/photo clips back-to-back with hard cuts.
 *
 * All clips are mounted simultaneously to eliminate decode delay between
 * transitions — only the current clip is visible and playing.
 *
 * Hard cuts only — no fades, no flashes. Native to TikTok pacing.
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
  const [ready, setReady] = useState(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clipTimerStarted = useRef(false);

  const clip = clips[currentIndex];

  const advanceClip = useCallback(() => {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= clips.length) {
      if (!loop) {
        setPlaying(false);
        return;
      }
      setCurrentIndex(0);
    } else {
      setCurrentIndex(nextIndex);
    }
  }, [currentIndex, clips.length, loop]);

  const onClipReady = useCallback(() => {
    if (!ready) setReady(true);
    if (!playing || !clip || clipTimerStarted.current) return;
    clipTimerStarted.current = true;
    holdTimerRef.current = setTimeout(advanceClip, clip.holdMs);
  }, [playing, clip, advanceClip, ready]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    };
  }, []);

  // Reset hold timer when index changes
  useEffect(() => {
    clipTimerStarted.current = false;
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, [currentIndex]);

  if (!clips.length) return null;

  return (
    <View style={[styles.container, style]}>
      {/* Mount ALL clips — only current is visible and playing */}
      {clips.map((entry, index) => {
        const isCurrent = index === currentIndex;
        return (
          <View
            key={`slot-${index}-${entry.uri}`}
            style={[StyleSheet.absoluteFill, { zIndex: isCurrent ? 1 : 0, opacity: isCurrent ? 1 : 0 }]}
            pointerEvents={isCurrent ? "auto" : "none"}
          >
            {entry.captureType === "photo" ? (
              <Image
                source={{ uri: entry.uri }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
                onLoad={isCurrent ? onClipReady : undefined}
              />
            ) : (
              <Video
                source={{ uri: entry.uri }}
                style={StyleSheet.absoluteFill}
                resizeMode={ResizeMode.COVER}
                shouldPlay={isCurrent && playing}
                isMuted={muted}
                isLooping={false}
                onPlaybackStatusUpdate={isCurrent ? (status: AVPlaybackStatus) => {
                  if (!status.isLoaded) {
                    if ("error" in status && status.error) {
                      if (__DEV__) console.error("[SequentialReelPlayer] load error:", status.error);
                      onClipReady();
                    }
                    return;
                  }
                  onClipReady();
                } : undefined}
                onError={isCurrent ? (error: string) => {
                  if (__DEV__) console.error("[SequentialReelPlayer] onError:", error);
                  onClipReady();
                } : undefined}
              />
            )}
          </View>
        );
      })}

      {/* Day label overlay */}
      {clip ? (
        <View style={[styles.labelWrap, { zIndex: 6 }]}>
          <Text style={styles.labelShadow}>{clip.label}</Text>
          <Text style={styles.labelText}>{clip.label}</Text>
        </View>
      ) : null}

      {/* Loading state */}
      {!ready ? (
        <View style={[styles.loadingOverlay, { zIndex: 7 }]}>
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
