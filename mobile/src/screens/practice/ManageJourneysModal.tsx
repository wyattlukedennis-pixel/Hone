import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { GlassSurface } from "../../components/GlassSurface";
import { theme } from "../../theme";
import type { Clip } from "../../types/clip";
import type { Journey } from "../../types/journey";
import { triggerSelectionHaptic } from "../../utils/feedback";
import { getCurrentStreak, getDayCount } from "../../utils/progress";
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
  onTitleChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onGoalTextChange: (value: string) => void;
  onMilestoneLengthChange: (value: number) => void;
  onCaptureModeChange: (value: "video" | "photo") => void;
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
  onTitleChange,
  onCategoryChange,
  onGoalTextChange,
  onMilestoneLengthChange,
  onCaptureModeChange,
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
            <Text style={styles.title}>Manage Journey</Text>
            <Pressable
              style={({ pressed }) => [styles.doneButton, pressed ? styles.pressed : undefined]}
              onPress={() => {
                triggerSelectionHaptic();
                onClose();
              }}
            >
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          </View>
          <Text style={styles.subtitle}>Create or switch your active skill.</Text>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.createCard}>
              <Text style={styles.sectionKicker}>Create</Text>
              <Text style={styles.sectionTitle}>Start New Journey</Text>
              <Text style={styles.milestoneLabel}>Choose first reveal window</Text>
              <View style={styles.milestoneRow}>
                {[7, 14, 30, 100].map((length) => {
                  const selected = newMilestoneLengthDays === length;
                  return (
                    <Pressable
                      key={length}
                      style={({ pressed }) => [
                        styles.milestoneChip,
                        selected ? styles.milestoneChipSelected : undefined,
                        pressed ? styles.pressed : undefined
                      ]}
                      onPress={() => {
                        triggerSelectionHaptic();
                        onMilestoneLengthChange(length);
                      }}
                    >
                      <Text style={[styles.milestoneChipText, selected ? styles.milestoneChipTextSelected : undefined]}>{length}d</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.captureModeLabel}>Capture mode</Text>
              <View style={styles.captureModeRow}>
                {[
                  { key: "video" as const, label: "Video" },
                  { key: "photo" as const, label: "Photo" }
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
              <TextInput
                style={styles.input}
                placeholder="Title (e.g., Learning Piano)"
                value={newTitle}
                onChangeText={onTitleChange}
                editable={!creating}
                placeholderTextColor="#7b90ab"
              />
              <TextInput
                style={styles.input}
                placeholder="Category (optional)"
                value={newCategory}
                onChangeText={onCategoryChange}
                editable={!creating}
                placeholderTextColor="#7b90ab"
              />
              <TextInput
                style={[styles.input, styles.goalInput]}
                placeholder="Goal (optional)"
                value={newGoalText}
                onChangeText={onGoalTextChange}
                editable={!creating}
                multiline
                placeholderTextColor="#7b90ab"
              />
              <ActionButton
                label="Create Journey"
                loadingLabel="Creating..."
                variant="primary"
                fullWidth
                onPress={onCreateJourney}
                disabled={creating}
                loading={creating}
              />
            </View>

            <View style={styles.listHeader}>
              <View>
                <Text style={styles.sectionKicker}>Switch</Text>
                <Text style={styles.switchTitle}>Choose Active Journey</Text>
              </View>
              <ActionButton label="Refresh" loading={refreshing} loadingLabel="Refreshing..." onPress={onRefresh} />
            </View>

            {journeys.length === 0 ? <Text style={styles.mutedText}>No journeys yet.</Text> : null}

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
                .join("") || "JR";
              return (
                <View key={journey.id} style={[styles.row, isActive ? styles.rowActive : undefined]}>
                  <View style={[styles.rowBadge, isActive ? styles.rowBadgeActive : undefined]}>
                    <Text style={[styles.rowBadgeText, isActive ? styles.rowBadgeTextActive : undefined]}>{badgeText}</Text>
                  </View>

                  <View style={styles.rowBody}>
                    <Text style={styles.rowTitle}>{journey.title}</Text>
                    <Text style={styles.rowMeta}>
                      Day {Math.max(dayCount, 1)} • {streak}d streak
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
                          {isActive ? "Active" : "Set active"}
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
                        <Text style={styles.actionLabelPrimary}>Record</Text>
                      </Pressable>

                      <Pressable
                        style={({ pressed }) => [styles.actionPillDanger, pressed ? styles.pressed : undefined, isBusy ? styles.actionDisabled : undefined]}
                        onPress={() => {
                          triggerSelectionHaptic();
                          onArchive(journey.id);
                        }}
                        disabled={isBusy}
                      >
                        <Text style={styles.actionLabelDanger}>{isBusy ? "Closing..." : "Close"}</Text>
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
    maxHeight: "84%",
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
    textTransform: "uppercase",
    letterSpacing: 0.55
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
    paddingBottom: 18,
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
    textTransform: "uppercase",
    letterSpacing: 0.5
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
    textTransform: "uppercase",
    letterSpacing: 0.45
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
    borderColor: "rgba(14,99,255,0.54)",
    backgroundColor: "rgba(14,99,255,0.18)"
  },
  milestoneChipText: {
    color: theme.colors.textSecondary,
    fontWeight: "800",
    fontSize: 12
  },
  milestoneChipTextSelected: {
    color: theme.colors.accentStrong
  },
  captureModeLabel: {
    marginTop: 10,
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.45
  },
  captureRuleLabel: {
    marginTop: 10,
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.45
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
    borderColor: "rgba(14,99,255,0.54)",
    backgroundColor: "rgba(14,99,255,0.18)"
  },
  captureModeChipText: {
    color: theme.colors.textSecondary,
    fontWeight: "800",
    fontSize: 12
  },
  captureModeChipTextSelected: {
    color: theme.colors.accentStrong
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
    backgroundColor: "rgba(14,99,255,0.14)",
    borderColor: "rgba(14,99,255,0.40)"
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
    borderColor: "rgba(14,99,255,0.44)",
    backgroundColor: "rgba(14,99,255,0.16)"
  },
  rowBadgeText: {
    color: theme.colors.textSecondary,
    fontWeight: "800",
    fontSize: 11,
    letterSpacing: 0.3
  },
  rowBadgeTextActive: {
    color: theme.colors.accentStrong
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
    borderColor: "rgba(14,99,255,0.42)",
    backgroundColor: "rgba(14,99,255,0.14)"
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
    color: theme.colors.accentStrong
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
