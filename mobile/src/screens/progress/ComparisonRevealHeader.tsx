import { StyleSheet, Text, View } from "react-native";

import { TactilePressable } from "../../components/TactilePressable";
import { theme } from "../../theme";

type ComparisonRevealHeaderProps = {
  title: string;
  subtitle?: string | null;
  closing?: boolean;
  onClose: () => void;
};

export function ComparisonRevealHeader({ title, subtitle = null, closing = false, onClose }: ComparisonRevealHeaderProps) {
  return (
    <View style={styles.compareModalHeader}>
      <View style={styles.headerCopy}>
        <Text style={styles.compareModalTitle}>{title}</Text>
        {subtitle ? <Text style={styles.compareModalSubtitle}>{subtitle}</Text> : null}
      </View>
      <TactilePressable
        style={[styles.compareModalClose, closing ? styles.compareModalCloseDisabled : undefined]}
        pressScale={0.96}
        onPress={onClose}
        disabled={closing}
      >
        <Text style={styles.compareModalCloseText}>Done</Text>
      </TactilePressable>
    </View>
  );
}

const styles = StyleSheet.create({
  compareModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 14,
    paddingBottom: 2
  },
  headerCopy: {
    flex: 1
  },
  compareModalTitle: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontWeight: "800",
    fontFamily: theme.typography.display
  },
  compareModalSubtitle: {
    marginTop: 2,
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    fontFamily: theme.typography.body
  },
  compareModalClose: {
    borderRadius: theme.shape.pillRadius,
    borderWidth: 2,
    borderColor: "#ffffff",
    backgroundColor: "rgba(241,233,221,0.97)",
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  compareModalCloseDisabled: {
    opacity: 0.62
  },
  compareModalCloseText: {
    color: theme.colors.textPrimary,
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    fontFamily: theme.typography.label
  }
});
