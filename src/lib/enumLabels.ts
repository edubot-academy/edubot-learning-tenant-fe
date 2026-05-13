import type { TFunction } from 'i18next';

export function enumKey(value?: string | number | boolean | null) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function unknownEnumLabel(value: string | number | boolean | null | undefined, t: TFunction) {
  if (value === null || value === undefined || value === '') return t('states.notSet');
  return t('states.unknownValue', { value: String(value) });
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
  course: 'navigation.courses',
  create: 'actions.create',
  delete: 'actions.delete',
  group: 'navigation.groups',
  member: 'navigation.members',
  session: 'navigation.sessions',
  tenant: 'overview.tenantTarget',
  update: 'actions.update',
  updated: 'actions.update',
};
