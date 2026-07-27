package com.checkpay.mobile

import android.app.Notification
import android.content.Context
import android.service.notification.StatusBarNotification
import org.json.JSONArray
import org.json.JSONObject

/**
 * SharedPreferences-backed queue of captured notifications.
 *
 * The listener service writes to this queue (works even when the React
 * context is not alive, e.g. app in background or killed), and the JS side
 * drains it periodically through NotificationListenerModule.
 */
object NotificationCaptureStore {
    private const val PREFS_NAME = "checkpay_notification_capture"
    private const val KEY_QUEUE = "captured_notifications"
    private const val MAX_ITEMS = 200

    @Synchronized
    fun add(context: Context, sbn: StatusBarNotification) {
        val extras = sbn.notification?.extras ?: return

        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
        val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString().orEmpty()
        val subText = extras.getCharSequence(Notification.EXTRA_SUB_TEXT)?.toString().orEmpty()

        // Skip empty notifications (e.g. group summaries without content)
        if (title.isEmpty() && text.isEmpty() && subText.isEmpty()) return

        val id = sbn.key ?: "${sbn.packageName}:${sbn.postTime}"
        val item = JSONObject()
            .put("id", id)
            .put("packageName", sbn.packageName.orEmpty())
            .put("title", title)
            .put("text", text)
            .put("subText", subText)
            .put("postedAt", sbn.postTime)

        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val queue = JSONArray(prefs.getString(KEY_QUEUE, "[]") ?: "[]")

        // Dedupe by notification key
        for (i in 0 until queue.length()) {
            if (queue.optJSONObject(i)?.optString("id") == id) return
        }

        queue.put(item)

        // Keep the queue bounded
        while (queue.length() > MAX_ITEMS) {
            queue.remove(0)
        }

        prefs.edit().putString(KEY_QUEUE, queue.toString()).apply()
    }

    /**
     * Returns all queued notifications and clears the queue.
     */
    @Synchronized
    fun drain(context: Context): JSONArray {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val queue = try {
            JSONArray(prefs.getString(KEY_QUEUE, "[]") ?: "[]")
        } catch (e: Exception) {
            JSONArray()
        }
        prefs.edit().remove(KEY_QUEUE).apply()
        return queue
    }
}
