@file:Suppress("DEPRECATION")

package expo.modules.fakecallalarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

/**
 * The system notification that carries the full-screen intent.
 *
 * Android will not let an app in the background launch an activity, but it does
 * launch the pending intent attached to a high-importance call notification when
 * the screen is locked. Everything visible (ringtone, call screen) still belongs
 * to React Native; this notification only exists to wake it up.
 */
object CallNotification {
  private const val CHANNEL_ID = "fakecall-incoming-call"
  private const val NOTIFICATION_ID = 4711
  private const val TAG = "FakeCallAlarm"

  private fun manager(context: Context) =
    context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager

  private fun ensureChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = manager(context) ?: return
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return

    val channel = NotificationChannel(
      CHANNEL_ID,
      "Incoming calls",
      NotificationManager.IMPORTANCE_HIGH,
    ).apply {
      description = "Shows a simulated incoming call"
      // The ringtone comes from expo-audio once the call screen is up, so the
      // notification stays silent and never doubles the ring.
      setSound(null, null)
      enableVibration(false)
      lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      setShowBadge(false)
    }
    manager.createNotificationChannel(channel)
  }

  fun show(context: Context, callerName: String, callerLabel: String) {
    val manager = manager(context) ?: return
    ensureChannel(context)

    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return
    launch.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
    val contentIntent = PendingIntent.getActivity(
      context,
      NOTIFICATION_ID,
      launch,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(context, CHANNEL_ID)
    } else {
      Notification.Builder(context)
    }

    val notification = builder
      .setSmallIcon(R.drawable.ic_call)
      .setContentTitle(callerName.ifBlank { "Incoming call" })
      .setContentText(callerLabel.ifBlank { "Tap to answer" })
      .setCategory(Notification.CATEGORY_CALL)
      .setContentIntent(contentIntent)
      .setFullScreenIntent(contentIntent, true)
      .setOngoing(true)
      .setAutoCancel(false)
      .setShowWhen(true)
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .setPriority(Notification.PRIORITY_MAX)
      .build()

    try {
      manager.notify(NOTIFICATION_ID, notification)
    } catch (error: SecurityException) {
      // Notifications are blocked: the call still rings when the app is opened.
      Log.w(TAG, "Incoming-call notification was blocked", error)
    }
  }

  fun dismiss(context: Context) {
    manager(context)?.cancel(NOTIFICATION_ID)
  }
}
