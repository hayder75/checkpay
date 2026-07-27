const { withAndroidManifest, withDangerousMod, withMainApplication } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const TEMPLATE_DIR = path.join(__dirname, 'notification-listener');
const KOTLIN_FILES = [
  'TransactionNotificationListenerService.kt',
  'NotificationCaptureStore.kt',
  'NotificationListenerModule.kt',
  'NotificationListenerPackage.kt',
];

function withNotificationListenerManifest(config) {
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

/**
 * Copies the Kotlin sources for the notification listener into the app module.
 */
function withNotificationListenerSources(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const packageName = config.android?.package || 'com.checkpay.mobile';
      const packageDir = packageName.replace(/\./g, '/');
      const destDir = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'java',
        packageDir
      );

      fs.mkdirSync(destDir, { recursive: true });

      for (const file of KOTLIN_FILES) {
        const templatePath = path.join(TEMPLATE_DIR, file);
        let contents = fs.readFileSync(templatePath, 'utf8');
        // Adjust the package declaration to the app package name
        contents = contents.replace(/^package\s+[\w.]+/m, `package ${packageName}`);
        fs.writeFileSync(path.join(destDir, file), contents);
      }

      return config;
    },
  ]);
}

/**
 * Registers NotificationListenerPackage in MainApplication.
 */
function withNotificationListenerMainApplication(config) {
  return withMainApplication(config, (config) => {
    const src = config.modResults.contents;

    if (src.includes('NotificationListenerPackage')) {
      return config;
    }

    const anchor = /PackageList\(this\)\.packages\.apply\s*\{/;
    if (anchor.test(src)) {
      config.modResults.contents = src.replace(
        anchor,
        (match) => `${match}\n              add(NotificationListenerPackage())`
      );
    } else {
      throw new Error(
        '[withNotificationListener] Could not find package registration anchor in MainApplication'
      );
    }

    return config;
  });
}

function withNotificationListener(config) {
  config = withNotificationListenerManifest(config);
  config = withNotificationListenerSources(config);
  config = withNotificationListenerMainApplication(config);
  return config;
}

module.exports = withNotificationListener;
