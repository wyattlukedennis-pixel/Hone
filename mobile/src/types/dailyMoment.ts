export type DailyMomentSettings = {
  enabled: boolean;
  hour: number;
  minute: number;
  windowMinutes: number;
  autoOpenRecorder: boolean;
};

export const defaultDailyMomentSettings: DailyMomentSettings = {
  enabled: true,
  hour: 19,
  minute: 0,
  windowMinutes: 10,
  autoOpenRecorder: true
};
