import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Dimensions } from "react-native";

import { trackEvent } from "../../analytics/events";
import { listClips } from "../../api/clips";
import { archiveJourney, createJourney, listJourneys } from "../../api/journeys";
import { readAutoReminderSetupCompleted, writeAutoReminderSetupCompleted } from "../../storage/autoReminderSetupStorage";
import { enqueueClipUpload, getPendingClipUploadCount, processClipUploadQueue, type ClipUploadQueueStatus } from "../../storage/clipUploadQueue";
import { theme } from "../../theme";
import type { Clip } from "../../types/clip";
import type { DevDateShiftSettings } from "../../types/devTools";
import type { Journey } from "../../types/journey";
import { triggerMilestoneHaptic, triggerSaveHaptic, playSaveSound } from "../../utils/feedback";
import { useReducedMotion } from "../../utils/useReducedMotion";
import {
  buildPracticeHeatmap,
  getChapterDayCount,
  getChapterStreak,
  getDayCount,
  hasChapterClipToday,
  getMilestoneChapterProgress,
  getUnlockedMilestone,
  hasClipToday,
  milestoneLengthOptions
} from "../../utils/progress";
import { buildSaveCelebration, toJourneyErrorMessage } from "./helpers";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

type UsePracticeStateParams = {
  token: string;
  activeJourneyId: string | null;
  onActiveJourneyChange: (journeyId: string | null) => void;
  mediaMode: "video" | "photo";
  devDateShiftSettings: DevDateShiftSettings;
  onDevDateShiftSettingsChange: (next: DevDateShiftSettings) => void;
  recordingsRevision: number;
};

type CelebrationState = {
  title: string;
  subtitle: string;
};

type CaptureMode = "video" | "photo";
type CaptureType = "video" | "photo";

function toLocalDayKey(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function applyDayOffset(value: string, dayOffset: number) {
  if (!dayOffset) return value;
  const base = new Date(value);
  if (Number.isNaN(base.getTime())) return value;
  base.setDate(base.getDate() + dayOffset);
  return base.toISOString();
}

function applyDayOffsetToDayKey(value: string, dayOffset: number) {
  if (!dayOffset) return value;
  const [yearRaw, monthRaw, dayRaw] = value.split("-").map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(yearRaw) || !Number.isFinite(monthRaw) || !Number.isFinite(dayRaw)) return value;
  const base = new Date(yearRaw, monthRaw - 1, dayRaw);
  if (Number.isNaN(base.getTime())) return value;
  base.setDate(base.getDate() + dayOffset);
  return toLocalDayKey(base);
}

function toUploadStatusMessage(status: ClipUploadQueueStatus) {
  switch (status) {
    case "queued":
      return "Sync queued...";
    case "uploading":
      return "Syncing take...";
    case "uploaded":
      return "Sync complete.";
    case "processing":
      return "Finalizing chapter...";
    case "ready":
      return "Take ready.";
    case "failed":
      return "Sync failed. Retrying in background...";
    default:
      return null;
  }
}

