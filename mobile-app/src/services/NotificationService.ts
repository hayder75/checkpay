import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import api from './api';
import { log } from '../utils/logger';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      log.warn('Notification', 'Failed to get push token for push notification!');
      return;
    }
    
    // Get the token
    try {
        const projectId = Constants?.expoConfig?.extra?.eas?.projectId || Constants?.easConfig?.projectId;
        
        // For Android, check if we have FCM configured
        if (Platform.OS === 'android') {
          // Try to get Expo push token (works with or without FCM)
          // If FCM is not configured, this will still work but may show a warning
          try {
            token = (await Notifications.getExpoPushTokenAsync({
              projectId,
            })).data;
            log.info('Notification', 'Expo Push Token obtained', { token });
          } catch (fcmError: any) {
            // If FCM error, log warning but don't fail completely
            if (fcmError.message?.includes('Firebase') || fcmError.message?.includes('FCM')) {
              log.warn('Notification', 'FCM not configured. Push notifications may not work on Android. See: https://docs.expo.dev/push-notifications/fcm-credentials/', fcmError);
              // Return null to indicate token couldn't be obtained
              return null;
            }
            throw fcmError;
          }
        } else {
          // iOS - no FCM needed
          token = (await Notifications.getExpoPushTokenAsync({
            projectId,
          })).data;
          log.info('Notification', 'Expo Push Token obtained', { token });
        }
    } catch (e) {
        log.error('Notification', 'Error getting push token', e);
        // Don't throw - allow app to continue without push notifications
        return null;
    }
  } else {
    log.info('Notification', 'Must use physical device for Push Notifications');
  }

  return token;
}

export async function sendPushTokenToBackend(token: string) {
    try {
        await api.post('/notifications/push-token', {
            token,
            platform: Platform.OS
        });
        log.info('Notification', 'Push token sent to backend');
    } catch (error) {
        log.error('Notification', 'Failed to send push token to backend', error);
    }
}

// Type for navigation callback
export type NotificationNavigationCallback = (data: {
    notificationId?: string;
    txnId?: string;
    type?: string;
    [key: string]: any;
}) => void;

let navigationCallback: NotificationNavigationCallback | null = null;

/**
 * Set the navigation callback for handling notification taps
 */
export function setNotificationNavigationCallback(callback: NotificationNavigationCallback) {
    navigationCallback = callback;
}

export function setupNotificationListeners() {
    // Foreground listener
    const notificationListener = Notifications.addNotificationReceivedListener(notification => {
        log.debug('Notification', 'Notification received in foreground', notification);
        
        // Mark as read if notification has an ID
        const notificationId = notification.request.content.data?.notificationId;
        if (notificationId) {
            notificationAPI.markAsRead(notificationId).catch(err => {
                log.error('Notification', 'Failed to mark notification as read', err);
            });
        }
    });

    // Response listener (user tapped notification)
    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
        log.debug('Notification', 'Notification tapped', response);
        
        const data = response.notification.request.content.data || {};
        const notificationId = data.notificationId;
        
        // Mark as read
        if (notificationId) {
            notificationAPI.markAsRead(notificationId).catch(err => {
                log.error('Notification', 'Failed to mark notification as read', err);
            });
        }
        
        // Navigate based on notification type
        if (navigationCallback) {
            try {
                navigationCallback({
                    notificationId,
                    txnId: data.txnId,
                    type: data.type || response.notification.request.content.data?.type,
                    ...data,
                });
            } catch (error) {
                log.error('Notification', 'Error in navigation callback', error);
            }
        } else {
            log.warn('Notification', 'No navigation callback set for notification tap');
        }
    });

    return () => {
        Notifications.removeNotificationSubscription(notificationListener);
        Notifications.removeNotificationSubscription(responseListener);
    };
}

export const notificationAPI = {
    getAll: async (page: number = 1, limit: number = 20, unreadOnly: boolean = false) => {
        const response = await api.get('/notifications', {
            params: { page, limit, unreadOnly: unreadOnly ? 'true' : 'false' },
        });
        return response.data;
    },
    getUnreadCount: async () => {
        const response = await api.get('/notifications/unread-count');
        return response.data.count;
    },
    markAsRead: async (id: string) => {
        const response = await api.patch(`/notifications/${id}/read`);
        return response.data;
    },
    markAllAsRead: async () => {
        const response = await api.patch('/notifications/mark-all-read');
        return response.data;
    },
    batchMarkAsRead: async (ids: string[]) => {
        const response = await api.patch('/notifications/batch-read', { ids });
        return response.data;
    },
    delete: async (id: string) => {
        const response = await api.delete(`/notifications/${id}`);
        return response.data;
    },
};
