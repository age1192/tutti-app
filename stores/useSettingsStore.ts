/**
 * アプリ設定状態管理ストア
 * AsyncStorage連携による永続化対応
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppSettings, TimeSignature } from '../types';
import { STORAGE_KEYS, TEMPO_DEFAULT, PITCH_DEFAULT } from '../utils/constants';

// デフォルト設定
const DEFAULT_SETTINGS: AppSettings = {
  keepScreenOn: true,
  backgroundPlayback: false,
  hapticEnabled: true,  // 振動はデフォルトでON
  defaultTempo: TEMPO_DEFAULT,
  defaultTimeSignature: { numerator: 4, denominator: 4 },
  defaultPitch: PITCH_DEFAULT,
  defaultTuning: 'equal',
};

interface SettingsStore {
  // 状態
  settings: AppSettings;
  isLoading: boolean;
  error: string | null;

  // 読み込み・保存
  loadSettings: () => Promise<void>;
  saveSettings: (settings: AppSettings) => Promise<void>;
  resetSettings: () => Promise<void>;

  // 個別設定の更新
  setKeepScreenOn: (enabled: boolean) => void;
  setBackgroundPlayback: (enabled: boolean) => void;
  setHapticEnabled: (enabled: boolean) => void;
  setDefaultTempo: (tempo: number) => void;
  setDefaultTimeSignature: (timeSignature: TimeSignature) => void;
  setDefaultPitch: (pitch: number) => void;
  setDefaultTuning: (tuning: 'equal' | 'just') => void;

  // エラーハンドリング
  clearError: () => void;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  // 初期状態
  settings: DEFAULT_SETTINGS,
  isLoading: false,
  error: null,

  // 設定を読み込み
  loadSettings: async () => {
    set({ isLoading: true, error: null });
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (json) {
        const loadedSettings = JSON.parse(json);
        // デフォルト設定とマージ（新しい設定項目が追加された場合に対応）
        const mergedSettings = { ...DEFAULT_SETTINGS, ...loadedSettings };
        set({ settings: mergedSettings, isLoading: false });
      } else {
        // 設定が存在しない場合はデフォルト設定を保存
        await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
        set({ settings: DEFAULT_SETTINGS, isLoading: false });
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      set({
        error: '設定の読み込みに失敗しました',
        isLoading: false,
        settings: DEFAULT_SETTINGS,
      });
    }
  },

  // 設定を保存
  saveSettings: async (settings) => {
    set({ isLoading: true, error: null });
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
      set({ settings, isLoading: false });
    } catch (error) {
      console.error('Failed to save settings:', error);
      set({
        error: '設定の保存に失敗しました',
        isLoading: false,
      });
    }
  },

  // 設定をリセット
  resetSettings: async () => {
    await get().saveSettings(DEFAULT_SETTINGS);
  },

  // 個別設定の更新（自動保存）
  setHapticEnabled: async (enabled) => {
    const { settings } = get();
    const newSettings = { ...settings, hapticEnabled: enabled };
    await get().saveSettings(newSettings);
  },

  setKeepScreenOn: async (enabled) => {
    const { settings } = get();
    const newSettings = { ...settings, keepScreenOn: enabled };
    await get().saveSettings(newSettings);
  },

  setDefaultTempo: async (tempo) => {
    const { settings } = get();
    const newSettings = { ...settings, defaultTempo: tempo };
    await get().saveSettings(newSettings);
  },

  setDefaultTimeSignature: async (timeSignature) => {
    const { settings } = get();
    const newSettings = { ...settings, defaultTimeSignature: timeSignature };
    await get().saveSettings(newSettings);
  },

  setDefaultPitch: async (pitch) => {
    const { settings } = get();
    const newSettings = { ...settings, defaultPitch: pitch };
    await get().saveSettings(newSettings);
  },

  setDefaultTuning: async (tuning) => {
    const { settings } = get();
    const newSettings = { ...settings, defaultTuning: tuning };
    await get().saveSettings(newSettings);
  },

  setBackgroundPlayback: async (enabled) => {
    const { settings } = get();
    const newSettings = { ...settings, backgroundPlayback: enabled };
    await get().saveSettings(newSettings);
  },

  // エラークリア
  clearError: () => set({ error: null }),
}));
