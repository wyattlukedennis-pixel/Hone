import { Pressable, StyleSheet, Text, View } from "react-native";

import { GlassSurface } from "../../components/GlassSurface";
import { theme } from "../../theme";
import type { Journey } from "../../types/journey";
import { triggerSelectionHaptic } from "../../utils/feedback";

type JourneySelectorCardProps = {
  journeys: Journey[];
  activeJourneyId: string | null;
  onSelectJourney: (journeyId: string) => void;
};

export function JourneySelectorCard({ journeys, activeJourneyId, onSelectJourney }: JourneySelectorCardProps) {
  return (
    <GlassSurface style={styles.selectorCard}>
      <Text style={styles.selectorTitle}>Choose Journey</Text>
      <View style={styles.selectorWrap}>
        {journeys.map((journey) => {
          const active = journey.id === activeJourneyId;
          return (
            <Pressable
              key={journey.id}
              style={({ pressed }) => [
                styles.selectorPill,
                active ? styles.selectorPillActive : undefined,
                pressed ? styles.pressScale : undefined
              ]}
              onPress={() => {
                triggerSelectionHaptic();
                onSelectJourney(journey.id);
              }}
            >
              <Text style={[styles.selectorPillText, active ? styles.selectorPillTextActive : undefined]}>{journey.title}</Text>
            </Pressable>
          );
        })}
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  selectorCard: {
    marginTop: 10,
    borderRadius: theme.shape.cardRadiusLg,
    borderWidth: 2,
    borderColor: "#ffffff",
    backgroundColor: "rgba(246,240,232,0.98)",
    padding: 12
  },
  selectorTitle: {
    color: theme.colors.textSecondary,
    fontWeight: "800",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.85,
    fontFamily: theme.typography.label
  },
  selectorWrap: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  selectorPill: {
    borderRadius: theme.shape.pillRadius,
    borderWidth: 2,
    borderColor: "#ffffff",
    backgroundColor: "rgba(241,233,221,0.94)",
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  selectorPillActive: {
    borderColor: "#ffffff",
    backgroundColor: "rgba(255,90,31,0.26)"
  },
  selectorPillText: {
    color: theme.colors.textSecondary,
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    fontFamily: theme.typography.label
  },
  selectorPillTextActive: {
    color: theme.colors.textPrimary
  },
  pressScale: {
    transform: [{ scale: 0.98 }]
  }
});
