import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { FiGlobe, FiLogOut, FiMoreHorizontal, FiSettings } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../features/auth/AuthProvider';
import { useTenant } from '../features/tenant/TenantProvider';
import { isTenantStudent } from '../features/tenant/tenantRoles';
import { SUPPORTED_LOCALES, type SupportedLocale } from '../i18n/locale';
import { useLocale } from '../i18n/LocaleProvider';
import { countEnabledStaffTools, getMobileNavGroups, getVisibleNavItems } from './appNavigation';

export function AppLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { tenants, activeTenant, hostnameLocked, setActiveTenantId } = useTenant();
  const { locale, setLocale } = useLocale();
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const mobileNavRef = useRef<HTMLElement>(null);
  const languageMenuRef = useRef<HTMLDivElement>(null);
  const learnerView = isTenantStudent(user, activeTenant);
  const visibleNavItems = getVisibleNavItems(user, activeTenant);
  const enabledTools = countEnabledStaffTools(activeTenant);
  const { primaryMobileNavItems, secondaryMobileNavItems } = getMobileNavGroups(visibleNavItems, learnerView);
  const hasMobileMoreMenu = secondaryMobileNavItems.length > 0 || Boolean(user);
  const moreActive = secondaryMobileNavItems.some((item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`));
  const userLabel = user?.fullName || user?.email || t('app.signedInUser');

  useEffect(() => {
    setMobileMoreOpen(false);
    setLanguageMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!languageMenuOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      if (!languageMenuRef.current?.contains(event.target as Node)) {
        setLanguageMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLanguageMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [languageMenuOpen]);

  const chooseLocale = (nextLocale: SupportedLocale) => {
    setLocale(nextLocale);
    setLanguageMenuOpen(false);
  };

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
      <a className="skip-link" href="#main-content">{t('app.skipToContent')}</a>
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">{activeTenant?.logoUrl ? <img src={activeTenant.logoUrl} alt="" /> : 'E'}</div>
          <div className="brand-copy">
            <strong title={activeTenant?.name ?? t('app.defaultTenant')}>{activeTenant?.name ?? t('app.defaultTenant')}</strong>
            <span title={userLabel}>{userLabel}</span>
          </div>
          <div className="language-compact" ref={languageMenuRef}>
            <button
              type="button"
              className={languageMenuOpen ? 'active' : ''}
              aria-label={t('language.label')}
              aria-haspopup="menu"
              aria-expanded={languageMenuOpen}
              aria-controls="language-menu"
              title={t('language.label')}
              onClick={() => setLanguageMenuOpen((open) => !open)}
            >
              <FiGlobe aria-hidden="true" />
            </button>
            {languageMenuOpen ? (
              <div className="language-menu" id="language-menu" role="menu" aria-label={t('language.label')}>
                {SUPPORTED_LOCALES.map((code) => (
                  <button
                    key={code}
                    type="button"
                    role="menuitemradio"
                    aria-checked={locale === code}
                    className={locale === code ? 'active' : ''}
                    onClick={() => chooseLocale(code)}
                  >
                    {code === 'ky' ? 'KG' : code.toUpperCase() === 'EN' ? 'US' : code.toUpperCase()}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
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
                  <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
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
        <Outlet />
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
