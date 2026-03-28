import { useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TactilePressable } from "../components/TactilePressable";
import { theme } from "../theme";
import type { Clip } from "../types/clip";
import type { User } from "../types/auth";
import type { Journey } from "../types/journey";
import type { DailyMomentSettings } from "../types/dailyMoment";
import type { DevDateShiftSettings } from "../types/devTools";
import type { HapticsMode } from "../types/haptics";
import { triggerSelectionHaptic } from "../utils/feedback";
import { getCurrentStreak, getDayCount } from "../utils/progress";
import { getSkillPackLabel } from "../utils/skillPack";
import { SettingsScreen } from "./SettingsScreen";

export type ManageScreenProps = {
  // Journey management (read-only list + set active)
  journeys: Journey[];
  activeJourneyId: string | null;
  clipsByJourney: Record<string, Clip[]>;
  updatingId: string | null;
  onSetActive: (journeyId: string) => void;
  onRecord: (journeyId: string) => void;
  onArchive: (journeyId: string) => void;
  onOpenCreateJourney: () => void;
  // Settings props
  user: User;
  onLogout: () => Promise<void>;
  loggingOut: boolean;
  devDateShiftSettings: DevDateShiftSettings | null;
  onDevDateShiftSettingsChange: (next: DevDateShiftSettings) => void;
  onClearAllRecordings: () => Promise<{ success: boolean; message: string }>;
  onGetPendingUploadsCount: () => Promise<number>;
  onRetryPendingUploads: () => Promise<{ success: boolean; message: string; remaining: number }>;
  dailyMomentSettings: DailyMomentSettings;
  onDailyMomentSettingsChange: (next: DailyMomentSettings) => void;
  hapticsMode: HapticsMode;
  onHapticsModeChange: (next: HapticsMode) => void;
};

