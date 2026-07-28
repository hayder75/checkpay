import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { ProtectedRoute } from '@/components/ProtectedRoute';

// Pages
import LandingPage from '@/pages/LandingPage';
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';
import VerifyOTPPage from '@/pages/auth/VerifyOTPPage';
import DashboardPage from '@/pages/DashboardPage';
import PatternBuilderPage from '@/pages/patterns/PatternBuilderPage';
import PatternLibraryPage from '@/pages/patterns/PatternLibraryPage';
import PatternEditPage from '@/pages/patterns/PatternEditPage';
import PatternMarketplacePage from '@/pages/patterns/PatternMarketplacePage';
import TransactionHistoryPage from '@/pages/TransactionHistoryPage';
import PremiumPage from '@/pages/PremiumPage';
import SettingsPage from '@/pages/SettingsPage';
import MobileAppPage from '@/pages/MobileAppPage';
import AnalyticsPage from '@/pages/AnalyticsPage';
import ApiDocsPage from '@/pages/ApiDocsPage';
import AdminDashboardPage from '@/pages/admin/AdminDashboardPage';
import UserManagementPage from '@/pages/admin/UserManagementPage';
import AdminAnalyticsPage from '@/pages/admin/AnalyticsPage';
import PatternManagementPage from '@/pages/admin/PatternManagementPage';
import TransactionMonitoringPage from '@/pages/admin/TransactionMonitoringPage';
import CountryManagementPage from '@/pages/admin/CountryManagementPage';
import TemplateManagementPage from '@/pages/admin/TemplateManagementPage';
import MissingTemplatesPage from '@/pages/admin/MissingTemplatesPage';
import AuditLogsPage from '@/pages/admin/AuditLogsPage';
import SystemHealthPage from '@/pages/admin/SystemHealthPage';
import VerifyPage from '@/pages/merchant/VerifyPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/api-docs" element={<ApiDocsPage />} />
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/register" element={<RegisterPage />} />
        <Route path="/auth/verify-otp" element={<VerifyOTPPage />} />

        {/* Protected routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/patterns/new"
          element={
            <ProtectedRoute>
              <PatternBuilderPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/patterns"
          element={
            <ProtectedRoute>
              <PatternLibraryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/patterns/:id/edit"
          element={
            <ProtectedRoute>
              <PatternEditPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/patterns/marketplace"
          element={
            <ProtectedRoute>
              <PatternMarketplacePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/transactions"
          element={
            <ProtectedRoute>
              <TransactionHistoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/premium"
          element={
            <ProtectedRoute>
              <PremiumPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/mobile-app"
          element={
            <ProtectedRoute>
              <MobileAppPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/analytics"
          element={
            <ProtectedRoute>
              <AnalyticsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/api-docs"
          element={
            <ProtectedRoute>
              <ApiDocsPage />
            </ProtectedRoute>
          }
        />

        {/* Admin routes */}
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute>
              <AdminDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute>
              <UserManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/analytics"
          element={
            <ProtectedRoute>
              <AdminAnalyticsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/patterns"
          element={
            <ProtectedRoute>
              <PatternManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/transactions"
          element={
            <ProtectedRoute>
              <TransactionMonitoringPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/countries"
          element={
            <ProtectedRoute>
              <CountryManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/countries/:countryCode/templates"
          element={
            <ProtectedRoute>
              <TemplateManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/missing-templates"
          element={
            <ProtectedRoute>
              <MissingTemplatesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/audit-logs"
          element={
            <ProtectedRoute>
              <AuditLogsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/system-health"
          element={
            <ProtectedRoute>
              <SystemHealthPage />
            </ProtectedRoute>
          }
        />

        {/* Merchant verification portal (public, no auth required) */}
        <Route path="/verify/:merchantId" element={<VerifyPage />} />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  );
}

export default App;