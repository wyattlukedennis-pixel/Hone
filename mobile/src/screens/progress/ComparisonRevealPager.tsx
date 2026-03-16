import type { RefObject } from "react";
import { Animated, ScrollView, StyleSheet, View } from "react-native";

import type { Clip } from "../../types/clip";
import { ComparisonRevealSlide } from "./ComparisonRevealSlide";

type RevealCard = {
  key: string;
  clip: Clip;
};

type ComparisonRevealPagerProps = {
  cards: RevealCard[];
  cardWidth: number;
  videoHeight: number;
  visible: boolean;
  activeIndex: number;
  scrollRef: RefObject<ScrollView | null>;
  contentReveal: Animated.Value | Animated.AnimatedInterpolation<number>;
  onIndexChange: (index: number) => void;
};

export function ComparisonRevealPager({
  cards,
  cardWidth,
  videoHeight,
  visible,
  activeIndex,
  scrollRef,
  contentReveal,
  onIndexChange
}: ComparisonRevealPagerProps) {
  return (
    <Animated.View
      style={[
        styles.cardsWrap,
        {
          opacity: contentReveal,
          transform: [
            {
              translateY: contentReveal.interpolate({
                inputRange: [0, 1],
                outputRange: [16, 0]
              })
            },
            {
              scale: contentReveal.interpolate({
                inputRange: [0, 1],
                outputRange: [0.985, 1]
              })
            }
          ]
        }
      ]}
    >
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
          onIndexChange(index);
        }}
        contentContainerStyle={styles.cardsTrack}
      >
        {cards.map((entry, index) => (
          <View key={entry.key} style={[styles.cardSlide, { width: cardWidth }]}>
            <ComparisonRevealSlide
              clip={entry.clip}
              active={activeIndex === index}
              visible={visible}
              videoHeight={videoHeight}
            />
          </View>
        ))}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cardsWrap: {
    marginTop: 0
  },
  cardsTrack: {
    alignItems: "stretch"
  },
  cardSlide: {
    paddingHorizontal: 0
  }
});
