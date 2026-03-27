import { StyleSheet, Text, View } from "react-native";

import { GlassSurface } from "../../components/GlassSurface";
import { theme } from "../../theme";

type HeatmapCell = {
  key: string;
  practiced: boolean;
  isToday: boolean;
};

type PracticeHeatmapCardProps = {
  heatmapWeeks: HeatmapCell[][];
  dayCount: number;
};

export function PracticeHeatmapCard({ heatmapWeeks, dayCount }: PracticeHeatmapCardProps) {
  return (
    <GlassSurface style={styles.heatmapCard}>
      <View style={styles.heatmapHeader}>
        <Text style={styles.heatmapTitle}>Practice Heatmap</Text>
        <Text style={styles.heatmapMeta}>Last 8 weeks</Text>
      </View>
      <View style={styles.heatmapGrid}>
        {heatmapWeeks.map((week, weekIndex) => (
          <View key={`week-${weekIndex}`} style={styles.heatmapWeekColumn}>
            {week.map((cell) => (
              <View
                key={cell.key}
                style={[
                  styles.heatmapCell,
                  cell.practiced ? styles.heatmapCellActive : undefined,
                  cell.isToday ? styles.heatmapCellToday : undefined
                ]}
              />
            ))}
          </View>
        ))}
      </View>
      <Text style={styles.heatmapLegend}>{dayCount} practice days logged. Keep the chain growing.</Text>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  heatmapCard: {
    marginTop: 14,
    borderRadius: theme.shape.cardRadiusLg,
    borderWidth: 2,
    borderColor: "#ffffff",
    backgroundColor: "rgba(246,240,232,0.98)",
    padding: 14
  },
  heatmapHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  heatmapTitle: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontWeight: "800",
    fontFamily: theme.typography.display
  },
  heatmapMeta: {
    color: theme.colors.textSecondary,
    fontWeight: "800",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.9,
    fontFamily: theme.typography.label
  },
  heatmapGrid: {
    marginTop: 10,
    flexDirection: "row",
    gap: 4
  },
  heatmapWeekColumn: {
    gap: 4
  },
  heatmapCell: {
    width: 12,
    height: 12,
    borderRadius: 0,
    backgroundColor: "rgba(241,233,221,0.96)",
    borderWidth: 1.5,
    borderColor: "#ffffff"
  },
  heatmapCellActive: {
    backgroundColor: "rgba(13,159,101,0.75)",
    borderColor: "#ffffff"
  },
  heatmapCellToday: {
    borderColor: theme.colors.accentStrong,
    borderWidth: 2
  },
  heatmapLegend: {
    marginTop: 10,
    color: theme.colors.textSecondary,
    fontWeight: "600"
  }
});
