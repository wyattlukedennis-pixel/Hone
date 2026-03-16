import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing } from "react-native";

import { trackEvent } from "../../analytics/events";
import { listClips } from "../../api/clips";
import { listJourneyReveals, listJourneys } from "../../api/journeys";
import { motionTokens } from "../../motion/tokens";
import type { Clip } from "../../types/clip";
import type { Journey, JourneyReveal } from "../../types/journey";
import { theme } from "../../theme";
import { useReducedMotion } from "../../utils/useReducedMotion";
import {
  buildChapterComparisonPair,
  buildPracticeHeatmap,
  getChapterDayCount,
  getChapterStreak,
  getMilestoneChapterProgress,
  getMilestoneStates,
  hasChapterClipToday
} from "../../utils/progress";

export type ComparisonPreset = "day1" | "week" | "month";

export const comparisonPresetOptions: Array<{ key: ComparisonPreset; label: string; chipLabel: string }> = [
  { key: "day1", label: "Milestone Reveal", chipLabel: "Reveal" }
];

type UseProgressStateParams = {
  token: string;
  activeJourneyId: string | null;
  onActiveJourneyChange: (journeyId: string | null) => void;
  mediaMode: "video" | "photo";
  devNowDayOffset: number;
  recordingsRevision: number;
};

function toProgressErrorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : "Unexpected error";
  if (raw === "UNAUTHORIZED") return "Session expired. Please login again.";
  if (raw === "BACKEND_MIGRATION_REQUIRED") return "Backend schema is outdated. Restart backend and run migrations.";
  if (raw === "Internal Server Error") return "Backend error. Check backend logs and restart the API.";
  if (raw.startsWith("Network request failed")) return raw;
  return raw;
}

