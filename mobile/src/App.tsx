import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { trackEvent } from "./analytics/events";
import { fetchMe, login, logout, signup } from "./api/auth";
import { clearJourneyClips } from "./api/clips";
import { listJourneys } from "./api/journeys";
import { GlassSurface } from "./components/GlassSurface";
import { TabBar } from "./components/TabBar";
import { TactilePressable } from "./components/TactilePressable";
import { env } from "./env";
import {
  addDailyMomentNotificationResponseListener,
  cancelDailyMomentNotification,
  handleInitialDailyMomentNotificationResponse,
  scheduleDailyMomentNotification
} from "./notifications/dailyMomentNotifications";
import { AuthScreen } from "./screens/AuthScreen";
import { JourneysScreen } from "./screens/JourneysScreen";
import { ProgressScreen } from "./screens/ProgressScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { clearActiveJourneyId, readActiveJourneyId, saveActiveJourneyId } from "./storage/activeJourneyStorage";
import { clearAuthToken, readAuthToken, saveAuthToken } from "./storage/authStorage";
import { getPendingClipUploadCount, processClipUploadQueue } from "./storage/clipUploadQueue";
import { readDailyMomentSettings, saveDailyMomentSettings } from "./storage/dailyMomentStorage";
import { readDevDateShiftSettings, saveDevDateShiftSettings } from "./storage/devToolsStorage";
import { readHapticsMode, saveHapticsMode } from "./storage/hapticsStorage";
import { theme } from "./theme";
import type { AuthMode, User } from "./types/auth";
import { defaultDailyMomentSettings, type DailyMomentSettings } from "./types/dailyMoment";
import { defaultDevDateShiftSettings, type DevDateShiftSettings } from "./types/devTools";
import { defaultHapticsMode, type HapticsMode } from "./types/haptics";
import type { TabKey } from "./types/navigation";
import { setHapticsMode as applyHapticsMode } from "./utils/feedback";
import { useReducedMotion } from "./utils/useReducedMotion";

type SessionState = {
  token: string;
  user: User;
};

function toAuthErrorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : "Unexpected error";
  if (raw === "INVALID_CREDENTIALS") return "Email or password is incorrect.";
  if (raw === "EMAIL_TAKEN") return "Email is already in use.";
  if (raw === "PASSWORD_TOO_SHORT") return "Password must be at least 8 characters.";
  if (raw === "INVALID_EMAIL") return "Enter a valid email address.";
  if (raw.startsWith("Network request failed")) {
    const host = env.apiBaseUrl.replace(/^https?:\/\//, "");
    return `Cannot reach API (${host}). Set EXPO_PUBLIC_API_BASE_URL to your Mac LAN IP:4000 if needed.`;
  }
  return raw;
}

function BackgroundOrbs() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={styles.orbA} />
      <View style={styles.orbB} />
      <View style={styles.orbC} />
    </View>
  );
}

