import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import type { DailyMomentSettings } from "../types/dailyMoment";

const DAILY_MOMENT_NOTIFICATION_ID_KEY = "hone.dailyMoment.notificationId";
const DAILY_MOMENT_CHANNEL_ID = "daily-moment";

let notificationHandlerConfigured = false;

function ensureHandlerConfigured() {
  if (notificationHandlerConfigured) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false
    })
  });
  notificationHandlerConfigured = true;
}

async function ensureNotificationPermissions() {
  const permissions = await Notifications.getPermissionsAsync();
  const granted =
    permissions.granted ||
    permissions.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  if (granted) return true;

  const requested = await Notifications.requestPermissionsAsync();
  return (
    requested.granted ||
    requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(DAILY_MOMENT_CHANNEL_ID, {
    name: "Daily Moment",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 120, 250],
    sound: null
  });
}

export async function cancelDailyMomentNotification() {
  const existingId = await AsyncStorage.getItem(DAILY_MOMENT_NOTIFICATION_ID_KEY);
  if (existingId) {
    try {
      await Notifications.cancelScheduledNotificationAsync(existingId);
    } catch {
      // already removed
    }
  }
  await AsyncStorage.removeItem(DAILY_MOMENT_NOTIFICATION_ID_KEY);
}

export async function scheduleDailyMomentNotification(settings: DailyMomentSettings) {
  ensureHandlerConfigured();
  await ensureAndroidChannel();
  await cancelDailyMomentNotification();

  if (!settings.enabled) {
    return { scheduled: false as const, reason: "disabled" as const };
  }

  const permissionsGranted = await ensureNotificationPermissions();
  if (!permissionsGranted) {
    return { scheduled: false as const, reason: "permission_denied" as const };
  }

  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: "it's your moment.",
      body: "drop today's clip before the day slips.",
      data: {
        honeAction: "open_recorder",
        source: "daily_moment"
      }
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: settings.hour,
      minute: settings.minute,
      channelId: DAILY_MOMENT_CHANNEL_ID
    }
  });

  await AsyncStorage.setItem(DAILY_MOMENT_NOTIFICATION_ID_KEY, identifier);
  return { scheduled: true as const };
}

function shouldOpenRecorderFromData(data: Record<string, unknown> | undefined) {
  return data?.honeAction === "open_recorder";
}

export function addDailyMomentNotificationResponseListener(onOpenRecorder: (source: string) => void) {
  ensureHandlerConfigured();
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as Record<string, unknown> | undefined;
    if (!shouldOpenRecorderFromData(data)) return;
    onOpenRecorder("notification_tap");
  });
  return () => subscription.remove();
}

export async function handleInitialDailyMomentNotificationResponse(
  onOpenRecorder: (source: string) => void
) {
  ensureHandlerConfigured();
  const response = await Notifications.getLastNotificationResponseAsync();
  if (!response) return;
  const data = response.notification.request.content.data as Record<string, unknown> | undefined;
  if (!shouldOpenRecorderFromData(data)) return;
  onOpenRecorder("notification_launch");
  await Notifications.clearLastNotificationResponseAsync?.();
}
