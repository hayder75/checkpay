package com.checkpay.mobile

import android.content.Intent
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray

/**
 * React Native bridge for the notification listener.
 * Exposed to JS as NativeModules.NotificationListener.
 */
class NotificationListenerModule(private val ctx: ReactApplicationContext) :
    ReactContextBaseJavaModule(ctx) {

    override fun getName(): String = "NotificationListener"

    @ReactMethod
    fun isNotificationAccessEnabled(promise: Promise) {
        try {
            val enabledPackages = NotificationManagerCompat.getEnabledListenerPackages(ctx)
            promise.resolve(enabledPackages.contains(ctx.packageName))
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun openNotificationAccessSettings(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            ctx.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun getCapturedNotifications(promise: Promise) {
        try {
            val items = NotificationCaptureStore.drain(ctx)
            val result: WritableArray = Arguments.createArray()
            for (i in 0 until items.length()) {
                val obj = items.optJSONObject(i) ?: continue
                val map = Arguments.createMap()
                map.putString("id", obj.optString("id"))
                map.putString("packageName", obj.optString("packageName"))
                map.putString("title", obj.optString("title"))
                map.putString("text", obj.optString("text"))
                map.putString("subText", obj.optString("subText"))
                map.putDouble("postedAt", obj.optLong("postedAt").toDouble())
                result.pushMap(map)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.resolve(Arguments.createArray())
        }
    }
}
