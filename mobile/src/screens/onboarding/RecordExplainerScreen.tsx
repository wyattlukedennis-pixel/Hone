import { useState } from "react";
import { Dimensions, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

import { TactilePressable } from "../../components/TactilePressable";
import { theme } from "../../theme";
import { triggerSelectionHaptic } from "../../utils/feedback";

type CaptureType = "video" | "photo";

interface Props {
  onContinue: (captureType: CaptureType) => void;
}

export function RecordExplainerScreen({ onContinue }: Props) {
  const [captureType, setCaptureType] = useState<CaptureType>("video");

  function handleContinue() {
    triggerSelectionHaptic();
    onContinue(captureType);
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.header}>{"how do you want\nto capture?"}</Text>
        <Text style={styles.body}>
          {captureType === "video"
            ? "record short clips of your practice — playing an instrument, working out, drawing, cooking, anything. over time, hone stitches them into a reveal video that shows how far you've come."
            : "snap daily photos of your progress — your physique, a drawing, a project build, anything visual. hone turns them into a timelapse that shows your transformation."}
        </Text>

        <View style={styles.modeRow}>
          <TactilePressable
            style={[styles.modeCard, captureType === "video" && styles.modeCardSelected]}
            onPress={() => { triggerSelectionHaptic(); setCaptureType("video"); }}
          >
            <Text style={styles.modeEmoji}>🎬</Text>
            <Text style={[styles.modeText, captureType === "video" && styles.modeTextSelected]}>video</Text>
          </TactilePressable>
          <TactilePressable
            style={[styles.modeCard, captureType === "photo" && styles.modeCardSelected]}
            onPress={() => { triggerSelectionHaptic(); setCaptureType("photo"); }}
          >
            <Text style={styles.modeEmoji}>📸</Text>
            <Text style={[styles.modeText, captureType === "photo" && styles.modeTextSelected]}>photo</Text>
          </TactilePressable>
        </View>

        <View style={styles.examples}>
          <Text style={styles.examplesLabel}>people use hone for</Text>
          <View style={styles.exampleRow}>
            <Text style={styles.exampleText}>🎹 learning an instrument</Text>
          </View>
          <View style={styles.exampleRow}>
            <Text style={styles.exampleText}>💪 fitness transformations</Text>
          </View>
          <View style={styles.exampleRow}>
            <Text style={styles.exampleText}>✏️ drawing & art practice</Text>
          </View>
          <View style={styles.exampleRow}>
            <Text style={styles.exampleText}>🛹 skateboard tricks</Text>
          </View>
          <View style={styles.exampleRow}>
            <Text style={styles.exampleText}>🍳 cooking skills</Text>
          </View>
          <View style={styles.exampleRow}>
            <Text style={styles.exampleText}>💃 dance routines</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottom}>
        <TactilePressable onPress={handleContinue}>
          <LinearGradient
            colors={theme.gradients.primaryAction}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.ctaButton}
          >
            <Text style={styles.ctaText}>continue</Text>
          </LinearGradient>
        </TactilePressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgStart,
    paddingHorizontal: 24,
  },
  content: {
    paddingTop: 60,
    paddingBottom: 24,
  },
  header: {
    fontSize: 32,
    fontFamily: theme.typography.display,
    color: theme.colors.textPrimary,
    marginBottom: 16,
    lineHeight: 38,
  },
  body: {
    fontSize: 17,
    lineHeight: 25,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.body,
    marginBottom: 32,
  },
  modeRow: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 36,
  },
  modeCard: {
    width: (Dimensions.get("window").width - 48 - 14) / 2,
    height: 90,
    backgroundColor: "rgba(0,0,0,0.03)",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  modeCardSelected: {
    backgroundColor: "rgba(255,90,31,0.08)",
    borderColor: theme.colors.accent,
  },
  modeEmoji: {
    fontSize: 32,
    marginBottom: 6,
  },
  modeText: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.textSecondary,
  },
  modeTextSelected: {
    color: theme.colors.accent,
  },
  examples: {
    gap: 12,
  },
  examplesLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: "700",
    letterSpacing: 0.2,
    marginBottom: 4,
  },
  exampleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  exampleText: {
    fontSize: 16,
    color: theme.colors.textPrimary,
    fontWeight: "500",
  },
  bottom: {
    paddingBottom: 24,
  },
  ctaButton: {
    height: 58,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
});
