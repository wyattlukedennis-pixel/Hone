import { useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { GlassSurface } from "../../components/GlassSurface";
import { TactilePressable } from "../../components/TactilePressable";
import { theme } from "../../theme";
import type { Clip } from "../../types/clip";
import { ComparisonLockedState } from "./ComparisonLockedState";
import { ComparisonPresetControl } from "./ComparisonPresetControl";
import { ComparisonTeaserRow } from "./ComparisonTeaserRow";

type ComparisonPreset = "day1" | "week" | "month";
type RevealSourceRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

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
  onOpenReveal: (sourceRect: RevealSourceRect | null) => void;
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
  const cardMeasureRef = useRef<View | null>(null);

  function handleOpenReveal() {
    if (!cardMeasureRef.current || typeof cardMeasureRef.current.measureInWindow !== "function") {
      onOpenReveal(null);
      return;
    }

    cardMeasureRef.current.measureInWindow((x, y, width, height) => {
      if (!width || !height) {
        onOpenReveal(null);
        return;
      }
      onOpenReveal({ x, y, width, height });
    });
  }

  return (
    <View ref={cardMeasureRef} collapsable={false}>
      <GlassSurface style={[styles.compareCard, hero ? styles.compareCardHero : undefined]}>
        {journeyTitle ? <Text style={styles.journeyEyebrow}>{journeyTitle}</Text> : null}
        <Text style={[styles.compareTitle, hero ? styles.compareTitleHero : undefined]}>Then vs Now</Text>
        <Text style={styles.compareSubtitle}>Your clearest proof you are improving.</Text>
        {presetOptions.length > 1 ? <ComparisonPresetControl preset={preset} options={presetOptions} onChange={onPresetChange} /> : null}

        {clipsLoading ? <Text style={styles.mutedText}>Loading comparison...</Text> : null}

        {!clipsLoading && !comparison ? <ComparisonLockedState hero={hero} message={emptyComparisonMessage} /> : null}

        {!clipsLoading && comparison ? (
          <>
            <ComparisonTeaserRow thenClip={comparison.thenClip} nowClip={comparison.nowClip} hero={hero} />
            <TactilePressable style={[styles.revealButton, hero ? styles.revealButtonHero : undefined]} onPress={handleOpenReveal}>
              <Text style={styles.revealButtonText}>Open Full Comparison</Text>
            </TactilePressable>
          </>
        ) : null}
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  compareCard: {
    marginTop: 20,
    borderRadius: theme.shape.cardRadiusLg,
    padding: 16,
    borderWidth: 2,
    borderColor: "#ffffff",
    backgroundColor: "rgba(246,240,232,0.98)"
  },
  compareCardHero: {
    marginTop: 16,
    padding: 18,
    shadowColor: "#000000",
    shadowOpacity: 0.2,
    shadowRadius: 0,
    shadowOffset: { width: 4, height: 4 },
    elevation: 0
  },
  journeyEyebrow: {
    color: theme.colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontWeight: "800",
    fontSize: 11,
    fontFamily: theme.typography.label
  },
  compareTitle: {
    color: theme.colors.textPrimary,
    fontSize: 24,
    fontWeight: "800",
    fontFamily: theme.typography.display
  },
  compareTitleHero: {
    fontSize: 34,
    lineHeight: 38
  },
  compareSubtitle: {
    marginTop: 5,
    color: theme.colors.textSecondary,
    fontWeight: "700",
    fontSize: 15,
    fontFamily: theme.typography.body
  },
  mutedText: {
    marginTop: 10,
    color: theme.colors.textSecondary
  },
  revealButton: {
    marginTop: 14,
    borderRadius: theme.shape.buttonRadius,
    borderWidth: 2,
    borderColor: "#ffffff",
    backgroundColor: "rgba(255,90,31,0.28)",
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.18,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
    elevation: 0
  },
  revealButtonHero: {
    marginTop: 12
  },
  revealButtonText: {
    color: theme.colors.textPrimary,
    fontWeight: "800",
    fontSize: 14,
    letterSpacing: 0.92,
    textTransform: "uppercase",
    fontFamily: theme.typography.label
  }
});
