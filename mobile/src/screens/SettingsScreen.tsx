import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GlassSurface } from "../components/GlassSurface";
import { theme } from "../theme";
import type { User } from "../types/auth";
import type { DevDateShiftSettings } from "../types/devTools";

type SettingsScreenProps = {
  user: User;
  onLogout: () => Promise<void>;
  loggingOut: boolean;
  devDateShiftSettings: DevDateShiftSettings | null;
  onDevDateShiftSettingsChange: (next: DevDateShiftSettings) => void;
  onClearAllRecordings: () => Promise<{ success: boolean; message: string }>;
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
  devDateShiftSettings,
  onDevDateShiftSettingsChange,
  onClearAllRecordings
}: SettingsScreenProps) {
  const insets = useSafeAreaInsets();
  const isDevToolsVisible = __DEV__ && devDateShiftSettings;
  const [clearingRecordings, setClearingRecordings] = useState(false);
  const [devMessage, setDevMessage] = useState<{ text: string; success: boolean } | null>(null);

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
        <Text style={styles.cardValue}>7:00 PM Practice Prompt</Text>
        <Text style={styles.cardHint}>A gentle nudge to show up and keep your streak alive.</Text>
      </GlassSurface>

      {isDevToolsVisible ? (
        <GlassSurface style={styles.card}>
          <Text style={styles.cardLabel}>Dev Tools</Text>
          <Text style={styles.cardValue}>Date Shift Testing</Text>
          <Text style={styles.cardHint}>Simulate future days so you can test milestones and comparisons in one sitting.</Text>

          <View style={styles.devPresetRow}>
            <Pressable
              style={({ pressed }) => [styles.devPresetButton, pressed ? styles.pressed : undefined]}
              onPress={() =>
                onDevDateShiftSettingsChange({
                  enabled: true,
                  dayOffset: 0,
                  autoAdvanceAfterSave: true
                })
              }
            >
              <Text style={styles.devPresetButtonText}>Simulate 30 Days</Text>
            </Pressable>
            <Text style={styles.devPresetHint}>Record and save 30 clips. Day offset advances after each save.</Text>
          </View>

          <View style={styles.devRow}>
            <Text style={styles.devRowLabel}>Date shift mode</Text>
            <Pressable
              style={({ pressed }) => [
                styles.devToggle,
                devDateShiftSettings.enabled ? styles.devToggleOn : undefined,
                pressed ? styles.pressed : undefined
              ]}
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
            </Pressable>
          </View>

          <Text style={styles.devOffsetLabel}>Current offset: {formatOffsetLabel(devDateShiftSettings.dayOffset)}</Text>
          <View style={styles.devOffsetActions}>
            {[
              { label: "-7", value: -7 },
              { label: "-1", value: -1 },
              { label: "+1", value: 1 },
              { label: "+7", value: 7 }
            ].map((entry) => (
              <Pressable
                key={entry.label}
                style={({ pressed }) => [styles.devOffsetChip, pressed ? styles.pressed : undefined]}
                onPress={() =>
                  onDevDateShiftSettingsChange({
                    ...devDateShiftSettings,
                    dayOffset: Math.max(-365, Math.min(365, devDateShiftSettings.dayOffset + entry.value))
                  })
                }
              >
                <Text style={styles.devOffsetChipText}>{entry.label}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.devRow}>
            <Text style={styles.devRowLabel}>Auto-advance after save</Text>
            <Pressable
              style={({ pressed }) => [
                styles.devToggle,
                devDateShiftSettings.autoAdvanceAfterSave ? styles.devToggleOn : undefined,
                pressed ? styles.pressed : undefined
              ]}
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
            </Pressable>
          </View>

          <Pressable
            style={({ pressed }) => [styles.devReset, pressed ? styles.pressed : undefined]}
            onPress={() =>
              onDevDateShiftSettingsChange({
                enabled: false,
                dayOffset: 0,
                autoAdvanceAfterSave: false
              })
            }
          >
            <Text style={styles.devResetText}>Reset Dev Tools</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.devDangerAction,
              clearingRecordings ? styles.devDangerActionDisabled : undefined,
              pressed && !clearingRecordings ? styles.pressed : undefined
            ]}
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
          </Pressable>
          {devMessage ? <Text style={[styles.devMessage, devMessage.success ? styles.devMessageSuccess : styles.devMessageDanger]}>{devMessage.text}</Text> : null}
        </GlassSurface>
      ) : null}

      <Pressable
        style={[styles.logoutButton, loggingOut ? styles.logoutDisabled : undefined]}
        onPress={() => {
          void onLogout();
        }}
        disabled={loggingOut}
      >
        <Text style={styles.logoutText}>{loggingOut ? "Logging out..." : "Log out"}</Text>
      </Pressable>
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
    marginTop: 18,
    alignSelf: "flex-start",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(214,69,93,0.42)",
    backgroundColor: "rgba(214,69,93,0.12)",
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  logoutDisabled: {
    opacity: 0.65
  },
  logoutText: {
    color: theme.colors.danger,
    fontWeight: "700"
  },
  pressed: {
    transform: [{ scale: 0.98 }]
  }
});
