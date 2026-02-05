// アンケートプロジェクト
export interface SurveyProject {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

// 設問定義
export interface Question {
  id: string;
  projectId: string;
  key: string;
  label: string;
  categoryId: string;
  scaleMin: number;
  scaleMax: number;
}

// カテゴリ
export interface Category {
  id: string;
  name: string;
  color: string;
  order: number;
}

// 回答データ
export interface SurveyResponse {
  id: string;
  projectId: string;
  respondentId: string;
  department: string;
  answers: Record<string, number>;
}

// 分析結果
export interface AnalysisResult {
  questionId: string;
  questionKey: string;
  questionLabel: string;
  categoryId: string;
  mean: number;
  median: number;
  stdDev: number;
  lowRatio: number;
  highRatio: number;
  importance: number;
  priority: 'high' | 'medium' | 'low';
  quadrant: 'improve' | 'maintain' | 'monitor' | 'excess';
  extractionType: 'issue' | 'excellent' | 'neutral';
}

// 部署別分析結果
export interface DepartmentAnalysis {
  department: string;
  questionKey: string;
  mean: number;
  diffFromOverall: number;
}

// 部署別スコアデータ（事前集計済み部署別平均点）
export interface DepartmentScoreData {
  questions: DepartmentScoreQuestion[];
  departments: string[];
  overallDepartment: string; // "部門計" 等の全体列（なければ空文字）
}

export interface DepartmentScoreQuestion {
  number: number;
  label: string;
  categoryId: string;
  scores: Record<string, number>; // department name -> average score
}

// AIコメント
export interface AIComment {
  id: string;
  projectId: string;
  targetType: 'issue' | 'excellent' | 'priority_quadrant' | 'dept_question' | 'dept_department' | 'dept_overview';
  targetId: string;
  aiGeneratedText: string;
  editedText: string;
  isEdited: boolean;
  generatedAt: Date;
  editedAt: Date | null;
}

// バリデーション結果
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  row?: number;
  column?: string;
  message: string;
}

export interface ValidationWarning {
  row?: number;
  column?: string;
  message: string;
}

// パース済みデータ
export interface ParsedSurveyData {
  headers: string[];
  respondentIdColumn: string;
  departmentColumn: string;
  questionColumns: string[];
  rows: Record<string, string | number>[];
}

// デフォルトカテゴリ
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-1', name: '職場環境', color: '#3b82f6', order: 1 },
  { id: 'cat-2', name: '人間関係', color: '#ef4444', order: 2 },
  { id: 'cat-3', name: '報酬・待遇', color: '#f59e0b', order: 3 },
  { id: 'cat-4', name: '成長・キャリア', color: '#10b981', order: 4 },
  { id: 'cat-5', name: '業務内容', color: '#8b5cf6', order: 5 },
  { id: 'cat-6', name: '経営・組織', color: '#ec4899', order: 6 },
  { id: 'cat-other', name: 'その他', color: '#6b7280', order: 99 },
];

// カテゴリ分類用キーワードマップ
export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'cat-1': ['職場', '環境', 'オフィス', '設備', '働く場所', '勤務'],
  'cat-2': ['人間関係', '上司', '同僚', 'チーム', 'コミュニケーション', '関係'],
  'cat-3': ['給与', '報酬', '待遇', '賞与', 'ボーナス', '福利厚生', '手当'],
  'cat-4': ['成長', 'キャリア', '研修', '教育', 'スキル', '昇進', '機会'],
  'cat-5': ['仕事', '業務', 'やりがい', '裁量', '負荷', '残業', 'ワークライフ'],
  'cat-6': ['経営', '組織', 'ビジョン', '戦略', '方針', '理念', '会社'],
};

// 設定
export interface AppSettings {
  issueThreshold: number;
  excellentThreshold: number;
  scaleMin: number;
  scaleMax: number;
  apiKey: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  issueThreshold: 3.0,
  excellentThreshold: 4.0,
  scaleMin: 1,
  scaleMax: 5,
  apiKey: '',
};
