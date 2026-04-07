import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { COLORS, FONT_SIZES, RADIUS, SPACING } from '@/lib/constants';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  textStyle,
  fullWidth = true,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.75}
      style={[
        styles.base,
        styles[variant],
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#fff' : COLORS.primary} />
      ) : (
        <Text style={[styles.label, styles[`${variant}Text`], textStyle]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  fullWidth: { width: '100%' },
  primary: { backgroundColor: COLORS.primary },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  ghost: { backgroundColor: 'transparent' },
  danger: { backgroundColor: COLORS.danger },
  disabled: { opacity: 0.45 },

  label: { fontSize: FONT_SIZES.md, fontWeight: '600' },
  primaryText: { color: '#fff' },
  secondaryText: { color: COLORS.primary },
  ghostText: { color: COLORS.textSecondary },
  dangerText: { color: '#fff' },
});
