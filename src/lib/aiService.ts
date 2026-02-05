import type { AnalysisResult, DepartmentAnalysis, AIComment, DepartmentScoreData } from '@/types';
import { v4 as uuidv4 } from 'uuid';

const API_URL = 'https://api.anthropic.com/v1/messages';

interface AIRequest {
  apiKey: string;
  systemPrompt: string;
  userPrompt: string;
}

async function callClaudeAPI({ apiKey, systemPrompt, userPrompt }: AIRequest): Promise<string> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API Error (${response.status}): ${err}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || '';
}

const SYSTEM_PROMPT = `あなたは企業のアンケート分析の専門家です。
提供された統計データに基づき、簡潔で実用的なコメントを日本語で生成してください。
具体的な数値を引用し、実行可能な提案を含めてください。
マークダウン形式は使わず、プレーンテキストで出力してください。`;

export async function generateIssueComment(
  apiKey: string,
  result: AnalysisResult,
  deptAnalyses: DepartmentAnalysis[],
  projectId: string
): Promise<AIComment> {
  const deptData = deptAnalyses
    .filter((d) => d.questionKey === result.questionKey)
    .map((d) => `${d.department}: 平均${d.mean}（全社比${d.diffFromOverall >= 0 ? '+' : ''}${d.diffFromOverall}）`)
    .join('\n');

  const prompt = `以下の課題項目について分析コメントを生成してください。

【設問】${result.questionLabel}
【全社平均】${result.mean}（5段階）
【中央値】${result.median}
【標準偏差】${result.stdDev}
【低評価(1-2)割合】${Math.round(result.lowRatio * 100)}%
【重要度】${result.importance}
【優先度】${result.priority === 'high' ? '高' : result.priority === 'medium' ? '中' : '低'}

【部署別データ】
${deptData || 'なし'}

以下の構成で200文字程度のコメントを生成してください：
1. 現状の課題認識（数値を引用）
2. 想定される影響
3. 具体的な改善提案（2-3点）`;

  const text = await callClaudeAPI({
    apiKey,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: prompt,
  });

  return {
    id: uuidv4(),
    projectId,
    targetType: 'issue',
    targetId: result.questionId,
    aiGeneratedText: text,
    editedText: text,
    isEdited: false,
    generatedAt: new Date(),
    editedAt: null,
  };
}

export async function generateExcellentComment(
  apiKey: string,
  result: AnalysisResult,
  deptAnalyses: DepartmentAnalysis[],
  projectId: string
): Promise<AIComment> {
  const deptData = deptAnalyses
    .filter((d) => d.questionKey === result.questionKey)
    .map((d) => `${d.department}: 平均${d.mean}（全社比${d.diffFromOverall >= 0 ? '+' : ''}${d.diffFromOverall}）`)
    .join('\n');

  const prompt = `以下の優良評価項目について分析コメントを生成してください。

【設問】${result.questionLabel}
【全社平均】${result.mean}（5段階）
【中央値】${result.median}
【標準偏差】${result.stdDev}
【高評価(4-5)割合】${Math.round(result.highRatio * 100)}%
【重要度】${result.importance}

【部署別データ】
${deptData || 'なし'}

以下の構成で200文字程度のコメントを生成してください：
1. 高評価の要因分析（数値を引用）
2. 組織の強みとしての位置づけ
3. 維持・さらなる強化のための施策（2-3点）`;

  const text = await callClaudeAPI({
    apiKey,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: prompt,
  });

  return {
    id: uuidv4(),
    projectId,
    targetType: 'excellent',
    targetId: result.questionId,
    aiGeneratedText: text,
    editedText: text,
    isEdited: false,
    generatedAt: new Date(),
    editedAt: null,
  };
}

// ── 部署別スコア分析用 AI コメント ─────────────────

export async function generateDeptQuestionComment(
  apiKey: string,
  questionLabel: string,
  questionNumber: number,
  scores: Record<string, number>,
  overallDept: string,
  issueThreshold: number,
  projectId: string
): Promise<AIComment> {
  const scoreLines = Object.entries(scores)
    .map(([dept, score]) => {
      const flag = score <= issueThreshold ? '【課題】' : score >= 4.0 ? '【優良】' : '';
      return `${dept}: ${score} ${flag}`;
    })
    .join('\n');

  const overallScore = overallDept ? scores[overallDept] : undefined;
  const subDepts = Object.entries(scores).filter(([d]) => d !== overallDept);
  const minDept = subDepts.length > 0 ? subDepts.reduce((a, b) => (a[1] < b[1] ? a : b)) : null;
  const maxDept = subDepts.length > 0 ? subDepts.reduce((a, b) => (a[1] > b[1] ? a : b)) : null;

  const prompt = `以下の設問について、部署間の比較分析コメントを生成してください。

【設問${questionNumber}】${questionLabel}
${overallScore !== undefined ? `【部門全体平均】${overallScore}` : ''}
${minDept ? `【最低部署】${minDept[0]}: ${minDept[1]}` : ''}
${maxDept ? `【最高部署】${maxDept[0]}: ${maxDept[1]}` : ''}

【部署別スコア】
${scoreLines}

以下の構成で200文字程度のコメントを生成してください：
1. 部署間のスコア差異の概要（具体的な数値を引用）
2. 特に注目すべき部署（低スコア・高スコア）
3. 部署間格差を踏まえた具体的な改善・対応提案（2-3点）`;

  const text = await callClaudeAPI({
    apiKey,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: prompt,
  });

  return {
    id: uuidv4(),
    projectId,
    targetType: 'dept_question',
    targetId: `q-${questionNumber}`,
    aiGeneratedText: text,
    editedText: text,
    isEdited: false,
    generatedAt: new Date(),
    editedAt: null,
  };
}

