import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ResizeMode } from "expo-av";
import LottieView from "lottie-react-native";

import { trackEvent } from "../../analytics/events";
import { LogoMorphLoader } from "../../components/LogoMorphLoader";
import { LoopingVideoPlayer } from "../../components/LoopingVideoPlayer";
import { SequentialReelPlayer } from "../../components/SequentialReelPlayer";
import { PaywallModal } from "../../components/PaywallModal";
import { ProofReceiptModal } from "../../components/ProofReceiptModal";
import { TactilePressable } from "../../components/TactilePressable";
import { readQuickShareCap, writeQuickShareCap } from "../../storage/revealShareNudgeStorage";
import { theme } from "../../theme";
import type { Clip } from "../../types/clip";
import { triggerMilestoneHaptic, triggerSelectionHaptic } from "../../utils/feedback";
import type { ChapterTrailerMoment } from "../../utils/progress";
import { exportAndSaveReel, exportAndShareReel, prepareReelAsset, resolveReelUri } from "../../utils/reelExport";
import { hasRevealExportPurchase } from "../../utils/purchases";
import { useReducedMotion } from "../../utils/useReducedMotion";
import { ComparisonRevealHeader } from "./ComparisonRevealHeader";
import ReelPreviewScreen from "./ReelPreviewScreen";
import { ThenNowCompareStage } from "./ThenNowCompareStage";

type ComparisonRevealModalProps = {
  visible: boolean;
  comparison: {
    thenClip: Clip;
    nowClip: Clip;
    thenLabel: string;
    nowLabel: string;
  } | null;
  presetLabel: string;
  token: string;
  chapterNumber: number;
  journeyId?: string | null;
  milestoneLengthDays: number;
  progressDays: number;
  currentStreak: number;
  totalPracticeDays: number;
  modalBackdropReveal: Animated.Value;
  modalCardReveal: Animated.Value;
  thenPanelReveal: Animated.Value;
  nowPanelReveal: Animated.Value;
  labelsReveal: Animated.Value;
  sourceRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  pairStrategyLabel?: string | null;
  pairReason?: string | null;
  pairConsistencyScore?: number | null;
  trailerMoments?: ChapterTrailerMoment[] | null;
  allChapterClips?: Clip[] | null;
  storylineHeadline?: string | null;
  storylineCaption?: string | null;
  storylineReflection?: string | null;
  entryStage?: "unlock" | "compare" | "reel";
  nextChapterBusyLength?: number | null;
  chapterActionMessage?: string | null;
  goalText?: string | null;
  onStartNextChapter?: (days: number) => void;
  onClose: () => void;
};

type RevealStage = "unlock" | "opening" | "compare" | "reel" | "summary" | "next_chapter";
type ReelPrepareStatus = "idle" | "preparing" | "ready" | "failed";
type SummaryNudgeState = "prompt_both" | "prompt_save" | "prompt_share" | "complete";
const nextMilestoneOptions = [7, 14, 30, 100] as const;
const revealEasing = {
  outHero: Easing.bezier(0.16, 1, 0.3, 1),
  outCinematic: Easing.bezier(0.19, 1, 0.22, 1),
  inSoft: Easing.bezier(0.4, 0, 1, 1),
  inOutCinematic: Easing.bezier(0.65, 0, 0.35, 1)
};
const presentOpeningAnimation = require("../../motion/present opening.json");
const openingFallbackExtraMs = 7000;
const nextMilestoneCardContent: Record<
  (typeof nextMilestoneOptions)[number],
  { title: string; subtitle: string; payoff: string }
> = {
  7: {
    title: "7-day chapter",
    subtitle: "fast momentum loop",
    payoff: "quick reveal pace to lock consistency."
  },
  14: {
    title: "14-day chapter",
    subtitle: "momentum chapter",
    payoff: "more visible change while keeping feedback tight."
  },
  30: {
    title: "30-day chapter",
    subtitle: "core growth block",
    payoff: "strong balance of consistency and clear transformation."
  },
  100: {
    title: "100-day chapter",
    subtitle: "commitment chapter",
    payoff: "long-arc story for serious practitioners."
  }
};

function getRecommendedNextMilestoneLength(params: {
  chapterNumber: number;
  currentStreak: number;
  milestoneLengthDays: number;
  progressDays: number;
  totalPracticeDays: number;
}) {
  const { chapterNumber, currentStreak, milestoneLengthDays, progressDays, totalPracticeDays } = params;

  // Keep first completion easy so users get another quick win.
  if (chapterNumber <= 1 && totalPracticeDays < 7) return 7;

  // Very established users can opt into deeper chapter scope.
  if ((totalPracticeDays >= 120 && currentStreak >= 30) || milestoneLengthDays >= 100) return 100;

  // Core recommendation for consistent users.
  if (totalPracticeDays >= 30 || currentStreak >= 14 || milestoneLengthDays >= 30) return 30;

  // Standard progression for growing consistency.
  if (totalPracticeDays >= 10 || currentStreak >= 7 || chapterNumber >= 2 || progressDays >= 14) return 14;

  return 7;
}

function getRecommendedNextMilestoneReason(params: {
  recommendedDays: number;
  totalPracticeDays: number;
  currentStreak: number;
}) {
  const { recommendedDays, totalPracticeDays, currentStreak } = params;

  if (recommendedDays === 100) {
    return `you are showing serious consistency. a 100-day chapter fits your rhythm.`;
  }

  if (recommendedDays === 30) {
    if (totalPracticeDays >= 30) {
      return `you have built real momentum. a 30-day chapter will show meaningful growth.`;
    }
    return `your ${currentStreak}-day streak is strong. a 30-day chapter keeps that momentum going.`;
  }

  if (recommendedDays === 14) {
    return "great pacing. a 14-day chapter keeps progress visible without losing speed.";
  }

  return "start with a 7-day chapter to protect momentum and earn your next reveal fast.";
}

