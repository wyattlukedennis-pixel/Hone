import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import type { ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ResizeMode } from "expo-av";
import LottieView from "lottie-react-native";

import { LoopingVideoPlayer } from "../../components/LoopingVideoPlayer";
import { TactilePressable } from "../../components/TactilePressable";
import { theme } from "../../theme";
import type { Clip } from "../../types/clip";
import { triggerMilestoneHaptic, triggerSelectionHaptic } from "../../utils/feedback";
import { useReducedMotion } from "../../utils/useReducedMotion";
import { ComparisonRevealHeader } from "./ComparisonRevealHeader";
import { ComparisonRevealIndicators } from "./ComparisonRevealIndicators";
import { ComparisonRevealPager } from "./ComparisonRevealPager";

type ComparisonRevealModalProps = {
  visible: boolean;
  comparison: {
    thenClip: Clip;
    nowClip: Clip;
    thenLabel: string;
    nowLabel: string;
  } | null;
  presetLabel: string;
  chapterNumber: number;
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
  nextChapterBusyLength?: number | null;
  chapterActionMessage?: string | null;
  onStartNextChapter?: (days: number) => void;
  onClose: () => void;
};

type RevealStage = "unlock" | "opening" | "compare" | "reel" | "summary" | "next_chapter";
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
    title: "7-Day Chapter",
    subtitle: "Quick rhythm reset",
    payoff: "Fast reveal loop. Great for staying consistent day to day."
  },
  14: {
    title: "14-Day Chapter",
    subtitle: "Momentum chapter",
    payoff: "More visible change while still keeping feedback frequent."
  },
  30: {
    title: "30-Day Chapter",
    subtitle: "Core growth block",
    payoff: "Best balance of consistency and meaningful transformation."
  },
  100: {
    title: "100-Day Chapter",
    subtitle: "Commitment chapter",
    payoff: "Long-arc progress story for serious practitioners."
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

  // Very established users can opt into deeper chapter cadence.
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
    return `You are showing serious consistency. A 100-day chapter fits your rhythm.`;
  }

  if (recommendedDays === 30) {
    if (totalPracticeDays >= 30) {
      return `You have built real momentum. A 30-day chapter will show meaningful growth.`;
    }
    return `Your ${currentStreak}-day streak is strong. A 30-day chapter keeps that momentum going.`;
  }

  if (recommendedDays === 14) {
    return "Great pacing. A 14-day chapter keeps progress visible without slowing you down.";
  }

  return "Start with a quick 7-day chapter to keep the streak alive and earn your next reveal fast.";
}

