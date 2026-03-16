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
  identityLabel: string;
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
  identityLabel,
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
      <Animated.View style={{ transform: [{ scale: statPulse }] }}>
        <Text style={styles.heroDayline}>
          Day {Math.max(dayCount, 1)} {streak > 0 ? `• ${streak}-day streak` : ""}
        </Text>
        <View style={styles.identityPill}>
          <Text style={styles.identityText}>{identityLabel}</Text>
        </View>
      </Animated.View>
      <Text style={styles.heroSubtitle} numberOfLines={2}>
        {heroMessage}
      </Text>

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
  heroDayline: {
    marginTop: 4,
    color: theme.colors.accentStrong,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "800"
  },
  identityPill: {
    marginTop: 7,
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(14,99,255,0.42)",
    backgroundColor: "rgba(14,99,255,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  identityText: {
    color: theme.colors.accentStrong,
    fontSize: 12,
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
