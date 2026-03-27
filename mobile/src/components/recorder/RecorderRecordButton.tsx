import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { triggerSelectionHaptic } from "../../utils/feedback";

// Same paths as LogoMorphLoader
const CLEAN_PATH =
  "M442 161.648C428.914 155.578 415.073 150.954 400.526 147.818C392.001 145.985 377.487 144.714 363 144.224C349.302 143.761 335.629 143.996 327.066 145.114C317.465 146.375 307.947 148.05 298.5 150.142C287.576 152.562 276.748 155.539 266 159.079C255.597 162.506 245.269 166.46 235 170.947C227.383 174.276 219.8 177.898 212.243 181.815C205.188 185.471 198.447 189.175 192 192.942C183.887 197.683 176.242 202.525 169.026 207.5C162.322 212.122 155.99 216.86 150 221.739C140.353 229.598 131.593 237.823 123.599 246.526C117.172 253.523 111.239 260.829 105.737 268.5C100.951 275.173 96.4915 282.123 92.3161 289.388C86.6415 299.26 82.361 310.358 79.4754 322C76.9387 332.234 75.4801 342.889 75.1003 353.5C74.6792 365.263 75.5838 376.973 77.8149 388C80.5633 401.584 85.3248 414.13 92.1011 424.46C95.8255 430.127 103.354 438.546 111.142 446.149C117.368 452.227 123.76 457.784 128.509 460.999C134.813 465.271 142.064 469.345 150 473.142C159.646 477.756 170.303 481.958 181.5 485.6C190.003 488.366 198.818 490.809 207.737 492.864C222.24 496.205 237.02 498.52 251.189 499.53C256.368 499.899 265.389 500.035 276 499.992C284.997 499.956 295.137 499.791 305.049 499.53C324.335 499.022 342.756 498.152 350.205 497.162C359.594 495.916 368.685 494.485 377.5 492.864C393.919 489.844 409.376 486.163 424 481.785C432.776 479.157 441.251 476.279 449.453 473.142C461.204 468.647 472.394 463.621 483.105 458.04C491.755 453.53 498.535 449.776 504.364 446.149C514.219 440.018 521.356 434.25 530.216 425.805C534.954 421.286 539.219 416.691 543.019 412C549.266 404.289 554.258 396.319 558.035 388C564.08 374.686 567.013 360.478 567 345.004C566.992 332.592 564.912 319.591 560.624 305.5C557.67 295.795 553.668 285.572 548.575 274.67C542.995 262.725 536.868 251.544 530.216 241.149C522.325 228.818 513.695 217.591 504.364 207.5C495.487 197.9 485.975 189.329 475.861 181.815C465.227 173.913 453.927 167.18 442 161.648Z";

const JAGGED_PATH_RAW =
  "M222.615 505.052C223.444 509.594 225.145 513.262 227.196 514.966C232.052 518.984 239.148 517.601 274.047 505.809C290.798 500.145 306.764 495.516 309.498 495.516C312.232 495.516 320.768 498.267 328.46 501.616C345.037 508.837 353.558 509.419 370.891 504.469C376.94 502.751 385.301 501.339 389.474 501.339C395.073 501.339 398.446 500.407 402.459 497.758C405.44 495.778 418.92 489.227 432.414 483.199C476.139 463.648 505.658 445.479 525.579 425.825C538.797 412.796 541.821 406.259 540.324 393.957C537.343 369.528 535.176 377.346 555.548 339.014C567.123 317.22 569.769 302.502 564.185 290.928C562.542 287.536 556.479 280.592 550.43 275.132C537.764 263.748 536.703 260.749 540.105 246.059C541.356 240.629 542.388 233.102 542.388 229.332C542.388 223.421 541.661 221.718 537.197 217.117C534.347 214.162 530.741 211.352 529.185 210.857C527.629 210.377 523.747 206.111 520.533 201.38C513.961 191.699 507.562 187.418 492.222 182.483C474.729 176.849 470.89 173.996 461.496 159.598C453.673 147.587 452.219 147.019 432.065 148.227C415.416 149.232 414.732 149.145 410.922 145.869C408.247 143.554 406.444 139.944 405.237 134.47C403.521 126.71 403.303 126.448 398.228 126.026C395.349 125.779 386.857 127.322 379.354 129.447C371.85 131.573 359.505 134.834 351.9 136.697C344.295 138.561 336.123 140.861 333.724 141.822C330.83 142.972 316.347 143.7 290.827 143.962C245.605 144.457 231.689 146.291 217.831 153.629C201.443 162.276 177.494 189.952 167.068 212.226C162.808 221.354 162.197 221.951 147.859 230.657C121.831 246.481 109.064 263.573 109.064 282.586C109.064 291.001 106.345 295.863 93.4321 310.625C71.9549 335.142 70.748 344.954 87.4702 358.944C110.242 378.001 111.056 379.544 112.641 406.71C114.633 440.82 117.352 443.776 151.742 449.06C171.067 452.03 180.504 455.495 183.252 460.634C184.125 462.265 185.783 468.525 186.931 474.537C190.232 491.803 190.116 491.687 206.707 493.318C212.029 493.842 217.497 495.065 218.849 496.054C220.201 497.044 221.888 501.092 222.615 505.052Z";

