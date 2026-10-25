import type { AppSettings, RingtoneId } from '@/types/call';

export const DEFAULT_SETTINGS: AppSettings = {
  caller: {
    name: 'Mom',
    label: 'mobile',
    avatarColor: '#7C5CFF',
    ringtone: 'classic',
    ringtoneUri: null,
    voiceClipUri: null,
    voiceClipName: null,
  },
  vibrate: true,
};

export const AVATAR_COLORS: readonly string[] = [
  '#7C5CFF',
  '#2E90FA',
  '#12B76A',
  '#F79009',
  '#F04438',
  '#EE46BC',
];

export const RINGTONE_IDS: readonly RingtoneId[] = ['classic', 'chime', 'system', 'file'];

export const MAX_NAME_LENGTH = 40;
