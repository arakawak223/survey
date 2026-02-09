import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import type {
  ParsedSurveyData,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  SurveyResponse,
  Question,
  DepartmentScoreData,
  DepartmentScoreQuestion,
} from '@/types';
import { classifyQuestion } from './analysis';

// ── CSV パース ──────────────────────────────────
export function parseCSV(file: File): Promise<ParsedSurveyData> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        try {
          const headers = result.meta.fields || [];
          const rows = result.data as Record<string, string | number>[];
          const freq = tryConvertFrequencyTable(headers, rows);
          resolve(freq ?? processParsedRows(headers, rows));
        } catch (e) {
          reject(e);
        }
      },
      error: (err) => reject(err),
    });
  });
}

// ── Excel パース ────────────────────────────────
export function parseExcel(file: File): Promise<ParsedSurveyData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet);
        const headers = Object.keys(jsonData[0] || {});
        const freq = tryConvertFrequencyTable(headers, jsonData);
        resolve(freq ?? processParsedRows(headers, jsonData));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'));
    reader.readAsArrayBuffer(file);
  });
}

// ── 度数分布表の検出・変換 ──────────────────────
// Excel形式例:
//   Row1(header): 事前アンケート | (空) | 5    | 4         | 3           | 2              | 1         | (空)   | (空) | 点
//   Row2(label):  番号          | 質問  | そう思う | 少しそう思う | どちらでもない | あまりそう思わない | そう思わない | 無回答 | 総数 | 加重平均値
//   Row3+:        1            | 質問文 | 6    | 16        | 23          | 17             | 2         | 2      | 65   | 3.1

function tryConvertFrequencyTable(
  headers: string[],
  rows: Record<string, string | number>[]
): ParsedSurveyData | null {
  if (rows.length < 3) return null;

  // ヘッダーからスコア列（1〜5 or 1〜7 等の数値）を検出
  const scoreHeaderMap = new Map<number, string>(); // score -> headerKey
  for (const h of headers) {
    const num = Number(h);
    if (Number.isInteger(num) && num >= 1 && num <= 10) {
      scoreHeaderMap.set(num, String(h));
    }
  }
  if (scoreHeaderMap.size < 3) return null;

  // 1行目がラベル行か確認（スコア列にテキストが入っている）
  const firstRow = rows[0];
  const textInScoreCols = Array.from(scoreHeaderMap.values()).filter((h) => {
    const val = firstRow[h];
    return typeof val === 'string' && val.length > 1;
  });
  if (textInScoreCols.length < scoreHeaderMap.size / 2) return null;

  // === 度数分布表と判定 ===
  const dataRows = rows.slice(1); // ラベル行をスキップ

  // 質問テキスト列を検出（長いテキストが入っている列）
  const textColumn = headers.find((h) =>
    dataRows.some((row) => {
      const val = row[h];
      return typeof val === 'string' && val.length > 5;
    })
  );
  if (!textColumn) return null;

  // 番号列を検出（テキスト列でもスコア列でもない、数値が入っている列）
  const nonDataCols = new Set([textColumn, ...scoreHeaderMap.values()]);
  const numberColumn = headers.find(
    (h) => !nonDataCols.has(h) && dataRows.some((row) => !isNaN(Number(row[h])) && Number(row[h]) > 0)
  );

  // 加重平均列を検出（"点" or "平均" を含む列、もしくは小数値の列）
  const avgColumn = headers.find((h) => /点|平均|average|avg|mean/i.test(String(h)));

  // 各設問を解析
  interface QuestionFreq {
    number: number;
    text: string;
    counts: Map<number, number>; // score -> count
    total: number;
    weightedAvg: number | null;
  }
  const questions: QuestionFreq[] = [];

  for (const row of dataRows) {
    const text = String(row[textColumn] || '').trim();
    if (!text || text.length < 2) continue;

    const counts = new Map<number, number>();
    let total = 0;
    for (const [score, header] of scoreHeaderMap) {
      const count = Number(row[header]) || 0;
      counts.set(score, count);
      total += count;
    }
    if (total === 0) continue;

    const qNum = numberColumn ? (Number(row[numberColumn]) || questions.length + 1) : questions.length + 1;
    const wAvg = avgColumn ? Number(row[avgColumn]) || null : null;

    questions.push({ number: qNum, text, counts, total, weightedAvg: wAvg });
  }

  if (questions.length === 0) return null;

  // 擬似個別回答データを生成
  const maxTotal = Math.max(...questions.map((q) => q.total));
  const questionKeys = questions.map((q) => `Q${q.number}_${q.text}`);

  // 各設問の度数分布からスコア配列を生成してシャッフル
  const scoreArrays: (number | null)[][] = questions.map((q) => {
    const arr: (number | null)[] = [];
    for (const [score, count] of q.counts) {
      for (let i = 0; i < count; i++) {
        arr.push(score);
      }
    }
    // 無回答分はnull
    while (arr.length < maxTotal) {
      arr.push(null);
    }
    // Fisher-Yates シャッフル
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  });

  // 擬似回答者行を構築
  const pseudoRows: Record<string, string | number>[] = [];
  for (let i = 0; i < maxTotal; i++) {
    const row: Record<string, string | number> = {
      '回答者ID': String(i + 1).padStart(3, '0'),
    };
    questions.forEach((_, qIdx) => {
      const score = scoreArrays[qIdx][i];
      if (score !== null) {
        row[questionKeys[qIdx]] = score;
      }
    });
    pseudoRows.push(row);
  }

  return {
    headers: ['回答者ID', ...questionKeys],
    respondentIdColumn: '回答者ID',
    departmentColumn: '',
    questionColumns: questionKeys,
    rows: pseudoRows,
  };
}

