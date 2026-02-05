import { useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Trash2 } from 'lucide-react';
import { useSurveyStore } from '@/store/surveyStore';
import { parseDepartmentScoreExcel, parseDepartmentScoreCSV } from '@/lib/parser';
import type { DepartmentScoreData } from '@/types';

export default function DeptUploadPage() {
  const { deptScoreData, setDeptScoreData, setDeptAIComments } = useSurveyStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    setIsLoading(true);
    setError(null);
    try {
      let data: DepartmentScoreData;
      if (file.name.endsWith('.csv')) {
        data = await parseDepartmentScoreCSV(file);
      } else {
        data = await parseDepartmentScoreExcel(file);
      }
      setDeptScoreData(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'パース中にエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  }, [setDeptScoreData]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }, [handleFile]);

  const clearData = () => {
    setDeptScoreData(null);
    setDeptAIComments([]);
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-800 mb-6">部署別データ取り込み</h2>

      {/* Upload area */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors ${
          dragOver
            ? 'border-blue-400 bg-blue-50'
            : 'border-slate-300 bg-white hover:border-slate-400'
        }`}
      >
        <Upload size={40} className="mx-auto text-slate-400 mb-3" />
        <p className="text-sm text-slate-600 mb-2">
          部署別平均点データのExcelまたはCSVファイルをドラッグ＆ドロップ
        </p>
        <p className="text-xs text-slate-400 mb-4">
          設問行 × 部署列に平均スコアが入ったフォーマット
        </p>
        <label className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg cursor-pointer hover:bg-blue-700">
          <FileSpreadsheet size={16} />
          ファイルを選択
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={onFileSelect}
            className="hidden"
          />
        </label>
      </div>

      {isLoading && (
        <div className="mt-4 text-center text-sm text-slate-500">読み込み中...</div>
      )}

      {error && (
        <div className="mt-4 flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Data preview */}
      {deptScoreData && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} className="text-green-600" />
              <span className="text-sm font-medium text-green-700">データ読み込み完了</span>
            </div>
            <button
              onClick={clearData}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50"
            >
              <Trash2 size={14} />
              クリア
            </button>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-white rounded-lg border border-slate-200 p-4 text-center">
              <p className="text-xs text-slate-500">設問数</p>
              <p className="text-2xl font-bold text-slate-800">{deptScoreData.questions.length}</p>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-4 text-center">
              <p className="text-xs text-slate-500">部署数</p>
              <p className="text-2xl font-bold text-slate-800">{deptScoreData.departments.length}</p>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-4 text-center">
              <p className="text-xs text-slate-500">全体列</p>
              <p className="text-lg font-bold text-slate-800 truncate">
                {deptScoreData.overallDepartment || 'なし'}
              </p>
            </div>
          </div>

          {/* Preview table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
              <p className="text-sm font-medium text-slate-700">データプレビュー</p>
            </div>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-slate-600">#</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-600">設問</th>
                    {deptScoreData.departments.map((d) => (
                      <th key={d} className="px-3 py-2 text-right font-medium text-slate-600 whitespace-nowrap">
                        {d}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {deptScoreData.questions.map((q) => (
                    <tr key={q.number} className="border-t border-slate-100">
                      <td className="px-3 py-2 text-slate-500">{q.number}</td>
                      <td className="px-3 py-2 text-slate-700 max-w-[300px] truncate" title={q.label}>
                        {q.label}
                      </td>
                      {deptScoreData.departments.map((d) => (
                        <td key={d} className="px-3 py-2 text-right text-slate-700">
                          {q.scores[d] ?? '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
