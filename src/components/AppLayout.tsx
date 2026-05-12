import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { FiLogOut, FiMoreHorizontal, FiSettings } from 'react-icons/fi';
import { useAuth } from '../features/auth/AuthProvider';
import { useTenant } from '../features/tenant/TenantProvider';
import { isTenantStudent } from '../features/tenant/tenantRoles';
import { countEnabledStaffTools, getMobileNavGroups, getVisibleNavItems } from './appNavigation';

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { tenants, activeTenant, hostnameLocked, setActiveTenantId } = useTenant();
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const mobileNavRef = useRef<HTMLElement>(null);
  const learnerView = isTenantStudent(user, activeTenant);
  const visibleNavItems = getVisibleNavItems(user, activeTenant);
  const enabledTools = countEnabledStaffTools(activeTenant);
  const { primaryMobileNavItems, secondaryMobileNavItems } = getMobileNavGroups(visibleNavItems, learnerView);
  const hasMobileMoreMenu = secondaryMobileNavItems.length > 0 || Boolean(user);
  const moreActive = secondaryMobileNavItems.some((item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`));
  const userLabel = user?.fullName || user?.email || 'Signed in user';

  useEffect(() => {
    setMobileMoreOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileMoreOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      if (!mobileNavRef.current?.contains(event.target as Node)) {
        setMobileMoreOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileMoreOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileMoreOpen]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">{activeTenant?.logoUrl ? <img src={activeTenant.logoUrl} alt="" /> : 'E'}</div>
          <div>
            <strong title={activeTenant?.name ?? 'EduBot Tenant'}>{activeTenant?.name ?? 'EduBot Tenant'}</strong>
            <span title={userLabel}>{userLabel}</span>
          </div>
        </div>

        <div className="tenant-context">
          {!hostnameLocked && tenants.length > 1 ? (
            <>
              <label className="tenant-select-label" htmlFor="tenant-select">Switch tenant</label>
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
          ) : null}
        </div>

        <div className="sidebar-workspace-card">
          <FiSettings />
          <div>
            <span>Workspace</span>
            <strong>{learnerView ? 'Learner portal' : `${enabledTools} tools enabled`}</strong>
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
          title="Sign out"
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

      <nav className="mobile-tabbar" aria-label="Mobile workspace navigation" ref={mobileNavRef}>
        <div className="mobile-tabbar-inner">
          {primaryMobileNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={() => setMobileMoreOpen(false)}
              >
                {({ isActive }) => (
                  <>
                    <span className="mobile-tabbar-icon" aria-hidden="true">
                      <Icon />
                    </span>
                    <span className="mobile-tabbar-label">{item.label}</span>
                    {isActive ? <span className="sr-only">Current page</span> : null}
                  </>
                )}
              </NavLink>
            );
          })}
          {hasMobileMoreMenu ? (
            <button
              className={moreActive || mobileMoreOpen ? 'active' : ''}
              type="button"
              aria-label="More navigation options"
              aria-expanded={mobileMoreOpen}
              aria-controls="mobile-more-menu"
              onClick={() => setMobileMoreOpen((open) => !open)}
            >
              <span className="mobile-tabbar-icon" aria-hidden="true">
                <FiMoreHorizontal />
              </span>
              <span className="mobile-tabbar-label">More</span>
            </button>
          ) : null}
        </div>
        {hasMobileMoreMenu && mobileMoreOpen ? (
          <div className="mobile-more-menu" id="mobile-more-menu">
            {secondaryMobileNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={() => setMobileMoreOpen(false)}
                >
                  <Icon aria-hidden="true" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
            <button
              type="button"
              className="mobile-more-action danger"
              onClick={() => {
                setMobileMoreOpen(false);
                void signOut();
                navigate('/login');
              }}
            >
              <FiLogOut aria-hidden="true" />
              <span>Sign out</span>
            </button>
          </div>
        ) : null}
      </nav>
    </div>
  );
}
