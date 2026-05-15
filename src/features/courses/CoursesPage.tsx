import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { FiBookOpen, FiCalendar, FiCheckSquare, FiEdit2, FiFileText, FiPlus, FiTrash2, FiUsers } from 'react-icons/fi';
import { PageHeader } from '../../components/PageHeader';
import { StatGrid } from '../../components/StatGrid';
import { EmptyState, ErrorState, LoadingState } from '../../components/DataState';
import { FormModal, Modal } from '../../components/Modal';
import { createTenantCourse, deleteTenantCourse, listCourseGroups, listGroupSessions, listGroupStudents, listHomework, listTenantCourses, listTenantMembers, updateCourseStatus, updateTenantCourse } from '../../services/api';
import type { CompanyMember, Course, CourseGroup, CourseSession, GroupStudent, SessionHomework } from '../../types/domain';
import { useTenant } from '../tenant/TenantProvider';
import { useAuth } from '../auth/AuthProvider';
import { canApproveTenantCourses, canManageTenantCourses, getEffectiveTenantRole } from '../tenant/tenantRoles';
import { formatDate } from '../../lib/format';
import { commonStatusLabelKeys, courseTypeLabelKeys, enumLabel } from '../../lib/enumLabels';
import { useAsyncLoadState } from '../../lib/asyncState';
import { isCourseWorkflowReady, nextWorkflowSearchParams, workflowPath } from '../workflows/workflowContext';
import { courseRosterFilterParams, isDefaultCourseRosterFilter, type CourseProgressFilter } from './courseRosterFilters';
import { courseHealthFilters, courseMatchesHealthFilter, getCourseHealthCounts, type CourseHealthFilter, type CourseHealthSummary } from './courseHealth';

type TenantCourseType = 'offline' | 'online_live' | 'video';

const courseIdValue = (course: Pick<Course, 'id'>) => Number(course.id);
const summaryHealthFilters = new Set<CourseHealthFilter>(['no_groups', 'no_sessions', 'certificate_missing']);

