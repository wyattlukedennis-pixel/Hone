import { useEffect, useState } from "react";
import { Alert, Linking, Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  darkMode: boolean;
  onDarkModeChange: (next: boolean) => void;
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
  onDeleteAccount,
  darkMode,
  onDarkModeChange
}: SettingsScreenProps) {
  const insets = useSafeAreaInsets();
  const isDevToolsVisible = __DEV__ && devDateShiftSettings;
  const [clearingRecordings, setClearingRecordings] = useState(false);
  const [devMessage, setDevMessage] = useState<{ text: string; success: boolean } | null>(null);
  const [, setPendingUploadsCount] = useState(0);
  const [, setPendingUploadsLoading] = useState(true);
  const [timePickerOpen, setTimePickerOpen] = useState(false);

  const cardGradient = darkMode ? theme.gradients.intelCardDark : theme.gradients.heroSurface;
  const cardBorder = darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
  const textPrimary = darkMode ? theme.darkColors.textPrimary : theme.colors.textPrimary;
  const textSecondary = darkMode ? theme.darkColors.textSecondary : theme.colors.textSecondary;
  const chipBg = darkMode ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.5)";
  const chipBorder = darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)";

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

  function Card({ children }: { children: React.ReactNode }) {
    return (
      <View style={[styles.card, { borderColor: cardBorder }]}>
        <LinearGradient
          colors={cardGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: 20 }]}
        />
        {children}
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: Math.max(124, insets.bottom + 96) }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.title, { color: textPrimary }]}>profile</Text>
      <Text style={[styles.subtitle, { color: textSecondary }]}>account + daily cues</Text>

      {/* Account */}
      <Card>
        <Text style={[styles.cardLabel, { color: textSecondary }]}>account</Text>
        <Text style={[styles.cardValue, { color: textPrimary }]}>{user.email}</Text>
      </Card>

      {/* Daily cue */}
      <Card>
        <Text style={[styles.cardLabel, { color: textSecondary }]}>daily cue</Text>
        <Text style={[styles.cardValueLarge, { color: textPrimary }]}>{formatDailyMomentTime(dailyMomentSettings)} practice cue</Text>
        <Text style={[styles.cardHint, { color: textSecondary }]}>a nudge so you don't forget</Text>
        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: textPrimary }]}>daily cue</Text>
          <TactilePressable
            style={[styles.toggleChip, { backgroundColor: chipBg, borderColor: chipBorder }, dailyMomentSettings.enabled && styles.toggleChipActive]}
            onPress={() =>
              onDailyMomentSettingsChange({
                ...dailyMomentSettings,
                enabled: !dailyMomentSettings.enabled
              })
            }
          >
            <Text style={[styles.toggleChipText, { color: textSecondary }, dailyMomentSettings.enabled && styles.toggleChipTextActive]}>
              {dailyMomentSettings.enabled ? "on" : "off"}
            </Text>
          </TactilePressable>
        </View>
        <View style={styles.chipRow}>
          <TactilePressable
            style={[styles.chip, { backgroundColor: chipBg, borderColor: chipBorder }]}
            onPress={() => setTimePickerOpen(true)}
          >
            <Text style={[styles.chipText, { color: textSecondary }]}>set cue time</Text>
          </TactilePressable>
          <TactilePressable
            style={[styles.chip, { backgroundColor: chipBg, borderColor: chipBorder }, dailyMomentSettings.autoOpenRecorder && styles.chipActive]}
            onPress={() =>
              onDailyMomentSettingsChange({
                ...dailyMomentSettings,
                autoOpenRecorder: !dailyMomentSettings.autoOpenRecorder
              })
            }
          >
            <Text style={[styles.chipText, { color: textSecondary }, dailyMomentSettings.autoOpenRecorder && styles.chipTextActive]}>
              auto-open recorder
            </Text>
          </TactilePressable>
        </View>
      </Card>

      {/* Haptics */}
      <Card>
        <Text style={[styles.cardLabel, { color: textSecondary }]}>haptics</Text>
        <View style={styles.segmentRow}>
          {(["standard", "subtle", "off"] as const).map((mode) => {
            const active = hapticsMode === mode;
            return (
              <TactilePressable
                key={mode}
                style={[styles.segmentChip, { backgroundColor: chipBg, borderColor: chipBorder }, active && styles.segmentChipActive]}
                onPress={() => onHapticsModeChange(mode)}
              >
                <Text style={[styles.segmentChipText, { color: textSecondary }, active && styles.segmentChipTextActive]}>
                  {mode}
                </Text>
              </TactilePressable>
            );
          })}
        </View>
      </Card>

      {/* Appearance */}
      <Card>
        <Text style={[styles.cardLabel, { color: textSecondary }]}>appearance</Text>
        <View style={styles.segmentRow}>
          {(["light", "dark"] as const).map((mode) => {
            const active = (mode === "dark") === darkMode;
            return (
              <TactilePressable
                key={mode}
                style={[styles.segmentChip, { backgroundColor: chipBg, borderColor: chipBorder }, active && styles.segmentChipActive]}
                onPress={() => onDarkModeChange(mode === "dark")}
              >
                <Text style={[styles.segmentChipText, { color: textSecondary }, active && styles.segmentChipTextActive]}>
                  {mode}
                </Text>
              </TactilePressable>
            );
          })}
        </View>
      </Card>

      {/* Legal */}
      <Card>
        <Text style={[styles.cardLabel, { color: textSecondary }]}>legal</Text>
        <TactilePressable
          style={styles.legalRow}
          onPress={() => { void Linking.openURL(PRIVACY_POLICY_URL); }}
        >
          <Text style={[styles.legalText, { color: textSecondary }]}>privacy policy</Text>
        </TactilePressable>
        <TactilePressable
          style={styles.legalRow}
          onPress={() => { void Linking.openURL(TERMS_OF_SERVICE_URL); }}
        >
          <Text style={[styles.legalText, { color: textSecondary }]}>terms of service</Text>
        </TactilePressable>
      </Card>

      {isDevToolsVisible ? (
        <Card>
          <Text style={[styles.cardLabel, { color: textSecondary }]}>dev tools</Text>
          <Text style={[styles.cardValueLarge, { color: textPrimary }]}>date shift testing</Text>
          <Text style={[styles.cardHint, { color: textSecondary }]}>simulate future days so you can test milestones and comparisons in one sitting.</Text>

          <View style={{ marginTop: 12, gap: 8 }}>
            <TactilePressable
              style={styles.devAccentChip}
              onPress={() =>
                onDevDateShiftSettingsChange({
                  enabled: true,
                  dayOffset: 0,
                  autoAdvanceAfterSave: true
                })
              }
            >
              <Text style={styles.devAccentChipText}>simulate 30 takes</Text>
            </TactilePressable>
            <Text style={[styles.devHint, { color: textSecondary }]}>record and save 30 takes. day offset advances after each save.</Text>
          </View>

          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: textPrimary }]}>date shift</Text>
            <TactilePressable
              style={[styles.toggleChip, { backgroundColor: chipBg, borderColor: chipBorder }, devDateShiftSettings.enabled && styles.toggleChipActive]}
              onPress={() =>
                onDevDateShiftSettingsChange({
                  ...devDateShiftSettings,
                  enabled: !devDateShiftSettings.enabled
                })
              }
            >
              <Text style={[styles.toggleChipText, { color: textSecondary }, devDateShiftSettings.enabled && styles.toggleChipTextActive]}>
                {devDateShiftSettings.enabled ? "on" : "off"}
              </Text>
            </TactilePressable>
          </View>

          <Text style={[styles.devOffsetLabel, { color: textPrimary }]}>current shift: {formatOffsetLabel(devDateShiftSettings.dayOffset)}</Text>
          <View style={styles.chipRow}>
            {[
              { label: "-7", value: -7 },
              { label: "-1", value: -1 },
              { label: "+1", value: 1 },
              { label: "+7", value: 7 }
            ].map((entry) => (
              <TactilePressable
                key={entry.label}
                style={[styles.chip, { backgroundColor: chipBg, borderColor: chipBorder }]}
                onPress={() =>
                  onDevDateShiftSettingsChange({
                    ...devDateShiftSettings,
                    dayOffset: Math.max(-365, Math.min(365, devDateShiftSettings.dayOffset + entry.value))
                  })
                }
              >
                <Text style={[styles.chipText, { color: textSecondary }]}>{entry.label}</Text>
              </TactilePressable>
            ))}
          </View>

          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: textPrimary }]}>auto-step day after save</Text>
            <TactilePressable
              style={[styles.toggleChip, { backgroundColor: chipBg, borderColor: chipBorder }, devDateShiftSettings.autoAdvanceAfterSave && styles.toggleChipActive]}
              onPress={() =>
                onDevDateShiftSettingsChange({
                  ...devDateShiftSettings,
                  autoAdvanceAfterSave: !devDateShiftSettings.autoAdvanceAfterSave
                })
              }
            >
              <Text style={[styles.toggleChipText, { color: textSecondary }, devDateShiftSettings.autoAdvanceAfterSave && styles.toggleChipTextActive]}>
                {devDateShiftSettings.autoAdvanceAfterSave ? "on" : "off"}
              </Text>
            </TactilePressable>
          </View>

          <TactilePressable
            style={[styles.chip, { backgroundColor: chipBg, borderColor: chipBorder, alignSelf: "flex-start", marginTop: 4 }]}
            onPress={() =>
              onDevDateShiftSettingsChange({
                enabled: false,
                dayOffset: 0,
                autoAdvanceAfterSave: false
              })
            }
          >
            <Text style={[styles.chipText, { color: textSecondary }]}>reset dev tools</Text>
          </TactilePressable>

          <TactilePressable
            style={[styles.devDangerChip, clearingRecordings && { opacity: 0.6 }]}
            onPress={async () => {
              setClearingRecordings(true);
              setDevMessage(null);
              const result = await onClearAllRecordings();
              setDevMessage({ text: result.message, success: result.success });
              setClearingRecordings(false);
            }}
            disabled={clearingRecordings}
          >
            <Text style={styles.devDangerChipText}>{clearingRecordings ? "clearing..." : "clear all takes"}</Text>
          </TactilePressable>
          <TactilePressable
            style={styles.devDangerChip}
            onPress={async () => {
              await resetOnboardingState();
              await resetPurchaseState();
              setDevMessage({ text: "resetting... logging out now.", success: true });
              setTimeout(() => { void onLogout(); }, 500);
            }}
          >
            <Text style={styles.devDangerChipText}>reset onboarding + paywall</Text>
          </TactilePressable>
          <TactilePressable
            style={[styles.devAccentChip, hasRevealExportPurchase() && { borderColor: "rgba(232,69,10,0.4)", backgroundColor: "rgba(232,69,10,0.12)" }]}
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
            <Text style={[styles.devAccentChipText, { fontSize: 13 }]}>
              {hasRevealExportPurchase() ? "paid — tap to switch to free" : "free — tap to switch to paid"}
            </Text>
          </TactilePressable>
          {devMessage ? <Text style={[{ marginTop: 8, fontWeight: "600" }, devMessage.success ? { color: theme.colors.success } : { color: theme.colors.danger }]}>{devMessage.text}</Text> : null}
        </Card>
      ) : null}

      <TactilePressable
        style={[styles.logoutButton, { backgroundColor: chipBg, borderColor: chipBorder }, loggingOut && { opacity: 0.65 }]}
        onPress={() => { void onLogout(); }}
        disabled={loggingOut}
      >
        <Text style={[styles.logoutText, { color: textSecondary }]}>{loggingOut ? "signing out..." : "sign out"}</Text>
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
          <View style={[styles.timePickerSheet, { paddingBottom: Math.max(18, insets.bottom + 10) }, darkMode && { backgroundColor: "rgba(20,18,16,0.98)", borderColor: "rgba(255,255,255,0.08)" }]}>
            <View style={styles.timePickerHeader}>
              <Text style={[styles.timePickerTitle, { color: textPrimary }]}>choose cue time</Text>
              <TactilePressable
                style={[styles.toggleChip, { backgroundColor: chipBg, borderColor: chipBorder }]}
                onPress={() => setTimePickerOpen(false)}
              >
                <Text style={[styles.toggleChipText, { color: textSecondary }]}>done</Text>
              </TactilePressable>
            </View>
            <Text style={[styles.timePickerCurrent, { color: textSecondary }]}>{formatDailyMomentTime(dailyMomentSettings)} daily cue</Text>
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
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 8,
    gap: 14,
  },
  title: {
    fontSize: 38,
    fontWeight: "800",
    fontFamily: theme.typography.display,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 17,
    lineHeight: 22,
    fontFamily: theme.typography.body,
    marginTop: -6,
  },
  // Card
  card: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    padding: 20,
    gap: 8,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.3,
    textTransform: "uppercase",
    fontFamily: theme.typography.label,
  },
  cardValue: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: theme.typography.body,
  },
  cardValueLarge: {
    fontSize: 18,
    fontWeight: "800",
    fontFamily: theme.typography.heading,
  },
  cardHint: {
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
  },
  // Rows
  settingRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  settingLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    fontFamily: theme.typography.label,
  },
  // Toggle chip (on/off)
  toggleChip: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  toggleChipActive: {
    backgroundColor: "rgba(255,90,31,0.12)",
    borderColor: "rgba(255,90,31,0.35)",
  },
  toggleChipText: {
    fontWeight: "700",
    fontSize: 14,
  },
  toggleChipTextActive: {
    color: theme.colors.accentStrong,
  },
  // Generic chip
  chipRow: {
    marginTop: 4,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  chipActive: {
    borderColor: "rgba(255,90,31,0.35)",
    backgroundColor: "rgba(255,90,31,0.10)",
  },
  chipText: {
    fontWeight: "700",
    fontSize: 14,
    fontFamily: theme.typography.label,
  },
  chipTextActive: {
    color: theme.colors.accentStrong,
  },
  // Segment chips (full-width row like haptics/appearance)
  segmentRow: {
    marginTop: 6,
    flexDirection: "row",
    gap: 10,
  },
  segmentChip: {
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentChipActive: {
    borderColor: "rgba(255,90,31,0.40)",
    backgroundColor: "rgba(255,90,31,0.12)",
  },
  segmentChipText: {
    fontWeight: "700",
    fontSize: 15,
    fontFamily: theme.typography.label,
  },
  segmentChipTextActive: {
    color: theme.colors.accentStrong,
    fontWeight: "800",
  },
  // Legal
  legalRow: {
    paddingVertical: 6,
  },
  legalText: {
    fontWeight: "600",
    fontSize: 14,
    textDecorationLine: "underline",
    fontFamily: theme.typography.body,
  },
  // Dev tools
  devAccentChip: {
    alignSelf: "flex-start",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,90,31,0.35)",
    backgroundColor: "rgba(255,90,31,0.10)",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  devAccentChipText: {
    color: theme.colors.accentStrong,
    fontWeight: "800",
    fontSize: 14,
  },
  devHint: {
    fontSize: 12,
    fontWeight: "600",
  },
  devOffsetLabel: {
    marginTop: 6,
    fontWeight: "700",
    fontSize: 14,
  },
  devDangerChip: {
    marginTop: 4,
    alignSelf: "flex-start",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(214,69,93,0.35)",
    backgroundColor: "rgba(214,69,93,0.10)",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  devDangerChipText: {
    color: theme.colors.danger,
    fontWeight: "700",
    fontSize: 14,
  },
  // Logout / delete
  logoutButton: {
    alignSelf: "flex-start",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  logoutText: {
    fontWeight: "700",
    fontSize: 14,
  },
  deleteAccountButton: {
    alignSelf: "flex-start",
    paddingVertical: 8,
  },
  deleteAccountText: {
    color: theme.colors.danger,
    fontWeight: "600",
    fontSize: 13,
  },
  // Time picker
  timePickerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(7,14,24,0.38)",
    justifyContent: "flex-end",
  },
  timePickerSheet: {
    height: "88%",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.66)",
    backgroundColor: "rgba(244,239,230,0.98)",
    paddingTop: 16,
    paddingHorizontal: 20,
  },
  timePickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  timePickerTitle: {
    fontSize: 28,
    fontWeight: "800",
  },
  timePickerCurrent: {
    marginTop: 8,
    marginBottom: 8,
    fontWeight: "700",
    fontSize: 15,
  },
});
