import { Easing } from "react-native";

export const motionTokens = {
  sectionStaggerMs: 78,
  reveal: {
    primaryY: 14,
    primaryScaleFrom: 0.988,
    secondaryY: 12,
    secondaryScaleFrom: 0.992,
    historyCardY: 18,
    historyCardScaleFrom: 0.99,
    historyContentY: 14,
    historyContentScaleFrom: 0.99
  },
  durationOffset: {
    sectionIn: -20,
    sectionInSoft: -35,
    sectionInLight: -30,
    sectionOut: -70,
    contentIn: 20,
    contentOut: -30
  },
  easing: {
    outCubic: Easing.out(Easing.cubic),
    inCubic: Easing.in(Easing.cubic),
    outQuad: Easing.out(Easing.quad),
    inQuad: Easing.in(Easing.quad)
  }
} as const;
