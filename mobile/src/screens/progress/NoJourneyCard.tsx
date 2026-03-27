import { Pressable, StyleSheet, Text } from "react-native";

import { GlassSurface } from "../../components/GlassSurface";
import { theme } from "../../theme";
import { triggerSelectionHaptic } from "../../utils/feedback";

type NoJourneyCardProps = {
  onStartJourney: () => void;
};

export function NoJourneyCard({ onStartJourney }: NoJourneyCardProps) {
  return (
    <GlassSurface style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>No active journey yet</Text>
      <Text style={styles.emptyText}>Start your first journey, then log a take today to unlock comparisons.</Text>
      <Pressable
        style={({ pressed }) => [styles.ctaButton, pressed ? styles.pressScale : undefined]}
        onPress={() => {
          triggerSelectionHaptic();
          onStartJourney();
        }}
      >
        <Text style={styles.ctaText}>Start First Journey</Text>
      </Pressable>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  emptyCard: {
    marginTop: 14,
    borderRadius: theme.shape.cardRadiusLg,
    borderWidth: 2,
    borderColor: "#ffffff",
    backgroundColor: "rgba(245,239,230,0.98)",
    padding: 14
  },
  emptyTitle: {
    color: theme.colors.textPrimary,
    fontSize: 22,
    fontWeight: "800",
    fontFamily: theme.typography.display
  },
  emptyText: {
    marginTop: 8,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.body
  },
  ctaButton: {
    marginTop: 14,
    borderRadius: theme.shape.buttonRadius,
    borderWidth: 2,
    borderColor: "#ffffff",
    backgroundColor: "rgba(255,90,31,0.22)",
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  ctaText: {
    color: "#111111",
    fontWeight: "800",
    letterSpacing: 0.9,
    textTransform: "uppercase",
    fontFamily: theme.typography.label
  },
  pressScale: {
    transform: [{ scale: 0.98 }]
  }
});
