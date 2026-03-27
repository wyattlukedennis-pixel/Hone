import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { theme } from "../theme";

type GlassSurfaceProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  tone?: "light" | "dark";
};

export function GlassSurface({ children, style, intensity = 20, tone = "light" }: GlassSurfaceProps) {
  const gradientColors =
    tone === "dark"
      ? ([theme.colors.darkGlassFillTop, theme.colors.darkGlassFillBottom] as const)
      : ([theme.colors.glassFillTop, theme.colors.glassFillBottom] as const);
  return (
    <BlurView intensity={intensity} tint={tone === "dark" ? "dark" : "light"} style={[styles.container, tone === "dark" ? styles.containerDark : null, style]}>
      <LinearGradient colors={gradientColors} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={styles.inner}>{children}</View>
    </BlurView>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: theme.shape.cardRadiusMd,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3
  },
  containerDark: {
    borderColor: theme.colors.darkGlassBorder,
    shadowColor: "#000000",
    shadowOpacity: 0.10,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3
  },
  inner: {}
});
