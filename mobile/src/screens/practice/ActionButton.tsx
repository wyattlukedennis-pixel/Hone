import { Pressable, StyleSheet, Text } from "react-native";

import { theme } from "../../theme";

type ActionButtonProps = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  fullWidth?: boolean;
};

export function ActionButton({
  label,
  onPress,
  variant = "ghost",
  disabled,
  loading,
  loadingLabel,
  fullWidth
}: ActionButtonProps) {
  const text = loading ? loadingLabel ?? "Working..." : label;
  const pressDisabled = Boolean(disabled || loading);

  if (variant === "primary") {
    return (
      <Pressable
        onPress={onPress}
        disabled={pressDisabled}
        style={({ pressed }) => [
          styles.primaryAction,
          fullWidth ? styles.fullWidth : undefined,
          pressed && !pressDisabled ? styles.pressed : undefined,
          pressDisabled ? styles.disabled : undefined
        ]}
      >
        <Text style={styles.primaryActionText}>{text}</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={pressDisabled}
      style={({ pressed }) => [
        styles.ghostAction,
        variant === "danger" ? styles.dangerAction : undefined,
        fullWidth ? styles.fullWidth : undefined,
        pressed && !pressDisabled ? styles.pressed : undefined,
        pressDisabled ? styles.disabled : undefined
      ]}
    >
      <Text style={[styles.ghostActionText, variant === "danger" ? styles.dangerActionText : undefined]}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primaryAction: {
    borderRadius: 16,
    backgroundColor: theme.colors.accent,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center"
  },
  primaryActionText: {
    color: "#edf5ff",
    fontWeight: "800",
    fontSize: 16
  },
  ghostAction: {
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.72)",
    backgroundColor: "rgba(255,255,255,0.28)",
    paddingVertical: 11,
    paddingHorizontal: 14
  },
  ghostActionText: {
    color: theme.colors.textSecondary,
    fontWeight: "700"
  },
  dangerAction: {
    borderColor: "rgba(214,69,93,0.42)",
    backgroundColor: "rgba(214,69,93,0.12)"
  },
  dangerActionText: {
    color: theme.colors.danger
  },
  fullWidth: {
    width: "100%",
    marginTop: 16
  },
  pressed: {
    transform: [{ scale: 0.98 }]
  },
  disabled: {
    opacity: 0.65
  }
});
