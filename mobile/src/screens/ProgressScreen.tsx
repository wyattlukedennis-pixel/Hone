import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, ScrollView, StyleSheet, Text, Vibration } from "react-native";

import { trackEvent } from "../analytics/events";
import { listClips } from "../api/clips";
import { listJourneys } from "../api/journeys";
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
import { ComparisonRevealModal } from "./progress/ComparisonRevealModal";
import { JourneySelectorCard } from "./progress/JourneySelectorCard";
import { MilestonesCard } from "./progress/MilestonesCard";
import { NoJourneyCard } from "./progress/NoJourneyCard";
import { PracticeHeatmapCard } from "./progress/PracticeHeatmapCard";
import { ProgressSummaryCard } from "./progress/ProgressSummaryCard";
import { ThenVsNowCard } from "./progress/ThenVsNowCard";
import { TimeMachineCard } from "./progress/TimeMachineCard";
import { theme } from "../theme";

type ComparisonPreset = "day1" | "week" | "month";

type ProgressScreenProps = {
  token: string;
  activeJourneyId: string | null;
  onActiveJourneyChange: (journeyId: string | null) => void;
  onOpenJourneysTab: () => void;
  devNowDayOffset?: number;
  recordingsRevision: number;
};

const presetOptions: Array<{ key: ComparisonPreset; label: string; chipLabel: string }> = [
  { key: "day1", label: "Day 1 vs Today", chipLabel: "Day 1" },
  { key: "week", label: "7d vs Today", chipLabel: "7 Days" },
  { key: "month", label: "30d vs Today", chipLabel: "30 Days" }
];

function toProgressErrorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : "Unexpected error";
  if (raw === "UNAUTHORIZED") return "Session expired. Please login again.";
  if (raw.startsWith("Network request failed")) return raw;
  return raw;
}

export function ProgressScreen({
  token,
  activeJourneyId,
  onActiveJourneyChange,
  onOpenJourneysTab,
  devNowDayOffset = 0,
  recordingsRevision
}: ProgressScreenProps) {
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
  }, [token, recordingsRevision]);

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
  }, [token, activeJourneyId, recordingsRevision]);

  const selectedJourney = useMemo(
    () => (activeJourneyId ? journeys.find((journey) => journey.id === activeJourneyId) ?? null : null),
    [journeys, activeJourneyId]
  );
  const effectiveNow = useMemo(() => {
    if (!devNowDayOffset) return new Date();
    const value = new Date();
    value.setDate(value.getDate() + devNowDayOffset);
    return value;
  }, [devNowDayOffset]);
  const clipsAscending = useMemo(() => sortClipsAscending(clips), [clips]);
  const comparison = useMemo(() => buildComparisonPair(clips, preset), [clips, preset]);
  const dayCount = getDayCount(clips);
  const streak = getCurrentStreak(clips, effectiveNow);
  const didPracticeToday = hasClipToday(clips, effectiveNow);

  const heatmapCells = useMemo(() => buildPracticeHeatmap(clips, 8, effectiveNow), [clips, effectiveNow]);
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
  const showJourneySelector = journeys.length > 1;
  const showHeatmap = dayCount >= 3;

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
        {__DEV__ && devNowDayOffset ? (
          <Text style={styles.devHintText}>
            Dev date shift: {devNowDayOffset >= 0 ? "+" : ""}
            {devNowDayOffset} day{Math.abs(devNowDayOffset) === 1 ? "" : "s"}
          </Text>
        ) : null}

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        {journeysLoading ? <Text style={styles.mutedText}>Loading progress...</Text> : null}

        {!journeysLoading && journeys.length === 0 ? <NoJourneyCard onStartJourney={onOpenJourneysTab} /> : null}

        {selectedJourney ? (
          <ThenVsNowCard
            journeyTitle={selectedJourney.title}
            hero
            preset={preset}
            presetOptions={presetOptions}
            clipsLoading={clipsLoading}
            comparison={comparison ? { thenClip: comparison.thenClip, nowClip: comparison.nowClip } : null}
            emptyComparisonMessage={emptyComparisonMessage}
            onPresetChange={setPreset}
            onOpenReveal={() => {
              setCompareModalOpen(true);
              trackEvent("comparison_reveal_opened", {
                journeyId: selectedJourney?.id ?? null,
                preset
              });
            }}
          />
        ) : null}

        {selectedJourney ? (
          <TimeMachineCard
            timelineRef={timelineRef}
            timelineEntries={timelineEntries}
            selectedEntry={selectedEntry}
            latestEntry={latestEntry}
            timeMachineThenEntry={timeMachineThenEntry}
            compareMode={timeMachineCompareMode}
            playing={timeMachinePlaying}
            status={timeMachineStatus}
            scrubIndex={scrubIndex}
            timelineStep={TIMELINE_STEP}
            onToggleCompare={() => {
              if (timelineEntries.length < 2) return;
              setTimeMachineCompareMode((current) => !current);
            }}
            onTogglePlay={() => {
              setTimeMachinePlaying((current) => !current);
              setTimeMachineStatus(null);
              trackEvent("time_machine_playback_toggled", {
                journeyId: selectedJourney.id,
                active: !timeMachinePlaying
              });
            }}
            onExport={() => {
              setTimeMachineStatus("Progress reel export is coming next sprint.");
              trackEvent("reel_export_tapped", { journeyId: selectedJourney.id, source: "time_machine" });
            }}
            onJump={jumpToTimelinePreset}
            onScrubIndexChange={(index) => setScrubIndex(index)}
          />
        ) : null}

        {selectedJourney ? (
          <ProgressSummaryCard
            journeyTitle={selectedJourney.title}
            didPracticeToday={didPracticeToday}
            dayCount={dayCount}
            streak={streak}
            nextMilestone={nextMilestone}
          />
        ) : null}

        {showJourneySelector ? (
          <JourneySelectorCard
            journeys={journeys}
            activeJourneyId={activeJourneyId}
            onSelectJourney={(journeyId) => {
              onActiveJourneyChange(journeyId);
            }}
          />
        ) : null}

        {selectedJourney ? (
          <MilestonesCard
            milestonePreview={milestonePreview}
            milestonesTotal={milestones.length}
            unlockedMilestones={unlockedMilestones}
            recentlyUnlockedMilestoneDay={recentlyUnlockedMilestoneDay}
            milestoneUnlockPulse={milestoneUnlockPulse}
            milestoneUnlockGlow={milestoneUnlockGlow}
            showAllMilestones={showAllMilestones}
            onShowAll={() => setShowAllMilestones(true)}
            onShowLess={() => setShowAllMilestones(false)}
          />
        ) : null}

        {selectedJourney && showHeatmap ? <PracticeHeatmapCard heatmapWeeks={heatmapWeeks} dayCount={dayCount} /> : null}
      </ScrollView>

      <ComparisonRevealModal
        visible={compareModalOpen && Boolean(comparison)}
        comparison={comparison}
        presetLabel={presetOptions.find((entry) => entry.key === preset)?.label ?? "Comparison"}
        modalBackdropReveal={modalBackdropReveal}
        modalCardReveal={modalCardReveal}
        thenPanelReveal={thenPanelReveal}
        nowPanelReveal={nowPanelReveal}
        labelsReveal={labelsReveal}
        onClose={() => setCompareModalOpen(false)}
      />
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
  devHintText: {
    marginTop: 4,
    color: theme.colors.accentStrong,
    fontSize: 12,
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
  }
});
