import { Platform, Vibration } from "react-native";
import * as Haptics from "expo-haptics";
import type { HapticsMode } from "../types/haptics";

let hapticsMode: HapticsMode = "subtle";
let soundEnabled = true;

export function setSoundEnabled(enabled: boolean) {
  soundEnabled = enabled;
}

async function playTone(_frequency: number, durationMs: number, _volume = 0.3) {
  if (!soundEnabled || Platform.OS === "web") return;
  try {
    // Use a simple haptic as sound placeholder until real audio assets are added
    // Real implementation: load .wav/.mp3 files from assets/sounds/
    if (durationMs <= 100) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } else {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
  } catch {
    // Silently fail — sounds are non-critical
  }
}

/** Satisfying click on recording complete */
export function playCaptureSound() {
  void playTone(880, 60, 0.2);
}

/** Rising ding on streak increase */
export function playStreakSound() {
  void playTone(1046, 120, 0.25);
}

/** Success chime on save complete */
export function playSaveSound() {
  void playTone(784, 200, 0.3);
}

/** Dramatic swell before reveal plays */
export function playRevealSound() {
  void playTone(440, 400, 0.35);
}

export function setHapticsMode(mode: HapticsMode) {
  hapticsMode = mode;
}

function fallbackTapVibration() {
  if (Platform.OS === "web") return;
  Vibration.vibrate(4);
}

export function triggerSelectionHaptic() {
  if (Platform.OS === "web" || hapticsMode === "off") return;
  if (hapticsMode === "standard") {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
      fallbackTapVibration();
    });
    return;
  }
  void Haptics.selectionAsync().catch(() => {
    fallbackTapVibration();
  });
}

export function triggerSaveHaptic() {
  if (Platform.OS === "web" || hapticsMode === "off") return;
  void Haptics.impactAsync(hapticsMode === "standard" ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => {
    fallbackTapVibration();
  });
}

export function triggerMilestoneHaptic() {
  if (Platform.OS === "web" || hapticsMode === "off") return;
  if (hapticsMode === "standard") {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {
      fallbackTapVibration();
    });
    return;
  }
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
    fallbackTapVibration();
  });
}
