import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, Vibration, View } from "react-native";
import { ResizeMode, Video } from "expo-av";

import { trackEvent } from "../analytics/events";
import { listClips } from "../api/clips";
import { listJourneys } from "../api/journeys";
import { GlassSurface } from "../components/GlassSurface";
import { theme } from "../theme";
import type { Clip } from "../types/clip";
import type { Journey } from "../types/journey";
import {
  buildComparisonPair,
  buildPracticeHeatmap,
  getCurrentStreak,
  getDayCount,
  getMilestoneStates,
  hasClipToday,
  milestoneDefinitions,
  sortClipsAscending
} from "../utils/progress";

type ComparisonPreset = "day1" | "week" | "month";

type ProgressScreenProps = {
  token: string;
  activeJourneyId: string | null;
  onActiveJourneyChange: (journeyId: string | null) => void;
  onOpenJourneysTab: () => void;
};

const presetLabels: Array<{ key: ComparisonPreset; label: string }> = [
  { key: "day1", label: "Day 1 vs Today" },
  { key: "week", label: "7d vs Today" },
  { key: "month", label: "30d vs Today" }
];

function formatDuration(ms: number) {
  return `${Math.max(1, Math.round(ms / 1000))}s`;
}

function toProgressErrorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : "Unexpected error";
  if (raw === "UNAUTHORIZED") return "Session expired. Please login again.";
  if (raw.startsWith("Network request failed")) return raw;
  return raw;
}

