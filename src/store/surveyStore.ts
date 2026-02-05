import { create } from 'zustand';
import type {
  SurveyProject,
  Question,
  Category,
  SurveyResponse,
  AnalysisResult,
  DepartmentAnalysis,
  AIComment,
  ParsedSurveyData,
  AppSettings,
  DepartmentScoreData,
} from '@/types';
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS } from '@/types';
import { v4 as uuidv4 } from 'uuid';

interface SurveyState {
  // プロジェクト
  project: SurveyProject | null;
  // データ
  parsedData: ParsedSurveyData | null;
  questions: Question[];
  categories: Category[];
  responses: SurveyResponse[];
  // 分析結果
  analysisResults: AnalysisResult[];
  departmentAnalyses: DepartmentAnalysis[];
  // AIコメント
  aiComments: AIComment[];
  // 部署別スコア分析
  deptScoreData: DepartmentScoreData | null;
  deptAIComments: AIComment[];
  // 設定
  settings: AppSettings;

  // アクション
  setProject: (project: SurveyProject) => void;
  setParsedData: (data: ParsedSurveyData) => void;
  setQuestions: (questions: Question[]) => void;
  setCategories: (categories: Category[]) => void;
  updateQuestionCategory: (questionId: string, categoryId: string) => void;
  setResponses: (responses: SurveyResponse[]) => void;
  setAnalysisResults: (results: AnalysisResult[]) => void;
  setDepartmentAnalyses: (analyses: DepartmentAnalysis[]) => void;
  setAIComments: (comments: AIComment[]) => void;
  updateAIComment: (id: string, editedText: string) => void;
  resetAIComment: (id: string) => void;
  addOrUpdateAIComment: (comment: AIComment) => void;
  setDeptScoreData: (data: DepartmentScoreData | null) => void;
  setDeptAIComments: (comments: AIComment[]) => void;
  addOrUpdateDeptAIComment: (comment: AIComment) => void;
  updateDeptAIComment: (id: string, editedText: string) => void;
  resetDeptAIComment: (id: string) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  resetAll: () => void;
}

export const useSurveyStore = create<SurveyState>((set) => ({
  project: null,
  parsedData: null,
  questions: [],
  categories: [...DEFAULT_CATEGORIES],
  responses: [],
  analysisResults: [],
  departmentAnalyses: [],
  aiComments: [],
  deptScoreData: null,
  deptAIComments: [],
  settings: { ...DEFAULT_SETTINGS },

  setProject: (project) => set({ project }),

  setParsedData: (data) => set({ parsedData: data }),

  setQuestions: (questions) => set({ questions }),

  setCategories: (categories) => set({ categories }),

  updateQuestionCategory: (questionId, categoryId) =>
    set((state) => ({
      questions: state.questions.map((q) =>
        q.id === questionId ? { ...q, categoryId } : q
      ),
    })),

  setResponses: (responses) => set({ responses }),

  setAnalysisResults: (results) => set({ analysisResults: results }),

  setDepartmentAnalyses: (analyses) => set({ departmentAnalyses: analyses }),

  setAIComments: (comments) => set({ aiComments: comments }),

  updateAIComment: (id, editedText) =>
    set((state) => ({
      aiComments: state.aiComments.map((c) =>
        c.id === id
          ? { ...c, editedText, isEdited: true, editedAt: new Date() }
          : c
      ),
    })),

  resetAIComment: (id) =>
    set((state) => ({
      aiComments: state.aiComments.map((c) =>
        c.id === id
          ? { ...c, editedText: c.aiGeneratedText, isEdited: false, editedAt: null }
          : c
      ),
    })),

  addOrUpdateAIComment: (comment) =>
    set((state) => {
      const existing = state.aiComments.find(
        (c) => c.targetType === comment.targetType && c.targetId === comment.targetId
      );
      if (existing) {
        return {
          aiComments: state.aiComments.map((c) =>
            c.id === existing.id
              ? { ...comment, id: existing.id }
              : c
          ),
        };
      }
      return { aiComments: [...state.aiComments, { ...comment, id: uuidv4() }] };
    }),

  setDeptScoreData: (data) => set({ deptScoreData: data }),

  setDeptAIComments: (comments) => set({ deptAIComments: comments }),

  addOrUpdateDeptAIComment: (comment) =>
    set((state) => {
      const existing = state.deptAIComments.find(
        (c) => c.targetType === comment.targetType && c.targetId === comment.targetId
      );
      if (existing) {
        return {
          deptAIComments: state.deptAIComments.map((c) =>
            c.id === existing.id ? { ...comment, id: existing.id } : c
          ),
        };
      }
      return { deptAIComments: [...state.deptAIComments, { ...comment, id: uuidv4() }] };
    }),

  updateDeptAIComment: (id, editedText) =>
    set((state) => ({
      deptAIComments: state.deptAIComments.map((c) =>
        c.id === id
          ? { ...c, editedText, isEdited: true, editedAt: new Date() }
          : c
      ),
    })),

  resetDeptAIComment: (id) =>
    set((state) => ({
      deptAIComments: state.deptAIComments.map((c) =>
        c.id === id
          ? { ...c, editedText: c.aiGeneratedText, isEdited: false, editedAt: null }
          : c
      ),
    })),

  updateSettings: (newSettings) =>
    set((state) => ({
      settings: { ...state.settings, ...newSettings },
    })),

  resetAll: () =>
    set({
      project: null,
      parsedData: null,
      questions: [],
      categories: [...DEFAULT_CATEGORIES],
      responses: [],
      analysisResults: [],
      departmentAnalyses: [],
      aiComments: [],
      deptScoreData: null,
      deptAIComments: [],
    }),
}));
