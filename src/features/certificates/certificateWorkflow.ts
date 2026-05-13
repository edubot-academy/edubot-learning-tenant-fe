import type { CourseCertificate, CourseCertificateSettings, GroupStudent } from '../../types/domain';
import i18n from '../../i18n/config';
import { enumLabel, unknownEnumLabel } from '../../lib/enumLabels';

export type CertificateTab = 'branding' | 'rules' | 'registry';
export type CertificateLanguageValue = 'en' | 'ru' | 'ky';
export type CertificateOrientationValue = 'landscape' | 'portrait';
export type CertificateDecisionAction = 'approve' | 'reject' | 'revoke';

export const certificateTabs: Array<{ key: CertificateTab; label: string; description: string }> = [
  { key: 'branding', label: 'Branding', description: 'Certificate template, logo, colors, and preview.' },
  { key: 'rules', label: 'Course rules', description: 'Eligibility, issue mode, approval, and signatures.' },
  { key: 'registry', label: 'Registry', description: 'Issue, approve, regenerate, and search certificates.' },
];

export const eligibilityReasonLabels: Record<string, string> = {
  sessions_missing: 'certificates.reasonSessionsMissing',
  sessions_incomplete: 'certificates.reasonSessionsIncomplete',
  attendance_below_threshold: 'certificates.reasonAttendanceBelow',
  homework_below_threshold: 'certificates.reasonHomeworkBelow',
  activities_below_threshold: 'certificates.reasonActivitiesBelow',
  lesson_progress_incomplete: 'certificates.reasonLessonProgressIncomplete',
};

export function describeEligibility(student?: GroupStudent | null) {
  const eligibility = student?.certificateEligibility;
  if (!eligibility) return student?.certificateEligible ? i18n.t('certificates.eligible') : i18n.t('certificates.eligibilityUnavailable');
  if (eligibility.eligible) return i18n.t('certificates.eligible');
  const reasons = eligibility.reasons ?? [];
  return reasons.map((reason) => {
    const labelKey = eligibilityReasonLabels[reason];
    return labelKey ? i18n.t(labelKey) : unknownEnumLabel(reason, i18n.t.bind(i18n));
  }).join(', ') || i18n.t('certificates.requirementsNotMet');
}

export function isStudentEligibleForCertificate(student?: GroupStudent | null) {
  return Boolean(student?.certificateEligibility?.eligible || student?.certificateEligible);
}

export function filterIssueStudents(
  students: GroupStudent[],
  query: string,
  filter: 'all' | 'eligible' | 'blocked',
) {
  const normalizedQuery = query.trim().toLowerCase();
  return students.filter((student) => {
    const eligible = isStudentEligibleForCertificate(student);
    const matchesFilter = filter === 'all'
      || (filter === 'eligible' && eligible)
      || (filter === 'blocked' && !eligible);
    const matchesQuery = !normalizedQuery
      || String(student.fullName ?? '').toLowerCase().includes(normalizedQuery)
      || String(student.email ?? '').toLowerCase().includes(normalizedQuery)
      || String(student.id).includes(normalizedQuery)
      || String(student.userId ?? '').includes(normalizedQuery);
    return matchesFilter && matchesQuery;
  });
}

export function filterCertificates(
  certificates: CourseCertificate[],
  query: string,
  status: string,
) {
  const normalizedQuery = query.trim().toLowerCase();
  return certificates.filter((certificate) => {
    const matchesStatus = status === 'all' || certificate.status === status;
    const matchesQuery = !normalizedQuery
      || String(certificate.studentName ?? '').toLowerCase().includes(normalizedQuery)
      || String(certificate.studentId).includes(normalizedQuery)
      || String(certificate.publicId ?? '').toLowerCase().includes(normalizedQuery)
      || String(certificate.status ?? '').toLowerCase().includes(normalizedQuery);
    return matchesStatus && matchesQuery;
  });
}

export function getCertificateCounts(certificates: CourseCertificate[]) {
  return certificates.reduce<Record<string, number>>((acc, certificate) => {
    acc.total = (acc.total ?? 0) + 1;
    acc[certificate.status] = (acc[certificate.status] ?? 0) + 1;
    return acc;
  }, { total: 0 });
}

export function validateHexColors(values: Record<string, string | null | undefined>) {
  const hexColorPattern = /^#?[0-9a-fA-F]{6}$/;
  return Object.entries(values).reduce<Record<string, string>>((errors, [key, value]) => {
    if (value && !hexColorPattern.test(value)) {
      errors[key] = i18n.t('certificates.errorHexColor');
    }
    return errors;
  }, {});
}

export function validateCourseCertificateSettings(courseSettings: CourseCertificateSettings) {
  const errors = validateHexColors({
    primaryColor: courseSettings.primaryColor,
    accentColor: courseSettings.accentColor,
  });
  const attendancePercent = courseSettings.eligibilityAttendancePercent ?? 80;
  const homeworkPercent = courseSettings.eligibilityHomeworkPercent ?? 100;
  const activitiesPercent = courseSettings.eligibilityActivitiesPercent ?? 100;
  if (attendancePercent < 0 || attendancePercent > 100) errors.attendance = i18n.t('certificates.errorAttendanceRange');
  if (homeworkPercent < 0 || homeworkPercent > 100) errors.homework = i18n.t('certificates.errorHomeworkRange');
  if (activitiesPercent < 0 || activitiesPercent > 100) errors.activities = i18n.t('certificates.errorActivitiesRange');
  return errors;
}

export function getCertificateDecisionBlocker(action: CertificateDecisionAction, reason: string) {
  if ((action === 'reject' || action === 'revoke') && !reason.trim()) {
    return i18n.t('certificates.reasonRequired');
  }
  return '';
}

export function formatApprovalMode(value?: CourseCertificateSettings['approvalMode'] | null) {
  if (value === 'admin') return i18n.t('certificates.ownerCompanyAdmin');
  if (value === 'instructor') return i18n.t('members.roleInstructor');
  if (!value || value === 'none') return i18n.t('certificates.none');
  return enumLabel(value, {}, i18n.t.bind(i18n));
}
