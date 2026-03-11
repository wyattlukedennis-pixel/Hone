export type DevDateShiftSettings = {
  enabled: boolean;
  dayOffset: number;
  autoAdvanceAfterSave: boolean;
};

export const defaultDevDateShiftSettings: DevDateShiftSettings = {
  enabled: false,
  dayOffset: 0,
  autoAdvanceAfterSave: false
};
