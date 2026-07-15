import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
// Landing page is public/marketing-only and pulls in heavy deps (framer-motion).
// Lazy-load it so those bytes never ship in the authenticated app bundle.
const LandingPage = lazy(() =>
  import('./pages/LandingPage').then((m) => ({ default: m.LandingPage })),
);
import { HomePage } from './pages/HomePage';
import { OrganizationPage } from './pages/OrganizationPage';
import { UsersPage } from './pages/UsersPage';
import { TeamsPage } from './pages/TeamsPage';
import { PlatformPage } from './pages/PlatformPage';
import { ConnectionPage } from './pages/ConnectionPage';
import { AuditPage } from './pages/AuditPage';
import { ManagerHomePage } from './pages/ManagerHomePage';
import { PipelinePage } from './pages/PipelinePage';
import { LeadsPage } from './pages/LeadsPage';
import { ReportsPage } from './pages/ReportsPage';
import { CalendarPage } from './pages/CalendarPage';
import { ExposPage } from './pages/ExposPage';
import { BulkImportPage } from './pages/BulkImportPage';
import { LeadGeneratorPage } from './pages/LeadGeneratorPage';
import { CampaignDetailPage } from './pages/CampaignDetailPage';
import { CrmSettingsPage } from './pages/CrmSettingsPage';
import { IntegrationsPage } from './pages/IntegrationsPage';
import { TargetsPage } from './pages/TargetsPage';
import { DataHygienePage } from './pages/DataHygienePage';
import { BrandingPage } from './pages/BrandingPage';
import { BusinessPage } from './pages/BusinessPage';
import LeadEngineSettingsPage from './pages/LeadEngineSettingsPage';
import { ContactFinderPage } from './pages/ContactFinderPage';
import { ProductDocumentsPage } from './pages/ProductDocumentsPage';
import { PhotoCapturePage } from './pages/PhotoCapturePage';
import { RosterPage } from './pages/RosterPage';
import { VsmConfigPage } from './pages/VsmConfigPage';
import { InboundEmailsPage } from './pages/InboundEmailsPage';
import { VsmRunsPage } from './pages/VsmRunsPage';
import { EscalationsPage } from './pages/EscalationsPage';
import { VsmPerformancePage } from './pages/VsmPerformancePage';
import type { FeatureKey } from '@wizcrm/shared';
import { RolePermissionsPage } from './pages/RolePermissionsPage';
import { isAdmin, isManager } from './lib/roles';
import { useAuth } from './lib/auth';

function AdminOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!isAdmin(user?.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function ManagerOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!isManager(user?.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/** Manager-only page whose visibility an org admin can additionally toggle off per role. */
function FeatureGated({ feature, children }: { feature: FeatureKey; children: React.ReactNode }) {
  const { user, can } = useAuth();
  if (!isManager(user?.role)) return <Navigate to="/" replace />;
  if (!can(feature)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/landing"
            element={
              <Suspense fallback={<div style={{ minHeight: '100vh', background: '#ffffff' }} />}>
                <LandingPage />
              </Suspense>
            }
          />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<HomePage />} />
            <Route
              path="/manager"
              element={
                <ManagerOnly>
                  <ManagerHomePage />
                </ManagerOnly>
              }
            />
            <Route
              path="/pipeline"
              element={
                <ManagerOnly>
                  <PipelinePage />
                </ManagerOnly>
              }
            />
            <Route
              path="/leads"
              element={
                <ManagerOnly>
                  <LeadsPage />
                </ManagerOnly>
              }
            />
            <Route
              path="/reports"
              element={
                <FeatureGated feature="reports">
                  <ReportsPage />
                </FeatureGated>
              }
            />
            <Route
              path="/targets"
              element={
                <FeatureGated feature="targets">
                  <TargetsPage />
                </FeatureGated>
              }
            />
            <Route
              path="/data-hygiene"
              element={
                <FeatureGated feature="dataHygiene">
                  <DataHygienePage />
                </FeatureGated>
              }
            />
            <Route
              path="/settings/branding"
              element={
                <AdminOnly>
                  <BrandingPage />
                </AdminOnly>
              }
            />
            <Route
              path="/settings/lead-engine"
              element={
                <AdminOnly>
                  <LeadEngineSettingsPage />
                </AdminOnly>
              }
            />
            <Route
              path="/settings/vsm-roster"
              element={
                <AdminOnly>
                  <RosterPage />
                </AdminOnly>
              }
            />
            <Route
              path="/settings/vsm"
              element={
                <AdminOnly>
                  <VsmConfigPage />
                </AdminOnly>
              }
            />
            <Route
              path="/settings/inbound-emails"
              element={
                <AdminOnly>
                  <InboundEmailsPage />
                </AdminOnly>
              }
            />
            <Route
              path="/settings/vsm-runs"
              element={
                <AdminOnly>
                  <VsmRunsPage />
                </AdminOnly>
              }
            />
            <Route
              path="/settings/escalations"
              element={
                <AdminOnly>
                  <EscalationsPage />
                </AdminOnly>
              }
            />
            <Route
              path="/settings/vsm-performance"
              element={
                <AdminOnly>
                  <VsmPerformancePage />
                </AdminOnly>
              }
            />
            <Route
              path="/business"
              element={
                <ManagerOnly>
                  <BusinessPage />
                </ManagerOnly>
              }
            />
            <Route
              path="/calendar"
              element={
                <ManagerOnly>
                  <CalendarPage />
                </ManagerOnly>
              }
            />
            <Route path="/capture" element={<PhotoCapturePage />} />
            <Route
              path="/expos"
              element={
                <FeatureGated feature="expoFinder">
                  <ExposPage />
                </FeatureGated>
              }
            />
            <Route
              path="/leads/import"
              element={
                <FeatureGated feature="bulkImport">
                  <BulkImportPage />
                </FeatureGated>
              }
            />
            <Route
              path="/lead-generator"
              element={
                <FeatureGated feature="leadGenerator">
                  <LeadGeneratorPage />
                </FeatureGated>
              }
            />
            <Route
              path="/contact-finder"
              element={
                <FeatureGated feature="contactFinder">
                  <ContactFinderPage />
                </FeatureGated>
              }
            />
            <Route
              path="/documents"
              element={
                <ManagerOnly>
                  <ProductDocumentsPage />
                </ManagerOnly>
              }
            />
            <Route
              path="/lead-generator/:campaignId"
              element={
                <FeatureGated feature="leadGenerator">
                  <CampaignDetailPage />
                </FeatureGated>
              }
            />
            <Route
              path="/settings/crm"
              element={
                <ManagerOnly>
                  <CrmSettingsPage />
                </ManagerOnly>
              }
            />
            <Route
              path="/organization"
              element={
                <AdminOnly>
                  <OrganizationPage />
                </AdminOnly>
              }
            />
            <Route
              path="/users"
              element={
                <AdminOnly>
                  <UsersPage />
                </AdminOnly>
              }
            />
            <Route
              path="/settings/permissions"
              element={
                <AdminOnly>
                  <RolePermissionsPage />
                </AdminOnly>
              }
            />
            <Route
              path="/teams"
              element={
                <ManagerOnly>
                  <TeamsPage />
                </ManagerOnly>
              }
            />
            <Route
              path="/platform"
              element={
                <AdminOnly>
                  <PlatformPage />
                </AdminOnly>
              }
            />
            <Route
              path="/connection"
              element={
                <AdminOnly>
                  <ConnectionPage />
                </AdminOnly>
              }
            />
            <Route
              path="/audit"
              element={
                <AdminOnly>
                  <AuditPage />
                </AdminOnly>
              }
            />
            <Route
              path="/integrations"
              element={
                <AdminOnly>
                  <IntegrationsPage />
                </AdminOnly>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/landing" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
