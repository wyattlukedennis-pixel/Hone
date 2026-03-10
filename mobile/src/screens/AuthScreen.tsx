import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { GlassSurface } from "../components/GlassSurface";
import { theme } from "../theme";
import type { AuthMode } from "../types/auth";

type AuthFormValues = {
  email: string;
  password: string;
  displayName: string;
};

type AuthScreenProps = {
  mode: AuthMode;
  loading: boolean;
  errorMessage: string | null;
  onModeChange: (mode: AuthMode) => void;
  onSubmit: (values: AuthFormValues) => Promise<void>;
};

export function AuthScreen({ mode, loading, errorMessage, onModeChange, onSubmit }: AuthScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const entrance = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 360,
      useNativeDriver: true
    }).start();
  }, [entrance]);

  const isSignup = mode === "signup";

  async function handleSubmit() {
    await onSubmit({
      email,
      password,
      displayName
    });
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Animated.View
        style={[
          styles.hero,
          {
            opacity: entrance,
            transform: [
              {
                translateY: entrance.interpolate({
                  inputRange: [0, 1],
                  outputRange: [12, 0]
                })
              }
            ]
          }
        ]}
      >
        <Text style={styles.title}>{isSignup ? "Create account" : "Welcome back"}</Text>
        <Text style={styles.subtitle}>{isSignup ? "Start your first Hone journey." : "Log in to continue your streak."}</Text>
      </Animated.View>

      <GlassSurface style={styles.formCard}>
        <View style={styles.modeRow}>
          <Pressable
            style={[styles.modeButton, mode === "login" ? styles.modeButtonActive : undefined]}
            onPress={() => onModeChange("login")}
          >
            <Text style={[styles.modeText, mode === "login" ? styles.modeTextActive : undefined]}>Login</Text>
          </Pressable>
          <Pressable
            style={[styles.modeButton, mode === "signup" ? styles.modeButtonActive : undefined]}
            onPress={() => onModeChange("signup")}
          >
            <Text style={[styles.modeText, mode === "signup" ? styles.modeTextActive : undefined]}>Sign up</Text>
          </Pressable>
        </View>

        {isSignup ? (
          <TextInput
            style={styles.input}
            placeholder="Display name"
            autoCapitalize="words"
            value={displayName}
            onChangeText={setDisplayName}
            editable={!loading}
            placeholderTextColor="#7891af"
          />
        ) : null}

        <TextInput
          style={styles.input}
          placeholder="Email"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          value={email}
          onChangeText={setEmail}
          editable={!loading}
          placeholderTextColor="#7891af"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          secureTextEntry
          autoCapitalize="none"
          value={password}
          onChangeText={setPassword}
          editable={!loading}
          placeholderTextColor="#7891af"
        />

        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

        <Pressable
          style={({ pressed }) => [
            styles.submitButton,
            loading ? styles.submitButtonLoading : undefined,
            pressed && !loading ? styles.submitButtonPressed : undefined
          ]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.submitText}>{loading ? "Please wait..." : isSignup ? "Create account" : "Login"}</Text>
        </Pressable>
      </GlassSurface>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 18,
    paddingBottom: 24
  },
  hero: {
    marginTop: 18,
    marginBottom: 12
  },
  title: {
    fontSize: 42,
    lineHeight: 46,
    fontWeight: "800",
    color: theme.colors.textPrimary
  },
  subtitle: {
    marginTop: 6,
    color: theme.colors.textSecondary,
    fontSize: 17
  },
  formCard: {
    padding: 14,
    borderRadius: 24
  },
  modeRow: {
    flexDirection: "row",
    marginBottom: 12,
    gap: 10
  },
  modeButton: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.52)",
    backgroundColor: "rgba(255,255,255,0.2)"
  },
  modeButtonActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accent
  },
  modeText: {
    color: theme.colors.textSecondary,
    fontWeight: "700",
    textAlign: "center",
    paddingVertical: 10
  },
  modeTextActive: {
    color: "#eff6ff"
  },
  input: {
    marginTop: 10,
    backgroundColor: "rgba(255,255,255,0.48)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.64)",
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: theme.colors.textPrimary
  },
  error: {
    marginTop: 12,
    color: theme.colors.danger,
    fontWeight: "700"
  },
  submitButton: {
    marginTop: 16,
    borderRadius: 14,
    backgroundColor: theme.colors.accent,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13
  },
  submitButtonLoading: {
    backgroundColor: "#6d86a7"
  },
  submitButtonPressed: {
    opacity: 0.9
  },
  submitText: {
    color: "#eaf4ff",
    fontWeight: "800",
    fontSize: 18
  }
});
