/**
 * セクションリストアイテム
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Section } from '../../types';
import { colors, typography, spacing } from '../../styles';
import { formatTimeSignature, formatAccentPattern } from '../../utils/programUtils';

interface SectionItemProps {
  section: Section;
  index: number;
  isActive?: boolean;
  isPlaying?: boolean;
  onPress?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onTimeSignatureSequence?: () => void;
}

export const SectionItem: React.FC<SectionItemProps> = ({
  section,
  index,
  isActive = false,
  isPlaying = false,
  onPress,
  onEdit,
  onDelete,
  onDuplicate,
  onTimeSignatureSequence,
}) => {
  return (
    <Pressable
      style={[
        styles.container,
        isActive && styles.containerActive,
        isPlaying && styles.containerPlaying,
      ]}
      onPress={onPress}
    >
      {/* セクション番号 */}
      <View style={[styles.numberBadge, isActive && styles.numberBadgeActive]}>
        <Text style={[styles.numberText, isActive && styles.numberTextActive]}>
          {index + 1}
        </Text>
      </View>

      {/* セクション情報 */}
      <View style={styles.info}>
        <Text style={[styles.name, isActive && styles.nameActive]}>
          {section.name}
        </Text>
        <View style={styles.details}>
          <Text style={styles.detailText}>{section.tempo} BPM</Text>
          <Text style={styles.detailDivider}>|</Text>
          <Text style={styles.detailText}>
            {formatTimeSignature(section.timeSignature)}
          </Text>
          <Text style={styles.detailDivider}>|</Text>
          <Text style={styles.detailText}>{section.measures}小節</Text>
          {section.accentPattern && section.accentPattern.length > 0 && (
            <>
              <Text style={styles.detailDivider}>|</Text>
              <Text style={styles.accentBadge}>
                {formatAccentPattern(section.accentPattern)}
              </Text>
            </>
          )}
          {section.countIn && (
            <>
              <Text style={styles.detailDivider}>|</Text>
              <Text style={styles.countInBadge}>カウントイン</Text>
            </>
          )}
        </View>
      </View>

      {/* アクションボタン */}
      <View style={styles.actions}>
        {onEdit && (
          <Pressable style={styles.actionButton} onPress={onEdit}>
            <Text style={styles.actionText}>編集</Text>
          </Pressable>
        )}
        {onTimeSignatureSequence && section.measures > 1 && (
          <Pressable style={styles.actionButton} onPress={onTimeSignatureSequence}>
            <Text style={styles.actionText}>拍子シーケンス</Text>
          </Pressable>
        )}
        {onDuplicate && (
          <Pressable style={styles.actionButton} onPress={onDuplicate}>
            <Text style={styles.actionText}>複製</Text>
          </Pressable>
        )}
        {onDelete && (
          <Pressable
            style={[styles.actionButton, styles.actionButtonDanger]}
            onPress={onDelete}
          >
            <Text style={[styles.actionText, styles.actionTextDanger]}>削除</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  containerActive: {
    borderColor: colors.accent.primary,
    backgroundColor: colors.background.tertiary,
  },
  containerPlaying: {
    borderColor: colors.ui.success,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  numberBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  numberBadgeActive: {
    backgroundColor: colors.accent.primary,
  },
  numberText: {
    ...typography.body,
    color: colors.text.secondary,
    fontWeight: '700',
  },
  numberTextActive: {
    color: colors.background.primary,
  },
  info: {
    flex: 1,
  },
  name: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: 4,
  },
  nameActive: {
    color: colors.accent.primary,
  },
  details: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  detailText: {
    ...typography.caption,
    color: colors.text.muted,
  },
  detailDivider: {
    ...typography.caption,
    color: colors.text.muted,
    marginHorizontal: spacing.xs,
  },
  countInBadge: {
    ...typography.caption,
    color: colors.accent.secondary,
    fontWeight: '600',
  },
  accentBadge: {
    ...typography.caption,
    color: colors.ui.info,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  actionButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 6,
    backgroundColor: colors.background.tertiary,
  },
  actionButtonDanger: {
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
  },
  actionText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  actionTextDanger: {
    color: colors.ui.error,
  },
});
