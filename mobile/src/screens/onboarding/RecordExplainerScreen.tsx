import { useState } from "react";
import { Dimensions, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

import { TactilePressable } from "../../components/TactilePressable";
import { theme } from "../../theme";
import { triggerSelectionHaptic } from "../../utils/feedback";

type CaptureType = "video" | "photo";

interface Props {
  skillLabel: string;
  onContinue: (captureType: CaptureType) => void;
}

export function RecordExplainerScreen({ skillLabel, onContinue }: Props) {
  const [captureType, setCaptureType] = useState<CaptureType>("video");

  function handleContinue() {
    triggerSelectionHaptic();
    onContinue(captureType);
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.header}>record your{"\n"}day 1</Text>
        <Text style={styles.body}>
          {captureType === "video"
            ? `capture a quick clip of where you're at right now with ${skillLabel}. it doesn't need to be good — the worse it is, the better your reveal will be.`
            : `snap a photo of where you're at right now with ${skillLabel}. it doesn't need to be good — the worse it looks, the better your reveal will be.`}
        </Text>

        <View style={styles.tips}>
          <View style={styles.tipRow}>
            <Text style={styles.tipIcon}>📱</Text>
            <Text style={styles.tipText}>
              {captureType === "video" ? "prop your phone up or hold it steady" : "find good lighting and a clean angle"}
            </Text>
          </View>
          <View style={styles.tipRow}>
            <Text style={styles.tipIcon}>{captureType === "video" ? "⏱" : "📐"}</Text>
            <Text style={styles.tipText}>
              {captureType === "video" ? "just 5-10 seconds is perfect" : "frame it the same way each time"}
            </Text>
          </View>
          <View style={styles.tipRow}>
            <Text style={styles.tipIcon}>🔄</Text>
            <Text style={styles.tipText}>
              {captureType === "video" ? "try to record from the same angle each day" : "take one photo a day — consistency is everything"}
            </Text>
          </View>
        </View>

        <Text style={styles.modeLabel}>how do you want to capture?</Text>
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
      </ScrollView>

      <View style={styles.bottom}>
        <TactilePressable onPress={handleContinue}>
          <LinearGradient
            colors={theme.gradients.primaryAction}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.ctaButton}
          >
            <Text style={styles.ctaText}>open camera</Text>
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
    fontSize: 36,
    fontFamily: theme.typography.display,
    color: theme.colors.textPrimary,
    marginBottom: 16,
    lineHeight: 42,
  },
  body: {
    fontSize: 17,
    lineHeight: 25,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.body,
    marginBottom: 36,
  },
  tips: {
    gap: 20,
    marginBottom: 40,
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  tipIcon: {
    fontSize: 28,
  },
  tipText: {
    fontSize: 17,
    color: theme.colors.textPrimary,
    fontWeight: "500",
    flex: 1,
  },
  modeLabel: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    fontWeight: "600",
    marginBottom: 14,
  },
  modeRow: {
    flexDirection: "row",
    gap: 14,
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