export function ComparisonRevealModal({
  visible,
  comparison,
  presetLabel,
  token,
  chapterNumber,
  journeyId = null,
  milestoneLengthDays,
  progressDays,
  currentStreak,
  totalPracticeDays,
  modalBackdropReveal,
  modalCardReveal,
  thenPanelReveal,
  nowPanelReveal,
  labelsReveal,
  sourceRect,
  pairStrategyLabel: _pairStrategyLabel = null,
  pairReason: _pairReason = null,
  pairConsistencyScore: _pairConsistencyScore = null,
  trailerMoments = null,
  allChapterClips = null,
  storylineHeadline = null,
  storylineCaption = null,
  storylineReflection = null,
  entryStage = "unlock",
  nextChapterBusyLength = null,
  chapterActionMessage = null,
  goalText = null,
  onStartNextChapter,
  onClose
}: ComparisonRevealModalProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [compareFocus, setCompareFocus] = useState<"then" | "now">("now");
  const [stage, setStage] = useState<RevealStage>("unlock");
  const [closing, setClosing] = useState(false);
  const [capsuleOpening, setCapsuleOpening] = useState(false);
  const [reelPlaying, setReelPlaying] = useState(true);
  const [reelIndex, setReelIndex] = useState(0);
  const [reelExportMessage, setReelExportMessage] = useState<string | null>(null);
  const [reelExporting, setReelExporting] = useState(false);
  const [reelSaving, setReelSaving] = useState(false);
  const [reelReady, setReelReady] = useState(false);
  const [reelPrepareStatus, setReelPrepareStatus] = useState<ReelPrepareStatus>("idle");
  const [reelShared, setReelShared] = useState(false);
  const [receiptVisible, setReceiptVisible] = useState(false);
  const [receiptPaywallVisible, setReceiptPaywallVisible] = useState(false);
  const [reelSaved, setReelSaved] = useState(false);
  const [quickShareDismissed, setQuickShareDismissed] = useState(false);
  const [quickShareCapLoaded, setQuickShareCapLoaded] = useState(false);
  const [quickShareCapReached, setQuickShareCapReached] = useState(false);
  const [reelPreviewVisible, setReelPreviewVisible] = useState(false);
  const [composedDaySpan, setComposedDaySpan] = useState(0);
  const [composing, setComposing] = useState(false);
  const stageReveal = useRef(new Animated.Value(0)).current;
  const unlockPulse = useRef(new Animated.Value(1)).current;
  const presentOpen = useRef(new Animated.Value(0)).current;
  const backgroundDrift = useRef(new Animated.Value(0)).current;
  const summaryHeroReveal = useRef(new Animated.Value(0)).current;
  const summaryMetricsReveal = useRef(new Animated.Value(0)).current;
  const summaryActionsReveal = useRef(new Animated.Value(0)).current;
  const compareEntryVeil = useRef(new Animated.Value(0)).current;
  const reelTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const openingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stageViewKeyRef = useRef<string | null>(null);
  const summaryNudgeKeyRef = useRef<string | null>(null);
  const quickShareImpressionKeyRef = useRef<string | null>(null);
  const quickShareSuppressedKeyRef = useRef<string | null>(null);
  const openingFinishedRef = useRef(false);
  const duration = (ms: number) => (reducedMotion ? 0 : ms);
  const revealPace = chapterNumber <= 1 ? 1.18 : 0.94;
  const pacedDuration = (ms: number) => duration(Math.round(ms * revealPace));
  const motionDurations = {
    enter: pacedDuration(640),
    openingEnter: pacedDuration(1180),
    stageOut: pacedDuration(260),
    stageIn: pacedDuration(540),
    closePanels: pacedDuration(240),
    closeShell: pacedDuration(560),
    backdrop: pacedDuration(620),
    pulse: pacedDuration(420),
    capsuleOpen: pacedDuration(1220),
    drift: pacedDuration(760)
  };

  const safeHeight = Math.max(560, height - insets.top - insets.bottom);
  const compareVideoHeight = Math.max(320, Math.min(safeHeight - 280, safeHeight * 0.68));
  const reelVideoHeight = Math.max(320, Math.min(safeHeight - 260, safeHeight * 0.68));
  const summaryHeroHeight = Math.max(220, Math.min(safeHeight * 0.4, 340));
  const compareActionsStacked = width < 415;
  const compareDockHorizontalPadding = width >= 430 ? 32 : width >= 390 ? 24 : 20;
  const comparePairGap = width >= 430 ? 18 : 14;
  const comparePrimaryGap = compareActionsStacked ? 14 : width >= 430 ? 24 : 20;
  const compareOverlayTopInset = width >= 430 ? 18 : 14;
  const compareOverlaySideInset = width >= 430 ? 22 : width >= 390 ? 18 : 14;
  const compareOverlayBottomInset = width >= 430 ? 14 : 12;
  const startScaleX = sourceRect ? Math.max(0.34, sourceRect.width / width) : 0.975;
  const startScaleY = sourceRect ? Math.max(0.22, sourceRect.height / height) : 0.975;
  const startTranslateX = sourceRect ? sourceRect.x - ((1 - startScaleX) * width) / 2 : 0;
  const startTranslateY = sourceRect ? sourceRect.y - ((1 - startScaleY) * height) / 2 : 22;
  const cards = useMemo(
    () =>
      comparison
        ? [
            {
              key: "then",
              badge: "before",
              title: comparison.thenLabel,
              clip: comparison.thenClip
            },
            {
              key: "now",
              badge: "now",
              title: comparison.nowLabel,
              clip: comparison.nowClip
            }
          ]
        : [],
    [comparison]
  );
  const reelCards = useMemo(() => {
    if (trailerMoments && trailerMoments.length >= 2) {
      return trailerMoments.map((moment, index) => ({
        key: `trailer-${moment.clip.id}-${index}`,
        badge: moment.label,
        title: moment.label,
        clip: moment.clip
      }));
    }
    return cards;
  }, [trailerMoments, cards]);
  const sequentialReelClips = useMemo(() => {
    if (allChapterClips && allChapterClips.length >= 2) {
      const sorted = [...allChapterClips].sort(
        (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
      );
      return sorted.map((clip, index) => ({
        uri: clip.videoUrl,
        label: `day ${index + 1}`,
        holdMs: index === 0 ? 3000 : index === sorted.length - 1 ? 3000 : 800,
        captureType: clip.captureType,
      }));
    }
    return reelCards.map((entry, index) => ({
      uri: entry.clip.videoUrl,
      label: entry.title.toLowerCase(),
      holdMs: index === 0 ? 3000 : index === reelCards.length - 1 ? 3000 : 800,
      captureType: entry.clip.captureType,
    }));
  }, [allChapterClips, reelCards]);
  const reelMomentsLabel = `${reelCards.length} ${reelCards.length === 1 ? "moment" : "moments"}`;
  const chapterProgressLabel = `${Math.min(progressDays, milestoneLengthDays)} / ${milestoneLengthDays} days`;
  const reelStatsLabel =
    currentStreak > 0 ? `chapter ${chapterNumber} • ${chapterProgressLabel} • ${currentStreak}-day streak` : `chapter ${chapterNumber} • ${chapterProgressLabel}`;

  const summaryClip = comparison?.nowClip ?? reelCards[reelCards.length - 1]?.clip ?? cards[cards.length - 1]?.clip ?? null;
  const reelExportInput = useMemo(
    () => ({
      chapterNumber,
      trailerMoments,
      sourceClips: reelCards.map((entry) => entry.clip),
      fallbackClip: summaryClip,
      milestoneLengthDays,
      progressDays,
      currentStreak,
      storylineHeadline,
      storylineCaption,
      storylineReflection,
      token,
      journeyId
    }),
    [
      chapterNumber,
      trailerMoments,
      reelCards,
      summaryClip,
      milestoneLengthDays,
      progressDays,
      currentStreak,
      storylineHeadline,
      storylineCaption,
      storylineReflection,
      token,
      journeyId
    ]
  );
  const compareExportInput = useMemo(
    () => ({
      chapterNumber,
      trailerMoments: comparison
        ? [
            { clip: comparison.thenClip, label: "THEN" },
            { clip: comparison.nowClip, label: "NOW" }
          ]
        : trailerMoments,
      sourceClips: comparison ? [comparison.thenClip, comparison.nowClip] : reelCards.map((entry) => entry.clip),
      fallbackClip: comparison?.nowClip ?? summaryClip,
      milestoneLengthDays,
      progressDays,
      currentStreak,
      storylineHeadline: storylineHeadline ?? `chapter ${chapterNumber} compare`,
      storylineCaption: storylineCaption ?? "then vs now snapshot",
      storylineReflection: storylineReflection ?? "visible progress from early reps to current form.",
      token,
      journeyId
    }),
    [
      chapterNumber,
      comparison,
      trailerMoments,
      reelCards,
      summaryClip,
      milestoneLengthDays,
      progressDays,
      currentStreak,
      storylineHeadline,
      storylineCaption,
      storylineReflection,
      token,
      journeyId
    ]
  );
  const summaryReadyLabel =
    reelPrepareStatus === "ready"
      ? "reel ready."
      : reelPrepareStatus === "failed"
        ? "reel prep failed. retry or export directly."
        : "preparing reel...";
  const summaryNudgeState: SummaryNudgeState = reelShared ? (reelSaved ? "complete" : "prompt_save") : reelSaved ? "prompt_share" : "prompt_both";
  const summaryNudgeCopy =
    summaryNudgeState === "complete"
      ? "reel shared and saved."
      : summaryNudgeState === "prompt_save"
        ? "great share. save a copy to your library."
        : summaryNudgeState === "prompt_share"
          ? "nice save. share your progress with someone."
          : "share or save this reel to lock in the chapter win.";
  const showQuickShareCta =
    quickShareCapLoaded && !quickShareCapReached && reelPrepareStatus === "ready" && !reelShared && !quickShareDismissed;
  const shareButtonLabel = reelExporting ? "preparing..." : reelShared ? "share again" : "share reel";
  const saveButtonLabel = reelSaving ? "saving..." : reelSaved ? "saved to library" : "save reel";
  const compareSaveLabel = reelSaving ? "saving..." : reelSaved ? "saved snapshot" : "save snapshot";
  const analyticsBase = useMemo(
    () => ({
      journeyId,
      chapterNumber,
      milestoneLengthDays,
      progressDays,
      currentStreak,
      totalPracticeDays,
      entryStage,
      presetLabel,
      trailerMomentCount: trailerMoments?.length ?? 0
    }),
    [
      journeyId,
      chapterNumber,
      milestoneLengthDays,
      progressDays,
      currentStreak,
      totalPracticeDays,
      entryStage,
      presetLabel,
      trailerMoments
    ]
  );

  useEffect(() => {
    if (!visible) return;
    setCompareFocus("now");
    setStage(entryStage === "unlock" ? "unlock" : entryStage === "reel" ? "reel" : "compare");
    setClosing(false);
    setCapsuleOpening(false);
    setReelPlaying(true);
    setReelIndex(0);
    setReelExportMessage(null);
    setReelExporting(false);
    setReelSaving(false);
    setReelReady(false);
    setReelPrepareStatus("idle");
    setReelShared(false);
    setReelSaved(false);
    setQuickShareDismissed(false);
    setQuickShareCapLoaded(false);
    setQuickShareCapReached(false);
    setReelPreviewVisible(false);
    openingFinishedRef.current = false;
    if (openingTimerRef.current) {
      clearTimeout(openingTimerRef.current);
      openingTimerRef.current = null;
    }
    stageReveal.setValue(0);
    unlockPulse.setValue(1);
    presentOpen.setValue(0);
    backgroundDrift.setValue(0);
    summaryHeroReveal.setValue(0);
    summaryMetricsReveal.setValue(0);
    summaryActionsReveal.setValue(0);
    compareEntryVeil.setValue(0);
    Animated.timing(stageReveal, {
      toValue: 1,
      duration: motionDurations.enter,
      easing: revealEasing.outHero,
      useNativeDriver: true
    }).start();

    // Auto-reveal reel stage after loading spinner when entryStage is "reel"
    if (entryStage === "reel") {
      setComposing(true);
      setTimeout(() => {
        setComposing(false);
      }, 2200);
    }
  }, [visible, entryStage]);

  useEffect(() => {
    return () => {
      if (reelTimerRef.current) {
        clearInterval(reelTimerRef.current);
        reelTimerRef.current = null;
      }
      if (openingTimerRef.current) {
        clearTimeout(openingTimerRef.current);
        openingTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    void (async () => {
      const capped = await readQuickShareCap({
        journeyId,
        chapterNumber
      });
      if (cancelled) return;
      setQuickShareCapReached(capped);
      setQuickShareCapLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, journeyId, chapterNumber]);

  useEffect(() => {
    if (!visible) {
      stageViewKeyRef.current = null;
      summaryNudgeKeyRef.current = null;
      quickShareImpressionKeyRef.current = null;
      quickShareSuppressedKeyRef.current = null;
      return;
    }
    const stageViewKey = `${chapterNumber}:${stage}`;
    if (stageViewKeyRef.current === stageViewKey) return;
    stageViewKeyRef.current = stageViewKey;
    trackEvent("comparison_reveal_stage_viewed", {
      ...analyticsBase,
      stage,
      compareCardCount: cards.length,
      reelCardCount: reelCards.length
    });
  }, [visible, stage, chapterNumber, analyticsBase, cards.length, reelCards.length]);

  useEffect(() => {
    if (!visible || stage !== "summary") return;
    const key = `${chapterNumber}:${summaryNudgeState}`;
    if (summaryNudgeKeyRef.current === key) return;
    summaryNudgeKeyRef.current = key;
    trackEvent("reel_summary_nudge_viewed", {
      ...analyticsBase,
      summaryNudgeState,
      reelShared,
      reelSaved
    });
  }, [visible, stage, chapterNumber, summaryNudgeState, reelShared, reelSaved, analyticsBase]);

  useEffect(() => {
    if (!visible || stage !== "summary" || !showQuickShareCta) return;
    const key = `${journeyId ?? "none"}:${chapterNumber}:${reelPrepareStatus}:${reelShared}:${reelSaved}`;
    if (quickShareImpressionKeyRef.current === key) return;
    quickShareImpressionKeyRef.current = key;
    trackEvent("reel_quick_share_impression", {
      ...analyticsBase,
      reelSaved,
      trigger: "summary_ready_unshared"
    });
    void writeQuickShareCap({
      journeyId,
      chapterNumber
    });
  }, [visible, stage, showQuickShareCta, journeyId, chapterNumber, reelPrepareStatus, reelShared, reelSaved, analyticsBase]);

  useEffect(() => {
    if (!visible || stage !== "summary" || !quickShareCapLoaded || !quickShareCapReached || reelShared) return;
    const key = `${journeyId ?? "none"}:${chapterNumber}:cap`;
    if (quickShareSuppressedKeyRef.current === key) return;
    quickShareSuppressedKeyRef.current = key;
    trackEvent("reel_quick_share_suppressed", {
      ...analyticsBase,
      reason: "cap_active",
      reelSaved
    });
  }, [visible, stage, quickShareCapLoaded, quickShareCapReached, reelShared, journeyId, chapterNumber, reelSaved, analyticsBase]);

  useEffect(() => {
    if (!visible) return;
    const target =
      stage === "unlock"
        ? 0
        : stage === "opening"
          ? 0.9
        : stage === "compare"
          ? compareFocus === "then"
            ? 1.6
            : 2
          : stage === "reel"
            ? 2.6
            : 3;
    if (reducedMotion) {
      backgroundDrift.setValue(target);
      return;
    }
    Animated.timing(backgroundDrift, {
      toValue: target,
      duration: motionDurations.drift,
      easing: revealEasing.inOutCinematic,
      useNativeDriver: true
    }).start();
  }, [visible, stage, compareFocus, reducedMotion, backgroundDrift]);

  useEffect(() => {
    if (!visible || stage !== "reel") return;
    let cancelled = false;
    void (async () => {
      const startedAtMs = Date.now();
      trackEvent("reel_prewarm_started", {
        ...analyticsBase,
        summaryClipId: summaryClip?.id ?? null,
        attempt: 1,
        trigger: "reel_stage"
      });
      const result = await prepareReelAsset(reelExportInput);
      if (cancelled) return;
      if (result.success) {
        setReelReady(true);
        setReelPrepareStatus((current) => (current === "idle" ? "ready" : current));
      }
      trackEvent("reel_prewarm_completed", {
        ...analyticsBase,
        summaryClipId: summaryClip?.id ?? null,
        success: result.success,
        code: result.code,
        sourceKind: result.sourceKind,
        cacheHit: result.cacheHit,
        durationMs: Date.now() - startedAtMs,
        attempt: 1,
        trigger: "reel_stage"
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, stage, chapterNumber, summaryClip?.id, analyticsBase, reelExportInput]);

  useEffect(() => {
    if (!visible || stage !== "summary") return;
    if (reelReady && reelPrepareStatus === "ready") return;
    let cancelled = false;
    setReelPrepareStatus("preparing");
    void (async () => {
      const maxAttempts = 2;
      let attempt = 0;
      let finalResult: Awaited<ReturnType<typeof prepareReelAsset>> | null = null;
      while (attempt < maxAttempts) {
        attempt += 1;
        const startedAtMs = Date.now();
        trackEvent("reel_prewarm_started", {
          ...analyticsBase,
          summaryClipId: summaryClip?.id ?? null,
          attempt,
          trigger: "summary_auto"
        });
        const result = await prepareReelAsset(reelExportInput);
        if (cancelled) return;
        trackEvent("reel_prewarm_completed", {
          ...analyticsBase,
          summaryClipId: summaryClip?.id ?? null,
          success: result.success,
          code: result.code,
          sourceKind: result.sourceKind,
          cacheHit: result.cacheHit,
          durationMs: Date.now() - startedAtMs,
          attempt,
          trigger: "summary_auto"
        });
        finalResult = result;
        if (result.success || result.code !== "prepare_failed") break;
      }
      if (cancelled || !finalResult) return;
      setReelReady(finalResult.success);
      setReelPrepareStatus(finalResult.success ? "ready" : "failed");
      if (finalResult.success) {
        setReelExportMessage(null);
      } else {
        setReelExportMessage((current) => current ?? finalResult.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, stage, chapterNumber, summaryClip?.id, analyticsBase, reelExportInput]);

  useEffect(() => {
    if (!visible) return;
    if (stage !== "summary") {
      summaryHeroReveal.setValue(0);
      summaryMetricsReveal.setValue(0);
      summaryActionsReveal.setValue(0);
      return;
    }
    if (reducedMotion) {
      summaryHeroReveal.setValue(1);
      summaryMetricsReveal.setValue(1);
      summaryActionsReveal.setValue(1);
      return;
    }
    summaryHeroReveal.setValue(0);
    summaryMetricsReveal.setValue(0);
    summaryActionsReveal.setValue(0);
    Animated.stagger(pacedDuration(140), [
      Animated.timing(summaryHeroReveal, {
        toValue: 1,
        duration: pacedDuration(920),
        easing: revealEasing.outCinematic,
        useNativeDriver: true
      }),
      Animated.timing(summaryMetricsReveal, {
        toValue: 1,
        duration: pacedDuration(760),
        easing: revealEasing.outCinematic,
        useNativeDriver: true
      }),
      Animated.timing(summaryActionsReveal, {
        toValue: 1,
        duration: pacedDuration(680),
        easing: revealEasing.outCinematic,
        useNativeDriver: true
      })
    ]).start();
  }, [stage, visible, reducedMotion, summaryHeroReveal, summaryMetricsReveal, summaryActionsReveal, chapterNumber]);

  useEffect(() => {
    if (stage !== "reel" || !visible || !reelCards.length || !reelPlaying) {
      if (reelTimerRef.current) {
        clearInterval(reelTimerRef.current);
        reelTimerRef.current = null;
      }
      return;
    }
    reelTimerRef.current = setInterval(() => {
      setReelIndex((current) => (current + 1) % reelCards.length);
    }, 2000);
    return () => {
      if (reelTimerRef.current) {
        clearInterval(reelTimerRef.current);
        reelTimerRef.current = null;
      }
    };
  }, [stage, visible, reelCards.length, reelPlaying]);

  useEffect(() => {
    if (!visible) return;
    if (stage !== "unlock") return;
    if (reducedMotion) {
      unlockPulse.setValue(1);
      return;
    }

    unlockPulse.setValue(0.98);
    Animated.sequence([
      Animated.timing(unlockPulse, {
        toValue: 1.035,
        duration: motionDurations.pulse,
        easing: revealEasing.outHero,
        useNativeDriver: true
      }),
      Animated.timing(unlockPulse, {
        toValue: 1,
        duration: motionDurations.pulse,
        easing: revealEasing.inOutCinematic,
        useNativeDriver: true
      })
    ]).start();
  }, [stage, visible, reducedMotion]);

  const headerReveal = Animated.multiply(modalCardReveal, thenPanelReveal);

  function transitionToStage(next: RevealStage) {
    if (stage === next || closing) return;
    if (reducedMotion) {
      setStage(next);
      return;
    }

    Animated.timing(stageReveal, {
      toValue: 0,
      duration: motionDurations.stageOut,
      easing: revealEasing.inSoft,
      useNativeDriver: true
    }).start(() => {
      setStage(next);
      stageReveal.setValue(0);
      Animated.timing(stageReveal, {
        toValue: 1,
        duration: motionDurations.stageIn,
        easing: revealEasing.outHero,
        useNativeDriver: true
      }).start();
    });
  }

  function handleCloseRequest() {
    if (closing) return;
    trackEvent("comparison_reveal_closed", {
      ...analyticsBase,
      stage,
      reelReady,
      reelPrepareStatus,
      reelShared,
      reelSaved,
      hadExportMessage: Boolean(reelExportMessage)
    });
    setClosing(true);

    Animated.sequence([
      Animated.parallel([
        Animated.timing(labelsReveal, {
          toValue: 0,
          duration: motionDurations.closePanels,
          easing: revealEasing.inSoft,
          useNativeDriver: true
        }),
        Animated.timing(nowPanelReveal, {
          toValue: 0,
          duration: motionDurations.closePanels,
          easing: revealEasing.inSoft,
          useNativeDriver: true
        }),
        Animated.timing(thenPanelReveal, {
          toValue: 0,
          duration: motionDurations.closePanels,
          easing: revealEasing.inSoft,
          useNativeDriver: true
        })
      ]),
      Animated.parallel([
        Animated.timing(modalCardReveal, {
          toValue: 0,
          duration: motionDurations.closeShell,
          easing: revealEasing.inSoft,
          useNativeDriver: true
        }),
        Animated.timing(modalBackdropReveal, {
          toValue: 0,
          duration: motionDurations.backdrop,
          easing: revealEasing.inSoft,
          useNativeDriver: true
        })
      ])
    ]).start(({ finished }) => {
      setClosing(false);
      if (finished) {
        onClose();
      }
    });
  }

  async function handleSharePress(actionSurface: "summary_primary" | "summary_quick" | "reel_primary" | "unlock_primary" | "compare_primary") {
    if (reelExporting || reelSaving) return;
    if (actionSurface === "summary_quick") {
      setQuickShareDismissed(true);
      trackEvent("reel_quick_share_clicked", {
        ...analyticsBase,
        reelSaved
      });
    }
    triggerSelectionHaptic();
    const startedAtMs = Date.now();
    trackEvent("reel_share_started", {
      ...analyticsBase,
      reelReady,
      actionSurface
    });
    setReelExporting(true);
    const exportInput = actionSurface === "compare_primary" ? compareExportInput : reelExportInput;
    const result = await exportAndShareReel(exportInput);
    setReelExportMessage(result.message);
    setReelExporting(false);
    if (result.success) {
      setReelShared(true);
      trackEvent("reveal_shared", {
        ...analyticsBase,
        reelReady,
        sourceKind: result.sourceKind,
        cacheHit: result.cacheHit,
        actionSurface
      });
    }
    trackEvent("reel_share_completed", {
      ...analyticsBase,
      reelReady,
      success: result.success,
      code: result.code,
      sourceKind: result.sourceKind,
      cacheHit: result.cacheHit,
      durationMs: Date.now() - startedAtMs,
      actionSurface
    });
  }

  async function handleSavePress(actionSurface: "summary_primary" | "compare_primary") {
    if (reelExporting || reelSaving) return;
    triggerSelectionHaptic();
    const startedAtMs = Date.now();
    trackEvent("reel_save_started", {
      ...analyticsBase,
      reelReady,
      actionSurface
    });
    setReelSaving(true);
    const exportInput = actionSurface === "compare_primary" ? compareExportInput : reelExportInput;
    const result = await exportAndSaveReel(exportInput);
    setReelExportMessage(result.message);
    setReelSaving(false);
    if (result.success) {
      setReelSaved(true);
      trackEvent("reveal_saved", {
        ...analyticsBase,
        reelReady,
        sourceKind: result.sourceKind,
        cacheHit: result.cacheHit,
        actionSurface
      });
    }
    trackEvent("reel_save_completed", {
      ...analyticsBase,
      reelReady,
      success: result.success,
      code: result.code,
      sourceKind: result.sourceKind,
      cacheHit: result.cacheHit,
      durationMs: Date.now() - startedAtMs,
      actionSurface
    });
  }

  function finishOpeningToCompare() {
    if (openingFinishedRef.current) return;
    openingFinishedRef.current = true;
    if (openingTimerRef.current) {
      clearTimeout(openingTimerRef.current);
      openingTimerRef.current = null;
    }
    if (!visible || closing) return;
    setCapsuleOpening(false);
    presentOpen.setValue(0);
    compareEntryVeil.setValue(1);
    Animated.timing(stageReveal, {
      toValue: 0,
      duration: pacedDuration(360),
      easing: revealEasing.inSoft,
      useNativeDriver: true
    }).start(() => {
      setStage("compare");
      stageReveal.setValue(0);
      Animated.parallel([
        Animated.timing(stageReveal, {
          toValue: 1,
          duration: pacedDuration(680),
          easing: revealEasing.outCinematic,
          useNativeDriver: true
        }),
        Animated.timing(compareEntryVeil, {
          toValue: 0,
          duration: pacedDuration(760),
          easing: revealEasing.outCinematic,
          useNativeDriver: true
        })
      ]).start();
    });
  }

  function handleOpenRevealPress() {
    if (capsuleOpening || closing) return;
    triggerMilestoneHaptic();
    if (reducedMotion) {
      transitionToStage("compare");
      return;
    }
    setCapsuleOpening(true);
    setStage("opening");
    openingFinishedRef.current = false;
    stageReveal.setValue(0);
    presentOpen.setValue(0);
    if (openingTimerRef.current) {
      clearTimeout(openingTimerRef.current);
      openingTimerRef.current = null;
    }
    openingTimerRef.current = setTimeout(() => {
      finishOpeningToCompare();
    }, Math.max(1200, motionDurations.capsuleOpen + 220 + openingFallbackExtraMs));

    Animated.parallel([
      Animated.timing(stageReveal, {
        toValue: 1,
        duration: motionDurations.openingEnter,
        easing: revealEasing.outCinematic,
        useNativeDriver: true
      }),
      Animated.timing(presentOpen, {
        toValue: 1,
        duration: motionDurations.capsuleOpen,
        easing: revealEasing.inOutCinematic,
        useNativeDriver: true
      })
    ]).start();
  }

  const stageTitle =
    stage === "unlock"
      ? `chapter ${chapterNumber}`
      : stage === "compare"
        ? "before vs now"
      : stage === "reel"
        ? "reveal reel"
      : stage === "summary"
        ? "chapter complete"
        : stage === "next_chapter"
          ? "next chapter"
          : presetLabel;
  const stageSubtitle = null;
  const canStartNextChapter = typeof onStartNextChapter === "function";
  const recommendedNextLength = useMemo(
    () =>
      getRecommendedNextMilestoneLength({
        chapterNumber,
        currentStreak,
        milestoneLengthDays,
        progressDays,
        totalPracticeDays
      }),
    [chapterNumber, currentStreak, milestoneLengthDays, progressDays, totalPracticeDays]
  );
  const recommendedNextReason = useMemo(
    () =>
      getRecommendedNextMilestoneReason({
        recommendedDays: recommendedNextLength,
        totalPracticeDays,
        currentStreak
      }),
    [recommendedNextLength, totalPracticeDays, currentStreak]
  );

  return (
    <>
    <Modal visible={visible} animationType="none" transparent onRequestClose={handleCloseRequest}>
      {entryStage === "reel" && composing ? (
        <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: "#f4efe6", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <LogoMorphLoader size={100} color="#E8450A" duration={900} />
        </View>
      ) : null}
      <Animated.View style={[styles.compareModalBackdrop, { opacity: modalBackdropReveal }, entryStage === "reel" ? { display: "none" } : null]}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.parallaxOrbA,
            {
              opacity: backgroundDrift.interpolate({
                inputRange: [0, 3],
                outputRange: [0.32, 0.2]
              }),
              transform: [
                {
                  translateX: backgroundDrift.interpolate({
                    inputRange: [0, 3],
                    outputRange: [-18, 24]
                  })
                },
                {
                  translateY: backgroundDrift.interpolate({
                    inputRange: [0, 3],
                    outputRange: [-16, 20]
                  })
                },
                {
                  scale: backgroundDrift.interpolate({
                    inputRange: [0, 3],
                    outputRange: [1, 1.08]
                  })
                }
              ]
            }
          ]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.parallaxOrbB,
            {
              opacity: backgroundDrift.interpolate({
                inputRange: [0, 3],
                outputRange: [0.2, 0.3]
              }),
              transform: [
                {
                  translateX: backgroundDrift.interpolate({
                    inputRange: [0, 3],
                    outputRange: [24, -30]
                  })
                },
                {
                  translateY: backgroundDrift.interpolate({
                    inputRange: [0, 3],
                    outputRange: [12, -18]
                  })
                },
                {
                  scale: backgroundDrift.interpolate({
                    inputRange: [0, 3],
                    outputRange: [1, 1.1]
                  })
                }
              ]
            }
          ]}
        />
        <Pressable style={StyleSheet.absoluteFill} onPress={handleCloseRequest} disabled={closing} />
        <Animated.View
          style={[
            styles.compareModalCard,
            {
              paddingTop: Math.max(6, insets.top + 1),
              paddingBottom: Math.max(14, insets.bottom + 8),
              opacity: modalCardReveal,
              transform: [
                {
                  translateX: modalCardReveal.interpolate({
                    inputRange: [0, 1],
                    outputRange: [startTranslateX, 0]
                  })
                },
                {
                  translateY: modalCardReveal.interpolate({
                    inputRange: [0, 1],
                    outputRange: [startTranslateY, 0]
                  })
                },
                {
                  scaleX: modalCardReveal.interpolate({
                    inputRange: [0, 1],
                    outputRange: [startScaleX, 1]
                  })
                },
                {
                  scaleY: modalCardReveal.interpolate({
                    inputRange: [0, 1],
                    outputRange: [startScaleY, 1]
                  })
                },
                {
                  scale: modalCardReveal.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.975, 1]
                  })
                }
              ]
            }
          ]}
        >
          {stage !== "opening" && stage !== "compare" ? (
            <Animated.View
              style={[
                styles.headerWrap,
                {
                  opacity: headerReveal,
                  transform: [
                    {
                      translateY: thenPanelReveal.interpolate({
                        inputRange: [0, 1],
                        outputRange: [10, 0]
                      })
                    }
                  ]
                }
              ]}
            >
              <ComparisonRevealHeader title={stageTitle} subtitle={stageSubtitle} closing={closing} onClose={handleCloseRequest} />
            </Animated.View>
          ) : null}

          <Animated.View
            style={[
              styles.stageWrap,
              {
                opacity: stageReveal,
                transform: [
                  {
                    translateY: stageReveal.interpolate({
                      inputRange: [0, 1],
                      outputRange: [12, 0]
                    })
                  }
                ]
              }
            ]}
          >
            {stage === "unlock" ? (
              <Animated.View style={[styles.unlockCard, { transform: [{ scale: unlockPulse }] }]}>
                <Text style={styles.unlockKicker}>chapter {chapterNumber}</Text>
                <Text style={styles.unlockTitle}>your reveal is live.</Text>
                <Text style={styles.unlockMeta}>{storylineCaption ?? "play it and review your arc."}</Text>
                <View style={styles.unlockActionRow}>
                  <TactilePressable
                    stretch
                    style={[styles.unlockButton, capsuleOpening ? styles.unlockButtonDisabled : undefined]}
                    pressScale={0.974}
                    onPress={handleOpenRevealPress}
                    disabled={capsuleOpening}
                  >
                    <Text style={styles.unlockButtonText}>{capsuleOpening ? "opening..." : "play reveal"}</Text>
                  </TactilePressable>
                  <TactilePressable
                    stretch
                    style={[styles.unlockShareButton, reelExporting || reelSaving ? styles.unlockButtonDisabled : undefined]}
                    pressScale={0.974}
                    onPress={() => {
                      void handleSharePress("unlock_primary");
                    }}
                    disabled={reelExporting || reelSaving}
                  >
                    <Text style={styles.unlockShareButtonText}>{reelExporting ? "preparing..." : "share reveal"}</Text>
                  </TactilePressable>
                </View>
                {reelExportMessage ? <Text style={styles.unlockExportMessage}>{reelExportMessage}</Text> : null}
              </Animated.View>
            ) : null}

            {stage === "opening" ? (
              <View style={styles.openingStage}>
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.openingVeil,
                    {
                      opacity: presentOpen.interpolate({
                        inputRange: [0, 0.7, 1],
                        outputRange: [0.96, 0.4, 0]
                      })
                    }
                  ]}
                />
                <Animated.View
                  style={[
                    styles.openingAnimationShell,
                    {
                      opacity: presentOpen.interpolate({
                        inputRange: [0, 0.15, 1],
                        outputRange: [0, 1, 1]
                      }),
                      transform: [
                        {
                          translateY: presentOpen.interpolate({
                            inputRange: [0, 1],
                            outputRange: [56, 0]
                          })
                        },
                        {
                          scale: presentOpen.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.97, 1.04]
                          })
                        }
                      ]
                    }
                  ]}
                >
                  <View pointerEvents="none" style={styles.openingAmbientGlow} />
                  <LottieView
                    source={presentOpeningAnimation}
                    autoPlay
                    loop={false}
                    speed={0.92}
                    style={styles.openingAnimation}
                    onAnimationFinish={(isCancelled) => {
                      if (!isCancelled) {
                        finishOpeningToCompare();
                      }
                    }}
                  />
                </Animated.View>
              </View>
            ) : null}

            {stage === "compare" && cards.length ? (
              <View style={styles.compareStage}>
                <View style={[styles.compareMediaSurface, { height: compareVideoHeight }]}>
                  <ThenNowCompareStage
                    thenClip={comparison?.thenClip ?? cards[0].clip}
                    nowClip={comparison?.nowClip ?? cards[cards.length - 1].clip}
                    thenLabel={comparison?.thenLabel ?? cards[0].title}
                    nowLabel={comparison?.nowLabel ?? cards[cards.length - 1].title}
                    onFocusChange={setCompareFocus}
                    videoHeight={compareVideoHeight}
                    overlayTopInset={compareOverlayTopInset}
                    overlaySideInset={compareOverlaySideInset}
                    overlayBottomInset={compareOverlayBottomInset}
                    visible={visible && stage === "compare"}
                    contentReveal={nowPanelReveal}
                  />
                  <Animated.View pointerEvents="none" style={[styles.compareEntryVeil, { opacity: compareEntryVeil }]} />
                  <TactilePressable
                    style={[
                      styles.compareDoneOverlayButton,
                      {
                        top: compareOverlayTopInset,
                        right: compareOverlaySideInset
                      },
                      closing ? styles.compareDoneOverlayButtonDisabled : undefined
                    ]}
                    pressScale={0.97}
                    onPress={handleCloseRequest}
                    disabled={closing}
                  >
                    <Text style={styles.compareDoneOverlayText}>done</Text>
                  </TactilePressable>
                </View>
                <Animated.View
                  style={[
                    styles.compareControlsDock,
                    {
                      paddingHorizontal: compareDockHorizontalPadding,
                      paddingBottom: Math.max(20, insets.bottom + 14),
                      opacity: labelsReveal,
                      transform: [
                        {
                          translateY: labelsReveal.interpolate({
                            inputRange: [0, 1],
                            outputRange: [10, 0]
                          })
                        }
                      ]
                    }
                  ]}
                >
                  <View style={[styles.compareActionRow, compareActionsStacked ? styles.compareActionRowStacked : null]}>
                    <TactilePressable
                      stretch
                      style={[
                        styles.compareShareButton,
                        compareActionsStacked ? styles.compareActionButtonStacked : null,
                        reelExporting || reelSaving ? styles.summaryExportButtonDisabled : undefined
                      ]}
                      pressScale={0.972}
                      onPress={() => {
                        void handleSharePress("compare_primary");
                      }}
                      disabled={reelExporting || reelSaving}
                    >
                      <Text style={styles.compareShareButtonText}>{reelExporting ? "preparing..." : "share compare"}</Text>
                    </TactilePressable>
                    <View
                      style={
                        compareActionsStacked
                          ? styles.compareStackedButtonSpacer
                          : [styles.comparePairButtonSpacer, { width: comparePairGap }]
                      }
                    />
                    <TactilePressable
                      stretch
                      style={[
                        styles.compareSaveButton,
                        compareActionsStacked ? styles.compareActionButtonStacked : null,
                        reelExporting || reelSaving ? styles.summaryExportButtonDisabled : undefined
                      ]}
                      pressScale={0.972}
                      onPress={() => {
                        void handleSavePress("compare_primary");
                      }}
                      disabled={reelExporting || reelSaving}
                    >
                      <Text style={styles.compareSaveButtonText}>{compareSaveLabel}</Text>
                    </TactilePressable>
                  </View>
                  <TactilePressable
                    stretch
                    style={[styles.compareContinueFloating, { marginTop: comparePrimaryGap }]}
                    pressScale={0.972}
                    onPress={() => {
                      if (composing) return;
                      triggerSelectionHaptic();
                      setComposing(true);
                      setReelExportMessage(null);
                      void (async () => {
                        try {
                          const uri = await resolveReelUri(reelExportInput);
                          if (!uri) {
                            setReelExportMessage("couldn't prepare reel. try again.");
                            setComposing(false);
                            return;
                          }
                          setComposedDaySpan(progressDays);
                          setReelPreviewVisible(true);
                          setComposing(false);
                        } catch (err) {
                          if (__DEV__) console.error("[ComparisonReveal] Reel resolve error:", err);
                          setReelExportMessage("something went wrong. try again.");
                          setComposing(false);
                        }
                      })();
                    }}
                    disabled={composing}
                  >
                    <Text style={styles.compareContinueFloatingText}>
                      {composing ? "loading..." : "open reel"}
                    </Text>
                  </TactilePressable>
                  {reelExportMessage ? <Text style={styles.reelExportMessage}>{reelExportMessage}</Text> : null}
                </Animated.View>
              </View>
            ) : null}

            {stage === "reel" && reelCards.length ? (
              <View style={styles.reelStage}>
                <View style={styles.reelVideoWrap}>
                  <SequentialReelPlayer
                    clips={sequentialReelClips}
                    style={[styles.reelVideo, { height: reelVideoHeight }]}
                    loop
                    muted={false}
                    autoPlay={reelPlaying}
                  />
                </View>

                <Animated.View style={[styles.reelControlsWrap, { opacity: labelsReveal }]}>
                  <View style={styles.reelMetaRow}>
                    <Text style={styles.reelMetaPill}>auto trailer</Text>
                    <Text style={styles.reelMetaCopy}>{reelMomentsLabel}</Text>
                  </View>
                  <Text style={styles.reelStatsCopy}>{reelStatsLabel}</Text>
                  <View style={styles.reelIndicatorRow}>
                    {reelCards.map((entry, index) => (
                      <View key={`reel-${entry.key}`} style={styles.reelIndicatorShell}>
                        <View style={[styles.reelIndicatorFill, index === reelIndex ? styles.reelIndicatorFillActive : undefined]} />
                      </View>
                    ))}
                  </View>
                  <View style={styles.reelActionRow}>
                    <TactilePressable
                      stretch
                      style={[styles.reelShareButton, reelExporting || reelSaving ? styles.summaryExportButtonDisabled : undefined]}
                      pressScale={0.972}
                      onPress={() => {
                        void handleSharePress("reel_primary");
                      }}
                      disabled={reelExporting || reelSaving}
                    >
                      <Text style={styles.reelShareButtonText}>{shareButtonLabel}</Text>
                    </TactilePressable>
                    <TactilePressable
                      stretch
                      style={styles.reelContinueButton}
                      pressScale={0.972}
                      onPress={() => {
                        triggerSelectionHaptic();
                        onClose();
                      }}
                    >
                      <Text style={styles.reelContinueButtonText}>done</Text>
                    </TactilePressable>
                  </View>
                  {reelExportMessage ? <Text style={styles.reelExportMessage}>{reelExportMessage}</Text> : null}
                </Animated.View>
              </View>
            ) : null}

            {stage === "summary" ? (
              <Animated.ScrollView
                style={styles.summaryStage}
                contentContainerStyle={[styles.summaryContent, { paddingBottom: Math.max(18, insets.bottom + 10) }]}
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                <Animated.View
                  style={[
                    styles.summaryHeroMotion,
                    {
                      opacity: summaryHeroReveal,
                      transform: [
                        {
                          translateY: summaryHeroReveal.interpolate({
                            inputRange: [0, 1],
                            outputRange: [18, 0]
                          })
                        },
                        {
                          scale: summaryHeroReveal.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.985, 1]
                          })
                        }
                      ]
                    }
                  ]}
                >
                  <View style={[styles.summaryHeroWrap, { height: summaryHeroHeight }]}>
                    {summaryClip ? (
                      <LoopingVideoPlayer
                        uri={summaryClip.videoUrl}
                        mediaType={summaryClip.captureType}
                        posterUri={summaryClip.thumbnailUrl}
                        style={styles.summaryHeroVideo}
                        resizeMode={ResizeMode.COVER}
                        showControls={false}
                        muted
                        autoPlay
                        active
                        loop
                      />
                    ) : (
                      <View style={styles.summaryHeroFallback} />
                    )}
                    <View pointerEvents="none" style={styles.summaryHeroShade} />
                    <View pointerEvents="none" style={styles.summaryHeroTextWrap}>
                      <Text style={styles.summaryHeroKicker}>chapter {chapterNumber} complete</Text>
                      <Text style={styles.summaryHeroTitle}>you built this.</Text>
                    </View>
                  </View>
                </Animated.View>

                <Animated.View
                  style={[
                    styles.summaryMetricsMotion,
                    {
                      opacity: summaryMetricsReveal,
                      transform: [
                        {
                          translateY: summaryMetricsReveal.interpolate({
                            inputRange: [0, 1],
                            outputRange: [14, 0]
                          })
                        }
                      ]
                    }
                  ]}
                >
                  <View style={styles.summaryMetricsRow}>
                    <View style={styles.summaryMetricPill}>
                      <Text style={styles.summaryMetricLabel}>practices</Text>
                      <Text style={styles.summaryMetricValue}>
                        {Math.min(progressDays, milestoneLengthDays)} / {milestoneLengthDays}
                      </Text>
                    </View>
                    <View style={styles.summaryMetricPill}>
                      <Text style={styles.summaryMetricLabel}>streak</Text>
                      <Text style={styles.summaryMetricValue}>{currentStreak} days</Text>
                    </View>
                  </View>
                </Animated.View>

                <Animated.View
                  style={[
                    styles.summaryActionsMotion,
                    {
                      opacity: summaryActionsReveal,
                      transform: [
                        {
                          translateY: summaryActionsReveal.interpolate({
                            inputRange: [0, 1],
                            outputRange: [16, 0]
                          })
                        }
                      ]
                    }
                  ]}
                >
                  {storylineHeadline ? <Text style={styles.summaryStorylineHeadline}>{storylineHeadline}</Text> : null}
                  <Text style={styles.summaryCopy}>{storylineReflection ?? "you showed up. the change is real."}</Text>
                  <Text style={styles.summaryTrailerLine}>reel cut ready: then {"->"} moments {"->"} now ({reelMomentsLabel}).</Text>
                  <Text style={styles.summaryReadyLine}>{summaryReadyLabel}</Text>
                  <Text style={[styles.summaryNudgeLine, summaryNudgeState === "complete" ? styles.summaryNudgeLineDone : undefined]}>
                    {summaryNudgeCopy}
                  </Text>
                  {showQuickShareCta ? (
                    <View style={styles.quickShareCard}>
                      <Text style={styles.quickShareTitle}>reel ready now</Text>
                      <Text style={styles.quickShareCopy}>share this chapter in one tap while momentum is high.</Text>
                      <View style={styles.quickShareActionsRow}>
                        <TactilePressable
                          stretch
                          style={[styles.quickShareButton, reelExporting || reelSaving ? styles.summaryExportButtonDisabled : undefined]}
                          pressScale={0.975}
                          onPress={() => {
                            void handleSharePress("summary_quick");
                          }}
                          disabled={reelExporting || reelSaving}
                        >
                          <Text style={styles.quickShareButtonText}>{reelExporting ? "preparing..." : "share fast"}</Text>
                        </TactilePressable>
                        <TactilePressable
                          style={styles.quickShareDismissButton}
                          pressScale={0.98}
                          onPress={() => {
                            setQuickShareDismissed(true);
                            trackEvent("reel_quick_share_dismissed", {
                              ...analyticsBase,
                              reelSaved
                            });
                          }}
                          disabled={reelExporting || reelSaving}
                        >
                          <Text style={styles.quickShareDismissText}>not now</Text>
                        </TactilePressable>
                      </View>
                    </View>
                  ) : null}
                  {reelPrepareStatus === "failed" ? (
                    <TactilePressable
                      stretch
                      style={[
                        styles.summaryRetryButton,
                        reelExporting || reelSaving ? styles.summaryExportButtonDisabled : undefined
                      ]}
                      pressScale={0.975}
                      onPress={async () => {
                        if (reelExporting || reelSaving) return;
                        triggerSelectionHaptic();
                        setReelPrepareStatus("preparing");
                        const startedAtMs = Date.now();
                        trackEvent("reel_prewarm_started", {
                          ...analyticsBase,
                          summaryClipId: summaryClip?.id ?? null,
                          attempt: 1,
                          trigger: "manual_retry"
                        });
                        const result = await prepareReelAsset(reelExportInput);
                        setReelReady(result.success);
                        setReelPrepareStatus(result.success ? "ready" : "failed");
                        setReelExportMessage(result.success ? "reel ready." : result.message);
                        trackEvent("reel_prewarm_completed", {
                          ...analyticsBase,
                          summaryClipId: summaryClip?.id ?? null,
                          success: result.success,
                          code: result.code,
                          sourceKind: result.sourceKind,
                          cacheHit: result.cacheHit,
                          durationMs: Date.now() - startedAtMs,
                          attempt: 1,
                          trigger: "manual_retry"
                        });
                      }}
                      disabled={reelExporting || reelSaving}
                    >
                      <Text style={styles.summaryRetryButtonText}>retry reel prep</Text>
                    </TactilePressable>
                  ) : null}
                  <View style={styles.summaryExportActions}>
                    <TactilePressable
                      stretch
                      style={[
                        styles.summaryExportButton,
                        reelExporting || reelSaving ? styles.summaryExportButtonDisabled : undefined
                      ]}
                      pressScale={0.975}
                      onPress={() => {
                        void handleSharePress("summary_primary");
                      }}
                      disabled={reelExporting || reelSaving}
                    >
                      <Text style={styles.summaryExportButtonText}>{shareButtonLabel}</Text>
                    </TactilePressable>
                    <TactilePressable
                      stretch
                      style={[
                        styles.summarySaveButton,
                        reelSaved ? styles.summarySaveButtonDone : undefined,
                        reelExporting || reelSaving ? styles.summaryExportButtonDisabled : undefined
                      ]}
                      pressScale={0.975}
                      onPress={() => {
                        void handleSavePress("summary_primary");
                      }}
                      disabled={reelExporting || reelSaving}
                    >
                      <Text style={[styles.summarySaveButtonText, reelSaved ? styles.summarySaveButtonTextDone : undefined]}>{saveButtonLabel}</Text>
                    </TactilePressable>
                  </View>
                  <View style={styles.summaryShareStateRow}>
                    <View style={[styles.summaryShareStatePill, reelShared ? styles.summaryShareStatePillDone : undefined]}>
                      <Text style={[styles.summaryShareStateText, reelShared ? styles.summaryShareStateTextDone : undefined]}>
                        {reelShared ? "shared" : "unshared"}
                      </Text>
                    </View>
                    <View style={[styles.summaryShareStatePill, reelSaved ? styles.summaryShareStatePillDone : undefined]}>
                      <Text style={[styles.summaryShareStateText, reelSaved ? styles.summaryShareStateTextDone : undefined]}>
                        {reelSaved ? "saved" : "unsaved"}
                      </Text>
                    </View>
                  </View>
                  <TactilePressable
                    stretch
                    style={styles.receiptButton}
                    pressScale={0.975}
                    onPress={() => {
                      triggerSelectionHaptic();
                      if (hasRevealExportPurchase()) {
                        setReceiptVisible(true);
                      } else {
                        setReceiptPaywallVisible(true);
                      }
                    }}
                  >
                    <Text style={styles.receiptButtonText}>share receipt</Text>
                  </TactilePressable>
                  {reelExportMessage ? <Text style={styles.reelExportMessage}>{reelExportMessage}</Text> : null}
                  {canStartNextChapter ? (
                    <View style={styles.nextChapterSummaryWrap}>
                      <Text style={styles.nextChapterReason}>{recommendedNextReason}</Text>
                      <TactilePressable
                        stretch
                        style={styles.nextChapterOpenButton}
                        pressScale={0.972}
                        onPress={() => {
                          triggerSelectionHaptic();
                          transitionToStage("next_chapter");
                        }}
                      >
                        <Text style={styles.nextChapterOpenButtonText}>choose next chapter</Text>
                      </TactilePressable>
                    </View>
                  ) : null}
                  {chapterActionMessage ? <Text style={styles.chapterActionMessage}>{chapterActionMessage}</Text> : null}
                  <TactilePressable stretch style={styles.summaryDoneButton} pressScale={0.98} onPress={handleCloseRequest}>
                    <Text style={styles.summaryDoneButtonText}>done</Text>
                  </TactilePressable>
                </Animated.View>
              </Animated.ScrollView>
            ) : null}

            {stage === "next_chapter" ? (
              <View style={styles.nextChapterStage}>
                <Text style={styles.nextChapterStageTitle}>start chapter {chapterNumber + 1}</Text>
                <Text style={styles.nextChapterStageSubtitle}>{recommendedNextReason}</Text>

                <View style={styles.nextChapterCardsWrap}>
                  {nextMilestoneOptions.map((days) => {
                    const busy = nextChapterBusyLength === days;
                    const recommended = days === recommendedNextLength;
                    const locked = days > 7 && !hasRevealExportPurchase();
                    const content = nextMilestoneCardContent[days];
                    return (
                      <TactilePressable
                        key={days}
                        style={[
                          styles.nextChapterCard,
                          recommended ? styles.nextChapterCardRecommended : undefined,
                          busy ? styles.nextChapterCardBusy : undefined,
                          locked ? { opacity: 0.4 } : undefined
                        ]}
                        pressScale={0.982}
                        onPress={() => {
                          if (locked) return;
                          onStartNextChapter?.(days);
                        }}
                        disabled={Boolean(nextChapterBusyLength) || locked}
                      >
                        <View style={styles.nextChapterCardTop}>
                          <Text style={[styles.nextChapterCardDays, recommended ? styles.nextChapterCardDaysRecommended : undefined]}>
                            {locked ? `🔒 ${days}` : days} days
                          </Text>
                          {recommended ? <Text style={styles.nextChapterRecommendedPill}>recommended</Text> : null}
                        </View>
                        <Text style={styles.nextChapterCardTitle}>{content.title}</Text>
                        <Text style={styles.nextChapterCardSubtitle}>{content.subtitle}</Text>
                        <Text style={styles.nextChapterCardPayoff}>{busy ? "starting..." : content.payoff}</Text>
                      </TactilePressable>
                    );
                  })}
                </View>

                {chapterActionMessage ? <Text style={styles.chapterActionMessage}>{chapterActionMessage}</Text> : null}

                <TactilePressable
                  stretch
                  style={styles.nextChapterBackButton}
                  pressScale={0.982}
                  onPress={() => {
                    triggerSelectionHaptic();
                    onClose();
                  }}
                  disabled={Boolean(nextChapterBusyLength)}
                >
                  <Text style={styles.nextChapterBackButtonText}>done</Text>
                </TactilePressable>
              </View>
            ) : null}
          </Animated.View>
        </Animated.View>
      </Animated.View>
      <ReelPreviewScreen
        visible={reelPreviewVisible}
        firstClipUri={comparison?.thenClip?.videoUrl ?? null}
        latestClipUri={comparison?.nowClip?.videoUrl ?? null}
        daySpan={composedDaySpan}
        goalText={goalText}
        onClose={() => {
          setReelPreviewVisible(false);
          setTimeout(onClose, 150);
        }}
      />
    </Modal>
    <ProofReceiptModal
      visible={receiptVisible}
      onClose={() => setReceiptVisible(false)}
      skillName={presetLabel ?? "practice"}
      chapterNumber={chapterNumber}
      daysPracticed={progressDays}
      streak={currentStreak}
    />
    <PaywallModal
      visible={receiptPaywallVisible}
      onClose={() => setReceiptPaywallVisible(false)}
      onPurchased={() => {
        setReceiptPaywallVisible(false);
        setReceiptVisible(true);
      }}
    />
    </>
  );
}

