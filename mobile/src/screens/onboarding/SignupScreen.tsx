import { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { theme } from "../../theme";
import { TactilePressable } from "../../components/TactilePressable";
import { triggerSelectionHaptic } from "../../utils/feedback";

interface Props {
  loading: boolean;
  errorMessage: string | null;
  onSubmit: (values: {
    email: string;
    password: string;
    displayName: string;
  }) => Promise<void>;
}

export function SignupScreen({ loading, errorMessage, onSubmit }: Props) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit() {
    triggerSelectionHaptic();
    await onSubmit({
      displayName: displayName.trim(),
      email: email.trim(),
      password,
    });
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.header}>save your progress</Text>
        <Text style={styles.subtitle}>
          create an account so you don't lose your day 1
        </Text>

        <TextInput
          style={styles.input}
          placeholder="your name"
          placeholderTextColor="rgba(0,0,0,0.3)"
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
          autoCorrect={false}
        />

        <TextInput
          style={styles.input}
          placeholder="email"
          placeholderTextColor="rgba(0,0,0,0.3)"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TextInput
          style={styles.input}
          placeholder="password"
          placeholderTextColor="rgba(0,0,0,0.3)"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
        />

        {errorMessage != null && (
          <Text style={styles.error}>{errorMessage}</Text>
        )}

        <TactilePressable onPress={handleSubmit} disabled={loading}>
          <LinearGradient
            colors={theme.gradients.primaryAction}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.ctaButton}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.ctaText}>create account</Text>
            )}
          </LinearGradient>
        </TactilePressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgStart,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  header: {
    fontSize: 28,
    fontFamily: theme.typography.display,
    color: theme.colors.textPrimary,
    marginTop: 60,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 32,
  },
  input: {
    backgroundColor: "rgba(0,0,0,0.03)",
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 16,
    fontFamily: theme.typography.body,
    color: theme.colors.textPrimary,
    marginBottom: 12,
  },
  error: {
    color: theme.colors.danger,
    fontSize: 13,
    marginBottom: 12,
  },
  ctaButton: {
    height: 58,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
});
