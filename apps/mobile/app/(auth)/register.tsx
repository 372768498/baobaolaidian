/**
 * Register screen — collects phone, password, nickname, birth year.
 * Age is verified server-side (>= 18) and also checked client-side
 * to give immediate feedback.
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

export default function RegisterScreen() {
  const { register, isLoading, error, clearError } = useAuthStore();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [birthYear, setBirthYear] = useState('');

  const handleRegister = async () => {
    clearError();

    // Client-side validation
    if (!phone.trim() || !password || !nickname.trim() || !birthYear) {
      Alert.alert('提示', '请填写所有必填项');
      return;
    }
    const year = parseInt(birthYear, 10);
    const currentYear = new Date().getFullYear();
    if (isNaN(year) || currentYear - year < 18) {
      Alert.alert('年龄限制', '本产品仅限 18 岁及以上用户使用');
      return;
    }
    if (password.length < 8) {
      Alert.alert('密码太短', '密码至少需要 8 位');
      return;
    }

    try {
      await register({
        phone: phone.trim(),
        password,
        nickname: nickname.trim(),
        birth_year: year,
      });
    } catch {
      // Error displayed from store
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
          <TouchableOpacity onPress={() => router.back()} style={styles.back}>
            <Text style={styles.backText}>← 返回</Text>
          </TouchableOpacity>

          <Text style={styles.title}>创建账号</Text>
          <Text style={styles.subtitle}>几步就能遇见你的 AI 朋友</Text>

          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="你的昵称"
              placeholderTextColor={COLORS.textLight}
              value={nickname}
              onChangeText={setNickname}
            />
            <TextInput
              style={styles.input}
              placeholder="出生年份（如：1998）"
              placeholderTextColor={COLORS.textLight}
              keyboardType="number-pad"
              maxLength={4}
              value={birthYear}
              onChangeText={setBirthYear}
            />
            <TextInput
              style={styles.input}
              placeholder="手机号"
              placeholderTextColor={COLORS.textLight}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
            <TextInput
              style={styles.input}
              placeholder="密码（至少 8 位）"
              placeholderTextColor={COLORS.textLight}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            {error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : null}

            <Text style={styles.disclaimer}>
              注册即代表你已年满 18 岁，并同意我们的服务条款和隐私政策。
              本产品使用 AI 陪伴，不提供医疗建议。
            </Text>

            <Button
              label="注册并开始"
              onPress={handleRegister}
              loading={isLoading}
            />
          </View>
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
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xxl,
  },
  back: { marginBottom: SPACING.xl },
  backText: { color: COLORS.textSecondary, fontSize: FONT_SIZES.md },
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xl,
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
  disclaimer: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textLight,
    lineHeight: 18,
    textAlign: 'center',
  },
});
