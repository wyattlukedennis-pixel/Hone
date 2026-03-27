import { StyleSheet, Text, View } from "react-native";

import { theme } from "../../theme";

type ComparisonLockedStateProps = {
  hero?: boolean;
  message: string;
};

export function ComparisonLockedState({ hero = false, message }: ComparisonLockedStateProps) {
  return (
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
      <Text style={styles.unlockText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  unlockBox: {
    marginTop: 14,
    borderWidth: 2,
    borderColor: "#ffffff",
    borderRadius: theme.shape.cardRadiusMd,
    padding: 15,
    backgroundColor: "rgba(241,233,221,0.94)"
  },
  unlockBoxHero: {
    marginTop: 14
  },
  unlockTitle: {
    color: theme.colors.textPrimary,
    fontWeight: "800",
    fontSize: 16,
    textTransform: "uppercase",
    letterSpacing: 0.85,
    fontFamily: theme.typography.label
  },
  lockedTeaserRow: {
    marginTop: 10,
    flexDirection: "row",
    gap: 10
  },
  lockedTeaserPane: {
    flex: 1,
    height: 110,
    borderRadius: theme.shape.cardRadiusMd,
    borderWidth: 2,
    borderColor: "#ffffff",
    backgroundColor: "rgba(246,240,232,0.98)",
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
    letterSpacing: 0.9,
    fontFamily: theme.typography.label
  },
  unlockText: {
    marginTop: 10,
    color: theme.colors.textSecondary
  }
});
