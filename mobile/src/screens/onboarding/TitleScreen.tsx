import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { theme } from "../../theme";
import { TactilePressable } from "../../components/TactilePressable";
import { triggerSelectionHaptic } from "../../utils/feedback";

interface Props {
  captureType: "video" | "photo";
  onContinue: (title: string) => void;
}

export function TitleScreen({ captureType, onContinue }: Props) {
  const [title, setTitle] = useState("");

  function handleContinue() {
    triggerSelectionHaptic();
    const trimmed = title.trim();
    onContinue(trimmed.length > 0 ? trimmed : `my ${captureType} journey`);
  }

  const canContinue = title.trim().length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.top}>
        <Text style={styles.header}>{"name your\njourney"}</Text>
        <Text style={styles.subtitle}>
          this is what you'll see every day when you open the app.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="e.g., learning piano, 100 pushups..."
          placeholderTextColor="rgba(0,0,0,0.3)"
          value={title}
          onChangeText={setTitle}
          autoCapitalize="none"
          returnKeyType="done"
          blurOnSubmit
          autoFocus
          maxLength={120}
        />
      </View>

      <View style={styles.bottom}>
        <TactilePressable onPress={handleContinue} disabled={!canContinue}>
          <LinearGradient
            colors={theme.gradients.primaryAction}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.ctaButton, !canContinue && styles.ctaButtonDisabled]}
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
  top: {
    flex: 1,
    justifyContent: "center",
  },
  header: {
    fontSize: 32,
    fontFamily: theme.typography.display,
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    marginBottom: 32,
    lineHeight: 21,
  },
  input: {
    backgroundColor: "rgba(0,0,0,0.03)",
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    fontSize: 18,
    fontFamily: theme.typography.body,
    color: theme.colors.textPrimary,
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
  ctaButtonDisabled: {
    opacity: 0.4,
  },
  ctaText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
});
