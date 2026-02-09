/**
 * プリセット状態管理ストア
 * AsyncStorage連携による永続化対応
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  MetronomePreset,
  HarmonyPreset,
  PlaybackPreset,
  TimeSignature,
  SubdivisionSettings,
  MetronomeToneType,
  TuningType,
  ToneType,
} from '../types';
import { STORAGE_KEYS } from '../utils/constants';

interface PresetStore {
  // 状態
  metronomePresets: MetronomePreset[];
  harmonyPresets: HarmonyPreset[];
  playbackPresets: PlaybackPreset[];
  isLoading: boolean;
  error: string | null;

  // 読み込み
  loadMetronomePresets: () => Promise<void>;
  loadHarmonyPresets: () => Promise<void>;
  loadPlaybackPresets: () => Promise<void>;
  loadAllPresets: () => Promise<void>;

  // メトロノームプリセット操作
  saveMetronomePreset: (preset: Omit<MetronomePreset, 'id' | 'createdAt'>) => Promise<string>;
  deleteMetronomePreset: (id: string) => Promise<void>;
  updateMetronomePreset: (id: string, updates: Partial<MetronomePreset>) => Promise<void>;

  // ハーモニープリセット操作
  saveHarmonyPreset: (preset: Omit<HarmonyPreset, 'id' | 'createdAt'>) => Promise<string>;
  deleteHarmonyPreset: (id: string) => Promise<void>;
  updateHarmonyPreset: (id: string, updates: Partial<HarmonyPreset>) => Promise<void>;

  // コード再生プリセット操作
  savePlaybackPreset: (preset: Omit<PlaybackPreset, 'id' | 'createdAt'>) => Promise<string>;
  deletePlaybackPreset: (id: string) => Promise<void>;
  updatePlaybackPreset: (id: string, updates: Partial<PlaybackPreset>) => Promise<void>;

  // エラーハンドリング
  clearError: () => void;
}

// ID生成
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export const usePresetStore = create<PresetStore>((set, get) => ({
  // 初期状態
  metronomePresets: [],
  harmonyPresets: [],
  playbackPresets: [],
  isLoading: false,
  error: null,

  // メトロノームプリセットを読み込み
  loadMetronomePresets: async () => {
    set({ isLoading: true, error: null });
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEYS.METRONOME_PRESETS);
      if (json) {
        const presets = JSON.parse(json);
        set({ metronomePresets: presets, isLoading: false });
      } else {
        set({ metronomePresets: [], isLoading: false });
      }
    } catch (error) {
      console.error('Failed to load metronome presets:', error);
      set({
        error: 'プリセットの読み込みに失敗しました',
        isLoading: false,
      });
    }
  },

  // ハーモニープリセットを読み込み
  loadHarmonyPresets: async () => {
    set({ isLoading: true, error: null });
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEYS.HARMONY_PRESETS);
      if (json) {
        const presets = JSON.parse(json);
        set({ harmonyPresets: presets, isLoading: false });
      } else {
        set({ harmonyPresets: [], isLoading: false });
      }
    } catch (error) {
      console.error('Failed to load harmony presets:', error);
      set({
        error: 'プリセットの読み込みに失敗しました',
        isLoading: false,
      });
    }
  },

  // コード再生プリセットを読み込み
  loadPlaybackPresets: async () => {
    set({ isLoading: true, error: null });
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEYS.PLAYBACK_PRESETS);
      if (json) {
        const presets = JSON.parse(json);
        set({ playbackPresets: presets, isLoading: false });
      } else {
        set({ playbackPresets: [], isLoading: false });
      }
    } catch (error) {
      console.error('Failed to load playback presets:', error);
      set({
        error: 'プリセットの読み込みに失敗しました',
        isLoading: false,
      });
    }
  },

  // すべてのプリセットを読み込み
  loadAllPresets: async () => {
    await Promise.all([
      get().loadMetronomePresets(),
      get().loadHarmonyPresets(),
      get().loadPlaybackPresets(),
    ]);
  },

  // メトロノームプリセットを保存
  saveMetronomePreset: async (presetData) => {
    set({ isLoading: true, error: null });
    try {
      const newPreset: MetronomePreset = {
        ...presetData,
        id: generateId(),
        createdAt: Date.now(),
      };

      const { metronomePresets } = get();
      const updatedPresets = [...metronomePresets, newPreset];
      await AsyncStorage.setItem(
        STORAGE_KEYS.METRONOME_PRESETS,
        JSON.stringify(updatedPresets)
      );

      set({ metronomePresets: updatedPresets, isLoading: false });
      return newPreset.id;
    } catch (error) {
      console.error('Failed to save metronome preset:', error);
      set({
        error: 'プリセットの保存に失敗しました',
        isLoading: false,
      });
      throw error;
    }
  },

  // メトロノームプリセットを削除
  deleteMetronomePreset: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const { metronomePresets } = get();
      const updatedPresets = metronomePresets.filter((p) => p.id !== id);
      await AsyncStorage.setItem(
        STORAGE_KEYS.METRONOME_PRESETS,
        JSON.stringify(updatedPresets)
      );

      set({ metronomePresets: updatedPresets, isLoading: false });
    } catch (error) {
      console.error('Failed to delete metronome preset:', error);
      set({
        error: 'プリセットの削除に失敗しました',
        isLoading: false,
      });
    }
  },

  // メトロノームプリセットを更新
  updateMetronomePreset: async (id, updates) => {
    set({ isLoading: true, error: null });
    try {
      const { metronomePresets } = get();
      const updatedPresets = metronomePresets.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      );
      await AsyncStorage.setItem(
        STORAGE_KEYS.METRONOME_PRESETS,
        JSON.stringify(updatedPresets)
      );

      set({ metronomePresets: updatedPresets, isLoading: false });
    } catch (error) {
      console.error('Failed to update metronome preset:', error);
      set({
        error: 'プリセットの更新に失敗しました',
        isLoading: false,
      });
    }
  },

  // ハーモニープリセットを保存
  saveHarmonyPreset: async (presetData) => {
    set({ isLoading: true, error: null });
    try {
      const newPreset: HarmonyPreset = {
        ...presetData,
        id: generateId(),
        createdAt: Date.now(),
      };

      const { harmonyPresets } = get();
      const updatedPresets = [...harmonyPresets, newPreset];
      await AsyncStorage.setItem(
        STORAGE_KEYS.HARMONY_PRESETS,
        JSON.stringify(updatedPresets)
      );

      set({ harmonyPresets: updatedPresets, isLoading: false });
      return newPreset.id;
    } catch (error) {
      console.error('Failed to save harmony preset:', error);
      set({
        error: 'プリセットの保存に失敗しました',
        isLoading: false,
      });
      throw error;
    }
  },

  // ハーモニープリセットを削除
  deleteHarmonyPreset: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const { harmonyPresets } = get();
      const updatedPresets = harmonyPresets.filter((p) => p.id !== id);
      await AsyncStorage.setItem(
        STORAGE_KEYS.HARMONY_PRESETS,
        JSON.stringify(updatedPresets)
      );

      set({ harmonyPresets: updatedPresets, isLoading: false });
    } catch (error) {
      console.error('Failed to delete harmony preset:', error);
      set({
        error: 'プリセットの削除に失敗しました',
        isLoading: false,
      });
    }
  },

  // ハーモニープリセットを更新
  updateHarmonyPreset: async (id, updates) => {
    set({ isLoading: true, error: null });
    try {
      const { harmonyPresets } = get();
      const updatedPresets = harmonyPresets.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      );
      await AsyncStorage.setItem(
        STORAGE_KEYS.HARMONY_PRESETS,
        JSON.stringify(updatedPresets)
      );

      set({ harmonyPresets: updatedPresets, isLoading: false });
    } catch (error) {
      console.error('Failed to update harmony preset:', error);
      set({
        error: 'プリセットの更新に失敗しました',
        isLoading: false,
      });
    }
  },

  // コード再生プリセットを保存
  savePlaybackPreset: async (presetData) => {
    set({ isLoading: true, error: null });
    try {
      const newPreset: PlaybackPreset = {
        ...presetData,
        id: generateId(),
        createdAt: Date.now(),
      };

      const { playbackPresets } = get();
      const updatedPresets = [...playbackPresets, newPreset];
      await AsyncStorage.setItem(
        STORAGE_KEYS.PLAYBACK_PRESETS,
        JSON.stringify(updatedPresets)
      );

      set({ playbackPresets: updatedPresets, isLoading: false });
      return newPreset.id;
    } catch (error) {
      console.error('Failed to save playback preset:', error);
      set({
        error: 'プリセットの保存に失敗しました',
        isLoading: false,
      });
      throw error;
    }
  },

  // コード再生プリセットを削除
  deletePlaybackPreset: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const { playbackPresets } = get();
      const updatedPresets = playbackPresets.filter((p) => p.id !== id);
      await AsyncStorage.setItem(
        STORAGE_KEYS.PLAYBACK_PRESETS,
        JSON.stringify(updatedPresets)
      );

      set({ playbackPresets: updatedPresets, isLoading: false });
    } catch (error) {
      console.error('Failed to delete playback preset:', error);
      set({
        error: 'プリセットの削除に失敗しました',
        isLoading: false,
      });
    }
  },

  // コード再生プリセットを更新
  updatePlaybackPreset: async (id, updates) => {
    set({ isLoading: true, error: null });
    try {
      const { playbackPresets } = get();
      const updatedPresets = playbackPresets.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      );
      await AsyncStorage.setItem(
        STORAGE_KEYS.PLAYBACK_PRESETS,
        JSON.stringify(updatedPresets)
      );

      set({ playbackPresets: updatedPresets, isLoading: false });
    } catch (error) {
      console.error('Failed to update playback preset:', error);
      set({
        error: 'プリセットの更新に失敗しました',
        isLoading: false,
      });
    }
  },

  // エラークリア
  clearError: () => set({ error: null }),
}));
