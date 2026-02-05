import { useState, useRef, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Legend, ReferenceLine, Cell,
} from 'recharts';
import { LineChart as LineChartIcon, Download, ImageDown } from 'lucide-react';
import { useSurveyStore } from '@/store/surveyStore';
import html2canvas from 'html2canvas';

const DEPT_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#6366f1',
];

const CHART_LABELS: Record<string, string> = {
  bar: '部署別_設問別比較',
  radar: '部署別_レーダーチャート',
  heatmap: '部署別_ヒートマップ',
  ranking: '部署別_ランキング',
};

export default function DeptChartsPage() {
  const { deptScoreData, settings } = useSurveyStore();
  const [chartType, setChartType] = useState<'bar' | 'radar' | 'heatmap' | 'ranking'>('bar');
  const [selectedQuestion, setSelectedQuestion] = useState<number>(0);
  const [isExporting, setIsExporting] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  const exportChart = useCallback(async () => {
    if (!chartRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(chartRef.current, { backgroundColor: '#ffffff', scale: 2 });
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `${CHART_LABELS[chartType] || 'dept_chart'}.png`;
      a.click();
    } finally {
      setIsExporting(false);
    }
  }, [chartType]);

  const exportAllCharts = useCallback(async () => {
    if (!chartRef.current) return;
    setIsExporting(true);
    const tabs: Array<'bar' | 'radar' | 'heatmap' | 'ranking'> = ['bar', 'radar', 'heatmap', 'ranking'];
    try {
      for (const tab of tabs) {
        setChartType(tab);
        await new Promise((r) => setTimeout(r, 500));
        if (!chartRef.current) continue;
        const canvas = await html2canvas(chartRef.current, { backgroundColor: '#ffffff', scale: 2 });
        const url = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = `${CHART_LABELS[tab]}.png`;
        a.click();
        await new Promise((r) => setTimeout(r, 300));
      }
    } finally {
      setIsExporting(false);
    }
  }, []);

  if (!deptScoreData) {
    return (
      <div className="text-center py-16 text-slate-400">
        <LineChartIcon size={48} className="mx-auto mb-3 opacity-50" />
        <p>部署別データを取り込むとチャートが表示されます</p>
      </div>
    );
  }

  const { questions, departments, overallDepartment } = deptScoreData;
  const subDepts = overallDepartment
    ? departments.filter((d) => d !== overallDepartment)
    : departments;

  const chartTabs = [
    { key: 'bar', label: '設問別比較' },
    { key: 'radar', label: 'レーダーチャート' },
    { key: 'heatmap', label: 'ヒートマップ' },
    { key: 'ranking', label: '部署ランキング' },
  ] as const;

  // Bar chart: per question, each department as a bar
  const currentQ = selectedQuestion || questions[0]?.number || 1;
  const barQuestion = questions.find((q) => q.number === currentQ);
  const barData = barQuestion
    ? subDepts.map((dept) => ({
        name: dept,
        スコア: barQuestion.scores[dept] ?? 0,
        fill: DEPT_COLORS[subDepts.indexOf(dept) % DEPT_COLORS.length],
      }))
    : [];
  const overallScore = barQuestion && overallDepartment ? barQuestion.scores[overallDepartment] : undefined;

  // Radar chart: each department as a radar line, axes are questions
  const radarData = questions.map((q) => {
    const entry: Record<string, string | number> = {
      question: q.label.length > 6 ? q.label.slice(0, 6) + '…' : q.label,
      fullName: q.label,
    };
    for (const dept of subDepts) {
      entry[dept] = q.scores[dept] ?? 0;
    }
    return entry;
  });

  // Ranking: average score per department
  const rankingData = subDepts
    .map((dept) => {
      const scores = questions.map((q) => q.scores[dept]).filter((v) => v !== undefined);
      const avg = scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100 : 0;
      return { name: dept, 平均スコア: avg };
    })
    .sort((a, b) => b.平均スコア - a.平均スコア);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-800">部署別チャート</h2>
        <div className="flex gap-2">
          <button
            onClick={exportChart}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-100 disabled:opacity-50"
          >
            <Download size={15} />
            このチャートをPNG保存
          </button>
          <button
            onClick={exportAllCharts}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <ImageDown size={15} />
            全チャートを一括保存
          </button>
        </div>
      </div>

      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {chartTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setChartType(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              chartType === tab.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div ref={chartRef} className="bg-white rounded-xl border border-slate-200 p-6">
        {/* Bar Chart */}
        {chartType === 'bar' && (
          <div>
            <div className="flex items-center gap-4 mb-4">
              <h3 className="font-medium text-slate-700">設問別 部署比較</h3>
              <select
                value={currentQ}
                onChange={(e) => setSelectedQuestion(Number(e.target.value))}
                className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {questions.map((q) => (
                  <option key={q.number} value={q.number}>Q{q.number}. {q.label}</option>
                ))}
              </select>
            </div>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={barData} margin={{ top: 5, right: 30, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" />
                <YAxis domain={[0, settings.scaleMax]} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => [value, 'スコア']} />
                <Bar dataKey="スコア" radius={[4, 4, 0, 0]}>
                  {barData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
                {overallScore !== undefined && (
                  <ReferenceLine y={overallScore} stroke="#f59e0b" strokeDasharray="5 5" label={`全体: ${overallScore}`} />
                )}
                <ReferenceLine y={settings.issueThreshold} stroke="#ef4444" strokeDasharray="3 3" label="課題閾値" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Radar Chart */}
        {chartType === 'radar' && (
          <div>
            <h3 className="font-medium text-slate-700 mb-4">部署別レーダーチャート</h3>
            <ResponsiveContainer width="100%" height={500}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="question" tick={{ fontSize: 10 }} />
                <PolarRadiusAxis domain={[0, settings.scaleMax]} tick={{ fontSize: 9 }} />
                {subDepts.map((dept, i) => (
                  <Radar
                    key={dept}
                    name={dept}
                    dataKey={dept}
                    stroke={DEPT_COLORS[i % DEPT_COLORS.length]}
                    fill={DEPT_COLORS[i % DEPT_COLORS.length]}
                    fillOpacity={0.05}
                    strokeWidth={2}
                  />
                ))}
                <Legend />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Heatmap */}
        {chartType === 'heatmap' && (
          <div>
            <h3 className="font-medium text-slate-700 mb-4">部署別ヒートマップ</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="px-2 py-2 text-left text-xs font-medium text-slate-600 sticky left-0 bg-white"></th>
                    {subDepts.map((d) => (
                      <th key={d} className="px-2 py-2 text-center text-xs font-medium text-slate-600 whitespace-nowrap">
                        {d}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {questions.map((q) => (
                    <tr key={q.number} className="border-t border-slate-100">
                      <td className="px-2 py-2 text-xs text-slate-700 sticky left-0 bg-white whitespace-nowrap max-w-[200px] truncate" title={q.label}>
                        Q{q.number}. {q.label}
                      </td>
                      {subDepts.map((d) => {
                        const val = q.scores[d] ?? 0;
                        const ratio = (val - settings.scaleMin) / (settings.scaleMax - settings.scaleMin);
                        const r = Math.round(255 - ratio * 200);
                        const g = Math.round(55 + ratio * 200);
                        const bg = val > 0 ? `rgb(${r}, ${g}, 80)` : '#f1f5f9';
                        return (
                          <td
                            key={d}
                            className="px-2 py-2 text-center text-xs font-bold text-white"
                            style={{ backgroundColor: bg }}
                            title={`${d} - Q${q.number}: ${val}`}
                          >
                            {val || '-'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Legend */}
            <div className="flex items-center justify-center gap-2 mt-4 text-xs text-slate-500">
              <span>低</span>
              <div className="flex">
                {[1, 2, 3, 4, 5].map((v) => {
                  const ratio = (v - 1) / 4;
                  const r = Math.round(255 - ratio * 200);
                  const g = Math.round(55 + ratio * 200);
                  return (
                    <div
                      key={v}
                      className="w-8 h-4 text-center text-[10px] font-bold text-white"
                      style={{ backgroundColor: `rgb(${r}, ${g}, 80)` }}
                    >
                      {v}
                    </div>
                  );
                })}
              </div>
              <span>高</span>
            </div>
          </div>
        )}

        {/* Ranking */}
        {chartType === 'ranking' && (
          <div>
            <h3 className="font-medium text-slate-700 mb-4">部署別平均スコアランキング</h3>
            <ResponsiveContainer width="100%" height={Math.max(300, rankingData.length * 50)}>
              <BarChart data={rankingData} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" domain={[0, settings.scaleMax]} tick={{ fontSize: 12 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={80} />
                <Tooltip formatter={(value) => [value, '平均スコア']} />
                <Bar dataKey="平均スコア" radius={[0, 4, 4, 0]}>
                  {rankingData.map((entry, i) => {
                    const fill = entry.平均スコア <= settings.issueThreshold
                      ? '#ef4444'
                      : entry.平均スコア >= settings.excellentThreshold
                      ? '#10b981'
                      : '#3b82f6';
                    return <Cell key={i} fill={fill} />;
                  })}
                </Bar>
                <ReferenceLine x={settings.issueThreshold} stroke="#ef4444" strokeDasharray="3 3" />
                <ReferenceLine x={settings.excellentThreshold} stroke="#10b981" strokeDasharray="3 3" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
