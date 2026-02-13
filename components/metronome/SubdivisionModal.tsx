/**
 * 拍分割（サブディビジョン）モーダル
 * 左右からスライドインするモーダルで音量調整を行う
 */
import { View, Text, StyleSheet, Pressable, Modal, Platform } from 'react-native';
import { useEffect } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import Slider from '@react-native-community/slider';
import { colors, typography, spacing } from '../../styles';
import { SubdivisionSettings, SubdivisionType } from '../../types';

interface SubdivisionModalProps {
  visible: boolean;
  settings: SubdivisionSettings;
  onVolumeChange: (type: SubdivisionType, volume: number) => void;
  onClose: () => void;
  position: 'left' | 'right';
}

// 分割タイプの定義
const SUBDIVISIONS: {
  type: SubdivisionType;
  label: string;
  symbol: string;
  description: string;
}[] = [
  { type: 'quarter', label: '4分', symbol: '♩', description: '1拍に1回' },
  { type: 'eighth', label: '8分', symbol: '♫', description: '1拍に2回' },
  { type: 'triplet', label: '3連', symbol: '3', description: '1拍に3回' },
  { type: 'sixteenth', label: '16分', symbol: '𝅘𝅥𝅯', description: '1拍に4回' },
];

export function SubdivisionModal({
  visible,
  settings,
  onVolumeChange,
  onClose,
  position,
}: SubdivisionModalProps) {
  const translateX = useSharedValue(position === 'left' ? -300 : 300);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateX.value = withSpring(0, {
        damping: 20,
        stiffness: 90,
      });
      opacity.value = withTiming(1, { duration: 200 });
    } else {
      opacity.value = withTiming(0, { duration: 200 });
      translateX.value = withSpring(
        position === 'left' ? -300 : 300,
        {
          damping: 20,
          stiffness: 90,
        }
      );
    }
  }, [visible, position]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: opacity.value * 0.3,
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      supportedOrientations={['landscape', 'landscape-left', 'landscape-right']}
      onRequestClose={onClose}
      presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
    >
      <View style={styles.container}>
        {/* バックドロップ */}
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={styles.backdropPressable} onPress={onClose} />
        </Animated.View>

        {/* モーダルコンテンツ */}
        <Animated.View
          style={[
            styles.modal,
            position === 'left' ? styles.modalLeft : styles.modalRight,
            animatedStyle,
          ]}
        >
          <View style={styles.header}>
            <Text style={styles.title}>拍分割</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </Pressable>
          </View>

          <View style={styles.content}>
            {SUBDIVISIONS.map((subdivision) => {
              const volume = settings[subdivision.type];
              const isActive = volume > 0;

              return (
                <View key={subdivision.type} style={styles.item}>
                  {/* ヘッダー: ラベルとシンボル */}
                  <Pressable
                    style={[
                      styles.itemHeader,
                      isActive && styles.itemHeaderActive,
                    ]}
                    onPress={() => {
                      if (isActive) {
                        onVolumeChange(subdivision.type, 0);
                      } else {
                        onVolumeChange(
                          subdivision.type,
                          subdivision.type === 'quarter' ? 1.0 : 0.5
                        );
                      }
                    }}
                  >
                    <Text style={[styles.symbol, isActive && styles.symbolActive]}>
                      {subdivision.symbol}
                    </Text>
                    <View style={styles.labelContainer}>
                      <Text style={[styles.label, isActive && styles.labelActive]}>
                        {subdivision.label}
                      </Text>
                      <Text style={styles.description}>{subdivision.description}</Text>
                    </View>
                  </Pressable>

                  {/* スライダー */}
                  <View style={styles.sliderContainer}>
                    <Slider
                      style={styles.slider}
                      minimumValue={0}
                      maximumValue={1}
                      step={0.05}
                      value={volume}
                      onValueChange={(value) =>
                        onVolumeChange(subdivision.type, value)
                      }
                      minimumTrackTintColor={
                        isActive ? colors.functional.rhythm : colors.border.default
                      }
                      maximumTrackTintColor={colors.border.default}
                      thumbTintColor={
                        isActive ? colors.functional.rhythm : colors.text.muted
                      }
                    />
                    <Text
                      style={[
                        styles.volumeText,
                        isActive && styles.volumeTextActive,
                      ]}
                    >
                      {Math.round(volume * 100)}%
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  backdropPressable: {
    flex: 1,
  },
  modal: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 300,
    backgroundColor: colors.background.secondary,
    borderRightWidth: 1,
    borderRightColor: colors.border.default,
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  modalLeft: {
    left: 0,
  },
  modalRight: {
    right: 0,
    borderRightWidth: 0,
    borderLeftWidth: 1,
    borderLeftColor: colors.border.default,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  title: {
    ...typography.heading,
    fontSize: 18,
    color: colors.text.primary,
    fontWeight: '600',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  item: {
    gap: spacing.md,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.tertiary,
    borderRadius: 8,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  itemHeaderActive: {
    backgroundColor: colors.functional.rhythm,
  },
  symbol: {
    fontSize: 24,
    color: colors.text.muted,
  },
  symbolActive: {
    color: '#FFFFFF',
  },
  labelContainer: {
    flex: 1,
  },
  label: {
    ...typography.body,
    color: colors.text.secondary,
    fontWeight: '600',
    fontSize: 16,
  },
  labelActive: {
    color: '#FFFFFF',
  },
  description: {
    ...typography.caption,
    color: colors.text.muted,
    fontSize: 11,
    marginTop: 2,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  volumeText: {
    ...typography.caption,
    color: colors.text.muted,
    minWidth: 45,
    textAlign: 'right',
    fontSize: 13,
  },
  volumeTextActive: {
    color: colors.text.secondary,
    fontWeight: '600',
  },
});
