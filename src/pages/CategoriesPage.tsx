import { useState } from 'react';
import { Tags, Plus, X } from 'lucide-react';
import { useSurveyStore } from '@/store/surveyStore';
import type { Category } from '@/types';
import { v4 as uuidv4 } from 'uuid';

export default function CategoriesPage() {
  const { categories, questions, setCategories, updateQuestionCategory } = useSurveyStore();
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#6366f1');

  const addCategory = () => {
    if (!newCatName.trim()) return;
    const newCat: Category = {
      id: uuidv4(),
      name: newCatName.trim(),
      color: newCatColor,
      order: categories.length + 1,
    };
    setCategories([...categories, newCat]);
    setNewCatName('');
  };

  const removeCategory = (id: string) => {
    if (id.startsWith('cat-')) return; // デフォルトカテゴリは削除不可
    setCategories(categories.filter((c) => c.id !== id));
  };

  const getCategoryName = (id: string) =>
    categories.find((c) => c.id === id)?.name || '未分類';

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-800 mb-6">分類設定</h2>

      {/* Category list */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
        <h3 className="font-medium text-slate-700 mb-4 flex items-center gap-2">
          <Tags size={18} /> カテゴリ一覧
        </h3>
        <div className="flex flex-wrap gap-2 mb-4">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 text-sm"
            >
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: cat.color }}
              />
              {cat.name}
              {!cat.id.startsWith('cat-') && (
                <button
                  onClick={() => removeCategory(cat.id)}
                  className="text-slate-400 hover:text-red-500"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={newCatColor}
            onChange={(e) => setNewCatColor(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer"
          />
          <input
            type="text"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            placeholder="新しいカテゴリ名"
            className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            onKeyDown={(e) => e.key === 'Enter' && addCategory()}
          />
          <button
            onClick={addCategory}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus size={14} /> 追加
          </button>
        </div>
      </div>

      {/* Question-Category mapping */}
      {questions.length > 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-medium text-slate-700 mb-4">設問とカテゴリの紐付け</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-3 py-2 text-left font-medium text-slate-600">設問キー</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">表示名</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-600">カテゴリ</th>
                </tr>
              </thead>
              <tbody>
                {questions.map((q) => (
                  <tr key={q.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-slate-500 font-mono text-xs">{q.key}</td>
                    <td className="px-3 py-2 text-slate-700">{q.label}</td>
                    <td className="px-3 py-2">
                      <select
                        value={q.categoryId}
                        onChange={(e) => updateQuestionCategory(q.id, e.target.value)}
                        className="px-2 py-1 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
                      >
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-slate-400">
          <Tags size={40} className="mx-auto mb-3 opacity-50" />
          <p>データを取り込むと設問の分類設定ができます</p>
        </div>
      )}
    </div>
  );
}
