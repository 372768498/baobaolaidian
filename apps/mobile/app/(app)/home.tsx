/**
 * Home screen — greeting + emergency call trigger.
 *
 * Key UX decisions:
 * - Large "立刻来电" button is the primary CTA — one tap to start a call
 * - Greeting adapts to time of day (morning/afternoon/evening/night)
 * - Shows upcoming scheduled call window so user feels anticipated
 * - Safety help link is always visible but unobtrusive
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '@/store/authStore';
import { callApi, SessionOut } from '@/lib/api';
import { COLORS, FONT_SIZES, RADIUS, SPACING } from '@/lib/constants';

function timeGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return '早上好';
  if (h >= 12 && h < 18) return '下午好';
  if (h >= 18 && h < 22) return '晚上好';
  return '夜深了';
}

function timeEmoji(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return '☀️';
  if (h >= 12 && h < 18) return '🌤️';
  if (h >= 18 && h < 22) return '🌆';
  return '🌙';
}

function formatCallWindow(start?: string | null, end?: string | null): string | null {
  if (!start || !end) return null;
  return `${start} - ${end}`;
}

export default function HomeScreen() {
  const { user, refreshUser } = useAuthStore();
  const [recentSessions, setRecentSessions] = useState<SessionOut[]>([]);
  const [loading, setLoading] = useState(false);
  const [calling, setCalling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const navigatingToIncoming = useRef<string | null>(null);

  const loadData = async () => {
    try {
      const res = await callApi.sessions(0, 3);
      setRecentSessions(res.data);
    } catch {
      // Silently fail — not critical
    }
  };

  // Refresh data each time screen comes into focus
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadData().finally(() => setLoading(false));
    }, [])
  );

  useEffect(() => {
    if (!user?.onboarding_done) return;

    let cancelled = false;
    const poll = async () => {
      try {
        const res = await callApi.incoming();
        const session = res.data;
        if (
          !cancelled &&
          session &&
          session.status === 'pending' &&
          navigatingToIncoming.current !== session.id
        ) {
          navigatingToIncoming.current = session.id;
          router.push({
            pathname: '/call/incoming',
            params: { sessionId: session.id, triggerType: session.trigger_type },
          });
        }
      } catch {
        // Polling failure is non-blocking.
      }
    };

    poll();
    const timer = setInterval(poll, 8000);
    return () => {
      cancelled = true;
      clearInterval(timer);
      navigatingToIncoming.current = null;
    };
  }, [user?.onboarding_done]);

  const handleEmergencyCall = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCalling(true);
    try {
      const res = await callApi.triggerEmergency();
      const session = res.data;
      // Navigate to the incoming call screen first for a natural "ringing" experience
      router.push({
        pathname: '/call/incoming',
        params: { sessionId: session.id, triggerType: session.trigger_type },
      });
    } catch (err: any) {
      const msg = err.response?.data?.detail ?? '无法发起通话，请稍后再试';
      Alert.alert('提示', msg);
    } finally {
      setCalling(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadData(), refreshUser()]);
    setRefreshing(false);
  };

  const greeting = timeGreeting();
  const emoji = timeEmoji();
  const callWindow = formatCallWindow(user?.call_time_start, user?.call_time_end);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
      >
        {/* Header greeting */}
        <View style={styles.header}>
          <Text style={styles.greetingEmoji}>{emoji}</Text>
          <Text style={styles.greeting}>
            {greeting}，{user?.nickname ?? '宝宝'}
          </Text>
          <Text style={styles.tagline}>今晚有我陪你</Text>
        </View>

        {/* Emergency call button — big, warm, inviting */}
        <TouchableOpacity
          onPress={handleEmergencyCall}
          disabled={calling}
          activeOpacity={0.85}
          style={styles.callBtnWrapper}
        >
          <LinearGradient
            colors={[COLORS.primaryLight, COLORS.primary]}
            style={styles.callBtn}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.callBtnEmoji}>📞</Text>
            <Text style={styles.callBtnLabel}>
              {calling ? '接通中...' : '立刻来电'}
            </Text>
            <Text style={styles.callBtnSub}>情绪急救 · 即刻接通</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Scheduled call info */}
        {user?.preferred_persona_id && (
          <View style={styles.scheduledCard}>
            <Text style={styles.scheduledTitle}>🌙 睡前来电</Text>
            <Text style={styles.scheduledBody}>
              {callWindow ? `今晚我会在 ${callWindow} 主动打来，\n` : '今晚我会在你设定的时间段里主动打来，\n'}
              不用等我，安心做你的事就好。
            </Text>
            <Text style={styles.scheduledHint}>
              App 打开时会自动等这通来电。通话全程明确为 AI 互动。
            </Text>
          </View>
        )}

        {/* Recent sessions */}
        {recentSessions.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>最近通话</Text>
              <TouchableOpacity onPress={() => router.push('/(app)/history')}>
                <Text style={styles.sectionMore}>全部 →</Text>
              </TouchableOpacity>
            </View>
            {recentSessions.slice(0, 3).map((s) => (
              <TouchableOpacity
                key={s.id}
                style={styles.sessionRow}
                onPress={() => router.push(`/recap/${s.id}`)}
                activeOpacity={0.7}
              >
                <Text style={styles.sessionIcon}>
                  {s.trigger_type === 'emergency' ? '🆘' : '🌙'}
                </Text>
                <View style={styles.sessionInfo}>
                  <Text style={styles.sessionType}>
                    {s.trigger_type === 'emergency' ? '情绪急救' : '睡前陪伴'}
                  </Text>
                  <Text style={styles.sessionDate}>
                    {s.started_at
                      ? new Date(s.started_at).toLocaleDateString('zh-CN')
                      : '未开始'}
                  </Text>
                </View>
                <Text style={styles.sessionDuration}>
                  {s.duration_secs ? `${Math.floor(s.duration_secs / 60)}分钟` : '—'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Safety link — always visible but small */}
        <TouchableOpacity
          onPress={() => router.push('/safety')}
          style={styles.safetyLink}
        >
          <Text style={styles.safetyText}>
            如有紧急情况，点此获取专业帮助 →
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  header: { marginBottom: SPACING.xl },
  greetingEmoji: { fontSize: 40, marginBottom: SPACING.sm },
  greeting: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  tagline: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginTop: 4,
  },

  callBtnWrapper: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  callBtn: {
    paddingVertical: SPACING.xl,
    alignItems: 'center',
    borderRadius: RADIUS.lg,
  },
  callBtnEmoji: { fontSize: 48, marginBottom: SPACING.sm },
  callBtnLabel: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  callBtnSub: { fontSize: FONT_SIZES.sm, color: 'rgba(255,255,255,0.8)' },

  scheduledCard: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  scheduledTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  scheduledBody: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  scheduledHint: {
    marginTop: SPACING.sm,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textLight,
  },

  section: { marginBottom: SPACING.lg },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  sectionMore: { fontSize: FONT_SIZES.sm, color: COLORS.primary },

  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  sessionIcon: { fontSize: 24 },
  sessionInfo: { flex: 1 },
  sessionType: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  sessionDate: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary },
  sessionDuration: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },

  safetyLink: { alignItems: 'center', marginTop: SPACING.lg },
  safetyText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    textDecorationLine: 'underline',
  },
});
