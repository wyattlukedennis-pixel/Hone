import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TactilePressable } from "./TactilePressable";
import { theme } from "../theme";
import { triggerSelectionHaptic, triggerMilestoneHaptic } from "../utils/feedback";
import {
  getRevealExportPrice,
  purchaseRevealExport,
  restorePurchases,
} from "../utils/purchases";

type PaywallModalProps = {
  visible: boolean;
  onClose: () => void;
  onPurchased: () => void;
};

type PurchaseState = "idle" | "purchasing" | "restoring";

export function PaywallModal({ visible, onClose, onPurchased }: PaywallModalProps) {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<PurchaseState>("idle");
  const price = getRevealExportPrice();

  async function handlePurchase() {
    if (state !== "idle") return;
    triggerSelectionHaptic();
    setState("purchasing");
    try {
      const success = await purchaseRevealExport();
      if (success) {
        triggerMilestoneHaptic();
        onPurchased();
      } else {
        setState("idle");
      }
    } catch (error) {
      if (__DEV__) console.error("[Paywall] Purchase failed:", error);
      Alert.alert("purchase failed", "something went wrong. try again.");
      setState("idle");
    }
  }

  async function handleRestore() {
    if (state !== "idle") return;
    triggerSelectionHaptic();
    setState("restoring");
    try {
      const success = await restorePurchases();
      if (success) {
        triggerMilestoneHaptic();
        onPurchased();
      } else {
        Alert.alert("no purchase found", "we couldn't find a previous purchase to restore.");
        setState("idle");
      }
    } catch (error) {
      if (__DEV__) console.error("[Paywall] Restore failed:", error);
      Alert.alert("restore failed", "something went wrong. try again.");
      setState("idle");
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTap} onPress={onClose} />

        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom + 16, 32) }]}>
          {/* Handle bar */}
          <View style={styles.handleBar} />

          {/* Hero content */}
          <View style={styles.heroSection}>
            <Text style={styles.heroEmoji}>🎬</Text>
            <Text style={styles.heroTitle}>export your reveal</Text>
            <Text style={styles.heroSubtitle}>
              save to camera roll or share directly to tiktok, instagram, or anywhere.
            </Text>
          </View>

          {/* What you get */}
          <View style={styles.benefitsSection}>
            <View style={styles.benefitRow}>
              <Text style={styles.benefitIcon}>✓</Text>
              <Text style={styles.benefitText}>unlimited reveal exports</Text>
            </View>
            <View style={styles.benefitRow}>
              <Text style={styles.benefitIcon}>✓</Text>
              <Text style={styles.benefitText}>save to camera roll</Text>
            </View>
            <View style={styles.benefitRow}>
              <Text style={styles.benefitIcon}>✓</Text>
              <Text style={styles.benefitText}>share to any app</Text>
            </View>
            <View style={styles.benefitRow}>
              <Text style={styles.benefitIcon}>✓</Text>
              <Text style={styles.benefitText}>no watermark</Text>
            </View>
            <View style={styles.benefitRow}>
              <Text style={styles.benefitIcon}>✓</Text>
              <Text style={styles.benefitText}>one-time purchase, forever</Text>
            </View>
          </View>

          {/* Purchase button */}
          <TactilePressable
            style={styles.purchaseButton}
            pressScale={0.97}
            onPress={() => { void handlePurchase(); }}
            disabled={state !== "idle"}
          >
            <LinearGradient
              colors={theme.gradients.primaryAction}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.purchaseButtonGradient}
            >
              {state === "purchasing" ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.purchaseButtonText}>
                  unlock for {price}
                </Text>
              )}
            </LinearGradient>
          </TactilePressable>

          {/* Restore */}
          <TactilePressable
            style={styles.restoreButton}
            pressScale={0.98}
            onPress={() => { void handleRestore(); }}
            disabled={state !== "idle"}
          >
            <Text style={styles.restoreButtonText}>
              {state === "restoring" ? "restoring..." : "restore purchase"}
            </Text>
          </TactilePressable>

          {/* Fine print */}
          <Text style={styles.finePrint}>
            one-time payment · no subscription · works forever
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  backdropTap: {
    flex: 1,
  },
  sheet: {
    backgroundColor: theme.colors.bgStart,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingHorizontal: 24,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(0,0,0,0.12)",
    alignSelf: "center",
    marginBottom: 20,
  },
  heroSection: {
    alignItems: "center",
    marginBottom: 24,
  },
  heroEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: theme.colors.textPrimary,
    fontFamily: theme.typography.display,
    textAlign: "center",
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    textAlign: "center",
    lineHeight: 21,
    fontFamily: theme.typography.body,
    paddingHorizontal: 12,
  },
  benefitsSection: {
    marginBottom: 24,
    gap: 10,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  benefitIcon: {
    color: theme.colors.accent,
    fontSize: 16,
    fontWeight: "800",
  },
  benefitText: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: "600",
    fontFamily: theme.typography.heading,
  },
  purchaseButton: {
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: theme.colors.accent,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    marginBottom: 12,
  },
  purchaseButtonGradient: {
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  purchaseButtonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
    fontFamily: theme.typography.heading,
  },
  restoreButton: {
    alignSelf: "center",
    paddingVertical: 10,
    marginBottom: 8,
  },
  restoreButtonText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  finePrint: {
    textAlign: "center",
    color: "rgba(0,0,0,0.3)",
    fontSize: 11,
    fontWeight: "500",
  },
});
