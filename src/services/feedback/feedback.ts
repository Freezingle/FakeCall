import * as Haptics from 'expo-haptics';
import { Vibration } from 'react-native';

/**
 * Ringing vibration uses React Native's Vibration API because expo-haptics only
 * supports one-shot effects and cannot loop a pattern. expo-haptics is used for
 * short button feedback.
 *
 * Android pattern format: [initial delay, vibrate, pause, vibrate, pause, ...] in ms.
 * Passing `true` repeats the pattern until cancel() is called.
 */
const RING_PATTERN = [0, 900, 700, 900, 1800];

export function startRingVibration(): void {
  Vibration.vibrate(RING_PATTERN, true);
}

export function stopRingVibration(): void {
  Vibration.cancel();
}

function safely(effect: Promise<void>): void {
  // Haptics can be unavailable (emulators, some devices). Never let that surface as an error.
  effect.catch(() => undefined);
}

export function tapFeedback(): void {
  safely(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

export function confirmFeedback(): void {
  safely(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

export function endFeedback(): void {
  safely(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}
