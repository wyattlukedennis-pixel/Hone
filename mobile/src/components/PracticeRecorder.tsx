import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { ResizeMode, Video } from "expo-av";
import { CameraView, useCameraPermissions } from "expo-camera";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import * as VideoThumbnails from "expo-video-thumbnails";
import { trackEvent } from "../analytics/events";
import { theme } from "../theme";
import { useReducedMotion } from "../utils/useReducedMotion";
import { RecorderCaptureTray } from "./recorder/RecorderCaptureTray";
import { RecorderPermissionGate } from "./recorder/RecorderPermissionGate";
import { RecorderRecordButton } from "./recorder/RecorderRecordButton";
import { RecorderTopOverlay } from "./recorder/RecorderTopOverlay";
import type { SkillPack } from "../types/journey";

type PracticeRecorderProps = {
  visible: boolean;
  saving: boolean;
  statusMessage: string | null;
  journeyTitle?: string;
  dayNumber?: number;
  captureType: "video" | "photo";
  skillPack: SkillPack;
  onCancel: () => void;
  onSave: (payload: { uri: string; durationMs: number; recordedAt: string; recordedOn: string; captureType: "video" | "photo" }) => Promise<{ success: boolean; errorMessage?: string }>;
  referenceClipUrl?: string | null;
};

type CapturedAsset = {
  uri: string;
  durationMs: number;
  recordedAt: string;
  recordedOn: string;
};

