const { withAndroidManifest, withMainApplication, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo Config Plugin to add SMS BroadcastReceiver for background SMS monitoring
 * This receiver works even when the app is closed.
 */
function withSMSReceiver(config) {
  // Step 1: Add BroadcastReceiver to AndroidManifest.xml
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    
    // Ensure application element exists
    if (!manifest.application) {
      manifest.application = [{}];
    }
    
    const application = manifest.application[0];
    
    // Ensure receiver array exists
    if (!application.receiver) {
      application.receiver = [];
    }
    
    // Check if our receiver is already registered
    const hasReceiver = application.receiver.some(
      (r) => r.$?.['android:name'] === '.SMSBroadcastReceiver'
    );
    
    if (!hasReceiver) {
      // Add the SMS BroadcastReceiver
      application.receiver.push({
        $: {
          'android:name': '.SMSBroadcastReceiver',
          'android:exported': 'true',
          'android:permission': 'android.permission.BROADCAST_SMS',
        },
        'intent-filter': [
          {
            $: {
              'android:priority': '999',
            },
            action: [
              {
                $: {
                  'android:name': 'android.provider.Telephony.SMS_RECEIVED',
                },
              },
            ],
          },
        ],
      });
      
      console.log('✅ [withSMSReceiver] Added SMSBroadcastReceiver to AndroidManifest.xml');
    }
    
    return config;
  });

  // Step 2: Create the Kotlin BroadcastReceiver file
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const packageName = config.android?.package || 'com.checkpay.mobile';
      const packagePath = packageName.replace(/\./g, '/');
      
      // Path to the java source directory
      const srcMainPath = path.join(
        projectRoot,
        'android',
        'app',
        'src',
        'main',
        'java',
        packagePath
      );
      
      // Ensure directory exists
      if (!fs.existsSync(srcMainPath)) {
        fs.mkdirSync(srcMainPath, { recursive: true });
      }
      
      // Create SMSBroadcastReceiver.kt
      const receiverPath = path.join(srcMainPath, 'SMSBroadcastReceiver.kt');
      const receiverContent = `package ${packageName}

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import android.util.Log
import com.facebook.react.HeadlessJsTaskService

/**
 * BroadcastReceiver that listens for incoming SMS messages.
 * Processes SMS even when the app is closed by starting a HeadlessJS task.
 */
class SMSBroadcastReceiver : BroadcastReceiver() {
    
    companion object {
        private const val TAG = "SMSBroadcastReceiver"
    }
    
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Telephony.Sms.Intents.SMS_RECEIVED_ACTION) {
            Log.d(TAG, "SMS received - starting HeadlessJS task")
            
            try {
                // Extract SMS messages from intent
                val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
                
                if (messages.isNotEmpty()) {
                    for (message in messages) {
                        val sender = message.displayOriginatingAddress ?: ""
                        val body = message.messageBody ?: ""
                        val timestamp = message.timestampMillis
                        
                        Log.d(TAG, "SMS from: \$sender, preview: \${body.take(50)}...")
                        
                        // Start HeadlessJS service to process SMS in JS
                        val serviceIntent = Intent(context, SMSHeadlessTaskService::class.java)
                        serviceIntent.putExtra("sender", sender)
                        serviceIntent.putExtra("body", body)
                        serviceIntent.putExtra("timestamp", timestamp)
                        
                        // Use startForegroundService for Android 8+ or startService for older
                        try {
                            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                                context.startForegroundService(serviceIntent)
                            } else {
                                context.startService(serviceIntent)
                            }
                        } catch (e: Exception) {
                            Log.e(TAG, "Error starting HeadlessJS service: \${e.message}")
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error processing SMS: \${e.message}")
            }
        }
    }
}
`;
      
      fs.writeFileSync(receiverPath, receiverContent);
      console.log('✅ [withSMSReceiver] Created SMSBroadcastReceiver.kt');
      
      // Create SMSHeadlessTaskService.kt
      const servicePath = path.join(srcMainPath, 'SMSHeadlessTaskService.kt');
      const serviceContent = `package ${packageName}

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Intent
import android.os.Build
import android.os.Bundle
import androidx.core.app.NotificationCompat
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

/**
 * Headless JS Task Service for processing SMS in background.
 * This allows React Native JavaScript code to run even when app is closed.
 */
class SMSHeadlessTaskService : HeadlessJsTaskService() {
    
    companion object {
        private const val CHANNEL_ID = "sms_processing_channel"
        private const val NOTIFICATION_ID = 1001
    }
    
    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }
    
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Call startForeground immediately when service starts
        // This is required for foreground services on Android 8+
        val notification = createNotification()
        startForeground(NOTIFICATION_ID, notification)
        
        // Call parent to start the HeadlessJS task
        return super.onStartCommand(intent, flags, startId)
    }
    
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "SMS Processing",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Processing incoming SMS messages"
                setShowBadge(false)
            }
            
            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
        }
    }
    
    private fun createNotification(): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Processing SMS")
            .setContentText("Checking for transaction messages...")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(false)
            .setAutoCancel(true)
            .build()
    }
    
    override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
        val extras = intent?.extras ?: return null
        
        val data = Arguments.createMap().apply {
            putString("sender", extras.getString("sender", ""))
            putString("body", extras.getString("body", ""))
            putDouble("timestamp", extras.getLong("timestamp", 0).toDouble())
        }
        
        return HeadlessJsTaskConfig(
            "SMSReceivedTask",  // Task name - must match JS registration
            data,
            5000,  // Timeout in ms (5 seconds)
            true   // Allow task to run in foreground
        )
    }
}
`;
      
      fs.writeFileSync(servicePath, serviceContent);
      console.log('✅ [withSMSReceiver] Created SMSHeadlessTaskService.kt');
      
      return config;
    },
  ]);

  // Step 3: Register the HeadlessJS service in AndroidManifest
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const application = manifest.application[0];
    
    // Ensure service array exists
    if (!application.service) {
      application.service = [];
    }
    
    // Check if our service is already registered
    const hasService = application.service.some(
      (s) => s.$?.['android:name'] === '.SMSHeadlessTaskService'
    );
    
    if (!hasService) {
      application.service.push({
        $: {
          'android:name': '.SMSHeadlessTaskService',
          'android:enabled': 'true',
          'android:exported': 'false',
          'android:foregroundServiceType': 'dataSync',
        },
      });
      
      console.log('✅ [withSMSReceiver] Added SMSHeadlessTaskService to AndroidManifest.xml');
    }
    
    return config;
  });

  return config;
}

module.exports = withSMSReceiver;
