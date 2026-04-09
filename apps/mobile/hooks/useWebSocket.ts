/**
 * WebSocket hook for the in-call screen.
 *
 * Manages the connection lifecycle and decodes the server message protocol:
 *
 *   Server → Client frames (JSON):
 *     { type: "text_delta",  delta: string }         — streaming LLM text
 *     { type: "text_done",   full_text: string }     — complete utterance
 *     { type: "phase_change", phase: string }        — conversation phase update
 *     { type: "risk_alert",  script: string }        — safety escalation
 *     { type: "call_ended"  }                        — server hung up
 *     { type: "error",       message: string }
 *
 *   Client → Server frames (JSON):
 *     { type: "stt_result", text: string }           — user speech text
 *     { type: "hang_up" }                            — user hung up
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { buildWsUrl } from '@/lib/api';
import { CALL_PHASE_LABELS } from '@/lib/constants';

export type WsStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface CallMessage {
  role: 'ai' | 'user';
  text: string;
  timestamp: number;
}

interface UseWebSocketResult {
  status: WsStatus;
  phase: string;
  phaseLabel: string;
  messages: CallMessage[];
  currentAiText: string;       // streaming text, resets when text_done arrives
  riskAlert: string | null;
  ttsChunkCount: number;
  sendSttResult: (text: string) => void;
  sendAudioMessage: (payload: {
    base64Audio: string;
    audioFormat: string;
    sampleRate: number;
    bitsPerSample: number;
    channels: number;
    language?: string;
  }) => void;
  hangUp: () => void;
}

interface UseWebSocketOptions {
  onTtsChunk?: (base64Audio: string) => void;
  onTtsTurnDone?: () => void;
  onPlaybackStop?: (reason?: string) => void;
}

export function useWebSocket(sessionId: string, options?: UseWebSocketOptions): UseWebSocketResult {
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<WsStatus>('connecting');
  const [phase, setPhase] = useState('OPENING');
  const [messages, setMessages] = useState<CallMessage[]>([]);
  const [currentAiText, setCurrentAiText] = useState('');
  const [riskAlert, setRiskAlert] = useState<string | null>(null);
  const [ttsChunkCount, setTtsChunkCount] = useState(0);

  const phaseLabel = CALL_PHASE_LABELS[phase] ?? phase;

  useEffect(() => {
    let ws: WebSocket;
    let unmounted = false;

    const connect = async () => {
      const url = await buildWsUrl(sessionId);
      ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!unmounted) setStatus('connected');
      };

      ws.onmessage = (event) => {
        if (unmounted) return;
        try {
          const frame = JSON.parse(event.data as string);
          handleFrame(frame);
        } catch {
          // Ignore malformed frames
        }
      };

      ws.onerror = () => {
        if (!unmounted) setStatus('error');
      };

      ws.onclose = () => {
        if (!unmounted) setStatus('disconnected');
      };
    };

    connect();

    return () => {
      unmounted = true;
      ws?.close();
    };
  }, [sessionId]);

  const handleFrame = useCallback((frame: Record<string, unknown>) => {
    switch (frame.type) {
      case 'text_delta':
        // Accumulate streaming text character by character
        setCurrentAiText((prev) => prev + (frame.delta as string));
        break;

      case 'text_done': {
        // Finalize AI utterance — add to message history
        const text = frame.full_text as string;
        setCurrentAiText('');
        options?.onTtsTurnDone?.();
        setMessages((prev) => [
          ...prev,
          { role: 'ai', text, timestamp: Date.now() },
        ]);
        break;
      }

      case 'phase_change':
        setPhase(frame.phase as string);
        break;

      case 'risk_alert':
        setRiskAlert((frame.script as string) ?? '我需要先停下来，请联系专业支持。');
        options?.onPlaybackStop?.('risk_interrupt');
        break;

      case 'call_ended':
        options?.onPlaybackStop?.('call_ended');
        setStatus('disconnected');
        break;

      case 'tts_chunk':
        if (typeof frame.data === 'string') {
          setTtsChunkCount((prev) => prev + 1);
          options?.onTtsChunk?.(frame.data);
        }
        break;

      case 'error':
        console.warn('[WS] Server error:', frame.message);
        break;

      default:
        break;
    }
  }, [options]);

  const sendSttResult = useCallback((text: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stt_result', text }));
      // Add user message to local history immediately (optimistic)
      setMessages((prev) => [
        ...prev,
        { role: 'user', text, timestamp: Date.now() },
      ]);
    }
  }, []);

  const sendAudioMessage = useCallback((payload: {
    base64Audio: string;
    audioFormat: string;
    sampleRate: number;
    bitsPerSample: number;
    channels: number;
    language?: string;
  }) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'audio_chunk',
        data: payload.base64Audio,
        audio_format: payload.audioFormat,
        sample_rate: payload.sampleRate,
        bits_per_sample: payload.bitsPerSample,
        channels: payload.channels,
        language: payload.language ?? 'zh-CN',
      }));
      wsRef.current.send(JSON.stringify({ type: 'end_of_speech' }));
      setMessages((prev) => [
        ...prev,
        { role: 'user', text: '🎤 发来了一段语音', timestamp: Date.now() },
      ]);
    }
  }, []);

  const hangUp = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'hang_up' }));
      wsRef.current.close();
    }
    setStatus('disconnected');
  }, []);

  return {
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
  };
}
