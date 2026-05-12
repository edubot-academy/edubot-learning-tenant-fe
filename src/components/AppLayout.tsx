import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { FiAward, FiBookOpen, FiCalendar, FiCheckSquare, FiHome, FiLogOut, FiSettings, FiSliders, FiUsers } from 'react-icons/fi';
import { useAuth } from '../features/auth/AuthProvider';
import { useTenant } from '../features/tenant/TenantProvider';
import { isTenantFeatureEnabled, type TenantFeatureKey } from '../features/tenant/tenantFeatures';
import { canManageTenantCertificates, canManageTenantMembers, getEffectiveTenantRole, isTenantStudent } from '../features/tenant/tenantRoles';
import { readable } from '../lib/format';

type NavItem = { to: string; label: string; icon: typeof FiHome; feature?: TenantFeatureKey };

const staffNavItems = [
  { to: '/', label: 'Overview', icon: FiHome },
  { to: '/courses', label: 'Courses', icon: FiBookOpen },
  { to: '/groups', label: 'Groups', icon: FiUsers },
  { to: '/sessions', label: 'Sessions', icon: FiCalendar },
  { to: '/attendance', label: 'Attendance', icon: FiCheckSquare, feature: 'attendance.enabled' },
  { to: '/homework', label: 'Homework', icon: FiCheckSquare, feature: 'homework.enabled' },
  { to: '/certificates', label: 'Certificates', icon: FiAward, feature: 'certificates.enabled' },
  { to: '/members', label: 'Members', icon: FiUsers },
  { to: '/settings', label: 'Settings', icon: FiSettings },
] satisfies NavItem[];

const studentNavItems = [
  { to: '/student', label: 'My learning', icon: FiHome },
  { to: '/settings', label: 'Settings', icon: FiSettings },
] satisfies NavItem[];

export function AppLayout() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { tenants, activeTenant, hostnameLocked, setActiveTenantId } = useTenant();
  const tenantRole = getEffectiveTenantRole(user, activeTenant);
  const learnerView = isTenantStudent(user, activeTenant);
  const navItems: NavItem[] = learnerView
    ? studentNavItems
    : staffNavItems.filter((item) => {
      if (item.to === '/members') return canManageTenantMembers(user, activeTenant);
      if (item.to === '/certificates') return canManageTenantCertificates(user, activeTenant);
      return true;
    });
  const visibleNavItems = navItems.filter((item) => !item.feature || isTenantFeatureEnabled(activeTenant, item.feature));
  const enabledTools = staffNavItems.filter((item) => item.feature && isTenantFeatureEnabled(activeTenant, item.feature)).length;

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">{activeTenant?.logoUrl ? <img src={activeTenant.logoUrl} alt="" /> : 'E'}</div>
          <div>
            <strong>{activeTenant?.name ?? 'EduBot Tenant'}</strong>
            <span>{user?.fullName || user?.email}</span>
          </div>
        </div>

        <div className="sidebar-user-card">
          <div>
            <span>Signed in as</span>
            <strong>{readable(tenantRole)}</strong>
          </div>
          <span className={`status-badge role-${tenantRole || 'user'}`}>{learnerView ? 'Learner' : 'Staff'}</span>
        </div>

        {!hostnameLocked && tenants.length > 1 ? (
          <>
            <label className="tenant-select-label" htmlFor="tenant-select">Tenant</label>
            <select
              id="tenant-select"
              className="tenant-select"
              value={activeTenant?.id ?? ''}
              onChange={(event) => setActiveTenantId(Number(event.target.value))}
            >
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
              ))}
            </select>
          </>
        ) : activeTenant ? (
          <div className="tenant-fixed">
            <span>Tenant</span>
            <strong>{activeTenant.name}</strong>
          </div>
        ) : null}

        <div className="sidebar-workspace-card">
          <FiSliders />
          <div>
            <span>Workspace tools</span>
            <strong>{learnerView ? 'Learner portal' : `${enabledTools} enabled`}</strong>
          </div>
        </div>

        <span className="sidebar-section-label">Navigation</span>
        <nav className="sidebar-nav" aria-label="Workspace navigation">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} end={item.to === '/'}>
                {({ isActive }) => (
                  <>
                    <Icon aria-hidden="true" />
                    <span>{item.label}</span>
                    {isActive ? (
                      <>
                        <span className="sidebar-current-dot" aria-hidden="true" />
                        <span className="sr-only">Current page</span>
                      </>
                    ) : null}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        <button
          className="ghost-button sidebar-logout"
          type="button"
          onClick={() => {
            void signOut();
            navigate('/login');
          }}
        >
          <FiLogOut />
          Sign out
        </button>
      </aside>

      <main id="main-content" className="main-panel" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
