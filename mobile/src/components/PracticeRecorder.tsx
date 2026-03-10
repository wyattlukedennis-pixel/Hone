import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { ResizeMode, Video } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { trackEvent } from "../analytics/events";
import { theme } from "../theme";

type PracticeRecorderProps = {
  visible: boolean;
  saving: boolean;
  statusMessage: string | null;
  journeyTitle?: string;
  dayNumber?: number;
  referenceClipUrl?: string | null;
  onCancel: () => void;
  onSave: (payload: { uri: string; durationMs: number; recordedAt: string }) => Promise<{ success: boolean; errorMessage?: string }>;
};

function formatDuration(ms: number) {
  const seconds = Math.max(1, Math.round(ms / 1000));
  return `${seconds}s`;
}

export function PracticeRecorder({
  visible,
  saving,
  statusMessage,
  journeyTitle,
  dayNumber,
  referenceClipUrl,
  onCancel,
  onSave
}: PracticeRecorderProps) {
  const cameraRef = useRef<CameraView | null>(null);
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [recording, setRecording] = useState(false);
  const [facing, setFacing] = useState<"front" | "back">("front");
  const [captured, setCaptured] = useState<{ uri: string; durationMs: number; recordedAt: string } | null>(null);
  const [recordingStartedAtMs, setRecordingStartedAtMs] = useState<number | null>(null);
  const [ticker, setTicker] = useState(0);
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const [showReferenceGuide, setShowReferenceGuide] = useState(false);
  const [cameraMounted, setCameraMounted] = useState(false);
  const transition = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      setRecording(false);
      setFacing("front");
      setCaptured(null);
      setRecordingStartedAtMs(null);
      setSaveErrorMessage(null);
      setShowReferenceGuide(false);
      setCameraMounted(false);
      return;
    }
    // Stage the opening: animate sheet first, then mount camera to avoid dropped frames.
    setShowReferenceGuide(false);
    setCameraMounted(false);
    transition.setValue(0);
    Animated.timing(transition, {
      toValue: 1,
      duration: 190,
      useNativeDriver: true
    }).start();
    const mountTimer = setTimeout(() => {
      setCameraMounted(true);
    }, 140);

    return () => clearTimeout(mountTimer);
  }, [visible, transition]);

  useEffect(() => {
    if (!recordingStartedAtMs) return;
    const timer = setInterval(() => {
      setTicker((value) => value + 1);
    }, 300);
    return () => clearInterval(timer);
  }, [recordingStartedAtMs]);

  async function startRecording() {
    if (!cameraRef.current || !cameraMounted) return;

    const startedAt = Date.now();
    const recordedAtIso = new Date(startedAt).toISOString();
    setRecording(true);
    setRecordingStartedAtMs(startedAt);
    trackEvent("recording_started", { journeyTitle: journeyTitle ?? null, dayNumber: dayNumber ?? null, facing });
    try {
      const result = await cameraRef.current.recordAsync({
        maxDuration: 10
      });
      const durationMs = Math.max(1000, Date.now() - startedAt);
      if (result?.uri) {
        trackEvent("recording_completed", { durationMs, facing });
        setCaptured({
          uri: result.uri,
          durationMs,
          recordedAt: recordedAtIso
        });
      }
    } finally {
      setRecording(false);
      setRecordingStartedAtMs(null);
    }
  }

  function stopRecording() {
    cameraRef.current?.stopRecording();
  }

  if (!visible) return null;

  const safeBottom = Math.max(16, insets.bottom + 8);

  return (
    <Modal visible={visible} animationType="none" transparent presentationStyle="overFullScreen" onRequestClose={onCancel}>
      <View style={styles.modalRoot}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} disabled={recording || saving} />
        <Animated.View style={[styles.backdrop, { opacity: transition.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) }]}>
          <View style={styles.backdropFill} />
        </Animated.View>
        <Animated.View
          style={[
            styles.sheet,
            {
              opacity: transition.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }),
              transform: [
                {
                  translateY: transition.interpolate({
                    inputRange: [0, 1],
                    outputRange: [48, 0]
                  })
                },
                {
                  scale: transition.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.98, 1]
                  })
                }
              ]
            }
          ]}
        >
          {!permission || !permission.granted ? (
            <LinearGradient colors={["#e6eef7", "#d0deef"]} style={[styles.permissionWrap, { paddingTop: Math.max(16, insets.top + 10) }]}>
              <Pressable style={({ pressed }) => [styles.closeButton, pressed ? styles.buttonPressed : undefined]} onPress={onCancel}>
                <Text style={styles.closeButtonText}>Close</Text>
              </Pressable>
              <View style={styles.permissionCard}>
                <Text style={styles.permissionTitle}>Camera access needed</Text>
                <Text style={styles.permissionText}>Hone uses quick daily clips to track your progress.</Text>
                <Pressable
                  style={styles.allowButton}
                  onPress={() => {
                    void requestPermission();
                  }}
                >
                  <Text style={styles.allowText}>Allow Camera</Text>
                </Pressable>
              </View>
            </LinearGradient>
          ) : (
            <View style={styles.container}>
          {cameraMounted ? <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} mode="video" mute facing={facing} /> : null}
          {!cameraMounted ? (
            <View style={styles.cameraBootPlaceholder}>
              <ActivityIndicator size="small" color="#d6e6fa" />
              <Text style={styles.cameraBootText}>Preparing camera...</Text>
            </View>
          ) : null}
          {referenceClipUrl && cameraMounted && !captured && showReferenceGuide ? (
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              <Video source={{ uri: referenceClipUrl }} style={StyleSheet.absoluteFill} isMuted resizeMode={ResizeMode.COVER} />
              <View style={styles.referenceOverlayMask} />
            </View>
          ) : null}
          <LinearGradient colors={["rgba(8,16,30,0.4)", "rgba(8,16,30,0.06)", "rgba(8,16,30,0.45)"]} style={StyleSheet.absoluteFill} />

          <View style={[styles.topOverlay, { paddingTop: Math.max(14, insets.top + 8) }]}>
            <View style={styles.topActions}>
              <Pressable
                style={({ pressed }) => [styles.closeButtonDark, pressed && !recording && !saving ? styles.buttonPressed : undefined]}
                onPress={onCancel}
                disabled={recording || saving}
              >
                <Text style={styles.closeButtonDarkText}>Close</Text>
              </Pressable>
              <View style={styles.topRightActions}>
                {referenceClipUrl ? (
                  <Pressable
                    style={({ pressed }) => [
                      styles.flipButton,
                      showReferenceGuide ? styles.guideButtonOn : undefined,
                      pressed && !recording && !saving ? styles.buttonPressed : undefined
                    ]}
                    onPress={() => {
                      setShowReferenceGuide((current) => !current);
                    }}
                    disabled={recording || saving || !cameraMounted}
                  >
                    <Text style={styles.flipButtonText}>{showReferenceGuide ? "Guide On" : "Guide Off"}</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  style={({ pressed }) => [styles.flipButton, pressed && !recording && !saving ? styles.buttonPressed : undefined]}
                  onPress={() => {
                    trackEvent("camera_flipped", { from: facing, to: facing === "front" ? "back" : "front" });
                    setFacing((value) => (value === "front" ? "back" : "front"));
                  }}
                  disabled={recording || saving || !cameraMounted}
                >
                  <Text style={styles.flipButtonText}>Flip</Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.topCopy}>
              <Text style={styles.kicker}>{journeyTitle ?? "Practice"}</Text>
              <Text style={styles.title}>Day {dayNumber ?? 1}</Text>
              <Text style={styles.subtitle}>Keep your framing similar each day for better comparisons.</Text>
            </View>
            {recordingStartedAtMs ? (
              <Text style={styles.liveBadge}>
                Recording {formatDuration(Date.now() - recordingStartedAtMs)}
                {ticker % 2 ? " •" : ""}
              </Text>
            ) : (
              <Text style={styles.liveHint}>
                5-10 seconds works best
                {referenceClipUrl ? ` • ${showReferenceGuide ? "Reference guide on" : "Reference guide off"}` : ""}
              </Text>
            )}
          </View>

          <View style={[styles.bottomOverlay, { paddingBottom: safeBottom }]}>
            {captured ? (
              <View style={styles.captureCard}>
                <Text style={styles.captureTitle}>Clip captured ({formatDuration(captured.durationMs)})</Text>
                {statusMessage ? <Text style={styles.statusText}>{statusMessage}</Text> : null}
                {saveErrorMessage ? <Text style={styles.errorText}>{saveErrorMessage}</Text> : null}
                <View style={styles.captureActions}>
                  <Pressable
                    style={({ pressed }) => [styles.ghostButton, pressed && !recording && !saving ? styles.buttonPressed : undefined]}
                    onPress={onCancel}
                    disabled={recording || saving}
                  >
                    <Text style={styles.ghostButtonText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.ghostButton, pressed && !saving ? styles.buttonPressed : undefined]}
                    onPress={() => setCaptured(null)}
                    disabled={saving}
                  >
                    <Text style={styles.ghostButtonText}>Retake</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.saveButton,
                      saving ? styles.disabled : undefined,
                      pressed && !saving ? styles.buttonPressed : undefined
                    ]}
                    onPress={async () => {
                      if (!captured) return;
                      setSaveErrorMessage(null);
                      const result = await onSave(captured);
                      if (!result.success) {
                        setSaveErrorMessage(result.errorMessage ?? "Failed to save clip.");
                      }
                    }}
                    disabled={saving}
                  >
                    <Text style={styles.saveText}>{saving ? "Saving..." : "Save Clip"}</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.recordWrap}>
                <Pressable
                  style={({ pressed }) => [
                    styles.recordOuter,
                    recording ? styles.recordOuterActive : undefined,
                    pressed ? styles.recordPressed : undefined
                  ]}
                  onPress={() => {
                    if (recording) {
                      stopRecording();
                    } else {
                      void startRecording();
                    }
                  }}
                  disabled={saving || !cameraMounted}
                >
                  <View style={[styles.recordInner, recording ? styles.recordInnerActive : undefined]} />
                </Pressable>
                <Text style={styles.recordText}>
                  {!cameraMounted ? "Preparing camera..." : recording ? "Tap to stop" : "Tap to record today"}
                </Text>
              </View>
            )}
          </View>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end"
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(7,14,24,0.26)"
  },
  backdropFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(7,14,24,0.24)"
  },
  sheet: {
    flex: 1,
    marginTop: 0,
    marginHorizontal: 0,
    marginBottom: 0,
    borderRadius: 0,
    overflow: "hidden",
    borderWidth: 0
  },
  container: {
    flex: 1,
    backgroundColor: "#07101c"
  },
  cameraBootPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  cameraBootText: {
    color: "#d2e4fb",
    fontWeight: "600",
    fontSize: 12
  },
  permissionWrap: {
    flex: 1,
    paddingHorizontal: 18
  },
  permissionCard: {
    marginTop: 24,
    borderRadius: 24,
    padding: 18,
    backgroundColor: "rgba(255,255,255,0.72)",
    shadowColor: "#143c66",
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6
  },
  permissionTitle: {
    color: theme.colors.textPrimary,
    fontSize: 26,
    fontWeight: "800"
  },
  permissionText: {
    marginTop: 8,
    color: theme.colors.textSecondary
  },
  allowButton: {
    marginTop: 16,
    borderRadius: 14,
    backgroundColor: theme.colors.accent,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  allowText: {
    color: "#edf5ff",
    fontWeight: "800"
  },
  closeButton: {
    alignSelf: "flex-start",
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.65)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.8)",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  closeButtonText: {
    color: theme.colors.textSecondary,
    fontWeight: "700"
  },
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
  },
  referenceOverlayMask: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(197,218,243,0.12)"
  },
  bottomOverlay: {
    marginTop: "auto",
    paddingHorizontal: 18,
    paddingTop: 14
  },
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
  },
  disabled: {
    opacity: 0.65
  },
  buttonPressed: {
    transform: [{ scale: 0.98 }]
  }
});
