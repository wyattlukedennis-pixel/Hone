import { StyleSheet, Text, View } from "react-native";

import { GlassSurface } from "../../components/GlassSurface";
import { theme } from "../../theme";

type NextMilestone = {
  day: number;
  title: string;
  remainingDays: number;
};

type ProgressSummaryCardProps = {
  journeyTitle: string;
  didPracticeToday: boolean;
  dayCount: number;
  streak: number;
  nextMilestone: NextMilestone | null;
};

export function ProgressSummaryCard({ journeyTitle, didPracticeToday, dayCount, streak, nextMilestone }: ProgressSummaryCardProps) {
  return (
    <GlassSurface style={styles.summaryCard}>
      <Text style={styles.summaryJourney}>{journeyTitle}</Text>
      <Text style={styles.summaryCopy}>{didPracticeToday ? "You showed up today." : "Record today to keep your habit alive."}</Text>
      <View style={styles.summaryStats}>
        <View style={styles.summaryStat}>
          <Text style={styles.summaryStatLabel}>Day</Text>
          <Text style={styles.summaryStatValue}>{Math.max(dayCount, 1)}</Text>
        </View>
        <View style={styles.summaryStat}>
          <Text style={styles.summaryStatLabel}>Streak</Text>
          <Text style={styles.summaryStatValue}>{streak}d</Text>
        </View>
        <View style={styles.summaryStat}>
          <Text style={styles.summaryStatLabel}>Today</Text>
          <Text style={styles.summaryStatValue}>{didPracticeToday ? "Done" : "Open"}</Text>
        </View>
      </View>
      {nextMilestone ? (
        <Text style={styles.nextMilestoneText}>
          Next unlock: Day {nextMilestone.day} • {nextMilestone.title} ({nextMilestone.remainingDays} day
          {nextMilestone.remainingDays === 1 ? "" : "s"} to go)
        </Text>
      ) : (
        <Text style={styles.nextMilestoneText}>All milestones unlocked. Keep showing up and keep sharpening.</Text>
      )}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    marginTop: 14,
    borderRadius: theme.shape.cardRadiusLg,
    borderWidth: 2,
    borderColor: "#ffffff",
    backgroundColor: "rgba(246,240,232,0.98)",
    padding: 16
  },
  summaryJourney: {
    color: theme.colors.textPrimary,
    fontSize: 28,
    fontWeight: "800",
    fontFamily: theme.typography.display
  },
  summaryCopy: {
    marginTop: 8,
    color: theme.colors.textSecondary,
    fontSize: 18,
    fontWeight: "700",
    fontFamily: theme.typography.body
  },
  summaryStats: {
    marginTop: 12,
    flexDirection: "row",
    gap: 8
  },
  summaryStat: {
    flex: 1,
    borderRadius: theme.shape.cardRadiusMd,
    borderWidth: 2,
    borderColor: "#ffffff",
    backgroundColor: "rgba(241,233,221,0.94)",
    paddingVertical: 8,
    paddingHorizontal: 10
  },
  summaryStatLabel: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.85,
    fontFamily: theme.typography.label
  },
  summaryStatValue: {
    marginTop: 4,
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: "800"
  },
  nextMilestoneText: {
    marginTop: 12,
    color: theme.colors.textSecondary,
    fontWeight: "600"
  }
});
