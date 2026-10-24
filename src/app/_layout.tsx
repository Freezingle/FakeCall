import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { CallNavigator } from '@/features/calls/CallNavigator';
import { CallProvider } from '@/features/calls/CallProvider';
import { SettingsProvider, useSettings } from '@/features/settings/SettingsProvider';
import { callColors, usePalette } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function AppShell() {
  const { status } = useSettings();
  const palette = usePalette();

  // Keep the splash screen up until saved settings are read, so the home
  // screen never flashes default values.
  useEffect(() => {
    if (status === 'ready') SplashScreen.hideAsync().catch(() => undefined);
  }, [status]);

  if (status === 'loading') return null;

  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: palette.background },
          headerTintColor: palette.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: palette.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ title: 'Caller settings' }} />
        <Stack.Screen
          name="incoming"
          options={{
            headerShown: false,
            presentation: 'fullScreenModal',
            animation: 'fade',
            gestureEnabled: false,
            contentStyle: { backgroundColor: callColors.background },
          }}
        />
        <Stack.Screen
          name="active"
          options={{
            headerShown: false,
            animation: 'fade',
            gestureEnabled: false,
            contentStyle: { backgroundColor: callColors.background },
          }}
        />
      </Stack>
      <CallNavigator />
    </>
  );
}

export default function RootLayout() {
  return (
    <SettingsProvider>
      <CallProvider>
        <AppShell />
      </CallProvider>
    </SettingsProvider>
  );
}
