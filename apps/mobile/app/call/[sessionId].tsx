/**
 * Live call screen — WebSocket-connected real-time conversation.
 *
 * Architecture:
 *  1. useWebSocket() manages the WS connection and message state
 *  2. In MVP, STT is simulated via a text input (full STT wired in Week 2)
 *  3. CallWaveform pulses when AI is speaking (currentAiText streaming in)
 *  4. Risk alerts surface a safety modal that can't be dismissed without action
 *  5. On hang-up / disconnect → navigate to PostCallRecap
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWebSocket } from '@/hooks/useWebSocket';
import { CallWaveform } from '@/components/CallWaveform';
import { Button } from '@/components/ui/Button';
import { COLORS, FONT_SIZES, RADIUS, SPACING, SAFETY_HOTLINE } from '@/lib/constants';

export default function CallScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const {
    status,
    phase,
    phaseLabel,
    messages,
    currentAiText,
    riskAlert,
    sendSttResult,
    hangUp,
  } = useWebSocket(sessionId);

  // Text input for MVP STT simulation
  const [inputText, setInputText] = useState('');
  const [showRiskModal, setShowRiskModal] = useState(false);

  const scrollRef = useRef<ScrollView>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, currentAiText]);

  // Show risk modal when server sends a risk alert
  useEffect(() => {
    if (riskAlert) setShowRiskModal(true);
  }, [riskAlert]);

  // Navigate to recap when call ends
  useEffect(() => {
    if (status === 'disconnected') {
      router.replace(`/recap/${sessionId}`);
    }
  }, [status]);

  const handleSend = () => {
    const text = inputText.trim();
    if (!text) return;
    sendSttResult(text);
    setInputText('');
  };

  const isAiSpeaking = currentAiText.length > 0;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.container}>
          {/* Header — phase indicator + hang-up */}
          <View style={styles.header}>
            <View style={styles.phaseBadge}>
              <Text style={styles.phaseText}>{phaseLabel}</Text>
            </View>
            <TouchableOpacity
              onPress={hangUp}
              style={styles.hangUpBtn}
              activeOpacity={0.8}
            >
              <Text style={styles.hangUpEmoji}>📵</Text>
            </TouchableOpacity>
          </View>

          {/* Waveform — visual feedback AI is speaking */}
          <View style={styles.waveSection}>
            <CallWaveform active={isAiSpeaking} />
            <Text style={styles.statusText}>
              {status === 'connecting' ? '连接中...' : isAiSpeaking ? '对方说话中' : '在听...'}
            </Text>
          </View>

          {/* Message transcript */}
          <ScrollView
            ref={scrollRef}
            style={styles.transcript}
            contentContainerStyle={styles.transcriptContent}
          >
            {messages.map((msg, i) => (
              <View
                key={i}
                style={[
                  styles.bubble,
                  msg.role === 'ai' ? styles.aiBubble : styles.userBubble,
                ]}
              >
                <Text
                  style={[
                    styles.bubbleText,
                    msg.role === 'user' && styles.userBubbleText,
                  ]}
                >
                  {msg.text}
                </Text>
              </View>
            ))}

            {/* Streaming AI text — shown while still receiving */}
            {currentAiText ? (
              <View style={[styles.bubble, styles.aiBubble]}>
                <Text style={styles.bubbleText}>{currentAiText}▋</Text>
              </View>
            ) : null}
          </ScrollView>

          {/* Input bar (MVP: text → STT placeholder) */}
          <View style={styles.inputBar}>
            <TextInput
              style={styles.input}
              placeholder="说点什么... (MVP 文字模式)"
              placeholderTextColor={COLORS.textLight}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={300}
              returnKeyType="send"
              onSubmitEditing={handleSend}
            />
            <TouchableOpacity
              onPress={handleSend}
              style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
              disabled={!inputText.trim()}
              activeOpacity={0.8}
            >
              <Text style={styles.sendBtnText}>发送</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Risk alert modal — can't be dismissed without acknowledging */}
      <Modal
        visible={showRiskModal}
        transparent
        animationType="slide"
        onRequestClose={() => {}}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalEmoji}>🆘</Text>
            <Text style={styles.modalTitle}>我需要先停下来</Text>
            <Text style={styles.modalBody}>
              我注意到你说的一些话让我很担心你。{'\n\n'}
              如果你现在感到很痛苦，或者有伤害自己的想法，请拨打专业热线获得帮助。
              他们 24 小时都有人接听。
            </Text>
            <Button
              label={`拨打 ${SAFETY_HOTLINE}`}
              onPress={() => Linking.openURL(`tel:${SAFETY_HOTLINE}`)}
              style={{ marginBottom: SPACING.sm }}
            />
            <Button
              label="我现在没事，继续通话"
              onPress={() => setShowRiskModal(false)}
              variant="secondary"
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1A1A2E' },
  container: { flex: 1 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
  },
  phaseBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  phaseText: { color: 'rgba(255,255,255,0.7)', fontSize: FONT_SIZES.sm },
  hangUpBtn: { padding: SPACING.sm },
  hangUpEmoji: { fontSize: 28 },

  waveSection: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  statusText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: FONT_SIZES.sm,
    marginTop: SPACING.sm,
  },

  transcript: { flex: 1 },
  transcriptContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.md,
    gap: SPACING.sm,
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  aiBubble: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignSelf: 'flex-start',
  },
  userBubble: {
    backgroundColor: COLORS.primary,
    alignSelf: 'flex-end',
  },
  bubbleText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: FONT_SIZES.md,
    lineHeight: 22,
  },
  userBubbleText: { color: '#fff' },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.05)',
    gap: SPACING.sm,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    color: '#fff',
    fontSize: FONT_SIZES.md,
    maxHeight: 100,
  },
  sendBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    minWidth: 60,
    alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: '#fff', fontWeight: '700', fontSize: FONT_SIZES.sm },

  // Risk alert modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    padding: SPACING.xl,
    paddingBottom: SPACING.xxl,
  },
  modalEmoji: { fontSize: 48, textAlign: 'center', marginBottom: SPACING.md },
  modalTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  modalBody: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
});
