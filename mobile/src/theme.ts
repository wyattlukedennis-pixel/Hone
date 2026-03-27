import { Platform } from "react-native";

const displayFamily = Platform.select({
  ios: "Georgia-Bold",
  android: "serif",
  default: "System"
});
const headingFamily = Platform.select({
  ios: "AvenirNext-Bold",
  android: "sans-serif-medium",
  default: "System"
});
const labelFamily = Platform.select({
  ios: "AvenirNext-DemiBold",
  android: "sans-serif-medium",
  default: "System"
});
const bodyFamily = Platform.select({
  ios: "Georgia",
  android: "sans-serif",
  default: "System"
});

const colors = {
  bgStart: "#f4efe6",
  bgMid: "#ebe5da",
  bgEnd: "#e1d7c8",
  textPrimary: "#101010",
  textSecondary: "#2a2a2a",
  accent: "#ff5a1f",
  accentStrong: "#ea3d00",
  accentGlow: "#ffad85",
  danger: "#cb1f1f",
  success: "#157a3f",
  glassBorder: "rgba(0,0,0,0.08)",
  glassFillTop: "rgba(247,243,236,0.95)",
  glassFillBottom: "rgba(237,230,220,0.9)",
  darkGlassBorder: "rgba(255,255,255,0.1)",
  darkGlassFillTop: "rgba(21,21,21,0.97)",
  darkGlassFillBottom: "rgba(8,8,8,0.95)",
  darkTextPrimary: "#f6f1e8",
  darkTextSecondary: "#c8c0b2",
  tabText: "#2c2c2c",
  tabTextActive: "#f5f2ea"
};

const gradients = {
  appBackground: ["#f4efe6", "#ebe5da", "#e1d7c8"] as [string, string, string],
  primaryAction: ["#ff8b2b", "#ff5a1f", "#d93000"] as [string, string, string],
  tabIndicator: ["#ff5a1f", "#ea3d00"] as [string, string],
  topControl: ["rgba(31,31,31,0.96)", "rgba(4,4,4,0.96)"] as [string, string],
  topControlActive: ["rgba(5,5,5,0.98)", "rgba(5,5,5,0.98)"] as [string, string],
  topControlGhost: ["rgba(241,233,221,0.97)", "rgba(241,233,221,0.97)"] as [string, string],
  heroSurface: ["rgba(246,241,232,0.99)", "rgba(235,227,214,0.96)"] as [string, string],
  heroSurfaceReveal: ["rgba(246,241,232,0.99)", "rgba(234,225,211,0.97)"] as [string, string],
  intelCard: ["rgba(246,241,232,0.99)", "rgba(235,227,214,0.97)"] as [string, string],
  calendarHero: ["rgba(246,241,232,0.99)", "rgba(233,224,210,0.97)"] as [string, string],
  calendarHeroScene: ["rgba(246,241,232,0.99)", "rgba(232,223,208,0.98)"] as [string, string]
};

const shape = {
  topControlRadius: 12,
  chipRadius: 10,
  badgeRadius: 10,
  buttonRadius: 14,
  tabBarRadius: 20,
  tabIndicatorRadius: 14,
  cardRadiusLg: 16,
  cardRadiusMd: 14,
  pillRadius: 999
};

const decor = {
  field: {
    ring: "rgba(0,0,0,0.02)",
    stripeA: "rgba(255,90,31,0.04)",
    stripeB: "rgba(0,0,0,0.02)",
    stripeC: "rgba(255,255,255,0.02)",
    gridStrong: "rgba(0,0,0,0.04)",
    gridSoft: "rgba(0,0,0,0.03)"
  }
};

export const theme = {
  visualDirection: "modern" as const,
  colors,
  gradients,
  shape,
  decor,
  typography: {
    display: displayFamily,
    heading: headingFamily,
    label: labelFamily,
    body: bodyFamily
  },
  motion: {
    microMs: 160,
    transitionMs: 300,
    rewardMs: 540
  }
};
