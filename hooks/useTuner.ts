/**
 * チューナーフック
 * マイク入力から音程を測定
 * react-native-audio-api を使用（Native/Web両対応）
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import {
  AudioContext,
  AudioRecorder,
  AudioManager,
  AnalyserNode,
} from 'react-native-audio-api';

export interface TunerResult {
  frequency: number;      // 検出された周波数（Hz）
  note: string;          // ノート名（例: "A4"）
  cents: number;         // 基準ピッチからのセント差（-50〜+50）
  isDetected: boolean;    // 音が検出されているか
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * 周波数からMIDIノート番号を計算
 */
function frequencyToMidi(frequency: number): number {
  return 69 + 12 * Math.log2(frequency / 440);
}

/**
 * MIDIノート番号から周波数を計算
 */
function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * MIDIノート番号からノート名を取得
 */
function midiToNoteName(midi: number): string {
  const noteIndex = Math.round(midi) % 12;
  const octave = Math.floor(Math.round(midi) / 12) - 1;
  return `${NOTE_NAMES[noteIndex]}${octave}`;
}

/**
 * 周波数からセント差を計算
 */
function frequencyToCents(frequency: number, referenceFrequency: number): number {
  return 1200 * Math.log2(frequency / referenceFrequency);
}

/**
 * オートコリレーション法で基本周波数を検出
 * これは最も信頼性の高いピッチ検出アルゴリズムの一つ
 * 多くのチューナーアプリで採用されている
 */
function detectPitchAutocorrelation(
  dataArray: Uint8Array,
  sampleRate: number,
  sensitivity: number = 50
): number | null {
  const bufferSize = dataArray.length;
  
  // データを-1.0〜1.0の範囲に正規化
  const normalizedData = new Float32Array(bufferSize);
  for (let i = 0; i < bufferSize; i++) {
    normalizedData[i] = (dataArray[i] - 128) / 128.0;
  }
  
  // RMS（Root Mean Square）で音量レベルを計算
  let rms = 0;
  for (let i = 0; i < bufferSize; i++) {
    rms += normalizedData[i] * normalizedData[i];
  }
  rms = Math.sqrt(rms / bufferSize);
  
  // 感度に応じた閾値（sensitivity 高 = 低い閾値で検出しやすい）
  // ネイティブ環境では入力が小さいことがあるため閾値を低めに
  const rmsThreshold = 0.0015 + ((100 - sensitivity) / 100) * 0.02;
  if (rms < rmsThreshold) {
    return null; // 音量が小さすぎる
  }

  // 検出範囲（80Hz〜2000Hz）
  const minPeriod = Math.floor(sampleRate / 2000); // 最小周期（最高周波数）
  const maxPeriod = Math.floor(sampleRate / 80);   // 最大周期（最低周波数）
  
  // オートコリレーションを計算
  const correlations = new Float32Array(maxPeriod + 1);
  
  for (let lag = minPeriod; lag <= maxPeriod; lag++) {
    let correlation = 0;
    for (let i = 0; i < bufferSize - lag; i++) {
      correlation += normalizedData[i] * normalizedData[i + lag];
    }
    correlations[lag] = correlation;
  }
  
  // 最初の有効なピークを探す（ノイズを無視するため）
  // まず相関値の最大値を見つける
  let maxCorrelation = 0;
  for (let lag = minPeriod; lag <= maxPeriod; lag++) {
    if (correlations[lag] > maxCorrelation) {
      maxCorrelation = correlations[lag];
    }
  }
  
  // 閾値を設定（最大相関の70%以上のピークを探す）
  const correlationThreshold = maxCorrelation * 0.7;
  
  // 最初のピークを探す（周期の開始点）
  let bestPeriod = -1;
  let bestCorrelation = correlationThreshold;
  
  // 立ち上がり検出：相関が閾値を超えて、その後下がり始めるポイントを探す
  let rising = false;
  for (let lag = minPeriod; lag <= maxPeriod - 1; lag++) {
    if (correlations[lag] > correlationThreshold) {
      rising = true;
    }
    if (rising && correlations[lag] > correlations[lag + 1] && correlations[lag] > bestCorrelation) {
      bestCorrelation = correlations[lag];
      bestPeriod = lag;
      break; // 最初のピークで十分
    }
  }
  
  if (bestPeriod === -1) {
    return null;
  }
  
  // 放物線補間で精度を向上
  if (bestPeriod > minPeriod && bestPeriod < maxPeriod) {
    const y0 = correlations[bestPeriod - 1];
    const y1 = correlations[bestPeriod];
    const y2 = correlations[bestPeriod + 1];
    const denominator = y0 - 2 * y1 + y2;
    if (Math.abs(denominator) > 0.0001) {
      const delta = 0.5 * (y0 - y2) / denominator;
      if (Math.abs(delta) < 1) {
        bestPeriod = bestPeriod + delta;
      }
    }
  }
  
  const frequency = sampleRate / bestPeriod;
  
  // 最終範囲チェック
  if (frequency < 80 || frequency > 2000) {
    return null;
  }
  
  return frequency;
}