function toLocalDayKey(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function PracticeRecorder({
  visible,
  saving,
  statusMessage,
  journeyTitle,
  dayNumber,
  captureType,
  skillPack,
  onCancel,
  onSave,
  referenceClipUrl
}: PracticeRecorderProps) {
  const cameraRef = useRef<CameraView | null>(null);
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [recording, setRecording] = useState(false);
  const [facing, setFacing] = useState<"front" | "back">("front");
  const [captured, setCaptured] = useState<CapturedAsset | null>(null);
  const [recordingStartedAtMs, setRecordingStartedAtMs] = useState<number | null>(null);
  const [ticker, setTicker] = useState(0);
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const [cameraMounted, setCameraMounted] = useState(false);
  const [ghostEnabled, setGhostEnabled] = useState(true);
  const [ghostImageUri, setGhostImageUri] = useState<string | null>(null);
  const transition = useRef(new Animated.Value(0)).current;
  const reducedMotion = useReducedMotion();
  const duration = (ms: number) => (reducedMotion ? 0 : ms);

  useEffect(() => {
    if (!visible) {
      setRecording(false);
      setFacing("front");
      setCaptured(null);
      setRecordingStartedAtMs(null);
      setSaveErrorMessage(null);
      setCameraMounted(false);
      setGhostEnabled(true);
      setGhostImageUri(null);
      return;
    }
    // Stage the opening: animate sheet first, then mount camera to avoid dropped frames.
    setCameraMounted(false);
    transition.setValue(0);
    Animated.timing(transition, {
      toValue: 1,
      duration: duration(theme.motion.transitionMs),
      useNativeDriver: true
    }).start();
    const mountTimer = setTimeout(() => {
      setCameraMounted(true);
    }, reducedMotion ? 0 : 140);

    return () => clearTimeout(mountTimer);
  }, [visible, transition, reducedMotion]);

  // Generate ghost image: use reference clip directly for photos, extract mid-frame for videos
  useEffect(() => {
    if (!referenceClipUrl) {
      setGhostImageUri(null);
      return;
    }
    const lower = referenceClipUrl.toLowerCase();
    const isVideo = lower.endsWith(".mp4") || lower.endsWith(".mov") || lower.endsWith(".m4v") || lower.includes("video");
    if (!isVideo) {
      // Photo — use directly
      setGhostImageUri(referenceClipUrl);
      return;
    }
    // Video — grab middle frame
    let cancelled = false;
    (async () => {
      try {
        const { uri } = await VideoThumbnails.getThumbnailAsync(referenceClipUrl, { time: 2500 });
        if (!cancelled) setGhostImageUri(uri);
      } catch {
        // If thumbnail fails, still try the URL directly (some formats work as images)
        if (!cancelled) setGhostImageUri(referenceClipUrl);
      }
    })();
    return () => { cancelled = true; };
  }, [referenceClipUrl]);

  useEffect(() => {
    if (!recordingStartedAtMs) return;
    const timer = setInterval(() => {
      setTicker((value) => value + 1);
    }, 300);
    return () => clearInterval(timer);
  }, [recordingStartedAtMs]);

  async function startCapture() {
    if (!cameraRef.current || !cameraMounted) return;

    const startedAt = Date.now();
    const recordedAtDate = new Date(startedAt);
    const recordedAtIso = recordedAtDate.toISOString();
    const recordedOn = toLocalDayKey(recordedAtDate);
    if (captureType === "photo") {
      trackEvent("recording_started", { journeyTitle: journeyTitle ?? null, dayNumber: dayNumber ?? null, facing, captureType });
      const result = await cameraRef.current.takePictureAsync({
        quality: 0.9
      });
      if (result?.uri) {
        trackEvent("recording_completed", { durationMs: 1000, facing, captureType });
        setCaptured({
          uri: result.uri,
          durationMs: 1000,
          recordedAt: recordedAtIso,
          recordedOn
        });
      }
      return;
    }

    setRecording(true);
    setRecordingStartedAtMs(startedAt);
    trackEvent("recording_started", { journeyTitle: journeyTitle ?? null, dayNumber: dayNumber ?? null, facing, captureType });
    try {
      const result = await cameraRef.current.recordAsync({
        maxDuration: 10
      });
      const durationMs = Math.max(1000, Date.now() - startedAt);
      if (result?.uri) {
        trackEvent("recording_completed", { durationMs, facing, captureType });
        setCaptured({
          uri: result.uri,
          durationMs,
          recordedAt: recordedAtIso,
          recordedOn
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
            <RecorderPermissionGate
              paddingTop={Math.max(16, insets.top + 10)}
              onClose={onCancel}
              onRequestPermission={() => {
                void requestPermission();
              }}
            />
          ) : (
            <View style={styles.container}>
              <RecorderTopOverlay
                paddingTop={Math.max(14, insets.top + 8)}
                recording={recording}
                saving={saving}
                captureType={captureType}
                skillPack={skillPack}
                journeyTitle={journeyTitle}
                dayNumber={dayNumber}
                cameraMounted={cameraMounted}
                recordingStartedAtMs={recordingStartedAtMs}
                ticker={ticker}
                onClose={onCancel}
                onFlip={() => {
                  trackEvent("camera_flipped", { from: facing, to: facing === "front" ? "back" : "front" });
                  setFacing((value) => (value === "front" ? "back" : "front"));
                }}
              />

              {/* Camera frame — rounded like the reveal screen */}
              <View style={styles.cameraFrame}>
                {cameraMounted && !captured ? <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} mode={captureType === "photo" ? "picture" : "video"} facing={facing} /> : null}
                {captured ? (
                  captureType === "video" ? (
                    <Video
                      source={{ uri: captured.uri }}
                      style={StyleSheet.absoluteFill}
                      resizeMode={ResizeMode.COVER}
                      isLooping
                      shouldPlay
                      isMuted={false}
                    />
                  ) : (
                    <Image source={{ uri: captured.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  )
                ) : null}
                {ghostImageUri && ghostEnabled && !captured ? (
                  <View style={[styles.ghostOverlay, facing === "front" && { transform: [{ scaleX: -1 }] }]} pointerEvents="none">
                    <Image source={{ uri: ghostImageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                    <Text style={[styles.ghostLabel, facing === "front" && { transform: [{ scaleX: -1 }] }]}>yesterday</Text>
                  </View>
                ) : null}
                {!cameraMounted ? (
                  <View style={styles.cameraBootPlaceholder}>
                    <ActivityIndicator size="small" color={theme.colors.accent} />
                    <Text style={styles.cameraBootText}>booting camera...</Text>
                  </View>
                ) : null}
                <LinearGradient colors={["rgba(0,0,0,0.15)", "transparent", "rgba(0,0,0,0.2)"]} style={StyleSheet.absoluteFill} pointerEvents="none" />
                {ghostImageUri && !captured && !recording ? (
                  <Pressable
                    style={[styles.ghostToggle, ghostEnabled ? styles.ghostToggleActive : null]}
                    onPress={() => setGhostEnabled((v) => !v)}
                  >
                    <Text style={styles.ghostToggleText}>{ghostEnabled ? "ghost on" : "ghost off"}</Text>
                  </Pressable>
                ) : null}
              </View>

              <View style={[styles.bottomOverlay, { paddingBottom: safeBottom }]}>
                {captured ? (
                  <RecorderCaptureTray
                    durationMs={captured.durationMs}
                    captureType={captureType}
                    saving={saving}
                    recording={recording}
                    statusMessage={statusMessage}
                    saveErrorMessage={saveErrorMessage}
                    onCancel={onCancel}
                    onRetake={() => setCaptured(null)}
                    onSave={async () => {
                      if (!captured) return;
                      setSaveErrorMessage(null);
                      const result = await onSave({
                        uri: captured.uri,
                        durationMs: captured.durationMs,
                        recordedAt: captured.recordedAt,
                        recordedOn: captured.recordedOn,
                        captureType
                      });
                      if (!result.success) {
                        setSaveErrorMessage(result.errorMessage ?? "Couldn't save take.");
                        return;
                      }
                      // Parent closes recorder after 500ms delay for calendar animation
                    }}
                  />
                ) : (
                  <RecorderRecordButton
                    recording={recording}
                    saving={saving}
                    cameraMounted={cameraMounted}
                    captureType={captureType}
                    onToggle={() => {
                      if (captureType === "video" && recording) {
                        stopRecording();
                      } else {
                        void startCapture();
                      }
                    }}
                  />
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
    backgroundColor: "rgba(0,0,0,0.15)"
  },
  backdropFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.12)"
  },
  sheet: {
    flex: 1,
    marginTop: 0,
    marginHorizontal: 0,
    marginBottom: 0,
    borderRadius: 0,
    overflow: "hidden",
    borderWidth: 0,
    backgroundColor: "#f4efe6",
  },
  container: {
    flex: 1,
    backgroundColor: "#f4efe6",
  },
  cameraFrame: {
    flex: 1,
    alignSelf: "stretch",
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#e8e2d8",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  cameraBootPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  cameraBootText: {
    color: "rgba(0,0,0,0.35)",
    fontWeight: "600",
    fontSize: 12
  },
  bottomOverlay: {
    marginTop: "auto",
    paddingHorizontal: 18,
    paddingTop: 14,
    alignItems: "center",
  },
  ghostOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.2,
  },
  ghostLabel: {
    position: "absolute",
    bottom: 120,
    right: 16,
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  ghostToggle: {
    position: "absolute",
    bottom: 12,
    left: 12,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.3)",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  ghostToggleActive: {
    backgroundColor: "rgba(255,90,31,0.5)",
  },
  ghostToggleText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
});
