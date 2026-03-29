import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Image, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { ResizeMode, Video } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { trackEvent } from "../analytics/events";
import { motionTokens } from "../motion/tokens";
import { PracticeRecorder } from "../components/PracticeRecorder";
import { TactilePressable } from "../components/TactilePressable";
import { readWeeklyProofCardDismissed, writeWeeklyProofCardDismissed } from "../storage/weeklyProofCardStorage";
import { theme } from "../theme";
import type { Clip } from "../types/clip";
import type { Journey } from "../types/journey";
import type { DailyMomentSettings } from "../types/dailyMoment";
import type { DevDateShiftSettings } from "../types/devTools";
import { formatDailyMomentTime, getDailyMomentKey, isInDailyMomentWindow } from "../utils/dailyMoment";
import { type ChapterTrailerMoment } from "../utils/progress";
import { exportAndShareReel } from "../utils/reelExport";
import { triggerSelectionHaptic } from "../utils/feedback";
import { useReducedMotion } from "../utils/useReducedMotion";
import { ActionButton } from "./practice/ActionButton";
import { ManageJourneysModal } from "./practice/ManageJourneysModal";
import { PracticeCalendarMini } from "./practice/PracticeCalendarMini";
import { usePracticeState } from "./practice/usePracticeState";

function parseLocalDayKey(value: string) {
  const [yearRaw, monthRaw, dayRaw] = value.split("-").map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(yearRaw) || !Number.isFinite(monthRaw) || !Number.isFinite(dayRaw)) return null;
  const parsed = new Date(yearRaw, monthRaw - 1, dayRaw);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

function toDayKey(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function resolveWeekStartMonday(value: Date) {
  const start = new Date(value);
  start.setHours(0, 0, 0, 0);
  const offset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - offset);
  return start;
}

function selectTrailerIndices(total: number) {
  if (total <= 1) return [0];
  if (total === 2) return [0, 1];
  if (total === 3) return [0, 1, 2];
  const end = total - 1;
  return [...new Set([0, Math.round(end * 0.5), end])].sort((a, b) => a - b);
}

function buildWeeklyTrailerMoments(clips: Clip[]): ChapterTrailerMoment[] {
  if (!clips.length) return [];
  const indices = selectTrailerIndices(clips.length);
  const labelsByCount: Record<number, string[]> = {
    1: ["NOW"],
    2: ["THEN", "NOW"],
    3: ["THEN", "MOMENT", "NOW"]
  };
  const labels = labelsByCount[indices.length] ?? labelsByCount[3];
  return indices.map((index, labelIndex) => ({
    clip: clips[index],
    label: labels[labelIndex] ?? `MOMENT ${labelIndex + 1}`
  }));
}

type JourneysScreenProps = {
  token: string;
  activeJourneyId: string | null;
  mediaMode: "video" | "photo";
  onActiveJourneyChange: (journeyId: string | null) => void;
  onOpenProgress: (journeyId: string, options?: { openReveal?: boolean }) => void;
  devDateShiftSettings: DevDateShiftSettings;
  onDevDateShiftSettingsChange: (next: DevDateShiftSettings) => void;
  dailyMomentSettings: DailyMomentSettings;
  onDailyMomentSettingsChange: (next: DailyMomentSettings) => void;
  openRecorderSignal: number;
  deepLinkRecorderSignal: number;
  deepLinkRecorderJourneyId: string | null;
  recordingsRevision: number;
  onRecordingsRevisionBump?: () => void;
  onMediaModeChange?: (mode: "video" | "photo") => void;
  onJourneysLoaded?: (data: { journeys: Journey[]; clipsByJourney: Record<string, Clip[]>; updatingId: string | null }) => void;
  darkMode?: boolean;
};

