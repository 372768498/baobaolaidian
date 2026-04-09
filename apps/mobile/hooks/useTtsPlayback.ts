import { useCallback, useEffect, useRef, useState } from 'react';
import { Audio, AVPlaybackStatus } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { TTS_PLAYBACK_MODE } from '@/lib/constants';

export interface PlaybackMetrics {
  ttsFirstChunkPlayMs: number | null;
  playbackTotalDurationMs: number | null;
  interruptCount: number;
  playbackError: string | null;
}

interface UseTtsPlaybackResult {
  isPlaying: boolean;
  playbackMetrics: PlaybackMetrics;
  enqueueChunk: (base64Audio: string) => void;
  stopPlayback: (reason?: string) => Promise<void>;
  markTurnComplete: () => void;
}

function buildDataUri(base64Audio: string): string {
  return `data:audio/mpeg;base64,${base64Audio}`;
}

async function buildPlayableSource(base64Audio: string): Promise<{
  uri: string;
  cleanup?: () => Promise<void>;
}> {
  if (TTS_PLAYBACK_MODE === 'tempfile') {
    const dir = `${FileSystem.cacheDirectory}tts-chunks/`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const uri = `${dir}${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`;
    await FileSystem.writeAsStringAsync(uri, base64Audio, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return {
      uri,
      cleanup: async () => {
        try {
          await FileSystem.deleteAsync(uri, { idempotent: true });
        } catch {}
      },
    };
  }

  return { uri: buildDataUri(base64Audio) };
}

export function useTtsPlayback(): UseTtsPlaybackResult {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackMetrics, setPlaybackMetrics] = useState<PlaybackMetrics>({
    ttsFirstChunkPlayMs: null,
    playbackTotalDurationMs: null,
    interruptCount: 0,
    playbackError: null,
  });

  const queueRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const soundCleanupRef = useRef<(() => Promise<void>) | null>(null);
  const turnStartedAtRef = useRef<number | null>(null);
  const turnCompletedRef = useRef(false);

  const finalizeIfIdle = useCallback(() => {
    if (!turnCompletedRef.current || isPlayingRef.current || queueRef.current.length > 0) {
      return;
    }
    setPlaybackMetrics((prev) => ({
      ...prev,
      playbackTotalDurationMs: turnStartedAtRef.current ? Date.now() - turnStartedAtRef.current : prev.playbackTotalDurationMs,
    }));
    turnStartedAtRef.current = null;
    turnCompletedRef.current = false;
  }, []);

  const unloadCurrentSound = useCallback(async () => {
    if (!soundRef.current) return;
    const sound = soundRef.current;
    soundRef.current = null;
    sound.setOnPlaybackStatusUpdate(null);
    try {
      await sound.stopAsync();
    } catch {}
    try {
      await sound.unloadAsync();
    } catch {}
    if (soundCleanupRef.current) {
      const cleanup = soundCleanupRef.current;
      soundCleanupRef.current = null;
      await cleanup();
    }
  }, []);

  const playNext = useCallback(async () => {
    if (isPlayingRef.current) return;
    const nextChunk = queueRef.current.shift();
    if (!nextChunk) {
      setIsPlaying(false);
      finalizeIfIdle();
      return;
    }

    const sound = new Audio.Sound();
    soundRef.current = sound;
    isPlayingRef.current = true;
    setIsPlaying(true);

    sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
      if (!status.isLoaded) {
        if (status.error) {
          setPlaybackMetrics((prev) => ({
            ...prev,
            playbackError: status.error ?? 'playback_status_error',
          }));
        }
        return;
      }
      if (status.didJustFinish) {
        sound.setOnPlaybackStatusUpdate(null);
        void sound.unloadAsync().catch(() => {});
        if (soundRef.current === sound) {
          soundRef.current = null;
        }
        isPlayingRef.current = false;
        setIsPlaying(false);
        void playNext();
      }
    });

    try {
      const source = await buildPlayableSource(nextChunk);
      soundCleanupRef.current = source.cleanup ?? null;
      await sound.loadAsync(
        { uri: source.uri },
        { shouldPlay: true, progressUpdateIntervalMillis: 50 },
        false,
      );

      if (turnStartedAtRef.current != null && playbackMetrics.ttsFirstChunkPlayMs == null) {
        setPlaybackMetrics((prev) => ({
          ...prev,
          ttsFirstChunkPlayMs: prev.ttsFirstChunkPlayMs ?? (Date.now() - turnStartedAtRef.current!),
          playbackError: null,
        }));
      }
    } catch (error) {
      isPlayingRef.current = false;
      setIsPlaying(false);
      setPlaybackMetrics((prev) => ({
        ...prev,
        playbackError: error instanceof Error ? error.message : 'playback_start_error',
      }));
      await unloadCurrentSound();
      void playNext();
    }
  }, [finalizeIfIdle, playbackMetrics.ttsFirstChunkPlayMs, unloadCurrentSound]);

  const enqueueChunk = useCallback((base64Audio: string) => {
    if (!base64Audio) return;
    if (turnStartedAtRef.current == null) {
      turnStartedAtRef.current = Date.now();
      turnCompletedRef.current = false;
      setPlaybackMetrics((prev) => ({
        ...prev,
        ttsFirstChunkPlayMs: null,
        playbackTotalDurationMs: null,
        playbackError: null,
      }));
    }
    queueRef.current.push(base64Audio);
    void playNext();
  }, [playNext]);

  const stopPlayback = useCallback(async (reason?: string) => {
    queueRef.current = [];
    isPlayingRef.current = false;
    setIsPlaying(false);
    await unloadCurrentSound();
    setPlaybackMetrics((prev) => ({
      ...prev,
      interruptCount: prev.interruptCount + 1,
      playbackError: reason ?? prev.playbackError,
      playbackTotalDurationMs: turnStartedAtRef.current ? Date.now() - turnStartedAtRef.current : prev.playbackTotalDurationMs,
    }));
    turnStartedAtRef.current = null;
    turnCompletedRef.current = false;
  }, [unloadCurrentSound]);

  const markTurnComplete = useCallback(() => {
    turnCompletedRef.current = true;
    finalizeIfIdle();
  }, [finalizeIfIdle]);

  useEffect(() => {
    return () => {
      void unloadCurrentSound();
    };
  }, [unloadCurrentSound]);

  return {
    isPlaying,
    playbackMetrics,
    enqueueChunk,
    stopPlayback,
    markTurnComplete,
  };
}
