/**
 * Post-call recap screen — shown after every call ends.
 *
 * Navigated to automatically via router.replace() when the WS
 * disconnects in the live call screen.
 *
 * Displays:
 *  1. A warm summary of the conversation (AI-generated)
 *  2. A micro-action — one small thing the user can do right now
 *  3. A follow-up point — something to reflect on or revisit
 *  4. Memory items stored from this call (so user knows AI remembers)
 *
 * UX: No back button — this is the natural end of the flow.
 * User can go home or view history from here.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { callApi, memoryApi, RecapOut, SessionOut, MemoryItemOut } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { COLORS, FONT_SIZES, RADIUS, SPACING } from '@/lib/constants';

/** One section card — icon + title + body */
function RecapCard({
  icon,
  title,
  body,
  accent,
}: {
  icon: string;
  title: string;
  body: string;
  accent?: string;
}) {
  return (
    <View style={[styles.card, accent ? { borderLeftColor: accent, borderLeftWidth: 3 } : null]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardIcon}>{icon}</Text>
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      <Text style={styles.cardBody}>{body}</Text>
    </View>
  );
}

/** Small pill showing a single memory item */
function MemoryPill({ item }: { item: MemoryItemOut }) {
  return (
    <View style={styles.memoryPill}>
      <Text style={styles.memoryKey}>{item.category}</Text>
      <Text style={styles.memoryValue}>{item.content}</Text>
    </View>
  );
}

export default function RecapScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();

  const [recap, setRecap] = useState<RecapOut | null>(null);
  const [session, setSession] = useState<SessionOut | null>(null);
  const [memories, setMemories] = useState<MemoryItemOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [waitingForRecap, setWaitingForRecap] = useState(false);
  const cancelledRef = useRef(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    cancelledRef.current = false;
    void loadRecap(0);
    return () => {
      cancelledRef.current = true;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [sessionId]);

  const loadRecap = async (attempt = 0) => {
    let keepLoading = false;
    try {
      setLoading(true);
      setError(null);
      // Fetch recap and recent memories in parallel
      const [sessionRes, memRes] = await Promise.all([
        callApi.session(sessionId),
        memoryApi.list(),
      ]);
      setSession(sessionRes.data);
      setMemories(memRes.data);

      try {
        const recapRes = await callApi.recap(sessionId);
        if (cancelledRef.current) return;
        setRecap(recapRes.data);
        setWaitingForRecap(false);
        setRetryCount(attempt);
      } catch (err: any) {
        if (cancelledRef.current) return;
        if (err.response?.status === 404 && attempt < 6) {
          keepLoading = true;
          setWaitingForRecap(true);
          setRetryCount(attempt + 1);
          retryTimerRef.current = setTimeout(() => {
            void loadRecap(attempt + 1);
          }, 2500);
          return;
        }
        setError('无法加载通话小结，请稍后再试');
      }
    } catch {
      if (!cancelledRef.current) setError('无法加载通话小结，请稍后再试');
    } finally {
      if (!cancelledRef.current && !keepLoading) setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>
            {waitingForRecap ? '正在生成通话小结...' : '正在整理我们的对话...'}
          </Text>
          {waitingForRecap ? (
            <Text style={styles.waitingHint}>
              AI 正在回顾这通电话，通常几秒内就会完成。
              {retryCount > 0 ? ` 已尝试 ${retryCount} 次。` : ''}
            </Text>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  if (error || !recap) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Text style={styles.errorEmoji}>😔</Text>
          <Text style={styles.errorText}>{error ?? '暂无小结'}</Text>
          <Button
            label="返回首页"
            onPress={() => router.replace('/(app)/home')}
            style={{ marginTop: SPACING.lg }}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero — call ended badge */}
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>🌙</Text>
          <Text style={styles.heroTitle}>通话结束了</Text>
          <Text style={styles.heroSub}>谢谢你今晚愿意说说话</Text>
          <Text style={styles.heroAiNote}>本次通话由 AI 陪伴完成</Text>
        </View>

        {/* Summary */}
        <RecapCard
          icon="💬"
          title="我们聊了什么"
          body={recap.summary_text ?? '这次通话没有生成小结。'}
        />

        {/* Micro action — most actionable, highlighted */}
        {recap.micro_action ? (
          <RecapCard
            icon="✨"
            title="现在可以试试"
            body={recap.micro_action}
            accent={COLORS.primary}
          />
        ) : null}

        {/* Follow-up point */}
        {recap.followup_point ? (
          <RecapCard
            icon="🌱"
            title="留着慢慢想"
            body={recap.followup_point}
          />
        ) : null}

        {/* Memory items — shows the user AI has noted things */}
        {memories.length > 0 ? (
          <View style={styles.memorySection}>
            <Text style={styles.memoryTitle}>我记住了关于你的</Text>
            <View style={styles.memoryList}>
              {memories.map((m) => (
                <MemoryPill key={m.id} item={m} />
              ))}
            </View>
          </View>
        ) : null}

        {/* Duration info — comes from session, not recap */}
        {session?.duration_secs ? (
          <Text style={styles.durationText}>
            通话时长 {Math.floor(session.duration_secs / 60)} 分 {session.duration_secs % 60} 秒
          </Text>
        ) : null}

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            label="回到首页"
            onPress={() => router.replace('/(app)/home')}
          />
          <Button
            label="查看历史"
            onPress={() => router.replace('/(app)/history')}
            variant="secondary"
            style={{ marginTop: SPACING.sm }}
          />
        </View>

        {/* Safety reminder — always present but low-key */}
        <TouchableOpacity
          onPress={() => router.push('/safety')}
          style={styles.safetyLink}
        >
          <Text style={styles.safetyText}>
            如果你仍然感到很难受，点这里获取专业支持 →
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

  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.xl,
  },
  loadingText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
  },
  waitingHint: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textLight,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorEmoji: { fontSize: 48 },
  errorText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },

  hero: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    marginBottom: SPACING.md,
  },
  heroEmoji: { fontSize: 56, marginBottom: SPACING.sm },
  heroTitle: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  heroSub: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  heroAiNote: {
    marginTop: SPACING.xs,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textLight,
  },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  cardIcon: { fontSize: 20 },
  cardTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardBody: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textPrimary,
    lineHeight: 24,
  },

  memorySection: {
    marginBottom: SPACING.md,
  },
  memoryTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  memoryList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  memoryPill: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  memoryKey: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    fontWeight: '600',
  },
  memoryValue: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },

  durationText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textLight,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },

  actions: { marginBottom: SPACING.md },

  safetyLink: { alignItems: 'center', marginTop: SPACING.md },
  safetyText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
});
