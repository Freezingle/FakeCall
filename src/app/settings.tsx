import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as IntentLauncher from 'expo-intent-launcher';
import { useEffect, useState, type ReactNode } from 'react';
import {
  Alert,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { AVATAR_COLORS, MAX_NAME_LENGTH } from '@/features/settings/defaults';
import { useSettings } from '@/features/settings/SettingsProvider';
import {
  playVoiceClip,
  startRingtone,
  stopRingtone,
  stopVoiceClip,
} from '@/services/audio/callAudio';
import { persistAudioFile, RINGTONES, type BuiltInRingtoneId } from '@/services/audio/catalog';
import { tapFeedback } from '@/services/feedback/feedback';
import { MIN_TOUCH, radius, space, usePalette, type Palette } from '@/theme';

function Section({
  title,
  palette,
  children,
}: {
  title: string;
  palette: Palette;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: palette.textMuted }]} accessibilityRole="header">
        {title}
      </Text>
      <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        {children}
      </View>
    </View>
  );
}

function Divider({ palette }: { palette: Palette }) {
  return <View style={[styles.divider, { backgroundColor: palette.border }]} />;
}

function TextField({
  label,
  value,
  onCommit,
  palette,
}: {
  label: string;
  value: string;
  onCommit: (next: string) => void;
  palette: Palette;
}) {
  const [draft, setDraft] = useState(value);
  const empty = draft.trim().length === 0;

  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: palette.textMuted }]}>{label}</Text>
      <TextInput
        value={draft}
        onChangeText={(text) => {
          setDraft(text);
          if (text.trim().length > 0) onCommit(text.trim());
        }}
        maxLength={MAX_NAME_LENGTH}
        accessibilityLabel={label}
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="done"
        placeholderTextColor={palette.textMuted}
        style={[
          styles.input,
          {
            color: palette.text,
            backgroundColor: palette.surfaceAlt,
            borderColor: empty ? palette.danger : 'transparent',
          },
        ]}
      />
      {empty && (
        <Text style={[styles.error, { color: palette.danger }]} accessibilityLiveRegion="polite">
          {label} can&apos;t be empty. The last saved value is still in use.
        </Text>
      )}
    </View>
  );
}

