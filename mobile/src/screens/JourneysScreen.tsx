import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ResizeMode, Video } from "expo-av";

import { trackEvent } from "../analytics/events";
import { createClip, listClips, requestClipUploadUrl, uploadClipFile } from "../api/clips";
import { archiveJourney, createJourney, listJourneys } from "../api/journeys";
import { PracticeRecorder } from "../components/PracticeRecorder";
import { theme } from "../theme";
import type { Clip } from "../types/clip";
import type { DevDateShiftSettings } from "../types/devTools";
import type { Journey } from "../types/journey";
import { getCurrentStreak, getDayCount, getNextMilestone, getUnlockedMilestone, hasClipToday } from "../utils/progress";
import { ActionButton } from "./practice/ActionButton";
import { ClipViewerModal } from "./practice/ClipViewerModal";
import { buildHeroMessage, buildSaveMessage, getTodayPrompt, toJourneyErrorMessage } from "./practice/helpers";
import { ManageJourneysModal } from "./practice/ManageJourneysModal";
import { PracticeHeroCard } from "./practice/PracticeHeroCard";
import { PracticeProgressPreviewCard } from "./practice/PracticeProgressPreviewCard";
import { TimelineModal } from "./practice/TimelineModal";

type JourneysScreenProps = {
  token: string;
  activeJourneyId: string | null;
  onActiveJourneyChange: (journeyId: string | null) => void;
  onOpenProgress: (journeyId: string) => void;
  devDateShiftSettings: DevDateShiftSettings;
  onDevDateShiftSettingsChange: (next: DevDateShiftSettings) => void;
  recordingsRevision: number;
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

function applyDayOffset(value: string, dayOffset: number) {
  if (!dayOffset) return value;
  const base = new Date(value);
  if (Number.isNaN(base.getTime())) return value;
  base.setDate(base.getDate() + dayOffset);
  return base.toISOString();
}

export function JourneysScreen({
  token,
  activeJourneyId,
  onActiveJourneyChange,
  onOpenProgress,
  devDateShiftSettings,
  onDevDateShiftSettingsChange,
  recordingsRevision
}: JourneysScreenProps) {
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newGoalText, setNewGoalText] = useState("");

  const [clipsByJourney, setClipsByJourney] = useState<Record<string, Clip[]>>({});
  const [clipsLoadingByJourney, setClipsLoadingByJourney] = useState<Record<string, boolean>>({});
  const [activeClip, setActiveClip] = useState<Clip | null>(null);

  const [recorderJourneyId, setRecorderJourneyId] = useState<string | null>(null);
  const [clipSaving, setClipSaving] = useState(false);
  const [recorderStatusMessage, setRecorderStatusMessage] = useState<string | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);

  const [celebrationText, setCelebrationText] = useState<string | null>(null);
  const [recentlySavedClipId, setRecentlySavedClipId] = useState<string | null>(null);
  const [recentlyFilledDotIndex, setRecentlyFilledDotIndex] = useState<number | null>(null);
  const [milestoneFlash, setMilestoneFlash] = useState(false);

  const celebrationOpacity = useRef(new Animated.Value(0)).current;
  const celebrationY = useRef(new Animated.Value(14)).current;
  const statPulse = useRef(new Animated.Value(1)).current;
  const newestClipReveal = useRef(new Animated.Value(1)).current;
  const dotFillProgress = useRef(new Animated.Value(1)).current;
  const milestonePulse = useRef(new Animated.Value(1)).current;

  const saveFlightOpacity = useRef(new Animated.Value(0)).current;
  const saveFlightX = useRef(new Animated.Value(0)).current;
  const saveFlightY = useRef(new Animated.Value(0)).current;
  const saveFlightScale = useRef(new Animated.Value(1)).current;
  const [saveFlightClipUrl, setSaveFlightClipUrl] = useState<string | null>(null);

  function playCelebration(message: string) {
    setCelebrationText(message);
    celebrationOpacity.setValue(0);
    celebrationY.setValue(14);
    Animated.sequence([
      Animated.parallel([
        Animated.timing(celebrationOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(celebrationY, { toValue: 0, duration: 180, useNativeDriver: true })
      ]),
      Animated.delay(1200),
      Animated.parallel([
        Animated.timing(celebrationOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(celebrationY, { toValue: -8, duration: 220, useNativeDriver: true })
      ])
    ]).start(() => {
      setCelebrationText(null);
    });
  }

  function playSaveMotion(filledDotIndex: number, unlockedMilestone: boolean, clipUrl: string | null) {
    setRecentlyFilledDotIndex(filledDotIndex);
    dotFillProgress.setValue(0);
    newestClipReveal.setValue(0);
    statPulse.setValue(0.94);

    Animated.parallel([
      Animated.timing(dotFillProgress, {
        toValue: 1,
        duration: 520,
        useNativeDriver: true
      }),
      Animated.timing(newestClipReveal, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true
      }),
      Animated.sequence([
        Animated.timing(statPulse, {
          toValue: 1.06,
          duration: 180,
          useNativeDriver: true
        }),
        Animated.timing(statPulse, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true
        })
      ])
    ]).start();

    if (clipUrl) {
      setSaveFlightClipUrl(clipUrl);
      saveFlightOpacity.setValue(0.98);
      saveFlightX.setValue(0);
      saveFlightY.setValue(0);
      saveFlightScale.setValue(1.05);

      Animated.parallel([
        Animated.timing(saveFlightX, {
          toValue: Math.max(112, SCREEN_WIDTH * 0.34),
          duration: 420,
          useNativeDriver: true
        }),
        Animated.timing(saveFlightY, {
          toValue: -Math.max(210, SCREEN_HEIGHT * 0.32),
          duration: 420,
          useNativeDriver: true
        }),
        Animated.timing(saveFlightScale, {
          toValue: 0.35,
          duration: 420,
          useNativeDriver: true
        }),
        Animated.sequence([
          Animated.delay(260),
          Animated.timing(saveFlightOpacity, {
            toValue: 0,
            duration: 190,
            useNativeDriver: true
          })
        ])
      ]).start(() => {
        setSaveFlightClipUrl(null);
      });
    }

    if (unlockedMilestone) {
      setMilestoneFlash(true);
      milestonePulse.setValue(0.96);
      Animated.sequence([
        Animated.timing(milestonePulse, {
          toValue: 1.05,
          duration: 220,
          useNativeDriver: true
        }),
        Animated.timing(milestonePulse, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true
        })
      ]).start(() => {
        setMilestoneFlash(false);
      });
    }
  }

  async function loadJourneys({ silent = false }: { silent?: boolean } = {}) {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setErrorMessage(null);

    try {
      const response = await listJourneys(token);
      setJourneys(response.journeys);
      if (response.journeys.length === 0) {
        onActiveJourneyChange(null);
      } else {
        const activeStillExists = Boolean(activeJourneyId) && response.journeys.some((journey) => journey.id === activeJourneyId);
        if (!activeStillExists) {
          onActiveJourneyChange(response.journeys[0].id);
        }
      }
    } catch (error) {
      setErrorMessage(toJourneyErrorMessage(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function loadJourneyClips(journeyId: string) {
    setClipsLoadingByJourney((current) => ({ ...current, [journeyId]: true }));
    setErrorMessage(null);
    try {
      const response = await listClips(token, journeyId);
      setClipsByJourney((current) => ({ ...current, [journeyId]: response.clips }));
      return response.clips;
    } catch (error) {
      setErrorMessage(toJourneyErrorMessage(error));
      return [] as Clip[];
    } finally {
      setClipsLoadingByJourney((current) => ({ ...current, [journeyId]: false }));
    }
  }

  useEffect(() => {
    void loadJourneys();
  }, [token]);

  useEffect(() => {
    setClipsByJourney({});
    setClipsLoadingByJourney({});
    if (activeJourneyId) {
      void loadJourneyClips(activeJourneyId);
    }
  }, [recordingsRevision]);

  useEffect(() => {
    if (!activeJourneyId) return;
    const hasClips = Boolean(clipsByJourney[activeJourneyId]);
    const loadingClips = Boolean(clipsLoadingByJourney[activeJourneyId]);
    if (!hasClips && !loadingClips) {
      void loadJourneyClips(activeJourneyId);
    }
  }, [activeJourneyId, clipsByJourney, clipsLoadingByJourney]);

  async function handleCreateJourney() {
    const title = newTitle.trim();
    if (!title) {
      setErrorMessage("Title is required.");
      return;
    }

    setCreating(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const response = await createJourney(token, {
        title,
        category: newCategory.trim() || null,
        goalText: newGoalText.trim() || null
      });
      setJourneys((current) => [response.journey, ...current]);
      onActiveJourneyChange(response.journey.id);
      setManageOpen(false);
      setNewTitle("");
      setNewCategory("");
      setNewGoalText("");
      setStatusMessage("Journey started. Day 1 is ready.");
    } catch (error) {
      setErrorMessage(toJourneyErrorMessage(error));
    } finally {
      setCreating(false);
    }
  }

  async function handleArchiveJourney(journeyId: string) {
    setUpdatingId(journeyId);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      await archiveJourney(token, journeyId);
      const remainingJourneys = journeys.filter((journey) => journey.id !== journeyId);
      setJourneys(remainingJourneys);
      setClipsByJourney((current) => {
        const next = { ...current };
        delete next[journeyId];
        return next;
      });
      if (activeJourneyId === journeyId) {
        onActiveJourneyChange(remainingJourneys[0]?.id ?? null);
      }
      setStatusMessage("Journey archived.");
    } catch (error) {
      setErrorMessage(toJourneyErrorMessage(error));
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleSaveRecordedClip(payload: {
    uri: string;
    durationMs: number;
    recordedAt: string;
  }): Promise<{ success: boolean; errorMessage?: string }> {
    if (!recorderJourneyId) {
      return { success: false, errorMessage: "No journey selected." };
    }

    setClipSaving(true);
    setErrorMessage(null);
    setStatusMessage(null);
    setRecorderStatusMessage("Requesting upload URL...");
    try {
      const upload = await requestClipUploadUrl(token, recorderJourneyId, {
        mimeType: "video/mp4",
        fileExtension: "mp4"
      });

      setRecorderStatusMessage("Uploading clip...");
      await uploadClipFile({
        token,
        uploadUrl: upload.uploadUrl,
        fileField: upload.fileField,
        fileUri: payload.uri,
        mimeType: "video/mp4"
      });

      setRecorderStatusMessage("Finalizing timeline...");
      const dayOffset = devDateShiftSettings.enabled ? devDateShiftSettings.dayOffset : 0;
      const effectiveRecordedAt = applyDayOffset(payload.recordedAt, dayOffset);

      await createClip(token, recorderJourneyId, {
        uploadId: upload.uploadId,
        durationMs: payload.durationMs,
        recordedAt: effectiveRecordedAt
      });

      const refreshed = await loadJourneyClips(recorderJourneyId);
      const dayCount = getDayCount(refreshed);
      const streak = getCurrentStreak(refreshed);
      const unlockedMilestone = getUnlockedMilestone(dayCount);
      const newestClip = refreshed[0] ?? null;

      onActiveJourneyChange(recorderJourneyId);
      const message = buildSaveMessage(dayCount, streak, unlockedMilestone?.title ?? null);

      trackEvent("clip_saved", { journeyId: recorderJourneyId, dayCount, streak });
      if (unlockedMilestone) {
        trackEvent("milestone_unlocked", {
          journeyId: recorderJourneyId,
          day: unlockedMilestone.day,
          title: unlockedMilestone.title
        });
      }

      if (newestClip) setRecentlySavedClipId(newestClip.id);
      playSaveMotion(Math.min(6, Math.max(0, dayCount - 1)), Boolean(unlockedMilestone), newestClip?.videoUrl ?? null);
      setStatusMessage(message);
      playCelebration(message);

      if (devDateShiftSettings.enabled && devDateShiftSettings.autoAdvanceAfterSave) {
        void onDevDateShiftSettingsChange({
          ...devDateShiftSettings,
          dayOffset: devDateShiftSettings.dayOffset + 1
        });
      }

      setRecorderJourneyId(null);
      setRecorderStatusMessage(null);
      return { success: true };
    } catch (error) {
      const message = toJourneyErrorMessage(error);
      setErrorMessage(message);
      setRecorderStatusMessage(null);
      console.error("clip save failed", error);
      return { success: false, errorMessage: message };
    } finally {
      setClipSaving(false);
    }
  }

  const activeJourney = useMemo(
    () => (activeJourneyId ? journeys.find((journey) => journey.id === activeJourneyId) ?? null : null),
    [journeys, activeJourneyId]
  );

  const effectiveNow = useMemo(() => {
    if (!devDateShiftSettings.enabled || !devDateShiftSettings.dayOffset) return new Date();
    const next = new Date();
    next.setDate(next.getDate() + devDateShiftSettings.dayOffset);
    return next;
  }, [devDateShiftSettings.enabled, devDateShiftSettings.dayOffset]);

  const activeJourneyClips = activeJourney ? clipsByJourney[activeJourney.id] ?? [] : [];
  const clipsLoading = activeJourney ? Boolean(clipsLoadingByJourney[activeJourney.id]) : false;
  const activeDayCount = getDayCount(activeJourneyClips);
  const activeStreak = getCurrentStreak(activeJourneyClips, effectiveNow);
  const practicedToday = hasClipToday(activeJourneyClips, effectiveNow);
  const nextMilestone = getNextMilestone(activeDayCount);
  const practiceDots = Math.min(7, activeDayCount);

  const recorderJourney = recorderJourneyId ? journeys.find((journey) => journey.id === recorderJourneyId) ?? null : null;
  const recorderClips = recorderJourney ? clipsByJourney[recorderJourney.id] ?? [] : [];
  const recorderDay = Math.max(1, getDayCount(recorderClips) + (hasClipToday(recorderClips, effectiveNow) ? 0 : 1));
  const recorderReferenceClipUrl = recorderClips[0]?.videoUrl ?? null;

  const heroMessage = buildHeroMessage(practicedToday, activeStreak, activeDayCount);
  const todayPrompt = getTodayPrompt(activeDayCount, activeJourney?.id ?? null);

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.headerBlock}>
          <Text style={styles.title}>Practice</Text>
          <Text style={styles.subtitle}>Show up today. Watch your skill sharpen.</Text>
          {__DEV__ && devDateShiftSettings.enabled ? (
            <Text style={styles.devHintText}>
              Dev date shift active: {devDateShiftSettings.dayOffset >= 0 ? "+" : ""}
              {devDateShiftSettings.dayOffset} day{Math.abs(devDateShiftSettings.dayOffset) === 1 ? "" : "s"}
              {devDateShiftSettings.autoAdvanceAfterSave ? " • auto-advance on" : ""}
            </Text>
          ) : null}
        </View>

        {celebrationText ? (
          <Animated.View style={[styles.celebrationBanner, { opacity: celebrationOpacity, transform: [{ translateY: celebrationY }] }]}>
            <Text style={styles.celebrationText}>{celebrationText}</Text>
          </Animated.View>
        ) : null}

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        {statusMessage ? <Text style={styles.statusText}>{statusMessage}</Text> : null}
        {loading ? <Text style={styles.mutedText}>Loading your practice space...</Text> : null}

        {activeJourney ? (
          <PracticeHeroCard
            title={activeJourney.title}
            practicedToday={practicedToday}
            dayCount={activeDayCount}
            streak={activeStreak}
            heroMessage={heroMessage}
            todayPrompt={todayPrompt}
            statPulse={statPulse}
            milestonePulse={milestonePulse}
            milestoneFlash={milestoneFlash}
            nextMilestone={nextMilestone}
            onRecord={() => {
              trackEvent("record_tapped", { journeyId: activeJourney.id, context: "practice_hero" });
              setRecorderJourneyId(activeJourney.id);
            }}
          />
        ) : !loading ? (
          <View style={styles.emptyHeroCard}>
            <Text style={styles.emptyHeroTitle}>Your journey starts today</Text>
            <Text style={styles.emptyHeroSubtitle}>Create a skill journey and record your first practice clip.</Text>
            <ActionButton label="Create First Journey" variant="primary" onPress={() => setManageOpen(true)} />
          </View>
        ) : null}

        {activeJourney ? (
          <PracticeProgressPreviewCard
            clips={activeJourneyClips}
            loading={clipsLoading}
            practiceDots={practiceDots}
            recentlyFilledDotIndex={recentlyFilledDotIndex}
            dotFillProgress={dotFillProgress}
            newestClipReveal={newestClipReveal}
            recentlySavedClipId={recentlySavedClipId}
            onOpenTimeline={() => setTimelineOpen(true)}
            onOpenClip={(clip) => setActiveClip(clip)}
            onOpenProgress={() => onOpenProgress(activeJourney.id)}
          />
        ) : null}

        {activeJourney ? (
          <Pressable style={({ pressed }) => [styles.manageInlineLink, pressed ? styles.pressed : undefined]} onPress={() => setManageOpen(true)}>
            <Text style={styles.manageInlineLinkText}>Manage journeys</Text>
          </Pressable>
        ) : null}
      </ScrollView>

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
        onTitleChange={setNewTitle}
        onCategoryChange={setNewCategory}
        onGoalTextChange={setNewGoalText}
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
        referenceClipUrl={recorderReferenceClipUrl}
        onCancel={() => {
          if (clipSaving) return;
          setRecorderJourneyId(null);
          setRecorderStatusMessage(null);
        }}
        onSave={handleSaveRecordedClip}
      />

      <ClipViewerModal clip={activeClip} onClose={() => setActiveClip(null)} />

      <TimelineModal
        visible={timelineOpen}
        clips={activeJourneyClips}
        onClose={() => setTimelineOpen(false)}
        onSelectClip={(clip) => setActiveClip(clip)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 22
  },
  headerBlock: {
    marginTop: 6
  },
  title: {
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "800",
    color: theme.colors.textPrimary
  },
  subtitle: {
    marginTop: 6,
    fontSize: 16,
    color: theme.colors.textSecondary
  },
  devHintText: {
    marginTop: 5,
    color: theme.colors.accentStrong,
    fontSize: 12,
    fontWeight: "700"
  },
  celebrationBanner: {
    marginTop: 14,
    borderRadius: 16,
    backgroundColor: "rgba(13,159,101,0.14)",
    borderWidth: 1,
    borderColor: "rgba(13,159,101,0.36)",
    paddingVertical: 10,
    paddingHorizontal: 12
  },
  celebrationText: {
    color: theme.colors.success,
    fontWeight: "800",
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
  emptyHeroCard: {
    marginTop: 24,
    borderRadius: 28,
    backgroundColor: "rgba(252,255,255,0.86)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.86)",
    padding: 20,
    shadowColor: "#113761",
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 7
  },
  emptyHeroTitle: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: "800",
    color: theme.colors.textPrimary
  },
  emptyHeroSubtitle: {
    marginTop: 8,
    fontSize: 17,
    color: theme.colors.textSecondary,
    fontWeight: "700"
  },
  manageInlineLink: {
    marginTop: 12,
    alignSelf: "center",
    paddingVertical: 6,
    paddingHorizontal: 8
  },
  manageInlineLinkText: {
    color: theme.colors.textSecondary,
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
  pressed: {
    transform: [{ scale: 0.98 }]
  }
});
