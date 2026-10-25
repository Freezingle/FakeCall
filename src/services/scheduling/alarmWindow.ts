/**
 * Decides what a stored OS alarm means when the app starts.
 *
 * The alarm can fire with no React Native process alive, so by the time JS runs
 * the deadline may already be behind us. Ringing for an alarm that went off
 * minutes ago would be wrong (the caller "hung up"), hence the grace window.
 */

/** How late a fired call may still be picked up on launch. */
export const RING_GRACE_MS = 60_000;

export interface AlarmWindow {
  /** Epoch milliseconds at which the call should ring. */
  fireAt: number;
  /** When the OS alarm actually fired, or 0 if it has not. */
  firedAt: number;
}

/**
 * True when the call should ring right now: the alarm fired within the grace
 * window, or its deadline passed that recently without being observed.
 */
export function shouldRingOnLaunch(alarm: AlarmWindow, now: number): boolean {
  const reference = alarm.firedAt > 0 ? alarm.firedAt : alarm.fireAt;
  const elapsed = now - reference;
  return elapsed >= 0 && elapsed <= RING_GRACE_MS;
}

/** True while the alarm is still ahead of us and worth restoring on the home screen. */
export function isAlarmStillPending(alarm: AlarmWindow, now: number): boolean {
  return alarm.fireAt > now;
}
