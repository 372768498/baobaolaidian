/**
 * PersonaCard — selectable AI companion card shown during onboarding.
 * Displays avatar, name, bio, and personality tags.
 */
import React from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { PersonaOut } from '@/lib/api';
import { COLORS, FONT_SIZES, RADIUS, SPACING } from '@/lib/constants';

// Map persona names to their accent colors
const PERSONA_ACCENT: Record<string, string> = {
  '小暖': COLORS.personaGentle,
  '阿晴': COLORS.personaEnergetic,
  '静澜': COLORS.personaCalm,
};

interface Props {
  persona: PersonaOut;
  selected: boolean;
  onSelect: (id: string) => void;
}

export function PersonaCard({ persona, selected, onSelect }: Props) {
  const accentColor = PERSONA_ACCENT[persona.name] ?? COLORS.surfaceAlt;

  return (
    <TouchableOpacity
      onPress={() => onSelect(persona.id)}
      activeOpacity={0.8}
      style={[
        styles.container,
        { backgroundColor: accentColor },
        selected && styles.selectedBorder,
      ]}
    >
      {/* Selection indicator */}
      {selected && (
        <View style={styles.checkBadge}>
          <Text style={styles.checkMark}>✓</Text>
        </View>
      )}

      <Text style={styles.avatar}>{persona.avatar_emoji}</Text>
      <Text style={styles.name}>{persona.name}</Text>
      <Text style={styles.bio}>{persona.short_bio}</Text>

      {/* Personality tags */}
      <View style={styles.tags}>
        {persona.personality_tags.slice(0, 3).map((tag) => (
          <View key={tag} style={styles.tag}>
            <Text style={styles.tagText}>{tag}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.voice}>声音风格：{persona.voice_style}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    margin: SPACING.xs,
    alignItems: 'center',
    minHeight: 200,
    position: 'relative',
  },
  selectedBorder: {
    borderWidth: 2.5,
    borderColor: COLORS.primary,
  },
  checkBadge: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.pill,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  avatar: { fontSize: 48, marginBottom: SPACING.sm },
  name: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  bio: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 4,
    marginBottom: SPACING.sm,
  },
  tag: {
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  tagText: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary },
  voice: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
});
