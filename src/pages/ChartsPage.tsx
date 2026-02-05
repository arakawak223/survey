import { useState, useRef, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ScatterChart, Scatter, Cell, ReferenceLine,
  Label,
} from 'recharts';
import { LineChart as LineChartIcon, Download, ImageDown } from 'lucide-react';
import { useSurveyStore } from '@/store/surveyStore';
import { getDistribution } from '@/lib/analysis';
import html2canvas from 'html2canvas';

const QUADRANT_COLORS: Record<string, string> = {
  improve: '#ef4444',
  maintain: '#10b981',
  monitor: '#f59e0b',
  excess: '#6366f1',
};

const CHART_LABELS: Record<string, string> = {
  bar: '棒グラフ_設問別平均スコア',
  radar: 'レーダーチャート_カテゴリ別',
  isa: 'ISAマトリクス',
  distribution: '回答分布',
  heatmap: '部署別ヒートマップ',
};

export default function ChartsPage() {
  const { analysisResults, responses, questions, categories, departmentAnalyses, settings } = useSurveyStore();
  const [chartType, setChartType] = useState<'bar' | 'radar' | 'isa' | 'distribution' | 'heatmap'>('bar');
  const [selectedQuestion, setSelectedQuestion] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  const exportChart = useCallback(async () => {
    if (!chartRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
      });
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `${CHART_LABELS[chartType] || 'chart'}.png`;
      a.click();
    } finally {
      setIsExporting(false);
    }
  }, [chartType]);

  const exportAllCharts = useCallback(async () => {
    if (!chartRef.current) return;
    setIsExporting(true);
    const tabs: Array<'bar' | 'radar' | 'isa' | 'distribution' | 'heatmap'> = ['bar', 'radar', 'isa', 'distribution', 'heatmap'];
    try {
      for (const tab of tabs) {
        setChartType(tab);
        // wait for re-render
        await new Promise((r) => setTimeout(r, 500));
        if (!chartRef.current) continue;
        const canvas = await html2canvas(chartRef.current, {
          backgroundColor: '#ffffff',
          scale: 2,
        });
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

  if (analysisResults.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <LineChartIcon size={48} className="mx-auto mb-3 opacity-50" />
        <p>分析を実行するとチャートが表示されます</p>
      </div>
    );
  }

  const chartTabs = [
    { key: 'bar', label: '棒グラフ' },
    { key: 'radar', label: 'レーダーチャート' },
    { key: 'isa', label: 'ISAマトリクス' },
    { key: 'distribution', label: '分布' },
    { key: 'heatmap', label: '部署別ヒートマップ' },
  ] as const;

  // Bar chart data
  const barData = analysisResults.map((r) => ({
    name: r.questionLabel.length > 8 ? r.questionLabel.slice(0, 8) + '…' : r.questionLabel,
    fullName: r.questionLabel,
    平均値: r.mean,
    fill: r.extractionType === 'issue' ? '#ef4444' : r.extractionType === 'excellent' ? '#10b981' : '#3b82f6',
  }));

  // Radar chart data by category
  const radarData = categories
    .filter((c) => analysisResults.some((r) => r.categoryId === c.id))
    .map((cat) => {
      const catResults = analysisResults.filter((r) => r.categoryId === cat.id);
      const avg = catResults.reduce((s, r) => s + r.mean, 0) / catResults.length;
      return { category: cat.name, value: Math.round(avg * 100) / 100, fullMark: settings.scaleMax };
    });

  // ISA scatter data
  const scatterData = analysisResults.map((r) => ({
    x: r.importance,
    y: r.mean,
    name: r.questionLabel,
    quadrant: r.quadrant,
  }));

  // Distribution data
  const questionForDist = selectedQuestion || (questions[0]?.key ?? '');
  const distData = questionForDist
    ? getDistribution(responses, questionForDist, settings.scaleMin, settings.scaleMax)
    : [];

  // Heatmap data
  const departments = [...new Set(departmentAnalyses.map((d) => d.department))];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-800">チャート・可視化</h2>
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
            <h3 className="font-medium text-slate-700 mb-4">設問別 平均スコア</h3>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={barData} margin={{ top: 5, right: 30, left: 0, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" />
                <YAxis domain={[0, settings.scaleMax]} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value) => [value, '平均値']}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''}
                />
                <Bar dataKey="平均値" radius={[4, 4, 0, 0]}>
                  {barData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
                <ReferenceLine y={settings.issueThreshold} stroke="#ef4444" strokeDasharray="5 5" label="課題閾値" />
                <ReferenceLine y={settings.excellentThreshold} stroke="#10b981" strokeDasharray="5 5" label="優良閾値" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Radar Chart */}
        {chartType === 'radar' && (
          <div>
            <h3 className="font-medium text-slate-700 mb-4">カテゴリ別バランス</h3>
            <ResponsiveContainer width="100%" height={400}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="category" tick={{ fontSize: 12 }} />
                <PolarRadiusAxis domain={[0, settings.scaleMax]} tick={{ fontSize: 10 }} />
                <Radar
                  dataKey="value"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ISA Matrix Scatter */}
        {chartType === 'isa' && (
          <div>
            <h3 className="font-medium text-slate-700 mb-4">重要度-満足度マトリクス（ISA）</h3>
            <ResponsiveContainer width="100%" height={450}>
              <ScatterChart margin={{ top: 20, right: 40, bottom: 30, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  type="number"
                  dataKey="x"
                  domain={[0, 1]}
                  tick={{ fontSize: 12 }}
                  name="重要度"
                >
                  <Label value="重要度" offset={-10} position="insideBottom" style={{ fontSize: 12 }} />
                </XAxis>
                <YAxis
                  type="number"
                  dataKey="y"
                  domain={[settings.scaleMin, settings.scaleMax]}
                  tick={{ fontSize: 12 }}
                  name="満足度"
                >
                  <Label value="満足度" angle={-90} position="insideLeft" style={{ fontSize: 12 }} />
                </YAxis>
                <ReferenceLine x={0.5} stroke="#94a3b8" strokeDasharray="5 5" />
                <ReferenceLine y={(settings.scaleMin + settings.scaleMax) / 2} stroke="#94a3b8" strokeDasharray="5 5" />
                <Tooltip
                  formatter={(value) => value}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.name || ''}
                />
                <Scatter data={scatterData}>
                  {scatterData.map((entry, i) => (
                    <Cell key={i} fill={QUADRANT_COLORS[entry.quadrant] || '#6b7280'} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 mt-2">
              {Object.entries(QUADRANT_COLORS).map(([key, color]) => (
                <div key={key} className="flex items-center gap-1.5 text-xs text-slate-600">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                  {{ improve: '重点改善', maintain: '維持', monitor: '改善検討', excess: '過剰' }[key]}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Distribution Histogram */}
        {chartType === 'distribution' && (
          <div>
            <div className="flex items-center gap-4 mb-4">
              <h3 className="font-medium text-slate-700">回答分布</h3>
              <select
                value={questionForDist}
                onChange={(e) => setSelectedQuestion(e.target.value)}
                className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {questions.map((q) => (
                  <option key={q.key} value={q.key}>{q.label}</option>
                ))}
              </select>
            </div>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={distData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="value" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => [`${value}人`, '回答数']} />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} name="回答数" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Department Heatmap */}
        {chartType === 'heatmap' && (
          <div>
            <h3 className="font-medium text-slate-700 mb-4">部署別ヒートマップ</h3>
            {departments.length === 0 ? (
              <p className="text-center py-8 text-slate-400">部署データがありません</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="px-2 py-2 text-left text-xs font-medium text-slate-600"></th>
                      {questions.map((q) => (
                        <th key={q.key} className="px-2 py-2 text-center text-xs font-medium text-slate-600 max-w-[80px]">
                          <span className="block truncate" title={q.label}>{q.label}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {departments.map((dept) => (
                      <tr key={dept} className="border-t border-slate-100">
                        <td className="px-2 py-2 text-xs font-medium text-slate-700 whitespace-nowrap">{dept}</td>
                        {questions.map((q) => {
                          const da = departmentAnalyses.find(
                            (a) => a.department === dept && a.questionKey === q.key
                          );
                          const val = da?.mean ?? 0;
                          const ratio = (val - settings.scaleMin) / (settings.scaleMax - settings.scaleMin);
                          const r = Math.round(255 - ratio * 200);
                          const g = Math.round(55 + ratio * 200);
                          const bg = `rgb(${r}, ${g}, 80)`;
                          return (
                            <td
                              key={q.key}
                              className="px-2 py-2 text-center text-xs font-bold text-white"
                              style={{ backgroundColor: bg }}
                              title={`${dept} - ${q.label}: ${val}`}
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
            )}
          </div>
        )}
      </div>
    </div>
  );
}
