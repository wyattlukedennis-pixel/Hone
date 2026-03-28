import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { GlassSurface } from "./GlassSurface";
import { theme } from "../theme";
import type { TabKey } from "../types/navigation";
import { triggerSelectionHaptic } from "../utils/feedback";
import { useReducedMotion } from "../utils/useReducedMotion";

type TabBarProps = {
  activeTab: TabKey;
  onSelect: (tab: TabKey) => void;
};

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "journeys", label: "practice" },
  { key: "progress", label: "progress" },
  { key: "settings", label: "manage" }
];

export function TabBar({ activeTab, onSelect }: TabBarProps) {
  const [width, setWidth] = useState(0);
  const reducedMotion = useReducedMotion();
  const indicatorX = useRef(new Animated.Value(0)).current;

  const activeIndex = useMemo(() => {
    const index = tabs.findIndex((tab) => tab.key === activeTab);
    return index >= 0 ? index : 0;
  }, [activeTab]);

  useEffect(() => {
    if (!width) return;
    const tabWidth = width / tabs.length;
    if (reducedMotion) {
      indicatorX.setValue(tabWidth * activeIndex);
      return;
    }
    Animated.spring(indicatorX, {
      toValue: tabWidth * activeIndex,
      damping: 14,
      stiffness: 180,
      mass: 0.6,
      useNativeDriver: true
    }).start();
  }, [activeIndex, indicatorX, reducedMotion, width]);

  const tabWidth = width ? width / tabs.length : 0;
  const indicatorWidth = Math.max(tabWidth - 10, 0);

  return (
    <View style={styles.safeWrap}>
      <GlassSurface style={styles.container} intensity={14}>
        <View
          style={styles.row}
          onLayout={(event) => {
            setWidth(event.nativeEvent.layout.width);
          }}
        >
          {tabWidth ? (
            <Animated.View
              pointerEvents="none"
              style={[styles.indicatorShell, { width: indicatorWidth, transform: [{ translateX: indicatorX }] }]}
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
                <Text style={[styles.label, active ? styles.labelActive : undefined]}>{tab.label}</Text>
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
  }
});
