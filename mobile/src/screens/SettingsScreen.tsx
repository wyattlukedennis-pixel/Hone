import { useEffect, useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GlassSurface } from "../components/GlassSurface";
import { TactilePressable } from "../components/TactilePressable";
import { TimeWheelPicker } from "../components/TimeWheelPicker";
import { theme } from "../theme";
import type { User } from "../types/auth";
import type { DailyMomentSettings } from "../types/dailyMoment";
import type { DevDateShiftSettings } from "../types/devTools";
import type { HapticsMode } from "../types/haptics";
import { formatDailyMomentTime } from "../utils/dailyMoment";

type SettingsScreenProps = {
  user: User;
  onLogout: () => Promise<void>;
  loggingOut: boolean;
  dailyMomentSettings: DailyMomentSettings;
  onDailyMomentSettingsChange: (next: DailyMomentSettings) => void;
  hapticsMode: HapticsMode;
  onHapticsModeChange: (next: HapticsMode) => void;
  devDateShiftSettings: DevDateShiftSettings | null;
  onDevDateShiftSettingsChange: (next: DevDateShiftSettings) => void;
  onClearAllRecordings: () => Promise<{ success: boolean; message: string }>;
  onGetPendingUploadsCount: () => Promise<number>;
  onRetryPendingUploads: () => Promise<{ success: boolean; message: string; remaining: number }>;
};

function formatOffsetLabel(offset: number) {
  if (offset === 0) return "Today";
  if (offset > 0) return `+${offset} day${offset === 1 ? "" : "s"}`;
  const absolute = Math.abs(offset);
  return `-${absolute} day${absolute === 1 ? "" : "s"}`;
}

