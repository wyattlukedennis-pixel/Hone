import { useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { theme } from "../../theme";
import { triggerSelectionHaptic } from "../../utils/feedback";
import { useReducedMotion } from "../../utils/useReducedMotion";

type ActionButtonProps = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  fullWidth?: boolean;
  dense?: boolean;
};

export function ActionButton({
  label,
  onPress,
  variant = "ghost",
  disabled,
  loading,
  loadingLabel,
  fullWidth,
  dense = false
}: ActionButtonProps) {
  const reducedMotion = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const text = loading ? loadingLabel ?? "Working..." : label;
  const pressDisabled = Boolean(disabled || loading);

  function handlePressIn() {
    if (pressDisabled) return;
    if (reducedMotion) {
      scale.setValue(1);
      opacity.setValue(1);
      return;
    }
    const micro = Math.min(theme.motion.microMs, 75);
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 0.976,
        duration: micro,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true
      }),
      Animated.timing(opacity, {
        toValue: 0.92,
        duration: micro,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true
      })
    ]).start();
  }

  function handlePressOut() {
    if (pressDisabled) return;
    if (reducedMotion) {
      scale.setValue(1);
      opacity.setValue(1);
      return;
    }
    const micro = Math.min(theme.motion.microMs, 75);
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        damping: 18,
        stiffness: 420,
        mass: 0.5,
        useNativeDriver: true
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: micro,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true
      })
    ]).start();
  }

  function handlePress() {
    if (pressDisabled) return;
    triggerSelectionHaptic();
    onPress();
  }

  if (variant === "primary") {
    return (
      <Animated.View
        style={[
          fullWidth ? styles.fullWidth : undefined,
          dense && fullWidth ? styles.fullWidthDense : undefined,
          { transform: [{ scale }], opacity }
        ]}
      >
        <Pressable
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={pressDisabled}
          hitSlop={12}
          pressRetentionOffset={18}
          style={[styles.primaryAction, dense ? styles.primaryActionDense : undefined, pressDisabled ? styles.disabled : undefined]}
        >
          <LinearGradient
            colors={["#2b78f2", "#0f5be0"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.primaryActionFill, dense ? styles.primaryActionFillDense : undefined]}
          >
            <Text style={[styles.primaryActionText, dense ? styles.primaryActionTextDense : undefined]}>{text}</Text>
          </LinearGradient>
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[
        fullWidth ? styles.fullWidth : undefined,
        dense && fullWidth ? styles.fullWidthDense : undefined,
        { transform: [{ scale }], opacity }
      ]}
    >
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={pressDisabled}
        hitSlop={12}
        pressRetentionOffset={18}
        style={[styles.ghostAction, variant === "danger" ? styles.dangerAction : undefined, pressDisabled ? styles.disabled : undefined]}
      >
        <Text style={[styles.ghostActionText, variant === "danger" ? styles.dangerActionText : undefined]}>{text}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  primaryAction: {
    borderRadius: 16,
    borderWidth: 0,
    borderColor: "transparent",
    overflow: "hidden",
    shadowColor: "#0d4fbf",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
    elevation: 5
  },
  primaryActionDense: {
    minHeight: 44
  },
  primaryActionFill: {
    minHeight: 48,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center"
  },
  primaryActionFillDense: {
    minHeight: 42
  },
  primaryActionText: {
    color: "#edf5ff",
    fontWeight: "800",
    fontSize: 16
  },
  primaryActionTextDense: {
    fontSize: 15
  },
  ghostAction: {
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.66)",
    backgroundColor: "rgba(245,251,255,0.42)",
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
  fullWidthDense: {
    marginTop: 10
  },
  disabled: {
    opacity: 0.65
  }
});
