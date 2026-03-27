import { StyleSheet, Text, View } from "react-native";
import { ResizeMode } from "expo-av";

import { LoopingVideoPlayer } from "../../components/LoopingVideoPlayer";
import type { Clip } from "../../types/clip";
import { theme } from "../../theme";

type ComparisonTeaserRowProps = {
  thenClip: Clip;
  nowClip: Clip;
  hero?: boolean;
};

export function ComparisonTeaserRow({ thenClip, nowClip, hero = false }: ComparisonTeaserRowProps) {
  return (
    <View style={styles.compareTeaserRow}>
      <View style={styles.compareTeaserPane}>
        <Text style={styles.compareTeaserLabel}>
          {new Date(thenClip.recordedAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric"
          })}
        </Text>
        <LoopingVideoPlayer
          uri={thenClip.videoUrl}
          mediaType={thenClip.captureType}
          posterUri={thenClip.thumbnailUrl}
          style={[styles.compareTeaserVideo, hero ? styles.compareTeaserVideoHero : undefined]}
          resizeMode={ResizeMode.COVER}
          muted
          autoPlay
        />
      </View>
      <View style={styles.compareTeaserPane}>
        <Text style={styles.compareTeaserLabel}>Latest</Text>
        <LoopingVideoPlayer
          uri={nowClip.videoUrl}
          mediaType={nowClip.captureType}
          posterUri={nowClip.thumbnailUrl}
          style={[styles.compareTeaserVideo, hero ? styles.compareTeaserVideoHero : undefined]}
          resizeMode={ResizeMode.COVER}
          muted
          autoPlay
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  compareTeaserRow: {
    marginTop: 14,
    flexDirection: "row",
    gap: 12
  },
  compareTeaserPane: {
    flex: 1
  },
  compareTeaserLabel: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.9,
    fontFamily: theme.typography.label
  },
  compareTeaserVideo: {
    marginTop: 6,
    width: "100%",
    aspectRatio: 3 / 4,
    borderRadius: theme.shape.cardRadiusMd,
    borderWidth: 2,
    borderColor: "#ffffff",
    overflow: "hidden",
    backgroundColor: "#121212"
  },
  compareTeaserVideoHero: {
    aspectRatio: 9 / 15
  }
});
