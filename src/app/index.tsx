import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { useCall } from '@/features/calls/CallProvider';
import { useSettings } from '@/features/settings/SettingsProvider';
import { ringtoneLabel } from '@/services/audio/catalog';
import { tapFeedback } from '@/services/feedback/feedback';
import {
  callAlarmAvailable,
  getAlarmPermissions,
  openAlarmSettings,
  requestNotificationPermission,
  type AlarmPermissions,
} from '@/services/scheduling/callAlarm';
import {
  DEFAULT_DELAY_ID,
  DELAY_PRESETS,
  formatCountdown,
} from '@/services/scheduling/delays';
import { useNow } from '@/services/scheduling/useNow';
import { MIN_TOUCH, radius, space, usePalette, type Palette } from '@/theme';

const NOTICE_DURATION_MS = 4000;

function ScheduleStatus({
  fireAt,
  callerName,
  palette,
  alarmSupported,
  onCancel,
}: {
  fireAt: number;
  callerName: string;
  palette: Palette;
  alarmSupported: boolean;
  onCancel: () => void;
}) {
  const now = useNow(250);
  return (
    <View style={[styles.statusCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <Text style={[styles.statusLabel, { color: palette.textMuted }]}>
        Incoming call from {callerName} in
      </Text>
      <Text
        style={[styles.statusTime, { color: palette.text }]}
        accessibilityRole="timer"
        accessibilityLabel={`${formatCountdown(fireAt - now)} remaining`}
      >
        {formatCountdown(fireAt - now)}
      </Text>
      <Pressable
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel="Cancel scheduled call"
        android_ripple={{ color: palette.surfaceAlt }}
        style={[styles.outlineButton, { borderColor: palette.danger }]}
      >
        <Text style={[styles.outlineButtonText, { color: palette.danger }]}>Cancel call</Text>
      </Pressable>
      <Text style={[styles.hint, { color: palette.textMuted }]}>
        {alarmSupported
          ? 'Rings even if FakeCall is closed. Keep the phone switched on.'
          : 'Only rings while FakeCall is open: this build has no native call alarm.'}
      </Text>
    </View>
  );
}

export default function HomeScreen() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { settings } = useSettings();
  const { schedule, callNow, scheduleCall, cancelScheduledCall } = useCall();

  const [delayId, setDelayId] = useState(DEFAULT_DELAY_ID);
  const [notice, setNotice] = useState<string | null>(null);
  const [alarmPermissions, setAlarmPermissions] = useState<AlarmPermissions | null>(null);

  const { caller } = settings;
  const selectedDelay = DELAY_PRESETS.find((p) => p.id === delayId) ?? DELAY_PRESETS[1];

  // Transient confirmation line. The timer is cleared if the message changes or the screen unmounts.
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_DURATION_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  const announce = useCallback((message: string) => {
    setNotice(message);
    AccessibilityInfo.announceForAccessibility(message);
  }, []);

  const refreshAlarmPermissions = useCallback(() => {
    getAlarmPermissions()
      .then(setAlarmPermissions)
      .catch(() => undefined);
  }, []);

  // Re-read on focus: the user may have just granted a permission in settings.
  useFocusEffect(
    useCallback(() => {
      refreshAlarmPermissions();
    }, [refreshAlarmPermissions]),
  );

  // Missing permissions, in the order worth fixing them.
  const missingPermissions: { key: keyof AlarmPermissions; label: string }[] = alarmPermissions
    ? [
        { key: 'notifications' as const, label: 'notifications' },
        { key: 'exactAlarms' as const, label: 'exact alarms' },
        { key: 'fullScreenIntent' as const, label: 'full-screen alerts' },
      ].filter(({ key }) => !alarmPermissions[key])
    : [];

  const handleFixPermissions = async () => {
    tapFeedback();
    if (!alarmPermissions) return;
    if (!alarmPermissions.notifications) {
      // The only one Android can ask for directly; the rest need the user.
      const granted = await requestNotificationPermission();
      if (!granted) await openAlarmSettings('notifications');
      refreshAlarmPermissions();
      return;
    }
    if (!alarmPermissions.exactAlarms) {
      await openAlarmSettings('exactAlarms');
      return;
    }
    await openAlarmSettings('fullScreenIntent');
  };

  const handleSchedule = () => {
    tapFeedback();
    scheduleCall(selectedDelay.ms);
    announce(`Call scheduled in ${selectedDelay.spoken}`);
  };

  const handleCancel = () => {
    tapFeedback();
    cancelScheduledCall();
    announce('Scheduled call cancelled');
  };

  return (
    <ScrollView
      style={{ backgroundColor: palette.background }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.lg },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={styles.brand}>
          <View style={[styles.logo, { backgroundColor: palette.accent }]}>
            <MaterialCommunityIcons name="phone-in-talk" size={20} color={palette.onAccent} />
          </View>
          <Text style={[styles.brandText, { color: palette.text }]} accessibilityRole="header">
            FakeCall
          </Text>
        </View>
        <Pressable
          onPress={() => router.push('/settings')}
          accessibilityRole="button"
          accessibilityLabel="Settings"
          hitSlop={4}
          android_ripple={{ color: palette.surfaceAlt, borderless: true, radius: 24 }}
          style={styles.iconButton}
        >
          <MaterialCommunityIcons name="cog-outline" size={26} color={palette.text} />
        </Pressable>
      </View>

      <Pressable
        onPress={() => router.push('/settings')}
        accessibilityRole="button"
        accessibilityLabel={`Caller: ${caller.name}, ${caller.label}. Edit caller settings`}
        android_ripple={{ color: palette.surfaceAlt }}
        style={[styles.callerRow, { backgroundColor: palette.surface, borderColor: palette.border }]}
      >
        <Avatar name={caller.name} color={caller.avatarColor} size={52} />
        <View style={styles.callerText}>
          <Text style={[styles.callerName, { color: palette.text }]} numberOfLines={1}>
            {caller.name}
          </Text>
          <Text style={[styles.callerMeta, { color: palette.textMuted }]} numberOfLines={1}>
            {caller.label} · {ringtoneLabel(caller.ringtone, caller.ringtoneUri)}
          </Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={24} color={palette.textMuted} />
      </Pressable>

      <Pressable
        onPress={callNow}
        accessibilityRole="button"
        accessibilityLabel="Call me now"
        accessibilityHint={`Starts a simulated incoming call from ${caller.name}`}
        android_ripple={{ color: 'rgba(255,255,255,0.25)' }}
        style={({ pressed }) => [
          styles.primaryButton,
          { backgroundColor: palette.accent, opacity: pressed ? 0.9 : 1 },
        ]}
      >
        <MaterialCommunityIcons name="phone-incoming" size={26} color={palette.onAccent} />
        <Text style={[styles.primaryButtonText, { color: palette.onAccent }]}>Call Me Now</Text>
      </Pressable>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: palette.textMuted }]} accessibilityRole="header">
          Or schedule a call
        </Text>

        {schedule ? (
          <ScheduleStatus
            fireAt={schedule.fireAt}
            callerName={caller.name}
            palette={palette}
            alarmSupported={callAlarmAvailable}
            onCancel={handleCancel}
          />
        ) : (
          <>
            <View style={styles.chips} accessibilityRole="radiogroup">
              {DELAY_PRESETS.map((preset) => {
                const selected = preset.id === delayId;
                return (
                  <Pressable
                    key={preset.id}
                    onPress={() => {
                      tapFeedback();
                      setDelayId(preset.id);
                    }}
                    accessibilityRole="radio"
                    accessibilityLabel={`Call in ${preset.spoken}`}
                    accessibilityState={{ selected }}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: selected ? palette.accent : palette.surface,
                        borderColor: selected ? palette.accent : palette.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: selected ? palette.onAccent : palette.text },
                      ]}
                    >
                      {preset.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              onPress={handleSchedule}
              accessibilityRole="button"
              accessibilityLabel={`Schedule fake call in ${selectedDelay.spoken}`}
              android_ripple={{ color: palette.surfaceAlt }}
              style={[
                styles.secondaryButton,
                { backgroundColor: palette.surface, borderColor: palette.border },
              ]}
            >
              <MaterialCommunityIcons name="timer-outline" size={22} color={palette.text} />
              <Text style={[styles.secondaryButtonText, { color: palette.text }]}>
                Schedule Fake Call
              </Text>
            </Pressable>
          </>
        )}

        <View accessibilityLiveRegion="polite" style={styles.noticeSlot}>
          {notice !== null && (
            <Text style={[styles.notice, { color: palette.success }]}>{notice}</Text>
          )}
        </View>

        {missingPermissions.length > 0 && (
          <Pressable
            onPress={handleFixPermissions}
            accessibilityRole="button"
            accessibilityLabel={`Allow ${missingPermissions
              .map((permission) => permission.label)
              .join(', ')} so scheduled calls can reach you`}
            android_ripple={{ color: palette.surfaceAlt }}
            style={[
              styles.permissionCard,
              { backgroundColor: palette.surface, borderColor: palette.border },
            ]}
          >
            <MaterialCommunityIcons name="bell-alert-outline" size={22} color={palette.text} />
            <View style={styles.permissionText}>
              <Text style={[styles.permissionTitle, { color: palette.text }]}>
                Allow {missingPermissions.map((permission) => permission.label).join(', ')}
              </Text>
              <Text style={[styles.permissionHint, { color: palette.textMuted }]}>
                Without this, a scheduled call cannot reach you while FakeCall is closed.
              </Text>
            </View>
            <Text style={[styles.permissionAction, { color: palette.accent }]}>Allow</Text>
          </Pressable>
        )}
      </View>

      <Text style={[styles.footnote, { color: palette.textMuted }]}>
        FakeCall only simulates a call on this screen. It never dials a number or sends a message.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.lg, gap: space.lg, flexGrow: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  brandText: { fontSize: 24, fontWeight: '700', letterSpacing: -0.3 },
  iconButton: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    minHeight: 76,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  callerText: { flex: 1, gap: 2 },
  callerName: { fontSize: 18, fontWeight: '600' },
  callerMeta: { fontSize: 14 },
  primaryButton: {
    minHeight: 72,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    overflow: 'hidden',
  },
  primaryButtonText: { fontSize: 20, fontWeight: '700' },
  section: { gap: space.md },
  sectionTitle: { fontSize: 13, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase' },
  chips: { flexDirection: 'row', gap: space.sm },
  chip: {
    flex: 1,
    minHeight: MIN_TOUCH,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontSize: 15, fontWeight: '600' },
  secondaryButton: {
    minHeight: 56,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    overflow: 'hidden',
  },
  secondaryButtonText: { fontSize: 17, fontWeight: '600' },
  statusCard: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.lg,
    alignItems: 'center',
    gap: space.sm,
  },
  statusLabel: { fontSize: 14, textAlign: 'center' },
  statusTime: { fontSize: 52, fontWeight: '700', fontVariant: ['tabular-nums'] },
  outlineButton: {
    minHeight: MIN_TOUCH,
    alignSelf: 'stretch',
    borderRadius: radius.sm,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.sm,
    overflow: 'hidden',
  },
  outlineButtonText: { fontSize: 16, fontWeight: '600' },
  hint: { fontSize: 12, textAlign: 'center', marginTop: space.xs },
  noticeSlot: { minHeight: 22 },
  notice: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
  permissionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  permissionText: { flex: 1, gap: 2 },
  permissionTitle: { fontSize: 15, fontWeight: '600' },
  permissionHint: { fontSize: 12, lineHeight: 16 },
  permissionAction: { fontSize: 15, fontWeight: '700' },
  footnote: { fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 'auto' },
});
