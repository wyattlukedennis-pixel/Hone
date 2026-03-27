import { StyleSheet, Text, View } from "react-native";

import { TactilePressable } from "../TactilePressable";
import { triggerSelectionHaptic } from "../../utils/feedback";

type RecorderCaptureTrayProps = {
  durationMs: number;
  captureType: "video" | "photo";
  saving: boolean;
  recording: boolean;
  statusMessage: string | null;
  saveErrorMessage: string | null;
  onCancel: () => void;
  onRetake: () => void;
  onSave: () => void;
};

function formatDuration(ms: number) {
  const seconds = Math.max(1, Math.round(ms / 1000));
  return `${seconds}s`;
}

export function RecorderCaptureTray({
  durationMs,
  captureType,
  saving,
  recording,
  statusMessage,
  saveErrorMessage,
  onCancel,
  onRetake,
  onSave
}: RecorderCaptureTrayProps) {
  const noun = captureType === "photo" ? "photo" : "take";
  const detail = captureType === "photo" ? "captured and ready to save." : `length ${formatDuration(durationMs)}`;

  return (
    <View style={styles.captureCard}>
      <Text style={styles.captureTitle}>{noun} ready</Text>
      <Text style={styles.captureMeta}>{detail}</Text>
      {statusMessage ? <Text style={styles.statusText}>{statusMessage}</Text> : null}
      {saveErrorMessage ? <Text style={styles.errorText}>{saveErrorMessage}</Text> : null}
      <View style={styles.captureActions}>
        <TactilePressable
          style={styles.saveButton}
          pressScale={0.96}
          onPress={() => {
            triggerSelectionHaptic();
            onSave();
          }}
          disabled={saving}
        >
          <Text style={styles.saveText}>{saving ? "saving..." : `save ${noun}`}</Text>
        </TactilePressable>
      </View>
      <View style={styles.secondaryActions}>
        <TactilePressable
          style={styles.secondaryButton}
          pressScale={0.97}
          onPress={() => {
            triggerSelectionHaptic();
            onRetake();
          }}
          disabled={saving}
        >
          <Text style={styles.secondaryText}>retake</Text>
        </TactilePressable>
        <TactilePressable
          style={styles.secondaryButton}
          pressScale={0.97}
          onPress={() => {
            triggerSelectionHaptic();
            onCancel();
          }}
          disabled={recording || saving}
        >
          <Text style={styles.secondaryText}>discard</Text>
        </TactilePressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  captureCard: {
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.04)",
    padding: 20,
    alignSelf: "stretch",
  },
  captureTitle: {
    color: "#101010",
    fontSize: 20,
    fontWeight: "800"
  },
  captureMeta: {
    marginTop: 4,
    color: "rgba(0,0,0,0.4)",
    fontSize: 14,
    fontWeight: "600"
  },
  statusText: {
    marginTop: 8,
    color: "#7ce2b7",
    fontWeight: "700"
  },
  errorText: {
    marginTop: 8,
    color: "#ff8da0",
    fontWeight: "700"
  },
  captureActions: {
    marginTop: 16,
  },
  saveButton: {
    borderRadius: 24,
    backgroundColor: "#E8450A",
    paddingVertical: 16,
    alignItems: "center",
  },
  saveText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 17,
  },
  secondaryActions: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "center",
    gap: 24,
  },
  secondaryButton: {
    paddingVertical: 8,
  },
  secondaryText: {
    color: "rgba(0,0,0,0.4)",
    fontWeight: "600",
    fontSize: 14,
  },
});
