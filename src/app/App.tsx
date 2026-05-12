import { Component, lazy, Suspense, useEffect, useMemo, type ComponentType, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { useAuth } from '../features/auth/AuthProvider';
import { useTenant } from '../features/tenant/TenantProvider';
import { EmptyState, LoadingState } from '../components/DataState';
import { isTenantFeatureEnabled, type TenantFeatureKey } from '../features/tenant/tenantFeatures';
import { canManageTenantCertificates, canManageTenantMembers, canOperateTenantLearning, getTenantAccessLevel, isPlatformAdmin, isTenantStudent } from '../features/tenant/tenantRoles';

function lazyNamed<T extends ComponentType<object>>(loader: () => Promise<Record<string, T>>, exportName: string) {
  return lazy(async () => {
    const module = await loader();
    return { default: module[exportName] };
  });
}

const LoginPage = lazyNamed(() => import('../features/auth/LoginPage'), 'LoginPage');
const PasswordResetPage = lazyNamed(() => import('../features/auth/PasswordResetPage'), 'PasswordResetPage');
const SetupAccountPage = lazyNamed(() => import('../features/auth/SetupAccountPage'), 'SetupAccountPage');
const OverviewPage = lazyNamed(() => import('../features/dashboard/OverviewPage'), 'OverviewPage');
const CoursesPage = lazyNamed(() => import('../features/courses/CoursesPage'), 'CoursesPage');
const GroupsPage = lazyNamed(() => import('../features/groups/GroupsPage'), 'GroupsPage');
const SessionsPage = lazyNamed(() => import('../features/sessions/SessionsPage'), 'SessionsPage');
const AttendancePage = lazyNamed(() => import('../features/attendance/AttendancePage'), 'AttendancePage');
const HomeworkPage = lazyNamed(() => import('../features/homework/HomeworkPage'), 'HomeworkPage');
const CertificatesPage = lazyNamed(() => import('../features/certificates/CertificatesPage'), 'CertificatesPage');
const MembersPage = lazyNamed(() => import('../features/members/MembersPage'), 'MembersPage');
const SettingsPage = lazyNamed(() => import('../features/settings/SettingsPage'), 'SettingsPage');
const StudentDashboardPage = lazyNamed(() => import('../features/student/StudentDashboardPage'), 'StudentDashboardPage');

const routeTitles: Record<string, string> = {
  '/': 'Overview',
  '/forgot-password': 'Password reset',
  '/setup-account': 'Account setup',
  '/student': 'My learning',
  '/courses': 'Courses',
  '/groups': 'Groups',
  '/sessions': 'Sessions',
  '/attendance': 'Attendance',
  '/homework': 'Homework',
  '/certificates': 'Certificates',
  '/members': 'Members',
  '/settings': 'Settings',
};

const defaultFaviconHref = '/edubot-icon.svg';

type RouteErrorBoundaryState = {
  hasError: boolean;
};

class RouteErrorBoundary extends Component<{ children: ReactNode }, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="login-page">
          <section className="login-panel state-panel" role="alert">
            <strong>Workspace view failed</strong>
            <span>Refresh this view or return to another workspace section.</span>
            <div className="page-actions">
              <button type="button" onClick={() => this.setState({ hasError: false })}>Try again</button>
              <button type="button" className="secondary-button" onClick={() => window.location.assign('/')}>Go to overview</button>
            </div>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

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
    if (pathname === '/forgot-password') {
      return activeTenant?.name ? `Password reset | ${activeTenant.name}` : 'Password reset | Learning Workspace';
    }
    if (pathname === '/setup-account') {
      return activeTenant?.name ? `Account setup | ${activeTenant.name}` : 'Account setup | Learning Workspace';
    }

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
            <button type="button" className="secondary-button" onClick={() => void signOut()}>Sign out</button>
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
            <button type="button" className="secondary-button" onClick={() => void signOut()}>Sign out</button>
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
            <button type="button" className="secondary-button" onClick={() => void signOut()}>Sign out</button>
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
            <button type="button" className="secondary-button" onClick={() => void signOut()}>Sign out</button>
          </div>
          {tenants.length ? <span>{tenants.length} tenants loaded, but none is active.</span> : null}
        </section>
      </main>
    );
  }
  if (getTenantAccessLevel(user, activeTenant) === 'none') {
    return (
      <main className="login-page">
        <section className="login-panel state-panel">
          <strong>No workspace role</strong>
          <span>Your account is assigned to this tenant, but it does not have a tenant workspace role yet.</span>
          <div className="page-actions">
            <button type="button" onClick={() => void reloadTenants().catch(() => undefined)}>Refresh</button>
            <button type="button" className="secondary-button" onClick={() => void signOut()}>Sign out</button>
          </div>
        </section>
      </main>
    );
  }

  return <AppLayout />;
}

function AppRoutes() {
  const location = useLocation();

  return (
    <RouteErrorBoundary key={location.pathname}>
      <Suspense fallback={<LoadingState label="Loading workspace view" />}>
        <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<PasswordResetPage />} />
        <Route path="/setup-account" element={<SetupAccountPage />} />
        <Route element={<ProtectedRoutes />}>
          <Route index element={<HomeRoute />} />
          <Route path="/student" element={<StudentRoute><StudentDashboardPage /></StudentRoute>} />
          <Route path="/courses" element={<StaffRoute><CoursesPage /></StaffRoute>} />
          <Route path="/groups" element={<StaffRoute><GroupsPage /></StaffRoute>} />
          <Route path="/sessions" element={<StaffRoute><SessionsPage /></StaffRoute>} />
          <Route path="/attendance" element={<StaffRoute><FeatureRoute feature="attendance.enabled"><AttendancePage /></FeatureRoute></StaffRoute>} />
          <Route path="/homework" element={<StaffRoute><FeatureRoute feature="homework.enabled"><HomeworkPage /></FeatureRoute></StaffRoute>} />
          <Route path="/certificates" element={<CertificateRoute><FeatureRoute feature="certificates.enabled"><CertificatesPage /></FeatureRoute></CertificateRoute>} />
          <Route path="/members" element={<TenantAdminRoute><MembersPage /></TenantAdminRoute>} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </RouteErrorBoundary>
  );
}

export function App() {
  return (
    <>
      <DocumentMetadata />
      <AppRoutes />
    </>
  );
}
