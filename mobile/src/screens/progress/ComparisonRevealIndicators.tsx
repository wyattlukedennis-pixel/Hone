import { StyleSheet, View } from "react-native";

import { theme } from "../../theme";

type ComparisonRevealIndicatorsProps = {
  keys: string[];
  activeIndex: number;
};

export function ComparisonRevealIndicators({ keys, activeIndex }: ComparisonRevealIndicatorsProps) {
  return (
    <View style={styles.indicatorRow}>
      {keys.map((key, index) => (
        <View key={`dot-${key}`} style={[styles.indicatorDot, index === activeIndex ? styles.indicatorDotActive : undefined]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  indicatorRow: {
    marginTop: 2,
    marginBottom: 0,
    alignSelf: "center",
    flexDirection: "row",
    gap: 7
  },
  indicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 0,
    borderWidth: 2,
    borderColor: "#ffffff",
    backgroundColor: "rgba(241,233,221,0.94)"
  },
  indicatorDotActive: {
    width: 28,
    borderRadius: 0,
    backgroundColor: theme.colors.accent,
    borderColor: "#ffffff"
  }
});
