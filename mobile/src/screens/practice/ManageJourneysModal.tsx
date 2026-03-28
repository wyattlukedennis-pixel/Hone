import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";


import { GlassSurface } from "../../components/GlassSurface";
import { theme } from "../../theme";
import type { Clip } from "../../types/clip";
import type { Journey } from "../../types/journey";
import { triggerSelectionHaptic } from "../../utils/feedback";
import { hasRevealExportPurchase } from "../../utils/purchases";
import { getCurrentStreak, getDayCount } from "../../utils/progress";
import { getSkillPackLabel, skillPackOptions } from "../../utils/skillPack";
import { ActionButton } from "./ActionButton";
import {
  PRACTICE_MODAL_BACKDROP,
  PRACTICE_MODAL_DONE_BORDER,
  PRACTICE_MODAL_DONE_FILL,
  PRACTICE_MODAL_EDGE_PADDING,
  PRACTICE_MODAL_PADDING,
  PRACTICE_MODAL_RADIUS
} from "./modalTokens";

type ManageJourneysModalProps = {
  visible: boolean;
  journeys: Journey[];
  activeJourneyId: string | null;
  clipsByJourney: Record<string, Clip[]>;
  creating: boolean;
  refreshing: boolean;
  updatingId: string | null;
  newTitle: string;
  newCategory: string;
  newGoalText: string;
  newMilestoneLengthDays: number;
  newCaptureMode: "video" | "photo";
  newSkillPack: "fitness" | "drawing" | "instrument";
  onTitleChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onGoalTextChange: (value: string) => void;
  onMilestoneLengthChange: (value: number) => void;
  onCaptureModeChange: (value: "video" | "photo") => void;
  onSkillPackChange: (value: "fitness" | "drawing" | "instrument") => void;
  onClose: () => void;
  onCreateJourney: () => void;
  onRefresh: () => void;
  onSetActive: (journeyId: string) => void;
  onRecord: (journeyId: string) => void;
  onArchive: (journeyId: string) => void;
};

