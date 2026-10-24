import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useKeepAwake } from 'expo-keep-awake';
import { LinearGradient } from 'expo-linear-gradient';
import { NavigationBar } from 'expo-navigation-bar';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { ComponentProps } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  BackHandler,
  Easing,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCall } from '@/features/calls/CallProvider';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

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

const ACCEPT_COLOR = '#2FBE62';
const DECLINE_COLOR = '#E5484D';
const RING_COLOR = 'rgba(255,255,255,0.55)';
const RING_WIDTH = 7;

// Pulse (unchanged)
const PULSE_DURATION = 1500;
const PULSE_OFFSET = PULSE_DURATION / 2;
const PULSE_BORDER_WIDTH = 3;
const PULSE_MAX_SCALE = 1.6;
const PULSE_START_OPACITY = 0.65;

// Swipe threshold in dp — how far the user must drag horizontally.
const SWIPE_THRESHOLD = 120;

const SHADOW = {
  textShadowColor: 'rgba(0,0,0,0.3)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 3,
};

/* ------------------------------------------------------------ helpers ---- */

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduced(enabled);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);
  return reduced;
}

function ButtonPulse({ color, size, delay }: { color: string; size: number; delay: number }) {
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const animation = Animated.sequence([
      Animated.delay(delay),
      Animated.loop(
        Animated.timing(progress, {
          toValue: 1,
          duration: PULSE_DURATION,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
          isInteraction: false,
        }),
      ),
    ]);
    animation.start();
    return () => animation.stop();
  }, [progress, delay]);

  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [1, PULSE_MAX_SCALE] });
  const opacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [PULSE_START_OPACITY, 0],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.pulse,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: color,
          opacity,
          transform: [{ scale }],
        },
      ]}
    />
  );
}

/* ------------------------------------------------- swipe-aware button ---- */

/**
 * A call button that must be *dragged horizontally* past `SWIPE_THRESHOLD`
 * in the given direction to trigger `onComplete`.
 *
 * The button itself does **not** move with the finger. Only a subtle
 * scale + fade animation plays on successful confirmation.
 *
 * - `direction: 'left'`  → user drags the button to the left  (decline)
 * - `direction: 'right'` → user drags the button to the right (answer)
 */
function SwipeCallButton({
  icon,
  color,
  size,
  direction,
  onComplete,
  reduceMotion,
}: {
  icon: IconName;
  color: string;
  size: number;
  direction: 'left' | 'right';
  onComplete: () => void;
  reduceMotion?: boolean;
}) {
  const inner = size - RING_WIDTH * 2;
  const dirSign = direction === 'right' ? 1 : -1;

  // Only used for the confirmation animation (fade + scale). Not tied to finger.
  const [confirmProgress] = useState(() => new Animated.Value(0));

  const trigger = useCallback(() => {
    Animated.timing(confirmProgress, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      confirmProgress.setValue(0);
      onComplete();
    });
  }, [confirmProgress, onComplete]);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dx) > 4 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderMove: () => {
          // Intentionally empty — button never follows the finger.
        },
        onPanResponderRelease: (_, g) => {
          const dragged = dirSign > 0 ? Math.max(0, g.dx) : Math.min(0, g.dx);
          const velocityOk = dirSign > 0 ? g.vx > 1.2 : g.vx < -1.2;
          if (Math.abs(dragged) >= SWIPE_THRESHOLD || velocityOk) {
            trigger();
          }
        },
        onPanResponderTerminate: () => {
          // Nothing to reset — button never moved.
        },
      }),
    [dirSign, trigger],
  );

  const scale = confirmProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.85],
  });
  const opacity = confirmProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  return (
    <View style={[styles.buttonWrap, { width: size, height: size }]}>
      {!reduceMotion && (
        <>
          <ButtonPulse color={color} size={size} delay={0} />
          <ButtonPulse color={color} size={size} delay={PULSE_OFFSET} />
        </>
      )}

      <Animated.View
        {...responder.panHandlers}
        style={[
          styles.ring,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            opacity,
            transform: [{ scale }],
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityHint={`Swipe ${direction} to confirm`}
          accessibilityActions={[{ name: 'activate', label: 'Confirm' }]}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === 'activate') trigger();
          }}
          android_ripple={{ color: 'rgba(255,255,255,0.25)' }}
          style={({ pressed }) => [
            styles.buttonFace,
            {
              width: inner,
              height: inner,
              borderRadius: inner / 2,
              backgroundColor: color,
              opacity: pressed ? 0.95 : 1,
            },
          ]}
        >
          <MaterialCommunityIcons name={icon} size={Math.round(inner * 0.52)} color="#FFFFFF" />
        </Pressable>
      </Animated.View>
    </View>
  );
}

