import { type CSSProperties, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { FiActivity, FiCreditCard, FiGlobe, FiLock, FiSliders, FiUserCheck } from 'react-icons/fi';
import { PageHeader } from '../../components/PageHeader';
import { WorkspaceTabs } from '../../components/WorkspaceTabs';
import { EmptyState, LoadingState } from '../../components/DataState';
import { formatDate, readable } from '../../lib/format';
import { activityActionLabelKeys, enumLabel, roleLabelKeys } from '../../lib/enumLabels';
import { useTenant } from '../tenant/TenantProvider';
import { useTheme } from '../theme/themeContext';
import { useAuth } from '../auth/AuthProvider';
import { listTenantActivity, updateTenant, updateTenantBranding, updateTenantSettings, uploadTenantLogo } from '../../services/api';
import { canManageTenantProfile, getEffectiveTenantRole, isTenantAdmin } from '../tenant/tenantRoles';
import type { Tenant, TenantActivityLog } from '../../types/domain';
import { normalizeLocale, SUPPORTED_LOCALES, type SupportedLocale } from '../../i18n/locale';

const knownFeatures = [
  { key: 'courses.video.enabled', labelKey: 'settings.featureVideoCourses' },
  { key: 'courses.offline.enabled', labelKey: 'settings.featureOfflineCourses' },
  { key: 'courses.onlineLive.enabled', labelKey: 'settings.featureOnlineLiveCourses' },
  { key: 'attendance.enabled', labelKey: 'navigation.attendance' },
  { key: 'homework.enabled', labelKey: 'navigation.homework' },
  { key: 'certificates.enabled', labelKey: 'navigation.certificates' },
  { key: 'crmSync.enabled', labelKey: 'settings.featureCrmSync' },
  { key: 'aiAssistant.enabled', labelKey: 'settings.featureAiAssistant' },
];

const emptyProfileForm = {
  name: '',
  timezone: '',
  locale: '',
  website: '',
  email: '',
  phone: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  address: '',
  city: '',
  country: '',
  telegram: '',
  whatsapp: '',
  instagram: '',
  taxId: '',
  notes: '',
};

const emptyBrandingForm = {
  displayName: '',
  certificateLogoUrl: '',
  primaryColor: '#122144',
  secondaryColor: '#14b8a6',
  accentColor: '#f17e22',
};

const emptyTenantSettingsForm = {
  supportEmail: '',
  defaultCourseVisibility: 'PRIVATE' as 'PUBLIC' | 'PRIVATE' | 'TENANT_ONLY',
  allowSelfEnrollment: false,
  requireEnrollmentApproval: false,
};

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function recordText(record: Record<string, unknown> | null | undefined, key: string) {
  const value = record?.[key];
  return typeof value === 'string' ? value : null;
}

function recordBoolean(record: Record<string, unknown> | null | undefined, key: string) {
  return record?.[key] === true;
}

function profileFormFromTenant(tenant: Tenant | null) {
  if (!tenant) return emptyProfileForm;
  return {
    name: tenant.name ?? '',
    timezone: tenant.timezone ?? '',
    locale: normalizeLocale(tenant.locale),
    website: tenant.website ?? '',
    email: tenant.email ?? '',
    phone: tenant.phone ?? '',
    contactName: tenant.contactName ?? '',
    contactEmail: tenant.contactEmail ?? '',
    contactPhone: tenant.contactPhone ?? '',
    address: tenant.address ?? '',
    city: tenant.city ?? '',
    country: tenant.country ?? '',
    telegram: tenant.telegram ?? '',
    whatsapp: tenant.whatsapp ?? '',
    instagram: tenant.instagram ?? '',
    taxId: tenant.taxId ?? '',
    notes: tenant.notes ?? '',
  };
}

function brandingFormFromTenant(tenant: Tenant | null) {
  if (!tenant) return emptyBrandingForm;
  const branding = tenant.branding ?? {};
  return {
    displayName: typeof branding.displayName === 'string' ? branding.displayName : '',
    certificateLogoUrl: typeof branding.certificateLogoUrl === 'string' ? branding.certificateLogoUrl : '',
    primaryColor: typeof branding.primaryColor === 'string' ? branding.primaryColor : '#122144',
    secondaryColor: typeof branding.secondaryColor === 'string' ? branding.secondaryColor : '#14b8a6',
    accentColor: typeof branding.accentColor === 'string' ? branding.accentColor : '#f17e22',
  };
}

function settingsFormFromTenant(tenant: Tenant | null): typeof emptyTenantSettingsForm {
  if (!tenant) return emptyTenantSettingsForm;
  const settings = tenant.settings ?? {};
  return {
    supportEmail: typeof settings.supportEmail === 'string' ? settings.supportEmail : '',
    defaultCourseVisibility:
      settings.defaultCourseVisibility === 'PUBLIC' || settings.defaultCourseVisibility === 'TENANT_ONLY'
        ? settings.defaultCourseVisibility
        : 'PRIVATE',
    allowSelfEnrollment: settings.allowSelfEnrollment === true,
    requireEnrollmentApproval: settings.requireEnrollmentApproval === true,
  };
}

function activityDetail(row: TenantActivityLog, fallback: string, detailLabel: (count: number) => string, targetLabel: (value?: string | null) => string) {
  if (row.targetType && row.targetId) return `${targetLabel(row.targetType)} ${row.targetId}`;
  if (row.targetType) return targetLabel(row.targetType);
  const metadataKeys = row.metadata ? Object.keys(row.metadata) : [];
  if (metadataKeys.length) return detailLabel(metadataKeys.length);
  return fallback;
}

type SettingsTab = 'profile' | 'branding' | 'policies' | 'access' | 'platform' | 'features' | 'activity';

export function SettingsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { tenants, activeTenant, reloadTenants } = useTenant();
  const { preference, resolvedTheme, setPreference } = useTheme();
  const [profileForm, setProfileForm] = useState(emptyProfileForm);
  const [brandingForm, setBrandingForm] = useState(emptyBrandingForm);
  const [tenantSettingsForm, setTenantSettingsForm] = useState(emptyTenantSettingsForm);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingBranding, setEditingBranding] = useState(false);
  const [editingPolicies, setEditingPolicies] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingBranding, setSavingBranding] = useState(false);
  const [savingPolicies, setSavingPolicies] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('profile');
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [brandingErrors, setBrandingErrors] = useState<Record<string, string>>({});
  const [policyErrors, setPolicyErrors] = useState<Record<string, string>>({});
  const [activityRows, setActivityRows] = useState<TenantActivityLog[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const flags = useMemo(() => activeTenant?.featureFlags ?? {}, [activeTenant?.featureFlags]);
  const tenantRole = getEffectiveTenantRole(user, activeTenant);
  const canEditTenantProfile = canManageTenantProfile(user, activeTenant);
  const canViewTenantActivity = isTenantAdmin(user, activeTenant);

  const featureRows = useMemo(() => {
    const rows: Array<{ key: string; label: string; explicit: boolean; enabled: boolean }> = knownFeatures.map((feature) => ({
      ...feature,
      label: t(feature.labelKey),
      explicit: Object.prototype.hasOwnProperty.call(flags, feature.key),
      enabled: flags[feature.key] !== false,
    }));
    const knownKeys = new Set(knownFeatures.map((feature) => feature.key));
    Object.entries(flags).forEach(([key, value]) => {
      if (!knownKeys.has(key)) {
        rows.push({
          key,
          label: t('settings.featurePlatformManaged'),
          explicit: true,
          enabled: value !== false,
        });
      }
    });
    return rows;
  }, [flags, t]);

  const settingsTabs = useMemo<Array<{ key: SettingsTab; label: string; description: string }>>(() => [
    { key: 'profile', label: t('settings.tabProfile'), description: t('settings.tabProfileDetail') },
    { key: 'branding', label: t('settings.tabBranding'), description: t('settings.tabBrandingDetail') },
    { key: 'policies', label: t('settings.tabPolicies'), description: t('settings.tabPoliciesDetail') },
    { key: 'access', label: t('settings.tabAccess'), description: t('settings.tabAccessDetail') },
    { key: 'platform', label: t('settings.tabPlatform'), description: t('settings.tabPlatformDetail') },
    { key: 'features', label: t('settings.tabFeatures'), description: t('settings.tabFeaturesDetail') },
    ...(canViewTenantActivity ? [{ key: 'activity' as const, label: t('settings.tabActivity'), description: t('settings.tabActivityDetail') }] : []),
  ], [canViewTenantActivity, t]);

  const languageLabel = (locale: SupportedLocale) => {
    const labels: Record<SupportedLocale, string> = {
      en: t('language.en'),
      ky: t('language.ky'),
      ru: t('language.ru'),
    };
    return labels[locale];
  };
  const themeLabel = (value: string) => {
    const labels: Record<string, string> = {
      dark: t('settings.themeDark'),
      light: t('settings.themeLight'),
      system: t('settings.themeSystem'),
    };
    return labels[value] ?? enumLabel(value, {}, t);
  };
  const visibilityLabel = (value: string) => {
    const labels: Record<string, string> = {
      PRIVATE: t('settings.visibilityPrivate'),
      PUBLIC: t('settings.visibilityPublic'),
      TENANT_ONLY: t('settings.visibilityTenantOnly'),
    };
    return labels[value] ?? enumLabel(value, {}, t);
  };
  const booleanLabel = (value: boolean) => (value ? t('overview.enabled') : t('overview.disabled'));
  const roleLabel = (value?: string | null) => {
    const labels: Record<string, string> = {
      admin: t('members.roleAdmin'),
      assistant: t('members.roleAssistant'),
      company_admin: t('members.roleCompanyAdmin'),
      instructor: t('members.roleInstructor'),
      owner: t('members.roleOwner'),
      student: t('members.roleStudent'),
      superadmin: t('members.roleSuperAdmin'),
    };
    return labels[String(value || '').toLowerCase()] ?? enumLabel(value, roleLabelKeys, t);
  };
  const activityActionLabel = (value?: string | null) => {
    const labels: Record<string, string> = {
      create: t('actions.create'),
      delete: t('actions.delete'),
      update: t('actions.update'),
      updated: t('actions.update'),
      certificate: t('navigation.certificates'),
      course: t('navigation.courses'),
      group: t('navigation.groups'),
      member: t('navigation.members'),
      session: t('navigation.sessions'),
      tenant: t('overview.tenantTarget'),
    };
    return labels[String(value || '').toLowerCase()] ?? enumLabel(value, activityActionLabelKeys, t);
  };
  const profileErrorMessage = (message?: string) => {
    if (!message) return '';
    const messages: Record<string, string> = {
      'Tenant name is required.': t('settings.errorTenantNameRequired'),
      'Enter a valid tenant email.': t('settings.errorTenantEmail'),
      'Enter a valid contact email.': t('settings.errorContactEmail'),
      'Use a full URL, for example https://example.com.': t('settings.errorWebsiteUrl'),
      'Select a supported language.': t('settings.errorSupportedLanguage'),
    };
    return messages[message] ?? message;
  };
  const brandingErrorMessage = (message?: string) => {
    if (!message) return '';
    const messages: Record<string, string> = {
      'Use a 6-digit hex color.': t('settings.errorHexColor'),
      'Use a full URL, for example https://example.com/logo.png.': t('settings.errorLogoUrl'),
    };
    return messages[message] ?? message;
  };
  const policyErrorMessage = (message?: string) => {
    if (!message) return '';
    const messages: Record<string, string> = {
      'Enter a valid support email.': t('settings.errorSupportEmail'),
    };
    return messages[message] ?? message;
  };

  const platformManagedItems = useMemo(() => [
    { icon: FiLock, label: t('settings.tenantStatus'), value: activeTenant?.status || t('states.notSet'), detail: t('settings.tenantStatusDetail') },
    { icon: FiCreditCard, label: t('settings.planBilling'), value: activeTenant?.plan || t('states.notSet'), detail: activeTenant?.billingStatus || t('settings.planBillingDetail') },
    { icon: FiGlobe, label: t('settings.domainRouting'), value: activeTenant?.customDomain || activeTenant?.subdomain || t('states.notSet'), detail: t('settings.domainRoutingDetail') },
  ], [activeTenant, t]);

  const enabledFeatureCount = useMemo(
    () => featureRows.filter((feature) => feature.enabled).length,
    [featureRows],
  );
  const brandingPreviewStyle = {
    '--settings-preview-primary': brandingForm.primaryColor || '#122144',
    '--settings-preview-secondary': brandingForm.secondaryColor || '#14b8a6',
    '--settings-preview-accent': brandingForm.accentColor || '#f17e22',
  } as CSSProperties;

  useEffect(() => {
    if (!activeTenant) {
      setProfileForm(emptyProfileForm);
      setBrandingForm(emptyBrandingForm);
      setTenantSettingsForm(emptyTenantSettingsForm);
      return;
    }
    setProfileForm(profileFormFromTenant(activeTenant));
    setBrandingForm(brandingFormFromTenant(activeTenant));
    setTenantSettingsForm(settingsFormFromTenant(activeTenant));
  }, [activeTenant]);

  useEffect(() => {
    if (settingsTab === 'activity' && !canViewTenantActivity) {
      setSettingsTab('profile');
      setActivityRows([]);
      setActivityLoading(false);
      return;
    }
    if (!activeTenant || settingsTab !== 'activity') return;
    let cancelled = false;
    setActivityLoading(true);
    listTenantActivity(activeTenant.id, { limit: 20 })
      .then((rows) => {
        if (!cancelled) setActivityRows(rows);
      })
      .catch(() => {
        if (!cancelled) toast.error(t('settings.activityLoadFailed'));
      })
      .finally(() => {
        if (!cancelled) setActivityLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTenant, canViewTenantActivity, settingsTab, t]);

  const uploadLogo = async (file: File | undefined) => {
    if (!activeTenant || !file) return;

    setUploadingLogo(true);
    try {
      await uploadTenantLogo(activeTenant.id, file);
      await reloadTenants();
      toast.success(t('settings.logoUploaded'));
    } catch {
      toast.error(t('settings.logoUploadFailed'));
    } finally {
      setUploadingLogo(false);
    }
  };

  const cancelProfileEdit = () => {
    setProfileForm(profileFormFromTenant(activeTenant));
    setProfileErrors({});
    setEditingProfile(false);
  };

  const cancelBrandingEdit = () => {
    setBrandingForm(brandingFormFromTenant(activeTenant));
    setBrandingErrors({});
    setEditingBranding(false);
  };

  const cancelPoliciesEdit = () => {
    setTenantSettingsForm(settingsFormFromTenant(activeTenant));
    setPolicyErrors({});
    setEditingPolicies(false);
  };

  const saveTenantProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeTenant) return;
    const nextErrors: Record<string, string> = {};
    if (!profileForm.name.trim()) {
      nextErrors.name = t('settings.errorTenantNameRequired');
    }
    if (profileForm.email.trim() && !isEmail(profileForm.email.trim())) {
      nextErrors.email = t('settings.errorTenantEmail');
    }
    if (profileForm.contactEmail.trim() && !isEmail(profileForm.contactEmail.trim())) {
      nextErrors.contactEmail = t('settings.errorContactEmail');
    }
    if (profileForm.website.trim() && !isHttpUrl(profileForm.website.trim())) {
      nextErrors.website = t('settings.errorWebsiteUrl');
    }
    if (profileForm.locale && !SUPPORTED_LOCALES.includes(profileForm.locale as SupportedLocale)) {
      nextErrors.locale = t('settings.errorSupportedLanguage');
    }
    if (Object.keys(nextErrors).length) {
      setProfileErrors(Object.fromEntries(Object.entries(nextErrors).map(([key, value]) => [key, profileErrorMessage(value)])));
      toast.error(profileErrorMessage(nextErrors.name ?? nextErrors.email ?? nextErrors.contactEmail ?? nextErrors.website ?? nextErrors.locale));
      return;
    }

    setProfileErrors({});
    setSavingProfile(true);
    try {
      await updateTenant(activeTenant.id, {
        name: profileForm.name.trim(),
        timezone: profileForm.timezone.trim() || null,
        locale: profileForm.locale || 'ky',
        website: profileForm.website.trim() || null,
        email: profileForm.email.trim() || null,
        phone: profileForm.phone.trim() || null,
        contactName: profileForm.contactName.trim() || null,
        contactEmail: profileForm.contactEmail.trim() || null,
        contactPhone: profileForm.contactPhone.trim() || null,
        address: profileForm.address.trim() || null,
        city: profileForm.city.trim() || null,
        country: profileForm.country.trim() || null,
        telegram: profileForm.telegram.trim() || null,
        whatsapp: profileForm.whatsapp.trim() || null,
        instagram: profileForm.instagram.trim() || null,
        taxId: profileForm.taxId.trim() || null,
        notes: profileForm.notes.trim() || null,
      });
      await reloadTenants();
      setEditingProfile(false);
      setProfileErrors({});
      toast.success(t('settings.profileSaved'));
    } catch {
      toast.error(t('settings.profileSaveFailed'));
    } finally {
      setSavingProfile(false);
    }
  };

  const saveTenantBranding = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeTenant) return;
    const nextErrors: Record<string, string> = {};
    const hexColorPattern = /^#?[0-9a-fA-F]{6}$/;
    if (brandingForm.primaryColor && !hexColorPattern.test(brandingForm.primaryColor)) {
      nextErrors.primaryColor = t('settings.errorHexColor');
    }
    if (brandingForm.secondaryColor && !hexColorPattern.test(brandingForm.secondaryColor)) {
      nextErrors.secondaryColor = t('settings.errorHexColor');
    }
    if (brandingForm.accentColor && !hexColorPattern.test(brandingForm.accentColor)) {
      nextErrors.accentColor = t('settings.errorHexColor');
    }
    if (brandingForm.certificateLogoUrl.trim() && !isHttpUrl(brandingForm.certificateLogoUrl.trim())) {
      nextErrors.certificateLogoUrl = t('settings.errorLogoUrl');
    }
    if (Object.keys(nextErrors).length) {
      setBrandingErrors(Object.fromEntries(Object.entries(nextErrors).map(([key, value]) => [key, brandingErrorMessage(value)])));
      toast.error(brandingErrorMessage(nextErrors.primaryColor ?? nextErrors.secondaryColor ?? nextErrors.accentColor ?? nextErrors.certificateLogoUrl));
      return;
    }

    setBrandingErrors({});
    setSavingBranding(true);
    try {
      await updateTenantBranding(activeTenant.id, {
        displayName: brandingForm.displayName.trim() || null,
        certificateLogoUrl: brandingForm.certificateLogoUrl.trim() || null,
        primaryColor: brandingForm.primaryColor.trim() || null,
        secondaryColor: brandingForm.secondaryColor.trim() || null,
        accentColor: brandingForm.accentColor.trim() || null,
      });
      await reloadTenants();
      setEditingBranding(false);
      toast.success(t('settings.brandingSaved'));
    } catch {
      toast.error(t('settings.brandingSaveFailed'));
    } finally {
      setSavingBranding(false);
    }
  };

  const saveTenantPolicies = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeTenant) return;
    const nextErrors: Record<string, string> = {};
    if (tenantSettingsForm.supportEmail.trim() && !isEmail(tenantSettingsForm.supportEmail.trim())) {
      nextErrors.supportEmail = t('settings.errorSupportEmail');
    }
    if (Object.keys(nextErrors).length) {
      setPolicyErrors(Object.fromEntries(Object.entries(nextErrors).map(([key, value]) => [key, policyErrorMessage(value)])));
      toast.error(policyErrorMessage(nextErrors.supportEmail));
      return;
    }

    setPolicyErrors({});
    setSavingPolicies(true);
    try {
      await updateTenantSettings(activeTenant.id, {
        supportEmail: tenantSettingsForm.supportEmail.trim() || null,
        defaultCourseVisibility: tenantSettingsForm.defaultCourseVisibility,
        allowSelfEnrollment: tenantSettingsForm.allowSelfEnrollment,
        requireEnrollmentApproval: tenantSettingsForm.requireEnrollmentApproval,
      });
      await reloadTenants();
      setEditingPolicies(false);
      toast.success(t('settings.policiesSaved'));
    } catch {
      toast.error(t('settings.policiesSaveFailed'));
    } finally {
      setSavingPolicies(false);
    }
  };

  return (
    <>
      <PageHeader
        title={t('navigation.settings')}
        eyebrow={activeTenant?.name}
        actions={<button type="button" className="secondary-button" onClick={() => void reloadTenants()}>{t('settings.refreshTenant')}</button>}
      />

      <WorkspaceTabs
        tabs={settingsTabs}
        activeTab={settingsTab}
        onChange={setSettingsTab}
        ariaLabel={t('settings.workspace')}
        className="settings-workspace-tabs"
      />

      {settingsTab === 'access' ? (
      <div className="settings-grid">
        <section className="settings-panel">
          <div className="settings-panel-heading">
            <FiSliders />
            <div>
              <h2>{t('settings.appearance')}</h2>
              <span>{t('settings.appearanceDetail')}</span>
            </div>
          </div>
          <div className="theme-settings-row">
            <div>
              <span>{t('settings.theme')}</span>
              <strong>{preference === 'system' ? t('settings.themeSystemResolved', { theme: themeLabel(resolvedTheme) }) : themeLabel(preference)}</strong>
            </div>
            <div className="segmented-control" aria-label={t('settings.themePreference')}>
              {(['system', 'light', 'dark'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  className={preference === option ? 'active' : ''}
                  onClick={() => setPreference(option)}
                >
                  {themeLabel(option)}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="settings-panel">
          <div className="settings-panel-heading">
            <FiUserCheck />
            <div>
              <h2>{t('settings.yourAccess')}</h2>
              <span>{t('settings.yourAccessDetail')}</span>
            </div>
          </div>
          <div className="definition-grid">
            <span>{t('groups.name')}</span><strong>{readable(user?.fullName)}</strong>
            <span>{t('groups.email')}</span><strong>{readable(user?.email)}</strong>
            <span>{t('settings.tenantRole')}</span><strong>{roleLabel(tenantRole)}</strong>
            <span>{t('settings.platformRole')}</span><strong>{roleLabel(user?.role)}</strong>
            <span>{t('settings.tenants')}</span><strong>{tenants.length}</strong>
          </div>
        </section>
      </div>
      ) : null}

      {settingsTab === 'platform' ? (
      <section className="settings-panel full platform-managed-panel">
        <div className="section-heading-row">
          <div>
            <h2>{t('settings.platformControls')}</h2>
            <span>{t('settings.platformControlsDetail')}</span>
          </div>
          <span className="status-badge role-owner">{t('members.readOnly')}</span>
        </div>
        <div className="platform-managed-grid">
          {platformManagedItems.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.label}>
                <Icon />
                <div>
                  <span>{item.label}</span>
                  <strong>{readable(item.value)}</strong>
                  <small>{item.detail}</small>
                </div>
              </article>
            );
          })}
        </div>
      </section>
      ) : null}

      {settingsTab === 'profile' ? (
      <form className="settings-panel full" onSubmit={saveTenantProfile}>
        <div className="section-heading-row">
          <div>
            <h2>{t('settings.tenantProfile')}</h2>
            <span>{t('settings.tenantProfileDetail')}</span>
          </div>
          <div className="profile-actions">
            {canEditTenantProfile && editingProfile ? (
              <>
                <button type="button" className="secondary-button" onClick={cancelProfileEdit} disabled={savingProfile}>{t('courses.cancel')}</button>
                <button type="submit" disabled={savingProfile}>{savingProfile ? t('courses.saving') : t('settings.saveProfile')}</button>
              </>
            ) : canEditTenantProfile ? (
              <button type="button" onClick={() => setEditingProfile(true)}>{t('settings.editProfile')}</button>
            ) : null}
          </div>
        </div>
        <div className="tenant-logo-row">
          <div className="logo-preview">
            {activeTenant?.logoUrl ? <img src={activeTenant.logoUrl} alt="" /> : <span>{t('settings.noLogoUploaded')}</span>}
          </div>
          <div>
            <strong>{t('settings.tenantLogo')}</strong>
            <span>{t('settings.tenantLogoDetail')}</span>
            {canEditTenantProfile && editingProfile ? (
              <label className="file-button">
                {uploadingLogo ? t('settings.uploading') : t('settings.uploadLogo')}
                <input
                  type="file"
                  accept="image/*"
                  disabled={uploadingLogo}
                  onChange={(event) => void uploadLogo(event.target.files?.[0])}
                />
              </label>
            ) : null}
          </div>
        </div>
        {canEditTenantProfile && editingProfile ? (
          <>
            <div className="settings-grid embedded">
              <section className="form-section">
                <h3>{t('settings.workspaceIdentity')}</h3>
                <div className="two-col">
                <label>
                  {t('groups.name')}
                  <input
                    value={profileForm.name}
                    onChange={(event) => {
                      setProfileForm((current) => ({ ...current, name: event.target.value }));
                      setProfileErrors((current) => ({ ...current, name: '' }));
                    }}
                    className={profileErrors.name ? 'input-error' : ''}
                    aria-invalid={!!profileErrors.name}
                  />
                  {profileErrors.name ? <span className="field-error">{profileErrors.name}</span> : null}
                </label>
                <label>{t('groups.timezone')}<input value={profileForm.timezone} onChange={(event) => setProfileForm((current) => ({ ...current, timezone: event.target.value }))} placeholder="Asia/Bishkek" /></label>
                <label>
                  {t('settings.locale')}
                  <select
                    value={SUPPORTED_LOCALES.includes(profileForm.locale as SupportedLocale) ? profileForm.locale : 'ky'}
                    onChange={(event) => {
                      setProfileForm((current) => ({ ...current, locale: event.target.value }));
                      setProfileErrors((current) => ({ ...current, locale: '' }));
                    }}
                    className={profileErrors.locale ? 'input-error' : ''}
                    aria-invalid={!!profileErrors.locale}
                  >
                    {SUPPORTED_LOCALES.map((locale) => (
                      <option key={locale} value={locale}>{languageLabel(locale)}</option>
                    ))}
                  </select>
                  <span className="field-hint">{t('language.tenantDefaultHint')}</span>
                  {profileErrors.locale ? <span className="field-error">{profileErrors.locale}</span> : null}
                </label>
                <label>
                  {t('settings.website')}
                  <input
                    value={profileForm.website}
                    onChange={(event) => {
                      setProfileForm((current) => ({ ...current, website: event.target.value }));
                      setProfileErrors((current) => ({ ...current, website: '' }));
                    }}
                    className={profileErrors.website ? 'input-error' : ''}
                    aria-invalid={!!profileErrors.website}
                  />
                  {profileErrors.website ? <span className="field-error">{profileErrors.website}</span> : null}
                </label>
                <label>
                  {t('groups.email')}
                  <input
                    type="email"
                    value={profileForm.email}
                    onChange={(event) => {
                      setProfileForm((current) => ({ ...current, email: event.target.value }));
                      setProfileErrors((current) => ({ ...current, email: '' }));
                    }}
                    className={profileErrors.email ? 'input-error' : ''}
                    aria-invalid={!!profileErrors.email}
                  />
                  {profileErrors.email ? <span className="field-error">{profileErrors.email}</span> : null}
                </label>
                <label>{t('settings.phone')}<input value={profileForm.phone} onChange={(event) => setProfileForm((current) => ({ ...current, phone: event.target.value }))} /></label>
                </div>
              </section>
              <section className="form-section">
                <h3>{t('settings.primaryContact')}</h3>
                <div className="two-col">
                <label>{t('settings.contactName')}<input value={profileForm.contactName} onChange={(event) => setProfileForm((current) => ({ ...current, contactName: event.target.value }))} /></label>
                <label>
                  {t('settings.contactEmail')}
                  <input
                    type="email"
                    value={profileForm.contactEmail}
                    onChange={(event) => {
                      setProfileForm((current) => ({ ...current, contactEmail: event.target.value }));
                      setProfileErrors((current) => ({ ...current, contactEmail: '' }));
                    }}
                    className={profileErrors.contactEmail ? 'input-error' : ''}
                    aria-invalid={!!profileErrors.contactEmail}
                  />
                  {profileErrors.contactEmail ? <span className="field-error">{profileErrors.contactEmail}</span> : null}
                </label>
                <label>{t('settings.contactPhone')}<input value={profileForm.contactPhone} onChange={(event) => setProfileForm((current) => ({ ...current, contactPhone: event.target.value }))} /></label>
                </div>
              </section>
              <section className="form-section">
                <h3>{t('settings.locationLegal')}</h3>
                <div className="two-col">
                <label>{t('settings.city')}<input value={profileForm.city} onChange={(event) => setProfileForm((current) => ({ ...current, city: event.target.value }))} /></label>
                <label>{t('settings.country')}<input value={profileForm.country} onChange={(event) => setProfileForm((current) => ({ ...current, country: event.target.value }))} /></label>
                <label>{t('settings.address')}<input value={profileForm.address} onChange={(event) => setProfileForm((current) => ({ ...current, address: event.target.value }))} /></label>
                <label>{t('settings.taxId')}<input value={profileForm.taxId} onChange={(event) => setProfileForm((current) => ({ ...current, taxId: event.target.value }))} /></label>
                </div>
              </section>
              <section className="form-section">
                <h3>{t('settings.socialNotes')}</h3>
                <div className="two-col">
                <label>Telegram<input value={profileForm.telegram} onChange={(event) => setProfileForm((current) => ({ ...current, telegram: event.target.value }))} /></label>
                <label>WhatsApp<input value={profileForm.whatsapp} onChange={(event) => setProfileForm((current) => ({ ...current, whatsapp: event.target.value }))} /></label>
                <label>Instagram<input value={profileForm.instagram} onChange={(event) => setProfileForm((current) => ({ ...current, instagram: event.target.value }))} /></label>
                <label className="wide-field">{t('sessions.notes')}<textarea value={profileForm.notes} onChange={(event) => setProfileForm((current) => ({ ...current, notes: event.target.value }))} rows={4} /></label>
                </div>
              </section>
            </div>
          </>
        ) : (
          <div className="settings-grid embedded">
            <div className="definition-grid">
              <span>{t('groups.name')}</span><strong>{readable(activeTenant?.name)}</strong>
              <span>{t('settings.website')}</span><strong>{readable(activeTenant?.website)}</strong>
              <span>{t('groups.email')}</span><strong>{readable(activeTenant?.email)}</strong>
              <span>{t('settings.phone')}</span><strong>{readable(activeTenant?.phone)}</strong>
              <span>{t('settings.taxId')}</span><strong>{readable(activeTenant?.taxId)}</strong>
            </div>
            <div className="definition-grid">
              <span>{t('groups.timezone')}</span><strong>{readable(activeTenant?.timezone)}</strong>
              <span>{t('settings.locale')}</span><strong>{readable(activeTenant?.locale)}</strong>
              <span>{t('settings.contact')}</span><strong>{readable(activeTenant?.contactName)}</strong>
              <span>{t('settings.contactEmail')}</span><strong>{readable(activeTenant?.contactEmail)}</strong>
              <span>{t('settings.location')}</span><strong>{readable([activeTenant?.city, activeTenant?.country].filter(Boolean).join(', '))}</strong>
              <span>{t('sessions.notes')}</span><strong>{readable(activeTenant?.notes)}</strong>
            </div>
          </div>
        )}
        <p className="panel-note">
          {canEditTenantProfile
            ? t('settings.profileEditNote')
            : t('settings.profileReadOnlyNote')}
        </p>
      </form>
      ) : null}

      {settingsTab === 'branding' ? (
      <form className="settings-panel full" onSubmit={saveTenantBranding}>
        <div className="section-heading-row">
          <div>
            <h2>{t('settings.tenantBranding')}</h2>
            <span>{t('settings.tenantBrandingDetail')}</span>
          </div>
          <div className="profile-actions">
            {canEditTenantProfile && editingBranding ? (
              <>
                <button type="button" className="secondary-button" onClick={cancelBrandingEdit} disabled={savingBranding}>{t('courses.cancel')}</button>
                <button type="submit" disabled={savingBranding}>{savingBranding ? t('courses.saving') : t('settings.saveBranding')}</button>
              </>
            ) : canEditTenantProfile ? (
              <button type="button" onClick={() => setEditingBranding(true)}>{t('settings.editBranding')}</button>
            ) : null}
          </div>
        </div>
        {editingBranding && canEditTenantProfile ? (
          <div className="settings-grid embedded">
            <section className="form-section">
            <div className="two-col">
              <label>{t('settings.displayName')}<input value={brandingForm.displayName} onChange={(event) => setBrandingForm((current) => ({ ...current, displayName: event.target.value }))} placeholder={activeTenant?.name ?? t('settings.tenantNamePlaceholder')} /></label>
              <label>
                {t('settings.certificateLogoUrl')}
                <input
                  value={brandingForm.certificateLogoUrl}
                  onChange={(event) => {
                    setBrandingForm((current) => ({ ...current, certificateLogoUrl: event.target.value }));
                    setBrandingErrors((current) => ({ ...current, certificateLogoUrl: '' }));
                  }}
                  className={brandingErrors.certificateLogoUrl ? 'input-error' : ''}
                  aria-invalid={!!brandingErrors.certificateLogoUrl}
                  placeholder="https://example.com/logo.png"
                />
                {brandingErrors.certificateLogoUrl ? <span className="field-error">{brandingErrors.certificateLogoUrl}</span> : null}
              </label>
            </div>
            <p className="panel-note">{t('settings.logoCertificateNote')}</p>
            </section>
            <section className="form-section">
              <h3>{t('settings.colorSystem')}</h3>
            <div className="three-col">
              {([
                ['primaryColor', t('settings.primaryColor')],
                ['secondaryColor', t('settings.secondaryColor')],
                ['accentColor', t('settings.accentColor')],
              ] as const).map(([field, label]) => (
                <label key={field}>
                  {label}
                  <span className="color-input-row">
                    <input type="color" value={brandingForm[field] || '#122144'} onChange={(event) => setBrandingForm((current) => ({ ...current, [field]: event.target.value }))} />
                    <input
                      value={brandingForm[field]}
                      onChange={(event) => {
                        setBrandingForm((current) => ({ ...current, [field]: event.target.value }));
                        setBrandingErrors((current) => ({ ...current, [field]: '' }));
                      }}
                      className={brandingErrors[field] ? 'input-error' : ''}
                      aria-invalid={!!brandingErrors[field]}
                      placeholder="#122144"
                    />
                  </span>
                  {brandingErrors[field] ? <span className="field-error">{brandingErrors[field]}</span> : null}
                </label>
              ))}
            </div>
            </section>
          </div>
        ) : (
          <div className="settings-grid embedded">
            <div className="definition-grid">
              <span>{t('settings.displayName')}</span><strong>{readable(recordText(activeTenant?.branding, 'displayName'))}</strong>
              <span>{t('settings.certificateLogoUrl')}</span><strong>{readable(recordText(activeTenant?.branding, 'certificateLogoUrl'))}</strong>
            </div>
            <div className="definition-grid">
              <span>{t('settings.primaryColor')}</span><strong>{readable(recordText(activeTenant?.branding, 'primaryColor'))}</strong>
              <span>{t('settings.secondaryColor')}</span><strong>{readable(recordText(activeTenant?.branding, 'secondaryColor'))}</strong>
              <span>{t('settings.accentColor')}</span><strong>{readable(recordText(activeTenant?.branding, 'accentColor'))}</strong>
            </div>
          </div>
        )}
        <section className="settings-brand-preview" style={brandingPreviewStyle}>
          <div className="settings-brand-preview-header">
            <div className="settings-brand-mark">
              {activeTenant?.logoUrl ? <img src={activeTenant.logoUrl} alt="" /> : (brandingForm.displayName || activeTenant?.name || t('settings.tenantFallbackInitial')).slice(0, 1)}
            </div>
            <div>
              <strong>{brandingForm.displayName || recordText(activeTenant?.branding, 'displayName') || activeTenant?.name || t('settings.tenantFallback')}</strong>
              <span>{t('settings.uiPreview')}</span>
            </div>
          </div>
          <div className="settings-brand-preview-body">
            <span>{t('settings.primaryAction')}</span>
            <button type="button">{t('student.continueLearning')}</button>
          </div>
        </section>
      </form>
      ) : null}

      {settingsTab === 'policies' ? (
      <form className="settings-panel full" onSubmit={saveTenantPolicies}>
        <div className="section-heading-row">
          <div>
            <h2>{t('settings.tenantPolicies')}</h2>
            <span>{t('settings.tenantPoliciesDetail')}</span>
          </div>
          <div className="profile-actions">
            {canEditTenantProfile && editingPolicies ? (
              <>
                <button type="button" className="secondary-button" onClick={cancelPoliciesEdit} disabled={savingPolicies}>{t('courses.cancel')}</button>
                <button type="submit" disabled={savingPolicies}>{savingPolicies ? t('courses.saving') : t('settings.savePolicies')}</button>
              </>
            ) : canEditTenantProfile ? (
              <button type="button" onClick={() => setEditingPolicies(true)}>{t('settings.editPolicies')}</button>
            ) : null}
          </div>
        </div>
        {editingPolicies && canEditTenantProfile ? (
          <div className="settings-grid embedded">
            <div className="two-col">
              <label>
                {t('settings.supportEmail')}
                <input
                  type="email"
                  value={tenantSettingsForm.supportEmail}
                  onChange={(event) => {
                    setTenantSettingsForm((current) => ({ ...current, supportEmail: event.target.value }));
                    setPolicyErrors((current) => ({ ...current, supportEmail: '' }));
                  }}
                  className={policyErrors.supportEmail ? 'input-error' : ''}
                  aria-invalid={!!policyErrors.supportEmail}
                />
                {policyErrors.supportEmail ? <span className="field-error">{policyErrors.supportEmail}</span> : null}
              </label>
              <label>
                {t('settings.defaultCourseVisibility')}
                <select value={tenantSettingsForm.defaultCourseVisibility} onChange={(event) => setTenantSettingsForm((current) => ({ ...current, defaultCourseVisibility: event.target.value as typeof tenantSettingsForm.defaultCourseVisibility }))}>
                  <option value="PUBLIC">{t('settings.visibilityPublic')}</option>
                  <option value="PRIVATE">{t('settings.visibilityPrivate')}</option>
                  <option value="TENANT_ONLY">{t('settings.visibilityTenantOnly')}</option>
                </select>
              </label>
            </div>
            <div className="two-col">
              <label className="checkbox-row">
                <input type="checkbox" checked={tenantSettingsForm.allowSelfEnrollment} onChange={(event) => setTenantSettingsForm((current) => ({ ...current, allowSelfEnrollment: event.target.checked }))} />
                <span>
                  <strong>{t('settings.allowSelfEnrollment')}</strong>
                  <small>{t('settings.allowSelfEnrollmentDetail')}</small>
                </span>
              </label>
              <label className="checkbox-row">
                <input type="checkbox" checked={tenantSettingsForm.requireEnrollmentApproval} onChange={(event) => setTenantSettingsForm((current) => ({ ...current, requireEnrollmentApproval: event.target.checked }))} />
                <span>
                  <strong>{t('settings.requireEnrollmentApproval')}</strong>
                  <small>{t('settings.requireEnrollmentApprovalDetail')}</small>
                </span>
              </label>
            </div>
          </div>
        ) : (
          <div className="definition-grid">
            <span>{t('settings.supportEmail')}</span><strong>{readable(recordText(activeTenant?.settings, 'supportEmail'))}</strong>
            <span>{t('settings.defaultCourseVisibility')}</span><strong>{visibilityLabel(recordText(activeTenant?.settings, 'defaultCourseVisibility') ?? '')}</strong>
            <span>{t('settings.allowSelfEnrollment')}</span><strong>{booleanLabel(recordBoolean(activeTenant?.settings, 'allowSelfEnrollment'))}</strong>
            <span>{t('settings.requireEnrollmentApproval')}</span><strong>{booleanLabel(recordBoolean(activeTenant?.settings, 'requireEnrollmentApproval'))}</strong>
          </div>
        )}
      </form>
      ) : null}

      {settingsTab === 'features' ? (
      <section className="settings-panel full">
        <div className="section-heading-row">
          <div>
            <h2>{t('settings.featureVisibility')}</h2>
            <span>{t('settings.enabledToolsCount', { count: enabledFeatureCount })}</span>
          </div>
          <span className="status-badge role-owner">{t('members.platformManaged')}</span>
        </div>
        <div className="flag-grid settings-status-grid">
          {featureRows.map((feature) => (
            <div key={feature.key} className="flag-row">
              <div>
                <span>{feature.label}</span>
                <small>{feature.explicit ? feature.key : t('settings.featureDefault', { key: feature.key })}</small>
              </div>
              <strong className={`status-badge ${feature.enabled ? 'published' : 'destructive'}`}>
                {booleanLabel(feature.enabled)}
              </strong>
            </div>
          ))}
        </div>
        <p className="panel-note">{t('settings.featureDefaultNote')}</p>
      </section>
      ) : null}

      {settingsTab === 'activity' && canViewTenantActivity ? (
      <section className="settings-panel full">
        <div className="section-heading-row">
          <div>
            <h2>{t('settings.activity')}</h2>
            <span>{t('settings.activityDetail')}</span>
          </div>
          <FiActivity />
        </div>
        {activityLoading ? <LoadingState label={t('settings.loadingActivity')} /> : null}
        {!activityLoading ? (
          <div className="stack-list">
            {activityRows.map((row) => (
              <article key={row.id} className="stack-list-item">
                <div>
                  <strong>{activityActionLabel(row.action)}</strong>
                  <span>{row.actorFullName || row.actorEmail || t('overview.system')} · {formatDate(row.createdAt)}</span>
                </div>
                <span className="muted-text">{activityDetail(row, t('settings.tenantWorkspace'), (count) => t('settings.detailCountUpdated', { count }), activityActionLabel)}</span>
              </article>
            ))}
            {!activityRows.length ? (
              <EmptyState
                title={t('overview.activityEmptyTitle')}
                detail={t('overview.activityEmptyDetail')}
              />
            ) : null}
          </div>
        ) : null}
      </section>
      ) : null}
    </>
  );
}
