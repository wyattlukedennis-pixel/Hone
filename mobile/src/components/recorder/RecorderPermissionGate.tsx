import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { theme } from "../../theme";
import { triggerSelectionHaptic } from "../../utils/feedback";

type RecorderPermissionGateProps = {
  paddingTop: number;
  onClose: () => void;
  onRequestPermission: () => void;
};

export function RecorderPermissionGate({ paddingTop, onClose, onRequestPermission }: RecorderPermissionGateProps) {
  return (
    <LinearGradient colors={["#f4efe6", "#f4efe6"]} style={[styles.permissionWrap, { paddingTop }]}>
      <Pressable
        style={({ pressed }) => [styles.closeButton, pressed ? styles.buttonPressed : undefined]}
        onPress={() => {
          triggerSelectionHaptic();
          onClose();
        }}
      >
        <Text style={styles.closeButtonText}>close</Text>
      </Pressable>
      <View style={styles.permissionCard}>
        <Text style={styles.permissionTitle}>camera access required</Text>
        <Text style={styles.permissionText}>Hone uses quick daily takes to track your progress arc.</Text>
        <Pressable
          style={styles.allowButton}
          onPress={() => {
            triggerSelectionHaptic();
            onRequestPermission();
          }}
        >
          <Text style={styles.allowText}>enable camera</Text>
        </Pressable>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  permissionWrap: {
    flex: 1,
    paddingHorizontal: 18
  },
  permissionCard: {
    marginTop: 24,
    borderRadius: 24,
    padding: 18,
    backgroundColor: "rgba(255,255,255,0.72)",
    shadowColor: "#143c66",
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6
  },
  permissionTitle: {
    color: theme.colors.textPrimary,
    fontSize: 26,
    fontWeight: "800"
  },
  permissionText: {
    marginTop: 8,
    color: theme.colors.textSecondary
  },
  allowButton: {
    marginTop: 16,
    borderRadius: 14,
    backgroundColor: theme.colors.accent,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  allowText: {
    color: "#edf5ff",
    fontWeight: "800"
  },
  closeButton: {
    alignSelf: "flex-start",
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.65)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.8)",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  closeButtonText: {
    color: theme.colors.textSecondary,
    fontWeight: "700"
  },
  buttonPressed: {
    transform: [{ scale: 0.98 }]
  }
});
