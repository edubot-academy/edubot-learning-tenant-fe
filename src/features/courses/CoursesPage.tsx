import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiBookOpen, FiCalendar, FiCheckSquare, FiFileText, FiPlus, FiUsers } from 'react-icons/fi';
import { PageHeader } from '../../components/PageHeader';
import { StatGrid } from '../../components/StatGrid';
import { EmptyState, LoadingState } from '../../components/DataState';
import { FormModal } from '../../components/Modal';
import { createTenantCourse, listCourseGroups, listGroupSessions, listGroupStudents, listHomework, listTenantCourses, updateCourseStatus } from '../../services/api';
import type { Course, CourseGroup, CourseSession, GroupStudent, SessionHomework } from '../../types/domain';
import { useTenant } from '../tenant/TenantProvider';
import { useAuth } from '../auth/AuthProvider';
import { getEffectiveTenantRole } from '../tenant/tenantRoles';
import { formatDate } from '../../lib/format';

type TenantCourseType = 'offline' | 'online_live' | 'video';

export function CoursesPage() {
  const { activeTenant } = useTenant();
  const { user } = useAuth();
  const activeTenantId = activeTenant?.id;
  const [courses, setCourses] = useState<Course[]>([]);
  const [groups, setGroups] = useState<CourseGroup[]>([]);
  const [sessions, setSessions] = useState<CourseSession[]>([]);
  const [students, setStudents] = useState<GroupStudent[]>([]);
  const [homework, setHomework] = useState<SessionHomework[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | undefined>();
  const [selectedGroupId, setSelectedGroupId] = useState<number | undefined>();
  const [query, setQuery] = useState('');
  const [studentQuery, setStudentQuery] = useState('');
  const [progressFilter, setProgressFilter] = useState<'all' | 'not_started' | 'in_progress' | 'completed'>('all');
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creatingCourse, setCreatingCourse] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    courseType: 'offline' as TenantCourseType,
  });

  const activeRole = getEffectiveTenantRole(user, activeTenant);
  const canCreateCourse = ['owner', 'company_admin', 'admin', 'instructor'].includes(activeRole);
  const canApproveTenantCourses = ['owner', 'company_admin', 'admin'].includes(activeRole);

  const courseTypeOptions = useMemo(() => {
    const flags = activeTenant?.featureFlags ?? {};
    const options: Array<{ value: TenantCourseType; label: string }> = [];
    if (flags['courses.offline.enabled'] !== false) options.push({ value: 'offline', label: 'Offline' });
    if (flags['courses.onlineLive.enabled'] !== false) options.push({ value: 'online_live', label: 'Online live' });
    if (flags['courses.video.enabled'] === true) options.push({ value: 'video', label: 'Video' });
    return options;
  }, [activeTenant?.featureFlags]);

  const filteredCourses = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return courses;
    return courses.filter((course) => (
      course.title.toLowerCase().includes(normalized)
      || (course.courseType ?? '').toLowerCase().includes(normalized)
      || (course.status ?? '').toLowerCase().includes(normalized)
    ));
  }, [courses, query]);

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === selectedCourseId),
    [courses, selectedCourseId],
  );

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId),
    [groups, selectedGroupId],
  );

  useEffect(() => {
    let cancelled = false;
    setCourses([]);
    setGroups([]);
    setSessions([]);
    setStudents([]);
    setHomework([]);
    setSelectedCourseId(undefined);
    setSelectedGroupId(undefined);
    if (!activeTenantId) {
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    listTenantCourses(activeTenantId)
      .then((items) => {
        if (cancelled) return;
        setCourses(items);
        setSelectedCourseId(items[0]?.id);
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
    setGroups([]);
    setSessions([]);
    setStudents([]);
    setHomework([]);
    setSelectedGroupId(undefined);
    if (!selectedCourseId) return;

    let cancelled = false;
    setDetailLoading(true);
    Promise.all([listCourseGroups(selectedCourseId), listHomework(selectedCourseId)])
      .then(([nextGroups, nextHomework]) => {
        if (cancelled) return;
        setGroups(nextGroups);
        setHomework(nextHomework);
        setSelectedGroupId(nextGroups[0]?.id);
      })
      .catch(() => {
        if (!cancelled) toast.error('Could not load course detail');
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCourseId]);

  useEffect(() => {
    setSessions([]);
    setStudents([]);
    if (!selectedGroupId) return;

    let cancelled = false;
    setDetailLoading(true);
    Promise.all([listGroupSessions(selectedGroupId), listGroupStudents(selectedGroupId, { limit: 200 })])
      .then(([nextSessions, nextStudents]) => {
        if (cancelled) return;
        setSessions(nextSessions);
        setStudents(nextStudents);
      })
      .catch(() => {
        if (!cancelled) toast.error('Could not load group detail');
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedGroupId]);

  useEffect(() => {
    if (!selectedGroupId) return;
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      const params = {
        q: studentQuery.trim() || undefined,
        progressGte: progressFilter === 'completed' ? 100 : progressFilter === 'in_progress' ? 1 : undefined,
        progressLte: progressFilter === 'not_started' ? 0 : progressFilter === 'in_progress' ? 99 : undefined,
        limit: 200,
      };
      listGroupStudents(selectedGroupId, params)
        .then((nextStudents) => {
          if (!cancelled) setStudents(nextStudents);
        })
        .catch(() => {
          if (!cancelled) toast.error('Could not filter students');
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [progressFilter, selectedGroupId, studentQuery]);

  const stats = useMemo(() => [
    { label: 'Groups', value: groups.length, hint: selectedCourse?.title ?? 'Selected course' },
    { label: 'Sessions', value: sessions.length, hint: selectedGroup?.name ?? 'Selected group' },
    { label: 'Students', value: students.length, hint: 'Current group roster' },
    { label: 'Homework', value: homework.length, hint: 'Course assignments' },
  ], [groups.length, homework.length, selectedCourse?.title, selectedGroup?.name, sessions.length, students.length]);

  const groupProgressAverage = useMemo(() => {
    if (!students.length) return 0;
    const total = students.reduce((sum, student) => sum + (student.progressPercent ?? 0), 0);
    return Math.round(total / students.length);
  }, [students]);

  const completedStudents = useMemo(
    () => students.filter((student) => student.completed || (student.progressPercent ?? 0) >= 100).length,
    [students],
  );

  useEffect(() => {
    if (!courseTypeOptions.length) return;
    if (!courseTypeOptions.some((option) => option.value === createForm.courseType)) {
      setCreateForm((current) => ({ ...current, courseType: courseTypeOptions[0].value }));
    }
  }, [courseTypeOptions, createForm.courseType]);

  const openCreateModal = () => {
    setCreateErrors({});
    setCreateForm({
      title: '',
      description: '',
      courseType: courseTypeOptions[0]?.value ?? 'offline',
    });
    setCreateModalOpen(true);
  };

  const submitCourse = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeTenantId) return;

    const errors: Record<string, string> = {};
    if (createForm.title.trim().length < 2) errors.title = 'Course title is required.';
    if (createForm.description.trim().length < 10) errors.description = 'Add a short course description.';
    if (!courseTypeOptions.some((option) => option.value === createForm.courseType)) {
      errors.courseType = 'This course type is not enabled for this tenant.';
    }
    setCreateErrors(errors);
    if (Object.keys(errors).length) return;

    setCreatingCourse(true);
    try {
      const created = await createTenantCourse(activeTenantId, {
        title: createForm.title.trim(),
        description: createForm.description.trim(),
        courseType: createForm.courseType,
      });
      const items = await listTenantCourses(activeTenantId);
      setCourses(items);
      setSelectedCourseId(created.id);
      setCreateModalOpen(false);
      toast.success('Course created');
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || 'Could not create course');
    } finally {
      setCreatingCourse(false);
    }
  };

  const reloadCourses = async (preferredCourseId?: number) => {
    if (!activeTenantId) return;
    const items = await listTenantCourses(activeTenantId);
    setCourses(items);
    const preferred = preferredCourseId ? items.find((course) => course.id === preferredCourseId) : null;
    setSelectedCourseId(preferred?.id ?? items[0]?.id);
  };

  const changeCourseStatus = async (courseId: number, status: 'pending' | 'approved' | 'rejected') => {
    setStatusUpdating(true);
    try {
      await updateCourseStatus(courseId, status);
      await reloadCourses(courseId);
      toast.success(status === 'approved' ? 'Course approved' : status === 'rejected' ? 'Course rejected' : 'Course submitted for approval');
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || 'Could not update course status');
    } finally {
      setStatusUpdating(false);
    }
  };

  if (loading) return <LoadingState label="Loading courses" />;

  return (
    <>
      <PageHeader
        title="Courses"
        eyebrow={activeTenant?.name}
        actions={canCreateCourse ? (
          <button type="button" className="primary-button" onClick={openCreateModal} disabled={!courseTypeOptions.length}>
            <FiPlus />
            Create course
          </button>
        ) : null}
      />
      <div className="filters-row">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search tenant courses"
        />
        <select value={selectedCourseId ?? ''} onChange={(event) => setSelectedCourseId(Number(event.target.value) || undefined)}>
          <option value="">Select course</option>
          {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
        </select>
      </div>
      {!courses.length ? (
        <EmptyState
          title="No tenant courses yet"
          detail={canCreateCourse ? 'Create a private offline or live course for this tenant, or ask the platform team to assign existing courses.' : 'Assigned tenant courses will appear here when they are ready for delivery.'}
          action={canCreateCourse ? (
            <button type="button" className="secondary-button" onClick={openCreateModal} disabled={!courseTypeOptions.length}>Create course</button>
          ) : <Link className="secondary-link-button" to="/settings">Review tenant settings</Link>}
        />
      ) : (
        <>
          <StatGrid items={stats} />
          <div className="workspace-grid">
            <section className="content-section">
              <h2>Tenant catalog</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Course</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Published</th>
                      <th>Students</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCourses.map((course) => (
                      <tr
                        key={course.id}
                        className={`interactive-row ${course.id === selectedCourseId ? 'selected-row' : ''}`}
                        role="button"
                        tabIndex={0}
                        aria-pressed={course.id === selectedCourseId}
                        onClick={() => setSelectedCourseId(course.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setSelectedCourseId(course.id);
                          }
                        }}
                      >
                    <td>
                      <strong>{course.title}</strong>
                      {course.instructor?.fullName ? <small>{course.instructor.fullName}</small> : null}
                    </td>
                    <td><span className="status-badge">{(course.courseType || 'video').replace('_', ' ')}</span></td>
                    <td><span className={`status-badge ${course.status || 'draft'}`}>{course.status || 'draft'}</span></td>
                    <td><span className={`status-badge ${course.isPublished ? 'published' : 'draft'}`}>{course.isPublished ? 'Published' : 'Draft'}</span></td>
                    <td>{course.enrolledStudents ?? 0}</td>
                  </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!filteredCourses.length ? (
                <EmptyState
                  title="No matching courses"
                  detail="Clear the search or choose a course from the selector above."
                  action={<button type="button" className="secondary-button" onClick={() => setQuery('')}>Clear search</button>}
                />
              ) : null}
            </section>

            <aside className="settings-panel">
              <div className="section-heading-row compact">
                <div>
                  <h2>Course operations</h2>
                  <span>{selectedCourse?.title ?? 'Select a course'}</span>
                </div>
              </div>
              {!selectedCourse ? (
                <EmptyState title="Select a course" detail="Choose a course from the catalog to see groups, sessions, learners, and next actions." />
              ) : detailLoading ? (
                <LoadingState label="Loading course detail" />
              ) : (
                <>
                  <div className="course-action-grid">
                    <Link className="course-action-card" to="/sessions">
                      <FiCalendar />
                      <span>Sessions</span>
                    </Link>
                    <Link className="course-action-card" to="/attendance">
                      <FiCheckSquare />
                      <span>Attendance</span>
                    </Link>
                    <Link className="course-action-card" to="/homework">
                      <FiFileText />
                      <span>Homework</span>
                    </Link>
                    <Link className="course-action-card" to="/certificates">
                      <FiBookOpen />
                      <span>Certificates</span>
                    </Link>
                  </div>
                  <div className="definition-grid">
                    <span>Course</span><strong>{selectedCourse.title}</strong>
                    <span>Type</span><strong>{(selectedCourse.courseType || 'video').replace('_', ' ')}</strong>
                    <span>Status</span><strong><span className={`status-badge ${selectedCourse.status || 'draft'}`}>{selectedCourse.status || 'draft'}</span></strong>
                    <span>Published</span><strong><span className={`status-badge ${selectedCourse.isPublished ? 'published' : 'draft'}`}>{selectedCourse.isPublished ? 'Published' : 'Draft'}</span></strong>
                  </div>
                  <div className="modal-actions">
                    {canApproveTenantCourses && selectedCourse.status !== 'approved' ? (
                      <button
                        type="button"
                        className="primary-button"
                        disabled={statusUpdating}
                        onClick={() => changeCourseStatus(selectedCourse.id, 'approved')}
                      >
                        Approve
                      </button>
                    ) : null}
                    {canApproveTenantCourses && selectedCourse.status !== 'rejected' ? (
                      <button
                        type="button"
                        className="secondary-button"
                        disabled={statusUpdating}
                        onClick={() => changeCourseStatus(selectedCourse.id, 'rejected')}
                      >
                        Reject
                      </button>
                    ) : null}
                    {activeRole === 'instructor' && selectedCourse.instructor?.id === user?.id && ['draft', 'rejected'].includes(selectedCourse.status || 'draft') ? (
                      <button
                        type="button"
                        className="secondary-button"
                        disabled={statusUpdating}
                        onClick={() => changeCourseStatus(selectedCourse.id, 'pending')}
                      >
                        Submit for approval
                      </button>
                    ) : null}
                  </div>

                  <label>
                    Group
                    <select value={selectedGroupId ?? ''} onChange={(event) => setSelectedGroupId(Number(event.target.value) || undefined)} disabled={!groups.length}>
                      <option value="">Select group</option>
                      {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                    </select>
                  </label>

                  {selectedGroup ? (
                    <div className="course-group-summary">
                      <div className="definition-grid">
                        <span>Code</span><strong>{selectedGroup.code ?? '-'}</strong>
                        <span>Group status</span><strong><span className={`status-badge ${selectedGroup.status ?? 'planned'}`}>{selectedGroup.status ?? 'planned'}</span></strong>
                        <span>Dates</span><strong>{selectedGroup.startDate || selectedGroup.endDate ? `${selectedGroup.startDate ?? '-'} - ${selectedGroup.endDate ?? '-'}` : '-'}</strong>
                      </div>
                      <div className="course-group-metrics">
                        <span><FiUsers /><strong>{students.length}</strong> students</span>
                        <span><FiCalendar /><strong>{sessions.length}</strong> sessions</span>
                        <span><FiCheckSquare /><strong>{completedStudents}</strong> completed</span>
                      </div>
                      <div className="progress-cell course-progress-cell">
                        <span style={{ width: `${groupProgressAverage}%` }} />
                        <strong>{groupProgressAverage}% average progress</strong>
                      </div>
                    </div>
                  ) : null}

                  <div className="stack-list">
                    {sessions.slice(0, 5).map((session) => (
                      <article className="stack-list-item" key={session.id}>
                        <div>
                          <strong>{session.title}</strong>
                          <span>{formatDate(session.startsAt)}</span>
                        </div>
                        <strong><span className={`status-badge ${session.status || 'scheduled'}`}>{session.status || 'scheduled'}</span></strong>
                      </article>
                    ))}
                    {!sessions.length ? <span className="muted-text">No sessions for the selected group.</span> : null}
                  </div>
                </>
              )}
            </aside>
          </div>

          {selectedGroup ? (
            <section className="content-section course-roster-section">
              <div className="section-heading-row">
                <div>
                  <h2>Group roster</h2>
                  <span>{selectedGroup.name}</span>
                </div>
              </div>
              <div className="filters-row three roster-filters">
                <input
                  value={studentQuery}
                  onChange={(event) => setStudentQuery(event.target.value)}
                  placeholder="Search student"
                />
                <select value={progressFilter} onChange={(event) => setProgressFilter(event.target.value as 'all' | 'not_started' | 'in_progress' | 'completed')}>
                  <option value="all">All progress</option>
                  <option value="not_started">Not started</option>
                  <option value="in_progress">In progress</option>
                  <option value="completed">Completed</option>
                </select>
                <button type="button" className="secondary-button" onClick={() => {
                  setStudentQuery('');
                  setProgressFilter('all');
                }}>
                  Clear filters
                </button>
              </div>
              {!students.length ? (
                <EmptyState title="No students found" />
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Email</th>
                        <th>Progress</th>
                        <th>Completed</th>
                        <th>Enrolled</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student) => (
                        <tr key={student.userId}>
                          <td>
                            <strong>{student.fullName || `Student #${student.userId}`}</strong>
                            {student.phoneNumber ? <small>{student.phoneNumber}</small> : null}
                          </td>
                          <td>{student.email ?? '-'}</td>
                          <td>
                            <div className="progress-cell">
                              <span style={{ width: `${Math.min(100, Math.max(0, student.progressPercent ?? 0))}%` }} />
                              <strong>{student.progressPercent ?? 0}%</strong>
                            </div>
                          </td>
                          <td><span className={`status-badge ${student.completed ? 'published' : 'draft'}`}>{student.completed ? 'Completed' : 'In progress'}</span></td>
                          <td>{formatDate(student.enrolledAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ) : null}
        </>
      )}
      {createModalOpen ? (
        <FormModal labelledBy="create-course-title" onClose={() => setCreateModalOpen(false)} onSubmit={submitCourse}>
          <div className="modal-header-block">
            <span>Create private tenant course</span>
            <h2 id="create-course-title">New course</h2>
          </div>
          <label>
            Title
            <input
              className={createErrors.title ? 'input-error' : undefined}
              value={createForm.title}
              onChange={(event) => setCreateForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Course title"
              autoFocus
            />
            {createErrors.title ? <small className="field-error">{createErrors.title}</small> : null}
          </label>
          <label>
            Type
            <select
              className={createErrors.courseType ? 'input-error' : undefined}
              value={createForm.courseType}
              onChange={(event) => setCreateForm((current) => ({ ...current, courseType: event.target.value as TenantCourseType }))}
            >
              {courseTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            {createErrors.courseType ? <small className="field-error">{createErrors.courseType}</small> : null}
          </label>
          <label>
            Description
            <textarea
              className={createErrors.description ? 'input-error' : undefined}
              value={createForm.description}
              onChange={(event) => setCreateForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Short description for staff and students"
              rows={4}
            />
            {createErrors.description ? <small className="field-error">{createErrors.description}</small> : null}
          </label>
          {activeTenant?.featureFlags?.['courses.video.enabled'] !== true ? (
            <p className="muted-text">Video course creation is platform-controlled for this tenant.</p>
          ) : null}
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={() => setCreateModalOpen(false)}>Cancel</button>
            <button type="submit" className="primary-button" disabled={creatingCourse || !courseTypeOptions.length}>
              {creatingCourse ? 'Creating...' : 'Create course'}
            </button>
          </div>
        </FormModal>
      ) : null}
    </>
  );
}
