import { Animated, StyleSheet, Text, View } from "react-native";

import { theme } from "../../theme";
import { ActionButton } from "./ActionButton";

type NextMilestone = {
  day: number;
  title: string;
  remainingDays: number;
};

type PracticeHeroCardProps = {
  title: string;
  practicedToday: boolean;
  dayCount: number;
  streak: number;
  heroMessage: string;
  todayPrompt: string;
  statPulse: Animated.Value;
  milestonePulse: Animated.Value;
  milestoneFlash: boolean;
  nextMilestone: NextMilestone | null;
  onRecord: () => void;
};

export function PracticeHeroCard({
  title,
  practicedToday,
  dayCount,
  streak,
  heroMessage,
  todayPrompt,
  statPulse,
  milestonePulse,
  milestoneFlash,
  nextMilestone,
  onRecord
}: PracticeHeroCardProps) {
  return (
    <View style={styles.heroCard}>
      <Text style={styles.heroOverline}>Active Skill</Text>
      <Text style={styles.heroTitle}>{title}</Text>
      <Text style={styles.heroSubtitle} numberOfLines={2}>
        {heroMessage}
      </Text>

      <Animated.View style={[styles.heroStatsRow, { transform: [{ scale: statPulse }] }]}>
        <View style={styles.heroStatPill}>
          <Text style={styles.heroStatLabel}>Day</Text>
          <Text style={styles.heroStatValue}>{Math.max(dayCount, 1)}</Text>
        </View>
        <View style={styles.heroStatPill}>
          <Text style={styles.heroStatLabel}>Streak</Text>
          <Text style={styles.heroStatValue}>{streak} days</Text>
        </View>
        <View style={styles.heroStatPill}>
          <Text style={styles.heroStatLabel}>Today</Text>
          <Text style={styles.heroStatValue}>{practicedToday ? "Done" : "Open"}</Text>
        </View>
      </Animated.View>

      <ActionButton label={practicedToday ? "Record Again Today" : "Record Today"} variant="primary" fullWidth onPress={onRecord} />

      <Text style={styles.todayPrompt} numberOfLines={2}>
        {todayPrompt}
      </Text>

      <Animated.View
        style={[
          styles.milestoneHintWrap,
          milestoneFlash ? styles.milestoneHintWrapActive : undefined,
          { transform: [{ scale: milestonePulse }] }
        ]}
      >
        {nextMilestone ? (
          <Text style={styles.milestoneHint}>
            Next unlock: Day {nextMilestone.day} • {nextMilestone.title} ({nextMilestone.remainingDays} day
            {nextMilestone.remainingDays === 1 ? "" : "s"} to go)
          </Text>
        ) : (
          <Text style={styles.milestoneHint}>All current milestones unlocked. Keep showing up.</Text>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    marginTop: 18,
    borderRadius: 28,
    backgroundColor: "rgba(252,255,255,0.86)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.86)",
    padding: 18,
    shadowColor: "#113761",
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 7
  },
  heroOverline: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    fontWeight: "800",
    color: theme.colors.textSecondary
  },
  heroTitle: {
    marginTop: 4,
    fontSize: 31,
    lineHeight: 35,
    fontWeight: "800",
    color: theme.colors.textPrimary
  },
  heroSubtitle: {
    marginTop: 6,
    fontSize: 16,
    lineHeight: 21,
    color: theme.colors.textSecondary,
    fontWeight: "700"
  },
  heroStatsRow: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8
  },
  heroStatPill: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.72)",
    backgroundColor: "rgba(255,255,255,0.44)",
    paddingVertical: 7,
    paddingHorizontal: 10
  },
  heroStatLabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: "700"
  },
  heroStatValue: {
    marginTop: 2,
    color: theme.colors.textPrimary,
    fontWeight: "800"
  },
  todayPrompt: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 19,
    color: theme.colors.textSecondary,
    fontWeight: "600"
  },
  milestoneHintWrap: {
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: "rgba(255,255,255,0.34)"
  },
  milestoneHintWrapActive: {
    backgroundColor: "rgba(13,159,101,0.17)",
    borderWidth: 1,
    borderColor: "rgba(13,159,101,0.35)"
  },
  milestoneHint: {
    color: theme.colors.textSecondary,
    fontWeight: "600",
    fontSize: 13,
    lineHeight: 17
  }
});