// ── 通常フォーマット処理 ────────────────────────
function processParsedRows(
  headers: string[],
  rows: Record<string, string | number>[]
): ParsedSurveyData {
  const respondentIdColumn =
    headers.find((h) => /回答者|respondent|id/i.test(h) && !/部署|dept/i.test(h)) || headers[0];

  const departmentColumn =
    headers.find((h) => /部署|department|dept|組織/i.test(h)) || '';

  const questionColumns = headers.filter(
    (h) => h !== respondentIdColumn && h !== departmentColumn
  );

  return {
    headers,
    respondentIdColumn,
    departmentColumn,
    questionColumns,
    rows,
  };
}

// ── バリデーション ──────────────────────────────
export function validateData(
  data: ParsedSurveyData,
  scaleMin: number,
  scaleMax: number
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (data.rows.length === 0) {
    errors.push({ message: 'データが空です。' });
    return { isValid: false, errors, warnings };
  }

  if (data.questionColumns.length === 0) {
    errors.push({ message: '設問カラムが見つかりません。' });
    return { isValid: false, errors, warnings };
  }

  data.rows.forEach((row, idx) => {
    const rowNum = idx + 2;
    data.questionColumns.forEach((col) => {
      const val = row[col];
      if (val === '' || val === null || val === undefined) {
        warnings.push({ row: rowNum, column: col, message: '欠損値' });
        return;
      }
      const num = Number(val);
      if (isNaN(num)) {
        errors.push({ row: rowNum, column: col, message: `数値ではありません: "${val}"` });
      } else if (num < scaleMin || num > scaleMax) {
        warnings.push({
          row: rowNum,
          column: col,
          message: `範囲外の値: ${num}（${scaleMin}〜${scaleMax}）`,
        });
      }
    });
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// ── 変換ユーティリティ ──────────────────────────
export function convertToResponses(
  data: ParsedSurveyData,
  projectId: string
): SurveyResponse[] {
  return data.rows.map((row) => ({
    id: uuidv4(),
    projectId,
    respondentId: String(row[data.respondentIdColumn] || ''),
    department: data.departmentColumn ? String(row[data.departmentColumn] || '') : '',
    answers: Object.fromEntries(
      data.questionColumns
        .map((col) => [col, Number(row[col])])
        .filter(([, v]) => !isNaN(v as number))
    ),
  }));
}

export function generateQuestions(
  data: ParsedSurveyData,
  projectId: string,
  scaleMin: number,
  scaleMax: number
): Question[] {
  return data.questionColumns.map((col) => {
    const label = col.replace(/^Q\d+[_\s]*/i, '');
    return {
      id: uuidv4(),
      projectId,
      key: col,
      label: label || col,
      categoryId: classifyQuestion(col),
      scaleMin,
      scaleMax,
    };
  });
}

// ── 部署別スコアデータのパース ──────────────────
// Excel/CSV で 部署×設問 の平均点が入ったフォーマットを読み取る

const SKIP_COL_PATTERNS =
  /^(番号|No\.?|#|質問|そう思う|少しそう思う|どちらでもない|あまりそう思わない|そう思わない|無回答|総数|点|平均|average|avg|mean|count|total|回答|ID)$/i;

export function parseDepartmentScoreCSV(file: File): Promise<DepartmentScoreData> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        try {
          const rows = result.data as Record<string, string | number>[];
          resolve(extractDepartmentScores(rows));
        } catch (e) {
          reject(e);
        }
      },
      error: (err) => reject(err),
    });
  });
}