export function usePracticeState({
  token,
  activeJourneyId,
  onActiveJourneyChange,
  mediaMode,
  devDateShiftSettings,
  onDevDateShiftSettingsChange,
  recordingsRevision
}: UsePracticeStateParams) {
  const reducedMotion = useReducedMotion();
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
  const [newMilestoneLengthDays, setNewMilestoneLengthDays] = useState<number>(7);
  const [newCaptureMode, setNewCaptureMode] = useState<CaptureMode>("video");
  const [newSkillPack, setNewSkillPack] = useState<Journey["skillPack"]>("fitness");

  const [clipsByJourney, setClipsByJourney] = useState<Record<string, Clip[]>>({});
  const [clipsLoadingByJourney, setClipsLoadingByJourney] = useState<Record<string, boolean>>({});
  const [activeClip, setActiveClip] = useState<Clip | null>(null);

  const [recorderJourneyId, setRecorderJourneyId] = useState<string | null>(null);
  const [clipSaving, setClipSaving] = useState(false);
  const [recorderStatusMessage, setRecorderStatusMessage] = useState<string | null>(null);
  const [pendingUploadCount, setPendingUploadCount] = useState(0);
  const [retryingPendingUploads, setRetryingPendingUploads] = useState(false);
  const [pendingUploadStatusMessage, setPendingUploadStatusMessage] = useState<string | null>(null);
  const [autoReminderSuggestion, setAutoReminderSuggestion] = useState<{ hour: number; minute: number } | null>(null);
  const autoReminderSetupLoadedRef = useRef(false);
  const autoReminderSetupCompletedRef = useRef(false);

  const [celebration, setCelebration] = useState<CelebrationState | null>(null);
  const [recentlyFilledDotIndex, setRecentlyFilledDotIndex] = useState<number | null>(null);
  const [milestoneFlash, setMilestoneFlash] = useState(false);

  const celebrationOpacity = useRef(new Animated.Value(0)).current;
  const celebrationY = useRef(new Animated.Value(14)).current;
  const statPulse = useRef(new Animated.Value(1)).current;
  const dotFillProgress = useRef(new Animated.Value(1)).current;
  const milestonePulse = useRef(new Animated.Value(1)).current;

  const saveFlightOpacity = useRef(new Animated.Value(0)).current;
  const saveFlightX = useRef(new Animated.Value(0)).current;
  const saveFlightY = useRef(new Animated.Value(0)).current;
  const saveFlightScale = useRef(new Animated.Value(1)).current;
  const [saveFlightClipUrl, setSaveFlightClipUrl] = useState<string | null>(null);
  const duration = (ms: number) => (reducedMotion ? 0 : ms);

  function resolveCaptureType(journey: Journey | null): CaptureType {
    if (!journey) return "video";
    return journey.captureMode;
  }

  function playCelebration(nextCelebration: CelebrationState) {
    setCelebration(nextCelebration);
    if (reducedMotion) {
      setTimeout(() => {
        setCelebration(null);
      }, theme.motion.rewardMs);
      return;
    }
    celebrationOpacity.setValue(0);
    celebrationY.setValue(14);
    Animated.sequence([
      Animated.parallel([
        Animated.timing(celebrationOpacity, { toValue: 1, duration: duration(theme.motion.microMs), useNativeDriver: true }),
        Animated.timing(celebrationY, { toValue: 0, duration: duration(theme.motion.microMs), useNativeDriver: true })
      ]),
      Animated.delay(duration(theme.motion.rewardMs)),
      Animated.parallel([
        Animated.timing(celebrationOpacity, { toValue: 0, duration: duration(theme.motion.transitionMs), useNativeDriver: true }),
        Animated.timing(celebrationY, { toValue: -8, duration: duration(theme.motion.transitionMs), useNativeDriver: true })
      ])
    ]).start(() => {
      setCelebration(null);
    });
  }

  function playSaveMotion(filledDotIndex: number, unlockedMilestone: boolean, clipUrl: string | null) {
    triggerSaveHaptic();
    playSaveSound();
    setRecentlyFilledDotIndex(filledDotIndex);
    dotFillProgress.setValue(reducedMotion ? 1 : 0);
    statPulse.setValue(reducedMotion ? 1 : 0.94);

    Animated.parallel([
      Animated.timing(dotFillProgress, {
        toValue: 1,
        duration: duration(theme.motion.rewardMs),
        useNativeDriver: true
      }),
      Animated.sequence([
        Animated.timing(statPulse, {
          toValue: 1.06,
          duration: duration(theme.motion.microMs),
          useNativeDriver: true
        }),
        Animated.timing(statPulse, {
          toValue: 1,
          duration: duration(theme.motion.microMs + 20),
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
          duration: duration(theme.motion.transitionMs + 140),
          useNativeDriver: true
        }),
        Animated.timing(saveFlightY, {
          toValue: -Math.max(210, SCREEN_HEIGHT * 0.32),
          duration: duration(theme.motion.transitionMs + 140),
          useNativeDriver: true
        }),
        Animated.timing(saveFlightScale, {
          toValue: 0.35,
          duration: duration(theme.motion.transitionMs + 140),
          useNativeDriver: true
        }),
        Animated.sequence([
          Animated.delay(duration(theme.motion.microMs + 80)),
          Animated.timing(saveFlightOpacity, {
            toValue: 0,
            duration: duration(theme.motion.microMs + 10),
            useNativeDriver: true
          })
        ])
      ]).start(() => {
        setSaveFlightClipUrl(null);
      });
    }

    if (unlockedMilestone) {
      triggerMilestoneHaptic();
      setMilestoneFlash(true);
      milestonePulse.setValue(reducedMotion ? 1 : 0.96);
      Animated.sequence([
        Animated.timing(milestonePulse, {
          toValue: 1.05,
          duration: duration(theme.motion.microMs + 40),
          useNativeDriver: true
        }),
        Animated.timing(milestonePulse, {
          toValue: 1,
          duration: duration(theme.motion.microMs + 40),
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
      const allJourneys = response.journeys;
      if (allJourneys.length === 0) {
        onActiveJourneyChange(null);
      } else {
        const activeStillExists = Boolean(activeJourneyId) && allJourneys.some((journey) => journey.id === activeJourneyId);
        if (!activeStillExists) {
          onActiveJourneyChange(allJourneys[0].id);
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
      // Mark as loaded with an empty list to avoid retry loops spamming errors on every render.
      setClipsByJourney((current) => ({ ...current, [journeyId]: current[journeyId] ?? [] }));
      setErrorMessage(toJourneyErrorMessage(error));
      return [] as Clip[];
    } finally {
      setClipsLoadingByJourney((current) => ({ ...current, [journeyId]: false }));
    }
  }

  async function refreshPendingUploadCount() {
    try {
      const pending = await getPendingClipUploadCount();
      setPendingUploadCount(pending);
      return pending;
    } catch {
      return 0;
    }
  }

  useEffect(() => {
    void loadJourneys();
    void refreshPendingUploadCount();
  }, [token, mediaMode]);

  useEffect(() => {
    let cancelled = false;
    async function loadAutoReminderSetupState() {
      const completed = await readAutoReminderSetupCompleted();
      if (cancelled) return;
      autoReminderSetupCompletedRef.current = completed;
      autoReminderSetupLoadedRef.current = true;
    }
    void loadAutoReminderSetupState();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setClipsByJourney({});
    setClipsLoadingByJourney({});
    if (activeJourneyId) {
      void loadJourneyClips(activeJourneyId);
    }
    void refreshPendingUploadCount();
  }, [recordingsRevision]);

  useEffect(() => {
    if (!activeJourneyId) return;
    const hasClips = Boolean(clipsByJourney[activeJourneyId]);
    const loadingClips = Boolean(clipsLoadingByJourney[activeJourneyId]);
    if (!hasClips && !loadingClips) {
      void loadJourneyClips(activeJourneyId);
    }
  }, [activeJourneyId, clipsByJourney, clipsLoadingByJourney]);

  useEffect(() => {
    setNewCaptureMode(mediaMode);
  }, [mediaMode]);

  useEffect(() => {
    let cancelled = false;

    async function flushQueue() {
      const result = await processClipUploadQueue(token, {
        onEvent: (event) => {
          if (cancelled) return;
          if (event.type === "success") {
            void applyClipSavedState(event.journeyId, "background");
          }
        }
      });
      if (cancelled) return;
      setPendingUploadCount(result.remaining);
    }

    void flushQueue();
    const timer = setInterval(() => {
      void flushQueue();
    }, 15000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [token, activeJourneyId]);

  async function handleRetryPendingUploads() {
    if (retryingPendingUploads) return;
    setRetryingPendingUploads(true);
    setPendingUploadStatusMessage(null);
    setErrorMessage(null);
    try {
      const before = await refreshPendingUploadCount();
      const result = await processClipUploadQueue(token, {
        onEvent: (event) => {
          if (event.type === "success") {
            void applyClipSavedState(event.journeyId, "background");
          }
        }
      });
      setPendingUploadCount(result.remaining);
      if (before === 0) {
        setPendingUploadStatusMessage("Sync queue is clear.");
        return;
      }
      if (result.remaining === 0) {
        setPendingUploadStatusMessage(`Sync complete (${result.succeeded}).`);
        return;
      }
      if (result.succeeded > 0) {
        setPendingUploadStatusMessage(`Synced ${result.succeeded}. ${result.remaining} still waiting.`);
        return;
      }
      setPendingUploadStatusMessage(`${result.remaining} takes still waiting.`);
    } catch (error) {
      const raw = error instanceof Error ? error.message : "Unexpected retry error";
      setPendingUploadStatusMessage(`Retry failed: ${raw}`);
    } finally {
      setRetryingPendingUploads(false);
    }
  }

  async function handleCreateJourney() {
    const title = newTitle.trim();
    if (!title) {
      setErrorMessage("Journey name is required.");
      return;
    }

    setCreating(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const response = await createJourney(token, {
        title,
        skillPack: newSkillPack,
        category: newCategory.trim() || null,
        goalText: newGoalText.trim() || null,
        captureMode: newCaptureMode,
        milestoneLengthDays: milestoneLengthOptions.includes(newMilestoneLengthDays as (typeof milestoneLengthOptions)[number])
          ? newMilestoneLengthDays
          : 7
      });
      const createdJourney = response.journey;
      setJourneys((current) => [createdJourney, ...current]);
      onActiveJourneyChange(createdJourney.id);
      setManageOpen(false);
      setRecorderStatusMessage(null);
      setRecorderJourneyId(createdJourney.id);
      trackEvent("record_tapped", { journeyId: createdJourney.id, context: "journey_create_instant_start" });
      setNewTitle("");
      setNewCategory("");
      setNewGoalText("");
      setNewMilestoneLengthDays(7);
      setNewCaptureMode(mediaMode);
      setNewSkillPack("fitness");
      setStatusMessage("Journey live. Day 1 camera is open.");
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
      const remainingModeJourneys = remainingJourneys;
      setJourneys(remainingJourneys);
      setClipsByJourney((current) => {
        const next = { ...current };
        delete next[journeyId];
        return next;
      });
      if (activeJourneyId === journeyId) {
        onActiveJourneyChange(remainingModeJourneys[0]?.id ?? null);
      }
      setStatusMessage("Journey archived.");
    } catch (error) {
      setErrorMessage(toJourneyErrorMessage(error));
    } finally {
      setUpdatingId(null);
    }
  }

  async function applyClipSavedState(journeyId: string, source: "foreground" | "background") {
    const refreshed = await loadJourneyClips(journeyId);
    const journeyForSavedClip = journeys.find((journey) => journey.id === journeyId) ?? null;
    const journeyRule = journeyForSavedClip ? { captureMode: journeyForSavedClip.captureMode } : null;
    const dayCount = journeyRule ? getChapterDayCount(refreshed, journeyRule) : getDayCount(refreshed);
    const streak = journeyRule ? getChapterStreak(refreshed, journeyRule, effectiveNow) : 0;
    if (__DEV__) console.log("[ClipSaved] journeyId:", journeyId, "clipCount:", refreshed.length, "dayCount:", dayCount, "streak:", streak, "captureMode:", journeyRule?.captureMode, "clipTypes:", refreshed.map(c => c.captureType).join(","));
    const unlockedMilestone = getUnlockedMilestone(dayCount);
    const newestClip = refreshed[0] ?? null;
    const celebrationPayload = buildSaveCelebration(dayCount, streak, unlockedMilestone?.title ?? null);

    trackEvent("clip_saved", { journeyId, dayCount, streak, source });
    if (unlockedMilestone) {
      trackEvent("milestone_unlocked", {
        journeyId,
        day: unlockedMilestone.day,
        title: unlockedMilestone.title,
        source
      });
    }

    if (source === "foreground") {
      playSaveMotion(Math.min(6, Math.max(0, dayCount - 1)), Boolean(unlockedMilestone), newestClip?.videoUrl ?? null);
      playCelebration(celebrationPayload);
    } else if (journeyId === activeJourneyId) {
      setStatusMessage("Queued take synced to this chapter.");
    }

    // Delay auto-advance so recorder closes first
    if (source === "foreground" && devDateShiftSettings.enabled && devDateShiftSettings.autoAdvanceAfterSave) {
      setTimeout(() => {
        void onDevDateShiftSettingsChange({
          ...devDateShiftSettings,
          dayOffset: devDateShiftSettings.dayOffset + 1
        });
      }, 600);
    }
    return {
      clipCount: refreshed.length
    };
  }

  async function handleSaveRecordedClip(payload: {
    uri: string;
    durationMs: number;
    recordedAt: string;
    recordedOn: string;
    captureType: CaptureType;
  }): Promise<{ success: boolean; errorMessage?: string }> {
    if (!recorderJourneyId) {
      return { success: false, errorMessage: "No journey selected." };
    }

    setClipSaving(true);
    setErrorMessage(null);
    setStatusMessage(null);
    setRecorderStatusMessage("Saving take locally...");
    const journeyId = recorderJourneyId;
    const dayOffset = devDateShiftSettings.enabled ? devDateShiftSettings.dayOffset : 0;
    const effectiveRecordedAt = applyDayOffset(payload.recordedAt, dayOffset);
    const effectiveRecordedOn = applyDayOffsetToDayKey(payload.recordedOn, dayOffset);
    try {
      const queuedItem = await enqueueClipUpload({
        journeyId,
        captureType: payload.captureType,
        fileUri: payload.uri,
        durationMs: payload.durationMs,
        recordedAt: effectiveRecordedAt,
        recordedOn: effectiveRecordedOn
      });
      setPendingUploadCount((value) => value + 1);
      setRecorderStatusMessage("Sync queued...");
      trackEvent("clip_upload_queued", { journeyId: queuedItem.journeyId });

      const processed = await processClipUploadQueue(token, {
        targetItemId: queuedItem.id,
        onEvent: (event) => {
          if (event.itemId !== queuedItem.id) return;
          if (event.type === "status") {
            setRecorderStatusMessage(toUploadStatusMessage(event.status));
            return;
          }
          if (event.type === "failed") {
            setRecorderStatusMessage("Sync failed. Retrying in background...");
            return;
          }
          if (event.type === "success") {
            setRecorderStatusMessage("Chapter updated.");
          }
        }
      });

      if (!processed.target?.success) {
        setStatusMessage("Take saved locally. Sync will retry in the background.");
        setPendingUploadStatusMessage("Take saved locally. Sync queued in background.");
        await refreshPendingUploadCount();
        setRecorderJourneyId(null);
        setRecorderStatusMessage(null);
        return { success: true };
      }

      onActiveJourneyChange(journeyId);
      const saveState = await applyClipSavedState(journeyId, "foreground");
      if (
        autoReminderSetupLoadedRef.current &&
        !autoReminderSetupCompletedRef.current &&
        !autoReminderSuggestion &&
        saveState.clipCount === 1
      ) {
        const capturedAt = new Date(effectiveRecordedAt);
        if (!Number.isNaN(capturedAt.getTime())) {
          setAutoReminderSuggestion({
            hour: capturedAt.getHours(),
            minute: capturedAt.getMinutes()
          });
        }
      }
      setRecorderJourneyId(null);
      setRecorderStatusMessage(null);
      return { success: true };
    } catch (error) {
      const message = toJourneyErrorMessage(error);
      setErrorMessage(message);
      setRecorderStatusMessage(null);
      if (__DEV__) console.error("clip save failed", error);
      return { success: false, errorMessage: message };
    } finally {
      setClipSaving(false);
    }
  }

  const modeJourneys = useMemo(() => journeys, [journeys]);
  const activeJourney = useMemo(
    () => (activeJourneyId ? modeJourneys.find((journey) => journey.id === activeJourneyId) ?? null : null),
    [modeJourneys, activeJourneyId]
  );

  const effectiveNow = useMemo(() => {
    if (!devDateShiftSettings.enabled || !devDateShiftSettings.dayOffset) return new Date();
    const next = new Date();
    next.setDate(next.getDate() + devDateShiftSettings.dayOffset);
    return next;
  }, [devDateShiftSettings.enabled, devDateShiftSettings.dayOffset]);

  const activeJourneyClips = activeJourney ? clipsByJourney[activeJourney.id] ?? [] : [];
  const clipsLoading = activeJourney ? Boolean(clipsLoadingByJourney[activeJourney.id]) : false;
  const chapterRule = activeJourney ? { captureMode: activeJourney.captureMode } : null;
  const activeDayCount = chapterRule ? getChapterDayCount(activeJourneyClips, chapterRule) : getDayCount(activeJourneyClips);
  const activeStreak = chapterRule ? getChapterStreak(activeJourneyClips, chapterRule, effectiveNow) : 0;
  const practicedToday = chapterRule ? hasChapterClipToday(activeJourneyClips, chapterRule, effectiveNow) : hasClipToday(activeJourneyClips, effectiveNow);
  const practiceDots = Math.min(7, activeDayCount);
  const milestoneProgress = activeJourney
    ? getMilestoneChapterProgress(activeDayCount, {
        milestoneLengthDays: activeJourney.milestoneLengthDays,
        milestoneStartDay: activeJourney.milestoneStartDay,
        milestoneChapter: activeJourney.milestoneChapter
      })
    : null;
  const practiceHeatmapCells = buildPracticeHeatmap(activeJourneyClips, 4, effectiveNow);

  const recorderJourney = recorderJourneyId ? journeys.find((journey) => journey.id === recorderJourneyId) ?? null : null;
  const recorderClips = recorderJourney ? clipsByJourney[recorderJourney.id] ?? [] : [];
  const recorderCaptureType = resolveCaptureType(recorderJourney);
  const recorderRule = recorderJourney ? { captureMode: recorderJourney.captureMode } : null;
  const recorderQualifiedDayCount = recorderRule ? getChapterDayCount(recorderClips, recorderRule) : getDayCount(recorderClips);
  const recorderHasQualifiedToday = recorderRule ? hasChapterClipToday(recorderClips, recorderRule, effectiveNow) : hasClipToday(recorderClips, effectiveNow);
  const recorderDay = Math.max(1, recorderQualifiedDayCount + (recorderHasQualifiedToday ? 0 : 1));
  const recorderReferenceClipUrl =
    recorderClips.find((clip) => clip.captureType === recorderCaptureType)?.videoUrl ?? recorderClips[0]?.videoUrl ?? null;

  async function acknowledgeAutoReminderSuggestion() {
    setAutoReminderSuggestion(null);
    autoReminderSetupCompletedRef.current = true;
    await writeAutoReminderSetupCompleted();
  }

  return {
    journeys: modeJourneys,
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
    newSkillPack,
    setNewSkillPack,
    clipsByJourney,
    activeClip,
    setActiveClip,
    recorderJourneyId,
    setRecorderJourneyId,
    clipSaving,
    recorderStatusMessage,
    setRecorderStatusMessage,
    pendingUploadCount,
    retryingPendingUploads,
    pendingUploadStatusMessage,
    celebration,
    recentlyFilledDotIndex,
    milestoneFlash,
    celebrationOpacity,
    celebrationY,
    statPulse,
    dotFillProgress,
    milestonePulse,
    saveFlightOpacity,
    saveFlightX,
    saveFlightY,
    saveFlightScale,
    saveFlightClipUrl,
    loadJourneys,
    loadJourneyClips,
    handleCreateJourney,
    handleArchiveJourney,
    handleRetryPendingUploads,
    handleSaveRecordedClip,
    activeJourney,
    clipsLoading,
    activeDayCount,
    activeStreak,
    practicedToday,
    milestoneProgress,
    practiceHeatmapCells,
    practiceDots,
    activeJourneyClips,
    recorderJourney,
    recorderCaptureType,
    recorderDay,
    recorderReferenceClipUrl,
    autoReminderSuggestion,
    acknowledgeAutoReminderSuggestion
  };
}