export async function generateDeptDepartmentComment(
  apiKey: string,
  deptName: string,
  data: DepartmentScoreData,
  issueThreshold: number,
  excellentThreshold: number,
  projectId: string
): Promise<AIComment> {
  const questions = data.questions;
  const scores = questions.map((q) => q.scores[deptName]).filter((v) => v !== undefined);
  const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const issues = questions.filter((q) => (q.scores[deptName] ?? 99) <= issueThreshold);
  const excellents = questions.filter((q) => (q.scores[deptName] ?? 0) >= excellentThreshold);

  const overallDept = data.overallDepartment;
  const diffLines = overallDept
    ? questions
        .map((q) => {
          const s = q.scores[deptName];
          const o = q.scores[overallDept];
          if (s === undefined || o === undefined) return null;
          const diff = Math.round((s - o) * 100) / 100;
          if (Math.abs(diff) >= 0.3) {
            return `・${q.label}（${s} / 全体${o} / 差${diff >= 0 ? '+' : ''}${diff}）`;
          }
          return null;
        })
        .filter(Boolean)
        .join('\n')
    : '';

  const prompt = `以下の部署の従業員満足度調査結果について分析コメントを生成してください。

【部署名】${deptName}
【全設問平均】${Math.round(avg * 100) / 100}（5段階）
【課題項目数】${issues.length}件${issues.length > 0 ? `（${issues.map((q) => q.label).join('、')}）` : ''}
【優良項目数】${excellents.length}件${excellents.length > 0 ? `（${excellents.map((q) => q.label).join('、')}）` : ''}

${diffLines ? `【全体平均との差が大きい項目】\n${diffLines}` : ''}

以下の構成で250文字程度のコメントを生成してください：
1. この部署の全体的な傾向（数値を引用）
2. 強みと課題の要約
3. 重点的に取り組むべき改善提案（2-3点）`;

  const text = await callClaudeAPI({
    apiKey,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: prompt,
  });

  return {
    id: uuidv4(),
    projectId,
    targetType: 'dept_department',
    targetId: deptName,
    aiGeneratedText: text,
    editedText: text,
    isEdited: false,
    generatedAt: new Date(),
    editedAt: null,
  };
}

export async function generateDeptOverviewComment(
  apiKey: string,
  data: DepartmentScoreData,
  issueThreshold: number,
  projectId: string
): Promise<AIComment> {
  const deptAvgs = data.departments.map((dept) => {
    const scores = data.questions.map((q) => q.scores[dept]).filter((v) => v !== undefined);
    const avg = scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100 : 0;
    const issueCount = data.questions.filter((q) => (q.scores[dept] ?? 99) <= issueThreshold).length;
    return { dept, avg, issueCount };
  });

  const deptSummary = deptAvgs
    .map((d) => `${d.dept}: 平均${d.avg}、課題${d.issueCount}件`)
    .join('\n');

  const prompt = `以下の部署別従業員満足度調査の全体総括コメントを生成してください。

【部署数】${data.departments.length}
【設問数】${data.questions.length}

【部署別サマリー】
${deptSummary}

以下の構成で300文字程度のコメントを生成してください：
1. 組織全体の傾向と部署間格差の概況
2. 特に注意が必要な部署と項目
3. 組織横断的な優先課題（2-3点）
4. 部署別に取り組むべきアクションの方向性`;

  const text = await callClaudeAPI({
    apiKey,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: prompt,
  });

  return {
    id: uuidv4(),
    projectId,
    targetType: 'dept_overview',
    targetId: 'overview',
    aiGeneratedText: text,
    editedText: text,
    isEdited: false,
    generatedAt: new Date(),
    editedAt: null,
  };
}

export async function generatePriorityComment(
  apiKey: string,
  quadrant: string,
  results: AnalysisResult[],
  projectId: string
): Promise<AIComment> {
  const quadrantLabel =
    quadrant === 'improve' ? '重点改善（高重要度×低満足度）' :
    quadrant === 'maintain' ? '維持（高重要度×高満足度）' :
    quadrant === 'monitor' ? '改善検討（低重要度×低満足度）' :
    '過剰（低重要度×高満足度）';

  const items = results
    .map((r) => `・${r.questionLabel}（平均${r.mean}, 重要度${r.importance}）`)
    .join('\n');

  const prompt = `以下のISA分析（重要度-満足度分析）の象限結果について総括コメントを生成してください。

【象限】${quadrantLabel}
【該当項目】
${items || '該当なし'}

以下の構成で200文字程度のコメントを生成してください：
1. この象限の項目群の総括
2. 推奨アクション（2-3点）
3. 取り組みの優先順位の考え方`;

  const text = await callClaudeAPI({
    apiKey,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: prompt,
  });

  return {
    id: uuidv4(),
    projectId,
    targetType: 'priority_quadrant',
    targetId: quadrant,
    aiGeneratedText: text,
    editedText: text,
    isEdited: false,
    generatedAt: new Date(),
    editedAt: null,
  };
}
