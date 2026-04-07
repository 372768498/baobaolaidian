/**
 * Login screen — phone + password auth.
 * Links to register for new users.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import { COLORS, FONT_SIZES, RADIUS, SPACING } from '@/lib/constants';

export default function LoginScreen() {
  const { login, isLoading, error, clearError } = useAuthStore();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    clearError();
    if (!phone.trim() || !password.trim()) {
      Alert.alert('提示', '请填写手机号和密码');
      return;
    }
    try {
      await login(phone.trim(), password);
      // Root layout useEffect will handle redirect based on user.onboarding_done
    } catch {
      // Error already set in store
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <Text style={styles.emoji}>🌙</Text>
          <Text style={styles.title}>宝宝来电</Text>
          <Text style={styles.subtitle}>你的 AI 陪伴，随时在线</Text>

          {/* Form */}
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="手机号"
              placeholderTextColor={COLORS.textLight}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              autoComplete="tel"
            />
            <TextInput
              style={styles.input}
              placeholder="密码"
              placeholderTextColor={COLORS.textLight}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            {error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : null}

            <Button
              label="登录"
              onPress={handleLogin}
              loading={isLoading}
              style={styles.submitBtn}
            />
          </View>

          {/* Register link */}
          <TouchableOpacity
            onPress={() => router.push('/(auth)/register')}
            style={styles.link}
          >
            <Text style={styles.linkText}>
              还没有账号？<Text style={styles.linkHighlight}>立即注册</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  container: {
    flexGrow: 1,
    paddingHorizontal: SPACING.xl,
    justifyContent: 'center',
    paddingBottom: SPACING.xxl,
  },
  emoji: { fontSize: 64, textAlign: 'center', marginBottom: SPACING.sm },
  title: {
    fontSize: FONT_SIZES.display,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.xxl,
  },
  form: { gap: SPACING.md },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: '#EBEBEB',
  },
  errorText: {
    color: COLORS.danger,
    fontSize: FONT_SIZES.sm,
    textAlign: 'center',
  },
  submitBtn: { marginTop: SPACING.sm },
  link: { marginTop: SPACING.xl, alignItems: 'center' },
  linkText: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  linkHighlight: { color: COLORS.primary, fontWeight: '600' },
});
