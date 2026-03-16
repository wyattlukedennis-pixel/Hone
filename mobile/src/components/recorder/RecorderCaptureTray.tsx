import { Pressable, StyleSheet, Text, View } from "react-native";

import { theme } from "../../theme";
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
  const noun = captureType === "photo" ? "Photo" : "Clip";
  return (
    <View style={styles.captureCard}>
      <Text style={styles.captureTitle}>{noun} captured ({formatDuration(durationMs)})</Text>
      {statusMessage ? <Text style={styles.statusText}>{statusMessage}</Text> : null}
      {saveErrorMessage ? <Text style={styles.errorText}>{saveErrorMessage}</Text> : null}
      <View style={styles.captureActions}>
        <Pressable
          style={({ pressed }) => [styles.ghostButton, pressed && !recording && !saving ? styles.buttonPressed : undefined]}
          onPress={() => {
            triggerSelectionHaptic();
            onCancel();
          }}
          disabled={recording || saving}
        >
          <Text style={styles.ghostButtonText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.ghostButton, pressed && !saving ? styles.buttonPressed : undefined]}
          onPress={() => {
            triggerSelectionHaptic();
            onRetake();
          }}
          disabled={saving}
        >
          <Text style={styles.ghostButtonText}>Retake</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.saveButton, saving ? styles.disabled : undefined, pressed && !saving ? styles.buttonPressed : undefined]}
          onPress={() => {
            triggerSelectionHaptic();
            onSave();
          }}
          disabled={saving}
        >
          <Text style={styles.saveText}>{saving ? "Saving..." : `Save ${noun}`}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  captureCard: {
    borderRadius: 20,
    backgroundColor: "rgba(8,16,30,0.62)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.32)",
    padding: 12
  },
  captureTitle: {
    color: "#edf5ff",
    fontSize: 18,
    fontWeight: "800"
  },
  statusText: {
    marginTop: 6,
    color: "#7ce2b7",
    fontWeight: "700"
  },
  errorText: {
    marginTop: 6,
    color: "#ff8da0",
    fontWeight: "700"
  },
  captureActions: {
    marginTop: 12,
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap"
  },
  ghostButton: {
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
    backgroundColor: "rgba(255,255,255,0.16)",
    paddingVertical: 10,
    paddingHorizontal: 14
  },
  ghostButtonText: {
    color: "#e7f1ff",
    fontWeight: "700"
  },
  saveButton: {
    borderRadius: 13,
    backgroundColor: theme.colors.accent,
    paddingVertical: 10,
    paddingHorizontal: 14
  },
  saveText: {
    color: "#edf5ff",
    fontWeight: "800"
  },
  disabled: {
    opacity: 0.65
  },
  buttonPressed: {
    transform: [{ scale: 0.98 }]
  }
});