/* ------------------------------------------------------------- screen ---- */

export default function IncomingCallScreen() {
  const { caller, answer, hangUp } = useCall();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  const previewCaller = {
    name: 'Mami',
    label: 'Phone  984-2105624',
    avatarColor: '#7C5CFF',
  } as const;
  const currentCaller = caller ?? previewCaller;

  useKeepAwake();

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
      return () => subscription.remove();
    }, []),
  );

  const nameSize = Math.round(Math.max(32, Math.min(width * 0.11, 48)));
  const buttonSize = Math.round(Math.max(56, Math.min(width * 0.16, 70)));
  const outerSize = buttonSize + RING_WIDTH * 2;
  const edgePad = Math.max(insets.left, insets.right, 24) + 24;

  return (
    <LinearGradient
      colors={WALLPAPER}
      locations={WALLPAPER_STOPS}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.root}
    >
      <StatusBar hidden />
      <NavigationBar hidden />

      <View
        style={[
          styles.content,
          { paddingTop: Math.max(insets.top, 28), paddingBottom: insets.bottom + 16 },
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.caption}>Incoming call</Text>
          <Text
            accessibilityRole="header"
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[styles.name, { fontSize: nameSize, lineHeight: Math.round(nameSize * 1.15) }]}
          >
            {currentCaller.name}
          </Text>
          {currentCaller.label ? (
            <Text numberOfLines={1} style={styles.number}>
              {currentCaller.label}
            </Text>
          ) : null}
        </View>

        <View style={styles.spacerLarge} />

        <View style={styles.recent}>
          <MaterialCommunityIcons name="phone" size={26} color="#FFFFFF" />
          <Text style={styles.recentText}>Most recent call</Text>
          <Text style={styles.recentText}>Yesterday</Text>
        </View>

        <View style={styles.spacerSmall} />

        {/* Decline on the left (swipe left), Accept on the right (swipe right) */}
        <View style={[styles.actions, { paddingHorizontal: edgePad }]}>
          <SwipeCallButton
            icon="phone"
            color={ACCEPT_COLOR}
            size={outerSize}
            direction="right"
            onComplete={answer}
            reduceMotion={reduceMotion}
          />
          <SwipeCallButton
            icon="phone-hangup"
            color={DECLINE_COLOR}
            size={outerSize}
            direction="left"
            onComplete={hangUp}
            reduceMotion={reduceMotion}
          />
        </View>

        <View style={styles.bottom}>
          <View style={styles.homeBar} />
          <Text style={styles.sendMessage}>Send message</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

/* ------------------------------------------------------------- styles ---- */

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
  header: { alignItems: 'center', paddingHorizontal: 24 },
  caption: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '400',
    letterSpacing: 0.3,
    ...SHADOW,
  },
  name: {
    color: '#FFFFFF',
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 40,
    ...SHADOW,
  },
  number: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '400',
    marginTop: 8,
    ...SHADOW,
  },
  spacerLarge: { flex: 3 },
  spacerSmall: { flex: 1 },
  recent: { alignItems: 'center', gap: 6 },
  recentText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '400',
    textAlign: 'center',
    ...SHADOW,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  buttonWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulse: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderWidth: PULSE_BORDER_WIDTH,
  },
  ring: {
    backgroundColor: RING_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonFace: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  bottom: { alignItems: 'center', marginTop: 30 },
  homeBar: {
    width: 130,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  sendMessage: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '500',
    marginTop: 12,
    ...SHADOW,
  },
});