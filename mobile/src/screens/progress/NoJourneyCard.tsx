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
      <Text style={styles.emptyTitle}>No journey yet</Text>
      <Text style={styles.emptyText}>Create your first journey, then record today to unlock comparisons.</Text>
      <Pressable
        style={({ pressed }) => [styles.ctaButton, pressed ? styles.pressScale : undefined]}
        onPress={() => {
          triggerSelectionHaptic();
          onStartJourney();
        }}
      >
        <Text style={styles.ctaText}>Start a Journey</Text>
      </Pressable>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  emptyCard: {
    marginTop: 14,
    borderRadius: 22,
    padding: 14
  },
  emptyTitle: {
    color: theme.colors.textPrimary,
    fontSize: 22,
    fontWeight: "800"
  },
  emptyText: {
    marginTop: 8,
    color: theme.colors.textSecondary
  },
  ctaButton: {
    marginTop: 14,
    borderRadius: 14,
    backgroundColor: theme.colors.accent,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  ctaText: {
    color: "#eaf4ff",
    fontWeight: "800"
  },
  pressScale: {
    transform: [{ scale: 0.98 }]
  }
});
