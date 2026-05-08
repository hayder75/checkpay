import { Alert, Linking, NativeModules, Platform } from 'react-native';

type CapturedNotification = {
  id: string;
  packageName: string;
  title: string;
  text: string;
  subText?: string;
  postedAt: number;
};

type NotificationListenerModule = {
  isNotificationAccessEnabled: () => Promise<boolean>;
  openNotificationAccessSettings: () => Promise<boolean>;
  getCapturedNotifications: () => Promise<CapturedNotification[]>;
};

const NotificationListener = NativeModules.NotificationListener as NotificationListenerModule | undefined;

export async function isNotificationAccessEnabled(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  if (!NotificationListener?.isNotificationAccessEnabled) return false;

  try {
    return !!(await NotificationListener.isNotificationAccessEnabled());
  } catch {
    return false;
  }
}

export async function openNotificationAccessSettings(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;

  try {
    if (NotificationListener?.openNotificationAccessSettings) {
      return !!(await NotificationListener.openNotificationAccessSettings());
    }

    await Linking.openSettings();
    return true;
  } catch {
    return false;
  }
}

export async function getCapturedNotifications(): Promise<CapturedNotification[]> {
  if (Platform.OS !== 'android') return [];
  if (!NotificationListener?.getCapturedNotifications) return [];

  try {
    const data = await NotificationListener.getCapturedNotifications();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function checkAndPromptNotificationAccess(): Promise<boolean> {
  const enabled = await isNotificationAccessEnabled();
  if (enabled) return true;

  return new Promise((resolve) => {
    Alert.alert(
      'Notification Access Required',
      'CheckPay now uses notification monitoring for transaction detection. Please enable Notification Access for CheckPay to continue automatic transaction capture.',
      [
        {
          text: 'Not Now',
          style: 'cancel',
          onPress: () => resolve(false),
        },
        {
          text: 'Open Settings',
          onPress: async () => {
            await openNotificationAccessSettings();
            resolve(false);
          },
        },
      ]
    );
  });
}