export function ManageScreen({
  journeys,
  activeJourneyId,
  clipsByJourney,
  updatingId,
  onSetActive,
  onRecord,
  onArchive,
  onOpenCreateJourney,
  user,
  onLogout,
  loggingOut,
  devDateShiftSettings,
  onDevDateShiftSettingsChange,
  onClearAllRecordings,
  onGetPendingUploadsCount,
  onRetryPendingUploads,
  dailyMomentSettings,
  onDailyMomentSettingsChange,
  hapticsMode,
  onHapticsModeChange,
}: ManageScreenProps) {
  const insets = useSafeAreaInsets();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(124, insets.bottom + 96) }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>manage</Text>
          <TactilePressable
            style={styles.gearButton}
            onPress={() => {
              triggerSelectionHaptic();
              setSettingsOpen(true);
            }}
          >
            <Text style={styles.gearIcon}>{"⚙"}</Text>
          </TactilePressable>
        </View>

        {/* Journey list */}
        <Text style={styles.sectionKicker}>journeys</Text>

        {journeys.length === 0 ? (
          <Text style={styles.emptyText}>no journeys yet.</Text>
        ) : null}

        {journeys.map((journey) => {
          const isActive = activeJourneyId === journey.id;
          const isBusy = updatingId === journey.id;
          const journeyClips = clipsByJourney[journey.id] ?? [];
          const dayCount = getDayCount(journeyClips);
          const streak = getCurrentStreak(journeyClips);
          const badgeText = journey.title
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((chunk) => chunk[0]?.toUpperCase() ?? "")
            .join("") || "jr";

          return (
            <View key={journey.id} style={[styles.card, isActive ? styles.cardActive : undefined]}>
              <View style={styles.cardRow}>
                <View style={[styles.badge, isActive ? styles.badgeActive : undefined]}>
                  <Text style={[styles.badgeText, isActive ? styles.badgeTextActive : undefined]}>{badgeText}</Text>
                </View>

                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{journey.title.toLowerCase()}</Text>
                  <Text style={styles.cardMeta}>
                    {getSkillPackLabel(journey.skillPack).toLowerCase()} {"\u2022"} day {Math.max(dayCount, 1)} {"\u2022"} {streak}-day streak
                  </Text>

                  <View style={styles.actions}>
                    <TactilePressable
                      style={[
                        styles.actionPill,
                        isActive ? styles.actionPillActive : undefined,
                        (isActive || isBusy) ? styles.actionDisabled : undefined,
                      ]}
                      onPress={() => {
                        triggerSelectionHaptic();
                        onSetActive(journey.id);
                      }}
                      disabled={isActive || isBusy}
                    >
                      <Text style={[styles.actionLabel, isActive ? styles.actionLabelActive : undefined]}>
                        {isActive ? "active" : "set active"}
                      </Text>
                    </TactilePressable>

                    <TactilePressable
                      style={[styles.actionPillPrimary, isBusy ? styles.actionDisabled : undefined]}
                      onPress={() => {
                        triggerSelectionHaptic();
                        onRecord(journey.id);
                      }}
                      disabled={isBusy}
                    >
                      <Text style={styles.actionLabelPrimary}>record</Text>
                    </TactilePressable>

                    <TactilePressable
                      style={[styles.actionPillDanger, isBusy ? styles.actionDisabled : undefined]}
                      onPress={() => {
                        triggerSelectionHaptic();
                        Alert.alert(
                          "close journey?",
                          `this will archive "${journey.title.toLowerCase()}" and all its recordings. you can't undo this.`,
                          [
                            { text: "cancel", style: "cancel" },
                            {
                              text: "close journey",
                              style: "destructive",
                              onPress: () => onArchive(journey.id),
                            },
                          ]
                        );
                      }}
                      disabled={isBusy}
                    >
                      <Text style={styles.actionLabelDanger}>{isBusy ? "closing..." : "close"}</Text>
                    </TactilePressable>
                  </View>
                </View>
              </View>
            </View>
          );
        })}

        {/* Create new journey button */}
        <TactilePressable style={styles.createButton} onPress={() => {
          triggerSelectionHaptic();
          onOpenCreateJourney();
        }}>
          <Text style={styles.createButtonText}>+ new journey</Text>
        </TactilePressable>
      </ScrollView>

      {/* Settings Modal */}
      <Modal visible={settingsOpen} animationType="slide" transparent onRequestClose={() => setSettingsOpen(false)}>
        <View style={styles.settingsBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSettingsOpen(false)} />
          <View style={[styles.settingsSheet, { paddingBottom: Math.max(18, insets.bottom + 10) }]}>
            <View style={styles.settingsCloseRow}>
              <TactilePressable style={styles.settingsCloseButton} onPress={() => {
                triggerSelectionHaptic();
                setSettingsOpen(false);
              }}>
                <Text style={styles.settingsCloseText}>done</Text>
              </TactilePressable>
            </View>
            <SettingsScreen
              user={user}
              onLogout={onLogout}
              loggingOut={loggingOut}
              devDateShiftSettings={devDateShiftSettings}
              onDevDateShiftSettingsChange={onDevDateShiftSettingsChange}
              onClearAllRecordings={onClearAllRecordings}
              onGetPendingUploadsCount={onGetPendingUploadsCount}
              onRetryPendingUploads={onRetryPendingUploads}
              dailyMomentSettings={dailyMomentSettings}
              onDailyMomentSettingsChange={onDailyMomentSettingsChange}
              hapticsMode={hapticsMode}
              onHapticsModeChange={onHapticsModeChange}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 36,
    fontWeight: "800",
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.display,
  },
  gearButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  gearIcon: {
    fontSize: 24,
  },
  sectionKicker: {
    marginTop: 4,
    color: theme.colors.textSecondary,
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 0.15,
    fontFamily: theme.typography.label,
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.body,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    backgroundColor: "rgba(255,255,255,0.4)",
    padding: 12,
  },
  cardActive: {
    borderColor: "rgba(232,69,10,0.35)",
    backgroundColor: "rgba(232,69,10,0.08)",
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  badge: {
    width: 38,
    height: 38,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    backgroundColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeActive: {
    borderColor: "rgba(232,69,10,0.4)",
    backgroundColor: "rgba(232,69,10,0.1)",
  },
  badgeText: {
    color: theme.colors.textSecondary,
    fontWeight: "800",
    fontSize: 11,
    letterSpacing: 0.3,
  },
  badgeTextActive: {
    color: theme.colors.accent,
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.heading,
  },
  cardMeta: {
    marginTop: 2,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.body,
  },
  actions: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  actionPill: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    backgroundColor: "rgba(255,255,255,0.26)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionPillActive: {
    borderColor: "rgba(232,69,10,0.35)",
    backgroundColor: "rgba(232,69,10,0.08)",
  },
  actionPillPrimary: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.30)",
    backgroundColor: theme.colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionPillDanger: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(214,69,93,0.42)",
    backgroundColor: "rgba(214,69,93,0.12)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionLabel: {
    color: theme.colors.textSecondary,
    fontWeight: "700",
    fontSize: 13,
  },
  actionLabelActive: {
    color: theme.colors.accent,
  },
  actionLabelPrimary: {
    color: "#edf5ff",
    fontWeight: "800",
    fontSize: 13,
  },
  actionLabelDanger: {
    color: theme.colors.danger,
    fontWeight: "700",
    fontSize: 13,
  },
  actionDisabled: {
    opacity: 0.62,
  },
  createButton: {
    marginTop: 6,
    alignSelf: "flex-start",
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  createButtonText: {
    color: theme.colors.textSecondary,
    fontWeight: "800",
    fontSize: 15,
    fontFamily: theme.typography.label,
  },
  // Settings modal
  settingsBackdrop: {
    flex: 1,
    backgroundColor: "rgba(7,14,24,0.38)",
    justifyContent: "flex-end",
  },
  settingsSheet: {
    height: "92%",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.66)",
    backgroundColor: "rgba(244,239,230,0.98)",
    paddingTop: 12,
  },
  settingsCloseRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  settingsCloseButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.72)",
    backgroundColor: "rgba(255,255,255,0.34)",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  settingsCloseText: {
    color: theme.colors.textSecondary,
    fontWeight: "700",
  },
});
