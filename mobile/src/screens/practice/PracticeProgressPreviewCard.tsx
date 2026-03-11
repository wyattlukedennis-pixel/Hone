import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { ResizeMode } from "expo-av";

import { GlassSurface } from "../../components/GlassSurface";
import { LoopingVideoPlayer } from "../../components/LoopingVideoPlayer";
import { theme } from "../../theme";
import type { Clip } from "../../types/clip";
import { formatClipDay, formatDurationMs } from "./helpers";

type PracticeProgressPreviewCardProps = {
  clips: Clip[];
  loading: boolean;
  practiceDots: number;
  recentlyFilledDotIndex: number | null;
  dotFillProgress: Animated.Value;
  newestClipReveal: Animated.Value;
  recentlySavedClipId: string | null;
  onOpenTimeline: () => void;
  onOpenClip: (clip: Clip) => void;
  onOpenProgress: () => void;
};

export function PracticeProgressPreviewCard({
  clips,
  loading,
  practiceDots,
  recentlyFilledDotIndex,
  dotFillProgress,
  newestClipReveal,
  recentlySavedClipId,
  onOpenTimeline,
  onOpenClip,
  onOpenProgress
}: PracticeProgressPreviewCardProps) {
  const latestClip = clips[0] ?? null;
  const firstClip = clips[clips.length - 1] ?? null;

  return (
    <GlassSurface style={styles.timelineCard}>
      <View style={styles.timelineHeader}>
        <Text style={styles.sectionTitle}>Progress Preview</Text>
        <Pressable style={({ pressed }) => [styles.timelineExpandLink, pressed ? styles.pressed : undefined]} onPress={onOpenTimeline}>
          <Text style={styles.timelineExpandLinkText}>Open timeline</Text>
        </Pressable>
      </View>

      <Pressable style={({ pressed }) => [styles.comparePreview, pressed ? styles.pressed : undefined]} onPress={onOpenProgress}>
        {firstClip && latestClip ? (
          <>
            <View style={styles.previewPane}>
              <Text style={styles.previewLabel}>Day 1</Text>
              <LoopingVideoPlayer uri={firstClip.videoUrl} style={styles.previewVideo} resizeMode={ResizeMode.COVER} muted autoPlay={false} />
            </View>
            <View style={styles.previewPane}>
              <Text style={styles.previewLabel}>Today</Text>
              <LoopingVideoPlayer uri={latestClip.videoUrl} style={styles.previewVideo} resizeMode={ResizeMode.COVER} muted autoPlay={false} />
            </View>
          </>
        ) : (
          <View style={styles.previewEmptyWrap}>
            <Text style={styles.emptyText}>Record a few days to unlock your first comparison preview.</Text>
          </View>
        )}
      </Pressable>
      <Text style={styles.progressHint}>Tap preview to open Then vs Now</Text>

      <View style={styles.dotsRow}>
        {Array.from({ length: 7 }).map((_, index) => (
          <View key={index} style={styles.dotShell}>
            {index < practiceDots ? (
              index === recentlyFilledDotIndex ? (
                <Animated.View
                  style={[
                    styles.dotFilled,
                    {
                      opacity: dotFillProgress,
                      transform: [
                        {
                          scale: dotFillProgress.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.2, 1]
                          })
                        }
                      ]
                    }
                  ]}
                />
              ) : (
                <View style={styles.dotFilled} />
              )
            ) : null}
          </View>
        ))}
      </View>

      {loading ? <Text style={styles.mutedText}>Loading clips...</Text> : null}
      {!loading && !latestClip ? <Text style={styles.emptyText}>Record your first clip to begin your daily timeline.</Text> : null}

      {!loading && latestClip ? (
        <Animated.View
          style={
            latestClip.id === recentlySavedClipId
              ? {
                  opacity: newestClipReveal,
                  transform: [
                    {
                      translateX: newestClipReveal.interpolate({
                        inputRange: [0, 1],
                        outputRange: [18, 0]
                      })
                    }
                  ]
                }
              : undefined
          }
        >
          <Pressable style={({ pressed }) => [styles.latestClipRow, pressed ? styles.pressed : undefined]} onPress={() => onOpenClip(latestClip)}>
            <Text style={styles.latestClipEyebrow}>Latest clip</Text>
            <View style={styles.latestClipRowMain}>
              <LoopingVideoPlayer uri={latestClip.videoUrl} style={styles.latestClipThumb} resizeMode={ResizeMode.COVER} muted autoPlay={false} />
              <View style={styles.clipMain}>
                <Text style={styles.clipTitle}>{formatClipDay(latestClip.recordedOn)}</Text>
                <Text style={styles.clipMeta}>
                  {formatDurationMs(latestClip.durationMs)} • {new Date(latestClip.recordedAt).toLocaleTimeString()}
                </Text>
              </View>
            </View>
          </Pressable>
        </Animated.View>
      ) : null}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  timelineCard: {
    marginTop: 14,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.78)"
  },
  timelineHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: theme.colors.textPrimary
  },
  timelineExpandLink: {
    paddingVertical: 3
  },
  timelineExpandLinkText: {
    color: theme.colors.accentStrong,
    fontWeight: "600",
    fontSize: 12
  },
  comparePreview: {
    marginTop: 10,
    flexDirection: "row",
    gap: 10,
    borderRadius: 16,
    padding: 9,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.62)",
    backgroundColor: "rgba(255,255,255,0.26)"
  },
  previewPane: {
    flex: 1
  },
  previewLabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    textTransform: "uppercase",
    fontWeight: "800",
    letterSpacing: 0.5
  },
  previewVideo: {
    marginTop: 6,
    width: "100%",
    aspectRatio: 3 / 4,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#0d2740"
  },
  previewEmptyWrap: {
    flex: 1
  },
  progressHint: {
    marginTop: 8,
    color: theme.colors.accentStrong,
    fontWeight: "600",
    fontSize: 12
  },
  dotsRow: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8
  },
  dotShell: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "rgba(255,255,255,0.46)"
  },
  dotFilled: {
    backgroundColor: theme.colors.accent,
    width: 10,
    height: 10,
    borderRadius: 5
  },
  mutedText: {
    marginTop: 10,
    color: theme.colors.textSecondary
  },
  emptyText: {
    marginTop: 8,
    color: theme.colors.textSecondary
  },
  latestClipRow: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.62)",
    backgroundColor: "rgba(255,255,255,0.34)",
    paddingHorizontal: 10,
    paddingVertical: 10
  },
  latestClipEyebrow: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.55
  },
  latestClipRowMain: {
    marginTop: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  latestClipThumb: {
    width: 48,
    height: 66,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#0d2740"
  },
  clipMain: {
    flex: 1,
    minWidth: 0
  },
  clipTitle: {
    color: theme.colors.textPrimary,
    fontWeight: "800",
    fontSize: 14
  },
  clipMeta: {
    marginTop: 3,
    color: theme.colors.textSecondary,
    fontSize: 13
  },
  pressed: {
    transform: [{ scale: 0.98 }]
  }
});