export function SettingsScreen({
  user,
  onLogout,
  loggingOut,
  dailyMomentSettings,
  onDailyMomentSettingsChange,
  hapticsMode,
  onHapticsModeChange,
  devDateShiftSettings,
  onDevDateShiftSettingsChange,
  onClearAllRecordings,
  onGetPendingUploadsCount,
  onRetryPendingUploads
}: SettingsScreenProps) {
  const insets = useSafeAreaInsets();
  const isDevToolsVisible = __DEV__ && devDateShiftSettings;
  const [clearingRecordings, setClearingRecordings] = useState(false);
  const [devMessage, setDevMessage] = useState<{ text: string; success: boolean } | null>(null);
  const [pendingUploadsCount, setPendingUploadsCount] = useState(0);
  const [pendingUploadsLoading, setPendingUploadsLoading] = useState(true);
  const [retryingUploads, setRetryingUploads] = useState(false);
  const [uploadsMessage, setUploadsMessage] = useState<{ text: string; success: boolean } | null>(null);
  const [timePickerOpen, setTimePickerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function refreshPendingUploads() {
      const count = await onGetPendingUploadsCount();
      if (cancelled) return;
      setPendingUploadsCount(count);
      setPendingUploadsLoading(false);
    }

    void refreshPendingUploads();
    const timer = setInterval(() => {
      void refreshPendingUploads();
    }, 10000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [onGetPendingUploadsCount]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: Math.max(124, insets.bottom + 96) }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.subtitle}>Account and daily practice preferences.</Text>

      <GlassSurface style={styles.card}>
        <Text style={styles.accountLabel}>Signed in as</Text>
        <Text style={styles.accountValue}>{user.email}</Text>
      </GlassSurface>

      <GlassSurface style={styles.card}>
        <Text style={styles.cardLabel}>Daily Reminder</Text>
        <Text style={styles.cardValue}>{formatDailyMomentTime(dailyMomentSettings)} Practice Prompt</Text>
        <Text style={styles.cardHint}>A gentle nudge to show up and keep your streak alive.</Text>
        <View style={styles.reminderRow}>
          <Text style={styles.reminderLabel}>Daily Moment</Text>
          <TactilePressable
            style={[styles.reminderToggle, dailyMomentSettings.enabled ? styles.reminderToggleOn : undefined]}
            onPress={() =>
              onDailyMomentSettingsChange({
                ...dailyMomentSettings,
                enabled: !dailyMomentSettings.enabled
              })
            }
          >
            <Text style={[styles.reminderToggleText, dailyMomentSettings.enabled ? styles.reminderToggleTextOn : undefined]}>
              {dailyMomentSettings.enabled ? "On" : "Off"}
            </Text>
          </TactilePressable>
        </View>
        <View style={styles.reminderAdjustRow}>
          <TactilePressable
            style={styles.reminderAdjustChip}
            onPress={() => {
              setTimePickerOpen(true);
            }}
          >
            <Text style={styles.reminderAdjustText}>Set reminder time</Text>
          </TactilePressable>
          <TactilePressable
            style={[styles.reminderAdjustChip, dailyMomentSettings.autoOpenRecorder ? styles.reminderAdjustChipActive : undefined]}
            onPress={() =>
              onDailyMomentSettingsChange({
                ...dailyMomentSettings,
                autoOpenRecorder: !dailyMomentSettings.autoOpenRecorder
              })
            }
          >
            <Text style={[styles.reminderAdjustText, dailyMomentSettings.autoOpenRecorder ? styles.reminderAdjustTextActive : undefined]}>
              Auto-open
            </Text>
          </TactilePressable>
        </View>
      </GlassSurface>

      <GlassSurface style={styles.card}>
        <Text style={styles.cardLabel}>Uploads</Text>
        <Text style={styles.cardValue}>{pendingUploadsLoading ? "Checking..." : `${pendingUploadsCount} pending`}</Text>
        <Text style={styles.cardHint}>
          {pendingUploadsCount > 0
            ? "Some clips are still syncing. You can retry now."
            : "All recorded clips are synced."}
        </Text>
        <View style={styles.uploadActions}>
          <TactilePressable
            style={[styles.uploadActionButton, retryingUploads ? styles.uploadActionButtonDisabled : undefined]}
            onPress={async () => {
              setRetryingUploads(true);
              setUploadsMessage(null);
              const result = await onRetryPendingUploads();
              setPendingUploadsCount(result.remaining);
              setUploadsMessage({ text: result.message, success: result.success });
              setRetryingUploads(false);
            }}
            disabled={retryingUploads}
          >
            <Text style={styles.uploadActionButtonText}>{retryingUploads ? "Retrying..." : "Retry now"}</Text>
          </TactilePressable>
          <TactilePressable
            style={styles.uploadRefreshButton}
            onPress={async () => {
              setPendingUploadsLoading(true);
              const count = await onGetPendingUploadsCount();
              setPendingUploadsCount(count);
              setPendingUploadsLoading(false);
            }}
          >
            <Text style={styles.uploadRefreshButtonText}>Refresh</Text>
          </TactilePressable>
        </View>
        {uploadsMessage ? (
          <Text style={[styles.uploadMessage, uploadsMessage.success ? styles.uploadMessageSuccess : styles.uploadMessageDanger]}>
            {uploadsMessage.text}
          </Text>
        ) : null}
      </GlassSurface>

      <GlassSurface style={styles.card}>
        <Text style={styles.cardLabel}>Haptics</Text>
        <Text style={styles.cardValue}>Touch feedback intensity</Text>
        <Text style={styles.cardHint}>Choose how strong taps and interaction cues should feel.</Text>
        <View style={styles.hapticsRow}>
          {[
            { key: "off" as const, label: "Off" },
            { key: "subtle" as const, label: "Subtle" },
            { key: "standard" as const, label: "Standard" }
          ].map((entry) => (
            <TactilePressable
              key={entry.key}
              style={[styles.hapticsChip, hapticsMode === entry.key ? styles.hapticsChipActive : undefined]}
              onPress={() => onHapticsModeChange(entry.key)}
            >
              <Text style={[styles.hapticsChipText, hapticsMode === entry.key ? styles.hapticsChipTextActive : undefined]}>
                {entry.label}
              </Text>
            </TactilePressable>
          ))}
        </View>
      </GlassSurface>

      {isDevToolsVisible ? (
        <GlassSurface style={styles.card}>
          <Text style={styles.cardLabel}>Dev Tools</Text>
          <Text style={styles.cardValue}>Date Shift Testing</Text>
          <Text style={styles.cardHint}>Simulate future days so you can test milestones and comparisons in one sitting.</Text>

          <View style={styles.devPresetRow}>
            <TactilePressable
              style={styles.devPresetButton}
              onPress={() =>
                onDevDateShiftSettingsChange({
                  enabled: true,
                  dayOffset: 0,
                  autoAdvanceAfterSave: true
                })
              }
            >
              <Text style={styles.devPresetButtonText}>Simulate 30 Days</Text>
            </TactilePressable>
            <Text style={styles.devPresetHint}>Record and save 30 clips. Day offset advances after each save.</Text>
          </View>

          <View style={styles.devRow}>
            <Text style={styles.devRowLabel}>Date shift mode</Text>
            <TactilePressable
              style={[styles.devToggle, devDateShiftSettings.enabled ? styles.devToggleOn : undefined]}
              onPress={() =>
                onDevDateShiftSettingsChange({
                  ...devDateShiftSettings,
                  enabled: !devDateShiftSettings.enabled
                })
              }
            >
              <Text style={[styles.devToggleText, devDateShiftSettings.enabled ? styles.devToggleTextOn : undefined]}>
                {devDateShiftSettings.enabled ? "On" : "Off"}
              </Text>
            </TactilePressable>
          </View>

          <Text style={styles.devOffsetLabel}>Current offset: {formatOffsetLabel(devDateShiftSettings.dayOffset)}</Text>
          <View style={styles.devOffsetActions}>
            {[
              { label: "-7", value: -7 },
              { label: "-1", value: -1 },
              { label: "+1", value: 1 },
              { label: "+7", value: 7 }
            ].map((entry) => (
              <TactilePressable
                key={entry.label}
                style={styles.devOffsetChip}
                onPress={() =>
                  onDevDateShiftSettingsChange({
                    ...devDateShiftSettings,
                    dayOffset: Math.max(-365, Math.min(365, devDateShiftSettings.dayOffset + entry.value))
                  })
                }
              >
                <Text style={styles.devOffsetChipText}>{entry.label}</Text>
              </TactilePressable>
            ))}
          </View>

          <View style={styles.devRow}>
            <Text style={styles.devRowLabel}>Auto-advance after save</Text>
            <TactilePressable
              style={[styles.devToggle, devDateShiftSettings.autoAdvanceAfterSave ? styles.devToggleOn : undefined]}
              onPress={() =>
                onDevDateShiftSettingsChange({
                  ...devDateShiftSettings,
                  autoAdvanceAfterSave: !devDateShiftSettings.autoAdvanceAfterSave
                })
              }
            >
              <Text style={[styles.devToggleText, devDateShiftSettings.autoAdvanceAfterSave ? styles.devToggleTextOn : undefined]}>
                {devDateShiftSettings.autoAdvanceAfterSave ? "On" : "Off"}
              </Text>
            </TactilePressable>
          </View>

          <TactilePressable
            style={styles.devReset}
            onPress={() =>
              onDevDateShiftSettingsChange({
                enabled: false,
                dayOffset: 0,
                autoAdvanceAfterSave: false
              })
            }
          >
            <Text style={styles.devResetText}>Reset Dev Tools</Text>
          </TactilePressable>

          <TactilePressable
            style={[styles.devDangerAction, clearingRecordings ? styles.devDangerActionDisabled : undefined]}
            onPress={async () => {
              setClearingRecordings(true);
              setDevMessage(null);
              const result = await onClearAllRecordings();
              setDevMessage({ text: result.message, success: result.success });
              setClearingRecordings(false);
            }}
            disabled={clearingRecordings}
          >
            <Text style={styles.devDangerActionText}>{clearingRecordings ? "Clearing..." : "Clear All Recordings"}</Text>
          </TactilePressable>
          {devMessage ? <Text style={[styles.devMessage, devMessage.success ? styles.devMessageSuccess : styles.devMessageDanger]}>{devMessage.text}</Text> : null}
        </GlassSurface>
      ) : null}

      <TactilePressable
        style={[styles.logoutButton, loggingOut ? styles.logoutDisabled : undefined]}
        onPress={() => {
          void onLogout();
        }}
        disabled={loggingOut}
      >
        <Text style={styles.logoutText}>{loggingOut ? "Logging out..." : "Log out"}</Text>
      </TactilePressable>

      <Modal visible={timePickerOpen} transparent animationType="slide" onRequestClose={() => setTimePickerOpen(false)}>
        <View style={styles.timePickerBackdrop}>
          <View style={StyleSheet.absoluteFill}>
            <TactilePressable style={StyleSheet.absoluteFill} onPress={() => setTimePickerOpen(false)} />
          </View>
          <View style={[styles.timePickerSheet, { paddingBottom: Math.max(18, insets.bottom + 10) }]}>
            <View style={styles.timePickerHeader}>
              <Text style={styles.timePickerTitle}>Choose reminder time</Text>
              <TactilePressable style={styles.timePickerDone} onPress={() => setTimePickerOpen(false)}>
                <Text style={styles.timePickerDoneText}>Done</Text>
              </TactilePressable>
            </View>
            <Text style={styles.timePickerCurrent}>{formatDailyMomentTime(dailyMomentSettings)} daily</Text>
            <TimeWheelPicker
              hour24={dailyMomentSettings.hour}
              minute={dailyMomentSettings.minute}
              disabled={!dailyMomentSettings.enabled}
              onChange={({ hour24, minute }) =>
                onDailyMomentSettingsChange({
                  ...dailyMomentSettings,
                  hour: hour24,
                  minute
                })
              }
            />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8
  },
  title: {
    fontSize: 36,
    fontWeight: "800",
    color: theme.colors.textPrimary
  },
  subtitle: {
    marginTop: 6,
    fontSize: 17,
    color: theme.colors.textSecondary
  },
  card: {
    marginTop: 16,
    borderRadius: 22,
    padding: 16
  },
  accountLabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: "700"
  },
  accountValue: {
    marginTop: 6,
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: "600"
  },
  cardLabel: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: "700"
  },
  cardValue: {
    marginTop: 6,
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: "800"
  },
  cardHint: {
    marginTop: 8,
    color: theme.colors.textSecondary
  },
  reminderRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  reminderLabel: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontWeight: "700"
  },
  reminderToggle: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.62)",
    backgroundColor: "rgba(255,255,255,0.3)",
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  reminderToggleOn: {
    backgroundColor: "rgba(14,99,255,0.16)",
    borderColor: "rgba(14,99,255,0.45)"
  },
  reminderToggleText: {
    color: theme.colors.textSecondary,
    fontWeight: "700"
  },
  reminderToggleTextOn: {
    color: theme.colors.accentStrong
  },
  reminderAdjustRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  reminderAdjustChip: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.66)",
    backgroundColor: "rgba(255,255,255,0.3)",
    paddingHorizontal: 11,
    paddingVertical: 6
  },
  reminderAdjustChipActive: {
    borderColor: "rgba(14,99,255,0.45)",
    backgroundColor: "rgba(14,99,255,0.14)"
  },
  reminderAdjustText: {
    color: theme.colors.textSecondary,
    fontWeight: "700",
    fontSize: 12
  },
  reminderAdjustTextActive: {
    color: theme.colors.accentStrong
  },
  uploadActions: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8
  },
  uploadActionButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(14,99,255,0.45)",
    backgroundColor: "rgba(14,99,255,0.14)",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  uploadActionButtonDisabled: {
    opacity: 0.6
  },
  uploadActionButtonText: {
    color: theme.colors.accentStrong,
    fontWeight: "800"
  },
  uploadRefreshButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.62)",
    backgroundColor: "rgba(255,255,255,0.22)",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  uploadRefreshButtonText: {
    color: theme.colors.textSecondary,
    fontWeight: "700"
  },
  uploadMessage: {
    marginTop: 8,
    fontWeight: "600"
  },
  uploadMessageSuccess: {
    color: theme.colors.success
  },
  uploadMessageDanger: {
    color: theme.colors.danger
  },
  hapticsRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 8
  },
  hapticsChip: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.68)",
    backgroundColor: "rgba(255,255,255,0.24)",
    paddingVertical: 9,
    alignItems: "center",
    justifyContent: "center"
  },
  hapticsChipActive: {
    borderColor: "rgba(14,99,255,0.52)",
    backgroundColor: "rgba(14,99,255,0.18)"
  },
  hapticsChipText: {
    color: theme.colors.textSecondary,
    fontWeight: "700",
    fontSize: 13
  },
  hapticsChipTextActive: {
    color: theme.colors.accentStrong,
    fontWeight: "800"
  },
  devRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  devPresetRow: {
    marginTop: 12,
    gap: 8
  },
  devPresetButton: {
    alignSelf: "flex-start",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(14,99,255,0.45)",
    backgroundColor: "rgba(14,99,255,0.14)",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  devPresetButtonText: {
    color: theme.colors.accentStrong,
    fontWeight: "800"
  },
  devPresetHint: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: "600"
  },
  devRowLabel: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontWeight: "600"
  },
  devToggle: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.62)",
    backgroundColor: "rgba(255,255,255,0.3)",
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  devToggleOn: {
    backgroundColor: "rgba(14,99,255,0.16)",
    borderColor: "rgba(14,99,255,0.45)"
  },
  devToggleText: {
    color: theme.colors.textSecondary,
    fontWeight: "700"
  },
  devToggleTextOn: {
    color: theme.colors.accentStrong
  },
  devOffsetLabel: {
    marginTop: 10,
    color: theme.colors.textPrimary,
    fontWeight: "700"
  },
  devOffsetActions: {
    marginTop: 8,
    flexDirection: "row",
    gap: 8
  },
  devOffsetChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.66)",
    backgroundColor: "rgba(255,255,255,0.35)",
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  devOffsetChipText: {
    color: theme.colors.textSecondary,
    fontWeight: "700"
  },
  devReset: {
    marginTop: 12,
    alignSelf: "flex-start",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.62)",
    backgroundColor: "rgba(255,255,255,0.24)",
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  devResetText: {
    color: theme.colors.textSecondary,
    fontWeight: "700"
  },
  devDangerAction: {
    marginTop: 10,
    alignSelf: "flex-start",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(214,69,93,0.45)",
    backgroundColor: "rgba(214,69,93,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  devDangerActionDisabled: {
    opacity: 0.6
  },
  devDangerActionText: {
    color: theme.colors.danger,
    fontWeight: "700"
  },
  devMessage: {
    marginTop: 8,
    fontWeight: "600"
  },
  devMessageSuccess: {
    color: theme.colors.success
  },
  devMessageDanger: {
    color: theme.colors.danger
  },
  logoutButton: {
    marginTop: 14,
    alignSelf: "flex-start",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.52)",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  logoutDisabled: {
    opacity: 0.65
  },
  logoutText: {
    color: theme.colors.tabText,
    fontWeight: "600",
    fontSize: 13
  },
  timePickerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(7,14,24,0.38)",
    justifyContent: "flex-end"
  },
  timePickerSheet: {
    height: "88%",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.66)",
    backgroundColor: "rgba(226,236,248,0.98)",
    paddingTop: 16,
    paddingHorizontal: 20
  },
  timePickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  timePickerTitle: {
    color: theme.colors.textPrimary,
    fontSize: 28,
    fontWeight: "800"
  },
  timePickerDone: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.72)",
    backgroundColor: "rgba(255,255,255,0.34)",
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  timePickerDoneText: {
    color: theme.colors.textSecondary,
    fontWeight: "700"
  },
  timePickerCurrent: {
    marginTop: 8,
    marginBottom: 8,
    color: theme.colors.textSecondary,
    fontWeight: "700",
    fontSize: 15
  }
});
