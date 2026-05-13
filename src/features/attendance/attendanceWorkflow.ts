import type { AttendanceStatus, CourseSession, GroupStudent } from '../../types/domain';
import i18n from '../../i18n/config';

export const attendanceStatuses: AttendanceStatus[] = ['present', 'late', 'absent', 'excused'];

export type EditableAttendance = {
  status: AttendanceStatus;
  notes: string;
};

export function isAttendanceSessionReady(session: CourseSession | undefined | null) {
  return Boolean(session && ['scheduled', 'completed'].includes(String(session.status ?? 'scheduled')));
}

export function getAttendanceCounts(
  students: GroupStudent[],
  attendance: Record<number, EditableAttendance>,
) {
  const counts = attendanceStatuses.reduce(
    (acc, status) => ({ ...acc, [status]: 0 }),
    {} as Record<AttendanceStatus, number>,
  );

  students.forEach((student) => {
    const status = attendance[student.userId]?.status;
    if (status) counts[status] += 1;
  });

  const marked = students.filter((student) => attendance[student.userId]).length;
  return {
    ...counts,
    marked,
    unmarked: Math.max(0, students.length - marked),
    total: students.length,
  };
}

export function getChangedAttendanceRows(
  students: GroupStudent[],
  attendance: Record<number, EditableAttendance>,
  savedAttendance: Record<number, EditableAttendance>,
) {
  return students.filter((student) => {
    const current = attendance[student.userId];
    const saved = savedAttendance[student.userId];
    if (!current && !saved) return false;
    if (!current || !saved) return true;
    return current.status !== saved.status || current.notes.trim() !== saved.notes.trim();
  });
}

export function filterAttendanceStudents(
  students: GroupStudent[],
  attendance: Record<number, EditableAttendance>,
  query: string,
  statusFilter: AttendanceStatus | 'all' | 'unmarked',
) {
  const normalizedQuery = query.trim().toLowerCase();
  return students.filter((student) => {
    const row = attendance[student.userId];
    const matchesQuery = !normalizedQuery
      || (student.fullName ?? '').toLowerCase().includes(normalizedQuery)
      || (student.email ?? '').toLowerCase().includes(normalizedQuery)
      || String(student.userId).includes(normalizedQuery);
    const matchesStatus = statusFilter === 'all'
      || (statusFilter === 'unmarked' ? !row : row?.status === statusFilter);
    return matchesQuery && matchesStatus;
  });
}

export function getAttendanceSaveBlocker({
  sessionReady,
  studentCount,
  markedCount,
  changedCount,
}: {
  sessionReady: boolean;
  studentCount: number;
  markedCount: number;
  changedCount: number;
}) {
  if (!sessionReady) return i18n.t('attendance.saveBlockerSessionReady');
  if (!studentCount) return i18n.t('attendance.saveBlockerNoStudents');
  if (!markedCount) return i18n.t('attendance.saveBlockerNoMarked');
  if (!changedCount) return i18n.t('attendance.saveBlockerNoChanges');
  return '';
}
