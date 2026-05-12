import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState, LoadingState } from '../../components/DataState';
import { CountFilterRow } from '../../components/CountFilterRow';
import { useTenant } from '../tenant/TenantProvider';
import {
  attendanceStatuses,
  filterAttendanceStudents,
  getAttendanceCounts,
  getAttendanceSaveBlocker,
  getChangedAttendanceRows,
  isAttendanceSessionReady,
  type EditableAttendance,
} from './attendanceWorkflow';
import {
  getSessionAttendance,
  listCourseGroups,
  listGroupSessions,
  listGroupStudents,
  listTenantCourses,
  saveSessionAttendance,
} from '../../services/api';
import type { AttendanceRecord, AttendanceStatus, Course, CourseGroup, CourseSession, GroupStudent } from '../../types/domain';
import { formatDate, readable } from '../../lib/format';
import { isCourseWorkflowReady, nextWorkflowSearchParams } from '../workflows/workflowContext';

function isAttendanceCourseReady(course: Course | undefined | null) {
  return isCourseWorkflowReady(course);
}

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

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === sessionId),
    [sessionId, sessions],
  );
  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === courseId),
    [courseId, courses],
  );
  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === groupId),
    [groupId, groups],
  );
  const selectedSessionReady = isAttendanceSessionReady(selectedSession);

  const filteredStudents = useMemo(() => {
    return filterAttendanceStudents(students, attendance, studentQuery, statusFilter);
  }, [attendance, statusFilter, studentQuery, students]);

  const attendanceCounts = useMemo(() => {
    return getAttendanceCounts(students, attendance);
  }, [attendance, students]);

  const changedAttendanceRows = useMemo(() => {
    return getChangedAttendanceRows(students, attendance, savedAttendance);
  }, [attendance, savedAttendance, students]);
  const hasAttendanceChanges = changedAttendanceRows.length > 0;
  const attendanceSaveBlocker = getAttendanceSaveBlocker({
    sessionReady: selectedSessionReady,
    studentCount: students.length,
    markedCount: attendanceCounts.marked,
    changedCount: changedAttendanceRows.length,
  });
  const workflowSteps = useMemo(() => [
    {
      label: 'Course',
      value: selectedCourse?.title ?? 'Choose course',
      state: selectedCourse ? 'ready' : 'current',
    },
    {
      label: 'Group',
      value: selectedGroup?.name ?? (selectedCourse ? 'Choose group' : 'Waiting for course'),
      state: selectedGroup ? 'ready' : selectedCourse ? 'current' : 'locked',
    },
    {
      label: 'Session',
      value: selectedSession?.title ?? (selectedGroup ? 'Choose session' : 'Waiting for group'),
      state: selectedSession ? 'ready' : selectedGroup ? 'current' : 'locked',
    },
    {
      label: 'Mark',
      value: selectedSession ? `${attendanceCounts.marked} of ${attendanceCounts.total} marked` : 'Attendance unlocks here',
      state: selectedSession ? 'current' : 'locked',
    },
  ], [attendanceCounts.marked, attendanceCounts.total, selectedCourse, selectedGroup, selectedSession]);

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
    if (!activeTenantId) return;
    let cancelled = false;
    setLoading(true);
    listTenantCourses(activeTenantId)
      .then((nextCourses) => {
        if (cancelled) return;
        const readyCourses = nextCourses.filter(isAttendanceCourseReady);
        setCourses(readyCourses);
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
  }, [activeTenantId]);

  useEffect(() => {
    setCourseId((current) => {
      if (!courses.length) return undefined;
      if (requestedCourseId && courses.some((course) => course.id === requestedCourseId)) return requestedCourseId;
      return current && courses.some((course) => course.id === current) ? current : courses[0]?.id;
    });
  }, [courses, requestedCourseId]);

  useEffect(() => {
    setGroups([]);
    setSessions([]);
    setStudents([]);
    setAttendance({});
    setSavedAttendance({});
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
  }, [courseId]);

  useEffect(() => {
    setGroupId((current) => {
      if (!groups.length) return undefined;
      if (requestedGroupId && groups.some((group) => group.id === requestedGroupId)) return requestedGroupId;
      return current && groups.some((group) => group.id === current) ? current : groups[0]?.id;
    });
  }, [groups, requestedGroupId]);

  useEffect(() => {
    setSessions([]);
    setStudents([]);
    setAttendance({});
    setSavedAttendance({});
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
  }, [groupId]);

  useEffect(() => {
    setSessionId((current) => {
      if (!sessions.length) return undefined;
      if (requestedSessionId && sessions.some((session) => session.id === requestedSessionId)) return requestedSessionId;
      return current && sessions.some((session) => session.id === current) ? current : sessions[0]?.id;
    });
  }, [sessions, requestedSessionId]);

  useEffect(() => {
    const next = nextWorkflowSearchParams(searchParamsString, { courseId, groupId, sessionId });
    if (next.toString() !== searchParamsString) setSearchParams(next, { replace: true });
  }, [courseId, groupId, sessionId, searchParamsString, setSearchParams]);

  useEffect(() => {
    setAttendance({});
    setSavedAttendance({});
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
  };

  const saveAttendance = async () => {
    if (!sessionId) return;
    if (attendanceSaveBlocker) {
      toast.error(attendanceSaveBlocker);
      return;
    }

    const markedStudents = students.filter((student) => attendance[student.userId]);
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
          <button type="button" onClick={saveAttendance} disabled={saving || Boolean(attendanceSaveBlocker)} title={attendanceSaveBlocker || undefined}>
            {saving ? 'Saving...' : 'Save attendance'}
          </button>
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

      <section className="session-workflow-strip attendance-workflow-strip" aria-label="Attendance workflow">
        {workflowSteps.map((step, index) => (
          <article key={step.label} className={`workflow-step ${step.state}`}>
            <span>{index + 1}</span>
            <div>
              <strong>{step.label}</strong>
              <small>{step.value}</small>
            </div>
          </article>
        ))}
      </section>

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
        <section className="content-section workflow-context-panel">
          <div className="section-heading-row">
            <div>
              <h2>{selectedSession?.title ?? 'Session attendance'}</h2>
              <span>{attendanceCounts.marked} marked of {attendanceCounts.total}</span>
            </div>
            <div className="attendance-save-state">
              <span className={`status-badge ${hasAttendanceChanges ? 'pending_approval' : 'published'}`}>
                {hasAttendanceChanges ? `${changedAttendanceRows.length} changed` : 'Saved'}
              </span>
            </div>
          </div>
          <div className="attendance-session-summary" aria-label="Attendance summary">
            <section>
              <span>Marked</span>
              <strong>{attendanceCounts.marked}</strong>
            </section>
            <section>
              <span>Unmarked</span>
              <strong>{attendanceCounts.unmarked}</strong>
            </section>
            <section>
              <span>Changed</span>
              <strong>{changedAttendanceRows.length}</strong>
            </section>
            <section>
              <span>Session</span>
              <strong>{selectedSessionReady ? readable(selectedSession?.status ?? 'scheduled') : 'Not ready'}</strong>
            </section>
          </div>
          <CountFilterRow
            className="attendance-summary-row"
            ariaLabel="Attendance status filters"
            items={[
              ...attendanceStatuses.map((status) => ({
                key: status,
                label: readable(status),
                count: attendanceCounts[status],
                active: statusFilter === status,
              })),
              {
                key: 'unmarked' as const,
                label: 'Unmarked',
                count: attendanceCounts.unmarked,
                active: statusFilter === 'unmarked',
              },
            ]}
            onSelect={(nextStatus) => setStatusFilter(statusFilter === nextStatus ? 'all' : nextStatus)}
          />
          <div className="filters-row three attendance-tools">
            <label>
              Find student
              <input
                value={studentQuery}
                onChange={(event) => setStudentQuery(event.target.value)}
                placeholder="Name, email, or ID"
              />
            </label>
            <label>
              Status filter
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as AttendanceStatus | 'all' | 'unmarked')}>
                <option value="all">All statuses</option>
                <option value="unmarked">Unmarked</option>
                {attendanceStatuses.map((status) => <option key={status} value={status}>{readable(status)}</option>)}
              </select>
            </label>
            <div className="attendance-bulk-actions">
              <button type="button" className="secondary-button" onClick={() => markVisible('present')} disabled={!filteredStudents.length || saving}>
                Visible present
              </button>
              <button type="button" className="secondary-button" onClick={() => markVisible('absent')} disabled={!filteredStudents.length || saving}>
                Visible absent
              </button>
              <button type="button" className="secondary-button" onClick={() => markUnmarked('present')} disabled={!students.length || !attendanceCounts.unmarked || saving}>
                Unmarked present
              </button>
            </div>
          </div>
          <div className="attendance-review-banner">
            <div>
              <strong>{hasAttendanceChanges ? 'Review changes before saving' : 'Attendance is up to date'}</strong>
              <span>
                {hasAttendanceChanges
                  ? `${changedAttendanceRows.length} student${changedAttendanceRows.length === 1 ? '' : 's'} changed from the saved roster.`
                  : 'No unsaved attendance changes for this session.'}
              </span>
            </div>
            <span className={`status-badge ${attendanceCounts.unmarked ? 'draft' : 'published'}`}>{attendanceCounts.unmarked} unmarked</span>
          </div>
          <p className="panel-note attendance-note">Only marked rows are saved. Use bulk actions before saving when the whole class has the same status.</p>
          <div className="table-wrap attendance-table-wrap">
            <table className="attendance-roster-table">
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
                  const row = attendance[student.userId];
                  const progress = Math.round(student.progressPercent ?? 0);
                  return (
                    <tr key={student.userId} className={`attendance-row ${row ? row.status : 'unmarked'}`}>
                      <td data-label="Student">
                        <strong>{student.fullName || student.email || `Student ${student.userId}`}</strong>
                        {student.email ? <small>{student.email}</small> : null}
                      </td>
                      <td data-label="Status">
                        <span className={`status-badge attendance-${row ? row.status : 'unmarked'}`}>
                          {row ? readable(row.status) : 'Unmarked'}
                        </span>
                        <select
                          className="attendance-status-select"
                          aria-label={`Attendance status for ${student.fullName || student.email || `student ${student.userId}`}`}
                          value={row?.status ?? ''}
                          onChange={(event) => updateStudentAttendance(student.userId, { status: event.target.value as AttendanceStatus })}
                        >
                          <option value="" disabled>Choose status</option>
                          {attendanceStatuses.map((status) => (
                            <option key={status} value={status}>{readable(status)}</option>
                          ))}
                        </select>
                      </td>
                      <td data-label="Progress">
                        <div className="progress-cell attendance-progress-cell">
                          <span style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
                          <strong>{progress}%</strong>
                        </div>
                      </td>
                      <td data-label="Notes">
                        <input
                          value={row?.notes ?? ''}
                          onChange={(event) => updateStudentAttendance(student.userId, { notes: event.target.value })}
                          placeholder={row ? 'Optional note' : 'Choose status first'}
                          disabled={!row}
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
