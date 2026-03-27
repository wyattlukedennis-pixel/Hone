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
import { env } from "./env";
import { identifyUser, initPurchases } from "./utils/purchases";
import {
  addDailyMomentNotificationResponseListener,
  cancelDailyMomentNotification,
  handleInitialDailyMomentNotificationResponse,
  scheduleDailyMomentNotification
} from "./notifications/dailyMomentNotifications";
import { AuthScreen } from "./screens/AuthScreen";
import { JourneysScreen } from "./screens/JourneysScreen";
import { OnboardingFlow } from "./screens/onboarding/OnboardingFlow";
import { ProgressScreen } from "./screens/ProgressScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { clearActiveJourneyId, readActiveJourneyId, saveActiveJourneyId } from "./storage/activeJourneyStorage";
import { readOnboardingComplete } from "./storage/onboardingStorage";
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
  if (raw === "INVALID_CREDENTIALS") return "email or password is incorrect.";
  if (raw === "EMAIL_TAKEN") return "email is already in use.";
  if (raw === "PASSWORD_TOO_SHORT") return "password must be at least 8 characters.";
  if (raw === "INVALID_EMAIL") return "enter a valid email address.";
  if (raw.startsWith("Network request failed")) {
    return "can't reach the server. check your connection.";
  }
  return raw;
}

function BackgroundOrbs() {
  const horizontalGuides = [94, 194, 294, 394, 494, 594, 694];
  const verticalGuides = [56, 156, 256, 356];
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={styles.fieldRing} />
      <View style={styles.fieldStripeA} />
      <View style={styles.fieldStripeB} />
      <View style={styles.fieldStripeC} />
      {horizontalGuides.map((top) => (
        <View key={`h-${top}`} style={[styles.fieldGuideHorizontal, { top }]} />
      ))}
      {verticalGuides.map((left) => (
        <View key={`v-${left}`} style={[styles.fieldGuideVertical, { left }]} />
      ))}
    </View>
  );
}

