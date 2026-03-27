import { useEffect, useMemo, useRef } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { theme } from "../theme";
import { triggerSelectionHaptic } from "../utils/feedback";

type TimeWheelPickerProps = {
  hour24: number;
  minute: number;
  disabled?: boolean;
  onChange: (next: { hour24: number; minute: number }) => void;
};

const ITEM_HEIGHT = 38;
const VISIBLE_ROWS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ROWS;
const PADDING_Y = (PICKER_HEIGHT - ITEM_HEIGHT) / 2;
const MERIDIEM_OPTIONS = ["AM", "PM"] as const;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function toHour12(hour24: number) {
  const value = hour24 % 12;
  return value === 0 ? 12 : value;
}

function toMeridiem(hour24: number): (typeof MERIDIEM_OPTIONS)[number] {
  return hour24 >= 12 ? "PM" : "AM";
}

function toHour24(hour12: number, meridiem: (typeof MERIDIEM_OPTIONS)[number]) {
  if (meridiem === "AM") return hour12 === 12 ? 0 : hour12;
  return hour12 === 12 ? 12 : hour12 + 12;
}

export function TimeWheelPicker({ hour24, minute, disabled = false, onChange }: TimeWheelPickerProps) {
  const hourRef = useRef<ScrollView | null>(null);
  const minuteRef = useRef<ScrollView | null>(null);
  const meridiemRef = useRef<ScrollView | null>(null);
  const hourIndexRef = useRef(0);
  const minuteIndexRef = useRef(0);
  const meridiemIndexRef = useRef(0);
  const hourInteractingRef = useRef(false);
  const minuteInteractingRef = useRef(false);
  const meridiemInteractingRef = useRef(false);

  const hour12 = toHour12(hour24);
  const meridiem = toMeridiem(hour24);

  const hourItems = useMemo(() => Array.from({ length: 12 }, (_, index) => index + 1), []);
  const minuteItems = useMemo(() => Array.from({ length: 60 }, (_, value) => value), []);

  useEffect(() => {
    hourIndexRef.current = hour12 - 1;
  }, [hour12]);

  useEffect(() => {
    minuteIndexRef.current = minute;
  }, [minute]);

  useEffect(() => {
    meridiemIndexRef.current = meridiem === "AM" ? 0 : 1;
  }, [meridiem]);

  useEffect(() => {
    hourRef.current?.scrollTo({ y: (hour12 - 1) * ITEM_HEIGHT, animated: false });
  }, [hour12]);

  useEffect(() => {
    minuteRef.current?.scrollTo({ y: minute * ITEM_HEIGHT, animated: false });
  }, [minute]);

  useEffect(() => {
    meridiemRef.current?.scrollTo({ y: (meridiem === "AM" ? 0 : 1) * ITEM_HEIGHT, animated: false });
  }, [meridiem]);

  function emitStepHaptics(indexRef: { current: number }, rawNextIndex: number, maxIndex: number) {
    const nextIndex = clamp(rawNextIndex, 0, maxIndex);
    const priorIndex = indexRef.current;
    if (nextIndex === priorIndex) return;
    const steps = Math.abs(nextIndex - priorIndex);
    for (let i = 0; i < steps; i += 1) {
      triggerSelectionHaptic();
    }
    indexRef.current = nextIndex;
  }

  function handleHourScrollEnd(offsetY: number) {
    const nextHour12 = clamp(Math.round(offsetY / ITEM_HEIGHT), 0, 11) + 1;
    if (nextHour12 === hour12) return;
    onChange({ hour24: toHour24(nextHour12, meridiem), minute });
  }

  function handleMinuteScrollEnd(offsetY: number) {
    const nextMinute = clamp(Math.round(offsetY / ITEM_HEIGHT), 0, 59);
    if (nextMinute === minute) return;
    onChange({ hour24, minute: nextMinute });
  }

  function handleMeridiemScrollEnd(offsetY: number) {
    const nextIndex = clamp(Math.round(offsetY / ITEM_HEIGHT), 0, 1);
    const nextMeridiem = MERIDIEM_OPTIONS[nextIndex];
    if (nextMeridiem === meridiem) return;
    onChange({ hour24: toHour24(hour12, nextMeridiem), minute });
  }

  return (
    <View style={[styles.wrap, disabled ? styles.wrapDisabled : undefined]}>
      <View style={styles.wheelsRow}>
        <View style={styles.wheelCol}>
          <Text style={styles.wheelLabel}>Hour</Text>
          <View style={styles.wheelSurface}>
            <View style={styles.centerHighlight} pointerEvents="none" />
            <ScrollView
              ref={hourRef}
              showsVerticalScrollIndicator={false}
              snapToInterval={ITEM_HEIGHT}
              decelerationRate="fast"
              scrollEnabled={!disabled}
              contentContainerStyle={styles.wheelContent}
              onScrollBeginDrag={() => {
                hourInteractingRef.current = true;
              }}
              onScrollEndDrag={(event) => {
                if (!event.nativeEvent.velocity?.y) {
                  hourInteractingRef.current = false;
                }
              }}
              onMomentumScrollBegin={() => {
                hourInteractingRef.current = true;
              }}
              onScroll={(event) => {
                if (disabled || !hourInteractingRef.current) return;
                emitStepHaptics(hourIndexRef, Math.round(event.nativeEvent.contentOffset.y / ITEM_HEIGHT), 11);
              }}
              scrollEventThrottle={16}
              onMomentumScrollEnd={(event) => {
                hourInteractingRef.current = false;
                handleHourScrollEnd(event.nativeEvent.contentOffset.y);
              }}
            >
              {hourItems.map((value) => (
                <View key={`h-${value}`} style={styles.itemRow}>
                  <Text style={[styles.itemText, value === hour12 ? styles.itemTextActive : undefined]}>{value}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>

        <View style={styles.wheelCol}>
          <Text style={styles.wheelLabel}>Minute</Text>
          <View style={styles.wheelSurface}>
            <View style={styles.centerHighlight} pointerEvents="none" />
            <ScrollView
              ref={minuteRef}
              showsVerticalScrollIndicator={false}
              snapToInterval={ITEM_HEIGHT}
              decelerationRate="fast"
              scrollEnabled={!disabled}
              contentContainerStyle={styles.wheelContent}
              onScrollBeginDrag={() => {
                minuteInteractingRef.current = true;
              }}
              onScrollEndDrag={(event) => {
                if (!event.nativeEvent.velocity?.y) {
                  minuteInteractingRef.current = false;
                }
              }}
              onMomentumScrollBegin={() => {
                minuteInteractingRef.current = true;
              }}
              onScroll={(event) => {
                if (disabled || !minuteInteractingRef.current) return;
                emitStepHaptics(minuteIndexRef, Math.round(event.nativeEvent.contentOffset.y / ITEM_HEIGHT), 59);
              }}
              scrollEventThrottle={16}
              onMomentumScrollEnd={(event) => {
                minuteInteractingRef.current = false;
                handleMinuteScrollEnd(event.nativeEvent.contentOffset.y);
              }}
            >
              {minuteItems.map((value) => (
                <View key={`m-${value}`} style={styles.itemRow}>
                  <Text style={[styles.itemText, value === minute ? styles.itemTextActive : undefined]}>
                    {`${value}`.padStart(2, "0")}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>

        <View style={[styles.wheelCol, styles.meridiemCol]}>
          <Text style={styles.wheelLabel}>Period</Text>
          <View style={styles.wheelSurface}>
            <View style={styles.centerHighlight} pointerEvents="none" />
            <ScrollView
              ref={meridiemRef}
              showsVerticalScrollIndicator={false}
              snapToInterval={ITEM_HEIGHT}
              decelerationRate="fast"
              scrollEnabled={!disabled}
              contentContainerStyle={styles.wheelContent}
              onScrollBeginDrag={() => {
                meridiemInteractingRef.current = true;
              }}
              onScrollEndDrag={(event) => {
                if (!event.nativeEvent.velocity?.y) {
                  meridiemInteractingRef.current = false;
                }
              }}
              onMomentumScrollBegin={() => {
                meridiemInteractingRef.current = true;
              }}
              onScroll={(event) => {
                if (disabled || !meridiemInteractingRef.current) return;
                emitStepHaptics(meridiemIndexRef, Math.round(event.nativeEvent.contentOffset.y / ITEM_HEIGHT), 1);
              }}
              scrollEventThrottle={16}
              onMomentumScrollEnd={(event) => {
                meridiemInteractingRef.current = false;
                handleMeridiemScrollEnd(event.nativeEvent.contentOffset.y);
              }}
            >
              {MERIDIEM_OPTIONS.map((value) => (
                <View key={value} style={styles.itemRow}>
                  <Text style={[styles.itemText, value === meridiem ? styles.itemTextActive : undefined]}>{value}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 10
  },
  wrapDisabled: {
    opacity: 0.62
  },
  wheelsRow: {
    flexDirection: "row",
    gap: 10
  },
  wheelCol: {
    flex: 1
  },
  wheelLabel: {
    marginBottom: 6,
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: "700"
  },
  wheelSurface: {
    height: PICKER_HEIGHT,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.66)",
    backgroundColor: "rgba(255,255,255,0.3)",
    overflow: "hidden"
  },
  wheelContent: {
    paddingVertical: PADDING_Y
  },
  centerHighlight: {
    position: "absolute",
    left: 6,
    right: 6,
    top: PADDING_Y,
    height: ITEM_HEIGHT,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,90,31,0.30)",
    backgroundColor: "rgba(255,90,31,0.10)"
  },
  itemRow: {
    height: ITEM_HEIGHT,
    alignItems: "center",
    justifyContent: "center"
  },
  itemText: {
    color: theme.colors.textSecondary,
    fontSize: 17,
    fontWeight: "600"
  },
  itemTextActive: {
    color: theme.colors.accentStrong,
    fontWeight: "800"
  },
  meridiemCol: {
    maxWidth: 92
  }
});
