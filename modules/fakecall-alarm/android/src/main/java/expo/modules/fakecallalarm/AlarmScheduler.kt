package expo.modules.fakecallalarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

/** Arms, disarms and fires the one alarm that backs a scheduled call. */
object AlarmScheduler {
  const val ACTION_FIRE = "expo.modules.fakecallalarm.FIRE"
  const val ALARM_REQUEST_CODE = 4711
  private const val TAG = "FakeCallAlarm"

  private fun pendingIntent(context: Context): PendingIntent {
    val intent = Intent(context, CallAlarmReceiver::class.java).setAction(ACTION_FIRE)
    return PendingIntent.getBroadcast(
      context,
      ALARM_REQUEST_CODE,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  /**
   * Arms the alarm and reports whether it is exact.
   *
   * `setExactAndAllowWhileIdle` is the only variant that still fires in Doze.
   * Without the exact-alarm permission (Android 12+) it throws, so the call
   * degrades to an inexact alarm instead of being lost entirely.
   */
  fun schedule(context: Context, fireAt: Long): Boolean {
    val manager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return false
    val operation = pendingIntent(context)
    return try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !manager.canScheduleExactAlarms()) {
        manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, fireAt, operation)
        false
      } else {
        manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, fireAt, operation)
        true
      }
    } catch (error: SecurityException) {
      Log.w(TAG, "Exact alarm denied, falling back to an inexact one", error)
      manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, fireAt, operation)
      false
    }
  }

  fun cancel(context: Context) {
    val manager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
    manager.cancel(pendingIntent(context))
  }
}
