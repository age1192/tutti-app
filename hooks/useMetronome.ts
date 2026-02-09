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

// 分割タイプの優先順位（細かい方が優先）
const SUBDIVISION_TYPES: SubdivisionType[] = ['sixteenth', 'triplet', 'eighth', 'quarter'];

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

  const { playClick, playSubdivisionClick, isWebAudioSupported, ensureAudioContextResumed } = useAudioEngine();
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

  // 特定のタイミングで音を鳴らすべきかチェック
  // position: 0 = 拍頭, 1 = 2番目, 2 = 3番目, 3 = 4番目
  const shouldPlayAtPosition = (type: SubdivisionType, position: number, count: number): boolean => {
    const subdivisionCount = SUBDIVISION_COUNTS[type];
    // その分割タイプのタイミングに一致するかチェック
    // 例: 8分(count=2)の場合、position 0, 2 で鳴る（4分割の0, 2番目）
    // 例: 3連(count=3)の場合、position 0, 1.33, 2.66 で鳴る
    const interval = count / subdivisionCount;
    return position % interval < 0.01 || Math.abs(position % interval - interval) < 0.01;
  };

  // 1拍内の全ての分割音をスケジュール
  // 常に最小単位（16分音符相当）でスケジュールし、音量で制御
  const scheduleSubdivisions = useCallback((isAccent: boolean) => {
    clearSubdivisionTimers();
    
    // 最新の状態を取得
    const state = useMetronomeStore.getState();
    const currentTone = state.tone;
    
    // 各分割タイプについて、全てのタイミングで音をスケジュール
    SUBDIVISION_TYPES.forEach((type) => {
      const count = SUBDIVISION_COUNTS[type];
      
      // このタイプの全てのタイミングをスケジュール
      for (let i = 0; i < count; i++) {
        const delay = (beatIntervalMs / count) * i;
        
        if (i === 0) {
          // 拍頭の音
          // 4分音符の場合はplayClick（アクセント対応）
          // それ以外はplaySubdivisionClick
          if (type === 'quarter') {
            // 音量とtoneはリアルタイムで取得
            const volume = useMetronomeStore.getState().subdivisionSettings.quarter;
            const latestTone = useMetronomeStore.getState().tone;
            if (volume > 0) {
              playClick(isAccent, volume * 0.7, latestTone);
            }
          } else {
            // 拍頭でも分割音を鳴らす（8分、3連、16分）
            const volume = useMetronomeStore.getState().subdivisionSettings[type];
            const latestTone = useMetronomeStore.getState().tone;
            if (volume > 0) {
              playSubdivisionClick(type, true, volume * 0.6, latestTone);
            }
          }
        } else {
          // 拍頭以外の分割音をスケジュール
          const timer = setTimeout(() => {
            // 音量とtoneはリアルタイムで取得（スライダー操作中でも反映）
            const currentVolume = useMetronomeStore.getState().subdivisionSettings[type];
            const latestTone = useMetronomeStore.getState().tone;
            if (currentVolume > 0) {
              playSubdivisionClick(type, false, currentVolume * 0.6, latestTone);
              setSubdivision(i);
            }
          }, delay);
          subdivisionTimersRef.current.push(timer);
        }
      }
    });
  }, [beatIntervalMs, clearSubdivisionTimers, playClick, playSubdivisionClick, setSubdivision]);

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

  // AppStateの変化を監視してフォアグラウンド復帰時にAudioContextをresume
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && isPlaying) {
        // フォアグラウンドに戻ったらAudioContextを再開
        ensureAudioContextResumed();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [isPlaying, ensureAudioContextResumed]);

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