export function parseDepartmentScoreExcel(file: File): Promise<DepartmentScoreData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet);
        // ラベル行をスキップ（部署スコア列にテキストが入っている行）
        const cleaned = skipLabelRows(jsonData);
        resolve(extractDepartmentScores(cleaned));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'));
    reader.readAsArrayBuffer(file);
  });
}

function skipLabelRows(
  rows: Record<string, string | number>[]
): Record<string, string | number>[] {
  if (rows.length === 0) return rows;
  const headers = Object.keys(rows[0]);
  // 数値列を特定
  const numericHeaders = headers.filter((h) => {
    const vals = rows.slice(0, Math.min(5, rows.length)).map((r) => r[h]);
    return vals.some((v) => typeof v === 'number' || (!isNaN(Number(v)) && String(v).includes('.')));
  });
  if (numericHeaders.length === 0) return rows;

  // 先頭行が数値列にテキストを持っている場合はラベル行としてスキップ
  return rows.filter((row) => {
    const textInNumCols = numericHeaders.filter((h) => {
      const v = row[h];
      return typeof v === 'string' && v.length > 1 && isNaN(Number(v));
    });
    return textInNumCols.length < numericHeaders.length / 2;
  });
}

function extractDepartmentScores(
  rows: Record<string, string | number>[]
): DepartmentScoreData {
  if (rows.length === 0) throw new Error('データが空です');

  const headers = Object.keys(rows[0]);

  // 質問テキスト列を検出（長いテキストが入っている列）
  const textCol = headers.find((h) =>
    rows.some((r) => typeof r[h] === 'string' && String(r[h]).length > 5)
  );
  if (!textCol) throw new Error('質問テキスト列が見つかりません');

  // 番号列を検出
  const numCol = headers.find(
    (h) => h !== textCol && /番号|No|#/i.test(h)
  );

  // 部署スコア列を検出: スキップ対象でなく、大半の行に1〜5の数値があるもの
  const deptColumns = headers.filter((h) => {
    if (h === textCol || h === numCol) return false;
    if (SKIP_COL_PATTERNS.test(h.trim())) return false;
    const numericVals = rows
      .map((r) => Number(r[h]))
      .filter((v) => !isNaN(v) && v > 0);
    // 半数以上の行にデータがあり、すべて1〜5の範囲
    return (
      numericVals.length >= rows.length * 0.3 &&
      numericVals.every((v) => v >= 1 && v <= 5.5)
    );
  });

  if (deptColumns.length === 0) throw new Error('部署別スコア列が見つかりません');

  // "部門計" "全体" "合計" を含む列を全体列として検出
  const overallDept =
    deptColumns.find((h) => /部門計|全体|合計|total/i.test(h)) || '';

  // 設問データの構築
  const questions: DepartmentScoreQuestion[] = rows
    .filter((row) => {
      const text = String(row[textCol] || '').trim();
      return text.length > 2;
    })
    .map((row, idx) => {
      const label = String(row[textCol]).trim();
      const number = numCol ? Number(row[numCol]) || idx + 1 : idx + 1;
      const scores: Record<string, number> = {};
      for (const dept of deptColumns) {
        const val = Number(row[dept]);
        if (!isNaN(val) && val > 0) {
          scores[dept] = Math.round(val * 100) / 100;
        }
      }
      return {
        number,
        label,
        categoryId: classifyQuestion(label),
        scores,
      };
    });

  if (questions.length === 0) throw new Error('設問データが見つかりません');

  return {
    questions,
    departments: [...deptColumns].sort((a, b) => a.localeCompare(b, 'ja', { numeric: true })),
    overallDepartment: overallDept,
  };
}

export function generateSampleCSV(): string {
  const headers = '回答者ID,部署,Q1_仕事のやりがい,Q2_職場環境,Q3_給与待遇,Q4_上司との関係,Q5_成長機会,Q6_経営方針,Q7_チームワーク,Q8_福利厚生';
  const departments = ['営業部', '開発部', '人事部', '総務部', '企画部'];
  const rows: string[] = [headers];
  for (let i = 1; i <= 50; i++) {
    const dept = departments[Math.floor(Math.random() * departments.length)];
    const scores = Array.from({ length: 8 }, () => Math.floor(Math.random() * 5) + 1);
    rows.push(`${String(i).padStart(3, '0')},${dept},${scores.join(',')}`);
  }
  return rows.join('\n');
}
