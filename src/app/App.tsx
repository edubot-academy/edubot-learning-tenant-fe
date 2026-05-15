import { Component, lazy, Suspense, useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n/config';
import { AppLayout } from '../components/AppLayout';
import { useAuth } from '../features/auth/AuthProvider';
import { useTenant } from '../features/tenant/TenantProvider';
import { EmptyState, LoadingState } from '../components/DataState';
import { isTenantFeatureEnabled, type TenantFeatureKey } from '../features/tenant/tenantFeatures';
import { getStudentAccess } from '../services/api';
import {
  canManageTenantBranding,
  canManageAssignedAttendance,
  canManageAssignedHomework,
  canManageTenantCertificates,
  canManageTenantCourses,
  canManageTenantProfile,
  canManageTenantSettings,
  canApproveAssignedCertificates,
  canCoordinateTenantLearning,
  canOperateTenantLearning,
  canSupportTenantOperations,
  canViewAssignedLearning,
  canViewOperationalLearning,
  canViewOperationalReports,
  canViewStudentSupportContext,
  getTenantAccessLevel,
  isPlatformAdmin,
  isTenantStudent,
} from '../features/tenant/tenantRoles';
import { canAccessTenantPermissionSurface } from './routePermissions';

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
const OperationsPage = lazyNamed(() => import('../features/operations/OperationsPage'), 'OperationsPage');
const ReportsPage = lazyNamed(() => import('../features/reports/ReportsPage'), 'ReportsPage');
const SettingsPage = lazyNamed(() => import('../features/settings/SettingsPage'), 'SettingsPage');
const StudentDashboardPage = lazyNamed(() => import('../features/student/StudentDashboardPage'), 'StudentDashboardPage');
const StudentSupportPage = lazyNamed(() => import('../features/support/StudentSupportPage'), 'StudentSupportPage');

const routeTitles: Record<string, string> = {
  '/': 'navigation.overview',
  '/forgot-password': 'titles.passwordReset',
  '/setup-account': 'titles.accountSetup',
  '/student': 'student.today',
  '/student/today': 'student.today',
  '/student/todo': 'student.toDo',
  '/student/courses': 'navigation.courses',
  '/student/sessions': 'student.sessionDetail',
  '/student/materials': 'student.materials',
  '/student/progress': 'student.progress',
  '/student/help': 'student.help',
  '/courses': 'navigation.courses',
  '/groups': 'navigation.groups',
  '/sessions': 'navigation.sessions',
  '/attendance': 'navigation.attendance',
  '/homework': 'navigation.homework',
  '/certificates': 'navigation.certificates',
  '/members': 'navigation.members',
  '/operations': 'navigation.operations',
  '/reports': 'navigation.reports',
  '/support': 'navigation.support',
  '/settings': 'navigation.settings',
};

const defaultFaviconHref = '/edubot-icon.svg';

type RouteErrorBoundaryState = {
  hasError: boolean;
};

class RouteErrorBoundary extends Component<{ children: ReactNode; resetKey: string }, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidUpdate(prevProps: { resetKey: string }) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      const t = i18n.t.bind(i18n);
      return (
        <main className="login-page">
          <section className="login-panel state-panel" role="alert">
            <strong>{t('errors.workspaceViewFailedTitle')}</strong>
            <span>{t('errors.workspaceViewFailedDetail')}</span>
            <div className="page-actions">
              <button type="button" onClick={() => this.setState({ hasError: false })}>{t('actions.tryAgain')}</button>
              <button type="button" className="secondary-button" onClick={() => window.location.assign('/')}>{t('actions.goToOverview')}</button>
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
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { activeTenant, resolvedTenant } = useTenant();
  const tenant = activeTenant ?? resolvedTenant;
  const faviconHref = tenant?.logoUrl || defaultFaviconHref;

  const title = useMemo(() => {
    if (pathname === '/login') return tenant?.name ? `${t('titles.signIn')} | ${tenant.name}` : `${t('titles.signIn')} | ${t('app.defaultTenant')}`;
    if (pathname === '/forgot-password') {
      return tenant?.name ? `${t('titles.passwordReset')} | ${tenant.name}` : `${t('titles.passwordReset')} | ${t('app.defaultTenant')}`;
    }
    if (pathname === '/setup-account') {
      return tenant?.name ? `${t('titles.accountSetup')} | ${tenant.name}` : `${t('titles.accountSetup')} | ${t('app.defaultTenant')}`;
    }

    const sectionTitle = t(routeTitles[pathname] ?? 'app.tenantWorkspace');
    const tenantName = tenant?.name ?? t('app.tenantWorkspace');
    return `${sectionTitle} | ${tenantName}`;
  }, [pathname, t, tenant?.name]);

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
  return isTenantStudent(user, activeTenant) ? <Navigate to="/student/today" replace /> : <OverviewPage />;
}

function AccessDeniedState({
  detailKey,
  to,
  actionKey,
}: {
  detailKey: string;
  to: string;
  actionKey: string;
}) {
  const { t } = useTranslation();
  return (
    <EmptyState
      title={t('errors.accessDeniedTitle')}
      detail={t(detailKey)}
      action={<Link className="secondary-link-button" to={to}>{t(actionKey)}</Link>}
    />
  );
}

function StaffRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { activeTenant } = useTenant();
  return canViewAssignedLearning(user, activeTenant) || canViewOperationalLearning(user, activeTenant) || canOperateTenantLearning(user, activeTenant)
    ? children
    : <AccessDeniedState detailKey="errors.staffOnlyDetail" to="/student" actionKey="navigation.myLearning" />;
}

function AttendanceManagementRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { activeTenant } = useTenant();
  return canManageAssignedAttendance(user, activeTenant) || canManageTenantCourses(user, activeTenant)
    ? children
    : <AccessDeniedState detailKey="errors.attendanceManagerOnlyDetail" to="/" actionKey="actions.goToOverview" />;
}

function HomeworkManagementRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { activeTenant } = useTenant();
  return canManageAssignedHomework(user, activeTenant) || canManageTenantCourses(user, activeTenant)
    ? children
    : <AccessDeniedState detailKey="errors.homeworkManagerOnlyDetail" to="/" actionKey="actions.goToOverview" />;
}

function CourseAdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { activeTenant } = useTenant();
  return canAccessTenantPermissionSurface('courses', user, activeTenant)
    ? children
    : <AccessDeniedState detailKey="errors.tenantAdminOnlyDetail" to="/" actionKey="actions.goToOverview" />;
}

function StudentRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { activeTenant } = useTenant();
  const [accessState, setAccessState] = useState<'loading' | 'allowed' | 'denied'>('loading');

  useEffect(() => {
    let cancelled = false;
    if (!isTenantStudent(user, activeTenant)) {
      setAccessState('denied');
      return;
    }

    setAccessState('loading');
    getStudentAccess()
      .then(() => {
        if (!cancelled) setAccessState('allowed');
      })
      .catch(() => {
        if (!cancelled) setAccessState('denied');
      });

    return () => {
      cancelled = true;
    };
  }, [activeTenant?.id, user]);

  if (!isTenantStudent(user, activeTenant) || accessState === 'denied') {
    return <AccessDeniedState detailKey="errors.studentOnlyDetail" to="/" actionKey="actions.goToOverview" />;
  }

  return accessState === 'allowed' ? children : <LoadingState label="Loading" />;
}

function StudentCourseDetailRoute() {
  const { courseId } = useParams();
  const numericCourseId = Number(courseId);
  return Number.isFinite(numericCourseId)
    ? <StudentDashboardPage view="courseDetail" courseId={numericCourseId} />
    : <Navigate to="/student/courses" replace />;
}

function StudentSessionDetailRoute() {
  const { sessionId } = useParams();
  const numericSessionId = Number(sessionId);
  return Number.isFinite(numericSessionId)
    ? <StudentDashboardPage view="sessionDetail" sessionId={numericSessionId} />
    : <Navigate to="/student/today" replace />;
}

function TenantAdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { activeTenant } = useTenant();
  return canAccessTenantPermissionSurface('members', user, activeTenant)
    ? children
    : <AccessDeniedState detailKey="errors.tenantAdminOnlyDetail" to="/" actionKey="actions.goToOverview" />;
}

function CertificateRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { activeTenant } = useTenant();
  return canManageTenantCertificates(user, activeTenant)
    || canApproveAssignedCertificates(user, activeTenant)
    ? children
    : <AccessDeniedState detailKey="errors.certificateManagerOnlyDetail" to="/" actionKey="actions.goToOverview" />;
}

function OperationsRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { activeTenant } = useTenant();
  return canSupportTenantOperations(user, activeTenant)
    || canViewOperationalLearning(user, activeTenant)
    || canCoordinateTenantLearning(user, activeTenant)
    || canManageTenantCertificates(user, activeTenant)
    ? children
    : <AccessDeniedState detailKey="errors.staffOnlyDetail" to="/student" actionKey="navigation.myLearning" />;
}

function ReportsRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { activeTenant } = useTenant();
  return canAccessTenantPermissionSurface('reports', user, activeTenant) || canViewOperationalReports(user, activeTenant)
    ? children
    : <AccessDeniedState detailKey="errors.tenantAdminOnlyDetail" to="/" actionKey="actions.goToOverview" />;
}

function SupportRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { activeTenant } = useTenant();
  return canViewStudentSupportContext(user, activeTenant)
    && (canViewOperationalLearning(user, activeTenant) || canOperateTenantLearning(user, activeTenant))
    ? children
    : <AccessDeniedState detailKey="errors.supportOnlyDetail" to="/" actionKey="actions.goToOverview" />;
}

function SettingsRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { activeTenant } = useTenant();
  return isTenantStudent(user, activeTenant)
    || canSupportTenantOperations(user, activeTenant)
    || canOperateTenantLearning(user, activeTenant)
    || canManageTenantProfile(user, activeTenant)
    || canManageTenantBranding(user, activeTenant)
    || canManageTenantSettings(user, activeTenant)
    ? children
    : <AccessDeniedState detailKey="errors.tenantAdminOnlyDetail" to="/" actionKey="actions.goToOverview" />;
}

function FeatureRoute({ feature, children }: { feature: TenantFeatureKey; children: React.ReactNode }) {
  const { t } = useTranslation();
  const { activeTenant } = useTenant();

  if (!isTenantFeatureEnabled(activeTenant, feature)) {
    return (
      <EmptyState
        title={t('errors.featureDisabledTitle')}
        detail={t('errors.featureDisabledDetail')}
      />
    );
  }

  return children;
}

function ProtectedRoutes() {
  const { t } = useTranslation();
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

  if (loading || tenantLoading || resolvingTenant) return <LoadingState label={t('app.preparingWorkspace')} />;
  if (!user) return <Navigate to="/login" replace />;
  if (isPlatformAdmin(user)) {
    return (
      <main className="login-page">
        <section className="login-panel state-panel">
          <strong>{t('errors.platformAdminTitle')}</strong>
          <span>{t('errors.platformAdminDetail')}</span>
          <div className="page-actions">
            <button type="button" className="secondary-button" onClick={() => void signOut()}>{t('actions.signOut')}</button>
          </div>
        </section>
      </main>
    );
  }
  if (resolutionError) {
    return (
      <main className="login-page">
        <section className="login-panel state-panel">
          <strong>{t('errors.tenantDomainTitle')}</strong>
          <span>{resolutionError}</span>
          <div className="page-actions">
            <button type="button" className="secondary-button" onClick={() => void signOut()}>{t('actions.signOut')}</button>
          </div>
        </section>
      </main>
    );
  }
  if (tenantError) {
    return (
      <main className="login-page">
        <section className="login-panel state-panel">
          <strong>{t('errors.tenantAccessLoadTitle')}</strong>
          <span>{tenantError}</span>
          <div className="page-actions">
            <button type="button" onClick={() => void reloadTenants().catch(() => undefined)}>{t('actions.retry')}</button>
            <button type="button" className="secondary-button" onClick={() => void signOut()}>{t('actions.signOut')}</button>
          </div>
        </section>
      </main>
    );
  }
  if (!activeTenant) {
    return (
      <main className="login-page">
        <section className="login-panel state-panel">
          <strong>{t('errors.noTenantAccessTitle')}</strong>
          <span>{t('errors.noTenantAccessDetail')}</span>
          <div className="page-actions">
            <button type="button" onClick={() => void reloadTenants().catch(() => undefined)}>{t('actions.refresh')}</button>
            <button type="button" className="secondary-button" onClick={() => void signOut()}>{t('actions.signOut')}</button>
          </div>
          {tenants.length ? <span>{t('errors.noTenantAccessLoaded', { count: tenants.length })}</span> : null}
        </section>
      </main>
    );
  }
  if (getTenantAccessLevel(user, activeTenant) === 'none') {
    return (
      <main className="login-page">
        <section className="login-panel state-panel">
          <strong>{t('errors.noWorkspaceRoleTitle')}</strong>
          <span>{t('errors.noWorkspaceRoleDetail')}</span>
          <div className="page-actions">
            <button type="button" onClick={() => void reloadTenants().catch(() => undefined)}>{t('actions.refresh')}</button>
            <button type="button" className="secondary-button" onClick={() => void signOut()}>{t('actions.signOut')}</button>
          </div>
        </section>
      </main>
    );
  }

  return <AppLayout />;
}