const styles = StyleSheet.create({
  compareModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.58)"
  },
  parallaxOrbA: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 999,
    left: -96,
    top: 76,
    backgroundColor: "rgba(255,90,31,0.12)"
  },
  parallaxOrbB: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 999,
    right: -128,
    bottom: 96,
    backgroundColor: "rgba(0,0,0,0.08)"
  },
  compareModalCard: {
    flex: 1,
    backgroundColor: "rgba(246,240,232,0.99)"
  },
  headerWrap: {
    gap: 0
  },
  stageWrap: {
    flex: 1
  },
  unlockCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: theme.shape.cardRadiusLg,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(245,239,230,0.98)",
    padding: 16
  },
  unlockKicker: {
    marginTop: 10,
    color: "#2a2a2a",
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 0.15,
    fontFamily: theme.typography.label
  },
  unlockTitle: {
    marginTop: 6,
    color: "#101010",
    fontWeight: "800",
    fontSize: 30,
    lineHeight: 34,
    fontFamily: theme.typography.display
  },
  unlockMeta: {
    marginTop: 8,
    color: "#2a2a2a",
    fontWeight: "600",
    fontSize: 14,
    fontFamily: theme.typography.body
  },
  unlockActionRow: {
    marginTop: 14,
    flexDirection: "row",
    gap: 10
  },
  unlockButton: {
    flex: 1,
    borderRadius: theme.shape.buttonRadius,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: theme.colors.accent,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12
  },
  unlockButtonDisabled: {
    opacity: 0.66
  },
  unlockButtonText: {
    color: "#101010",
    fontWeight: "800",
    fontSize: 14,
    letterSpacing: 0.15,
    fontFamily: theme.typography.label
  },
  unlockShareButton: {
    flex: 1,
    borderRadius: theme.shape.buttonRadius,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(240,232,220,0.95)",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12
  },
  unlockShareButtonText: {
    color: "#101010",
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 0.15,
    fontFamily: theme.typography.label
  },
  unlockExportMessage: {
    marginTop: 8,
    color: "#2a2a2a",
    fontWeight: "700",
    fontSize: 12
  },
  openingStage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22
  },
  openingVeil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(240,232,220,0.96)"
  },
  openingAnimationShell: {
    width: "116%",
    maxWidth: 460,
    aspectRatio: 1.1,
    borderRadius: 0,
    borderWidth: 0,
    borderColor: "transparent",
    backgroundColor: "transparent",
    overflow: "visible",
    alignItems: "center",
    justifyContent: "center"
  },
  openingAmbientGlow: {
    position: "absolute",
    width: "82%",
    aspectRatio: 1,
    borderRadius: 999,
    backgroundColor: "rgba(255,90,31,0.14)"
  },
  openingAnimation: {
    width: "100%",
    height: "100%"
  },
  compareMetaPill: {
    borderRadius: theme.shape.pillRadius,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(240,232,220,0.95)",
    color: "#101010",
    fontWeight: "800",
    fontSize: 11,
    letterSpacing: 0.15,
    fontFamily: theme.typography.label,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  compareStage: {
    flex: 1,
    paddingTop: 0,
    paddingBottom: 0,
    justifyContent: "flex-start",
    overflow: "hidden"
  },
  compareMediaSurface: {
    width: "100%",
    backgroundColor: "#0c0c0c",
    borderRadius: 0,
    borderWidth: 0,
    borderColor: "transparent",
    padding: 0,
    overflow: "hidden"
  },
  compareTopOverlay: {
    position: "absolute",
    top: 16,
    left: 16
  },
  compareControlsDock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 14,
    paddingHorizontal: 18,
    gap: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(246,240,232,0.98)"
  },
  compareEntryVeil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.16)"
  },
  compareContinueFloating: {
    marginTop: 0,
    borderRadius: theme.shape.pillRadius,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: theme.colors.accent,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 64,
    paddingHorizontal: 28,
    paddingVertical: 16
  },
  compareContinueFloatingText: {
    color: "#101010",
    fontWeight: "800",
    fontSize: 16,
    lineHeight: 23,
    letterSpacing: 0.15,
    fontFamily: theme.typography.label
  },
  compareDoneOverlayButton: {
    position: "absolute",
    top: 12,
    right: 12,
    borderRadius: theme.shape.pillRadius,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(240,232,220,0.95)",
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  compareDoneOverlayButtonDisabled: {
    opacity: 0.62
  },
  compareDoneOverlayText: {
    color: "#101010",
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 0.15,
    fontFamily: theme.typography.label
  },
  compareActionRow: {
    flexDirection: "row",
    alignItems: "stretch"
  },
  compareActionRowStacked: {
    flexDirection: "column"
  },
  comparePairButtonSpacer: {
    width: 14
  },
  compareStackedButtonSpacer: {
    height: 12
  },
  compareActionButtonStacked: {
    minHeight: 58
  },
  compareShareButton: {
    flex: 1,
    borderRadius: theme.shape.pillRadius,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(240,232,220,0.95)",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 64,
    paddingHorizontal: 18,
    paddingVertical: 16
  },
  compareShareButtonText: {
    color: "#101010",
    fontWeight: "800",
    fontSize: 13,
    lineHeight: 20,
    letterSpacing: 0.15,
    fontFamily: theme.typography.label
  },
  compareSaveButton: {
    flex: 1,
    borderRadius: theme.shape.pillRadius,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(240,232,220,0.95)",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 64,
    paddingHorizontal: 18,
    paddingVertical: 16
  },
  compareSaveButtonText: {
    color: "#101010",
    fontWeight: "800",
    fontSize: 13,
    lineHeight: 20,
    letterSpacing: 0.15,
    fontFamily: theme.typography.label
  },
  reelStage: {
    flex: 1,
    marginHorizontal: 18,
    marginTop: 2
  },
  reelVideoWrap: {
    marginTop: 6,
    borderRadius: theme.shape.cardRadiusMd,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(241,233,222,0.95)",
    padding: 8
  },
  reelVideo: {
    width: "100%",
    borderRadius: theme.shape.cardRadiusMd,
    overflow: "hidden",
    backgroundColor: "rgba(235,227,214,0.96)"
  },
  reelControlsWrap: {
    marginTop: 10
  },
  reelMetaRow: {
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  reelMetaPill: {
    borderRadius: theme.shape.pillRadius,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(240,232,220,0.96)",
    color: "#101010",
    fontWeight: "800",
    fontSize: 11,
    letterSpacing: 0.15,
    fontFamily: theme.typography.label,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  reelMetaCopy: {
    color: "#2a2a2a",
    fontWeight: "700",
    fontSize: 12
  },
  reelStatsCopy: {
    marginTop: 2,
    color: "#2a2a2a",
    fontWeight: "700",
    fontSize: 11
  },
  reelIndicatorRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  reelActionRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 10
  },
  reelShareButton: {
    flex: 1,
    borderRadius: theme.shape.pillRadius,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(240,232,220,0.95)",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 58,
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  reelShareButtonText: {
    color: "#101010",
    fontWeight: "800",
    fontSize: 13,
    lineHeight: 20,
    letterSpacing: 0.15,
    fontFamily: theme.typography.label
  },
  reelIndicatorShell: {
    flex: 1,
    height: 4,
    borderRadius: 0,
    backgroundColor: "rgba(0,0,0,0.16)",
    overflow: "hidden"
  },
  reelIndicatorFill: {
    width: "100%",
    height: "100%",
    borderRadius: 0,
    opacity: 0.24,
    backgroundColor: "#4a4a4a"
  },
  reelIndicatorFillActive: {
    opacity: 1,
    backgroundColor: theme.colors.accentStrong
  },
  reelContinueButton: {
    flex: 1,
    borderRadius: theme.shape.pillRadius,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: theme.colors.accent,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 58,
    paddingHorizontal: 28,
    paddingVertical: 15
  },
  reelContinueButtonText: {
    color: "#101010",
    fontWeight: "800",
    fontSize: 16,
    lineHeight: 23,
    letterSpacing: 0.15,
    fontFamily: theme.typography.label
  },
  reelExportMessage: {
    marginTop: 8,
    color: "#2a2a2a",
    fontWeight: "700",
    fontSize: 12
  },
  receiptButton: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    alignItems: "center",
  },
  receiptButtonText: {
    color: "#2a2a2a",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.15,
  },
  summaryStage: {
    flex: 1,
    marginHorizontal: 16,
    marginTop: 10
  },
  summaryContent: {
    paddingBottom: 24
  },
  summaryHeroMotion: {
    width: "100%"
  },
  summaryHeroWrap: {
    width: "100%",
    borderRadius: theme.shape.cardRadiusLg,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    overflow: "hidden",
    backgroundColor: "rgba(241,233,222,0.96)"
  },
  summaryHeroVideo: {
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(235,227,214,0.96)"
  },
  summaryHeroFallback: {
    flex: 1,
    backgroundColor: "rgba(235,227,214,0.96)"
  },
  summaryHeroShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.2)"
  },
  summaryHeroTextWrap: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 14
  },
  summaryHeroKicker: {
    color: "#2a2a2a",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.15,
    fontFamily: theme.typography.label
  },
  summaryHeroTitle: {
    marginTop: 4,
    color: "#101010",
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "800",
    fontFamily: theme.typography.display
  },
  summaryMetricsRow: {
    marginTop: 16,
    flexDirection: "row",
    gap: 12
  },
  summaryMetricsMotion: {
    width: "100%"
  },
  summaryMetricPill: {
    flex: 1,
    borderRadius: theme.shape.cardRadiusMd,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(241,233,222,0.96)",
    paddingHorizontal: 13,
    paddingVertical: 12
  },
  summaryMetricLabel: {
    color: "#2a2a2a",
    fontWeight: "700",
    fontSize: 11,
    letterSpacing: 0.15,
    fontFamily: theme.typography.label
  },
  summaryMetricValue: {
    marginTop: 3,
    color: "#101010",
    fontWeight: "800",
    fontSize: 16
  },
  summaryStorylineHeadline: {
    marginTop: 14,
    color: "#101010",
    fontWeight: "800",
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: 0.15,
    fontFamily: theme.typography.label
  },
  summaryCopy: {
    marginTop: 7,
    color: "#2a2a2a",
    fontWeight: "600",
    lineHeight: 20,
    fontSize: 14
  },
  summaryTrailerLine: {
    marginTop: 5,
    color: "#2a2a2a",
    fontWeight: "700",
    fontSize: 12
  },
  summaryReadyLine: {
    marginTop: 3,
    color: "#2a2a2a",
    fontWeight: "700",
    fontSize: 12
  },
  summaryNudgeLine: {
    marginTop: 4,
    color: "#2a2a2a",
    fontWeight: "600",
    fontSize: 12
  },
  summaryNudgeLineDone: {
    color: theme.colors.success
  },
  quickShareCard: {
    marginTop: 10,
    borderRadius: theme.shape.cardRadiusMd,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(241,233,222,0.96)",
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  quickShareTitle: {
    color: "#101010",
    fontWeight: "800",
    fontSize: 13
  },
  quickShareCopy: {
    marginTop: 3,
    color: "#2a2a2a",
    fontWeight: "600",
    fontSize: 12
  },
  quickShareActionsRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  quickShareButton: {
    flex: 1,
    borderRadius: theme.shape.buttonRadius,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: theme.colors.accent,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 12
  },
  quickShareButtonText: {
    color: "#101010",
    fontWeight: "800",
    fontSize: 13,
    letterSpacing: 0.15,
    fontFamily: theme.typography.label
  },
  quickShareDismissButton: {
    borderRadius: theme.shape.buttonRadius,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(240,232,220,0.95)",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 12
  },
  quickShareDismissText: {
    color: "#101010",
    fontWeight: "700",
    fontSize: 12,
    fontFamily: theme.typography.label,
    letterSpacing: 0.15
  },
  summaryRetryButton: {
    marginTop: 10,
    borderRadius: theme.shape.buttonRadius,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(255,90,31,0.22)",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  summaryRetryButtonText: {
    color: "#101010",
    fontWeight: "700",
    fontSize: 12,
    fontFamily: theme.typography.label,
    letterSpacing: 0.15
  },
  summaryExportActions: {
    marginTop: 14,
    gap: 10
  },
  summaryShareStateRow: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8
  },
  summaryShareStatePill: {
    flex: 1,
    borderRadius: theme.shape.pillRadius,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(240,232,220,0.95)",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 30,
    paddingHorizontal: 10
  },
  summaryShareStatePillDone: {
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(21,122,63,0.24)"
  },
  summaryShareStateText: {
    color: "#2a2a2a",
    fontWeight: "700",
    fontSize: 11
  },
  summaryShareStateTextDone: {
    color: "#0f4a28"
  },
  summaryExportButton: {
    borderRadius: theme.shape.buttonRadius,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(240,232,220,0.95)",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: 18,
    paddingVertical: 12
  },
  summaryExportButtonDisabled: {
    opacity: 0.66
  },
  summaryExportButtonText: {
    color: "#101010",
    fontWeight: "800",
    fontSize: 13,
    fontFamily: theme.typography.label,
    letterSpacing: 0.15
  },
  summarySaveButton: {
    borderRadius: theme.shape.buttonRadius,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(240,232,220,0.95)",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: 18,
    paddingVertical: 12
  },
  summarySaveButtonDone: {
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(21,122,63,0.24)"
  },
  summarySaveButtonText: {
    color: "#101010",
    fontWeight: "800",
    fontSize: 13,
    fontFamily: theme.typography.label,
    letterSpacing: 0.15
  },
  summarySaveButtonTextDone: {
    color: "#0f4a28"
  },
  nextChapterSummaryWrap: {
    marginTop: 16
  },
  summaryActionsMotion: {
    width: "100%"
  },
  nextChapterReason: {
    marginTop: 2,
    color: "#2a2a2a",
    fontWeight: "600",
    fontSize: 12,
    lineHeight: 17
  },
  nextChapterOpenButton: {
    marginTop: 12,
    borderRadius: theme.shape.buttonRadius,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(255,90,31,0.22)",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: 18,
    paddingVertical: 12
  },
  nextChapterOpenButtonText: {
    color: "#101010",
    fontWeight: "800",
    fontSize: 14,
    fontFamily: theme.typography.label,
    letterSpacing: 0.15
  },
  nextChapterStage: {
    flex: 1,
    marginHorizontal: 16,
    marginTop: 12
  },
  nextChapterStageTitle: {
    color: "#101010",
    fontWeight: "800",
    fontSize: 30,
    lineHeight: 34,
    fontFamily: theme.typography.display
  },
  nextChapterStageSubtitle: {
    marginTop: 6,
    color: "#2a2a2a",
    fontWeight: "600",
    lineHeight: 19,
    fontFamily: theme.typography.body
  },
  nextChapterCardsWrap: {
    marginTop: 12,
    gap: 10
  },
  nextChapterCard: {
    borderRadius: theme.shape.cardRadiusMd,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(241,233,222,0.96)",
    padding: 12
  },
  nextChapterCardRecommended: {
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(255,90,31,0.22)"
  },
  nextChapterCardBusy: {
    opacity: 0.66
  },
  nextChapterCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  nextChapterCardDays: {
    color: "#2a2a2a",
    fontWeight: "800",
    fontSize: 13,
    letterSpacing: 0.15,
    fontFamily: theme.typography.label
  },
  nextChapterCardDaysRecommended: {
    color: "#101010"
  },
  nextChapterRecommendedPill: {
    color: "#ea3d00",
    fontWeight: "800",
    fontSize: 11,
    letterSpacing: 0.15,
    fontFamily: theme.typography.label
  },
  nextChapterCardTitle: {
    marginTop: 4,
    color: "#101010",
    fontWeight: "800",
    fontSize: 22,
    lineHeight: 25,
    fontFamily: theme.typography.display
  },
  nextChapterCardSubtitle: {
    marginTop: 2,
    color: "#2a2a2a",
    fontWeight: "600",
    fontFamily: theme.typography.body
  },
  nextChapterCardPayoff: {
    marginTop: 6,
    color: "#2a2a2a",
    fontWeight: "600",
    lineHeight: 18,
    fontFamily: theme.typography.body
  },
  nextChapterBackButton: {
    marginTop: 12,
    marginBottom: 8,
    borderRadius: theme.shape.buttonRadius,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(240,232,220,0.95)",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
    paddingHorizontal: 16,
    paddingVertical: 11
  },
  nextChapterBackButtonText: {
    color: "#101010",
    fontWeight: "800",
    fontSize: 13,
    fontFamily: theme.typography.label,
    letterSpacing: 0.15
  },
  chapterActionMessage: {
    marginTop: 10,
    color: "#2a2a2a",
    fontWeight: "700",
    fontSize: 12
  },
  summaryDoneButton: {
    marginTop: 14,
    borderRadius: theme.shape.buttonRadius,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(240,232,220,0.95)",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: 18,
    paddingVertical: 12
  },
  summaryDoneButtonText: {
    color: "#101010",
    fontWeight: "800",
    fontSize: 13,
    fontFamily: theme.typography.label,
    letterSpacing: 0.15
  }
});
