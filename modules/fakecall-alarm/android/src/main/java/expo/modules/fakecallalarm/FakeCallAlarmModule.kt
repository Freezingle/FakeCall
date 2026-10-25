package expo.modules.fakecallalarm

import android.Manifest
import android.app.AlarmManager
import android.app.NotificationManager
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * JS surface for scheduled calls that outlive the app.
 *
 * Everything here is fire-and-forget except the getters: the alarm, its
 * persisted record and the notification are owned by Android, so the app can be
 * killed at any point without losing a scheduled call.
 */
class FakeCallAlarmModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("FakeCallAlarm")

    /** Arms the OS alarm. Resolves true when it is exact, false when it only approximates. */
    AsyncFunction("schedule") { fireAt: Double, callerName: String, callerLabel: String ->
      val context = requireAndroidContext()
      CallNotification.dismiss(context)
      AlarmStore.save(context, fireAt.toLong(), callerName, callerLabel)
      AlarmScheduler.schedule(context, fireAt.toLong())
    }

    AsyncFunction("cancel") {
      val context = requireAndroidContext()
      AlarmScheduler.cancel(context)
      AlarmStore.clear(context)
      CallNotification.dismiss(context)
      true
    }

    AsyncFunction("acknowledgeFired") {
      AlarmStore.acknowledgeFired(requireAndroidContext())
      true
    }

    AsyncFunction("dismissNotification") {
      CallNotification.dismiss(requireAndroidContext())
      true
    }

    /** The pending call, or null when nothing is scheduled. */
    AsyncFunction("getPending") {
      AlarmStore.read(requireAndroidContext())?.let { alarm ->
        mapOf(
          "fireAt" to alarm.fireAt.toDouble(),
          "firedAt" to alarm.firedAt.toDouble(),
          "callerName" to alarm.callerName,
          "callerLabel" to alarm.callerLabel,
        )
      }
    }

    AsyncFunction("getPermissions") {
      val context = requireAndroidContext()
      mapOf(
        "notifications" to canPostNotifications(context),
        "exactAlarms" to canScheduleExactAlarms(context),
        "fullScreenIntent" to canUseFullScreenIntent(context),
      )
    }

    AsyncFunction("openNotificationSettings") {
      val context = requireAndroidContext()
      val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
          .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
      } else {
        appDetails(context)
      }
      open(context, intent)
    }

    AsyncFunction("openExactAlarmSettings") {
      val context = requireAndroidContext()
      val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, packageUri(context))
      } else {
        appDetails(context)
      }
      open(context, intent)
    }

    AsyncFunction("openFullScreenIntentSettings") {
      val context = requireAndroidContext()
      val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, packageUri(context))
      } else {
        Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
          .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
      }
      open(context, intent)
    }
  }

  private fun requireAndroidContext(): Context =
    appContext.reactContext
      ?: appContext.activityProvider?.currentActivity
      ?: throw IllegalStateException("FakeCallAlarm needs an Android context")

  private fun packageUri(context: Context): Uri = Uri.fromParts("package", context.packageName, null)

  private fun appDetails(context: Context): Intent =
    Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, packageUri(context))

  private fun open(context: Context, intent: Intent): Boolean {
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    return try {
      context.startActivity(intent)
      true
    } catch (error: ActivityNotFoundException) {
      // Some OEMs hide the screen we asked for; app details always exists.
      try {
        context.startActivity(appDetails(context).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        true
      } catch (fallbackError: ActivityNotFoundException) {
        android.util.Log.w("FakeCallAlarm", "No settings screen available", fallbackError)
        false
      }
    }
  }

  private fun canPostNotifications(context: Context): Boolean =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) ==
        PackageManager.PERMISSION_GRANTED
    } else {
      true
    }

  private fun canScheduleExactAlarms(context: Context): Boolean =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      (context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager)?.canScheduleExactAlarms()
        ?: false
    } else {
      true
    }

  private fun canUseFullScreenIntent(context: Context): Boolean =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      (context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager)
        ?.canUseFullScreenIntent()
        ?: false
    } else {
      true
    }
}