function AppRoutes() {
  const { t } = useTranslation();
  const location = useLocation();

  return (
    <RouteErrorBoundary resetKey={location.pathname}>
      <Suspense fallback={<LoadingState label={t('app.loadingView')} />}>
        <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<PasswordResetPage />} />
        <Route path="/setup-account" element={<SetupAccountPage />} />
        <Route element={<ProtectedRoutes />}>
          <Route index element={<HomeRoute />} />
          <Route path="/student" element={<StudentRoute><Navigate to="/student/today" replace /></StudentRoute>} />
          <Route path="/student/today" element={<StudentRoute><StudentDashboardPage view="today" /></StudentRoute>} />
          <Route path="/student/todo" element={<StudentRoute><StudentDashboardPage view="todo" /></StudentRoute>} />
          <Route path="/student/courses" element={<StudentRoute><StudentDashboardPage view="courses" /></StudentRoute>} />
          <Route path="/student/courses/:courseId" element={<StudentRoute><StudentCourseDetailRoute /></StudentRoute>} />
          <Route path="/student/sessions/:sessionId" element={<StudentRoute><StudentSessionDetailRoute /></StudentRoute>} />
          <Route path="/student/materials" element={<StudentRoute><StudentDashboardPage view="materials" /></StudentRoute>} />
          <Route path="/student/progress" element={<StudentRoute><StudentDashboardPage view="progress" /></StudentRoute>} />
          <Route path="/student/help" element={<StudentRoute><StudentDashboardPage view="help" /></StudentRoute>} />
          <Route path="/courses" element={<CourseAdminRoute><CoursesPage /></CourseAdminRoute>} />
          <Route path="/groups" element={<StaffRoute><GroupsPage /></StaffRoute>} />
          <Route path="/sessions" element={<StaffRoute><SessionsPage /></StaffRoute>} />
          <Route path="/attendance" element={<AttendanceManagementRoute><FeatureRoute feature="attendance.enabled"><AttendancePage /></FeatureRoute></AttendanceManagementRoute>} />
          <Route path="/homework" element={<HomeworkManagementRoute><FeatureRoute feature="homework.enabled"><HomeworkPage /></FeatureRoute></HomeworkManagementRoute>} />
          <Route path="/certificates" element={<CertificateRoute><FeatureRoute feature="certificates.enabled"><CertificatesPage /></FeatureRoute></CertificateRoute>} />
          <Route path="/members" element={<TenantAdminRoute><MembersPage /></TenantAdminRoute>} />
          <Route path="/operations" element={<OperationsRoute><OperationsPage /></OperationsRoute>} />
          <Route path="/reports" element={<ReportsRoute><ReportsPage /></ReportsRoute>} />
          <Route path="/support" element={<SupportRoute><StudentSupportPage /></SupportRoute>} />
          <Route path="/settings" element={<SettingsRoute><SettingsPage /></SettingsRoute>} />
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