export default function App() {
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [session, setSession] = useState<SessionState | null>(null);
  const [onboardingDone, setOnboardingDone] = useState(true); // default true to prevent flash
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
  const [deepLinkRecorderSignal, setDeepLinkRecorderSignal] = useState(0);
  const [deepLinkRecorderJourneyId, setDeepLinkRecorderJourneyId] = useState<string | null>(null);
  const [openRevealSignal, setOpenRevealSignal] = useState(0);
  const [progressEntrySignal, setProgressEntrySignal] = useState(0);
  const [recordingsRevision, setRecordingsRevision] = useState(0);
  const mediaMode = "video" as const;
  const previousTabRef = useRef<TabKey>("journeys");
  const reducedMotion = useReducedMotion();
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const screenTranslateY = useRef(new Animated.Value(0)).current;
  const screenScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    trackEvent("app_opened", { appEnv: env.appEnv });
    async function bootstrapAuth() {
      try {
        const [token, storedJourneyId, storedDevDateShift, storedDailyMoment, storedHapticsMode, , storedOnboardingDone] = await Promise.all([
          readAuthToken(),
          readActiveJourneyId(),
          __DEV__ ? readDevDateShiftSettings() : Promise.resolve(defaultDevDateShiftSettings),
          readDailyMomentSettings(),
          readHapticsMode(),
          initPurchases(),
          readOnboardingComplete()
        ]);
        if (storedJourneyId) setActiveJourneyId(storedJourneyId);
        if (__DEV__) setDevDateShiftSettings(storedDevDateShift);
        setDailyMomentSettings(storedDailyMoment);
        setHapticsMode(storedHapticsMode);
        applyHapticsMode(storedHapticsMode);
        setOnboardingDone(storedOnboardingDone);
        if (!token) return;

        const me = await fetchMe(token);
        setSession({
          token,
          user: me.user
        });
        void identifyUser(me.user.id);
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
        setAuthError("email and password are required.");
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
      void identifyUser(result.user.id);
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

  const journeysContent = useMemo(() => {
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
          onDailyMomentSettingsChange={(next) => {
            void handleDailyMomentSettingsChange(next);
          }}
          openRecorderSignal={openRecorderSignal}
          deepLinkRecorderSignal={deepLinkRecorderSignal}
          deepLinkRecorderJourneyId={deepLinkRecorderJourneyId}
          recordingsRevision={recordingsRevision}
          onRecordingsRevisionBump={() => setRecordingsRevision((v) => v + 1)}
        />
      ) : null;
  }, [
    session,
    activeJourneyId,
    mediaMode,
    devDateShiftSettings,
    dailyMomentSettings,
    openRecorderSignal,
    deepLinkRecorderSignal,
    deepLinkRecorderJourneyId,
    recordingsRevision
  ]);

  const progressContent = useMemo(() => {
    return session ? (
        <ProgressScreen
          token={session.token}
          activeJourneyId={activeJourneyId}
          mediaMode={mediaMode}
          onActiveJourneyChange={(journeyId) => {
            void handleActiveJourneyChange(journeyId);
          }}
          onOpenJourneysTab={(options) => {
            if (options?.journeyId !== undefined) {
              setDeepLinkRecorderJourneyId(options.journeyId ?? null);
              void handleActiveJourneyChange(options.journeyId ?? null);
            } else {
              setDeepLinkRecorderJourneyId(activeJourneyId);
            }
            if (options?.openRecorder) {
              setDeepLinkRecorderSignal((value) => value + 1);
            }
            setTab("journeys");
          }}
          devNowDayOffset={devDateShiftSettings.enabled ? devDateShiftSettings.dayOffset : 0}
          openRevealSignal={openRevealSignal}
          progressEntrySignal={progressEntrySignal}
          recordingsRevision={recordingsRevision}
        />
      ) : null;
  }, [
    session,
    activeJourneyId,
    mediaMode,
    openRevealSignal,
    progressEntrySignal,
    recordingsRevision
  ]);

  const settingsContent = useMemo(() => {
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
  }, [
    session,
    logoutLoading,
    devDateShiftSettings,
    dailyMomentSettings,
    hapticsMode
  ]);

  return (
    <SafeAreaProvider>
      <LinearGradient colors={theme.gradients.appBackground} style={styles.app}>
        <BackgroundOrbs />
        {isBootstrapping ? (
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={theme.colors.accentStrong} />
              <Text style={styles.loadingText}>loading hone...</Text>
            </View>
            <StatusBar style="dark" />
          </SafeAreaView>
        ) : (
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.topBar}>
              <View style={styles.topBarRow}>
                {__DEV__ ? (
                  <GlassSurface style={styles.devBadge} intensity={10}>
                    <LinearGradient
                      pointerEvents="none"
                      colors={theme.gradients.topControlGhost}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.devBadgeFill}
                    />
                    <Text style={styles.devBadgeText}>dev</Text>
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
                <>
                  <View style={tab === "journeys" ? styles.tabVisible : styles.tabHidden}>
                    {journeysContent}
                  </View>
                  <View style={tab === "progress" ? styles.tabVisible : styles.tabHidden}>
                    {progressContent}
                  </View>
                  <View style={tab === "settings" ? styles.tabVisible : styles.tabHidden}>
                    {settingsContent}
                  </View>
                </>
              ) : onboardingDone ? (
                <AuthScreen
                  mode={authMode}
                  loading={authLoading}
                  errorMessage={authError}
                  onModeChange={setAuthMode}
                  onSubmit={handleAuthSubmit}
                />
              ) : (
                <OnboardingFlow
                  onComplete={({ token, user }) => {
                    setSession({ token, user });
                    void listJourneys(token).then(({ journeys }) => {
                      if (journeys.length > 0) {
                        const firstJourney = journeys[0];
                        setActiveJourneyId(firstJourney.id);
                        void saveActiveJourneyId(firstJourney.id);
                      }
                    });
                    setOnboardingDone(true);
                  }}
                  onSkipToLogin={() => {
                    setOnboardingDone(true);
                  }}
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
  tabVisible: {
    flex: 1,
  },
  tabHidden: {
    flex: 1,
    display: "none",
  },
  safeArea: {
    flex: 1
  },
  topBar: {
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 8
  },
  topBarRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  mediaModeSwitch: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(244,239,231,0.96)",
    shadowColor: "#000000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 0
  },
  mediaModeChip: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    paddingHorizontal: 14,
    minHeight: 32,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  mediaModeChipSelected: {
    borderColor: "rgba(0,0,0,0.12)"
  },
  mediaModeChipActiveFill: {
    ...StyleSheet.absoluteFillObject
  },
  mediaModeChipGhostFill: {
    ...StyleSheet.absoluteFillObject,
    opacity: 1
  },
  mediaModeChipText: {
    fontSize: 12,
    color: "#111111",
    fontWeight: "800",
    letterSpacing: 0.3,
    textTransform: "uppercase",
    fontFamily: theme.typography.label
  },
  mediaModeChipTextSelected: {
    color: "#f7f2e8",
    fontFamily: theme.typography.label
  },
  devBadge: {
    alignSelf: "flex-end",
    borderRadius: 10,
    minWidth: 58,
    height: 32,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(244,239,231,0.96)"
  },
  devBadgeFill: {
    ...StyleSheet.absoluteFillObject
  },
  devBadgeText: {
    fontSize: 10,
    color: "#101010",
    fontWeight: "800",
    letterSpacing: 0.3,
    textTransform: "uppercase",
    fontFamily: theme.typography.label
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
    fontWeight: "600",
    fontFamily: theme.typography.body
  },
  fieldRing: {
    position: "absolute",
    top: -44,
    left: -64,
    width: 288,
    height: 288,
    borderRadius: 144,
    borderWidth: 18,
    borderColor: theme.decor.field.ring
  },
  fieldStripeA: {
    position: "absolute",
    top: 212,
    left: -76,
    width: 340,
    height: 72,
    borderRadius: 0,
    transform: [{ rotate: "-29deg" }],
    backgroundColor: theme.decor.field.stripeA
  },
  fieldStripeB: {
    position: "absolute",
    top: 470,
    right: -96,
    width: 420,
    height: 82,
    borderRadius: 0,
    transform: [{ rotate: "-17deg" }],
    backgroundColor: theme.decor.field.stripeB
  },
  fieldStripeC: {
    position: "absolute",
    bottom: 136,
    left: -46,
    width: 312,
    height: 64,
    borderRadius: 0,
    transform: [{ rotate: "-22deg" }],
    backgroundColor: theme.decor.field.stripeC
  },
  fieldGuideHorizontal: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1.2,
    backgroundColor: theme.decor.field.gridSoft
  },
  fieldGuideVertical: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1.2,
    backgroundColor: theme.decor.field.gridStrong
  }
});
