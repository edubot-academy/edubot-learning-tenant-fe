import { beforeEach, describe, expect, it } from 'vitest';
import type { CourseCertificate, CourseCertificateSettings, GroupStudent } from '../../types/domain';
import i18n from '../../i18n/config';
import {
  describeEligibility,
  filterCertificates,
  filterIssueStudents,
  getCertificateCounts,
  getCertificateDecisionBlocker,
  isStudentEligibleForCertificate,
  validateCourseCertificateSettings,
  validateHexColors,
} from './certificateWorkflow';

const student = (overrides: Partial<GroupStudent>): GroupStudent => ({
  id: 1,
  userId: 10,
  fullName: 'Ava Stone',
  email: 'ava@example.com',
  ...overrides,
});

const certificate = (overrides: Partial<CourseCertificate>): CourseCertificate => ({
  id: 1,
  publicId: 'CERT-1',
  studentId: 10,
  studentName: 'Ava Stone',
  courseId: 100,
  status: 'issued',
  ...overrides,
});

describe('certificate workflow helpers', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('describes eligibility reasons for blocked students', () => {
    const blocked = student({
      certificateEligibility: {
        eligible: false,
        progressPercent: 80,
        completed: false,
        reasons: ['attendance_below_threshold', 'custom_reason'],
      },
    });

    expect(isStudentEligibleForCertificate(blocked)).toBe(false);
    expect(describeEligibility(blocked)).toBe('Attendance is below requirement, custom reason');
  });

  it('filters issue students by eligibility and query', () => {
    const rows = [
      student({ id: 1, userId: 10, fullName: 'Ava Stone', certificateEligible: true }),
      student({ id: 2, userId: 20, fullName: 'Ben Park', certificateEligible: false }),
    ];

    expect(filterIssueStudents(rows, 'ava', 'eligible').map((item) => item.userId)).toEqual([10]);
    expect(filterIssueStudents(rows, '', 'blocked').map((item) => item.userId)).toEqual([20]);
  });

  it('filters and counts certificate registry rows', () => {
    const rows = [
      certificate({ id: 1, status: 'issued', publicId: 'ABC-1' }),
      certificate({ id: 2, status: 'pending_approval', publicId: 'XYZ-2', studentName: 'Ben Park' }),
    ];

    expect(getCertificateCounts(rows)).toMatchObject({ total: 2, issued: 1, pending_approval: 1 });
    expect(filterCertificates(rows, 'xyz', 'pending_approval').map((item) => item.id)).toEqual([2]);
  });

  it('validates color and threshold settings', () => {
    expect(validateHexColors({ primaryColor: 'not-a-color' })).toEqual({
      primaryColor: 'Use a 6-digit hex color, for example #122144.',
    });

    const settings: CourseCertificateSettings = {
      courseId: 1,
      eligibilityAttendancePercent: 101,
      eligibilityHomeworkPercent: -1,
      eligibilityActivitiesPercent: 100,
    };
    expect(validateCourseCertificateSettings(settings)).toMatchObject({
      attendance: 'Attendance must be between 0 and 100.',
      homework: 'Homework must be between 0 and 100.',
    });
  });

  it('requires reasons for reject and revoke decisions', () => {
    expect(getCertificateDecisionBlocker('reject', '')).toBe('Reason is required.');
    expect(getCertificateDecisionBlocker('revoke', 'Duplicate')).toBe('');
    expect(getCertificateDecisionBlocker('approve', '')).toBe('');
  });
});
