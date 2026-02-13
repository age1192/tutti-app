/**
 * メトロノームロジックフック
 * タイマー制御とオーディオ再生を管理
 * 拍分割（サブディビジョン）機能対応
 * 
 * 設計思想：
 * - 全ての分割音が常にスケジュールされている
 * - 音量はリアルタイムで反映される（スライダー操作中も）
 * - 音量0の分割は鳴らない
 * - バックグラウンドでも再生を維持
 */
import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Audio } from 'expo-av';
import { useMetronomeStore } from '../stores';
import { useAudioEngine } from './useAudioEngine';
import { SubdivisionType } from '../types';
import { useSettingsStore } from '../stores/useSettingsStore';

// タップテンポ用の設定
const TAP_TEMPO_MAX_INTERVAL = 2000; // 2秒以上空いたらリセット
const TAP_TEMPO_MIN_TAPS = 2; // 最低タップ数
const TAP_TEMPO_MAX_TAPS = 4; // 計算に使う最大タップ数

// 分割タイプごとの分割数
const SUBDIVISION_COUNTS: Record<SubdivisionType, number> = {
  quarter: 1,    // 4分音符: 1拍に1回
  eighth: 2,     // 8分音符: 1拍に2回
  triplet: 3,    // 3連符: 1拍に3回
  sixteenth: 4,  // 16分音符: 1拍に4回
};

// 12スロットグリッド（2,3,4のLCM）で全分割を表現。同時刻の重複を避けるため1スロット1音に集約
const SLOTS_PER_BEAT = 12;
// 各分割タイプが鳴るスロット番号（0〜11）
const SUBDIVISION_SLOTS: Record<SubdivisionType, number[]> = {
  quarter: [0],
  eighth: [0, 6],
  triplet: [0, 4, 8],
  sixteenth: [0, 3, 6, 9],
};

