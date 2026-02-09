/**
 * プログラム進行状況表示
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Program, Section } from '../../types';
import { colors, typography, spacing } from '../../styles';
import { formatTimeSignature, formatDuration, getEstimatedDuration, isAccentBeat, formatAccentPattern } from '../../utils/programUtils';
import { PlaybackPosition } from '../../hooks/useProgramMetronome';

interface ProgramProgressProps {
  program: Program;
  position: PlaybackPosition | null;
  currentSection: Section | null;
  progress: number;
  isPlaying: boolean;
}

export const ProgramProgress: React.FC<ProgramProgressProps> = ({
  program,
  position,
  currentSection,
  progress,
  isPlaying,
}) => {
  const totalDuration = getEstimatedDuration(program);

  return (
    <View style={styles.container}>
      {/* 現在のセクション情報 */}
      <View style={styles.currentSection}>
        {currentSection ? (
          <>
            <Text style={styles.sectionName}>{currentSection.name}</Text>
            <View style={styles.sectionDetails}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>テンポ</Text>
                <Text style={styles.detailValue}>{currentSection.tempo}</Text>
                <Text style={styles.detailUnit}>BPM</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>拍子</Text>
                <Text style={styles.detailValue}>
                  {formatTimeSignature(currentSection.timeSignature)}
                </Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>小節</Text>
                <Text style={styles.detailValue}>{currentSection.measures}</Text>
              </View>
              {currentSection.accentPattern && currentSection.accentPattern.length > 0 && (
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>パターン</Text>
                  <Text style={styles.detailValue}>
                    {formatAccentPattern(currentSection.accentPattern)}
                  </Text>
                </View>
              )}
            </View>
          </>
        ) : (
          <Text style={styles.sectionName}>準備完了</Text>
        )}
      </View>

      {/* 現在位置表示 */}
      {position && (
        <View style={styles.positionDisplay}>
          <View style={styles.positionRow}>
            {/* カウントイン表示 */}
            {position.isCountIn && (
              <View style={styles.countInBadge}>
                <Text style={styles.countInText}>COUNT IN</Text>
              </View>
            )}

            {/* 小節・拍表示 */}
            <View style={styles.measureBeat}>
              <Text style={styles.measureLabel}>小節</Text>
              <Text style={styles.measureValue}>
                {position.isCountIn ? '-' : position.measureInSection}
              </Text>
              <Text style={styles.measureTotal}>
                / {currentSection?.measures || '-'}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.measureBeat}>
              <Text style={styles.measureLabel}>拍</Text>
              <Text style={styles.beatValue}>{position.beatInMeasure}</Text>
              <Text style={styles.measureTotal}>
                / {currentSection?.timeSignature.numerator || '-'}
              </Text>
            </View>
          </View>

          {/* 拍インジケーター */}
          {currentSection && (
            <View style={styles.beatIndicators}>
              {Array.from({ length: currentSection.timeSignature.numerator }).map(
                (_, index) => {
                  const beatNum = index + 1;
                  const isAccent = isAccentBeat(beatNum, currentSection.accentPattern);
                  return (
                    <View
                      key={index}
                      style={[
                        styles.beatDot,
                        isAccent && styles.beatDotAccent,
                        beatNum === position.beatInMeasure && styles.beatDotActive,
                      ]}
                    />
                  );
                }
              )}
            </View>
          )}
        </View>
      )}

      {/* プログレスバー */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View
            style={[styles.progressFill, { width: `${progress * 100}%` }]}
          />
          {/* セクション区切り */}
          {program.sections.map((section, index) => {
            if (index === 0) return null;
            // 各セクションの開始位置を計算
            let position = 0;
            for (let i = 0; i < index; i++) {
              const s = program.sections[i];
              const beats = s.timeSignature.numerator * s.measures;
              const totalBeats = program.sections.reduce(
                (sum, sec) => sum + sec.timeSignature.numerator * sec.measures,
                0
              );
              position += beats / totalBeats;
            }
            return (
              <View
                key={index}
                style={[styles.sectionMarker, { left: `${position * 100}%` }]}
              />
            );
          })}
        </View>
        <View style={styles.progressLabels}>
          <Text style={styles.progressTime}>
            {formatDuration(totalDuration * progress)}
          </Text>
          <Text style={styles.progressTime}>
            {formatDuration(totalDuration)}
          </Text>
        </View>
      </View>

      {/* セクション一覧（小型） */}
      <View style={styles.sectionList}>
        {program.sections.map((section, index) => (
          <View
            key={section.id}
            style={[
              styles.sectionPill,
              position?.sectionIndex === index && styles.sectionPillActive,
            ]}
          >
            <Text
              style={[
                styles.sectionPillText,
                position?.sectionIndex === index && styles.sectionPillTextActive,
              ]}
            >
              {index + 1}. {section.name}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.secondary,
    borderRadius: 16,
    padding: spacing.lg,
  },
  currentSection: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionName: {
    ...typography.title,
    color: colors.accent.primary,
    marginBottom: spacing.sm,
  },
  sectionDetails: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  detailItem: {
    alignItems: 'center',
  },
  detailLabel: {
    ...typography.caption,
    color: colors.text.muted,
    marginBottom: 2,
  },
  detailValue: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: '700',
  },
  detailUnit: {
    ...typography.caption,
    color: colors.text.muted,
  },
  positionDisplay: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  positionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  countInBadge: {
    backgroundColor: colors.accent.secondary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 4,
  },
  countInText: {
    ...typography.caption,
    color: colors.background.primary,
    fontWeight: '700',
  },
  measureBeat: {
    alignItems: 'center',
  },
  measureLabel: {
    ...typography.caption,
    color: colors.text.muted,
    marginBottom: 2,
  },
  measureValue: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.text.primary,
    fontFamily: 'monospace',
  },
  beatValue: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.accent.primary,
    fontFamily: 'monospace',
  },
  measureTotal: {
    ...typography.caption,
    color: colors.text.muted,
  },
  divider: {
    width: 2,
    height: 60,
    backgroundColor: colors.background.tertiary,
  },
  beatIndicators: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  beatDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.background.tertiary,
  },
  beatDotAccent: {
    backgroundColor: colors.text.muted,
  },
  beatDotActive: {
    backgroundColor: colors.accent.primary,
    transform: [{ scale: 1.2 }],
  },
  progressContainer: {
    marginBottom: spacing.md,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.background.tertiary,
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent.primary,
    borderRadius: 4,
  },
  sectionMarker: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: colors.background.primary,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  progressTime: {
    ...typography.caption,
    color: colors.text.muted,
    fontFamily: 'monospace',
  },
  sectionList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'center',
  },
  sectionPill: {
    backgroundColor: colors.background.tertiary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  sectionPillActive: {
    borderColor: colors.accent.primary,
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
  },
  sectionPillText: {
    ...typography.caption,
    color: colors.text.muted,
  },
  sectionPillTextActive: {
    color: colors.accent.primary,
    fontWeight: '600',
  },
});
