import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { trackEvent } from "./analytics/events";
import { fetchMe, login, logout, signup } from "./api/auth";
import { GlassSurface } from "./components/GlassSurface";
import { TabBar } from "./components/TabBar";
import { env } from "./env";
import { AuthScreen } from "./screens/AuthScreen";
import { JourneysScreen } from "./screens/JourneysScreen";
import { ProgressScreen } from "./screens/ProgressScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { clearActiveJourneyId, readActiveJourneyId, saveActiveJourneyId } from "./storage/activeJourneyStorage";
import { clearAuthToken, readAuthToken, saveAuthToken } from "./storage/authStorage";
import { theme } from "./theme";
import type { AuthMode, User } from "./types/auth";
import type { TabKey } from "./types/navigation";

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
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const screenTranslateY = useRef(new Animated.Value(0)).current;
  const screenScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    trackEvent("app_opened", { appEnv: env.appEnv });
    async function bootstrapAuth() {
      try {
        const [token, storedJourneyId] = await Promise.all([readAuthToken(), readActiveJourneyId()]);
        if (storedJourneyId) setActiveJourneyId(storedJourneyId);
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
    screenOpacity.setValue(0.84);
    screenTranslateY.setValue(10);
    screenScale.setValue(0.992);
    Animated.parallel([
      Animated.timing(screenOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true
      }),
      Animated.timing(screenTranslateY, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true
      }),
      Animated.timing(screenScale, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true
      })
    ]).start();
  }, [screenOpacity, screenScale, screenTranslateY, session, tab]);

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

  const content = useMemo(() => {
    if (tab === "journeys") {
      return session ? (
        <JourneysScreen
          token={session.token}
          activeJourneyId={activeJourneyId}
          onActiveJourneyChange={(journeyId) => {
            void handleActiveJourneyChange(journeyId);
          }}
          onOpenProgress={(journeyId) => {
            void handleActiveJourneyChange(journeyId);
            setTab("progress");
          }}
        />
      ) : null;
    }
    if (tab === "progress") {
      return session ? (
        <ProgressScreen
          token={session.token}
          activeJourneyId={activeJourneyId}
          onActiveJourneyChange={(journeyId) => {
            void handleActiveJourneyChange(journeyId);
          }}
          onOpenJourneysTab={() => setTab("journeys")}
        />
      ) : null;
    }
    return session ? <SettingsScreen user={session.user} onLogout={handleLogout} loggingOut={logoutLoading} /> : null;
  }, [tab, session, logoutLoading, activeJourneyId]);

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
              <GlassSurface style={styles.envPill} intensity={40}>
                <Text style={styles.envText}>{env.appEnv.toUpperCase()}</Text>
                {__DEV__ ? <Text style={styles.envSubText}>{env.apiBaseUrl.replace(/^https?:\/\//, "")}</Text> : null}
                {__DEV__ ? <Text style={styles.envHintText}>{env.apiBaseUrlSource}</Text> : null}
              </GlassSurface>
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
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingTop: 8
  },
  envPill: {
    alignSelf: "flex-end",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  envText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: "800",
    letterSpacing: 0.7
  },
  envSubText: {
    marginTop: 2,
    fontSize: 10,
    color: theme.colors.tabText,
    fontWeight: "600"
  },
  envHintText: {
    marginTop: 1,
    fontSize: 9,
    color: theme.colors.tabText,
    opacity: 0.82
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
    top: -80,
    left: -34,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(77,155,255,0.1)"
  },
  orbB: {
    position: "absolute",
    top: 210,
    right: -58,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(142,197,255,0.11)"
  },
  orbC: {
    position: "absolute",
    bottom: 54,
    left: -78,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(224,244,255,0.2)"
  }
});
