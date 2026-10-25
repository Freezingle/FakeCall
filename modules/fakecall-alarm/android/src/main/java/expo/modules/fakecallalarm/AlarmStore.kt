package expo.modules.fakecallalarm

import android.content.Context

/**
 * The pending call, kept in SharedPreferences rather than only in memory.
 *
 * The alarm fires with no React Native process alive, and Android drops every
 * AlarmManager entry on reboot, so the record has to be readable by a
 * BroadcastReceiver alone.
 */
object AlarmStore {
  private const val PREFS = "fakecall_alarm"
  private const val KEY_FIRE_AT = "fireAt"
  private const val KEY_FIRED_AT = "firedAt"
  private const val KEY_CALLER_NAME = "callerName"
  private const val KEY_CALLER_LABEL = "callerLabel"

  data class PendingAlarm(
    val fireAt: Long,
    val firedAt: Long,
    val callerName: String,
    val callerLabel: String,
  )

  private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun save(context: Context, fireAt: Long, callerName: String, callerLabel: String) {
    prefs(context)
      .edit()
      .putLong(KEY_FIRE_AT, fireAt)
      .putLong(KEY_FIRED_AT, 0L)
      .putString(KEY_CALLER_NAME, callerName)
      .putString(KEY_CALLER_LABEL, callerLabel)
      .apply()
  }

  /** Records that the OS alarm actually went off, so the app knows to ring on launch. */
  fun markFired(context: Context, firedAt: Long) {
    prefs(context).edit().putLong(KEY_FIRED_AT, firedAt).apply()
  }

  /** Clears only the fired flag, keeping a still-pending future alarm intact. */
  fun acknowledgeFired(context: Context) {
    prefs(context).edit().putLong(KEY_FIRED_AT, 0L).apply()
  }

  fun read(context: Context): PendingAlarm? {
    val store = prefs(context)
    val fireAt = store.getLong(KEY_FIRE_AT, 0L)
    if (fireAt <= 0L) return null
    return PendingAlarm(
      fireAt = fireAt,
      firedAt = store.getLong(KEY_FIRED_AT, 0L),
      callerName = store.getString(KEY_CALLER_NAME, "") ?: "",
      callerLabel = store.getString(KEY_CALLER_LABEL, "") ?: "",
    )
  }

  fun clear(context: Context) {
    prefs(context).edit().clear().apply()
  }
}
