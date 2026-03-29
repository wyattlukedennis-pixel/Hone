import { useMemo, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { GlassSurface } from "./GlassSurface";
import { theme } from "../theme";
import type { TabKey } from "../types/navigation";
import { triggerSelectionHaptic } from "../utils/feedback";

type TabBarProps = {
  activeTab: TabKey;
  onSelect: (tab: TabKey) => void;
  darkMode?: boolean;
  scrollX?: Animated.Value;
  screenWidth?: number;
};

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "journeys", label: "practice" },
  { key: "progress", label: "progress" },
  { key: "settings", label: "manage" }
];

export function TabBar({ activeTab, onSelect, darkMode, scrollX, screenWidth }: TabBarProps) {
  const [width, setWidth] = useState(0);

  const tabWidth = width ? width / tabs.length : 0;
  const indicatorWidth = Math.max(tabWidth - 10, 0);

  // Map scroll position to indicator position
  const indicatorTranslateX = useMemo(() => {
    if (!scrollX || !screenWidth || !tabWidth) return new Animated.Value(0);
    // scrollX goes 0 → screenWidth → screenWidth*2
    // indicator should go 0 → tabWidth → tabWidth*2
    return scrollX.interpolate({
      inputRange: [0, screenWidth, screenWidth * 2],
      outputRange: [0, tabWidth, tabWidth * 2],
      extrapolate: "clamp",
    });
  }, [scrollX, screenWidth, tabWidth]);

  return (
    <View style={styles.safeWrap}>
      <GlassSurface style={[styles.container, darkMode ? styles.containerDark : null]} intensity={14} tone={darkMode ? "dark" : "light"}>
        <View
          style={styles.row}
          onLayout={(event) => {
            setWidth(event.nativeEvent.layout.width);
          }}
        >
          {tabWidth ? (
            <Animated.View
              pointerEvents="none"
              style={[styles.indicatorShell, { width: indicatorWidth, transform: [{ translateX: indicatorTranslateX }] }]}
            >
              <LinearGradient
                colors={theme.gradients.tabIndicator}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.indicatorFill}
              />
            </Animated.View>
          ) : null}
          {tabs.map((tab) => {
            const active = tab.key === activeTab;
            return (
              <Pressable
                key={tab.key}
                onPress={() => {
                  triggerSelectionHaptic();
                  onSelect(tab.key);
                }}
                style={styles.item}
              >
                <Text style={[styles.label, darkMode ? styles.labelDark : null, active ? styles.labelActive : undefined]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  safeWrap: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12
  },
  container: {
    borderRadius: theme.shape.tabBarRadius,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    backgroundColor: "rgba(243,238,229,0.96)",
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 3
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
    padding: 4
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    zIndex: 2
  },
  indicatorShell: {
    position: "absolute",
    left: 4,
    top: 4,
    bottom: 4,
    borderRadius: theme.shape.tabIndicatorRadius,
    overflow: "hidden",
    shadowColor: "transparent",
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
    zIndex: 1
  },
  indicatorFill: {
    flex: 1
  },
  label: {
    color: "#2c2c2c",
    fontSize: 13,
    letterSpacing: 0.3,
    fontWeight: "800",
    fontFamily: theme.typography.label
  },
  labelActive: {
    color: "#ffffff",
    fontWeight: "900",
    fontFamily: theme.typography.label
  },
  containerDark: {
    borderColor: theme.darkColors.tabBorder,
    backgroundColor: theme.darkColors.tabBg,
  },
  labelDark: {
    color: theme.darkColors.textSecondary,
  }
});
