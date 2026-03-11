import type { RefObject } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ResizeMode } from "expo-av";

import { GlassSurface } from "../../components/GlassSurface";
import { LoopingVideoPlayer } from "../../components/LoopingVideoPlayer";
import { theme } from "../../theme";
import type { Clip } from "../../types/clip";

type TimeMachineJumpTarget = "day1" | "week" | "month" | "today";

type TimelineEntry = {
  clip: Clip;
  day: number;
  isMilestone: boolean;
};

type TimeMachineCardProps = {
  timelineRef: RefObject<ScrollView | null>;
  timelineEntries: TimelineEntry[];
  selectedEntry: TimelineEntry | null;
  latestEntry: TimelineEntry | null;
  timeMachineThenEntry: TimelineEntry | null;
  compareMode: boolean;
  playing: boolean;
  status: string | null;
  scrubIndex: number;
  timelineStep: number;
  onToggleCompare: () => void;
  onTogglePlay: () => void;
  onExport: () => void;
  onJump: (target: TimeMachineJumpTarget) => void;
  onScrubIndexChange: (index: number) => void;
};

export function TimeMachineCard({
  timelineRef,
  timelineEntries,
  selectedEntry,
  latestEntry,
  timeMachineThenEntry,
  compareMode,
  playing,
  status,
  scrubIndex,
  timelineStep,
  onToggleCompare,
  onTogglePlay,
  onExport,
  onJump,
  onScrubIndexChange
}: TimeMachineCardProps) {
  return (
    <GlassSurface style={styles.timeMachineCard}>
      <Text style={styles.timeMachineTitle}>Progress Time Machine</Text>
      <Text style={styles.timeMachineSubtitle}>Scrub through your journey and feel the progress.</Text>

      {timelineEntries.length === 0 ? <Text style={styles.mutedText}>Record your first day to start the Time Machine.</Text> : null}

      {timelineEntries.length > 0 && selectedEntry ? (
        <>
          {!compareMode ? (
            <View style={styles.timeMachinePreviewBlock}>
              <Text style={styles.timeMachineDayLabel}>Day {selectedEntry.day}</Text>
              <LoopingVideoPlayer uri={selectedEntry.clip.videoUrl} style={styles.timeMachineVideo} resizeMode={ResizeMode.COVER} muted />
            </View>
          ) : (
            <View style={styles.timeMachineCompareRow}>
              <View style={styles.timeMachineComparePane}>
                <Text style={styles.timeMachineCompareLabel}>Day {timeMachineThenEntry?.day ?? selectedEntry.day}</Text>
                {timeMachineThenEntry ? (
                  <LoopingVideoPlayer
                    uri={timeMachineThenEntry.clip.videoUrl}
                    style={styles.timeMachineCompareVideo}
                    resizeMode={ResizeMode.COVER}
                    muted
                  />
                ) : (
                  <View style={[styles.timeMachineCompareVideo, styles.timeMachineCompareVideoEmpty]} />
                )}
              </View>
              <View style={styles.timeMachineComparePane}>
                <Text style={styles.timeMachineCompareLabel}>Today</Text>
                {latestEntry ? (
                  <LoopingVideoPlayer uri={latestEntry.clip.videoUrl} style={styles.timeMachineCompareVideo} resizeMode={ResizeMode.COVER} muted />
                ) : (
                  <View style={[styles.timeMachineCompareVideo, styles.timeMachineCompareVideoEmpty]} />
                )}
              </View>
            </View>
          )}

          <View style={styles.timeMachineControls}>
            <Pressable
              style={({ pressed }) => [
                styles.timeMachineControlBtn,
                timelineEntries.length < 2 ? styles.timeMachineControlBtnDisabled : undefined,
                pressed && timelineEntries.length > 1 ? styles.pressScale : undefined
              ]}
              onPress={onToggleCompare}
            >
              <Text style={styles.timeMachineControlText}>{compareMode ? "Single View" : "Compare"}</Text>
            </Pressable>
            <Pressable style={({ pressed }) => [styles.timeMachineControlBtn, pressed ? styles.pressScale : undefined]} onPress={onTogglePlay}>
              <Text style={styles.timeMachineControlText}>{playing ? "Stop" : "Play"}</Text>
            </Pressable>
            <Pressable style={({ pressed }) => [styles.timeMachineControlBtn, pressed ? styles.pressScale : undefined]} onPress={onExport}>
              <Text style={styles.timeMachineControlText}>Export</Text>
            </Pressable>
          </View>

          <View style={styles.timelineJumpRow}>
            <Pressable style={({ pressed }) => [styles.timelineJumpChip, pressed ? styles.pressScale : undefined]} onPress={() => onJump("day1")}>
              <Text style={styles.timelineJumpChipText}>Day 1</Text>
            </Pressable>
            <Pressable style={({ pressed }) => [styles.timelineJumpChip, pressed ? styles.pressScale : undefined]} onPress={() => onJump("week")}>
              <Text style={styles.timelineJumpChipText}>-7d</Text>
            </Pressable>
            <Pressable style={({ pressed }) => [styles.timelineJumpChip, pressed ? styles.pressScale : undefined]} onPress={() => onJump("month")}>
              <Text style={styles.timelineJumpChipText}>-30d</Text>
            </Pressable>
            <Pressable style={({ pressed }) => [styles.timelineJumpChip, pressed ? styles.pressScale : undefined]} onPress={() => onJump("today")}>
              <Text style={styles.timelineJumpChipText}>Today</Text>
            </Pressable>
          </View>

          <View style={styles.timelineTrackWrap}>
            <ScrollView
              ref={timelineRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.timelineTrack}
              snapToInterval={timelineStep}
              decelerationRate="fast"
              onMomentumScrollEnd={(event) => {
                const offset = event.nativeEvent.contentOffset.x;
                const nextIndex = Math.max(0, Math.min(timelineEntries.length - 1, Math.round(offset / timelineStep)));
                onScrubIndexChange(nextIndex);
              }}
            >
              {timelineEntries.map((entry, index) => (
                <Pressable key={entry.clip.id} style={({ pressed }) => [styles.timelineMarkerWrap, pressed ? styles.pressScale : undefined]} onPress={() => onScrubIndexChange(index)}>
                  <View
                    style={[
                      styles.timelineMarker,
                      entry.isMilestone ? styles.timelineMarkerMilestone : undefined,
                      index <= scrubIndex ? styles.timelineMarkerDone : undefined,
                      index === scrubIndex ? styles.timelineMarkerActive : undefined
                    ]}
                  />
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <Text style={styles.timelineMetaText}>Day {selectedEntry.day} • {new Date(selectedEntry.clip.recordedAt).toLocaleDateString()}</Text>
          {status ? <Text style={styles.timeMachineStatusText}>{status}</Text> : null}
        </>
      ) : null}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  timeMachineCard: {
    marginTop: 14,
    borderRadius: 22,
    padding: 14
  },
  timeMachineTitle: {
    color: theme.colors.textPrimary,
    fontSize: 24,
    fontWeight: "800"
  },
  timeMachineSubtitle: {
    marginTop: 4,
    color: theme.colors.textSecondary,
    fontWeight: "600"
  },
  timeMachinePreviewBlock: {
    marginTop: 12
  },
  timeMachineDayLabel: {
    color: theme.colors.textSecondary,
    fontWeight: "700"
  },
  timeMachineVideo: {
    marginTop: 6,
    width: "100%",
    aspectRatio: 9 / 12,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#0d2740"
  },
  timeMachineCompareRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 8
  },
  timeMachineComparePane: {
    flex: 1
  },
  timeMachineCompareLabel: {
    color: theme.colors.textSecondary,
    fontWeight: "700",
    fontSize: 12
  },
  timeMachineCompareVideo: {
    marginTop: 5,
    width: "100%",
    aspectRatio: 3 / 4,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#0d2740"
  },
  timeMachineCompareVideoEmpty: {
    backgroundColor: "rgba(255,255,255,0.14)"
  },
  timeMachineControls: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8
  },
  timeMachineControlBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.66)",
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingVertical: 9,
    alignItems: "center",
    justifyContent: "center"
  },
  timeMachineControlBtnDisabled: {
    opacity: 0.52
  },
  timeMachineControlText: {
    color: theme.colors.textPrimary,
    fontWeight: "700"
  },
  timelineJumpRow: {
    marginTop: 10,
    flexDirection: "row",
    gap: 6
  },
  timelineJumpChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.66)",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 9,
    paddingVertical: 5
  },
  timelineJumpChipText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: "700"
  },
  timelineTrackWrap: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.52)",
    backgroundColor: "rgba(255,255,255,0.13)",
    paddingVertical: 12
  },
  timelineTrack: {
    paddingHorizontal: 8
  },
  timelineMarkerWrap: {
    width: 26,
    alignItems: "center",
    justifyContent: "center"
  },
  timelineMarker: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.42)"
  },
  timelineMarkerMilestone: {
    width: 12,
    height: 12,
    borderRadius: 6
  },
  timelineMarkerDone: {
    backgroundColor: "rgba(13,159,101,0.72)"
  },
  timelineMarkerActive: {
    backgroundColor: theme.colors.accent,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.72)"
  },
  timelineMetaText: {
    marginTop: 8,
    color: theme.colors.textSecondary,
    fontWeight: "600"
  },
  timeMachineStatusText: {
    marginTop: 6,
    color: theme.colors.textSecondary,
    fontWeight: "600"
  },
  mutedText: {
    marginTop: 10,
    color: theme.colors.textSecondary
  },
  pressScale: {
    transform: [{ scale: 0.98 }]
  }
});
