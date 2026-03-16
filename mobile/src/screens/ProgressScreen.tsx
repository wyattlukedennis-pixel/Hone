import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Modal, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { trackEvent } from "../analytics/events";
import { startNextMilestone } from "../api/journeys";
import { GlassSurface } from "../components/GlassSurface";
import { TactilePressable } from "../components/TactilePressable";
import { motionTokens } from "../motion/tokens";
import { theme } from "../theme";
import type { JourneyReveal } from "../types/journey";
import { useReducedMotion } from "../utils/useReducedMotion";
import { ComparisonRevealModal } from "./progress/ComparisonRevealModal";
import { NoJourneyCard } from "./progress/NoJourneyCard";
import { useProgressState } from "./progress/useProgressState";

type ProgressScreenProps = {
  token: string;
  activeJourneyId: string | null;
  mediaMode: "video" | "photo";
  onActiveJourneyChange: (journeyId: string | null) => void;
  onOpenJourneysTab: () => void;
  devNowDayOffset?: number;
  openRevealSignal?: number;
  progressEntrySignal?: number;
  recordingsRevision: number;
};

type RevealSourceRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ChapterStartInterstitialState = {
  journeyTitle: string;
  chapterNumber: number;
  milestoneLengthDays: number;
  prompts: string[];
};

