import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { GlassSurface } from "../../components/GlassSurface";
import { TactilePressable } from "../../components/TactilePressable";
import { theme } from "../../theme";
import type { Clip } from "../../types/clip";

type TimelineEntry = {
  clip: Clip;
  day: number;
  isMilestone: boolean;
};

type ProgressCalendarCardProps = {
  entries: TimelineEntry[];
  selectedDay: number | null;
  compareSelectedClipIds: string[];
  comparisonEnabled?: boolean;
  onSelectEntry: (entry: TimelineEntry, index: number) => void;
  onClearCompareSelection: () => void;
};

type CalendarCell = {
  key: string;
  day: number | null;
  entry: TimelineEntry | null;
};

const weekdayLabels = ["S", "M", "T", "W", "T", "F", "S"];

function toDateKey(value: Date) {
  const y = value.getFullYear();
  const m = `${value.getMonth() + 1}`.padStart(2, "0");
  const d = `${value.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dayKeyToDate(value: string) {
  const [year, month, day] = value.split("-").map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  const parsed = new Date(year, month - 1, day);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function ProgressCalendarCard({
  entries,
  selectedDay,
  compareSelectedClipIds,
  comparisonEnabled = true,
  onSelectEntry,
  onClearCompareSelection
}: ProgressCalendarCardProps) {
  const [monthOffset, setMonthOffset] = useState(0);

  useEffect(() => {
    setMonthOffset(0);
  }, [entries.length, entries[0]?.clip.id, entries[entries.length - 1]?.clip.id]);

  const entryIndexById = useMemo(() => {
    const map = new Map<string, number>();
    entries.forEach((entry, index) => {
      map.set(entry.clip.id, index);
    });
    return map;
  }, [entries]);

  const {
    monthLabel,
    cells,
    canGoPrev,
    canGoNext
  } = useMemo(() => {
    const entriesByDate = new Map<string, TimelineEntry>();
    entries.forEach((entry) => {
      entriesByDate.set(entry.clip.recordedOn.slice(0, 10), entry);
    });

    const latestAnchor =
      entries.length > 0
        ? dayKeyToDate(entries[entries.length - 1].clip.recordedOn.slice(0, 10)) ?? new Date(entries[entries.length - 1].clip.recordedAt)
        : new Date();
    const earliestAnchor =
      entries.length > 0 ? dayKeyToDate(entries[0].clip.recordedOn.slice(0, 10)) ?? new Date(entries[0].clip.recordedAt) : latestAnchor;
    const latestMonthIndex = latestAnchor.getFullYear() * 12 + latestAnchor.getMonth();
    const earliestMonthIndex = earliestAnchor.getFullYear() * 12 + earliestAnchor.getMonth();
    const displayMonthIndex = latestMonthIndex + monthOffset;
    const year = Math.floor(displayMonthIndex / 12);
    const month = displayMonthIndex % 12;
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);
    const totalDays = monthEnd.getDate();
    const firstWeekday = monthStart.getDay();

    const results: CalendarCell[] = [];
    for (let index = 0; index < firstWeekday; index += 1) {
      results.push({ key: `pad-start-${index}`, day: null, entry: null });
    }
    for (let day = 1; day <= totalDays; day += 1) {
      const date = new Date(year, month, day);
      const key = toDateKey(date);
      results.push({
        key,
        day,
        entry: entriesByDate.get(key) ?? null
      });
    }
    while (results.length % 7 !== 0) {
      results.push({ key: `pad-end-${results.length}`, day: null, entry: null });
    }

    return {
      monthLabel: monthStart.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
      cells: results,
      canGoPrev: displayMonthIndex > earliestMonthIndex,
      canGoNext: displayMonthIndex < latestMonthIndex
    };
  }, [entries, monthOffset]);

  return (
    <GlassSurface style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Practice Calendar</Text>
          <Text style={styles.subtitle}>
            {comparisonEnabled ? "Tap a day to preview this chapter." : "Tap a day to revisit that chapter clip."}
          </Text>
        </View>
        {compareSelectedClipIds.length > 0 ? (
          <TactilePressable style={styles.clearChip} onPress={onClearCompareSelection}>
            <Text style={styles.clearChipText}>Clear</Text>
          </TactilePressable>
        ) : null}
      </View>

      <View style={styles.monthNavRow}>
        <TactilePressable style={[styles.monthNavChip, !canGoPrev ? styles.monthNavChipDisabled : undefined]} onPress={() => setMonthOffset((value) => value - 1)} disabled={!canGoPrev}>
          <Text style={styles.monthNavText}>Prev</Text>
        </TactilePressable>
        <Text style={styles.monthLabel}>{monthLabel}</Text>
        <TactilePressable style={[styles.monthNavChip, !canGoNext ? styles.monthNavChipDisabled : undefined]} onPress={() => setMonthOffset((value) => value + 1)} disabled={!canGoNext}>
          <Text style={styles.monthNavText}>Next</Text>
        </TactilePressable>
      </View>
      <View style={styles.weekdayRow}>
        {weekdayLabels.map((label, index) => (
          <Text key={`${label}-${index}`} style={styles.weekdayLabel}>
            {label}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((cell, index) => {
          if (!cell.day) {
            return <View key={cell.key} style={styles.dayCellEmpty} />;
          }

          const entry = cell.entry;
          const isRecorded = Boolean(entry);
          const isSelectedDay = Boolean(entry && entry.day === selectedDay);
          const isCompareSelected = Boolean(entry && compareSelectedClipIds.includes(entry.clip.id));

          const containerStyle = [
            styles.dayCell,
            isRecorded ? styles.dayCellRecorded : styles.dayCellMissed,
            isSelectedDay ? styles.dayCellSelected : undefined,
            isCompareSelected ? styles.dayCellCompareSelected : undefined
          ];

          if (!entry) {
            return (
              <View key={`${cell.key}-${index}`} style={containerStyle}>
                <Text style={styles.dayLabelMissed}>{cell.day}</Text>
              </View>
            );
          }

          return (
            <TactilePressable
              key={`${cell.key}-${index}`}
              style={containerStyle}
              onPress={() => onSelectEntry(entry, entryIndexById.get(entry.clip.id) ?? 0)}
            >
              <Text style={styles.dayLabelRecorded}>{cell.day}</Text>
            </TactilePressable>
          );
        })}
      </View>

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.legendDotRecorded]} />
          <Text style={styles.legendText}>Recorded</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.legendDotMissed]} />
          <Text style={styles.legendText}>No clip</Text>
        </View>
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 18,
    borderRadius: theme.shape.cardRadiusLg,
    borderWidth: 2,
    borderColor: "#ffffff",
    backgroundColor: "rgba(246,240,232,0.98)",
    padding: 16
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 24,
    fontWeight: "800",
    fontFamily: theme.typography.display
  },
  subtitle: {
    marginTop: 4,
    color: theme.colors.textSecondary,
    fontWeight: "600",
    maxWidth: 280,
    fontFamily: theme.typography.body
  },
  clearChip: {
    borderRadius: theme.shape.pillRadius,
    borderWidth: 2,
    borderColor: "#ffffff",
    backgroundColor: "rgba(241,233,221,0.94)",
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  clearChipText: {
    color: theme.colors.textSecondary,
    fontWeight: "800",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.78,
    fontFamily: theme.typography.label
  },
  monthLabel: {
    color: theme.colors.textPrimary,
    fontWeight: "800",
    fontSize: 16,
    fontFamily: theme.typography.display
  },
  monthNavRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  monthNavChip: {
    borderRadius: theme.shape.pillRadius,
    borderWidth: 2,
    borderColor: "#ffffff",
    backgroundColor: "rgba(241,233,221,0.94)",
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  monthNavChipDisabled: {
    opacity: 0.45
  },
  monthNavText: {
    color: theme.colors.textSecondary,
    fontWeight: "800",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.72,
    fontFamily: theme.typography.label
  },
  weekdayRow: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between"
  },
  weekdayLabel: {
    width: `${100 / 7}%`,
    textAlign: "center",
    color: theme.colors.textSecondary,
    fontWeight: "800",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.72,
    fontFamily: theme.typography.label
  },
  grid: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 8
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    borderRadius: theme.shape.cardRadiusMd,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center"
  },
  dayCellEmpty: {
    width: `${100 / 7}%`,
    aspectRatio: 1
  },
  dayCellMissed: {
    borderColor: "#9a8f80",
    backgroundColor: "rgba(237,229,217,0.8)"
  },
  dayCellRecorded: {
    borderColor: "#ffffff",
    backgroundColor: "rgba(255,90,31,0.24)"
  },
  dayCellSelected: {
    borderColor: "#ffffff",
    borderWidth: 3
  },
  dayCellCompareSelected: {
    backgroundColor: "rgba(13,159,101,0.2)",
    borderColor: "#ffffff"
  },
  dayLabelMissed: {
    color: "rgba(42,42,42,0.58)",
    fontWeight: "600"
  },
  dayLabelRecorded: {
    color: theme.colors.textPrimary,
    fontWeight: "800"
  },
  legendRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 14
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 0,
    borderWidth: 2,
    borderColor: "#ffffff"
  },
  legendDotRecorded: {
    backgroundColor: "rgba(255,90,31,0.58)"
  },
  legendDotMissed: {
    backgroundColor: "rgba(237,229,217,0.8)"
  },
  legendText: {
    color: theme.colors.textSecondary,
    fontWeight: "600",
    fontSize: 12
  }
});