export default function App() {
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [session, setSession] = useState<SessionState | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [tab, setTab] = useState<TabKey>("journeys");
  const [activeJourneyId, setActiveJourneyId] = useState<string | null>(null);
  const [devDateShiftSettings, setDevDateShiftSettings] = useState<DevDateShiftSettings>(defaultDevDateShiftSettings);
  const [dailyMomentSettings, setDailyMomentSettings] = useState<DailyMomentSettings>(defaultDailyMomentSettings);
  const [hapticsMode, setHapticsMode] = useState<HapticsMode>(defaultHapticsMode);
  const [openRecorderSignal, setOpenRecorderSignal] = useState(0);
  const [openRevealSignal, setOpenRevealSignal] = useState(0);
  const [progressEntrySignal, setProgressEntrySignal] = useState(0);
  const [recordingsRevision, setRecordingsRevision] = useState(0);
  const [mediaMode, setMediaMode] = useState<"video" | "photo">("video");
  const previousTabRef = useRef<TabKey>("journeys");
  const reducedMotion = useReducedMotion();
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const screenTranslateY = useRef(new Animated.Value(0)).current;
  const screenScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    trackEvent("app_opened", { appEnv: env.appEnv });
    async function bootstrapAuth() {
      try {
        const [token, storedJourneyId, storedDevDateShift, storedDailyMoment, storedHapticsMode] = await Promise.all([
          readAuthToken(),
          readActiveJourneyId(),
          __DEV__ ? readDevDateShiftSettings() : Promise.resolve(defaultDevDateShiftSettings),
          readDailyMomentSettings(),
          readHapticsMode()
        ]);
        if (storedJourneyId) setActiveJourneyId(storedJourneyId);
        if (__DEV__) setDevDateShiftSettings(storedDevDateShift);
        setDailyMomentSettings(storedDailyMoment);
        setHapticsMode(storedHapticsMode);
        applyHapticsMode(storedHapticsMode);
        if (!token) return;

        const me = await fetchMe(token);
        setSession({
          token,
          user: me.user
        });
      } catch {
        await clearAuthToken();
      } finally {
        setIsBootstrapping(false);
      }
    }

    void bootstrapAuth();
  }, []);

  useEffect(() => {
    applyHapticsMode(hapticsMode);
  }, [hapticsMode]);

  useEffect(() => {
    if (reducedMotion) {
      screenOpacity.setValue(1);
      screenTranslateY.setValue(0);
      screenScale.setValue(1);
      return;
    }
    screenOpacity.setValue(0.84);
    screenTranslateY.setValue(10);
    screenScale.setValue(0.992);
    Animated.parallel([
      Animated.timing(screenOpacity, {
        toValue: 1,
        duration: theme.motion.microMs,
        useNativeDriver: true
      }),
      Animated.timing(screenTranslateY, {
        toValue: 0,
        duration: theme.motion.transitionMs,
        useNativeDriver: true
      }),
      Animated.timing(screenScale, {
        toValue: 1,
        duration: theme.motion.transitionMs,
        useNativeDriver: true
      })
    ]).start();
  }, [reducedMotion, screenOpacity, screenScale, screenTranslateY, session, tab]);

  useEffect(() => {
    if (tab === "progress" && previousTabRef.current !== "progress") {
      setProgressEntrySignal((value) => value + 1);
    }
    previousTabRef.current = tab;
  }, [tab]);

  useEffect(() => {
    function handleOpenRecorderFromNotification(source: string) {
      setTab("journeys");
      setOpenRecorderSignal((value) => value + 1);
      trackEvent("daily_moment_prompted", { source, action: "open_recorder" });
    }

    const removeResponseListener = addDailyMomentNotificationResponseListener(handleOpenRecorderFromNotification);
    void handleInitialDailyMomentNotificationResponse(handleOpenRecorderFromNotification);
    return () => {
      removeResponseListener();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function syncDailyMomentSchedule() {
      if (!session) {
        await cancelDailyMomentNotification();
        return;
      }
      const result = await scheduleDailyMomentNotification(dailyMomentSettings);
      if (cancelled) return;
      if (!result.scheduled && result.reason === "permission_denied") {
        trackEvent("daily_moment_notification_permission_denied");
      }
    }

    void syncDailyMomentSchedule();
    return () => {
      cancelled = true;
    };
  }, [
    session?.user.id,
    dailyMomentSettings.enabled,
    dailyMomentSettings.hour,
    dailyMomentSettings.minute,
    dailyMomentSettings.windowMinutes
  ]);

  async function handleAuthSubmit(values: { email: string; password: string; displayName: string }) {
    setAuthError(null);
    setAuthLoading(true);
    try {
      const email = values.email.trim().toLowerCase();
      const password = values.password;
      if (!email || !password) {
        setAuthError("Email and password are required.");
        return;
      }

      const result =
        authMode === "signup"
          ? await signup({
              email,
              password,
              displayName: values.displayName.trim()
            })
          : await login({
              email,
              password
            });

      await saveAuthToken(result.token);
      setSession({
        token: result.token,
        user: result.user
      });
      trackEvent(authMode === "signup" ? "signup_success" : "login_success", { userId: result.user.id });
      setTab("journeys");
    } catch (error) {
      setAuthError(toAuthErrorMessage(error));
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleActiveJourneyChange(journeyId: string | null) {
    setActiveJourneyId(journeyId);
    trackEvent("journey_opened", { journeyId });
    if (journeyId) {
      await saveActiveJourneyId(journeyId);
      return;
    }
    await clearActiveJourneyId();
  }

  async function handleLogout() {
    if (!session) return;
    setLogoutLoading(true);
    try {
      await logout(session.token);
    } catch {
      // Session may already be expired/revoked; continue clearing local state.
    } finally {
      await Promise.all([clearAuthToken(), clearActiveJourneyId()]);
      setActiveJourneyId(null);
      setSession(null);
      setAuthMode("login");
      setLogoutLoading(false);
    }
  }

  async function handleClearAllRecordings() {
    if (!session) return { success: false, message: "Not signed in." };
    try {
      const journeysResponse = await listJourneys(session.token);
      if (!journeysResponse.journeys.length) {
        return { success: true, message: "No journeys to clear." };
      }

      const deletionResults = await Promise.all(
        journeysResponse.journeys.map(async (journey) => {
          try {
            const result = await clearJourneyClips(session.token, journey.id);
            return {
              journeyId: journey.id,
              title: journey.title,
              success: Boolean(result.success),
              deletedCount: result.deletedCount ?? 0,
              error: null as string | null
            };
          } catch (error) {
            return {
              journeyId: journey.id,
              title: journey.title,
              success: false,
              deletedCount: 0,
              error: error instanceof Error ? error.message : "Unexpected error"
            };
          }
        })
      );
      const deletedCount = deletionResults.reduce((sum, item) => sum + (item.deletedCount ?? 0), 0);
      const failed = deletionResults.filter((item) => item.success === false);
      const failedCount = failed.length;
      trackEvent("clips_cleared", { deletedCount, journeys: journeysResponse.journeys.length, source: "dev_tools" });
      if (failedCount > 0) {
        const endpointMissing = failed.every((item) => item.error === "HTTP_404");
        if (endpointMissing) {
          return {
            success: false,
            message: "Clear endpoint missing (HTTP_404). Restart backend so new routes load."
          };
        }

        const failurePreview = failed
          .slice(0, 2)
          .map((item) => `${item.title}: ${item.error ?? "Unknown error"}`)
          .join(" | ");
        return {
          success: false,
          message: `Cleared ${deletedCount} recordings. ${failedCount} journey${failedCount === 1 ? "" : "s"} failed. ${failurePreview}`
        };
      }
      setRecordingsRevision((value) => value + 1);
      return {
        success: true,
        message: `Cleared ${deletedCount} recording${deletedCount === 1 ? "" : "s"} across ${journeysResponse.journeys.length} journey${
          journeysResponse.journeys.length === 1 ? "" : "s"
        }.`
      };
    } catch (error) {
      const raw = error instanceof Error ? error.message : "Unexpected error";
      return { success: false, message: `Failed to clear recordings: ${raw}` };
    }
  }

  async function handleDevDateShiftSettingsChange(next: DevDateShiftSettings) {
    setDevDateShiftSettings(next);
    if (!__DEV__) return;
    await saveDevDateShiftSettings(next);
  }

  async function handleDailyMomentSettingsChange(next: DailyMomentSettings) {
    setDailyMomentSettings(next);
    await saveDailyMomentSettings(next);
  }

  async function handleHapticsModeChange(next: HapticsMode) {
    setHapticsMode(next);
    applyHapticsMode(next);
    await saveHapticsMode(next);
  }

  async function handleGetPendingUploadsCount() {
    try {
      return await getPendingClipUploadCount();
    } catch {
      return 0;
    }
  }

  async function handleRetryPendingUploads() {
    if (!session) {
      return { success: false, message: "Not signed in.", remaining: 0 };
    }
    try {
      const before = await getPendingClipUploadCount();
      const result = await processClipUploadQueue(session.token);
      const remaining = result.remaining;
      if (result.succeeded > 0) {
        setRecordingsRevision((value) => value + 1);
      }
      trackEvent("clip_upload_retry_manual", {
        before,
        remaining,
        succeeded: result.succeeded,
        failed: result.failed
      });

      if (before === 0) {
        return { success: true, message: "No pending uploads.", remaining };
      }
      if (remaining === 0) {
        return { success: true, message: `All pending uploads synced (${result.succeeded}).`, remaining };
      }
      if (result.succeeded > 0) {
        return {
          success: true,
          message: `Synced ${result.succeeded}. ${remaining} still pending.`,
          remaining
        };
      }
      return {
        success: false,
        message: `Retry finished. ${remaining} still pending.`,
        remaining
      };
    } catch (error) {
      const raw = error instanceof Error ? error.message : "Unexpected error";
      return { success: false, message: `Retry failed: ${raw}`, remaining: 0 };
    }
  }

  const content = useMemo(() => {
    if (tab === "journeys") {
      return session ? (
        <JourneysScreen
          token={session.token}
          activeJourneyId={activeJourneyId}
          mediaMode={mediaMode}
          onActiveJourneyChange={(journeyId) => {
            void handleActiveJourneyChange(journeyId);
          }}
          onOpenProgress={(journeyId, options) => {
            void handleActiveJourneyChange(journeyId);
            if (options?.openReveal) {
              setOpenRevealSignal((value) => value + 1);
            }
            setTab("progress");
          }}
          devDateShiftSettings={devDateShiftSettings}
          onDevDateShiftSettingsChange={(next) => {
            void handleDevDateShiftSettingsChange(next);
          }}
          dailyMomentSettings={dailyMomentSettings}
          openRecorderSignal={openRecorderSignal}
          recordingsRevision={recordingsRevision}
        />
      ) : null;
    }
    if (tab === "progress") {
      return session ? (
        <ProgressScreen
          token={session.token}
          activeJourneyId={activeJourneyId}
          mediaMode={mediaMode}
          onActiveJourneyChange={(journeyId) => {
            void handleActiveJourneyChange(journeyId);
          }}
          onOpenJourneysTab={() => setTab("journeys")}
          devNowDayOffset={devDateShiftSettings.enabled ? devDateShiftSettings.dayOffset : 0}
          openRevealSignal={openRevealSignal}
          progressEntrySignal={progressEntrySignal}
          recordingsRevision={recordingsRevision}
        />
      ) : null;
    }
    return session ? (
      <SettingsScreen
        user={session.user}
        onLogout={handleLogout}
        loggingOut={logoutLoading}
        devDateShiftSettings={__DEV__ ? devDateShiftSettings : null}
        onDevDateShiftSettingsChange={(next) => {
          void handleDevDateShiftSettingsChange(next);
        }}
        onClearAllRecordings={handleClearAllRecordings}
        onGetPendingUploadsCount={handleGetPendingUploadsCount}
        onRetryPendingUploads={handleRetryPendingUploads}
        dailyMomentSettings={dailyMomentSettings}
        onDailyMomentSettingsChange={(next) => {
          void handleDailyMomentSettingsChange(next);
        }}
        hapticsMode={hapticsMode}
        onHapticsModeChange={(next) => {
          void handleHapticsModeChange(next);
        }}
      />
    ) : null;
  }, [tab, session, logoutLoading, activeJourneyId, mediaMode, devDateShiftSettings, dailyMomentSettings, hapticsMode, openRecorderSignal, openRevealSignal, progressEntrySignal, recordingsRevision]);

  return (
    <SafeAreaProvider>
      <LinearGradient colors={[theme.colors.bgStart, theme.colors.bgEnd]} style={styles.app}>
        <BackgroundOrbs />
        {isBootstrapping ? (
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={theme.colors.accentStrong} />
              <Text style={styles.loadingText}>Loading Hone...</Text>
            </View>
            <StatusBar style="dark" />
          </SafeAreaView>
        ) : (
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.topBar}>
              <View style={styles.topBarRow}>
                {session ? (
                  <GlassSurface style={styles.mediaModeSwitch} intensity={34}>
                    {(["video", "photo"] as const).map((mode) => {
                      const selected = mediaMode === mode;
                      return (
                        <TactilePressable
                          key={mode}
                          style={[styles.mediaModeChip, selected ? styles.mediaModeChipSelected : undefined]}
                          onPress={() => setMediaMode(mode)}
                        >
                          <Text style={[styles.mediaModeChipText, selected ? styles.mediaModeChipTextSelected : undefined]}>
                            {mode === "video" ? "Video" : "Photo"}
                          </Text>
                        </TactilePressable>
                      );
                    })}
                  </GlassSurface>
                ) : (
                  <View />
                )}
                {__DEV__ ? (
                  <GlassSurface style={styles.devBadge} intensity={34}>
                    <Text style={styles.devBadgeText}>DEV</Text>
                  </GlassSurface>
                ) : null}
              </View>
            </View>
            <Animated.View
              style={[
                styles.content,
                {
                  opacity: screenOpacity,
                  transform: [{ translateY: screenTranslateY }, { scale: screenScale }]
                }
              ]}
            >
              {session ? (
                content
              ) : (
                <AuthScreen
                  mode={authMode}
                  loading={authLoading}
                  errorMessage={authError}
                  onModeChange={setAuthMode}
                  onSubmit={handleAuthSubmit}
                />
              )}
            </Animated.View>
            {session ? <TabBar activeTab={tab} onSelect={setTab} /> : null}
            <StatusBar style="dark" />
          </SafeAreaView>
        )}
      </LinearGradient>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1
  },
  safeArea: {
    flex: 1
  },
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 2
  },
  topBarRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  mediaModeSwitch: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    padding: 4
  },
  mediaModeChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    minHeight: 28,
    alignItems: "center",
    justifyContent: "center"
  },
  mediaModeChipSelected: {
    backgroundColor: "rgba(255,255,255,0.74)"
  },
  mediaModeChipText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: "700"
  },
  mediaModeChipTextSelected: {
    color: theme.colors.textPrimary
  },
  devBadge: {
    alignSelf: "flex-end",
    borderRadius: 999,
    minWidth: 40,
    height: 28,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  devBadgeText: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontWeight: "800",
    letterSpacing: 0.6
  },
  content: {
    flex: 1
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12
  },
  loadingText: {
    color: theme.colors.textSecondary,
    fontWeight: "600"
  },
  orbA: {
    position: "absolute",
    top: -72,
    left: -30,
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: "rgba(77,155,255,0.03)"
  },
  orbB: {
    position: "absolute",
    top: 228,
    right: -52,
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: "rgba(142,197,255,0.032)"
  },
  orbC: {
    position: "absolute",
    bottom: 62,
    left: -68,
    width: 142,
    height: 142,
    borderRadius: 71,
    backgroundColor: "rgba(224,244,255,0.045)"
  }
});
