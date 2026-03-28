import { useEffect, useState } from "react";
import { Alert, Linking, Modal, ScrollView, StyleSheet, Text, View } from "react-native";
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
import { clearOnboardingDraft } from "../storage/onboardingStorage";
import { hasRevealExportPurchase, purchaseRevealExport, resetPurchaseState } from "../utils/purchases";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
  onDeleteAccount: () => Promise<void>;
};

function formatOffsetLabel(offset: number) {
  if (offset === 0) return "live";
  if (offset > 0) return `+${offset} day${offset === 1 ? "" : "s"}`;
  const absolute = Math.abs(offset);
  return `-${absolute} day${absolute === 1 ? "" : "s"}`;
}

const PRIVACY_POLICY_URL = "https://wyattlukedennis-pixel.github.io/hone-legal/privacy.html";
const TERMS_OF_SERVICE_URL = "https://wyattlukedennis-pixel.github.io/hone-legal/terms.html";

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
  onDeleteAccount
}: SettingsScreenProps) {
  const insets = useSafeAreaInsets();
  const isDevToolsVisible = __DEV__ && devDateShiftSettings;
  const [clearingRecordings, setClearingRecordings] = useState(false);
  const [devMessage, setDevMessage] = useState<{ text: string; success: boolean } | null>(null);
  const [, setPendingUploadsCount] = useState(0);
  const [, setPendingUploadsLoading] = useState(true);
  const [timePickerOpen, setTimePickerOpen] = useState(false);

  async function resetOnboardingState() {
    await AsyncStorage.removeItem("hone.onboarding.complete.v1");
    await clearOnboardingDraft();
  }

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
      <Text style={styles.title}>profile</Text>
      <Text style={styles.subtitle}>account + daily cues</Text>

      <GlassSurface style={styles.card}>
        <Text style={styles.accountLabel}>account</Text>
        <Text style={styles.accountValue}>{user.email}</Text>
      </GlassSurface>

      <GlassSurface style={styles.card}>
        <Text style={styles.cardLabel}>daily cue</Text>
        <Text style={styles.cardValue}>{formatDailyMomentTime(dailyMomentSettings)} practice cue</Text>
        <Text style={styles.cardHint}>a nudge so you don't forget</Text>
        <View style={styles.reminderRow}>
          <Text style={styles.reminderLabel}>daily cue</Text>
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
              {dailyMomentSettings.enabled ? "on" : "off"}
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
            <Text style={styles.reminderAdjustText}>set cue time</Text>
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
              auto-open recorder
            </Text>
          </TactilePressable>
        </View>
      </GlassSurface>

      <GlassSurface style={styles.card}>
        <Text style={styles.cardLabel}>haptics</Text>
        <View style={styles.hapticsRow}>
          {(["standard", "subtle", "off"] as const).map((mode) => (
            <TactilePressable
              key={mode}
              style={[styles.hapticsChip, hapticsMode === mode ? styles.hapticsChipActive : undefined]}
              onPress={() => onHapticsModeChange(mode)}
            >
              <Text style={[styles.hapticsChipText, hapticsMode === mode ? styles.hapticsChipTextActive : undefined]}>
                {mode}
              </Text>
            </TactilePressable>
          ))}
        </View>
      </GlassSurface>

      <GlassSurface style={styles.card}>
        <Text style={styles.cardLabel}>legal</Text>
        <TactilePressable
          style={styles.legalRow}
          onPress={() => { void Linking.openURL(PRIVACY_POLICY_URL); }}
        >
          <Text style={styles.legalText}>privacy policy</Text>
        </TactilePressable>
        <TactilePressable
          style={styles.legalRow}
          onPress={() => { void Linking.openURL(TERMS_OF_SERVICE_URL); }}
        >
          <Text style={styles.legalText}>terms of service</Text>
        </TactilePressable>
      </GlassSurface>

      {isDevToolsVisible ? (
        <GlassSurface style={styles.card}>
          <Text style={styles.cardLabel}>dev tools</Text>
          <Text style={styles.cardValue}>date shift testing</Text>
          <Text style={styles.cardHint}>simulate future days so you can test milestones and comparisons in one sitting.</Text>

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
              <Text style={styles.devPresetButtonText}>simulate 30 takes</Text>
            </TactilePressable>
            <Text style={styles.devPresetHint}>record and save 30 takes. day offset advances after each save.</Text>
          </View>

          <View style={styles.devRow}>
            <Text style={styles.devRowLabel}>date shift</Text>
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
                {devDateShiftSettings.enabled ? "on" : "off"}
              </Text>
            </TactilePressable>
          </View>

          <Text style={styles.devOffsetLabel}>current shift: {formatOffsetLabel(devDateShiftSettings.dayOffset)}</Text>
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
            <Text style={styles.devRowLabel}>auto-step day after save</Text>
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
                {devDateShiftSettings.autoAdvanceAfterSave ? "on" : "off"}
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
            <Text style={styles.devResetText}>reset dev tools</Text>
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
            <Text style={styles.devDangerActionText}>{clearingRecordings ? "clearing..." : "clear all takes"}</Text>
          </TactilePressable>
          <TactilePressable
            style={styles.devDangerAction}
            onPress={async () => {
              await resetOnboardingState();
              await resetPurchaseState();
              setDevMessage({ text: "resetting... logging out now.", success: true });
              // Log out so the onboarding gate is visible on next launch
              setTimeout(() => { void onLogout(); }, 500);
            }}
          >
            <Text style={styles.devDangerActionText}>reset onboarding + paywall</Text>
          </TactilePressable>
          <TactilePressable
            style={[styles.devAction, hasRevealExportPurchase() ? styles.devActionActive : undefined]}
            onPress={async () => {
              if (hasRevealExportPurchase()) {
                await resetPurchaseState();
                setDevMessage({ text: "switched to free tier", success: true });
              } else {
                await purchaseRevealExport();
                setDevMessage({ text: "switched to paid tier", success: true });
              }
            }}
          >
            <Text style={styles.devActionText}>
              {hasRevealExportPurchase() ? "🟢 paid — tap to switch to free" : "⚪ free — tap to switch to paid"}
            </Text>
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
        <Text style={styles.logoutText}>{loggingOut ? "signing out..." : "sign out"}</Text>
      </TactilePressable>

      <TactilePressable
        style={styles.deleteAccountButton}
        onPress={() => {
          Alert.alert(
            "delete account?",
            "this will permanently delete your account and all your data. this cannot be undone.",
            [
              { text: "cancel", style: "cancel" },
              {
                text: "delete account",
                style: "destructive",
                onPress: () => { void onDeleteAccount(); },
              },
            ]
          );
        }}
      >
        <Text style={styles.deleteAccountText}>delete account</Text>
      </TactilePressable>

      <Modal visible={timePickerOpen} transparent animationType="slide" onRequestClose={() => setTimePickerOpen(false)}>
        <View style={styles.timePickerBackdrop}>
          <View style={StyleSheet.absoluteFill}>
            <TactilePressable style={StyleSheet.absoluteFill} onPress={() => setTimePickerOpen(false)} />
          </View>
          <View style={[styles.timePickerSheet, { paddingBottom: Math.max(18, insets.bottom + 10) }]}>
            <View style={styles.timePickerHeader}>
              <Text style={styles.timePickerTitle}>choose cue time</Text>
              <TactilePressable style={styles.timePickerDone} onPress={() => setTimePickerOpen(false)}>
                <Text style={styles.timePickerDoneText}>done</Text>
              </TactilePressable>
            </View>
            <Text style={styles.timePickerCurrent}>{formatDailyMomentTime(dailyMomentSettings)} daily cue</Text>
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
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.display
  },
  subtitle: {
    marginTop: 6,
    fontSize: 17,
    color: theme.colors.textSecondary,
    lineHeight: 22,
    fontFamily: theme.typography.body
  },
  card: {
    marginTop: 16,
    borderRadius: 24,
    padding: 16
  },
  accountLabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
    fontFamily: theme.typography.label
  },
  accountValue: {
    marginTop: 6,
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: "600",
    fontFamily: theme.typography.body
  },
  cardLabel: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    fontFamily: theme.typography.label
  },
  cardValue: {
    marginTop: 6,
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: "800",
    fontFamily: theme.typography.heading
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
    fontWeight: "700",
    fontFamily: theme.typography.label
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
    backgroundColor: "rgba(255,90,31,0.12)",
    borderColor: "rgba(255,90,31,0.35)"
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
    borderColor: "rgba(255,90,31,0.35)",
    backgroundColor: "rgba(255,90,31,0.10)"
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
    borderColor: "rgba(255,90,31,0.35)",
    backgroundColor: "rgba(255,90,31,0.10)",
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
    borderColor: "rgba(255,90,31,0.40)",
    backgroundColor: "rgba(255,90,31,0.12)"
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
    borderColor: "rgba(255,90,31,0.35)",
    backgroundColor: "rgba(255,90,31,0.10)",
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
    backgroundColor: "rgba(255,90,31,0.12)",
    borderColor: "rgba(255,90,31,0.35)"
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
  devAction: {
    marginTop: 10,
    alignSelf: "stretch",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(0,0,0,0.03)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  devActionActive: {
    borderColor: "rgba(232,69,10,0.3)",
    backgroundColor: "rgba(232,69,10,0.08)",
  },
  devActionText: {
    color: "#101010",
    fontWeight: "700",
    fontSize: 13,
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
  legalRow: {
    paddingVertical: 10,
  },
  legalText: {
    color: theme.colors.textSecondary,
    fontWeight: "600",
    fontSize: 14,
    textDecorationLine: "underline",
    fontFamily: theme.typography.body,
  },
  deleteAccountButton: {
    marginTop: 24,
    alignSelf: "flex-start",
    paddingVertical: 8,
  },
  deleteAccountText: {
    color: theme.colors.danger,
    fontWeight: "600",
    fontSize: 13,
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
    backgroundColor: "rgba(244,239,230,0.98)",
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