export function useProgressState({
  token,
  activeJourneyId,
  onActiveJourneyChange,
  mediaMode,
  devNowDayOffset,
  recordingsRevision
}: UseProgressStateParams) {
  const reducedMotion = useReducedMotion();

  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [journeysLoading, setJourneysLoading] = useState(true);
  const [clips, setClips] = useState<Clip[]>([]);
  const [clipsLoading, setClipsLoading] = useState(false);
  const [reveals, setReveals] = useState<JourneyReveal[]>([]);
  const [revealsLoading, setRevealsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [preset, setPreset] = useState<ComparisonPreset>("day1");
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [recentlyUnlockedMilestoneDay, setRecentlyUnlockedMilestoneDay] = useState<number | null>(null);

  const modalBackdropReveal = useRef(new Animated.Value(0)).current;
  const modalCardReveal = useRef(new Animated.Value(0)).current;
  const thenPanelReveal = useRef(new Animated.Value(0)).current;
  const nowPanelReveal = useRef(new Animated.Value(0)).current;
  const labelsReveal = useRef(new Animated.Value(0)).current;
  const compareCardReveal = useRef(new Animated.Value(0)).current;
  const nextUnlockReveal = useRef(new Animated.Value(0)).current;

  const milestoneUnlockPulse = useRef(new Animated.Value(1)).current;
  const milestoneUnlockGlow = useRef(new Animated.Value(0)).current;
  const milestoneJourneyRef = useRef<string | null>(null);
  const previousUnlockedCountRef = useRef(0);
  const duration = (ms: number) => (reducedMotion ? 0 : ms);

  useEffect(() => {
    async function load() {
      setJourneysLoading(true);
      setErrorMessage(null);
      try {
        const response = await listJourneys(token);
        setJourneys(response.journeys);
        if (!response.journeys.length) {
          onActiveJourneyChange(null);
          return;
        }
        const modeJourneys = response.journeys.filter((journey) => journey.captureMode === mediaMode);
        const activeExists = Boolean(activeJourneyId) && modeJourneys.some((journey) => journey.id === activeJourneyId);
        if (!activeExists) {
          onActiveJourneyChange(modeJourneys[0]?.id ?? null);
        }
      } catch (error) {
        setErrorMessage(toProgressErrorMessage(error));
      } finally {
        setJourneysLoading(false);
      }
    }

    void load();
  }, [token, recordingsRevision, mediaMode]);

  useEffect(() => {
    async function loadJourneyClips() {
      if (!activeJourneyId) {
        setClips([]);
        setReveals([]);
        return;
      }

      setClipsLoading(true);
      setErrorMessage(null);
      try {
        const response = await listClips(token, activeJourneyId);
        setClips(response.clips);
      } catch (error) {
        setErrorMessage(toProgressErrorMessage(error));
      } finally {
        setClipsLoading(false);
      }
    }

    void loadJourneyClips();
  }, [token, activeJourneyId, recordingsRevision]);

  useEffect(() => {
    async function loadReveals() {
      if (!activeJourneyId) {
        setReveals([]);
        return;
      }
      setRevealsLoading(true);
      try {
        const response = await listJourneyReveals(token, activeJourneyId);
        setReveals(response.reveals);
      } catch (error) {
        setErrorMessage(toProgressErrorMessage(error));
      } finally {
        setRevealsLoading(false);
      }
    }
    void loadReveals();
  }, [token, activeJourneyId, recordingsRevision]);

  const modeJourneys = useMemo(() => journeys.filter((journey) => journey.captureMode === mediaMode), [journeys, mediaMode]);
  const selectedJourney = useMemo(
    () => (activeJourneyId ? modeJourneys.find((journey) => journey.id === activeJourneyId) ?? null : null),
    [modeJourneys, activeJourneyId]
  );
  const effectiveNow = useMemo(() => {
    if (!devNowDayOffset) return new Date();
    const value = new Date();
    value.setDate(value.getDate() + devNowDayOffset);
    return value;
  }, [devNowDayOffset]);
  const chapterRule = selectedJourney ? { captureMode: selectedJourney.captureMode } : null;
  const dayCount = chapterRule ? getChapterDayCount(clips, chapterRule) : 0;
  const revealTrackClips = useMemo(() => {
    if (!selectedJourney) return clips;
    return clips.filter((clip) => clip.captureType === selectedJourney.captureMode);
  }, [clips, selectedJourney?.id, selectedJourney?.captureMode]);
  const milestoneProgress = useMemo(
    () =>
      selectedJourney
        ? getMilestoneChapterProgress(dayCount, {
            milestoneLengthDays: selectedJourney.milestoneLengthDays,
            milestoneStartDay: selectedJourney.milestoneStartDay,
            milestoneChapter: selectedJourney.milestoneChapter
          })
        : null,
    [selectedJourney?.id, selectedJourney?.milestoneLengthDays, selectedJourney?.milestoneStartDay, selectedJourney?.milestoneChapter, dayCount]
  );
  const comparison = useMemo(() => {
    if (!selectedJourney || !milestoneProgress?.reachedReveal) return null;
    return buildChapterComparisonPair(revealTrackClips, {
      milestoneLengthDays: selectedJourney.milestoneLengthDays,
      milestoneStartDay: selectedJourney.milestoneStartDay,
      milestoneChapter: selectedJourney.milestoneChapter
    });
  }, [
    revealTrackClips,
    selectedJourney?.id,
    selectedJourney?.milestoneLengthDays,
    selectedJourney?.milestoneStartDay,
    selectedJourney?.milestoneChapter,
    milestoneProgress?.reachedReveal
  ]);
  const streak = chapterRule ? getChapterStreak(clips, chapterRule, effectiveNow) : 0;
  const didPracticeToday = chapterRule ? hasChapterClipToday(clips, chapterRule, effectiveNow) : false;

  const heatmapCells = useMemo(() => buildPracticeHeatmap(clips, 8, effectiveNow), [clips, effectiveNow]);

  const milestones = getMilestoneStates(dayCount);
  const nextMilestone = milestones.find((milestone) => !milestone.unlocked) ?? null;
  const unlockedMilestones = milestones.filter((milestone) => milestone.unlocked).length;
  const milestonePreview = nextMilestone ? [nextMilestone] : milestones.slice(-1);

  useEffect(() => {
    if (!comparison || !compareModalOpen) return;
    modalBackdropReveal.setValue(0);
    modalCardReveal.setValue(0);
    thenPanelReveal.setValue(0);
    nowPanelReveal.setValue(0);
    labelsReveal.setValue(0);
    Animated.sequence([
      Animated.parallel([
        Animated.timing(modalBackdropReveal, {
          toValue: 1,
          duration: duration(theme.motion.transitionMs - 40),
          easing: Easing.out(Easing.quad),
          useNativeDriver: true
        }),
        Animated.timing(modalCardReveal, {
          toValue: 1,
          duration: duration(theme.motion.transitionMs),
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true
        })
      ]),
      Animated.parallel([
        Animated.timing(thenPanelReveal, {
          toValue: 1,
          duration: duration(theme.motion.microMs - 10),
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true
        }),
        Animated.sequence([
          Animated.delay(duration(36)),
          Animated.timing(labelsReveal, {
            toValue: 1,
            duration: duration(theme.motion.microMs - 10),
            easing: Easing.out(Easing.quad),
            useNativeDriver: true
          })
        ])
      ]),
      Animated.timing(nowPanelReveal, {
        toValue: 1,
        duration: duration(theme.motion.microMs + 30),
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      })
    ]).start();
  }, [compareModalOpen, comparison?.thenClip.id, comparison?.nowClip.id, preset]);

  useEffect(() => {
    if (!comparison || !selectedJourney || !compareModalOpen) return;
    trackEvent("comparison_viewed", {
      journeyId: selectedJourney.id,
      preset,
      thenClipId: comparison.thenClip.id,
      nowClipId: comparison.nowClip.id
    });
  }, [compareModalOpen, comparison?.thenClip.id, comparison?.nowClip.id, preset, selectedJourney?.id]);

  useEffect(() => {
    if (!compareModalOpen) return;
    if (comparison) return;
    if (clips.length >= 2) return;
    setCompareModalOpen(false);
  }, [compareModalOpen, comparison, clips.length]);

  useEffect(() => {
    if (!selectedJourney) return;
    trackEvent("milestone_viewed", {
      journeyId: selectedJourney.id,
      unlockedMilestones,
      totalMilestones: milestones.length
    });
  }, [selectedJourney?.id, unlockedMilestones]);

  useEffect(() => {
    const journeyId = selectedJourney?.id ?? null;
    if (!journeyId) {
      milestoneJourneyRef.current = null;
      previousUnlockedCountRef.current = 0;
      setRecentlyUnlockedMilestoneDay(null);
      milestoneUnlockPulse.setValue(1);
      milestoneUnlockGlow.setValue(0);
      return;
    }

    if (milestoneJourneyRef.current !== journeyId) {
      milestoneJourneyRef.current = journeyId;
      previousUnlockedCountRef.current = unlockedMilestones;
      setRecentlyUnlockedMilestoneDay(null);
      milestoneUnlockPulse.setValue(1);
      milestoneUnlockGlow.setValue(0);
      return;
    }

    if (unlockedMilestones > previousUnlockedCountRef.current) {
      const newestUnlocked = [...milestones].reverse().find((milestone) => milestone.unlocked) ?? null;
      if (newestUnlocked) {
        setRecentlyUnlockedMilestoneDay(newestUnlocked.day);
        milestoneUnlockPulse.setValue(reducedMotion ? 1 : 0.96);
        milestoneUnlockGlow.setValue(reducedMotion ? 1 : 0);
        Animated.parallel([
          Animated.sequence([
            Animated.timing(milestoneUnlockPulse, {
              toValue: 1.06,
              duration: duration(theme.motion.microMs + 40),
              useNativeDriver: true
            }),
            Animated.timing(milestoneUnlockPulse, {
              toValue: 1,
              duration: duration(theme.motion.microMs + 40),
              useNativeDriver: true
            })
          ]),
          Animated.sequence([
            Animated.timing(milestoneUnlockGlow, {
              toValue: 1,
              duration: duration(theme.motion.microMs + 20),
              useNativeDriver: true
            }),
            Animated.delay(duration(theme.motion.rewardMs - 20)),
            Animated.timing(milestoneUnlockGlow, {
              toValue: 0,
              duration: duration(theme.motion.transitionMs - 20),
              useNativeDriver: true
            })
          ])
        ]).start(() => {
          setRecentlyUnlockedMilestoneDay(null);
        });
      }
    }

    previousUnlockedCountRef.current = unlockedMilestones;
  }, [selectedJourney?.id, unlockedMilestones, milestones, milestoneUnlockGlow, milestoneUnlockPulse]);

  useEffect(() => {
    if (!selectedJourney) {
      compareCardReveal.setValue(0);
      nextUnlockReveal.setValue(0);
      return;
    }

    compareCardReveal.setValue(0);
    nextUnlockReveal.setValue(0);
    Animated.stagger(motionTokens.sectionStaggerMs, [
      Animated.timing(compareCardReveal, {
        toValue: 1,
        duration: duration(theme.motion.transitionMs + motionTokens.durationOffset.sectionIn),
        easing: motionTokens.easing.outCubic,
        useNativeDriver: true
      }),
      Animated.timing(nextUnlockReveal, {
        toValue: 1,
        duration: duration(theme.motion.transitionMs + motionTokens.durationOffset.sectionInSoft),
        easing: motionTokens.easing.outCubic,
        useNativeDriver: true
      })
    ]).start();
  }, [selectedJourney?.id, compareCardReveal, nextUnlockReveal]);

  let emptyComparisonMessage = "Choose a journey to view progress.";
  if (selectedJourney && !milestoneProgress) {
    emptyComparisonMessage = "Milestone data is loading.";
  } else if (selectedJourney && milestoneProgress?.reachedReveal) {
    if (revealTrackClips.length < 2) {
      emptyComparisonMessage = `Add at least two ${selectedJourney.captureMode} clips to open this reveal.`;
    } else {
      emptyComparisonMessage = "Reveal is almost ready.";
    }
  } else if (milestoneProgress) {
    emptyComparisonMessage = `${milestoneProgress.remainingDays} ${milestoneProgress.remainingDays === 1 ? "practice" : "practices"} until your reveal.`;
  }

  return {
    journeys: journeys.filter((journey) => journey.captureMode === mediaMode),
    journeysLoading,
    clipsLoading,
    reveals,
    revealsLoading,
    errorMessage,
    preset,
    setPreset,
    compareModalOpen,
    setCompareModalOpen,
    recentlyUnlockedMilestoneDay,
    modalBackdropReveal,
    modalCardReveal,
    thenPanelReveal,
    nowPanelReveal,
    labelsReveal,
    compareCardReveal,
    nextUnlockReveal,
    milestoneUnlockPulse,
    milestoneUnlockGlow,
    selectedJourney,
    milestoneProgress,
    comparison,
    dayCount,
    streak,
    didPracticeToday,
    heatmapCells,
    milestones,
    nextMilestone,
    unlockedMilestones,
    milestonePreview,
    emptyComparisonMessage,
    showJourneySelector: modeJourneys.length > 1,
    showHeatmap: dayCount >= 3
  };
}
