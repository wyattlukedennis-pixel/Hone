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
  saveSignal?: number;
  onReRecordToday?: () => void;
};

function toLocalDayKey(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromDayKey(value: string) {
  const [year, month, day] = value.split("-").map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  const parsed = new Date(year, month - 1, day);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

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
  saveSignal = 0,
  onReRecordToday
}: PracticeCalendarMiniProps) {
  const insets = useSafeAreaInsets();
  const currentMonthStart = useMemo(() => new Date(now.getFullYear(), now.getMonth(), 1), [now]);
  const currentMonthKey = `${currentMonthStart.getFullYear()}-${currentMonthStart.getMonth()}`;
  const [displayMonthStart, setDisplayMonthStart] = useState(currentMonthStart);
  const [activeDayKey, setActiveDayKey] = useState<string | null>(null);
  const [dayViewerClip, setDayViewerClip] = useState<Clip | null>(null);
  const [monthAnimating, setMonthAnimating] = useState(false);
  const todayCellScale = useRef(new Animated.Value(1)).current;
  const todayCellGlow = useRef(new Animated.Value(0)).current;

  // Track initial value so we only animate on changes, not on mount
  const saveSignalRef = useRef(saveSignal);
  useEffect(() => {
    if (saveSignal === saveSignalRef.current) return;
    saveSignalRef.current = saveSignal;
    const timer = setTimeout(() => {
      // Big bounce + glow pulse
      todayCellScale.setValue(0.4);
      todayCellGlow.setValue(1);

      Animated.sequence([
        Animated.spring(todayCellScale, {
          toValue: 1.4,
          tension: 60,
          friction: 4,
          useNativeDriver: true,
        }),
        Animated.spring(todayCellScale, {
          toValue: 0.9,
          tension: 100,
          friction: 6,
          useNativeDriver: true,
        }),
        Animated.spring(todayCellScale, {
          toValue: 1,
          tension: 80,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();

      Animated.timing(todayCellGlow, {
        toValue: 0,
        duration: 3000,
        useNativeDriver: true,
      }).start();
    }, 500);
    return () => clearTimeout(timer);
  }, [saveSignal, todayCellScale, todayCellGlow]);
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
  const todayKey = useMemo(() => toLocalDayKey(now), [now]);
  const canGoNext = displayMonthStart.getTime() < currentMonthStart.getTime();
  const sceneMode = hero && scene;
  const heroCellSize = sceneMode ? (compact ? 27 : 31) : 44;
  const heroCellRadius = 8;
  const heroRowGap = sceneMode ? 6 : 9;
  const heroNavSize = sceneMode ? 36 : 44;
  const heroNavRadius = 8;
  const heroNavIconSize = sceneMode ? 18 : 24;
  const heroMonthTitleSize = sceneMode ? 21 : 32;
  const heroMonthTitleLineHeight = sceneMode ? 25 : 36;
  const heroPaddingHorizontal = sceneMode ? 15 : 20;
  const heroPaddingTop = sceneMode ? 10 : 15;
  const heroPaddingBottom = sceneMode ? 10 : 16;

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
      const dateKey = toLocalDayKey(new Date(year, month, day));
      return { key: dateKey, day, dateKey };
    });
  }, [displayMonthStart, sceneMode]);

  const weekdayLabels = ["S", "M", "T", "W", "T", "F", "S"];
  const dayViewerDateLabel = dayViewerClip
    ? (dateFromDayKey(dayViewerClip.recordedOn.slice(0, 10)) ?? new Date(dayViewerClip.recordedAt)).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric"
      })
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
            colors={sceneMode ? theme.gradients.calendarHeroScene : theme.gradients.calendarHero}
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
            {sceneMode ? <View style={styles.sceneSignalRail} /> : null}
            <View style={[styles.heroHeaderRow, sceneMode ? styles.heroHeaderRowScene : undefined]}>
              <View>
                <Text
                  style={[
                    styles.heroTitle,
                    sceneMode ? styles.heroTitleScene : undefined,
                    { fontSize: heroMonthTitleSize, lineHeight: heroMonthTitleLineHeight }
                  ]}
                >
                  {monthLabel}
                </Text>
              </View>
              {progressLabel ? (
                <View style={[styles.heroProgressPill, sceneMode ? styles.heroProgressPillScene : undefined]}>
                  <Text style={[styles.heroProgressPillText, sceneMode ? styles.heroProgressPillTextScene : undefined]}>{progressLabel}</Text>
                </View>
              ) : null}
            </View>

            <View style={[styles.monthNavRow, sceneMode ? styles.monthNavRowScene : undefined]}>
              <TactilePressable
                style={[
                  styles.monthArrowButton,
                  sceneMode ? styles.monthArrowButtonScene : undefined,
                  sceneMode ? { width: heroNavSize, height: heroNavSize, borderRadius: heroNavRadius } : undefined,
                  monthAnimating ? styles.monthArrowButtonDisabled : undefined
                ]}
                pressScale={0.98}
                onPress={() => shiftMonth(-1)}
                disabled={monthAnimating}
                accessibilityRole="button"
                accessibilityLabel="Previous month"
              >
                <Text
                  style={[
                    styles.monthArrowText,
                    sceneMode ? styles.monthArrowTextScene : undefined,
                    { fontSize: heroNavIconSize, lineHeight: heroNavIconSize }
                  ]}
                >
                  {"‹"}
                </Text>
              </TactilePressable>
              <View style={styles.monthNavSpacer} />
              <TactilePressable
                style={[
                  styles.monthArrowButton,
                  sceneMode ? styles.monthArrowButtonScene : undefined,
                  sceneMode ? { width: heroNavSize, height: heroNavSize, borderRadius: heroNavRadius } : undefined,
                  !canGoNext || monthAnimating ? styles.monthArrowButtonDisabled : undefined
                ]}
                pressScale={0.98}
                onPress={() => shiftMonth(1)}
                disabled={!canGoNext || monthAnimating}
                accessibilityRole="button"
                accessibilityLabel="Next month"
              >
                <Text
                  style={[
                    styles.monthArrowText,
                    sceneMode ? styles.monthArrowTextScene : undefined,
                    { fontSize: heroNavIconSize, lineHeight: heroNavIconSize },
                    !canGoNext ? styles.monthArrowTextDisabled : undefined
                  ]}
                >
                  {"›"}
                </Text>
              </TactilePressable>
            </View>

            <Animated.View style={{ opacity: monthFade, transform: [{ translateX: monthTranslate }] }}>
              <View style={[styles.weekdayRow, fill ? styles.weekdayRowFill : undefined, sceneMode ? styles.weekdayRowScene : undefined]}>
                {weekdayLabels.map((label, index) => (
                  <Text key={`${label}-${index}`} style={[styles.weekdayLabel, sceneMode ? styles.weekdayLabelScene : undefined, { width: heroCellSize }]}>
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
                      const heroCellEl = (
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
                            sceneMode ? styles.cellHeroScene : undefined,
                            {
                              width: heroCellSize,
                              height: heroCellSize,
                              borderRadius: heroCellRadius
                            },
                            practiced ? (hasPhoto ? styles.cellDoneHeroPhoto : styles.cellDoneHero) : styles.cellEmptyHero,
                            !practiced && sceneMode ? styles.cellEmptyHeroScene : undefined,
                            practiced && !hasPhoto && sceneMode ? styles.cellDoneHeroScene : undefined,
                            practiced && hasPhoto && sceneMode ? styles.cellDoneHeroPhotoScene : undefined,
                            isRevealDay ? styles.cellRevealHero : undefined,
                            isRevealDay && sceneMode ? styles.cellRevealHeroScene : undefined,
                            isToday ? styles.cellTodayHero : undefined,
                            isToday && sceneMode ? styles.cellTodayHeroScene : undefined,
                            activeDayKey === cell.dateKey ? styles.cellActiveHero : undefined
                          ]}
                        >
                          <Text
                            style={[
                              styles.cellDayText,
                              sceneMode ? styles.cellDayTextScene : undefined,
                              practiced ? styles.cellDayTextDone : undefined,
                              practiced && sceneMode ? styles.cellDayTextDoneScene : undefined,
                              isRevealDay ? styles.cellDayTextReveal : undefined
                            ]}
                          >
                            {cell.day}
                          </Text>
                        </TactilePressable>
                      );
                      if (isToday) {
                        return (
                          <Animated.View
                            key={cell.key}
                            style={{
                              transform: [{ scale: todayCellScale }],
                            }}
                          >
                            {/* Outer glow */}
                            <Animated.View
                              style={{
                                position: "absolute",
                                top: -4,
                                left: -4,
                                right: -4,
                                bottom: -4,
                                borderRadius: heroCellRadius + 4,
                                backgroundColor: "#E8450A",
                                opacity: todayCellGlow,
                              }}
                            />
                            {heroCellEl}
                          </Animated.View>
                        );
                      }
                      return heroCellEl;
                    })}
                  </View>
                ))}
              </View>
            </Animated.View>
          </LinearGradient>
        ) : (
          <>
            <Text style={styles.title}>practice calendar</Text>
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
            {!compact ? <Text style={styles.subtitle}>month view</Text> : null}

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
                      const cellContent = (
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
                      if (isToday) {
                        return (
                          <Animated.View
                            key={cell.key}
                            style={{
                              transform: [{ scale: todayCellScale }],
                            }}
                          >
                            <Animated.View
                              style={{
                                position: "absolute",
                                top: -3,
                                left: -3,
                                right: -3,
                                bottom: -3,
                                borderRadius: 12,
                                backgroundColor: "#E8450A",
                                opacity: todayCellGlow,
                              }}
                            />
                            {cellContent}
                          </Animated.View>
                        );
                      }
                      return cellContent;
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
                <Text style={styles.dayModalEyebrow}>chapter day</Text>
                <Text style={styles.dayModalTitle}>{dayViewerDayNumber ? `day ${dayViewerDayNumber}` : "today's practice"}</Text>
                <Text style={styles.dayModalDate}>{dayViewerDateLabel}</Text>
              </View>
              <TactilePressable style={styles.dayModalClose} onPress={() => setDayViewerClip(null)}>
                <Text style={styles.dayModalCloseText}>done</Text>
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
                <Text style={styles.dayModalPrimaryActionText}>re-record today</Text>
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
    borderRadius: 80,
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
    borderRadius: theme.shape.cardRadiusLg,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    backgroundColor: "transparent",
    overflow: "hidden",
    minHeight: 0,
    shadowColor: "#000000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 0
  },
  cardHeroFill: {
    flex: 1,
    minHeight: 0
  },
  cardHeroScene: {
    minHeight: 0,
    borderRadius: theme.shape.cardRadiusMd,
    borderColor: "rgba(0,0,0,0.06)",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 0
  },
  cardHeroCompact: {
    minHeight: 0
  },
  heroGradient: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 15
  },
  heroGradientFill: {
    flex: 1
  },
  heroGradientScene: {
    flexShrink: 1,
    borderWidth: 0
  },
  sceneSignalRail: {
    width: 68,
    height: 4,
    borderRadius: 0,
    marginBottom: 8,
    backgroundColor: "#ff5a1f"
  },
  heroHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10
  },
  heroHeaderRowScene: {
    alignItems: "center"
  },
  heroTitle: {
    color: theme.colors.textPrimary,
    fontSize: 32,
    lineHeight: 36,
    fontWeight: "800",
    fontFamily: theme.typography.display
  },
  heroTitleScene: {
    color: theme.colors.textPrimary
  },
  heroSubtitle: {
    marginTop: 3,
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: "700"
  },
  heroProgressPill: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    backgroundColor: "rgba(238,230,219,0.95)",
    paddingHorizontal: 13,
    paddingVertical: 8
  },
  heroProgressPillScene: {
    borderColor: "rgba(0,0,0,0.06)",
    backgroundColor: "rgba(238,230,219,0.95)"
  },
  heroProgressPillText: {
    color: theme.colors.accentStrong,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.3,

    fontFamily: theme.typography.label
  },
  heroProgressPillTextScene: {
    color: theme.colors.accentStrong
  },
  weekdayRow: {
    marginTop: 11,
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
    color: "#252525",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,

    fontFamily: theme.typography.label
  },
  weekdayLabelScene: {
    color: theme.colors.textSecondary
  },
  gridHero: {
    marginTop: 12,
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
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  cellHeroScene: {
    borderWidth: 1
  },
  cellEmptyHero: {
    borderColor: "#c4b9a8",
    backgroundColor: "rgba(241,234,223,0.74)"
  },
  cellEmptyHeroScene: {
    borderColor: "#bcb09f",
    backgroundColor: "rgba(239,231,220,0.95)"
  },
  cellDoneHero: {
    borderColor: "rgba(232,69,10,0.3)",
    backgroundColor: "rgba(255,90,31,0.88)",
    shadowColor: "#000000",
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 0
  },
  cellDoneHeroScene: {
    borderColor: "rgba(232,69,10,0.3)",
    backgroundColor: "rgba(255,90,31,0.9)",
    shadowColor: "#000000",
    shadowOpacity: 0.16
  },
  cellDoneHeroPhoto: {
    borderColor: "rgba(232,69,10,0.3)",
    backgroundColor: "rgba(41,41,41,0.84)",
    shadowColor: "#000000",
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 0
  },
  cellDoneHeroPhotoScene: {
    borderColor: "rgba(232,69,10,0.3)",
    backgroundColor: "rgba(41,41,41,0.88)"
  },
  cellDoneHeroDual: {
    borderColor: "rgba(232,69,10,0.3)",
    borderWidth: 1,
    backgroundColor: "#131313",
    shadowColor: "#000000",
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 0
  },
  cellPartialHero: {
    borderColor: "rgba(0,0,0,0.06)",
    backgroundColor: "rgba(41,41,41,0.14)"
  },
  cellRevealHero: {
    borderColor: "rgba(0,0,0,0.06)",
    borderWidth: 1,
    backgroundColor: "#131313",
    shadowColor: "#000000",
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 0
  },
  cellRevealHeroScene: {
    borderColor: "rgba(0,0,0,0.06)",
    backgroundColor: "#131313"
  },
  cellTodayHero: {
    borderColor: "rgba(0,0,0,0.06)",
    borderWidth: 1
  },
  cellTodayHeroScene: {
    borderColor: "rgba(0,0,0,0.06)"
  },
  cellActiveHero: {
    transform: [{ scale: 1.05 }],
    shadowOpacity: 0.3,
    shadowRadius: 12
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
    marginTop: 5,
    marginBottom: 4
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
    backgroundColor: "#ff5a1f"
  },
  trackLegendDotPhoto: {
    backgroundColor: "#2a2a2a"
  },
  trackLegendText: {
    color: "#2d2d2d",
    fontSize: 11,
    fontWeight: "700"
  },
  trackLegendRule: {
    marginLeft: "auto",
    color: "#2d2d2d",
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
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    backgroundColor: "rgba(240,232,222,0.98)",
    shadowColor: "#000000",
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 0
  },
  monthArrowButtonScene: {
    borderColor: "rgba(0,0,0,0.06)",
    backgroundColor: "rgba(240,232,222,0.98)",
    shadowColor: "#000000",
    shadowOpacity: 0.16
  },
  monthArrowButtonCompact: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    backgroundColor: "rgba(240,232,222,0.98)"
  },
  monthArrowButtonDisabled: {
    opacity: 0.45
  },
  monthArrowText: {
    color: "#101010",
    fontSize: 21,
    fontWeight: "800",
    lineHeight: 22
  },
  monthArrowTextScene: {
    color: theme.colors.textPrimary
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
    fontSize: 21,
    fontWeight: "800",
    fontFamily: theme.typography.display
  },
  monthLabelWrap: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    backgroundColor: "rgba(239,231,220,0.96)",
    paddingHorizontal: 14,
    paddingVertical: 5
  },
  monthLabelCompact: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: "800",
    fontFamily: theme.typography.display
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
    borderRadius: 8
  },
  cellGhost: {
    backgroundColor: "transparent",
    borderColor: "transparent"
  },
  cellEmpty: {
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(241,233,222,0.9)"
  },
  cellDone: {
    borderColor: "rgba(232,69,10,0.3)",
    backgroundColor: "rgba(255,90,31,0.32)"
  },
  cellDonePhoto: {
    borderColor: "rgba(232,69,10,0.3)",
    backgroundColor: "rgba(41,41,41,0.3)"
  },
  cellDoneDual: {
    borderColor: "rgba(232,69,10,0.3)",
    backgroundColor: "#161616"
  },
  cellPartial: {
    borderColor: "rgba(0,0,0,0.06)",
    backgroundColor: "rgba(41,41,41,0.14)"
  },
  cellToday: {
    borderColor: "rgba(0,0,0,0.06)",
    borderWidth: 1
  },
  cellActive: {
    borderColor: "rgba(0,0,0,0.06)",
    backgroundColor: "rgba(255,90,31,0.28)"
  },
  cellHeroGhost: {
    width: 44,
    height: 44
  },
  cellHeroGhostScene: {
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(240,232,222,0.92)"
  },
  cellDayText: {
    color: "#2a2a2a",
    fontSize: 15,
    fontWeight: "800",
    fontFamily: theme.typography.heading
  },
  cellDayTextScene: {
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.heading
  },
  cellDayTextSmall: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: "700"
  },
  cellDayTextDone: {
    color: "#f4efe6",
    fontWeight: "800"
  },
  cellDayTextDoneScene: {
    color: "#f4efe6"
  },
  cellDayTextReveal: {
    color: "#f4efe6",
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
    backgroundColor: "#ff5a1f"
  },
  trackDotPhoto: {
    backgroundColor: "#2a2a2a"
  },
  trackDotVideoCompact: {
    backgroundColor: "#ff5a1f"
  },
  trackDotPhotoCompact: {
    backgroundColor: "#2a2a2a"
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

    letterSpacing: 0.3,
    fontFamily: theme.typography.label
  },
  dayModalTitle: {
    marginTop: 4,
    color: "#eef5ff",
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "800",
    fontFamily: theme.typography.display
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
    borderRadius: 86,
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
    fontWeight: "800",
    letterSpacing: 0.44,

    fontFamily: theme.typography.heading
  }
});
