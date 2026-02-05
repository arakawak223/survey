import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import { Users, BarChart3, AlertTriangle, Star, Upload } from 'lucide-react';
import { useSurveyStore } from '@/store/surveyStore';
import { useNavigate } from 'react-router-dom';

export default function DashboardPage() {
  const { responses, analysisResults, categories, settings } = useSurveyStore();
  const navigate = useNavigate();

  const stats = useMemo(() => {
    if (analysisResults.length === 0) return null;
    const issues = analysisResults.filter((r) => r.extractionType === 'issue');
    const excellents = analysisResults.filter((r) => r.extractionType === 'excellent');
    const overallMean = analysisResults.reduce((s, r) => s + r.mean, 0) / analysisResults.length;
    const topIssue = issues.sort((a, b) => a.mean - b.mean)[0];
    const topExcellent = excellents.sort((a, b) => b.mean - a.mean)[0];
    return {
      responseCount: responses.length,
      overallMean: Math.round(overallMean * 100) / 100,
      issueCount: issues.length,
      excellentCount: excellents.length,
      topIssue,
      topExcellent,
    };
  }, [analysisResults, responses]);

  if (!stats) {
    return (
      <div className="text-center py-20">
        <Upload size={56} className="mx-auto text-slate-300 mb-4" />
        <h2 className="text-lg font-medium text-slate-600 mb-2">アンケート結果分析アプリ</h2>
        <p className="text-slate-400 mb-6">CSVまたはExcelファイルをアップロードして分析を開始</p>
        <button
          onClick={() => navigate('/upload')}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          データを取り込む
        </button>
      </div>
    );
  }

  const barData = analysisResults
    .sort((a, b) => a.mean - b.mean)
    .map((r) => ({
      name: r.questionLabel.length > 6 ? r.questionLabel.slice(0, 6) + '…' : r.questionLabel,
      平均値: r.mean,
      fill: r.extractionType === 'issue' ? '#ef4444' : r.extractionType === 'excellent' ? '#10b981' : '#3b82f6',
    }));

  const radarData = categories
    .filter((c) => analysisResults.some((r) => r.categoryId === c.id))
    .map((cat) => {
      const catResults = analysisResults.filter((r) => r.categoryId === cat.id);
      const avg = catResults.reduce((s, r) => s + r.mean, 0) / catResults.length;
      return { category: cat.name, value: Math.round(avg * 100) / 100, fullMark: settings.scaleMax };
    });

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-800 mb-6">ダッシュボード</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card icon={Users} label="回答数" value={stats.responseCount} color="blue" />
        <Card icon={BarChart3} label="全体平均" value={stats.overallMean} color="slate" />
        <Card icon={AlertTriangle} label="課題項目" value={stats.issueCount} color="red" />
        <Card icon={Star} label="優良項目" value={stats.excellentCount} color="green" />
      </div>

      {/* Highlight */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {stats.topIssue && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-xs font-medium text-red-500 mb-1">最重要課題</p>
            <p className="font-medium text-red-800">{stats.topIssue.questionLabel}</p>
            <p className="text-sm text-red-600 mt-1">平均: {stats.topIssue.mean} / 低評価率: {Math.round(stats.topIssue.lowRatio * 100)}%</p>
          </div>
        )}
        {stats.topExcellent && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <p className="text-xs font-medium text-emerald-500 mb-1">最高評価項目</p>
            <p className="font-medium text-emerald-800">{stats.topExcellent.questionLabel}</p>
            <p className="text-sm text-emerald-600 mt-1">平均: {stats.topExcellent.mean} / 高評価率: {Math.round(stats.topExcellent.highRatio * 100)}%</p>
          </div>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-medium text-slate-700 mb-3">設問別スコア</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={barData} margin={{ top: 5, right: 10, left: -10, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" />
              <YAxis domain={[0, settings.scaleMax]} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="平均値" radius={[3, 3, 0, 0]}>
                {barData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-medium text-slate-700 mb-3">カテゴリバランス</h3>
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#e2e8f0" />
              <PolarAngleAxis dataKey="category" tick={{ fontSize: 11 }} />
              <PolarRadiusAxis domain={[0, settings.scaleMax]} tick={{ fontSize: 9 }} />
              <Radar dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} strokeWidth={2} />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function Card({ icon: Icon, label, value, color }: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: number | string;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    slate: 'bg-slate-100 text-slate-600',
    red: 'bg-red-50 text-red-600',
    green: 'bg-emerald-50 text-emerald-600',
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-1.5 rounded-lg ${colorMap[color]}`}>
          <Icon size={16} />
        </div>
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
    </div>
  );
}
