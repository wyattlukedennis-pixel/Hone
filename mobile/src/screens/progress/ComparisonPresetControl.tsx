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
    borderRadius: theme.shape.cardRadiusMd,
    borderWidth: 2,
    borderColor: "#ffffff",
    backgroundColor: "rgba(241,233,221,0.94)",
    flexDirection: "row",
    padding: 4,
    gap: 4
  },
  presetButton: {
    flex: 1,
    borderRadius: theme.shape.chipRadius,
    borderWidth: 2,
    borderColor: "transparent",
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  presetButtonActive: {
    borderColor: "#ffffff",
    backgroundColor: "rgba(255,90,31,0.28)"
  },
  presetText: {
    color: theme.colors.textSecondary,
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 0.72,
    textTransform: "uppercase",
    fontFamily: theme.typography.label
  },
  presetTextActive: {
    color: theme.colors.textPrimary,
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 0.72,
    textTransform: "uppercase",
    fontFamily: theme.typography.label
  },
  pressScale: {
    transform: [{ scale: 0.985 }],
    opacity: 0.92
  }
});
