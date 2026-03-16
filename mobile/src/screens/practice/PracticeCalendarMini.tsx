import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Modal, StyleSheet, Text, View } from "react-native";
import { ResizeMode } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LoopingVideoPlayer } from "../../components/LoopingVideoPlayer";
import { TactilePressable } from "../../components/TactilePressable";
import { theme } from "../../theme";
import type { Clip } from "../../types/clip";

type PracticeCalendarMiniProps = {
  clips: Clip[];
  now: Date;
  compact?: boolean;
  hero?: boolean;
  fill?: boolean;
  scene?: boolean;
  captureMode?: "video" | "photo";
  milestoneLengthDays?: number;
  milestoneProgressDays?: number;
  revealReady?: boolean;
  onReRecordToday?: () => void;
};

export function PracticeCalendarMini({
  clips,
  now,
  compact = false,
  hero = false,
  fill = false,
  scene = false,
  captureMode = "video",
  milestoneLengthDays = 0,
  milestoneProgressDays = 0,
  revealReady = false,
  onReRecordToday
}: PracticeCalendarMiniProps) {
  const insets = useSafeAreaInsets();
  const currentMonthStart = useMemo(() => new Date(now.getFullYear(), now.getMonth(), 1), [now]);
  const currentMonthKey = `${currentMonthStart.getFullYear()}-${currentMonthStart.getMonth()}`;
  const [displayMonthStart, setDisplayMonthStart] = useState(currentMonthStart);
  const [activeDayKey, setActiveDayKey] = useState<string | null>(null);
  const [dayViewerClip, setDayViewerClip] = useState<Clip | null>(null);
  const [monthAnimating, setMonthAnimating] = useState(false);
  const monthFade = useRef(new Animated.Value(1)).current;
  const monthTranslate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setDisplayMonthStart(currentMonthStart);
    setActiveDayKey(null);
  }, [currentMonthKey]);

  const progressLabel =
    milestoneLengthDays > 0 ? `${Math.min(milestoneProgressDays, milestoneLengthDays)} of ${milestoneLengthDays}` : null;
  const monthLabel = displayMonthStart.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const dayClipsByKey = useMemo(() => {
    const map = new Map<string, { latest: Clip | null; video: Clip | null; photo: Clip | null }>();
    for (const clip of clips) {
      const key = clip.recordedOn.slice(0, 10);
      const current = map.get(key) ?? { latest: null, video: null, photo: null };
      const clipTime = new Date(clip.recordedAt).getTime();
      const latestTime = current.latest ? new Date(current.latest.recordedAt).getTime() : 0;
      if (!current.latest || clipTime > latestTime) {
        current.latest = clip;
      }
      if (clip.captureType === "video") {
        const videoTime = current.video ? new Date(current.video.recordedAt).getTime() : 0;
        if (!current.video || clipTime > videoTime) current.video = clip;
      }
      if (clip.captureType === "photo") {
        const photoTime = current.photo ? new Date(current.photo.recordedAt).getTime() : 0;
        if (!current.photo || clipTime > photoTime) current.photo = clip;
      }
      map.set(key, current);
    }
    return map;
  }, [clips]);
  const clipByDayKey = useMemo(() => {
    const map = new Map<string, Clip>();
    for (const [key, value] of dayClipsByKey.entries()) {
      if (value.latest) map.set(key, value.latest);
    }
    return map;
  }, [dayClipsByKey]);
  const practicedDayKeys = useMemo(() => {
    const qualified = new Set<string>();
    for (const [key, value] of dayClipsByKey.entries()) {
      const hasVideo = Boolean(value.video);
      const hasPhoto = Boolean(value.photo);
      const isQualified = captureMode === "photo" ? hasPhoto : hasVideo;
      if (isQualified) qualified.add(key);
    }
    return qualified;
  }, [captureMode, dayClipsByKey]);
  const revealDayKey = useMemo(() => {
    if (!revealReady || clips.length === 0) return null;
    const latestClip = clips.reduce((latest, clip) => (clip.recordedOn > latest.recordedOn ? clip : latest), clips[0]);
    return latestClip.recordedOn.slice(0, 10);
  }, [clips, revealReady]);
  const todayKey = useMemo(() => new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())).toISOString().slice(0, 10), [now]);
  const canGoNext = displayMonthStart.getTime() < currentMonthStart.getTime();
  const sceneMode = hero && scene;
  const heroCellSize = sceneMode ? (compact ? 30 : 34) : 44;
  const heroCellRadius = sceneMode ? 10 : 13;
  const heroRowGap = sceneMode ? 6 : 9;
  const heroNavSize = sceneMode ? 38 : 44;
  const heroNavRadius = heroNavSize / 2;
  const heroNavIconSize = sceneMode ? 20 : 24;
  const heroMonthTitleSize = sceneMode ? 24 : 32;
  const heroMonthTitleLineHeight = sceneMode ? 28 : 36;
  const heroPaddingHorizontal = sceneMode ? 16 : 20;
  const heroPaddingTop = sceneMode ? 12 : 15;
  const heroPaddingBottom = sceneMode ? 12 : 16;

  const monthCells = useMemo(() => {
    const year = displayMonthStart.getFullYear();
    const month = displayMonthStart.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const totalCells = sceneMode ? 42 : Math.ceil((firstWeekday + daysInMonth) / 7) * 7;

    return Array.from({ length: totalCells }).map((_, index) => {
      const day = index - firstWeekday + 1;
      if (day < 1 || day > daysInMonth) {
        return { key: `empty-${index}`, day: null, dateKey: null };
      }
      const dateKey = new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
      return { key: dateKey, day, dateKey };
    });
  }, [displayMonthStart, sceneMode]);

  const weekdayLabels = ["S", "M", "T", "W", "T", "F", "S"];
  const dayViewerDateLabel = dayViewerClip
    ? new Date(dayViewerClip.recordedOn).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : "";
  const dayViewerDayNumber = dayViewerClip
    ? Math.max(1, new Set(clips.filter((clip) => clip.recordedOn <= dayViewerClip.recordedOn).map((clip) => clip.recordedOn.slice(0, 10))).size)
    : null;

  function shiftMonth(delta: number) {
    if (monthAnimating) return;
    const direction = delta > 0 ? 1 : -1;
    setMonthAnimating(true);

    Animated.parallel([
      Animated.timing(monthFade, {
        toValue: 0,
        duration: 120,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true
      }),
      Animated.timing(monthTranslate, {
        toValue: -10 * direction,
        duration: 120,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true
      })
    ]).start(() => {
      setDisplayMonthStart((prev) => {
        const next = new Date(prev.getFullYear(), prev.getMonth() + delta, 1);
        if (next.getTime() > currentMonthStart.getTime()) return prev;
        return next;
      });
      monthTranslate.setValue(6 * direction);
      Animated.parallel([
        Animated.timing(monthFade, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true
        }),
        Animated.timing(monthTranslate, {
          toValue: 0,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true
        })
      ]).start(() => {
        setMonthAnimating(false);
      });
    });
  }

  return (
    <>
      <View
        style={[
          styles.card,
          compact ? styles.cardCompact : undefined,
          hero ? styles.cardHero : undefined,
          compact && hero ? styles.cardHeroCompact : undefined,
          hero && fill ? styles.cardHeroFill : undefined,
          sceneMode ? styles.cardHeroScene : undefined
        ]}
      >
        {hero ? (
          <LinearGradient
            colors={["rgba(242,250,255,0.96)", "rgba(188,210,241,0.9)"]}
            style={[
              styles.heroGradient,
              fill ? styles.heroGradientFill : undefined,
              sceneMode ? styles.heroGradientScene : undefined,
              {
                paddingHorizontal: heroPaddingHorizontal,
                paddingTop: heroPaddingTop,
                paddingBottom: heroPaddingBottom
              }
            ]}
          >
            <View style={styles.heroHeaderRow}>
              <View>
                <Text style={[styles.heroTitle, { fontSize: heroMonthTitleSize, lineHeight: heroMonthTitleLineHeight }]}>{monthLabel}</Text>
              </View>
              {progressLabel ? (
                <View style={styles.heroProgressPill}>
                  <Text style={styles.heroProgressPillText}>{progressLabel}</Text>
                </View>
              ) : null}
            </View>

            <View style={[styles.monthNavRow, sceneMode ? styles.monthNavRowScene : undefined]}>
              <TactilePressable
                style={[
                  styles.monthArrowButton,
                  sceneMode ? { width: heroNavSize, height: heroNavSize, borderRadius: heroNavRadius } : undefined,
                  monthAnimating ? styles.monthArrowButtonDisabled : undefined
                ]}
                pressScale={0.98}
                onPress={() => shiftMonth(-1)}
                disabled={monthAnimating}
                accessibilityRole="button"
                accessibilityLabel="Previous month"
              >
                <Text style={[styles.monthArrowText, { fontSize: heroNavIconSize, lineHeight: heroNavIconSize }]}>{"‹"}</Text>
              </TactilePressable>
              <View style={styles.monthNavSpacer} />
              <TactilePressable
                style={[
                  styles.monthArrowButton,
                  sceneMode ? { width: heroNavSize, height: heroNavSize, borderRadius: heroNavRadius } : undefined,
                  !canGoNext || monthAnimating ? styles.monthArrowButtonDisabled : undefined
                ]}
                pressScale={0.98}
                onPress={() => shiftMonth(1)}
                disabled={!canGoNext || monthAnimating}
                accessibilityRole="button"
                accessibilityLabel="Next month"
              >
                <Text style={[styles.monthArrowText, { fontSize: heroNavIconSize, lineHeight: heroNavIconSize }, !canGoNext ? styles.monthArrowTextDisabled : undefined]}>
                  {"›"}
                </Text>
              </TactilePressable>
            </View>

            <Animated.View style={{ opacity: monthFade, transform: [{ translateX: monthTranslate }] }}>
              <View style={[styles.weekdayRow, fill ? styles.weekdayRowFill : undefined, sceneMode ? styles.weekdayRowScene : undefined]}>
                {weekdayLabels.map((label, index) => (
                  <Text key={`${label}-${index}`} style={[styles.weekdayLabel, { width: heroCellSize }]}>
                    {label}
                  </Text>
                ))}
              </View>

              <View style={[styles.gridHero, fill ? styles.gridHeroFill : undefined, { gap: heroRowGap }]}>
                {Array.from({ length: monthCells.length / 7 }).map((_, weekIndex) => (
                  <View key={`w-${weekIndex}`} style={[styles.weekRowHero, { minHeight: heroCellSize }]}>
                    {monthCells.slice(weekIndex * 7, weekIndex * 7 + 7).map((cell) => {
                      if (!cell.day || !cell.dateKey) {
                        return (
                          <View
                            key={cell.key}
                            style={[
                              styles.cellHeroGhost,
                              sceneMode ? styles.cellHeroGhostScene : undefined,
                              {
                                width: heroCellSize,
                                height: heroCellSize,
                                borderRadius: heroCellRadius
                              }
                            ]}
                          />
                        );
                      }
                      const dayCapture = dayClipsByKey.get(cell.dateKey);
                      const hasPhoto = Boolean(dayCapture?.photo);
                      const practiced = practicedDayKeys.has(cell.dateKey);
                      const isToday = cell.dateKey === todayKey;
                      const isRevealDay = revealDayKey === cell.dateKey;
                      const canOpenDay = isToday && Boolean(clipByDayKey.get(todayKey));
                      return (
                        <TactilePressable
                          key={cell.key}
                          pressScale={0.94}
                          hitSlop={3}
                          pressRetentionOffset={8}
                          disabled={!canOpenDay}
                          onPress={() => {
                            if (!canOpenDay) return;
                            setActiveDayKey(cell.dateKey);
                            const clip = clipByDayKey.get(todayKey);
                            if (clip) setDayViewerClip(clip);
                          }}
                          style={[
                            styles.cellHero,
                            {
                              width: heroCellSize,
                              height: heroCellSize,
                              borderRadius: heroCellRadius
                            },
                            practiced ? (hasPhoto ? styles.cellDoneHeroPhoto : styles.cellDoneHero) : styles.cellEmptyHero,
                            isRevealDay ? styles.cellRevealHero : undefined,
                            isToday ? styles.cellTodayHero : undefined,
                            activeDayKey === cell.dateKey ? styles.cellActiveHero : undefined
                          ]}
                        >
                          <Text style={[styles.cellDayText, practiced ? styles.cellDayTextDone : undefined, isRevealDay ? styles.cellDayTextReveal : undefined]}>
                            {cell.day}
                          </Text>
                        </TactilePressable>
                      );
                    })}
                  </View>
                ))}
              </View>
            </Animated.View>
          </LinearGradient>
        ) : (
          <>
            <Text style={styles.title}>Practice Calendar</Text>
            <View style={styles.monthNavRowCompact}>
              <TactilePressable
                style={[styles.monthArrowButtonCompact, monthAnimating ? styles.monthArrowButtonDisabled : undefined]}
                pressScale={0.98}
                onPress={() => shiftMonth(-1)}
                disabled={monthAnimating}
                accessibilityRole="button"
                accessibilityLabel="Previous month"
              >
                <Text style={styles.monthArrowTextCompact}>{"‹"}</Text>
              </TactilePressable>
              <Text style={styles.monthLabelCompact}>{monthLabel}</Text>
              <TactilePressable
                style={[styles.monthArrowButtonCompact, !canGoNext || monthAnimating ? styles.monthArrowButtonDisabled : undefined]}
                pressScale={0.98}
                onPress={() => shiftMonth(1)}
                disabled={!canGoNext || monthAnimating}
                accessibilityRole="button"
                accessibilityLabel="Next month"
              >
                <Text style={[styles.monthArrowTextCompact, !canGoNext ? styles.monthArrowTextDisabled : undefined]}>{"›"}</Text>
              </TactilePressable>
            </View>
            {!compact ? <Text style={styles.subtitle}>Month view</Text> : null}

            <Animated.View style={{ opacity: monthFade, transform: [{ translateX: monthTranslate }] }}>
              <View style={styles.grid}>
                {Array.from({ length: monthCells.length / 7 }).map((_, weekIndex) => (
                  <View key={`w-${weekIndex}`} style={styles.weekRow}>
                    {monthCells.slice(weekIndex * 7, weekIndex * 7 + 7).map((cell) => {
                      if (!cell.day || !cell.dateKey) {
                        return <View key={cell.key} style={[styles.cellGhost, compact ? styles.cellCompact : undefined]} />;
                      }
                      const dayCapture = dayClipsByKey.get(cell.dateKey);
                      const hasPhoto = Boolean(dayCapture?.photo);
                      const practiced = practicedDayKeys.has(cell.dateKey);
                      const isToday = cell.dateKey === todayKey;
                      const canOpenDay = isToday && Boolean(clipByDayKey.get(todayKey));
                      return (
                        <TactilePressable
                          key={cell.key}
                          pressScale={0.94}
                          hitSlop={3}
                          pressRetentionOffset={8}
                          disabled={!canOpenDay}
                          onPress={() => {
                            if (!canOpenDay) return;
                            setActiveDayKey(cell.dateKey);
                            const clip = clipByDayKey.get(todayKey);
                            if (clip) setDayViewerClip(clip);
                          }}
                          style={[
                            styles.cell,
                            compact ? styles.cellCompact : undefined,
                            practiced ? (hasPhoto ? styles.cellDonePhoto : styles.cellDone) : styles.cellEmpty,
                            isToday ? styles.cellToday : undefined,
                            activeDayKey === cell.dateKey ? styles.cellActive : undefined
                          ]}
                        >
                          {!compact ? <Text style={[styles.cellDayTextSmall, practiced ? styles.cellDayTextDone : undefined]}>{cell.day}</Text> : null}
                        </TactilePressable>
                      );
                    })}
                  </View>
                ))}
              </View>
            </Animated.View>
          </>
        )}
      </View>

      <Modal visible={Boolean(dayViewerClip)} animationType="fade" transparent onRequestClose={() => setDayViewerClip(null)}>
        <View style={styles.dayModalOverlay}>
          <View style={[styles.dayModalCard, { paddingTop: Math.max(12, insets.top + 2), paddingBottom: Math.max(16, insets.bottom + 10) }]}>
            <View style={styles.dayModalHeader}>
              <View style={styles.dayModalHeaderCopy}>
                <Text style={styles.dayModalEyebrow}>Chapter Day</Text>
                <Text style={styles.dayModalTitle}>{dayViewerDayNumber ? `Day ${dayViewerDayNumber}` : "Today's Practice"}</Text>
                <Text style={styles.dayModalDate}>{dayViewerDateLabel}</Text>
              </View>
              <TactilePressable style={styles.dayModalClose} onPress={() => setDayViewerClip(null)}>
                <Text style={styles.dayModalCloseText}>Done</Text>
              </TactilePressable>
            </View>

            {dayViewerClip ? (
              <View style={styles.dayModalVideoWrap}>
                <LoopingVideoPlayer
                  uri={dayViewerClip.videoUrl}
                  mediaType={dayViewerClip.captureType}
                  posterUri={dayViewerClip.thumbnailUrl}
                  style={styles.dayModalVideo}
                  resizeMode={ResizeMode.COVER}
                  showControls
                  controlsVariant="minimal"
                  muted={false}
                  autoPlay
                  active
                  loop
                />
              </View>
            ) : null}
            {onReRecordToday ? (
              <TactilePressable
                stretch
                style={styles.dayModalPrimaryAction}
                onPress={() => {
                  setDayViewerClip(null);
                  onReRecordToday();
                }}
              >
                <Text style={styles.dayModalPrimaryActionText}>Re-record Today</Text>
              </TactilePressable>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.88)",
    backgroundColor: "rgba(255,255,255,0.46)",
    padding: 14,
    shadowColor: "#0b2650",
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 9 },
    elevation: 7
  },
  cardCompact: {
    padding: 9
  },
  cardHero: {
    padding: 0,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
    backgroundColor: "transparent",
    overflow: "hidden",
    minHeight: 0,
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 }
  },
  cardHeroFill: {
    flex: 1,
    minHeight: 0
  },
  cardHeroScene: {
    minHeight: 0,
    borderRadius: 24,
    borderColor: "rgba(255,255,255,0.76)",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 7
  },
  cardHeroCompact: {
    minHeight: 0
  },
  heroGradient: {
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 16
  },
  heroGradientFill: {
    flex: 1
  },
  heroGradientScene: {
    flexShrink: 1
  },
  heroHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10
  },
  heroTitle: {
    color: theme.colors.textPrimary,
    fontSize: 32,
    lineHeight: 36,
    fontWeight: "800"
  },
  heroSubtitle: {
    marginTop: 3,
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: "700"
  },
  heroProgressPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(14,99,255,0.44)",
    backgroundColor: "rgba(247,251,255,0.82)",
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  heroProgressPillText: {
    color: theme.colors.accentStrong,
    fontSize: 12,
    fontWeight: "800"
  },
  weekdayRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 1
  },
  weekdayRowFill: {
    marginTop: 10
  },
  weekdayRowScene: {
    marginTop: 8
  },
  weekdayLabel: {
    width: 44,
    textAlign: "center",
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5
  },
  gridHero: {
    marginTop: 10,
    gap: 9
  },
  gridHeroFill: {
    marginTop: 12,
    flexGrow: 1,
    justifyContent: "space-between"
  },
  weekRowHero: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  cellHero: {
    width: 44,
    height: 44,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  cellEmptyHero: {
    borderColor: "rgba(255,255,255,0.62)",
    backgroundColor: "rgba(248,252,255,0.3)"
  },
  cellDoneHero: {
    borderColor: "rgba(14,99,255,0.8)",
    backgroundColor: "rgba(84,149,255,0.82)",
    shadowColor: "#2e73ea",
    shadowOpacity: 0.32,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4
  },
  cellDoneHeroPhoto: {
    borderColor: "rgba(24,166,122,0.86)",
    backgroundColor: "rgba(70,185,145,0.8)",
    shadowColor: "#1f8f66",
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4
  },
  cellDoneHeroDual: {
    borderColor: "rgba(255,255,255,0.95)",
    borderWidth: 1.8,
    backgroundColor: "rgba(14,99,255,0.92)",
    shadowColor: "#0e63ff",
    shadowOpacity: 0.38,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5
  },
  cellPartialHero: {
    borderColor: "rgba(255,255,255,0.76)",
    backgroundColor: "rgba(24,166,122,0.16)"
  },
  cellRevealHero: {
    borderColor: "rgba(255,255,255,0.98)",
    borderWidth: 2,
    backgroundColor: "rgba(11,90,232,0.94)",
    shadowColor: "#0e63ff",
    shadowOpacity: 0.42,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6
  },
  cellTodayHero: {
    borderColor: "rgba(255,255,255,0.97)",
    borderWidth: 1.8
  },
  cellActiveHero: {
    transform: [{ scale: 1.03 }],
    shadowOpacity: 0.26,
    shadowRadius: 11
  },
  heroFooterRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  heroCountdown: {
    marginTop: 12,
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: "800"
  },
  heroHint: {
    color: theme.colors.accentStrong,
    fontSize: 13,
    fontWeight: "800"
  },
  title: {
    color: theme.colors.textPrimary,
    fontWeight: "800",
    fontSize: 16
  },
  subtitle: {
    marginTop: 3,
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: "600"
  },
  monthNavRow: {
    marginTop: 10,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  monthNavRowScene: {
    marginTop: 8,
    marginBottom: 6
  },
  trackLegendRow: {
    marginTop: 2,
    marginBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  trackLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5
  },
  trackLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  trackLegendDotVideo: {
    backgroundColor: "rgba(14,99,255,0.92)"
  },
  trackLegendDotPhoto: {
    backgroundColor: "rgba(24,166,122,0.92)"
  },
  trackLegendText: {
    color: "rgba(20,58,96,0.78)",
    fontSize: 11,
    fontWeight: "700"
  },
  trackLegendRule: {
    marginLeft: "auto",
    color: "rgba(20,58,96,0.72)",
    fontSize: 11,
    fontWeight: "700"
  },
  monthNavSpacer: {
    flex: 1
  },
  monthNavRowCompact: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  monthArrowButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.74)",
    backgroundColor: "rgba(244,250,255,0.66)",
    shadowColor: "#0f2f5f",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5
  },
  monthArrowButtonCompact: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.62)",
    backgroundColor: "rgba(255,255,255,0.18)"
  },
  monthArrowButtonDisabled: {
    opacity: 0.45
  },
  monthArrowText: {
    color: theme.colors.textPrimary,
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 24
  },
  monthArrowTextCompact: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 17
  },
  monthArrowTextDisabled: {
    color: theme.colors.textSecondary
  },
  monthLabel: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontWeight: "800"
  },
  monthLabelWrap: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.68)",
    backgroundColor: "rgba(255,255,255,0.26)",
    paddingHorizontal: 14,
    paddingVertical: 5
  },
  monthLabelCompact: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: "800"
  },
  grid: {
    marginTop: 10,
    gap: 5
  },
  weekRow: {
    flexDirection: "row",
    gap: 5
  },
  cell: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  cellCompact: {
    width: 27,
    height: 27,
    borderRadius: 6
  },
  cellGhost: {
    backgroundColor: "transparent",
    borderColor: "transparent"
  },
  cellEmpty: {
    borderColor: "rgba(255,255,255,0.34)",
    backgroundColor: "rgba(255,255,255,0.12)"
  },
  cellDone: {
    borderColor: "rgba(14,99,255,0.58)",
    backgroundColor: "rgba(14,99,255,0.28)"
  },
  cellDonePhoto: {
    borderColor: "rgba(24,166,122,0.62)",
    backgroundColor: "rgba(24,166,122,0.26)"
  },
  cellDoneDual: {
    borderColor: "rgba(255,255,255,0.9)",
    backgroundColor: "rgba(14,99,255,0.62)"
  },
  cellPartial: {
    borderColor: "rgba(255,255,255,0.62)",
    backgroundColor: "rgba(24,166,122,0.12)"
  },
  cellToday: {
    borderColor: "rgba(255,255,255,0.88)",
    borderWidth: 1.4
  },
  cellActive: {
    borderColor: "rgba(14,99,255,0.86)",
    backgroundColor: "rgba(14,99,255,0.34)"
  },
  cellHeroGhost: {
    width: 44,
    height: 44
  },
  cellHeroGhostScene: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "rgba(255,255,255,0.06)"
  },
  cellDayText: {
    color: theme.colors.textSecondary,
    fontSize: 16,
    fontWeight: "800"
  },
  cellDayTextSmall: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: "700"
  },
  cellDayTextDone: {
    color: "#eef5ff",
    fontWeight: "800"
  },
  cellDayTextReveal: {
    color: "#ffffff",
    fontWeight: "900"
  },
  trackDotRow: {
    position: "absolute",
    bottom: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: 3
  },
  trackDotRowCompact: {
    position: "absolute",
    bottom: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 2
  },
  trackDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5
  },
  trackDotVideo: {
    backgroundColor: "#d9eaff"
  },
  trackDotPhoto: {
    backgroundColor: "#dcffef"
  },
  trackDotVideoCompact: {
    backgroundColor: "rgba(14,99,255,0.92)"
  },
  trackDotPhotoCompact: {
    backgroundColor: "rgba(24,166,122,0.92)"
  },
  dayModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(5,12,22,0.84)",
    justifyContent: "center"
  },
  dayModalCard: {
    flex: 1,
    backgroundColor: "rgba(7,16,30,0.98)"
  },
  dayModalHeader: {
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  dayModalHeaderCopy: {
    flex: 1
  },
  dayModalEyebrow: {
    color: "rgba(198,219,244,0.9)",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.62
  },
  dayModalTitle: {
    marginTop: 4,
    color: "#eef5ff",
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "800"
  },
  dayModalDate: {
    marginTop: 2,
    color: "rgba(198,219,244,0.84)",
    fontSize: 13,
    fontWeight: "700"
  },
  dayModalClose: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  dayModalCloseText: {
    color: "#dceaff",
    fontWeight: "700",
    fontSize: 13
  },
  dayModalVideoWrap: {
    marginTop: 14,
    marginHorizontal: 16,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 8,
    flex: 1
  },
  dayModalVideo: {
    width: "100%",
    height: "100%",
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#0c1b2f"
  },
  dayModalPrimaryAction: {
    marginTop: 12,
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(103,169,255,0.66)",
    backgroundColor: "rgba(11,86,224,0.9)",
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 12
  },
  dayModalPrimaryActionText: {
    color: "#ecf5ff",
    fontSize: 16,
    fontWeight: "800"
  }
});
