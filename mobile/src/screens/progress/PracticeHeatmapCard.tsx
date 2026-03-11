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
    borderRadius: 22,
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
    fontWeight: "800"
  },
  heatmapMeta: {
    color: theme.colors.textSecondary,
    fontWeight: "700",
    fontSize: 12
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
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.34)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.42)"
  },
  heatmapCellActive: {
    backgroundColor: "rgba(13,159,101,0.75)",
    borderColor: "rgba(13,159,101,0.86)"
  },
  heatmapCellToday: {
    borderColor: "rgba(14,99,255,0.95)",
    borderWidth: 1.5
  },
  heatmapLegend: {
    marginTop: 10,
    color: theme.colors.textSecondary,
    fontWeight: "600"
  }
});
