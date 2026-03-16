import { StyleSheet, Text, View } from "react-native";

import { TactilePressable } from "../../components/TactilePressable";

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
    color: "#eef5ff",
    fontSize: 20,
    fontWeight: "800"
  },
  compareModalSubtitle: {
    marginTop: 2,
    color: "rgba(214,230,250,0.82)",
    fontSize: 12,
    fontWeight: "600"
  },
  compareModalClose: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 11,
    paddingVertical: 5
  },
  compareModalCloseDisabled: {
    opacity: 0.62
  },
  compareModalCloseText: {
    color: "#dceaff",
    fontWeight: "700",
    fontSize: 13
  }
});
