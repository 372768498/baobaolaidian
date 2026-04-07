/**
 * Incoming call screen — "ringing" animation for 2s, then auto-answer.
 *
 * Shown between triggering a call and the live call screen.
 * Gives the app a natural "phone ringing" feel.
 *
 * Params:
 *   sessionId — the session to connect to after answering
 */
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '@/store/authStore';
import { COLORS, FONT_SIZES, RADIUS, SPACING } from '@/lib/constants';

export default function IncomingCallScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { personas, user, loadPersonas } = useAuthStore();

  // Pulsing ring animation
  const pulse1 = useRef(new Animated.Value(1)).current;
  const pulse2 = useRef(new Animated.Value(1)).current;

  const persona = personas.find((p) => p.id === user?.preferred_persona_id);

  useEffect(() => {
    if (personas.length === 0) loadPersonas();
  }, []);

  // Haptic ring pattern: buzz twice, pause, repeat
  useEffect(() => {
    let cancelled = false;

    const vibrate = async () => {
      while (!cancelled) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await new Promise((r) => setTimeout(r, 300));
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await new Promise((r) => setTimeout(r, 1400));
      }
    };
    vibrate();
    return () => { cancelled = true; };
  }, []);

  // Expanding ring animation
  useEffect(() => {
    const ring = (val: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, {
            toValue: 2.2,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(val, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };
    ring(pulse1, 0);
    ring(pulse2, 600);
  }, []);

  const handleAnswer = () => {
    router.replace({
      pathname: `/call/${sessionId}`,
    });
  };

  const handleDecline = () => {
    router.back();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Caller info */}
        <View style={styles.callerSection}>
          <Text style={styles.callerLabel}>宝宝来电</Text>
          <Text style={styles.triggerLabel}>情绪急救 · 来了</Text>

          {/* Animated rings */}
          <View style={styles.avatarWrapper}>
            <Animated.View
              style={[styles.ring, styles.ring1, { transform: [{ scale: pulse1 }] }]}
            />
            <Animated.View
              style={[styles.ring, styles.ring2, { transform: [{ scale: pulse2 }] }]}
            />
            <View style={styles.avatar}>
              <Text style={styles.avatarEmoji}>
                {persona?.avatar_emoji ?? '🌙'}
              </Text>
            </View>
          </View>

          <Text style={styles.personaName}>{persona?.name ?? 'AI 朋友'}</Text>
          <Text style={styles.personaBio}>{persona?.short_bio ?? '在线等你接听'}</Text>
        </View>

        {/* Call controls */}
        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.controlBtn, styles.declineBtn]}
            onPress={handleDecline}
            activeOpacity={0.8}
          >
            <Text style={styles.controlEmoji}>📵</Text>
            <Text style={styles.controlLabel}>不接</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlBtn, styles.answerBtn]}
            onPress={handleAnswer}
            activeOpacity={0.8}
          >
            <Text style={styles.controlEmoji}>📞</Text>
            <Text style={[styles.controlLabel, { color: '#fff' }]}>接听</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const RING_SIZE = 140;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1A1A2E' },
  container: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
    paddingHorizontal: SPACING.xl,
  },
  callerSection: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  callerLabel: {
    fontSize: FONT_SIZES.sm,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: SPACING.xs,
    letterSpacing: 1,
  },
  triggerLabel: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: '#fff',
    marginBottom: SPACING.xl,
  },
  avatarWrapper: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  ring: {
    position: 'absolute',
    borderRadius: RING_SIZE / 2,
    borderWidth: 1.5,
  },
  ring1: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderColor: `${COLORS.primary}60`,
  },
  ring2: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderColor: `${COLORS.primary}30`,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: { fontSize: 48 },
  personaName: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '800',
    color: '#fff',
    marginBottom: SPACING.xs,
  },
  personaBio: { fontSize: FONT_SIZES.sm, color: 'rgba(255,255,255,0.6)' },

  controls: {
    flexDirection: 'row',
    gap: SPACING.xxl,
    paddingBottom: SPACING.xl,
  },
  controlBtn: {
    alignItems: 'center',
    gap: SPACING.sm,
  },
  declineBtn: {},
  answerBtn: {},
  controlEmoji: {
    fontSize: 40,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 40,
    padding: 16,
    overflow: 'hidden',
  },
  answerBg: {
    backgroundColor: COLORS.success,
  },
  controlLabel: {
    fontSize: FONT_SIZES.sm,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
  },
});
