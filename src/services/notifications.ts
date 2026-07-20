import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const DAILY_REMINDER_ID = 'aisocial-daily-reminder';

let permissionRequested = false;

/** Requests notification permission at most once per app session; safe to call repeatedly. */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    const existing = await Notifications.getPermissionsAsync();
    if (existing.granted) return true;
    if (permissionRequested) return false;
    permissionRequested = true;
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
  }
  return true;
}

/** Fired when a model finishes downloading — useful if the app was backgrounded mid-download. */
export async function notifyModelDownloadComplete(filename: string): Promise<void> {
  const granted = await ensureNotificationPermission();
  if (!granted) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Model downloaded',
      body: `${filename} is ready. Open AI Social to start using it.`,
    },
    trigger: null, // fire immediately
  });
}

export async function scheduleDailyReminder(hour: number, minute: number): Promise<boolean> {
  const granted = await ensureNotificationPermission();
  if (!granted) return false;
  await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_ID).catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: DAILY_REMINDER_ID,
    content: {
      title: 'AI Social',
      body: 'Your feed is waiting — see what your AI authors have been up to.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
  return true;
}

export async function cancelDailyReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_ID).catch(() => {});
}
