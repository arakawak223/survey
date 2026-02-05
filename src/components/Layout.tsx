import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Upload,
  Tags,
  BarChart3,
  LineChart,
  FileDown,
  Settings,
  Building2,
} from 'lucide-react';

interface NavItem {
  to: string;
  icon: React.ComponentType<{ size?: number }>;
  label: string;
}
interface NavSeparator {
  separator: true;
  label: string;
}
type NavEntry = NavItem | NavSeparator;

const navEntries: NavEntry[] = [
  { to: '/', icon: LayoutDashboard, label: 'ダッシュボード' },
  { to: '/upload', icon: Upload, label: 'データ取り込み' },
  { to: '/categories', icon: Tags, label: '分類設定' },
  { to: '/analysis', icon: BarChart3, label: '分析結果' },
  { to: '/charts', icon: LineChart, label: 'チャート' },
  { to: '/report', icon: FileDown, label: 'レポート出力' },
  { separator: true, label: '部署別分析' },
  { to: '/dept/upload', icon: Upload, label: '部署データ取込' },
  { to: '/dept/analysis', icon: Building2, label: '部署別分析結果' },
  { to: '/dept/charts', icon: LineChart, label: '部署別チャート' },
  { separator: true, label: '' },
  { to: '/settings', icon: Settings, label: '設定' },
];

export default function Layout() {
  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-200">
          <h1 className="text-lg font-bold text-slate-800">アンケート分析</h1>
          <p className="text-xs text-slate-500 mt-0.5">Survey Analyzer</p>
        </div>
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {navEntries.map((entry, i) => {
            if ('separator' in entry) {
              return entry.label ? (
                <div key={`sep-${i}`} className="pt-4 pb-1 px-3">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{entry.label}</p>
                </div>
              ) : (
                <div key={`sep-${i}`} className="pt-1" />
              );
            }
            return (
              <NavLink
                key={entry.to}
                to={entry.to}
                end={entry.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`
                }
              >
                <entry.icon size={18} />
                {entry.label}
              </NavLink>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
