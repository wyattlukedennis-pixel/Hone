import { StyleSheet, Text, View } from "react-native";

import { TactilePressable } from "../TactilePressable";

type RecorderTopOverlayProps = {
  paddingTop: number;
  recording: boolean;
  saving: boolean;
  captureType: "video" | "photo";
  journeyTitle?: string;
  dayNumber?: number;
  hasReferenceClip: boolean;
  showReferenceGuide: boolean;
  cameraMounted: boolean;
  recordingStartedAtMs: number | null;
  ticker: number;
  onClose: () => void;
  onToggleGuide: () => void;
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
  captureType,
  journeyTitle,
  dayNumber,
  hasReferenceClip,
  showReferenceGuide,
  cameraMounted,
  recordingStartedAtMs,
  ticker,
  onClose,
  onToggleGuide,
  onFlip
}: RecorderTopOverlayProps) {
  return (
    <View style={[styles.topOverlay, { paddingTop }]}>
      <View style={styles.topActions}>
        <TactilePressable style={styles.closeButtonDark} onPress={onClose} disabled={recording || saving}>
          <Text style={styles.closeButtonDarkText}>Close</Text>
        </TactilePressable>
        <View style={styles.topRightActions}>
          {hasReferenceClip ? (
            <TactilePressable
              style={[styles.flipButton, showReferenceGuide ? styles.guideButtonOn : undefined]}
              onPress={onToggleGuide}
              disabled={recording || saving || !cameraMounted}
            >
              <Text style={styles.flipButtonText}>{showReferenceGuide ? "Reference On" : "Reference Off"}</Text>
            </TactilePressable>
          ) : null}
          <TactilePressable style={styles.flipButton} onPress={onFlip} disabled={recording || saving || !cameraMounted}>
            <Text style={styles.flipButtonText}>Flip</Text>
          </TactilePressable>
        </View>
      </View>
      <View style={styles.topCopy}>
        <Text style={styles.kicker}>{journeyTitle ?? "Practice"}</Text>
        <Text style={styles.title}>Day {dayNumber ?? 1}</Text>
        <Text style={styles.subtitle}>
          {captureType === "photo" ? "Capture the same angle each day for cleaner comparisons." : "Match your framing each day for clearer comparisons."}
        </Text>
      </View>
      {recordingStartedAtMs ? (
        <Text style={styles.liveBadge}>
          Recording {formatDuration(Date.now() - recordingStartedAtMs)}
          {ticker % 2 ? " •" : ""}
        </Text>
      ) : (
        <Text style={styles.liveHint}>
          {captureType === "photo" ? "One clean photo works best" : "5-10 seconds works best"}
          {hasReferenceClip ? ` • ${showReferenceGuide ? "Reference overlay on" : "Reference overlay off"}` : ""}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  topOverlay: {
    paddingHorizontal: 18
  },
  topActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  topRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  closeButtonDark: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  closeButtonDarkText: {
    color: "#f0f6ff",
    fontWeight: "700"
  },
  flipButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  flipButtonText: {
    color: "#f0f6ff",
    fontWeight: "700"
  },
  guideButtonOn: {
    borderColor: "rgba(13,159,101,0.7)",
    backgroundColor: "rgba(13,159,101,0.2)"
  },
  topCopy: {
    marginTop: 14
  },
  kicker: {
    color: "#c5d6ed",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontWeight: "800",
    fontSize: 12
  },
  title: {
    marginTop: 4,
    color: "#f2f8ff",
    fontSize: 36,
    fontWeight: "800"
  },
  subtitle: {
    marginTop: 6,
    color: "#d2e4fb",
    maxWidth: "82%"
  },
  liveBadge: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: "rgba(214,69,93,0.26)",
    borderWidth: 1,
    borderColor: "rgba(214,69,93,0.65)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    color: "#ffe7ec",
    fontWeight: "800"
  },
  liveHint: {
    marginTop: 10,
    color: "#d2e4fb",
    fontWeight: "600"
  }
});
