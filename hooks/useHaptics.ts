/**
 * ハプティクス（振動フィードバック）フック
 * 設定ストアの hapticEnabled を自動参照
 */
import { useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { useSettingsStore } from '../stores/useSettingsStore';

interface UseHapticsReturn {
  // ライト振動（ボタンタップなど）
  lightImpact: () => void;
  // ミディアム振動（確認アクションなど）
  mediumImpact: () => void;
  // ヘビー振動（重要アクションなど）
  heavyImpact: () => void;
  // 成功振動
  successNotification: () => void;
  // 警告振動
  warningNotification: () => void;
  // エラー振動
  errorNotification: () => void;
  // メトロノームビート用
  beatImpact: (isAccent: boolean) => void;
  // ハプティクスが利用可能か
  isAvailable: boolean;
}

export function useHaptics(): UseHapticsReturn {
  const { settings } = useSettingsStore();
  // Webでは振動は利用不可、設定でOFFの場合も無効
  const isAvailable = Platform.OS !== 'web' && settings.hapticEnabled;

  const lightImpact = useCallback(() => {
    if (isAvailable) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [isAvailable]);

  const mediumImpact = useCallback(() => {
    if (isAvailable) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [isAvailable]);

  const heavyImpact = useCallback(() => {
    if (isAvailable) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
  }, [isAvailable]);

  const successNotification = useCallback(() => {
    if (isAvailable) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [isAvailable]);

  const warningNotification = useCallback(() => {
    if (isAvailable) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  }, [isAvailable]);

  const errorNotification = useCallback(() => {
    if (isAvailable) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [isAvailable]);

  const beatImpact = useCallback(
    (isAccent: boolean) => {
      if (isAvailable) {
        if (isAccent) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } else {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }
    },
    [isAvailable]
  );

  return {
    lightImpact,
    mediumImpact,
    heavyImpact,
    successNotification,
    warningNotification,
    errorNotification,
    beatImpact,
    isAvailable,
  };
}
