import { StyleSheet, Text, View } from "react-native";

import { TactilePressable } from "../TactilePressable";
import type { SkillPack } from "../../types/journey";
import { getSkillPackLabel } from "../../utils/skillPack";

type RecorderTopOverlayProps = {
  paddingTop: number;
  recording: boolean;
  saving: boolean;
  captureType: "video" | "photo";
  skillPack: SkillPack;
  journeyTitle?: string;
  dayNumber?: number;
  cameraMounted: boolean;
  recordingStartedAtMs: number | null;
  ticker: number;
  onClose: () => void;
  onFlip: () => void;
};

function formatDuration(ms: number) {
  const seconds = Math.max(1, Math.round(ms / 1000));
  return `${seconds}s`;
}

export function RecorderTopOverlay({
  paddingTop,
  recording,
  saving,
  captureType: _captureType,
  skillPack,
  journeyTitle,
  dayNumber,
  cameraMounted,
  recordingStartedAtMs,
  ticker,
  onClose,
  onFlip
}: RecorderTopOverlayProps) {
  const elapsedMs = recordingStartedAtMs ? Math.max(0, Date.now() - recordingStartedAtMs) : 0;

  return (
    <View style={[styles.topOverlay, { paddingTop }]}>
      <View style={styles.topActions}>
        <TactilePressable style={styles.actionButton} onPress={onClose} disabled={recording || saving}>
          <Text style={styles.actionButtonText}>close</Text>
        </TactilePressable>
        <TactilePressable style={styles.actionButton} onPress={onFlip} disabled={recording || saving || !cameraMounted}>
          <Text style={styles.actionButtonText}>flip</Text>
        </TactilePressable>
      </View>
      <View style={styles.topCopy}>
        <Text style={styles.kicker}>
          {(journeyTitle ?? "practice session").toLowerCase()} · {getSkillPackLabel(skillPack).toLowerCase()}
        </Text>
        <View style={styles.titleRow}>
          <Text style={styles.title}>day {dayNumber ?? 1}</Text>
          {recordingStartedAtMs ? (
            <Text style={styles.liveBadge}>
              {formatDuration(elapsedMs)}{ticker % 2 ? " ·" : ""}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topOverlay: {
    paddingHorizontal: 18,
    zIndex: 10,
    alignSelf: "stretch",
  },
  topActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  actionButton: {
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.06)",
    paddingHorizontal: 16,
    paddingVertical: 9
  },
  actionButtonText: {
    color: "#101010",
    fontWeight: "700",
    fontSize: 14
  },
  topCopy: {
    marginTop: 8,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  kicker: {
    color: "rgba(0,0,0,0.4)",
    letterSpacing: 0.15,
    fontWeight: "700",
    fontSize: 13
  },
  title: {
    marginTop: 2,
    color: "#101010",
    fontSize: 32,
    fontWeight: "800",
  },
  subtitle: {
    marginTop: 6,
    color: "rgba(0,0,0,0.3)",
    maxWidth: "82%",
    fontWeight: "600",
    fontSize: 15
  },
  liveBadge: {
    backgroundColor: "rgba(232,69,10,0.15)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    color: "#E8450A",
    fontWeight: "700",
    fontSize: 14,
    overflow: "hidden",
  }
});