export function ComparisonRevealModal({
  visible,
  comparison,
  presetLabel,
  chapterNumber,
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
  nextChapterBusyLength = null,
  chapterActionMessage = null,
  onStartNextChapter,
  onClose
}: ComparisonRevealModalProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const scrollRef = useRef<ScrollView | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [stage, setStage] = useState<RevealStage>("unlock");
  const [closing, setClosing] = useState(false);
  const [capsuleOpening, setCapsuleOpening] = useState(false);
  const [reelPlaying, setReelPlaying] = useState(true);
  const [reelIndex, setReelIndex] = useState(0);
  const [reelExportMessage, setReelExportMessage] = useState<string | null>(null);
  const stageReveal = useRef(new Animated.Value(0)).current;
  const unlockPulse = useRef(new Animated.Value(1)).current;
  const presentOpen = useRef(new Animated.Value(0)).current;
  const backgroundDrift = useRef(new Animated.Value(0)).current;
  const summaryHeroReveal = useRef(new Animated.Value(0)).current;
  const summaryMetricsReveal = useRef(new Animated.Value(0)).current;
  const summaryActionsReveal = useRef(new Animated.Value(0)).current;
  const compareEntryVeil = useRef(new Animated.Value(0)).current;
  const floatingDoneOpacity = useRef(new Animated.Value(0)).current;
  const reelTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const openingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const floatingDoneHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openingFinishedRef = useRef(false);
  const [floatingDoneHitArea, setFloatingDoneHitArea] = useState(false);
  const duration = (ms: number) => (reducedMotion ? 0 : ms);
  const revealCadence = chapterNumber <= 1 ? 1.18 : 0.94;
  const cadenceDuration = (ms: number) => duration(Math.round(ms * revealCadence));
  const motionDurations = {
    enter: cadenceDuration(640),
    openingEnter: cadenceDuration(1180),
    stageOut: cadenceDuration(260),
    stageIn: cadenceDuration(540),
    closePanels: cadenceDuration(240),
    closeShell: cadenceDuration(560),
    backdrop: cadenceDuration(620),
    pulse: cadenceDuration(420),
    capsuleOpen: cadenceDuration(1220),
    drift: cadenceDuration(760)
  };
  const controlTimings = {
    showDuration: cadenceDuration(260),
    hideDuration: cadenceDuration(380),
    autoHideDefault: 2200,
    autoHideAfterInteraction: 1700,
    autoHideOnStageEnter: 2800
  };

  const cardWidth = width;
  const safeHeight = Math.max(560, height - insets.top - insets.bottom);
  const videoHeight = Math.max(420, Math.min(safeHeight - 110, safeHeight * 0.9));
  const reelVideoHeight = Math.max(320, Math.min(safeHeight - 260, safeHeight * 0.68));
  const summaryHeroHeight = Math.max(220, Math.min(safeHeight * 0.4, 340));
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
              badge: "Then",
              title: comparison.thenLabel,
              clip: comparison.thenClip
            },
            {
              key: "now",
              badge: "Now",
              title: comparison.nowLabel,
              clip: comparison.nowClip
            }
          ]
        : [],
    [comparison]
  );

  const summaryClip = comparison?.nowClip ?? cards[cards.length - 1]?.clip ?? null;

  useEffect(() => {
    if (!visible) return;
    setActiveIndex(0);
    setStage("unlock");
    setClosing(false);
    setCapsuleOpening(false);
    setReelPlaying(true);
    setReelIndex(0);
    setReelExportMessage(null);
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
    floatingDoneOpacity.setValue(0);
    setFloatingDoneHitArea(false);
    if (floatingDoneHideTimerRef.current) {
      clearTimeout(floatingDoneHideTimerRef.current);
      floatingDoneHideTimerRef.current = null;
    }
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ x: 0, animated: false });
    });
    Animated.timing(stageReveal, {
      toValue: 1,
      duration: motionDurations.enter,
      easing: revealEasing.outHero,
      useNativeDriver: true
    }).start();
  }, [visible]);

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
      if (floatingDoneHideTimerRef.current) {
        clearTimeout(floatingDoneHideTimerRef.current);
        floatingDoneHideTimerRef.current = null;
      }
    };
  }, []);

  const hideFloatingDone = () => {
    if (floatingDoneHideTimerRef.current) {
      clearTimeout(floatingDoneHideTimerRef.current);
      floatingDoneHideTimerRef.current = null;
    }
    if (reducedMotion) {
      floatingDoneOpacity.setValue(0);
      setFloatingDoneHitArea(false);
      return;
    }
    Animated.timing(floatingDoneOpacity, {
      toValue: 0,
      duration: controlTimings.hideDuration,
      easing: revealEasing.inSoft,
      useNativeDriver: true
    }).start(() => {
      setFloatingDoneHitArea(false);
    });
  };

  const showFloatingDone = (autoHideDelay = controlTimings.autoHideDefault) => {
    if (!(visible && (stage === "compare" || stage === "reel"))) return;
    if (floatingDoneHideTimerRef.current) {
      clearTimeout(floatingDoneHideTimerRef.current);
      floatingDoneHideTimerRef.current = null;
    }
    setFloatingDoneHitArea(true);
    if (reducedMotion) {
      floatingDoneOpacity.setValue(1);
    } else {
      Animated.timing(floatingDoneOpacity, {
        toValue: 1,
        duration: controlTimings.showDuration,
        easing: revealEasing.outHero,
        useNativeDriver: true
      }).start();
    }
    floatingDoneHideTimerRef.current = setTimeout(() => {
      hideFloatingDone();
    }, Math.max(900, autoHideDelay));
  };

  const handleMediaTouchStart = () => {
    if (stage !== "compare" && stage !== "reel") return;
    hideFloatingDone();
  };

  const handleMediaTouchEnd = () => {
    if (stage !== "compare" && stage !== "reel") return;
    showFloatingDone(controlTimings.autoHideAfterInteraction);
  };

  useEffect(() => {
    if (!(visible && (stage === "compare" || stage === "reel"))) {
      hideFloatingDone();
      return;
    }
    showFloatingDone(controlTimings.autoHideOnStageEnter);
  }, [visible, stage]);

  useEffect(() => {
    if (!visible) return;
    const target =
      stage === "unlock"
        ? 0
        : stage === "opening"
          ? 0.9
        : stage === "compare"
          ? Math.min(2, activeIndex + 1)
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
  }, [visible, stage, activeIndex, reducedMotion, backgroundDrift]);

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
    Animated.stagger(cadenceDuration(140), [
      Animated.timing(summaryHeroReveal, {
        toValue: 1,
        duration: cadenceDuration(920),
        easing: revealEasing.outCinematic,
        useNativeDriver: true
      }),
      Animated.timing(summaryMetricsReveal, {
        toValue: 1,
        duration: cadenceDuration(760),
        easing: revealEasing.outCinematic,
        useNativeDriver: true
      }),
      Animated.timing(summaryActionsReveal, {
        toValue: 1,
        duration: cadenceDuration(680),
        easing: revealEasing.outCinematic,
        useNativeDriver: true
      })
    ]).start();
  }, [stage, visible, reducedMotion, summaryHeroReveal, summaryMetricsReveal, summaryActionsReveal, chapterNumber]);

  useEffect(() => {
    if (stage !== "reel" || !visible || !cards.length || !reelPlaying) {
      if (reelTimerRef.current) {
        clearInterval(reelTimerRef.current);
        reelTimerRef.current = null;
      }
      return;
    }
    reelTimerRef.current = setInterval(() => {
      setReelIndex((current) => (current + 1) % cards.length);
    }, 2000);
    return () => {
      if (reelTimerRef.current) {
        clearInterval(reelTimerRef.current);
        reelTimerRef.current = null;
      }
    };
  }, [stage, visible, cards.length, reelPlaying]);

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

  function jumpToNextSlide() {
    const nextIndex = Math.min(cards.length - 1, activeIndex + 1);
    setActiveIndex(nextIndex);
    scrollRef.current?.scrollTo({ x: nextIndex * cardWidth, animated: true });
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
      duration: cadenceDuration(360),
      easing: revealEasing.inSoft,
      useNativeDriver: true
    }).start(() => {
      setStage("compare");
      stageReveal.setValue(0);
      Animated.parallel([
        Animated.timing(stageReveal, {
          toValue: 1,
          duration: cadenceDuration(680),
          easing: revealEasing.outCinematic,
          useNativeDriver: true
        }),
        Animated.timing(compareEntryVeil, {
          toValue: 0,
          duration: cadenceDuration(760),
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
      ? `Chapter ${chapterNumber}`
      : stage === "compare"
        ? "Then vs Now"
      : stage === "reel"
        ? "Chapter Reel"
      : stage === "summary"
        ? "Chapter complete"
        : stage === "next_chapter"
          ? "Next chapter"
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
    <Modal visible={visible} animationType="none" transparent onRequestClose={handleCloseRequest}>
      <Animated.View style={[styles.compareModalBackdrop, { opacity: modalBackdropReveal }]}>
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
          {stage !== "opening" && stage !== "compare" && stage !== "reel" ? (
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
          {stage === "compare" || stage === "reel" ? (
            <Animated.View
              pointerEvents={floatingDoneHitArea ? "auto" : "none"}
              style={[
                styles.floatingDoneWrap,
                {
                  top: Math.max(8, insets.top + 2),
                  opacity: floatingDoneOpacity
                }
              ]}
            >
              <TactilePressable
                style={[styles.floatingDoneButton, closing ? styles.floatingDoneButtonDisabled : undefined]}
                pressScale={0.96}
                onPress={handleCloseRequest}
                disabled={closing}
              >
                <Text style={styles.floatingDoneText}>Done</Text>
              </TactilePressable>
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
                <Text style={styles.unlockKicker}>Chapter {chapterNumber}</Text>
                <Text style={styles.unlockTitle}>Your chapter is ready.</Text>
                <Text style={styles.unlockMeta}>Open what you built.</Text>
                <TactilePressable
                  stretch
                  style={[styles.unlockButton, capsuleOpening ? styles.unlockButtonDisabled : undefined]}
                  pressScale={0.974}
                  onPress={handleOpenRevealPress}
                  disabled={capsuleOpening}
                >
                  <Text style={styles.unlockButtonText}>{capsuleOpening ? "Opening..." : "Open Reveal"}</Text>
                </TactilePressable>
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
                <View
                  style={[styles.compareMediaSurface, { height: videoHeight }]}
                  onTouchStart={handleMediaTouchStart}
                  onTouchEnd={handleMediaTouchEnd}
                  onTouchCancel={handleMediaTouchEnd}
                >
                  <ComparisonRevealPager
                    cards={cards}
                    cardWidth={cardWidth}
                    videoHeight={videoHeight}
                    visible={visible}
                    activeIndex={activeIndex}
                    scrollRef={scrollRef}
                    contentReveal={nowPanelReveal}
                    onIndexChange={setActiveIndex}
                  />
                  <Animated.View pointerEvents="none" style={[styles.compareEntryVeil, { opacity: compareEntryVeil }]} />
                  <Animated.View
                    style={[
                      styles.compareTopOverlay,
                      {
                        opacity: labelsReveal,
                        transform: [
                          {
                            translateY: labelsReveal.interpolate({
                              inputRange: [0, 1],
                              outputRange: [8, 0]
                            })
                          }
                        ]
                      }
                    ]}
                  >
                    <Text style={styles.compareMetaPill}>{cards[activeIndex]?.badge ?? ""}</Text>
                  </Animated.View>
                </View>
                <Animated.View
                  style={[
                    styles.compareControlsDock,
                    {
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
                  <ComparisonRevealIndicators keys={cards.map((entry) => entry.key)} activeIndex={activeIndex} />
                  <TactilePressable
                    stretch
                    style={styles.compareContinueFloating}
                    pressScale={0.972}
                    onPress={() => {
                      triggerSelectionHaptic();
                      if (activeIndex < cards.length - 1) {
                        jumpToNextSlide();
                        return;
                      }
                      setReelIndex(0);
                      setReelPlaying(true);
                      transitionToStage("reel");
                    }}
                  >
                    <Text style={styles.compareContinueFloatingText}>Continue</Text>
                  </TactilePressable>
                </Animated.View>
              </View>
            ) : null}

            {stage === "reel" && cards.length ? (
              <View style={styles.reelStage}>
                <View
                  style={styles.reelVideoWrap}
                  onTouchStart={handleMediaTouchStart}
                  onTouchEnd={handleMediaTouchEnd}
                  onTouchCancel={handleMediaTouchEnd}
                >
                  <LoopingVideoPlayer
                    uri={cards[reelIndex]?.clip.videoUrl ?? cards[0].clip.videoUrl}
                    mediaType={cards[reelIndex]?.clip.captureType ?? cards[0].clip.captureType}
                    posterUri={cards[reelIndex]?.clip.thumbnailUrl ?? cards[0].clip.thumbnailUrl}
                    style={[styles.reelVideo, { height: reelVideoHeight }]}
                    resizeMode={ResizeMode.COVER}
                    showControls
                    muted={false}
                    autoPlay={reelPlaying}
                    active
                    loop
                  />
                </View>

                <Animated.View style={[styles.reelControlsWrap, { opacity: labelsReveal }]}>
                  <View style={styles.reelIndicatorRow}>
                    {cards.map((entry, index) => (
                      <View key={`reel-${entry.key}`} style={styles.reelIndicatorShell}>
                        <View style={[styles.reelIndicatorFill, index === reelIndex ? styles.reelIndicatorFillActive : undefined]} />
                      </View>
                    ))}
                  </View>

                  <TactilePressable
                    stretch
                    style={styles.reelContinueButton}
                    pressScale={0.972}
                    onPress={() => {
                      triggerSelectionHaptic();
                      transitionToStage("summary");
                    }}
                  >
                    <Text style={styles.reelContinueButtonText}>Continue</Text>
                  </TactilePressable>
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
                      <Text style={styles.summaryHeroKicker}>Chapter {chapterNumber} complete</Text>
                      <Text style={styles.summaryHeroTitle}>You built this.</Text>
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
                      <Text style={styles.summaryMetricLabel}>Practices</Text>
                      <Text style={styles.summaryMetricValue}>
                        {Math.min(progressDays, milestoneLengthDays)} / {milestoneLengthDays}
                      </Text>
                    </View>
                    <View style={styles.summaryMetricPill}>
                      <Text style={styles.summaryMetricLabel}>Streak</Text>
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
                  <Text style={styles.summaryCopy}>You showed up. The change is real.</Text>
                  <TactilePressable
                    stretch
                    style={styles.summaryExportButton}
                    pressScale={0.975}
                    onPress={() => {
                      triggerSelectionHaptic();
                      setReelExportMessage("Chapter reel export preview is ready. Full export ships next.");
                    }}
                  >
                    <Text style={styles.summaryExportButtonText}>Save Reel</Text>
                  </TactilePressable>
                  {reelExportMessage ? <Text style={styles.reelExportMessage}>Export preview ready.</Text> : null}
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
                        <Text style={styles.nextChapterOpenButtonText}>Choose Next Chapter</Text>
                      </TactilePressable>
                    </View>
                  ) : null}
                  {chapterActionMessage ? <Text style={styles.chapterActionMessage}>{chapterActionMessage}</Text> : null}
                  <TactilePressable stretch style={styles.summaryDoneButton} pressScale={0.98} onPress={handleCloseRequest}>
                    <Text style={styles.summaryDoneButtonText}>Done</Text>
                  </TactilePressable>
                </Animated.View>
              </Animated.ScrollView>
            ) : null}

            {stage === "next_chapter" ? (
              <View style={styles.nextChapterStage}>
                <Text style={styles.nextChapterStageTitle}>Start Chapter {chapterNumber + 1}</Text>
                <Text style={styles.nextChapterStageSubtitle}>{recommendedNextReason}</Text>

                <View style={styles.nextChapterCardsWrap}>
                  {nextMilestoneOptions.map((days) => {
                    const busy = nextChapterBusyLength === days;
                    const recommended = days === recommendedNextLength;
                    const content = nextMilestoneCardContent[days];
                    return (
                      <TactilePressable
                        key={days}
                        style={[
                          styles.nextChapterCard,
                          recommended ? styles.nextChapterCardRecommended : undefined,
                          busy ? styles.nextChapterCardBusy : undefined
                        ]}
                        pressScale={0.982}
                        onPress={() => {
                          onStartNextChapter?.(days);
                        }}
                        disabled={Boolean(nextChapterBusyLength)}
                      >
                        <View style={styles.nextChapterCardTop}>
                          <Text style={[styles.nextChapterCardDays, recommended ? styles.nextChapterCardDaysRecommended : undefined]}>
                            {days} days
                          </Text>
                          {recommended ? <Text style={styles.nextChapterRecommendedPill}>Recommended</Text> : null}
                        </View>
                        <Text style={styles.nextChapterCardTitle}>{content.title}</Text>
                        <Text style={styles.nextChapterCardSubtitle}>{content.subtitle}</Text>
                        <Text style={styles.nextChapterCardPayoff}>{busy ? "Starting..." : content.payoff}</Text>
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
                    transitionToStage("summary");
                  }}
                  disabled={Boolean(nextChapterBusyLength)}
                >
                  <Text style={styles.nextChapterBackButtonText}>Back to Summary</Text>
                </TactilePressable>
              </View>
            ) : null}
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  compareModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(5,12,22,0.96)"
  },
  parallaxOrbA: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 999,
    left: -96,
    top: 76,
    backgroundColor: "rgba(55,136,255,0.24)"
  },
  parallaxOrbB: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 999,
    right: -128,
    bottom: 96,
    backgroundColor: "rgba(74,164,255,0.2)"
  },
  compareModalCard: {
    flex: 1,
    backgroundColor: "rgba(8,16,30,0.98)"
  },
  headerWrap: {
    gap: 0
  },
  floatingDoneWrap: {
    position: "absolute",
    top: 8,
    right: 12,
    zIndex: 20
  },
  floatingDoneButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "rgba(6,16,30,0.5)",
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  floatingDoneButtonDisabled: {
    opacity: 0.62
  },
  floatingDoneText: {
    color: "#dceaff",
    fontWeight: "700",
    fontSize: 13
  },
  stageWrap: {
    flex: 1
  },
  unlockCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "rgba(255,255,255,0.06)",
    padding: 16
  },
  unlockKicker: {
    marginTop: 10,
    color: "#cadcf3",
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 0.7,
    textTransform: "uppercase"
  },
  unlockTitle: {
    marginTop: 6,
    color: "#eff7ff",
    fontWeight: "800",
    fontSize: 30,
    lineHeight: 34
  },
  unlockMeta: {
    marginTop: 8,
    color: "#c6d8ef",
    fontWeight: "700",
    fontSize: 14
  },
  unlockButton: {
    marginTop: 14,
    borderRadius: 14,
    backgroundColor: theme.colors.accent,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12
  },
  unlockButtonDisabled: {
    opacity: 0.66
  },
  unlockButtonText: {
    color: "#eaf4ff",
    fontWeight: "800",
    fontSize: 15
  },
  openingStage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22
  },
  openingVeil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#06101d"
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
    backgroundColor: "rgba(102,188,255,0.16)"
  },
  openingAnimation: {
    width: "100%",
    height: "100%"
  },
  compareMetaPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.08)",
    color: "#d7e8fb",
    fontWeight: "800",
    fontSize: 11,
    letterSpacing: 0.55,
    textTransform: "uppercase",
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  compareStage: {
    flex: 1,
    marginHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 6,
    justifyContent: "center"
  },
  compareMediaSurface: {
    width: "100%",
    backgroundColor: "#061220",
    borderRadius: 24,
    overflow: "hidden"
  },
  compareTopOverlay: {
    position: "absolute",
    top: 16,
    left: 16
  },
  compareControlsDock: {
    marginTop: 14,
    gap: 12
  },
  compareEntryVeil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#071321"
  },
  compareContinueFloating: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(124,189,255,0.7)",
    backgroundColor: "rgba(10,86,219,0.92)",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 58,
    paddingHorizontal: 28,
    paddingVertical: 15
  },
  compareContinueFloatingText: {
    color: "#f0f7ff",
    fontWeight: "800",
    fontSize: 17,
    lineHeight: 23,
    letterSpacing: 0.2
  },
  reelStage: {
    flex: 1,
    marginHorizontal: 18,
    marginTop: 2
  },
  reelVideoWrap: {
    marginTop: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 8
  },
  reelVideo: {
    width: "100%",
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#0b1a2d"
  },
  reelControlsWrap: {
    marginTop: 10
  },
  reelIndicatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  reelIndicatorShell: {
    flex: 1,
    height: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.24)",
    overflow: "hidden"
  },
  reelIndicatorFill: {
    width: "100%",
    height: "100%",
    borderRadius: 999,
    opacity: 0.24,
    backgroundColor: "#6ca8ff"
  },
  reelIndicatorFillActive: {
    opacity: 1,
    backgroundColor: "#0e63ff"
  },
  reelContinueButton: {
    marginTop: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(118,184,255,0.58)",
    backgroundColor: "rgba(10,86,219,0.9)",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 58,
    paddingHorizontal: 28,
    paddingVertical: 15
  },
  reelContinueButtonText: {
    color: "#f0f7ff",
    fontWeight: "800",
    fontSize: 17,
    lineHeight: 23,
    letterSpacing: 0.2
  },
  reelExportMessage: {
    marginTop: 8,
    color: "#b8cde6",
    fontWeight: "700",
    fontSize: 12
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
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.06)"
  },
  summaryHeroVideo: {
    width: "100%",
    height: "100%",
    backgroundColor: "#0b1a2d"
  },
  summaryHeroFallback: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.08)"
  },
  summaryHeroShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(4,10,19,0.26)"
  },
  summaryHeroTextWrap: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 14
  },
  summaryHeroKicker: {
    color: "#d6e8ff",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  summaryHeroTitle: {
    marginTop: 4,
    color: "#f3f9ff",
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "800"
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
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 13,
    paddingVertical: 12
  },
  summaryMetricLabel: {
    color: "#b8cde6",
    fontWeight: "700",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.45
  },
  summaryMetricValue: {
    marginTop: 3,
    color: "#eff7ff",
    fontWeight: "800",
    fontSize: 16
  },
  summaryCopy: {
    marginTop: 14,
    color: "#c6d8ef",
    fontWeight: "600",
    lineHeight: 20,
    fontSize: 14
  },
  summaryExportButton: {
    marginTop: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.32)",
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: 18,
    paddingVertical: 12
  },
  summaryExportButtonText: {
    color: "#d7e9ff",
    fontWeight: "700",
    fontSize: 13
  },
  nextChapterSummaryWrap: {
    marginTop: 16
  },
  summaryActionsMotion: {
    width: "100%"
  },
  nextChapterReason: {
    marginTop: 2,
    color: "#9fb6d2",
    fontWeight: "600",
    fontSize: 12,
    lineHeight: 17
  },
  nextChapterOpenButton: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(14,99,255,0.56)",
    backgroundColor: "rgba(14,99,255,0.24)",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: 18,
    paddingVertical: 12
  },
  nextChapterOpenButtonText: {
    color: "#eaf4ff",
    fontWeight: "800",
    fontSize: 15
  },
  nextChapterStage: {
    flex: 1,
    marginHorizontal: 16,
    marginTop: 12
  },
  nextChapterStageTitle: {
    color: "#eff7ff",
    fontWeight: "800",
    fontSize: 30,
    lineHeight: 34
  },
  nextChapterStageSubtitle: {
    marginTop: 6,
    color: "#b8cde6",
    fontWeight: "600",
    lineHeight: 19
  },
  nextChapterCardsWrap: {
    marginTop: 12,
    gap: 10
  },
  nextChapterCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    backgroundColor: "rgba(255,255,255,0.06)",
    padding: 12
  },
  nextChapterCardRecommended: {
    borderColor: "rgba(88,177,255,0.76)",
    backgroundColor: "rgba(14,99,255,0.22)"
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
    color: "#c6d8ef",
    fontWeight: "800",
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 0.55
  },
  nextChapterCardDaysRecommended: {
    color: "#eff7ff"
  },
  nextChapterRecommendedPill: {
    color: "#d9ebff",
    fontWeight: "800",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  nextChapterCardTitle: {
    marginTop: 4,
    color: "#eff7ff",
    fontWeight: "800",
    fontSize: 22,
    lineHeight: 25
  },
  nextChapterCardSubtitle: {
    marginTop: 2,
    color: "#c6d8ef",
    fontWeight: "700"
  },
  nextChapterCardPayoff: {
    marginTop: 6,
    color: "#b8cde6",
    fontWeight: "600",
    lineHeight: 18
  },
  nextChapterBackButton: {
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
    paddingHorizontal: 16,
    paddingVertical: 11
  },
  nextChapterBackButtonText: {
    color: "#d3e4f8",
    fontWeight: "700",
    fontSize: 14
  },
  chapterActionMessage: {
    marginTop: 10,
    color: "#b8cde6",
    fontWeight: "700",
    fontSize: 12
  },
  summaryDoneButton: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.32)",
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: 18,
    paddingVertical: 12
  },
  summaryDoneButtonText: {
    color: "#dcecff",
    fontWeight: "700",
    fontSize: 14
  }
});
