import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
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
import { BulkImportPage } from './pages/BulkImportPage';
import { CrmSettingsPage } from './pages/CrmSettingsPage';
import { IntegrationsPage } from './pages/IntegrationsPage';
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
              path="/calendar"
              element={
                <ManagerOnly>
                  <CalendarPage />
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
