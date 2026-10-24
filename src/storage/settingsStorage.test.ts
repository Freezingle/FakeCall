import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_SETTINGS } from '@/features/settings/defaults';

import { loadSettings, parseSettings, saveSettings } from './settingsStorage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

describe('parseSettings', () => {
  it('falls back to defaults for anything that is not an object', () => {
    for (const bad of [null, undefined, 42, 'text', [], true]) {
      expect(parseSettings(bad)).toEqual(DEFAULT_SETTINGS);
    }
  });

  it('keeps valid stored values', () => {
    const stored = {
      caller: {
        name: '  Dr. Patel ',
        label: 'work',
        avatarColor: '#12B76A',
        ringtone: 'chime',
        voiceClip: null,
      },
      vibrate: false,
    };
    expect(parseSettings(stored)).toEqual({
      caller: {
        ...stored.caller,
        name: 'Dr. Patel',
        ringtoneUri: null,
        voiceClipUri: null,
        voiceClipName: null,
      },
      vibrate: false,
    });
  });

  it('keeps the system ringtone and picked clip URIs', () => {
    const stored = {
      caller: {
        ...DEFAULT_SETTINGS.caller,
        ringtone: 'system',
        ringtoneUri: 'content://media/internal/media/42',
        voiceClipUri: 'file:///data/clip.mp3',
        voiceClipName: 'clip.mp3',
      },
    };
    expect(parseSettings(stored).caller).toMatchObject({
      ringtone: 'system',
      ringtoneUri: 'content://media/internal/media/42',
      voiceClipUri: 'file:///data/clip.mp3',
      voiceClipName: 'clip.mp3',
    });
  });

  it('drops non-string or empty URIs', () => {
    const result = parseSettings({
      caller: { ringtoneUri: 42, voiceClipUri: '', voiceClipName: false },
    });
    expect(result.caller.ringtoneUri).toBeNull();
    expect(result.caller.voiceClipUri).toBeNull();
    expect(result.caller.voiceClipName).toBeNull();
  });

  it('replaces invalid fields individually instead of discarding everything', () => {
    const result = parseSettings({
      caller: { name: '   ', ringtone: 'not-a-ringtone', avatarColor: 'red', voiceClip: 'nope' },
      vibrate: 'yes',
    });
    expect(result).toEqual(DEFAULT_SETTINGS);
  });

  it('truncates over-long names', () => {
    const result = parseSettings({ caller: { name: 'x'.repeat(200) } });
    expect(result.caller.name).toHaveLength(40);
  });
});

describe('load / save', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('returns defaults when nothing is stored', async () => {
    await expect(loadSettings()).resolves.toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips saved settings', async () => {
    const custom = {
      caller: { ...DEFAULT_SETTINGS.caller, name: 'Boss', ringtone: 'chime' as const },
      vibrate: false,
    };
    await saveSettings(custom);
    await expect(loadSettings()).resolves.toEqual(custom);
  });

  it('recovers from corrupted JSON', async () => {
    await AsyncStorage.setItem('fakecall.settings.v1', '{not json');
    await expect(loadSettings()).resolves.toEqual(DEFAULT_SETTINGS);
  });
});