/**
 * FFT解析で基本周波数を検出（バックアップ用）
 */
function detectPitchFFT(
  dataArray: Uint8Array,
  sampleRate: number,
  fftSize: number,
  sensitivity: number = 50
): number | null {
  let maxValue = 0;
  let maxIndex = 0;

  const minBin = Math.max(1, Math.floor((80 * fftSize) / sampleRate));
  const maxBin = Math.min(dataArray.length - 2, Math.floor((2000 * fftSize) / sampleRate));

  for (let i = minBin; i < maxBin; i++) {
    if (dataArray[i] > maxValue) {
      maxValue = dataArray[i];
      maxIndex = i;
    }
  }

  // 感度に応じた閾値
  const threshold = 5 + ((100 - sensitivity) / 100) * 30;
  if (maxValue < threshold) {
    return null;
  }

  // 放物線補間でピーク位置を精密化
  const y0 = maxIndex > 0 ? dataArray[maxIndex - 1] : 0;
  const y1 = dataArray[maxIndex];
  const y2 = maxIndex < dataArray.length - 1 ? dataArray[maxIndex + 1] : 0;
  const denominator = y0 - 2 * y1 + y2;
  let peakBin = maxIndex;
  if (Math.abs(denominator) > 0.0001) {
    const delta = 0.5 * (y0 - y2) / denominator;
    if (Math.abs(delta) < 1) {
      peakBin = maxIndex + delta;
    }
  }

  const frequency = (peakBin * sampleRate) / fftSize;
  return frequency >= 80 && frequency <= 2000 ? frequency : null;
}

