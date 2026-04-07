/**
 * Onboarding Step 3 — Choose AI companion persona.
 * Loads the 3 personas from the backend and shows PersonaCard for each.
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/authStore';
import { userApi, PersonaOut } from '@/lib/api';
import { PersonaCard } from '@/components/PersonaCard';
import { Button } from '@/components/ui/Button';
import { COLORS, FONT_SIZES, SPACING } from '@/lib/constants';

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

export default function Step3() {
  const { user, refreshUser } = useAuthStore();
  const [personas, setPersonas] = useState<PersonaOut[]>([]);
  const [selectedId, setSelectedId] = useState<string>(
    user?.preferred_persona_id ?? ''
  );
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    userApi.personas().then((res) => {
      setPersonas(res.data);
      // Pre-select first persona if nothing selected yet
      if (!selectedId && res.data.length > 0) {
        setSelectedId(res.data[0].id);
      }
    }).finally(() => setFetching(false));
  }, []);

  const handleNext = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      await userApi.updateOnboarding({ preferred_persona_id: selectedId });
      await refreshUser();
      router.push('/(onboarding)/step4');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <ProgressDots current={2} total={5} />

        <Text style={styles.title}>选择你的 AI 朋友</Text>
        <Text style={styles.subtitle}>
          它会陪你通话，风格不同但都是真诚的
        </Text>

        {fetching ? (
          <ActivityIndicator
            size="large"
            color={COLORS.primary}
            style={{ marginTop: SPACING.xxl }}
          />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.cardRow}
          >
            {personas.map((p) => (
              <View key={p.id} style={styles.cardWrapper}>
                <PersonaCard
                  persona={p}
                  selected={selectedId === p.id}
                  onSelect={setSelectedId}
                />
              </View>
            ))}
          </ScrollView>
        )}

        <Button
          label="就选它了 →"
          onPress={handleNext}
          loading={saving}
          disabled={!selectedId}
          style={styles.btn}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  container: {
    flex: 1,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xl,
    paddingHorizontal: SPACING.xl,
  },
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
  cardRow: { paddingBottom: SPACING.md, gap: SPACING.sm },
  cardWrapper: { width: 200 },
  btn: { marginTop: SPACING.md },
});
