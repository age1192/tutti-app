import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { colors } from '../styles';

export default function RootLayout() {
  useEffect(() => {
    // スプラッシュスクリーンを非表示にする（expo-splash-screenが利用可能な場合）
    try {
      const SplashScreen = require('expo-splash-screen');
      SplashScreen.hideAsync();
    } catch (e) {
      // expo-splash-screenが利用できない場合は無視
    }
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: colors.background.primary,
          },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="home" />
        <Stack.Screen name="program" />
        <Stack.Screen name="tutorial" />
        <Stack.Screen name="help" />
        <Stack.Screen name="settings" />
      </Stack>
    </>
  );
}