export function useTuner(referencePitch: number = 440, sensitivity: number = 50) {
  const [result, setResult] = useState<TunerResult>({
    frequency: 0,
    note: '',
    cents: 0,
    isDetected: false,
  });
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [volumeLevel, setVolumeLevel] = useState(0); // 0〜100、音量インジケーター用

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const frequencyDataArrayRef = useRef<Uint8Array | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isActiveRef = useRef(false);
  const sensitivityRef = useRef(sensitivity);

  // sensitivityの変更を追跡
  useEffect(() => {
    sensitivityRef.current = sensitivity;
  }, [sensitivity]);

  // isActiveの状態をrefで追跡（コールバック内で最新値を参照するため）
  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  // チューナーを開始
  const start = useCallback(async () => {
    if (isActive) return;

    try {
      // マイク権限をリクエスト
      const permissions = await AudioManager.requestRecordingPermissions();
      if (permissions !== 'Granted') {
        setError('マイク権限が必要です');
        return;
      }

      // オーディオセッションを設定（playAndRecordモード）
      AudioManager.setAudioSessionOptions({
        iosCategory: 'playAndRecord',
        iosMode: 'default',
        iosOptions: [],
      });

      // オーディオセッションをアクティブ化
      const sessionActive = await AudioManager.setAudioSessionActivity(true);
      if (!sessionActive) {
        setError('オーディオセッションの開始に失敗しました');
        return;
      }

      // AudioContextを作成
      const audioContext = new AudioContext({ sampleRate: 44100 });
      audioContextRef.current = audioContext;

      // AudioRecorderを作成
      const audioRecorder = new AudioRecorder();
      audioRecorderRef.current = audioRecorder;

      // RecorderAdapterを作成してAudioRecorderと接続
      const recorderAdapter = audioContext.createRecorderAdapter();
      audioRecorder.connect(recorderAdapter);

      // AnalyserNodeを作成（FFT 4096で低域分解能を向上）
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0.3; // 応答を速く（針の反応を良くする）
      analyserRef.current = analyser;

      // 接続: RecorderAdapter -> Analyser -> Destination
      // AnalyserNodeの出力も接続する必要がある（データが流れるため）
      recorderAdapter.connect(analyser);
      analyser.connect(audioContext.destination); // 出力を接続（重要：これがないとデータが流れない）

      // データ配列を準備（周波数用・時間領域用）
      dataArrayRef.current = new Uint8Array(analyser.fftSize);
      frequencyDataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);

      // AudioContextがsuspendedなら再開
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      // 録音開始（設定を明示的に指定）
      const startResult = audioRecorder.start({
        sampleRate: 44100,
        numberOfChannels: 1,
        bitDepth: 16,
      });
      
      if (startResult.status === 'error') {
        const errorMsg = startResult.message || '録音開始に失敗しました';
        console.error('[Tuner] AudioRecorder start error:', errorMsg);
        setError(`録音開始エラー: ${errorMsg}`);
        return;
      }
      
      console.log('[Tuner] AudioRecorder started successfully');

      isActiveRef.current = true;
      setIsActive(true);
      setError(null);

      // 更新ループを開始
      const updateLoop = () => {
        if (!isActiveRef.current || !analyserRef.current || !dataArrayRef.current || !frequencyDataArrayRef.current) {
          return;
        }

        const sampleRate = audioContextRef.current?.sampleRate || 44100;
        const fftSize = analyserRef.current?.fftSize || 4096;

        // 時間領域データを取得
        analyserRef.current.getByteTimeDomainData(dataArrayRef.current);
        const data = dataArrayRef.current;

        // 音量レベル（RMS）を計算してインジケーター用に0〜100で表示
        let sumSquares = 0;
        let maxValue = 0;
        let minValue = 255;
        for (let i = 0; i < data.length; i++) {
          const n = (data[i] - 128) / 128;
          sumSquares += n * n;
          maxValue = Math.max(maxValue, data[i]);
          minValue = Math.min(minValue, data[i]);
        }
        const rms = Math.sqrt(sumSquares / data.length);
        // データが動いているか確認（デバッグ用）
        const dataRange = maxValue - minValue;
        if (dataRange < 2) {
          // データがほとんど動いていない（マイク入力がない可能性）
          setVolumeLevel(0);
        } else {
          const level = Math.min(100, Math.round(rms * 500)); // 感度を上げる
          setVolumeLevel(level);
        }

        // 1. オートコリレーション法で検出（最も信頼性が高い）
        let frequency = detectPitchAutocorrelation(
          data,
          sampleRate,
          sensitivityRef.current
        );

        // 2. オートコリレーションで検出できなければFFTを試す
        if (!frequency) {
          analyserRef.current.getByteFrequencyData(frequencyDataArrayRef.current);
          frequency = detectPitchFFT(
            frequencyDataArrayRef.current,
            sampleRate,
            fftSize,
            sensitivityRef.current
          );
        }

        if (frequency && frequency > 80 && frequency < 2000) {
          const midi = frequencyToMidi(frequency);
          const note = midiToNoteName(midi);
          const referenceFrequency = midiToFrequency(Math.round(midi));
          const cents = frequencyToCents(frequency, referenceFrequency);

          setResult({
            frequency,
            note,
            cents: Math.max(-50, Math.min(50, cents)),
            isDetected: true,
          });
        } else {
          setResult((prev) => ({ ...prev, isDetected: false }));
        }

        if (isActiveRef.current) {
          animationFrameRef.current = requestAnimationFrame(updateLoop);
        }
      };

      // 少し遅延させてから更新を開始（初期化を待つ）
      setTimeout(() => {
        if (isActiveRef.current) {
          updateLoop();
        }
      }, 200);

    } catch (err) {
      console.error('Failed to start tuner:', err);
      const errorMessage = err instanceof Error ? err.message : 'チューナーの開始に失敗しました';
      setError(errorMessage);
      isActiveRef.current = false;
      setIsActive(false);
    }
  }, [isActive]);

  // チューナーを停止
  const stop = useCallback(() => {
    isActiveRef.current = false;
    setIsActive(false);

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // AnalyserNodeの接続を切断
    if (analyserRef.current && audioContextRef.current) {
      try {
        analyserRef.current.disconnect();
      } catch (e) {
        console.warn('[Tuner] Failed to disconnect analyser:', e);
      }
    }

    if (audioRecorderRef.current) {
      try {
        audioRecorderRef.current.stop();
        audioRecorderRef.current.disconnect();
      } catch (e) {
        console.warn('Error stopping recorder:', e);
      }
      audioRecorderRef.current = null;
    }

    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) {
        console.warn('Error closing audio context:', e);
      }
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    dataArrayRef.current = null;
    frequencyDataArrayRef.current = null;

    // オーディオセッションを非アクティブ化
    AudioManager.setAudioSessionActivity(false);

    setResult({
      frequency: 0,
      note: '',
      cents: 0,
      isDetected: false,
    });
    setError(null);
  }, []);

  // クリーンアップ
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    result,
    isActive,
    error,
    start,
    stop,
    volumeLevel, // 0〜100、マイク入力の音量インジケーター用
  };
}
