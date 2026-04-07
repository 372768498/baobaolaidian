/**
 * Safety screen — crisis resources + AI transparency disclosure.
 *
 * Accessible from:
 *  - Home screen bottom link
 *  - Settings screen "安全" section
 *  - Risk alert modal (implied — user can navigate here after)
 *
 * Design: clear, calm, zero-friction. The primary CTA is the hotline
 * dial button — one tap, no confirmation dialog required.
 */
import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, FONT_SIZES, RADIUS, SPACING, SAFETY_HOTLINE } from '@/lib/constants';
import { Button } from '@/components/ui/Button';

/** Section divider with title */
function SectionLabel({ label }: { label: string }) {
  return <Text style={styles.sectionLabel}>{label}</Text>;
}

/** A single resource row — icon + text + optional action */
function ResourceRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.resourceRow}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <Text style={styles.resourceIcon}>{icon}</Text>
      <View style={styles.resourceInfo}>
        <Text style={styles.resourceTitle}>{title}</Text>
        {subtitle ? (
          <Text style={styles.resourceSubtitle}>{subtitle}</Text>
        ) : null}
      </View>
      {onPress ? <Text style={styles.resourceChevron}>→</Text> : null}
    </TouchableOpacity>
  );
}

/** Disclosure bullet */
function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.bullet}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

export default function SafetyScreen() {
  const dialHotline = () => {
    Linking.openURL(`tel:${SAFETY_HOTLINE}`);
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header row with back button */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← 返回</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>安全与帮助</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Emergency CTA — most prominent element */}
        <View style={styles.emergencyCard}>
          <Text style={styles.emergencyEmoji}>🆘</Text>
          <Text style={styles.emergencyTitle}>如果你现在处于危机中</Text>
          <Text style={styles.emergencyBody}>
            如果你有伤害自己或他人的想法，或者感到无法承受，请立刻拨打专业热线。
            热线 24 小时有真人接听，完全免费。
          </Text>
          <TouchableOpacity style={styles.dialBtn} onPress={dialHotline} activeOpacity={0.85}>
            <Text style={styles.dialBtnIcon}>📞</Text>
            <View>
              <Text style={styles.dialBtnLabel}>拨打危机热线</Text>
              <Text style={styles.dialBtnNumber}>{SAFETY_HOTLINE}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Other resources */}
        <SectionLabel label="其他支持渠道" />
        <View style={styles.card}>
          <ResourceRow
            icon="💬"
            title="北京心理危机研究与干预中心"
            subtitle="010-82951332 · 24 小时"
            onPress={() => Linking.openURL('tel:01082951332')}
          />
          <View style={styles.divider} />
          <ResourceRow
            icon="🌐"
            title="全国心理援助热线"
            subtitle="400-161-9995 · 24 小时免费"
            onPress={dialHotline}
          />
          <View style={styles.divider} />
          <ResourceRow
            icon="🏥"
            title="拨打 120 急救"
            subtitle="身体或精神紧急情况"
            onPress={() => Linking.openURL('tel:120')}
          />
        </View>

        {/* AI transparency */}
        <SectionLabel label="关于宝宝来电" />
        <View style={styles.card}>
          <Text style={styles.disclosureIntro}>
            我们承诺对你完全透明：
          </Text>
          <Bullet text="宝宝来电使用 AI 技术，所有通话由 AI 完成，不是真人。" />
          <Bullet text="AI 伴侣会在通话开始时主动告知自己是 AI。" />
          <Bullet text="我们不提供医疗建议、心理治疗或诊断。" />
          <Bullet text="AI 可能理解失误或说出不合适的内容，请以自己的判断为准。" />
          <Bullet text="高风险内容会触发安全流程，引导你联系专业人士。" />
          <Bullet text="通话记录加密存储，不会共享给第三方。" />
        </View>

        {/* When to seek professional help */}
        <SectionLabel label="何时寻求专业帮助" />
        <View style={styles.card}>
          <Text style={styles.disclosureIntro}>
            请在以下情况寻求专业心理咨询师或医生：
          </Text>
          <Bullet text="情绪低落持续超过两周，影响日常生活。" />
          <Bullet text="有伤害自己或他人的想法或行为。" />
          <Bullet text="睡眠、饮食或工作出现严重问题。" />
          <Bullet text="感到极度焦虑、恐慌或无法控制的情绪。" />
          <Bullet text="AI 陪伴无法缓解你的痛苦。" />
        </View>

        {/* Back to home */}
        <Button
          label="返回首页"
          onPress={() => router.replace('/(app)/home')}
          variant="secondary"
          style={{ marginTop: SPACING.md }}
        />

        <Text style={styles.footer}>
          宝宝来电不是医疗机构，无法替代专业心理健康服务。
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backBtn: { padding: SPACING.sm, minWidth: 60 },
  backText: { fontSize: FONT_SIZES.sm, color: COLORS.primary, fontWeight: '600' },
  headerTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  scroll: {
    flexGrow: 1,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },

  emergencyCard: {
    backgroundColor: '#FFF5F5',
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFD0D0',
  },
  emergencyEmoji: { fontSize: 40, marginBottom: SPACING.sm },
  emergencyTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '800',
    color: COLORS.danger,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  emergencyBody: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  dialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.danger,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    width: '100%',
    justifyContent: 'center',
  },
  dialBtnIcon: { fontSize: 20 },
  dialBtnLabel: {
    color: '#fff',
    fontWeight: '700',
    fontSize: FONT_SIZES.md,
  },
  dialBtnNumber: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: FONT_SIZES.sm,
  },

  sectionLabel: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
  },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.xs,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
  },

  resourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  resourceIcon: { fontSize: 22, width: 32, textAlign: 'center' },
  resourceInfo: { flex: 1 },
  resourceTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  resourceSubtitle: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  resourceChevron: { fontSize: FONT_SIZES.sm, color: COLORS.primary },

  divider: { height: 1, backgroundColor: '#F0F0F0', marginHorizontal: SPACING.md },

  disclosureIntro: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  bullet: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  bulletDot: {
    fontSize: FONT_SIZES.md,
    color: COLORS.primary,
    lineHeight: 22,
    marginTop: 1,
  },
  bulletText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textPrimary,
    lineHeight: 22,
  },

  footer: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textLight,
    textAlign: 'center',
    marginTop: SPACING.lg,
    lineHeight: 18,
  },
});
