import { Pressable, StyleSheet, Text, View } from "react-native";

import { theme } from "../../theme";
import { triggerSelectionHaptic } from "../../utils/feedback";

type ComparisonPreset = "day1" | "week" | "month";

type ComparisonPresetControlProps = {
  preset: ComparisonPreset;
  options: Array<{ key: ComparisonPreset; chipLabel: string }>;
  onChange: (preset: ComparisonPreset) => void;
};

export function ComparisonPresetControl({ preset, options, onChange }: ComparisonPresetControlProps) {
  return (
    <View style={styles.presetControl}>
      {options.map((entry) => {
        const active = entry.key === preset;
        return (
          <Pressable
            key={entry.key}
            style={({ pressed }) => [styles.presetButton, active ? styles.presetButtonActive : undefined, pressed ? styles.pressScale : undefined]}
            onPress={() => {
              triggerSelectionHaptic();
              onChange(entry.key);
            }}
          >
            <Text style={active ? styles.presetTextActive : styles.presetText}>{entry.chipLabel}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  presetControl: {
    marginTop: 14,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.62)",
    backgroundColor: "rgba(255,255,255,0.18)",
    flexDirection: "row",
    padding: 4,
    gap: 4
  },
  presetButton: {
    flex: 1,
    borderRadius: 11,
    paddingVertical: 10,
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
  pressScale: {
    transform: [{ scale: 0.985 }],
    opacity: 0.92
  }
});
