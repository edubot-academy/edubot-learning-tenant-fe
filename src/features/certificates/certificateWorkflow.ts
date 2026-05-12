import type { CourseCertificate, CourseCertificateSettings, GroupStudent } from '../../types/domain';
import { readable } from '../../lib/format';

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
  sessions_missing: 'No delivery sessions exist yet',
  sessions_incomplete: 'Sessions are not completed',
  attendance_below_threshold: 'Attendance is below requirement',
  homework_below_threshold: 'Homework is below requirement',
  activities_below_threshold: 'Activities are below requirement',
  lesson_progress_incomplete: 'Lesson progress is incomplete',
};

export function describeEligibility(student?: GroupStudent | null) {
  const eligibility = student?.certificateEligibility;
  if (!eligibility) return student?.certificateEligible ? 'Eligible' : 'Eligibility unavailable';
  if (eligibility.eligible) return 'Eligible';
  const reasons = eligibility.reasons ?? [];
  return reasons.map((reason) => eligibilityReasonLabels[reason] ?? readable(reason)).join(', ') || 'Requirements not met';
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
      errors[key] = 'Use a 6-digit hex color, for example #122144.';
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
  if (attendancePercent < 0 || attendancePercent > 100) errors.attendance = 'Attendance must be between 0 and 100.';
  if (homeworkPercent < 0 || homeworkPercent > 100) errors.homework = 'Homework must be between 0 and 100.';
  if (activitiesPercent < 0 || activitiesPercent > 100) errors.activities = 'Activities must be between 0 and 100.';
  return errors;
}

export function getCertificateDecisionBlocker(action: CertificateDecisionAction, reason: string) {
  if ((action === 'reject' || action === 'revoke') && !reason.trim()) {
    return 'Reason is required.';
  }
  return '';
}

export function formatApprovalMode(value?: CourseCertificateSettings['approvalMode'] | null) {
  if (value === 'admin') return 'Owner / company admin';
  return readable(value ?? 'none');
}
