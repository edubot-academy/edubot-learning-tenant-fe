import { beforeEach, describe, expect, it } from 'vitest';
import type { GroupStudent } from '../../types/domain';
import i18n from '../../i18n/config';
import {
  filterAttendanceStudents,
  getAttendanceCounts,
  getAttendanceSaveBlocker,
  getAttendanceSessionDetail,
  getChangedAttendanceRows,
  type EditableAttendance,
} from './attendanceWorkflow';

const students: GroupStudent[] = [
  { id: 1, userId: 10, fullName: 'Ava Stone', email: 'ava@example.com' },
  { id: 2, userId: 20, fullName: 'Ben Park', email: 'ben@example.com' },
];

describe('attendance workflow helpers', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('counts marked and unmarked attendance against enrolled students', () => {
    const attendance: Record<number, EditableAttendance> = {
      10: { status: 'present', notes: '' },
    };

    expect(getAttendanceCounts(students, attendance)).toMatchObject({
      present: 1,
      late: 0,
      absent: 0,
      excused: 0,
      marked: 1,
      unmarked: 1,
      total: 2,
    });
  });

  it('detects note and status changes from saved attendance', () => {
    const current: Record<number, EditableAttendance> = {
      10: { status: 'present', notes: 'Arrived early' },
      20: { status: 'late', notes: '' },
    };
    const saved: Record<number, EditableAttendance> = {
      10: { status: 'present', notes: '' },
      20: { status: 'late', notes: '' },
    };

    expect(getChangedAttendanceRows(students, current, saved).map((student) => student.userId)).toEqual([10]);
  });

  it('filters by query and unmarked status', () => {
    const attendance: Record<number, EditableAttendance> = {
      10: { status: 'present', notes: '' },
    };

    expect(filterAttendanceStudents(students, attendance, 'ben', 'unmarked').map((student) => student.userId)).toEqual([20]);
  });

  it('returns concrete save blockers', () => {
    expect(getAttendanceSaveBlocker({ sessionReady: false, studentCount: 2, markedCount: 1, changedCount: 1 })).toContain('scheduled or completed');
    expect(getAttendanceSaveBlocker({ sessionReady: true, studentCount: 2, markedCount: 1, changedCount: 1 })).toBe('');
  });

  it('uses one-student copy for individual attendance sessions', () => {
    expect(getAttendanceSessionDetail({
      groupDeliveryMode: 'individual',
      students: [{ id: 3, userId: 30, fullName: 'Cara One', email: 'cara@example.com' }],
      marked: 0,
      total: 1,
      studentFallback: (id) => `Student ${id}`,
    })).toBe('One-to-one session for Cara One');

    expect(getAttendanceSessionDetail({
      groupDeliveryMode: 'group',
      students,
      marked: 1,
      total: 2,
      studentFallback: (id) => `Student ${id}`,
    })).toBe('1 of 2 marked');
  });
});
