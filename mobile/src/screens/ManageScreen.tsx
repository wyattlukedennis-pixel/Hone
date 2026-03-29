import { useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

import { TactilePressable } from "../components/TactilePressable";
import { theme } from "../theme";
import type { Clip } from "../types/clip";
import type { User } from "../types/auth";
import type { Journey } from "../types/journey";
import type { DailyMomentSettings } from "../types/dailyMoment";
import type { DevDateShiftSettings } from "../types/devTools";
import type { HapticsMode } from "../types/haptics";
import { triggerSelectionHaptic } from "../utils/feedback";
import { getChapterStreak, getDayCount } from "../utils/progress";
import { hasRevealExportPurchase } from "../utils/purchases";
import { SettingsScreen } from "./SettingsScreen";

export type ManageScreenProps = {
  journeys: Journey[];
  activeJourneyId: string | null;
  clipsByJourney: Record<string, Clip[]>;
  updatingId: string | null;
  onSetActive: (journeyId: string) => void;
  onEditJourney: (journeyId: string, payload: {
    title?: string;
    milestoneLengthDays?: number;
  }) => Promise<void>;
  onArchive: (journeyId: string) => void;
  onCreateJourney: (payload: {
    title: string;
    captureMode: "video" | "photo";
    milestoneLengthDays: number;
  }) => Promise<void>;
  creating: boolean;
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
  onDeleteAccount: () => Promise<void>;
  darkMode: boolean;
  onDarkModeChange: (next: boolean) => void;
};

export function ManageScreen({
  journeys,
  activeJourneyId,
  clipsByJourney,
  updatingId,
  onSetActive,
  onEditJourney,
  onArchive,
  onCreateJourney,
  creating,
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
  onDeleteAccount,
  darkMode,
  onDarkModeChange,
}: ManageScreenProps) {
  const insets = useSafeAreaInsets();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCaptureMode, setNewCaptureMode] = useState<"video" | "photo">("video");
  const [newMilestoneLengthDays, setNewMilestoneLengthDays] = useState(7);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editMilestoneLengthDays, setEditMilestoneLengthDays] = useState(7);
  const [editSaving, setEditSaving] = useState(false);

  const effectiveNow = (() => {
    if (!devDateShiftSettings?.enabled || !devDateShiftSettings.dayOffset) return new Date();
    const d = new Date();
    d.setDate(d.getDate() + devDateShiftSettings.dayOffset);
    return d;
  })();

  async function handleCreate() {
    const title = newTitle.trim();
    if (!title) return;
    triggerSelectionHaptic();
    await onCreateJourney({
      title,
      captureMode: newCaptureMode,
      milestoneLengthDays: newMilestoneLengthDays,
    });
    setNewTitle("");
    setNewCaptureMode("video");
    setNewMilestoneLengthDays(7);
    setShowCreateForm(false);
  }

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(124, insets.bottom + 96) }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <View style={styles.headerRail} />
            <Text style={[styles.title, darkMode ? { color: theme.darkColors.textPrimary } : null]}>manage</Text>
          </View>
          <TactilePressable
            style={[styles.settingsButton, darkMode && { borderColor: "rgba(255,255,255,0.1)" }]}
            onPress={() => {
              triggerSelectionHaptic();
              setSettingsOpen(true);
            }}
          >
            <LinearGradient
              colors={darkMode ? ["rgba(255,255,255,0.06)", "rgba(255,255,255,0.03)"] as [string, string] : theme.gradients.topControlGhost}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Text style={[styles.settingsButtonText, darkMode && { color: theme.darkColors.textSecondary }]}>settings</Text>
          </TactilePressable>
        </View>

        {/* Journey cards */}
        {journeys.length === 0 && !showCreateForm ? (
          <View style={[styles.emptyCard, darkMode && { borderColor: theme.darkColors.cardBorder }]}>
            <LinearGradient
              colors={darkMode ? theme.gradients.intelCardDark : theme.gradients.heroSurface}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Text style={[styles.emptyTitle, darkMode && { color: theme.darkColors.textPrimary }]}>no journeys yet</Text>
            <Text style={[styles.emptyBody, darkMode && { color: theme.darkColors.textSecondary }]}>tap below to start tracking your first skill.</Text>
          </View>
        ) : null}

        {[...journeys].sort((a, b) => {
          if (a.id === activeJourneyId) return -1;
          if (b.id === activeJourneyId) return 1;
          return 0;
        }).map((journey) => {
          const isActive = activeJourneyId === journey.id;
          const isBusy = updatingId === journey.id;
          const isEditing = editingId === journey.id;
          const journeyClips = clipsByJourney[journey.id] ?? [];
          const dayCount = getDayCount(journeyClips);
          const streak = getChapterStreak(journeyClips, { captureMode: journey.captureMode }, effectiveNow);
          const modeEmoji = journey.captureMode === "photo" ? "\uD83D\uDCF7" : "\uD83C\uDFA5";

          return (
            <View key={journey.id} style={[styles.card, isActive && styles.cardActive, darkMode ? { borderColor: isActive ? "rgba(255,90,31,0.25)" : theme.darkColors.cardBorder } : null]}>
              <LinearGradient
                colors={darkMode ? (isActive ? theme.gradients.intelCardDark : theme.gradients.intelCardDark) : isActive ? theme.gradients.heroSurface : ["rgba(246,240,232,0.5)", "rgba(246,240,232,0.35)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[StyleSheet.absoluteFill, { borderRadius: 20 }]}
              />
              {isActive ? <View style={styles.activeIndicator} /> : null}

              {/* Top row: title + emoji */}
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleArea}>
                  {isActive ? (
                    <Text style={styles.cardKicker}>active journey</Text>
                  ) : null}
                  <Text style={[isActive ? styles.cardTitleActive : styles.cardTitle, darkMode ? { color: theme.darkColors.textPrimary } : null]} numberOfLines={2}>{journey.title.toLowerCase()}</Text>
                </View>
                <Text style={styles.modeEmoji}>{modeEmoji}</Text>
              </View>

              {/* Stats row */}
              <View style={[styles.statsRow, darkMode && { backgroundColor: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.06)" }]}>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, isActive && styles.statValueActive, darkMode && { color: theme.darkColors.textPrimary }]}>{Math.max(dayCount, 1)}</Text>
                  <Text style={[styles.statLabel, isActive && styles.statLabelActive, darkMode && { color: theme.darkColors.textSecondary }]}>day</Text>
                </View>
                <View style={[styles.statDivider, darkMode && { backgroundColor: "rgba(255,255,255,0.1)" }]} />
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, isActive && styles.statValueActive, streak >= 7 ? styles.statValueHot : undefined, darkMode && streak < 7 && { color: theme.darkColors.textPrimary }]}>
                    {streak}
                  </Text>
                  <Text style={[styles.statLabel, isActive && styles.statLabelActive, darkMode && { color: theme.darkColors.textSecondary }]}>streak</Text>
                </View>
                <View style={[styles.statDivider, darkMode && { backgroundColor: "rgba(255,255,255,0.1)" }]} />
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, isActive && styles.statValueActive, darkMode && { color: theme.darkColors.textPrimary }]}>{journey.milestoneLengthDays}d</Text>
                  <Text style={[styles.statLabel, isActive && styles.statLabelActive, darkMode && { color: theme.darkColors.textSecondary }]}>chapter</Text>
                </View>
              </View>

              {isEditing ? (
                <View style={styles.editForm}>
                  <View style={styles.editSection}>
                    <Text style={[styles.fieldLabel, darkMode && { color: theme.darkColors.textSecondary }]}>title</Text>
                    <TextInput
                      style={[styles.input, darkMode && { backgroundColor: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.08)", color: theme.darkColors.textPrimary }]}
                      value={editTitle}
                      onChangeText={setEditTitle}
                      editable={!editSaving}
                      placeholderTextColor={darkMode ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.25)"}
                      autoFocus
                      autoCapitalize="none"
                      maxLength={120}
                    />
                  </View>
                  <View style={styles.editSection}>
                    <Text style={[styles.fieldLabel, darkMode && { color: theme.darkColors.textSecondary }]}>chapter length</Text>
                    <View style={styles.chipRow}>
                      {[7, 14, 30, 100].map((length) => {
                        const selected = editMilestoneLengthDays === length;
                        const locked = length > 7 && !hasRevealExportPurchase();
                        return (
                          <TactilePressable
                            key={length}
                            style={[
                              styles.chip,
                              selected ? styles.chipSelected : undefined,
                              locked ? styles.chipLocked : undefined,
                            ]}
                            onPress={() => {
                              if (locked) return;
                              triggerSelectionHaptic();
                              setEditMilestoneLengthDays(length);
                            }}
                          >
                            <Text style={[styles.chipText, selected ? styles.chipTextSelected : undefined, locked ? styles.chipTextLocked : undefined]}>
                              {locked ? `\uD83D\uDD12 ${length}d` : `${length}d`}
                            </Text>
                          </TactilePressable>
                        );
                      })}
                    </View>
                  </View>
                  <View style={styles.editActions}>
                    <TactilePressable
                      style={styles.editCancelButton}
                      onPress={() => {
                        triggerSelectionHaptic();
                        setEditingId(null);
                      }}
                    >
                      <Text style={styles.editCancelText}>cancel</Text>
                    </TactilePressable>
                    <TactilePressable
                      onPress={() => {
                        triggerSelectionHaptic();
                        const trimmed = editTitle.trim();
                        if (!trimmed) return;
                        const hasChanges =
                          trimmed !== journey.title ||
                          editMilestoneLengthDays !== journey.milestoneLengthDays;
                        if (!hasChanges) {
                          setEditingId(null);
                          return;
                        }
                        setEditSaving(true);
                        void onEditJourney(journey.id, {
                          title: trimmed !== journey.title ? trimmed : undefined,
                          milestoneLengthDays: editMilestoneLengthDays !== journey.milestoneLengthDays ? editMilestoneLengthDays : undefined,
                        }).then(() => {
                          setEditingId(null);
                        }).finally(() => {
                          setEditSaving(false);
                        });
                      }}
                      disabled={editSaving || !editTitle.trim()}
                    >
                      <LinearGradient
                        colors={theme.gradients.primaryAction}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.saveButton, (!editTitle.trim() || editSaving) && styles.buttonDisabled]}
                      >
                        <Text style={styles.saveButtonText}>{editSaving ? "saving..." : "save"}</Text>
                      </LinearGradient>
                    </TactilePressable>
                  </View>
                </View>
              ) : (
                <View style={styles.cardActions}>
                  {!isActive ? (
                    <TactilePressable
                      style={[styles.actionButton, isBusy ? styles.buttonDisabled : undefined]}
                      onPress={() => {
                        triggerSelectionHaptic();
                        onSetActive(journey.id);
                      }}
                      disabled={isBusy}
                    >
                      <LinearGradient
                        colors={theme.gradients.primaryAction}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[StyleSheet.absoluteFill, { borderRadius: 12 }]}
                      />
                      <Text style={styles.actionButtonTextPrimary}>set active</Text>
                    </TactilePressable>
                  ) : null}
                  <TactilePressable
                    style={[styles.actionButtonGhost, darkMode && { backgroundColor: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.1)" }, isBusy ? styles.buttonDisabled : undefined]}
                    onPress={() => {
                      triggerSelectionHaptic();
                      setEditingId(journey.id);
                      setEditTitle(journey.title);
                      setEditMilestoneLengthDays(journey.milestoneLengthDays);
                    }}
                    disabled={isBusy}
                  >
                    <Text style={[styles.actionButtonTextGhost, darkMode && { color: theme.darkColors.textSecondary }]}>edit</Text>
                  </TactilePressable>
                  <TactilePressable
                    style={[styles.actionButtonDanger, darkMode && { backgroundColor: "rgba(203,31,31,0.12)", borderColor: "rgba(203,31,31,0.2)" }, isBusy ? styles.buttonDisabled : undefined]}
                    onPress={() => {
                      triggerSelectionHaptic();
                      Alert.alert(
                        "delete journey?",
                        `this will permanently delete "${journey.title.toLowerCase()}" and all its recordings. you can't undo this.`,
                        [
                          { text: "cancel", style: "cancel" },
                          {
                            text: "delete",
                            style: "destructive",
                            onPress: () => onArchive(journey.id),
                          },
                        ]
                      );
                    }}
                    disabled={isBusy}
                  >
                    <Text style={styles.actionButtonTextDanger}>{isBusy ? "deleting..." : "delete"}</Text>
                  </TactilePressable>
                </View>
              )}
            </View>
          );
        })}

        {/* Create journey */}
        {showCreateForm ? (
          <View style={[styles.card, darkMode && { borderColor: theme.darkColors.cardBorder }]}>
            <LinearGradient
              colors={darkMode ? theme.gradients.intelCardDark : theme.gradients.heroSurface}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, { borderRadius: 20 }]}
            />
            <View style={styles.createFormHeader}>
              <View style={styles.headerRail} />
              <Text style={[styles.createFormTitle, darkMode && { color: theme.darkColors.textPrimary }]}>new journey</Text>
            </View>

            <View style={styles.editSection}>
              <Text style={[styles.fieldLabel, darkMode && { color: theme.darkColors.textSecondary }]}>what are you practicing?</Text>
              <TextInput
                style={[styles.input, darkMode && { backgroundColor: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.08)", color: theme.darkColors.textPrimary }]}
                placeholder="e.g., learning piano"
                value={newTitle}
                onChangeText={setNewTitle}
                editable={!creating}
                placeholderTextColor={darkMode ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.25)"}
                autoFocus
                autoCapitalize="none"
                maxLength={120}
              />
            </View>

            <View style={styles.editSection}>
              <Text style={[styles.fieldLabel, darkMode && { color: theme.darkColors.textSecondary }]}>capture mode</Text>
              <View style={styles.chipRow}>
                {([
                  { key: "video" as const, label: "\uD83C\uDFA5 video" },
                  { key: "photo" as const, label: "\uD83D\uDCF7 photo" },
                ] as const).map((option) => {
                  const selected = newCaptureMode === option.key;
                  return (
                    <TactilePressable
                      key={option.key}
                      style={[styles.chip, darkMode && !selected && { backgroundColor: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.08)" }, selected ? styles.chipSelected : undefined]}
                      onPress={() => {
                        triggerSelectionHaptic();
                        setNewCaptureMode(option.key);
                      }}
                    >
                      <Text style={[styles.chipText, darkMode && !selected && { color: theme.darkColors.textSecondary }, selected ? styles.chipTextSelected : undefined]}>{option.label}</Text>
                    </TactilePressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.editSection}>
              <Text style={[styles.fieldLabel, darkMode && { color: theme.darkColors.textSecondary }]}>first chapter length</Text>
              <View style={styles.chipRow}>
                {[7, 14, 30, 100].map((length) => {
                  const selected = newMilestoneLengthDays === length;
                  const locked = length > 7 && !hasRevealExportPurchase();
                  return (
                    <TactilePressable
                      key={length}
                      style={[
                        styles.chip,
                        selected ? styles.chipSelected : undefined,
                        locked ? styles.chipLocked : undefined,
                      ]}
                      onPress={() => {
                        if (locked) return;
                        triggerSelectionHaptic();
                        setNewMilestoneLengthDays(length);
                      }}
                    >
                      <Text style={[styles.chipText, selected ? styles.chipTextSelected : undefined, locked ? styles.chipTextLocked : undefined]}>
                        {locked ? `\uD83D\uDD12 ${length}d` : `${length}d`}
                      </Text>
                    </TactilePressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.editActions}>
              <TactilePressable
                style={styles.editCancelButton}
                onPress={() => {
                  triggerSelectionHaptic();
                  setShowCreateForm(false);
                  setNewTitle("");
                }}
              >
                <Text style={styles.editCancelText}>cancel</Text>
              </TactilePressable>
              <TactilePressable
                onPress={() => { void handleCreate(); }}
                disabled={creating || !newTitle.trim()}
              >
                <LinearGradient
                  colors={theme.gradients.primaryAction}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.saveButton, (!newTitle.trim() || creating) && styles.buttonDisabled]}
                >
                  <Text style={styles.saveButtonText}>{creating ? "creating..." : "create journey"}</Text>
                </LinearGradient>
              </TactilePressable>
            </View>
          </View>
        ) : (
          <TactilePressable
            style={[styles.newJourneyButton, darkMode && { borderColor: "rgba(255,255,255,0.06)" }]}
            onPress={() => {
              triggerSelectionHaptic();
              setShowCreateForm(true);
            }}
          >
            <LinearGradient
              colors={darkMode ? theme.gradients.intelCardDark : theme.gradients.heroSurface}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, { borderRadius: 16 }]}
            />
            <Text style={styles.newJourneyPlus}>+</Text>
            <Text style={[styles.newJourneyText, darkMode && { color: theme.darkColors.textSecondary }]}>new journey</Text>
          </TactilePressable>
        )}
      </ScrollView>

      {/* Settings Modal */}
      <Modal visible={settingsOpen} animationType="slide" transparent onRequestClose={() => setSettingsOpen(false)}>
        <View style={styles.settingsBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSettingsOpen(false)} />
          <View style={[styles.settingsSheet, { paddingBottom: Math.max(18, insets.bottom + 10) }, darkMode ? { backgroundColor: "rgba(20,18,16,0.98)", borderColor: "rgba(255,255,255,0.08)" } : null]}>
            <View style={styles.settingsCloseRow}>
              <TactilePressable style={[styles.settingsCloseButton, darkMode && { backgroundColor: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.12)" }]} onPress={() => {
                triggerSelectionHaptic();
                setSettingsOpen(false);
              }}>
                <Text style={[styles.settingsCloseText, darkMode && { color: theme.darkColors.textSecondary }]}>done</Text>
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
              onDeleteAccount={onDeleteAccount}
              darkMode={darkMode}
              onDarkModeChange={onDarkModeChange}
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
    paddingHorizontal: 18,
    paddingTop: 4,
    gap: 14,
  },
  // Header
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  headerRail: {
    width: 42,
    height: 4.5,
    borderRadius: 0,
    backgroundColor: theme.colors.accent,
    marginBottom: 6,
  },
  title: {
    fontSize: 38,
    fontWeight: "800",
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.display,
    letterSpacing: -0.5,
  },
  settingsButton: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    overflow: "hidden",
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  settingsButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: theme.colors.textSecondary,
    letterSpacing: 0.2,
    fontFamily: theme.typography.label,
  },
  // Empty state
  emptyCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    overflow: "hidden",
    padding: 24,
    alignItems: "center",
    gap: 6,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.display,
  },
  emptyBody: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.body,
    textAlign: "center",
  },
  // Journey card
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    overflow: "hidden",
    padding: 16,
    gap: 12,
  },
  cardActive: {
    borderColor: "rgba(255,90,31,0.2)",
    borderWidth: 1.5,
    padding: 20,
    gap: 16,
  },
  activeIndicator: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3.5,
    backgroundColor: theme.colors.accent,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  cardTitleArea: {
    flex: 1,
  },
  cardKicker: {
    fontSize: 11,
    fontWeight: "800",
    color: theme.colors.accent,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    fontFamily: theme.typography.label,
    marginBottom: 2,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.display,
    lineHeight: 24,
  },
  cardTitleActive: {
    fontSize: 28,
    fontWeight: "800",
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.display,
    lineHeight: 32,
  },
  modeEmoji: {
    fontSize: 20,
    marginTop: 2,
  },
  // Stats
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.03)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.04)",
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    gap: 1,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "800",
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.heading,
  },
  statValueActive: {
    fontSize: 22,
  },
  statValueHot: {
    color: theme.colors.accent,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.label,
    letterSpacing: 0.2,
    opacity: 0.6,
  },
  statLabelActive: {
    fontSize: 12,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: "rgba(0,0,0,0.08)",
  },
  // Card actions
  cardActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  actionButton: {
    borderRadius: 12,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    paddingHorizontal: 20,
  },
  actionButtonTextPrimary: {
    fontSize: 14,
    fontWeight: "800",
    color: "#fff",
    fontFamily: theme.typography.label,
    letterSpacing: 0.2,
  },
  actionButtonGhost: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(255,255,255,0.5)",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    paddingHorizontal: 20,
  },
  actionButtonTextGhost: {
    fontSize: 14,
    fontWeight: "800",
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.label,
    letterSpacing: 0.2,
  },
  actionButtonDanger: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(203,31,31,0.15)",
    backgroundColor: "rgba(203,31,31,0.06)",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    paddingHorizontal: 20,
  },
  actionButtonTextDanger: {
    fontSize: 14,
    fontWeight: "800",
    color: theme.colors.danger,
    fontFamily: theme.typography.label,
    letterSpacing: 0.2,
    opacity: 0.8,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  // Edit form
  editForm: {
    gap: 12,
  },
  editSection: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.textSecondary,
    letterSpacing: 0.3,
    textTransform: "uppercase",
    fontFamily: theme.typography.label,
    opacity: 0.6,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.6)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.body,
  },
  chipRow: {
    flexDirection: "row",
    gap: 8,
  },
  chip: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    backgroundColor: "rgba(255,255,255,0.5)",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipSelected: {
    borderColor: "rgba(255,90,31,0.4)",
    backgroundColor: "rgba(255,90,31,0.1)",
  },
  chipLocked: {
    opacity: 0.35,
  },
  chipText: {
    color: theme.colors.textSecondary,
    fontWeight: "800",
    fontSize: 13,
    fontFamily: theme.typography.label,
  },
  chipTextSelected: {
    color: theme.colors.accent,
  },
  chipTextLocked: {
    color: "rgba(0,0,0,0.25)",
  },
  editActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  editCancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  editCancelText: {
    color: theme.colors.textSecondary,
    fontWeight: "700",
    fontSize: 15,
    fontFamily: theme.typography.label,
    opacity: 0.7,
  },
  saveButton: {
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
    fontFamily: theme.typography.label,
    letterSpacing: 0.2,
  },
  // Create form
  createFormHeader: {
    gap: 4,
  },
  createFormTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.display,
  },
  // New journey button
  newJourneyButton: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 16,
  },
  newJourneyPlus: {
    fontSize: 22,
    fontWeight: "300",
    color: theme.colors.accent,
    marginTop: -1,
  },
  newJourneyText: {
    fontSize: 15,
    fontWeight: "800",
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.label,
    letterSpacing: 0.2,
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
