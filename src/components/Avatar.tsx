import { StyleSheet, Text, View } from 'react-native';

interface AvatarProps {
  name: string;
  color: string;
  size: number;
}

export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = Array.from(words[0])[0] ?? '';
  const second = words.length > 1 ? (Array.from(words[words.length - 1])[0] ?? '') : '';
  return (first + second).toUpperCase();
}

/** Decorative: the caller's name is always announced next to it, so it is hidden from screen readers. */
export function Avatar({ name, color, size }: AvatarProps) {
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
      ]}
    >
      <Text style={[styles.initials, { fontSize: size * 0.38 }]} allowFontScaling={false}>
        {getInitials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  initials: { color: '#FFFFFF', fontWeight: '600', letterSpacing: 1 },
});
