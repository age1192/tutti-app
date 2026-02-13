/**
 * オーディオエンジン管理フック
 * react-native-audio-api を使用した音声再生（Native/Web両対応）
 */
import { useCallback, useEffect, useState } from 'react';
import { Audio } from 'expo-av';
import { Platform } from 'react-native';
// react-native-audio-apiのインポート
let AudioContext: any = null;
try {
  AudioContext = require('react-native-audio-api').AudioContext;
} catch (e) {
  console.warn('react-native-audio-api is not available:', e);
}
import { ToneType, MetronomeToneType } from '../types';
import { useSettingsStore } from '../stores/useSettingsStore';

// 音声の状態
interface AudioState {
  isReady: boolean;
  isAudioSupported: boolean;
}

// ============================================================
// Module-level singleton: すべてのuseAudioEngineインスタンスが
// 同一のAudioContextを共有する。
// 複数のAudioContextが同時に存在するとiOSでネイティブスレッドが
// 競合しSIGABRTクラッシュが発生するため、シングルトン化は必須。
// ============================================================
let _sharedCtx: any = null;
let _sharedMasterGain: any = null;
let _sharedActiveNoteCount = 0;
let _refCount = 0;
let _isInitializing = false;
let _initPromise: Promise<void> | null = null;
let _initLock = false; // 初期化のロック（競合を防ぐ）
const MAX_CONCURRENT_NOTES = 32;

