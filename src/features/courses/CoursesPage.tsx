import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiBookOpen, FiCalendar, FiCheckSquare, FiEdit2, FiFileText, FiPlus, FiUsers } from 'react-icons/fi';
import { PageHeader } from '../../components/PageHeader';
import { StatGrid } from '../../components/StatGrid';
import { EmptyState, LoadingState } from '../../components/DataState';
import { FormModal } from '../../components/Modal';
import { createTenantCourse, listCourseGroups, listGroupSessions, listGroupStudents, listHomework, listTenantCourses, listTenantMembers, updateCourseStatus, updateTenantCourse } from '../../services/api';
import type { CompanyMember, Course, CourseGroup, CourseSession, GroupStudent, SessionHomework } from '../../types/domain';
import { useTenant } from '../tenant/TenantProvider';
import { useAuth } from '../auth/AuthProvider';
import { getEffectiveTenantRole } from '../tenant/tenantRoles';
import { formatDate, readable } from '../../lib/format';
import { courseWorkflowBlocker, formatCourseType, isCourseWorkflowReady, nextWorkflowSearchParams, workflowPath } from '../workflows/workflowContext';

type TenantCourseType = 'offline' | 'online_live' | 'video';

export function CoursesPage() {
  const { activeTenant } = useTenant();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTenantId = activeTenant?.id;
  const requestedCourseId = Number(searchParams.get('courseId')) || undefined;
  const requestedGroupId = Number(searchParams.get('groupId')) || undefined;
  const [courses, setCourses] = useState<Course[]>([]);
  const [groups, setGroups] = useState<CourseGroup[]>([]);
  const [sessions, setSessions] = useState<CourseSession[]>([]);
  const [students, setStudents] = useState<GroupStudent[]>([]);
  const [homework, setHomework] = useState<SessionHomework[]>([]);
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | undefined>();
  const [selectedGroupId, setSelectedGroupId] = useState<number | undefined>();
  const [query, setQuery] = useState('');
  const [studentQuery, setStudentQuery] = useState('');
  const [progressFilter, setProgressFilter] = useState<'all' | 'not_started' | 'in_progress' | 'completed'>('all');
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [creatingCourse, setCreatingCourse] = useState(false);
  const [savingCourse, setSavingCourse] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    courseType: 'offline' as TenantCourseType,
    instructorId: undefined as number | undefined,
  });

  const activeRole = getEffectiveTenantRole(user, activeTenant);
  const canCreateCourse = ['owner', 'company_admin', 'instructor'].includes(activeRole);
  const canApproveTenantCourses = ['owner', 'company_admin'].includes(activeRole);
  const canAssignInstructor = canApproveTenantCourses;
  const featureEnabled = (key: string) => activeTenant?.featureFlags?.[key] !== false;
  const attendanceEnabled = featureEnabled('attendance.enabled');
  const homeworkEnabled = featureEnabled('homework.enabled');
  const certificatesEnabled = featureEnabled('certificates.enabled');

  const courseTypeOptions = useMemo(() => {
    const flags = activeTenant?.featureFlags ?? {};
    const options: Array<{ value: TenantCourseType; label: string }> = [];
    if (flags['courses.offline.enabled'] !== false) options.push({ value: 'offline', label: 'Offline' });
    if (flags['courses.onlineLive.enabled'] !== false) options.push({ value: 'online_live', label: 'Online live' });
    if (flags['courses.video.enabled'] === true) options.push({ value: 'video', label: 'Video' });
    return options;
  }, [activeTenant?.featureFlags]);

  const instructorMembers = useMemo(
    () => {
      if (canAssignInstructor) {
        return members.filter((member) => String(member.role).toLowerCase() === 'instructor');
      }
      if (activeRole === 'instructor' && user?.id) {
        return [{
          userId: user.id,
          role: 'instructor',
          fullName: user.fullName,
          email: user.email,
        } satisfies CompanyMember];
      }
      return [];
    },
    [activeRole, canAssignInstructor, members, user?.email, user?.fullName, user?.id],
  );

  const filteredCourses = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return courses;
    return courses.filter((course) => (
      course.title.toLowerCase().includes(normalized)
      || (course.courseType ?? '').toLowerCase().includes(normalized)
      || (course.status ?? '').toLowerCase().includes(normalized)
    ));
  }, [courses, query]);

  useEffect(() => {
    if (!query.trim()) return;
    if (!filteredCourses.length) return;
    if (selectedCourseId && filteredCourses.some((course) => course.id === selectedCourseId)) return;
    setSelectedCourseId(filteredCourses[0].id);
  }, [filteredCourses, query, selectedCourseId]);

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === selectedCourseId),
    [courses, selectedCourseId],
  );
  const canEditCourse = Boolean(selectedCourse && (canApproveTenantCourses || (activeRole === 'instructor' && selectedCourse.instructor?.id === user?.id)));
  const selectedCourseOperational = isCourseWorkflowReady(selectedCourse, false);
  const selectedCourseDeliveryReady = isCourseWorkflowReady(selectedCourse);
  const courseBlockerMessage = courseWorkflowBlocker(selectedCourse, false);
  const courseDeliveryBlockerMessage = courseWorkflowBlocker(selectedCourse);

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId),
    [groups, selectedGroupId],
  );
  const selectedScope = {
    courseId: selectedCourse?.id,
    groupId: selectedGroup?.id,
  };

  const searchParamsString = searchParams.toString();

  useEffect(() => {
    let cancelled = false;
    setCourses([]);
    setGroups([]);
    setSessions([]);
    setStudents([]);
    setHomework([]);
    setMembers([]);
    setSelectedCourseId(undefined);
    setSelectedGroupId(undefined);
    if (!activeTenantId) {
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    Promise.all([
      listTenantCourses(activeTenantId),
      canAssignInstructor ? listTenantMembers(activeTenantId).catch(() => [] as CompanyMember[]) : Promise.resolve([] as CompanyMember[]),
    ])
      .then(([items, nextMembers]) => {
        if (cancelled) return;
        setCourses(items);
        setMembers(nextMembers);
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
  }, [activeTenantId, canAssignInstructor]);

  useEffect(() => {
    setSelectedCourseId((current) => {
      if (!courses.length) return undefined;
      if (requestedCourseId && courses.some((course) => course.id === requestedCourseId)) return requestedCourseId;
      return current && courses.some((course) => course.id === current) ? current : courses[0]?.id;
    });
  }, [courses, requestedCourseId]);

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
    setSelectedGroupId((current) => {
      if (!groups.length) return undefined;
      if (requestedGroupId && groups.some((group) => group.id === requestedGroupId)) return requestedGroupId;
      return current && groups.some((group) => group.id === current) ? current : groups[0]?.id;
    });
  }, [groups, requestedGroupId]);

  useEffect(() => {
    const next = nextWorkflowSearchParams(searchParamsString, { courseId: selectedCourseId, groupId: selectedGroupId });
    if (next.toString() !== searchParamsString) {
      setSearchParams(next, { replace: true });
    }
  }, [searchParamsString, selectedCourseId, selectedGroupId, setSearchParams]);

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
    if (!studentQuery.trim() && progressFilter === 'all') return;
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
      instructorId: activeRole === 'instructor' ? user?.id : instructorMembers[0]?.userId,
    });
    setCreateModalOpen(true);
  };

  const openEditModal = () => {
    if (!selectedCourse) return;
    setCreateErrors({});
    setCreateForm({
      title: selectedCourse.title ?? '',
      description: selectedCourse.description ?? '',
      courseType: (selectedCourse.courseType ?? courseTypeOptions[0]?.value ?? 'offline') as TenantCourseType,
      instructorId: selectedCourse.instructor?.id ?? (activeRole === 'instructor' ? user?.id : instructorMembers[0]?.userId),
    });
    setEditModalOpen(true);
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
    if (!createForm.instructorId) errors.instructorId = 'Select a tenant instructor.';
    setCreateErrors(errors);
    if (Object.keys(errors).length) return;

    setCreatingCourse(true);
    try {
      const created = await createTenantCourse(activeTenantId, {
        title: createForm.title.trim(),
        description: createForm.description.trim(),
        courseType: createForm.courseType,
        instructorId: createForm.instructorId,
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

  const saveCourse = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCourse) return;

    const errors: Record<string, string> = {};
    if (createForm.title.trim().length < 2) errors.title = 'Course title is required.';
    if (createForm.description.trim().length < 10) errors.description = 'Add a short course description.';
    if (!courseTypeOptions.some((option) => option.value === createForm.courseType)) {
      errors.courseType = 'This course type is not enabled for this tenant.';
    }
    if (!createForm.instructorId) errors.instructorId = 'Select a tenant instructor.';
    setCreateErrors(errors);
    if (Object.keys(errors).length) return;

    setSavingCourse(true);
    try {
      await updateTenantCourse(selectedCourse.id, {
        title: createForm.title.trim(),
        description: createForm.description.trim(),
        courseType: createForm.courseType,
        instructorId: createForm.instructorId,
      });
      await reloadCourses(selectedCourse.id);
      setEditModalOpen(false);
      toast.success('Course updated');
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || 'Could not update course');
    } finally {
      setSavingCourse(false);
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
          detail={canCreateCourse ? 'Create a private offline or live course for this tenant.' : 'Assigned tenant courses will appear here when they are ready for delivery.'}
          action={canCreateCourse ? (
            <button type="button" className="secondary-button" onClick={openCreateModal} disabled={!courseTypeOptions.length}>Create course</button>
          ) : <Link className="secondary-link-button" to="/settings">Review tenant settings</Link>}
        />
      ) : (
        <>
          <StatGrid items={stats} />
          {selectedCourse ? (
            <section className="course-context-strip workflow-context-panel" aria-label="Selected course summary">
              <div>
                <span className="ui-kicker">Selected course</span>
                <h2>{selectedCourse.title}</h2>
                <p>
                  {selectedCourseOperational
                    ? 'Approved and published for homework, certificates, and delivery tools.'
                    : courseBlockerMessage}
                </p>
                <div className="course-context-metrics">
                  <span><strong>{groups.length}</strong> groups</span>
                  <span><strong>{selectedCourse.enrolledStudents ?? 0}</strong> enrolled</span>
                  <span><strong>{homework.length}</strong> homework</span>
                </div>
              </div>
              <div className="course-context-badges">
                <span className="status-badge">{formatCourseType(selectedCourse.courseType)}</span>
                <span className={`status-badge ${selectedCourse.status || 'draft'}`}>{readable(selectedCourse.status || 'draft')}</span>
                <span className={`status-badge ${selectedCourse.isPublished ? 'published' : 'draft'}`}>
                  {selectedCourse.isPublished ? 'Published' : 'Draft'}
                </span>
              </div>
            </section>
          ) : null}
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
                      <tr key={course.id} className={course.id === selectedCourseId ? 'selected-row' : ''}>
                        <td>
                          <button
                            type="button"
                            className="table-row-button"
                            aria-pressed={course.id === selectedCourseId}
                            onClick={() => setSelectedCourseId(course.id)}
                          >
                            <strong>{course.title}</strong>
                            {course.instructor?.fullName ? <small>{course.instructor.fullName}</small> : null}
                          </button>
                        </td>
                        <td><span className="status-badge">{formatCourseType(course.courseType)}</span></td>
                        <td><span className={`status-badge ${course.status || 'draft'}`}>{readable(course.status || 'draft')}</span></td>
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

            <aside className="settings-panel workflow-context-panel">
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
                <div className="course-operations-stack">
                  <section className="course-panel-block">
                    <h3>Next actions</h3>
                    <div className="course-action-grid">
                      {selectedCourseDeliveryReady ? (
                        <Link className="course-action-card" to={workflowPath('/groups', selectedScope)}>
                          <FiUsers />
                          <span>Groups</span>
                        </Link>
                      ) : (
                        <span className="course-action-card disabled"><FiUsers /><span>Groups</span></span>
                      )}
                      {selectedCourseDeliveryReady ? (
                        <Link className="course-action-card" to={workflowPath('/sessions', selectedScope)}>
                          <FiCalendar />
                          <span>Sessions</span>
                        </Link>
                      ) : (
                        <span className="course-action-card disabled"><FiCalendar /><span>Sessions</span></span>
                      )}
                      {attendanceEnabled ? (
                        selectedCourseDeliveryReady ? (
                          <Link className="course-action-card" to={workflowPath('/attendance', selectedScope)}>
                            <FiCheckSquare />
                            <span>Attendance</span>
                          </Link>
                        ) : (
                          <span className="course-action-card disabled"><FiCheckSquare /><span>Attendance</span></span>
                        )
                      ) : null}
                      {homeworkEnabled ? (
                        selectedCourseOperational ? (
                          <Link className="course-action-card" to={workflowPath('/homework', selectedScope)}>
                            <FiFileText />
                            <span>Homework</span>
                          </Link>
                        ) : (
                          <span className="course-action-card disabled"><FiFileText /><span>Homework</span></span>
                        )
                      ) : null}
                      {certificatesEnabled ? (
                        selectedCourseOperational ? (
                          <Link className="course-action-card" to={workflowPath('/certificates', { courseId: selectedCourse.id, tab: 'rules' })}>
                            <FiBookOpen />
                            <span>Certificates</span>
                          </Link>
                        ) : (
                          <span className="course-action-card disabled"><FiBookOpen /><span>Certificates</span></span>
                        )
                      ) : null}
                    </div>
                    {!selectedCourseOperational ? (
                      <p className="panel-note">
                        {courseBlockerMessage}
                      </p>
                    ) : !selectedCourseDeliveryReady ? (
                      <p className="panel-note">
                        {courseDeliveryBlockerMessage}
                      </p>
                    ) : null}
                  </section>

                  <section className="course-panel-block">
                    <h3>Course state</h3>
                    <div className="definition-grid">
                      <span>Course</span><strong>{selectedCourse.title}</strong>
                      <span>Type</span><strong>{formatCourseType(selectedCourse.courseType)}</strong>
                      <span>Status</span><strong><span className={`status-badge ${selectedCourse.status || 'draft'}`}>{readable(selectedCourse.status || 'draft')}</span></strong>
                      <span>Published</span><strong><span className={`status-badge ${selectedCourse.isPublished ? 'published' : 'draft'}`}>{selectedCourse.isPublished ? 'Published' : 'Draft'}</span></strong>
                    </div>
                    <div className="modal-actions">
                      {canEditCourse ? (
                        <button type="button" className="secondary-button" onClick={openEditModal}>
                          <FiEdit2 />
                          Edit course
                        </button>
                      ) : null}
                      {canApproveTenantCourses && selectedCourse.status === 'pending' ? (
                        <button
                          type="button"
                          className="primary-button"
                          disabled={statusUpdating}
                          onClick={() => changeCourseStatus(selectedCourse.id, 'approved')}
                        >
                          Approve
                        </button>
                      ) : null}
                      {canApproveTenantCourses && selectedCourse.status === 'pending' ? (
                        <button
                          type="button"
                          className="secondary-button"
                          disabled={statusUpdating}
                          onClick={() => changeCourseStatus(selectedCourse.id, 'rejected')}
                        >
                          Reject
                        </button>
                      ) : null}
                      {['draft', 'rejected'].includes(selectedCourse.status || 'draft') && (
                        canApproveTenantCourses || (activeRole === 'instructor' && selectedCourse.instructor?.id === user?.id)
                      ) ? (
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
                  </section>

                  <section className="course-panel-block">
                    <h3>Selected group</h3>
                    <label>
                      Group
                      <select value={selectedGroupId ?? ''} onChange={(event) => setSelectedGroupId(Number(event.target.value) || undefined)} disabled={!groups.length}>
                        <option value="">Select group</option>
                        {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                      </select>
                    </label>

                  {selectedGroup ? (
                    <div className="course-group-summary workflow-context-panel compact">
                      <div className="definition-grid">
                        <span>Code</span><strong>{selectedGroup.code ?? '-'}</strong>
                        <span>Group status</span><strong><span className={`status-badge ${selectedGroup.status ?? 'planned'}`}>{readable(selectedGroup.status ?? 'planned')}</span></strong>
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
                  </section>

                  <section className="course-panel-block">
                    <h3>Recent sessions</h3>
                    <div className="stack-list">
                      {sessions.slice(0, 5).map((session) => (
                        <article className="stack-list-item" key={session.id}>
                          <div>
                            <strong>{session.title}</strong>
                            <span>{formatDate(session.startsAt)}</span>
                          </div>
                          <strong><span className={`status-badge ${session.status || 'scheduled'}`}>{readable(session.status || 'scheduled')}</span></strong>
                        </article>
                      ))}
                      {!sessions.length ? <span className="muted-text">No sessions for the selected group.</span> : null}
                    </div>
                  </section>
                </div>
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
                <strong className="muted-count">{students.length} shown</strong>
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
                <EmptyState
                  title={studentQuery.trim() || progressFilter !== 'all' ? 'No matching students' : 'No students in this group'}
                  detail={studentQuery.trim() || progressFilter !== 'all'
                    ? 'Clear the roster filters or choose another progress state.'
                    : 'Learners will appear here after they are enrolled in this group.'}
                  action={studentQuery.trim() || progressFilter !== 'all' ? (
                    <button type="button" className="secondary-button" onClick={() => {
                      setStudentQuery('');
                      setProgressFilter('all');
                    }}>
                      Clear filters
                    </button>
                  ) : null}
                />
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
          <label>
            Instructor
            <select
              className={createErrors.instructorId ? 'input-error' : undefined}
              value={createForm.instructorId ?? ''}
              onChange={(event) => setCreateForm((current) => ({ ...current, instructorId: Number(event.target.value) || undefined }))}
              disabled={activeRole === 'instructor'}
            >
              <option value="">Select instructor</option>
              {instructorMembers.map((member) => (
                <option key={`${member.userId}-${member.role}`} value={member.userId}>
                  {member.fullName || member.user?.fullName || member.email || member.user?.email || `User ${member.userId}`}
                </option>
              ))}
            </select>
            {createErrors.instructorId ? <small className="field-error">{createErrors.instructorId}</small> : null}
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
      {editModalOpen && selectedCourse ? (
        <FormModal labelledBy="edit-course-title" onClose={() => { setEditModalOpen(false); setCreateErrors({}); }} onSubmit={saveCourse}>
          <div className="modal-header-block">
            <span>Private tenant course</span>
            <h2 id="edit-course-title">Edit course</h2>
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
          <label>
            Instructor
            <select
              className={createErrors.instructorId ? 'input-error' : undefined}
              value={createForm.instructorId ?? ''}
              onChange={(event) => setCreateForm((current) => ({ ...current, instructorId: Number(event.target.value) || undefined }))}
              disabled={activeRole === 'instructor'}
            >
              <option value="">Select instructor</option>
              {instructorMembers.map((member) => (
                <option key={`${member.userId}-${member.role}`} value={member.userId}>
                  {member.fullName || member.user?.fullName || member.email || member.user?.email || `User ${member.userId}`}
                </option>
              ))}
            </select>
            {createErrors.instructorId ? <small className="field-error">{createErrors.instructorId}</small> : null}
          </label>
          <p className="muted-text">Tenant courses remain private and scoped to this tenant.</p>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={() => setEditModalOpen(false)} disabled={savingCourse}>Cancel</button>
            <button type="submit" className="primary-button" disabled={savingCourse || !courseTypeOptions.length}>
              {savingCourse ? 'Saving...' : 'Save course'}
            </button>
          </div>
        </FormModal>
      ) : null}
    </>
  );
}
