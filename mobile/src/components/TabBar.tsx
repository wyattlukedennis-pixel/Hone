import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

import { GlassSurface } from "./GlassSurface";
import { theme } from "../theme";
import type { TabKey } from "../types/navigation";

type TabBarProps = {
  activeTab: TabKey;
  onSelect: (tab: TabKey) => void;
};

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "journeys", label: "Practice" },
  { key: "progress", label: "Progress" },
  { key: "settings", label: "Profile" }
];

export function TabBar({ activeTab, onSelect }: TabBarProps) {
  const [width, setWidth] = useState(0);
  const indicatorX = useRef(new Animated.Value(0)).current;

  const activeIndex = useMemo(() => {
    const index = tabs.findIndex((tab) => tab.key === activeTab);
    return index >= 0 ? index : 0;
  }, [activeTab]);

  useEffect(() => {
    if (!width) return;
    const tabWidth = width / tabs.length;
    Animated.spring(indicatorX, {
      toValue: tabWidth * activeIndex,
      damping: 14,
      stiffness: 180,
      mass: 0.6,
      useNativeDriver: true
    }).start();
  }, [activeIndex, indicatorX, width]);

  const tabWidth = width ? width / tabs.length : 0;
  const indicatorWidth = Math.max(tabWidth - 10, 0);

  return (
    <View style={styles.safeWrap}>
      <GlassSurface style={styles.container}>
        <View
          style={styles.row}
          onLayout={(event) => {
            setWidth(event.nativeEvent.layout.width);
          }}
        >
          {tabWidth ? (
            <Animated.View
              pointerEvents="none"
              style={[styles.indicator, { width: indicatorWidth, transform: [{ translateX: indicatorX }] }]}
            />
          ) : null}
          {tabs.map((tab) => {
            const active = tab.key === activeTab;
            return (
              <Pressable key={tab.key} onPress={() => onSelect(tab.key)} style={styles.item}>
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
    borderRadius: 22,
    shadowColor: "#113761",
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
    padding: 6
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    zIndex: 2
  },
  indicator: {
    position: "absolute",
    left: 6,
    top: 6,
    bottom: 6,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.7)",
    zIndex: 1
  },
  label: {
    color: theme.colors.tabText,
    fontSize: 15,
    fontWeight: "700"
  },
  labelActive: {
    color: theme.colors.tabTextActive
  }
});
