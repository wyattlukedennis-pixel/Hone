import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { theme } from "../../theme";
import { TactilePressable } from "../../components/TactilePressable";
import { triggerSelectionHaptic } from "../../utils/feedback";

interface Props {
  skillLabel: string;
  onContinue: (goalText: string | null) => void;
}

export function GoalScreen({ skillLabel, onContinue }: Props) {
  const [goalText, setGoalText] = useState("");

  function handleContinue() {
    triggerSelectionHaptic();
    const trimmed = goalText.trim();
    onContinue(trimmed.length > 0 ? trimmed : null);
  }

  function handleSkip() {
    triggerSelectionHaptic();
    onContinue(null);
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.top}>
        <Text style={styles.header}>
          {"what do you want to\nbe able to do?"}
        </Text>
        <Text style={styles.subtitle}>
          a goal for your {skillLabel} journey
        </Text>

        <TextInput
          style={styles.input}
          placeholder="play fur elise without stopping..."
          placeholderTextColor="rgba(0,0,0,0.3)"
          value={goalText}
          onChangeText={setGoalText}
          multiline
          textAlignVertical="top"
          autoCapitalize="none"
          returnKeyType="done"
          blurOnSubmit
        />
      </View>

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

        <Pressable onPress={handleSkip} hitSlop={12}>
          <Text style={styles.skipText}>skip</Text>
        </Pressable>
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
  top: {
    flex: 1,
  },
  header: {
    fontSize: 28,
    fontFamily: theme.typography.display,
    color: theme.colors.textPrimary,
    marginTop: 60,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 32,
  },
  input: {
    backgroundColor: "rgba(0,0,0,0.03)",
    borderRadius: 16,
    padding: 20,
    fontSize: 18,
    fontFamily: theme.typography.body,
    color: theme.colors.textPrimary,
    minHeight: 120,
    textAlignVertical: "top",
  },
  bottom: {
    paddingBottom: 40,
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
  skipText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: "center",
    marginTop: 16,
  },
});
