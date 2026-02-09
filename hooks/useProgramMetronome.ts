/**
 * プログラムメトロノームフック
 * 複数セクションの自動遷移と再生を管理
 */
import { useEffect, useRef, useCallback, useState } from 'react';
import { Program, Section } from '../types';
import { useAudioEngine } from './useAudioEngine';
import { getPositionInfo, getTotalBeats, isAccentBeat, getEstimatedDuration } from '../utils/programUtils';

export interface PlaybackPosition {
  sectionIndex: number;
  measureInSection: number;
  beatInMeasure: number;
  isCountIn: boolean;
  totalBeat: number;
}

interface UseProgramMetronomeReturn {
  // 再生状態
  isPlaying: boolean;
  position: PlaybackPosition | null;
  currentSection: Section | null;
  progress: number; // 0-1 の進行率（カウントインを除く）

  // 時間情報
  elapsedTime: number;  // 経過時間（秒、カウントインを除く）
  totalTime: number;    // 総演奏時間（秒、カウントインを除く）

  // テンポ調整
  tempoMultiplier: number; // テンポ倍率（1.0 = 通常、<1.0 = リタルダンド、>1.0 = アッチェレランド）

  // 制御
  play: () => void;
  stop: () => void;
  toggle: () => void;
  jumpToSection: (sectionIndex: number) => void;
  reset: () => void;
  setTempoMultiplier: (multiplier: number) => void; // テンポ倍率を設定（0.5-2.0）

  // 情報
  isAudioSupported: boolean;
}

/**
 * カウントインを除外した演奏拍数を計算
 */
function getPlayingBeats(program: Program, totalBeat: number): number {
  let beatCount = 0;
  let playingBeats = 0;

  for (const section of program.sections) {
    const beatsPerMeasure = section.timeSignature.numerator;

    // カウントイン
    if (section.countIn) {
      const countInBeats = beatsPerMeasure;
      if (totalBeat <= beatCount + countInBeats) {
        // まだカウントイン中なので演奏拍数は0
        return playingBeats;
      }
      beatCount += countInBeats;
    }

    // セクション本体
    const sectionBeats = beatsPerMeasure * section.measures;
    if (totalBeat <= beatCount + sectionBeats) {
      playingBeats += totalBeat - beatCount;
      return playingBeats;
    }
    beatCount += sectionBeats;
    playingBeats += sectionBeats;
  }

  return playingBeats;
}

/**
 * カウントインを除外した総演奏拍数を計算
 */
function getTotalPlayingBeats(program: Program): number {
  let total = 0;
  for (const section of program.sections) {
    total += section.timeSignature.numerator * section.measures;
  }
  return total;
}

/**
 * 経過時間を計算（カウントインを除く）
 */
function getElapsedTime(program: Program, totalBeat: number): number {
  let beatCount = 0;
  let elapsedSeconds = 0;

  for (const section of program.sections) {
    const beatsPerMeasure = section.timeSignature.numerator;
    const beatsPerSecond = section.tempo / 60;

    // カウントイン
    if (section.countIn) {
      const countInBeats = beatsPerMeasure;
      if (totalBeat <= beatCount + countInBeats) {
        // カウントイン中は経過時間0
        return elapsedSeconds;
      }
      beatCount += countInBeats;
    }

    // セクション本体
    const sectionBeats = beatsPerMeasure * section.measures;
    if (totalBeat <= beatCount + sectionBeats) {
      const beatsInSection = totalBeat - beatCount;
      elapsedSeconds += beatsInSection / beatsPerSecond;
      return elapsedSeconds;
    }
    beatCount += sectionBeats;
    elapsedSeconds += sectionBeats / beatsPerSecond;
  }

  return elapsedSeconds;
}

