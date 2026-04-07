/**
 * Root layout — initializes auth state and decides which stack to show.
 *
 * Navigation strategy:
 *   - Not logged in                 → (auth) stack (login / register)
 *   - Logged in, onboarding undone  → (onboarding) stack
 *   - Logged in, onboarding done    → (app) tab stack
 *
 * The auth check happens in `useEffect` after the store initializes,
 * so we show a splash screen while loading to avoid a flicker.
 */
import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack, router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAuthStore } from '@/store/authStore';
import { COLORS } from '@/lib/constants';

export default function RootLayout() {
  const { user, isLoading, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, []);

  // After auth resolves, redirect to the appropriate starting screen
  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      router.replace('/(auth)/login');
    } else if (!user.onboarding_done) {
      router.replace('/(onboarding)/step1');
    } else {
      router.replace('/(app)/home');
    }
  }, [isLoading, user]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(onboarding)" />
          <Stack.Screen name="(app)" />
          <Stack.Screen
            name="call/incoming"
            options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
          />
          <Stack.Screen
            name="call/[sessionId]"
            options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
          />
          <Stack.Screen name="recap/[sessionId]" />
          <Stack.Screen name="safety" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
