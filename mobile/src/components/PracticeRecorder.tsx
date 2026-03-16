import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { ResizeMode, Video } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { trackEvent } from "../analytics/events";
import { theme } from "../theme";
import { useReducedMotion } from "../utils/useReducedMotion";
import { RecorderCaptureTray } from "./recorder/RecorderCaptureTray";
import { RecorderPermissionGate } from "./recorder/RecorderPermissionGate";
import { RecorderRecordButton } from "./recorder/RecorderRecordButton";
import { RecorderTopOverlay } from "./recorder/RecorderTopOverlay";

type PracticeRecorderProps = {
  visible: boolean;
  saving: boolean;
  statusMessage: string | null;
  journeyTitle?: string;
  dayNumber?: number;
  captureType: "video" | "photo";
  referenceClipUrl?: string | null;
  onCancel: () => void;
  onSave: (payload: { uri: string; durationMs: number; recordedAt: string; captureType: "video" | "photo" }) => Promise<{ success: boolean; errorMessage?: string }>;
};

export function PracticeRecorder({
  visible,
  saving,
  statusMessage,
  journeyTitle,
  dayNumber,
  captureType,
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
  const reducedMotion = useReducedMotion();
  const duration = (ms: number) => (reducedMotion ? 0 : ms);

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
      duration: duration(theme.motion.transitionMs),
      useNativeDriver: true
    }).start();
    const mountTimer = setTimeout(() => {
      setCameraMounted(true);
    }, reducedMotion ? 0 : 140);

    return () => clearTimeout(mountTimer);
  }, [visible, transition]);

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
    const recordedAtIso = new Date(startedAt).toISOString();
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
          recordedAt: recordedAtIso
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
            <RecorderPermissionGate
              paddingTop={Math.max(16, insets.top + 10)}
              onClose={onCancel}
              onRequestPermission={() => {
                void requestPermission();
              }}
            />
          ) : (
            <View style={styles.container}>
          {cameraMounted ? <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} mode={captureType === "photo" ? "picture" : "video"} mute facing={facing} /> : null}
          {!cameraMounted ? (
            <View style={styles.cameraBootPlaceholder}>
              <ActivityIndicator size="small" color="#d6e6fa" />
              <Text style={styles.cameraBootText}>Preparing camera...</Text>
            </View>
          ) : null}
          {referenceClipUrl && cameraMounted && !captured && showReferenceGuide ? (
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              {captureType === "photo" ? (
                <Image source={{ uri: referenceClipUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              ) : (
                <Video source={{ uri: referenceClipUrl }} style={StyleSheet.absoluteFill} shouldPlay isLooping isMuted resizeMode={ResizeMode.COVER} />
              )}
              <View style={styles.referenceOverlayMask} />
            </View>
          ) : null}
          <LinearGradient colors={["rgba(8,16,30,0.4)", "rgba(8,16,30,0.06)", "rgba(8,16,30,0.45)"]} style={StyleSheet.absoluteFill} />

            <RecorderTopOverlay
              paddingTop={Math.max(14, insets.top + 8)}
              recording={recording}
              saving={saving}
              captureType={captureType}
              journeyTitle={journeyTitle}
              dayNumber={dayNumber}
            hasReferenceClip={Boolean(referenceClipUrl)}
            showReferenceGuide={showReferenceGuide}
            cameraMounted={cameraMounted}
            recordingStartedAtMs={recordingStartedAtMs}
            ticker={ticker}
            onClose={onCancel}
            onToggleGuide={() => {
              setShowReferenceGuide((current) => !current);
            }}
            onFlip={() => {
              trackEvent("camera_flipped", { from: facing, to: facing === "front" ? "back" : "front" });
              setFacing((value) => (value === "front" ? "back" : "front"));
            }}
          />

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
                  const result = await onSave({ ...captured, captureType });
                  if (!result.success) {
                    setSaveErrorMessage(result.errorMessage ?? "Failed to save clip.");
                  }
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
  referenceOverlayMask: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(197,218,243,0.12)"
  },
  bottomOverlay: {
    marginTop: "auto",
    paddingHorizontal: 18,
    paddingTop: 14
  },
});
