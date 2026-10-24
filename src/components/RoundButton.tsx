import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { callColors } from '@/theme';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

type Variant = 'accept' | 'decline' | 'control';

interface RoundButtonProps {
  icon: IconName;
  label: string;
  onPress: () => void;
  variant: Variant;
  size?: number;
  /** For toggle buttons (mute, speaker). */
  active?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

/** Circular call button with a visible label underneath. */
export function RoundButton({
  icon,
  label,
  onPress,
  variant,
  size = 72,
  active,
  accessibilityLabel,
  accessibilityHint,
}: RoundButtonProps) {
  const isToggle = active !== undefined;
  const filled = variant === 'control' ? (active ? callColors.controlActive : callColors.control) : undefined;
  const background =
    variant === 'accept' ? callColors.accept : variant === 'decline' ? callColors.decline : filled;
  const iconColor = variant === 'control' && active ? callColors.onControlActive : '#FFFFFF';

  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={onPress}
        accessibilityRole={isToggle ? 'switch' : 'button'}
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityHint={accessibilityHint}
        accessibilityState={isToggle ? { checked: active } : undefined}
        android_ripple={{ color: 'rgba(255,255,255,0.25)', borderless: true, radius: size / 2 }}
        style={({ pressed }) => [
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: background,
            opacity: pressed ? 0.8 : 1,
            transform: [{ scale: pressed ? 0.96 : 1 }],
          },
        ]}
      >
        <MaterialCommunityIcons name={icon} size={size * 0.45} color={iconColor} />
      </Pressable>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', gap: 10, minWidth: 72 },
  circle: { alignItems: 'center', justifyContent: 'center' },
  label: { color: callColors.textMuted, fontSize: 14, fontWeight: '500' },
});
