import { useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from "react-native";

import { theme } from "../theme";
import { triggerSelectionHaptic } from "../utils/feedback";
import { useReducedMotion } from "../utils/useReducedMotion";

type TactilePressableProps = Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  pressScale?: number;
  pressedOpacity?: number;
  stretch?: boolean;
};

export function TactilePressable({
  style,
  contentStyle,
  pressScale = 0.982,
  pressedOpacity = 0.94,
  stretch = false,
  disabled,
  onPressIn,
  onPressOut,
  hitSlop,
  pressRetentionOffset,
  ...rest
}: TactilePressableProps) {
  const reducedMotion = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  function handlePress(event: Parameters<NonNullable<PressableProps["onPress"]>>[0]) {
    if (!disabled) {
      triggerSelectionHaptic();
    }
    rest.onPress?.(event);
  }

  function handlePressIn(event: Parameters<NonNullable<PressableProps["onPressIn"]>>[0]) {
    onPressIn?.(event);
    if (disabled) return;
    if (reducedMotion) {
      scale.setValue(1);
      opacity.setValue(1);
      return;
    }

    const micro = Math.min(theme.motion.microMs, 72);
    Animated.parallel([
      Animated.timing(scale, {
        toValue: pressScale,
        duration: micro,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true
      }),
      Animated.timing(opacity, {
        toValue: pressedOpacity,
        duration: micro,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true
      })
    ]).start();
  }

  function handlePressOut(event: Parameters<NonNullable<PressableProps["onPressOut"]>>[0]) {
    onPressOut?.(event);
    if (disabled) return;
    if (reducedMotion) {
      scale.setValue(1);
      opacity.setValue(1);
      return;
    }

    const micro = Math.min(theme.motion.microMs, 72);
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

  return (
    <Animated.View style={[stretch ? styles.stretchWrap : null, { transform: [{ scale }], opacity }]}>
      <Pressable
        {...rest}
        disabled={disabled}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[style, contentStyle]}
        hitSlop={hitSlop ?? 14}
        pressRetentionOffset={pressRetentionOffset ?? 22}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stretchWrap: {
    alignSelf: "stretch"
  }
});
