/**
 * Onboarding Step 2 — Choose avatar emoji.
 * Light and playful; lets users personalize without friction.
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/authStore';
import { userApi } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { COLORS, FONT_SIZES, RADIUS, SPACING } from '@/lib/constants';

const AVATARS = [
  '🐱', '🐶', '🐼', '🐨', '🐸', '🦊', '🐺', '🐭',
  '🌸', '🌻', '🍀', '🌈', '⭐', '🌙', '☁️', '🦋',
  '🍓', '🫧', '🍵', '🎈', '🎀', '💫', '✨', '🌊',
];

// Progress dots (same as step1 — in a real app, extract to a shared component file)
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

export default function Step2() {
  const { user, refreshUser } = useAuthStore();
  const [selected, setSelected] = useState(user?.avatar_emoji ?? '🌙');
  const [loading, setLoading] = useState(false);

  const handleNext = async () => {
    setLoading(true);
    try {
      await userApi.updateOnboarding({ avatar_emoji: selected });
      await refreshUser();
      router.push('/(onboarding)/step3');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <ProgressDots current={1} total={5} />

        <Text style={styles.selected}>{selected}</Text>
        <Text style={styles.title}>选一个你喜欢的头像</Text>
        <Text style={styles.subtitle}>这是你在宝宝来电里的专属形象</Text>

        <FlatList
          data={AVATARS}
          numColumns={6}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.avatarBtn, item === selected && styles.avatarSelected]}
              onPress={() => setSelected(item)}
              activeOpacity={0.7}
            >
              <Text style={styles.avatarEmoji}>{item}</Text>
            </TouchableOpacity>
          )}
        />

        <Button label="继续 →" onPress={handleNext} loading={loading} />
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
  selected: { fontSize: 72, textAlign: 'center', marginBottom: SPACING.sm },
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
  },
  grid: { paddingBottom: SPACING.xl },
  avatarBtn: {
    flex: 1,
    aspectRatio: 1,
    margin: 4,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  avatarSelected: {
    backgroundColor: COLORS.primaryLight,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  avatarEmoji: { fontSize: 28 },
});