const ACCENT = "#E8450A";
const IDLE_GRAY = "rgba(0,0,0,0.18)";
const BUTTON_SIZE = 80;

// --- Path alignment (same as LogoMorphLoader) ---

type Seg = { cp1x: number; cp1y: number; cp2x: number; cp2y: number; endX: number; endY: number };

function parsePath(d: string) {
  const nums = d.match(/-?\d+\.?\d*/g)!.map(Number);
  const segments: Seg[] = [];
  for (let i = 2; i + 5 < nums.length; i += 6) {
    segments.push({ cp1x: nums[i]!, cp1y: nums[i+1]!, cp2x: nums[i+2]!, cp2y: nums[i+3]!, endX: nums[i+4]!, endY: nums[i+5]! });
  }
  return { startX: nums[0]!, startY: nums[1]!, segments };
}

function rotateToAlign(parsed: ReturnType<typeof parsePath>, tx: number, ty: number): string {
  const starts = [{ x: parsed.startX, y: parsed.startY }];
  for (let i = 0; i < parsed.segments.length - 1; i++) starts.push({ x: parsed.segments[i]!.endX, y: parsed.segments[i]!.endY });
  let best = 0, bestD = Infinity;
  for (let i = 0; i < starts.length; i++) { const d = (starts[i]!.x-tx)**2 + (starts[i]!.y-ty)**2; if (d < bestD) { bestD = d; best = i; } }
  const rot = [...parsed.segments.slice(best), ...parsed.segments.slice(0, best)];
  let p = `M${starts[best]!.x} ${starts[best]!.y}`;
  for (const s of rot) p += `C${s.cp1x} ${s.cp1y} ${s.cp2x} ${s.cp2y} ${s.endX} ${s.endY}`;
  return p + "Z";
}

const cp = parsePath(CLEAN_PATH);
const JAGGED_PATH = rotateToAlign(parsePath(JAGGED_PATH_RAW), cp.startX, cp.startY);

function extractNums(path: string): number[] { return (path.match(/-?\d+\.?\d*/g) ?? []).map(Number); }
function rebuild(tpl: string, nums: number[]): string { let i = 0; return tpl.replace(/-?\d+\.?\d*/g, () => (nums[i++] ?? 0).toFixed(2)); }
function lerp(a: number[], b: number[], t: number): number[] { const r = new Array(Math.min(a.length, b.length)); for (let i = 0; i < r.length; i++) r[i] = a[i]! + (b[i]! - a[i]!) * t; return r; }

const jNums = extractNums(JAGGED_PATH);
const cNums = extractNums(CLEAN_PATH);

// --- Component ---

type Props = {
  recording: boolean;
  saving: boolean;
  cameraMounted: boolean;
  captureType: "video" | "photo";
  onToggle: () => void;
};

export function RecorderRecordButton({ recording, saving, cameraMounted, captureType, onToggle }: Props) {
  const isVideo = captureType === "video";
  const progress = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const [pathD, setPathD] = useState(JAGGED_PATH);

  // Morph: jagged → clean while recording, back when stopped
  useEffect(() => {
    Animated.timing(progress, {
      toValue: recording ? 1 : 0,
      duration: recording ? 900 : 500,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [recording, progress]);

  // Breathing pulse while recording
  useEffect(() => {
    if (recording) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.08, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
      animation.start();
      return () => animation.stop();
    }
    pulse.setValue(1);
  }, [recording, pulse]);

  useEffect(() => {
    const id = progress.addListener(({ value }) => {
      setPathD(rebuild(JAGGED_PATH, lerp(jNums, cNums, value)));
    });
    return () => progress.removeListener(id);
  }, [progress]);

  const fillColor = recording ? ACCENT : IDLE_GRAY;

  return (
    <View style={styles.wrap}>
      <Pressable
        style={({ pressed }) => [styles.outer, pressed && styles.pressed]}
        onPress={() => { triggerSelectionHaptic(); onToggle(); }}
        disabled={saving || !cameraMounted}
      >
        <Animated.View style={{ transform: [{ scale: pulse }] }}>
          <Svg width={BUTTON_SIZE} height={BUTTON_SIZE} viewBox="0 0 643 643">
            <Path d={pathD} fill={fillColor} />
          </Svg>
        </Animated.View>
      </Pressable>
      <Text style={[styles.hint, recording && styles.hintActive]}>
        {!cameraMounted
          ? "booting camera..."
          : isVideo
            ? recording ? "tap to stop" : "tap to record"
            : "tap to capture"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center" },
  outer: {
    width: BUTTON_SIZE + 12,
    height: BUTTON_SIZE + 12,
    borderRadius: (BUTTON_SIZE + 12) / 2,
    backgroundColor: "rgba(0,0,0,0.03)",
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { transform: [{ scale: 0.93 }] },
  hint: {
    marginTop: 10,
    color: "rgba(0,0,0,0.35)",
    fontWeight: "700",
    fontSize: 14,
  },
  hintActive: {
    color: ACCENT,
  },
});
