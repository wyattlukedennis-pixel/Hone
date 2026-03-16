import { Platform, Vibration } from "react-native";
import * as Haptics from "expo-haptics";

import type { HapticsMode } from "../types/haptics";

let hapticsMode: HapticsMode = "subtle";

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
