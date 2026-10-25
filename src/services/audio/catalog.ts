import { File, Paths } from 'expo-file-system';
import type { AudioSource } from 'expo-audio';

import type { CallerProfile, RingtoneId } from '@/types/call';

// Metro needs static require() calls, so bundled audio is registered here.
// To add a ringtone: drop a file in assets/audio, add its id to BuiltInRingtoneId
// (this file) and RINGTONE_IDS (features/settings/defaults.ts), then add it below.

/** Ringtones shipped with the app. 'system' and 'file' play a stored copy instead. */
export type BuiltInRingtoneId = Exclude<RingtoneId, 'system' | 'file'>;

export const RINGTONES: Record<BuiltInRingtoneId, { label: string; source: number }> = {
  classic: {
    label: 'Classic ring',
    source: require('../../../assets/audio/ringtone-classic.wav'),
  },
  chime: {
    label: 'Soft chime',
    source: require('../../../assets/audio/ringtone-chime.wav'),
  },
  
};

/**
 * Copies a picked audio file (ringtone or clip) into app storage and returns
 * the local `file://` URI to play and keep.
 *
 * The phone only grants temporary read access to a picked `content://` URI,
 * so without this copy the sound becomes unplayable later. There is no size
 * limit: the whole file is streamed into the app's own storage.
 */
export async function persistAudioFile(
  sourceUri: string,
  kind: 'ringtone' | 'clip',
): Promise<string> {
  // Keep the original extension when the URI has one; players sniff the
  // format from the content anyway.
  const tail = sourceUri.split('.').pop() ?? '';
  const extension = /^[a-zA-Z0-9]{1,5}$/.test(tail) ? `.${tail.toLowerCase()}` : '';
  const destination = new File(Paths.document, `${kind}-${Date.now()}${extension}`);
  await new File(sourceUri).copy(destination);
  return destination.uri;
}

/**
 * Resolves what to actually play for the caller's ringtone. Only local files
 * play reliably: read grants on raw `content://` URIs expire, so those (and a
 * missing URI) fall back to the classic bundled ring.
 */
export function resolveRingtoneSource(
  ringtone: RingtoneId,
  ringtoneUri: string | null,
): AudioSource {
  if (ringtone === 'classic' || ringtone === 'chime') return RINGTONES[ringtone].source;
  if (ringtoneUri?.startsWith('file://')) return { uri: ringtoneUri };
  return RINGTONES.classic.source;
}

/** Display name for any ringtone, including the phone's own and picked files. */
export function ringtoneLabel(ringtone: RingtoneId, ringtoneUri: string | null): string {
  if (ringtone === 'classic' || ringtone === 'chime') return RINGTONES[ringtone].label;
  if (ringtone === 'file') return ringtoneUri ? 'Your audio file' : 'Your audio file (not set)';
  return ringtoneUri ? 'Phone ringtone' : 'Phone ringtone (not set)';
}

/**
 * The audio to play automatically while the call is active: only a clip the
 * user picked themselves. No clip is bundled, so an answered call is silent
 * until they add one.
 */
export function resolveVoiceClipSource(caller: CallerProfile): AudioSource | null {
  return caller.voiceClipUri ? { uri: caller.voiceClipUri } : null;
}