export function useAudioEngine() {
  const [audioState, setAudioState] = useState<AudioState>({
    isReady: _sharedCtx != null && _sharedCtx.state !== 'closed',
    isAudioSupported: _sharedCtx != null && _sharedCtx.state !== 'closed',
  });

  const { settings, loadSettings } = useSettingsStore();

  // 初期化（シングルトンパターン: 最初のインスタンスがAudioContextを作成）
  useEffect(() => {
    _refCount++;

    const init = async () => {
      try {
        // 既にAudioContextが存在する場合は再利用（最初にチェック）
        if (_sharedCtx && _sharedCtx.state !== 'closed') {
          setAudioState({
            isReady: true,
            isAudioSupported: true,
          });
          return;
        }

        // 既に初期化中の場合は待機
        if (_initPromise) {
          console.log('[Audio] Waiting for existing initialization...');
          await _initPromise;
          setAudioState({
            isReady: _sharedCtx != null && _sharedCtx.state !== 'closed',
            isAudioSupported: _sharedCtx != null && _sharedCtx.state !== 'closed',
          });
          return;
        }

        // 初期化を開始（ロックを設定）- 競合を防ぐ
        if (_initLock) {
          console.log('[Audio] Initialization lock is set, waiting...');
          // ロックが解除されるまで待つ
          let waited = 0;
          while (_initLock && waited < 1000) {
            await new Promise(resolve => setTimeout(resolve, 50));
            waited += 50;
          }
          if (_initPromise) {
            await _initPromise;
          }
          setAudioState({
            isReady: _sharedCtx != null && _sharedCtx.state !== 'closed',
            isAudioSupported: _sharedCtx != null && _sharedCtx.state !== 'closed',
          });
          return;
        }

        // 再度チェック（待機中に他のスレッドが作成した可能性がある）
        if (_sharedCtx && _sharedCtx.state !== 'closed') {
          setAudioState({
            isReady: true,
            isAudioSupported: true,
          });
          return;
        }

        // 初期化を開始（ロックを設定）
        _initLock = true;
        _isInitializing = true;
        _initPromise = (async () => {
          try {
            await loadSettings();
            const currentSettings = useSettingsStore.getState().settings;
            
            // expo-av のオーディオモード設定（iOS サイレントモード対応など）
            await Audio.setAudioModeAsync({
              playsInSilentModeIOS: true,
              staysActiveInBackground: currentSettings?.backgroundPlayback || false,
              shouldDuckAndroid: true,
            });

            let isAudioSupported = false;
            console.log('[Audio] Checking AudioContext availability:', AudioContext ? 'available' : 'null');
            if (AudioContext) {
              // 再度チェック（他のスレッドが既に作成した可能性がある）- より厳密にチェック
              if (_sharedCtx && _sharedCtx.state !== 'closed') {
                isAudioSupported = true;
                console.log('[Audio] Reusing existing shared AudioContext, state:', _sharedCtx.state);
              } else if (_sharedCtx && _sharedCtx.state === 'closed') {
                // closed状態の場合はnullにリセット
                console.log('[Audio] Existing AudioContext is closed, resetting...');
                _sharedCtx = null;
                _sharedMasterGain = null;
              }
              
              // _sharedCtxがまだnullの場合のみ作成
              if (!_sharedCtx) {
                // 新しいAudioContextを作成（初回のみ、または前回が閉じられた場合）
                try {
                  console.log('[Audio] Creating new AudioContext...');
                  const ctx = new AudioContext();
                  console.log('[Audio] AudioContext created, state:', ctx?.state);
                  _sharedCtx = ctx;
                  
                  const masterGain = ctx.createGain();
                  masterGain.gain.value = 0.7;
                  masterGain.connect(ctx.destination);
                  _sharedMasterGain = masterGain;
                  
                  _sharedActiveNoteCount = 0;
                  
                  // iOS: suspended状態の場合はresumeを試みる
                  if (ctx.state === 'suspended') {
                    try {
                      console.log('[Audio] Resuming AudioContext during initialization...');
                      await ctx.resume();
                      // resume後、状態がrunningになるまで最大200ms待機
                      let retries = 0;
                      while (ctx.state === 'suspended' && retries < 20) {
                        await new Promise(resolve => setTimeout(resolve, 10));
                        retries++;
                      }
                      console.log('[Audio] AudioContext state after resume:', ctx.state);
                    } catch (e) {
                      console.warn('[Audio] Failed to resume AudioContext during initialization:', e);
                    }
                  }
                  
                  isAudioSupported = true;
                  console.log('[Audio] AudioContext initialized successfully (singleton), state:', ctx.state);
                } catch (e) {
                  console.error('[Audio] Failed to create AudioContext:', e);
                  console.error('[Audio] Error stack:', e instanceof Error ? e.stack : 'no stack');
                  isAudioSupported = false;
                }
              }
            } else {
              console.error('[Audio] react-native-audio-api AudioContext is null!');
              console.error('[Audio] Platform:', Platform.OS);
              isAudioSupported = false;
            }

            // すべてのインスタンスに状態を通知
            setAudioState({
              isReady: true,
              isAudioSupported,
            });
          } catch (error) {
            console.warn('Audio initialization failed:', error);
            setAudioState({
              isReady: false,
              isAudioSupported: false,
            });
          } finally {
            _isInitializing = false;
            _initPromise = null;
            _initLock = false; // ロックを解除
          }
        })();

        await _initPromise;
      } catch (error) {
        console.warn('Audio initialization failed:', error);
        setAudioState({
          isReady: false,
          isAudioSupported: false,
        });
        _isInitializing = false;
        _initPromise = null;
        _initLock = false; // ロックを解除
      }
    };

    init();

    return () => {
      _refCount--;
      // 最後のインスタンスがアンマウントされた時のみAudioContextを閉じる
      if (_refCount <= 0) {
        _refCount = 0;
        const cleanup = async () => {
          try {
            // 初期化中の場合は完了を待つ
            if (_initPromise) {
              await _initPromise;
            }

            const ctx = _sharedCtx;
            if (!ctx) return;

            const noteKeys = Object.keys(ctx).filter(key => key.startsWith('__note_'));
            noteKeys.forEach((key) => {
              try {
                const oscillator = (ctx as any)[key];
                if (oscillator) {
                  try { oscillator.stop(); } catch (e) {}
                  delete (ctx as any)[key];
                }
              } catch (e) {}
            });
            
            _sharedActiveNoteCount = 0;
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
            if (ctx.state !== 'closed') {
              try { await ctx.close(); } catch (e) {}
            }
          } catch (err) {
            console.error('[Audio] Error during cleanup:', err);
          } finally {
            _sharedCtx = null;
            _sharedMasterGain = null;
            _sharedActiveNoteCount = 0;
            _isInitializing = false;
            _initPromise = null;
          }
        };
        cleanup();
      }
    };
  }, [loadSettings]);

  // バックグラウンド再生設定が変更されたときにオーディオモードを更新
  useEffect(() => {
    const updateAudioMode = async () => {
      if (!audioState.isReady) return;
      
      try {
        // 最新の設定を取得
        await loadSettings();
        const currentSettings = useSettingsStore.getState().settings;
        
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: currentSettings?.backgroundPlayback || false,
          shouldDuckAndroid: true,
        });
      } catch (error) {
        console.warn('Failed to update audio mode:', error);
      }
    };

    updateAudioMode();
  }, [settings.backgroundPlayback, audioState.isReady, loadSettings]);

  /**
   * トーンを再生（AudioContext使用）
   */
  const playToneInternal = useCallback(
    async (frequency: number, duration: number, volume: number = 0.5) => {
      const isReady = await ensureAudioContextReady();
      if (!isReady) return;

      const ctx = _sharedCtx;
      if (!ctx || ctx.state === 'closed') return;

      const currentTime = ctx.currentTime;

      // オシレーター
      const oscillator = ctx.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;

      // ゲイン
      const gainNode = ctx.createGain();
      gainNode.gain.value = 0;

      // 接続
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      // エンベロープ
      const attack = 0.005;
      const decay = 0.045;
      const release = 0.01;
      const endTime = currentTime + duration;

      gainNode.gain.setValueAtTime(0, currentTime);
      gainNode.gain.linearRampToValueAtTime(volume, currentTime + attack);
      gainNode.gain.linearRampToValueAtTime(0, currentTime + attack + decay);

      oscillator.start(currentTime);
      oscillator.stop(endTime + release);
    },
    [ensureAudioContextReady]
  );

  /**
   * トーンを再生
   */
  const playTone = useCallback(
    (frequency: number, duration: number, volume: number = 0.5) => {
      playToneInternal(frequency, duration, volume);
    },
    [playToneInternal]
  );

  /**
   * クリック音を再生（メトロノーム用）
   * 音色によって周波数とエンベロープを変える
   */
  const playClick = useCallback(
    async (isAccent: boolean = false, volume: number = 0.7, tone: MetronomeToneType = 'default') => {
      const isReady = await ensureAudioContextReady();
      if (!isReady) return;

      const ctx = _sharedCtx;
      if (!ctx || ctx.state === 'closed') return;

        const currentTime = ctx.currentTime;
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        gainNode.gain.value = 0;

        // 音色ごとに周波数、波形、エンベロープを設定
        let frequency: number;
        let duration: number;
        let attackTime: number;

        switch (tone) {
          case 'hard':
            // 硬め: 矩形波 + 高い周波数 + 鋭いアタック
            oscillator.type = 'square';
            frequency = isAccent ? 1200 : 1000;
            duration = isAccent ? 0.04 : 0.025;
            attackTime = 0.001;
            break;
          case 'wood':
            // 木の音: サイン波 + 低域フィルタ + 低い周波数
            oscillator.type = 'sine';
            frequency = isAccent ? 700 : 500;
            duration = isAccent ? 0.06 : 0.04;
            attackTime = 0.002;
            oscillator.frequency.value = frequency;
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 1500;
            filter.Q.value = 2;
            oscillator.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(ctx.destination);
            
            gainNode.gain.setValueAtTime(0, currentTime);
            gainNode.gain.linearRampToValueAtTime(volume, currentTime + attackTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, currentTime + duration);
            
            oscillator.start(currentTime);
            oscillator.stop(currentTime + duration + 0.01);
            return;
          case 'default':
          default:
            // 通常: HD200のような聞こえやすいクリック音
            // 高い周波数 + 鋭いアタック + 短い持続時間で明確な音を作る
            oscillator.type = 'square'; // 矩形波でより明確な音
            frequency = isAccent ? 1800 : 1500; // より高い周波数で聞こえやすく
            duration = isAccent ? 0.025 : 0.02; // 短い持続時間でクリック感を強調
            attackTime = 0.0005; // 非常に鋭いアタック
            break;
        }

        oscillator.frequency.value = frequency;
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        // エンベロープ
        // デフォルト音色はより鋭いクリック感を出すため、指数関数的な減衰を使用
        if (tone === 'default') {
          gainNode.gain.setValueAtTime(0, currentTime);
          gainNode.gain.linearRampToValueAtTime(volume, currentTime + attackTime);
          // 指数関数的な減衰でより明確なクリック感
          gainNode.gain.exponentialRampToValueAtTime(0.001, currentTime + duration);
        } else {
          gainNode.gain.setValueAtTime(0, currentTime);
          gainNode.gain.linearRampToValueAtTime(volume, currentTime + attackTime);
          gainNode.gain.linearRampToValueAtTime(0, currentTime + duration);
        }

        oscillator.start(currentTime);
        oscillator.stop(currentTime + duration + 0.01);
    },
    [ensureAudioContextReady]
  );

  /**
   * 分割音（サブディビジョン）を再生
   * @param subdivisionType - 分割タイプ（'quarter' | 'eighth' | 'triplet' | 'sixteenth'）
   * @param isFirstOfBeat - 拍の最初の音かどうか（参考情報として受け取るが、スキップはしない）
   * @param volume - 音量（0.0 - 1.0）
   * @param tone - メトロノーム音色
   */
  const playSubdivisionClick = useCallback(
    async (subdivisionType: string, isFirstOfBeat: boolean, volume: number = 0.5, tone: MetronomeToneType = 'default') => {
      const isReady = await ensureAudioContextReady();
      if (!isReady) return;

      const ctx = _sharedCtx;
      if (!ctx || ctx.state === 'closed') return;

      // 分割タイプごとに異なる周波数を設定
      // 8th: 600Hz, triplet: 500Hz, 16th: 400Hz
      let frequency: number;
      let duration: number;
      
      switch (subdivisionType) {
        case 'eighth':
          frequency = 600;
          duration = 0.025;
          break;
        case 'triplet':
          frequency = 500;
          duration = 0.02;
          break;
        case 'sixteenth':
          frequency = 400;
          duration = 0.015;
          break;
        default:
          frequency = 800;
          duration = 0.03;
      }

      const currentTime = ctx.currentTime;
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        gainNode.gain.value = 0;

        // 音色設定
        switch (tone) {
          case 'default':
            oscillator.type = 'sine';
            break;
          case 'hard':
            oscillator.type = 'square';
            break;
          case 'wood':
            oscillator.type = 'sine';
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 1500;
            filter.Q.value = 1;
            oscillator.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(ctx.destination);
            
            oscillator.frequency.value = frequency;
            gainNode.gain.setValueAtTime(0, currentTime);
            gainNode.gain.linearRampToValueAtTime(volume, currentTime + 0.001);
            gainNode.gain.linearRampToValueAtTime(0, currentTime + duration);
            
            oscillator.start(currentTime);
            oscillator.stop(currentTime + duration + 0.01);
            return;
        }

        oscillator.frequency.value = frequency;
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        // エンベロープ
        gainNode.gain.setValueAtTime(0, currentTime);
        gainNode.gain.linearRampToValueAtTime(volume, currentTime + 0.003);
        gainNode.gain.linearRampToValueAtTime(0, currentTime + duration);

        oscillator.start(currentTime);
        oscillator.stop(currentTime + duration + 0.01);
    },
    [ensureAudioContextReady]
  );

  /**
   * 持続音を開始（Web環境のみ完全サポート）
   * 音色: organ, flute, clarinet, oboe
   */
  /**
   * iOS/Safari: AudioContext.resume() はユーザージェスチャー内で同期的に呼ぶ必要がある。
   * await の後に呼ぶとジェスチャーが失効し、resume が効かない。
   * タッチ/クリックハンドラの先頭で呼ぶこと。
   */
  const resumeAudioContextSync = useCallback(() => {
    const ctx = _sharedCtx;
    if (ctx && ctx.state === 'suspended') {
      try {
        ctx.resume(); // Promise を返すが await しない（同期的に呼ぶことが重要）
      } catch (e) {
        console.warn('[Audio] resumeAudioContextSync failed:', e);
      }
    }
  }, []);

  // AudioContextの状態を同期的にチェック（高速パス: await不要）
  const isAudioContextReadySync = useCallback((): boolean => {
    if (!_sharedCtx || !_sharedMasterGain) return false;
    const state = _sharedCtx.state;
    return state === 'running' || state === 'suspended';
  }, []);

  // AudioContextとマスターGainNodeの状態を確認・修復する関数
  const ensureAudioContextReady = useCallback(async (): Promise<boolean> => {
    // 高速パス: 既にrunning状態なら即座にtrue（ログも省略）
    if (_sharedCtx && _sharedMasterGain && _sharedCtx.state === 'running') {
      return true;
    }

    console.log('[Audio] ensureAudioContextReady called, _isInitializing:', _isInitializing, '_sharedCtx:', !!_sharedCtx, '_initPromise:', !!_initPromise);
    
    // 初期化中の場合は完了を待つ（重要：最初にチェック）
    if (_initPromise) {
      try {
        console.log('[Audio] Waiting for initialization to complete...');
        await _initPromise;
      } catch (e) {
        console.warn('[Audio] Initialization failed:', e);
        return false;
      }
    }

    // 初期化がまだ開始されていない、またはctxがnullの場合は待機
    if (!_sharedCtx) {
      console.log('[Audio] Waiting for AudioContext to be created...');
      let waited = 0;
      while (!_sharedCtx && waited < 2000) {
        if (_initPromise) {
          try {
            await _initPromise;
            if (_sharedCtx) break;
          } catch (e) {
            console.warn('[Audio] Initialization failed:', e);
            return false;
          }
        }
        await new Promise(resolve => setTimeout(resolve, 50));
        waited += 50;
      }
      
      if (!_sharedCtx) {
        console.warn('[Audio] AudioContext is still null after waiting 2000ms');
        return false;
      }
    }

    const ctx = _sharedCtx;
    if (!ctx || ctx.state === 'closed') {
      console.warn('[Audio] AudioContext is null or closed');
      return false;
    }

    // マスターGainNodeが存在しない場合は再作成
    if (!_sharedMasterGain) {
      try {
        const masterGain = ctx.createGain();
        masterGain.gain.value = 0.7;
        masterGain.connect(ctx.destination);
        _sharedMasterGain = masterGain;
      } catch (e) {
        console.error('[Audio] Failed to recreate masterGain:', e);
        return false;
      }
    }

    // AudioContextがsuspendedの場合は再開を試みる
    if (ctx.state === 'suspended') {
      try {
        ctx.resume();
      } catch (e) {
        console.warn('[Audio] Failed to resume AudioContext:', e);
      }
    }

    return true;
  }, []);

  const startNote = useCallback(
    async (noteId: number, frequency: number, volume: number = 0.3, tone: ToneType = 'organ') => {
      const ctx = _sharedCtx;
      const masterGain = _sharedMasterGain;

      // 高速パス: AudioContextがrunning状態ならawaitなしで即座に音を鳴らす
      if (!ctx || !masterGain || ctx.state !== 'running') {
        // 遅延パス: AudioContextの準備が必要
        const isReady = await ensureAudioContextReady();
        if (!isReady) {
          console.warn('[Audio] AudioContext is not ready, skipping note:', noteId);
          return;
        }

        // suspendedの場合はresume（fire-and-forget: 結果を待たずに進む）
        if (_sharedCtx?.state === 'suspended') {
          try { _sharedCtx.resume(); } catch (e) {}
        }

        // 再チェック
        if (!_sharedCtx || !_sharedMasterGain || _sharedCtx.state === 'closed') {
          console.warn('[Audio] AudioContext is not available after ensure, skipping note:', noteId);
          return;
        }
      }

      // 遅延パス通過後はシングルトン参照を再取得
      const activeCtx = _sharedCtx;
      const activeMasterGain = _sharedMasterGain;
      if (!activeCtx || !activeMasterGain) return;

      try {
        // 同じ noteId の音が既に鳴っていたら先に停止（参照を失って音が残るのを防ぐ）
        const existingOscillator = (activeCtx as any)[`__note_${noteId}`];
        if (existingOscillator) {
          stopNote(noteId);
        }

        // 同時に鳴らせる音の数が上限に達している場合は、古い音を停止
        if (_sharedActiveNoteCount >= MAX_CONCURRENT_NOTES) {
          // 最も古い音を探して停止（簡易実装：最初に見つかった音を停止）
          const keys = Object.keys(activeCtx).filter(k => k.startsWith('__note_'));
          if (keys.length > 0) {
            const oldestNoteId = parseInt(keys[0].replace('__note_', ''), 10);
            stopNote(oldestNoteId);
          }
        }

        const currentTime = activeCtx.currentTime;

        const oscillator = activeCtx.createOscillator();
        const gainNode = activeCtx.createGain();
        gainNode.gain.value = 0;

        // 音色設定
        let filter: BiquadFilterNode | null = null;
        
        switch (tone) {
          case 'organ':
            // オルガン: 複数の倍音を組み合わせて本物のオルガンに近づける
            // パイプオルガンは複数のパイプの音を合成したような豊かな倍音構造を持つ
            // 基本音を矩形波ベースにし、追加の倍音で豊かさを出す
            oscillator.type = 'square'; // 矩形波（奇数倍音を含む）
            filter = activeCtx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = frequency * 6; // 適度な高次倍音まで含める
            filter.Q.value = 0.5; // 緩やかなローパスで自然な減衰
            break;
          case 'flute':
            // フルート: サイン波 + 低域フィルタ
            oscillator.type = 'sine';
            filter = activeCtx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 3000;
            filter.Q.value = 1;
            break;
          case 'clarinet':
            // クラリネット: 奇数倍音のみを含む閉じた円筒管の特性
            // 矩形波は奇数倍音を含むが、より正確なクラリネットの音色を作るため
            // 複数のフィルタを組み合わせてフォルマント構造を再現
            oscillator.type = 'square'; // 矩形波（奇数倍音を含む）
            
            // クラリネットの特徴的なフォルマント周波数帯を再現
            // 第1フォルマント: 約1500Hz付近
            // 第2フォルマント: 約3000Hz付近
            // 低域は強く、高域は減衰する
            
            // ローパスフィルタで高域を減衰
            const lowpassFilter = activeCtx.createBiquadFilter();
            lowpassFilter.type = 'lowpass';
            lowpassFilter.frequency.value = 4000; // 高域を適度に減衰
            lowpassFilter.Q.value = 0.7;
            
            // ピークフィルタで第1フォルマント（1500Hz付近）を強調
            const formantFilter = activeCtx.createBiquadFilter();
            formantFilter.type = 'peaking';
            formantFilter.frequency.value = 1500;
            formantFilter.Q.value = 2.5;
            formantFilter.gain.value = 6; // 約6dBのブースト
            
            // 接続: oscillator -> lowpass -> formant -> gain
            oscillator.connect(lowpassFilter);
            lowpassFilter.connect(formantFilter);
            formantFilter.connect(gainNode);
            filter = formantFilter; // 参照を保持（後で使用）
            break;
          case 'organ2':
            // グランドピアノ: 複数の倍音を含む自然な減衰音
            // グランドピアノは持続音ではなく、打鍵音として実装（自動的に減衰）
            // グランドピアノの音色特性:
            // - 非常に短いアタック（ハンマーが弦を叩く瞬間）
            // - 複数の倍音（基本音 + 2倍音、3倍音、4倍音、5倍音、6倍音など）
            // - 高域の倍音は速く減衰
            // - ハンマーストライクのノイズ成分
            // - より豊かで深みのある音色
            oscillator.type = 'sine'; // 基本音はサイン波
            // ローパスフィルタで高域を自然に減衰（グランドピアノらしい柔らかい音色）
            filter = activeCtx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = frequency * 15; // より高次倍音まで含める
            filter.Q.value = 0.3; // より緩やかな減衰で自然な音色
            break;
        }

        oscillator.frequency.value = frequency;

        // 接続（すべてマスターGainNode経由で出力）
        // クラリネットの場合は既に接続済み（複数フィルタを使用）
        if (tone === 'clarinet') {
          // クラリネットは既に oscillator -> lowpassFilter -> formantFilter -> gainNode で接続済み
          gainNode.connect(activeMasterGain);
        } else if (filter) {
          oscillator.connect(filter);
          filter.connect(gainNode);
          gainNode.connect(activeMasterGain);
        } else {
          oscillator.connect(gainNode);
          gainNode.connect(activeMasterGain);
        }

        // Attack（楽器ごとに異なる）
        let attackTime: number;
        let releaseTime: number = 0; // ピアノ用のリリースタイム
        if (tone === 'organ') {
          // オルガン: 即座に立ち上がる（パイプオルガンの特性）
          attackTime = 0.001;
        } else if (tone === 'flute') {
          attackTime = 0.05;
        } else if (tone === 'organ2') {
          // グランドピアノ: 非常に短いアタック＋自然な減衰（グランドピアノらしい響き）
          attackTime = 0.001; // 1ms（ハンマーストライクの瞬間を再現）
          releaseTime = 0.8; // 約0.8秒で減衰完了（グランドピアノらしい自然な減衰）
        } else {
          attackTime = 0.01;
        }
        gainNode.gain.setValueAtTime(0, currentTime);
        gainNode.gain.linearRampToValueAtTime(volume, currentTime + attackTime);
        
        // グランドピアノ: 非常に短いアタック＋自然な指数減衰（グランドピアノらしい響き）
        if (tone === 'organ2' && releaseTime > 0) {
          gainNode.gain.setValueAtTime(0, currentTime);
          gainNode.gain.linearRampToValueAtTime(volume, currentTime + attackTime);
          // より自然な減衰カーブ（グランドピアノらしい響き）
          gainNode.gain.exponentialRampToValueAtTime(0.001, currentTime + attackTime + releaseTime);
          try {
            oscillator.stop(currentTime + attackTime + releaseTime + 0.05);
            (oscillator as any).__autoStopScheduled = true;
          } catch (e) {
            console.warn('Failed to schedule oscillator stop:', e);
          }
        }
        
        // グランドピアノの倍音（各倍音が異なる減衰時間で自然な響きを再現）
        if (tone === 'organ2') {
          // グランドピアノの倍音減衰: 高域ほど速く減衰（より自然な音色）
          const d2 = 0.6, d3 = 0.5, d4 = 0.4, d5 = 0.3, d6 = 0.25;
          const addHarmonic = (mult: number, vol: number, decay: number) => {
            try {
              const h = activeCtx.createOscillator();
              h.type = 'sine';
              h.frequency.value = frequency * mult;
              const g = activeCtx.createGain();
              g.gain.value = 0;
              const f = activeCtx.createBiquadFilter();
              f.type = 'lowpass';
              f.frequency.value = frequency * (mult < 4 ? 6 : 4);
              f.Q.value = 0.5;
              h.connect(f);
              f.connect(g);
              g.connect(activeMasterGain); // マスターGainNode経由で出力（重要）
              g.gain.setValueAtTime(0, currentTime);
              g.gain.linearRampToValueAtTime(volume * vol, currentTime + attackTime);
              g.gain.exponentialRampToValueAtTime(0.001, currentTime + attackTime + decay);
              h.start(currentTime);
              h.stop(currentTime + attackTime + decay + 0.05);
              return { h, g };
            } catch (e) {
              console.warn(`[Audio] Failed to create harmonic ${mult}x:`, e);
              return { h: null, g: null };
            }
          };
          // グランドピアノの倍音バランス（より豊かで深みのある音色）
          const h2 = addHarmonic(2, 0.4, d2);  // 2倍音（オクターブ上）を少し強めに
          if (h2.h && h2.g) {
            (oscillator as any).__harmonic2 = h2.h;
            (oscillator as any).__gain2 = h2.g;
            (oscillator as any).__harmonic2AutoStop = true;
          }
          const h3 = addHarmonic(3, 0.3, d3);  // 3倍音（12度上）
          if (h3.h && h3.g) {
            (oscillator as any).__harmonic3 = h3.h;
            (oscillator as any).__gain3 = h3.g;
            (oscillator as any).__harmonic3AutoStop = true;
          }
          const h4 = addHarmonic(4, 0.2, d4);  // 4倍音（2オクターブ上）
          if (h4.h && h4.g) {
            (oscillator as any).__harmonic4 = h4.h;
            (oscillator as any).__gain4 = h4.g;
            (oscillator as any).__harmonic4AutoStop = true;
          }
          const h5 = addHarmonic(5, 0.15, d5);  // 5倍音
          if (h5.h && h5.g) {
            (oscillator as any).__harmonic5 = h5.h;
            (oscillator as any).__gain5 = h5.g;
            (oscillator as any).__harmonic5AutoStop = true;
          }
          const h6 = addHarmonic(6, 0.1, d6);   // 6倍音
          if (h6.h && h6.g) {
            (oscillator as any).__harmonic6 = h6.h;
            (oscillator as any).__gain6 = h6.g;
            (oscillator as any).__harmonic6AutoStop = true;
          }
          // ハンマーストライクのノイズ成分（グランドピアノらしい打鍵感）
          const noiseBuffer = activeCtx.createBuffer(1, Math.min(activeCtx.sampleRate * 0.015, 768), activeCtx.sampleRate);
          const noiseData = noiseBuffer.getChannelData(0);
          for (let i = 0; i < noiseData.length; i++) {
            noiseData[i] = (Math.random() * 2 - 1) * 0.2; // 少し控えめに
          }
          const noiseSource = activeCtx.createBufferSource();
          noiseSource.buffer = noiseBuffer;
          noiseSource.loop = false;
          const noiseGain = activeCtx.createGain();
          noiseGain.gain.value = 0;
          const noiseFilter = activeCtx.createBiquadFilter();
          noiseFilter.type = 'bandpass';
          noiseFilter.frequency.value = frequency * 10; // より高域のノイズ
          noiseFilter.Q.value = 1.5;
          noiseSource.connect(noiseFilter);
          noiseFilter.connect(noiseGain);
          noiseGain.connect(activeMasterGain); // マスターGainNode経由で出力
          noiseGain.gain.setValueAtTime(volume * 0.1, currentTime);
          noiseGain.gain.exponentialRampToValueAtTime(0.001, currentTime + 0.01);
          noiseSource.start(currentTime);
          noiseSource.stop(currentTime + 0.025);
          (oscillator as any).__noiseSource = noiseSource;
          (oscillator as any).__noiseGain = noiseGain;
        }
        
        // オルガンの場合、倍音を追加してより豊かな音色に
        if (tone === 'organ') {
          // 2倍音（オクターブ上）を追加（音量は基本音の25%）
          const harmonic2 = activeCtx.createOscillator();
          harmonic2.type = 'sine';
          harmonic2.frequency.value = frequency * 2;
          const gain2 = activeCtx.createGain();
          gain2.gain.value = 0;
          
          const filter2 = activeCtx.createBiquadFilter();
          filter2.type = 'lowpass';
          filter2.frequency.value = frequency * 6; // 基本音と同じフィルタ設定
          filter2.Q.value = 0.5;
          
          harmonic2.connect(filter2);
          filter2.connect(gain2);
          gain2.connect(activeCtx.destination);
          
          gain2.gain.setValueAtTime(0, currentTime);
          gain2.gain.linearRampToValueAtTime(volume * 0.25, currentTime + attackTime);
          
          harmonic2.start(currentTime);
          (oscillator as any).__harmonic2 = harmonic2;
          (oscillator as any).__gain2 = gain2;
          
          // 3倍音（12度上）を追加（音量は基本音の15%）
          const harmonic3 = activeCtx.createOscillator();
          harmonic3.type = 'sine';
          harmonic3.frequency.value = frequency * 3;
          const gain3 = activeCtx.createGain();
          gain3.gain.value = 0;
          
          const filter3 = activeCtx.createBiquadFilter();
          filter3.type = 'lowpass';
          filter3.frequency.value = frequency * 6; // 基本音と同じフィルタ設定
          filter3.Q.value = 0.5;
          
          harmonic3.connect(filter3);
          filter3.connect(gain3);
          gain3.connect(activeCtx.destination);
          
          gain3.gain.setValueAtTime(0, currentTime);
          gain3.gain.linearRampToValueAtTime(volume * 0.15, currentTime + attackTime);
          
          harmonic3.start(currentTime);
          (oscillator as any).__harmonic3 = harmonic3;
          (oscillator as any).__gain3 = gain3;
        }

        // 基本音のオシレーターを開始（ピアノの場合は自動停止がスケジュール済み）
        try {
          oscillator.start(currentTime);
        } catch (e) {
          console.warn('[Audio] Failed to start oscillator:', e);
          // エラーが発生しても処理を続行（他の音に影響を与えない）
          return;
        }

        // 保存（簡易実装）
        (oscillator as any).__gainNode = gainNode;
        (oscillator as any).__targetVolume = volume;
        (oscillator as any).__filter = filter;
        (oscillator as any).__tone = tone; // 音色を保存（setNoteVolumeで使用）
        (activeCtx as any)[`__note_${noteId}`] = oscillator;
        _sharedActiveNoteCount++;
      } catch (error) {
        // 予期しないエラーが発生した場合もログを残して処理を続行
        console.error('[Audio] Unexpected error in startNote:', error);
        // エラーが発生しても他の音に影響を与えないようにする
      }
    },
    [ensureAudioContextReady, stopNote]
  );

  /**
   * 再生中のノートの音量を変更
   */
  const setNoteVolume = useCallback(
    (noteId: number, volume: number) => {
      if (audioState.isAudioSupported) {
        const ctx = _sharedCtx;
        if (!ctx) return;

        const oscillator = (ctx as any)[`__note_${noteId}`];
        if (oscillator) {
          const gainNode = (oscillator as any).__gainNode;
          if (gainNode) {
            const currentTime = ctx.currentTime;
            gainNode.gain.cancelScheduledValues(currentTime);
            gainNode.gain.setValueAtTime(gainNode.gain.value, currentTime);
            gainNode.gain.linearRampToValueAtTime(volume, currentTime + 0.05);
            (oscillator as any).__targetVolume = volume;
            
            // オルガンとオルガン2の倍音の音量も調整
            const gain2 = (oscillator as any).__gain2;
            if (gain2) {
              gain2.gain.cancelScheduledValues(currentTime);
              gain2.gain.setValueAtTime(gain2.gain.value, currentTime);
              // グランドピアノの場合は40%、オルガンの場合は25%
              const harmonic2Volume = (oscillator as any).__tone === 'organ2' ? volume * 0.4 : volume * 0.25;
              gain2.gain.linearRampToValueAtTime(harmonic2Volume, currentTime + 0.05);
            }
            
            const gain3 = (oscillator as any).__gain3;
            if (gain3) {
              gain3.gain.cancelScheduledValues(currentTime);
              gain3.gain.setValueAtTime(gain3.gain.value, currentTime);
              // グランドピアノの場合は30%、オルガンの場合は15%
              const harmonic3Volume = (oscillator as any).__tone === 'organ2' ? volume * 0.3 : volume * 0.15;
              gain3.gain.linearRampToValueAtTime(harmonic3Volume, currentTime + 0.05);
            }
          }
        }
      }
    },
    [audioState.isAudioSupported]
  );

  /**
   * 持続音を停止（即座に止める）
   */
  const stopNote = useCallback(
    (noteId: number) => {
      const ctx = _sharedCtx;
      if (!ctx || ctx.state === 'closed') return;

      const oscillator = (ctx as any)[`__note_${noteId}`];
      if (oscillator) {
        const gainNode = (oscillator as any).__gainNode;
        const currentTime = ctx.currentTime;

        // 短いリリース（0.05秒）で自然に減衰させてから停止
        const releaseTime = 0.05;
        const stopTime = currentTime + releaseTime + 0.01;

        if (gainNode) {
          gainNode.gain.cancelScheduledValues(currentTime);
          gainNode.gain.setValueAtTime(gainNode.gain.value, currentTime);
          gainNode.gain.linearRampToValueAtTime(0, currentTime + releaseTime);
        }

        // オルガンとオルガン2の倍音も短いリリースで停止
        const harmonic2 = (oscillator as any).__harmonic2;
        const gain2 = (oscillator as any).__gain2;
        if (harmonic2 && gain2) {
          gain2.gain.cancelScheduledValues(currentTime);
          gain2.gain.setValueAtTime(gain2.gain.value, currentTime);
          gain2.gain.linearRampToValueAtTime(0, currentTime + releaseTime);
          try {
            harmonic2.stop(stopTime);
          } catch (e) {
            // 既に停止している場合は無視
          }
        }

        const harmonic3 = (oscillator as any).__harmonic3;
        const gain3 = (oscillator as any).__gain3;
        if (harmonic3 && gain3) {
          gain3.gain.cancelScheduledValues(currentTime);
          gain3.gain.setValueAtTime(gain3.gain.value, currentTime);
          gain3.gain.linearRampToValueAtTime(0, currentTime + releaseTime);
          try {
            harmonic3.stop(stopTime);
          } catch (e) {
            // 既に停止している場合は無視
          }
        }

        // オルガン2の4倍音も短いリリースで停止
        const harmonic4 = (oscillator as any).__harmonic4;
        const gain4 = (oscillator as any).__gain4;
        if (harmonic4 && gain4) {
          gain4.gain.cancelScheduledValues(currentTime);
          gain4.gain.setValueAtTime(gain4.gain.value, currentTime);
          gain4.gain.linearRampToValueAtTime(0, currentTime + releaseTime);
          try {
            harmonic4.stop(stopTime);
          } catch (e) {
            // 既に停止している場合は無視
          }
        }

        // オルガン2の5倍音も短いリリースで停止
        const harmonic5 = (oscillator as any).__harmonic5;
        const gain5 = (oscillator as any).__gain5;
        if (harmonic5 && gain5) {
          gain5.gain.cancelScheduledValues(currentTime);
          gain5.gain.setValueAtTime(gain5.gain.value, currentTime);
          gain5.gain.linearRampToValueAtTime(0, currentTime + releaseTime);
          try {
            harmonic5.stop(stopTime);
          } catch (e) {
            // 既に停止している場合は無視
          }
        }

        // オルガン2の6倍音も短いリリースで停止
        const harmonic6 = (oscillator as any).__harmonic6;
        const gain6 = (oscillator as any).__gain6;
        if (harmonic6 && gain6) {
          gain6.gain.cancelScheduledValues(currentTime);
          gain6.gain.setValueAtTime(gain6.gain.value, currentTime);
          gain6.gain.linearRampToValueAtTime(0, currentTime + releaseTime);
          try {
            harmonic6.stop(stopTime);
          } catch (e) {
            // 既に停止している場合は無視
          }
        }

        // オルガン2のノイズ成分も短いリリースで停止
        const noiseSource = (oscillator as any).__noiseSource;
        const noiseGain = (oscillator as any).__noiseGain;
        if (noiseSource && noiseGain) {
          noiseGain.gain.cancelScheduledValues(currentTime);
          noiseGain.gain.setValueAtTime(noiseGain.gain.value, currentTime);
          noiseGain.gain.linearRampToValueAtTime(0, currentTime + releaseTime);
          try {
            noiseSource.stop(stopTime);
          } catch (e) {
            // 既に停止している場合は無視
          }
        }

        // リリース後に停止
        try {
          oscillator.stop(stopTime);
        } catch (e) {
          // 既に停止している場合は無視
        }
        delete (ctx as any)[`__note_${noteId}`];
        _sharedActiveNoteCount = Math.max(0, _sharedActiveNoteCount - 1);
      }
    },
    []
  );

  /**
   * すべての音を停止（安全な実装、iOS対応）
   */
  const stopAllNotes = useCallback(() => {
    const ctx = _sharedCtx;
    if (!ctx || ctx.state === 'closed') return;

    try {
      const currentTime = ctx.currentTime;
      const releaseTime = 0.01; // 短いリリースタイム（iOSで確実に停止）

      // __note_ で始まるすべてのプロパティを削除
      const noteKeys = Object.keys(ctx).filter(key => key.startsWith('__note_'));
      noteKeys.forEach((key) => {
        try {
          const oscillator = (ctx as any)[key];
          if (oscillator) {
            const gainNode = (oscillator as any).__gainNode;
            if (gainNode) {
              // ゲインを即座に0にしてから停止（iOSで音が残るのを防ぐ）
              gainNode.gain.cancelScheduledValues(currentTime);
              gainNode.gain.setValueAtTime(gainNode.gain.value, currentTime);
              gainNode.gain.linearRampToValueAtTime(0, currentTime + releaseTime);
            }
            
            // 倍音も停止
            const harmonic2 = (oscillator as any).__harmonic2;
            const gain2 = (oscillator as any).__gain2;
            if (harmonic2 && gain2) {
              gain2.gain.cancelScheduledValues(currentTime);
              gain2.gain.setValueAtTime(gain2.gain.value, currentTime);
              gain2.gain.linearRampToValueAtTime(0, currentTime + releaseTime);
              try {
                harmonic2.stop(currentTime + releaseTime + 0.01);
              } catch (e) {}
            }
            
            const harmonic3 = (oscillator as any).__harmonic3;
            const gain3 = (oscillator as any).__gain3;
            if (harmonic3 && gain3) {
              gain3.gain.cancelScheduledValues(currentTime);
              gain3.gain.setValueAtTime(gain3.gain.value, currentTime);
              gain3.gain.linearRampToValueAtTime(0, currentTime + releaseTime);
              try {
                harmonic3.stop(currentTime + releaseTime + 0.01);
              } catch (e) {}
            }

            // オシレーターを停止
            try {
              oscillator.stop(currentTime + releaseTime + 0.01);
            } catch (e) {
              // 既に停止している場合は無視
            }
            delete (ctx as any)[key];
          }
        } catch (e) {
          console.warn('[Audio] Error stopping note:', e);
        }
      });
      
      _sharedActiveNoteCount = 0;
    } catch (err) {
      console.error('[Audio] Error in stopAllNotes:', err);
    }
  }, []);

  /**
   * 現在の時間を取得
   */
  const getCurrentTime = useCallback((): number => {
    if (audioState.isAudioSupported && _sharedCtx) {
      return _sharedCtx.currentTime;
    }
    return Date.now() / 1000;
  }, [audioState.isAudioSupported]);

  /**
   * スケジュールされたクリック音（将来実装）
   */
  const scheduleClick = useCallback(
    (time: number, isAccent: boolean = false, volume: number = 0.7) => {
      // 簡易実装：即時再生
      playClick(isAccent, volume);
    },
    [playClick]
  );

  /**
   * AudioContextがsuspendedなら再開（バックグラウンド対応）
   * メトロノームなどから定期的に呼び出す
   */
  const ensureAudioContextResumed = useCallback(async () => {
    const ctx = _sharedCtx;
    if (ctx && ctx.state === 'suspended') {
      try {
        await ctx.resume();
        console.log('[Audio] AudioContext resumed');
      } catch (e) {
        console.warn('[Audio] Failed to resume AudioContext:', e);
      }
    }
  }, []);

  /**
   * AudioContextの初期化を確実に待機し、準備ができていることを保証する
   * 画面がフォーカスされた時などに呼び出す
   */
  const ensureReady = useCallback(async (): Promise<boolean> => {
    return await ensureAudioContextReady();
  }, [ensureAudioContextReady]);

  /**
   * バックグラウンドでオーディオセッションをアクティブに保つ
   * expo-avのオーディオモードを再設定してセッションを維持
   */
  const keepAudioAliveForBackground = useCallback(async () => {
    try {
      const currentSettings = useSettingsStore.getState().settings;
      if (currentSettings?.backgroundPlayback) {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
      }
      await ensureAudioContextResumed();
    } catch (e) {
      console.warn('[Audio] Failed to keep audio alive:', e);
    }
  }, [ensureAudioContextResumed]);

  // WebAudio対応チェック（メトロノームで使用）
  const isWebAudioSupported = audioState.isAudioSupported;

  return {
    isReady: audioState.isReady,
    isAudioSupported: audioState.isAudioSupported,
    isWebAudioSupported,
    playTone,
    playClick,
    playSubdivisionClick,
    startNote,
    stopNote,
    setNoteVolume,
    stopAllNotes,
    scheduleClick,
    getCurrentTime,
    ensureAudioContextResumed,
    ensureReady,
    isAudioContextReadySync,
    resumeAudioContextSync,
    keepAudioAliveForBackground,
  };
}
