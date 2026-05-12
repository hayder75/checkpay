import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { ProtectedRoute } from '@/components/ProtectedRoute';

// Pages
import LandingPage from '@/pages/LandingPage';
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';
import GoogleCallbackPage from '@/pages/auth/GoogleCallbackPage';
import RoleSelectionPage from '@/pages/auth/RoleSelectionPage';
import DashboardPage from '@/pages/DashboardPage';
import PatternBuilderPage from '@/pages/patterns/PatternBuilderPage';
import PatternLibraryPage from '@/pages/patterns/PatternLibraryPage';
import PatternEditPage from '@/pages/patterns/PatternEditPage';
import PatternMarketplacePage from '@/pages/patterns/PatternMarketplacePage';
import TransactionHistoryPage from '@/pages/TransactionHistoryPage';
import PendingOrdersPage from '@/pages/PendingOrdersPage';
import AnalyticsPage from '@/pages/AnalyticsPage';
import SettingsPage from '@/pages/SettingsPage';
import AdminDashboardPage from '@/pages/admin/AdminDashboardPage';
import UserManagementPage from '@/pages/admin/UserManagementPage';
import AdminAnalyticsPage from '@/pages/admin/AnalyticsPage';
import PatternManagementPage from '@/pages/admin/PatternManagementPage';
import TransactionMonitoringPage from '@/pages/admin/TransactionMonitoringPage';
import CountryManagementPage from '@/pages/admin/CountryManagementPage';
import CountryTemplatesPage from '@/pages/admin/CountryTemplatesPage';
import TemplateManagementPage from '@/pages/admin/TemplateManagementPage';
import MissingTemplatesPage from '@/pages/admin/MissingTemplatesPage';
import AuditLogsPage from '@/pages/admin/AuditLogsPage';
import SystemHealthPage from '@/pages/admin/SystemHealthPage';
import PackagePurchaseVerificationPage from '@/pages/admin/PackagePurchaseVerificationPage';
import AdminPackageManagementPage from '@/pages/admin/AdminPackageManagementPage';
import VerifyPage from '@/pages/merchant/VerifyPage';
import BusinessManagementPage from '@/pages/businesses/BusinessManagementPage';
import EmployeeManagementPage from '@/pages/employees/EmployeeManagementPage';
import ProjectManagementPage from '@/pages/projects/ProjectManagementPage';
import ProjectDetailsPage from '@/pages/projects/ProjectDetailsPage';
import UsagePage from '@/pages/packages/PackageManagementPage';
import AccessCodeManagementPage from '@/pages/accessCodes/AccessCodeManagementPage';
import EmployeeRegisterPage from '@/pages/employees/EmployeeRegisterPage';
import EmployeeTransactionEntryPage from '@/pages/employees/EmployeeTransactionEntryPage';
import AcceptTransferPage from '@/pages/projects/AcceptTransferPage';
import ApiDocsPage from '@/pages/ApiDocsPage';
import ProductsPage from '@/pages/ProductsPage';
import PricingPage from '@/pages/PricingPage';
import MobileAppPage from '@/pages/MobileAppPage';
import PrivacyPolicyPage from '@/pages/PrivacyPolicyPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/api-docs" element={<ApiDocsPage />} />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/register" element={<RegisterPage />} />
        <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />
        <Route path="/auth/select-role" element={<RoleSelectionPage />} />
        <Route path="/auth/employee/register" element={<EmployeeRegisterPage />} />
        <Route path="/projects/accept-transfer" element={<AcceptTransferPage />} />

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
          path="/dashboard/pending-orders"
          element={
            <ProtectedRoute>
              <PendingOrdersPage />
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
          path="/dashboard/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/businesses"
          element={
            <ProtectedRoute>
              <BusinessManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/employees"
          element={
            <ProtectedRoute>
              <EmployeeManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/projects"
          element={
            <ProtectedRoute>
              <ProjectManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/projects/:id"
          element={
            <ProtectedRoute>
              <ProjectDetailsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/mobile"
          element={
            <ProtectedRoute>
              <MobileAppPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/usage"
          element={
            <ProtectedRoute>
              <UsagePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/packages"
          element={
            <ProtectedRoute>
              <UsagePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/access-codes"
          element={
            <ProtectedRoute>
              <AccessCodeManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/employees/record"
          element={
            <ProtectedRoute>
              <EmployeeTransactionEntryPage />
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
              <CountryTemplatesPage />
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
        <Route
          path="/admin/packages"
          element={
            <ProtectedRoute>
              <AdminPackageManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/package-purchases"
          element={
            <ProtectedRoute>
              <PackagePurchaseVerificationPage />
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