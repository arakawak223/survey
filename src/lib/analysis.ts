import type {
  SurveyResponse,
  Question,
  AnalysisResult,
  DepartmentAnalysis,
  AppSettings,
} from '@/types';
import { CATEGORY_KEYWORDS } from '@/types';

// 部署名の自然順ソート（鋳造1課→2課→…→鋳造検査）
export function sortDepartments(departments: string[]): string[] {
  return [...departments].sort((a, b) => a.localeCompare(b, 'ja', { numeric: true }));
}

// カテゴリ自動分類
export function classifyQuestion(questionLabel: string): string {
  const label = questionLabel.toLowerCase();
  for (const [categoryId, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => label.includes(kw.toLowerCase()))) {
      return categoryId;
    }
  }
  return 'cat-other';
}

// 基本統計量の算出
function calcMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function calcMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function calcStdDev(values: number[]): number {
  if (values.length <= 1) return 0;
  const mean = calcMean(values);
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

// ピアソン相関係数
function calcCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n <= 1) return 0;
  const meanX = calcMean(x);
  const meanY = calcMean(y);
  let numerator = 0;
  let denomX = 0;
  let denomY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }
  const denom = Math.sqrt(denomX * denomY);
  return denom === 0 ? 0 : numerator / denom;
}

// 総合満足度（全設問の平均）を回答者ごとに算出
function calcOverallScores(
  responses: SurveyResponse[],
  questionKeys: string[]
): number[] {
  return responses.map((r) => {
    const scores = questionKeys
      .map((k) => r.answers[k])
      .filter((v) => v !== undefined && !isNaN(v));
    return scores.length > 0 ? calcMean(scores) : 0;
  });
}

// メイン分析
export function runAnalysis(
  responses: SurveyResponse[],
  questions: Question[],
  settings: AppSettings
): AnalysisResult[] {
  if (responses.length === 0 || questions.length === 0) return [];

  const questionKeys = questions.map((q) => q.key);
  const overallScores = calcOverallScores(responses, questionKeys);

  return questions.map((question) => {
    const values = responses
      .map((r) => r.answers[question.key])
      .filter((v) => v !== undefined && !isNaN(v));

    const mean = calcMean(values);
    const median = calcMedian(values);
    const stdDev = calcStdDev(values);
    const lowRatio = values.length > 0
      ? values.filter((v) => v <= 2).length / values.length
      : 0;
    const highRatio = values.length > 0
      ? values.filter((v) => v >= 4).length / values.length
      : 0;

    // 重要度 = 各設問スコアと総合満足度の相関
    const questionScores = responses.map((r) => r.answers[question.key] ?? 0);
    const importance = Math.abs(calcCorrelation(questionScores, overallScores));

    // 4象限判定
    const meanThreshold = (settings.scaleMin + settings.scaleMax) / 2;
    const importanceThreshold = 0.5;
    const quadrant = getQuadrant(mean, importance, meanThreshold, importanceThreshold);

    // 優先度
    const priority = getPriority(quadrant, mean, settings.issueThreshold);

    // 抽出タイプ
    let extractionType: 'issue' | 'excellent' | 'neutral' = 'neutral';
    if (mean <= settings.issueThreshold) extractionType = 'issue';
    else if (mean >= settings.excellentThreshold) extractionType = 'excellent';

    return {
      questionId: question.id,
      questionKey: question.key,
      questionLabel: question.label,
      categoryId: question.categoryId,
      mean: Math.round(mean * 100) / 100,
      median,
      stdDev: Math.round(stdDev * 100) / 100,
      lowRatio: Math.round(lowRatio * 100) / 100,
      highRatio: Math.round(highRatio * 100) / 100,
      importance: Math.round(importance * 100) / 100,
      priority,
      quadrant,
      extractionType,
    };
  });
}

function getQuadrant(
  mean: number,
  importance: number,
  meanThreshold: number,
  importanceThreshold: number
): 'improve' | 'maintain' | 'monitor' | 'excess' {
  if (importance >= importanceThreshold && mean < meanThreshold) return 'improve';
  if (importance >= importanceThreshold && mean >= meanThreshold) return 'maintain';
  if (importance < importanceThreshold && mean < meanThreshold) return 'monitor';
  return 'excess';
}

function getPriority(
  quadrant: string,
  mean: number,
  issueThreshold: number
): 'high' | 'medium' | 'low' {
  if (quadrant === 'improve') return 'high';
  if (quadrant === 'monitor' && mean <= issueThreshold) return 'medium';
  if (quadrant === 'maintain') return 'low';
  return 'low';
}

// 部署別分析
export function runDepartmentAnalysis(
  responses: SurveyResponse[],
  questions: Question[],
  overallResults: AnalysisResult[]
): DepartmentAnalysis[] {
  const departments = sortDepartments([...new Set(responses.map((r) => r.department).filter(Boolean))]);
  const results: DepartmentAnalysis[] = [];

  for (const dept of departments) {
    const deptResponses = responses.filter((r) => r.department === dept);
    for (const question of questions) {
      const values = deptResponses
        .map((r) => r.answers[question.key])
        .filter((v) => v !== undefined && !isNaN(v));
      const mean = calcMean(values);
      const overall = overallResults.find((r) => r.questionKey === question.key);
      const diffFromOverall = overall ? Math.round((mean - overall.mean) * 100) / 100 : 0;

      results.push({
        department: dept,
        questionKey: question.key,
        mean: Math.round(mean * 100) / 100,
        diffFromOverall,
      });
    }
  }

  return results;
}

// 回答分布の算出
export function getDistribution(
  responses: SurveyResponse[],
  questionKey: string,
  scaleMin: number,
  scaleMax: number
): { value: number; count: number }[] {
  const counts = new Map<number, number>();
  for (let i = scaleMin; i <= scaleMax; i++) {
    counts.set(i, 0);
  }
  for (const r of responses) {
    const v = r.answers[questionKey];
    if (v !== undefined && counts.has(v)) {
      counts.set(v, (counts.get(v) || 0) + 1);
    }
  }
  return Array.from(counts.entries()).map(([value, count]) => ({ value, count }));
}
