import { useState, useCallback } from 'react';
import { Upload, FileText, AlertTriangle, CheckCircle, Download, Trash2 } from 'lucide-react';
import { useSurveyStore } from '@/store/surveyStore';
import { parseCSV, parseExcel, validateData, convertToResponses, generateQuestions, generateSampleCSV } from '@/lib/parser';
import type { ParsedSurveyData, ValidationResult } from '@/types';
import { v4 as uuidv4 } from 'uuid';

export default function UploadPage() {
  const {
    parsedData, settings, setParsedData, setProject, setQuestions,
    setResponses, resetAll,
  } = useSurveyStore();
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const handleFile = useCallback(async (file: File) => {
    setIsLoading(true);
    setError('');
    setValidation(null);
    setFileName(file.name);

    try {
      let data: ParsedSurveyData;
      if (file.name.endsWith('.csv')) {
        data = await parseCSV(file);
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        data = await parseExcel(file);
      } else {
        throw new Error('CSVまたはExcelファイルを選択してください');
      }

      const result = validateData(data, settings.scaleMin, settings.scaleMax);
      setValidation(result);
      setParsedData(data);

      if (result.isValid) {
        const projectId = uuidv4();
        setProject({
          id: projectId,
          name: file.name.replace(/\.[^.]+$/, ''),
          description: '',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        const questions = generateQuestions(data, projectId, settings.scaleMin, settings.scaleMax);
        setQuestions(questions);
        const responses = convertToResponses(data, projectId);
        setResponses(responses);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '読み込みエラー');
    } finally {
      setIsLoading(false);
    }
  }, [settings, setParsedData, setProject, setQuestions, setResponses]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDownloadTemplate = () => {
    const csv = generateSampleCSV();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'survey_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-800 mb-6">データ取り込み</h2>

      {/* Upload area */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="border-2 border-dashed border-slate-300 rounded-xl p-10 text-center hover:border-blue-400 hover:bg-blue-50/30 transition-colors cursor-pointer"
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <label htmlFor="file-input" className="sr-only">CSVまたはExcelファイルを選択</label>
        <input
          id="file-input"
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          title="CSVまたはExcelファイルを選択"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        <Upload size={40} className="mx-auto text-slate-400 mb-3" />
        <p className="text-slate-600 font-medium">
          CSVまたはExcelファイルをドラッグ＆ドロップ
        </p>
        <p className="text-sm text-slate-400 mt-1">またはクリックしてファイルを選択</p>
      </div>

      <div className="flex gap-3 mt-4">
        <button
          onClick={handleDownloadTemplate}
          className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
        >
          <Download size={16} /> サンプルCSVをダウンロード
        </button>
        {parsedData && (
          <button
            onClick={() => { resetAll(); setValidation(null); setFileName(''); setError(''); }}
            className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
          >
            <Trash2 size={16} /> データをクリア
          </button>
        )}
      </div>

      {isLoading && (
        <div className="mt-6 text-center text-slate-500">読み込み中...</div>
      )}

      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Validation results */}
      {validation && (
        <div className="mt-6 space-y-4">
          <div className={`p-4 rounded-lg border ${
            validation.isValid
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center gap-2">
              {validation.isValid ? (
                <CheckCircle size={18} className="text-green-600" />
              ) : (
                <AlertTriangle size={18} className="text-red-600" />
              )}
              <span className={`font-medium ${validation.isValid ? 'text-green-700' : 'text-red-700'}`}>
                {validation.isValid ? 'データ検証OK' : 'データにエラーがあります'}
              </span>
            </div>
          </div>

          {validation.errors.length > 0 && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm font-medium text-red-700 mb-2">エラー ({validation.errors.length}件)</p>
              <ul className="space-y-1 max-h-40 overflow-y-auto">
                {validation.errors.slice(0, 20).map((e, i) => (
                  <li key={i} className="text-xs text-red-600">
                    {e.row ? `行${e.row}` : ''}{e.column ? ` [${e.column}]` : ''}: {e.message}
                  </li>
                ))}
                {validation.errors.length > 20 && (
                  <li className="text-xs text-red-500">...他{validation.errors.length - 20}件</li>
                )}
              </ul>
            </div>
          )}

          {validation.warnings.length > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm font-medium text-amber-700 mb-2">警告 ({validation.warnings.length}件)</p>
              <ul className="space-y-1 max-h-40 overflow-y-auto">
                {validation.warnings.slice(0, 20).map((w, i) => (
                  <li key={i} className="text-xs text-amber-600">
                    {w.row ? `行${w.row}` : ''}{w.column ? ` [${w.column}]` : ''}: {w.message}
                  </li>
                ))}
                {validation.warnings.length > 20 && (
                  <li className="text-xs text-amber-500">...他{validation.warnings.length - 20}件</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Data preview */}
      {parsedData && validation?.isValid && (
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-3">
            <FileText size={18} className="text-slate-500" />
            <h3 className="font-medium text-slate-700">データプレビュー</h3>
            <span className="text-xs text-slate-400">{fileName} ({parsedData.rows.length}行)</span>
          </div>
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100">
                  {parsedData.headers.map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium text-slate-600 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsedData.rows.slice(0, 10).map((row, i) => (
                  <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                    {parsedData.headers.map((h) => (
                      <td key={h} className="px-3 py-2 text-slate-700 whitespace-nowrap">
                        {String(row[h] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {parsedData.rows.length > 10 && (
              <div className="px-3 py-2 text-xs text-slate-400 bg-slate-50 border-t border-slate-100">
                先頭10行を表示（全{parsedData.rows.length}行）
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
