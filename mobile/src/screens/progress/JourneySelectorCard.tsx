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
    borderRadius: 20,
    padding: 12
  },
  selectorTitle: {
    color: theme.colors.textSecondary,
    fontWeight: "700",
    fontSize: 13
  },
  selectorWrap: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  selectorPill: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.66)",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  selectorPillActive: {
    borderColor: "rgba(47,128,237,0.5)",
    backgroundColor: "rgba(47,128,237,0.14)"
  },
  selectorPillText: {
    color: theme.colors.textSecondary,
    fontWeight: "700"
  },
  selectorPillTextActive: {
    color: theme.colors.textPrimary
  },
  pressScale: {
    transform: [{ scale: 0.98 }]
  }
});
