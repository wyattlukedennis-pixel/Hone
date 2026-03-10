import { Pressable, StyleSheet, Text, View } from "react-native";

import { GlassSurface } from "../components/GlassSurface";
import { theme } from "../theme";
import type { User } from "../types/auth";

type SettingsScreenProps = {
  user: User;
  onLogout: () => Promise<void>;
  loggingOut: boolean;
};

export function SettingsScreen({ user, onLogout, loggingOut }: SettingsScreenProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.subtitle}>Account and daily practice preferences.</Text>

      <GlassSurface style={styles.card}>
        <Text style={styles.accountLabel}>Signed in as</Text>
        <Text style={styles.accountValue}>{user.email}</Text>
      </GlassSurface>

      <GlassSurface style={styles.card}>
        <Text style={styles.cardLabel}>Daily Reminder</Text>
        <Text style={styles.cardValue}>7:00 PM Practice Prompt</Text>
        <Text style={styles.cardHint}>A gentle nudge to show up and keep your streak alive.</Text>
      </GlassSurface>

      <Pressable
        style={[styles.logoutButton, loggingOut ? styles.logoutDisabled : undefined]}
        onPress={() => {
          void onLogout();
        }}
        disabled={loggingOut}
      >
        <Text style={styles.logoutText}>{loggingOut ? "Logging out..." : "Log out"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8
  },
  title: {
    fontSize: 36,
    fontWeight: "800",
    color: theme.colors.textPrimary
  },
  subtitle: {
    marginTop: 6,
    fontSize: 17,
    color: theme.colors.textSecondary
  },
  card: {
    marginTop: 16,
    borderRadius: 22,
    padding: 16
  },
  accountLabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: "700"
  },
  accountValue: {
    marginTop: 6,
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: "600"
  },
  cardLabel: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: "700"
  },
  cardValue: {
    marginTop: 6,
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: "800"
  },
  cardHint: {
    marginTop: 8,
    color: theme.colors.textSecondary
  },
  logoutButton: {
    marginTop: 18,
    alignSelf: "flex-start",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(214,69,93,0.42)",
    backgroundColor: "rgba(214,69,93,0.12)",
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  logoutDisabled: {
    opacity: 0.65
  },
  logoutText: {
    color: theme.colors.danger,
    fontWeight: "700"
  }
});
