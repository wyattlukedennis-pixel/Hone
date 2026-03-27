import { StyleSheet, View } from "react-native";
import { ResizeMode } from "expo-av";

import { LoopingVideoPlayer } from "../../components/LoopingVideoPlayer";
import type { Clip } from "../../types/clip";

type ComparisonRevealSlideProps = {
  clip: Clip;
  active: boolean;
  visible: boolean;
  videoHeight: number;
};

export function ComparisonRevealSlide({
  clip,
  active,
  visible,
  videoHeight
}: ComparisonRevealSlideProps) {
  return (
    <View style={styles.clipCard}>
      <LoopingVideoPlayer
        uri={clip.videoUrl}
        mediaType={clip.captureType}
        posterUri={clip.thumbnailUrl}
        style={[styles.video, { height: videoHeight }]}
        resizeMode={ResizeMode.COVER}
        active={visible && active}
        autoPlay
        loop
        muted={false}
        showControls
        controlsVariant="minimal"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  clipCard: {
    borderRadius: 0,
    paddingHorizontal: 0,
    paddingBottom: 0
  },
  video: {
    width: "100%",
    borderRadius: 0,
    overflow: "hidden",
    backgroundColor: "#121212"
  }
});
