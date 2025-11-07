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
import TransactionHistoryPage from '@/pages/TransactionHistoryPage';
import PremiumPage from '@/pages/PremiumPage';
import SettingsPage from '@/pages/SettingsPage';
import MobileAppPage from '@/pages/MobileAppPage';
import AnalyticsPage from '@/pages/AnalyticsPage';
import ApiDocsPage from '@/pages/ApiDocsPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
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

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  );
}

export default App;