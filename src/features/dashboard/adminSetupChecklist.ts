import type { Tenant, TenantOverview } from '../../types/domain';

export type AdminSetupChecklistItem = {
  key: string;
  labelKey: string;
  detailKey: string;
  to: string;
  complete: boolean;
};

function numberStat(overview: TenantOverview, ...keys: string[]) {
  const value = keys.map((key) => overview.stats[key]).find((item) => item !== undefined && item !== null);
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
}

function hasText(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasTenantProfile(tenant: Tenant | null | undefined) {
  return Boolean(
    hasText(tenant?.name)
    && (hasText(tenant?.email) || hasText(tenant?.contactEmail))
    && (hasText(tenant?.timezone) || hasText(tenant?.locale)),
  );
}

function hasTenantBranding(tenant: Tenant | null | undefined) {
  const branding = tenant?.branding ?? {};
  return Boolean(
    hasText(tenant?.logoUrl)
    || hasText(branding.displayName)
    || hasText(branding.certificateLogoUrl)
    || hasText(branding.primaryColor),
  );
}

function hasLearningPolicies(tenant: Tenant | null | undefined) {
  const settings = tenant?.settings ?? {};
  return hasText(settings.supportEmail)
    || hasText(settings.defaultCourseVisibility)
    || settings.allowSelfEnrollment === true
    || settings.requireEnrollmentApproval === true;
}

export function getAdminSetupChecklist(
  overview: TenantOverview,
  tenant: Tenant | null | undefined,
  options: { canManageCertificates: boolean; certificatesEnabled: boolean },
): AdminSetupChecklistItem[] {
  const courseCount = numberStat(overview, 'courses');
  const instructorCount = numberStat(overview, 'instructors', 'instructorCount');
  const activeGroupCount = numberStat(overview, 'activeGroups', 'groups');
  const studentCount = numberStat(overview, 'students');
  const sessionCount = numberStat(overview, 'upcomingSessions', 'sessions');
  const certificatesReady = !options.certificatesEnabled
    || !options.canManageCertificates
    || (overview.certificates.configuredCourses > 0 && overview.certificates.coursesWithoutConfig === 0);

  return [
    {
      key: 'profile',
      labelKey: 'overview.setupChecklist.profile',
      detailKey: 'overview.setupChecklist.profileDetail',
      to: '/settings',
      complete: hasTenantProfile(tenant),
    },
    {
      key: 'branding',
      labelKey: 'overview.setupChecklist.branding',
      detailKey: 'overview.setupChecklist.brandingDetail',
      to: '/settings',
      complete: hasTenantBranding(tenant),
    },
    {
      key: 'admin',
      labelKey: 'overview.setupChecklist.admin',
      detailKey: 'overview.setupChecklist.adminDetail',
      to: '/members',
      complete: true,
    },
    {
      key: 'instructors',
      labelKey: 'overview.setupChecklist.instructors',
      detailKey: 'overview.setupChecklist.instructorsDetail',
      to: '/members',
      complete: instructorCount > 0,
    },
    {
      key: 'course',
      labelKey: 'overview.setupChecklist.course',
      detailKey: 'overview.setupChecklist.courseDetail',
      to: '/courses',
      complete: courseCount > 0,
    },
    {
      key: 'group',
      labelKey: 'overview.setupChecklist.group',
      detailKey: 'overview.setupChecklist.groupDetail',
      to: '/groups',
      complete: activeGroupCount > 0,
    },
    {
      key: 'sessions',
      labelKey: 'overview.setupChecklist.sessions',
      detailKey: 'overview.setupChecklist.sessionsDetail',
      to: '/sessions',
      complete: sessionCount > 0 || overview.sessions.today > 0,
    },
    {
      key: 'students',
      labelKey: 'overview.setupChecklist.students',
      detailKey: 'overview.setupChecklist.studentsDetail',
      to: '/groups',
      complete: studentCount > 0,
    },
    {
      key: 'certificates',
      labelKey: 'overview.setupChecklist.certificates',
      detailKey: options.certificatesEnabled ? 'overview.setupChecklist.certificatesDetail' : 'overview.setupChecklist.certificatesDisabledDetail',
      to: '/certificates?tab=rules',
      complete: certificatesReady,
    },
    {
      key: 'policies',
      labelKey: 'overview.setupChecklist.policies',
      detailKey: 'overview.setupChecklist.policiesDetail',
      to: '/settings',
      complete: hasLearningPolicies(tenant),
    },
  ];
}
