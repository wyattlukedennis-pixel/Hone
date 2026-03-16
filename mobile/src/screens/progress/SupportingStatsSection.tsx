import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { theme } from "../../theme";
import { triggerSelectionHaptic } from "../../utils/feedback";

type SupportingStatsSectionProps = {
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
};

export function SupportingStatsSection({ open, onToggle, children }: SupportingStatsSectionProps) {
  return (
    <View style={styles.supportingWrap}>
      <Pressable
        style={({ pressed }) => [styles.supportingHeader, pressed ? styles.pressScale : undefined]}
        onPress={() => {
          triggerSelectionHaptic();
          onToggle();
        }}
      >
        <View style={styles.supportingCopy}>
          <Text style={styles.supportingTitle}>Supporting stats</Text>
          <Text style={styles.supportingSubtitle}>Heatmap and streak details</Text>
        </View>
        <Text style={styles.supportingToggle}>{open ? "Hide" : "Show"}</Text>
      </Pressable>

      {open ? children : null}
    </View>
  );
}

const styles = StyleSheet.create({
  supportingWrap: {
    marginTop: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.68)",
    backgroundColor: "rgba(255,255,255,0.24)",
    padding: 13
  },
  supportingHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  supportingCopy: {
    flex: 1
  },
  supportingTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: "800"
  },
  supportingSubtitle: {
    marginTop: 2,
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: "600"
  },
  supportingToggle: {
    color: theme.colors.accentStrong,
    fontSize: 13,
    fontWeight: "800"
  },
  pressScale: {
    transform: [{ scale: 0.98 }]
  }
});
