package com.checkpay.mobile

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log

/**
 * Captures notifications posted by other apps (e.g. SMS apps) so the JS side
 * can poll them via NotificationListenerModule.getCapturedNotifications().
 *
 * The service is bound by the system when the user grants
 * "Notification access" for this app in system settings.
 */
class TransactionNotificationListenerService : NotificationListenerService() {

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        try {
            NotificationCaptureStore.add(applicationContext, sbn)
        } catch (e: Exception) {
            Log.w(TAG, "Failed to capture posted notification", e)
        }
    }

    override fun onListenerConnected() {
        Log.i(TAG, "Notification listener connected")
    }

    override fun onListenerDisconnected() {
        Log.i(TAG, "Notification listener disconnected")
    }

    companion object {
        private const val TAG = "TxnNotifListener"
    }
}
