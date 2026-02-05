import { useState } from 'react';
import { Settings, Eye, EyeOff, Save } from 'lucide-react';
import { useSurveyStore } from '@/store/surveyStore';

export default function SettingsPage() {
  const { settings, updateSettings } = useSurveyStore();
  const [showKey, setShowKey] = useState(false);
  const [localApiKey, setLocalApiKey] = useState(settings.apiKey);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    updateSettings({ apiKey: localApiKey });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-800 mb-6">設定</h2>

      {/* API Key */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
        <h3 className="font-medium text-slate-700 mb-4 flex items-center gap-2">
          <Settings size={18} /> AI連携設定
        </h3>
        <p className="text-sm text-slate-500 mb-4">
          AIコメント自動生成を利用するには、Anthropic APIキーを設定してください。
          キーはブラウザ内にのみ保存され、外部サーバーには送信されません。
        </p>
        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1">
            <input
              type={showKey ? 'text' : 'password'}
              value={localApiKey}
              onChange={(e) => setLocalApiKey(e.target.value)}
              placeholder="sk-ant-..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 pr-10"
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
          >
            <Save size={14} /> 保存
          </button>
        </div>
        {saved && (
          <p className="text-sm text-green-600">保存しました</p>
        )}
        <p className="text-xs text-slate-400">
          ※ AIへは統計サマリー（平均値・割合等）のみ送信されます。個別の回答データは送信されません。
        </p>
      </div>

      {/* Analysis thresholds */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
        <h3 className="font-medium text-slate-700 mb-4">分析閾値設定</h3>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm text-slate-600 mb-1">課題抽出の閾値（この値以下を課題とする）</label>
            <input
              type="number"
              step="0.1"
              min="1"
              max="5"
              value={settings.issueThreshold}
              onChange={(e) => updateSettings({ issueThreshold: Number(e.target.value) })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">優良抽出の閾値（この値以上を優良とする）</label>
            <input
              type="number"
              step="0.1"
              min="1"
              max="5"
              value={settings.excellentThreshold}
              onChange={(e) => updateSettings({ excellentThreshold: Number(e.target.value) })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        </div>
      </div>

      {/* Scale settings */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-medium text-slate-700 mb-4">尺度設定</h3>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm text-slate-600 mb-1">最小値</label>
            <input
              type="number"
              value={settings.scaleMin}
              onChange={(e) => updateSettings({ scaleMin: Number(e.target.value) })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">最大値</label>
            <input
              type="number"
              value={settings.scaleMax}
              onChange={(e) => updateSettings({ scaleMax: Number(e.target.value) })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
