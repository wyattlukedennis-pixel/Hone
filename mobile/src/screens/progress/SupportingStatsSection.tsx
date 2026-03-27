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
    borderRadius: theme.shape.cardRadiusLg,
    borderWidth: 2,
    borderColor: "#ffffff",
    backgroundColor: "rgba(246,240,232,0.98)",
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
    fontWeight: "800",
    fontFamily: theme.typography.heading
  },
  supportingSubtitle: {
    marginTop: 2,
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
    fontFamily: theme.typography.body
  },
  supportingToggle: {
    color: theme.colors.accentStrong,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontFamily: theme.typography.label
  },
  pressScale: {
    transform: [{ scale: 0.98 }]
  }
});