export default function SettingsScreen() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const { settings, storageError, updateCaller, resetSettings } = useSettings();
  const { caller } = settings;

  const [resetCount, setResetCount] = useState(0);

  useEffect(() => () => {
    stopRingtone();
    stopVoiceClip();
  }, []);

  /* ------------------------- ringtone picker ------------------------- */

  /**
   * Android only lets the app read the URI the ringtone picker returns once the
   * audio read permission is granted; without it the copy below fails.
   */
  const requestRingtoneReadPermission = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;
    const permission =
      Number(Platform.Version) >= 33
        ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO
        : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;
    try {
      const result = await PermissionsAndroid.request(permission);
      return result === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return false;
    }
  };

  const openSystemRingtonePicker = async () => {
    if (Platform.OS === 'android') {
      const granted = await requestRingtoneReadPermission();
      if (!granted) {
        Alert.alert(
          'Allow audio access',
          'Android needs permission to read the ringtone you pick. You can also use the Audio file option to pick a ringtone from your phone.',
        );
        return;
      }
      try {
        const result = await IntentLauncher.startActivityAsync(
          'android.intent.action.RINGTONE_PICKER',
          {
            extra: {
              // RingtoneManager.TYPE_RINGTONE
              'android.intent.extra.ringtone.TYPE': 1,
              'android.intent.extra.ringtone.SHOW_DEFAULT': true,
              'android.intent.extra.ringtone.SHOW_SILENT': true,
              ...(caller.ringtoneUri
                ? { 'android.intent.extra.ringtone.EXISTING_URI': caller.ringtoneUri }
                : {}),
            },
          },
        );
        if (result.resultCode !== IntentLauncher.ResultCode.Success) return; // cancelled

        // Pickers report the chosen ringtone in the result's data URI, but some
        // phones only fill the PICKED_URI extra instead.
        const extras = result.extra as Record<string, unknown> | undefined;
        const fromExtra = extras?.['android.intent.extra.ringtone.PICKED_URI'];
        const picked =
          result.data ?? (typeof fromExtra === 'string' ? fromExtra : null);
        if (!picked) return; // "Silent" selected — keep the current ringtone.

        // The phone only grants temporary read access to the picked URI, so
        // copy it into the app's storage right now while that grant is live.
        let localUri: string;
        try {
          localUri = await persistAudioFile(picked, 'ringtone');
        } catch {
          Alert.alert(
            'Could not use that ringtone',
            'Your phone did not share the ringtone file. Grant audio access, or use the Audio file option to pick a ringtone from your phone.',
          );
          return;
        }
        updateCaller({ ringtone: 'system', ringtoneUri: localUri });
        // Audible confirmation that the choice works.
        startRingtone('system', { systemUri: localUri, loop: false });
      } catch {
        Alert.alert(
          'Unable to open ringtone picker',
          'Open your phone Settings → Sound → Ringtone to choose a ringtone.',
        );
      }
    } else {
      Alert.alert(
        'Ringtone',
        'iOS does not allow picking the system ringtone from inside an app. Change it in Settings → Sounds & Haptics → Ringtone.',
      );
    }
  };

  const chooseBuiltIn = (id: BuiltInRingtoneId) => {
    updateCaller({ ringtone: id });
    startRingtone(id, { loop: false });
  };

  /** Uses any audio file on the phone as the ringtone, with no media permission. */
  const pickRingtoneFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      // Keep our own copy so the ringtone survives cache cleanups.
      let uri = asset.uri;
      try {
        uri = await persistAudioFile(asset.uri, 'ringtone');
      } catch {
        // Keep the picker's cache copy.
      }
      updateCaller({ ringtone: 'file', ringtoneUri: uri });
      startRingtone('file', { systemUri: uri, loop: false });
    } catch {
      Alert.alert('Could not open file picker', 'Please try again.');
    }
  };

  /* ----------------------- audio clip picker ------------------------ */

  const pickVoiceClip = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      // Keep our own copy so the clip survives cache cleanups. Any size works;
      // if the copy somehow fails we still fall back to the picker's cache copy.
      let uri = asset.uri;
      try {
        uri = await persistAudioFile(asset.uri, 'clip');
      } catch {
        // Keep the cache copy.
      }
      updateCaller({
        voiceClipUri: uri,
        voiceClipName: asset.name || 'Audio clip',
      });
    } catch {
      Alert.alert('Could not open file picker', 'Please try again.');
    }
  };

  const clearVoiceClip = () => {
    stopVoiceClip();
    updateCaller({ voiceClipUri: null, voiceClipName: null });
  };

  const previewVoiceClip = () => {
    if (!caller.voiceClipUri) return;
    void playVoiceClip(caller.voiceClipUri);
  };

  /* ------------------------------ reset ----------------------------- */

  const confirmReset = () => {
    Alert.alert('Reset to defaults?', 'This restores the default caller and settings.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => {
          stopRingtone();
          stopVoiceClip();
          resetSettings();
          setResetCount((count) => count + 1);
        },
      },
    ]);
  };

  const selectedPhoneRingtone =
    caller.ringtone === 'system' && caller.ringtoneUri ? caller.ringtoneUri : null;
  const selectedFileRingtone =
    caller.ringtone === 'file' && caller.ringtoneUri ? caller.ringtoneUri : null;

  const hasClip = Boolean(caller.voiceClipUri);

  return (
    <ScrollView
      style={{ backgroundColor: palette.background }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xl }]}
      keyboardShouldPersistTaps="handled"
    >
      {storageError !== null && (
        <View style={[styles.banner, { backgroundColor: palette.surfaceAlt, borderColor: palette.danger }]}>
          <MaterialCommunityIcons name="alert-circle-outline" size={20} color={palette.danger} />
          <Text style={[styles.bannerText, { color: palette.text }]}>{storageError}</Text>
        </View>
      )}

      <View style={styles.preview}>
        <Avatar name={caller.name} color={caller.avatarColor} size={88} />
      </View>

      <Section title="Caller" palette={palette}>
        <TextField
          key={`name-${resetCount}`}
          label="Name"
          value={caller.name}
          onCommit={(name) => updateCaller({ name })}
          palette={palette}
        />
        <Divider palette={palette} />
        <TextField
          key={`label-${resetCount}`}
          label="Label"
          value={caller.label}
          onCommit={(label) => updateCaller({ label })}
          palette={palette}
        />
        <Divider palette={palette} />
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: palette.textMuted }]}>Avatar colour</Text>
          <View style={styles.swatches} accessibilityRole="radiogroup">
            {AVATAR_COLORS.map((color) => {
              const selected = color === caller.avatarColor;
              return (
                <Pressable
                  key={color}
                  onPress={() => {
                    tapFeedback();
                    updateCaller({ avatarColor: color });
                  }}
                  accessibilityRole="radio"
                  accessibilityLabel={`Avatar colour ${color}`}
                  accessibilityState={{ selected }}
                  style={[
                    styles.swatch,
                    { backgroundColor: color, borderColor: selected ? palette.text : 'transparent' },
                  ]}
                >
                  {selected && <MaterialCommunityIcons name="check" size={22} color="#FFFFFF" />}
                </Pressable>
              );
            })}
          </View>
        </View>
      </Section>

      <Section title="Ringtone" palette={palette}>
        <Pressable
          onPress={openSystemRingtonePicker}
          accessibilityRole="radio"
          accessibilityLabel="Phone ringtone"
          accessibilityHint="Opens your phone's ringtone picker"
          accessibilityState={{ selected: selectedPhoneRingtone !== null }}
          android_ripple={{ color: palette.surfaceAlt }}
          style={styles.row}
        >
          <View style={styles.rowTextBlock}>
            <Text style={[styles.rowText, { color: palette.text }]}>Phone ringtone</Text>
            <Text style={[styles.rowSub, { color: palette.textMuted }]} numberOfLines={1}>
              {selectedPhoneRingtone
                ? 'Selected — plays when the call comes in'
                : 'Use the ringtone from your device settings'}
            </Text>
          </View>
          <MaterialCommunityIcons
            name={selectedPhoneRingtone ? 'check' : 'chevron-right'}
            size={22}
            color={selectedPhoneRingtone ? palette.accent : palette.textMuted}
          />
        </Pressable>

        <Divider palette={palette} />

        <Pressable
          onPress={pickRingtoneFile}
          accessibilityRole="radio"
          accessibilityLabel="Audio file"
          accessibilityHint="Pick an audio file from your phone to use as the ringtone"
          accessibilityState={{ selected: selectedFileRingtone !== null }}
          android_ripple={{ color: palette.surfaceAlt }}
          style={styles.row}
        >
          <View style={styles.rowTextBlock}>
            <Text style={[styles.rowText, { color: palette.text }]}>Audio file</Text>
            <Text style={[styles.rowSub, { color: palette.textMuted }]} numberOfLines={1}>
              {selectedFileRingtone
                ? 'Selected — plays when the call comes in'
                : 'Pick your own audio file from this phone'}
            </Text>
          </View>
          <MaterialCommunityIcons
            name={selectedFileRingtone ? 'check' : 'chevron-right'}
            size={22}
            color={selectedFileRingtone ? palette.accent : palette.textMuted}
          />
        </Pressable>

        <Divider palette={palette} />

        {(Object.keys(RINGTONES) as BuiltInRingtoneId[]).map((ringtoneId, index) => {
          const selected = ringtoneId === caller.ringtone;
          return (
            <View key={ringtoneId}>
              {index > 0 && <Divider palette={palette} />}
              <Pressable
                onPress={() => chooseBuiltIn(ringtoneId)}
                accessibilityRole="radio"
                accessibilityLabel={RINGTONES[ringtoneId].label}
                accessibilityHint="Selects this ringtone and plays a preview"
                accessibilityState={{ selected }}
                android_ripple={{ color: palette.surfaceAlt }}
                style={styles.row}
              >
                <Text style={[styles.rowText, { color: palette.text }]}>
                  {RINGTONES[ringtoneId].label}
                </Text>
                {selected && (
                  <MaterialCommunityIcons name="check" size={22} color={palette.accent} />
                )}
              </Pressable>
            </View>
          );
        })}
      </Section>

      {/* ---------------------- During the call ---------------------- */}
      <Section title="During the call" palette={palette}>
        <View style={styles.clipBlock}>
          <Text style={[styles.rowText, { color: palette.text }]}>Audio clip after answering</Text>
          <Text style={[styles.rowSub, { color: palette.textMuted }]}>
            {hasClip
              ? 'This clip will play automatically the moment you pick up the call.'
              : 'No clip selected. Pick an audio file from your device.'}
          </Text>

          {hasClip ? (
            <View style={[styles.clipCard, { backgroundColor: palette.surfaceAlt }]}>
              <MaterialCommunityIcons
                name="music-note"
                size={20}
                color={palette.accent}
              />
              <Text
                numberOfLines={1}
                style={[styles.clipName, { color: palette.text }]}
              >
                {caller.voiceClipName ?? 'Audio clip'}
              </Text>
              <Pressable
                onPress={previewVoiceClip}
                accessibilityRole="button"
                accessibilityLabel="Preview audio clip"
                hitSlop={8}
                style={styles.iconBtn}
              >
                <MaterialCommunityIcons name="play-circle" size={26} color={palette.accent} />
              </Pressable>
              <Pressable
                onPress={clearVoiceClip}
                accessibilityRole="button"
                accessibilityLabel="Remove audio clip"
                hitSlop={8}
                style={styles.iconBtn}
              >
                <MaterialCommunityIcons name="close-circle" size={26} color={palette.danger} />
              </Pressable>
            </View>
          ) : null}

          <Pressable
            onPress={pickVoiceClip}
            accessibilityRole="button"
            accessibilityLabel={hasClip ? 'Replace audio clip' : 'Choose audio clip'}
            android_ripple={{ color: palette.border }}
            style={[styles.pickButton, { borderColor: palette.accent }]}
          >
            <MaterialCommunityIcons
              name={hasClip ? 'swap-horizontal' : 'plus-circle-outline'}
              size={20}
              color={palette.accent}
            />
            <Text style={[styles.pickButtonText, { color: palette.accent }]}>
              {hasClip ? 'Replace clip' : 'Choose audio clip'}
            </Text>
          </Pressable>
        </View>
      </Section>

      <Pressable
        onPress={confirmReset}
        accessibilityRole="button"
        accessibilityLabel="Reset to defaults"
        android_ripple={{ color: palette.surfaceAlt }}
        style={[styles.resetButton, { borderColor: palette.border }]}
      >
        <Text style={[styles.resetText, { color: palette.danger }]}>Reset to defaults</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  bannerText: { flex: 1, fontSize: 14 },
  preview: { alignItems: 'center' },
  section: { gap: space.sm },
  sectionTitle: { fontSize: 13, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase' },
  card: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  divider: { height: StyleSheet.hairlineWidth },
  field: { padding: space.md, gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '500' },
  input: {
    minHeight: MIN_TOUCH,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    paddingHorizontal: space.md,
    fontSize: 17,
  },
  error: { fontSize: 12 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, paddingTop: 4 },
  swatch: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: MIN_TOUCH / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  rowTextBlock: { flex: 1, gap: 2 },
  rowText: { fontSize: 16 },
  rowSub: { fontSize: 13 },

  /* Audio clip */
  clipBlock: { padding: space.md, gap: space.sm },
  clipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
  },
  clipName: { flex: 1, fontSize: 14 },
  iconBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickButton: {
    minHeight: 44,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
  },
  pickButtonText: { fontSize: 15, fontWeight: '600' },

  resetButton: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  resetText: { fontSize: 16, fontWeight: '600' },
});