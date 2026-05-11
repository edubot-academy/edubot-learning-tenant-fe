import { useEffect, useMemo } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { useAuth } from '../features/auth/AuthProvider';
import { useTenant } from '../features/tenant/TenantProvider';
import { LoginPage } from '../features/auth/LoginPage';
import { OverviewPage } from '../features/dashboard/OverviewPage';
import { CoursesPage } from '../features/courses/CoursesPage';
import { SessionsPage } from '../features/sessions/SessionsPage';
import { AttendancePage } from '../features/attendance/AttendancePage';
import { HomeworkPage } from '../features/homework/HomeworkPage';
import { CertificatesPage } from '../features/certificates/CertificatesPage';
import { MembersPage } from '../features/members/MembersPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { StudentDashboardPage } from '../features/student/StudentDashboardPage';
import { EmptyState, LoadingState } from '../components/DataState';
import { isTenantFeatureEnabled, type TenantFeatureKey } from '../features/tenant/tenantFeatures';
import { canManageTenantCertificates, canManageTenantMembers, canOperateTenantLearning, isPlatformAdmin, isTenantStudent } from '../features/tenant/tenantRoles';

const routeTitles: Record<string, string> = {
  '/': 'Overview',
  '/student': 'My learning',
  '/courses': 'Courses',
  '/sessions': 'Sessions',
  '/attendance': 'Attendance',
  '/homework': 'Homework',
  '/certificates': 'Certificates',
  '/members': 'Members',
  '/settings': 'Settings',
};

const defaultFaviconHref = '/edubot-icon.svg';

function getManagedFaviconLink() {
  const existingManaged = document.querySelector<HTMLLinkElement>('link[data-managed-favicon="true"]');
  if (existingManaged) return existingManaged;

  const existingIcon = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
  const link = existingIcon ?? document.createElement('link');
  link.rel = 'icon';
  link.dataset.managedFavicon = 'true';
  if (!existingIcon) document.head.appendChild(link);
  return link;
}

function DocumentMetadata() {
  const { pathname } = useLocation();
  const { activeTenant } = useTenant();
  const faviconHref = activeTenant?.logoUrl || defaultFaviconHref;

  const title = useMemo(() => {
    if (pathname === '/login') return activeTenant?.name ? `Sign in | ${activeTenant.name}` : 'Sign in | Learning Workspace';

    const sectionTitle = routeTitles[pathname] ?? 'Tenant Workspace';
    const tenantName = activeTenant?.name ?? 'Tenant Workspace';
    return `${sectionTitle} | ${tenantName}`;
  }, [activeTenant?.name, pathname]);

  useEffect(() => {
    document.title = title;
  }, [title]);

  useEffect(() => {
    const link = getManagedFaviconLink();
    link.href = faviconHref;
    if (faviconHref.endsWith('.svg')) {
      link.type = 'image/svg+xml';
    } else {
      link.removeAttribute('type');
    }
  }, [faviconHref]);

  return null;
}

function HomeRoute() {
  const { user } = useAuth();
  const { activeTenant } = useTenant();
  return isTenantStudent(user, activeTenant) ? <Navigate to="/student" replace /> : <OverviewPage />;
}

function StaffRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { activeTenant } = useTenant();
  return canOperateTenantLearning(user, activeTenant) ? children : <Navigate to="/student" replace />;
}

function StudentRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { activeTenant } = useTenant();
  return isTenantStudent(user, activeTenant) ? children : <Navigate to="/" replace />;
}

function TenantAdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { activeTenant } = useTenant();
  return canManageTenantMembers(user, activeTenant) ? children : <Navigate to="/" replace />;
}

function CertificateRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { activeTenant } = useTenant();
  return canManageTenantCertificates(user, activeTenant) ? children : <Navigate to="/" replace />;
}

function FeatureRoute({ feature, children }: { feature: TenantFeatureKey; children: React.ReactNode }) {
  const { activeTenant } = useTenant();

  if (!isTenantFeatureEnabled(activeTenant, feature)) {
    return (
      <EmptyState
        title="Feature disabled"
        detail="This tenant feature is currently disabled by the platform admin."
      />
    );
  }

  return children;
}

function ProtectedRoutes() {
  const { user, loading, signOut } = useAuth();
  const {
    tenants,
    activeTenant,
    error: tenantError,
    loading: tenantLoading,
    resolvingTenant,
    resolutionError,
    reloadTenants,
  } = useTenant();

  if (loading || tenantLoading || resolvingTenant) return <LoadingState label="Preparing workspace" />;
  if (!user) return <Navigate to="/login" replace />;
  if (isPlatformAdmin(user)) {
    return (
      <main className="login-page">
        <section className="login-panel state-panel">
          <strong>Use platform admin</strong>
          <span>Super admin accounts cannot access tenant workspaces.</span>
          <div className="page-actions">
            <button type="button" className="secondary-button" onClick={signOut}>Sign out</button>
          </div>
        </section>
      </main>
    );
  }
  if (resolutionError) {
    return (
      <main className="login-page">
        <section className="login-panel state-panel">
          <strong>Tenant domain unavailable</strong>
          <span>{resolutionError}</span>
          <div className="page-actions">
            <button type="button" className="secondary-button" onClick={signOut}>Sign out</button>
          </div>
        </section>
      </main>
    );
  }
  if (tenantError) {
    return (
      <main className="login-page">
        <section className="login-panel state-panel">
          <strong>Could not load tenant access</strong>
          <span>{tenantError}</span>
          <div className="page-actions">
            <button type="button" onClick={() => void reloadTenants().catch(() => undefined)}>Retry</button>
            <button type="button" className="secondary-button" onClick={signOut}>Sign out</button>
          </div>
        </section>
      </main>
    );
  }
  if (!activeTenant) {
    return (
      <main className="login-page">
        <section className="login-panel state-panel">
          <strong>No tenant access</strong>
          <span>Your account is valid, but it is not assigned to a learning tenant yet.</span>
          <div className="page-actions">
            <button type="button" onClick={() => void reloadTenants().catch(() => undefined)}>Refresh</button>
            <button type="button" className="secondary-button" onClick={signOut}>Sign out</button>
          </div>
          {tenants.length ? <span>{tenants.length} tenants loaded, but none is active.</span> : null}
        </section>
      </main>
    );
  }

  return <AppLayout />;
}

export function App() {
  return (
    <>
      <DocumentMetadata />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoutes />}>
          <Route index element={<HomeRoute />} />
          <Route path="/student" element={<StudentRoute><StudentDashboardPage /></StudentRoute>} />
          <Route path="/courses" element={<StaffRoute><CoursesPage /></StaffRoute>} />
          <Route path="/sessions" element={<StaffRoute><SessionsPage /></StaffRoute>} />
          <Route path="/attendance" element={<StaffRoute><FeatureRoute feature="attendance.enabled"><AttendancePage /></FeatureRoute></StaffRoute>} />
          <Route path="/homework" element={<StaffRoute><FeatureRoute feature="homework.enabled"><HomeworkPage /></FeatureRoute></StaffRoute>} />
          <Route path="/certificates" element={<CertificateRoute><FeatureRoute feature="certificates.enabled"><CertificatesPage /></FeatureRoute></CertificateRoute>} />
          <Route path="/members" element={<TenantAdminRoute><MembersPage /></TenantAdminRoute>} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
