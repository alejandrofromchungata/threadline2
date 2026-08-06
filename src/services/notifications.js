import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function ensurePermission() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('laundry', {
      name: 'Laundry reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return !!asked.granted;
}

/**
 * Local reminder when the clean rotation is thin. No push server needed.
 */
export async function scheduleLaundryReminder(dirtyCount, categories) {
  const ok = await ensurePermission();
  if (!ok) return false;

  await cancelLaundryReminder();
  await Notifications.scheduleNotificationAsync({
    identifier: 'threadline-laundry',
    content: {
      title: 'Running low on clean clothes',
      body: `${dirtyCount} pieces are in the worn pile, including your ${categories.join(' and ')}.`,
      data: { screen: 'Log' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour: 19,
      minute: 0,
      repeats: false,
      channelId: 'laundry',
    },
  });
  return true;
}

export async function cancelLaundryReminder() {
  try {
    await Notifications.cancelScheduledNotificationAsync('threadline-laundry');
  } catch {
    /* nothing scheduled */
  }
}
