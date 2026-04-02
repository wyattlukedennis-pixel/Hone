import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Modal, PanResponder, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { trackEvent } from "../analytics/events";
import { startNextMilestone } from "../api/journeys";
import { GlassSurface } from "../components/GlassSurface";
import { PaywallModal } from "../components/PaywallModal";
import { TactilePressable } from "../components/TactilePressable";
import { motionTokens } from "../motion/tokens";
import { readJourneyFinaleUnlockSeen, writeJourneyFinaleUnlockSeen } from "../storage/journeyFinaleUnlockStorage";
import { readQuickReelStatus, writeQuickReelStatus } from "../storage/quickReelStatusStorage";
import { theme } from "../theme";
import type { JourneyReveal } from "../types/journey";
import { triggerMilestoneHaptic, triggerSelectionHaptic } from "../utils/feedback";
import { hasRevealExportPurchase } from "../utils/purchases";
import { prepareReelAsset } from "../utils/reelExport";
import { buildRevealComparisonPlanFromRange, buildRevealStoryline } from "../utils/progress";
import { buildTimelapseClips } from "../utils/reelBuilder";
import type { Clip } from "../types/clip";
import { useReducedMotion } from "../utils/useReducedMotion";
import ChapterRevealScreen from "./progress/ChapterRevealScreen";
import ReelPreviewScreen from "./progress/ReelPreviewScreen";
import { ComparisonRevealModal } from "./progress/ComparisonRevealModal";
import { NoJourneyCard } from "./progress/NoJourneyCard";
import { useProgressState } from "./progress/useProgressState";

type ProgressScreenProps = {
  token: string;
  activeJourneyId: string | null;
  mediaMode: "video" | "photo";
  onActiveJourneyChange: (journeyId: string | null) => void;
  onOpenJourneysTab: (options?: { journeyId?: string | null; openRecorder?: boolean }) => void;
  devNowDayOffset?: number;
  openRevealSignal?: number;
  progressEntrySignal?: number;
  recordingsRevision: number;
  onFullscreenChange?: (fullscreen: boolean) => void;
  darkMode?: boolean;
};

type RevealSourceRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const JOURNEY_FINALE_TARGET_DAYS = 100;

function pickJourneyFinaleClips<T extends { id: string; recordedAt: string }>(clips: T[]) {
  if (clips.length <= 4) return clips;
  const end = clips.length - 1;
  const candidateIndices = [0, Math.round(end * 0.34), Math.round(end * 0.68), end];
  const indices: number[] = [];
  for (const value of candidateIndices) {
    if (!indices.includes(value)) {
      indices.push(value);
    }
  }
  return indices.map((index) => clips[index]).filter((clip): clip is T => Boolean(clip));
}

