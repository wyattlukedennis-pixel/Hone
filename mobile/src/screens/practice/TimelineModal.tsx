import { useEffect, useRef } from "react";
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { theme } from "../../theme";
import type { Clip } from "../../types/clip";
import { formatClipDay, formatDurationMs } from "./helpers";

type TimelineModalProps = {
  visible: boolean;
  clips: Clip[];
  onClose: () => void;
  onSelectClip: (clip: Clip) => void;
};

export function TimelineModal({ visible, clips, onClose, onSelectClip }: TimelineModalProps) {
  const reveal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    reveal.setValue(0);
    Animated.timing(reveal, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true
    }).start();
  }, [visible, reveal]);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.timelineModalBackdrop}>
        <Animated.View
          style={[
            styles.timelineModalCard,
            {
              opacity: reveal,
              transform: [
                {
                  translateY: reveal.interpolate({
                    inputRange: [0, 1],
                    outputRange: [18, 0]
                  })
                },
                {
                  scale: reveal.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.96, 1]
                  })
                }
              ]
            }
          ]}
        >
          <View style={styles.timelineModalHeader}>
            <Text style={styles.timelineModalTitle}>Full Timeline</Text>
            <Pressable style={({ pressed }) => [styles.timelineModalDone, pressed ? styles.pressed : undefined]} onPress={onClose}>
              <Text style={styles.timelineModalDoneText}>Done</Text>
            </Pressable>
          </View>
          <Text style={styles.timelineModalSubtitle}>Every practice day, in order.</Text>

          <ScrollView contentContainerStyle={styles.timelineModalList}>
            {clips.length === 0 ? <Text style={styles.emptyText}>No clips yet.</Text> : null}
            {clips.map((clip, index) => (
              <Pressable
                key={clip.id}
                style={({ pressed }) => [styles.timelineModalRow, index === 0 ? styles.timelineModalRowAnchor : undefined, pressed ? styles.pressed : undefined]}
                onPress={() => {
                  onClose();
                  onSelectClip(clip);
                }}
              >
                <View>
                  <Text style={styles.clipTitle}>{formatClipDay(clip.recordedOn)}</Text>
                  <Text style={styles.clipMeta}>
                    {formatDurationMs(clip.durationMs)} • {new Date(clip.recordedAt).toLocaleTimeString()}
                  </Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  timelineModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(10,18,30,0.4)",
    justifyContent: "center",
    paddingHorizontal: 14
  },
  timelineModalCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.82)",
    backgroundColor: "rgba(237,247,255,0.94)",
    maxHeight: "82%",
    padding: 14
  },
  timelineModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  timelineModalTitle: {
    color: theme.colors.textPrimary,
    fontSize: 26,
    fontWeight: "800"
  },
  timelineModalDone: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
    backgroundColor: "rgba(255,255,255,0.45)",
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  timelineModalDoneText: {
    color: theme.colors.textSecondary,
    fontWeight: "700"
  },
  timelineModalSubtitle: {
    marginTop: 4,
    color: theme.colors.textSecondary
  },
  timelineModalList: {
    marginTop: 12,
    paddingBottom: 16
  },
  timelineModalRow: {
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.62)",
    backgroundColor: "rgba(255,255,255,0.48)",
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  timelineModalRowAnchor: {
    borderColor: "rgba(14,99,255,0.55)",
    backgroundColor: "rgba(14,99,255,0.09)"
  },
  emptyText: {
    marginTop: 8,
    color: theme.colors.textSecondary
  },
  clipTitle: {
    color: theme.colors.textPrimary,
    fontWeight: "800"
  },
  clipMeta: {
    marginTop: 4,
    color: theme.colors.textSecondary
  },
  pressed: {
    transform: [{ scale: 0.98 }]
  }
});
