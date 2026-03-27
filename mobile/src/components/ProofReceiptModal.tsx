import { useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TactilePressable } from "./TactilePressable";
import { triggerSelectionHaptic, triggerMilestoneHaptic } from "../utils/feedback";

type ProofReceiptModalProps = {
  visible: boolean;
  onClose: () => void;
  skillName: string;
  chapterNumber: number;
  daysPracticed: number;
  streak: number;
};

const MONO = Platform.OS === "ios" ? "Courier" : "monospace";

function ReceiptLine() {
  return <View style={styles.line} />;
}

function ReceiptRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export function ProofReceiptModal({
  visible,
  onClose,
  skillName,
  chapterNumber,
  daysPracticed,
  streak,
}: ProofReceiptModalProps) {
  const insets = useSafeAreaInsets();
  const [shared, setShared] = useState(false);

  async function handleShare() {
    triggerSelectionHaptic();

    const receiptText = [
      "────────────────",
      "h o n e",
      "────────────────",
      "",
      `skill        ${skillName.toLowerCase()}`,
      `chapter      ${chapterNumber}`,
      `practiced    ${daysPracticed} days`,
      `streak       ${streak} days`,
      "",
      "────────────────",
      "proof is in the reel.",
      "────────────────",
    ].join("\n");

    const available = await Sharing.isAvailableAsync();
    if (!available) {
      Alert.alert("sharing unavailable", "sharing isn't available on this device.");
      return;
    }

    // Share as text — user can also screenshot the visual receipt
    try {
      // Create a temp text file to share (Sharing.shareAsync needs a file URI)
      const path = `${FileSystem.cacheDirectory}hone-receipt.txt`;
      await FileSystem.writeAsStringAsync(path!, receiptText);
      await Sharing.shareAsync(path, {
        mimeType: "text/plain",
        dialogTitle: "share your proof receipt",
      });
      setShared(true);
      triggerMilestoneHaptic();
    } catch (error) {
      console.error("[ProofReceipt] Share failed:", error);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={[styles.root, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 16 }]}>
        {/* Visual receipt — designed to be screenshotted */}
        <View style={styles.receiptWrap}>
          <View style={styles.receipt}>
            <ReceiptLine />

            <Text style={styles.brandName}>h o n e</Text>

            <ReceiptLine />

            <View style={styles.statsSection}>
              <ReceiptRow label="skill" value={skillName.toLowerCase()} />
              <ReceiptRow label="chapter" value={String(chapterNumber)} />
              <ReceiptRow label="practiced" value={`${daysPracticed} days`} />
              <ReceiptRow label="streak" value={`${streak} days`} />
            </View>

            <ReceiptLine />

            <Text style={styles.tagline}>proof is in the reel.</Text>

            <ReceiptLine />
          </View>
        </View>

        <Text style={styles.screenshotHint}>screenshot to share on stories</Text>

        {/* Action buttons */}
        <View style={styles.actions}>
          <TactilePressable
            style={styles.shareButton}
            pressScale={0.97}
            onPress={() => { void handleShare(); }}
          >
            <Text style={styles.shareButtonText}>{shared ? "shared" : "share"}</Text>
          </TactilePressable>

          <TactilePressable
            style={styles.closeButton}
            pressScale={0.98}
            onPress={() => {
              triggerSelectionHaptic();
              onClose();
            }}
          >
            <Text style={styles.closeButtonText}>done</Text>
          </TactilePressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  receiptWrap: {
    width: "100%",
    maxWidth: 340,
  },
  receipt: {
    backgroundColor: "#000",
    paddingVertical: 32,
    paddingHorizontal: 28,
    gap: 20,
  },
  line: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  brandName: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: MONO,
    textAlign: "center",
    letterSpacing: 6,
  },
  statsSection: {
    gap: 14,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rowLabel: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 16,
    fontFamily: MONO,
    fontWeight: "500",
  },
  rowValue: {
    color: "#ffffff",
    fontSize: 16,
    fontFamily: MONO,
    fontWeight: "700",
  },
  tagline: {
    color: "rgba(255,255,255,0.25)",
    fontSize: 13,
    fontFamily: MONO,
    fontWeight: "500",
    textAlign: "center",
    fontStyle: "italic",
  },
  screenshotHint: {
    marginTop: 24,
    color: "rgba(255,255,255,0.2)",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  actions: {
    width: "100%",
    maxWidth: 340,
    marginTop: 20,
    gap: 12,
  },
  shareButton: {
    backgroundColor: "#E8450A",
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: "center",
  },
  shareButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
  closeButton: {
    alignItems: "center",
    paddingVertical: 10,
  },
  closeButtonText: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 14,
    fontWeight: "600",
  },
});