function uniqueCourses(items: Course[]) {
  const seen = new Set<number>();
  return items.filter((course) => {
    const id = courseIdValue(course);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function upsertCourse(items: Course[], nextCourse: Course) {
  const nextCourseId = courseIdValue(nextCourse);
  return [nextCourse, ...items.filter((course) => courseIdValue(course) !== nextCourseId)];
}

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
  const [courseHealth, setCourseHealth] = useState<Record<number, CourseHealthSummary>>({});
  const [selectedCourseId, setSelectedCourseId] = useState<number | undefined>();
  const [selectedGroupId, setSelectedGroupId] = useState<number | undefined>();
  const [query, setQuery] = useState('');
  const [healthFilter, setHealthFilter] = useState<CourseHealthFilter>('all');
  const [studentQuery, setStudentQuery] = useState('');
  const [progressFilter, setProgressFilter] = useState<CourseProgressFilter>('all');
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
  const [courseRejectPending, setCourseRejectPending] = useState<Course | null>(null);
  const [courseDeletePending, setCourseDeletePending] = useState<Course | null>(null);
  const [deletingCourse, setDeletingCourse] = useState(false);
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [loadedCourseDetailId, setLoadedCourseDetailId] = useState<number | undefined>();
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    courseType: 'offline' as TenantCourseType,
    instructorId: undefined as number | undefined,
  });
  const knownEmptyCourseIdsRef = useRef(new Set<number>());
  const pendingCreatedCourseIdRef = useRef<number | null>(null);
  const creatingCourseRef = useRef(false);
  const selectedCourseIdRef = useRef<number | undefined>(undefined);
  const loadingCourseDetailIdRef = useRef<number | null>(null);

  const activeRole = getEffectiveTenantRole(user, activeTenant);
  const canManageCourses = canManageTenantCourses(user, activeTenant);
  const canApproveCourses = canApproveTenantCourses(user, activeTenant);
  const canCreateCourse = canManageCourses;
  const canAssignInstructor = canApproveCourses;
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

  const courseTypeLabel = (value: Course['courseType'] | string | undefined | null) => enumLabel(value, courseTypeLabelKeys, t);
  const statusLabel = (value: string | undefined | null) => {
    return enumLabel(value || 'draft', {
      ...commonStatusLabelKeys,
      inprogress: 'courses.progressInProgress',
      notstarted: 'courses.progressNotStarted',
    }, t);
  };
  const publishLabel = (published?: boolean | null) => t(published ? 'courses.published' : 'courses.draft');
  const deliveryModeLabel = (value?: CourseGroup['deliveryMode'] | CourseSession['groupDeliveryMode'] | string | null) => (
    value === 'individual' ? t('groups.deliveryIndividual') : t('groups.deliveryGroup')
  );
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

  const healthCounts = useMemo(() => getCourseHealthCounts(courses, courseHealth), [courseHealth, courses]);
  const courseHealthComplete = courses.length > 0 && courses.every((course) => Boolean(courseHealth[courseIdValue(course)]));
  const healthFilterNeedsSummary = summaryHealthFilters.has(healthFilter);
  const healthFilterLabel = (value: CourseHealthFilter) => {
    const labels: Record<CourseHealthFilter, string> = {
      all: t('courses.healthAll'),
      draft: t('courses.healthDraft'),
      pending: t('courses.healthPending'),
      approved_unpublished: t('courses.healthApprovedUnpublished'),
      no_instructor: t('courses.healthNoInstructor'),
      no_groups: t('courses.healthNoGroups'),
      no_sessions: t('courses.healthNoSessions'),
      certificate_missing: t('courses.healthCertificateMissing'),
    };
    return labels[value];
  };

  const filteredCourses = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const effectiveHealthFilter = healthFilterNeedsSummary && !courseHealthComplete ? 'all' : healthFilter;
    return courses.filter((course) => (
      courseMatchesHealthFilter(course, effectiveHealthFilter, courseHealth[courseIdValue(course)])
      && (!normalized
        || course.title.toLowerCase().includes(normalized)
        || (course.courseType ?? '').toLowerCase().includes(normalized)
        || (course.status ?? '').toLowerCase().includes(normalized))
    ));
  }, [courseHealth, courseHealthComplete, courses, healthFilter, healthFilterNeedsSummary, query]);

  useEffect(() => {
    if (healthFilterNeedsSummary && !courseHealthComplete) {
      setHealthFilter('all');
      return;
    }
    if (!query.trim() && healthFilter === 'all') return;
    if (!filteredCourses.length) return;
    if (pendingCreatedCourseIdRef.current) return;
    if (selectedCourseId && filteredCourses.some((course) => courseIdValue(course) === selectedCourseId)) return;
    setSelectedCourseId(courseIdValue(filteredCourses[0]));
  }, [courseHealthComplete, filteredCourses, healthFilter, healthFilterNeedsSummary, query, selectedCourseId]);

  const selectedCourse = useMemo(
    () => courses.find((course) => courseIdValue(course) === selectedCourseId),
    [courses, selectedCourseId],
  );
  const canEditCourse = Boolean(selectedCourse && canManageCourses);
  const canDeleteCourse = Boolean(
    selectedCourse &&
    ['owner', 'company_admin'].includes(String(activeRole)) &&
    !selectedCourse.isPublished,
  );
  const selectedCourseOperational = isCourseWorkflowReady(selectedCourse, false);
  const selectedCourseDeliveryReady = isCourseWorkflowReady(selectedCourse);
  const courseBlockerMessage = workflowBlockerMessage(selectedCourse, false);
  const courseDeliveryBlockerMessage = workflowBlockerMessage(selectedCourse);
  const selectedCourseHealth = selectedCourse ? courseHealth[courseIdValue(selectedCourse)] : undefined;
  const selectedGroupCount = loadedCourseDetailId === selectedCourseId ? groups.length : selectedCourseHealth?.groupCount ?? groups.length;
  const selectedSessionCount = loadedCourseDetailId === selectedCourseId ? sessions.length : selectedCourseHealth?.sessionCount ?? sessions.length;
  const workflowChecklist = useMemo(() => {
    if (!selectedCourse) return [];
    const deliveryTypeReady = ['offline', 'online_live'].includes(String(selectedCourse.courseType ?? ''));
    const deliveryTypeLabel = enumLabel(selectedCourse.courseType, courseTypeLabelKeys, t);
    const approved = selectedCourse.status === 'approved';
    const published = selectedCourse.isPublished === true;
    return [
      {
        label: t('courses.workflowApproval'),
        detail: approved ? t('courses.workflowReady') : t('courses.workflowSubmitApprove'),
        complete: approved,
      },
      {
        label: t('courses.workflowPublish'),
        detail: published ? t('courses.workflowReady') : t('courses.workflowPublishDetail'),
        complete: published,
      },
      {
        label: t('courses.workflowDeliveryType'),
        detail: deliveryTypeReady ? deliveryTypeLabel : t('courses.blockerDeliveryType'),
        complete: deliveryTypeReady,
      },
      {
        label: t('courses.workflowGroups'),
        detail: selectedGroupCount ? t('courses.workflowCountReady', { count: selectedGroupCount }) : t('courses.workflowCreateGroup'),
        complete: selectedGroupCount > 0,
      },
      {
        label: t('courses.workflowSessions'),
        detail: selectedSessionCount ? t('courses.workflowCountReady', { count: selectedSessionCount }) : t('courses.workflowScheduleSession'),
        complete: selectedSessionCount > 0,
      },
    ];
  }, [selectedCourse, selectedGroupCount, selectedSessionCount, t]);

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId),
    [groups, selectedGroupId],
  );
  const selectedScope = {
    courseId: selectedCourse?.id,
    groupId: selectedGroup?.id,
  };
  const selectCourse = (courseId: number | undefined) => {
    selectedCourseIdRef.current = courseId;
    setSelectedCourseId(courseId);
    setSelectedGroupId(undefined);
  };

  const loadSelectedCourseDetails = useCallback(async () => {
    const courseId = selectedCourseIdRef.current;
    if (!courseId) return;
    if (loadedCourseDetailId === courseId) return;
    if (loadingCourseDetailIdRef.current === courseId) return;
    if (creatingCourseRef.current || pendingCreatedCourseIdRef.current === courseId) {
      setHomework([]);
      setLoadedCourseDetailId(courseId);
      succeedCourseDetailLoad();
      return;
    }
    loadingCourseDetailIdRef.current = courseId;
    startCourseDetailLoad();
    try {
      const [nextGroups, nextHomework] = await Promise.all([
        listCourseGroups(courseId),
        listHomework(courseId),
      ]);
      if (selectedCourseIdRef.current !== courseId) return;
      setGroups(nextGroups);
      setHomework(nextHomework);
      setLoadedCourseDetailId(courseId);
      succeedCourseDetailLoad();
    } catch {
      if (selectedCourseIdRef.current === courseId) {
        failCourseDetailLoad();
        toast.error(t('courses.detailLoadFailed'));
      }
    } finally {
      if (loadingCourseDetailIdRef.current === courseId) {
        loadingCourseDetailIdRef.current = null;
      }
    }
  }, [failCourseDetailLoad, loadedCourseDetailId, startCourseDetailLoad, succeedCourseDetailLoad, t]);

  const searchParamsString = searchParams.toString();

  useEffect(() => {
    let cancelled = false;
    setCourses((current) => current.length ? [] : current);
    setGroups((current) => current.length ? [] : current);
    setSessions((current) => current.length ? [] : current);
    setStudents((current) => current.length ? [] : current);
    setUnfilteredStudents((current) => current.length ? [] : current);
    setHomework((current) => current.length ? [] : current);
    setMembers((current) => current.length ? [] : current);
    setCourseHealth((current) => Object.keys(current).length ? {} : current);
    setLoadedCourseDetailId((current) => current === undefined ? current : undefined);
    setSelectedCourseId((current) => current === undefined ? current : undefined);
    setSelectedGroupId((current) => current === undefined ? current : undefined);
    if (!activeTenantId) {
      succeedCourseLoad();
      return undefined;
    }
    if (creatingCourseRef.current) {
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
        setCourses(uniqueCourses(items));
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
    if (!canManageCourses || !courses.length) {
      setCourseHealth({});
      return;
    }
    const backendHealthRows = courses
      .filter((course) => course.health || course.groupCount !== undefined || course.sessionCount !== undefined || course.certificateConfigured !== undefined)
      .map((course) => [
        courseIdValue(course),
        {
          groupCount: course.health?.groupCount ?? course.groupCount,
          sessionCount: course.health?.sessionCount ?? course.sessionCount,
          certificateConfigured: certificatesEnabled ? course.health?.certificateConfigured ?? course.certificateConfigured : undefined,
        } satisfies CourseHealthSummary,
      ] as const);
    const nextHealth = Object.fromEntries(backendHealthRows);
    courses.forEach((course) => {
      const courseId = courseIdValue(course);
      if (!knownEmptyCourseIdsRef.current.has(courseId) || nextHealth[courseId]) return;
      nextHealth[courseId] = {
        groupCount: 0,
        sessionCount: 0,
        certificateConfigured: certificatesEnabled ? false : undefined,
      };
    });
    setCourseHealth(nextHealth);
  }, [canManageCourses, certificatesEnabled, courses]);

  useEffect(() => {
    setSelectedCourseId((current) => {
      if (!courses.length) return undefined;
      const pendingCreatedCourseId = pendingCreatedCourseIdRef.current;
      if (pendingCreatedCourseId && courses.some((course) => courseIdValue(course) === pendingCreatedCourseId)) {
        return pendingCreatedCourseId;
      }
      if (current && courses.some((course) => courseIdValue(course) === current)) return current;
      if (requestedCourseId && courses.some((course) => courseIdValue(course) === requestedCourseId)) return requestedCourseId;
      return courseIdValue(courses[0]);
    });
  }, [courses, requestedCourseId]);

  useEffect(() => {
    selectedCourseIdRef.current = selectedCourseId;
    loadingCourseDetailIdRef.current = null;
    setGroups((current) => current.length ? [] : current);
    setSessions((current) => current.length ? [] : current);
    setStudents((current) => current.length ? [] : current);
    setUnfilteredStudents((current) => current.length ? [] : current);
    setHomework((current) => current.length ? [] : current);
    setSelectedGroupId((current) => current === undefined ? current : undefined);
    setLoadedCourseDetailId((current) => current === undefined ? current : undefined);
    succeedCourseDetailLoad();
    succeedGroupDetailLoad();
  }, [selectedCourseId, succeedCourseDetailLoad, succeedGroupDetailLoad]);

  useEffect(() => {
    if (!selectedCourseId || !requestedGroupId) return;
    void loadSelectedCourseDetails();
  }, [loadSelectedCourseDetails, requestedGroupId, selectedCourseId]);

  useEffect(() => {
    setSelectedGroupId((current) => {
      if (!groups.length) return undefined;
      if (requestedGroupId && groups.some((group) => group.id === requestedGroupId)) return requestedGroupId;
      return current && groups.some((group) => group.id === current) ? current : undefined;
    });
  }, [groups, requestedGroupId]);

  useEffect(() => {
    const next = nextWorkflowSearchParams(searchParamsString, { courseId: selectedCourseId, groupId: selectedGroupId });
    if (next.toString() !== searchParamsString) {
      setSearchParams(next, { replace: true });
    } else if (pendingCreatedCourseIdRef.current === selectedCourseId) {
      pendingCreatedCourseIdRef.current = null;
    }
  }, [searchParamsString, selectedCourseId, selectedGroupId, setSearchParams]);

  useEffect(() => {
    setSessions((current) => current.length ? [] : current);
    setStudents((current) => current.length ? [] : current);
    setUnfilteredStudents((current) => current.length ? [] : current);
    if (!selectedGroupId) {
      succeedGroupDetailLoad();
      return;
    }
    if (creatingCourseRef.current) {
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
    if (isDefaultCourseRosterFilter(studentQuery, progressFilter)) {
      setStudents(unfilteredStudents);
      return;
    }
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      const params = courseRosterFilterParams(studentQuery, progressFilter);
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
    { label: t('courses.groups'), value: selectedGroupCount, hint: selectedCourse?.title ?? t('courses.selectedCourse') },
    { label: t('courses.sessions'), value: sessions.length, hint: selectedGroup?.name ?? t('courses.selectedGroup') },
    { label: t('courses.students'), value: students.length, hint: t('courses.currentRoster') },
    { label: t('courses.homework'), value: homework.length, hint: t('courses.courseAssignments') },
  ], [homework.length, selectedCourse?.title, selectedGroup?.name, selectedGroupCount, sessions.length, students.length, t]);

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
    if (creatingCourseRef.current) return;

    const errors: Record<string, string> = {};
    if (createForm.title.trim().length < 2) errors.title = t('courses.titleRequired');
    if (createForm.description.trim().length < 10) errors.description = t('courses.descriptionRequired');
    if (!courseTypeOptions.some((option) => option.value === createForm.courseType)) {
      errors.courseType = t('courses.courseTypeDisabled');
    }
    if (!createForm.instructorId) errors.instructorId = t('courses.instructorRequired');
    setCreateErrors(errors);
    if (Object.keys(errors).length) return;

    creatingCourseRef.current = true;
    setCreatingCourse(true);
    try {
      const created = await createTenantCourse(activeTenantId, {
        title: createForm.title.trim(),
        description: createForm.description.trim(),
        courseType: createForm.courseType,
        instructorId: createForm.instructorId,
      });
      const createdCourseId = courseIdValue(created);
      knownEmptyCourseIdsRef.current.add(createdCourseId);
      pendingCreatedCourseIdRef.current = createdCourseId;
      selectedCourseIdRef.current = createdCourseId;
      setCourses((current) => upsertCourse(current, created));
      setCourseHealth((current) => ({
        ...current,
        [createdCourseId]: {
          groupCount: 0,
          sessionCount: 0,
          certificateConfigured: certificatesEnabled ? false : undefined,
        },
      }));
      setQuery('');
      setHealthFilter('all');
      setSelectedCourseId(createdCourseId);
      setSelectedGroupId(undefined);
      setSearchParams(nextWorkflowSearchParams(searchParamsString, { courseId: createdCourseId }), { replace: true });
      setCreateModalOpen(false);
      toast.success(t('courses.created'));
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || t('courses.createFailed'));
    } finally {
      creatingCourseRef.current = false;
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
      await updateTenantCourse(courseIdValue(selectedCourse), {
        title: createForm.title.trim(),
        description: createForm.description.trim(),
        courseType: createForm.courseType,
        instructorId: createForm.instructorId,
      });
      await reloadCourses(courseIdValue(selectedCourse));
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
    const nextCourses = uniqueCourses(items);
    setCourses(nextCourses);
    const preferred = preferredCourseId ? nextCourses.find((course) => courseIdValue(course) === preferredCourseId) : null;
    setSelectedCourseId(preferred ? courseIdValue(preferred) : nextCourses[0] ? courseIdValue(nextCourses[0]) : undefined);
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

  const deleteCourse = async (course: Course) => {
    const courseId = courseIdValue(course);
    setDeletingCourse(true);
    try {
      await deleteTenantCourse(courseId);
      setCourseDeletePending(null);
      await reloadCourses();
      toast.success(t('courses.deleted'));
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || t('courses.deleteFailed'));
    } finally {
      setDeletingCourse(false);
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
        <select value={selectedCourseId ?? ''} onChange={(event) => selectCourse(Number(event.target.value) || undefined)}>
          <option value="">{t('courses.selectCourse')}</option>
          {courses.map((course) => {
            const id = courseIdValue(course);
            return <option key={id} value={id}>{course.title}</option>;
          })}
        </select>
      </div>
      {canManageCourses && courses.length ? (
        <div className="member-role-chips course-health-filters" aria-label={t('courses.healthFilters')}>
          {courseHealthFilters.map((filter) => (
              <button
                key={filter}
                type="button"
                className={healthFilter === filter ? 'active' : ''}
                disabled={summaryHealthFilters.has(filter) && !courseHealthComplete}
                title={summaryHealthFilters.has(filter) && !courseHealthComplete ? t('courses.healthSummaryUnavailable') : undefined}
                onClick={() => setHealthFilter(filter)}
              >
                {healthFilterLabel(filter)}
                <strong>{healthCounts[filter] ?? 0}</strong>
              </button>
            ))}
            {!courseHealthComplete ? <span className="panel-note compact">{t('courses.healthSummaryUnavailable')}</span> : null}
          </div>
      ) : null}
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
                  <span><strong>{selectedGroupCount}</strong> {t('courses.groupsLower')}</span>
                  <span><strong>{selectedCourse.enrolledStudents ?? 0}</strong> {t('courses.enrolledLower')}</span>
                  <span><strong>{selectedSessionCount}</strong> {t('courses.sessionsLower')}</span>
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
                    {filteredCourses.map((course) => {
                      const id = courseIdValue(course);
                      return (
                        <tr
                          key={id}
                          className={`interactive-row ${id === selectedCourseId ? 'selected-row' : ''}`}
                          tabIndex={0}
                          onClick={() => selectCourse(id)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              selectCourse(id);
                            }
                          }}
                        >
                          <td>
                            <button
                              type="button"
                              className="table-row-button"
                              aria-pressed={id === selectedCourseId}
                              onClick={(event) => {
                                event.stopPropagation();
                                selectCourse(id);
                              }}
                            >
                              <strong>{course.title}</strong>
                              {course.instructor?.fullName ? <small>{course.instructor.fullName}</small> : null}
                            </button>
                          </td>
                          <td>{courseTypeLabel(course.courseType)}</td>
                          <td><span className={`status-badge ${course.status || 'draft'}`}>{statusLabel(course.status)}</span></td>
                          <td><span className="metadata-text">{publishLabel(course.isPublished)}</span></td>
                          <td>{course.enrolledStudents ?? 0}</td>
                        </tr>
                      );
                    })}
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
                      onClick={courseDetailLoad.failed ? () => void loadSelectedCourseDetails() : retryGroupDetailLoad}
                    >
                      {t('actions.retry')}
                    </button>
                  )}
                />
              ) : (
                <div className="course-operations-stack">
                  <section className="course-panel-block">
                    <h3>{t('courses.nextActions')}</h3>
                    <div className="course-workflow-checklist" aria-label={t('courses.workflowChecklist')}>
                      {workflowChecklist.map((step) => (
                        <article className={step.complete ? 'complete' : 'current'} key={step.label}>
                          <FiCheckSquare aria-hidden="true" />
                          <span>
                            <strong>{step.label}</strong>
                            <small>{step.detail}</small>
                          </span>
                        </article>
                      ))}
                    </div>
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
                          <Link className="course-action-card" to={workflowPath('/certificates', { courseId: courseIdValue(selectedCourse), tab: 'rules' })}>
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
                      {canApproveCourses && selectedCourse.status === 'pending' ? (
                        <button
                          type="button"
                          className="primary-button"
                          disabled={statusUpdating}
                          onClick={() => changeCourseStatus(courseIdValue(selectedCourse), 'approved')}
                        >
                          {t('courses.approve')}
                        </button>
                      ) : null}
                      {canApproveCourses && selectedCourse.status === 'pending' ? (
                        <button
                          type="button"
                          className="secondary-button"
                          disabled={statusUpdating}
                          onClick={() => setCourseRejectPending(selectedCourse)}
                        >
                          {t('courses.reject')}
                        </button>
                      ) : null}
                      {canApproveCourses && ['draft', 'rejected'].includes(selectedCourse.status || 'draft') ? (
                        <button
                          type="button"
                          className="primary-button"
                          disabled={statusUpdating}
                          onClick={() => changeCourseStatus(courseIdValue(selectedCourse), 'approved')}
                        >
                          {t('courses.approve')}
                        </button>
                      ) : null}
                      {!canApproveCourses && ['draft', 'rejected'].includes(selectedCourse.status || 'draft') ? (
                        <button
                          type="button"
                          className="secondary-button"
                          disabled={statusUpdating}
                          onClick={() => changeCourseStatus(courseIdValue(selectedCourse), 'pending')}
                        >
                          {t('courses.submitForApproval')}
                        </button>
                      ) : null}
                      {canDeleteCourse ? (
                        <button
                          type="button"
                          className="danger-button"
                          disabled={statusUpdating || deletingCourse}
                          onClick={() => setCourseDeletePending(selectedCourse)}
                        >
                          <FiTrash2 />
                          {t('courses.deleteCourse')}
                        </button>
                      ) : null}
                    </div>
                  </section>

                  <section className="course-panel-block">
                    <h3>{t('courses.selectedGroup')}</h3>
                    <label>
                      {t('courses.group')}
                      <select
                        value={selectedGroupId ?? ''}
                        onFocus={() => void loadSelectedCourseDetails()}
                        onMouseDown={() => void loadSelectedCourseDetails()}
                        onChange={(event) => setSelectedGroupId(Number(event.target.value) || undefined)}
                        disabled={!selectedCourse || courseDetailLoad.loading}
                      >
                        <option value="">{t('courses.selectGroup')}</option>
                        {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                      </select>
                    </label>

                  {selectedGroup ? (
                    <div className="course-group-summary workflow-context-panel compact">
                      <div className="definition-grid">
                        <span>{t('courses.code')}</span><strong>{selectedGroup.code ?? '-'}</strong>
                        <span>{t('courses.groupStatus')}</span><strong><span className={`status-badge ${selectedGroup.status ?? 'planned'}`}>{statusLabel(selectedGroup.status)}</span></strong>
                        <span>{t('groups.deliveryMode')}</span><strong><span className={`status-badge delivery-${selectedGroup.deliveryMode ?? 'group'}`}>{deliveryModeLabel(selectedGroup.deliveryMode)}</span></strong>
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
                          <strong>
                            <span className={`status-badge ${session.status || 'scheduled'}`}>{statusLabel(session.status)}</span>
                            {' '}<span className={`status-badge delivery-${session.groupDeliveryMode ?? selectedGroup?.deliveryMode ?? 'group'}`}>{deliveryModeLabel(session.groupDeliveryMode ?? selectedGroup?.deliveryMode)}</span>
                          </strong>
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
                <select value={progressFilter} onChange={(event) => setProgressFilter(event.target.value as CourseProgressFilter)}>
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
              aria-invalid={Boolean(createErrors.title)}
              aria-describedby={createErrors.title ? 'create-course-title-error' : undefined}
              value={createForm.title}
              onChange={(event) => setCreateForm((current) => ({ ...current, title: event.target.value }))}
              placeholder={t('courses.titlePlaceholder')}
              autoFocus
            />
            {createErrors.title ? <small className="field-error" id="create-course-title-error">{createErrors.title}</small> : null}
          </label>
          <label>
            {t('courses.type')}
            <select
              className={createErrors.courseType ? 'input-error' : undefined}
              aria-invalid={Boolean(createErrors.courseType)}
              aria-describedby={createErrors.courseType ? 'create-course-type-error' : undefined}
              value={createForm.courseType}
              onChange={(event) => setCreateForm((current) => ({ ...current, courseType: event.target.value as TenantCourseType }))}
            >
              {courseTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            {createErrors.courseType ? <small className="field-error" id="create-course-type-error">{createErrors.courseType}</small> : null}
          </label>
          <label>
            {t('courses.description')}
            <textarea
              className={createErrors.description ? 'input-error' : undefined}
              aria-invalid={Boolean(createErrors.description)}
              aria-describedby={createErrors.description ? 'create-course-description-error' : undefined}
              value={createForm.description}
              onChange={(event) => setCreateForm((current) => ({ ...current, description: event.target.value }))}
              placeholder={t('courses.descriptionPlaceholder')}
              rows={4}
            />
            {createErrors.description ? <small className="field-error" id="create-course-description-error">{createErrors.description}</small> : null}
          </label>
          <label>
            {t('courses.instructor')}
            <select
              className={createErrors.instructorId ? 'input-error' : undefined}
              aria-invalid={Boolean(createErrors.instructorId)}
              aria-describedby={createErrors.instructorId ? 'create-course-instructor-error' : undefined}
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
            {createErrors.instructorId ? <small className="field-error" id="create-course-instructor-error">{createErrors.instructorId}</small> : null}
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
              aria-invalid={Boolean(createErrors.title)}
              aria-describedby={createErrors.title ? 'edit-course-title-error' : undefined}
              value={createForm.title}
              onChange={(event) => setCreateForm((current) => ({ ...current, title: event.target.value }))}
              placeholder={t('courses.titlePlaceholder')}
              autoFocus
            />
            {createErrors.title ? <small className="field-error" id="edit-course-title-error">{createErrors.title}</small> : null}
          </label>
          <label>
            {t('courses.type')}
            <select
              className={createErrors.courseType ? 'input-error' : undefined}
              aria-invalid={Boolean(createErrors.courseType)}
              aria-describedby={createErrors.courseType ? 'edit-course-type-error' : undefined}
              value={createForm.courseType}
              onChange={(event) => setCreateForm((current) => ({ ...current, courseType: event.target.value as TenantCourseType }))}
            >
              {courseTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            {createErrors.courseType ? <small className="field-error" id="edit-course-type-error">{createErrors.courseType}</small> : null}
          </label>
          <label>
            {t('courses.description')}
            <textarea
              className={createErrors.description ? 'input-error' : undefined}
              aria-invalid={Boolean(createErrors.description)}
              aria-describedby={createErrors.description ? 'edit-course-description-error' : undefined}
              value={createForm.description}
              onChange={(event) => setCreateForm((current) => ({ ...current, description: event.target.value }))}
              placeholder={t('courses.descriptionPlaceholder')}
              rows={4}
            />
            {createErrors.description ? <small className="field-error" id="edit-course-description-error">{createErrors.description}</small> : null}
          </label>
          <label>
            {t('courses.instructor')}
            <select
              className={createErrors.instructorId ? 'input-error' : undefined}
              aria-invalid={Boolean(createErrors.instructorId)}
              aria-describedby={createErrors.instructorId ? 'edit-course-instructor-error' : undefined}
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
            {createErrors.instructorId ? <small className="field-error" id="edit-course-instructor-error">{createErrors.instructorId}</small> : null}
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
      {courseRejectPending ? (
        <Modal labelledBy="reject-course-title" onClose={() => setCourseRejectPending(null)}>
          <div className="modal-header-block">
            <span>{t('courses.reject')}</span>
            <h2 id="reject-course-title">{t('courses.rejectCourseTitle')}</h2>
            <p>{t('courses.rejectCourseDetail', { title: courseRejectPending.title })}</p>
          </div>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={() => setCourseRejectPending(null)} disabled={statusUpdating}>{t('courses.cancel')}</button>
            <button
              type="button"
              className="danger-button"
              disabled={statusUpdating}
              onClick={() => {
                const courseId = courseIdValue(courseRejectPending);
                setCourseRejectPending(null);
                void changeCourseStatus(courseId, 'rejected');
              }}
            >
              {statusUpdating ? t('auth.working') : t('courses.reject')}
            </button>
          </div>
        </Modal>
      ) : null}
      {courseDeletePending ? (
        <Modal labelledBy="delete-course-title" onClose={() => setCourseDeletePending(null)}>
          <div className="modal-header-block">
            <span>{t('courses.deleteCourse')}</span>
            <h2 id="delete-course-title">{t('courses.deleteCourseTitle')}</h2>
            <p>{t('courses.deleteCourseDetail', { title: courseDeletePending.title })}</p>
          </div>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={() => setCourseDeletePending(null)} disabled={deletingCourse}>{t('courses.cancel')}</button>
            <button
              type="button"
              className="danger-button"
              disabled={deletingCourse}
              onClick={() => void deleteCourse(courseDeletePending)}
            >
              {deletingCourse ? t('courses.deleting') : t('courses.deleteCourse')}
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
