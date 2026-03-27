import { useRef, useState } from "react";
import { Animated, StyleSheet, Text } from "react-native";
import { PracticeRecorder } from "../../components/PracticeRecorder";
import type { SkillPack } from "../../utils/skillPack";

interface Props {
  skillPack: "fitness" | "drawing" | "instrument";
  journeyTitle: string;
  captureType: "video" | "photo";
  onClipSaved: (clip: {
    uri: string;
    durationMs: number;
    recordedAt: string;
    recordedOn: string;
    captureType: "video" | "photo";
  }) => void;
  onCancel: () => void;
}

export function OnboardingRecorderScreen({
  skillPack,
  journeyTitle,
  captureType,
  onClipSaved,
  onCancel,
}: Props) {
  const [showCelebration, setShowCelebration] = useState(false);
  const celebrationAnim = useRef(new Animated.Value(0)).current;

  async function handleSave(payload: {
    uri: string;
    durationMs: number;
    recordedAt: string;
    recordedOn: string;
    captureType: "video" | "photo";
  }) {
    setShowCelebration(true);
    Animated.timing(celebrationAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    setTimeout(() => {
      onClipSaved(payload);
    }, 2000);

    return { success: true as const };
  }

  if (showCelebration) {
    return (
      <Animated.View
        style={[styles.celebration, { opacity: celebrationAnim }]}
      >
        <Text style={styles.celebrationTitle}>day 1. done.</Text>
        <Text style={styles.celebrationSubtitle}>
          that's the hardest part.
        </Text>
      </Animated.View>
    );
  }

  return (
    <PracticeRecorder
      visible={true}
      saving={false}
      statusMessage={null}
      journeyTitle={journeyTitle}
      dayNumber={1}
      captureType={captureType}
      skillPack={skillPack as SkillPack}
      onCancel={onCancel}
      onSave={handleSave}
    />
  );
}

const styles = StyleSheet.create({
  celebration: {
    flex: 1,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  celebrationTitle: {
    color: "#fff",
    fontSize: 36,
    fontWeight: "900",
  },
  celebrationSubtitle: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 16,
    marginTop: 12,
  },
});