export function JourneysScreen({
  token,
  activeJourneyId,
  mediaMode,
  onActiveJourneyChange,
  onOpenProgress,
  devDateShiftSettings,
  onDevDateShiftSettingsChange,
  dailyMomentSettings,
  onDailyMomentSettingsChange,
  openRecorderSignal,
  deepLinkRecorderSignal,
  deepLinkRecorderJourneyId,
  recordingsRevision,
  onRecordingsRevisionBump,
  onMediaModeChange,
  onJourneysLoaded,
  darkMode = false
}: JourneysScreenProps) {
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [clockTick, setClockTick] = useState(Date.now());
  const streakTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heroSectionReveal = useRef(new Animated.Value(0)).current;
  const previewSectionReveal = useRef(new Animated.Value(0)).current;
  const calendarSectionReveal = useRef(new Animated.Value(0)).current;
  const fabBob = useRef(new Animated.Value(0)).current;
  const {
    journeys,
    loading,
    refreshing,
    creating,
    updatingId,
    manageOpen,
    setManageOpen,
    errorMessage,
    statusMessage,
    newTitle,
    setNewTitle,
    newMilestoneLengthDays,
    setNewMilestoneLengthDays,
    newCaptureMode,
    setNewCaptureMode,
    clipsByJourney,
    recorderJourneyId,
    setRecorderJourneyId,
    clipSaving,
    recorderStatusMessage,
    setRecorderStatusMessage,
    statPulse,
    celebration,
    saveFlightOpacity,
    saveFlightX,
    saveFlightY,
    saveFlightScale,
    saveFlightClipUrl,
    loadJourneys,
    loadJourneyClips,
    handleCreateJourney,
    handleArchiveJourney,
    handleSaveRecordedClip,
    activeJourney,
    activeStreak,
    practicedToday,
    milestoneProgress,
    activeJourneyClips,
    recorderJourney,
    recorderCaptureType,
    recorderDay,
    recorderReferenceClipUrl,
    autoReminderSuggestion,
    acknowledgeAutoReminderSuggestion
  } = usePracticeState({
    token,
    activeJourneyId,
    onActiveJourneyChange,
    mediaMode,
    devDateShiftSettings,
    onDevDateShiftSettingsChange,
    recordingsRevision
  });

  // Push journey data up to App.tsx for ManageScreen
  const onJourneysLoadedRef = useRef(onJourneysLoaded);
  onJourneysLoadedRef.current = onJourneysLoaded;
  useEffect(() => {
    onJourneysLoadedRef.current?.({ journeys, clipsByJourney, updatingId });
  }, [journeys, clipsByJourney, updatingId]);

  // Sync mediaMode when active journey changes
  useEffect(() => {
    if (activeJourney?.captureMode && onMediaModeChange) {
      onMediaModeChange(activeJourney.captureMode);
    }
  }, [activeJourney?.captureMode, onMediaModeChange]);

  useEffect(() => {
    const timer = setInterval(() => {
      setClockTick(Date.now());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const now = useMemo(() => {
    const value = new Date();
    if (devDateShiftSettings.enabled && devDateShiftSettings.dayOffset) {
      value.setDate(value.getDate() + devDateShiftSettings.dayOffset);
    }
    return value;
  }, [clockTick, devDateShiftSettings.enabled, devDateShiftSettings.dayOffset]);
  const dailyMomentWindowOpen = isInDailyMomentWindow(now, dailyMomentSettings);
  const tabBarReserve = 90;
  const availableHeight = windowHeight - insets.top - insets.bottom - tabBarReserve;
  const normalizedStreak = Math.max(activeStreak, 0);
  const chapterTargetDays = milestoneProgress?.milestoneLengthDays ?? activeJourney?.milestoneLengthDays ?? 7;
  const chapterProgressDays = milestoneProgress?.progressDays ?? 0;
  const chapterRemainingDays = milestoneProgress?.remainingDays ?? chapterTargetDays;
  const chapterRevealReady = Boolean(milestoneProgress?.reachedReveal);
  const chapterNumber = milestoneProgress?.milestoneChapter ?? activeJourney?.milestoneChapter ?? 1;
  const chapterDisplayDay = chapterRevealReady
    ? chapterTargetDays
    : Math.max(1, Math.min(chapterTargetDays, chapterProgressDays + (practicedToday ? 0 : 1)));
  const primaryActionLabel = chapterRevealReady
    ? "watch reveal"
    : practicedToday
      ? "retake"
      : activeJourney?.captureMode === "photo" ? "capture" : "record";
  // Latest clip thumbnail for hero background
  const latestClipThumbnail = useMemo(() => {
    if (!activeJourneyClips.length) return null;
    const sorted = [...activeJourneyClips].sort(
      (a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt)
    );
    const latest = sorted[sorted.length - 1];
    return latest?.thumbnailUrl ?? (latest?.captureType === "photo" ? latest.videoUrl : null);
  }, [activeJourneyClips]);

  const criticalMode = availableHeight < 560;
  const ultraCompactMode = availableHeight < 680;
  const tightMode = availableHeight < 700;
  const compactMode = availableHeight < 760;
  const revealFocusMode = chapterRevealReady;
  const headingScale = availableHeight >= 860 ? 1.02 : availableHeight >= 760 ? 0.98 : availableHeight >= 700 ? 0.93 : 0.88;
  const effectiveHeadingScale = revealFocusMode ? headingScale * 0.92 : headingScale;
  const skillNameSize = Math.round(36 * effectiveHeadingScale);
  const dayLineSize = Math.round(22 * effectiveHeadingScale);
  const streakLineSize = Math.round(16 * effectiveHeadingScale);
  const sceneHorizontalPadding = criticalMode ? 14 : 18;
  const sceneTopPadding = criticalMode ? 2 : ultraCompactMode ? 4 : 6;
  const sceneBottomPadding = Math.max(insets.bottom + (criticalMode ? 174 : compactMode ? 186 : 198), criticalMode ? 188 : 206);
  const scenePrimaryDense = compactMode || criticalMode;
  const sceneCalendarCompact = criticalMode || availableHeight < 700;
  const missedDayRecovery = useMemo(() => {
    if (practicedToday || chapterRevealReady || activeJourneyClips.length === 0) return null;

    let latestPracticeDayMs: number | null = null;
    for (const clip of activeJourneyClips) {
      const dayKey = clip.recordedOn.slice(0, 10);
      const dayDate = parseLocalDayKey(dayKey);
      if (!dayDate) continue;
      const dayMs = dayDate.getTime();
      if (latestPracticeDayMs === null || dayMs > latestPracticeDayMs) {
        latestPracticeDayMs = dayMs;
      }
    }
    if (latestPracticeDayMs === null) return null;

    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const daysSinceLastPractice = Math.floor((today.getTime() - latestPracticeDayMs) / 86_400_000);
    if (daysSinceLastPractice < 2) return null;
    return {
      missedDays: daysSinceLastPractice - 1
    };
  }, [practicedToday, chapterRevealReady, activeJourneyClips, now]);
  const suggestedReminderLabel = useMemo(() => {
    if (!autoReminderSuggestion) return null;
    return formatDailyMomentTime({
      ...dailyMomentSettings,
      hour: autoReminderSuggestion.hour,
      minute: autoReminderSuggestion.minute
    });
  }, [autoReminderSuggestion?.hour, autoReminderSuggestion?.minute, dailyMomentSettings]);
  const weeklyProof = useMemo(() => {
    if (!activeJourney) return null;
    const weekStart = resolveWeekStartMonday(now);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const startKey = toDayKey(weekStart);
    const endKey = toDayKey(weekEnd);
    const weekKey = `${startKey}:${endKey}`;
    const weeklyClips = [...activeJourneyClips]
      .filter((clip) => clip.captureType === activeJourney.captureMode)
      .filter((clip) => {
        const dayKey = clip.recordedOn.slice(0, 10);
        return dayKey >= startKey && dayKey <= endKey;
      })
      .sort((a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt));
    const uniqueDays = new Set(weeklyClips.map((clip) => clip.recordedOn.slice(0, 10)));
    return {
      weekKey,
      weekLabel: `${weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} - ${weekEnd.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric"
      })}`,
      clips: weeklyClips,
      progressDays: uniqueDays.size,
      shareReady: weeklyClips.length >= 2,
      trailerMoments: buildWeeklyTrailerMoments(weeklyClips)
    };
  }, [activeJourney?.id, activeJourney?.captureMode, activeJourneyClips, now]);

  const [weeklyProofSharing, setWeeklyProofSharing] = useState(false);
  const [weeklyProofMessage, setWeeklyProofMessage] = useState<string | null>(null);
  const [weeklyProofDismissed, setWeeklyProofDismissed] = useState(false);
  const [displayStreak, setDisplayStreak] = useState(normalizedStreak);
  const displayStreakRef = useRef(normalizedStreak);
  const countersBootstrappedRef = useRef(false);
  const autoOpenedMomentKeyRef = useRef<string | null>(null);
  const handledNotificationSignalRef = useRef(0);
  const handledDeepLinkSignalRef = useRef(0);

  function animateCounter(
    valueRef: { current: number },
    timerRef: { current: ReturnType<typeof setInterval> | null },
    target: number,
    setter: (next: number) => void
  ) {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const start = valueRef.current;
    if (target <= start || target - start > 6) {
      valueRef.current = target;
      setter(target);
      return;
    }

    const steps = target - start;
    const stepDuration = Math.max(36, Math.floor(260 / steps));
    timerRef.current = setInterval(() => {
      const next = valueRef.current + 1;
      valueRef.current = next;
      setter(next);
      if (next >= target) {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }, stepDuration);
  }

  useEffect(() => {
    if (!activeJourney) return;
    if (!dailyMomentSettings.enabled || !dailyMomentSettings.autoOpenRecorder) return;
    if (!dailyMomentWindowOpen) return;
    if (practicedToday) return;
    if (recorderJourneyId) return;
    if (loading) return;

    const key = `${activeJourney.id}:${getDailyMomentKey(now)}`;
    if (autoOpenedMomentKeyRef.current === key) return;
    autoOpenedMomentKeyRef.current = key;
    trackEvent("daily_moment_prompted", { journeyId: activeJourney.id, source: "auto_open" });
    setRecorderJourneyId(activeJourney.id);
  }, [
    activeJourney?.id,
    dailyMomentSettings.enabled,
    dailyMomentSettings.autoOpenRecorder,
    dailyMomentWindowOpen,
    practicedToday,
    recorderJourneyId,
    loading,
    now
  ]);

  useEffect(() => {
    if (!openRecorderSignal) return;
    if (openRecorderSignal <= handledNotificationSignalRef.current) return;
    if (!activeJourney) return;
    handledNotificationSignalRef.current = openRecorderSignal;
    if (recorderJourneyId) return;
    setRecorderJourneyId(activeJourney.id);
    trackEvent("record_tapped", { journeyId: activeJourney.id, context: "daily_moment_notification" });
  }, [openRecorderSignal]); // Only re-run on signal change, not recorder state

  useEffect(() => {
    if (!deepLinkRecorderSignal) return;
    if (deepLinkRecorderSignal <= handledDeepLinkSignalRef.current) return;
    const targetJourneyId = deepLinkRecorderJourneyId ?? activeJourney?.id ?? null;
    if (!targetJourneyId) return;
    handledDeepLinkSignalRef.current = deepLinkRecorderSignal;
    if (recorderJourneyId) return;
    setRecorderJourneyId(targetJourneyId);
    trackEvent("record_tapped", { journeyId: targetJourneyId, context: "progress_deep_link" });
  }, [deepLinkRecorderSignal]); // Only re-run on signal change, not recorder state

  useEffect(() => {
    if (!countersBootstrappedRef.current) {
      countersBootstrappedRef.current = true;
      displayStreakRef.current = normalizedStreak;
      setDisplayStreak(normalizedStreak);
      return;
    }

    if (reducedMotion) {
      displayStreakRef.current = normalizedStreak;
      setDisplayStreak(normalizedStreak);
      return;
    }

    animateCounter(displayStreakRef, streakTimerRef, normalizedStreak, setDisplayStreak);
  }, [normalizedStreak, reducedMotion]);

  useEffect(() => {
    return () => {
      if (streakTimerRef.current) clearInterval(streakTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!activeJourney) {
      heroSectionReveal.setValue(0);
      previewSectionReveal.setValue(0);
      return;
    }

    if (reducedMotion) {
      heroSectionReveal.setValue(1);
      previewSectionReveal.setValue(1);
      calendarSectionReveal.setValue(1);
      return;
    }

    heroSectionReveal.setValue(1);
    previewSectionReveal.setValue(1);
    calendarSectionReveal.setValue(1);

    // FAB gentle floating bob
    Animated.loop(
      Animated.sequence([
        Animated.timing(fabBob, {
          toValue: 1,
          duration: 2000,
          easing: motionTokens.easing.outCubic,
          useNativeDriver: true
        }),
        Animated.timing(fabBob, {
          toValue: 0,
          duration: 2000,
          easing: motionTokens.easing.outCubic,
          useNativeDriver: true
        })
      ])
    ).start();
  }, [activeJourney?.id, reducedMotion, heroSectionReveal, previewSectionReveal, calendarSectionReveal, fabBob]);

  function handlePrimaryAction() {
    if (!activeJourney) return;
    if (chapterRevealReady) {
      trackEvent("milestone_reveal_opened", {
        journeyId: activeJourney.id,
        chapter: milestoneProgress?.milestoneChapter ?? activeJourney.milestoneChapter,
        source: "practice_primary"
      });
      onOpenProgress(activeJourney.id, { openReveal: true });
      return;
    }
    trackEvent("record_tapped", {
      journeyId: activeJourney.id,
      context: "practice_primary"
    });
    setRecorderJourneyId(activeJourney.id);
  }

  useEffect(() => {
    setWeeklyProofMessage(null);
    setWeeklyProofSharing(false);
  }, [activeJourney?.id, weeklyProof?.weekKey]);

  useEffect(() => {
    let cancelled = false;
    async function loadDismissedState() {
      if (!weeklyProof?.weekKey) {
        setWeeklyProofDismissed(false);
        return;
      }
      const dismissed = await readWeeklyProofCardDismissed({
        journeyId: activeJourney?.id ?? null,
        weekKey: weeklyProof.weekKey
      });
      if (cancelled) return;
      setWeeklyProofDismissed(dismissed);
    }
    void loadDismissedState();
    return () => {
      cancelled = true;
    };
  }, [activeJourney?.id, weeklyProof?.weekKey]);

  async function handleShareWeeklyProof() {
    if (!activeJourney || !weeklyProof || weeklyProofSharing || !weeklyProof.clips.length) return;
    setWeeklyProofSharing(true);
    setWeeklyProofMessage(null);
    const startedAtMs = Date.now();
    trackEvent("weekly_proof_share_started", {
      journeyId: activeJourney.id,
      progressDays: weeklyProof.progressDays,
      clipCount: weeklyProof.clips.length
    });
    const result = await exportAndShareReel({
      chapterNumber,
      trailerMoments: weeklyProof.trailerMoments,
      sourceClips: weeklyProof.clips,
      fallbackClip: weeklyProof.clips[weeklyProof.clips.length - 1] ?? null,
      milestoneLengthDays: 7,
      progressDays: weeklyProof.progressDays,
      currentStreak: activeStreak,
      storylineHeadline: `weekly proof • ${weeklyProof.weekLabel}`,
      storylineCaption: `${weeklyProof.progressDays}/7 days captured`,
      storylineReflection: "small daily reps stacked into visible progress this week.",
      token,
      journeyId: activeJourney.id
    });
    setWeeklyProofMessage(result.message);
    setWeeklyProofSharing(false);
    if (result.success) {
      setWeeklyProofDismissed(true);
      if (weeklyProof.weekKey) {
        await writeWeeklyProofCardDismissed({
          journeyId: activeJourney.id,
          weekKey: weeklyProof.weekKey
        });
      }
    }
    trackEvent("weekly_proof_share_completed", {
      journeyId: activeJourney.id,
      success: result.success,
      code: result.code,
      sourceKind: result.sourceKind,
      cacheHit: result.cacheHit,
      durationMs: Date.now() - startedAtMs,
      progressDays: weeklyProof.progressDays,
      clipCount: weeklyProof.clips.length
    });
  }

  return (
    <>
      {activeJourney ? (
        <ScrollView
          style={styles.container}
          contentContainerStyle={[
            styles.sceneContent,
            {
              paddingTop: sceneTopPadding,
              paddingHorizontal: sceneHorizontalPadding,
              paddingBottom: sceneBottomPadding
            }
          ]}
          showsVerticalScrollIndicator={false}
          scrollEnabled={false}
          scrollIndicatorInsets={{ bottom: Math.max(130, insets.bottom + 110) }}
        >
          <View
            style={[
              styles.contentTop,
              revealFocusMode ? styles.contentTopRevealFocus : undefined
            ]}
          >
            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
            <Animated.View
              style={[
                styles.motionSection,
                {
                  opacity: heroSectionReveal,
                  transform: [
                    {
                      translateY: heroSectionReveal.interpolate({
                        inputRange: [0, 1],
                        outputRange: [motionTokens.reveal.primaryY, 0]
                      })
                    },
                    {
                      scale: heroSectionReveal.interpolate({
                        inputRange: [0, 1],
                        outputRange: [motionTokens.reveal.primaryScaleFrom, 1]
                      })
                    }
                  ]
                }
              ]}
            >
              <View style={[styles.skillHeaderShell, revealFocusMode ? styles.skillHeaderShellRevealFocus : undefined]}>
                {latestClipThumbnail ? (
                  <Image
                    source={{ uri: latestClipThumbnail }}
                    style={styles.heroThumbnailBg}
                    blurRadius={20}
                    resizeMode="cover"
                  />
                ) : null}
                <LinearGradient
                  colors={
                    darkMode
                      ? theme.gradients.heroSurfaceDark
                      : latestClipThumbnail
                        ? ["rgba(244,239,230,0.82)", "rgba(235,227,214,0.88)"]
                        : revealFocusMode
                          ? theme.gradients.heroSurfaceReveal
                          : theme.gradients.heroSurface
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <View style={[styles.skillHeader, revealFocusMode ? styles.skillHeaderRevealFocus : undefined]}>
                  <View style={styles.skillHeaderRail} />
                  <Text style={[styles.sceneKicker, revealFocusMode ? styles.sceneKickerRevealFocus : undefined, darkMode ? styles.darkTextSecondary : null]}>
                    {`chapter ${chapterNumber}`}
                  </Text>
                  <View style={styles.skillHeaderTop}>
                    <Text
                      style={[
                        styles.skillName,
                        compactMode ? styles.skillNameCompact : undefined,
                        tightMode ? styles.skillNameTight : undefined,
                        { fontSize: skillNameSize, lineHeight: Math.round(skillNameSize * 1.15) },
                        darkMode ? styles.darkTextPrimary : null
                      ]}
                      numberOfLines={2}
                    >
                      {activeJourney.title.toLowerCase()}
                    </Text>
                    <Text style={styles.heroCaptureEmoji}>
                      {activeJourney.captureMode === "photo" ? "\uD83D\uDCF7" : "\uD83C\uDFA5"}
                    </Text>
                  </View>
                  <Animated.View style={{ transform: [{ scale: statPulse }] }}>
                    <Text
                      style={[
                        styles.dayLine,
                        compactMode ? styles.dayLineCompact : undefined,
                        tightMode ? styles.dayLineTight : undefined,
                        revealFocusMode ? styles.dayLineRevealFocus : undefined,
                        { fontSize: dayLineSize, lineHeight: Math.round(dayLineSize * 1.14) },
                        chapterRemainingDays <= 3 && chapterRemainingDays > 0 ? { fontSize: dayLineSize + 2, lineHeight: Math.round((dayLineSize + 2) * 1.14) } : undefined,
                        chapterRemainingDays === 1 && !chapterRevealReady ? { color: theme.colors.accent } : undefined,
                        chapterRevealReady ? { color: theme.colors.accent, fontWeight: "900" } : undefined,
                      ]}
                    >
                      {chapterRevealReady
                        ? `reveal ready • day ${chapterDisplayDay}/${chapterTargetDays}`
                        : `day ${chapterDisplayDay} of ${chapterTargetDays}`}
                    </Text>
                    {!chapterRevealReady ? (
                      <View style={displayStreak >= 7 ? styles.streakGlowWrap : undefined}>
                        <Text
                          style={[
                            styles.streakLine,
                            compactMode ? styles.streakLineCompact : undefined,
                            tightMode ? styles.streakLineTight : undefined,
                            { fontSize: streakLineSize, lineHeight: Math.round(streakLineSize * 1.15) },
                            displayStreak >= 7 ? styles.streakOnFire : undefined,
                            displayStreak >= 14 ? styles.streakIntense : undefined,
                          ]}
                        >
                          {displayStreak >= 7 ? `🔥 ${displayStreak}-day streak` : `${displayStreak}-day consistency`}
                        </Text>
                      </View>
                    ) : null}
                  </Animated.View>
                </View>
              </View>
              {/* Celebration banner replaced by calendar cell animation */}
            </Animated.View>
          </View>

          <Animated.View
            style={[
              styles.sceneMain,
              revealFocusMode ? styles.contentBottomRevealFocus : undefined,
              {
                opacity: previewSectionReveal,
                transform: [
                  {
                    translateY: previewSectionReveal.interpolate({
                      inputRange: [0, 1],
                      outputRange: [motionTokens.reveal.primaryY, 0]
                    })
                  },
                  {
                    scale: previewSectionReveal.interpolate({
                      inputRange: [0, 1],
                      outputRange: [motionTokens.reveal.primaryScaleFrom, 1]
                    })
                  }
                ]
              }
            ]}
          >
            {/* Progress bar */}
            <View style={styles.progressBarWrap}>
              <View style={styles.progressBarRow}>
                <View style={styles.progressBarTrack}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${Math.min(100, Math.round((chapterProgressDays / chapterTargetDays) * 100))}%` },
                      chapterRevealReady ? styles.progressBarFillComplete : undefined,
                    ]}
                  />
                </View>
                <Text style={styles.progressBarLabel}>
                  {chapterRevealReady
                    ? "✓"
                    : `${chapterProgressDays}/${chapterTargetDays}`}
                </Text>
              </View>
            </View>
            <View style={[styles.chapterPrimaryAction, revealFocusMode ? styles.chapterPrimaryActionRevealFocus : undefined]}>
              <ActionButton
                label={primaryActionLabel}
                variant="primary"
                fullWidth
                dense={scenePrimaryDense}
                noTopMargin
                onPress={handlePrimaryAction}
              />
            </View>
            {/* @hidden */ false && (missedDayRecovery as NonNullable<typeof missedDayRecovery>) ? (
              <View style={styles.recoveryCard}>
                <Text style={styles.recoveryTitle}>
                  {missedDayRecovery!.missedDays === 1 ? "missed one day?" : `missed ${missedDayRecovery!.missedDays} days?`}
                </Text>
                <Text style={styles.recoveryCopy}>log a quick take and reset</Text>
                <TactilePressable
                  style={styles.recoveryButton}
                  onPress={() => {
                    if (!activeJourney) return;
                    trackEvent("record_tapped", { journeyId: activeJourney.id, context: "missed_day_recovery" });
                    setRecorderJourneyId(activeJourney.id);
                  }}
                >
                  <Text style={styles.recoveryButtonText}>log quick take</Text>
                </TactilePressable>
              </View>
            ) : null}
            {/* @hidden */ false && (autoReminderSuggestion as NonNullable<typeof autoReminderSuggestion>) ? (
              <View style={styles.autoReminderCard}>
                <Text style={styles.autoReminderTitle}>keep your streak easy</Text>
                <Text style={styles.autoReminderCopy}>
                  set a daily cue at {suggestedReminderLabel ?? "this time"} based on when you logged your first take?
                </Text>
                <View style={styles.autoReminderActions}>
                  <TactilePressable
                    style={styles.autoReminderEnable}
                    onPress={() => {
                      onDailyMomentSettingsChange({
                        ...dailyMomentSettings,
                        enabled: true,
                        hour: autoReminderSuggestion!.hour,
                        minute: autoReminderSuggestion!.minute
                      });
                      trackEvent("daily_moment_auto_setup_enabled", {
                        journeyId: activeJourney?.id ?? null,
                        hour: autoReminderSuggestion!.hour,
                        minute: autoReminderSuggestion!.minute
                      });
                      void acknowledgeAutoReminderSuggestion();
                    }}
                  >
                    <Text style={styles.autoReminderEnableText}>enable</Text>
                  </TactilePressable>
                  <TactilePressable
                    style={styles.autoReminderDismiss}
                    onPress={() => {
                      trackEvent("daily_moment_auto_setup_dismissed", {
                        journeyId: activeJourney?.id ?? null
                      });
                      void acknowledgeAutoReminderSuggestion();
                    }}
                  >
                    <Text style={styles.autoReminderDismissText}>no thanks</Text>
                  </TactilePressable>
                </View>
              </View>
            ) : null}
            {/* @hidden */ false && (weeklyProof as NonNullable<typeof weeklyProof>) && !weeklyProofDismissed ? (
              <View style={styles.weeklyProofCard}>
                <Text style={styles.weeklyProofTitle}>weekly proof card</Text>
                <Text style={styles.weeklyProofCopy}>
                  {weeklyProof!.weekLabel} • {weeklyProof!.progressDays}/7 days captured
                </Text>
                <TactilePressable
                  style={[styles.weeklyProofButton, (!weeklyProof!.shareReady || weeklyProofSharing) ? styles.weeklyProofButtonDisabled : undefined]}
                  onPress={() => {
                    void handleShareWeeklyProof();
                  }}
                  disabled={!weeklyProof!.shareReady || weeklyProofSharing}
                >
                  <Text style={styles.weeklyProofButtonText}>
                    {weeklyProofSharing ? "preparing..." : weeklyProof!.shareReady ? "share weekly recap" : "log one more take"}
                  </Text>
                </TactilePressable>
                {weeklyProofMessage ? <Text style={styles.weeklyProofMessage}>{weeklyProofMessage}</Text> : null}
              </View>
            ) : null}
            {chapterRevealReady ? (
              <View style={styles.protocolCard}>
                <Text style={[styles.protocolStatus, darkMode && styles.darkTextPrimary]}>chapter done. reveal's ready.</Text>
              </View>
            ) : null}
            {activeJourney && (<Animated.View style={[styles.sceneCalendarWrap, {
              opacity: calendarSectionReveal,
              transform: [{
                translateY: calendarSectionReveal.interpolate({
                  inputRange: [0, 1],
                  outputRange: [14, 0]
                })
              }]
            }]}>
              <PracticeCalendarMini
                clips={activeJourneyClips}
                now={now}
                compact={sceneCalendarCompact}
                hero
                fill={false}
                scene
                darkMode={darkMode}
                captureMode={activeJourney.captureMode}
                milestoneLengthDays={chapterTargetDays}
                milestoneProgressDays={chapterProgressDays}
                revealReady={chapterRevealReady}
                saveSignal={activeJourneyClips.length}
                onReRecordToday={() => {
                  if (!activeJourney) return;
                  trackEvent("record_tapped", { journeyId: activeJourney.id, context: "calendar_today_rerecord" });
                  setRecorderJourneyId(activeJourney.id);
                }}
              />
            </Animated.View>)}
          </Animated.View>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.container}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: sceneTopPadding,
              paddingHorizontal: sceneHorizontalPadding,
              paddingBottom: Math.max(166, insets.bottom + 132)
            }
          ]}
          showsVerticalScrollIndicator={false}
          scrollIndicatorInsets={{ bottom: Math.max(126, insets.bottom + 100) }}
        >
          <View style={styles.contentTop}>
            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
            {statusMessage && !celebration ? <Text style={styles.statusText}>{statusMessage}</Text> : null}
            {/* Loading text removed — glitchy on tab switch */}
            {!loading ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyTitle}>start something.</Text>
                <Text style={styles.emptySubtitle}>pick a skill.</Text>
                <ActionButton label="start first journey" variant="primary" fullWidth dense={compactMode} onPress={() => setManageOpen(true)} />
              </View>
            ) : null}
          </View>
        </ScrollView>
      )}

      {saveFlightClipUrl ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.saveFlightChip,
            {
              opacity: saveFlightOpacity,
              transform: [{ translateX: saveFlightX }, { translateY: saveFlightY }, { scale: saveFlightScale }]
            }
          ]}
        >
          <Video source={{ uri: saveFlightClipUrl }} style={styles.saveFlightVideo} shouldPlay isLooping isMuted resizeMode={ResizeMode.COVER} />
        </Animated.View>
      ) : null}

      <ManageJourneysModal
        visible={manageOpen}
        journeys={journeys}
        activeJourneyId={activeJourneyId}
        clipsByJourney={clipsByJourney}
        creating={creating}
        refreshing={refreshing}
        updatingId={updatingId}
        newTitle={newTitle}
        newMilestoneLengthDays={newMilestoneLengthDays}
        newCaptureMode={newCaptureMode}
        onTitleChange={setNewTitle}
        onMilestoneLengthChange={setNewMilestoneLengthDays}
        onCaptureModeChange={setNewCaptureMode}
        onClose={() => setManageOpen(false)}
        onCreateJourney={() => {
          void handleCreateJourney();
        }}
        onRefresh={() => {
          void loadJourneys({ silent: true });
        }}
        onSetActive={(journeyId) => {
          onActiveJourneyChange(journeyId);
          void loadJourneyClips(journeyId);
        }}
        onRecord={(journeyId) => {
          onActiveJourneyChange(journeyId);
          trackEvent("record_tapped", { journeyId, context: "journey_manage" });
          setManageOpen(false);
          setRecorderJourneyId(journeyId);
        }}
        onArchive={(journeyId) => {
          void handleArchiveJourney(journeyId);
        }}
      />

      {activeJourney && !chapterRevealReady ? (
        <Animated.View style={{
          position: "absolute",
          bottom: 24,
          alignSelf: "center",
          zIndex: 100,
          transform: [{
            translateY: fabBob.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -4]
            })
          }]
        }}>
          <TactilePressable
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: theme.colors.accent,
              alignItems: "center",
              justifyContent: "center",
              shadowColor: theme.colors.accent,
              shadowOpacity: 0.3,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
              elevation: 6,
            }}
            pressScale={0.9}
            onPress={() => {
              triggerSelectionHaptic();
              setRecorderJourneyId(activeJourney.id);
            }}
          >
            <Text style={{ color: "#fff", fontSize: 28, fontWeight: "300", marginTop: -2 }}>+</Text>
          </TactilePressable>
        </Animated.View>
      ) : null}

      <PracticeRecorder
        visible={Boolean(recorderJourneyId)}
        saving={clipSaving}
        statusMessage={recorderStatusMessage}
        journeyTitle={recorderJourney?.title ?? "practice"}
        dayNumber={recorderDay}
        captureType={recorderCaptureType}
        skillPack={recorderJourney?.skillPack ?? "fitness"}
        onCancel={() => {
          if (clipSaving) return;
          setRecorderJourneyId(null);
          setRecorderStatusMessage(null);
        }}
        onSave={async (payload) => {
          const result = await handleSaveRecordedClip(payload);
          if (result.success) {
            if (__DEV__) console.log("[JourneysScreen] Clip saved, bumping recordingsRevision");
            onRecordingsRevisionBump?.();
          }
          return result;
        }}
        referenceClipUrl={recorderReferenceClipUrl}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  scrollContent: {
    flexGrow: 1
  },
  sceneContent: {
    flexGrow: 1
  },
  contentTop: {
    gap: 14
  },
  contentTopLocked: {
    gap: 6
  },
  contentTopReadyCompact: {
    gap: 8
  },
  contentTopRevealFocus: {
    gap: 3
  },
  contentBottom: {
    marginTop: 10
  },
  sceneMain: {
    marginTop: 6,
    minHeight: 0
  },
  sceneCalendarWrap: {
    marginTop: 4,
    minHeight: 0
  },
  contentBottomReadyCompact: {
    marginTop: 10
  },
  contentBottomRevealFocus: {
    marginTop: 10
  },
  contentBottomLocked: {
    marginTop: 8,
    flex: 1,
    minHeight: 0
  },
  celebrationBanner: {
    marginTop: 2,
    borderRadius: theme.shape.cardRadiusMd,
    backgroundColor: "rgba(13,159,101,0.14)",
    borderWidth: 1,
    borderColor: "rgba(13,159,101,0.36)",
    paddingVertical: 10,
    paddingHorizontal: 12
  },
  celebrationTitle: {
    color: theme.colors.success,
    fontWeight: "800",
    fontSize: 17,
    textAlign: "center",
    fontFamily: theme.typography.heading
  },
  celebrationSubtitle: {
    marginTop: 2,
    color: theme.colors.textSecondary,
    fontWeight: "700",
    fontSize: 13,
    textAlign: "center",
    fontFamily: theme.typography.body
  },
  errorText: {
    marginTop: 12,
    color: theme.colors.danger,
    fontWeight: "700"
  },
  statusText: {
    marginTop: 8,
    color: theme.colors.success,
    fontWeight: "700"
  },
  mutedText: {
    marginTop: 10,
    color: theme.colors.textSecondary
  },
  motionSection: {
    width: "100%"
  },
  skillHeaderShell: {
    borderRadius: theme.shape.cardRadiusMd,
    borderWidth: 0,
    borderColor: "transparent",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    shadowColor: "#000000",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 0,
    overflow: "hidden"
  },
  heroThumbnailBg: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.35
  },
  skillHeaderShellRevealFocus: {
    borderRadius: theme.shape.cardRadiusMd,
    borderColor: "#121212",
    paddingHorizontal: 11,
    paddingTop: 9,
    paddingBottom: 9,
    shadowOpacity: 0.18,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
    elevation: 0
  },
  skillHeader: {
    gap: 10
  },
  skillHeaderRail: {
    width: 56,
    height: 5,
    borderRadius: 0,
    backgroundColor: "#ff5a1f"
  },
  skillHeaderRevealFocus: {
    gap: 5
  },
  sceneKicker: {
    color: "#2d2d2d",
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "800",
    letterSpacing: 0.3,

    fontFamily: theme.typography.label
  },
  sceneKickerRevealFocus: {
    color: "#2d2d2d",
    opacity: 1,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 1
  },
  skillHeaderTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10
  },
  skillName: {
    flex: 1,
    flexShrink: 1,
    color: "#101010",
    fontSize: 48,
    lineHeight: 52,
    fontWeight: "800",
    fontFamily: theme.typography.display
  },
  heroCaptureEmoji: {
    fontSize: 24,
    marginTop: 4,
  },
  skillNameCompact: {
    fontSize: 24,
    lineHeight: 28
  },
  skillNameTight: {
    fontSize: 21,
    lineHeight: 24
  },
  moreChip: {
    minHeight: 38,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.12)",
    backgroundColor: "rgba(0,0,0,0.06)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 13,
    paddingVertical: 7,
    shadowColor: "transparent",
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 }
  },
  moreChipRevealFocus: {
    minHeight: 34,
    borderRadius: 2,
    borderColor: "rgba(0,0,0,0.12)",
    backgroundColor: "rgba(0,0,0,0.06)",
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  moreChipCompact: {
    minHeight: 30,
    borderRadius: Math.max(theme.shape.chipRadius - 1, 8),
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  moreChipText: {
    color: theme.colors.textSecondary,
    fontWeight: "700",
    fontSize: 14,
    lineHeight: 17,
    letterSpacing: 0.15,

    fontFamily: theme.typography.label
  },
  dayLine: {
    color: "#111111",
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
    letterSpacing: 0.12,
    fontFamily: theme.typography.display
  },
  dayLineCompact: {
    fontSize: 20,
    lineHeight: 23
  },
  dayLineTight: {
    fontSize: 18,
    lineHeight: 21
  },
  dayLineRevealFocus: {
    color: "#111111",
    fontWeight: "800"
  },
  compactStreakLine: {
    marginTop: 2,
    color: "#ea3d00",
    fontSize: 14,
    lineHeight: 17,
    fontWeight: "800"
  },
  streakLine: {
    marginTop: 4,
    color: "#ea3d00",
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "800",
    letterSpacing: 0.24,
    fontFamily: theme.typography.heading
  },
  streakLineCompact: {
    fontSize: 16,
    lineHeight: 19
  },
  streakLineTight: {
    fontSize: 14,
    lineHeight: 17
  },
  streakGlowWrap: {
    backgroundColor: "rgba(255,90,31,0.08)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
    marginTop: 2,
  },
  streakOnFire: {
    color: "#ff5a1f",
    fontWeight: "900",
  },
  streakIntense: {
    color: "#ea3d00",
    fontSize: 16,
  },
  captureModeRow: {
    marginTop: 6,
    flexDirection: "row",
    gap: 8
  },
  captureModeChip: {
    borderRadius: 2,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(240,232,221,0.92)",
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  captureModeChipSelected: {
    borderColor: "#111111",
    backgroundColor: "rgba(255,90,31,0.22)"
  },
  captureModeChipText: {
    color: "#222222",
    fontSize: 12,
    fontWeight: "800"
  },
  captureModeChipTextSelected: {
    color: theme.colors.accentStrong
  },
  progressBarWrap: {
    paddingHorizontal: 4,
    marginTop: 4,
    marginBottom: 6,
  },
  progressBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  progressBarTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(0,0,0,0.06)",
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 4,
    backgroundColor: theme.colors.accent,
  },
  progressBarFillComplete: {
    backgroundColor: "#E8450A",
  },
  progressBarLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "rgba(0,0,0,0.35)",
  },
  chapterScene: {
    gap: 14
  },
  chapterSceneRevealFocus: {
    gap: 8
  },
  chapterSceneLocked: {
    flex: 1
  },
  chapterSceneFrame: {
    borderRadius: 0,
    borderWidth: 0,
    borderColor: "transparent",
    backgroundColor: "transparent",
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
    shadowColor: "transparent",
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0
  },
  chapterSceneFrameLocked: {
    flex: 1
  },
  chapterMetaRail: {
    marginBottom: 3,
    gap: 2
  },
  chapterPrimaryAction: {
    marginBottom: 6
  },
  chapterPrimaryActionRevealFocus: {
    marginBottom: 6
  },
  recoveryCard: {
    marginBottom: 6,
    borderRadius: theme.shape.cardRadiusMd,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(245,236,226,0.98)",
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 6
  },
  recoveryTitle: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "800",

    letterSpacing: 0.85,
    fontFamily: theme.typography.label
  },
  recoveryCopy: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    fontFamily: theme.typography.body
  },
  recoveryButton: {
    borderRadius: theme.shape.buttonRadius,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(255,90,31,0.24)",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 10
  },
  recoveryButtonText: {
    color: "#130900",
    fontWeight: "800",
    fontSize: 12,

    letterSpacing: 0.8,
    fontFamily: theme.typography.label
  },
  autoReminderCard: {
    marginBottom: 6,
    borderRadius: theme.shape.cardRadiusMd,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(241,233,222,0.98)",
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 6
  },
  autoReminderTitle: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "800",

    letterSpacing: 0.85,
    fontFamily: theme.typography.label
  },
  autoReminderCopy: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    fontFamily: theme.typography.body
  },
  autoReminderActions: {
    flexDirection: "row",
    gap: 8
  },
  autoReminderEnable: {
    flex: 1,
    borderRadius: theme.shape.buttonRadius,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(255,90,31,0.24)",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 10
  },
  autoReminderEnableText: {
    color: "#130900",
    fontWeight: "800",
    fontSize: 12,

    letterSpacing: 0.8,
    fontFamily: theme.typography.label
  },
  autoReminderDismiss: {
    flex: 1,
    borderRadius: theme.shape.buttonRadius,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(255,255,255,0.42)",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 10
  },
  autoReminderDismissText: {
    color: theme.colors.textSecondary,
    fontWeight: "700",
    fontSize: 12,

    letterSpacing: 0.8,
    fontFamily: theme.typography.label
  },
  weeklyProofCard: {
    marginBottom: 6,
    borderRadius: theme.shape.cardRadiusMd,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(240,232,220,0.98)",
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 6
  },
  weeklyProofTitle: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "800",

    letterSpacing: 0.85,
    fontFamily: theme.typography.label
  },
  weeklyProofCopy: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    fontFamily: theme.typography.body
  },
  weeklyProofButton: {
    borderRadius: theme.shape.buttonRadius,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(255,90,31,0.24)",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 10
  },
  weeklyProofButtonDisabled: {
    opacity: 0.66
  },
  weeklyProofButtonText: {
    color: "#130900",
    fontWeight: "800",
    fontSize: 12,

    letterSpacing: 0.8,
    fontFamily: theme.typography.label
  },
  weeklyProofMessage: {
    color: "#2d2d2d",
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 16,
    fontFamily: theme.typography.body
  },
  evolutionCard: {
    marginBottom: 6,
    borderRadius: theme.shape.cardRadiusMd,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(240,232,220,0.98)",
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 6
  },
  evolutionTitle: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "800",

    letterSpacing: 0.85,
    fontFamily: theme.typography.label
  },
  evolutionThumbRow: {
    flexDirection: "row",
    gap: 8
  },
  evolutionThumbShell: {
    flex: 1,
    borderRadius: theme.shape.cardRadiusMd,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    overflow: "hidden",
    backgroundColor: "rgba(238,230,219,0.92)",
    aspectRatio: 0.75
  },
  evolutionThumbImage: {
    width: "100%",
    height: "100%"
  },
  evolutionThumbFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(228,219,206,0.95)"
  },
  evolutionThumbFallbackText: {
    color: "#2b2b2b",
    fontSize: 11,
    fontWeight: "800",

    letterSpacing: 0.7,
    fontFamily: theme.typography.label
  },
  evolutionThumbLabelWrap: {
    position: "absolute",
    left: 6,
    top: 6,
    borderRadius: theme.shape.pillRadius,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(240,232,220,0.95)",
    paddingHorizontal: 7,
    paddingVertical: 3
  },
  evolutionThumbLabelText: {
    color: "#111111",
    fontWeight: "800",
    fontSize: 10,

    letterSpacing: 0.8,
    fontFamily: theme.typography.label
  },
  evolutionCopy: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    fontFamily: theme.typography.body
  },
  protocolCard: {
    marginTop: 8,
    borderRadius: theme.shape.cardRadiusMd,
    borderWidth: 0,
    borderColor: "transparent",
    backgroundColor: "transparent",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6
  },
  protocolKicker: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "800",

    letterSpacing: 0.3,
    fontFamily: theme.typography.label
  },
  protocolTitle: {
    color: theme.colors.textPrimary,
    fontSize: 17,
    lineHeight: 20,
    fontWeight: "800",
    fontFamily: theme.typography.heading
  },
  protocolCopy: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "600",
    fontFamily: theme.typography.body
  },
  protocolStatus: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
    fontFamily: theme.typography.body
  },
  protocolMeta: {
    color: "#2f2f2f",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    fontFamily: theme.typography.body
  },
  chapterMetaPrimary: {
    color: "#2b2b2b",
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
    fontFamily: theme.typography.label
  },
  criticalFooterRow: {
    borderRadius: 2,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(240,233,223,0.96)",
    paddingHorizontal: 11,
    paddingVertical: 9
  },
  criticalFooterTitle: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    lineHeight: 17,
    fontWeight: "800"
  },
  criticalFooterSubtitle: {
    marginTop: 2,
    color: "#2b2b2b",
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "600"
  },
  criticalFooterAction: {
    marginTop: 8,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(255,90,31,0.24)",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 10
  },
  criticalFooterActionText: {
    color: "#111111",
    fontSize: 13,
    fontWeight: "800"
  },
  emptyWrap: {
    marginTop: 26,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(244,238,229,0.96)",
    padding: 16
  },
  emptyTitle: {
    color: theme.colors.textPrimary,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "800"
  },
  emptySubtitle: {
    marginTop: 7,
    color: "#2b2b2b",
    fontSize: 16,
    fontWeight: "600"
  },
  saveFlightChip: {
    position: "absolute",
    left: 18,
    bottom: 126,
    width: 82,
    height: 116,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.62)",
    backgroundColor: "rgba(14,99,255,0.18)",
    shadowColor: "#0d2d4f",
    shadowOpacity: 0.24,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8
  },
  saveFlightVideo: {
    width: "100%",
    height: "100%"
  },
  darkTextPrimary: {
    color: theme.darkColors.textPrimary
  },
  darkTextSecondary: {
    color: theme.darkColors.textSecondary
  },
  darkCard: {
    backgroundColor: theme.darkColors.cardBg,
    borderColor: theme.darkColors.cardBorder
  }
});
