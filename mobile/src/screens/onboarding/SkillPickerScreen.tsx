import { useRef, useState } from "react";
import {
  Dimensions,
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
// SkillPack type used via the onSelect callback parameter

interface Props {
  onSelect: (
    skillPack: "fitness" | "drawing" | "instrument" | "other",
    customName: string | null
  ) => void;
}

const SKILL_OPTIONS: Array<{
  emoji: string;
  label: string;
  skillPack: "instrument" | "drawing" | "fitness" | "other";
}> = [
  { emoji: "\ud83c\udfb9", label: "music", skillPack: "instrument" },
  { emoji: "\u270f\ufe0f", label: "drawing", skillPack: "drawing" },
  { emoji: "\ud83d\udcaa", label: "fitness", skillPack: "fitness" },
  { emoji: "\u2728", label: "other", skillPack: "other" },
];

export function SkillPickerScreen({ onSelect }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customName, setCustomName] = useState("");
  const delayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleCardPress(option: (typeof SKILL_OPTIONS)[number]) {
    triggerSelectionHaptic();
    setSelected(option.skillPack);

    if (option.skillPack === "other") {
      setShowCustomInput(true);
      return;
    }

    setShowCustomInput(false);
    if (delayRef.current) clearTimeout(delayRef.current);
    delayRef.current = setTimeout(() => {
      onSelect(option.skillPack, null);
    }, 150);
  }

  function handleContinueCustom() {
    triggerSelectionHaptic();
    const trimmed = customName.trim();
    onSelect("other", trimmed.length > 0 ? trimmed : null);
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>what are you honing?</Text>

      <View style={styles.grid}>
        <View style={styles.gridRow}>
          {SKILL_OPTIONS.slice(0, 2).map((option) => (
            <TactilePressable
              key={option.skillPack}
              onPress={() => handleCardPress(option)}
              style={[
                styles.card,
                selected === option.skillPack && styles.cardSelected,
              ]}
            >
              <Text style={styles.emoji}>{option.emoji}</Text>
              <Text style={styles.cardLabel}>{option.label}</Text>
            </TactilePressable>
          ))}
        </View>
        <View style={styles.gridRow}>
          {SKILL_OPTIONS.slice(2, 4).map((option) => (
            <TactilePressable
              key={option.skillPack}
              onPress={() => handleCardPress(option)}
              style={[
                styles.card,
                selected === option.skillPack && styles.cardSelected,
              ]}
            >
              <Text style={styles.emoji}>{option.emoji}</Text>
              <Text style={styles.cardLabel}>{option.label}</Text>
            </TactilePressable>
          ))}
        </View>
      </View>

      {showCustomInput && (
        <View style={styles.customSection}>
          <TextInput
            style={styles.customInput}
            placeholder="type your skill..."
            placeholderTextColor="rgba(0,0,0,0.3)"
            value={customName}
            onChangeText={setCustomName}
            autoFocus
            autoCapitalize="none"
          />
          <TactilePressable onPress={handleContinueCustom}>
            <LinearGradient
              colors={theme.gradients.primaryAction}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.continueButton}
            >
              <Text style={styles.continueText}>continue</Text>
            </LinearGradient>
          </TactilePressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgStart,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  header: {
    fontSize: 32,
    fontFamily: theme.typography.display,
    color: theme.colors.textPrimary,
    marginBottom: 28,
  },
  grid: {
    gap: 14,
  },
  gridRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  card: {
    width: (Dimensions.get("window").width - 48 - 14) / 2,
    height: 150,
    backgroundColor: "rgba(0,0,0,0.03)",
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  cardSelected: {
    backgroundColor: "rgba(255,90,31,0.08)",
    borderWidth: 2,
    borderColor: theme.colors.accent,
  },
  emoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  cardLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: theme.colors.textPrimary,
  },
  customSection: {
    marginTop: 24,
  },
  customInput: {
    backgroundColor: "rgba(0,0,0,0.03)",
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 16,
    fontFamily: theme.typography.body,
    color: theme.colors.textPrimary,
    marginBottom: 16,
  },
  continueButton: {
    height: 58,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  continueText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
});
