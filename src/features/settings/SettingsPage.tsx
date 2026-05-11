import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FiCreditCard, FiGlobe, FiLock, FiSliders, FiUserCheck } from 'react-icons/fi';
import { PageHeader } from '../../components/PageHeader';
import { WorkspaceTabs } from '../../components/WorkspaceTabs';
import { readable } from '../../lib/format';
import { useTenant } from '../tenant/TenantProvider';
import { useTheme } from '../theme/themeContext';
import { useAuth } from '../auth/AuthProvider';
import { updateTenant, uploadTenantLogo } from '../../services/api';
import { canManageTenantProfile, getEffectiveTenantRole } from '../tenant/tenantRoles';

const knownFeatures = [
  { key: 'courses.video.enabled', label: 'Video courses' },
  { key: 'courses.offline.enabled', label: 'Offline courses' },
  { key: 'courses.onlineLive.enabled', label: 'Online live courses' },
  { key: 'attendance.enabled', label: 'Attendance' },
  { key: 'homework.enabled', label: 'Homework' },
  { key: 'certificates.enabled', label: 'Certificates' },
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

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

type SettingsTab = 'profile' | 'access' | 'platform' | 'features';

const settingsTabs: Array<{ key: SettingsTab; label: string; description: string }> = [
  { key: 'profile', label: 'Profile', description: 'Tenant-facing brand, contact, and local profile details.' },
  { key: 'access', label: 'Access', description: 'Your account context and personal display preference.' },
  { key: 'platform', label: 'Platform', description: 'Read-only status, billing, and domain controls.' },
  { key: 'features', label: 'Features', description: 'Tools visible for this tenant workspace.' },
];

export function SettingsPage() {
  const { user } = useAuth();
  const { tenants, activeTenant, reloadTenants } = useTenant();
  const { preference, resolvedTheme, setPreference } = useTheme();
  const [profileForm, setProfileForm] = useState(emptyProfileForm);
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('profile');
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
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
      return;
    }

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
  }, [activeTenant]);

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
        timezone: profileForm.timezone.trim() || undefined,
        locale: profileForm.locale.trim() || undefined,
        website: profileForm.website.trim() || undefined,
        email: profileForm.email.trim() || undefined,
        phone: profileForm.phone.trim() || undefined,
        contactName: profileForm.contactName.trim() || undefined,
        contactEmail: profileForm.contactEmail.trim() || undefined,
        contactPhone: profileForm.contactPhone.trim() || undefined,
        address: profileForm.address.trim() || undefined,
        city: profileForm.city.trim() || undefined,
        country: profileForm.country.trim() || undefined,
        telegram: profileForm.telegram.trim() || undefined,
        whatsapp: profileForm.whatsapp.trim() || undefined,
        instagram: profileForm.instagram.trim() || undefined,
        taxId: profileForm.taxId.trim() || undefined,
        notes: profileForm.notes.trim() || undefined,
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
    </>
  );
}