export function useMetronome() {
  const {
    tempo,
    timeSignature,
    isPlaying,
    currentBeat,
    currentMeasure,
    subdivisionSettings,
    currentSubdivision,
    tone,
    setTempo,
    incrementTempo,
    decrementTempo,
    setTimeSignature,
    setTimeSignatureByIndex,
    setSubdivisionVolume,
    resetSubdivisionSettings,
    setTone,
    play,
    stop,
    toggle,
    tick,
    setSubdivision,
    reset,
  } = useMetronomeStore();

  const { playClick, playSubdivisionClick, scheduleSubdivisionClickAt, getCurrentTime, isWebAudioSupported, ensureAudioContextResumed } = useAudioEngine();
  const { settings } = useSettingsStore();
  
  // タイマー参照
  const mainTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const subdivisionTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const lastTickTimeRef = useRef<number>(0);
  const backgroundKeepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // タップテンポ用
  const tapTimesRef = useRef<number[]>([]);

  // 拍間隔をミリ秒で計算
  const beatIntervalMs = (60 / tempo) * 1000;

  // 分割音のタイマーをクリア
  const clearSubdivisionTimers = useCallback(() => {
    subdivisionTimersRef.current.forEach((timer) => clearTimeout(timer));
    subdivisionTimersRef.current = [];
  }, []);

  // 1拍内の分割音をスケジュール（同時刻の重複を避け、1スロット1音に集約してテンポの乱れを防止）
  const scheduleSubdivisions = useCallback((isAccent: boolean) => {
    clearSubdivisionTimers();
    if (!scheduleSubdivisionClickAt || !getCurrentTime) return;

    const state = useMetronomeStore.getState();
    const settings = state.subdivisionSettings;
    const tone = state.tone;
    const baseTime = getCurrentTime();
    const beatIntervalSec = beatIntervalMs / 1000;

    // 各スロットで鳴る最大音量と、そのスロットで使う分割タイプを集約
    const slotData: Map<number, { volume: number; type: SubdivisionType }> = new Map();
    (['quarter', 'eighth', 'triplet', 'sixteenth'] as SubdivisionType[]).forEach((type) => {
      const vol = type === 'quarter' ? settings.quarter * 0.7 : settings[type] * 0.6;
      if (vol <= 0) return;
      SUBDIVISION_SLOTS[type].forEach((slot) => {
        const existing = slotData.get(slot);
        if (!existing || existing.volume < vol) {
          slotData.set(slot, { volume: vol, type });
        }
      });
    });

    // スロット0（拍頭）: quarter があれば playClick、なければ scheduleSubdivisionClickAt
    const slot0 = slotData.get(0);
    if (slot0 && slot0.volume > 0) {
      if (slot0.type === 'quarter') {
        playClick(isAccent, slot0.volume, tone);
      } else {
        scheduleSubdivisionClickAt(baseTime, slot0.type, true, slot0.volume, tone);
      }
    }

    // スロット1〜11: 各1音のみスケジュール
    for (let slot = 1; slot < SLOTS_PER_BEAT; slot++) {
      const data = slotData.get(slot);
      if (!data || data.volume <= 0) continue;
      const offsetSec = (beatIntervalSec * slot) / SLOTS_PER_BEAT;
      scheduleSubdivisionClickAt(baseTime + offsetSec, data.type, false, data.volume, tone);
      const timer = setTimeout(() => setSubdivision(slot), offsetSec * 1000);
      subdivisionTimersRef.current.push(timer);
    }
  }, [beatIntervalMs, clearSubdivisionTimers, playClick, scheduleSubdivisionClickAt, getCurrentTime, setSubdivision]);

  // メトロノームのティック処理（拍頭）
  const handleTick = useCallback(() => {
    const now = Date.now();
    lastTickTimeRef.current = now;
    
    // 拍を進める
    tick();
    
    // tick()後の状態を取得して強拍を判定
    const state = useMetronomeStore.getState();
    const isAccent = state.currentBeat === 1;
    
    // 分割音をスケジュール（強拍情報を渡す）
    scheduleSubdivisions(isAccent);
  }, [tick, scheduleSubdivisions]);

  // バックグラウンドでオーディオセッションを維持するためのエフェクト
  useEffect(() => {
    if (isPlaying && settings?.backgroundPlayback) {
      // 再生開始時にオーディオモードを設定
      const setupBackgroundAudio = async () => {
        try {
          await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: true,
            shouldDuckAndroid: true,
            playThroughEarpieceAndroid: false,
          });
        } catch (e) {
          console.warn('[Metronome] Failed to setup background audio:', e);
        }
      };
      setupBackgroundAudio();

      // 定期的にAudioContextをresumeする（バックグラウンドで維持）
      const keepAliveInterval = setInterval(() => {
        ensureAudioContextResumed();
      }, 1000); // 1秒ごとにチェック
      backgroundKeepAliveRef.current = keepAliveInterval;

      return () => {
        if (backgroundKeepAliveRef.current) {
          clearInterval(backgroundKeepAliveRef.current);
          backgroundKeepAliveRef.current = null;
        }
      };
    } else {
      if (backgroundKeepAliveRef.current) {
        clearInterval(backgroundKeepAliveRef.current);
        backgroundKeepAliveRef.current = null;
      }
    }
  }, [isPlaying, settings?.backgroundPlayback, ensureAudioContextResumed]);

  // AppStateの変化を監視
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && isPlaying) {
        // フォアグラウンドに戻ったらAudioContextを再開
        ensureAudioContextResumed();
      }
      // バックグラウンド再生OFF時: バックグラウンドに移ったら停止
      if (nextAppState === 'background' && !settings?.backgroundPlayback && isPlaying) {
        stop();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [isPlaying, settings?.backgroundPlayback, ensureAudioContextResumed, stop]);

  // メトロノームの開始/停止を監視
  // 注意: subdivisionSettingsは依存に含めない（リアルタイム反映のため）
  useEffect(() => {
    if (isPlaying) {
      // 再生開始時にAudioContextを確実に起動
      ensureAudioContextResumed();
      
      // 最初のティックを即座に実行
      handleTick();
      
      // 定期的なティック（拍頭）
      const intervalId = setInterval(() => {
        handleTick();
      }, beatIntervalMs);

      mainTimerRef.current = intervalId;

      return () => {
        if (mainTimerRef.current) {
          clearInterval(mainTimerRef.current);
          mainTimerRef.current = null;
        }
        clearSubdivisionTimers();
      };
    } else {
      // 停止時はタイマーをクリア
      if (mainTimerRef.current) {
        clearInterval(mainTimerRef.current);
        mainTimerRef.current = null;
      }
      clearSubdivisionTimers();
    }
  }, [isPlaying, beatIntervalMs, handleTick, clearSubdivisionTimers, ensureAudioContextResumed]);

  // テンポ変更時にタイマーを更新
  useEffect(() => {
    if (isPlaying && mainTimerRef.current) {
      // タイマーを再設定
      clearInterval(mainTimerRef.current);
      clearSubdivisionTimers();
      
      const intervalId = setInterval(() => {
        handleTick();
      }, beatIntervalMs);

      mainTimerRef.current = intervalId;
    }
  }, [tempo, isPlaying, beatIntervalMs, handleTick, clearSubdivisionTimers]);

  // タップテンポ
  const tapTempo = useCallback(() => {
    const now = Date.now();
    const tapTimes = tapTimesRef.current;

    // 前回のタップから時間が空きすぎていたらリセット
    if (tapTimes.length > 0 && now - tapTimes[tapTimes.length - 1] > TAP_TEMPO_MAX_INTERVAL) {
      tapTimesRef.current = [];
    }

    // タップ時間を記録
    tapTimesRef.current.push(now);

    // 最大タップ数を超えたら古いものを削除
    if (tapTimesRef.current.length > TAP_TEMPO_MAX_TAPS) {
      tapTimesRef.current.shift();
    }

    // 最低タップ数に達したらテンポを計算
    if (tapTimesRef.current.length >= TAP_TEMPO_MIN_TAPS) {
      const times = tapTimesRef.current;
      let totalInterval = 0;
      
      for (let i = 1; i < times.length; i++) {
        totalInterval += times[i] - times[i - 1];
      }
      
      const averageInterval = totalInterval / (times.length - 1);
      const calculatedTempo = Math.round(60000 / averageInterval);
      
      // テンポを設定
      setTempo(calculatedTempo);
    }
  }, [setTempo]);

  // タップテンポのリセット
  const resetTapTempo = useCallback(() => {
    tapTimesRef.current = [];
  }, []);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (mainTimerRef.current) {
        clearInterval(mainTimerRef.current);
      }
      clearSubdivisionTimers();
    };
  }, [clearSubdivisionTimers]);

  return {
    // 状態
    tempo,
    timeSignature,
    isPlaying,
    currentBeat,
    currentMeasure,
    currentSubdivision,
    subdivisionSettings,
    tone,
    beatIntervalMs,
    isAudioSupported: isWebAudioSupported,

    // アクション
    setTempo,
    incrementTempo,
    decrementTempo,
    setTimeSignature,
    setTimeSignatureByIndex,
    setSubdivisionVolume,
    resetSubdivisionSettings,
    setTone,
    play,
    stop,
    toggle,
    reset,
    tapTempo,
    resetTapTempo,
  };
}
