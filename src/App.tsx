import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from '@/components/Layout';
import DashboardPage from '@/pages/DashboardPage';
import UploadPage from '@/pages/UploadPage';
import CategoriesPage from '@/pages/CategoriesPage';
import AnalysisPage from '@/pages/AnalysisPage';
import ChartsPage from '@/pages/ChartsPage';
import ReportPage from '@/pages/ReportPage';
import SettingsPage from '@/pages/SettingsPage';
import DeptUploadPage from '@/pages/DeptUploadPage';
import DeptAnalysisPage from '@/pages/DeptAnalysisPage';
import DeptChartsPage from '@/pages/DeptChartsPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/analysis" element={<AnalysisPage />} />
          <Route path="/charts" element={<ChartsPage />} />
          <Route path="/report" element={<ReportPage />} />
          <Route path="/dept/upload" element={<DeptUploadPage />} />
          <Route path="/dept/analysis" element={<DeptAnalysisPage />} />
          <Route path="/dept/charts" element={<DeptChartsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
