import { Animated, StyleSheet, Text, View } from "react-native";

import { GlassSurface } from "../../components/GlassSurface";
import { theme } from "../../theme";

type MilestoneState = {
  day: number;
  title: string;
  unlocked: boolean;
  remainingDays: number;
};

type MilestonesCardProps = {
  milestonePreview: MilestoneState[];
  milestonesTotal: number;
  unlockedMilestones: number;
  recentlyUnlockedMilestoneDay: number | null;
  milestoneUnlockPulse: Animated.Value;
  milestoneUnlockGlow: Animated.Value;
  mode?: "full" | "next";
};

export function MilestonesCard({
  milestonePreview,
  milestonesTotal,
  unlockedMilestones,
  recentlyUnlockedMilestoneDay,
  milestoneUnlockPulse,
  milestoneUnlockGlow,
  mode = "full"
}: MilestonesCardProps) {
  const isNextMode = mode === "next";
  const isComplete = unlockedMilestones >= milestonesTotal;
  return (
    <GlassSurface style={styles.milestoneCard}>
      <View style={styles.milestoneHeader}>
        <Text style={styles.milestoneTitle}>{isNextMode ? (isComplete ? "Milestones complete" : "Next unlock") : "Milestones"}</Text>
        {!isNextMode ? (
          <Text style={styles.milestoneCount}>
            {unlockedMilestones}/{milestonesTotal} unlocked
          </Text>
        ) : null}
      </View>
      {milestonePreview.map((milestone) => (
        <Animated.View
          key={milestone.day}
          style={[
            styles.milestoneRow,
            milestone.day === recentlyUnlockedMilestoneDay
              ? {
                  transform: [{ scale: milestoneUnlockPulse }],
                  backgroundColor: milestoneUnlockGlow.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["rgba(255,255,255,0)", "rgba(13,159,101,0.18)"]
                  })
                }
              : undefined
          ]}
        >
          <View style={[styles.milestoneDot, milestone.unlocked ? styles.milestoneDotUnlocked : undefined]} />
          <View style={styles.milestoneBody}>
            <Text style={styles.milestoneRowTitle}>
              Day {milestone.day} • {milestone.title}
            </Text>
            <Text style={styles.milestoneRowText}>
              {milestone.day === recentlyUnlockedMilestoneDay
                ? "Unlocked now"
                : milestone.unlocked
                  ? "Unlocked"
                  : milestone.remainingDays <= 1
                    ? "Unlocks tomorrow"
                    : `${milestone.remainingDays} days remaining`}
            </Text>
          </View>
        </Animated.View>
      ))}
      {isNextMode ? (
        <Text style={styles.nextHintText}>
          {isComplete ? "You unlocked every current milestone. Keep showing up." : "Show up daily to unlock this moment faster."}
        </Text>
      ) : null}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  milestoneCard: {
    marginTop: 14,
    borderRadius: theme.shape.cardRadiusLg,
    borderWidth: 2,
    borderColor: "#ffffff",
    backgroundColor: "rgba(246,240,232,0.98)",
    padding: 14
  },
  milestoneHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  milestoneTitle: {
    color: theme.colors.textPrimary,
    fontSize: 24,
    fontWeight: "800",
    fontFamily: theme.typography.display
  },
  milestoneCount: {
    color: theme.colors.textSecondary,
    fontWeight: "800",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontFamily: theme.typography.label
  },
  milestoneRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 10,
    borderRadius: theme.shape.cardRadiusMd,
    borderWidth: 2,
    borderColor: "#ffffff",
    backgroundColor: "rgba(241,233,221,0.94)",
    paddingHorizontal: 8,
    paddingVertical: 8
  },
  milestoneDot: {
    marginTop: 3,
    width: 12,
    height: 12,
    borderRadius: 0,
    borderWidth: 2,
    borderColor: "#ffffff",
    backgroundColor: "rgba(241,233,221,0.95)"
  },
  milestoneDotUnlocked: {
    backgroundColor: theme.colors.success,
    borderColor: theme.colors.success
  },
  milestoneBody: {
    flex: 1
  },
  milestoneRowTitle: {
    color: theme.colors.textPrimary,
    fontWeight: "800"
  },
  milestoneRowText: {
    marginTop: 4,
    color: theme.colors.textSecondary
  },
  nextHintText: {
    marginTop: 10,
    color: theme.colors.textSecondary,
    fontWeight: "600",
    fontSize: 13
  },
});