export function ProgressScreen({ token, activeJourneyId, onActiveJourneyChange, onOpenJourneysTab }: ProgressScreenProps) {
  const timelineRef = useRef<ScrollView | null>(null);
  const timelineMilestoneRef = useRef<number | null>(null);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [journeysLoading, setJourneysLoading] = useState(true);
  const [clips, setClips] = useState<Clip[]>([]);
  const [clipsLoading, setClipsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [preset, setPreset] = useState<ComparisonPreset>("day1");
  const [scrubIndex, setScrubIndex] = useState(0);
  const [showAllMilestones, setShowAllMilestones] = useState(false);
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [recentlyUnlockedMilestoneDay, setRecentlyUnlockedMilestoneDay] = useState<number | null>(null);
  const [timeMachineCompareMode, setTimeMachineCompareMode] = useState(false);
  const [timeMachinePlaying, setTimeMachinePlaying] = useState(false);
  const [timeMachineStatus, setTimeMachineStatus] = useState<string | null>(null);
  const modalBackdropReveal = useRef(new Animated.Value(0)).current;
  const modalCardReveal = useRef(new Animated.Value(0)).current;
  const thenPanelReveal = useRef(new Animated.Value(0)).current;
  const nowPanelReveal = useRef(new Animated.Value(0)).current;
  const labelsReveal = useRef(new Animated.Value(0)).current;
  const milestoneUnlockPulse = useRef(new Animated.Value(1)).current;
  const milestoneUnlockGlow = useRef(new Animated.Value(0)).current;
  const milestoneJourneyRef = useRef<string | null>(null);
  const previousUnlockedCountRef = useRef(0);
  const TIMELINE_STEP = 26;

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
        const activeExists = Boolean(activeJourneyId) && response.journeys.some((journey) => journey.id === activeJourneyId);
        if (!activeExists) {
          onActiveJourneyChange(response.journeys[0].id);
        }
      } catch (error) {
        setErrorMessage(toProgressErrorMessage(error));
      } finally {
        setJourneysLoading(false);
      }
    }

    void load();
  }, [token]);

  useEffect(() => {
    async function loadJourneyClips() {
      if (!activeJourneyId) {
        setClips([]);
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
  }, [token, activeJourneyId]);

  const selectedJourney = useMemo(
    () => (activeJourneyId ? journeys.find((journey) => journey.id === activeJourneyId) ?? null : null),
    [journeys, activeJourneyId]
  );
  const clipsAscending = useMemo(() => sortClipsAscending(clips), [clips]);
  const comparison = useMemo(() => buildComparisonPair(clips, preset), [clips, preset]);
  const dayCount = getDayCount(clips);
  const streak = getCurrentStreak(clips);
  const didPracticeToday = hasClipToday(clips);
  const heatmapCells = useMemo(() => buildPracticeHeatmap(clips, 8), [clips]);
  const heatmapWeeks = useMemo(() => {
    const weeks: typeof heatmapCells[] = [];
    for (let index = 0; index < heatmapCells.length; index += 7) {
      weeks.push(heatmapCells.slice(index, index + 7));
    }
    return weeks;
  }, [heatmapCells]);
  const milestones = getMilestoneStates(dayCount);
  const nextMilestone = milestones.find((milestone) => !milestone.unlocked) ?? null;
  const unlockedMilestones = milestones.filter((milestone) => milestone.unlocked).length;
  const nextMilestoneIndex = milestones.findIndex((milestone) => !milestone.unlocked);
  const milestonePreview =
    showAllMilestones || nextMilestoneIndex === -1
      ? milestones
      : milestones.slice(Math.max(0, nextMilestoneIndex - 1), Math.min(milestones.length, nextMilestoneIndex + 2));
  const timelineEntries = useMemo(
    () =>
      clipsAscending.map((clip, index) => ({
        clip,
        day: index + 1,
        isMilestone: milestoneDefinitions.some((milestone) => milestone.day === index + 1)
      })),
    [clipsAscending]
  );
  const scrubThenClip = clipsAscending[0] ?? null;
  const scrubNowClip = clipsAscending[scrubIndex] ?? null;
  const scrubReady = Boolean(scrubThenClip && scrubNowClip && scrubThenClip.id !== scrubNowClip.id);
  const selectedEntry = timelineEntries[scrubIndex] ?? null;
  const latestEntry = timelineEntries[timelineEntries.length - 1] ?? null;

  useEffect(() => {
    if (!clipsAscending.length) {
      setScrubIndex(0);
      return;
    }
    setScrubIndex(clipsAscending.length - 1);
  }, [clipsAscending.length, activeJourneyId]);

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
          duration: 180,
          useNativeDriver: true
        }),
        Animated.timing(modalCardReveal, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true
        })
      ]),
      Animated.timing(thenPanelReveal, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true
      }),
      Animated.timing(nowPanelReveal, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true
      }),
      Animated.timing(labelsReveal, {
        toValue: 1,
        duration: 150,
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
    if (comparison) return;
    setCompareModalOpen(false);
  }, [comparison]);

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
        milestoneUnlockPulse.setValue(0.96);
        milestoneUnlockGlow.setValue(0);
        Animated.parallel([
          Animated.sequence([
            Animated.timing(milestoneUnlockPulse, {
              toValue: 1.06,
              duration: 220,
              useNativeDriver: true
            }),
            Animated.timing(milestoneUnlockPulse, {
              toValue: 1,
              duration: 220,
              useNativeDriver: true
            })
          ]),
          Animated.sequence([
            Animated.timing(milestoneUnlockGlow, {
              toValue: 1,
              duration: 200,
              useNativeDriver: true
            }),
            Animated.delay(500),
            Animated.timing(milestoneUnlockGlow, {
              toValue: 0,
              duration: 260,
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
    if (!selectedJourney || !scrubReady || !scrubNowClip) return;
    trackEvent("progress_scrubbed", {
      journeyId: selectedJourney.id,
      clipId: scrubNowClip.id,
      day: scrubIndex + 1
    });
  }, [selectedJourney?.id, scrubNowClip?.id, scrubIndex, scrubReady]);

  useEffect(() => {
    if (!timelineEntries.length) {
      setTimeMachinePlaying(false);
      setTimeMachineCompareMode(false);
      return;
    }
    if (!timeMachinePlaying) return;
    if (scrubIndex >= timelineEntries.length - 1) {
      setTimeMachinePlaying(false);
      return;
    }
    const timer = setTimeout(() => {
      setScrubIndex((current) => Math.min(current + 1, timelineEntries.length - 1));
    }, 850);
    return () => clearTimeout(timer);
  }, [timeMachinePlaying, scrubIndex, timelineEntries.length]);

  useEffect(() => {
    if (!timelineEntries.length) {
      timelineMilestoneRef.current = null;
      return;
    }
    const current = timelineEntries[scrubIndex];
    if (!current) return;
    if (current.isMilestone && timelineMilestoneRef.current !== current.day) {
      Vibration.vibrate(8);
      timelineMilestoneRef.current = current.day;
    } else if (!current.isMilestone) {
      timelineMilestoneRef.current = null;
    }
  }, [scrubIndex, timelineEntries]);

  useEffect(() => {
    if (!timelineEntries.length) return;
    timelineRef.current?.scrollTo({
      x: Math.max(0, scrubIndex * TIMELINE_STEP),
      animated: true
    });
  }, [scrubIndex, timelineEntries.length, TIMELINE_STEP]);

  useEffect(() => {
    if (timelineEntries.length > 1) return;
    setTimeMachineCompareMode(false);
  }, [timelineEntries.length]);

  const emptyComparisonMessage =
    clips.length === 0
      ? "Record your first day to begin your progress story."
      : clips.length === 1
        ? "You need one more practice day to unlock comparison."
        : preset === "week"
          ? "Record across at least 7 days to unlock this view."
          : preset === "month"
            ? "Record across at least 30 days to unlock this view."
            : "Comparison unavailable for this range.";

  const timeMachineThenEntry =
    selectedEntry && latestEntry
      ? selectedEntry.day === latestEntry.day
        ? timelineEntries[Math.max(0, timelineEntries.length - 2)] ?? null
        : selectedEntry
      : null;

  function jumpToTimelinePreset(target: "day1" | "week" | "month" | "today") {
    if (!timelineEntries.length) return;
    if (target === "day1") {
      setScrubIndex(0);
      return;
    }
    if (target === "today") {
      setScrubIndex(timelineEntries.length - 1);
      return;
    }

    const latestDate = new Date(timelineEntries[timelineEntries.length - 1].clip.recordedAt);
    const targetDate = new Date(latestDate);
    targetDate.setDate(latestDate.getDate() - (target === "week" ? 7 : 30));
    let nextIndex = 0;
    for (let index = 0; index < timelineEntries.length; index += 1) {
      const candidateDate = new Date(timelineEntries[index].clip.recordedAt);
      if (candidateDate.getTime() <= targetDate.getTime()) {
        nextIndex = index;
      } else {
        break;
      }
    }
    setScrubIndex(nextIndex);
    trackEvent("time_machine_jump", {
      journeyId: selectedJourney?.id ?? null,
      target,
      day: nextIndex + 1
    });
  }

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Progress</Text>
      <Text style={styles.subtitle}>Look how far you have come.</Text>

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      {journeysLoading ? <Text style={styles.mutedText}>Loading progress...</Text> : null}

      {!journeysLoading && journeys.length === 0 ? (
        <GlassSurface style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No journey yet</Text>
          <Text style={styles.emptyText}>Create your first journey, then record today to unlock comparisons.</Text>
          <Pressable style={({ pressed }) => [styles.ctaButton, pressed ? styles.pressScale : undefined]} onPress={onOpenJourneysTab}>
            <Text style={styles.ctaText}>Start a Journey</Text>
          </Pressable>
        </GlassSurface>
      ) : null}

      {journeys.length > 0 ? (
        <GlassSurface style={styles.selectorCard}>
          <Text style={styles.selectorTitle}>Choose Journey</Text>
          <View style={styles.selectorWrap}>
            {journeys.map((journey) => {
              const active = journey.id === activeJourneyId;
              return (
                <Pressable
                  key={journey.id}
                  style={({ pressed }) => [
                    styles.selectorPill,
                    active ? styles.selectorPillActive : undefined,
                    pressed ? styles.pressScale : undefined
                  ]}
                  onPress={() => onActiveJourneyChange(journey.id)}
                >
                  <Text style={[styles.selectorPillText, active ? styles.selectorPillTextActive : undefined]}>{journey.title}</Text>
                </Pressable>
              );
            })}
          </View>
        </GlassSurface>
      ) : null}

      {selectedJourney ? (
        <GlassSurface style={styles.summaryCard}>
          <Text style={styles.summaryJourney}>{selectedJourney.title}</Text>
          <Text style={styles.summaryCopy}>{didPracticeToday ? "You showed up today." : "Record today to keep your habit alive."}</Text>
          <View style={styles.summaryStats}>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatLabel}>Day</Text>
              <Text style={styles.summaryStatValue}>{Math.max(dayCount, 1)}</Text>
            </View>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatLabel}>Streak</Text>
              <Text style={styles.summaryStatValue}>{streak}d</Text>
            </View>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatLabel}>Today</Text>
              <Text style={styles.summaryStatValue}>{didPracticeToday ? "Done" : "Open"}</Text>
            </View>
          </View>
          {nextMilestone ? (
            <Text style={styles.nextMilestoneText}>
              Next unlock: Day {nextMilestone.day} • {nextMilestone.title} ({nextMilestone.remainingDays} day
              {nextMilestone.remainingDays === 1 ? "" : "s"} to go)
            </Text>
          ) : (
            <Text style={styles.nextMilestoneText}>All milestones unlocked. Keep showing up and keep sharpening.</Text>
          )}
        </GlassSurface>
      ) : null}

      {selectedJourney ? (
        <GlassSurface style={styles.heatmapCard}>
          <View style={styles.heatmapHeader}>
            <Text style={styles.heatmapTitle}>Practice Heatmap</Text>
            <Text style={styles.heatmapMeta}>Last 8 weeks</Text>
          </View>
          <View style={styles.heatmapGrid}>
            {heatmapWeeks.map((week, weekIndex) => (
              <View key={`week-${weekIndex}`} style={styles.heatmapWeekColumn}>
                {week.map((cell) => (
                  <View
                    key={cell.key}
                    style={[
                      styles.heatmapCell,
                      cell.practiced ? styles.heatmapCellActive : undefined,
                      cell.isToday ? styles.heatmapCellToday : undefined
                    ]}
                  />
                ))}
              </View>
            ))}
          </View>
          <Text style={styles.heatmapLegend}>
            {dayCount} practice days logged. Keep the chain growing.
          </Text>
        </GlassSurface>
      ) : null}

      {selectedJourney ? (
        <GlassSurface style={styles.timeMachineCard}>
          <Text style={styles.timeMachineTitle}>Progress Time Machine</Text>
          <Text style={styles.timeMachineSubtitle}>Scrub through your journey and feel the progress.</Text>

          {timelineEntries.length === 0 ? (
            <Text style={styles.mutedText}>Record your first day to start the Time Machine.</Text>
          ) : null}

          {timelineEntries.length > 0 && selectedEntry ? (
            <>
              {!timeMachineCompareMode ? (
                <View style={styles.timeMachinePreviewBlock}>
                  <Text style={styles.timeMachineDayLabel}>Day {selectedEntry.day}</Text>
                  <Video source={{ uri: selectedEntry.clip.videoUrl }} style={styles.timeMachineVideo} useNativeControls resizeMode={ResizeMode.COVER} />
                </View>
              ) : (
                <View style={styles.timeMachineCompareRow}>
                  <View style={styles.timeMachineComparePane}>
                    <Text style={styles.timeMachineCompareLabel}>
                      Day {timeMachineThenEntry?.day ?? selectedEntry.day}
                    </Text>
                    {timeMachineThenEntry ? (
                      <Video source={{ uri: timeMachineThenEntry.clip.videoUrl }} style={styles.timeMachineCompareVideo} resizeMode={ResizeMode.COVER} />
                    ) : (
                      <View style={[styles.timeMachineCompareVideo, styles.timeMachineCompareVideoEmpty]} />
                    )}
                  </View>
                  <View style={styles.timeMachineComparePane}>
                    <Text style={styles.timeMachineCompareLabel}>Today</Text>
                    {latestEntry ? (
                      <Video source={{ uri: latestEntry.clip.videoUrl }} style={styles.timeMachineCompareVideo} resizeMode={ResizeMode.COVER} />
                    ) : (
                      <View style={[styles.timeMachineCompareVideo, styles.timeMachineCompareVideoEmpty]} />
                    )}
                  </View>
                </View>
              )}

              <View style={styles.timeMachineControls}>
                <Pressable
                  style={({ pressed }) => [
                    styles.timeMachineControlBtn,
                    timelineEntries.length < 2 ? styles.timeMachineControlBtnDisabled : undefined,
                    pressed && timelineEntries.length > 1 ? styles.pressScale : undefined
                  ]}
                  onPress={() => {
                    if (timelineEntries.length < 2) return;
                    setTimeMachineCompareMode((current) => !current);
                  }}
                >
                  <Text style={styles.timeMachineControlText}>{timeMachineCompareMode ? "Single View" : "Compare"}</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.timeMachineControlBtn, pressed ? styles.pressScale : undefined]}
                  onPress={() => {
                    setTimeMachinePlaying((current) => !current);
                    setTimeMachineStatus(null);
                    trackEvent("time_machine_playback_toggled", {
                      journeyId: selectedJourney.id,
                      active: !timeMachinePlaying
                    });
                  }}
                >
                  <Text style={styles.timeMachineControlText}>{timeMachinePlaying ? "Stop" : "Play"}</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.timeMachineControlBtn, pressed ? styles.pressScale : undefined]}
                  onPress={() => {
                    setTimeMachineStatus("Progress reel export is coming next sprint.");
                    trackEvent("reel_export_tapped", { journeyId: selectedJourney.id, source: "time_machine" });
                  }}
                >
                  <Text style={styles.timeMachineControlText}>Export</Text>
                </Pressable>
              </View>

              <View style={styles.timelineJumpRow}>
                <Pressable style={({ pressed }) => [styles.timelineJumpChip, pressed ? styles.pressScale : undefined]} onPress={() => jumpToTimelinePreset("day1")}>
                  <Text style={styles.timelineJumpChipText}>Day 1</Text>
                </Pressable>
                <Pressable style={({ pressed }) => [styles.timelineJumpChip, pressed ? styles.pressScale : undefined]} onPress={() => jumpToTimelinePreset("week")}>
                  <Text style={styles.timelineJumpChipText}>-7d</Text>
                </Pressable>
                <Pressable style={({ pressed }) => [styles.timelineJumpChip, pressed ? styles.pressScale : undefined]} onPress={() => jumpToTimelinePreset("month")}>
                  <Text style={styles.timelineJumpChipText}>-30d</Text>
                </Pressable>
                <Pressable style={({ pressed }) => [styles.timelineJumpChip, pressed ? styles.pressScale : undefined]} onPress={() => jumpToTimelinePreset("today")}>
                  <Text style={styles.timelineJumpChipText}>Today</Text>
                </Pressable>
              </View>

              <View style={styles.timelineTrackWrap}>
                <ScrollView
                  ref={timelineRef}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.timelineTrack}
                  snapToInterval={TIMELINE_STEP}
                  decelerationRate="fast"
                  onMomentumScrollEnd={(event) => {
                    const offset = event.nativeEvent.contentOffset.x;
                    const nextIndex = Math.max(0, Math.min(timelineEntries.length - 1, Math.round(offset / TIMELINE_STEP)));
                    setScrubIndex(nextIndex);
                  }}
                >
                  {timelineEntries.map((entry, index) => (
                    <Pressable
                      key={entry.clip.id}
                      style={({ pressed }) => [styles.timelineMarkerWrap, pressed ? styles.pressScale : undefined]}
                      onPress={() => {
                        setScrubIndex(index);
                      }}
                    >
                      <View
                        style={[
                          styles.timelineMarker,
                          entry.isMilestone ? styles.timelineMarkerMilestone : undefined,
                          index <= scrubIndex ? styles.timelineMarkerDone : undefined,
                          index === scrubIndex ? styles.timelineMarkerActive : undefined
                        ]}
                      />
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              <Text style={styles.timelineMetaText}>
                Day {selectedEntry.day} • {new Date(selectedEntry.clip.recordedAt).toLocaleDateString()}
              </Text>
              {timeMachineStatus ? <Text style={styles.timeMachineStatusText}>{timeMachineStatus}</Text> : null}
            </>
          ) : null}
        </GlassSurface>
      ) : null}

      {selectedJourney ? (
        <GlassSurface style={styles.compareCard}>
          <Text style={styles.compareTitle}>Then vs Now</Text>
          <View style={styles.presetRow}>
            {presetLabels.map((entry) => {
              const active = entry.key === preset;
              return (
                <Pressable
                  key={entry.key}
                  style={({ pressed }) => [styles.presetButton, active ? styles.presetButtonActive : undefined, pressed ? styles.pressScale : undefined]}
                  onPress={() => setPreset(entry.key)}
                >
                  <Text style={active ? styles.presetTextActive : styles.presetText}>{entry.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {clipsLoading ? <Text style={styles.mutedText}>Loading clips...</Text> : null}

          {!clipsLoading && !comparison ? (
            <View style={styles.unlockBox}>
              <Text style={styles.unlockTitle}>Comparison locked</Text>
              <View style={styles.lockedTeaserRow}>
                <View style={styles.lockedTeaserPane}>
                  <Text style={styles.lockedTeaserLabel}>Then</Text>
                </View>
                <View style={styles.lockedTeaserPane}>
                  <Text style={styles.lockedTeaserLabel}>Now</Text>
                </View>
              </View>
              <Text style={styles.unlockText}>{emptyComparisonMessage}</Text>
            </View>
          ) : null}

          {!clipsLoading && comparison ? (
            <>
              <View style={styles.compareTeaserRow}>
                <View style={styles.compareTeaserPane}>
                  <Text style={styles.compareTeaserLabel}>Then</Text>
                  <Video source={{ uri: comparison.thenClip.videoUrl }} style={styles.compareTeaserVideo} resizeMode={ResizeMode.COVER} />
                </View>
                <View style={styles.compareTeaserPane}>
                  <Text style={styles.compareTeaserLabel}>Now</Text>
                  <Video source={{ uri: comparison.nowClip.videoUrl }} style={styles.compareTeaserVideo} resizeMode={ResizeMode.COVER} />
                </View>
              </View>
              <Pressable
                style={({ pressed }) => [styles.revealButton, pressed ? styles.pressScale : undefined]}
                onPress={() => {
                  setCompareModalOpen(true);
                  trackEvent("comparison_reveal_opened", {
                    journeyId: selectedJourney?.id ?? null,
                    preset
                  });
                }}
              >
                <Text style={styles.revealButtonText}>Open Then vs Now</Text>
              </Pressable>
            </>
          ) : null}

        </GlassSurface>
      ) : null}

      {selectedJourney ? (
        <GlassSurface style={styles.milestoneCard}>
          <View style={styles.milestoneHeader}>
            <Text style={styles.milestoneTitle}>Milestones</Text>
            <Text style={styles.milestoneCount}>
              {unlockedMilestones}/{milestones.length} unlocked
            </Text>
          </View>
          {milestonePreview.map((milestone) => (
            <Animated.View
              key={milestone.day}
              style={[
                styles.milestoneRow,
                milestone.day === recentlyUnlockedMilestoneDay
                  ? {
                      transform: [{ scale: milestoneUnlockPulse }],
                      backgroundColor: milestoneUnlockGlow.interpolate({
                        inputRange: [0, 1],
                        outputRange: ["rgba(255,255,255,0)", "rgba(13,159,101,0.18)"]
                      })
                    }
                  : undefined
              ]}
            >
              <View style={[styles.milestoneDot, milestone.unlocked ? styles.milestoneDotUnlocked : undefined]} />
              <View style={styles.milestoneBody}>
                <Text style={styles.milestoneRowTitle}>
                  Day {milestone.day} • {milestone.title}
                </Text>
                <Text style={styles.milestoneRowText}>
                  {milestone.day === recentlyUnlockedMilestoneDay
                    ? "Unlocked now"
                    : milestone.unlocked
                    ? "Unlocked"
                    : milestone.remainingDays <= 1
                      ? "Unlocks tomorrow"
                      : `${milestone.remainingDays} days remaining`}
                </Text>
              </View>
            </Animated.View>
          ))}
          {milestonePreview.length < milestones.length ? (
            <Pressable style={({ pressed }) => [styles.viewAllLink, pressed ? styles.pressScale : undefined]} onPress={() => setShowAllMilestones(true)}>
              <Text style={styles.viewAllLinkText}>View all milestones</Text>
            </Pressable>
          ) : null}
          {showAllMilestones && milestonePreview.length === milestones.length ? (
            <Pressable style={({ pressed }) => [styles.viewAllLink, pressed ? styles.pressScale : undefined]} onPress={() => setShowAllMilestones(false)}>
              <Text style={styles.viewAllLinkText}>Show less</Text>
            </Pressable>
          ) : null}
        </GlassSurface>
      ) : null}
      </ScrollView>

      <Modal
        visible={compareModalOpen && Boolean(comparison)}
        animationType="fade"
        transparent
        onRequestClose={() => setCompareModalOpen(false)}
      >
        <Animated.View style={[styles.compareModalBackdrop, { opacity: modalBackdropReveal }]}>
          <Animated.View
            style={[
              styles.compareModalCard,
              {
                opacity: modalCardReveal,
                transform: [
                  {
                    translateY: modalCardReveal.interpolate({
                      inputRange: [0, 1],
                      outputRange: [22, 0]
                    })
                  },
                  {
                    scale: modalCardReveal.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.94, 1]
                    })
                  }
                ]
              }
            ]}
          >
            <View style={styles.compareModalHeader}>
              <View>
                <Text style={styles.compareModalTitle}>Then vs Now</Text>
                <Text style={styles.compareModalSubtitle}>{presetLabels.find((entry) => entry.key === preset)?.label ?? "Comparison"}</Text>
              </View>
              <Pressable style={({ pressed }) => [styles.compareModalClose, pressed ? styles.pressScale : undefined]} onPress={() => setCompareModalOpen(false)}>
                <Text style={styles.compareModalCloseText}>Done</Text>
              </Pressable>
            </View>

            {comparison ? (
              <View style={styles.compareStack}>
                <Animated.View
                  style={[
                    styles.clipBlock,
                    {
                      opacity: thenPanelReveal,
                      transform: [
                        {
                          translateX: thenPanelReveal.interpolate({
                            inputRange: [0, 1],
                            outputRange: [-22, 0]
                          })
                        }
                      ]
                    }
                  ]}
                >
                  <Animated.Text style={[styles.clipBadge, { opacity: labelsReveal }]}>Then</Animated.Text>
                  <Animated.Text style={[styles.clipLabel, { opacity: labelsReveal }]}>{comparison.thenLabel}</Animated.Text>
                  <Video source={{ uri: comparison.thenClip.videoUrl }} style={styles.video} useNativeControls resizeMode={ResizeMode.COVER} />
                  <Text style={styles.clipMeta}>{formatDuration(comparison.thenClip.durationMs)}</Text>
                </Animated.View>

                <Animated.View
                  style={[
                    styles.clipBlock,
                    {
                      opacity: nowPanelReveal,
                      transform: [
                        {
                          translateX: nowPanelReveal.interpolate({
                            inputRange: [0, 1],
                            outputRange: [22, 0]
                          })
                        }
                      ]
                    }
                  ]}
                >
                  <Animated.Text style={[styles.clipBadge, { opacity: labelsReveal }]}>Now</Animated.Text>
                  <Animated.Text style={[styles.clipLabel, { opacity: labelsReveal }]}>{comparison.nowLabel}</Animated.Text>
                  <Video source={{ uri: comparison.nowClip.videoUrl }} style={styles.video} useNativeControls resizeMode={ResizeMode.COVER} />
                  <Text style={styles.clipMeta}>{formatDuration(comparison.nowClip.durationMs)}</Text>
                </Animated.View>
              </View>
            ) : null}
          </Animated.View>
        </Animated.View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 26
  },
  title: {
    marginTop: 6,
    fontSize: 36,
    fontWeight: "800",
    color: theme.colors.textPrimary
  },
  subtitle: {
    marginTop: 6,
    fontSize: 17,
    color: theme.colors.textSecondary
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
  emptyCard: {
    marginTop: 14,
    borderRadius: 22,
    padding: 14
  },
  emptyTitle: {
    color: theme.colors.textPrimary,
    fontSize: 22,
    fontWeight: "800"
  },
  emptyText: {
    marginTop: 8,
    color: theme.colors.textSecondary
  },
  ctaButton: {
    marginTop: 14,
    borderRadius: 14,
    backgroundColor: theme.colors.accent,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  ctaText: {
    color: "#eaf4ff",
    fontWeight: "800"
  },
  selectorCard: {
    marginTop: 14,
    borderRadius: 20,
    padding: 12
  },
  selectorTitle: {
    color: theme.colors.textSecondary,
    fontWeight: "700",
    fontSize: 13
  },
  selectorWrap: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  selectorPill: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.66)",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  selectorPillActive: {
    borderColor: "rgba(47,128,237,0.5)",
    backgroundColor: "rgba(47,128,237,0.14)"
  },
  selectorPillText: {
    color: theme.colors.textSecondary,
    fontWeight: "700"
  },
  selectorPillTextActive: {
    color: theme.colors.textPrimary
  },
  summaryCard: {
    marginTop: 14,
    borderRadius: 22,
    padding: 16
  },
  heatmapCard: {
    marginTop: 14,
    borderRadius: 22,
    padding: 14
  },
  heatmapHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  heatmapTitle: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontWeight: "800"
  },
  heatmapMeta: {
    color: theme.colors.textSecondary,
    fontWeight: "700",
    fontSize: 12
  },
  heatmapGrid: {
    marginTop: 10,
    flexDirection: "row",
    gap: 4
  },
  heatmapWeekColumn: {
    gap: 4
  },
  heatmapCell: {
    width: 12,
    height: 12,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.34)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.42)"
  },
  heatmapCellActive: {
    backgroundColor: "rgba(13,159,101,0.75)",
    borderColor: "rgba(13,159,101,0.86)"
  },
  heatmapCellToday: {
    borderColor: "rgba(14,99,255,0.95)",
    borderWidth: 1.5
  },
  heatmapLegend: {
    marginTop: 10,
    color: theme.colors.textSecondary,
    fontWeight: "600"
  },
  timeMachineCard: {
    marginTop: 14,
    borderRadius: 22,
    padding: 14
  },
  timeMachineTitle: {
    color: theme.colors.textPrimary,
    fontSize: 24,
    fontWeight: "800"
  },
  timeMachineSubtitle: {
    marginTop: 4,
    color: theme.colors.textSecondary,
    fontWeight: "600"
  },
  timeMachinePreviewBlock: {
    marginTop: 12
  },
  timeMachineDayLabel: {
    color: theme.colors.textSecondary,
    fontWeight: "700"
  },
  timeMachineVideo: {
    marginTop: 6,
    width: "100%",
    aspectRatio: 9 / 12,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#0d2740"
  },
  timeMachineCompareRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 8
  },
  timeMachineComparePane: {
    flex: 1
  },
  timeMachineCompareLabel: {
    color: theme.colors.textSecondary,
    fontWeight: "700",
    fontSize: 12
  },
  timeMachineCompareVideo: {
    marginTop: 5,
    width: "100%",
    aspectRatio: 3 / 4,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#0d2740"
  },
  timeMachineCompareVideoEmpty: {
    backgroundColor: "rgba(255,255,255,0.14)"
  },
  timeMachineControls: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8
  },
  timeMachineControlBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.66)",
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingVertical: 9,
    alignItems: "center",
    justifyContent: "center"
  },
  timeMachineControlBtnDisabled: {
    opacity: 0.52
  },
  timeMachineControlText: {
    color: theme.colors.textPrimary,
    fontWeight: "700"
  },
  timelineJumpRow: {
    marginTop: 10,
    flexDirection: "row",
    gap: 6
  },
  timelineJumpChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.66)",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 9,
    paddingVertical: 5
  },
  timelineJumpChipText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: "700"
  },
  timelineTrackWrap: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.52)",
    backgroundColor: "rgba(255,255,255,0.13)",
    paddingVertical: 12
  },
  timelineTrack: {
    paddingHorizontal: 8
  },
  timelineMarkerWrap: {
    width: 26,
    alignItems: "center",
    justifyContent: "center"
  },
  timelineMarker: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.42)"
  },
  timelineMarkerMilestone: {
    width: 12,
    height: 12,
    borderRadius: 6
  },
  timelineMarkerDone: {
    backgroundColor: "rgba(13,159,101,0.72)"
  },
  timelineMarkerActive: {
    backgroundColor: theme.colors.accent,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.72)"
  },
  timelineMetaText: {
    marginTop: 8,
    color: theme.colors.textSecondary,
    fontWeight: "600"
  },
  timeMachineStatusText: {
    marginTop: 6,
    color: theme.colors.textSecondary,
    fontWeight: "600"
  },
  summaryJourney: {
    color: theme.colors.textPrimary,
    fontSize: 28,
    fontWeight: "800"
  },
  summaryCopy: {
    marginTop: 8,
    color: theme.colors.textSecondary,
    fontSize: 18,
    fontWeight: "700"
  },
  summaryStats: {
    marginTop: 12,
    flexDirection: "row",
    gap: 8
  },
  summaryStat: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.66)",
    backgroundColor: "rgba(255,255,255,0.24)",
    paddingVertical: 8,
    paddingHorizontal: 10
  },
  summaryStatLabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: "700"
  },
  summaryStatValue: {
    marginTop: 4,
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: "800"
  },
  nextMilestoneText: {
    marginTop: 12,
    color: theme.colors.textSecondary,
    fontWeight: "600"
  },
  milestoneCard: {
    marginTop: 14,
    borderRadius: 22,
    padding: 14
  },
  milestoneHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  milestoneTitle: {
    color: theme.colors.textPrimary,
    fontSize: 24,
    fontWeight: "800"
  },
  milestoneCount: {
    color: theme.colors.textSecondary,
    fontWeight: "700"
  },
  milestoneRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 10,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 8
  },
  milestoneDot: {
    marginTop: 3,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
    backgroundColor: "rgba(255,255,255,0.3)"
  },
  milestoneDotUnlocked: {
    backgroundColor: theme.colors.success,
    borderColor: theme.colors.success
  },
  milestoneBody: {
    flex: 1
  },
  milestoneRowTitle: {
    color: theme.colors.textPrimary,
    fontWeight: "800"
  },
  milestoneRowText: {
    marginTop: 4,
    color: theme.colors.textSecondary
  },
  viewAllLink: {
    marginTop: 12,
    alignSelf: "flex-start"
  },
  viewAllLinkText: {
    color: theme.colors.accentStrong,
    fontWeight: "700"
  },
  compareCard: {
    marginTop: 18,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.78)"
  },
  compareTeaserRow: {
    marginTop: 14,
    flexDirection: "row",
    gap: 10
  },
  compareTeaserPane: {
    flex: 1
  },
  compareTeaserLabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  compareTeaserVideo: {
    marginTop: 6,
    width: "100%",
    aspectRatio: 3 / 4,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#0d2740"
  },
  revealButton: {
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: theme.colors.accent,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center"
  },
  revealButtonText: {
    color: "#eaf4ff",
    fontWeight: "800"
  },
  compareTitle: {
    color: theme.colors.textPrimary,
    fontSize: 26,
    fontWeight: "800"
  },
  presetRow: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap"
  },
  presetButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.66)",
    backgroundColor: "rgba(255,255,255,0.22)",
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  presetButtonActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accent
  },
  presetText: {
    color: theme.colors.textSecondary,
    fontWeight: "700",
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  presetTextActive: {
    color: "#eaf4ff",
    fontWeight: "800"
  },
  unlockBox: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.66)",
    borderRadius: 14,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.2)"
  },
  lockedTeaserRow: {
    marginTop: 10,
    flexDirection: "row",
    gap: 10
  },
  lockedTeaserPane: {
    flex: 1,
    height: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center"
  },
  lockedTeaserLabel: {
    color: theme.colors.textSecondary,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  unlockTitle: {
    color: theme.colors.textPrimary,
    fontWeight: "800",
    fontSize: 16
  },
  unlockText: {
    marginTop: 10,
    color: theme.colors.textSecondary
  },
  compareStack: {
    marginTop: 14,
    gap: 14
  },
  clipBlock: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.66)",
    borderRadius: 16,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.2)"
  },
  clipBadge: {
    color: theme.colors.textSecondary,
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: "uppercase"
  },
  clipLabel: {
    marginTop: 4,
    color: theme.colors.textPrimary,
    fontWeight: "800"
  },
  video: {
    marginTop: 8,
    width: "100%",
    aspectRatio: 4 / 5,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#0d2740"
  },
  clipMeta: {
    marginTop: 6,
    color: theme.colors.textSecondary
  },
  scrubberBlock: {
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.65)",
    backgroundColor: "rgba(255,255,255,0.26)",
    padding: 12
  },
  scrubberTitle: {
    color: theme.colors.textPrimary,
    fontWeight: "800"
  },
  scrubberRow: {
    marginTop: 10,
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap"
  },
  scrubberStep: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.72)",
    backgroundColor: "rgba(255,255,255,0.26)",
    alignItems: "center",
    justifyContent: "center"
  },
  scrubberStepActive: {
    borderColor: "rgba(14,99,255,0.6)",
    backgroundColor: "rgba(14,99,255,0.18)"
  },
  scrubberDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.72)"
  },
  scrubberDotActive: {
    backgroundColor: theme.colors.accentStrong
  },
  scrubberMeta: {
    marginTop: 10,
    color: theme.colors.textSecondary,
    fontWeight: "600"
  },
  scrubberPreview: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8
  },
  scrubberPane: {
    flex: 1
  },
  scrubberPaneLabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: "700"
  },
  scrubberVideo: {
    marginTop: 6,
    width: "100%",
    aspectRatio: 3 / 4,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#0d2740"
  },
  compareModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(8,13,22,0.62)",
    justifyContent: "center",
    paddingHorizontal: 14
  },
  compareModalCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    backgroundColor: "rgba(12,20,34,0.94)",
    padding: 14
  },
  compareModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  compareModalTitle: {
    color: "#eef5ff",
    fontSize: 26,
    fontWeight: "800"
  },
  compareModalSubtitle: {
    marginTop: 3,
    color: "#b8c9de",
    fontWeight: "600"
  },
  compareModalClose: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  compareModalCloseText: {
    color: "#eaf4ff",
    fontWeight: "700"
  },
  pressScale: {
    transform: [{ scale: 0.98 }]
  }
});
