import { StyleSheet, Text, View } from "react-native";
import { ResizeMode } from "expo-av";

import { LoopingVideoPlayer } from "../../components/LoopingVideoPlayer";
import { TactilePressable } from "../../components/TactilePressable";
import { GlassSurface } from "../../components/GlassSurface";
import { theme } from "../../theme";
import type { ComparisonPair } from "../../utils/progress";

type PracticeProgressProofCardProps = {
  loading: boolean;
  dayCount: number;
  comparison: ComparisonPair | null;
  onOpenProgress: () => void;
};

export function PracticeProgressProofCard({ loading, dayCount, comparison, onOpenProgress }: PracticeProgressProofCardProps) {
  const lockMessage =
    dayCount <= 0
      ? "Record Day 1 to start your progress story."
      : dayCount === 1
        ? "One more practice day unlocks your first Then vs Now."
        : "Keep recording daily to unlock richer comparisons.";

  return (
    <GlassSurface style={styles.card}>
      <Text style={styles.eyebrow}>Progress Proof</Text>
      <Text style={styles.title}>Day 1 vs Today</Text>
      <Text style={styles.subtitle}>See the change, not the guess.</Text>

      {loading ? <Text style={styles.loadingText}>Loading your progress preview...</Text> : null}

      {!loading && comparison ? (
        <TactilePressable style={styles.comparePressable} onPress={onOpenProgress}>
          <View style={styles.compareRow}>
            <View style={styles.comparePane}>
              <Text style={styles.compareLabel}>Then</Text>
              <Text style={styles.compareMeta} numberOfLines={1}>
                {comparison.thenLabel}
              </Text>
              <LoopingVideoPlayer
                uri={comparison.thenClip.videoUrl}
                mediaType={comparison.thenClip.captureType}
                posterUri={comparison.thenClip.thumbnailUrl}
                style={styles.compareVideo}
                resizeMode={ResizeMode.COVER}
                muted
                autoPlay
              />
            </View>
            <View style={styles.comparePane}>
              <Text style={styles.compareLabel}>Now</Text>
              <Text style={styles.compareMeta} numberOfLines={1}>
                {comparison.nowLabel}
              </Text>
              <LoopingVideoPlayer
                uri={comparison.nowClip.videoUrl}
                mediaType={comparison.nowClip.captureType}
                posterUri={comparison.nowClip.thumbnailUrl}
                style={styles.compareVideo}
                resizeMode={ResizeMode.COVER}
                muted
                autoPlay
              />
            </View>
          </View>
          <Text style={styles.ctaHint}>Tap to open full comparison</Text>
        </TactilePressable>
      ) : null}

      {!loading && !comparison ? (
        <View style={styles.lockedState}>
          <View style={styles.lockedRow}>
            <View style={styles.lockedPane}>
              <Text style={styles.lockedLabel}>Then</Text>
            </View>
            <View style={styles.lockedPane}>
              <Text style={styles.lockedLabel}>Now</Text>
            </View>
          </View>
          <Text style={styles.lockedText}>{lockMessage}</Text>
        </View>
      ) : null}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 14,
    borderRadius: 24,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.76)"
  },
  eyebrow: {
    color: theme.colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    fontWeight: "800",
    fontSize: 11
  },
  title: {
    marginTop: 3,
    color: theme.colors.textPrimary,
    fontSize: 28,
    fontWeight: "800"
  },
  subtitle: {
    marginTop: 3,
    color: theme.colors.textSecondary,
    fontWeight: "600",
    fontSize: 14
  },
  loadingText: {
    marginTop: 12,
    color: theme.colors.textSecondary,
    fontWeight: "600"
  },
  comparePressable: {
    marginTop: 12
  },
  compareRow: {
    flexDirection: "row",
    gap: 10
  },
  comparePane: {
    flex: 1
  },
  compareLabel: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  compareMeta: {
    marginTop: 2,
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: "700"
  },
  compareVideo: {
    marginTop: 6,
    width: "100%",
    aspectRatio: 10 / 16,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#0d2740"
  },
  ctaHint: {
    marginTop: 9,
    color: theme.colors.accentStrong,
    fontWeight: "700"
  },
  lockedState: {
    marginTop: 12
  },
  lockedRow: {
    flexDirection: "row",
    gap: 10
  },
  lockedPane: {
    flex: 1,
    height: 154,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.58)",
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center"
  },
  lockedLabel: {
    color: theme.colors.textSecondary,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  lockedText: {
    marginTop: 10,
    color: theme.colors.textSecondary,
    fontWeight: "600"
  }
});
