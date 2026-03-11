import { Modal, StyleSheet, Text, View } from "react-native";
import { ResizeMode } from "expo-av";

import { GlassSurface } from "../../components/GlassSurface";
import { LoopingVideoPlayer } from "../../components/LoopingVideoPlayer";
import { theme } from "../../theme";
import type { Clip } from "../../types/clip";
import { ActionButton } from "./ActionButton";
import { formatClipDay } from "./helpers";

type ClipViewerModalProps = {
  clip: Clip | null;
  onClose: () => void;
};

export function ClipViewerModal({ clip, onClose }: ClipViewerModalProps) {
  return (
    <Modal visible={Boolean(clip)} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.videoModalBackdrop}>
        <GlassSurface style={styles.videoModalCard}>
          <Text style={styles.videoModalTitle}>Practice Clip</Text>
          {clip ? (
            <LoopingVideoPlayer uri={clip.videoUrl} style={styles.video} resizeMode={ResizeMode.CONTAIN} muted={false} showControls />
          ) : null}
          <View style={styles.videoMetaRow}>
            <Text style={styles.clipMeta}>{clip ? formatClipDay(clip.recordedOn) : ""}</Text>
            <ActionButton label="Close" onPress={onClose} />
          </View>
        </GlassSurface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  videoModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(17,36,58,0.25)",
    justifyContent: "center",
    paddingHorizontal: 16
  },
  videoModalCard: {
    borderRadius: 24,
    padding: 14
  },
  videoModalTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: theme.colors.textPrimary,
    marginBottom: 10
  },
  video: {
    width: "100%",
    aspectRatio: 9 / 16,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#00111f"
  },
  videoMetaRow: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10
  },
  clipMeta: {
    color: theme.colors.textSecondary
  }
});
