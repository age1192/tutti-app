/**
 * プログラム再生画面（横画面最適化・視覚的フィードバック強化）
 */
import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ScrollView,
  Dimensions,
  StatusBar,
  Platform,
} from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ScreenOrientation from 'expo-screen-orientation';
import { colors, typography, spacing } from '../../styles';
import { useProgramStore } from '../../stores';
import { useProgramMetronome, useKeepAwake, useHaptics } from '../../hooks';
import { getProgram, formatDuration } from '../../utils/programUtils';
import { LANDSCAPE_SAFE_AREA_INSET } from '../../utils/constants';
import { BeatIndicator, BeatPulse } from '../../components/metronome';

export default function ProgramPlayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currentProgram, setCurrentProgram } = useProgramStore();
  const insets = useSafeAreaInsets();
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));
  const isLandscape = dimensions.width > dimensions.height;
  const { beatImpact } = useHaptics();

  // ビートパルス用の状態
  const [pulseActive, setPulseActive] = useState(false);
  const [lastBeat, setLastBeat] = useState(0);

  // 演奏中は画面を点灯させ続ける
  useKeepAwake(currentProgram !== null, 'program-play');

  const {
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
    setTempoMultiplier,
    isAudioSupported,
  } = useProgramMetronome(currentProgram);

  // 画面サイズ変更を監視
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });
    return () => subscription.remove();
  }, []);

  // 横画面固定（home.tsxで管理されているが、念のため）
  useFocusEffect(
    useCallback(() => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      
      return () => {
        stop();
        // 画面を離れる時は何もしない（home.tsxで管理）
      };
    }, [stop])
  );

  // ビートが変わったらパルスとハプティクス
  useEffect(() => {
    if (isPlaying && position?.beatInMeasure !== lastBeat && (position?.beatInMeasure || 0) > 0) {
      setPulseActive(true);
      const isAccent = position?.beatInMeasure === 1;
      beatImpact(isAccent);
      setLastBeat(position?.beatInMeasure || 0);

      const timer = setTimeout(() => setPulseActive(false), 100);
      return () => clearTimeout(timer);
    }
  }, [position?.beatInMeasure, isPlaying, lastBeat, beatImpact]);

  // 停止時にリセット
  useEffect(() => {
    if (!isPlaying) {
      setLastBeat(0);
      setPulseActive(false);
    }
  }, [isPlaying]);

  // プログラムを読み込み
  useEffect(() => {
    const loadProgram = async () => {
      if (id && (!currentProgram || currentProgram.id !== id)) {
        const program = await getProgram(id);
        if (program) {
          setCurrentProgram(program);
        } else {
          Alert.alert('エラー', 'プログラムが見つかりません', [
            { text: 'OK', onPress: () => router.back() },
          ]);
        }
      }
    };
    loadProgram();
  }, [id]);

  // 戻る処理
  const handleBack = () => {
    stop();
    router.back();
  };

  if (!currentProgram) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>読み込み中...</Text>
      </View>
    );
  }

  // 横画面時のノッチ回避: 左右のみ 44pt を採用
  const safePadding = {
    top: insets.top,
    bottom: insets.bottom,
    left: Math.max(insets.left, LANDSCAPE_SAFE_AREA_INSET),
    right: Math.max(insets.right, LANDSCAPE_SAFE_AREA_INSET),
  };

  // 現在のセクション内のプログレス（小節単位）
  const sectionProgress = currentSection && position 
    ? (position.measureInSection - 1 + (position.beatInMeasure / currentSection.timeSignature.numerator)) / currentSection.measures
    : 0;

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: safePadding.top,
          paddingBottom: safePadding.bottom,
          paddingLeft: safePadding.left,
          paddingRight: safePadding.right,
        },
      ]}
    >
      <StatusBar hidden={isLandscape} />

      {/* 上段: ヘッダー */}
      <View style={styles.header}>
        <Text style={styles.programName} numberOfLines={1}>
          {currentProgram.name}
        </Text>

        {/* 再生コントロール */}
        <View style={styles.playControls}>
          <Pressable style={styles.resetBtn} onPress={reset}>
            <Text style={styles.resetBtnText}>↺</Text>
          </Pressable>
          <Pressable style={styles.playBtn} onPress={toggle}>
            <Text style={styles.playBtnText}>{isPlaying ? '一時停止' : '再生'}</Text>
          </Pressable>
          <Pressable style={styles.stopBtn} onPress={stop}>
            <Text style={styles.stopBtnText}>停止</Text>
          </Pressable>
        </View>

      </View>

      {/* メインエリア: 2カラム */}
      <View style={styles.mainArea}>
        {/* 左: 現在の再生情報（視覚的に強調） */}
        <View style={styles.nowPlayingPanel}>
          {/* ビートパルス */}
          <View style={styles.pulseContainer}>
              <BeatPulse
                isActive={pulseActive}
                isAccent={position?.beatInMeasure === 1}
                size={70}
              />
          </View>

          {/* テンポ表示 */}
          <Text style={styles.tempoDisplay}>
            {currentSection?.tempo || 120}
          </Text>
          <Text style={styles.tempoLabel}>BPM</Text>

          {/* 拍インジケーター */}
          {currentSection && (
            <View style={styles.beatIndicatorContainer}>
              <BeatIndicator
                beats={currentSection.timeSignature.numerator}
                currentBeat={position?.beatInMeasure || 0}
                isPlaying={isPlaying}
                size="normal"
              />
            </View>
          )}

          {/* セクション情報 */}
          <View style={styles.sectionInfo}>
            <Text style={styles.sectionName}>
              {currentSection?.name || 'ー'}
            </Text>
            <Text style={styles.measureDisplay}>
              小節 <Text style={styles.measureNumber}>{position?.measureInSection || 0}</Text> / {currentSection?.measures || 0}
            </Text>
          </View>

          {/* セクション内プログレスバー */}
          <View style={styles.sectionProgressBar}>
            <View style={[styles.sectionProgressFill, { width: `${sectionProgress * 100}%` }]} />
          </View>
        </View>

        {/* 右: セクションリスト（縦スクロール） */}
        <View style={styles.sectionListPanel}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {currentProgram.sections.map((section, index) => {
              const isCurrentSection = position?.sectionIndex === index;
              const isPastSection = (position?.sectionIndex || 0) > index;
              
              // 各セクションの小節プログレス
              const thisSectionProgress = isCurrentSection ? sectionProgress : (isPastSection ? 1 : 0);
              
              return (
                <Pressable
                  key={section.id}
                  style={[
                    styles.sectionRow,
                    isCurrentSection && styles.sectionRowActive,
                    isPastSection && styles.sectionRowPast,
                  ]}
                  onPress={() => jumpToSection(index)}
                >
                  {/* 進行状況バー（背景） */}
                  <View 
                    style={[
                      styles.sectionProgressBg,
                      { width: `${thisSectionProgress * 100}%` },
                      isCurrentSection && styles.sectionProgressBgActive,
                    ]} 
                  />
                  
                  <View style={styles.sectionRowContent}>
                    <Text style={[
                      styles.sectionIndex,
                      isCurrentSection && styles.sectionTextActive,
                    ]}>
                      {index + 1}
                    </Text>
                    <Text style={[
                      styles.sectionRowName,
                      isCurrentSection && styles.sectionTextActive,
                    ]} numberOfLines={1}>
                      {section.name}
                    </Text>
                    <Text style={[
                      styles.sectionRowMeta,
                      isCurrentSection && styles.sectionTextActive,
                    ]}>
                      {section.measures}小節
                    </Text>
                    <Text style={[
                      styles.sectionRowMeta,
                      isCurrentSection && styles.sectionTextActive,
                    ]}>
                      {section.timeSignature.numerator}/{section.timeSignature.denominator}
                    </Text>
                    <Text style={[
                      styles.sectionRowTempo,
                      isCurrentSection && styles.sectionTextActive,
                    ]}>
                      ♩={section.tempo}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>

      {/* 全体プログレスバー（演奏時間表示） */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        <View style={styles.progressTimeContainer}>
          <Text style={styles.progressText}>
            {formatDuration(elapsedTime)}
          </Text>
          <Text style={styles.progressTextDivider}>/</Text>
          <Text style={styles.progressText}>
            {formatDuration(totalTime)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  loading: {
    flex: 1,
    backgroundColor: colors.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: colors.text.muted,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: 6,
    backgroundColor: colors.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  programName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
    marginHorizontal: spacing.sm,
  },
  playControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  resetBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resetBtnText: {
    fontSize: 16,
    color: colors.text.secondary,
    fontWeight: '700', // ボールドに
  },
  playBtn: {
    minWidth: 80,
    height: 44,
    paddingHorizontal: spacing.sm,
    borderRadius: 22,
    backgroundColor: colors.functional.rhythm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stopBtn: {
    minWidth: 56,
    height: 44,
    paddingHorizontal: spacing.sm,
    borderRadius: 22,
    backgroundColor: colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
  },
  mainArea: {
    flex: 1,
    flexDirection: 'row',
    padding: spacing.sm,
    gap: spacing.sm,
  },
  // 左パネル: 現在の再生情報
  nowPlayingPanel: {
    width: 180,
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  pulseContainer: {
    marginBottom: spacing.xs,
  },
  tempoDisplay: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.functional.rhythm,
    fontFamily: 'monospace',
  },
  tempoLabel: {
    fontSize: 12,
    color: colors.text.muted,
    marginTop: -4,
  },
  beatIndicatorContainer: {
    marginVertical: spacing.sm,
  },
  sectionInfo: {
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  sectionName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  measureDisplay: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 4,
  },
  measureNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.functional.rhythm,
  },
  sectionProgressBar: {
    width: '100%',
    height: 6,
    backgroundColor: colors.background.tertiary,
    borderRadius: 3,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  sectionProgressFill: {
    height: '100%',
    backgroundColor: colors.functional.rhythm,
    borderRadius: 3,
  },
  // 右パネル: セクションリスト
  sectionListPanel: {
    flex: 1,
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    padding: spacing.sm,
  },
  sectionRow: {
    position: 'relative',
    borderRadius: 8,
    marginBottom: 4,
    overflow: 'hidden',
    backgroundColor: colors.background.tertiary,
  },
  sectionRowActive: {
    backgroundColor: colors.functional.rhythm,
  },
  sectionRowPast: {
    opacity: 0.5,
  },
  sectionProgressBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  sectionProgressBgActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  sectionRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    gap: spacing.sm,
  },
  sectionIndex: {
    width: 24,
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.muted,
    textAlign: 'center',
  },
  sectionRowName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
  },
  sectionRowMeta: {
    fontSize: 11,
    color: colors.text.secondary,
    minWidth: 40,
    textAlign: 'center',
  },
  sectionRowTempo: {
    fontSize: 11,
    color: colors.text.secondary,
    fontFamily: 'monospace',
    minWidth: 50,
    textAlign: 'right',
  },
  sectionTextActive: {
    color: '#FFFFFF',
  },
  // 全体プログレスバー
  progressBar: {
    height: 24,
    backgroundColor: colors.background.tertiary,
    position: 'relative',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.functional.rhythm,
  },
  progressTimeContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.primary,
    fontFamily: 'monospace',
  },
  progressTextDivider: {
    fontSize: 12,
    color: colors.text.muted,
  },
  tempoAdjustControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  tempoAdjustBtn: {
    backgroundColor: colors.background.tertiary,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: 6,
  },
  tempoAdjustBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  tempoMultiplierText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.functional.rhythm,
    minWidth: 40,
    textAlign: 'center',
  },
});
