import { useState } from 'react';
import { Pencil, RotateCcw, RefreshCw, Check, X } from 'lucide-react';
import type { AIComment } from '@/types';

interface Props {
  comment: AIComment | undefined;
  onEdit: (id: string, text: string) => void;
  onReset: (id: string) => void;
  onRegenerate?: () => void;
  isGenerating?: boolean;
}

export default function AICommentCard({ comment, onEdit, onReset, onRegenerate, isGenerating }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');

  if (!comment && !onRegenerate) return null;

  const startEdit = () => {
    setEditText(comment?.editedText || '');
    setIsEditing(true);
  };

  const saveEdit = () => {
    if (comment) {
      onEdit(comment.id, editText);
    }
    setIsEditing(false);
  };

  const cancelEdit = () => setIsEditing(false);

  return (
    <div className="mt-3 border border-slate-200 rounded-lg bg-slate-50">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-white rounded-t-lg">
        <span className="text-xs font-medium text-slate-500">
          AIコメント
          {comment?.isEdited && (
            <span className="ml-2 text-amber-600">（編集済み）</span>
          )}
        </span>
        <div className="flex items-center gap-1">
          {comment && !isEditing && (
            <>
              <button
                onClick={startEdit}
                className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                title="編集"
              >
                <Pencil size={14} />
              </button>
              {comment.isEdited && (
                <button
                  onClick={() => onReset(comment.id)}
                  className="p-1 text-slate-400 hover:text-amber-600 transition-colors"
                  title="原文に戻す"
                >
                  <RotateCcw size={14} />
                </button>
              )}
            </>
          )}
          {onRegenerate && (
            <button
              onClick={onRegenerate}
              disabled={isGenerating}
              className="p-1 text-slate-400 hover:text-green-600 transition-colors disabled:opacity-50"
              title="再生成"
            >
              <RefreshCw size={14} className={isGenerating ? 'animate-spin' : ''} />
            </button>
          )}
        </div>
      </div>
      <div className="p-3">
        {isGenerating && !comment ? (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <RefreshCw size={14} className="animate-spin" />
            AIコメントを生成中...
          </div>
        ) : isEditing ? (
          <div>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full min-h-[120px] p-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 resize-y"
            />
            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={cancelEdit}
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-slate-600 border border-slate-300 rounded-md hover:bg-slate-100"
              >
                <X size={12} /> キャンセル
              </button>
              <button
                onClick={saveEdit}
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                <Check size={12} /> 保存
              </button>
            </div>
          </div>
        ) : comment ? (
          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
            {comment.editedText}
          </p>
        ) : (
          <p className="text-sm text-slate-400 italic">
            コメントなし（APIキーを設定すると自動生成できます）
          </p>
        )}
        {comment?.editedAt && (
          <p className="mt-2 text-xs text-slate-400">
            最終編集: {new Date(comment.editedAt).toLocaleDateString('ja-JP')}
          </p>
        )}
      </div>
    </div>
  );
}
