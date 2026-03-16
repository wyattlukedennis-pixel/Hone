import { Pressable, StyleSheet, Text, View } from "react-native";

import { triggerSelectionHaptic } from "../../utils/feedback";

type RecorderRecordButtonProps = {
  recording: boolean;
  saving: boolean;
  cameraMounted: boolean;
  captureType: "video" | "photo";
  onToggle: () => void;
};

export function RecorderRecordButton({ recording, saving, cameraMounted, captureType, onToggle }: RecorderRecordButtonProps) {
  const isVideo = captureType === "video";
  return (
    <View style={styles.recordWrap}>
      <Pressable
        style={({ pressed }) => [styles.recordOuter, isVideo && recording ? styles.recordOuterActive : undefined, pressed ? styles.recordPressed : undefined]}
        onPress={() => {
          triggerSelectionHaptic();
          onToggle();
        }}
        disabled={saving || !cameraMounted}
      >
        <View style={[styles.recordInner, isVideo && recording ? styles.recordInnerActive : undefined]} />
      </Pressable>
      <Text style={styles.recordText}>
        {!cameraMounted ? "Preparing camera..." : isVideo ? (recording ? "Tap to stop" : "Tap to record today") : "Tap to capture photo"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  recordWrap: {
    alignItems: "center"
  },
  recordOuter: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.9)",
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center"
  },
  recordOuterActive: {
    borderColor: "rgba(214,69,93,0.95)"
  },
  recordInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.95)"
  },
  recordInnerActive: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#d6455d"
  },
  recordPressed: {
    transform: [{ scale: 0.96 }]
  },
  recordText: {
    marginTop: 10,
    color: "#edf5ff",
    fontWeight: "700"
  }
});
