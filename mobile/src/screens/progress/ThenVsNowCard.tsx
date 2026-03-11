import { Pressable, StyleSheet, Text, View } from "react-native";
import { ResizeMode } from "expo-av";

import { GlassSurface } from "../../components/GlassSurface";
import { LoopingVideoPlayer } from "../../components/LoopingVideoPlayer";
import { theme } from "../../theme";
import type { Clip } from "../../types/clip";

type ComparisonPreset = "day1" | "week" | "month";

type ThenVsNowCardProps = {
  journeyTitle?: string;
  hero?: boolean;
  preset: ComparisonPreset;
  presetOptions: Array<{ key: ComparisonPreset; label: string; chipLabel: string }>;
  clipsLoading: boolean;
  comparison: {
    thenClip: Clip;
    nowClip: Clip;
  } | null;
  emptyComparisonMessage: string;
  onPresetChange: (preset: ComparisonPreset) => void;
  onOpenReveal: () => void;
};

export function ThenVsNowCard({
  journeyTitle,
  hero = false,
  preset,
  presetOptions,
  clipsLoading,
  comparison,
  emptyComparisonMessage,
  onPresetChange,
  onOpenReveal
}: ThenVsNowCardProps) {
  return (
    <GlassSurface style={[styles.compareCard, hero ? styles.compareCardHero : undefined]}>
      {journeyTitle ? <Text style={styles.journeyEyebrow}>{journeyTitle}</Text> : null}
      <Text style={[styles.compareTitle, hero ? styles.compareTitleHero : undefined]}>Then vs Now</Text>
      <Text style={styles.compareSubtitle}>Your clearest proof you are improving.</Text>
      <View style={styles.presetControl}>
        {presetOptions.map((entry) => {
          const active = entry.key === preset;
          return (
            <Pressable
              key={entry.key}
              style={({ pressed }) => [
                styles.presetButton,
                active ? styles.presetButtonActive : undefined,
                pressed ? styles.pressScale : undefined
              ]}
              onPress={() => onPresetChange(entry.key)}
            >
              <Text style={active ? styles.presetTextActive : styles.presetText}>{entry.chipLabel}</Text>
            </Pressable>
          );
        })}
      </View>

      {clipsLoading ? <Text style={styles.mutedText}>Loading comparison...</Text> : null}

      {!clipsLoading && !comparison ? (
        <View style={[styles.unlockBox, hero ? styles.unlockBoxHero : undefined]}>
          <Text style={styles.unlockTitle}>Comparison locked</Text>
          <View style={styles.lockedTeaserRow}>
            <View style={[styles.lockedTeaserPane, hero ? styles.lockedTeaserPaneHero : undefined]}>
              <Text style={styles.lockedTeaserLabel}>Then</Text>
            </View>
            <View style={[styles.lockedTeaserPane, hero ? styles.lockedTeaserPaneHero : undefined]}>
              <Text style={styles.lockedTeaserLabel}>Now</Text>
            </View>
          </View>
          <Text style={styles.unlockText}>{emptyComparisonMessage}</Text>
        </View>
      ) : null}

      {!clipsLoading && comparison ? (
        <>
          <View style={styles.compareTeaserRow}>
            <View style={styles.compareTeaserPane}>
              <Text style={styles.compareTeaserLabel}>
                {new Date(comparison.thenClip.recordedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric"
                })}
              </Text>
              <LoopingVideoPlayer
                uri={comparison.thenClip.videoUrl}
                style={[styles.compareTeaserVideo, hero ? styles.compareTeaserVideoHero : undefined]}
                resizeMode={ResizeMode.COVER}
                muted
                autoPlay={false}
              />
            </View>
            <View style={styles.compareTeaserPane}>
              <Text style={styles.compareTeaserLabel}>Latest</Text>
              <LoopingVideoPlayer
                uri={comparison.nowClip.videoUrl}
                style={[styles.compareTeaserVideo, hero ? styles.compareTeaserVideoHero : undefined]}
                resizeMode={ResizeMode.COVER}
                muted
                autoPlay={false}
              />
            </View>
          </View>
          <Pressable
            style={({ pressed }) => [styles.revealButton, hero ? styles.revealButtonHero : undefined, pressed ? styles.pressScale : undefined]}
            onPress={onOpenReveal}
          >
            <Text style={styles.revealButtonText}>Open Full Comparison</Text>
          </Pressable>
        </>
      ) : null}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  compareCard: {
    marginTop: 18,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.78)"
  },
  compareCardHero: {
    marginTop: 14,
    padding: 16,
    shadowColor: "#0c2e54",
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8
  },
  journeyEyebrow: {
    color: theme.colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    fontWeight: "800",
    fontSize: 11
  },
  compareTitle: {
    color: theme.colors.textPrimary,
    fontSize: 24,
    fontWeight: "800"
  },
  compareTitleHero: {
    fontSize: 28
  },
  compareSubtitle: {
    marginTop: 3,
    color: theme.colors.textSecondary,
    fontWeight: "600",
    fontSize: 14
  },
  presetControl: {
    marginTop: 10,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.62)",
    backgroundColor: "rgba(255,255,255,0.18)",
    flexDirection: "row",
    padding: 3,
    gap: 4
  },
  presetButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  presetButtonActive: {
    backgroundColor: theme.colors.accent
  },
  presetText: {
    color: theme.colors.textSecondary,
    fontWeight: "700",
    fontSize: 13
  },
  presetTextActive: {
    color: "#eaf4ff",
    fontWeight: "800",
    fontSize: 13
  },
  mutedText: {
    marginTop: 10,
    color: theme.colors.textSecondary
  },
  unlockBox: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.66)",
    borderRadius: 14,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.2)"
  },
  unlockBoxHero: {
    marginTop: 14
  },
  unlockTitle: {
    color: theme.colors.textPrimary,
    fontWeight: "800",
    fontSize: 16
  },
  lockedTeaserRow: {
    marginTop: 10,
    flexDirection: "row",
    gap: 10
  },
  lockedTeaserPane: {
    flex: 1,
    height: 110,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center"
  },
  lockedTeaserPaneHero: {
    height: 140
  },
  lockedTeaserLabel: {
    color: theme.colors.textSecondary,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  unlockText: {
    marginTop: 10,
    color: theme.colors.textSecondary
  },
  compareTeaserRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 10
  },
  compareTeaserPane: {
    flex: 1
  },
  compareTeaserLabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  compareTeaserVideo: {
    marginTop: 5,
    width: "100%",
    aspectRatio: 3 / 4,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#0d2740"
  },
  compareTeaserVideoHero: {
    aspectRatio: 9 / 13
  },
  revealButton: {
    marginTop: 10,
    borderRadius: 13,
    backgroundColor: theme.colors.accent,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  revealButtonHero: {
    marginTop: 12
  },
  revealButtonText: {
    color: "#eaf4ff",
    fontWeight: "800"
  },
  pressScale: {
    transform: [{ scale: 0.98 }]
  }
});
