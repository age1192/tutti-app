/**
 * プログラム状態管理ストア
 * AsyncStorage連携による永続化対応
 */
import { create } from 'zustand';
import { Program, Section } from '../types';
import {
  loadPrograms as loadProgramsFromStorage,
  saveProgram as saveProgramToStorage,
  deleteProgram as deleteProgramFromStorage,
  createNewProgram,
  addSection as addSectionToProgram,
  removeSection as removeSectionFromProgram,
  updateSection as updateSectionInProgram,
  reorderSections as reorderSectionsInProgram,
  duplicateSection as duplicateSectionInProgram,
  createDefaultSection,
  saveAsTemplate as saveAsTemplateToStorage,
  loadTemplates as loadTemplatesFromStorage,
  createFromTemplate as createFromTemplateUtil,
} from '../utils/programUtils';

interface ProgramStore {
  // 状態
  programs: Program[];
  templates: Program[];
  currentProgram: Program | null;
  isLoading: boolean;
  error: string | null;

  // 読み込み・保存
  loadPrograms: () => Promise<void>;
  loadTemplates: () => Promise<void>;
  saveProgram: (program: Program) => Promise<void>;
  deleteProgram: (id: string) => Promise<void>;

  // プログラム操作
  setCurrentProgram: (program: Program | null) => void;
  createProgram: (name?: string) => Promise<Program>;
  updateCurrentProgram: (updates: Partial<Program>) => void;

  // テンプレート操作
  saveAsTemplate: (program: Program) => Promise<void>;
  createFromTemplate: (templateId: string, name?: string) => Promise<Program>;

  // セクション操作
  addSection: (section?: Partial<Section>) => void;
  removeSection: (sectionId: string) => void;
  updateSection: (sectionId: string, updates: Partial<Section>) => void;
  reorderSections: (fromIndex: number, toIndex: number) => void;
  duplicateSection: (sectionId: string) => void;

  // エラーハンドリング
  clearError: () => void;
}

