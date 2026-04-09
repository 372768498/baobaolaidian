/**
 * Onboarding Step 4 — Set preferred call time window for bedtime calls.
 * Simple time picker using scrollable hour selectors.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { userApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import { COLORS, FONT_SIZES, RADIUS, SPACING } from '@/lib/constants';

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6, marginBottom: SPACING.xl }}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={{
            width: i === current ? 24 : 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: i === current ? COLORS.primary : '#E0E0E0',
          }}
        />
      ))}
    </View>
  );
}

// Common bedtime windows to choose from
const PRESETS = [
  { label: '21:00 – 22:00', start: '21:00', end: '22:00' },
  { label: '22:00 – 23:00', start: '22:00', end: '23:00' },
  { label: '23:00 – 00:00', start: '23:00', end: '00:00' },
  { label: '00:00 – 01:00', start: '00:00', end: '01:00' },
];

export default function Step4() {
  const { refreshUser } = useAuthStore();
  const [selected, setSelected] = useState(PRESETS[1]);
  const [saving, setSaving] = useState(false);

  const handleNext = async () => {
    setSaving(true);
    try {
      await userApi.updateOnboarding({
        call_time_start: selected.start,
        call_time_end: selected.end,
      });
      await refreshUser();
      router.push('/(onboarding)/step5');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <ProgressDots current={3} total={5} />

        <Text style={styles.emoji}>🌙</Text>
        <Text style={styles.title}>什么时候打来比较好？</Text>
        <Text style={styles.subtitle}>
          我会在这个时间段里主动打来陪你睡前放松。
          不会在你忙的时候打扰你。
        </Text>

        <View style={styles.presets}>
          {PRESETS.map((p) => (
            <TouchableOpacity
              key={p.label}
              onPress={() => setSelected(p)}
              style={[
                styles.presetBtn,
                selected.label === p.label && styles.presetBtnSelected,
              ]}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.presetText,
                  selected.label === p.label && styles.presetTextSelected,
                ]}
              >
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.note}>
          ⓘ 每天最多来电 1 次，通话不超过 30 分钟
        </Text>

        <View style={styles.spacer} />

        <Button label="继续 →" onPress={handleNext} loading={saving} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  container: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xl,
  },
  emoji: { fontSize: 56, marginBottom: SPACING.sm },
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    lineHeight: 22,
    marginBottom: SPACING.xl,
  },
  presets: { gap: SPACING.sm },
  presetBtn: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1.5,
    borderColor: '#EBEBEB',
  },
  presetBtnSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#FFF0EA',
  },
  presetText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  presetTextSelected: { color: COLORS.primary, fontWeight: '700' },
  note: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textLight,
    marginTop: SPACING.lg,
  },
  spacer: { flex: 1 },
});