function buildChapterStartPrompts(params: { milestoneLengthDays: number; chapterNumber: number }) {
  const { milestoneLengthDays, chapterNumber } = params;

  const base = [
    "Show up once today. Keep the chain alive.",
    "One clean rep today beats waiting for perfect.",
    "Small human reps compound into visible growth."
  ];

  if (milestoneLengthDays >= 100) {
    return [
      "Long chapter, calm pace. One session today is enough.",
      "Think long arc: show up today, stack tomorrow.",
      "Consistency over intensity. Keep the chapter moving."
    ];
  }

  if (milestoneLengthDays >= 30) {
    return [
      "This chapter is where momentum becomes transformation.",
      "Show up today and let the month do the work.",
      "Keep the framing steady and trust the process."
    ];
  }

  if (chapterNumber <= 2) {
    return [
      "Quick win chapter. Record today and keep moving.",
      "Build confidence with one focused rep.",
      "You are building proof, one day at a time."
    ];
  }

  return base;
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
  recordingsRevision
}: ProgressScreenProps) {
  const { height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const duration = (ms: number) => (reducedMotion ? 0 : ms);
  const [comparisonSourceRect, setComparisonSourceRect] = useState<RevealSourceRect | null>(null);
  const [advancingMilestoneLength, setAdvancingMilestoneLength] = useState<number | null>(null);
  const [chapterActionMessage, setChapterActionMessage] = useState<string | null>(null);
  const [chapterStartInterstitial, setChapterStartInterstitial] = useState<ChapterStartInterstitialState | null>(null);
  const [chapterPromptIndex, setChapterPromptIndex] = useState(0);
  const [selectedPastReveal, setSelectedPastReveal] = useState<JourneyReveal | null>(null);
  const [chapterHistoryOpen, setChapterHistoryOpen] = useState(false);
  const handledRevealSignalRef = useRef(0);
  const handledProgressEntrySignalRef = useRef(0);
  const chapterStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chapterPromptTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chapterStartBackdropReveal = useRef(new Animated.Value(0)).current;
  const chapterStartCardReveal = useRef(new Animated.Value(0)).current;
  const revealCapsulePulse = useRef(new Animated.Value(1)).current;
  const progressTakeover = useRef(new Animated.Value(0)).current;

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
    dayCount,
    streak,
    didPracticeToday
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
    setSelectedPastReveal(null);
    setChapterHistoryOpen(false);
  }, [selectedJourney?.id]);

  useEffect(() => {
    return () => {
      if (chapterStartTimerRef.current) {
        clearTimeout(chapterStartTimerRef.current);
        chapterStartTimerRef.current = null;
      }
      if (chapterPromptTimerRef.current) {
        clearInterval(chapterPromptTimerRef.current);
        chapterPromptTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!chapterStartInterstitial) return;

    if (chapterStartTimerRef.current) {
      clearTimeout(chapterStartTimerRef.current);
      chapterStartTimerRef.current = null;
    }
    if (chapterPromptTimerRef.current) {
      clearInterval(chapterPromptTimerRef.current);
      chapterPromptTimerRef.current = null;
    }
    setChapterPromptIndex(0);

    const transitionOutAndRoute = () => {
      if (reducedMotion) {
        setChapterStartInterstitial(null);
        setChapterActionMessage(null);
        onOpenJourneysTab();
        return;
      }

      Animated.parallel([
        Animated.timing(chapterStartCardReveal, {
          toValue: 0,
          duration: duration(theme.motion.microMs + 40),
          easing: Easing.in(Easing.quad),
          useNativeDriver: true
        }),
        Animated.timing(chapterStartBackdropReveal, {
          toValue: 0,
          duration: duration(theme.motion.transitionMs),
          easing: Easing.in(Easing.quad),
          useNativeDriver: true
        })
      ]).start(() => {
        setChapterStartInterstitial(null);
        setChapterActionMessage(null);
        onOpenJourneysTab();
      });
    };

    if (reducedMotion) {
      chapterStartBackdropReveal.setValue(1);
      chapterStartCardReveal.setValue(1);
      chapterStartTimerRef.current = setTimeout(transitionOutAndRoute, 500);
      return;
    }

    chapterStartBackdropReveal.setValue(0);
    chapterStartCardReveal.setValue(0);
    Animated.parallel([
      Animated.timing(chapterStartBackdropReveal, {
        toValue: 1,
        duration: duration(theme.motion.transitionMs + 70),
        easing: Easing.out(Easing.quad),
        useNativeDriver: true
      }),
      Animated.timing(chapterStartCardReveal, {
        toValue: 1,
        duration: duration(theme.motion.transitionMs + 80),
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      })
    ]).start();

    if (chapterStartInterstitial.prompts.length > 1) {
      chapterPromptTimerRef.current = setInterval(() => {
        setChapterPromptIndex((current) => (current + 1) % chapterStartInterstitial.prompts.length);
      }, 900);
    }

    chapterStartTimerRef.current = setTimeout(transitionOutAndRoute, 2200);
    return () => {
      if (chapterStartTimerRef.current) {
        clearTimeout(chapterStartTimerRef.current);
        chapterStartTimerRef.current = null;
      }
      if (chapterPromptTimerRef.current) {
        clearInterval(chapterPromptTimerRef.current);
        chapterPromptTimerRef.current = null;
      }
    };
  }, [chapterStartInterstitial, reducedMotion, chapterStartBackdropReveal, chapterStartCardReveal, onOpenJourneysTab]);

  const activeComparison = comparison;
  const activePresetLabel = "Milestone Reveal";
  const revealReady = Boolean(milestoneProgress?.reachedReveal);
  const chapterProgressDays = milestoneProgress?.progressDays ?? 0;
  const chapterTargetDays = milestoneProgress?.milestoneLengthDays ?? selectedJourney?.milestoneLengthDays ?? 7;
  const chapterRemainingDays = milestoneProgress?.remainingDays ?? chapterTargetDays;
  const chapterNumber = milestoneProgress?.milestoneChapter ?? selectedJourney?.milestoneChapter ?? 1;
  const chapterProgressLabel = `${Math.min(chapterProgressDays, chapterTargetDays)} / ${chapterTargetDays} practices`;
  const chapterCountdownLabel = `${chapterRemainingDays} ${chapterRemainingDays === 1 ? "practice" : "practices"} until reveal`;
  const compactMode = height < 760;
  const tightMode = height < 700;
  const singleSceneMode = Boolean(
    selectedJourney &&
      !journeysLoading &&
      !errorMessage &&
      !chapterActionMessage &&
      !chapterStartInterstitial &&
      !compactMode
  );

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

  function openMirrorComparison(sourceRect: RevealSourceRect | null) {
    if (!selectedJourney || !comparison || !revealReady) return;
    setComparisonSourceRect(sourceRect);
    setCompareModalOpen(true);
    trackEvent("comparison_reveal_opened", {
      journeyId: selectedJourney.id,
      source: "progress_reveal_cta"
    });
  }

  useEffect(() => {
    if (!openRevealSignal) return;
    if (openRevealSignal <= handledRevealSignalRef.current) return;
    handledRevealSignalRef.current = openRevealSignal;
    if (!revealReady || !comparison || !selectedJourney) return;
    setComparisonSourceRect(null);
    setCompareModalOpen(true);
    trackEvent("milestone_reveal_opened", {
      journeyId: selectedJourney.id,
      chapter: chapterNumber,
      source: "practice_deep_link"
    });
  }, [openRevealSignal, revealReady, comparison?.thenClip.id, comparison?.nowClip.id, selectedJourney?.id, chapterNumber, setCompareModalOpen]);

  useEffect(() => {
    if (!progressEntrySignal) return;
    if (progressEntrySignal <= handledProgressEntrySignalRef.current) return;
    handledProgressEntrySignalRef.current = progressEntrySignal;
    if (!revealReady || !comparison || !selectedJourney) return;
    setComparisonSourceRect(null);
    setCompareModalOpen(true);
    trackEvent("milestone_reveal_opened", {
      journeyId: selectedJourney.id,
      chapter: chapterNumber,
      source: "progress_auto_takeover"
    });
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
      setCompareModalOpen(false);
      setComparisonSourceRect(null);
      setChapterActionMessage(`Chapter ${response.journey.milestoneChapter} started.`);
      setChapterStartInterstitial({
        journeyTitle: selectedJourney.title,
        chapterNumber: response.journey.milestoneChapter,
        milestoneLengthDays: nextLength,
        prompts: buildChapterStartPrompts({
          milestoneLengthDays: nextLength,
          chapterNumber: response.journey.milestoneChapter
        })
      });
    } catch (error) {
      const raw = error instanceof Error ? error.message : "Unexpected error";
      if (raw === "MILESTONE_NOT_REACHED") {
        setChapterActionMessage("Keep recording. This reveal is not ready yet.");
      } else {
        setChapterActionMessage(raw);
      }
    } finally {
      setAdvancingMilestoneLength(null);
    }
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
            scrollEnabled={!compareModalOpen && !singleSceneMode}
          >
            {selectedJourney ? (
              <View style={[styles.heroIdentityWrap, compactMode ? styles.heroIdentityWrapCompact : null]}>
                <Text style={styles.heroEyebrow}>{selectedJourney.title}</Text>
                <Text style={[styles.heroTitle, compactMode ? styles.heroTitleCompact : null]}>
                  {revealReady ? "Reveal Ready" : `Chapter ${chapterNumber}`}
                </Text>
                <Text style={[styles.heroMetaLine, tightMode ? styles.heroMetaLineCompact : null]}>
                  {revealReady ? "Open what you built." : chapterCountdownLabel}
                </Text>
              </View>
            ) : (
              <>
                <Text style={styles.title}>Progress</Text>
              </>
            )}

            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
            {journeysLoading ? <Text style={styles.mutedText}>Loading progress...</Text> : null}

            {!journeysLoading && journeys.length === 0 ? <NoJourneyCard onStartJourney={onOpenJourneysTab} /> : null}

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
                <Animated.View
                  style={[
                    styles.chapterSceneCard,
                    compactMode ? styles.chapterSceneCardCompact : null,
                    revealReady ? styles.chapterSceneCardReady : undefined,
                    { transform: [{ scale: revealCapsulePulse }] }
                  ]}
                >
                  <View style={styles.revealCapsuleTopRow}>
                    <Text style={[styles.revealCapsuleEyebrow, revealReady ? styles.revealCapsuleEyebrowReady : undefined]}>
                      {revealReady ? "Reveal Capsule" : "Chapter Build"}
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
                        <Text style={styles.historyAccessButtonText}>{revealsLoading ? "…" : "History"}</Text>
                      </TactilePressable>
                    </View>
                  </View>

                  <Text style={[styles.revealCapsuleTitle, compactMode ? styles.revealCapsuleTitleCompact : null]}>
                    {revealReady ? "Your chapter is ready." : "Keep building this chapter."}
                  </Text>
                  <Text style={[styles.revealCapsuleCopy, compactMode ? styles.revealCapsuleCopyCompact : null]}>
                    {revealReady ? "Tap to open your reveal moment." : "Show up today and keep the momentum moving."}
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

                  <TactilePressable
                    style={[styles.revealCapsulePrimary, revealReady ? styles.revealCapsulePrimaryReady : undefined]}
                    onPress={() => {
                      if (revealReady) {
                        openMirrorComparison(null);
                        return;
                      }
                      trackEvent("record_tapped", { journeyId: selectedJourney.id, context: "progress_build_capsule" });
                      onOpenJourneysTab();
                    }}
                  >
                    <Text style={[styles.revealCapsulePrimaryText, compactMode ? styles.revealCapsulePrimaryTextCompact : null]}>
                      {revealReady ? "Open Reveal" : didPracticeToday ? "Record Again Today" : "Record Today"}
                    </Text>
                  </TactilePressable>

                  <Animated.View
                    style={[
                      styles.chapterStatusFooter,
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
                    <Text style={styles.chapterStatusFooterText}>{revealReady ? "Ready now" : "Build mode"}</Text>
                  </Animated.View>
                </Animated.View>
                {chapterActionMessage ? <Text style={styles.chapterActionMessage}>{chapterActionMessage}</Text> : null}
              </Animated.View>
            ) : null}

            {!selectedJourney && !journeysLoading && journeys.length > 0 ? (
              <GlassSurface style={styles.emptySelectionCard} intensity={24}>
                <Text style={styles.emptySelectionTitle}>Choose your active journey in Practice.</Text>
                <Text style={styles.emptySelectionCopy}>Progress follows the chapter you are currently building.</Text>
                <TactilePressable style={styles.emptySelectionButton} onPress={onOpenJourneysTab}>
                  <Text style={styles.emptySelectionButtonText}>Go to Practice</Text>
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
        chapterNumber={chapterNumber}
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

      <Modal visible={chapterHistoryOpen} animationType="fade" transparent onRequestClose={() => setChapterHistoryOpen(false)}>
        <View style={styles.pastChapterOverlay}>
          <GlassSurface style={styles.historyModalCard} intensity={26}>
            <View style={styles.historyModalHeader}>
              <View>
                <Text style={styles.pastChapterEyebrow}>Journey Story</Text>
                <Text style={styles.historyModalTitle}>Chapter History</Text>
              </View>
              <TactilePressable style={styles.historyModalCloseChip} onPress={() => setChapterHistoryOpen(false)}>
                <Text style={styles.historyModalCloseText}>Done</Text>
              </TactilePressable>
            </View>

            {revealsLoading ? <Text style={styles.archiveMuted}>Loading chapters...</Text> : null}
            {!revealsLoading && reveals.length === 0 ? <Text style={styles.archiveMuted}>No completed chapters yet.</Text> : null}
            {!revealsLoading ? (
              <ScrollView style={styles.historyModalList} showsVerticalScrollIndicator={false}>
                {reveals.map((reveal) => (
                  <TactilePressable
                    key={reveal.id}
                    style={styles.chapterTimelineRow}
                    onPress={() => {
                      setSelectedPastReveal(reveal);
                      setChapterHistoryOpen(false);
                      if (!selectedJourney) return;
                      trackEvent("past_chapter_opened", {
                        journeyId: selectedJourney.id,
                        chapterNumber: reveal.chapterNumber,
                        milestoneLengthDays: reveal.milestoneLengthDays
                      });
                    }}
                  >
                    <View style={styles.chapterTimelineRail}>
                      <View style={styles.chapterTimelineLine} />
                      <View style={styles.chapterTimelineDot} />
                    </View>
                    <View style={styles.chapterTimelineBody}>
                      <Text style={styles.archiveRowTitle}>Chapter {reveal.chapterNumber} • {reveal.milestoneLengthDays}-day reveal</Text>
                      <Text style={styles.archiveRowMeta}>
                        {new Date(reveal.completedAt).toLocaleDateString()} • {reveal.recordedDays} practices logged
                      </Text>
                    </View>
                  </TactilePressable>
                ))}
              </ScrollView>
            ) : null}
          </GlassSurface>
        </View>
      </Modal>

      <Modal visible={Boolean(selectedPastReveal)} animationType="fade" transparent onRequestClose={() => setSelectedPastReveal(null)}>
        <View style={styles.pastChapterOverlay}>
          <GlassSurface style={styles.pastChapterCard} intensity={26}>
            <Text style={styles.pastChapterEyebrow}>Past Chapter</Text>
            <Text style={styles.pastChapterTitle}>Chapter {selectedPastReveal?.chapterNumber}</Text>
            <Text style={styles.pastChapterMeta}>{selectedPastReveal?.milestoneLengthDays}-day reveal window</Text>

            <View style={styles.pastChapterStatsWrap}>
              <View style={styles.pastChapterStat}>
                <Text style={styles.pastChapterStatLabel}>Completed</Text>
                <Text style={styles.pastChapterStatValue}>
                  {selectedPastReveal ? new Date(selectedPastReveal.completedAt).toLocaleDateString() : "--"}
                </Text>
              </View>
              <View style={styles.pastChapterStat}>
                <Text style={styles.pastChapterStatLabel}>Practice Days</Text>
                <Text style={styles.pastChapterStatValue}>{selectedPastReveal?.recordedDays ?? 0}</Text>
              </View>
              <View style={styles.pastChapterStat}>
                <Text style={styles.pastChapterStatLabel}>Range</Text>
                <Text style={styles.pastChapterStatValue}>
                  {selectedPastReveal ? `Day ${selectedPastReveal.startDayIndex}-${selectedPastReveal.endDayIndex}` : "--"}
                </Text>
              </View>
            </View>

            <Text style={styles.pastChapterCopy}>
              This chapter has been preserved in your journey history. Full replay from history is coming in a future update.
            </Text>

            <TactilePressable style={styles.pastChapterCloseButton} onPress={() => setSelectedPastReveal(null)}>
              <Text style={styles.pastChapterCloseButtonText}>Done</Text>
            </TactilePressable>
          </GlassSurface>
        </View>
      </Modal>

      <Modal visible={Boolean(chapterStartInterstitial)} animationType="none" transparent>
        <Animated.View style={[styles.chapterStartOverlay, { opacity: chapterStartBackdropReveal }]}>
          <Animated.View
            style={[
              styles.chapterStartCard,
              {
                opacity: chapterStartCardReveal,
                transform: [
                  {
                    translateY: chapterStartCardReveal.interpolate({
                      inputRange: [0, 1],
                      outputRange: [22, 0]
                    })
                  },
                  {
                    scale: chapterStartCardReveal.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.975, 1]
                    })
                  }
                ]
              }
            ]}
          >
            <Text style={styles.chapterStartKicker}>Chapter Started</Text>
            <Text style={styles.chapterStartJourneyTitle}>{chapterStartInterstitial?.journeyTitle}</Text>
            <Text style={styles.chapterStartTitle}>Chapter {chapterStartInterstitial?.chapterNumber}</Text>
            <Text style={styles.chapterStartMeta}>{chapterStartInterstitial?.milestoneLengthDays}-day reveal window</Text>
            <Text style={styles.chapterStartPromptLabel}>Today prompt</Text>
            <Text style={styles.chapterStartCopy}>
              {chapterStartInterstitial?.prompts[chapterPromptIndex] ?? "Show up today and build the next reveal."}
            </Text>
          </Animated.View>
        </Animated.View>
      </Modal>
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
    backgroundColor: "#060f1c"
  },
  container: {
    flex: 1
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
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
    color: theme.colors.textPrimary
  },
  subtitle: {
    marginTop: 5,
    fontSize: 18,
    color: theme.colors.textSecondary
  },
  heroIdentityWrap: {
    marginTop: 12,
    marginBottom: 6
  },
  heroIdentityWrapCompact: {
    marginTop: 8,
    marginBottom: 4
  },
  heroEyebrow: {
    color: theme.colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.68,
    fontWeight: "800",
    fontSize: 11
  },
  heroTitle: {
    marginTop: 5,
    color: theme.colors.textPrimary,
    fontSize: 38,
    lineHeight: 42,
    fontWeight: "800"
  },
  heroTitleCompact: {
    fontSize: 32,
    lineHeight: 36
  },
  heroMetaLine: {
    marginTop: 7,
    color: theme.colors.textPrimary,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "800"
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
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.66)",
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
    borderRadius: 28,
    borderWidth: 0,
    borderColor: "transparent",
    backgroundColor: "rgba(255,255,255,0.78)",
    padding: 18,
    shadowColor: "#0b1f38",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 }
  },
  chapterSceneCardCompact: {
    borderRadius: 24,
    padding: 16
  },
  chapterSceneCardReady: {
    backgroundColor: "rgba(255,255,255,0.84)"
  },
  revealCapsuleCard: {
    marginTop: 14,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.8)",
    backgroundColor: "rgba(255,255,255,0.28)",
    padding: 16
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
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(66,140,255,0.42)",
    backgroundColor: "rgba(66,140,255,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  chapterProgressPillText: {
    color: theme.colors.accentStrong,
    fontSize: 11,
    fontWeight: "800"
  },
  revealCapsuleEyebrow: {
    color: theme.colors.textSecondary,
    textTransform: "uppercase",
    fontWeight: "800",
    fontSize: 11,
    letterSpacing: 0.6
  },
  revealCapsuleEyebrowReady: {
    color: theme.colors.accentStrong
  },
  revealCapsuleTitle: {
    marginTop: 6,
    color: theme.colors.textPrimary,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "800"
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
    fontWeight: "700"
  },
  revealCapsuleCopyCompact: {
    fontSize: 13,
    lineHeight: 17
  },
  revealCapsuleTrack: {
    marginTop: 16,
    height: 10,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(235,243,255,0.92)"
  },
  revealCapsuleTrackFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: theme.colors.accent
  },
  revealCapsulePrimary: {
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(5,61,170,0.86)",
    backgroundColor: theme.colors.accent,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    shadowColor: "#0e63ff",
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 }
  },
  revealCapsulePrimaryReady: {
    borderColor: "rgba(7,56,152,0.95)",
    backgroundColor: "#0b56db",
    shadowOpacity: 0.36,
    shadowRadius: 16
  },
  revealCapsulePrimaryText: {
    color: "#f2f8ff",
    fontWeight: "800",
    fontSize: 16
  },
  revealCapsulePrimaryTextCompact: {
    fontSize: 15
  },
  chapterStatusFooter: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.58)",
    alignItems: "flex-start"
  },
  chapterStatusFooterText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: "700"
  },
  historyAccessButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(66,140,255,0.34)",
    backgroundColor: "rgba(66,140,255,0.1)",
    paddingHorizontal: 11,
    paddingVertical: 7
  },
  historyAccessButtonText: {
    color: theme.colors.accentStrong,
    fontSize: 12,
    fontWeight: "800"
  },
  chapterActionMessage: {
    marginTop: 10,
    color: theme.colors.textSecondary,
    fontWeight: "700",
    fontSize: 12
  },
  archiveMuted: {
    marginTop: 8,
    color: theme.colors.textSecondary,
    fontWeight: "600"
  },
  chapterTimelineRow: {
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.82)",
    backgroundColor: "rgba(255,255,255,0.42)",
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10
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
    width: 1,
    backgroundColor: "rgba(14,99,255,0.34)"
  },
  chapterTimelineDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: theme.colors.accent,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.82)"
  },
  chapterTimelineBody: {
    flex: 1
  },
  archiveRowTitle: {
    color: theme.colors.textPrimary,
    fontWeight: "800",
    fontSize: 16
  },
  archiveRowMeta: {
    marginTop: 4,
    color: theme.colors.textSecondary,
    fontWeight: "600",
    fontSize: 13
  },
  emptySelectionCard: {
    marginTop: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
    backgroundColor: "rgba(255,255,255,0.22)",
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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(14,99,255,0.5)",
    backgroundColor: "rgba(14,99,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10
  },
  emptySelectionButtonText: {
    color: theme.colors.accentStrong,
    fontWeight: "800",
    fontSize: 14
  },
  pastChapterOverlay: {
    flex: 1,
    backgroundColor: "rgba(8,16,30,0.72)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20
  },
  pastChapterCard: {
    width: "100%",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.74)",
    backgroundColor: "rgba(255,255,255,0.3)",
    padding: 18
  },
  historyModalCard: {
    width: "100%",
    maxHeight: "72%",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.74)",
    backgroundColor: "rgba(255,255,255,0.3)",
    padding: 18
  },
  historyModalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 4
  },
  historyModalList: {
    marginTop: 6
  },
  historyModalTitle: {
    marginTop: 3,
    color: theme.colors.textPrimary,
    fontSize: 24,
    fontWeight: "800"
  },
  historyModalCloseChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.78)",
    backgroundColor: "rgba(255,255,255,0.28)",
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
    letterSpacing: 0.7,
    textTransform: "uppercase"
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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.66)",
    backgroundColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  pastChapterStatLabel: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
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
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(14,99,255,0.5)",
    backgroundColor: "rgba(14,99,255,0.22)",
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
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.72)",
    backgroundColor: "rgba(255,255,255,0.25)",
    padding: 14
  },
  historyKicker: {
    color: theme.colors.textSecondary,
    textTransform: "uppercase",
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
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(14,99,255,0.45)",
    backgroundColor: "rgba(14,99,255,0.14)",
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
  chapterStartOverlay: {
    flex: 1,
    backgroundColor: "rgba(5,12,22,0.84)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20
  },
  chapterStartCard: {
    width: "100%",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.36)",
    backgroundColor: "rgba(12,26,48,0.95)",
    paddingHorizontal: 20,
    paddingVertical: 22
  },
  chapterStartKicker: {
    color: "#b8cde6",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  chapterStartTitle: {
    marginTop: 2,
    color: "#eff7ff",
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "800"
  },
  chapterStartJourneyTitle: {
    marginTop: 4,
    color: "#d1e2f7",
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "800"
  },
  chapterStartMeta: {
    marginTop: 4,
    color: "#d1e2f7",
    fontSize: 16,
    fontWeight: "700"
  },
  chapterStartPromptLabel: {
    marginTop: 12,
    color: "#9fb6d2",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.55
  },
  chapterStartCopy: {
    marginTop: 6,
    color: "#b8cde6",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600"
  }
});
