import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  AVATAR_COLORS,
  DEFAULT_SETTINGS,
  MAX_NAME_LENGTH,
  RINGTONE_IDS,
  VOICE_CLIP_IDS,
} from '@/features/settings/defaults';
import type { AppSettings, RingtoneId, VoiceClipId } from '@/types/call';

// Bump the suffix if the stored shape changes incompatibly.
const STORAGE_KEY = 'fakecall.settings.v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pickString(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, maxLength) : fallback;
}

/**
 * Merge untrusted stored data onto the defaults, field by field, so a corrupted
 * or older blob can never crash the app or produce an invalid profile.
 */
export function parseSettings(raw: unknown): AppSettings {
  const defaults = DEFAULT_SETTINGS;
  if (!isRecord(raw)) return defaults;

  const caller = isRecord(raw.caller) ? raw.caller : {};

  const ringtone = RINGTONE_IDS.find((id): id is RingtoneId => id === caller.ringtone);
  const voiceClip: VoiceClipId | null =
    caller.voiceClip === null
      ? null
      : (VOICE_CLIP_IDS.find((id): id is VoiceClipId => id === caller.voiceClip) ??
        defaults.caller.voiceClip);

  // URIs come from the system picker / document picker; accept any non-empty string.
  const uri = (value: unknown): string | null =>
    typeof value === 'string' && value.length > 0 ? value.slice(0, 512) : null;

  return {
    caller: {
      name: pickString(caller.name, defaults.caller.name, MAX_NAME_LENGTH),
      label: pickString(caller.label, defaults.caller.label, MAX_NAME_LENGTH),
      avatarColor:
        typeof caller.avatarColor === 'string' && AVATAR_COLORS.includes(caller.avatarColor)
          ? caller.avatarColor
          : defaults.caller.avatarColor,
      ringtone: ringtone ?? defaults.caller.ringtone,
      ringtoneUri: uri(caller.ringtoneUri),
      voiceClip,
      voiceClipUri: uri(caller.voiceClipUri),
      voiceClipName:
        typeof caller.voiceClipName === 'string' && caller.voiceClipName.length > 0
          ? caller.voiceClipName.slice(0, MAX_NAME_LENGTH)
          : null,
    },
    vibrate: typeof raw.vibrate === 'boolean' ? raw.vibrate : defaults.vibrate,
  };
}

export async function loadSettings(): Promise<AppSettings> {
  const json = await AsyncStorage.getItem(STORAGE_KEY);
  if (json === null) return DEFAULT_SETTINGS;
  try {
    return parseSettings(JSON.parse(json));
  } catch {
    // Unparseable JSON: fall back to defaults rather than blocking the app.
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
