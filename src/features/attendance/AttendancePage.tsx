import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState, LoadingState } from '../../components/DataState';
import { CountFilterRow } from '../../components/CountFilterRow';
import { useTenant } from '../tenant/TenantProvider';
import { useAuth } from '../auth/AuthProvider';
import { canTeachAssignedSessions } from '../tenant/tenantRoles';
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
import { formatDate } from '../../lib/format';
import { commonStatusLabelKeys, enumLabel } from '../../lib/enumLabels';
import { isCourseWorkflowReady, nextWorkflowSearchParams } from '../workflows/workflowContext';

function isAttendanceCourseReady(course: Course | undefined | null) {
  return isCourseWorkflowReady(course);
}

export function AttendancePage() {
  const { t } = useTranslation();
  const { activeTenant } = useTenant();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTenantId = activeTenant?.id;
  const requestedCourseId = Number(searchParams.get('courseId')) || undefined;
  const requestedGroupId = Number(searchParams.get('groupId')) || undefined;
  const requestedSessionId = Number(searchParams.get('sessionId')) || undefined;
  const searchParamsString = searchParams.toString();
  const [courses, setCourses] = useState<Course[]>([]);
  const [groups, setGroups] = useState<CourseGroup[]>([]);
  const [sessions, setSessions] = useState<CourseSession[]>([]);
  const [assignedSessions, setAssignedSessions] = useState<CourseSession[]>([]);
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
  const canUseAssignedSessionPicker = canTeachAssignedSessions(user, activeTenant);

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
  const attendanceSaveBlockerMessage = useMemo(() => {
    if (!attendanceSaveBlocker) return '';
    const blockers: Record<string, string> = {
      'Attendance can only be saved for scheduled or completed sessions.': t('attendance.saveBlockerSessionReady'),
      'No students are enrolled in this group.': t('attendance.saveBlockerNoStudents'),
      'Mark at least one student before saving.': t('attendance.saveBlockerNoMarked'),
      'No unsaved attendance changes.': t('attendance.saveBlockerNoChanges'),
    };
    return blockers[attendanceSaveBlocker] ?? attendanceSaveBlocker;
  }, [attendanceSaveBlocker, t]);
  const attendanceStatusLabel = (status: AttendanceStatus | 'unmarked') => {
    const labels: Record<AttendanceStatus | 'unmarked', string> = {
      absent: t('attendance.statusAbsent'),
      excused: t('attendance.statusExcused'),
      late: t('attendance.statusLate'),
      present: t('attendance.statusPresent'),
      unmarked: t('attendance.unmarked'),
    };
    return labels[status];
  };
  const sessionStatusLabel = (status?: string) => {
    return enumLabel(status ?? 'scheduled', commonStatusLabelKeys, t);
  };
  const studentFallback = (id: number) => t('courses.studentFallback', { id });
  const workflowSteps = useMemo(() => [
    {
      label: t('courses.course'),
      value: selectedCourse?.title ?? t('sessions.chooseCourse'),
      state: selectedCourse ? 'ready' : 'current',
    },
    {
      label: t('courses.group'),
      value: selectedGroup?.name ?? (selectedCourse ? t('attendance.chooseGroup') : t('sessions.waitingForCourse')),
      state: selectedGroup ? 'ready' : selectedCourse ? 'current' : 'locked',
    },
    {
      label: t('courses.sessions'),
      value: selectedSession?.title ?? (selectedGroup ? t('attendance.chooseSession') : t('sessions.waitingForGroup')),
      state: selectedSession ? 'ready' : selectedGroup ? 'current' : 'locked',
    },
    {
      label: t('attendance.mark'),
      value: selectedSession ? t('attendance.markedOfTotal', { marked: attendanceCounts.marked, total: attendanceCounts.total }) : t('attendance.unlocksHere'),
      state: selectedSession ? 'current' : 'locked',
    },
  ], [attendanceCounts.marked, attendanceCounts.total, selectedCourse, selectedGroup, selectedSession, t]);
  const attendanceReadyAssignedSessions = useMemo(() => {
    return assignedSessions
      .filter(isAttendanceSessionReady)
      .slice(0, 8);
  }, [assignedSessions]);
  const openAssignedSession = (session: CourseSession) => {
    const next = new URLSearchParams(searchParamsString);
    next.set('courseId', String(session.courseId));
    if (session.groupId) next.set('groupId', String(session.groupId));
    next.set('sessionId', String(session.id));
    setSearchParams(next);
  };

  useEffect(() => {
    setCourses([]);
    setGroups([]);
    setSessions([]);
    setAssignedSessions([]);
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
        if (!cancelled) toast.error(t('courses.loadFailed'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTenantId, t]);

  useEffect(() => {
    setAssignedSessions([]);
    if (!activeTenantId || !canUseAssignedSessionPicker) return;
    let cancelled = false;
    listGroupSessions()
      .then((nextSessions) => {
        if (!cancelled) setAssignedSessions(nextSessions);
      })
      .catch(() => {
        if (!cancelled) setAssignedSessions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTenantId, canUseAssignedSessionPicker]);

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
        if (!cancelled) toast.error(t('groups.courseGroupsLoadFailed'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [courseId, t]);

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
        if (!cancelled) toast.error(t('attendance.groupDataLoadFailed'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [groupId, t]);

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
        if (!cancelled) toast.error(t('attendance.savedLoadFailed'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, t]);

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
      toast.error(attendanceSaveBlockerMessage);
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
      toast.success(t('attendance.saved'));
    } catch {
      toast.error(t('attendance.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title={t('attendance.title')}
        eyebrow={activeTenant?.name}
        actions={sessionId ? (
          <button type="button" onClick={saveAttendance} disabled={saving || Boolean(attendanceSaveBlocker)} title={attendanceSaveBlockerMessage || undefined}>
            {saving ? t('courses.saving') : t('attendance.saveAttendance')}
          </button>
        ) : null}
      />

      <div className="filters-row three">
        <select value={courseId ?? ''} onChange={(event) => setCourseId(Number(event.target.value) || undefined)}>
          <option value="">{t('courses.selectCourse')}</option>
          {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
        </select>
        <select
          value={groupId ?? ''}
          onChange={(event) => setGroupId(Number(event.target.value) || undefined)}
          disabled={!groups.length}
        >
          <option value="">{t('courses.selectGroup')}</option>
          {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
        </select>
        <select
          value={sessionId ?? ''}
          onChange={(event) => setSessionId(Number(event.target.value) || undefined)}
          disabled={!sessions.length}
        >
          <option value="">{t('sessions.chooseSession')}</option>
          {sessions.map((session) => (
            <option key={session.id} value={session.id}>
              {session.title} {session.startsAt ? `- ${formatDate(session.startsAt)}` : ''}
            </option>
          ))}
        </select>
      </div>

      {canUseAssignedSessionPicker && attendanceReadyAssignedSessions.length ? (
        <section className="content-section workflow-context-panel">
          <div className="section-heading-row">
            <div>
              <h2>{t('homework.assigned')} {t('navigation.attendance')}</h2>
              <span>{t('attendance.chooseSessionDetail')}</span>
            </div>
          </div>
          <div className="stack-list">
            {attendanceReadyAssignedSessions.map((session) => (
              <article className="stack-list-item" key={session.id}>
                <div>
                  <strong>{session.title}</strong>
                  <span>
                    {formatDate(session.startsAt)} · <span className={`status-badge ${session.status || 'scheduled'}`}>{sessionStatusLabel(session.status)}</span>
                  </span>
                </div>
                <button type="button" className="link-button" onClick={() => openAssignedSession(session)}>
                  {t('student.open')}
                </button>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {loading ? <LoadingState label={t('attendance.loading')} /> : null}

      <section className="session-workflow-strip attendance-workflow-strip" aria-label={t('attendance.workflow')}>
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
        <EmptyState title={t('attendance.chooseCourseTitle')} detail={t('attendance.chooseCourseDetail')} />
      ) : null}

      {!loading && courseId && groupId && !students.length ? (
        <EmptyState
          title={t('courses.noStudentsTitle')}
          detail={t('attendance.noStudentsDetail')}
          action={<Link className="secondary-link-button" to="/sessions">{t('attendance.openSessions')}</Link>}
        />
      ) : null}

      {!loading && groupId && students.length > 0 && !sessionId ? (
        <EmptyState
          title={t('attendance.chooseSessionTitle')}
          detail={t('attendance.chooseSessionDetail')}
          action={<Link className="secondary-link-button" to="/sessions">{t('attendance.scheduleSessions')}</Link>}
        />
      ) : null}

      {!loading && sessionId && (
        <section className="content-section workflow-context-panel">
          <div className="section-heading-row">
            <div>
              <h2>{selectedSession?.title ?? t('attendance.sessionAttendance')}</h2>
              <span>{t('attendance.markedOfTotal', { marked: attendanceCounts.marked, total: attendanceCounts.total })}</span>
            </div>
            <div className="attendance-save-state">
              <span className={`status-badge ${hasAttendanceChanges ? 'pending_approval' : 'published'}`}>
                {hasAttendanceChanges ? t('attendance.changedCount', { count: changedAttendanceRows.length }) : t('attendance.savedState')}
              </span>
            </div>
          </div>
          <div className="attendance-session-summary" aria-label={t('attendance.summary')}>
            <section>
              <span>{t('sessions.marked')}</span>
              <strong>{attendanceCounts.marked}</strong>
            </section>
            <section>
              <span>{t('attendance.unmarked')}</span>
              <strong>{attendanceCounts.unmarked}</strong>
            </section>
            <section>
              <span>{t('attendance.changed')}</span>
              <strong>{changedAttendanceRows.length}</strong>
            </section>
            <section>
              <span>{t('courses.sessions')}</span>
              <strong>{selectedSessionReady ? sessionStatusLabel(selectedSession?.status ?? 'scheduled') : t('attendance.notReady')}</strong>
            </section>
          </div>
          <CountFilterRow
            className="attendance-summary-row"
            ariaLabel={t('attendance.statusFilters')}
            items={[
              ...attendanceStatuses.map((status) => ({
                key: status,
                label: attendanceStatusLabel(status),
                count: attendanceCounts[status],
                active: statusFilter === status,
              })),
              {
                key: 'unmarked' as const,
                label: t('attendance.unmarked'),
                count: attendanceCounts.unmarked,
                active: statusFilter === 'unmarked',
              },
            ]}
            onSelect={(nextStatus) => setStatusFilter(statusFilter === nextStatus ? 'all' : nextStatus)}
          />
          <div className="filters-row three attendance-tools">
            <label>
              {t('attendance.findStudent')}
              <input
                value={studentQuery}
                onChange={(event) => setStudentQuery(event.target.value)}
                placeholder={t('attendance.studentSearchPlaceholder')}
              />
            </label>
            <label>
              {t('attendance.statusFilter')}
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as AttendanceStatus | 'all' | 'unmarked')}>
                <option value="all">{t('attendance.allStatuses')}</option>
                <option value="unmarked">{t('attendance.unmarked')}</option>
                {attendanceStatuses.map((status) => <option key={status} value={status}>{attendanceStatusLabel(status)}</option>)}
              </select>
            </label>
            <div className="attendance-bulk-actions">
              <button type="button" className="secondary-button" onClick={() => markVisible('present')} disabled={!filteredStudents.length || saving}>
                {t('attendance.visiblePresent')}
              </button>
              <button type="button" className="secondary-button" onClick={() => markVisible('absent')} disabled={!filteredStudents.length || saving}>
                {t('attendance.visibleAbsent')}
              </button>
              <button type="button" className="secondary-button" onClick={() => markUnmarked('present')} disabled={!students.length || !attendanceCounts.unmarked || saving}>
                {t('attendance.unmarkedPresent')}
              </button>
            </div>
          </div>
          <div className="attendance-review-banner">
            <div>
              <strong>{hasAttendanceChanges ? t('attendance.reviewBeforeSaving') : t('attendance.upToDate')}</strong>
              <span>
                {hasAttendanceChanges
                  ? t('attendance.studentsChanged', { count: changedAttendanceRows.length })
                  : t('attendance.noUnsavedChanges')}
              </span>
            </div>
            <span className={`status-badge ${attendanceCounts.unmarked ? 'draft' : 'published'}`}>{t('attendance.unmarkedCount', { count: attendanceCounts.unmarked })}</span>
          </div>
          <p className="panel-note attendance-note">{t('attendance.saveNote')}</p>
          <div className="table-wrap attendance-table-wrap">
            <table className="attendance-roster-table">
              <thead>
                <tr>
                  <th>{t('courses.student')}</th>
                  <th>{t('courses.status')}</th>
                  <th>{t('courses.progress')}</th>
                  <th>{t('sessions.notes')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => {
                  const row = attendance[student.userId];
                  const progress = Math.round(student.progressPercent ?? 0);
                  return (
                    <tr key={student.userId} className={`attendance-row ${row ? row.status : 'unmarked'}`}>
                      <td data-label={t('courses.student')}>
                        <strong>{student.fullName || student.email || studentFallback(student.userId)}</strong>
                        {student.email ? <small>{student.email}</small> : null}
                      </td>
                      <td data-label={t('courses.status')}>
                        <span className={`status-badge attendance-${row ? row.status : 'unmarked'}`}>
                          {row ? attendanceStatusLabel(row.status) : t('attendance.unmarked')}
                        </span>
                        <select
                          className="attendance-status-select"
                          aria-label={t('attendance.statusForStudent', { name: student.fullName || student.email || studentFallback(student.userId) })}
                          value={row?.status ?? ''}
                          onChange={(event) => updateStudentAttendance(student.userId, { status: event.target.value as AttendanceStatus })}
                        >
                          <option value="" disabled>{t('attendance.chooseStatus')}</option>
                          {attendanceStatuses.map((status) => (
                            <option key={status} value={status}>{attendanceStatusLabel(status)}</option>
                          ))}
                        </select>
                      </td>
                      <td data-label={t('courses.progress')}>
                        <div className="progress-cell attendance-progress-cell">
                          <span style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
                          <strong>{progress}%</strong>
                        </div>
                      </td>
                      <td data-label={t('sessions.notes')}>
                        <input
                          value={row?.notes ?? ''}
                          onChange={(event) => updateStudentAttendance(student.userId, { notes: event.target.value })}
                          placeholder={row ? t('attendance.optionalNote') : t('attendance.chooseStatusFirst')}
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
              title={t('courses.noMatchingStudents')}
              detail={t('attendance.noMatchingStudentsDetail')}
              action={<button type="button" className="secondary-button" onClick={() => { setStudentQuery(''); setStatusFilter('all'); }}>{t('attendance.resetFilters')}</button>}
            />
          ) : null}
        </section>
      )}
    </>
  );
}
