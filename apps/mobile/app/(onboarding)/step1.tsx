/**
 * Onboarding Step 1 — Welcome + nickname confirmation.
 * The nickname was set at registration; user can adjust it here.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/authStore';
import { userApi } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { COLORS, FONT_SIZES, RADIUS, SPACING } from '@/lib/constants';

// Progress dots component — reused across all onboarding steps
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

export default function Step1() {
  const { user, refreshUser } = useAuthStore();
  const [nickname, setNickname] = useState(user?.nickname ?? '');
  const [loading, setLoading] = useState(false);

  const handleNext = async () => {
    if (!nickname.trim()) return;
    setLoading(true);
    try {
      await userApi.updateOnboarding({ nickname: nickname.trim() });
      await refreshUser();
      router.push('/(onboarding)/step2');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.container}>
          <ProgressDots current={0} total={5} />

          <Text style={styles.emoji}>👋</Text>
          <Text style={styles.title}>你好，我是宝宝来电</Text>
          <Text style={styles.body}>
            我会在你睡前或情绪不好的时候主动打来，陪你说说话。{'\n\n'}
            先告诉我，你平时喜欢别人怎么叫你？
          </Text>

          <TextInput
            style={styles.input}
            placeholder="你的昵称"
            placeholderTextColor={COLORS.textLight}
            value={nickname}
            onChangeText={setNickname}
            maxLength={20}
            autoFocus
          />

          <View style={styles.spacer} />

          <Button
            label="继续 →"
            onPress={handleNext}
            loading={loading}
            disabled={!nickname.trim()}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xl,
  },
  emoji: { fontSize: 56, marginBottom: SPACING.md },
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  body: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    lineHeight: 24,
    marginBottom: SPACING.xl,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZES.lg,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: '#EBEBEB',
  },
  spacer: { flex: 1 },
});
