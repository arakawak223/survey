import { useState, useCallback, useMemo } from 'react';
import { Building2, AlertTriangle, Star, BarChart3, Globe } from 'lucide-react';
import { useSurveyStore } from '@/store/surveyStore';
import {
  generateDeptQuestionComment,
  generateDeptDepartmentComment,
  generateDeptOverviewComment,
} from '@/lib/aiService';
import AICommentCard from '@/components/AICommentCard';

export default function DeptAnalysisPage() {
  const {
    deptScoreData, deptAIComments, settings,
    addOrUpdateDeptAIComment, updateDeptAIComment, resetDeptAIComment,
  } = useSurveyStore();

  const [activeTab, setActiveTab] = useState<'overview' | 'issues' | 'excellent' | 'department'>('overview');
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const [selectedDept, setSelectedDept] = useState<string>('');

  const projectId = 'dept-analysis';

  // 分析データの計算
  const analysis = useMemo(() => {
    if (!deptScoreData) return null;
    const { questions, departments, overallDepartment } = deptScoreData;
    // 部署（全体列を除く）
    const subDepts = overallDepartment
      ? departments.filter((d) => d !== overallDepartment)
      : departments;

    // 部署ごとの平均スコア
    const deptAverages = subDepts.map((dept) => {
      const scores = questions.map((q) => q.scores[dept]).filter((v) => v !== undefined);
      const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      return { dept, avg: Math.round(avg * 100) / 100 };
    });

    // 全体平均（overallDepartment があればそれ、なければ全部署平均）
    const overallAvg = overallDepartment
      ? (() => {
          const scores = questions.map((q) => q.scores[overallDepartment]).filter((v) => v !== undefined);
          return scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100 : 0;
        })()
      : (() => {
          const allAvgs = deptAverages.map((d) => d.avg);
          return allAvgs.length > 0 ? Math.round((allAvgs.reduce((a, b) => a + b, 0) / allAvgs.length) * 100) / 100 : 0;
        })();

    // 課題設問（全体平均または最低部署が閾値以下）
    const issueQuestions = questions.filter((q) => {
      const refScore = overallDepartment ? q.scores[overallDepartment] : undefined;
      const subScores = subDepts.map((d) => q.scores[d]).filter((v) => v !== undefined);
      const minScore = subScores.length > 0 ? Math.min(...subScores) : 99;
      return (refScore !== undefined && refScore <= settings.issueThreshold) || minScore <= settings.issueThreshold;
    });

    // 優良設問
    const excellentQuestions = questions.filter((q) => {
      const refScore = overallDepartment ? q.scores[overallDepartment] : undefined;
      const subScores = subDepts.map((d) => q.scores[d]).filter((v) => v !== undefined);
      const maxScore = subScores.length > 0 ? Math.max(...subScores) : 0;
      return (refScore !== undefined && refScore >= settings.excellentThreshold) || maxScore >= settings.excellentThreshold;
    });

    return {
      subDepts,
      deptAverages,
      overallAvg,
      issueQuestions,
      excellentQuestions,
      lowestDept: deptAverages.length > 0 ? deptAverages.reduce((a, b) => (a.avg < b.avg ? a : b)) : null,
      highestDept: deptAverages.length > 0 ? deptAverages.reduce((a, b) => (a.avg > b.avg ? a : b)) : null,
    };
  }, [deptScoreData, settings]);

  // AI コメント生成
  const genQuestionComment = useCallback(async (qNum: number) => {
    if (!settings.apiKey || !deptScoreData) return;
    const q = deptScoreData.questions.find((x) => x.number === qNum);
    if (!q) return;
    const key = `dept_question-q-${qNum}`;
    setGeneratingIds((prev) => new Set(prev).add(key));
    try {
      const comment = await generateDeptQuestionComment(
        settings.apiKey, q.label, q.number, q.scores,
        deptScoreData.overallDepartment, settings.issueThreshold, projectId
      );
      addOrUpdateDeptAIComment(comment);
    } catch (e) { console.error(e); }
    finally {
      setGeneratingIds((prev) => { const n = new Set(prev); n.delete(key); return n; });
    }
  }, [settings.apiKey, deptScoreData, addOrUpdateDeptAIComment, settings.issueThreshold]);

  const genDeptComment = useCallback(async (deptName: string) => {
    if (!settings.apiKey || !deptScoreData) return;
    const key = `dept_department-${deptName}`;
    setGeneratingIds((prev) => new Set(prev).add(key));
    try {
      const comment = await generateDeptDepartmentComment(
        settings.apiKey, deptName, deptScoreData,
        settings.issueThreshold, settings.excellentThreshold, projectId
      );
      addOrUpdateDeptAIComment(comment);
    } catch (e) { console.error(e); }
    finally {
      setGeneratingIds((prev) => { const n = new Set(prev); n.delete(key); return n; });
    }
  }, [settings.apiKey, deptScoreData, addOrUpdateDeptAIComment, settings.issueThreshold, settings.excellentThreshold]);

  const genOverviewComment = useCallback(async () => {
    if (!settings.apiKey || !deptScoreData) return;
    const key = 'dept_overview-overview';
    setGeneratingIds((prev) => new Set(prev).add(key));
    try {
      const comment = await generateDeptOverviewComment(
        settings.apiKey, deptScoreData, settings.issueThreshold, projectId
      );
      addOrUpdateDeptAIComment(comment);
    } catch (e) { console.error(e); }
    finally {
      setGeneratingIds((prev) => { const n = new Set(prev); n.delete(key); return n; });
    }
  }, [settings.apiKey, deptScoreData, addOrUpdateDeptAIComment, settings.issueThreshold]);

  const generateAllComments = useCallback(async () => {
    if (!deptScoreData || !analysis) return;
    await genOverviewComment();
    for (const q of analysis.issueQuestions) {
      await genQuestionComment(q.number);
    }
    for (const q of analysis.excellentQuestions) {
      await genQuestionComment(q.number);
    }
    for (const d of analysis.subDepts) {
      await genDeptComment(d);
    }
  }, [deptScoreData, analysis, genOverviewComment, genQuestionComment, genDeptComment]);

  if (!deptScoreData) {
    return (
      <div className="text-center py-16 text-slate-400">
        <Building2 size={48} className="mx-auto mb-3 opacity-50" />
        <p>部署別データを取り込むと分析結果が表示されます</p>
      </div>
    );
  }

  if (!analysis) return null;

  const { subDepts, deptAverages, overallAvg, issueQuestions, excellentQuestions, lowestDept, highestDept } = analysis;
  const { overallDepartment } = deptScoreData;

  const tabs = [
    { key: 'overview', label: '概要', icon: Globe },
    { key: 'issues', label: `課題項目 (${issueQuestions.length})`, icon: AlertTriangle },
    { key: 'excellent', label: `優良項目 (${excellentQuestions.length})`, icon: Star },
    { key: 'department', label: '部署詳細', icon: BarChart3 },
  ] as const;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-800">部署別分析結果</h2>
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

      {/* Overview tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-4">
            <SummaryCard label="部署数" value={subDepts.length} />
            <SummaryCard label="全体平均" value={overallAvg} />
            <SummaryCard label="最低部署" value={lowestDept ? `${lowestDept.dept} (${lowestDept.avg})` : '-'} warn />
            <SummaryCard label="最高部署" value={highestDept ? `${highestDept.dept} (${highestDept.avg})` : '-'} good />
          </div>

          {/* Department ranking */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h4 className="font-medium text-slate-700 mb-4">部署別平均スコアランキング</h4>
            <div className="space-y-2">
              {deptAverages
                .sort((a, b) => b.avg - a.avg)
                .map((d, i) => (
                  <div key={d.dept} className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-500 w-6">{i + 1}</span>
                    <span className="text-sm text-slate-700 w-28 truncate" title={d.dept}>{d.dept}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          d.avg <= settings.issueThreshold
                            ? 'bg-red-400'
                            : d.avg >= settings.excellentThreshold
                            ? 'bg-emerald-400'
                            : 'bg-blue-400'
                        }`}
                        style={{ width: `${(d.avg / settings.scaleMax) * 100}%` }}
                      />
                    </div>
                    <span className={`text-sm font-bold w-10 text-right ${
                      d.avg <= settings.issueThreshold ? 'text-red-600' :
                      d.avg >= settings.excellentThreshold ? 'text-emerald-600' : 'text-slate-700'
                    }`}>
                      {d.avg}
                    </span>
                  </div>
                ))}
            </div>
          </div>

          {/* Overview AI comment */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h4 className="font-medium text-slate-700 mb-2">全体総括</h4>
            <AICommentCard
              comment={deptAIComments.find((c) => c.targetType === 'dept_overview' && c.targetId === 'overview')}
              onEdit={updateDeptAIComment}
              onReset={resetDeptAIComment}
              onRegenerate={settings.apiKey ? genOverviewComment : undefined}
              isGenerating={generatingIds.has('dept_overview-overview')}
            />
          </div>
        </div>
      )}

      {/* Issues tab */}
      {activeTab === 'issues' && (
        <div className="space-y-4">
          {issueQuestions.length === 0 ? (
            <p className="text-center py-8 text-slate-400">
              課題項目はありません（閾値: {settings.issueThreshold}以下）
            </p>
          ) : (
            issueQuestions
              .sort((a, b) => {
                const aMin = Math.min(...Object.values(a.scores));
                const bMin = Math.min(...Object.values(b.scores));
                return aMin - bMin;
              })
              .map((q) => {
                const comment = deptAIComments.find(
                  (c) => c.targetType === 'dept_question' && c.targetId === `q-${q.number}`
                );
                const genKey = `dept_question-q-${q.number}`;
                return (
                  <div key={q.number} className="bg-white rounded-xl border border-slate-200 p-5">
                    <h4 className="font-medium text-slate-800">
                      Q{q.number}. {q.label}
                    </h4>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {deptScoreData.departments.map((d) => {
                        const score = q.scores[d];
                        if (score === undefined) return null;
                        const isIssue = score <= settings.issueThreshold;
                        const isOverall = d === overallDepartment;
                        return (
                          <span
                            key={d}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                              isOverall
                                ? 'bg-slate-100 text-slate-700 ring-1 ring-slate-300'
                                : isIssue
                                ? 'bg-red-100 text-red-700'
                                : 'bg-slate-50 text-slate-600'
                            }`}
                          >
                            {d}: {score}
                          </span>
                        );
                      })}
                    </div>
                    <AICommentCard
                      comment={comment}
                      onEdit={updateDeptAIComment}
                      onReset={resetDeptAIComment}
                      onRegenerate={settings.apiKey ? () => genQuestionComment(q.number) : undefined}
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
          {excellentQuestions.length === 0 ? (
            <p className="text-center py-8 text-slate-400">
              優良項目はありません（閾値: {settings.excellentThreshold}以上）
            </p>
          ) : (
            excellentQuestions
              .sort((a, b) => {
                const aMax = Math.max(...Object.values(a.scores));
                const bMax = Math.max(...Object.values(b.scores));
                return bMax - aMax;
              })
              .map((q) => {
                const comment = deptAIComments.find(
                  (c) => c.targetType === 'dept_question' && c.targetId === `q-${q.number}`
                );
                const genKey = `dept_question-q-${q.number}`;
                return (
                  <div key={q.number} className="bg-white rounded-xl border border-slate-200 p-5">
                    <h4 className="font-medium text-slate-800">
                      Q{q.number}. {q.label}
                    </h4>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {deptScoreData.departments.map((d) => {
                        const score = q.scores[d];
                        if (score === undefined) return null;
                        const isExcellent = score >= settings.excellentThreshold;
                        const isOverall = d === overallDepartment;
                        return (
                          <span
                            key={d}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                              isOverall
                                ? 'bg-slate-100 text-slate-700 ring-1 ring-slate-300'
                                : isExcellent
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate-50 text-slate-600'
                            }`}
                          >
                            {d}: {score}
                          </span>
                        );
                      })}
                    </div>
                    <AICommentCard
                      comment={comment}
                      onEdit={updateDeptAIComment}
                      onReset={resetDeptAIComment}
                      onRegenerate={settings.apiKey ? () => genQuestionComment(q.number) : undefined}
                      isGenerating={generatingIds.has(genKey)}
                    />
                  </div>
                );
              })
          )}
        </div>
      )}

      {/* Department detail tab */}
      {activeTab === 'department' && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <select
              value={selectedDept || (subDepts[0] ?? '')}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {subDepts.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {(() => {
            const dept = selectedDept || subDepts[0] || '';
            if (!dept) return null;
            const deptAvg = deptAverages.find((d) => d.dept === dept);
            const deptIssues = deptScoreData.questions.filter(
              (q) => (q.scores[dept] ?? 99) <= settings.issueThreshold
            );
            const deptExcellents = deptScoreData.questions.filter(
              (q) => (q.scores[dept] ?? 0) >= settings.excellentThreshold
            );
            const comment = deptAIComments.find(
              (c) => c.targetType === 'dept_department' && c.targetId === dept
            );
            const genKey = `dept_department-${dept}`;

            return (
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-slate-800 text-lg">{dept}</h4>
                  <div className="flex gap-4 text-sm">
                    <span className="text-slate-500">
                      平均: <span className="font-bold text-slate-800">{deptAvg?.avg ?? '-'}</span>
                    </span>
                    <span className="text-red-500">
                      課題: <span className="font-bold">{deptIssues.length}件</span>
                    </span>
                    <span className="text-emerald-500">
                      優良: <span className="font-bold">{deptExcellents.length}件</span>
                    </span>
                  </div>
                </div>

                {/* Score table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="px-3 py-2 text-left font-medium text-slate-600">#</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-600">設問</th>
                        <th className="px-3 py-2 text-right font-medium text-slate-600">{dept}</th>
                        {overallDepartment && (
                          <th className="px-3 py-2 text-right font-medium text-slate-600">{overallDepartment}</th>
                        )}
                        {overallDepartment && (
                          <th className="px-3 py-2 text-right font-medium text-slate-600">差分</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {deptScoreData.questions.map((q) => {
                        const score = q.scores[dept];
                        const overall = overallDepartment ? q.scores[overallDepartment] : undefined;
                        const diff = score !== undefined && overall !== undefined
                          ? Math.round((score - overall) * 100) / 100
                          : undefined;
                        const isIssue = score !== undefined && score <= settings.issueThreshold;
                        const isExcellent = score !== undefined && score >= settings.excellentThreshold;
                        return (
                          <tr key={q.number} className={`border-t border-slate-100 ${isIssue ? 'bg-red-50/50' : isExcellent ? 'bg-emerald-50/50' : ''}`}>
                            <td className="px-3 py-2 text-slate-500">{q.number}</td>
                            <td className="px-3 py-2 text-slate-700">{q.label}</td>
                            <td className={`px-3 py-2 text-right font-bold ${
                              isIssue ? 'text-red-600' : isExcellent ? 'text-emerald-600' : 'text-slate-700'
                            }`}>
                              {score ?? '-'}
                            </td>
                            {overallDepartment && (
                              <td className="px-3 py-2 text-right text-slate-500">{overall ?? '-'}</td>
                            )}
                            {overallDepartment && (
                              <td className={`px-3 py-2 text-right text-xs font-medium ${
                                diff !== undefined && diff > 0 ? 'text-green-600' :
                                diff !== undefined && diff < 0 ? 'text-red-600' : 'text-slate-400'
                              }`}>
                                {diff !== undefined ? `${diff >= 0 ? '+' : ''}${diff}` : '-'}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <AICommentCard
                  comment={comment}
                  onEdit={updateDeptAIComment}
                  onReset={resetDeptAIComment}
                  onRegenerate={settings.apiKey ? () => genDeptComment(dept) : undefined}
                  isGenerating={generatingIds.has(genKey)}
                />
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, warn, good }: {
  label: string;
  value: string | number;
  warn?: boolean;
  good?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-lg font-bold truncate ${
        warn ? 'text-red-600' : good ? 'text-emerald-600' : 'text-slate-800'
      }`}>
        {value}
      </p>
    </div>
  );
}
