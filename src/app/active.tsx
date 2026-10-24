import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useKeepAwake } from 'expo-keep-awake';
import { LinearGradient } from 'expo-linear-gradient';
import { NavigationBar } from 'expo-navigation-bar';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { ComponentProps } from 'react';
import { useCallback, useEffect, useState } from 'react';
import {
  BackHandler,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCall } from '@/features/calls/CallProvider';
import { resolveVoiceClipSource } from '@/services/audio/catalog';
import { subscribeVoicePlaying, toggleVoiceClip } from '@/services/audio/callAudio';
import { formatCallDuration } from '@/services/scheduling/delays';
import { useNow } from '@/services/scheduling/useNow';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

// Same blurred-wallpaper gradient used on the incoming screen, but shifted
// lighter toward the bottom half because the action card sits on top of it.
const WALLPAPER = [
  '#06060B',
  '#17121E',
  '#342736',
  '#5F4B5F',
  '#866A71',
  '#A99FA7',
  '#C0BBC5',
  '#DAD6DE',
] as const;
const WALLPAPER_STOPS = [0, 0.13, 0.28, 0.42, 0.54, 0.66, 0.8, 1] as const;

const CARD_BG = 'rgba(255,255,255,0.16)';
const CARD_BORDER = 'rgba(255,255,255,0.22)';
const ICON_COLOR = '#FFFFFF';
const ICON_SUB = 'rgba(255,255,255,0.92)';
const PILL_BG = 'rgba(0,0,0,0.32)';
const HANGUP_RED = '#F0483E';

const SHADOW = {
  textShadowColor: 'rgba(0,0,0,0.35)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 4,
};

/* ---------------------------------------------------------------- timer ---- */

function CallTimer({ answeredAt }: { answeredAt: number }) {
  const now = useNow(250);
  return (
    <Text style={styles.timer} accessibilityRole="timer">
      {formatCallDuration(now - answeredAt)}
    </Text>
  );
}

function useVoicePlaying(): boolean {
  const [playing, setPlaying] = useState(false);
  useEffect(
    () => subscribeVoicePlaying(setPlaying),
    [],
  );
  return playing;
}

/* ------------------------------------------------------------- tile btn ---- */

function ActionTile({
  icon,
  label,
  active = false,
  onPress,
  accessibilityLabel,
}: {
  icon: IconName;
  label: string;
  active?: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: active }}
      android_ripple={{ color: 'rgba(255,255,255,0.18)', borderless: true }}
      style={({ pressed }) => [styles.tile, pressed && { opacity: 0.7 }]}
    >
      <MaterialCommunityIcons name={icon} size={26} color={ICON_COLOR} />
      <Text style={styles.tileLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/* --------------------------------------------------------------- screen ---- */

export default function ActiveCallScreen() {
  const { caller, answeredAt, muted, speakerOn, toggleMute, toggleSpeaker, hangUp } = useCall();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const voicePlaying = useVoicePlaying();

  useKeepAwake();

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
      return () => subscription.remove();
    }, []),
  );

  if (!caller || answeredAt === null) return null;

  const nameSize = Math.round(Math.max(26, Math.min(width * 0.085, 38)));

  const hasClip = resolveVoiceClipSource(caller) !== null;

  return (
    <LinearGradient
      colors={WALLPAPER}
      locations={WALLPAPER_STOPS}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.root}
    >
      <StatusBar style="light" />
      <NavigationBar hidden />

      <View
        style={[
          styles.content,
          {
            paddingTop: Math.max(insets.top, 24) + 24,
            paddingBottom: insets.bottom + 12,
            paddingHorizontal: Math.max(insets.left, insets.right, 20),
            flexDirection: 'column',
            justifyContent: 'space-between',
          },
        ]}
      >
        {/* Caller */}
        <View style={styles.header}>
          <Text
            accessibilityRole="header"
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[styles.name, { fontSize: nameSize, lineHeight: Math.round(nameSize * 1.15) }]}
          >
            {caller.name}
          </Text>
          <CallTimer answeredAt={answeredAt} />
        </View>

        <View style={styles.avatarArea}>
        </View>

        {/* Action card */}
        <View style={styles.card}>
          {/* "Call ended" / status pill */}
          <View style={styles.pillWrap}>
            <View style={styles.pill}>
              <MaterialCommunityIcons
                name="phone-check"
                size={14}
                color={ICON_SUB}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.pillText}>Call active</Text>
            </View>
          </View>

          {/* 3 × 2 grid of tiles */}
          <View style={styles.grid}>
            <ActionTile
              icon="plus"
              label="Add call"
              onPress={() => {}}
              accessibilityLabel="Add call"
            />
            <ActionTile
              icon="bluetooth"
              label="Bluetooth"
              onPress={() => {}}
              accessibilityLabel="Bluetooth audio"
            />
            <ActionTile
              icon="dialpad"
              label="Keypad"
              onPress={() => {}}
              accessibilityLabel="Open keypad"
            />
            <ActionTile
              icon={muted ? 'microphone-off' : 'microphone'}
              label="Mute"
              active={muted}
              onPress={toggleMute}
              accessibilityLabel={muted ? 'Unmute microphone' : 'Mute microphone'}
            />
            <ActionTile
              icon={speakerOn ? 'volume-high' : 'volume-medium'}
              label="Speaker"
              active={speakerOn}
              onPress={toggleSpeaker}
              accessibilityLabel="Toggle speaker"
            />
            {hasClip ? (
              <ActionTile
                icon={voicePlaying ? 'pause' : 'play'}
                label={voicePlaying ? 'Pause' : 'Play clip'}
                onPress={() => {
                  void toggleVoiceClip();
                }}
                accessibilityLabel={voicePlaying ? 'Pause voice clip' : 'Play voice clip'}
              />
            ) : (
              <ActionTile
                icon="dots-grid"
                label="More"
                onPress={() => {}}
                accessibilityLabel="More options"
              />
            )}
          </View>

          {/* Hang-up button floating on the card */}
          <View style={styles.hangupWrap}>
            <Pressable
              onPress={hangUp}
              accessibilityRole="button"
              accessibilityLabel={`End call with ${caller.name}`}
              android_ripple={{ color: 'rgba(255,255,255,0.25)', borderless: true }}
              style={({ pressed }) => [
                styles.hangup,
                { transform: [{ scale: pressed ? 0.94 : 1 }] },
              ]}
            >
              <MaterialCommunityIcons name="phone-hangup" size={30} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}

/* --------------------------------------------------------------- styles ---- */

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },

  header: { alignItems: 'center' },
  name: {
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
    ...SHADOW,
  },
  timer: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 17,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
    ...SHADOW,
  },

  avatarArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },

  /* ---- frosted action card ---- */
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 32,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: CARD_BORDER,
    paddingTop: 14,
    paddingBottom: 20,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  pillWrap: { alignItems: 'center', marginBottom: 14 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PILL_BG,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  pillText: {
    color: ICON_SUB,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.2,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 100,
  },
  tile: {
    width: '33.3333%',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  tileLabel: {
    color: ICON_SUB,
    fontSize: 13,
    fontWeight: '400',
  },

  /* ---- hang-up ---- */
  hangupWrap: {
    alignItems: 'center',
    marginBottom: 40,
  },
  hangup: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: HANGUP_RED,
    alignItems: 'center',
    justifyContent: 'center',
  },
});