export function useProgramMetronome(program: Program | null): UseProgramMetronomeReturn {
  const { playClick, isWebAudioSupported } = useAudioEngine();

  // 状態
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState<PlaybackPosition | null>(null);
  const [currentSection, setCurrentSection] = useState<Section | null>(null);
  const [progress, setProgress] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [tempoMultiplier, setTempoMultiplier] = useState(1.0); // テンポ倍率

  // Refで拍数を管理（再レンダリングを防ぐ）
  const totalBeatRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPlayingRef = useRef(false);
  const programRef = useRef(program);
  const tempoMultiplierRef = useRef(1.0);

  // プログラムの参照を更新
  useEffect(() => {
    programRef.current = program;
    if (program) {
      setTotalTime(getEstimatedDuration(program));
    }
  }, [program]);

  // テンポ倍率の参照を更新
  useEffect(() => {
    tempoMultiplierRef.current = tempoMultiplier;
  }, [tempoMultiplier]);

  // プログラムの総拍数（演奏のみ）
  const totalPlayingBeats = program ? getTotalPlayingBeats(program) : 0;

  // 位置情報を更新
  const updatePositionState = useCallback((beat: number) => {
    const prog = programRef.current;
    if (!prog) return false;

    const posInfo = getPositionInfo(prog, beat);
    if (posInfo) {
      setPosition({
        ...posInfo,
        totalBeat: beat,
      });
      setCurrentSection(prog.sections[posInfo.sectionIndex]);
      
      // カウントインを除外したプログレスと時間を計算
      const playingBeats = getPlayingBeats(prog, beat);
      const totalPlaying = getTotalPlayingBeats(prog);
      setProgress(totalPlaying > 0 ? playingBeats / totalPlaying : 0);
      setElapsedTime(getElapsedTime(prog, beat));
      return true;
    } else {
      // プログラム終了
      setPosition(null);
      setProgress(1);
      setElapsedTime(getEstimatedDuration(prog));
      return false;
    }
  }, []);

  // セクション内の現在のテンポを計算（リタルダンド・アッチェレランド対応）
  const getCurrentTempo = useCallback((section: Section, measureInSection: number, sectionIndex: number): number => {
    const baseTempo = section.tempo;
    
    // カウントイン中はテンポ変化なし
    if (measureInSection === 0) {
      return baseTempo * tempoMultiplierRef.current;
    }
    
    // テンポ変化がない場合
    if (!section.tempoChange || section.tempoChange === 'none') {
      return baseTempo * tempoMultiplierRef.current;
    }

    // 実際の小節位置（カウントインを除く）
    const actualMeasure = measureInSection - (section.countIn ? 1 : 0);
    const totalMeasures = section.measures;

    // 次のセクションまで変化する場合
    if (section.tempoChangeToNext && sectionIndex < (programRef.current?.sections.length || 0) - 1) {
      const nextSection = programRef.current?.sections[sectionIndex + 1];
      if (nextSection && section.tempoChangeTarget !== undefined) {
        const targetTempo = section.tempoChangeTarget;
        // 現在のセクション全体 + 次のセクション全体で変化
        const totalProgress = (actualMeasure - 1) / (totalMeasures + nextSection.measures);
        
        if (section.tempoChange === 'ritardando') {
          // リタルダンド: 徐々に遅く
          const currentTempo = baseTempo + (targetTempo - baseTempo) * totalProgress;
          return Math.max(targetTempo, currentTempo) * tempoMultiplierRef.current;
        } else if (section.tempoChange === 'accelerando') {
          // アッチェレランド: 徐々に速く
          const currentTempo = baseTempo + (targetTempo - baseTempo) * totalProgress;
          return Math.min(targetTempo, currentTempo) * tempoMultiplierRef.current;
        }
      }
    } else if (section.tempoChangeTarget !== undefined) {
      // セクション内で目標テンポまで変化
      const targetTempo = section.tempoChangeTarget;
      const progress = Math.max(0, Math.min(1, (actualMeasure - 1) / totalMeasures));
      
      if (section.tempoChange === 'ritardando') {
        // リタルダンド: 徐々に遅く（目標テンポはbaseTempoより小さい）
        const currentTempo = baseTempo + (targetTempo - baseTempo) * progress;
        return Math.max(targetTempo, currentTempo) * tempoMultiplierRef.current;
      } else if (section.tempoChange === 'accelerando') {
        // アッチェレランド: 徐々に速く（目標テンポはbaseTempoより大きい）
        const currentTempo = baseTempo + (targetTempo - baseTempo) * progress;
        return Math.min(targetTempo, currentTempo) * tempoMultiplierRef.current;
      }
    }

    return baseTempo * tempoMultiplierRef.current;
  }, []);

  // ティック処理
  const tick = useCallback(() => {
    const prog = programRef.current;
    if (!prog || !isPlayingRef.current) return;

    const currentBeat = totalBeatRef.current;
    const posInfo = getPositionInfo(prog, currentBeat);

    if (!posInfo) {
      // プログラム終了
      isPlayingRef.current = false;
      setIsPlaying(false);
      setProgress(1);
      return;
    }

    // アクセントパターンを考慮してアクセントを判定
    const section = prog.sections[posInfo.sectionIndex];
    const isAccent = isAccentBeat(posInfo.beatInMeasure, section.accentPattern);

    // カウントイン中は少し音量を下げる
    const volume = posInfo.isCountIn ? 0.5 : 0.7;
    playClick(isAccent, volume);

    // 位置情報を更新
    updatePositionState(currentBeat);

    // 次の拍へ
    totalBeatRef.current = currentBeat + 1;

    // 現在のテンポを計算（リタルダンド・アッチェレランド対応）
    const currentTempo = getCurrentTempo(section, posInfo.measureInSection, posInfo.sectionIndex);
    const beatInterval = (60 / currentTempo) * 1000;
    timerRef.current = setTimeout(tick, beatInterval);
  }, [playClick, updatePositionState, getCurrentTempo]);

  // 再生開始
  const play = useCallback(() => {
    if (!program || program.sections.length === 0) return;
    if (isPlayingRef.current) return;

    isPlayingRef.current = true;
    setIsPlaying(true);

    // 最初のティックを即座に実行
    tick();
  }, [program, tick]);

  // 停止
  const stop = useCallback(() => {
    isPlayingRef.current = false;
    setIsPlaying(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // トグル
  const toggle = useCallback(() => {
    if (isPlayingRef.current) {
      stop();
    } else {
      play();
    }
  }, [play, stop]);

  // 特定セクションにジャンプ
  const jumpToSection = useCallback(
    (sectionIndex: number) => {
      if (!program || sectionIndex < 0 || sectionIndex >= program.sections.length) {
        return;
      }

      // 指定セクションの開始拍を計算
      let startBeat = 0;
      for (let i = 0; i < sectionIndex; i++) {
        const section = program.sections[i];
        const beatsPerMeasure = section.timeSignature.numerator;
        if (section.countIn) {
          startBeat += beatsPerMeasure;
        }
        startBeat += beatsPerMeasure * section.measures;
      }

      totalBeatRef.current = startBeat;
      updatePositionState(startBeat);
    },
    [program, updatePositionState]
  );

  // リセット
  const reset = useCallback(() => {
    stop();
    totalBeatRef.current = 0;
    setProgress(0);
    setTempoMultiplier(1.0);
    if (program && program.sections.length > 0) {
      setCurrentSection(program.sections[0]);
      setPosition({
        sectionIndex: 0,
        measureInSection: program.sections[0].countIn ? 0 : 1,
        beatInMeasure: 1,
        isCountIn: program.sections[0].countIn,
        totalBeat: 0,
      });
    } else {
      setCurrentSection(null);
      setPosition(null);
    }
  }, [program, stop]);

  // テンポ倍率設定
  const handleSetTempoMultiplier = useCallback((multiplier: number) => {
    const clamped = Math.max(0.5, Math.min(2.0, multiplier));
    setTempoMultiplier(clamped);
  }, []);

  // プログラム変更時にリセット
  useEffect(() => {
    reset();
  }, [program?.id]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return {
    isPlaying,
    position,
    currentSection,
    progress,
    elapsedTime,
    totalTime,
    tempoMultiplier,
    play,
    stop,
    toggle,
    jumpToSection,
    reset,
    setTempoMultiplier: handleSetTempoMultiplier,
    isAudioSupported: isWebAudioSupported,
  };
}
