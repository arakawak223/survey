import { useState } from 'react';
import { FileDown, FileSpreadsheet, FileText } from 'lucide-react';
import { useSurveyStore } from '@/store/surveyStore';
import * as XLSX from 'xlsx';

export default function ReportPage() {
  const {
    project, analysisResults, departmentAnalyses, aiComments, questions,
    categories, responses,
  } = useSurveyStore();
  const [isExporting, setIsExporting] = useState(false);

  const issues = analysisResults.filter((r) => r.extractionType === 'issue');
  const excellents = analysisResults.filter((r) => r.extractionType === 'excellent');

  const getCategoryName = (id: string) => categories.find((c) => c.id === id)?.name || 'その他';
  const getComment = (targetType: string, targetId: string) => {
    const c = aiComments.find((a) => a.targetType === targetType && a.targetId === targetId);
    return c?.editedText || '';
  };

  const exportExcel = () => {
    setIsExporting(true);
    try {
      const wb = XLSX.utils.book_new();

      // サマリーシート
      const summaryData = [
        ['アンケート分析レポート', '', '', ''],
        ['プロジェクト名', project?.name || '', '', ''],
        ['回答数', responses.length, '', ''],
        ['分析日', new Date().toLocaleDateString('ja-JP'), '', ''],
        ['', '', '', ''],
        ['全設問スコア一覧', '', '', '', '', '', '', '', ''],
        ['設問', 'カテゴリ', '平均値', '中央値', '標準偏差', '低評価率', '高評価率', '重要度', '優先度', '分類'],
        ...analysisResults.map((r) => [
          r.questionLabel, getCategoryName(r.categoryId), r.mean, r.median, r.stdDev,
          `${Math.round(r.lowRatio * 100)}%`, `${Math.round(r.highRatio * 100)}%`,
          r.importance,
          r.priority === 'high' ? '高' : r.priority === 'medium' ? '中' : '低',
          r.extractionType === 'issue' ? '課題' : r.extractionType === 'excellent' ? '優良' : '-',
        ]),
      ];
      const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, ws1, 'サマリー');

      // 課題項目シート
      const issueData = [
        ['課題項目一覧', '', '', '', ''],
        ['設問', '平均値', '低評価率', '優先度', 'AIコメント'],
        ...issues.map((r) => [
          r.questionLabel, r.mean, `${Math.round(r.lowRatio * 100)}%`,
          r.priority === 'high' ? '高' : r.priority === 'medium' ? '中' : '低',
          getComment('issue', r.questionId),
        ]),
      ];
      const ws2 = XLSX.utils.aoa_to_sheet(issueData);
      XLSX.utils.book_append_sheet(wb, ws2, '課題項目');

      // 優良項目シート
      const excellentData = [
        ['優良項目一覧', '', '', '', ''],
        ['設問', '平均値', '高評価率', 'AIコメント'],
        ...excellents.map((r) => [
          r.questionLabel, r.mean, `${Math.round(r.highRatio * 100)}%`,
          getComment('excellent', r.questionId),
        ]),
      ];
      const ws3 = XLSX.utils.aoa_to_sheet(excellentData);
      XLSX.utils.book_append_sheet(wb, ws3, '優良項目');

      // 優先順位シート
      const priorityData: (string | number)[][] = [
        ['優先順位（ISA分析）', '', '', '', ''],
        ['象限', '設問', '平均値', '重要度', 'AIコメント'],
      ];
      for (const q of ['improve', 'maintain', 'monitor', 'excess'] as const) {
        const label = { improve: '重点改善', maintain: '維持', monitor: '改善検討', excess: '過剰' }[q];
        const items = analysisResults.filter((r) => r.quadrant === q);
        const comment = getComment('priority_quadrant', q);
        items.forEach((r, i) => {
          priorityData.push([i === 0 ? label : '', r.questionLabel, r.mean, r.importance, i === 0 ? comment : '']);
        });
        if (items.length === 0) {
          priorityData.push([label, '該当なし', '', '', comment]);
        }
      }
      const ws4 = XLSX.utils.aoa_to_sheet(priorityData);
      XLSX.utils.book_append_sheet(wb, ws4, '優先順位');

      // 部署別シート
      const departments = [...new Set(departmentAnalyses.map((d) => d.department))];
      if (departments.length > 0) {
        const deptHeader = ['設問', '全社平均', ...departments];
        const deptRows = questions.map((q) => {
          const overall = analysisResults.find((r) => r.questionKey === q.key);
          const deptValues = departments.map((d) => {
            const da = departmentAnalyses.find((a) => a.department === d && a.questionKey === q.key);
            return da?.mean ?? '';
          });
          return [q.label, overall?.mean ?? '', ...deptValues];
        });
        const ws5 = XLSX.utils.aoa_to_sheet([['部署別比較'], deptHeader, ...deptRows]);
        XLSX.utils.book_append_sheet(wb, ws5, '部署別比較');
      }

      XLSX.writeFile(wb, `${project?.name || 'survey'}_report.xlsx`);
    } finally {
      setIsExporting(false);
    }
  };

  const exportPDF = async () => {
    setIsExporting(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'landscape' });

      // タイトル
      doc.setFontSize(18);
      doc.text('Survey Analysis Report', 14, 20);
      doc.setFontSize(11);
      doc.text(`Project: ${project?.name || 'N/A'}`, 14, 30);
      doc.text(`Responses: ${responses.length}`, 14, 37);
      doc.text(`Date: ${new Date().toLocaleDateString('ja-JP')}`, 14, 44);

      // スコア一覧テーブル
      let y = 56;
      doc.setFontSize(13);
      doc.text('Score Summary', 14, y);
      y += 8;
      doc.setFontSize(9);
      const headers = ['Question', 'Mean', 'Median', 'StdDev', 'Priority', 'Type'];
      headers.forEach((h, i) => doc.text(h, 14 + i * 45, y));
      y += 6;

      analysisResults.forEach((r) => {
        if (y > 190) {
          doc.addPage();
          y = 20;
        }
        const row = [
          r.questionLabel.slice(0, 20),
          String(r.mean),
          String(r.median),
          String(r.stdDev),
          r.priority,
          r.extractionType,
        ];
        row.forEach((val, i) => doc.text(val, 14 + i * 45, y));
        y += 5;
      });

      doc.save(`${project?.name || 'survey'}_report.pdf`);
    } finally {
      setIsExporting(false);
    }
  };

  if (analysisResults.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <FileDown size={48} className="mx-auto mb-3 opacity-50" />
        <p>分析を実行するとレポートを出力できます</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-800 mb-6">レポート出力</h2>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-medium text-slate-700 mb-2">出力内容</h3>
        <ul className="text-sm text-slate-600 space-y-1 mb-6">
          <li>- サマリー（回答数、全体平均、全スコア一覧）</li>
          <li>- 課題項目一覧 ({issues.length}件) + AIコメント</li>
          <li>- 優良項目一覧 ({excellents.length}件) + AIコメント</li>
          <li>- 優先順位マトリクス（ISA分析） + AIコメント</li>
          <li>- 部署別比較</li>
        </ul>

        <div className="flex gap-4">
          <button
            onClick={exportExcel}
            disabled={isExporting}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-medium"
          >
            <FileSpreadsheet size={18} />
            Excelダウンロード
          </button>
          <button
            onClick={exportPDF}
            disabled={isExporting}
            className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium"
          >
            <FileText size={18} />
            PDFダウンロード
          </button>
        </div>
        {isExporting && <p className="mt-3 text-sm text-slate-500">エクスポート中...</p>}
      </div>
    </div>
  );
}
