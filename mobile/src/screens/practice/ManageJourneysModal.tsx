import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { GlassSurface } from "../../components/GlassSurface";
import { theme } from "../../theme";
import type { Clip } from "../../types/clip";
import type { Journey } from "../../types/journey";
import { getCurrentStreak, getDayCount } from "../../utils/progress";
import { ActionButton } from "./ActionButton";

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
  onTitleChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onGoalTextChange: (value: string) => void;
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
  onTitleChange,
  onCategoryChange,
  onGoalTextChange,
  onClose,
  onCreateJourney,
  onRefresh,
  onSetActive,
  onRecord,
  onArchive
}: ManageJourneysModalProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.manageModalBackdrop}>
        <GlassSurface style={styles.manageModalCard}>
          <View style={styles.manageModalHeader}>
            <Text style={styles.manageTitle}>Journey Management</Text>
            <Pressable style={({ pressed }) => [styles.manageClose, pressed ? styles.pressed : undefined]} onPress={onClose}>
              <Text style={styles.manageCloseText}>Done</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.manageScrollContent}>
            <Text style={styles.cardTitle}>Start New Journey</Text>
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

            <View style={styles.manageListHeader}>
              <Text style={styles.sectionTitle}>Switch Journey</Text>
              <ActionButton label="Refresh" loading={refreshing} loadingLabel="Refreshing..." onPress={onRefresh} />
            </View>

            {journeys.length === 0 ? <Text style={styles.mutedText}>No journeys yet.</Text> : null}

            {journeys.map((journey) => {
              const isActive = activeJourneyId === journey.id;
              const isBusy = updatingId === journey.id;
              const journeyClips = clipsByJourney[journey.id] ?? [];
              const dayCount = getDayCount(journeyClips);
              const streak = getCurrentStreak(journeyClips);
              return (
                <View key={journey.id} style={[styles.journeyRow, isActive ? styles.journeyRowActive : undefined]}>
                  <View style={styles.clipMain}>
                    <Text style={styles.journeyTitle}>{journey.title}</Text>
                    <Text style={styles.journeyMeta}>
                      Day {Math.max(dayCount, 1)} • {streak}d streak
                    </Text>
                  </View>
                  <View style={styles.journeyActions}>
                    <ActionButton label={isActive ? "Active" : "Set Active"} onPress={() => onSetActive(journey.id)} disabled={isActive || isBusy} />
                    <ActionButton label="Record" variant="primary" onPress={() => onRecord(journey.id)} disabled={isBusy} />
                    <ActionButton
                      label="Archive"
                      variant="danger"
                      onPress={() => onArchive(journey.id)}
                      loading={isBusy}
                      loadingLabel="Archiving..."
                    />
                  </View>
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
  manageModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,26,44,0.3)",
    justifyContent: "flex-end",
    paddingHorizontal: 12,
    paddingBottom: 12
  },
  manageModalCard: {
    borderRadius: 28,
    maxHeight: "84%",
    padding: 16
  },
  manageModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8
  },
  manageScrollContent: {
    paddingBottom: 18
  },
  manageTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: theme.colors.textPrimary
  },
  manageClose: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
    backgroundColor: "rgba(255,255,255,0.4)",
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  manageCloseText: {
    color: theme.colors.textSecondary,
    fontWeight: "700"
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: theme.colors.textPrimary
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
  manageListHeader: {
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: theme.colors.textPrimary
  },
  mutedText: {
    marginTop: 10,
    color: theme.colors.textSecondary
  },
  journeyRow: {
    marginTop: 12,
    borderRadius: 16,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.36)"
  },
  journeyRowActive: {
    backgroundColor: "rgba(14,99,255,0.11)"
  },
  clipMain: {
    flex: 1
  },
  journeyTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: theme.colors.textPrimary
  },
  journeyMeta: {
    marginTop: 4,
    color: theme.colors.textSecondary
  },
  journeyActions: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  pressed: {
    transform: [{ scale: 0.98 }]
  }
});
