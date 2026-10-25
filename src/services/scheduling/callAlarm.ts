import { requireOptionalNativeModule } from 'expo';
import { PermissionsAndroid, Platform } from 'react-native';

/** A call the OS is holding for us, surviving process death and reboots. */
export interface PendingAlarm {
  /** Epoch milliseconds at which the call should ring. */
  fireAt: number;
  /** When the OS alarm actually went off, or 0 while it is still pending. */
  firedAt: number;
  callerName: string;
  callerLabel: string;
}

export interface AlarmPermissions {
  /** POST_NOTIFICATIONS (Android 13+) is granted. */
  notifications: boolean;
  /** The app may use SCHEDULE_EXACT_ALARM (Android 12+). */
  exactAlarms: boolean;
  /** The app may launch a full-screen intent (Android 14+). */
  fullScreenIntent: boolean;
}

type AlarmSettingsTarget = 'notifications' | 'exactAlarms' | 'fullScreenIntent';

interface FakeCallAlarmNativeModule {
  schedule(fireAt: number, callerName: string, callerLabel: string): Promise<boolean>;
  cancel(): Promise<boolean>;
  acknowledgeFired(): Promise<boolean>;
  dismissNotification(): Promise<boolean>;
  getPending(): Promise<PendingAlarm | null>;
  getPermissions(): Promise<AlarmPermissions>;
  openNotificationSettings(): Promise<boolean>;
  openExactAlarmSettings(): Promise<boolean>;
  openFullScreenIntentSettings(): Promise<boolean>;
}

/**
 * The native module in `modules/fakecall-alarm`. Optional because the web build
 * (and any binary built before the module existed) does not have it, and a
 * missing alarm must degrade to the in-app timer rather than crash.
 */
const native =
  Platform.OS === 'android'
    ? requireOptionalNativeModule<FakeCallAlarmNativeModule>('FakeCallAlarm')
    : null;

/**
 * Whether this binary can schedule a call outside the app.
 *
 * False in Expo Go, on web, and in any build made before the native module
 * existed: there the app falls back to the in-app timer, and the UI says so
 * instead of promising a call that cannot arrive.
 */
export const callAlarmAvailable = native !== null;

/** Arms the OS alarm. Resolves false when the alarm is only approximate. */
export async function scheduleAlarm(
  fireAt: number,
  callerName: string,
  callerLabel: string,
): Promise<boolean> {
  if (!native) return false;
  try {
    return await native.schedule(fireAt, callerName, callerLabel);
  } catch {
    return false;
  }
}

/** Removes the alarm, its record and any notification it already posted. */
export async function cancelAlarm(): Promise<void> {
  if (!native) return;
  try {
    await native.cancel();
  } catch {
    /* nothing to cancel */
  }
}

/** Clears the "it fired" flag once the app has taken the call over. */
export async function acknowledgeAlarmFired(): Promise<void> {
  if (!native) return;
  try {
    await native.acknowledgeFired();
  } catch {
    /* the call still rings in-app */
  }
}

export async function dismissCallNotification(): Promise<void> {
  if (!native) return;
  try {
    await native.dismissNotification();
  } catch {
    /* already gone */
  }
}

/** The call the OS is holding, if any. Never throws. */
export async function getPendingAlarm(): Promise<PendingAlarm | null> {
  if (!native) return null;
  try {
    const pending = await native.getPending();
    if (!pending || typeof pending.fireAt !== 'number' || !Number.isFinite(pending.fireAt)) {
      return null;
    }
    return {
      fireAt: pending.fireAt,
      firedAt: typeof pending.firedAt === 'number' ? pending.firedAt : 0,
      callerName: typeof pending.callerName === 'string' ? pending.callerName : '',
      callerLabel: typeof pending.callerLabel === 'string' ? pending.callerLabel : '',
    };
  } catch {
    return null;
  }
}

/**
 * Permissions a scheduled call needs. Reported as granted where the platform
 * has no such permission, so the web build never shows an Android hint.
 */
export async function getAlarmPermissions(): Promise<AlarmPermissions> {
  if (!native) return { notifications: true, exactAlarms: true, fullScreenIntent: true };
  try {
    return await native.getPermissions();
  } catch {
    return { notifications: true, exactAlarms: true, fullScreenIntent: true };
  }
}

/** Runtime notification permission prompt (Android 13+). */
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android' || Number(Platform.Version) < 33) return true;
  try {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

/** Opens the system screen for a permission the app cannot prompt for itself. */
export async function openAlarmSettings(target: AlarmSettingsTarget): Promise<void> {
  if (!native) return;
  try {
    if (target === 'notifications') await native.openNotificationSettings();
    else if (target === 'exactAlarms') await native.openExactAlarmSettings();
    else await native.openFullScreenIntentSettings();
  } catch {
    /* no settings screen available */
  }
}
