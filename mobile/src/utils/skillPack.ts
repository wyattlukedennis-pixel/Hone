import type { SkillPack } from "../types/journey";

export type { SkillPack };

type ProtocolGuide = {
  label: string;
  focus: string;
  setupTip: string;
  repTip: string;
};

const skillPackLabels: Record<SkillPack, string> = {
  fitness: "Fitness",
  drawing: "Drawing",
  instrument: "Instrument"
};

export const skillPackOptions: Array<{ key: SkillPack; label: string }> = [
  { key: "fitness", label: "Fitness" },
  { key: "drawing", label: "Drawing" },
  { key: "instrument", label: "Instrument" }
];

export function getSkillPackLabel(skillPack: SkillPack) {
  return skillPackLabels[skillPack];
}

export function getSkillPackProtocol(skillPack: SkillPack, captureType: "video" | "photo"): ProtocolGuide {
  if (skillPack === "fitness") {
    return {
      label: "Form Protocol",
      focus: captureType === "photo" ? "Capture your full stance from the same distance." : "Keep full body in frame from the same distance.",
      setupTip: "Place camera chest-height and keep feet visible.",
      repTip: captureType === "photo" ? "Take one photo at the same rep moment each day." : "Record one clean rep at steady tempo."
    };
  }
  if (skillPack === "drawing") {
    return {
      label: "Canvas Protocol",
      focus: captureType === "photo" ? "Capture the page straight-on with even lighting." : "Keep page centered with stable overhead framing.",
      setupTip: "Use the same desk angle and remove shadows.",
      repTip: captureType === "photo" ? "Photograph the same zoom level each day." : "Record the same section while drawing."
    };
  }
  return {
    label: "Performance Protocol",
    focus: captureType === "photo" ? "Capture posture and hand position at your anchor frame." : "Keep instrument and hands fully in frame.",
    setupTip: "Lock camera position and keep the same practice spot.",
    repTip: captureType === "photo" ? "Capture the same bar/chord position daily." : "Record the same warmup phrase each day."
  };
}

