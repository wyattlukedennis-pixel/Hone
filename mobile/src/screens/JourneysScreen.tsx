import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { ResizeMode, Video } from "expo-av";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { trackEvent } from "../analytics/events";
import { motionTokens } from "../motion/tokens";
import { PracticeRecorder } from "../components/PracticeRecorder";
import { TactilePressable } from "../components/TactilePressable";
import { theme } from "../theme";
import type { DailyMomentSettings } from "../types/dailyMoment";
import type { DevDateShiftSettings } from "../types/devTools";
import { getDailyMomentKey, isInDailyMomentWindow } from "../utils/dailyMoment";
import { useReducedMotion } from "../utils/useReducedMotion";
import { ActionButton } from "./practice/ActionButton";
import { ManageJourneysModal } from "./practice/ManageJourneysModal";
import { PracticeCalendarMini } from "./practice/PracticeCalendarMini";
import { usePracticeState } from "./practice/usePracticeState";

type JourneysScreenProps = {
  token: string;
  activeJourneyId: string | null;
  mediaMode: "video" | "photo";
  onActiveJourneyChange: (journeyId: string | null) => void;
  onOpenProgress: (journeyId: string, options?: { openReveal?: boolean }) => void;
  devDateShiftSettings: DevDateShiftSettings;
  onDevDateShiftSettingsChange: (next: DevDateShiftSettings) => void;
  dailyMomentSettings: DailyMomentSettings;
  openRecorderSignal: number;
  recordingsRevision: number;
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
  openRecorderSignal,
  recordingsRevision
}: JourneysScreenProps) {
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [clockTick, setClockTick] = useState(Date.now());
  const streakTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heroSectionReveal = useRef(new Animated.Value(0)).current;
  const previewSectionReveal = useRef(new Animated.Value(0)).current;
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
    newCategory,
    setNewCategory,
    newGoalText,
    setNewGoalText,
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
    celebrationOpacity,
    celebrationY,
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
    recorderReferenceClipUrl
  } = usePracticeState({
    token,
    activeJourneyId,
    onActiveJourneyChange,
    mediaMode,
    devDateShiftSettings,
    onDevDateShiftSettingsChange,
    recordingsRevision
  });

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
  const chapterCountdownLabel = chapterRevealReady
    ? "Your reveal is ready."
    : `${chapterRemainingDays} ${chapterRemainingDays === 1 ? "practice" : "practices"} until reveal`;
  const criticalMode = availableHeight < 560;
  const ultraCompactMode = availableHeight < 680;
  const tightMode = availableHeight < 700;
  const compactMode = availableHeight < 760;
  const revealFocusMode = chapterRevealReady;
  const headingScale = availableHeight >= 860 ? 1.02 : availableHeight >= 760 ? 0.98 : availableHeight >= 700 ? 0.93 : 0.88;
  const effectiveHeadingScale = revealFocusMode ? headingScale * 0.92 : headingScale;
  const skillNameSize = Math.round(23 * effectiveHeadingScale);
  const dayLineSize = Math.round(17 * effectiveHeadingScale);
  const streakLineSize = Math.round(13 * effectiveHeadingScale);
  const sceneHorizontalPadding = criticalMode ? 14 : 20;
  const sceneTopPadding = criticalMode ? 2 : ultraCompactMode ? 6 : 10;
  const sceneBottomPadding = Math.max(insets.bottom + 112, 124);
  const scenePrimaryDense = compactMode || criticalMode;
  const sceneCalendarCompact = criticalMode || availableHeight < 700;
  const [displayStreak, setDisplayStreak] = useState(normalizedStreak);
  const displayStreakRef = useRef(normalizedStreak);
  const countersBootstrappedRef = useRef(false);
  const autoOpenedMomentKeyRef = useRef<string | null>(null);
  const handledNotificationSignalRef = useRef(0);

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
  }, [openRecorderSignal, activeJourney?.id, recorderJourneyId]);

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
      return;
    }

    heroSectionReveal.setValue(0);
    previewSectionReveal.setValue(0);
    Animated.stagger(motionTokens.sectionStaggerMs, [
      Animated.timing(heroSectionReveal, {
        toValue: 1,
        duration: theme.motion.transitionMs + motionTokens.durationOffset.sectionIn,
        easing: motionTokens.easing.outCubic,
        useNativeDriver: true
      }),
      Animated.timing(previewSectionReveal, {
        toValue: 1,
        duration: theme.motion.transitionMs + motionTokens.durationOffset.sectionInLight,
        easing: motionTokens.easing.outCubic,
        useNativeDriver: true
      })
    ]).start();
  }, [activeJourney?.id, reducedMotion, heroSectionReveal, previewSectionReveal]);

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
    trackEvent("record_tapped", { journeyId: activeJourney.id, context: "practice_primary" });
    setRecorderJourneyId(activeJourney.id);
  }

  return (
    <>
      {activeJourney ? (
        <View style={styles.container}>
          <View
            style={[
              styles.sceneContent,
              {
                paddingTop: sceneTopPadding,
                paddingHorizontal: sceneHorizontalPadding,
                paddingBottom: sceneBottomPadding
              }
            ]}
          >
            <View style={[styles.contentTop, revealFocusMode ? styles.contentTopRevealFocus : undefined]}>
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
                <View style={[styles.skillHeader, revealFocusMode ? styles.skillHeaderRevealFocus : undefined]}>
                  <Text style={[styles.sceneKicker, revealFocusMode ? styles.sceneKickerRevealFocus : undefined]}>Chapter {chapterNumber}</Text>
                  <View style={styles.skillHeaderTop}>
                    <Text
                      style={[
                        styles.skillName,
                        compactMode ? styles.skillNameCompact : undefined,
                        tightMode ? styles.skillNameTight : undefined,
                        { fontSize: skillNameSize, lineHeight: Math.round(skillNameSize * 1.13) }
                      ]}
                      numberOfLines={1}
                    >
                      {activeJourney.title}
                    </Text>
                    <TactilePressable
                      style={[
                        styles.moreChip,
                        compactMode ? styles.moreChipCompact : undefined,
                        revealFocusMode ? styles.moreChipRevealFocus : undefined
                      ]}
                      onPress={() => {
                        setManageOpen(true);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Manage journeys"
                      accessibilityHint="Create, switch, and close journeys"
                    >
                      <Text style={styles.moreChipText}>Manage</Text>
                    </TactilePressable>
                  </View>
                  <Animated.View style={{ transform: [{ scale: statPulse }] }}>
                    <Text
                      style={[
                        styles.dayLine,
                        compactMode ? styles.dayLineCompact : undefined,
                        tightMode ? styles.dayLineTight : undefined,
                        revealFocusMode ? styles.dayLineRevealFocus : undefined,
                        { fontSize: dayLineSize, lineHeight: Math.round(dayLineSize * 1.14) }
                      ]}
                    >
                      {chapterRevealReady
                        ? `Reveal ready • Day ${chapterDisplayDay}/${chapterTargetDays}`
                        : `Day ${chapterDisplayDay} of ${chapterTargetDays}`}
                    </Text>
                    {!chapterRevealReady ? (
                      <Text
                        style={[
                          styles.streakLine,
                          compactMode ? styles.streakLineCompact : undefined,
                          tightMode ? styles.streakLineTight : undefined,
                          { fontSize: streakLineSize, lineHeight: Math.round(streakLineSize * 1.15) }
                        ]}
                      >
                        🔥 {displayStreak} Day Streak
                      </Text>
                    ) : null}
                  </Animated.View>
                </View>
                {celebration ? (
                  <Animated.View style={[styles.celebrationBanner, { opacity: celebrationOpacity, transform: [{ translateY: celebrationY }] }]}>
                    <Text style={styles.celebrationTitle}>{celebration.title}</Text>
                    <Text style={styles.celebrationSubtitle}>{celebration.subtitle}</Text>
                  </Animated.View>
                ) : null}
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
              {!chapterRevealReady ? (
                <View style={styles.chapterMetaRail}>
                  <Text style={styles.chapterMetaPrimary} numberOfLines={1}>
                    {chapterCountdownLabel}
                  </Text>
                </View>
              ) : null}
              <View style={[styles.chapterPrimaryAction, revealFocusMode ? styles.chapterPrimaryActionRevealFocus : undefined]}>
                <ActionButton
                  label={chapterRevealReady ? "Open Reveal" : practicedToday ? "Record Again Today" : "Record Today"}
                  variant="primary"
                  fullWidth
                  dense={scenePrimaryDense}
                  onPress={handlePrimaryAction}
                />
              </View>
              <View style={styles.sceneCalendarWrap}>
                <PracticeCalendarMini
                  clips={activeJourneyClips}
                  now={now}
                  compact={sceneCalendarCompact}
                  hero
                  fill={false}
                  scene
                  captureMode={activeJourney.captureMode}
                  milestoneLengthDays={chapterTargetDays}
                  milestoneProgressDays={chapterProgressDays}
                  revealReady={chapterRevealReady}
                  onReRecordToday={() => {
                    if (!activeJourney) return;
                    trackEvent("record_tapped", { journeyId: activeJourney.id, context: "calendar_today_rerecord" });
                    setRecorderJourneyId(activeJourney.id);
                  }}
                />
              </View>
            </Animated.View>
          </View>
        </View>
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
            {loading ? <Text style={styles.mutedText}>Loading your practice space...</Text> : null}
            {!loading ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyTitle}>Your journey starts today.</Text>
                <Text style={styles.emptySubtitle}>Create a skill and record your first practice clip.</Text>
                <ActionButton label="Create First Journey" variant="primary" fullWidth dense={compactMode} onPress={() => setManageOpen(true)} />
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
        newCategory={newCategory}
        newGoalText={newGoalText}
        newMilestoneLengthDays={newMilestoneLengthDays}
        newCaptureMode={newCaptureMode}
        onTitleChange={setNewTitle}
        onCategoryChange={setNewCategory}
        onGoalTextChange={setNewGoalText}
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

      <PracticeRecorder
        visible={Boolean(recorderJourneyId)}
        saving={clipSaving}
        statusMessage={recorderStatusMessage}
        journeyTitle={recorderJourney?.title ?? "Practice"}
        dayNumber={recorderDay}
        captureType={recorderCaptureType}
        referenceClipUrl={recorderReferenceClipUrl}
        onCancel={() => {
          if (clipSaving) return;
          setRecorderJourneyId(null);
          setRecorderStatusMessage(null);
        }}
        onSave={handleSaveRecordedClip}
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
    flex: 1
  },
  contentTop: {
    gap: 6
  },
  contentTopLocked: {
    gap: 0
  },
  contentTopReadyCompact: {
    gap: 2
  },
  contentTopRevealFocus: {
    gap: 4
  },
  contentBottom: {
    marginTop: 10
  },
  sceneMain: {
    marginTop: 10,
    minHeight: 0
  },
  sceneCalendarWrap: {
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
    marginTop: -2,
    borderRadius: 16,
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
    textAlign: "center"
  },
  celebrationSubtitle: {
    marginTop: 2,
    color: theme.colors.textSecondary,
    fontWeight: "700",
    fontSize: 13,
    textAlign: "center"
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
  skillHeader: {
    gap: 6
  },
  skillHeaderRevealFocus: {
    gap: 5
  },
  sceneKicker: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.68
  },
  sceneKickerRevealFocus: {
    color: theme.colors.textSecondary,
    opacity: 0.88,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 0.55
  },
  skillHeaderTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  skillName: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: 25,
    lineHeight: 29,
    fontWeight: "800"
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
    minHeight: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.72)",
    backgroundColor: "rgba(239,248,255,0.54)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: "#102f58",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 }
  },
  moreChipRevealFocus: {
    minHeight: 38,
    borderRadius: 19,
    borderColor: "rgba(255,255,255,0.74)",
    backgroundColor: "rgba(255,255,255,0.32)",
    shadowOpacity: 0.07,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  moreChipCompact: {
    minHeight: 34,
    borderRadius: 17,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  moreChipText: {
    color: theme.colors.textPrimary,
    fontWeight: "800",
    fontSize: 12,
    lineHeight: 14,
    letterSpacing: 0.2
  },
  dayLine: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    lineHeight: 21,
    fontWeight: "800"
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
    color: theme.colors.textPrimary,
    fontWeight: "800"
  },
  compactStreakLine: {
    marginTop: 2,
    color: theme.colors.accentStrong,
    fontSize: 14,
    lineHeight: 17,
    fontWeight: "800"
  },
  streakLine: {
    color: theme.colors.accentStrong,
    fontSize: 14,
    lineHeight: 17,
    fontWeight: "800"
  },
  streakLineCompact: {
    fontSize: 16,
    lineHeight: 19
  },
  streakLineTight: {
    fontSize: 14,
    lineHeight: 17
  },
  captureModeRow: {
    marginTop: 6,
    flexDirection: "row",
    gap: 8
  },
  captureModeChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.68)",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  captureModeChipSelected: {
    borderColor: "rgba(14,99,255,0.62)",
    backgroundColor: "rgba(14,99,255,0.2)"
  },
  captureModeChipText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: "800"
  },
  captureModeChipTextSelected: {
    color: theme.colors.accentStrong
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
    marginBottom: 4,
    gap: 2
  },
  chapterPrimaryAction: {
    marginBottom: 14
  },
  chapterPrimaryActionRevealFocus: {
    marginBottom: 16
  },
  chapterMetaPrimary: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800"
  },
  criticalFooterRow: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.68)",
    backgroundColor: "rgba(255,255,255,0.18)",
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
    color: theme.colors.textSecondary,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "600"
  },
  criticalFooterAction: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(14,99,255,0.42)",
    backgroundColor: "rgba(14,99,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 10
  },
  criticalFooterActionText: {
    color: theme.colors.accentStrong,
    fontSize: 13,
    fontWeight: "800"
  },
  emptyWrap: {
    marginTop: 26,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.72)",
    backgroundColor: "rgba(255,255,255,0.22)",
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
    color: theme.colors.textSecondary,
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
  }
});
