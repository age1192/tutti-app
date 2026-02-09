/**
 * 画面常時点灯フック
 */
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

/**
 * 画面を常時点灯に保つフック
 * @param active - trueの場合、画面を点灯させ続ける
 * @param tag - 識別用タグ（複数の場所で使う場合）
 */
export function useKeepAwake(active: boolean = true, tag?: string): void {
  const isActivatedRef = useRef(false);

  useEffect(() => {
    // Web環境では機能しないためスキップ
    if (Platform.OS === 'web') {
      return;
    }

    const activate = async () => {
      if (active && !isActivatedRef.current) {
        try {
          await activateKeepAwakeAsync(tag);
          isActivatedRef.current = true;
        } catch (error) {
          console.warn('Failed to activate keep awake:', error);
        }
      }
    };

    const deactivate = () => {
      if (isActivatedRef.current) {
        try {
          deactivateKeepAwake(tag);
          isActivatedRef.current = false;
        } catch (error) {
          console.warn('Failed to deactivate keep awake:', error);
        }
      }
    };

    if (active) {
      activate();
    } else {
      deactivate();
    }

    return () => {
      deactivate();
    };
  }, [active, tag]);
}

/**
 * コンポーネントがマウントされている間、画面を点灯させ続けるフック
 * 常に有効（条件付きでない場合に使用）
 */
export function useAlwaysKeepAwake(tag?: string): void {
  useKeepAwake(true, tag);
}
