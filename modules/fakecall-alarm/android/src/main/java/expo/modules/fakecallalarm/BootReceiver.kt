package expo.modules.fakecallalarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Android clears every alarm on shutdown, so a live schedule is re-armed here. */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    if (intent?.action != Intent.ACTION_BOOT_COMPLETED) return

    val pending = AlarmStore.read(context) ?: return
    if (pending.fireAt > System.currentTimeMillis()) {
      AlarmScheduler.schedule(context, pending.fireAt)
    } else {
      // The deadline passed while the phone was off; that call is gone.
      AlarmStore.clear(context)
    }
  }
}
