/**
 * ストレージユーティリティ
 * 初回起動検出など
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from './constants';

/**
 * 初回起動かどうかを確認
 */
export async function isFirstLaunch(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEYS.FIRST_LAUNCH);
    return value === null;
  } catch (error) {
    console.error('Failed to check first launch:', error);
    return true; // エラー時は初回起動とみなす
  }
}

/**
 * 初回起動完了を記録
 */
export async function setFirstLaunchComplete(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.FIRST_LAUNCH, 'false');
  } catch (error) {
    console.error('Failed to set first launch complete:', error);
  }
}
