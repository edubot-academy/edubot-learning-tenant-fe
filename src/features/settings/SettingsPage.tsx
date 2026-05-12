import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FiActivity, FiCreditCard, FiGlobe, FiLock, FiSliders, FiUserCheck } from 'react-icons/fi';
import { PageHeader } from '../../components/PageHeader';
import { WorkspaceTabs } from '../../components/WorkspaceTabs';
import { readable } from '../../lib/format';
import { useTenant } from '../tenant/TenantProvider';
import { useTheme } from '../theme/themeContext';
import { useAuth } from '../auth/AuthProvider';
import { listTenantActivity, updateTenant, updateTenantBranding, updateTenantSettings, uploadTenantLogo } from '../../services/api';
import { canManageTenantProfile, getEffectiveTenantRole } from '../tenant/tenantRoles';
import type { TenantActivityLog } from '../../types/domain';

const knownFeatures = [
  { key: 'courses.video.enabled', label: 'Video courses' },
  { key: 'courses.offline.enabled', label: 'Offline courses' },
  { key: 'courses.onlineLive.enabled', label: 'Online live courses' },
  { key: 'attendance.enabled', label: 'Attendance' },
  { key: 'homework.enabled', label: 'Homework' },
  { key: 'certificates.enabled', label: 'Certificates' },
  { key: 'crmSync.enabled', label: 'CRM sync' },
  { key: 'aiAssistant.enabled', label: 'AI assistant' },
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

function recordText(record: Record<string, unknown> | null | undefined, key: string) {
  const value = record?.[key];
  return typeof value === 'string' ? value : null;
}

function recordBoolean(record: Record<string, unknown> | null | undefined, key: string) {
  return record?.[key] === true;
}

type SettingsTab = 'profile' | 'branding' | 'policies' | 'access' | 'platform' | 'features' | 'activity';

const settingsTabs: Array<{ key: SettingsTab; label: string; description: string }> = [
  { key: 'profile', label: 'Profile', description: 'Tenant-facing brand, contact, and local profile details.' },
  { key: 'branding', label: 'Branding', description: 'Tenant colors used by tenant screens and certificate defaults.' },
  { key: 'policies', label: 'Policies', description: 'Tenant-scoped enrollment and support defaults.' },
  { key: 'access', label: 'Access', description: 'Your account context and personal display preference.' },
  { key: 'platform', label: 'Platform', description: 'Read-only status, billing, and domain controls.' },
  { key: 'features', label: 'Features', description: 'Tools visible for this tenant workspace.' },
  { key: 'activity', label: 'Activity', description: 'Recent tenant changes and audit history.' },
];

export function SettingsPage() {
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
  const [activityRows, setActivityRows] = useState<TenantActivityLog[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const flags = useMemo(() => activeTenant?.featureFlags ?? {}, [activeTenant?.featureFlags]);
  const tenantRole = getEffectiveTenantRole(user, activeTenant);
  const canEditTenantProfile = canManageTenantProfile(user, activeTenant);

  const featureRows = useMemo(() => {
    const rows = knownFeatures.map((feature) => ({
      ...feature,
      explicit: Object.prototype.hasOwnProperty.call(flags, feature.key),
      enabled: flags[feature.key] !== false,
    }));
    const knownKeys = new Set(knownFeatures.map((feature) => feature.key));
    Object.entries(flags).forEach(([key, value]) => {
      if (!knownKeys.has(key)) {
        rows.push({
          key,
          label: readable(key),
          explicit: true,
          enabled: value !== false,
        });
      }
    });
    return rows;
  }, [flags]);

  const platformManagedItems = useMemo(() => [
    { icon: FiLock, label: 'Tenant status', value: activeTenant?.status || 'Not set', detail: 'Activation and suspension are controlled by platform management.' },
    { icon: FiCreditCard, label: 'Plan and billing', value: activeTenant?.plan || 'Not set', detail: activeTenant?.billingStatus || 'Billing status is managed by platform.' },
    { icon: FiGlobe, label: 'Domain routing', value: activeTenant?.customDomain || activeTenant?.subdomain || 'Not set', detail: 'Domain, subdomain, and routing changes stay in platform management.' },
  ], [activeTenant]);

  const enabledFeatureCount = useMemo(
    () => featureRows.filter((feature) => feature.enabled).length,
    [featureRows],
  );

  useEffect(() => {
    if (!activeTenant) {
      setProfileForm(emptyProfileForm);
      setBrandingForm(emptyBrandingForm);
      setTenantSettingsForm(emptyTenantSettingsForm);
      return;
    }
    const branding = activeTenant.branding ?? {};
    const settings = activeTenant.settings ?? {};

    setProfileForm({
      name: activeTenant.name ?? '',
      timezone: activeTenant.timezone ?? '',
      locale: activeTenant.locale ?? '',
      website: activeTenant.website ?? '',
      email: activeTenant.email ?? '',
      phone: activeTenant.phone ?? '',
      contactName: activeTenant.contactName ?? '',
      contactEmail: activeTenant.contactEmail ?? '',
      contactPhone: activeTenant.contactPhone ?? '',
      address: activeTenant.address ?? '',
      city: activeTenant.city ?? '',
      country: activeTenant.country ?? '',
      telegram: activeTenant.telegram ?? '',
      whatsapp: activeTenant.whatsapp ?? '',
      instagram: activeTenant.instagram ?? '',
      taxId: activeTenant.taxId ?? '',
      notes: activeTenant.notes ?? '',
    });
    setBrandingForm({
      displayName: typeof branding.displayName === 'string' ? branding.displayName : '',
      certificateLogoUrl: typeof branding.certificateLogoUrl === 'string' ? branding.certificateLogoUrl : '',
      primaryColor: typeof branding.primaryColor === 'string' ? branding.primaryColor : '#122144',
      secondaryColor: typeof branding.secondaryColor === 'string' ? branding.secondaryColor : '#14b8a6',
      accentColor: typeof branding.accentColor === 'string' ? branding.accentColor : '#f17e22',
    });
    setTenantSettingsForm({
      supportEmail: typeof settings.supportEmail === 'string' ? settings.supportEmail : '',
      defaultCourseVisibility:
        settings.defaultCourseVisibility === 'PUBLIC' || settings.defaultCourseVisibility === 'TENANT_ONLY'
          ? settings.defaultCourseVisibility
          : 'PRIVATE',
      allowSelfEnrollment: settings.allowSelfEnrollment === true,
      requireEnrollmentApproval: settings.requireEnrollmentApproval === true,
    });
  }, [activeTenant]);

  useEffect(() => {
    if (!activeTenant || settingsTab !== 'activity') return;
    let cancelled = false;
    setActivityLoading(true);
    listTenantActivity(activeTenant.id, { limit: 20 })
      .then((rows) => {
        if (!cancelled) setActivityRows(rows);
      })
      .catch(() => {
        if (!cancelled) toast.error('Could not load tenant activity');
      })
      .finally(() => {
        if (!cancelled) setActivityLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTenant, settingsTab]);

  const uploadLogo = async (file: File | undefined) => {
    if (!activeTenant || !file) return;

    setUploadingLogo(true);
    try {
      await uploadTenantLogo(activeTenant.id, file);
      await reloadTenants();
      toast.success('Tenant logo uploaded');
    } catch {
      toast.error('Could not upload tenant logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const saveTenantProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeTenant) return;
    const nextErrors: Record<string, string> = {};
    if (!profileForm.name.trim()) {
      nextErrors.name = 'Tenant name is required.';
    }
    if (profileForm.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileForm.email.trim())) {
      nextErrors.email = 'Enter a valid tenant email.';
    }
    if (profileForm.contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileForm.contactEmail.trim())) {
      nextErrors.contactEmail = 'Enter a valid contact email.';
    }
    if (profileForm.website.trim() && !isHttpUrl(profileForm.website.trim())) {
      nextErrors.website = 'Use a full URL, for example https://example.com.';
    }
    if (Object.keys(nextErrors).length) {
      setProfileErrors(nextErrors);
      toast.error(nextErrors.name ?? nextErrors.email ?? nextErrors.contactEmail ?? nextErrors.website);
      return;
    }

    setProfileErrors({});
    setSavingProfile(true);
    try {
      await updateTenant(activeTenant.id, {
        name: profileForm.name.trim(),
        timezone: profileForm.timezone.trim() || null,
        locale: profileForm.locale.trim() || null,
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
      toast.success('Tenant profile saved');
    } catch {
      toast.error('Could not save tenant profile');
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
      nextErrors.primaryColor = 'Use a 6-digit hex color.';
    }
    if (brandingForm.secondaryColor && !hexColorPattern.test(brandingForm.secondaryColor)) {
      nextErrors.secondaryColor = 'Use a 6-digit hex color.';
    }
    if (brandingForm.accentColor && !hexColorPattern.test(brandingForm.accentColor)) {
      nextErrors.accentColor = 'Use a 6-digit hex color.';
    }
    if (brandingForm.certificateLogoUrl.trim() && !isHttpUrl(brandingForm.certificateLogoUrl.trim())) {
      nextErrors.certificateLogoUrl = 'Use a full URL, for example https://example.com/logo.png.';
    }
    if (Object.keys(nextErrors).length) {
      setBrandingErrors(nextErrors);
      toast.error(nextErrors.primaryColor ?? nextErrors.secondaryColor ?? nextErrors.accentColor ?? nextErrors.certificateLogoUrl);
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
      toast.success('Tenant branding saved');
    } catch {
      toast.error('Could not save tenant branding');
    } finally {
      setSavingBranding(false);
    }
  };

  const saveTenantPolicies = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeTenant) return;
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
      toast.success('Tenant policies saved');
    } catch {
      toast.error('Could not save tenant policies');
    } finally {
      setSavingPolicies(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Settings"
        eyebrow={activeTenant?.name}
        actions={<button type="button" className="secondary-button" onClick={() => void reloadTenants()}>Refresh tenant</button>}
      />

      <WorkspaceTabs
        tabs={settingsTabs}
        activeTab={settingsTab}
        onChange={setSettingsTab}
        ariaLabel="Settings workspace"
        className="settings-workspace-tabs"
      />

      {settingsTab === 'access' ? (
      <div className="settings-grid">
        <section className="settings-panel">
          <div className="settings-panel-heading">
            <FiSliders />
            <div>
              <h2>Appearance</h2>
              <span>Personal display preference for this browser.</span>
            </div>
          </div>
          <div className="theme-settings-row">
            <div>
              <span>Theme</span>
              <strong>{preference === 'system' ? `System (${resolvedTheme})` : readable(preference)}</strong>
            </div>
            <div className="segmented-control" aria-label="Theme preference">
              {(['system', 'light', 'dark'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  className={preference === option ? 'active' : ''}
                  onClick={() => setPreference(option)}
                >
                  {readable(option)}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="settings-panel">
          <div className="settings-panel-heading">
            <FiUserCheck />
            <div>
              <h2>Your access</h2>
              <span>Your platform account and tenant assignments.</span>
            </div>
          </div>
          <div className="definition-grid">
            <span>Name</span><strong>{readable(user?.fullName)}</strong>
            <span>Email</span><strong>{readable(user?.email)}</strong>
            <span>Tenant role</span><strong>{readable(tenantRole)}</strong>
            <span>Platform role</span><strong>{readable(user?.role)}</strong>
            <span>Tenants</span><strong>{tenants.length}</strong>
          </div>
        </section>
      </div>
      ) : null}

      {settingsTab === 'platform' ? (
      <section className="settings-panel full platform-managed-panel">
        <div className="section-heading-row">
          <div>
            <h2>Platform-managed tenant controls</h2>
            <span>These values are shown here for context and changed in platform management.</span>
          </div>
          <span className="status-badge role-owner">Read only</span>
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
            <h2>Tenant profile</h2>
            <span>Tenant-managed brand, contact, and local profile fields</span>
          </div>
          <div className="profile-actions">
            {canEditTenantProfile && editingProfile ? (
              <>
                <button type="button" className="secondary-button" onClick={() => setEditingProfile(false)} disabled={savingProfile}>Cancel</button>
                <button type="submit" disabled={savingProfile}>{savingProfile ? 'Saving...' : 'Save profile'}</button>
              </>
            ) : canEditTenantProfile ? (
              <button type="button" onClick={() => setEditingProfile(true)}>Edit profile</button>
            ) : null}
          </div>
        </div>
        <div className="tenant-logo-row">
          <div className="logo-preview">
            {activeTenant?.logoUrl ? <img src={activeTenant.logoUrl} alt="" /> : <span>No logo uploaded</span>}
          </div>
          <div>
            <strong>Tenant logo</strong>
            <span>Used as the default brand mark for tenant certificates and tenant-facing screens.</span>
            {canEditTenantProfile && editingProfile ? (
              <label className="file-button">
                {uploadingLogo ? 'Uploading...' : 'Upload logo'}
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
              <div className="two-col">
                <label>
                  Name
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
                <label>Timezone<input value={profileForm.timezone} onChange={(event) => setProfileForm((current) => ({ ...current, timezone: event.target.value }))} placeholder="Asia/Bishkek" /></label>
                <label>Locale<input value={profileForm.locale} onChange={(event) => setProfileForm((current) => ({ ...current, locale: event.target.value }))} placeholder="ky" /></label>
                <label>
                  Website
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
                  Email
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
                <label>Phone<input value={profileForm.phone} onChange={(event) => setProfileForm((current) => ({ ...current, phone: event.target.value }))} /></label>
              </div>
              <div className="two-col">
                <label>Contact name<input value={profileForm.contactName} onChange={(event) => setProfileForm((current) => ({ ...current, contactName: event.target.value }))} /></label>
                <label>
                  Contact email
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
                <label>Contact phone<input value={profileForm.contactPhone} onChange={(event) => setProfileForm((current) => ({ ...current, contactPhone: event.target.value }))} /></label>
                <label>City<input value={profileForm.city} onChange={(event) => setProfileForm((current) => ({ ...current, city: event.target.value }))} /></label>
                <label>Country<input value={profileForm.country} onChange={(event) => setProfileForm((current) => ({ ...current, country: event.target.value }))} /></label>
                <label>Address<input value={profileForm.address} onChange={(event) => setProfileForm((current) => ({ ...current, address: event.target.value }))} /></label>
                <label>Telegram<input value={profileForm.telegram} onChange={(event) => setProfileForm((current) => ({ ...current, telegram: event.target.value }))} /></label>
                <label>WhatsApp<input value={profileForm.whatsapp} onChange={(event) => setProfileForm((current) => ({ ...current, whatsapp: event.target.value }))} /></label>
                <label>Instagram<input value={profileForm.instagram} onChange={(event) => setProfileForm((current) => ({ ...current, instagram: event.target.value }))} /></label>
                <label>Tax ID<input value={profileForm.taxId} onChange={(event) => setProfileForm((current) => ({ ...current, taxId: event.target.value }))} /></label>
                <label className="wide-field">Notes<textarea value={profileForm.notes} onChange={(event) => setProfileForm((current) => ({ ...current, notes: event.target.value }))} rows={4} /></label>
              </div>
            </div>
          </>
        ) : (
          <div className="settings-grid embedded">
            <div className="definition-grid">
              <span>Name</span><strong>{readable(activeTenant?.name)}</strong>
              <span>Status</span><strong>{readable(activeTenant?.status)}</strong>
              <span>Plan</span><strong>{readable(activeTenant?.plan)}</strong>
              <span>Billing</span><strong>{readable(activeTenant?.billingStatus)}</strong>
              <span>Website</span><strong>{readable(activeTenant?.website)}</strong>
              <span>Email</span><strong>{readable(activeTenant?.email)}</strong>
              <span>Phone</span><strong>{readable(activeTenant?.phone)}</strong>
              <span>Tax ID</span><strong>{readable(activeTenant?.taxId)}</strong>
            </div>
            <div className="definition-grid">
              <span>Subdomain</span><strong>{readable(activeTenant?.subdomain)}</strong>
              <span>Custom domain</span><strong>{readable(activeTenant?.customDomain)}</strong>
              <span>Timezone</span><strong>{readable(activeTenant?.timezone)}</strong>
              <span>Locale</span><strong>{readable(activeTenant?.locale)}</strong>
              <span>Contact</span><strong>{readable(activeTenant?.contactName)}</strong>
              <span>Contact email</span><strong>{readable(activeTenant?.contactEmail)}</strong>
              <span>Location</span><strong>{readable([activeTenant?.city, activeTenant?.country].filter(Boolean).join(', '))}</strong>
              <span>Notes</span><strong>{readable(activeTenant?.notes)}</strong>
            </div>
          </div>
        )}
        <p className="panel-note">
          {canEditTenantProfile
            ? 'Use this area for tenant-facing contact and brand details. Platform-managed controls are listed above.'
            : 'Tenant profile changes are managed by tenant admins.'}
        </p>
      </form>
      ) : null}

      {settingsTab === 'branding' ? (
      <form className="settings-panel full" onSubmit={saveTenantBranding}>
        <div className="section-heading-row">
          <div>
            <h2>Tenant branding</h2>
            <span>Colors here are used as tenant UI and certificate defaults.</span>
          </div>
          <div className="profile-actions">
            {canEditTenantProfile && editingBranding ? (
              <>
                <button type="button" className="secondary-button" onClick={() => setEditingBranding(false)} disabled={savingBranding}>Cancel</button>
                <button type="submit" disabled={savingBranding}>{savingBranding ? 'Saving...' : 'Save branding'}</button>
              </>
            ) : canEditTenantProfile ? (
              <button type="button" onClick={() => setEditingBranding(true)}>Edit branding</button>
            ) : null}
          </div>
        </div>
        {editingBranding && canEditTenantProfile ? (
          <div className="settings-grid embedded">
            <div className="two-col">
              <label>Display name<input value={brandingForm.displayName} onChange={(event) => setBrandingForm((current) => ({ ...current, displayName: event.target.value }))} placeholder={activeTenant?.name ?? 'Tenant name'} /></label>
              <label>
                Certificate logo URL
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
            <div className="three-col">
              {([
                ['primaryColor', 'Primary color'],
                ['secondaryColor', 'Secondary color'],
                ['accentColor', 'Accent color'],
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
          </div>
        ) : (
          <div className="settings-grid embedded">
            <div className="definition-grid">
              <span>Display name</span><strong>{readable(recordText(activeTenant?.branding, 'displayName'))}</strong>
              <span>Certificate logo URL</span><strong>{readable(recordText(activeTenant?.branding, 'certificateLogoUrl'))}</strong>
            </div>
            <div className="definition-grid">
              <span>Primary color</span><strong>{readable(recordText(activeTenant?.branding, 'primaryColor'))}</strong>
              <span>Secondary color</span><strong>{readable(recordText(activeTenant?.branding, 'secondaryColor'))}</strong>
              <span>Accent color</span><strong>{readable(recordText(activeTenant?.branding, 'accentColor'))}</strong>
            </div>
          </div>
        )}
      </form>
      ) : null}

      {settingsTab === 'policies' ? (
      <form className="settings-panel full" onSubmit={saveTenantPolicies}>
        <div className="section-heading-row">
          <div>
            <h2>Tenant policies</h2>
            <span>Tenant-scoped defaults used by enrollment and support workflows.</span>
          </div>
          <div className="profile-actions">
            {canEditTenantProfile && editingPolicies ? (
              <>
                <button type="button" className="secondary-button" onClick={() => setEditingPolicies(false)} disabled={savingPolicies}>Cancel</button>
                <button type="submit" disabled={savingPolicies}>{savingPolicies ? 'Saving...' : 'Save policies'}</button>
              </>
            ) : canEditTenantProfile ? (
              <button type="button" onClick={() => setEditingPolicies(true)}>Edit policies</button>
            ) : null}
          </div>
        </div>
        {editingPolicies && canEditTenantProfile ? (
          <div className="settings-grid embedded">
            <div className="two-col">
              <label>Support email<input type="email" value={tenantSettingsForm.supportEmail} onChange={(event) => setTenantSettingsForm((current) => ({ ...current, supportEmail: event.target.value }))} /></label>
              <label>
                Default course visibility
                <select value={tenantSettingsForm.defaultCourseVisibility} onChange={(event) => setTenantSettingsForm((current) => ({ ...current, defaultCourseVisibility: event.target.value as typeof tenantSettingsForm.defaultCourseVisibility }))}>
                  <option value="PUBLIC">Public</option>
                  <option value="PRIVATE">Private</option>
                  <option value="TENANT_ONLY">Tenant only</option>
                </select>
              </label>
            </div>
            <div className="two-col">
              <label className="checkbox-row">
                <input type="checkbox" checked={tenantSettingsForm.allowSelfEnrollment} onChange={(event) => setTenantSettingsForm((current) => ({ ...current, allowSelfEnrollment: event.target.checked }))} />
                Allow self enrollment
              </label>
              <label className="checkbox-row">
                <input type="checkbox" checked={tenantSettingsForm.requireEnrollmentApproval} onChange={(event) => setTenantSettingsForm((current) => ({ ...current, requireEnrollmentApproval: event.target.checked }))} />
                Require enrollment approval
              </label>
            </div>
          </div>
        ) : (
          <div className="definition-grid">
            <span>Support email</span><strong>{readable(recordText(activeTenant?.settings, 'supportEmail'))}</strong>
            <span>Default course visibility</span><strong>{readable(recordText(activeTenant?.settings, 'defaultCourseVisibility'))}</strong>
            <span>Allow self enrollment</span><strong>{recordBoolean(activeTenant?.settings, 'allowSelfEnrollment') ? 'Enabled' : 'Disabled'}</strong>
            <span>Require enrollment approval</span><strong>{recordBoolean(activeTenant?.settings, 'requireEnrollmentApproval') ? 'Enabled' : 'Disabled'}</strong>
          </div>
        )}
      </form>
      ) : null}

      {settingsTab === 'features' ? (
      <section className="settings-panel full">
        <div className="section-heading-row">
          <div>
            <h2>Feature visibility</h2>
            <span>{enabledFeatureCount} enabled tools visible for this tenant</span>
          </div>
          <span className="status-badge role-owner">Platform managed</span>
        </div>
        <div className="flag-grid">
          {featureRows.map((feature) => (
            <div key={feature.key} className="flag-row">
              <div>
                <span>{feature.label}</span>
                <small>{feature.explicit ? feature.key : `${feature.key} · default`}</small>
              </div>
              <strong className={`status-badge ${feature.enabled ? 'published' : 'destructive'}`}>
                {feature.enabled ? 'Enabled' : 'Disabled'}
              </strong>
            </div>
          ))}
        </div>
        <p className="panel-note">Missing feature flags are treated as enabled by default. Only explicit false values disable a tenant feature.</p>
      </section>
      ) : null}

      {settingsTab === 'activity' ? (
      <section className="settings-panel full">
        <div className="section-heading-row">
          <div>
            <h2>Activity</h2>
            <span>Recent tenant changes recorded by the backend.</span>
          </div>
          <FiActivity />
        </div>
        {activityLoading ? <p className="panel-note">Loading activity...</p> : null}
        {!activityLoading ? (
          <div className="stack-list">
            {activityRows.map((row) => (
              <article key={row.id} className="stack-list-item">
                <div>
                  <strong>{readable(row.action)}</strong>
                  <span>{row.actorFullName || row.actorEmail || 'System'} · {new Date(row.createdAt).toLocaleString()}</span>
                </div>
                <span className="muted-text">{row.metadata ? Object.keys(row.metadata).join(', ') : row.targetType || 'tenant'}</span>
              </article>
            ))}
            {!activityRows.length ? <span className="muted-text">No tenant activity recorded yet.</span> : null}
          </div>
        ) : null}
      </section>
      ) : null}
    </>
  );
}
