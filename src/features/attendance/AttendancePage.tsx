import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState, LoadingState } from '../../components/DataState';
import { CountFilterRow } from '../../components/CountFilterRow';
import { useTenant } from '../tenant/TenantProvider';
import {
  getSessionAttendance,
  listCourseGroups,
  listGroupSessions,
  listGroupStudents,
  listTenantCourses,
  saveSessionAttendance,
} from '../../services/api';
import type { AttendanceRecord, AttendanceStatus, Course, CourseGroup, CourseSession, GroupStudent } from '../../types/domain';
import { formatDate } from '../../lib/format';

const attendanceStatuses: AttendanceStatus[] = ['present', 'late', 'absent', 'excused'];

function isAttendanceCourseReady(course: Course | undefined | null) {
  return Boolean(
    course
    && ['offline', 'online_live'].includes(String(course.courseType ?? ''))
    && course.status === 'approved'
    && course.isPublished === true,
  );
}

function isAttendanceSessionReady(session: CourseSession | undefined | null) {
  return Boolean(session && ['scheduled', 'completed'].includes(String(session.status ?? 'scheduled')));
}

type EditableAttendance = {
  status: AttendanceStatus;
  notes: string;
};

export function AttendancePage() {
  const { activeTenant } = useTenant();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTenantId = activeTenant?.id;
  const requestedCourseId = Number(searchParams.get('courseId')) || undefined;
  const requestedGroupId = Number(searchParams.get('groupId')) || undefined;
  const requestedSessionId = Number(searchParams.get('sessionId')) || undefined;
  const searchParamsString = searchParams.toString();
  const [courses, setCourses] = useState<Course[]>([]);
  const [groups, setGroups] = useState<CourseGroup[]>([]);
  const [sessions, setSessions] = useState<CourseSession[]>([]);
  const [students, setStudents] = useState<GroupStudent[]>([]);
  const [attendance, setAttendance] = useState<Record<number, EditableAttendance>>({});
  const [savedAttendance, setSavedAttendance] = useState<Record<number, EditableAttendance>>({});
  const [courseId, setCourseId] = useState<number | undefined>();
  const [groupId, setGroupId] = useState<number | undefined>();
  const [sessionId, setSessionId] = useState<number | undefined>();
  const [studentQuery, setStudentQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<AttendanceStatus | 'all' | 'unmarked'>('all');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === sessionId),
    [sessionId, sessions],
  );
  const selectedSessionReady = isAttendanceSessionReady(selectedSession);

  const filteredStudents = useMemo(() => {
    const normalizedQuery = studentQuery.trim().toLowerCase();
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
  }, [attendance, statusFilter, studentQuery, students]);

  const attendanceCounts = useMemo(() => {
    const counts = attendanceStatuses.reduce(
      (acc, status) => ({ ...acc, [status]: 0 }),
      {} as Record<AttendanceStatus, number>,
    );
    students.forEach((student) => {
      const status = attendance[student.userId]?.status;
      if (status) counts[status] += 1;
    });
    return {
      ...counts,
      marked: Object.keys(attendance).length,
      unmarked: Math.max(0, students.length - Object.keys(attendance).length),
      total: students.length,
    };
  }, [attendance, students]);

  const changedAttendanceRows = useMemo(() => {
    return students.filter((student) => {
      const current = attendance[student.userId] ?? { status: 'present' as AttendanceStatus, notes: '' };
      const saved = savedAttendance[student.userId] ?? { status: 'present' as AttendanceStatus, notes: '' };
      return current.status !== saved.status || current.notes.trim() !== saved.notes.trim();
    });
  }, [attendance, savedAttendance, students]);

  useEffect(() => {
    setCourses([]);
    setGroups([]);
    setSessions([]);
    setStudents([]);
    setAttendance({});
    setSavedAttendance({});
    setCourseId(undefined);
    setGroupId(undefined);
    setSessionId(undefined);
    setHasUnsavedChanges(false);
    if (!activeTenantId) return;
    let cancelled = false;
    setLoading(true);
    listTenantCourses(activeTenantId)
      .then((nextCourses) => {
        if (cancelled) return;
        const readyCourses = nextCourses.filter(isAttendanceCourseReady);
        setCourses(readyCourses);
        setCourseId((current) => {
          if (requestedCourseId && readyCourses.some((course) => course.id === requestedCourseId)) return requestedCourseId;
          return current && readyCourses.some((course) => course.id === current) ? current : readyCourses[0]?.id;
        });
      })
      .catch(() => {
        if (!cancelled) toast.error('Could not load courses');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTenantId, requestedCourseId]);

  useEffect(() => {
    setGroups([]);
    setSessions([]);
    setStudents([]);
    setAttendance({});
    setSavedAttendance({});
    setHasUnsavedChanges(false);
    setStudentQuery('');
    setStatusFilter('all');
    setGroupId(undefined);
    setSessionId(undefined);
    if (!courseId) return;
    let cancelled = false;
    setLoading(true);
    listCourseGroups(courseId)
      .then((nextGroups) => {
        if (cancelled) return;
        setGroups(nextGroups);
        setGroupId((current) => {
          if (requestedGroupId && nextGroups.some((group) => group.id === requestedGroupId)) return requestedGroupId;
          return current && nextGroups.some((group) => group.id === current) ? current : nextGroups[0]?.id;
        });
      })
      .catch(() => {
        if (!cancelled) toast.error('Could not load groups');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [courseId, requestedGroupId]);

  useEffect(() => {
    setSessions([]);
    setStudents([]);
    setAttendance({});
    setSavedAttendance({});
    setHasUnsavedChanges(false);
    setStudentQuery('');
    setStatusFilter('all');
    setSessionId(undefined);
    if (!groupId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([listGroupSessions(groupId), listGroupStudents(groupId)])
      .then(([nextSessions, nextStudents]) => {
        if (cancelled) return;
        const readySessions = nextSessions.filter(isAttendanceSessionReady);
        setSessions(readySessions);
        setStudents(nextStudents);
        setSessionId((current) => {
          if (requestedSessionId && readySessions.some((session) => session.id === requestedSessionId)) return requestedSessionId;
          return current && readySessions.some((session) => session.id === current) ? current : readySessions[0]?.id;
        });
      })
      .catch(() => {
        if (!cancelled) toast.error('Could not load group attendance data');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [groupId, requestedSessionId]);

  useEffect(() => {
    const next = new URLSearchParams(searchParamsString);
    if (courseId) next.set('courseId', String(courseId)); else next.delete('courseId');
    if (groupId) next.set('groupId', String(groupId)); else next.delete('groupId');
    if (sessionId) next.set('sessionId', String(sessionId)); else next.delete('sessionId');
    if (next.toString() !== searchParamsString) setSearchParams(next, { replace: true });
  }, [courseId, groupId, sessionId, searchParamsString, setSearchParams]);

  useEffect(() => {
    setAttendance({});
    setSavedAttendance({});
    setHasUnsavedChanges(false);
    if (!sessionId) return;
    let cancelled = false;
    setLoading(true);
    getSessionAttendance(sessionId)
      .then((records: AttendanceRecord[]) => {
        if (cancelled) return;
        const nextAttendance: Record<number, EditableAttendance> = {};
        records.forEach((record) => {
          nextAttendance[record.userId] = {
            status: record.status,
            notes: record.notes ?? '',
          };
        });
        setAttendance(nextAttendance);
        setSavedAttendance(nextAttendance);
        setHasUnsavedChanges(false);
      })
      .catch(() => {
        if (!cancelled) toast.error('Could not load saved attendance');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const updateStudentAttendance = (studentId: number, patch: Partial<EditableAttendance>) => {
    setAttendance((current) => ({
      ...current,
      [studentId]: {
        status: current[studentId]?.status ?? 'present',
        notes: current[studentId]?.notes ?? '',
        ...patch,
      },
    }));
    setHasUnsavedChanges(true);
  };

  const markVisible = (status: AttendanceStatus) => {
    setAttendance((current) => {
      const nextAttendance = { ...current };
      filteredStudents.forEach((student) => {
        nextAttendance[student.userId] = {
          status,
          notes: current[student.userId]?.notes ?? '',
        };
      });
      return nextAttendance;
    });
    setHasUnsavedChanges(true);
  };

  const markUnmarked = (status: AttendanceStatus) => {
    setAttendance((current) => {
      const nextAttendance = { ...current };
      students.forEach((student) => {
        if (!nextAttendance[student.userId]) {
          nextAttendance[student.userId] = {
            status,
            notes: '',
          };
        }
      });
      return nextAttendance;
    });
    setHasUnsavedChanges(true);
  };

  const saveAttendance = async () => {
    if (!sessionId) return;
    if (!students.length) {
      toast.error('No students in this group');
      return;
    }
    if (!selectedSessionReady) {
      toast.error('Attendance can only be saved for scheduled or completed sessions');
      return;
    }

    const markedStudents = students.filter((student) => attendance[student.userId]);
    if (!markedStudents.length) {
      toast.error('Mark at least one student before saving');
      return;
    }

    setSaving(true);
    try {
      const nextAttendance = markedStudents.reduce<Record<number, EditableAttendance>>((acc, student) => {
        acc[student.userId] = {
          status: attendance[student.userId].status,
          notes: attendance[student.userId]?.notes?.trim() ?? '',
        };
        return acc;
      }, {});
      await saveSessionAttendance(
        sessionId,
        markedStudents.map((student) => ({
          studentId: student.userId,
          status: nextAttendance[student.userId].status,
          notes: nextAttendance[student.userId].notes || undefined,
        })),
      );
      setAttendance(nextAttendance);
      setSavedAttendance(nextAttendance);
      setHasUnsavedChanges(false);
      toast.success('Attendance saved');
    } catch {
      toast.error('Could not save attendance');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Attendance"
        eyebrow={activeTenant?.name}
        actions={sessionId ? (
          <>
            <button type="button" className="secondary-button" onClick={() => markUnmarked('present')} disabled={!students.length || !attendanceCounts.unmarked || saving}>
              Mark unmarked present
            </button>
            <button type="button" onClick={saveAttendance} disabled={!students.length || saving || !hasUnsavedChanges || !selectedSessionReady}>
              {saving ? 'Saving...' : 'Save attendance'}
            </button>
          </>
        ) : null}
      />

      <div className="filters-row three">
        <select value={courseId ?? ''} onChange={(event) => setCourseId(Number(event.target.value) || undefined)}>
          <option value="">Select course</option>
          {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
        </select>
        <select
          value={groupId ?? ''}
          onChange={(event) => setGroupId(Number(event.target.value) || undefined)}
          disabled={!groups.length}
        >
          <option value="">Select group</option>
          {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
        </select>
        <select
          value={sessionId ?? ''}
          onChange={(event) => setSessionId(Number(event.target.value) || undefined)}
          disabled={!sessions.length}
        >
          <option value="">Select session</option>
          {sessions.map((session) => (
            <option key={session.id} value={session.id}>
              {session.title} {session.startsAt ? `- ${formatDate(session.startsAt)}` : ''}
            </option>
          ))}
        </select>
      </div>

      {loading ? <LoadingState label="Loading attendance" /> : null}

      {!loading && !courseId ? (
        <EmptyState title="Choose a course" detail="Select a tenant course, then choose a group and session to mark attendance." />
      ) : null}

      {!loading && courseId && groupId && !students.length ? (
        <EmptyState
          title="No students in this group"
          detail="Enroll students into the selected group before marking attendance."
          action={<Link className="secondary-link-button" to="/sessions">Open sessions</Link>}
        />
      ) : null}

      {!loading && groupId && students.length > 0 && !sessionId ? (
        <EmptyState
          title="Choose a session"
          detail="Select a scheduled or completed session to view and update attendance."
          action={<Link className="secondary-link-button" to="/sessions">Schedule sessions</Link>}
        />
      ) : null}

      {!loading && sessionId && (
        <section className="content-section">
          <div className="section-heading-row">
            <div>
              <h2>{selectedSession?.title ?? 'Session attendance'}</h2>
              <span>{attendanceCounts.marked} marked of {attendanceCounts.total}</span>
            </div>
            <div className="attendance-save-state">
              <span className={`status-badge ${hasUnsavedChanges ? 'pending_approval' : 'published'}`}>
                {hasUnsavedChanges ? `${changedAttendanceRows.length} changed` : 'Saved'}
              </span>
            </div>
          </div>
          <CountFilterRow
            className="attendance-summary-row"
            ariaLabel="Attendance status filters"
            items={[
              ...attendanceStatuses.map((status) => ({
                key: status,
                label: status,
                count: attendanceCounts[status],
                active: statusFilter === status,
              })),
              {
                key: 'unmarked' as const,
                label: 'unmarked',
                count: attendanceCounts.unmarked,
                active: statusFilter === 'unmarked',
              },
            ]}
            onSelect={(nextStatus) => setStatusFilter(statusFilter === nextStatus ? 'all' : nextStatus)}
          />
          <div className="filters-row three attendance-tools">
            <input
              value={studentQuery}
              onChange={(event) => setStudentQuery(event.target.value)}
              placeholder="Search student"
            />
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as AttendanceStatus | 'all' | 'unmarked')}>
              <option value="all">All statuses</option>
              <option value="unmarked">Unmarked</option>
              {attendanceStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
            <div className="attendance-bulk-actions">
              <button type="button" className="secondary-button" onClick={() => markVisible('present')} disabled={!filteredStudents.length || saving}>
                Visible present
              </button>
              <button type="button" className="secondary-button" onClick={() => markVisible('absent')} disabled={!filteredStudents.length || saving}>
                Visible absent
              </button>
            </div>
          </div>
          <div className="attendance-review-banner">
            <div>
              <strong>{hasUnsavedChanges ? 'Review changes before saving' : 'Attendance is up to date'}</strong>
              <span>
                {hasUnsavedChanges
                  ? `${changedAttendanceRows.length} student${changedAttendanceRows.length === 1 ? '' : 's'} changed from the saved roster.`
                  : 'No unsaved attendance changes for this session.'}
              </span>
            </div>
            <span className="status-badge draft">{attendanceCounts.unmarked} unmarked</span>
          </div>
          <p className="panel-note attendance-note">Only marked rows are saved. Use bulk actions before saving when the whole class has the same status.</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => {
                  const row = attendance[student.userId] ?? { status: 'present', notes: '' };
                  const progress = Math.round(student.progressPercent ?? 0);
                  return (
                    <tr key={student.userId} className={`attendance-row ${attendance[student.userId] ? row.status : 'unmarked'}`}>
                      <td>
                        <strong>{student.fullName || student.email || `Student ${student.userId}`}</strong>
                        {student.email ? <small>{student.email}</small> : null}
                      </td>
                      <td>
                        <span className={`status-badge attendance-${attendance[student.userId] ? row.status : 'unmarked'}`}>
                          {attendance[student.userId] ? row.status : 'unmarked'}
                        </span>
                        <select
                          className="attendance-status-select"
                          value={row.status}
                          onChange={(event) => updateStudentAttendance(student.userId, { status: event.target.value as AttendanceStatus })}
                        >
                          {attendanceStatuses.map((status) => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <div className="progress-cell attendance-progress-cell">
                          <span style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
                          <strong>{progress}%</strong>
                        </div>
                      </td>
                      <td>
                        <input
                          value={row.notes}
                          onChange={(event) => updateStudentAttendance(student.userId, { notes: event.target.value })}
                          placeholder="Optional note"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!filteredStudents.length ? (
            <EmptyState
              title="No matching students"
              detail="Clear the search or switch back to all attendance statuses."
              action={<button type="button" className="secondary-button" onClick={() => { setStudentQuery(''); setStatusFilter('all'); }}>Reset filters</button>}
            />
          ) : null}
        </section>
      )}
    </>
  );
}