export const useProgramStore = create<ProgramStore>((set, get) => ({
  // 初期状態
  programs: [],
  templates: [],
  currentProgram: null,
  isLoading: false,
  error: null,

  // プログラム一覧を読み込み
  loadPrograms: async () => {
    set({ isLoading: true, error: null });
    try {
      const allPrograms = await loadProgramsFromStorage();
      // テンプレートと通常のプログラムを分離
      const programs = allPrograms.filter((p) => !p.isTemplate);
      const templates = allPrograms.filter((p) => p.isTemplate === true);
      // 更新日時でソート（新しい順）
      programs.sort((a, b) => b.updatedAt - a.updatedAt);
      templates.sort((a, b) => b.updatedAt - a.updatedAt);
      set({ programs, templates, isLoading: false });
    } catch (error) {
      set({
        error: 'プログラムの読み込みに失敗しました',
        isLoading: false,
      });
    }
  },

  // テンプレート一覧を読み込み
  loadTemplates: async () => {
    set({ isLoading: true, error: null });
    try {
      const templates = await loadTemplatesFromStorage();
      templates.sort((a, b) => b.updatedAt - a.updatedAt);
      set({ templates, isLoading: false });
    } catch (error) {
      set({
        error: 'テンプレートの読み込みに失敗しました',
        isLoading: false,
      });
    }
  },

  // プログラムを保存
  saveProgram: async (program) => {
    set({ isLoading: true, error: null });
    try {
      await saveProgramToStorage(program);
      const allPrograms = await loadProgramsFromStorage();
      const programs = allPrograms.filter((p) => !p.isTemplate);
      const templates = allPrograms.filter((p) => p.isTemplate === true);
      programs.sort((a, b) => b.updatedAt - a.updatedAt);
      templates.sort((a, b) => b.updatedAt - a.updatedAt);
      set({ programs, templates, isLoading: false });
    } catch (error) {
      set({
        error: 'プログラムの保存に失敗しました',
        isLoading: false,
      });
    }
  },

  // プログラムを削除
  deleteProgram: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await deleteProgramFromStorage(id);
      const { currentProgram } = get();

      // 現在編集中のプログラムが削除された場合はクリア
      const newCurrentProgram =
        currentProgram?.id === id ? null : currentProgram;

      set((state) => ({
        programs: state.programs.filter((p) => p.id !== id),
        currentProgram: newCurrentProgram,
        isLoading: false,
      }));
    } catch (error) {
      set({
        error: 'プログラムの削除に失敗しました',
        isLoading: false,
      });
    }
  },

  // 現在のプログラムを設定
  setCurrentProgram: (currentProgram) => set({ currentProgram }),

  // 新規プログラムを作成
  createProgram: async (name) => {
    const newProgram = createNewProgram(name);
    await saveProgramToStorage(newProgram);

    set((state) => ({
      programs: [newProgram, ...state.programs],
      currentProgram: newProgram,
    }));

    return newProgram;
  },

  // 現在のプログラムを更新
  updateCurrentProgram: (updates) => {
    const { currentProgram } = get();
    if (!currentProgram) return;

    const updatedProgram = {
      ...currentProgram,
      ...updates,
      updatedAt: Date.now(),
    };

    set({ currentProgram: updatedProgram });
  },

  // セクション追加
  addSection: (section) => {
    const { currentProgram } = get();
    if (!currentProgram) return;

    const updatedProgram = addSectionToProgram(currentProgram, section);
    set({ currentProgram: updatedProgram });
  },

  // セクション削除
  removeSection: (sectionId) => {
    const { currentProgram } = get();
    if (!currentProgram) return;

    // 最低1つのセクションは残す
    if (currentProgram.sections.length <= 1) return;

    const updatedProgram = removeSectionFromProgram(currentProgram, sectionId);
    set({ currentProgram: updatedProgram });
  },

  // セクション更新
  updateSection: (sectionId, updates) => {
    const { currentProgram } = get();
    if (!currentProgram) return;

    const updatedProgram = updateSectionInProgram(
      currentProgram,
      sectionId,
      updates
    );
    set({ currentProgram: updatedProgram });
  },

  // セクション並び替え
  reorderSections: (fromIndex, toIndex) => {
    const { currentProgram } = get();
    if (!currentProgram) return;

    const updatedProgram = reorderSectionsInProgram(
      currentProgram,
      fromIndex,
      toIndex
    );
    set({ currentProgram: updatedProgram });
  },

  // セクション複製
  duplicateSection: (sectionId) => {
    const { currentProgram } = get();
    if (!currentProgram) return;

    const updatedProgram = duplicateSectionInProgram(currentProgram, sectionId);
    set({ currentProgram: updatedProgram });
  },

  // テンプレートとして保存
  saveAsTemplate: async (program) => {
    set({ isLoading: true, error: null });
    try {
      await saveAsTemplateToStorage(program);
      const templates = await loadTemplatesFromStorage();
      templates.sort((a, b) => b.updatedAt - a.updatedAt);
      set({ templates, isLoading: false });
    } catch (error) {
      set({
        error: 'テンプレートの保存に失敗しました',
        isLoading: false,
      });
    }
  },

  // テンプレートから新規プログラムを作成
  createFromTemplate: async (templateId, name) => {
    set({ isLoading: true, error: null });
    try {
      const { templates } = get();
      const template = templates.find((t) => t.id === templateId);
      if (!template) {
        throw new Error('テンプレートが見つかりません');
      }

      const newProgram = createFromTemplateUtil(template, name);
      await saveProgramToStorage(newProgram);

      const allPrograms = await loadProgramsFromStorage();
      const programs = allPrograms.filter((p) => !p.isTemplate);
      programs.sort((a, b) => b.updatedAt - a.updatedAt);
      set({ programs, currentProgram: newProgram, isLoading: false });
      return newProgram;
    } catch (error) {
      set({
        error: 'テンプレートからの作成に失敗しました',
        isLoading: false,
      });
      throw error;
    }
  },

  // エラークリア
  clearError: () => set({ error: null }),
}));
