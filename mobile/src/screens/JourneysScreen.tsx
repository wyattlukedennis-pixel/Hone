import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { ResizeMode, Video } from "expo-av";

import { trackEvent } from "../analytics/events";
import { createClip, listClips, requestClipUploadUrl, uploadClipFile } from "../api/clips";
import { archiveJourney, createJourney, listJourneys } from "../api/journeys";
import { GlassSurface } from "../components/GlassSurface";
import { PracticeRecorder } from "../components/PracticeRecorder";
import { theme } from "../theme";
import type { Clip } from "../types/clip";
import type { Journey } from "../types/journey";
import {
  buildComparisonPair,
  getCurrentStreak,
  getDayCount,
  getNextMilestone,
  getUnlockedMilestone,
  hasClipToday
} from "../utils/progress";

type JourneysScreenProps = {
  token: string;
  activeJourneyId: string | null;
  onActiveJourneyChange: (journeyId: string | null) => void;
  onOpenProgress: (journeyId: string) => void;
};

type ActionButtonProps = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  fullWidth?: boolean;
};

function ActionButton({
  label,
  onPress,
  variant = "ghost",
  disabled,
  loading,
  loadingLabel,
  fullWidth
}: ActionButtonProps) {
  const text = loading ? loadingLabel ?? "Working..." : label;
  const pressDisabled = Boolean(disabled || loading);

  if (variant === "primary") {
    return (
      <Pressable
        onPress={onPress}
        disabled={pressDisabled}
        style={({ pressed }) => [
          styles.primaryAction,
          fullWidth ? styles.fullWidth : undefined,
          pressed && !pressDisabled ? styles.pressed : undefined,
          pressDisabled ? styles.disabled : undefined
        ]}
      >
        <Text style={styles.primaryActionText}>{text}</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={pressDisabled}
      style={({ pressed }) => [
        styles.ghostAction,
        variant === "danger" ? styles.dangerAction : undefined,
        fullWidth ? styles.fullWidth : undefined,
        pressed && !pressDisabled ? styles.pressed : undefined,
        pressDisabled ? styles.disabled : undefined
      ]}
    >
      <Text style={[styles.ghostActionText, variant === "danger" ? styles.dangerActionText : undefined]}>{text}</Text>
    </Pressable>
  );
}

function formatClipDay(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 10);
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function formatDurationMs(ms: number) {
  return `${Math.max(1, Math.round(ms / 1000))}s`;
}

function toJourneyErrorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : "Unexpected error";
  if (raw === "UNAUTHORIZED") return "Session expired. Please login again.";
  if (raw === "TITLE_REQUIRED") return "Title is required.";
  if (raw === "TITLE_TOO_LONG") return "Title must be 120 characters or fewer.";
  if (raw === "JOURNEY_NOT_FOUND") return "Journey no longer exists.";
  if (raw === "UPLOAD_NOT_READY") return "Upload is still processing. Please retry.";
  if (raw.startsWith("Network request failed")) return raw;
  return raw;
}

const dailyPrompts = [
  "Today's focus: slow it down and keep your form clean.",
  "Today's focus: smoother transitions between movements.",
  "Today's focus: one clean take, not a perfect take.",
  "Today's focus: repeat the hardest part three extra times.",
  "Today's focus: relax your shoulders and breathe while practicing.",
  "Today's focus: keep the same framing so progress is easier to see."
];

function pickLine(lines: string[], seed: number) {
  if (!lines.length) return "";
  const index = Math.abs(seed) % lines.length;
  return lines[index];
}

function buildHeroMessage(practicedToday: boolean, streak: number, dayCount: number) {
  if (practicedToday) {
    return pickLine(
      [
        "Nice work. You showed up today.",
        "Momentum building. Keep this rhythm tomorrow.",
        `Day ${Math.max(dayCount, 1)} is logged. Progress is building.`
      ],
      dayCount + streak
    );
  }

  if (streak > 0) {
    return pickLine(
      [
        `Show up today to protect your ${streak} Day Practice Streak.`,
        "Small progress today keeps your momentum alive.",
        "Consistency builds mastery. Record today's session."
      ],
      streak + dayCount
    );
  }

  return pickLine(
    [
      "Show up today. Sharpen your skill.",
      "Small progress today builds long-term mastery.",
      "Your next clip is the next step forward."
    ],
    dayCount
  );
}

