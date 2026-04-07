/**
 * Settings / profile screen — persona, call schedule, account actions.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/authStore';
import { COLORS, FONT_SIZES, RADIUS, SPACING } from '@/lib/constants';

function SettingRow({
  label,
  value,
  onPress,
  danger,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <Text style={[styles.rowLabel, danger && { color: COLORS.danger }]}>
        {label}
      </Text>
      {value ? (
        <Text style={styles.rowValue}>{value} →</Text>
      ) : (
        <Text style={styles.rowChevron}>→</Text>
      )}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    Alert.alert('退出登录', '确定要退出吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '退出',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Profile header */}
        <View style={styles.profile}>
          <Text style={styles.avatar}>{user?.avatar_emoji ?? '🌙'}</Text>
          <Text style={styles.nickname}>{user?.nickname ?? '—'}</Text>
          <Text style={styles.phone}>{user?.phone ?? ''}</Text>
        </View>

        {/* Preferences */}
        <Text style={styles.section}>偏好设置</Text>
        <View style={styles.card}>
          <SettingRow
            label="AI 伴侣"
            value="点击更换"
            onPress={() => router.push('/(onboarding)/step3')}
          />
          <View style={styles.divider} />
          <SettingRow
            label="来电时间窗口"
            value="点击修改"
            onPress={() => router.push('/(onboarding)/step4')}
          />
        </View>

        {/* Safety */}
        <Text style={styles.section}>安全</Text>
        <View style={styles.card}>
          <SettingRow
            label="紧急求助热线"
            value="400-161-9995"
            onPress={() => router.push('/safety')}
          />
          <View style={styles.divider} />
          <SettingRow
            label="安全说明"
            onPress={() => router.push('/safety')}
          />
        </View>

        {/* Account */}
        <Text style={styles.section}>账号</Text>
        <View style={styles.card}>
          <SettingRow label="退出登录" onPress={handleLogout} danger />
        </View>

        <Text style={styles.footer}>
          宝宝来电 v1.0.0{'\n'}
          本产品使用 AI 技术，不提供医疗建议{'\n'}
          所有通话均由 AI 完成，会明确告知
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  container: {
    flexGrow: 1,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  profile: { alignItems: 'center', marginBottom: SPACING.xl },
  avatar: { fontSize: 72, marginBottom: SPACING.sm },
  nickname: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  phone: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginTop: 4 },

  section: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    marginTop: SPACING.lg,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  rowLabel: { fontSize: FONT_SIZES.md, color: COLORS.textPrimary },
  rowValue: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  rowChevron: { fontSize: FONT_SIZES.md, color: COLORS.textLight },
  divider: { height: 1, backgroundColor: '#F0F0F0', marginHorizontal: SPACING.md },

  footer: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textLight,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: SPACING.xxl,
  },
});
