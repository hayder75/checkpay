const { withAndroidManifest } = require('@expo/config-plugins');

function withNotificationListener(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const app = manifest.application?.[0];

    if (!app) {
      return config;
    }

    if (!app.service) {
      app.service = [];
    }

    const hasListenerService = app.service.some(
      (service) => service?.$?.['android:name'] === '.TransactionNotificationListenerService'
    );

    if (!hasListenerService) {
      app.service.push({
        $: {
          'android:name': '.TransactionNotificationListenerService',
          'android:permission': 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE',
          'android:exported': 'true',
          'android:label': 'CheckPay Notification Listener',
        },
        'intent-filter': [
          {
            action: [
              {
                $: {
                  'android:name': 'android.service.notification.NotificationListenerService',
                },
              },
            ],
          },
        ],
      });
    }

    return config;
  });
}

module.exports = withNotificationListener;
