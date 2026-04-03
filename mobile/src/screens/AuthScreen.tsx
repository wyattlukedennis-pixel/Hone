import { useEffect, useRef, useState } from "react";
import { Animated, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as AppleAuthentication from "expo-apple-authentication";

import { forgotPassword, resetPassword } from "../api/auth";
import { GlassSurface } from "../components/GlassSurface";
import { theme } from "../theme";
import type { AuthMode } from "../types/auth";
import { triggerSelectionHaptic } from "../utils/feedback";

type AuthFormValues = {
  email: string;
  password: string;
  displayName: string;
};

type AppleAuthResult = {
  appleUserId: string;
  email: string | null;
  displayName: string | null;
  identityToken: string | null;
};

type AuthScreenProps = {
  mode: AuthMode;
  loading: boolean;
  errorMessage: string | null;
  onModeChange: (mode: AuthMode) => void;
  onSubmit: (values: AuthFormValues) => Promise<void>;
  onAppleAuth: (result: AppleAuthResult) => Promise<void>;
  onResetSuccess?: (result: { token: string; expiresAt: string; user: { id: string; email: string; displayName: string | null } }) => void;
};

export function AuthScreen({ mode, loading, errorMessage, onModeChange, onSubmit, onAppleAuth, onResetSuccess }: AuthScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const entrance = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 360,
      useNativeDriver: true
    }).start();
  }, [entrance]);

  const isSignup = mode === "signup";
  const isForgot = mode === "forgot";
  const isResetCode = mode === "reset-code";
  const isResetPassword = mode === "reset-password";
  const isResetFlow = isForgot || isResetCode || isResetPassword;

  async function handleSubmit() {
    triggerSelectionHaptic();
    await onSubmit({
      email,
      password,
      displayName
    });
  }

  async function handleForgotSubmit() {
    triggerSelectionHaptic();
    setResetError(null);
    setResetLoading(true);
    try {
      await forgotPassword(resetEmail);
      setResetSuccess("check your email for a 6-digit code");
      onModeChange("reset-code");
    } catch {
      setResetError("something went wrong. try again.");
    } finally {
      setResetLoading(false);
    }
  }

  async function handleResetCodeSubmit() {
    triggerSelectionHaptic();
    setResetError(null);
    if (resetCode.length !== 6) {
      setResetError("enter the 6-digit code from your email");
      return;
    }
    onModeChange("reset-password");
  }

  async function handleResetPasswordSubmit() {
    triggerSelectionHaptic();
    setResetError(null);
    if (newPassword.length < 8) {
      setResetError("password must be at least 8 characters");
      return;
    }
    setResetLoading(true);
    try {
      const result = await resetPassword({
        email: resetEmail,
        code: resetCode,
        newPassword
      });
      onResetSuccess?.(result);
    } catch {
      setResetError("invalid or expired code. try again.");
      onModeChange("reset-code");
      setResetCode("");
    } finally {
      setResetLoading(false);
    }
  }

  function getHeroTitle() {
    if (isForgot) return "forgot password";
    if (isResetCode) return "check your email";
    if (isResetPassword) return "new password";
    return isSignup ? "start account" : "welcome back";
  }

  function getHeroSubtitle() {
    if (isForgot) return "we'll send you a reset code";
    if (isResetCode) return "enter the 6-digit code we sent";
    if (isResetPassword) return "choose a new password";
    return isSignup ? "one take a day. that's it." : "pick up where you left off";
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
        <View style={[styles.heroOrb, styles.heroOrbOne]} />
        <View style={[styles.heroOrb, styles.heroOrbTwo]} />
        <View style={styles.brandPill}>
          <Text style={styles.brandPillText}>HONE</Text>
        </View>
        <Text style={styles.title}>{getHeroTitle()}</Text>
        <Text style={styles.subtitle}>{getHeroSubtitle()}</Text>
      </Animated.View>

      <GlassSurface style={styles.formCard} intensity={22}>
        {/* Login / Signup mode tabs — hidden during reset flow */}
        {!isResetFlow ? (
          <>
            <View style={styles.modeRow}>
              <Pressable
                style={[styles.modeButton, mode === "login" ? styles.modeButtonActive : undefined]}
                onPress={() => {
                  triggerSelectionHaptic();
                  onModeChange("login");
                }}
              >
                <Text style={[styles.modeText, mode === "login" ? styles.modeTextActive : undefined]}>sign in</Text>
              </Pressable>
              <Pressable
                style={[styles.modeButton, mode === "signup" ? styles.modeButtonActive : undefined]}
                onPress={() => {
                  triggerSelectionHaptic();
                  onModeChange("signup");
                }}
              >
                <Text style={[styles.modeText, mode === "signup" ? styles.modeTextActive : undefined]}>create</Text>
              </Pressable>
            </View>

            {isSignup ? (
              <TextInput
                style={styles.input}
                placeholder="name"
                autoCapitalize="words"
                value={displayName}
                onChangeText={setDisplayName}
                editable={!loading}
                placeholderTextColor="#b0a090"
              />
            ) : null}

            <Text style={styles.inputLabel}>email address</Text>
            <TextInput
              style={styles.input}
              placeholder="you@domain.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
              editable={!loading}
              placeholderTextColor="#b0a090"
            />
            <Text style={styles.inputLabel}>password</Text>
            <TextInput
              style={styles.input}
              placeholder="enter password"
              secureTextEntry
              autoCapitalize="none"
              value={password}
              onChangeText={setPassword}
              editable={!loading}
              placeholderTextColor="#b0a090"
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
              <LinearGradient
                colors={loading ? ["#c9a07a", "#b8906a"] : ["#ff8b2b", "#ff5a1f"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.submitGradient}
              >
                <Text style={styles.submitText}>{loading ? "working..." : isSignup ? "start account" : "sign in"}</Text>
              </LinearGradient>
            </Pressable>

            {/* Forgot password link — only on login */}
            {mode === "login" ? (
              <Pressable
                style={styles.forgotLink}
                onPress={() => {
                  triggerSelectionHaptic();
                  setResetEmail(email); // pre-fill if they already typed it
                  setResetError(null);
                  setResetSuccess(null);
                  setResetCode("");
                  setNewPassword("");
                  onModeChange("forgot");
                }}
              >
                <Text style={styles.forgotLinkText}>forgot password?</Text>
              </Pressable>
            ) : null}

            {Platform.OS === "ios" ? (
              <>
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.dividerLine} />
                </View>
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                  cornerRadius={16}
                  style={styles.appleButton}
                  onPress={async () => {
                    try {
                      const credential = await AppleAuthentication.signInAsync({
                        requestedScopes: [
                          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                          AppleAuthentication.AppleAuthenticationScope.EMAIL,
                        ],
                      });
                      const dn = [credential.fullName?.givenName, credential.fullName?.familyName]
                        .filter(Boolean)
                        .join(" ") || null;
                      await onAppleAuth({
                        appleUserId: credential.user,
                        email: credential.email,
                        displayName: dn,
                        identityToken: credential.identityToken,
                      });
                    } catch (error: unknown) {
                      const code = (error as { code?: string })?.code;
                      if (code === "ERR_REQUEST_CANCELED") return;
                    }
                  }}
                />
              </>
            ) : null}
          </>
        ) : null}

        {/* Forgot password — enter email */}
        {isForgot ? (
          <>
            <Text style={styles.inputLabel}>email address</Text>
            <TextInput
              style={styles.input}
              placeholder="you@domain.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={resetEmail}
              onChangeText={setResetEmail}
              editable={!resetLoading}
              placeholderTextColor="#b0a090"
            />

            {resetError ? <Text style={styles.error}>{resetError}</Text> : null}

            <Pressable
              style={({ pressed }) => [
                styles.submitButton,
                resetLoading ? styles.submitButtonLoading : undefined,
                pressed && !resetLoading ? styles.submitButtonPressed : undefined
              ]}
              onPress={handleForgotSubmit}
              disabled={resetLoading}
            >
              <LinearGradient
                colors={resetLoading ? ["#c9a07a", "#b8906a"] : ["#ff8b2b", "#ff5a1f"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.submitGradient}
              >
                <Text style={styles.submitText}>{resetLoading ? "sending..." : "send reset code"}</Text>
              </LinearGradient>
            </Pressable>

            <Pressable
              style={styles.forgotLink}
              onPress={() => {
                triggerSelectionHaptic();
                setResetError(null);
                onModeChange("login");
              }}
            >
              <Text style={styles.forgotLinkText}>back to sign in</Text>
            </Pressable>
          </>
        ) : null}

        {/* Reset code — enter 6-digit code */}
        {isResetCode ? (
          <>
            {resetSuccess ? <Text style={styles.successText}>{resetSuccess}</Text> : null}

            <Text style={styles.inputLabel}>6-digit code</Text>
            <TextInput
              style={[styles.input, styles.codeInput]}
              placeholder="000000"
              keyboardType="number-pad"
              maxLength={6}
              value={resetCode}
              onChangeText={setResetCode}
              placeholderTextColor="#b0a090"
            />

            {resetError ? <Text style={styles.error}>{resetError}</Text> : null}

            <Pressable
              style={({ pressed }) => [
                styles.submitButton,
                pressed ? styles.submitButtonPressed : undefined
              ]}
              onPress={handleResetCodeSubmit}
            >
              <LinearGradient
                colors={["#ff8b2b", "#ff5a1f"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.submitGradient}
              >
                <Text style={styles.submitText}>verify code</Text>
              </LinearGradient>
            </Pressable>

            <Pressable
              style={styles.forgotLink}
              onPress={() => {
                triggerSelectionHaptic();
                setResetError(null);
                setResetSuccess(null);
                onModeChange("forgot");
              }}
            >
              <Text style={styles.forgotLinkText}>resend code</Text>
            </Pressable>
          </>
        ) : null}

        {/* Reset password — enter new password */}
        {isResetPassword ? (
          <>
            <Text style={styles.inputLabel}>new password</Text>
            <TextInput
              style={styles.input}
              placeholder="at least 8 characters"
              secureTextEntry
              autoCapitalize="none"
              value={newPassword}
              onChangeText={setNewPassword}
              editable={!resetLoading}
              placeholderTextColor="#b0a090"
            />

            {resetError ? <Text style={styles.error}>{resetError}</Text> : null}

            <Pressable
              style={({ pressed }) => [
                styles.submitButton,
                resetLoading ? styles.submitButtonLoading : undefined,
                pressed && !resetLoading ? styles.submitButtonPressed : undefined
              ]}
              onPress={handleResetPasswordSubmit}
              disabled={resetLoading}
            >
              <LinearGradient
                colors={resetLoading ? ["#c9a07a", "#b8906a"] : ["#ff8b2b", "#ff5a1f"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.submitGradient}
              >
                <Text style={styles.submitText}>{resetLoading ? "resetting..." : "set new password"}</Text>
              </LinearGradient>
            </Pressable>
          </>
        ) : null}
      </GlassSurface>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 18,
    paddingBottom: 28
  },
  hero: {
    marginTop: 22,
    marginBottom: 14,
    position: "relative",
    overflow: "hidden",
    borderRadius: 28,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,138,43,0.18)",
    backgroundColor: "rgba(255,248,240,0.88)"
  },
  heroOrb: {
    position: "absolute",
    borderRadius: 999
  },
  heroOrbOne: {
    width: 176,
    height: 176,
    right: -54,
    top: -72,
    backgroundColor: "rgba(255,138,43,0.14)"
  },
  heroOrbTwo: {
    width: 124,
    height: 124,
    left: -38,
    bottom: -50,
    backgroundColor: "rgba(255,90,31,0.10)"
  },
  brandPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,138,43,0.35)",
    backgroundColor: "rgba(255,243,230,0.82)",
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  brandPillText: {
    color: "#ea3d00",
    fontSize: 11,
    letterSpacing: 0.15,
    fontWeight: "800",
    fontFamily: theme.typography.heading
  },
  title: {
    marginTop: 8,
    fontSize: 44,
    lineHeight: 48,
    fontWeight: "800",
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.display
  },
  subtitle: {
    marginTop: 8,
    color: theme.colors.textSecondary,
    fontSize: 16,
    lineHeight: 22,
    fontFamily: theme.typography.body
  },
  formCard: {
    padding: 16,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    backgroundColor: "rgba(255,255,255,0.8)"
  },
  modeRow: {
    flexDirection: "row",
    marginBottom: 12,
    gap: 10,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "rgba(255,138,43,0.2)",
    backgroundColor: "rgba(255,243,230,0.6)",
    padding: 4
  },
  modeButton: {
    flex: 1,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "transparent",
    backgroundColor: "transparent"
  },
  modeButtonActive: {
    borderColor: "rgba(255,138,43,0.6)",
    backgroundColor: "rgba(255,90,31,0.9)"
  },
  modeText: {
    color: "#8a6a4a",
    fontWeight: "700",
    textAlign: "center",
    paddingVertical: 10,
    letterSpacing: 0.3,
    fontFamily: theme.typography.label
  },
  modeTextActive: {
    color: "#fff5ee",
    fontFamily: theme.typography.heading
  },
  inputLabel: {
    marginTop: 10,
    marginBottom: 4,
    color: "#7a6a56",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.15,
    fontFamily: theme.typography.label
  },
  input: {
    marginTop: 0,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    paddingHorizontal: 13,
    paddingVertical: 13,
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.body
  },
  codeInput: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: 8,
    textAlign: "center",
    fontFamily: theme.typography.heading
  },
  error: {
    marginTop: 12,
    color: theme.colors.danger,
    fontWeight: "700"
  },
  successText: {
    marginBottom: 12,
    color: "#2d8a4e",
    fontWeight: "700",
    fontSize: 14,
    fontFamily: theme.typography.body
  },
  submitButton: {
    marginTop: 18,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,138,43,0.4)",
    shadowColor: "#cc4400",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4
  },
  submitButtonLoading: {
    borderColor: "rgba(156,188,223,0.48)",
    shadowOpacity: 0.12
  },
  submitButtonPressed: {
    opacity: 0.94
  },
  submitGradient: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14
  },
  submitText: {
    color: "#fff8f2",
    fontWeight: "800",
    fontSize: 15,
    letterSpacing: 0.15,
    fontFamily: theme.typography.heading
  },
  forgotLink: {
    marginTop: 14,
    alignItems: "center",
    paddingVertical: 6
  },
  forgotLinkText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: "600",
    fontFamily: theme.typography.body
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 4,
    gap: 12
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(0,0,0,0.08)"
  },
  dividerText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: "600"
  },
  appleButton: {
    height: 50,
    marginTop: 8
  }
});
