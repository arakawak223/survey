import { useEffect, useState, useCallback } from 'react';
import { BarChart3, AlertTriangle, Star, ArrowUpDown } from 'lucide-react';
import { useSurveyStore } from '@/store/surveyStore';
import { runAnalysis, runDepartmentAnalysis } from '@/lib/analysis';
import {
  generateIssueComment,
  generateExcellentComment,
  generatePriorityComment,
} from '@/lib/aiService';
import AICommentCard from '@/components/AICommentCard';
import type { AnalysisResult } from '@/types';

const PRIORITY_LABELS = { high: '高', medium: '中', low: '低' };
const PRIORITY_COLORS = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-green-100 text-green-700',
};
const QUADRANT_LABELS = {
  improve: '重点改善',
  maintain: '維持',
  monitor: '改善検討',
  excess: '過剰',
};

export default function AnalysisPage() {
  const {
    responses, questions, settings, analysisResults, departmentAnalyses,
    aiComments, project,
    setAnalysisResults, setDepartmentAnalyses,
    updateAIComment, resetAIComment, addOrUpdateAIComment,
  } = useSurveyStore();

  const [activeTab, setActiveTab] = useState<'issues' | 'excellent' | 'priority' | 'department'>('issues');
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (responses.length > 0 && questions.length > 0) {
      const results = runAnalysis(responses, questions, settings);
      setAnalysisResults(results);
      const deptResults = runDepartmentAnalysis(responses, questions, results);
      setDepartmentAnalyses(deptResults);
    }
  }, [responses, questions, settings, setAnalysisResults, setDepartmentAnalyses]);

  const issues = analysisResults.filter((r) => r.extractionType === 'issue');
  const excellents = analysisResults.filter((r) => r.extractionType === 'excellent');
  const departments = [...new Set(departmentAnalyses.map((d) => d.department))].sort((a, b) => a.localeCompare(b, 'ja', { numeric: true }));

  const generateComment = useCallback(async (
    result: AnalysisResult,
    type: 'issue' | 'excellent'
  ) => {
    if (!settings.apiKey || !project) return;
    const key = `${type}-${result.questionId}`;
    setGeneratingIds((prev) => new Set(prev).add(key));
    try {
      const comment = type === 'issue'
        ? await generateIssueComment(settings.apiKey, result, departmentAnalyses, project.id)
        : await generateExcellentComment(settings.apiKey, result, departmentAnalyses, project.id);
      addOrUpdateAIComment(comment);
    } catch (e) {
      console.error('AI comment generation failed:', e);
    } finally {
      setGeneratingIds((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }, [settings.apiKey, project, departmentAnalyses, addOrUpdateAIComment]);

  const generateQuadrantComment = useCallback(async (quadrant: string) => {
    if (!settings.apiKey || !project) return;
    const key = `quadrant-${quadrant}`;
    setGeneratingIds((prev) => new Set(prev).add(key));
    try {
      const items = analysisResults.filter((r) => r.quadrant === quadrant);
      const comment = await generatePriorityComment(settings.apiKey, quadrant, items, project.id);
      addOrUpdateAIComment(comment);
    } catch (e) {
      console.error('AI comment generation failed:', e);
    } finally {
      setGeneratingIds((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }, [settings.apiKey, project, analysisResults, addOrUpdateAIComment]);

  const generateAllComments = useCallback(async () => {
    if (!settings.apiKey || !project) return;
    for (const r of issues) {
      await generateComment(r, 'issue');
    }
    for (const r of excellents) {
      await generateComment(r, 'excellent');
    }
    for (const q of ['improve', 'maintain', 'monitor', 'excess'] as const) {
      await generateQuadrantComment(q);
    }
  }, [issues, excellents, generateComment, generateQuadrantComment, settings.apiKey, project]);

  if (responses.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <BarChart3 size={48} className="mx-auto mb-3 opacity-50" />
        <p>データを取り込むと分析結果が表示されます</p>
      </div>
    );
  }

  const tabs = [
    { key: 'issues', label: `課題項目 (${issues.length})`, icon: AlertTriangle },
    { key: 'excellent', label: `優良項目 (${excellents.length})`, icon: Star },
    { key: 'priority', label: '優先順位', icon: ArrowUpDown },
    { key: 'department', label: '部署別比較', icon: BarChart3 },
  ] as const;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-800">分析結果</h2>
        {settings.apiKey && (
          <button
            onClick={generateAllComments}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            disabled={generatingIds.size > 0}
          >
            {generatingIds.size > 0 ? 'AI生成中...' : '全AIコメントを生成'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Issues tab */}
      {activeTab === 'issues' && (
        <div className="space-y-4">
          {issues.length === 0 ? (
            <p className="text-center py-8 text-slate-400">課題項目はありません（閾値: {settings.issueThreshold}以下）</p>
          ) : (
            issues.sort((a, b) => a.mean - b.mean).map((r) => {
              const comment = aiComments.find(
                (c) => c.targetType === 'issue' && c.targetId === r.questionId
              );
              const genKey = `issue-${r.questionId}`;
              return (
                <div key={r.questionId} className="bg-white rounded-xl border border-slate-200 p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium text-slate-800">{r.questionLabel}</h4>
                      <p className="text-xs text-slate-400 mt-0.5">{r.questionKey}</p>
                    </div>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${PRIORITY_COLORS[r.priority]}`}>
                      優先度: {PRIORITY_LABELS[r.priority]}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-4 mt-4">
                    <Stat label="平均値" value={r.mean} warn={r.mean <= settings.issueThreshold} />
                    <Stat label="中央値" value={r.median} />
                    <Stat label="標準偏差" value={r.stdDev} />
                    <Stat label="低評価割合" value={`${Math.round(r.lowRatio * 100)}%`} warn />
                  </div>
                  <AICommentCard
                    comment={comment}
                    onEdit={updateAIComment}
                    onReset={resetAIComment}
                    onRegenerate={settings.apiKey ? () => generateComment(r, 'issue') : undefined}
                    isGenerating={generatingIds.has(genKey)}
                  />
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Excellent tab */}
      {activeTab === 'excellent' && (
        <div className="space-y-4">
          {excellents.length === 0 ? (
            <p className="text-center py-8 text-slate-400">優良項目はありません（閾値: {settings.excellentThreshold}以上）</p>
          ) : (
            excellents.sort((a, b) => b.mean - a.mean).map((r) => {
              const comment = aiComments.find(
                (c) => c.targetType === 'excellent' && c.targetId === r.questionId
              );
              const genKey = `excellent-${r.questionId}`;
              return (
                <div key={r.questionId} className="bg-white rounded-xl border border-slate-200 p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium text-slate-800">{r.questionLabel}</h4>
                      <p className="text-xs text-slate-400 mt-0.5">{r.questionKey}</p>
                    </div>
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700">
                      優良
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-4 mt-4">
                    <Stat label="平均値" value={r.mean} good={r.mean >= settings.excellentThreshold} />
                    <Stat label="中央値" value={r.median} />
                    <Stat label="標準偏差" value={r.stdDev} />
                    <Stat label="高評価割合" value={`${Math.round(r.highRatio * 100)}%`} good />
                  </div>
                  <AICommentCard
                    comment={comment}
                    onEdit={updateAIComment}
                    onReset={resetAIComment}
                    onRegenerate={settings.apiKey ? () => generateComment(r, 'excellent') : undefined}
                    isGenerating={generatingIds.has(genKey)}
                  />
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Priority tab */}
      {activeTab === 'priority' && (
        <div className="space-y-6">
          {(['improve', 'maintain', 'monitor', 'excess'] as const).map((q) => {
            const items = analysisResults.filter((r) => r.quadrant === q);
            const comment = aiComments.find(
              (c) => c.targetType === 'priority_quadrant' && c.targetId === q
            );
            const genKey = `quadrant-${q}`;
            return (
              <div key={q} className="bg-white rounded-xl border border-slate-200 p-5">
                <h4 className="font-medium text-slate-800 mb-3">
                  {QUADRANT_LABELS[q]}
                  <span className="ml-2 text-xs text-slate-400">({items.length}項目)</span>
                </h4>
                {items.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50">
                          <th className="px-3 py-2 text-left font-medium text-slate-600">設問</th>
                          <th className="px-3 py-2 text-right font-medium text-slate-600">平均</th>
                          <th className="px-3 py-2 text-right font-medium text-slate-600">重要度</th>
                          <th className="px-3 py-2 text-center font-medium text-slate-600">優先度</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((r) => (
                          <tr key={r.questionId} className="border-t border-slate-100">
                            <td className="px-3 py-2 text-slate-700">{r.questionLabel}</td>
                            <td className="px-3 py-2 text-right text-slate-700">{r.mean}</td>
                            <td className="px-3 py-2 text-right text-slate-700">{r.importance}</td>
                            <td className="px-3 py-2 text-center">
                              <span className={`px-2 py-0.5 text-xs rounded-full ${PRIORITY_COLORS[r.priority]}`}>
                                {PRIORITY_LABELS[r.priority]}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">該当項目なし</p>
                )}
                <AICommentCard
                  comment={comment}
                  onEdit={updateAIComment}
                  onReset={resetAIComment}
                  onRegenerate={settings.apiKey ? () => generateQuadrantComment(q) : undefined}
                  isGenerating={generatingIds.has(genKey)}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Department tab */}
      {activeTab === 'department' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          {departments.length === 0 ? (
            <p className="text-center py-8 text-slate-400">部署データがありません</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-3 py-2 text-left font-medium text-slate-600 sticky left-0 bg-slate-50">設問</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-600">全社平均</th>
                    {departments.map((d) => (
                      <th key={d} className="px-3 py-2 text-right font-medium text-slate-600">{d}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {questions.map((q) => {
                    const overall = analysisResults.find((r) => r.questionKey === q.key);
                    return (
                      <tr key={q.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 text-slate-700 sticky left-0 bg-white">{q.label}</td>
                        <td className="px-3 py-2 text-right font-medium text-slate-700">{overall?.mean ?? '-'}</td>
                        {departments.map((d) => {
                          const da = departmentAnalyses.find(
                            (a) => a.department === d && a.questionKey === q.key
                          );
                          const diff = da?.diffFromOverall ?? 0;
                          return (
                            <td key={d} className="px-3 py-2 text-right">
                              <span className="text-slate-700">{da?.mean ?? '-'}</span>
                              {da && (
                                <span className={`ml-1 text-xs ${
                                  diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-slate-400'
                                }`}>
                                  ({diff >= 0 ? '+' : ''}{diff})
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, warn, good }: {
  label: string;
  value: number | string;
  warn?: boolean;
  good?: boolean;
}) {
  return (
    <div className="text-center">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-lg font-bold mt-0.5 ${
        warn ? 'text-red-600' : good ? 'text-emerald-600' : 'text-slate-800'
      }`}>
        {value}
      </p>
    </div>
  );
}
