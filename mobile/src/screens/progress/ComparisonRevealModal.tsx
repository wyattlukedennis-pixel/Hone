import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { ResizeMode } from "expo-av";

import { LoopingVideoPlayer } from "../../components/LoopingVideoPlayer";
import type { Clip } from "../../types/clip";

type ComparisonRevealModalProps = {
  visible: boolean;
  comparison: {
    thenClip: Clip;
    nowClip: Clip;
    thenLabel: string;
    nowLabel: string;
  } | null;
  presetLabel: string;
  modalBackdropReveal: Animated.Value;
  modalCardReveal: Animated.Value;
  thenPanelReveal: Animated.Value;
  nowPanelReveal: Animated.Value;
  labelsReveal: Animated.Value;
  onClose: () => void;
};

function formatDuration(ms: number) {
  return `${Math.max(1, Math.round(ms / 1000))}s`;
}

export function ComparisonRevealModal({
  visible,
  comparison,
  presetLabel,
  modalBackdropReveal,
  modalCardReveal,
  thenPanelReveal,
  nowPanelReveal,
  labelsReveal,
  onClose
}: ComparisonRevealModalProps) {
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const cardWidth = Math.max(300, width - 24);
  const cards = useMemo(
    () =>
      comparison
        ? [
            {
              key: "then",
              badge: "Then",
              title: comparison.thenLabel,
              clip: comparison.thenClip
            },
            {
              key: "now",
              badge: "Now",
              title: comparison.nowLabel,
              clip: comparison.nowClip
            }
          ]
        : [],
    [comparison]
  );

  useEffect(() => {
    if (!visible) return;
    setActiveIndex(0);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ x: 0, animated: false });
    });
  }, [visible]);

  const cardsReveal = Animated.multiply(thenPanelReveal, nowPanelReveal);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Animated.View style={[styles.compareModalBackdrop, { opacity: modalBackdropReveal }]}>
        <Animated.View
          style={[
            styles.compareModalCard,
            {
              opacity: modalCardReveal,
              transform: [
                {
                  translateY: modalCardReveal.interpolate({
                    inputRange: [0, 1],
                    outputRange: [22, 0]
                  })
                },
                {
                  scale: modalCardReveal.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.94, 1]
                  })
                }
              ]
            }
          ]}
        >
          <View style={styles.compareModalHeader}>
            <View style={styles.headerCopy}>
              <Text style={styles.compareModalTitle}>Then vs Now</Text>
              <Text style={styles.compareModalSubtitle}>{presetLabel}</Text>
            </View>
            <Pressable style={({ pressed }) => [styles.compareModalClose, pressed ? styles.pressScale : undefined]} onPress={onClose}>
              <Text style={styles.compareModalCloseText}>Done</Text>
            </Pressable>
          </View>

          <Text style={styles.swipeHint}>Swipe between cards. Tap video to play or pause.</Text>

          {cards.length ? (
            <Animated.View style={[styles.cardsWrap, { opacity: Animated.multiply(cardsReveal, labelsReveal) }]}>
              <ScrollView
                ref={scrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                onMomentumScrollEnd={(event) => {
                  const offset = event.nativeEvent.contentOffset.x;
                  const pageWidth = event.nativeEvent.layoutMeasurement.width || cardWidth;
                  const index = Math.max(0, Math.min(cards.length - 1, Math.round(offset / pageWidth)));
                  setActiveIndex(index);
                }}
                contentContainerStyle={styles.cardsTrack}
              >
                {cards.map((entry, index) => (
                  <View key={entry.key} style={[styles.cardSlide, { width: cardWidth }]}>
                    <View style={styles.clipCard}>
                      <Animated.Text style={[styles.clipBadge, { opacity: labelsReveal }]}>{entry.badge}</Animated.Text>
                      <Animated.Text style={[styles.clipLabel, { opacity: labelsReveal }]}>{entry.title}</Animated.Text>
                      <LoopingVideoPlayer
                        uri={entry.clip.videoUrl}
                        style={styles.video}
                        resizeMode={ResizeMode.COVER}
                        active={visible && activeIndex === index}
                        autoPlay
                        loop
                        muted={false}
                        showControls
                      />
                      <Text style={styles.clipMeta}>{formatDuration(entry.clip.durationMs)}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </Animated.View>
          ) : null}

          <View style={styles.indicatorRow}>
            {cards.map((entry, index) => (
              <View key={`dot-${entry.key}`} style={[styles.indicatorDot, index === activeIndex ? styles.indicatorDotActive : undefined]} />
            ))}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  compareModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(8,13,22,0.68)",
    justifyContent: "center",
    paddingHorizontal: 12
  },
  compareModalCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    backgroundColor: "rgba(10,18,32,0.96)",
    paddingHorizontal: 0,
    paddingTop: 14,
    paddingBottom: 12,
    maxHeight: "92%"
  },
  compareModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 14
  },
  headerCopy: {
    flex: 1
  },
  compareModalTitle: {
    color: "#eef5ff",
    fontSize: 26,
    fontWeight: "800"
  },
  compareModalSubtitle: {
    marginTop: 2,
    color: "#c6d8ef",
    fontWeight: "600"
  },
  compareModalClose: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  compareModalCloseText: {
    color: "#eaf4ff",
    fontWeight: "700"
  },
  swipeHint: {
    marginTop: 8,
    color: "#9fb6d2",
    fontWeight: "600",
    paddingHorizontal: 14
  },
  cardsWrap: {
    marginTop: 12
  },
  cardsTrack: {
    alignItems: "stretch"
  },
  cardSlide: {
    paddingHorizontal: 0
  },
  clipCard: {
    borderRadius: 0,
    paddingHorizontal: 14,
    paddingBottom: 2
  },
  clipBadge: {
    color: "#cadcf3",
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  clipLabel: {
    marginTop: 3,
    color: "#eff7ff",
    fontWeight: "800",
    fontSize: 15
  },
  video: {
    marginTop: 8,
    width: "100%",
    aspectRatio: 3 / 4,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#0d2740"
  },
  clipMeta: {
    marginTop: 7,
    color: "#bed2eb",
    fontWeight: "600"
  },
  indicatorRow: {
    marginTop: 10,
    alignSelf: "center",
    flexDirection: "row",
    gap: 7
  },
  indicatorDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.32)"
  },
  indicatorDotActive: {
    width: 20,
    backgroundColor: "#0e63ff"
  },
  pressScale: {
    transform: [{ scale: 0.98 }]
  }
});
