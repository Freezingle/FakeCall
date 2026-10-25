package expo.modules.fakecallalarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Runs with the app closed. Records that the alarm went off, then asks the
 * system for a call notification, which launches the app over the lock screen.
 */
class CallAlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    if (intent?.action != AlarmScheduler.ACTION_FIRE) return

    val pending = AlarmStore.read(context) ?: return
    AlarmStore.markFired(context, System.currentTimeMillis())
    CallNotification.show(context, pending.callerName, pending.callerLabel)
  }
}