export function ProgressScreen({
  token,
  activeJourneyId,
  mediaMode,
  onActiveJourneyChange,
  onOpenJourneysTab,
  devNowDayOffset = 0,
  openRevealSignal = 0,
  progressEntrySignal = 0,
  recordingsRevision,
  onFullscreenChange,
  darkMode = false
}: ProgressScreenProps) {
  const { height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const duration = (ms: number) => (reducedMotion ? 0 : ms);
  const [comparisonSourceRect, setComparisonSourceRect] = useState<RevealSourceRect | null>(null);
  const [advancingMilestoneLength, setAdvancingMilestoneLength] = useState<number | null>(null);
  const [chapterActionMessage, setChapterActionMessage] = useState<string | null>(null);
  const [chapterRevealOpen, setChapterRevealOpen] = useState(false);
  const [selectedPastReveal, setSelectedPastReveal] = useState<JourneyReveal | null>(null);
  const [chapterHistoryOpen, setChapterHistoryOpen] = useState(false);
  const [historyPaywallVisible, setHistoryPaywallVisible] = useState(false);
  const [pendingPaywallReveal, setPendingPaywallReveal] = useState<{ reveal: JourneyReveal; source: "history_row" | "history_picker" } | null>(null);
  const [replayOpenStatusMessage, setReplayOpenStatusMessage] = useState<string | null>(null);
  const [renderReplayOpenStatus, setRenderReplayOpenStatus] = useState(false);
  const [, setQuickReelExporting] = useState(false);
  const [, setQuickReelSaving] = useState(false);
  const [quickReelReady, setQuickReelReady] = useState(false);
  const [, setQuickReelMessage] = useState<string | null>(null);
  const [quickReelUpdatedAt, setQuickReelUpdatedAt] = useState<number | null>(null);
  const [, setQuickReelRelativeTick] = useState(0);
  const [, setJourneyFinaleExporting] = useState(false);
  const [, setJourneyFinaleSaving] = useState(false);
  const [, setJourneyFinaleMessage] = useState<string | null>(null);
  const [, setJourneyFinaleUnlockNotice] = useState(false);
  const [journeyFinaleUnlockSeen, setJourneyFinaleUnlockSeen] = useState(false);
  const [journeyFinaleUnlockSeenLoaded, setJourneyFinaleUnlockSeenLoaded] = useState(false);
  const handledRevealSignalRef = useRef(0);
  const handledProgressEntrySignalRef = useRef(0);
  const replayOpenStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyModalDragY = useRef(new Animated.Value(0)).current;
  const revealCapsulePulse = useRef(new Animated.Value(1)).current;
  const finaleUnlockPulse = useRef(new Animated.Value(1)).current;
  const progressTakeover = useRef(new Animated.Value(0)).current;
  const replayOpenStatusReveal = useRef(new Animated.Value(0)).current;
  const replayOpenStatusPulse = useRef(new Animated.Value(0)).current;
  const streakFlamePulse = useRef(new Animated.Value(0)).current;
  const pastRevealOpenCooldownUntilRef = useRef(0);
  const journeyFinaleUnlockHandledJourneyRef = useRef<string | null>(null);
  const quickReelPrewarmKeyRef = useRef<string | null>(null);
  const [reelPreviewVisible, setReelPreviewVisible] = useState(false);
  const [reelMode, setReelMode] = useState<"video" | "timelapse">("video");
  const [timelapsePhotos, setTimelapsePhotos] = useState<Array<{ uri: string; label: string }>>([]);
  const [timelapseClipObjects, setTimelapseClipObjects] = useState<Clip[]>([]);
  const [composedDaySpan, setComposedDaySpan] = useState(0);
  const [skipReelLoading, setSkipReelLoading] = useState(false);

  // Notify parent when fullscreen overlay is active (hides tab bar)
  useEffect(() => {
    onFullscreenChange?.(reelPreviewVisible || chapterRevealOpen);
  }, [reelPreviewVisible, chapterRevealOpen, onFullscreenChange]);

  const {
    journeys,
    journeysLoading,
    reveals,
    revealsLoading,
    errorMessage,
    compareModalOpen,
    setCompareModalOpen,
    modalBackdropReveal,
    modalCardReveal,
    thenPanelReveal,
    nowPanelReveal,
    labelsReveal,
    compareCardReveal,
    nextUnlockReveal,
    selectedJourney,
    milestoneProgress,
    comparison,
    comparisonPlan,
    revealTrackClips,
    dayCount,
    streak,
    bestStreak,
    didPracticeToday,
    heatmapCells,
    protocolConsistency,
    showHeatmap
  } = useProgressState({
    token,
    activeJourneyId,
    onActiveJourneyChange,
    mediaMode,
    devNowDayOffset,
    recordingsRevision
  });

  useEffect(() => {
    setComparisonSourceRect(null);
    setCompareModalOpen(false);
    setChapterActionMessage(null);
    setQuickReelMessage(null);
    setQuickReelExporting(false);
    setQuickReelSaving(false);
    setQuickReelReady(false);
    setQuickReelUpdatedAt(null);
    setJourneyFinaleExporting(false);
    setJourneyFinaleSaving(false);
    setJourneyFinaleMessage(null);
    setJourneyFinaleUnlockNotice(false);
    setJourneyFinaleUnlockSeen(false);
    setJourneyFinaleUnlockSeenLoaded(false);
    journeyFinaleUnlockHandledJourneyRef.current = null;
    finaleUnlockPulse.setValue(1);
    quickReelPrewarmKeyRef.current = null;
    setReelPreviewVisible(false);
    setReelMode("video");
    setTimelapsePhotos([]);
    setTimelapseClipObjects([]);
    setComposedDaySpan(0);
    setSelectedPastReveal(null);
    setChapterHistoryOpen(false);
  }, [selectedJourney?.id, finaleUnlockPulse]);

  const revealReplayPlans = useMemo(() => {
    const plans: Record<string, ReturnType<typeof buildRevealComparisonPlanFromRange>> = {};
    if (!selectedJourney) return plans;
    for (const reveal of reveals) {
      plans[reveal.id] = buildRevealComparisonPlanFromRange({
        clips: revealTrackClips,
        reveal: {
          chapterNumber: reveal.chapterNumber,
          milestoneLengthDays: reveal.milestoneLengthDays,
          startDayIndex: reveal.startDayIndex,
          endDayIndex: reveal.endDayIndex
        },
        captureMode: selectedJourney.captureMode
      });
    }
    return plans;
  }, [reveals, selectedJourney?.id, selectedJourney?.captureMode, revealTrackClips]);

  const revealStorylines = useMemo(() => {
    const stories: Record<string, ReturnType<typeof buildRevealStoryline>> = {};
    for (const reveal of reveals) {
      const replay = revealReplayPlans[reveal.id];
      stories[reveal.id] = buildRevealStoryline({
        chapterNumber: reveal.chapterNumber,
        milestoneLengthDays: reveal.milestoneLengthDays,
        recordedDays: reveal.recordedDays,
        completedAt: reveal.completedAt,
        consistencyScore: replay?.consistencyScore ?? null,
        trailerMomentCount: replay?.trailerMoments.length ?? 0
      });
    }
    return stories;
  }, [reveals, revealReplayPlans]);

  const historyModalBackdropOpacity = historyModalDragY.interpolate({
    inputRange: [0, 220],
    outputRange: [1, 0.86],
    extrapolate: "clamp"
  });
  const historyModalCardOpacity = historyModalDragY.interpolate({
    inputRange: [0, 260],
    outputRange: [1, 0.9],
    extrapolate: "clamp"
  });

  const closeChapterHistoryModal = useCallback(() => {
    historyModalDragY.stopAnimation();
    historyModalDragY.setValue(0);
    setChapterHistoryOpen(false);
  }, [historyModalDragY]);

  const historyModalPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => {
          if (!chapterHistoryOpen) return false;
          return Math.abs(gesture.dy) > 4 && Math.abs(gesture.dy) > Math.abs(gesture.dx);
        },
        onPanResponderGrant: () => {
          historyModalDragY.stopAnimation();
        },
        onPanResponderMove: (_, gesture) => {
          historyModalDragY.setValue(Math.max(0, gesture.dy));
        },
        onPanResponderRelease: (_, gesture) => {
          const shouldDismiss = gesture.dy > 108 || gesture.vy > 1.15;
          if (shouldDismiss) {
            if (reducedMotion) {
              closeChapterHistoryModal();
              return;
            }
            Animated.timing(historyModalDragY, {
              toValue: Math.max(240, gesture.dy + 34),
              duration: 150,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true
            }).start(() => {
              closeChapterHistoryModal();
            });
            return;
          }
          if (reducedMotion) {
            historyModalDragY.setValue(0);
            return;
          }
          Animated.spring(historyModalDragY, {
            toValue: 0,
            stiffness: 240,
            damping: 22,
            mass: 0.8,
            useNativeDriver: true
          }).start();
        },
        onPanResponderTerminate: () => {
          if (reducedMotion) {
            historyModalDragY.setValue(0);
            return;
          }
          Animated.spring(historyModalDragY, {
            toValue: 0,
            stiffness: 220,
            damping: 22,
            mass: 0.8,
            useNativeDriver: true
          }).start();
        }
      }),
    [chapterHistoryOpen, closeChapterHistoryModal, historyModalDragY, reducedMotion]
  );


  useEffect(() => {
    if (!chapterHistoryOpen) {
      setReplayOpenStatusMessage(null);
      setRenderReplayOpenStatus(false);
      replayOpenStatusReveal.setValue(0);
      historyModalDragY.setValue(0);
      if (replayOpenStatusTimerRef.current) {
        clearTimeout(replayOpenStatusTimerRef.current);
        replayOpenStatusTimerRef.current = null;
      }
    }
  }, [chapterHistoryOpen, historyModalDragY, replayOpenStatusReveal]);

  useEffect(() => {
    if (replayOpenStatusMessage) {
      setRenderReplayOpenStatus(true);
      replayOpenStatusPulse.setValue(0);
      if (reducedMotion) {
        replayOpenStatusReveal.setValue(1);
        return;
      }
      Animated.timing(replayOpenStatusReveal, {
        toValue: 1,
        duration: theme.motion.microMs - 30,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }).start();
      Animated.sequence([
        Animated.timing(replayOpenStatusPulse, {
          toValue: 1,
          duration: 110,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false
        }),
        Animated.timing(replayOpenStatusPulse, {
          toValue: 0,
          duration: 180,
          easing: Easing.in(Easing.quad),
          useNativeDriver: false
        })
      ]).start();
      return;
    }

    if (!renderReplayOpenStatus) {
      replayOpenStatusReveal.setValue(0);
      replayOpenStatusPulse.setValue(0);
      return;
    }

    if (reducedMotion) {
      replayOpenStatusReveal.setValue(0);
      replayOpenStatusPulse.setValue(0);
      setRenderReplayOpenStatus(false);
      return;
    }

    Animated.timing(replayOpenStatusReveal, {
      toValue: 0,
      duration: theme.motion.microMs - 40,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true
    }).start(({ finished }) => {
      if (finished) {
        replayOpenStatusPulse.setValue(0);
        setRenderReplayOpenStatus(false);
      }
    });
  }, [replayOpenStatusMessage, renderReplayOpenStatus, reducedMotion, replayOpenStatusReveal, replayOpenStatusPulse]);

  useEffect(() => {
    return () => {
      if (replayOpenStatusTimerRef.current) {
        clearTimeout(replayOpenStatusTimerRef.current);
        replayOpenStatusTimerRef.current = null;
      }
      historyModalDragY.stopAnimation();
    };
  }, [historyModalDragY]);

  useEffect(() => {
    if (streak >= 3 && !reducedMotion) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(streakFlamePulse, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(streakFlamePulse, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
        ])
      );
      loop.start();
      return () => loop.stop();
    }
    streakFlamePulse.setValue(0);
  }, [streak >= 3, reducedMotion, streakFlamePulse]);

  const activeComparison = comparison;
  const activePresetLabel = "chapter reveal";
  const revealReady = Boolean(milestoneProgress?.reachedReveal);
  const compareReady = Boolean(comparison);
  const chapterProgressDays = milestoneProgress?.progressDays ?? 0;
  const chapterTargetDays = milestoneProgress?.milestoneLengthDays ?? selectedJourney?.milestoneLengthDays ?? 7;
  const chapterRemainingDays = milestoneProgress?.remainingDays ?? chapterTargetDays;
  const chapterNumber = milestoneProgress?.milestoneChapter ?? selectedJourney?.milestoneChapter ?? 1;
  const chapterProgressLabel = `${Math.min(chapterProgressDays, chapterTargetDays)} / ${chapterTargetDays} takes`;
  const chapterCountdownLabel = `${chapterRemainingDays} ${chapterRemainingDays === 1 ? "take" : "takes"} to reveal`;
  const trailerMomentCount = comparisonPlan?.trailerMoments.length ?? 0;
  const journeyFinaleSourceClips = useMemo(() => {
    if (!selectedJourney) return [];
    const clipsAscending = [...revealTrackClips].sort(
      (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
    );
    return pickJourneyFinaleClips(clipsAscending);
  }, [selectedJourney?.id, revealTrackClips]);
  const journeyFinaleUnlocked = dayCount >= JOURNEY_FINALE_TARGET_DAYS && journeyFinaleSourceClips.length >= 2;
  const journeyFinaleExportInput = useMemo(() => {
    if (!selectedJourney || !journeyFinaleUnlocked || journeyFinaleSourceClips.length < 2) return null;
    const fallbackClip = journeyFinaleSourceClips[journeyFinaleSourceClips.length - 1] ?? null;
    if (!fallbackClip) return null;
    const labelSets: Record<number, string[]> = {
      2: ["START", "NOW"],
      3: ["START", "MILESTONE", "NOW"],
      4: ["START", "CHAPTER", "MOMENT", "NOW"]
    };
    const labels = labelSets[journeyFinaleSourceClips.length] ?? labelSets[4];
    return {
      chapterNumber: Math.max(1, selectedJourney.milestoneChapter),
      trailerMoments: journeyFinaleSourceClips.map((clip, index) => ({
        clip,
        label: labels[index] ?? `MOMENT ${index + 1}`
      })),
      sourceClips: journeyFinaleSourceClips,
      fallbackClip,
      milestoneLengthDays: JOURNEY_FINALE_TARGET_DAYS,
      progressDays: dayCount,
      currentStreak: streak,
      storylineHeadline: "journey finale",
      storylineCaption: `day 1 -> day ${dayCount} across ${Math.max(1, reveals.length + 1)} chapters`,
      storylineReflection: "a single arc from your first take to today.",
      token,
      journeyId: selectedJourney.id
    };
  }, [selectedJourney?.id, selectedJourney?.milestoneChapter, journeyFinaleUnlocked, journeyFinaleSourceClips, dayCount, streak, reveals.length, token]);
  const quickReelExportInput = useMemo(() => {
    if (!selectedJourney || !comparison) return null;
    return {
      chapterNumber,
      trailerMoments: [
        { clip: comparison.thenClip, label: "THEN" as const },
        { clip: comparison.nowClip, label: "NOW" as const }
      ],
      sourceClips: [comparison.thenClip, comparison.nowClip],
      fallbackClip: comparison.nowClip,
      milestoneLengthDays: chapterTargetDays,
      progressDays: chapterProgressDays,
      currentStreak: streak,
      storylineHeadline: "day 1 -> today",
      storylineCaption: `chapter ${chapterNumber} progress proof`,
      storylineReflection: null,
      token,
      journeyId: selectedJourney.id
    };
  }, [selectedJourney?.id, comparison?.thenClip.id, comparison?.nowClip.id, chapterNumber, chapterTargetDays, chapterProgressDays, streak, token]);
  const liveRevealStoryline = useMemo(() => {
    if (!selectedJourney) return null;
    return buildRevealStoryline({
      chapterNumber,
      milestoneLengthDays: chapterTargetDays,
      recordedDays: chapterProgressDays,
      completedAt: new Date().toISOString(),
      consistencyScore: comparisonPlan?.consistencyScore ?? null,
      trailerMomentCount
    });
  }, [selectedJourney?.id, chapterNumber, chapterTargetDays, chapterProgressDays, comparisonPlan?.consistencyScore, trailerMomentCount]);
  const compactMode = height < 760;
  const tightMode = height < 700;
  const singleSceneMode = Boolean(
    selectedJourney &&
      !journeysLoading &&
      !errorMessage &&
      !chapterActionMessage &&
      !compactMode
  );

  useEffect(() => {
    if (!selectedJourney) return;
    let cancelled = false;
    void (async () => {
      const seen = await readJourneyFinaleUnlockSeen({ journeyId: selectedJourney.id });
      if (cancelled) return;
      setJourneyFinaleUnlockSeen(seen);
      setJourneyFinaleUnlockSeenLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedJourney?.id]);

  useEffect(() => {
    if (!selectedJourney || !journeyFinaleUnlockSeenLoaded || !journeyFinaleUnlocked || journeyFinaleUnlockSeen) return;
    if (journeyFinaleUnlockHandledJourneyRef.current === selectedJourney.id) return;
    journeyFinaleUnlockHandledJourneyRef.current = selectedJourney.id;
    setJourneyFinaleUnlockSeen(true);
    setJourneyFinaleUnlockNotice(true);
    setJourneyFinaleMessage("journey finale unlocked.");
    trackEvent("journey_finale_unlocked", {
      journeyId: selectedJourney.id,
      targetDays: JOURNEY_FINALE_TARGET_DAYS,
      progressDays: dayCount
    });
    triggerMilestoneHaptic();
    if (reducedMotion) {
      finaleUnlockPulse.setValue(1);
    } else {
      finaleUnlockPulse.setValue(0.965);
      Animated.sequence([
        Animated.timing(finaleUnlockPulse, {
          toValue: 1.04,
          duration: duration(theme.motion.microMs + 30),
          easing: Easing.out(Easing.quad),
          useNativeDriver: true
        }),
        Animated.spring(finaleUnlockPulse, {
          toValue: 1,
          damping: 11,
          stiffness: 250,
          mass: 0.65,
          useNativeDriver: true
        })
      ]).start();
    }
    void writeJourneyFinaleUnlockSeen({ journeyId: selectedJourney.id });
    const hideTimer = setTimeout(() => {
      setJourneyFinaleUnlockNotice(false);
    }, 2800);
    return () => {
      clearTimeout(hideTimer);
    };
  }, [
    selectedJourney?.id,
    journeyFinaleUnlockSeenLoaded,
    journeyFinaleUnlocked,
    journeyFinaleUnlockSeen,
    dayCount,
    reducedMotion,
    duration,
    finaleUnlockPulse
  ]);

  useEffect(() => {
    if (!quickReelReady || !quickReelUpdatedAt) return;
    const interval = setInterval(() => {
      setQuickReelRelativeTick((value) => value + 1);
    }, 30 * 1000);
    return () => {
      clearInterval(interval);
    };
  }, [quickReelReady, quickReelUpdatedAt]);

  useEffect(() => {
    if (!selectedJourney) {
      setQuickReelReady(false);
      setQuickReelMessage(null);
      setQuickReelUpdatedAt(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const stored = await readQuickReelStatus({ journeyId: selectedJourney.id });
      if (cancelled) return;
      if (!stored || stored.chapterNumber !== chapterNumber) {
        setQuickReelReady(false);
        setQuickReelMessage(null);
        setQuickReelUpdatedAt(null);
        return;
      }
      setQuickReelReady(stored.ready);
      setQuickReelMessage(stored.message);
      setQuickReelUpdatedAt(stored.updatedAt);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedJourney?.id, chapterNumber]);

  useEffect(() => {
    if (!quickReelExportInput || !selectedJourney) return;
    const prewarmKey = `${selectedJourney.id}:${quickReelExportInput.chapterNumber}:${quickReelExportInput.progressDays}:${quickReelExportInput.milestoneLengthDays}:${quickReelExportInput.sourceClips?.map((clip) => clip.id).join(":")}`;
    if (quickReelPrewarmKeyRef.current === prewarmKey) return;
    quickReelPrewarmKeyRef.current = prewarmKey;
    let cancelled = false;
    void (async () => {
      const result = await prepareReelAsset(quickReelExportInput);
      if (cancelled) return;
      if (result.success) {
        const statusUpdatedAt = Date.now();
        setQuickReelReady(true);
        setQuickReelMessage((current) => current ?? "quick reel ready.");
        setQuickReelUpdatedAt(statusUpdatedAt);
        await writeQuickReelStatus({
          journeyId: selectedJourney.id,
          chapterNumber,
          message: "quick reel ready.",
          source: "prewarm",
          success: true,
          ready: true
        });
      }
      trackEvent("progress_quick_reel_prewarm_completed", {
        journeyId: selectedJourney.id,
        chapterNumber,
        success: result.success,
        code: result.code,
        sourceKind: result.sourceKind,
        cacheHit: result.cacheHit
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [quickReelExportInput, selectedJourney?.id, chapterNumber]);

  useEffect(() => {
    if (!journeyFinaleExportInput || !selectedJourney || !journeyFinaleUnlocked) return;
    let cancelled = false;
    void (async () => {
      const result = await prepareReelAsset(journeyFinaleExportInput);
      if (cancelled) return;
      trackEvent("journey_finale_prewarm_completed", {
        journeyId: selectedJourney.id,
        chapterNumber,
        success: result.success,
        code: result.code,
        sourceKind: result.sourceKind,
        cacheHit: result.cacheHit
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [journeyFinaleExportInput, journeyFinaleUnlocked, selectedJourney?.id, chapterNumber]);

  useEffect(() => {
    if (!selectedJourney || revealReady || reducedMotion) {
      revealCapsulePulse.setValue(1);
      return;
    }

    revealCapsulePulse.setValue(0.985);
    Animated.timing(revealCapsulePulse, {
      toValue: 1,
      duration: duration(theme.motion.transitionMs + 80),
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [selectedJourney?.id, revealReady, reducedMotion, revealCapsulePulse]);

  useEffect(() => {
    if (reducedMotion) {
      progressTakeover.setValue(compareModalOpen ? 1 : 0);
      return;
    }
    Animated.timing(progressTakeover, {
      toValue: compareModalOpen ? 1 : 0,
      duration: duration(theme.motion.transitionMs + 40),
      easing: compareModalOpen ? Easing.out(Easing.quad) : Easing.in(Easing.quad),
      useNativeDriver: true
    }).start();
  }, [compareModalOpen, reducedMotion, progressTakeover]);



  useEffect(() => {
    if (!openRevealSignal) return;
    if (openRevealSignal <= handledRevealSignalRef.current) return;
    handledRevealSignalRef.current = openRevealSignal;
    if (!comparison || !selectedJourney) return;
    if (revealReady) {
      if (selectedJourney.captureMode === "photo") {
        (async () => {
          const clips = await buildTimelapseClips(token, selectedJourney.id);
          if (clips.length > 0) {
            setTimelapsePhotos(clips.map(c => ({ uri: c.clip.videoUrl, label: c.label })));
            setTimelapseClipObjects(clips.map(c => c.clip));
            setReelMode("timelapse");
            setComposedDaySpan(clips.length);
            setSkipReelLoading(false);
            setReelPreviewVisible(true);
            trackEvent("milestone_reveal_opened", {
              journeyId: selectedJourney.id,
              chapter: chapterNumber,
              source: "practice_deep_link",
              mode: "timelapse"
            });
          }
        })();
        return;
      }
      setChapterRevealOpen(true);
      trackEvent("milestone_reveal_opened", {
        journeyId: selectedJourney.id,
        chapter: chapterNumber,
        source: "practice_deep_link"
      });
    } else {
      setReelMode("video");
      setComposedDaySpan(chapterProgressDays);
      setSkipReelLoading(true);
      setReelPreviewVisible(true);
      trackEvent("comparison_reveal_opened", {
        journeyId: selectedJourney.id,
        source: "practice_compare_deep_link"
      });
    }
  }, [openRevealSignal, revealReady, comparison?.thenClip.id, comparison?.nowClip.id, selectedJourney?.id, selectedJourney?.captureMode, chapterNumber, setCompareModalOpen, token]);

  useEffect(() => {
    if (!progressEntrySignal) return;
    if (progressEntrySignal <= handledProgressEntrySignalRef.current) return;
    handledProgressEntrySignalRef.current = progressEntrySignal;
    // Don't auto-open reveal — let the user tap the button
  }, [
    progressEntrySignal,
    revealReady,
    comparison?.thenClip.id,
    comparison?.nowClip.id,
    selectedJourney?.id,
    chapterNumber,
    setCompareModalOpen
  ]);

  async function handleStartNextChapter(nextLength: number) {
    if (!selectedJourney) return;
    setChapterActionMessage(null);
    setAdvancingMilestoneLength(nextLength);
    try {
      const response = await startNextMilestone(token, selectedJourney.id, nextLength);
      trackEvent("milestone_next_started", {
        journeyId: selectedJourney.id,
        chapter: response.journey.milestoneChapter,
        milestoneLengthDays: nextLength
      });
      onActiveJourneyChange(null);
      requestAnimationFrame(() => {
        onActiveJourneyChange(response.journey.id);
      });
      onOpenJourneysTab({
        journeyId: response.journey.id,
        openRecorder: true
      });
      setCompareModalOpen(false);
      setComparisonSourceRect(null);
      setChapterActionMessage(`chapter ${response.journey.milestoneChapter} is live.`);
    } catch (error) {
      const raw = error instanceof Error ? error.message : "Unexpected error";
      if (raw === "MILESTONE_NOT_REACHED") {
        setChapterActionMessage("keep logging takes. this reveal is not ready yet.");
      } else {
        setChapterActionMessage(raw);
      }
    } finally {
      setAdvancingMilestoneLength(null);
    }
  }

  function openPastReveal(reveal: JourneyReveal, source: "history_row" | "history_picker") {
    if (!hasRevealExportPurchase()) {
      setPendingPaywallReveal({ reveal, source });
      setHistoryPaywallVisible(true);
      return;
    }
    const now = Date.now();
    if (now < pastRevealOpenCooldownUntilRef.current) {
      setReplayOpenStatusMessage("opening replay...");
      if (replayOpenStatusTimerRef.current) {
        clearTimeout(replayOpenStatusTimerRef.current);
      }
      replayOpenStatusTimerRef.current = setTimeout(() => {
        setReplayOpenStatusMessage(null);
        replayOpenStatusTimerRef.current = null;
      }, 900);
      return;
    }
    setReplayOpenStatusMessage(null);
    if (replayOpenStatusTimerRef.current) {
      clearTimeout(replayOpenStatusTimerRef.current);
      replayOpenStatusTimerRef.current = null;
    }
    pastRevealOpenCooldownUntilRef.current = now + 500;
    setSelectedPastReveal(reveal);
    closeChapterHistoryModal();

    // Open the standard chapter reveal screen for replay
    if (selectedJourney?.captureMode === "photo") {
      // Photo mode: open timelapse preview
      (async () => {
        const clips = await buildTimelapseClips(token, selectedJourney.id);
        if (clips.length > 0) {
          setTimelapsePhotos(clips.map(c => ({ uri: c.clip.videoUrl, label: c.label })));
          setTimelapseClipObjects(clips.map(c => c.clip));
          setReelMode("timelapse");
          setComposedDaySpan(clips.length);
          setSkipReelLoading(false);
          setReelPreviewVisible(true);
        }
      })();
    } else {
      // Video mode: open chapter reveal screen
      setChapterRevealOpen(true);
    }
    if (!selectedJourney) return;
    trackEvent("past_chapter_opened", {
      journeyId: selectedJourney.id,
      chapterNumber: reveal.chapterNumber,
      milestoneLengthDays: reveal.milestoneLengthDays,
      source
    });
  }

  return (
    <>
      <View style={styles.root}>
        <Animated.View
          style={[
            styles.scrollShell,
            {
              opacity: progressTakeover.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 0.24]
              }),
              transform: [
                {
                  scale: progressTakeover.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 0.984]
                  })
                },
                {
                  translateY: progressTakeover.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -6]
                  })
                }
              ]
            }
          ]}
        >
          <ScrollView
            style={styles.container}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.content,
              singleSceneMode ? styles.contentSingleScene : null,
              { paddingBottom: Math.max(124, insets.bottom + 96) }
            ]}
            scrollIndicatorInsets={{ bottom: Math.max(124, insets.bottom + 96) }}
            scrollEnabled={!compareModalOpen}
          >
            {selectedJourney ? (
              <View style={[styles.heroIdentityWrap, compactMode ? styles.heroIdentityWrapCompact : null]}>
                <LinearGradient
                  colors={darkMode ? theme.gradients.heroSurfaceDark : theme.gradients.heroSurface}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.heroIdentityPanel}
                >
                  <Text style={[styles.heroEyebrow, darkMode ? styles.darkText : null]}>{selectedJourney.title.toLowerCase()}</Text>
                  <Text style={[styles.heroTitle, compactMode ? styles.heroTitleCompact : null, darkMode ? styles.darkTextPrimary : null]}>
                    {revealReady ? "reveal live" : `chapter ${chapterNumber}`}
                  </Text>
                  <Text style={[styles.heroMetaLine, tightMode ? styles.heroMetaLineCompact : null, darkMode ? styles.darkText : null]}>
                    {compareReady ? "day 1 → today" : chapterCountdownLabel}
                  </Text>
                </LinearGradient>
              </View>
            ) : (
              <>
                <Text style={styles.title}>progress studio</Text>
              </>
            )}

            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
            {/* Loading text removed — glitchy on tab switch */}

            {!journeysLoading && journeys.length === 0 ? <NoJourneyCard onStartJourney={() => onOpenJourneysTab()} /> : null}

            {selectedJourney && (reveals.length > 0 || chapterNumber > 1) ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chapterTimelineStrip}
                style={styles.chapterTimelineStripWrap}
              >
                {Array.from({ length: chapterNumber }, (_, i) => {
                  const num = i + 1;
                  const isCompleted = num < chapterNumber;
                  const isCurrent = num === chapterNumber;
                  return (
                    <View key={num} style={styles.chapterTimelineNode}>
                      {i > 0 ? <View style={[styles.chapterTimelineConnector, isCompleted || isCurrent ? styles.chapterTimelineConnectorFilled : null]} /> : null}
                      <View
                        style={[
                          styles.chapterTimelineDotNode,
                          isCompleted ? styles.chapterTimelineDotCompleted : null,
                          isCurrent ? styles.chapterTimelineDotCurrent : null,
                          !isCompleted && !isCurrent && darkMode ? { borderColor: "rgba(255,255,255,0.15)", backgroundColor: "rgba(30,28,26,0.9)" } : null
                        ]}
                      >
                        <Text style={[styles.chapterTimelineDotText, isCompleted ? styles.chapterTimelineDotTextCompleted : null, darkMode && !isCompleted ? styles.darkText : null]}>
                          {num}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            ) : null}

            {selectedJourney ? (
              <Animated.View
                style={[
                  styles.motionSection,
                  singleSceneMode ? styles.motionSectionSingleScene : null,
                  {
                    opacity: compareCardReveal,
                    transform: [
                      {
                        translateY: compareCardReveal.interpolate({
                          inputRange: [0, 1],
                          outputRange: [motionTokens.reveal.primaryY, 0]
                        })
                      },
                      {
                        scale: compareCardReveal.interpolate({
                          inputRange: [0, 1],
                          outputRange: [motionTokens.reveal.primaryScaleFrom, 1]
                        })
                      }
                    ]
                  }
                ]}
              >
                <Animated.View style={{ transform: [{ scale: revealCapsulePulse }] }}>
                  <LinearGradient
                    colors={
                      darkMode
                        ? theme.gradients.intelCardDark
                        : revealReady
                          ? theme.gradients.heroSurfaceReveal
                          : theme.gradients.intelCard
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[
                      styles.chapterSceneCard,
                      compactMode ? styles.chapterSceneCardCompact : null,
                      revealReady ? styles.chapterSceneCardReady : undefined
                    ]}
                  >
                    <View style={styles.revealCapsuleTopRow}>
                      <Text style={[styles.revealCapsuleEyebrow, revealReady ? styles.revealCapsuleEyebrowReady : undefined, darkMode ? styles.darkText : null]}>
                        {revealReady ? "reveal stage" : compareReady ? "compare stage" : "build stage"}
                      </Text>
                      <View style={styles.revealCapsuleTopActions}>
                        <View style={styles.chapterProgressPill}>
                          <Text style={styles.chapterProgressPillText}>{chapterProgressLabel}</Text>
                        </View>
                        <TactilePressable
                          style={styles.historyAccessButton}
                          onPress={() => {
                            if (!reveals.length || revealsLoading) return;
                            setChapterHistoryOpen(true);
                          }}
                          disabled={!reveals.length || revealsLoading}
                        >
                          <Text style={styles.historyAccessButtonText}>{revealsLoading ? "…" : hasRevealExportPurchase() ? "history" : "history (pro)"}</Text>
                        </TactilePressable>
                      </View>
                    </View>

                    <Text style={[styles.revealCapsuleTitle, compactMode ? styles.revealCapsuleTitleCompact : null, darkMode ? styles.darkTextPrimary : null]}>
                      {compareReady ? "day 1 vs now" : "keep this chapter moving."}
                    </Text>
                    <Text style={[styles.revealCapsuleCopy, compactMode ? styles.revealCapsuleCopyCompact : null, darkMode ? styles.darkText : null]}>
                      {compareReady
                        ? revealReady
                          ? "see how far you've come."
                          : "compare anytime while this chapter is still in build."
                        : "log one focused take and keep momentum."}
                    </Text>

                    {!revealReady ? (
                      <View style={styles.revealCapsuleTrack}>
                        <View
                          style={[
                            styles.revealCapsuleTrackFill,
                            { width: `${Math.max(0, Math.min(100, Math.round((Math.min(chapterProgressDays, chapterTargetDays) / chapterTargetDays) * 100)))}%` }
                          ]}
                        />
                      </View>
                    ) : null}

                    {!revealReady && !didPracticeToday ? (
                      <TactilePressable
                        style={styles.todayNudge}
                        pressScale={0.97}
                        onPress={() => {
                          trackEvent("today_nudge_tapped", { journeyId: selectedJourney.id });
                          onOpenJourneysTab({
                            journeyId: selectedJourney.id,
                            openRecorder: true
                          });
                        }}
                      >
                        <Text style={styles.todayNudgeDot}>●</Text>
                        <Text style={styles.todayNudgeText}>
                          {streak > 0
                            ? `don't lose your ${streak}-day streak — record today's take`
                            : "start your streak — record today's take"}
                        </Text>
                      </TactilePressable>
                    ) : null}

                    {revealReady ? (
                      <>
                        <TactilePressable
                          style={styles.watchRevealButton}
                          stretch
                          pressScale={0.96}
                          onPress={async () => {
                            triggerSelectionHaptic();
                            if (selectedJourney.captureMode === "photo") {
                              const clips = await buildTimelapseClips(token, selectedJourney.id);
                              if (clips.length > 0) {
                                setTimelapsePhotos(clips.map(c => ({ uri: c.clip.videoUrl, label: c.label })));
                                setTimelapseClipObjects(clips.map(c => c.clip));
                                setReelMode("timelapse");
                                setComposedDaySpan(clips.length);
                                setSkipReelLoading(false);
                                setReelPreviewVisible(true);
                                trackEvent("chapter_reveal_opened", { journeyId: selectedJourney.id, chapterNumber, mode: "timelapse" });
                                return;
                              }
                            }
                            setChapterRevealOpen(true);
                            trackEvent("chapter_reveal_opened", { journeyId: selectedJourney.id, chapterNumber });
                          }}
                        >
                          <LinearGradient
                            colors={theme.gradients.primaryAction}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.watchRevealButtonGradient}
                          >
                            <Text style={styles.watchRevealButtonText}>watch reveal</Text>
                          </LinearGradient>
                        </TactilePressable>
                        <TactilePressable
                          style={styles.nextChapterLink}
                          pressScale={0.97}
                          onPress={() => {
                            triggerSelectionHaptic();
                            void handleStartNextChapter(chapterTargetDays);
                          }}
                          disabled={Boolean(advancingMilestoneLength)}
                        >
                          <Text style={styles.nextChapterLinkText}>
                            {advancingMilestoneLength ? "starting..." : "start chapter " + (chapterNumber + 1)}
                          </Text>
                        </TactilePressable>
                      </>
                    ) : (
                      <TactilePressable
                        style={[styles.revealCapsulePrimary]}
                        onPress={async () => {
                          if (compareReady) {
                            setReelMode("video");
                            setComposedDaySpan(chapterProgressDays);
                            setSkipReelLoading(true);
                            setReelPreviewVisible(true);
                            return;
                          }
                          trackEvent("record_tapped", { journeyId: selectedJourney.id, context: "progress_build_capsule" });
                          onOpenJourneysTab({
                            journeyId: selectedJourney.id,
                            openRecorder: true
                          });
                        }}
                      >
                        <Text style={[styles.revealCapsulePrimaryText, compactMode ? styles.revealCapsulePrimaryTextCompact : null]}>
                          {compareReady ? "open compare" : didPracticeToday ? "retake" : selectedJourney.captureMode === "photo" ? "capture" : "record"}
                        </Text>
                      </TactilePressable>
                    )}

                    {!revealReady ? (
                      <Animated.View
                        style={[
                          styles.chapterStatusFooter,
                          darkMode && { borderTopColor: "rgba(255,255,255,0.08)" },
                          {
                            opacity: nextUnlockReveal,
                            transform: [
                              {
                                translateY: nextUnlockReveal.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [motionTokens.reveal.secondaryY, 0]
                                })
                              }
                            ]
                          }
                        ]}
                      >
                        <Text style={[styles.chapterStatusFooterText, darkMode && styles.darkText]}>{compareReady ? "compare ready" : "in build"}</Text>
                      </Animated.View>
                    ) : null}
                  </LinearGradient>
                </Animated.View>
                {chapterActionMessage ? <Text style={styles.chapterActionMessage}>{chapterActionMessage}</Text> : null}
              </Animated.View>
            ) : null}

            {selectedJourney ? (
              <View style={[styles.statsStrip, darkMode ? styles.darkCard : null]}>
                <View style={styles.statTile}>
                  <View style={styles.streakValueRow}>
                    <Text style={[styles.statValue, darkMode ? styles.darkTextPrimary : null]}>{streak}</Text>
                    {streak >= 3 ? (
                      <Animated.Text
                        style={[
                          styles.streakFlame,
                          {
                            opacity: streakFlamePulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }),
                            transform: [
                              { scale: streakFlamePulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) },
                              { translateY: streakFlamePulse.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) }
                            ]
                          }
                        ]}
                      >
                        🔥
                      </Animated.Text>
                    ) : null}
                  </View>
                  <Text style={[styles.statLabel, darkMode ? styles.darkText : null]}>day streak</Text>
                  {bestStreak > streak ? (
                    <Text style={styles.bestStreakLabel}>best: {bestStreak}</Text>
                  ) : null}
                </View>
                <View style={[styles.statTileDivider, darkMode ? styles.darkDivider : null]} />
                <View style={styles.statTile}>
                  <Text style={[styles.statValue, darkMode ? styles.darkTextPrimary : null]}>{dayCount}</Text>
                  <Text style={[styles.statLabel, darkMode ? styles.darkText : null]}>total takes</Text>
                </View>
                <View style={[styles.statTileDivider, darkMode ? styles.darkDivider : null]} />
                <View style={styles.statTile}>
                  <Text style={[styles.statValue, darkMode ? styles.darkTextPrimary : null]}>{reveals.length}</Text>
                  <Text style={[styles.statLabel, darkMode ? styles.darkText : null]}>{reveals.length === 1 ? "chapter done" : "chapters done"}</Text>
                </View>
              </View>
            ) : null}

            {selectedJourney && showHeatmap ? (
              <View style={[styles.heatmapCard, darkMode ? styles.darkCard : null]}>
                <View style={styles.heatmapHeader}>
                  <Text style={[styles.heatmapTitle, darkMode ? styles.darkTextPrimary : null]}>activity</Text>
                  {protocolConsistency && protocolConsistency.consistencyPct > 0 ? (
                    <Text style={styles.heatmapConsistency}>{protocolConsistency.consistencyPct}% consistency</Text>
                  ) : null}
                </View>
                <View style={styles.heatmapGrid}>
                  {Array.from({ length: 8 }, (_, weekIdx) => (
                    <View key={weekIdx} style={styles.heatmapColumn}>
                      {heatmapCells.slice(weekIdx * 7, weekIdx * 7 + 7).map((cell) => (
                        <View
                          key={cell.key}
                          style={[
                            styles.heatmapCell,
                            cell.practiced
                              ? styles.heatmapCellActive
                              : cell.isToday
                                ? styles.heatmapCellToday
                                : darkMode ? styles.heatmapCellEmptyDark : styles.heatmapCellEmpty
                          ]}
                        />
                      ))}
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {!selectedJourney && !journeysLoading && journeys.length > 0 ? (
              <GlassSurface style={styles.emptySelectionCard} intensity={24}>
                <Text style={styles.emptySelectionTitle}>pick your active journey in practice.</Text>
                <Text style={styles.emptySelectionCopy}>progress tracks the chapter you are actively building.</Text>
                <TactilePressable
                  style={styles.emptySelectionButton}
                  onPress={() => {
                    onOpenJourneysTab();
                  }}
                >
                  <Text style={styles.emptySelectionButtonText}>open practice</Text>
                </TactilePressable>
              </GlassSurface>
            ) : null}

          </ScrollView>
        </Animated.View>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.takeoverShade,
            {
              opacity: progressTakeover.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.54]
              })
            }
          ]}
        />
      </View>

      <ComparisonRevealModal
        visible={compareModalOpen && Boolean(activeComparison)}
        comparison={activeComparison}
        presetLabel={activePresetLabel}
        entryStage="compare"
        token={token}
        chapterNumber={chapterNumber}
        journeyId={selectedJourney?.id ?? null}
        goalText={selectedJourney?.goalText ?? null}
        milestoneLengthDays={chapterTargetDays}
        progressDays={chapterProgressDays}
        currentStreak={streak}
        totalPracticeDays={dayCount}
        modalBackdropReveal={modalBackdropReveal}
        modalCardReveal={modalCardReveal}
        thenPanelReveal={thenPanelReveal}
        nowPanelReveal={nowPanelReveal}
        labelsReveal={labelsReveal}
        sourceRect={comparisonSourceRect}
        pairStrategyLabel={comparisonPlan?.strategyLabel ?? null}
        pairReason={comparisonPlan?.reason ?? null}
        pairConsistencyScore={comparisonPlan?.consistencyScore ?? null}
        trailerMoments={comparisonPlan?.trailerMoments ?? null}
        allChapterClips={revealTrackClips}
        storylineHeadline={liveRevealStoryline?.headline ?? null}
        storylineCaption={liveRevealStoryline?.caption ?? null}
        storylineReflection={liveRevealStoryline?.reflection ?? null}
        nextChapterBusyLength={advancingMilestoneLength}
        chapterActionMessage={chapterActionMessage}
        onStartNextChapter={(days) => {
          void handleStartNextChapter(days);
        }}
        onClose={() => {
          setCompareModalOpen(false);
          setComparisonSourceRect(null);
        }}
      />


      <Modal visible={chapterHistoryOpen} animationType="fade" transparent onRequestClose={closeChapterHistoryModal}>
        <Animated.View style={[styles.pastChapterOverlay, { opacity: historyModalBackdropOpacity }]}>
          <Animated.View
            style={[
              styles.historyModalCardMotion,
              {
                opacity: historyModalCardOpacity,
                transform: [{ translateY: historyModalDragY }]
              }
            ]}
          >
            <GlassSurface style={[styles.historyModalCard, darkMode && { backgroundColor: "rgba(20,18,16,0.98)", borderColor: "rgba(255,255,255,0.08)" }]} intensity={26} tone={darkMode ? "dark" : "light"}>
              <View style={styles.historyModalDragHandleWrap} {...historyModalPanResponder.panHandlers}>
                <View style={[styles.historyModalDragHandle, darkMode && { backgroundColor: "rgba(255,255,255,0.25)" }]} />
              </View>
            <View style={styles.historyModalHeader}>
              <View>
                <Text style={[styles.pastChapterEyebrow, darkMode && styles.darkText]}>journey arc</Text>
                <Text style={[styles.historyModalTitle, darkMode && styles.darkTextPrimary]}>chapter history</Text>
              </View>
              <TactilePressable style={[styles.historyModalCloseChip, darkMode && { backgroundColor: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.1)" }]} onPress={closeChapterHistoryModal}>
                <Text style={[styles.historyModalCloseText, darkMode && styles.darkTextPrimary]}>close</Text>
              </TactilePressable>
            </View>
            {renderReplayOpenStatus ? (
              <Animated.Text
                style={[
                  styles.historyVerdictCooldownMessage,
                  {
                    opacity: replayOpenStatusReveal,
                    color: replayOpenStatusPulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [theme.colors.accentStrong, "#ff7b45"]
                    }),
                    transform: [
                      {
                        translateY: replayOpenStatusReveal.interpolate({
                          inputRange: [0, 1],
                          outputRange: [2, 0]
                        })
                      },
                      {
                        scale: replayOpenStatusPulse.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 1.02]
                        })
                      }
                    ]
                  }
                ]}
              >
                {replayOpenStatusMessage ?? "opening replay..."}
              </Animated.Text>
            ) : null}

            {revealsLoading ? <Text style={[styles.archiveMuted, darkMode && styles.darkText]}>loading chapters...</Text> : null}
            {!revealsLoading && reveals.length === 0 ? <Text style={[styles.archiveMuted, darkMode && styles.darkText]}>no completed chapters yet.</Text> : null}
            {!revealsLoading ? (
              <ScrollView style={styles.historyModalList} showsVerticalScrollIndicator={false}>
                {reveals.map((reveal) => {
                  const replayReady = Boolean(revealReplayPlans[reveal.id]);
                  const momentCount = revealReplayPlans[reveal.id]?.trailerMoments.length ?? 0;
                  const completedDate = new Date(reveal.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
                  return (
                    <TactilePressable
                      key={reveal.id}
                      style={[styles.chapterTimelineRow, darkMode && { backgroundColor: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.06)" }, !replayReady ? styles.chapterTimelineRowDisabled : undefined]}
                      onPress={() => {
                        openPastReveal(reveal, "history_row");
                      }}
                    >
                      <View style={styles.chapterTimelineRail}>
                        <View style={[styles.chapterTimelineLine, darkMode && { backgroundColor: "rgba(255,255,255,0.3)" }]} />
                        <View style={styles.chapterTimelineDot} />
                      </View>
                      <View style={styles.chapterTimelineBody}>
                        <View style={styles.archiveRowTop}>
                          <Text style={[styles.archiveRowTitle, darkMode && styles.darkTextPrimary]}>chapter {reveal.chapterNumber}</Text>
                          <View
                            style={[
                              styles.archiveVerdictPill,
                              replayReady ? styles.archiveVerdictPillGood : styles.archiveVerdictPillNeutral
                            ]}
                          >
                            <Text
                              style={[
                                styles.archiveVerdictText,
                                replayReady ? styles.archiveVerdictTextGood : styles.archiveVerdictTextNeutral
                              ]}
                            >
                              {replayReady ? "watch reveal" : "processing"}
                            </Text>
                          </View>
                        </View>
                        <Text style={[styles.archiveRowMeta, darkMode && styles.darkText]}>
                          {reveal.recordedDays}/{reveal.milestoneLengthDays} days captured{momentCount > 0 ? ` • ${momentCount}-moment reel` : ""} • Completed {completedDate}
                        </Text>
                      </View>
                    </TactilePressable>
                  );
                })}
              </ScrollView>
            ) : null}
            </GlassSurface>
          </Animated.View>
        </Animated.View>
      </Modal>

      <ReelPreviewScreen
        visible={reelPreviewVisible}
        firstClipUri={comparison?.thenClip.videoUrl ?? null}
        latestClipUri={comparison?.nowClip.videoUrl ?? null}
        daySpan={reelMode === "timelapse" ? composedDaySpan : chapterProgressDays}
        chapterNumber={chapterNumber}
        goalText={selectedJourney?.goalText ?? null}
        darkMode={darkMode}
        onClose={() => setReelPreviewVisible(false)}
        mode={reelMode}
        timelapsePhotos={reelMode === "timelapse" ? timelapsePhotos : undefined}
        timelapseClips={reelMode === "timelapse" ? timelapseClipObjects : undefined}
        token={token}
        journeyId={selectedJourney?.id}
        skipLoading={skipReelLoading}
      />
      <ChapterRevealScreen
        visible={chapterRevealOpen}
        reelExportInput={selectedPastReveal ? {
          chapterNumber: selectedPastReveal.chapterNumber,
          trailerMoments: revealReplayPlans[selectedPastReveal.id]?.trailerMoments ?? null,
          sourceClips: revealTrackClips,
          fallbackClip: null,
          milestoneLengthDays: selectedPastReveal.milestoneLengthDays,
          progressDays: selectedPastReveal.recordedDays,
          currentStreak: Math.min(streak, selectedPastReveal.recordedDays),
          storylineHeadline: revealStorylines[selectedPastReveal.id]?.headline ?? null,
          storylineCaption: revealStorylines[selectedPastReveal.id]?.caption ?? null,
          storylineReflection: revealStorylines[selectedPastReveal.id]?.reflection ?? null,
          token,
          journeyId: selectedJourney?.id ?? null,
        } : {
          chapterNumber,
          trailerMoments: comparisonPlan?.trailerMoments ?? null,
          sourceClips: revealTrackClips,
          fallbackClip: comparison?.nowClip ?? null,
          milestoneLengthDays: chapterTargetDays,
          progressDays: chapterProgressDays,
          currentStreak: streak,
          storylineHeadline: liveRevealStoryline?.headline ?? null,
          storylineCaption: liveRevealStoryline?.caption ?? null,
          storylineReflection: liveRevealStoryline?.reflection ?? null,
          token,
          journeyId: selectedJourney?.id ?? null,
        }}
        daySpan={selectedPastReveal?.recordedDays ?? chapterProgressDays}
        chapterNumber={selectedPastReveal?.chapterNumber ?? chapterNumber}
        goalText={selectedJourney?.goalText ?? null}
        darkMode={darkMode}
        onClose={() => {
          setChapterRevealOpen(false);
          setSelectedPastReveal(null);
        }}
      />
      <PaywallModal
        visible={historyPaywallVisible}
        onClose={() => {
          setHistoryPaywallVisible(false);
          setPendingPaywallReveal(null);
        }}
        onPurchased={() => {
          setHistoryPaywallVisible(false);
          if (pendingPaywallReveal) {
            const { reveal, source } = pendingPaywallReveal;
            setPendingPaywallReveal(null);
            openPastReveal(reveal, source);
          }
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1
  },
  scrollShell: {
    flex: 1
  },
  takeoverShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.34)"
  },
  container: {
    flex: 1
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28
  },
  contentSingleScene: {
    flexGrow: 1
  },
  title: {
    marginTop: 8,
    fontSize: 40,
    lineHeight: 44,
    fontWeight: "800",
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.display
  },
  subtitle: {
    marginTop: 5,
    fontSize: 18,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.body
  },
  heroIdentityWrap: {
    marginTop: 12,
    marginBottom: 6
  },
  heroIdentityWrapCompact: {
    marginTop: 8,
    marginBottom: 4
  },
  heroIdentityPanel: {
    borderRadius: theme.shape.cardRadiusLg,
    borderWidth: 0,
    borderColor: "transparent",
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: "#000000",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 0
  },
  heroEyebrow: {
    color: theme.colors.textSecondary,
    /* textTransform: "uppercase", */
    letterSpacing: 0.3,
    fontWeight: "800",
    fontSize: 11,
    fontFamily: theme.typography.label
  },
  heroTitle: {
    marginTop: 5,
    color: theme.colors.textPrimary,
    fontSize: 48,
    lineHeight: 52,
    fontWeight: "800",
    fontFamily: theme.typography.display
  },
  heroTitleCompact: {
    fontSize: 40,
    lineHeight: 44
  },
  heroMetaLine: {
    marginTop: 7,
    color: theme.colors.textSecondary,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "800",
    fontFamily: theme.typography.body
  },
  heroMetaLineCompact: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 18
  },
  captureModeSwitch: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8
  },
  captureModeChip: {
    borderRadius: theme.shape.pillRadius,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(241,233,221,0.94)",
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  captureModeChipSelected: {
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(255,90,31,0.3)"
  },
  captureModeChipText: {
    color: theme.colors.textSecondary,
    fontWeight: "800",
    fontSize: 12
  },
  captureModeChipTextSelected: {
    color: theme.colors.accentStrong
  },
  journeyIdentityWrap: {
    marginTop: 12
  },
  journeyIdentity: {
    color: theme.colors.textPrimary,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "800"
  },
  journeyMetaLine: {
    marginTop: 4,
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: "700"
  },
  errorText: {
    marginTop: 10,
    color: theme.colors.danger,
    fontWeight: "700"
  },
  mutedText: {
    marginTop: 10,
    color: theme.colors.textSecondary
  },
  motionSection: {
    marginTop: 12
  },
  motionSectionSingleScene: {
    marginTop: 10
  },
  chapterSceneCard: {
    marginTop: 8,
    borderRadius: theme.shape.cardRadiusLg,
    borderWidth: 0,
    borderColor: "transparent",
    backgroundColor: "transparent",
    padding: 20,
    shadowColor: "#000000",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 }
  },
  chapterSceneCardCompact: {
    borderRadius: theme.shape.cardRadiusMd,
    padding: 17
  },
  chapterSceneCardReady: {
    borderColor: "rgba(0,0,0,0.08)"
  },
  revealCapsuleCard: {
    marginTop: 14,
    borderRadius: theme.shape.cardRadiusLg,
    borderWidth: 0,
    borderColor: "transparent",
    backgroundColor: "rgba(241,233,221,0.96)",
    padding: 16,
    shadowColor: "#000000",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 }
  },
  revealCapsuleTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 8
  },
  revealCapsuleTopActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  chapterProgressPill: {
    borderRadius: theme.shape.pillRadius,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(240,232,220,0.94)",
    paddingHorizontal: 11,
    paddingVertical: 6
  },
  chapterProgressPillText: {
    color: theme.colors.accentStrong,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.95,
    /* textTransform: "uppercase", */
    fontFamily: theme.typography.label
  },
  revealCapsuleEyebrow: {
    color: theme.colors.textSecondary,
    /* textTransform: "uppercase", */
    fontWeight: "800",
    fontSize: 11,
    letterSpacing: 0.3,
    fontFamily: theme.typography.label
  },
  revealCapsuleEyebrowReady: {
    color: theme.colors.accentStrong,
    fontFamily: theme.typography.label
  },
  revealCapsuleTitle: {
    marginTop: 6,
    color: theme.colors.textPrimary,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "800",
    fontFamily: theme.typography.display
  },
  revealCapsuleTitleCompact: {
    fontSize: 30,
    lineHeight: 34
  },
  revealCapsuleCopy: {
    marginTop: 6,
    color: theme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "600",
    fontFamily: theme.typography.body
  },
  revealCapsuleCopyCompact: {
    fontSize: 13,
    lineHeight: 17
  },
  revealIntelCard: {
    marginTop: 10,
    borderRadius: theme.shape.cardRadiusMd,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(239,232,222,0.95)",
    paddingHorizontal: 11,
    paddingVertical: 9,
    gap: 2
  },
  revealIntelLabel: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "800"
  },
  revealIntelReason: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "600"
  },
  revealIntelTrailer: {
    marginTop: 1,
    color: "#2d2d2d",
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "700"
  },
  revealCapsuleTrack: {
    marginTop: 16,
    height: 8,
    borderRadius: 0,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(240,232,220,0.95)"
  },
  revealCapsuleTrackFill: {
    height: "100%",
    borderRadius: 0,
    backgroundColor: theme.colors.accent
  },
  revealCapsulePrimary: {
    marginTop: 14,
    borderRadius: 24,
    borderWidth: 0,
    borderColor: "transparent",
    backgroundColor: theme.colors.accent,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
    shadowColor: "#000000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }
  },
  revealCapsulePrimaryReady: {
    borderColor: "transparent",
    backgroundColor: theme.colors.accentStrong,
    shadowOpacity: 0.2,
    shadowRadius: 12
  },
  revealCapsulePrimaryText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 14,
    letterSpacing: 0.3,
    /* textTransform: "uppercase", */
    fontFamily: theme.typography.label
  },
  revealCapsulePrimaryTextCompact: {
    fontSize: 15
  },
  watchRevealButton: {
    marginTop: 12,
    borderRadius: 24,
    overflow: "hidden",
  },
  watchRevealButtonGradient: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
  },
  watchRevealButtonText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 16,
  },
  nextChapterLink: {
    marginTop: 10,
    alignSelf: "center",
    paddingVertical: 8,
  },
  nextChapterLinkText: {
    color: theme.colors.accent,
    fontWeight: "700",
    fontSize: 15,
  },
  revealQuickReadyPill: {
    marginTop: 8,
    alignSelf: "flex-start",
    borderRadius: theme.shape.pillRadius,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(21,122,63,0.22)",
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  revealQuickReadyGroup: {
    alignSelf: "flex-start"
  },
  revealQuickReadyPillText: {
    color: "#0f4a28",
    fontWeight: "800",
    fontSize: 10,
    letterSpacing: 0.3,
    /* textTransform: "uppercase", */
    fontFamily: theme.typography.label
  },
  revealQuickReadyMeta: {
    marginTop: 4,
    marginLeft: 2,
    color: "rgba(17,17,17,0.72)",
    fontSize: 11,
    letterSpacing: 0.2,
    fontWeight: "700",
    fontFamily: theme.typography.body
  },
  revealCapsuleSecondaryRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "stretch"
  },
  revealCapsuleSecondarySpacer: {
    width: 10
  },
  revealCapsuleSecondary: {
    flex: 1,
    borderRadius: theme.shape.buttonRadius,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(240,232,220,0.95)",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12
  },
  revealCapsuleSecondaryDisabled: {
    opacity: 0.68
  },
  revealCapsuleSecondaryText: {
    color: "#111111",
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 0.3,
    /* textTransform: "uppercase", */
    fontFamily: theme.typography.label
  },
  revealCapsuleSecondaryMessage: {
    marginTop: 8,
    color: "#2d2d2d",
    fontWeight: "700",
    fontSize: 12
  },
  chapterStatusFooter: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.08)",
    alignItems: "flex-start"
  },
  chapterStatusFooterText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: "700"
  },
  historyAccessButton: {
    borderRadius: theme.shape.pillRadius,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(240,232,220,0.94)",
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  historyAccessButtonText: {
    color: theme.colors.accentStrong,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.3,
    /* textTransform: "uppercase", */
    fontFamily: theme.typography.label
  },
  todayNudge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "rgba(255,90,31,0.1)",
    gap: 8
  },
  todayNudgeDot: {
    fontSize: 8,
    color: theme.colors.accentStrong
  },
  todayNudgeText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: theme.colors.accentStrong
  },
  chapterActionMessage: {
    marginTop: 10,
    color: theme.colors.textSecondary,
    fontWeight: "700",
    fontSize: 12
  },
  chapterTimelineStripWrap: {
    marginTop: 10,
    marginBottom: -4
  },
  chapterTimelineStrip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    paddingVertical: 6
  },
  chapterTimelineNode: {
    flexDirection: "row",
    alignItems: "center"
  },
  chapterTimelineConnector: {
    width: 20,
    height: 2,
    backgroundColor: "rgba(0,0,0,0.1)",
    marginHorizontal: 2
  },
  chapterTimelineConnectorFilled: {
    backgroundColor: theme.colors.accentStrong
  },
  chapterTimelineDotNode: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "rgba(0,0,0,0.12)",
    backgroundColor: "rgba(246,240,232,0.9)",
    alignItems: "center",
    justifyContent: "center"
  },
  chapterTimelineDotCompleted: {
    backgroundColor: theme.colors.accentStrong,
    borderColor: theme.colors.accentStrong
  },
  chapterTimelineDotCurrent: {
    borderColor: theme.colors.accentStrong,
    borderWidth: 2.5
  },
  chapterTimelineDotText: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.textSecondary
  },
  chapterTimelineDotTextCompleted: {
    color: "#fff"
  },
  statsStrip: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    borderRadius: theme.shape.cardRadiusMd,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    backgroundColor: "rgba(246,240,232,0.85)",
    paddingVertical: 14,
    paddingHorizontal: 6
  },
  statTile: {
    flex: 1,
    alignItems: "center"
  },
  statTileDivider: {
    width: 1,
    height: 28,
    backgroundColor: "rgba(0,0,0,0.1)"
  },
  streakValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2
  },
  streakFlame: {
    fontSize: 20,
    marginTop: -2
  },
  statValue: {
    fontSize: 26,
    fontWeight: "800",
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.display
  },
  statLabel: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "700",
    color: theme.colors.textSecondary,
    textTransform: "lowercase" as const
  },
  bestStreakLabel: {
    marginTop: 1,
    fontSize: 10,
    fontWeight: "700",
    color: theme.colors.accentStrong
  },
  heatmapCard: {
    marginTop: 14,
    borderRadius: theme.shape.cardRadiusMd,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    backgroundColor: "rgba(246,240,232,0.85)",
    padding: 14
  },
  heatmapHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10
  },
  heatmapTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: theme.colors.textPrimary,
    textTransform: "lowercase" as const
  },
  heatmapConsistency: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.colors.accentStrong
  },
  heatmapGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 3
  },
  heatmapColumn: {
    flex: 1,
    gap: 3
  },
  heatmapCell: {
    aspectRatio: 1,
    borderRadius: 3,
    width: "100%"
  },
  heatmapCellActive: {
    backgroundColor: theme.colors.accentStrong
  },
  heatmapCellToday: {
    backgroundColor: "rgba(255,90,31,0.18)",
    borderWidth: 1.5,
    borderColor: theme.colors.accentStrong
  },
  heatmapCellEmpty: {
    backgroundColor: "rgba(0,0,0,0.06)"
  },
  heatmapCellEmptyDark: {
    backgroundColor: "rgba(255,255,255,0.08)"
  },
  protocolCard: {
    marginTop: 12,
    borderRadius: theme.shape.cardRadiusMd,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(246,240,232,0.98)",
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 5
  },
  protocolKicker: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "800",
    /* textTransform: "uppercase", */
    letterSpacing: 0.92,
    fontFamily: theme.typography.label
  },
  protocolTitle: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    lineHeight: 21,
    fontWeight: "800",
    fontFamily: theme.typography.heading
  },
  protocolCopy: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "600",
    fontFamily: theme.typography.body
  },
  protocolStatus: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    lineHeight: 16,
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
  finaleCard: {
    marginTop: 12,
    borderRadius: theme.shape.cardRadiusMd,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(240,232,220,0.98)",
    paddingHorizontal: 12,
    paddingVertical: 11
  },
  finaleCardMotion: {
    marginTop: 0
  },
  finaleCardUnlockedFlash: {
    borderColor: theme.colors.accentStrong,
    backgroundColor: "rgba(255,90,31,0.13)"
  },
  finaleTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  finaleKicker: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "800",
    /* textTransform: "uppercase", */
    letterSpacing: 0.92,
    fontFamily: theme.typography.label
  },
  finaleStatePill: {
    borderRadius: theme.shape.pillRadius,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  finaleStatePillLive: {
    backgroundColor: "rgba(21,122,63,0.2)"
  },
  finaleStatePillLocked: {
    backgroundColor: "rgba(216,208,195,0.88)"
  },
  finaleStateText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    /* textTransform: "uppercase", */
    fontFamily: theme.typography.label
  },
  finaleStateTextLive: {
    color: "#0f4a28"
  },
  finaleStateTextLocked: {
    color: "#2d2d2d"
  },
  finaleTitle: {
    marginTop: 8,
    color: theme.colors.textPrimary,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "800",
    fontFamily: theme.typography.heading
  },
  finaleCopy: {
    marginTop: 4,
    color: theme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    fontFamily: theme.typography.body
  },
  finaleUnlockNotice: {
    marginTop: 6,
    color: theme.colors.accentStrong,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    fontFamily: theme.typography.body
  },
  finaleTrack: {
    marginTop: 10,
    height: 8,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(246,240,232,0.95)",
    overflow: "hidden"
  },
  finaleTrackFill: {
    height: "100%",
    backgroundColor: theme.colors.accent
  },
  finaleMeta: {
    marginTop: 6,
    color: "#2f2f2f",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    fontFamily: theme.typography.body
  },
  finaleActionRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "stretch"
  },
  finaleActionSpacer: {
    width: 10
  },
  finaleSecondaryAction: {
    flex: 1,
    borderRadius: theme.shape.buttonRadius,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(246,240,232,0.95)",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12
  },
  finalePrimaryAction: {
    marginTop: 10,
    borderRadius: theme.shape.buttonRadius,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: theme.colors.accent,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12
  },
  finalePrimaryActionText: {
    color: "#130900",
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 0.3,
    /* textTransform: "uppercase", */
    fontFamily: theme.typography.label
  },
  finaleSecondaryActionText: {
    color: "#111111",
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 0.88,
    /* textTransform: "uppercase", */
    fontFamily: theme.typography.label
  },
  finaleActionDisabled: {
    opacity: 0.68
  },
  finaleMessage: {
    marginTop: 8,
    color: "#2d2d2d",
    fontWeight: "700",
    fontSize: 12,
    fontFamily: theme.typography.body
  },
  archiveMuted: {
    marginTop: 8,
    color: theme.colors.textSecondary,
    fontWeight: "600"
  },
  chapterTimelineRow: {
    marginTop: 12,
    borderRadius: theme.shape.cardRadiusMd,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(241,233,222,0.95)",
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10
  },
  chapterTimelineRowDisabled: {
    opacity: 0.72
  },
  chapterTimelineRail: {
    width: 18,
    alignItems: "center",
    justifyContent: "center",
    position: "relative"
  },
  chapterTimelineLine: {
    position: "absolute",
    top: 2,
    bottom: 2,
    width: 2,
    backgroundColor: "#111111"
  },
  chapterTimelineDot: {
    width: 9,
    height: 9,
    borderRadius: 0,
    backgroundColor: theme.colors.accent,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)"
  },
  chapterTimelineBody: {
    flex: 1
  },
  archiveRowTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8
  },
  archiveRowTitle: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontWeight: "800",
    fontSize: 16
  },
  archiveVerdictPill: {
    borderRadius: theme.shape.pillRadius,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  archiveVerdictPillGood: {
    backgroundColor: "rgba(13,159,101,0.2)"
  },
  archiveVerdictPillWarn: {
    backgroundColor: "rgba(255,186,110,0.24)"
  },
  archiveVerdictPillNeutral: {
    backgroundColor: "rgba(216,208,195,0.84)"
  },
  archiveVerdictText: {
    fontSize: 10,
    fontWeight: "800",
    /* textTransform: "uppercase", */
    letterSpacing: 0.52,
    fontFamily: theme.typography.label
  },
  archiveVerdictTextGood: {
    color: "#0f4a28"
  },
  archiveVerdictTextWarn: {
    color: "#6a3400"
  },
  archiveVerdictTextNeutral: {
    color: "#2d2d2d"
  },
  archiveRowMeta: {
    marginTop: 4,
    color: theme.colors.textSecondary,
    fontWeight: "600",
    fontSize: 13
  },
  archiveStoryReflection: {
    marginTop: 4,
    color: "#2f2f2f",
    fontWeight: "600",
    fontSize: 12,
    lineHeight: 16
  },
  archiveReplayState: {
    marginTop: 5,
    fontSize: 12,
    fontWeight: "700"
  },
  archiveReplayStateReady: {
    color: theme.colors.accentStrong
  },
  archiveReplayStateMissing: {
    color: theme.colors.textSecondary
  },
  emptySelectionCard: {
    marginTop: 16,
    borderRadius: theme.shape.cardRadiusLg,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(245,239,230,0.98)",
    padding: 14
  },
  emptySelectionTitle: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800"
  },
  emptySelectionCopy: {
    marginTop: 6,
    color: theme.colors.textSecondary,
    fontWeight: "600",
    lineHeight: 20
  },
  emptySelectionButton: {
    marginTop: 12,
    borderRadius: theme.shape.buttonRadius,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(255,90,31,0.22)",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10
  },
  emptySelectionButtonText: {
    color: theme.colors.accentStrong,
    fontWeight: "800",
    fontSize: 14,
    letterSpacing: 0.3,
    /* textTransform: "uppercase", */
    fontFamily: theme.typography.label
  },
  pastChapterOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.54)",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  pastChapterCard: {
    width: "100%",
    borderRadius: theme.shape.cardRadiusLg,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(246,240,232,0.98)",
    padding: 18
  },
  historyModalCard: {
    width: "100%",
    maxHeight: "92%",
    borderTopLeftRadius: theme.shape.cardRadiusLg,
    borderTopRightRadius: theme.shape.cardRadiusLg,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(246,240,232,0.98)",
    padding: 18,
    paddingBottom: 34,
  },
  historyModalCardMotion: {
    width: "100%",
  },
  historyModalDragHandleWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 2,
    paddingBottom: 8
  },
  historyModalDragHandle: {
    width: 46,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(17,17,17,0.34)"
  },
  historyModalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 4
  },
  historyModalList: {
    marginTop: 6,
    paddingBottom: 24,
  },
  historyVerdictTrendCard: {
    marginTop: 8,
    borderRadius: theme.shape.cardRadiusMd,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(241,233,221,0.92)",
    paddingHorizontal: 10,
    paddingVertical: 9
  },
  historyVerdictTrendKicker: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "800",
    /* textTransform: "uppercase", */
    letterSpacing: 0.68,
    fontFamily: theme.typography.label
  },
  historyVerdictTrendHint: {
    marginTop: 4,
    color: "#2f2f2f",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "600",
    fontFamily: theme.typography.body
  },
  historyVerdictTrendRow: {
    marginTop: 7,
    gap: 8,
    paddingRight: 8
  },
  historyVerdictTrendPill: {
    borderRadius: theme.shape.cardRadiusMd,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    paddingHorizontal: 8,
    paddingVertical: 6,
    minWidth: 112
  },
  historyVerdictTrendPillGood: {
    backgroundColor: "rgba(13,159,101,0.2)"
  },
  historyVerdictTrendPillWarn: {
    backgroundColor: "rgba(255,186,110,0.24)"
  },
  historyVerdictTrendPillNeutral: {
    backgroundColor: "rgba(216,208,195,0.84)"
  },
  historyVerdictTrendPillPending: {
    opacity: 0.74
  },
  historyVerdictTrendPillSelected: {
    borderColor: theme.colors.accentStrong
  },
  historyVerdictTrendPillRecommended: {
    backgroundColor: "rgba(255,90,31,0.26)"
  },
  historyVerdictTrendMeta: {
    color: "#2d2d2d",
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "800",
    /* textTransform: "uppercase", */
    letterSpacing: 0.46,
    fontFamily: theme.typography.label
  },
  historyVerdictTrendText: {
    marginTop: 3,
    color: "#1f1f1f",
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "800",
    fontFamily: theme.typography.body
  },
  historyVerdictTrendTag: {
    marginTop: 4,
    alignSelf: "flex-start",
    borderRadius: theme.shape.pillRadius,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(246,240,232,0.95)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    color: "#111111",
    fontSize: 9,
    lineHeight: 11,
    fontWeight: "800",
    /* textTransform: "uppercase", */
    letterSpacing: 0.52,
    fontFamily: theme.typography.label
  },
  historyVerdictTrendSummary: {
    marginTop: 6,
    color: "#2f2f2f",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
    fontFamily: theme.typography.body
  },
  historyVerdictCooldownMessage: {
    marginTop: 4,
    color: theme.colors.accentStrong,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
    fontFamily: theme.typography.body
  },
  historyVerdictWhyButton: {
    marginTop: 6,
    alignSelf: "flex-start",
    borderRadius: theme.shape.pillRadius,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(246,240,232,0.95)",
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  historyVerdictWhyButtonText: {
    color: "#111111",
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "800",
    letterSpacing: 0.42,
    /* textTransform: "uppercase", */
    fontFamily: theme.typography.label
  },
  historyVerdictBreakdownMotion: {
    marginTop: 6
  },
  historyVerdictBreakdownCard: {
    borderRadius: theme.shape.cardRadiusMd,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(246,240,232,0.95)",
    paddingHorizontal: 8,
    paddingVertical: 7,
    gap: 3
  },
  historyVerdictBreakdownTitle: {
    color: "#111111",
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "800",
    letterSpacing: 0.46,
    /* textTransform: "uppercase", */
    fontFamily: theme.typography.label
  },
  historyVerdictBreakdownLine: {
    color: "#2f2f2f",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "600",
    fontFamily: theme.typography.body
  },
  historyVerdictBreakdownTotal: {
    marginTop: 1,
    color: "#111111",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
    fontFamily: theme.typography.body
  },
  historyVerdictOpenReplayButton: {
    marginTop: 6,
    alignSelf: "flex-start",
    borderRadius: theme.shape.pillRadius,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(255,90,31,0.26)",
    paddingHorizontal: 8,
    paddingVertical: 5
  },
  historyVerdictOpenReplayButtonText: {
    color: "#111111",
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "800",
    /* textTransform: "uppercase", */
    letterSpacing: 0.52,
    fontFamily: theme.typography.label
  },
  historyModalTitle: {
    marginTop: 3,
    color: theme.colors.textPrimary,
    fontSize: 24,
    fontWeight: "800"
  },
  historyModalCloseChip: {
    borderRadius: theme.shape.pillRadius,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(240,232,220,0.95)",
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  historyModalCloseText: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: "800"
  },
  pastChapterEyebrow: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.7
    /* textTransform: "uppercase" */
  },
  pastChapterTitle: {
    marginTop: 4,
    color: theme.colors.textPrimary,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "800"
  },
  pastChapterMeta: {
    marginTop: 3,
    color: theme.colors.textSecondary,
    fontSize: 16,
    fontWeight: "700"
  },
  pastChapterStatsWrap: {
    marginTop: 14,
    gap: 8
  },
  pastChapterStat: {
    borderRadius: theme.shape.cardRadiusMd,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(241,233,221,0.94)",
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  pastChapterStatLabel: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    /* textTransform: "uppercase", */
    letterSpacing: 0.45
  },
  pastChapterStatValue: {
    marginTop: 2,
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: "800"
  },
  pastChapterCopy: {
    marginTop: 12,
    color: theme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600"
  },
  pastChapterCloseButton: {
    marginTop: 14,
    borderRadius: theme.shape.buttonRadius,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(255,90,31,0.22)",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12
  },
  pastChapterCloseButtonText: {
    color: theme.colors.accentStrong,
    fontSize: 15,
    fontWeight: "800"
  },
  historyCard: {
    marginTop: 14,
    borderRadius: theme.shape.cardRadiusLg,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(241,233,221,0.94)",
    padding: 14
  },
  historyKicker: {
    color: theme.colors.textSecondary,
    /* textTransform: "uppercase", */
    fontWeight: "800",
    fontSize: 11,
    letterSpacing: 0.55
  },
  historyTitle: {
    marginTop: 2,
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontWeight: "800"
  },
  historySubtitle: {
    marginTop: 4,
    color: theme.colors.textSecondary,
    fontWeight: "600"
  },
  historyToggle: {
    marginTop: 10,
    alignSelf: "flex-start",
    borderRadius: theme.shape.pillRadius,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(255,90,31,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  historyToggleText: {
    color: theme.colors.accentStrong,
    fontWeight: "800"
  },
  historyContentWrap: {
    overflow: "hidden"
  },
  darkCard: {
    backgroundColor: theme.darkColors.cardBg,
    borderColor: theme.darkColors.cardBorder
  },
  darkTextPrimary: {
    color: theme.darkColors.textPrimary
  },
  darkText: {
    color: theme.darkColors.textSecondary
  },
  darkDivider: {
    backgroundColor: "rgba(255,255,255,0.1)"
  }
});
