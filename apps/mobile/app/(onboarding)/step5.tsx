/**
 * Onboarding Step 5 — Safety briefing + completion.
 *
 * This screen is critical: it sets expectations about AI limitations,
 * introduces the emergency call button, and marks onboarding complete.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/authStore';
import { userApi } from '@/lib/api';
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

const NOTICES = [
  {
    emoji: '🤖',
    title: '我是 AI，不是真人',
    body: '宝宝来电是 AI 助手。我会尽力共情和陪伴，但我不是心理医生，也无法替代真人关系。',
  },
  {
    emoji: '🆘',
    title: '遇到危机请拨打专业热线',
    body: '如果你有伤害自己或他人的想法，请立刻拨打 400-161-9995（心理危机热线）。我会在通话中提醒你。',
  },
  {
    emoji: '🔔',
    title: '随时可以叫我打来',
    body: '情绪急救模式：在首页点"立刻来电"，我会在 3 秒内接通，不需要预约。',
  },
];

export default function Step5() {
  const { refreshUser } = useAuthStore();
  const [saving, setSaving] = useState(false);

  const handleDone = async () => {
    setSaving(true);
    try {
      // Mark onboarding complete — root layout will redirect to home
      await userApi.updateOnboarding({ onboarding_done: true });
      await refreshUser();
      router.replace('/(app)/home');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <ProgressDots current={4} total={5} />

        <Text style={styles.title}>在开始之前，说几句重要的话</Text>

        {NOTICES.map((n) => (
          <View key={n.emoji} style={styles.notice}>
            <Text style={styles.noticeEmoji}>{n.emoji}</Text>
            <View style={styles.noticeText}>
              <Text style={styles.noticeTitle}>{n.title}</Text>
              <Text style={styles.noticeBody}>{n.body}</Text>
            </View>
          </View>
        ))}

        <View style={styles.readyBox}>
          <Text style={styles.readyText}>
            准备好了吗？我已经迫不及待想认识你了 ☺️
          </Text>
        </View>

        <Button
          label="开始吧！"
          onPress={handleDone}
          loading={saving}
          style={styles.btn}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  container: {
    flexGrow: 1,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xxl,
  },
  title: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xl,
    lineHeight: 28,
  },
  notice: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  noticeEmoji: { fontSize: 28 },
  noticeText: { flex: 1 },
  noticeTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  noticeBody: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  readyBox: {
    backgroundColor: '#FFF0EA',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginVertical: SPACING.lg,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  readyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textPrimary,
    lineHeight: 22,
  },
  btn: { marginTop: SPACING.sm },
});
