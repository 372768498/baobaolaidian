/**
 * Live call screen — WebSocket-connected real-time conversation.
 *
 * Architecture:
 *  1. useWebSocket() manages the WS connection and message state
 *  2. Press-and-hold voice recording sends audio_chunk/end_of_speech frames
 *  3. Text input remains as a fallback when microphone is unavailable
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
import { Audio } from 'expo-av';
import { AndroidAudioEncoder, AndroidOutputFormat, IOSAudioQuality, IOSOutputFormat } from 'expo-av/build/Audio';
import { Buffer } from 'buffer';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useTtsPlayback } from '@/hooks/useTtsPlayback';
import { CallWaveform } from '@/components/CallWaveform';
import { Button } from '@/components/ui/Button';
import { COLORS, FONT_SIZES, RADIUS, SPACING, SAFETY_HOTLINE } from '@/lib/constants';

export default function CallScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const {
    isPlaying,
    playbackMetrics,
    enqueueChunk,
    stopPlayback,
    markTurnComplete,
  } = useTtsPlayback();
  const {
    status,
    phase,
    phaseLabel,
    messages,
    currentAiText,
    riskAlert,
    ttsChunkCount,
    sendSttResult,
    sendAudioMessage,
    hangUp,
  } = useWebSocket(sessionId, {
    onTtsChunk: enqueueChunk,
    onTtsTurnDone: markTurnComplete,
    onPlaybackStop: stopPlayback,
  });

  const [inputText, setInputText] = useState('');
  const [showRiskModal, setShowRiskModal] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingBusy, setRecordingBusy] = useState(false);
  const [micReady, setMicReady] = useState<boolean | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);

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

  useEffect(() => {
    void prepareAudio();
    return () => {
      void stopPlayback('screen_unmount');
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, [stopPlayback]);

  const handleSend = () => {
    const text = inputText.trim();
    if (!text) return;
    sendSttResult(text);
    setInputText('');
  };

  const handleHangUp = async () => {
    await stopPlayback('manual_hangup');
    hangUp();
  };

  const prepareAudio = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setMicReady(false);
        setVoiceError('麦克风权限未开启，当前先使用文字模式。');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      setMicReady(true);
      setVoiceError(null);
    } catch {
      setMicReady(false);
      setVoiceError('语音模式初始化失败，请先使用文字模式。');
    }
  };

  const startRecording = async () => {
    if (recordingBusy || isRecording) return;
    setRecordingBusy(true);
    try {
      await stopPlayback('user_barge_in');
      if (micReady !== true) {
        await prepareAudio();
      }
      const permission = await Audio.getPermissionsAsync();
      if (!permission.granted) {
        setVoiceError('没有麦克风权限，无法发送语音。');
        return;
      }

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync({
        android: {
          extension: '.aac',
          outputFormat: AndroidOutputFormat.AAC_ADTS,
          audioEncoder: AndroidAudioEncoder.AAC,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 32000,
        },
        ios: {
          extension: '.wav',
          outputFormat: IOSOutputFormat.LINEARPCM,
          audioQuality: IOSAudioQuality.MEDIUM,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 256000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 32000,
        },
      });
      await recording.startAsync();
      recordingRef.current = recording;
      setIsRecording(true);
      setVoiceError(null);
    } catch {
      setVoiceError('开始录音失败，请稍后再试。');
    } finally {
      setRecordingBusy(false);
    }
  };

  const stopRecording = async () => {
    const recording = recordingRef.current;
    if (!recording || !isRecording) return;
    setRecordingBusy(true);
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      recordingRef.current = null;
      setIsRecording(false);

      if (!uri) {
        setVoiceError('录音文件为空，请重试。');
        return;
      }

      const response = await fetch(uri);
      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer.byteLength === 0) {
        setVoiceError('这段语音没有录到内容，请再试一次。');
        return;
      }

      const base64Audio = Buffer.from(arrayBuffer).toString('base64');
      sendAudioMessage({
        base64Audio,
        audioFormat: Platform.OS === 'ios' ? 'wav' : Platform.OS === 'android' ? 'aac' : 'webm',
        sampleRate: 16000,
        bitsPerSample: 16,
        channels: 1,
      });
    } catch {
      setVoiceError('发送语音失败，请再试一次。');
    } finally {
      setRecordingBusy(false);
    }
  };

  const isAiSpeaking = isPlaying || currentAiText.length > 0;

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
              onPress={() => void handleHangUp()}
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
            <Text style={styles.aiDisclosure}>你正在与 AI 互动</Text>
            <Text style={styles.audioMetaText}>
              {`已收语音片段 ${ttsChunkCount} · 首包播放 ${playbackMetrics.ttsFirstChunkPlayMs ?? '-'}ms`}
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
            <TouchableOpacity
              onPressIn={startRecording}
              onPressOut={stopRecording}
              style={[
                styles.voiceBtn,
                isRecording && styles.voiceBtnActive,
                (recordingBusy || micReady === false) && styles.voiceBtnDisabled,
              ]}
              disabled={recordingBusy || micReady === false}
              activeOpacity={0.85}
            >
              <Text style={styles.voiceBtnEmoji}>{isRecording ? '🎙️' : '🎤'}</Text>
              <Text style={styles.voiceBtnText}>
                {isRecording ? '松开发送' : '按住说话'}
              </Text>
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              placeholder="文字补充也可以发给我"
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
          <View style={styles.voiceHelpRow}>
            <Text style={styles.voiceHelpText}>
              语音是当前主入口，文字模式仅作兜底。
            </Text>
            {voiceError ? <Text style={styles.voiceErrorText}>{voiceError}</Text> : null}
            {playbackMetrics.playbackError ? (
              <Text style={styles.voiceErrorText}>{`播放异常：${playbackMetrics.playbackError}`}</Text>
            ) : null}
            <Text style={styles.voiceHelpText}>
              {`播放总耗时 ${playbackMetrics.playbackTotalDurationMs ?? '-'}ms · interrupt ${playbackMetrics.interruptCount}`}
            </Text>
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
              {riskAlert ?? (
                '我注意到你说的一些话让我很担心你。\n\n如果你现在感到很痛苦，或者有伤害自己的想法，请拨打专业热线获得帮助。'
              )}
            </Text>
            <Button
              label={`拨打 ${SAFETY_HOTLINE}`}
              onPress={() => Linking.openURL(`tel:${SAFETY_HOTLINE}`)}
              style={{ marginBottom: SPACING.sm }}
            />
            <Button
              label="回到首页"
              onPress={() => router.replace('/(app)/home')}
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
  aiDisclosure: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: FONT_SIZES.xs,
    marginTop: SPACING.xs,
  },
  audioMetaText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: FONT_SIZES.xs,
    marginTop: SPACING.xs,
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
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.05)',
    gap: SPACING.sm,
  },
  voiceBtn: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 88,
  },
  voiceBtnActive: {
    backgroundColor: COLORS.primary,
  },
  voiceBtnDisabled: {
    opacity: 0.45,
  },
  voiceBtnEmoji: {
    fontSize: 18,
    marginBottom: 2,
  },
  voiceBtnText: {
    color: '#fff',
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
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
  voiceHelpRow: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
  },
  voiceHelpText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: FONT_SIZES.xs,
  },
  voiceErrorText: {
    color: '#FFB4A7',
    fontSize: FONT_SIZES.xs,
    marginTop: 4,
  },

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
