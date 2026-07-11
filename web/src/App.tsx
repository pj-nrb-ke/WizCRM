import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
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
import { RosterPage } from './pages/RosterPage';
import { VsmConfigPage } from './pages/VsmConfigPage';
import { InboundEmailsPage } from './pages/InboundEmailsPage';
import { VsmRunsPage } from './pages/VsmRunsPage';
import { EscalationsPage } from './pages/EscalationsPage';
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
                <ManagerOnly>
                  <ReportsPage />
                </ManagerOnly>
              }
            />
            <Route
              path="/targets"
              element={
                <ManagerOnly>
                  <TargetsPage />
                </ManagerOnly>
              }
            />
            <Route
              path="/data-hygiene"
              element={
                <ManagerOnly>
                  <DataHygienePage />
                </ManagerOnly>
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
            <Route
              path="/expos"
              element={
                <ManagerOnly>
                  <ExposPage />
                </ManagerOnly>
              }
            />
            <Route
              path="/leads/import"
              element={
                <ManagerOnly>
                  <BulkImportPage />
                </ManagerOnly>
              }
            />
            <Route
              path="/lead-generator"
              element={
                <ManagerOnly>
                  <LeadGeneratorPage />
                </ManagerOnly>
              }
            />
            <Route
              path="/contact-finder"
              element={
                <ManagerOnly>
                  <ContactFinderPage />
                </ManagerOnly>
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
                <ManagerOnly>
                  <CampaignDetailPage />
                </ManagerOnly>
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
                <ManagerOnly>
                  <OrganizationPage />
                </ManagerOnly>
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
