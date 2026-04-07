/**
 * History screen — list of all past call sessions with tap-to-recap.
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { callApi, SessionOut } from '@/lib/api';
import { COLORS, FONT_SIZES, RADIUS, SPACING } from '@/lib/constants';

const STATUS_LABEL: Record<string, string> = {
  pending: '待接通',
  active: '通话中',
  completed: '已完成',
  failed: '未接通',
};

const STATUS_COLOR: Record<string, string> = {
  pending: COLORS.warning,
  active: COLORS.success,
  completed: COLORS.textSecondary,
  failed: COLORS.danger,
};

function SessionItem({ session }: { session: SessionOut }) {
  const canViewRecap = session.status === 'completed';

  return (
    <TouchableOpacity
      style={styles.item}
      activeOpacity={canViewRecap ? 0.7 : 1}
      onPress={() => canViewRecap && router.push(`/recap/${session.id}`)}
    >
      <Text style={styles.itemIcon}>
        {session.trigger_type === 'emergency' ? '🆘' : '🌙'}
      </Text>
      <View style={styles.itemInfo}>
        <Text style={styles.itemType}>
          {session.trigger_type === 'emergency' ? '情绪急救' : '睡前陪伴'}
        </Text>
        <Text style={styles.itemDate}>
          {session.started_at
            ? new Date(session.started_at).toLocaleString('zh-CN', {
                month: 'numeric',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : '—'}
        </Text>
      </View>
      <View style={styles.itemRight}>
        <Text
          style={[styles.itemStatus, { color: STATUS_COLOR[session.status] }]}
        >
          {STATUS_LABEL[session.status]}
        </Text>
        {session.duration_secs ? (
          <Text style={styles.itemDuration}>
            {Math.floor(session.duration_secs / 60)}分{session.duration_secs % 60}秒
          </Text>
        ) : null}
        {canViewRecap && <Text style={styles.recapHint}>查看小结 →</Text>}
      </View>
    </TouchableOpacity>
  );
}

export default function HistoryScreen() {
  const [sessions, setSessions] = useState<SessionOut[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      callApi.sessions(0, 50)
        .then((res) => setSessions(res.data))
        .finally(() => setLoading(false));
    }, [])
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>通话记录</Text>
      </View>

      {loading ? (
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
          style={{ marginTop: SPACING.xxl }}
        />
      ) : sessions.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>📭</Text>
          <Text style={styles.emptyText}>还没有通话记录</Text>
          <Text style={styles.emptySubText}>
            回到首页，点"立刻来电"开始第一次陪伴
          </Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(s) => s.id}
          renderItem={({ item }) => <SessionItem session={item} />}
          contentContainerStyle={styles.list}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  list: { padding: SPACING.xl, gap: SPACING.sm },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    gap: SPACING.md,
  },
  itemIcon: { fontSize: 28 },
  itemInfo: { flex: 1 },
  itemType: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  itemDate: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginTop: 2 },
  itemRight: { alignItems: 'flex-end', gap: 2 },
  itemStatus: { fontSize: FONT_SIZES.xs, fontWeight: '600' },
  itemDuration: { fontSize: FONT_SIZES.xs, color: COLORS.textLight },
  recapHint: { fontSize: FONT_SIZES.xs, color: COLORS.primary, marginTop: 2 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm },
  emptyEmoji: { fontSize: 56 },
  emptyText: { fontSize: FONT_SIZES.lg, fontWeight: '600', color: COLORS.textSecondary },
  emptySubText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textLight,
    textAlign: 'center',
    paddingHorizontal: SPACING.xl,
  },
});
