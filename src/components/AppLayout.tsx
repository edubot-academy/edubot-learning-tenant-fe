import { Suspense, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { FiBell, FiLogOut, FiMoreHorizontal, FiSettings } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../features/auth/AuthProvider';
import { useTenant } from '../features/tenant/TenantProvider';
import { isTenantStudent } from '../features/tenant/tenantRoles';
import { countEnabledStaffTools, getMobileNavGroups, getVisibleNavItems } from './appNavigation';
import { LanguageMenu } from './LanguageMenu';
import { LoadingState } from './DataState';
import { getStudentNotificationUnreadCount, listStudentNotifications, markStudentNotificationRead } from '../services/api';

type ShellNotification = {
  id?: number;
  title?: string;
  body?: string;
  type?: string;
  isRead?: boolean;
  createdAt?: string;
};

export function AppLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { tenants, activeTenant, hostnameLocked, setActiveTenantId } = useTenant();
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [notificationMenuOpen, setNotificationMenuOpen] = useState(false);
  const [studentNotifications, setStudentNotifications] = useState<ShellNotification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [studentUnreadCount, setStudentUnreadCount] = useState(0);
  const mobileNavRef = useRef<HTMLElement>(null);
  const notificationMenuRef = useRef<HTMLDivElement>(null);
  const learnerView = isTenantStudent(user, activeTenant);
  const visibleNavItems = getVisibleNavItems(user, activeTenant);
  const enabledTools = countEnabledStaffTools(activeTenant);
  const { primaryMobileNavItems, secondaryMobileNavItems } = getMobileNavGroups(visibleNavItems, learnerView, user, activeTenant);
  const hasMobileMoreMenu = secondaryMobileNavItems.length > 0 || Boolean(user);
  const moreActive = secondaryMobileNavItems.some((item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`));
  const userLabel = user?.fullName || user?.email || t('app.signedInUser');

  useEffect(() => {
    setMobileMoreOpen(false);
    setNotificationMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!learnerView) {
      setStudentUnreadCount(0);
      setStudentNotifications([]);
      setNotificationMenuOpen(false);
      return undefined;
    }
    let cancelled = false;
    const refreshNotifications = () => {
      void getStudentNotificationUnreadCount()
        .then((result) => {
          if (!cancelled) setStudentUnreadCount(result?.count ?? 0);
        })
        .catch(() => {
          if (!cancelled) setStudentUnreadCount(0);
        });
      if (notificationMenuOpen) {
        setNotificationsLoading(true);
        void listStudentNotifications({ page: 1, limit: 5 })
          .then((items) => {
            if (!cancelled) setStudentNotifications(items);
          })
          .catch(() => {
            if (!cancelled) setStudentNotifications([]);
          })
          .finally(() => {
            if (!cancelled) setNotificationsLoading(false);
          });
      }
    };
    refreshNotifications();
    window.addEventListener('student-notifications-updated', refreshNotifications);
    return () => {
      cancelled = true;
      window.removeEventListener('student-notifications-updated', refreshNotifications);
    };
  }, [activeTenant?.id, learnerView, notificationMenuOpen]);

  useEffect(() => {
    if (!notificationMenuOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!notificationMenuRef.current?.contains(target) && !mobileNavRef.current?.contains(target)) {
        setNotificationMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setNotificationMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [notificationMenuOpen]);

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

  const markShellNotificationRead = async (notification: ShellNotification) => {
    if (!notification.id || notification.isRead) return;
    try {
      await markStudentNotificationRead(notification.id);
      setStudentNotifications((current) => current.map((item) => (
        item.id === notification.id ? { ...item, isRead: true } : item
      )));
      setStudentUnreadCount((current) => Math.max(0, current - 1));
      window.dispatchEvent(new Event('student-notifications-updated'));
    } catch {
      setNotificationMenuOpen(false);
    }
  };

  const notificationMenu = (
    <div className="shell-notification-menu" role="menu" aria-label={t('student.notifications')}>
      <div className="shell-notification-heading">
        <strong>{t('student.notifications')}</strong>
        <NavLink to="/student/today">{t('student.viewAll')}</NavLink>
      </div>
      {notificationsLoading ? (
        <div className="shell-notification-empty">{t('student.notificationsLoading')}</div>
      ) : !studentNotifications.length ? (
        <div className="shell-notification-empty">{t('student.notificationsEmptyTitle')}</div>
      ) : (
        <div className="shell-notification-list">
          {studentNotifications.map((notification, index) => (
            <button
              key={notification.id ?? index}
              type="button"
              className={`shell-notification-item ${notification.isRead ? 'read' : 'unread'}`}
              onClick={() => void markShellNotificationRead(notification)}
            >
              <span>
                <strong>{notification.title ?? t('student.notification')}</strong>
                <small>{notification.body ?? notification.type ?? t('student.notification')}</small>
              </span>
              {!notification.isRead ? <i aria-hidden="true" /> : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">{t('app.skipToContent')}</a>
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">{activeTenant?.logoUrl ? <img src={activeTenant.logoUrl} alt="" /> : 'E'}</div>
          <div className="brand-copy">
            <strong title={activeTenant?.name ?? t('app.defaultTenant')}>{activeTenant?.name ?? t('app.defaultTenant')}</strong>
            <span title={userLabel}>{userLabel}</span>
          </div>
          <LanguageMenu />
        </div>

        <div className="tenant-context">
          {!hostnameLocked && tenants.length > 1 ? (
            <>
              <label className="tenant-select-label" htmlFor="tenant-select">{t('navigation.switchTenant')}</label>
              <select
                id="tenant-select"
                className="tenant-select"
                value={activeTenant?.id ?? ''}
                onChange={(event) => setActiveTenantId(Number(event.target.value))}
              >
                {tenants.map((tenant) => (
                  <option
                    key={tenant.id}
                    value={tenant.id}
                    disabled={tenant.availability?.enabled === false || tenant.permissions?.canEnterWorkspace === false}
                  >
                    {tenant.name}{tenant.availability?.enabled === false ? ` (${tenant.availability.reason ?? tenant.status ?? 'Unavailable'})` : ''}
                  </option>
                ))}
              </select>
            </>
          ) : null}
        </div>

        <div className="sidebar-workspace-card">
          <FiSettings />
          <div>
            <span>{t('app.workspace')}</span>
            <strong>{learnerView ? t('app.learnerPortal') : t('app.toolsEnabled', { count: enabledTools })}</strong>
          </div>
        </div>

        {learnerView ? (
          <div className="shell-notification-control" ref={notificationMenuRef}>
            <button
              type="button"
              className={notificationMenuOpen ? 'active' : ''}
              aria-expanded={notificationMenuOpen}
              aria-haspopup="menu"
              onClick={() => setNotificationMenuOpen((open) => !open)}
            >
              <FiBell aria-hidden="true" />
              <span>{t('student.notifications')}</span>
              {studentUnreadCount > 0 ? <strong>{studentUnreadCount}</strong> : null}
            </button>
            {notificationMenuOpen ? notificationMenu : null}
          </div>
        ) : null}

        <span className="sidebar-section-label">{t('app.navigation')}</span>
        <nav className="sidebar-nav" aria-label={t('app.navigation')}>
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} end={item.to === '/'}>
                {({ isActive }) => (
                  <>
                    <Icon aria-hidden="true" />
                    <span>{t(item.labelKey)}</span>
                    {learnerView && item.to === '/student/today' && studentUnreadCount > 0 ? (
                      <span className="nav-unread-badge" aria-label={t('student.unreadNotifications', { count: studentUnreadCount })}>{studentUnreadCount}</span>
                    ) : null}
                    {isActive ? (
                      <>
                        <span className="sidebar-current-dot" aria-hidden="true" />
                        <span className="sr-only">{t('app.currentPage')}</span>
                      </>
                    ) : null}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {learnerView ? (
          <NavLink className="ghost-button sidebar-logout sidebar-settings-link" to="/settings">
            <FiSettings />
            {t('navigation.settings')}
          </NavLink>
        ) : null}

        <button
          className="ghost-button sidebar-logout"
          type="button"
          title={t('actions.signOut')}
          onClick={() => {
            void signOut();
            navigate('/login');
          }}
        >
          <FiLogOut />
          {t('actions.signOut')}
        </button>
      </aside>

      <main id="main-content" className="main-panel" tabIndex={-1}>
        <Suspense fallback={<div className="route-loading"><LoadingState label={t('app.loadingView')} /></div>}>
          <Outlet />
        </Suspense>
      </main>

      <nav className="mobile-tabbar" aria-label={t('app.navigation')} ref={mobileNavRef}>
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
                      {learnerView && item.to === '/student/today' && studentUnreadCount > 0 ? (
                        <span className="mobile-unread-badge">{studentUnreadCount}</span>
                      ) : null}
                    </span>
                    <span className="mobile-tabbar-label">{t(item.labelKey)}</span>
                    {isActive ? <span className="sr-only">{t('app.currentPage')}</span> : null}
                  </>
                )}
              </NavLink>
            );
          })}
          {hasMobileMoreMenu ? (
            <button
              className={moreActive || mobileMoreOpen ? 'active' : ''}
              type="button"
              aria-label={t('navigation.moreOptions')}
              aria-expanded={mobileMoreOpen}
              aria-controls="mobile-more-menu"
              onClick={() => setMobileMoreOpen((open) => !open)}
            >
              <span className="mobile-tabbar-icon" aria-hidden="true">
                <FiMoreHorizontal />
              </span>
              <span className="mobile-tabbar-label">{t('actions.more')}</span>
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
                  <span>{t(item.labelKey)}</span>
                </NavLink>
              );
            })}
            {learnerView ? (
              <>
              <button
                type="button"
                className="mobile-more-action"
                onClick={() => setNotificationMenuOpen((open) => !open)}
              >
                <FiBell aria-hidden="true" />
                <span>{t('student.notifications')}</span>
                {studentUnreadCount > 0 ? <span className="mobile-more-count">{studentUnreadCount}</span> : null}
              </button>
              {notificationMenuOpen ? notificationMenu : null}
              <NavLink
                to="/settings"
                end
                onClick={() => setMobileMoreOpen(false)}
              >
                <FiSettings aria-hidden="true" />
                <span>{t('navigation.settings')}</span>
              </NavLink>
              </>
            ) : null}
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
              <span>{t('actions.signOut')}</span>
            </button>
          </div>
        ) : null}
      </nav>
    </div>
  );
}
