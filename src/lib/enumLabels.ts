import type { TFunction } from 'i18next';

export function enumKey(value?: string | number | boolean | null) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function humanizeEnumValue(value: string | number | boolean) {
  const words = String(value)
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const acronyms = new Set(['api', 'crm', 'id', 'url']);
  return words.length
    ? words.map((word) => {
      const lower = word.toLowerCase();
      if (acronyms.has(lower)) return lower.toUpperCase();
      if (word === word.toUpperCase() && word.length <= 4) return word;
      return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
    }).join(' ')
    : String(value);
}

export function unknownEnumLabel(value: string | number | boolean | null | undefined, t: TFunction) {
  if (value === null || value === undefined || value === '') return t('states.notSet');
  return t('states.unknownValue', { value: humanizeEnumValue(value) });
}

export function enumLabel(
  value: string | number | boolean | null | undefined,
  labels: Record<string, string>,
  t: TFunction,
  fallbackValue?: string,
) {
  const normalized = enumKey(value);
  const labelKey = labels[normalized];
  if (labelKey) return t(labelKey);
  if (fallbackValue && !normalized) return fallbackValue;
  return unknownEnumLabel(value, t);
}

export const commonStatusLabelKeys: Record<string, string> = {
  absent: 'attendance.statusAbsent',
  active: 'groups.statusActive',
  approved: 'courses.statusApproved',
  cancelled: 'groups.statusCancelled',
  completed: 'groups.statusCompleted',
  done: 'sessions.statusDone',
  draft: 'courses.statusDraft',
  excused: 'attendance.statusExcused',
  existing: 'groups.existing',
  issued: 'certificates.statusIssued',
  late: 'attendance.statusLate',
  missing: 'homework.reviewMissing',
  needsreview: 'homework.reviewNeedsReview',
  needsrevision: 'homework.reviewNeedsRevision',
  new: 'groups.new',
  open: 'groups.statusOpen',
  overdue: 'homework.overdue',
  passed: 'student.completed',
  pending: 'courses.statusPending',
  pendingapproval: 'overview.pendingApprovals',
  pendingsubmission: 'homework.reviewMissing',
  planned: 'courses.statusPlanned',
  present: 'attendance.statusPresent',
  rejected: 'courses.statusRejected',
  revoked: 'certificates.statusRevoked',
  scheduled: 'courses.statusScheduled',
  submitted: 'sessions.statusSubmitted',
  total: 'groups.total',
};

export const courseTypeLabelKeys: Record<string, string> = {
  offline: 'courses.typeOffline',
  onlinelive: 'courses.typeOnlineLive',
  video: 'courses.typeVideo',
};

export const roleLabelKeys: Record<string, string> = {
  admin: 'members.roleAdmin',
  all: 'members.all',
  assistant: 'members.roleAssistant',
  companyadmin: 'members.roleCompanyAdmin',
  instructor: 'members.roleInstructor',
  owner: 'members.roleOwner',
  student: 'members.roleStudent',
  superadmin: 'members.roleSuperAdmin',
};

export const activityTypeLabelKeys: Record<string, string> = {
  discussion: 'sessions.activityTypeDiscussion',
  exercise: 'sessions.activityTypeExercise',
  groupwork: 'sessions.activityTypeGroupWork',
  homework: 'navigation.homework',
  quiz: 'sessions.activityTypeQuiz',
  resource: 'student.resource',
  submission: 'sessions.activityTypeSubmission',
};

export const activityActionLabelKeys: Record<string, string> = {
  certificate: 'navigation.certificates',
  certificateapproved: 'overview.activityCertificateApproved',
  certificateissued: 'overview.activityCertificateIssued',
  certificaterejected: 'overview.activityCertificateRejected',
  certificaterevoked: 'overview.activityCertificateRevoked',
  course: 'navigation.courses',
  courseapproved: 'overview.activityCourseApproved',
  coursearchived: 'overview.activityCourseArchived',
  coursecreated: 'overview.activityCourseCreated',
  coursepublished: 'overview.activityCoursePublished',
  courseupdated: 'overview.activityCourseUpdated',
  create: 'actions.create',
  delete: 'actions.delete',
  group: 'navigation.groups',
  groupcreated: 'overview.activityGroupCreated',
  groupupdated: 'overview.activityGroupUpdated',
  homeworkcreated: 'overview.activityHomeworkCreated',
  homeworkupdated: 'overview.activityHomeworkUpdated',
  member: 'navigation.members',
  membercreated: 'overview.activityMemberCreated',
  memberinvited: 'overview.activityMemberInvited',
  memberinvitationresent: 'overview.activityMemberInvitationResent',
  memberremoved: 'overview.activityMemberRemoved',
  memberroleset: 'overview.activityMemberRoleSet',
  memberroleupdated: 'overview.activityMemberRoleSet',
  memberupdated: 'overview.activityMemberUpdated',
  session: 'navigation.sessions',
  sessioncreated: 'overview.activitySessionCreated',
  sessionupdated: 'overview.activitySessionUpdated',
  tenant: 'overview.tenantTarget',
  tenantaccessupdated: 'overview.activityTenantAccessUpdated',
  tenantbrandingupdated: 'overview.activityTenantBrandingUpdated',
  tenantcrmconnected: 'overview.activityTenantCrmConnected',
  tenantcrmlinkremoved: 'overview.activityTenantCrmLinkRemoved',
  tenantcrmlinkupdated: 'overview.activityTenantCrmLinkUpdated',
  tenantfeaturesupdated: 'overview.activityTenantFeaturesUpdated',
  tenantlogoupdated: 'overview.activityTenantLogoUpdated',
  tenantprofileupdated: 'overview.activityTenantProfileUpdated',
  tenantsettingsupdated: 'overview.activityTenantSettingsUpdated',
  tenantupdated: 'overview.activityTenantUpdated',
  update: 'actions.update',
  updated: 'actions.update',
};

export const activityTargetLabelKeys: Record<string, string> = {
  certificate: 'overview.targetCertificate',
  certificates: 'overview.targetCertificate',
  course: 'overview.targetCourse',
  courses: 'overview.targetCourse',
  group: 'overview.targetGroup',
  groups: 'overview.targetGroup',
  homework: 'overview.targetHomework',
  member: 'overview.targetMember',
  members: 'overview.targetMember',
  session: 'overview.targetSession',
  sessions: 'overview.targetSession',
  tenant: 'overview.targetWorkspace',
  workspace: 'overview.targetWorkspace',
};