export function ManageJourneysModal({
  visible,
  journeys,
  activeJourneyId,
  clipsByJourney,
  creating,
  refreshing,
  updatingId,
  newTitle,
  newCategory,
  newGoalText,
  newMilestoneLengthDays,
  newCaptureMode,
  newSkillPack,
  onTitleChange,
  onCategoryChange,
  onGoalTextChange,
  onMilestoneLengthChange,
  onCaptureModeChange,
  onSkillPackChange,
  onClose,
  onCreateJourney,
  onRefresh,
  onSetActive,
  onRecord,
  onArchive
}: ManageJourneysModalProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <GlassSurface style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>manage journey</Text>
            <Pressable
              style={({ pressed }) => [styles.doneButton, pressed ? styles.pressed : undefined]}
              onPress={() => {
                triggerSelectionHaptic();
                onClose();
              }}
            >
              <Text style={styles.doneText}>done</Text>
            </Pressable>
          </View>
          <Text style={styles.subtitle}>create or switch your active skill.</Text>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.createCard}>
              <Text style={styles.sectionKicker}>create</Text>
              <Text style={styles.sectionTitle}>start new journey</Text>
              <Text style={styles.milestoneLabel}>choose first reveal window</Text>
              <View style={styles.milestoneRow}>
                {[7, 14, 30, 100].map((length) => {
                  const selected = newMilestoneLengthDays === length;
                  const locked = length > 7 && !hasRevealExportPurchase();
                  return (
                    <Pressable
                      key={length}
                      style={({ pressed }) => [
                        styles.milestoneChip,
                        selected ? styles.milestoneChipSelected : undefined,
                        locked ? styles.milestoneChipLocked : undefined,
                        pressed ? styles.pressed : undefined
                      ]}
                      onPress={() => {
                        if (locked) return;
                        triggerSelectionHaptic();
                        onMilestoneLengthChange(length);
                      }}
                    >
                      <Text style={[styles.milestoneChipText, selected ? styles.milestoneChipTextSelected : undefined, locked ? styles.milestoneChipTextLocked : undefined]}>
                        {locked ? `🔒 ${length}d` : `${length}d`}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.captureModeLabel}>capture mode</Text>
              <View style={styles.captureModeRow}>
                {[
                  { key: "video" as const, label: "video" },
                  { key: "photo" as const, label: "photo" }
                ].map((option) => {
                  const selected = newCaptureMode === option.key;
                  return (
                    <Pressable
                      key={option.key}
                      style={({ pressed }) => [
                        styles.captureModeChip,
                        selected ? styles.captureModeChipSelected : undefined,
                        pressed ? styles.pressed : undefined
                      ]}
                      onPress={() => {
                        triggerSelectionHaptic();
                        onCaptureModeChange(option.key);
                      }}
                    >
                      <Text style={[styles.captureModeChipText, selected ? styles.captureModeChipTextSelected : undefined]}>{option.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.captureModeLabel}>skill pack</Text>
              <View style={styles.captureModeRow}>
                {skillPackOptions.map((option) => {
                  const selected = newSkillPack === option.key;
                  return (
                    <Pressable
                      key={option.key}
                      style={({ pressed }) => [
                        styles.captureModeChip,
                        selected ? styles.captureModeChipSelected : undefined,
                        pressed ? styles.pressed : undefined
                      ]}
                      onPress={() => {
                        triggerSelectionHaptic();
                        onSkillPackChange(option.key);
                      }}
                    >
                      <Text style={[styles.captureModeChipText, selected ? styles.captureModeChipTextSelected : undefined]}>{option.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <TextInput
                style={styles.input}
                placeholder="title (e.g., learning piano)"
                value={newTitle}
                onChangeText={onTitleChange}
                editable={!creating}
                placeholderTextColor="rgba(0,0,0,0.25)"
              />
              <TextInput
                style={styles.input}
                placeholder="category (optional)"
                value={newCategory}
                onChangeText={onCategoryChange}
                editable={!creating}
                placeholderTextColor="rgba(0,0,0,0.25)"
              />
              <TextInput
                style={[styles.input, styles.goalInput]}
                placeholder="goal (optional)"
                value={newGoalText}
                onChangeText={onGoalTextChange}
                editable={!creating}
                multiline
                placeholderTextColor="rgba(0,0,0,0.25)"
              />
              <ActionButton
                label="create journey"
                loadingLabel="creating..."
                variant="primary"
                fullWidth
                onPress={onCreateJourney}
                disabled={creating}
                loading={creating}
              />
            </View>

            <View style={styles.listHeader}>
              <View>
                <Text style={styles.sectionKicker}>switch</Text>
                <Text style={styles.switchTitle}>choose active journey</Text>
              </View>
              <ActionButton label="refresh" loading={refreshing} loadingLabel="refreshing..." onPress={onRefresh} />
            </View>

            {journeys.length === 0 ? <Text style={styles.mutedText}>no journeys yet.</Text> : null}

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
                <View key={journey.id} style={[styles.row, isActive ? styles.rowActive : undefined]}>
                  <View style={[styles.rowBadge, isActive ? styles.rowBadgeActive : undefined]}>
                    <Text style={[styles.rowBadgeText, isActive ? styles.rowBadgeTextActive : undefined]}>{badgeText}</Text>
                  </View>

                  <View style={styles.rowBody}>
                    <Text style={styles.rowTitle}>{journey.title.toLowerCase()}</Text>
                    <Text style={styles.rowMeta}>
                      {getSkillPackLabel(journey.skillPack).toLowerCase()} • day {Math.max(dayCount, 1)} • {streak}-day streak
                    </Text>

                    <View style={styles.rowActions}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.actionPill,
                          isActive ? styles.actionPillActive : undefined,
                          pressed ? styles.pressed : undefined,
                          (isActive || isBusy) ? styles.actionDisabled : undefined
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
                      </Pressable>

                      <Pressable
                        style={({ pressed }) => [styles.actionPillPrimary, pressed ? styles.pressed : undefined, isBusy ? styles.actionDisabled : undefined]}
                        onPress={() => {
                          triggerSelectionHaptic();
                          onRecord(journey.id);
                        }}
                        disabled={isBusy}
                      >
                        <Text style={styles.actionLabelPrimary}>record</Text>
                      </Pressable>

                      <Pressable
                        style={({ pressed }) => [styles.actionPillDanger, pressed ? styles.pressed : undefined, isBusy ? styles.actionDisabled : undefined]}
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
                      </Pressable>
                    </View>
                  </View>

                  <Text style={styles.rowChevron}>{">"}</Text>
                </View>
              );
            })}
          </ScrollView>
        </GlassSurface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: PRACTICE_MODAL_BACKDROP,
    justifyContent: "flex-end",
    paddingHorizontal: PRACTICE_MODAL_EDGE_PADDING,
    paddingBottom: PRACTICE_MODAL_EDGE_PADDING
  },
  sheet: {
    borderRadius: PRACTICE_MODAL_RADIUS,
    maxHeight: "95%",
    padding: PRACTICE_MODAL_PADDING
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 24,
    fontWeight: "800",
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 6,
    color: theme.colors.textSecondary,
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 0.15
  },
  doneButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: PRACTICE_MODAL_DONE_BORDER,
    backgroundColor: PRACTICE_MODAL_DONE_FILL,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  doneText: {
    color: theme.colors.textSecondary,
    fontWeight: "700"
  },
  scrollContent: {
    paddingBottom: 60,
    gap: 10
  },
  createCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.68)",
    backgroundColor: "rgba(255,255,255,0.30)",
    padding: 12
  },
  sectionKicker: {
    color: theme.colors.textSecondary,
    fontWeight: "700",
    fontSize: 11,
    letterSpacing: 0.15
  },
  sectionTitle: {
    marginTop: 2,
    fontSize: 22,
    fontWeight: "800",
    color: theme.colors.textPrimary
  },
  milestoneLabel: {
    marginTop: 10,
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.15
  },
  milestoneRow: {
    marginTop: 8,
    flexDirection: "row",
    gap: 8
  },
  milestoneChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.72)",
    backgroundColor: "rgba(255,255,255,0.24)",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  milestoneChipSelected: {
    borderColor: "rgba(232,69,10,0.5)",
    backgroundColor: "rgba(232,69,10,0.1)"
  },
  milestoneChipText: {
    color: theme.colors.textSecondary,
    fontWeight: "800",
    fontSize: 12
  },
  milestoneChipTextSelected: {
    color: theme.colors.accent
  },
  milestoneChipLocked: {
    opacity: 0.4,
  },
  milestoneChipTextLocked: {
    color: "rgba(0,0,0,0.25)",
  },
  captureModeLabel: {
    marginTop: 10,
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.15
  },
  captureRuleLabel: {
    marginTop: 10,
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.15
  },
  captureModeRow: {
    marginTop: 8,
    flexDirection: "row",
    gap: 8
  },
  captureModeChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.72)",
    backgroundColor: "rgba(255,255,255,0.24)",
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  captureModeChipSelected: {
    borderColor: "rgba(232,69,10,0.5)",
    backgroundColor: "rgba(232,69,10,0.1)"
  },
  captureModeChipText: {
    color: theme.colors.textSecondary,
    fontWeight: "800",
    fontSize: 12
  },
  captureModeChipTextSelected: {
    color: theme.colors.accent
  },
  input: {
    marginTop: 12,
    backgroundColor: "rgba(255,255,255,0.52)",
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.66)",
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: theme.colors.textPrimary
  },
  goalInput: {
    minHeight: 72,
    textAlignVertical: "top"
  },
  listHeader: {
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10
  },
  switchTitle: {
    marginTop: 2,
    fontSize: 20,
    fontWeight: "800",
    color: theme.colors.textPrimary
  },
  mutedText: {
    marginTop: 4,
    color: theme.colors.textSecondary
  },
  row: {
    marginTop: 2,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.66)",
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: "rgba(255,255,255,0.32)",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10
  },
  rowActive: {
    backgroundColor: "rgba(232,69,10,0.08)",
    borderColor: "rgba(232,69,10,0.35)"
  },
  rowBadge: {
    width: 38,
    height: 38,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.70)",
    backgroundColor: "rgba(255,255,255,0.30)",
    alignItems: "center",
    justifyContent: "center"
  },
  rowBadgeActive: {
    borderColor: "rgba(232,69,10,0.4)",
    backgroundColor: "rgba(232,69,10,0.1)"
  },
  rowBadgeText: {
    color: theme.colors.textSecondary,
    fontWeight: "800",
    fontSize: 11,
    letterSpacing: 0.3
  },
  rowBadgeTextActive: {
    color: theme.colors.accent
  },
  rowBody: {
    flex: 1
  },
  rowTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: theme.colors.textPrimary
  },
  rowMeta: {
    marginTop: 2,
    color: theme.colors.textSecondary
  },
  rowActions: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap"
  },
  actionPill: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.74)",
    backgroundColor: "rgba(255,255,255,0.26)",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  actionPillActive: {
    borderColor: "rgba(232,69,10,0.35)",
    backgroundColor: "rgba(232,69,10,0.08)"
  },
  actionPillPrimary: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.30)",
    backgroundColor: theme.colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginLeft: 8
  },
  actionPillDanger: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(214,69,93,0.42)",
    backgroundColor: "rgba(214,69,93,0.12)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginLeft: 8
  },
  actionLabel: {
    color: theme.colors.textSecondary,
    fontWeight: "700",
    fontSize: 13
  },
  actionLabelActive: {
    color: theme.colors.accent
  },
  actionLabelPrimary: {
    color: "#edf5ff",
    fontWeight: "800",
    fontSize: 13
  },
  actionLabelDanger: {
    color: theme.colors.danger,
    fontWeight: "700",
    fontSize: 13
  },
  actionDisabled: {
    opacity: 0.62
  },
  rowChevron: {
    color: theme.colors.textSecondary,
    fontWeight: "800",
    fontSize: 14,
    opacity: 0.75,
    paddingTop: 4
  },
  pressed: {
    transform: [{ scale: 0.98 }]
  },
  gap8: {
    gap: 8
  }
});
