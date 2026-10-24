/**
 * - `classic` / `chime`: bundled sounds.
 * - `system`: the phone's own ringtone, chosen with the system ringtone picker
 *   (its content URI is kept in `CallerProfile.ringtoneUri`).
 */
export type RingtoneId = 'classic' | 'chime' | 'system';

export type VoiceClipId = 'greeting';

/** Bundled avatars are a colour plus the caller's initials. */
export type AvatarColor = string;

export interface CallerProfile {
  name: string;
  /** Secondary line under the name, e.g. "mobile". */
  label: string;
  avatarColor: AvatarColor;
  ringtone: RingtoneId;
  /** Content URI picked from the phone's ringtone picker; used when `ringtone` is 'system'. */
  ringtoneUri: string | null;
  /** Bundled clip that plays automatically after answering, or null for silence. */
  voiceClip: VoiceClipId | null;
  /** Audio file picked from the device; auto-plays during the call (wins over `voiceClip`). */
  voiceClipUri: string | null;
  /** Display name of the picked file, for the settings UI. */
  voiceClipName: string | null;
}

export interface AppSettings {
  caller: CallerProfile;
  /** Vibrate while the simulated call is ringing. */
  vibrate: boolean;
}

/**
 * - idle: nothing happening (a scheduled call may be pending, see CallState.schedule)
 * - ringing: incoming-call screen is showing
 * - active: the user answered
 */
export type CallPhase = 'idle' | 'ringing' | 'active';

export interface ScheduledCall {
  /** Epoch milliseconds at which the call should ring. */
  fireAt: number;
  delayMs: number;
}