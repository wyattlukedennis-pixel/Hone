import { StyleSheet, View } from "react-native";

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
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.3)"
  },
  indicatorDotActive: {
    width: 26,
    borderRadius: 999,
    backgroundColor: "#0d63ff"
  }
});
