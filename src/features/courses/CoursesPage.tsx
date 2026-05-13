import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { FiBookOpen, FiCalendar, FiCheckSquare, FiEdit2, FiFileText, FiPlus, FiUsers } from 'react-icons/fi';
import { PageHeader } from '../../components/PageHeader';
import { StatGrid } from '../../components/StatGrid';
import { EmptyState, ErrorState, LoadingState } from '../../components/DataState';
import { FormModal } from '../../components/Modal';
import { createTenantCourse, listCourseGroups, listGroupSessions, listGroupStudents, listHomework, listTenantCourses, listTenantMembers, updateCourseStatus, updateTenantCourse } from '../../services/api';
import type { CompanyMember, Course, CourseGroup, CourseSession, GroupStudent, SessionHomework } from '../../types/domain';
import { useTenant } from '../tenant/TenantProvider';
import { useAuth } from '../auth/AuthProvider';
import { getEffectiveTenantRole } from '../tenant/tenantRoles';
import { formatDate, readable } from '../../lib/format';
import { useAsyncLoadState } from '../../lib/asyncState';
import { isCourseWorkflowReady, nextWorkflowSearchParams, workflowPath } from '../workflows/workflowContext';

type TenantCourseType = 'offline' | 'online_live' | 'video';

export function CoursesPage() {
  const { t } = useTranslation();
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
  const [unfilteredStudents, setUnfilteredStudents] = useState<GroupStudent[]>([]);
  const [homework, setHomework] = useState<SessionHomework[]>([]);
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | undefined>();
  const [selectedGroupId, setSelectedGroupId] = useState<number | undefined>();
  const [query, setQuery] = useState('');
  const [studentQuery, setStudentQuery] = useState('');
  const [progressFilter, setProgressFilter] = useState<'all' | 'not_started' | 'in_progress' | 'completed'>('all');
  const courseLoad = useAsyncLoadState(false);
  const courseDetailLoad = useAsyncLoadState(false);
  const groupDetailLoad = useAsyncLoadState(false);
  const {
    start: startCourseLoad,
    succeed: succeedCourseLoad,
    fail: failCourseLoad,
    retry: retryCourseLoad,
    reloadToken: courseReloadToken,
  } = courseLoad;
  const {
    start: startCourseDetailLoad,
    succeed: succeedCourseDetailLoad,
    fail: failCourseDetailLoad,
    retry: retryCourseDetailLoad,
    reloadToken: courseDetailReloadToken,
  } = courseDetailLoad;
  const {
    start: startGroupDetailLoad,
    succeed: succeedGroupDetailLoad,
    fail: failGroupDetailLoad,
    retry: retryGroupDetailLoad,
    reloadToken: groupDetailReloadToken,
  } = groupDetailLoad;
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
    if (flags['courses.offline.enabled'] !== false) options.push({ value: 'offline', label: t('courses.typeOffline') });
    if (flags['courses.onlineLive.enabled'] !== false) options.push({ value: 'online_live', label: t('courses.typeOnlineLive') });
    if (flags['courses.video.enabled'] === true) options.push({ value: 'video', label: t('courses.typeVideo') });
    return options;
  }, [activeTenant?.featureFlags, t]);

  const courseTypeLabel = (value: Course['courseType'] | string | undefined | null) => (
    value === 'offline'
      ? t('courses.typeOffline')
      : value === 'online_live'
        ? t('courses.typeOnlineLive')
        : t('courses.typeVideo')
  );
  const statusLabel = (value: string | undefined | null) => {
    const status = value || 'draft';
    const key = status.replaceAll('_', '');
    const statusKeys: Record<string, string> = {
      approved: 'courses.statusApproved',
      completed: 'courses.completed',
      draft: 'courses.statusDraft',
      inprogress: 'courses.progressInProgress',
      notstarted: 'courses.progressNotStarted',
      pending: 'courses.statusPending',
      planned: 'courses.statusPlanned',
      rejected: 'courses.statusRejected',
      scheduled: 'courses.statusScheduled',
    };
    return statusKeys[key] ? t(statusKeys[key]) : readable(status);
  };
  const publishLabel = (published?: boolean | null) => t(published ? 'courses.published' : 'courses.draft');
  const workflowBlockerMessage = (course: Course | undefined, requireDelivery = true) => {
    if (!course) return t('courses.blockerChooseCourse');
    if (requireDelivery && !['offline', 'online_live'].includes(String(course.courseType ?? ''))) {
      return t('courses.blockerDeliveryType');
    }
    if (course.status !== 'approved') return t('courses.blockerApproval');
    if (course.isPublished !== true) return t('courses.blockerPublish');
    return '';
  };

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
  const courseBlockerMessage = workflowBlockerMessage(selectedCourse, false);
  const courseDeliveryBlockerMessage = workflowBlockerMessage(selectedCourse);

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
      succeedCourseLoad();
      return undefined;
    }
    startCourseLoad();
    Promise.all([
      listTenantCourses(activeTenantId),
      canAssignInstructor ? listTenantMembers(activeTenantId).catch(() => [] as CompanyMember[]) : Promise.resolve([] as CompanyMember[]),
    ])
      .then(([items, nextMembers]) => {
        if (cancelled) return;
        setCourses(items);
        setMembers(nextMembers);
        succeedCourseLoad();
      })
      .catch(() => {
        if (!cancelled) {
          failCourseLoad();
          toast.error(t('courses.loadFailed'));
        }
      })
    return () => {
      cancelled = true;
    };
  }, [activeTenantId, canAssignInstructor, courseReloadToken, failCourseLoad, startCourseLoad, succeedCourseLoad, t]);

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
    setUnfilteredStudents([]);
    setHomework([]);
    setSelectedGroupId(undefined);
    if (!selectedCourseId) {
      succeedCourseDetailLoad();
      return;
    }

    let cancelled = false;
    startCourseDetailLoad();
    Promise.all([listCourseGroups(selectedCourseId), listHomework(selectedCourseId)])
      .then(([nextGroups, nextHomework]) => {
        if (cancelled) return;
        setGroups(nextGroups);
        setHomework(nextHomework);
        succeedCourseDetailLoad();
      })
      .catch(() => {
        if (!cancelled) {
          failCourseDetailLoad();
          toast.error(t('courses.detailLoadFailed'));
        }
      })
    return () => {
      cancelled = true;
    };
  }, [courseDetailReloadToken, failCourseDetailLoad, selectedCourseId, startCourseDetailLoad, succeedCourseDetailLoad, t]);

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
    setUnfilteredStudents([]);
    if (!selectedGroupId) {
      succeedGroupDetailLoad();
      return;
    }

    let cancelled = false;
    startGroupDetailLoad();
    Promise.all([listGroupSessions(selectedGroupId), listGroupStudents(selectedGroupId, { limit: 200 })])
      .then(([nextSessions, nextStudents]) => {
        if (cancelled) return;
        setSessions(nextSessions);
        setStudents(nextStudents);
        setUnfilteredStudents(nextStudents);
        succeedGroupDetailLoad();
      })
      .catch(() => {
        if (!cancelled) {
          failGroupDetailLoad();
          toast.error(t('courses.groupDetailLoadFailed'));
        }
      })
    return () => {
      cancelled = true;
    };
  }, [failGroupDetailLoad, groupDetailReloadToken, selectedGroupId, startGroupDetailLoad, succeedGroupDetailLoad, t]);

  useEffect(() => {
    if (!selectedGroupId) return;
    if (!studentQuery.trim() && progressFilter === 'all') {
      setStudents(unfilteredStudents);
      return;
    }
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
          if (!cancelled) toast.error(t('courses.studentFilterFailed'));
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [progressFilter, selectedGroupId, studentQuery, t, unfilteredStudents]);

  const stats = useMemo(() => [
    { label: t('courses.groups'), value: groups.length, hint: selectedCourse?.title ?? t('courses.selectedCourse') },
    { label: t('courses.sessions'), value: sessions.length, hint: selectedGroup?.name ?? t('courses.selectedGroup') },
    { label: t('courses.students'), value: students.length, hint: t('courses.currentRoster') },
    { label: t('courses.homework'), value: homework.length, hint: t('courses.courseAssignments') },
  ], [groups.length, homework.length, selectedCourse?.title, selectedGroup?.name, sessions.length, students.length, t]);

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
    if (createForm.title.trim().length < 2) errors.title = t('courses.titleRequired');
    if (createForm.description.trim().length < 10) errors.description = t('courses.descriptionRequired');
    if (!courseTypeOptions.some((option) => option.value === createForm.courseType)) {
      errors.courseType = t('courses.courseTypeDisabled');
    }
    if (!createForm.instructorId) errors.instructorId = t('courses.instructorRequired');
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
      toast.success(t('courses.created'));
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || t('courses.createFailed'));
    } finally {
      setCreatingCourse(false);
    }
  };

  const saveCourse = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCourse) return;

    const errors: Record<string, string> = {};
    if (createForm.title.trim().length < 2) errors.title = t('courses.titleRequired');
    if (createForm.description.trim().length < 10) errors.description = t('courses.descriptionRequired');
    if (!courseTypeOptions.some((option) => option.value === createForm.courseType)) {
      errors.courseType = t('courses.courseTypeDisabled');
    }
    if (!createForm.instructorId) errors.instructorId = t('courses.instructorRequired');
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
      toast.success(t('courses.updated'));
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || t('courses.updateFailed'));
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
      toast.success(status === 'approved' ? t('courses.approved') : status === 'rejected' ? t('courses.rejected') : t('courses.submitted'));
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || t('courses.statusUpdateFailed'));
    } finally {
      setStatusUpdating(false);
    }
  };

  if (courseLoad.loading) return <LoadingState label={t('courses.loading')} />;
  if (courseLoad.failed) {
    return (
      <ErrorState
        message={t('courses.loadFailed')}
        action={<button type="button" className="secondary-button" onClick={retryCourseLoad}>{t('actions.retry')}</button>}
      />
    );
  }

  return (
    <>
      <PageHeader
        title={t('navigation.courses')}
        eyebrow={activeTenant?.name}
        actions={canCreateCourse ? (
          <button type="button" className="primary-button" onClick={openCreateModal} disabled={!courseTypeOptions.length}>
            <FiPlus />
            {t('courses.createCourse')}
          </button>
        ) : null}
      />
      <div className="filters-row">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('courses.searchPlaceholder')}
        />
        <select value={selectedCourseId ?? ''} onChange={(event) => setSelectedCourseId(Number(event.target.value) || undefined)}>
          <option value="">{t('courses.selectCourse')}</option>
          {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
        </select>
      </div>
      {!courses.length ? (
        <EmptyState
          title={t('courses.emptyTitle')}
          detail={canCreateCourse ? t('courses.emptyCreateDetail') : t('courses.emptyAssignedDetail')}
          action={canCreateCourse ? (
            <button type="button" className="secondary-button" onClick={openCreateModal} disabled={!courseTypeOptions.length}>{t('courses.createCourse')}</button>
          ) : <Link className="secondary-link-button" to="/settings">{t('courses.reviewSettings')}</Link>}
        />
      ) : (
        <>
          <StatGrid items={stats} />
          {selectedCourse ? (
            <section className="course-context-strip workflow-context-panel" aria-label={t('courses.selectedSummary')}>
              <div>
                <span className="ui-kicker">{t('courses.selectedCourse')}</span>
                <h2>{selectedCourse.title}</h2>
                <p>
                  {selectedCourseOperational
                    ? t('courses.operationalDetail')
                    : courseBlockerMessage}
                </p>
                <div className="course-context-metrics">
                  <span><strong>{groups.length}</strong> {t('courses.groupsLower')}</span>
                  <span><strong>{selectedCourse.enrolledStudents ?? 0}</strong> {t('courses.enrolledLower')}</span>
                  <span><strong>{homework.length}</strong> {t('courses.homeworkLower')}</span>
                </div>
              </div>
              <div className="course-context-badges">
                <span className="muted-text">{courseTypeLabel(selectedCourse.courseType)}</span>
                <span className={`status-badge ${selectedCourse.status || 'draft'}`}>{statusLabel(selectedCourse.status)}</span>
                <span className={`status-badge ${selectedCourse.isPublished ? 'published' : 'draft'}`}>
                  {publishLabel(selectedCourse.isPublished)}
                </span>
              </div>
            </section>
          ) : null}
          <div className="workspace-grid">
            <section className="content-section">
              <h2>{t('courses.tenantCatalog')}</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t('courses.course')}</th>
                      <th>{t('courses.type')}</th>
                      <th>{t('courses.status')}</th>
                      <th>{t('courses.publishedColumn')}</th>
                      <th>{t('courses.students')}</th>
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
                        <td>{courseTypeLabel(course.courseType)}</td>
                        <td><span className={`status-badge ${course.status || 'draft'}`}>{statusLabel(course.status)}</span></td>
                        <td><span className={`status-badge ${course.isPublished ? 'published' : 'draft'}`}>{publishLabel(course.isPublished)}</span></td>
                        <td>{course.enrolledStudents ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!filteredCourses.length ? (
                <EmptyState
                  title={t('courses.noMatchesTitle')}
                  detail={t('courses.noMatchesDetail')}
                  action={<button type="button" className="secondary-button" onClick={() => setQuery('')}>{t('courses.clearSearch')}</button>}
                />
              ) : null}
            </section>

            <aside className="settings-panel workflow-context-panel">
              <div className="section-heading-row compact">
                <div>
                  <h2>{t('courses.operations')}</h2>
                  <span>{selectedCourse?.title ?? t('courses.selectCourse')}</span>
                </div>
              </div>
              {!selectedCourse ? (
                <EmptyState title={t('courses.selectCourse')} detail={t('courses.selectCourseDetail')} />
              ) : courseDetailLoad.loading || groupDetailLoad.loading ? (
                <LoadingState label={t('courses.loadingDetail')} />
              ) : courseDetailLoad.failed || groupDetailLoad.failed ? (
                <ErrorState
                  message={courseDetailLoad.failed ? t('courses.detailLoadFailed') : t('courses.groupDetailLoadFailed')}
                  action={(
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={courseDetailLoad.failed ? retryCourseDetailLoad : retryGroupDetailLoad}
                    >
                      {t('actions.retry')}
                    </button>
                  )}
                />
              ) : (
                <div className="course-operations-stack">
                  <section className="course-panel-block">
                    <h3>{t('courses.nextActions')}</h3>
                    <div className="course-action-grid">
                      {selectedCourseDeliveryReady ? (
                        <Link className="course-action-card" to={workflowPath('/groups', selectedScope)}>
                          <FiUsers />
                          <span>{t('courses.groups')}</span>
                        </Link>
                      ) : (
                        <span className="course-action-card disabled"><FiUsers /><span>{t('courses.groups')}</span></span>
                      )}
                      {selectedCourseDeliveryReady ? (
                        <Link className="course-action-card" to={workflowPath('/sessions', selectedScope)}>
                          <FiCalendar />
                          <span>{t('courses.sessions')}</span>
                        </Link>
                      ) : (
                        <span className="course-action-card disabled"><FiCalendar /><span>{t('courses.sessions')}</span></span>
                      )}
                      {attendanceEnabled ? (
                        selectedCourseDeliveryReady ? (
                          <Link className="course-action-card" to={workflowPath('/attendance', selectedScope)}>
                            <FiCheckSquare />
                            <span>{t('navigation.attendance')}</span>
                          </Link>
                        ) : (
                          <span className="course-action-card disabled"><FiCheckSquare /><span>{t('navigation.attendance')}</span></span>
                        )
                      ) : null}
                      {homeworkEnabled ? (
                        selectedCourseOperational ? (
                          <Link className="course-action-card" to={workflowPath('/homework', selectedScope)}>
                            <FiFileText />
                            <span>{t('courses.homework')}</span>
                          </Link>
                        ) : (
                          <span className="course-action-card disabled"><FiFileText /><span>{t('courses.homework')}</span></span>
                        )
                      ) : null}
                      {certificatesEnabled ? (
                        selectedCourseOperational ? (
                          <Link className="course-action-card" to={workflowPath('/certificates', { courseId: selectedCourse.id, tab: 'rules' })}>
                            <FiBookOpen />
                            <span>{t('navigation.certificates')}</span>
                          </Link>
                        ) : (
                          <span className="course-action-card disabled"><FiBookOpen /><span>{t('navigation.certificates')}</span></span>
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
                    <h3>{t('courses.courseState')}</h3>
                    <div className="definition-grid">
                      <span>{t('courses.course')}</span><strong>{selectedCourse.title}</strong>
                      <span>{t('courses.type')}</span><strong>{courseTypeLabel(selectedCourse.courseType)}</strong>
                      <span>{t('courses.status')}</span><strong><span className={`status-badge ${selectedCourse.status || 'draft'}`}>{statusLabel(selectedCourse.status)}</span></strong>
                      <span>{t('courses.publishedColumn')}</span><strong><span className={`status-badge ${selectedCourse.isPublished ? 'published' : 'draft'}`}>{publishLabel(selectedCourse.isPublished)}</span></strong>
                    </div>
                    <div className="modal-actions">
                      {canEditCourse ? (
                        <button type="button" className="secondary-button" onClick={openEditModal}>
                          <FiEdit2 />
                          {t('courses.editCourse')}
                        </button>
                      ) : null}
                      {canApproveTenantCourses && selectedCourse.status === 'pending' ? (
                        <button
                          type="button"
                          className="primary-button"
                          disabled={statusUpdating}
                          onClick={() => changeCourseStatus(selectedCourse.id, 'approved')}
                        >
                          {t('courses.approve')}
                        </button>
                      ) : null}
                      {canApproveTenantCourses && selectedCourse.status === 'pending' ? (
                        <button
                          type="button"
                          className="secondary-button"
                          disabled={statusUpdating}
                          onClick={() => changeCourseStatus(selectedCourse.id, 'rejected')}
                        >
                          {t('courses.reject')}
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
                          {t('courses.submitForApproval')}
                        </button>
                      ) : null}
                    </div>
                  </section>

                  <section className="course-panel-block">
                    <h3>{t('courses.selectedGroup')}</h3>
                    <label>
                      {t('courses.group')}
                      <select value={selectedGroupId ?? ''} onChange={(event) => setSelectedGroupId(Number(event.target.value) || undefined)} disabled={!groups.length}>
                        <option value="">{t('courses.selectGroup')}</option>
                        {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                      </select>
                    </label>

                  {selectedGroup ? (
                    <div className="course-group-summary workflow-context-panel compact">
                      <div className="definition-grid">
                        <span>{t('courses.code')}</span><strong>{selectedGroup.code ?? '-'}</strong>
                        <span>{t('courses.groupStatus')}</span><strong><span className={`status-badge ${selectedGroup.status ?? 'planned'}`}>{statusLabel(selectedGroup.status)}</span></strong>
                        <span>{t('courses.dates')}</span><strong>{selectedGroup.startDate || selectedGroup.endDate ? `${selectedGroup.startDate ?? '-'} - ${selectedGroup.endDate ?? '-'}` : '-'}</strong>
                      </div>
                      <div className="course-group-metrics">
                        <span><FiUsers /><strong>{students.length}</strong> {t('courses.studentsLower')}</span>
                        <span><FiCalendar /><strong>{sessions.length}</strong> {t('courses.sessionsLower')}</span>
                        <span><FiCheckSquare /><strong>{completedStudents}</strong> {t('courses.completedLower')}</span>
                      </div>
                      <div className="progress-cell course-progress-cell">
                        <span style={{ width: `${groupProgressAverage}%` }} />
                        <strong>{t('courses.averageProgress', { percent: groupProgressAverage })}</strong>
                      </div>
                    </div>
                  ) : null}
                  </section>

                  <section className="course-panel-block">
                    <h3>{t('courses.recentSessions')}</h3>
                    <div className="stack-list">
                      {sessions.slice(0, 5).map((session) => (
                        <article className="stack-list-item" key={session.id}>
                          <div>
                            <strong>{session.title}</strong>
                            <span>{formatDate(session.startsAt)}</span>
                          </div>
                          <strong><span className={`status-badge ${session.status || 'scheduled'}`}>{statusLabel(session.status)}</span></strong>
                        </article>
                      ))}
                      {!sessions.length ? <span className="muted-text">{t('courses.noSessions')}</span> : null}
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
                  <h2>{t('courses.groupRoster')}</h2>
                  <span>{selectedGroup.name}</span>
                </div>
                <strong className="muted-count">{t('courses.shownCount', { count: students.length })}</strong>
              </div>
              <div className="filters-row three roster-filters">
                <input
                  value={studentQuery}
                  onChange={(event) => setStudentQuery(event.target.value)}
                  placeholder={t('courses.searchStudent')}
                />
                <select value={progressFilter} onChange={(event) => setProgressFilter(event.target.value as 'all' | 'not_started' | 'in_progress' | 'completed')}>
                  <option value="all">{t('courses.allProgress')}</option>
                  <option value="not_started">{t('courses.progressNotStarted')}</option>
                  <option value="in_progress">{t('courses.progressInProgress')}</option>
                  <option value="completed">{t('courses.completed')}</option>
                </select>
                <button type="button" className="secondary-button" onClick={() => {
                  setStudentQuery('');
                  setProgressFilter('all');
                }}>
                  {t('courses.clearFilters')}
                </button>
              </div>
              {!students.length ? (
                <EmptyState
                  title={studentQuery.trim() || progressFilter !== 'all' ? t('courses.noMatchingStudents') : t('courses.noStudentsTitle')}
                  detail={studentQuery.trim() || progressFilter !== 'all'
                    ? t('courses.noMatchingStudentsDetail')
                    : t('courses.noStudentsDetail')}
                  action={studentQuery.trim() || progressFilter !== 'all' ? (
                    <button type="button" className="secondary-button" onClick={() => {
                      setStudentQuery('');
                      setProgressFilter('all');
                    }}>
                      {t('courses.clearFilters')}
                    </button>
                  ) : null}
                />
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>{t('courses.student')}</th>
                        <th>{t('courses.email')}</th>
                        <th>{t('courses.progress')}</th>
                        <th>{t('courses.completed')}</th>
                        <th>{t('courses.enrolled')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student) => (
                        <tr key={student.userId}>
                          <td>
                            <strong>{student.fullName || t('courses.studentFallback', { id: student.userId })}</strong>
                            {student.phoneNumber ? <small>{student.phoneNumber}</small> : null}
                          </td>
                          <td>{student.email ?? '-'}</td>
                          <td>
                            <div className="progress-cell">
                              <span style={{ width: `${Math.min(100, Math.max(0, student.progressPercent ?? 0))}%` }} />
                              <strong>{student.progressPercent ?? 0}%</strong>
                            </div>
                          </td>
                          <td>{student.completed ? t('courses.completed') : t('courses.progressInProgress')}</td>
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
            <span>{t('courses.createModalEyebrow')}</span>
            <h2 id="create-course-title">{t('courses.newCourse')}</h2>
          </div>
          <label>
            {t('courses.title')}
            <input
              className={createErrors.title ? 'input-error' : undefined}
              value={createForm.title}
              onChange={(event) => setCreateForm((current) => ({ ...current, title: event.target.value }))}
              placeholder={t('courses.titlePlaceholder')}
              autoFocus
            />
            {createErrors.title ? <small className="field-error">{createErrors.title}</small> : null}
          </label>
          <label>
            {t('courses.type')}
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
            {t('courses.description')}
            <textarea
              className={createErrors.description ? 'input-error' : undefined}
              value={createForm.description}
              onChange={(event) => setCreateForm((current) => ({ ...current, description: event.target.value }))}
              placeholder={t('courses.descriptionPlaceholder')}
              rows={4}
            />
            {createErrors.description ? <small className="field-error">{createErrors.description}</small> : null}
          </label>
          <label>
            {t('courses.instructor')}
            <select
              className={createErrors.instructorId ? 'input-error' : undefined}
              value={createForm.instructorId ?? ''}
              onChange={(event) => setCreateForm((current) => ({ ...current, instructorId: Number(event.target.value) || undefined }))}
              disabled={activeRole === 'instructor'}
            >
              <option value="">{t('courses.selectInstructor')}</option>
              {instructorMembers.map((member) => (
                <option key={`${member.userId}-${member.role}`} value={member.userId}>
                  {member.fullName || member.user?.fullName || member.email || member.user?.email || t('courses.userFallback', { id: member.userId })}
                </option>
              ))}
            </select>
            {createErrors.instructorId ? <small className="field-error">{createErrors.instructorId}</small> : null}
          </label>
          {activeTenant?.featureFlags?.['courses.video.enabled'] !== true ? (
            <p className="muted-text">{t('courses.videoControlled')}</p>
          ) : null}
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={() => setCreateModalOpen(false)}>{t('courses.cancel')}</button>
            <button type="submit" className="primary-button" disabled={creatingCourse || !courseTypeOptions.length}>
              {creatingCourse ? t('courses.creating') : t('courses.createCourse')}
            </button>
          </div>
        </FormModal>
      ) : null}
      {editModalOpen && selectedCourse ? (
        <FormModal labelledBy="edit-course-title" onClose={() => { setEditModalOpen(false); setCreateErrors({}); }} onSubmit={saveCourse}>
          <div className="modal-header-block">
            <span>{t('courses.privateTenantCourse')}</span>
            <h2 id="edit-course-title">{t('courses.editCourse')}</h2>
          </div>
          <label>
            {t('courses.title')}
            <input
              className={createErrors.title ? 'input-error' : undefined}
              value={createForm.title}
              onChange={(event) => setCreateForm((current) => ({ ...current, title: event.target.value }))}
              placeholder={t('courses.titlePlaceholder')}
              autoFocus
            />
            {createErrors.title ? <small className="field-error">{createErrors.title}</small> : null}
          </label>
          <label>
            {t('courses.type')}
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
            {t('courses.description')}
            <textarea
              className={createErrors.description ? 'input-error' : undefined}
              value={createForm.description}
              onChange={(event) => setCreateForm((current) => ({ ...current, description: event.target.value }))}
              placeholder={t('courses.descriptionPlaceholder')}
              rows={4}
            />
            {createErrors.description ? <small className="field-error">{createErrors.description}</small> : null}
          </label>
          <label>
            {t('courses.instructor')}
            <select
              className={createErrors.instructorId ? 'input-error' : undefined}
              value={createForm.instructorId ?? ''}
              onChange={(event) => setCreateForm((current) => ({ ...current, instructorId: Number(event.target.value) || undefined }))}
              disabled={activeRole === 'instructor'}
            >
              <option value="">{t('courses.selectInstructor')}</option>
              {instructorMembers.map((member) => (
                <option key={`${member.userId}-${member.role}`} value={member.userId}>
                  {member.fullName || member.user?.fullName || member.email || member.user?.email || t('courses.userFallback', { id: member.userId })}
                </option>
              ))}
            </select>
            {createErrors.instructorId ? <small className="field-error">{createErrors.instructorId}</small> : null}
          </label>
          <p className="muted-text">{t('courses.privateScopeNote')}</p>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={() => setEditModalOpen(false)} disabled={savingCourse}>{t('courses.cancel')}</button>
            <button type="submit" className="primary-button" disabled={savingCourse || !courseTypeOptions.length}>
              {savingCourse ? t('courses.saving') : t('courses.saveCourse')}
            </button>
          </div>
        </FormModal>
      ) : null}
    </>
  );
}