function buildSaveMessage(dayCount: number, streak: number, unlockedMilestoneTitle: string | null) {
  if (unlockedMilestoneTitle) {
    return `Nice. Day ${dayCount} recorded. ${unlockedMilestoneTitle} unlocked.`;
  }
  if (streak > 1) {
    return `Nice. Day ${dayCount} recorded. ${streak} Day Practice Streak.`;
  }
  return `Nice. Day ${dayCount} recorded. Momentum building.`;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export function JourneysScreen({ token, activeJourneyId, onActiveJourneyChange, onOpenProgress }: JourneysScreenProps) {
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
  const timelineModalReveal = useRef(new Animated.Value(0)).current;
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
      await createClip(token, recorderJourneyId, {
        uploadId: upload.uploadId,
        durationMs: payload.durationMs,
        recordedAt: payload.recordedAt
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
        trackEvent("milestone_unlocked", { journeyId: recorderJourneyId, day: unlockedMilestone.day, title: unlockedMilestone.title });
      }
      if (newestClip) {
        setRecentlySavedClipId(newestClip.id);
      }
      playSaveMotion(Math.min(6, Math.max(0, dayCount - 1)), Boolean(unlockedMilestone), newestClip?.videoUrl ?? null);
      setStatusMessage(message);
      playCelebration(message);
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
  const activeJourneyClips = activeJourney ? clipsByJourney[activeJourney.id] ?? [] : [];
  const clipsLoading = activeJourney ? Boolean(clipsLoadingByJourney[activeJourney.id]) : false;
  const activeDayCount = getDayCount(activeJourneyClips);
  const activeStreak = getCurrentStreak(activeJourneyClips);
  const practicedToday = hasClipToday(activeJourneyClips);
  const hasComparisonReady = Boolean(buildComparisonPair(activeJourneyClips, "day1"));
  const nextMilestone = getNextMilestone(activeDayCount);
  const timelinePreview = activeJourneyClips.slice(0, 4);
  const practiceDots = Math.min(7, activeDayCount);
  const recorderJourney = recorderJourneyId ? journeys.find((journey) => journey.id === recorderJourneyId) ?? null : null;
  const recorderClips = recorderJourney ? clipsByJourney[recorderJourney.id] ?? [] : [];
  const recorderDay = Math.max(1, getDayCount(recorderClips) + (hasClipToday(recorderClips) ? 0 : 1));
  const recorderReferenceClipUrl = recorderClips[0]?.videoUrl ?? null;
  const heroMessage = buildHeroMessage(practicedToday, activeStreak, activeDayCount);
  const progressHint = hasComparisonReady ? "View progress reveal" : "Record one more day to unlock Then vs Now";
  const todayPrompt = useMemo(() => {
    const dayOfMonth = Number(new Date().toISOString().slice(8, 10)) || 1;
    const seed = dayOfMonth + activeDayCount + (activeJourney?.id.length ?? 0);
    return pickLine(dailyPrompts, seed);
  }, [activeDayCount, activeJourney?.id]);

  useEffect(() => {
    if (!timelineOpen) return;
    timelineModalReveal.setValue(0);
    Animated.timing(timelineModalReveal, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true
    }).start();
  }, [timelineOpen, timelineModalReveal]);

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.headerBlock}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Practice</Text>
            <Pressable style={({ pressed }) => [styles.manageTrigger, pressed ? styles.pressed : undefined]} onPress={() => setManageOpen(true)}>
              <Text style={styles.manageTriggerText}>Manage</Text>
            </Pressable>
          </View>
          <Text style={styles.subtitle}>Show up today. Watch your skill sharpen.</Text>
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
          <View style={styles.heroCard}>
            <Text style={styles.heroOverline}>Active Skill</Text>
            <Text style={styles.heroTitle}>{activeJourney.title}</Text>
            <Text style={styles.heroSubtitle}>{heroMessage}</Text>
            <Animated.View style={[styles.heroStatsRow, { transform: [{ scale: statPulse }] }]}>
              <View style={styles.heroStatPill}>
                <Text style={styles.heroStatLabel}>Day</Text>
                <Text style={styles.heroStatValue}>{Math.max(activeDayCount, 1)}</Text>
              </View>
              <View style={styles.heroStatPill}>
                <Text style={styles.heroStatLabel}>Streak</Text>
                <Text style={styles.heroStatValue}>{activeStreak} days</Text>
              </View>
              <View style={styles.heroStatPill}>
                <Text style={styles.heroStatLabel}>Today</Text>
                <Text style={styles.heroStatValue}>{practicedToday ? "Done" : "Open"}</Text>
              </View>
            </Animated.View>

            <ActionButton
              label={practicedToday ? "Record Again Today" : "Record Today"}
              variant="primary"
              fullWidth
              onPress={() => {
                trackEvent("record_tapped", { journeyId: activeJourney.id, context: "practice_hero" });
                setRecorderJourneyId(activeJourney.id);
              }}
            />
            <Pressable
              style={({ pressed }) => [styles.secondaryLink, pressed ? styles.pressed : undefined]}
              onPress={() => {
                onOpenProgress(activeJourney.id);
              }}
            >
              <Text style={[styles.secondaryLinkText, !hasComparisonReady ? styles.secondaryLinkTextDisabled : undefined]}>{progressHint}</Text>
            </Pressable>
            <Animated.View
              style={[
                styles.milestoneHintWrap,
                milestoneFlash ? styles.milestoneHintWrapActive : undefined,
                { transform: [{ scale: milestonePulse }] }
              ]}
            >
              {nextMilestone ? (
                <Text style={styles.milestoneHint}>
                  Next unlock: Day {nextMilestone.day} • {nextMilestone.title} ({nextMilestone.remainingDays} day
                  {nextMilestone.remainingDays === 1 ? "" : "s"} to go)
                </Text>
              ) : (
                <Text style={styles.milestoneHint}>All current milestones unlocked. Keep showing up.</Text>
              )}
            </Animated.View>
          </View>
        ) : !loading ? (
          <View style={styles.heroCard}>
            <Text style={styles.heroTitle}>Your journey starts today</Text>
            <Text style={styles.heroSubtitle}>Create a skill journey and record your first practice clip.</Text>
            <ActionButton
              label="Create First Journey"
              variant="primary"
              onPress={() => {
                setManageOpen(true);
              }}
            />
          </View>
        ) : null}

        {activeJourney ? (
          <GlassSurface style={styles.promptCard}>
            <Text style={styles.promptKicker}>Today's Focus</Text>
            <Text style={styles.promptText}>{todayPrompt}</Text>
          </GlassSurface>
        ) : null}

        {activeJourney ? (
          <GlassSurface style={styles.timelineCard}>
            <View style={styles.timelineHeader}>
              <Text style={styles.sectionTitle}>Recent Practice</Text>
              <Pressable style={({ pressed }) => [styles.timelineExpandButton, pressed ? styles.pressed : undefined]} onPress={() => setTimelineOpen(true)}>
                <Text style={styles.timelineExpandButtonText}>Expand</Text>
              </Pressable>
            </View>
            <View style={styles.dotsRow}>
              {Array.from({ length: 7 }).map((_, index) => (
                <View key={index} style={styles.dotShell}>
                  {index < practiceDots ? (
                    index === recentlyFilledDotIndex ? (
                      <Animated.View
                        style={[
                          styles.dotFilled,
                          {
                            opacity: dotFillProgress,
                            transform: [
                              {
                                scale: dotFillProgress.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0.2, 1]
                                })
                              }
                            ]
                          }
                        ]}
                      />
                    ) : (
                      <View style={styles.dotFilled} />
                    )
                  ) : null}
                </View>
              ))}
            </View>
            {clipsLoading ? <Text style={styles.mutedText}>Loading clips...</Text> : null}
            {!clipsLoading && timelinePreview.length === 0 ? (
              <Text style={styles.emptyText}>Record your first clip to begin your daily timeline.</Text>
            ) : null}
            {!clipsLoading
              ? timelinePreview.map((clip) => {
                  const isNewestSaved = clip.id === recentlySavedClipId;
                  const row = (
                    <Pressable style={({ pressed }) => [styles.clipRow, pressed ? styles.pressed : undefined]} onPress={() => setActiveClip(clip)}>
                      <View style={styles.clipMain}>
                        <Text style={styles.clipTitle}>{formatClipDay(clip.recordedOn)}</Text>
                        <Text style={styles.clipMeta}>
                          {formatDurationMs(clip.durationMs)} • {new Date(clip.recordedAt).toLocaleTimeString()}
                        </Text>
                      </View>
                    </Pressable>
                  );
                  if (!isNewestSaved) {
                    return <View key={clip.id}>{row}</View>;
                  }
                  return (
                    <Animated.View
                      key={clip.id}
                      style={{
                        opacity: newestClipReveal,
                        transform: [
                          {
                            translateX: newestClipReveal.interpolate({
                              inputRange: [0, 1],
                              outputRange: [18, 0]
                            })
                          }
                        ]
                      }}
                    >
                      {row}
                    </Animated.View>
                  );
                })
              : null}
          </GlassSurface>
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
          <Video source={{ uri: saveFlightClipUrl }} style={styles.saveFlightVideo} resizeMode={ResizeMode.COVER} />
        </Animated.View>
      ) : null}

      <Modal visible={manageOpen} animationType="slide" transparent onRequestClose={() => setManageOpen(false)}>
        <View style={styles.manageModalBackdrop}>
          <GlassSurface style={styles.manageModalCard}>
            <View style={styles.manageModalHeader}>
              <Text style={styles.manageTitle}>Journey Management</Text>
              <Pressable style={({ pressed }) => [styles.manageClose, pressed ? styles.pressed : undefined]} onPress={() => setManageOpen(false)}>
                <Text style={styles.manageCloseText}>Done</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.manageScrollContent}>
              <Text style={styles.cardTitle}>Start New Journey</Text>
              <TextInput
                style={styles.input}
                placeholder="Title (e.g., Learning Piano)"
                value={newTitle}
                onChangeText={setNewTitle}
                editable={!creating}
                placeholderTextColor="#7b90ab"
              />
              <TextInput
                style={styles.input}
                placeholder="Category (optional)"
                value={newCategory}
                onChangeText={setNewCategory}
                editable={!creating}
                placeholderTextColor="#7b90ab"
              />
              <TextInput
                style={[styles.input, styles.goalInput]}
                placeholder="Goal (optional)"
                value={newGoalText}
                onChangeText={setNewGoalText}
                editable={!creating}
                multiline
                placeholderTextColor="#7b90ab"
              />
              <ActionButton
                label="Create Journey"
                loadingLabel="Creating..."
                variant="primary"
                fullWidth
                onPress={() => {
                  void handleCreateJourney();
                }}
                disabled={creating}
                loading={creating}
              />

              <View style={styles.manageListHeader}>
                <Text style={styles.sectionTitle}>Switch Journey</Text>
                <ActionButton
                  label="Refresh"
                  loading={refreshing}
                  loadingLabel="Refreshing..."
                  onPress={() => {
                    void loadJourneys({ silent: true });
                  }}
                />
              </View>

              {journeys.length === 0 ? <Text style={styles.mutedText}>No journeys yet.</Text> : null}

              {journeys.map((journey) => {
                const isActive = activeJourneyId === journey.id;
                const isBusy = updatingId === journey.id;
                const journeyClips = clipsByJourney[journey.id] ?? [];
                const dayCount = getDayCount(journeyClips);
                const streak = getCurrentStreak(journeyClips);
                return (
                  <View key={journey.id} style={[styles.journeyRow, isActive ? styles.journeyRowActive : undefined]}>
                    <View style={styles.clipMain}>
                      <Text style={styles.journeyTitle}>{journey.title}</Text>
                      <Text style={styles.journeyMeta}>
                        Day {Math.max(dayCount, 1)} • {streak}d streak
                      </Text>
                    </View>
                    <View style={styles.journeyActions}>
                      <ActionButton
                        label={isActive ? "Active" : "Set Active"}
                        onPress={() => {
                          onActiveJourneyChange(journey.id);
                          void loadJourneyClips(journey.id);
                        }}
                        disabled={isActive || isBusy}
                      />
                      <ActionButton
                        label="Record"
                        variant="primary"
                        onPress={() => {
                          onActiveJourneyChange(journey.id);
                          trackEvent("record_tapped", { journeyId: journey.id, context: "journey_manage" });
                          setManageOpen(false);
                          setRecorderJourneyId(journey.id);
                        }}
                        disabled={isBusy}
                      />
                      <ActionButton
                        label="Archive"
                        variant="danger"
                        onPress={() => {
                          void handleArchiveJourney(journey.id);
                        }}
                        loading={isBusy}
                        loadingLabel="Archiving..."
                      />
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </GlassSurface>
        </View>
      </Modal>

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

      <Modal visible={Boolean(activeClip)} animationType="slide" transparent onRequestClose={() => setActiveClip(null)}>
        <View style={styles.videoModalBackdrop}>
          <GlassSurface style={styles.videoModalCard}>
            <Text style={styles.videoModalTitle}>Practice Clip</Text>
            {activeClip ? (
              <Video source={{ uri: activeClip.videoUrl }} style={styles.video} useNativeControls shouldPlay resizeMode={ResizeMode.CONTAIN} />
            ) : null}
            <View style={styles.videoMetaRow}>
              <Text style={styles.clipMeta}>{activeClip ? formatClipDay(activeClip.recordedOn) : ""}</Text>
              <ActionButton
                label="Close"
                onPress={() => {
                  setActiveClip(null);
                }}
              />
            </View>
          </GlassSurface>
        </View>
      </Modal>

      <Modal visible={timelineOpen} animationType="fade" transparent onRequestClose={() => setTimelineOpen(false)}>
        <View style={styles.timelineModalBackdrop}>
          <Animated.View
            style={[
              styles.timelineModalCard,
              {
                opacity: timelineModalReveal,
                transform: [
                  {
                    translateY: timelineModalReveal.interpolate({
                      inputRange: [0, 1],
                      outputRange: [18, 0]
                    })
                  },
                  {
                    scale: timelineModalReveal.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.96, 1]
                    })
                  }
                ]
              }
            ]}
          >
            <View style={styles.timelineModalHeader}>
              <Text style={styles.timelineModalTitle}>Full Timeline</Text>
              <Pressable style={({ pressed }) => [styles.timelineModalDone, pressed ? styles.pressed : undefined]} onPress={() => setTimelineOpen(false)}>
                <Text style={styles.timelineModalDoneText}>Done</Text>
              </Pressable>
            </View>
            <Text style={styles.timelineModalSubtitle}>Every practice day, in order.</Text>

            <ScrollView contentContainerStyle={styles.timelineModalList}>
              {activeJourneyClips.length === 0 ? <Text style={styles.emptyText}>No clips yet.</Text> : null}
              {activeJourneyClips.map((clip, index) => (
                <Pressable
                  key={clip.id}
                  style={({ pressed }) => [styles.timelineModalRow, index === 0 ? styles.timelineModalRowAnchor : undefined, pressed ? styles.pressed : undefined]}
                  onPress={() => {
                    setTimelineOpen(false);
                    setActiveClip(clip);
                  }}
                >
                  <View style={styles.clipMain}>
                    <Text style={styles.clipTitle}>{formatClipDay(clip.recordedOn)}</Text>
                    <Text style={styles.clipMeta}>
                      {formatDurationMs(clip.durationMs)} • {new Date(clip.recordedAt).toLocaleTimeString()}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </Animated.View>
        </View>
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
  headerBlock: {
    marginTop: 8
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  title: {
    fontSize: 38,
    lineHeight: 42,
    fontWeight: "800",
    color: theme.colors.textPrimary
  },
  subtitle: {
    marginTop: 8,
    fontSize: 18,
    color: theme.colors.textSecondary
  },
  manageTrigger: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.72)",
    backgroundColor: "rgba(255,255,255,0.42)",
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  manageTriggerText: {
    color: theme.colors.textSecondary,
    fontWeight: "700"
  },
  celebrationBanner: {
    marginTop: 18,
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
    marginTop: 14,
    color: theme.colors.danger,
    fontWeight: "700"
  },
  statusText: {
    marginTop: 10,
    color: theme.colors.success,
    fontWeight: "700"
  },
  mutedText: {
    marginTop: 10,
    color: theme.colors.textSecondary
  },
  heroCard: {
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
  heroOverline: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    fontWeight: "800",
    color: theme.colors.textSecondary
  },
  heroTitle: {
    marginTop: 6,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "800",
    color: theme.colors.textPrimary
  },
  heroSubtitle: {
    marginTop: 8,
    fontSize: 17,
    color: theme.colors.textSecondary,
    fontWeight: "700"
  },
  heroStatsRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 8
  },
  heroStatPill: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.72)",
    backgroundColor: "rgba(255,255,255,0.44)",
    paddingVertical: 8,
    paddingHorizontal: 10
  },
  heroStatLabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: "700"
  },
  heroStatValue: {
    marginTop: 4,
    color: theme.colors.textPrimary,
    fontWeight: "800"
  },
  secondaryLink: {
    marginTop: 14
  },
  secondaryLinkText: {
    color: theme.colors.accentStrong,
    fontWeight: "700"
  },
  secondaryLinkTextDisabled: {
    color: theme.colors.textSecondary
  },
  milestoneHintWrap: {
    marginTop: 10,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "rgba(255,255,255,0.34)"
  },
  milestoneHintWrapActive: {
    backgroundColor: "rgba(13,159,101,0.17)",
    borderWidth: 1,
    borderColor: "rgba(13,159,101,0.35)"
  },
  milestoneHint: {
    color: theme.colors.textSecondary,
    fontWeight: "600"
  },
  promptCard: {
    marginTop: 18,
    borderRadius: 20,
    padding: 14
  },
  promptKicker: {
    color: theme.colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    fontWeight: "800",
    fontSize: 11
  },
  promptText: {
    marginTop: 6,
    color: theme.colors.textPrimary,
    fontWeight: "700",
    fontSize: 16,
    lineHeight: 22
  },
  timelineCard: {
    marginTop: 18,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.78)"
  },
  timelineHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  timelineExpandButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.72)",
    backgroundColor: "rgba(255,255,255,0.32)",
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  timelineExpandButtonText: {
    color: theme.colors.textSecondary,
    fontWeight: "700",
    fontSize: 12
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: theme.colors.textPrimary
  },
  dotsRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 10
  },
  dotShell: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "rgba(255,255,255,0.46)"
  },
  dotFilled: {
    backgroundColor: theme.colors.accent
  },
  clipRow: {
    marginTop: 12,
    paddingTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.62)",
    backgroundColor: "rgba(255,255,255,0.34)",
    paddingHorizontal: 10,
    paddingBottom: 10
  },
  clipMain: {
    flex: 1
  },
  clipTitle: {
    color: theme.colors.textPrimary,
    fontWeight: "800"
  },
  clipMeta: {
    marginTop: 4,
    color: theme.colors.textSecondary
  },
  manageModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,26,44,0.3)",
    justifyContent: "flex-end",
    paddingHorizontal: 12,
    paddingBottom: 12
  },
  manageModalCard: {
    borderRadius: 28,
    maxHeight: "84%",
    padding: 16
  },
  manageModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8
  },
  manageScrollContent: {
    paddingBottom: 18
  },
  manageTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: theme.colors.textPrimary
  },
  manageClose: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
    backgroundColor: "rgba(255,255,255,0.4)",
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  manageCloseText: {
    color: theme.colors.textSecondary,
    fontWeight: "700"
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: theme.colors.textPrimary
  },
  input: {
    marginTop: 12,
    backgroundColor: "rgba(255,255,255,0.52)",
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.66)",
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: theme.colors.textPrimary
  },
  goalInput: {
    minHeight: 72,
    textAlignVertical: "top"
  },
  manageListHeader: {
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  journeyRow: {
    marginTop: 12,
    borderRadius: 16,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.36)"
  },
  journeyRowActive: {
    backgroundColor: "rgba(14,99,255,0.11)"
  },
  journeyTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: theme.colors.textPrimary
  },
  journeyMeta: {
    marginTop: 4,
    color: theme.colors.textSecondary
  },
  journeyActions: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  primaryAction: {
    borderRadius: 16,
    backgroundColor: theme.colors.accent,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center"
  },
  primaryActionText: {
    color: "#edf5ff",
    fontWeight: "800",
    fontSize: 16
  },
  ghostAction: {
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.72)",
    backgroundColor: "rgba(255,255,255,0.28)",
    paddingVertical: 11,
    paddingHorizontal: 14
  },
  ghostActionText: {
    color: theme.colors.textSecondary,
    fontWeight: "700"
  },
  dangerAction: {
    borderColor: "rgba(214,69,93,0.42)",
    backgroundColor: "rgba(214,69,93,0.12)"
  },
  dangerActionText: {
    color: theme.colors.danger
  },
  fullWidth: {
    width: "100%",
    marginTop: 16
  },
  pressed: {
    transform: [{ scale: 0.98 }]
  },
  disabled: {
    opacity: 0.65
  },
  emptyText: {
    marginTop: 8,
    color: theme.colors.textSecondary
  },
  videoModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(17,36,58,0.25)",
    justifyContent: "center",
    paddingHorizontal: 16
  },
  videoModalCard: {
    borderRadius: 24,
    padding: 14
  },
  videoModalTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: theme.colors.textPrimary,
    marginBottom: 10
  },
  video: {
    width: "100%",
    aspectRatio: 9 / 16,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#00111f"
  },
  videoMetaRow: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10
  },
  timelineModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(10,18,30,0.4)",
    justifyContent: "center",
    paddingHorizontal: 14
  },
  timelineModalCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.82)",
    backgroundColor: "rgba(237,247,255,0.94)",
    maxHeight: "82%",
    padding: 14
  },
  timelineModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  timelineModalTitle: {
    color: theme.colors.textPrimary,
    fontSize: 26,
    fontWeight: "800"
  },
  timelineModalDone: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
    backgroundColor: "rgba(255,255,255,0.45)",
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  timelineModalDoneText: {
    color: theme.colors.textSecondary,
    fontWeight: "700"
  },
  timelineModalSubtitle: {
    marginTop: 4,
    color: theme.colors.textSecondary
  },
  timelineModalList: {
    marginTop: 12,
    paddingBottom: 16
  },
  timelineModalRow: {
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.62)",
    backgroundColor: "rgba(255,255,255,0.48)",
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  timelineModalRowAnchor: {
    borderColor: "rgba(14,99,255,0.55)",
    backgroundColor: "rgba(14,99,255,0.09)"
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
