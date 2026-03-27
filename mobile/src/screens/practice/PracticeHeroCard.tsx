import { Animated, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

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
    <LinearGradient
      colors={["#172a44", "#14233b", "#0f1c31"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.heroCard}
    >
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
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    marginTop: 18,
    borderRadius: 28,
    backgroundColor: "#14243b",
    borderWidth: 1,
    borderColor: "rgba(151,194,247,0.38)",
    padding: 18,
    shadowColor: "#091a31",
    shadowOpacity: 0.32,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 11
  },
  heroOverline: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.9,
    fontWeight: "800",
    color: "#8ea7c8",
    fontFamily: theme.typography.heading
  },
  heroTitle: {
    marginTop: 4,
    fontSize: 32,
    lineHeight: 36,
    fontWeight: "800",
    color: "#f0f7ff",
    fontFamily: theme.typography.display
  },
  heroSubtitle: {
    marginTop: 6,
    fontSize: 16,
    lineHeight: 21,
    color: "#c1d5ef",
    fontWeight: "700",
    fontFamily: theme.typography.body
  },
  heroDayline: {
    marginTop: 4,
    color: "#6cc7ff",
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "800",
    fontFamily: theme.typography.heading
  },
  identityPill: {
    marginTop: 7,
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(117,198,255,0.56)",
    backgroundColor: "rgba(18,102,178,0.35)",
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  identityText: {
    color: "#def2ff",
    fontSize: 12,
    fontWeight: "800",
    fontFamily: theme.typography.heading
  },
  todayPrompt: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 19,
    color: "#b4cae7",
    fontWeight: "600",
    fontFamily: theme.typography.body
  },
  milestoneHintWrap: {
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: "rgba(255,255,255,0.08)"
  },
  milestoneHintWrapActive: {
    backgroundColor: "rgba(20,163,115,0.2)",
    borderWidth: 1,
    borderColor: "rgba(104,210,160,0.38)"
  },
  milestoneHint: {
    color: "#b4cae7",
    fontWeight: "600",
    fontSize: 13,
    lineHeight: 17,
    fontFamily: theme.typography.body
  }
});
