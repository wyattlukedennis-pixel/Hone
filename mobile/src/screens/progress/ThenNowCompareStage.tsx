import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Image, PanResponder, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { ResizeMode, Video, type AVPlaybackStatus } from "expo-av";
import Slider from "@react-native-community/slider";

import { TactilePressable } from "../../components/TactilePressable";
import { theme } from "../../theme";
import type { Clip } from "../../types/clip";
import { triggerSelectionHaptic } from "../../utils/feedback";

type CompareFocus = "then" | "now";

type ThenNowCompareStageProps = {
  thenClip: Clip;
  nowClip: Clip;
  thenLabel: string;
  nowLabel: string;
  visible: boolean;
  videoHeight: number;
  overlayTopInset?: number;
  overlaySideInset?: number;
  overlayBottomInset?: number;
  contentReveal: Animated.Value | Animated.AnimatedInterpolation<number>;
  onFocusChange: (focus: CompareFocus) => void;
};

const PROGRESS_UPDATE_MIN_MS = 120;
const VIDEO_CONTROLS_AUTO_HIDE_MS = 1600;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isLoadedStatus(status: AVPlaybackStatus): status is AVPlaybackStatus & { isLoaded: true } {
  return status.isLoaded;
}

export function ThenNowCompareStage({
  thenClip,
  nowClip,
  thenLabel,
  nowLabel,
  visible,
  videoHeight,
  overlayTopInset = 12,
  overlaySideInset = 12,
  overlayBottomInset = 14,
  contentReveal,
  onFocusChange
}: ThenNowCompareStageProps) {
  const { width } = useWindowDimensions();
  const photoCompare = thenClip.captureType === "photo" && nowClip.captureType === "photo";
  const compactControls = width < 390;
  const spaciousControls = width >= 430;
  const topControlsTopInset = Math.max(overlayTopInset, spaciousControls ? 18 : 14);
  const topControlsSideInset = Math.max(overlaySideInset, spaciousControls ? 22 : compactControls ? 14 : 18);
  const scrubControlsSideInset = Math.max(overlaySideInset, spaciousControls ? 22 : 16);
  const scrubControlsBottomInset = Math.max(overlayBottomInset, compactControls ? 16 : 18);
  const [compareFocus, setCompareFocus] = useState<CompareFocus>("now");
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(1);
  const [surfaceWidth, setSurfaceWidth] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);
  const [scrubRatio, setScrubRatio] = useState(0);
  const [holdFlipActive, setHoldFlipActive] = useState(false);
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [topControlsVisible, setTopControlsVisible] = useState(true);
  const thenVideoRef = useRef<Video | null>(null);
  const nowVideoRef = useRef<Video | null>(null);
  const progressUpdateAtRef = useRef(0);
  const splitStartRatioRef = useRef(0.5);
  const wasPlayingBeforeScrubRef = useRef(false);
  const holdFlipFocusRef = useRef<CompareFocus | null>(null);
  const holdFlipSplitRatioRef = useRef<number | null>(null);
  const topControlsHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swipeSwitchedRef = useRef(false);
  const seekInFlightRef = useRef(false);
  const pendingSeekRef = useRef<{ positionMs: number; mode: "active" | "both"; focus: CompareFocus } | null>(null);
  const scrubPreviewAtRef = useRef(0);
  const scrubSnapZoneRef = useRef<"start" | "middle" | "end" | null>(null);
  const durationMsRef = useRef(durationMs);
  const topControlsOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    durationMsRef.current = durationMs;
  }, [durationMs]);

  useEffect(() => {
    setCompareFocus("now");
    setPlaying(true);
    setMuted(false);
    setPositionMs(0);
    setDurationMs(1);
    setScrubRatio(0);
    setScrubbing(false);
    setHoldFlipActive(false);
    setSplitRatio(0.5);
    setTopControlsVisible(true);
    topControlsOpacity.setValue(1);
    onFocusChange("now");
  }, [thenClip.id, nowClip.id, onFocusChange, topControlsOpacity]);

  const clearTopControlsHideTimer = useCallback(() => {
    if (topControlsHideTimerRef.current) {
      clearTimeout(topControlsHideTimerRef.current);
      topControlsHideTimerRef.current = null;
    }
  }, []);

  const setTopControls = useCallback(
    (nextVisible: boolean) => {
      setTopControlsVisible(nextVisible);
      Animated.timing(topControlsOpacity, {
        toValue: nextVisible ? 1 : 0,
        duration: nextVisible ? 160 : 220,
        useNativeDriver: true
      }).start();
    },
    [topControlsOpacity]
  );

  const revealTopControls = useCallback(() => {
    clearTopControlsHideTimer();
    setTopControls(true);
  }, [clearTopControlsHideTimer, setTopControls]);

  const scheduleTopControlsAutoHide = useCallback(
    (delayMs = VIDEO_CONTROLS_AUTO_HIDE_MS) => {
      if (photoCompare || !visible) return;
      clearTopControlsHideTimer();
      topControlsHideTimerRef.current = setTimeout(() => {
        setTopControls(false);
      }, Math.max(600, delayMs));
    },
    [clearTopControlsHideTimer, photoCompare, setTopControls, visible]
  );

  useEffect(() => {
    if (photoCompare || !visible) {
      clearTopControlsHideTimer();
      setTopControls(true);
      return;
    }
    setTopControls(true);
    scheduleTopControlsAutoHide();
    return () => {
      clearTopControlsHideTimer();
    };
  }, [photoCompare, visible, clearTopControlsHideTimer, scheduleTopControlsAutoHide, setTopControls]);

  const splitPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: () => photoCompare,
        onPanResponderGrant: () => {
          splitStartRatioRef.current = splitRatio;
        },
        onPanResponderMove: (_, gestureState) => {
          if (!surfaceWidth) return;
          const next = clamp(splitStartRatioRef.current + gestureState.dx / surfaceWidth, 0.12, 0.88);
          setSplitRatio(next);
        }
      }),
    [photoCompare, splitRatio, surfaceWidth]
  );

  function updateActiveVideoStatus(status: AVPlaybackStatus) {
    if (!isLoadedStatus(status)) return;
    const now = Date.now();
    if (now - progressUpdateAtRef.current < PROGRESS_UPDATE_MIN_MS) return;
    progressUpdateAtRef.current = now;
    const nextDuration = Math.max(1, status.durationMillis ?? 1);
    const nextPosition = Math.max(0, status.positionMillis ?? 0);
    setDurationMs(nextDuration);
    if (scrubbing) return;
    setPositionMs(nextPosition);
    setScrubRatio(Math.max(0, Math.min(1, nextPosition / nextDuration)));
  }

  const performSeek = useCallback((params: { positionMs: number; mode: "active" | "both"; focus?: CompareFocus }) => {
    if (photoCompare) return;

    const focus = params.focus ?? compareFocus;
    const clampedPosition = Math.max(0, Math.min(durationMsRef.current, params.positionMs));
    setPositionMs(clampedPosition);
    setScrubRatio(Math.max(0, Math.min(1, clampedPosition / Math.max(1, durationMsRef.current))));

    if (seekInFlightRef.current) {
      pendingSeekRef.current = {
        positionMs: clampedPosition,
        mode: params.mode,
        focus
      };
      return;
    }

    const runSeek = (positionMs: number, mode: "active" | "both", activeFocus: CompareFocus) => {
      seekInFlightRef.current = true;
      const activeRef = activeFocus === "then" ? thenVideoRef : nowVideoRef;
      const refs = mode === "both" ? [thenVideoRef, nowVideoRef] : [activeRef];
      const players = refs.map((entry) => entry.current).filter((entry): entry is Video => Boolean(entry));
      if (!players.length) {
        seekInFlightRef.current = false;
        return;
      }

      void Promise.all(players.map((player) => player.setStatusAsync({ positionMillis: positionMs, shouldPlay: false })))
        .catch(() => {
          // Best-effort seek.
        })
        .finally(() => {
          seekInFlightRef.current = false;
          const pending = pendingSeekRef.current;
          if (!pending) return;
          pendingSeekRef.current = null;
          runSeek(pending.positionMs, pending.mode, pending.focus);
        });
    };

    runSeek(clampedPosition, params.mode, focus);
  }, [compareFocus, photoCompare]);

  function handleHoldFlipStart() {
    if (holdFlipActive) return;
    setHoldFlipActive(true);
    if (photoCompare) {
      holdFlipSplitRatioRef.current = splitRatio;
      setSplitRatio((value) => clamp(1 - value, 0.12, 0.88));
      return;
    }
    holdFlipFocusRef.current = compareFocus;
    void switchFocus(compareFocus === "then" ? "now" : "then");
  }

  function handleHoldFlipEnd() {
    if (!holdFlipActive) return;
    setHoldFlipActive(false);
    if (photoCompare) {
      if (holdFlipSplitRatioRef.current !== null) {
        setSplitRatio(holdFlipSplitRatioRef.current);
      }
      holdFlipSplitRatioRef.current = null;
      return;
    }
    const previousFocus = holdFlipFocusRef.current;
    holdFlipFocusRef.current = null;
    if (previousFocus && previousFocus !== compareFocus) {
      void switchFocus(previousFocus);
    }
  }

  const handleSliderStart = useCallback(() => {
    if (photoCompare) return;
    revealTopControls();
    wasPlayingBeforeScrubRef.current = playing;
    setPlaying(false);
    setScrubbing(true);
    scrubPreviewAtRef.current = 0;
    scrubSnapZoneRef.current = null;
  }, [photoCompare, playing, revealTopControls]);

  const handleSliderValueChange = useCallback(
    (value: number) => {
      if (photoCompare) return;
      const ratio = clamp(value, 0, 1);
      const nextPosition = ratio * Math.max(1, durationMsRef.current);
      setScrubRatio(ratio);
      setPositionMs(nextPosition);

      const now = Date.now();
      if (now - scrubPreviewAtRef.current >= 90) {
        scrubPreviewAtRef.current = now;
        performSeek({ positionMs: nextPosition, mode: "active", focus: compareFocus });
      }

      const snapZone: "start" | "middle" | "end" | null =
        ratio <= 0.03 ? "start" : ratio >= 0.97 ? "end" : Math.abs(ratio - 0.5) <= 0.03 ? "middle" : null;
      if (snapZone && snapZone !== scrubSnapZoneRef.current) {
        triggerSelectionHaptic();
        scrubSnapZoneRef.current = snapZone;
      } else if (!snapZone) {
        scrubSnapZoneRef.current = null;
      }
    },
    [photoCompare, performSeek, compareFocus]
  );

  const handleSliderComplete = useCallback(
    (value: number) => {
      if (photoCompare) return;
      const ratio = clamp(value, 0, 1);
      const nextPosition = ratio * Math.max(1, durationMsRef.current);
      setScrubRatio(ratio);
      setPositionMs(nextPosition);
      setScrubbing(false);
      performSeek({ positionMs: nextPosition, mode: "both", focus: compareFocus });
      setPlaying(wasPlayingBeforeScrubRef.current);
      scheduleTopControlsAutoHide();
      scrubSnapZoneRef.current = null;
    },
    [photoCompare, performSeek, compareFocus, scheduleTopControlsAutoHide]
  );

  const swipePanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          !photoCompare && Math.abs(gestureState.dx) > 18 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
        onPanResponderGrant: () => {
          swipeSwitchedRef.current = false;
          revealTopControls();
        },
        onPanResponderMove: (_, gestureState) => {
          if (swipeSwitchedRef.current || photoCompare) return;
          if (Math.abs(gestureState.dx) < 52) return;
          const nextFocus: CompareFocus = gestureState.dx > 0 ? "then" : "now";
          if (nextFocus === compareFocus) return;
          swipeSwitchedRef.current = true;
          triggerSelectionHaptic();
          void switchFocus(nextFocus);
        },
        onPanResponderRelease: () => {
          scheduleTopControlsAutoHide();
        },
        onPanResponderTerminate: () => {
          scheduleTopControlsAutoHide();
        }
      }),
    [compareFocus, photoCompare, revealTopControls, scheduleTopControlsAutoHide]
  );

  async function switchFocus(next: CompareFocus) {
    if (next === compareFocus || photoCompare) return;
    const activeRef = compareFocus === "then" ? thenVideoRef : nowVideoRef;
    const nextRef = next === "then" ? thenVideoRef : nowVideoRef;

    let nextPosition = positionMs;
    try {
      const status = await activeRef.current?.getStatusAsync();
      if (status && isLoadedStatus(status)) {
        nextPosition = status.positionMillis ?? nextPosition;
        setDurationMs(Math.max(1, status.durationMillis ?? durationMs));
      }
    } catch {
      // No-op fallback keeps current position.
    }

    setPositionMs(nextPosition);
    setCompareFocus(next);
    onFocusChange(next);
    revealTopControls();
    scheduleTopControlsAutoHide();
    void activeRef.current?.setStatusAsync({ shouldPlay: false }).catch(() => {});
    void nextRef.current?.setStatusAsync({ positionMillis: nextPosition }).catch(() => {});
  }

  function renderPhotoCompare() {
    const splitX = surfaceWidth > 0 ? Math.round(surfaceWidth * splitRatio) : 0;
    const thenUri = thenClip.videoUrl;
    const nowUri = nowClip.videoUrl;

    return (
      <View
        style={[styles.mediaShell, { height: videoHeight }]}
        onLayout={(event) => {
          setSurfaceWidth(event.nativeEvent.layout.width);
        }}
      >
        <Image source={{ uri: nowUri }} style={styles.photoLayer} resizeMode="cover" />
        <View style={[styles.photoThenMask, { width: splitX > 0 ? splitX : "50%" }]}>
          <Image source={{ uri: thenUri }} style={styles.photoLayer} resizeMode="cover" />
        </View>
        <View style={[styles.photoSplitLine, { left: Math.max(0, splitX - 1) }]} pointerEvents="none" />
        <View style={[styles.photoHandleWrap, { left: Math.max(0, splitX - 18) }]} {...splitPanResponder.panHandlers}>
          <View style={styles.photoHandle}>
            <Text style={styles.photoHandleText}>||</Text>
          </View>
        </View>
        <View
          style={[
            styles.photoLabelRow,
            compactControls ? styles.photoLabelRowCompact : null,
            {
              top: topControlsTopInset,
              left: topControlsSideInset,
              right: topControlsSideInset
            }
          ]}
          pointerEvents="none"
        >
          <Text style={styles.photoLabelPill}>Then</Text>
          <Text style={styles.photoLabelPill}>Now</Text>
        </View>
      </View>
    );
  }

  function renderVideoCompare() {
    return (
      <View
        style={[styles.mediaShell, { height: videoHeight }]}
        {...swipePanResponder.panHandlers}
        onTouchEnd={() => {
          revealTopControls();
          scheduleTopControlsAutoHide();
        }}
      >
        <Video
          ref={thenVideoRef}
          source={{ uri: thenClip.videoUrl }}
          style={[styles.videoLayer, compareFocus === "then" ? styles.videoLayerActive : styles.videoLayerInactive]}
          resizeMode={ResizeMode.COVER}
          usePoster={Boolean(thenClip.thumbnailUrl)}
          posterSource={thenClip.thumbnailUrl ? { uri: thenClip.thumbnailUrl } : undefined}
          shouldPlay={visible && compareFocus === "then" && playing}
          isLooping
          isMuted={compareFocus === "then" ? muted : true}
          onPlaybackStatusUpdate={(status) => {
            if (compareFocus !== "then") return;
            updateActiveVideoStatus(status);
          }}
        />
        <Video
          ref={nowVideoRef}
          source={{ uri: nowClip.videoUrl }}
          style={[styles.videoLayer, compareFocus === "now" ? styles.videoLayerActive : styles.videoLayerInactive]}
          resizeMode={ResizeMode.COVER}
          usePoster={Boolean(nowClip.thumbnailUrl)}
          posterSource={nowClip.thumbnailUrl ? { uri: nowClip.thumbnailUrl } : undefined}
          shouldPlay={visible && compareFocus === "now" && playing}
          isLooping
          isMuted={compareFocus === "now" ? muted : true}
          onPlaybackStatusUpdate={(status) => {
            if (compareFocus !== "now") return;
            updateActiveVideoStatus(status);
          }}
        />
        <View style={styles.videoOverlayRoot} pointerEvents="box-none">
          <View
            style={[
              styles.videoTopControls,
              {
                top: topControlsTopInset,
                left: topControlsSideInset,
                right: topControlsSideInset
              }
            ]}
            pointerEvents={topControlsVisible ? "auto" : "none"}
          >
            <Animated.View
              style={{
                opacity: topControlsOpacity,
                transform: [
                  {
                    translateY: topControlsOpacity.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-8, 0]
                    })
                  }
                ]
              }}
            >
              <View style={[styles.videoSwitchRow, compactControls ? styles.videoControlRowCompact : null]}>
                <TactilePressable
                  style={[
                    styles.videoSwitchChip,
                    compactControls ? styles.videoChipCompact : null,
                    compareFocus === "then" ? styles.videoSwitchChipActive : undefined
                  ]}
                  onPress={() => {
                    void switchFocus("then");
                  }}
                >
                  <Text
                    style={[
                      styles.videoSwitchText,
                      compactControls ? styles.videoChipTextCompact : null,
                      compareFocus === "then" ? styles.videoSwitchTextActive : undefined
                    ]}
                  >
                    Then
                  </Text>
                </TactilePressable>
                <TactilePressable
                  style={[
                    styles.videoSwitchChip,
                    compactControls ? styles.videoChipCompact : null,
                    compareFocus === "now" ? styles.videoSwitchChipActive : undefined
                  ]}
                  onPress={() => {
                    void switchFocus("now");
                  }}
                >
                  <Text
                    style={[
                      styles.videoSwitchText,
                      compactControls ? styles.videoChipTextCompact : null,
                      compareFocus === "now" ? styles.videoSwitchTextActive : undefined
                    ]}
                  >
                    Now
                  </Text>
                </TactilePressable>
              </View>
              <View style={[styles.videoPlaybackRow, compactControls ? styles.videoControlRowCompact : null]}>
                <TactilePressable
                  style={[styles.videoControlChip, compactControls ? styles.videoChipCompact : null]}
                  onPress={() => {
                    setPlaying((value) => !value);
                    revealTopControls();
                    scheduleTopControlsAutoHide();
                  }}
                >
                  <Text style={[styles.videoControlText, compactControls ? styles.videoChipTextCompact : null]}>
                    {playing ? "Pause" : "Play"}
                  </Text>
                </TactilePressable>
                <TactilePressable
                  style={[styles.videoControlChip, compactControls ? styles.videoChipCompact : null]}
                  onPress={() => {
                    setMuted((value) => !value);
                    revealTopControls();
                    scheduleTopControlsAutoHide();
                  }}
                >
                  <Text style={[styles.videoControlText, compactControls ? styles.videoChipTextCompact : null]}>
                    {muted ? "Sound Off" : "Sound On"}
                  </Text>
                </TactilePressable>
                <TactilePressable
                  style={[
                    styles.videoControlChip,
                    compactControls ? styles.videoChipCompact : null,
                    holdFlipActive ? styles.videoControlChipActive : undefined
                  ]}
                  onPressIn={() => {
                    handleHoldFlipStart();
                    revealTopControls();
                  }}
                  onPressOut={() => {
                    handleHoldFlipEnd();
                    scheduleTopControlsAutoHide();
                  }}
                >
                  <Text
                    style={[
                      styles.videoControlText,
                      compactControls ? styles.videoChipTextCompact : null,
                      holdFlipActive ? styles.videoControlTextActive : undefined
                    ]}
                  >
                    {holdFlipActive ? "Release" : "Hold Flip"}
                  </Text>
                </TactilePressable>
              </View>
            </Animated.View>
          </View>
          <View
            style={[
              styles.videoScrubOverlay,
              {
                left: scrubControlsSideInset,
                right: scrubControlsSideInset,
                bottom: scrubControlsBottomInset
              }
            ]}
          >
            <Text style={styles.videoScrubLabel}>Scrub Replay</Text>
            <Slider
              style={styles.videoScrubSlider}
              value={progressPct}
              minimumValue={0}
              maximumValue={1}
              onSlidingStart={handleSliderStart}
              onValueChange={handleSliderValueChange}
              onSlidingComplete={handleSliderComplete}
              minimumTrackTintColor={theme.colors.accentStrong}
              maximumTrackTintColor="rgba(255,255,255,0.28)"
              thumbTintColor="rgba(240,232,220,0.98)"
            />
          </View>
        </View>
      </View>
    );
  }

  const progressPct = scrubbing ? scrubRatio : Math.max(0, Math.min(1, positionMs / Math.max(1, durationMs)));

  return (
    <Animated.View
      style={[
        styles.container,
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
      {photoCompare ? renderPhotoCompare() : renderVideoCompare()}
      {photoCompare ? (
        <>
          <View style={styles.replayControlRow}>
            <Text style={styles.replayControlHint}>Drag split to compare. Hold to flip sides.</Text>
            <TactilePressable
              style={[styles.replayHoldButton, holdFlipActive ? styles.replayHoldButtonActive : undefined]}
              onPressIn={handleHoldFlipStart}
              onPressOut={handleHoldFlipEnd}
            >
              <Text style={[styles.replayHoldButtonText, holdFlipActive ? styles.replayHoldButtonTextActive : undefined]}>
                {holdFlipActive ? "Release" : "Hold to Flip"}
              </Text>
            </TactilePressable>
          </View>
          <View style={styles.labelMetaRow}>
            <Text style={styles.labelMetaText}>{`Then: ${thenLabel}`}</Text>
            <Text style={styles.labelMetaText}>{`Now: ${nowLabel}`}</Text>
          </View>
        </>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    gap: 8
  },
  mediaShell: {
    width: "100%",
    borderRadius: 0,
    overflow: "hidden",
    backgroundColor: "#0e0e0e"
  },
  videoOverlayRoot: {
    ...StyleSheet.absoluteFillObject
  },
  videoTopControls: {
    position: "absolute",
    gap: 8
  },
  videoScrubOverlay: {
    position: "absolute",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: theme.shape.cardRadiusMd,
    backgroundColor: "rgba(10,10,10,0.22)"
  },
  videoLayer: {
    ...StyleSheet.absoluteFillObject
  },
  videoLayerActive: {
    opacity: 1
  },
  videoLayerInactive: {
    opacity: 0
  },
  videoSwitchRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap"
  },
  videoControlRowCompact: {
    gap: 6
  },
  videoSwitchChip: {
    borderRadius: theme.shape.pillRadius,
    borderWidth: 2,
    borderColor: "#ffffff",
    backgroundColor: "rgba(240,232,220,0.92)",
    paddingHorizontal: 11,
    paddingVertical: 6
  },
  videoChipCompact: {
    paddingHorizontal: 9,
    paddingVertical: 5
  },
  videoSwitchChipActive: {
    backgroundColor: theme.colors.accent
  },
  videoSwitchText: {
    color: "#111111",
    fontWeight: "800",
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    fontFamily: theme.typography.label
  },
  videoSwitchTextActive: {
    color: "#130900"
  },
  videoPlaybackRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap"
  },
  videoControlChip: {
    borderRadius: theme.shape.pillRadius,
    borderWidth: 2,
    borderColor: "#ffffff",
    backgroundColor: "rgba(246,239,230,0.94)",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  videoControlText: {
    color: "#111111",
    fontWeight: "700",
    fontSize: 11,
    letterSpacing: 0.7,
    textTransform: "uppercase",
    fontFamily: theme.typography.label
  },
  videoChipTextCompact: {
    fontSize: 10,
    letterSpacing: 0.62
  },
  videoControlChipActive: {
    backgroundColor: theme.colors.accent
  },
  videoControlTextActive: {
    color: "#130900"
  },
  videoScrubLabel: {
    color: "#f7f1e9",
    fontWeight: "800",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.95,
    fontFamily: theme.typography.label
  },
  videoScrubSlider: {
    height: 30,
    marginTop: 2,
    marginHorizontal: -6
  },
  photoLayer: {
    ...StyleSheet.absoluteFillObject
  },
  photoThenMask: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    overflow: "hidden"
  },
  photoSplitLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: "#f7efe3"
  },
  photoHandleWrap: {
    position: "absolute",
    top: "50%",
    width: 36,
    height: 36,
    marginTop: -18,
    alignItems: "center",
    justifyContent: "center"
  },
  photoHandle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#ffffff",
    backgroundColor: "rgba(240,232,220,0.96)",
    alignItems: "center",
    justifyContent: "center"
  },
  photoHandleText: {
    color: "#111111",
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 0.7
  },
  photoLabelRow: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    justifyContent: "space-between"
  },
  photoLabelRowCompact: {
    top: 14
  },
  photoLabelPill: {
    borderRadius: theme.shape.pillRadius,
    borderWidth: 2,
    borderColor: "#ffffff",
    backgroundColor: "rgba(240,232,220,0.92)",
    color: "#111111",
    fontWeight: "800",
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    fontFamily: theme.typography.label,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  replayControlRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 8
  },
  replayControlHint: {
    flex: 1,
    color: "#2d2d2d",
    fontSize: 11,
    fontWeight: "600",
    fontFamily: theme.typography.body
  },
  replayHoldButton: {
    borderRadius: theme.shape.pillRadius,
    borderWidth: 2,
    borderColor: "#ffffff",
    backgroundColor: "rgba(240,232,220,0.95)",
    paddingHorizontal: 11,
    paddingVertical: 6
  },
  replayHoldButtonActive: {
    backgroundColor: theme.colors.accent
  },
  replayHoldButtonText: {
    color: "#111111",
    fontWeight: "800",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontFamily: theme.typography.label
  },
  replayHoldButtonTextActive: {
    color: "#130900"
  },
  labelMetaRow: {
    paddingHorizontal: 8,
    gap: 2
  },
  labelMetaText: {
    color: "#2d2d2d",
    fontSize: 11,
    fontWeight: "600",
    fontFamily: theme.typography.body
  }
});
