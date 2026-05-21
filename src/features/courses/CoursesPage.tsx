import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { FiEdit2, FiPlus } from 'react-icons/fi';
import { PageHeader } from '../../components/PageHeader';
import { StatGrid } from '../../components/StatGrid';
import { EmptyState, ErrorState, LoadingState } from '../../components/DataState';
import { createTenantCourse, deleteTenantCourse, listCourseGroups, listGroupSessions, listGroupStudents, listHomework, listTenantCourses, listTenantMembers, publishTenantCourse, updateCourseStatus, updateTenantCourse } from '../../services/api';
import type { CompanyMember, Course, CourseGroup, CourseSession, GroupStudent, SessionHomework } from '../../types/domain';
import { useTenant } from '../tenant/TenantProvider';
import { useAuth } from '../auth/AuthProvider';
import { canApproveTenantCourses, canManageTenantCourses, getEffectiveTenantRole } from '../tenant/tenantRoles';
import { getApiErrorMessage } from '../../lib/apiErrors';
import { commonStatusLabelKeys, courseTypeLabelKeys, enumLabel } from '../../lib/enumLabels';
import { useAsyncLoadState } from '../../lib/asyncState';
import { isCourseWorkflowReady, nextWorkflowSearchParams, workflowPath } from '../workflows/workflowContext';
import { courseRosterFilterParams, isDefaultCourseRosterFilter, type CourseProgressFilter } from './courseRosterFilters';
import { courseMatchesHealthFilter, getCourseHealthCounts, type CourseHealthFilter, type CourseHealthSummary } from './courseHealth';
import { getCourseReadiness, type CourseNextAction } from './courseReadiness';
import {
  CourseCatalogTable,
  CourseEmptyOnboarding,
  CourseHealthFilterBar,
  CourseOperationsGrid,
  CourseStatePanel,
  CourseSummaryBanner,
  CourseToolbar,
  CourseWorkflowChecklist,
  GroupRosterSection,
  RecentSessionsPanel,
  SelectedGroupPanel,
  type TenantCourseType,
} from './courseComponents';
import { CourseCreateModal, CourseDeleteDialog, CourseEditModal, CourseRejectDialog } from './courseModals';

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
  const canAssignInstructor = canManageCourses;
  const showCourseHealthFilters = canApproveCourses;
  const isInstructorCreator = activeRole === 'instructor' && canCreateCourse && !canApproveCourses;
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
  const courseTypeDetail = (value: TenantCourseType) => {
    if (value === 'online_live') return t('courses.typeOnlineLiveDetail');
    if (value === 'video') return t('courses.typeVideoDetail');
    return t('courses.typeOfflineDetail');
  };
  const workflowBlockerMessage = (course: Course | undefined, requireDelivery = true) => {
    if (!course) return t('courses.blockerChooseCourse');
    if (requireDelivery && !['offline', 'online_live'].includes(String(course.courseType ?? ''))) {
      return t('courses.blockerDeliveryType');
    }
    if (course.status !== 'approved') return t('courses.blockerApproval');
    if (course.isPublished !== true) return t('courses.blockerPublish');
    return '';
  };

  const instructorMembers = useMemo<CompanyMember[]>(
    () => {
      const tenantInstructors = canAssignInstructor
        ? members.filter((member) => String(member.role).toLowerCase() === 'instructor')
        : [];
      if (activeRole === 'instructor' && user?.id) {
        const self = {
          userId: user.id,
          role: 'instructor',
          fullName: user.fullName,
          email: user.email,
        } satisfies CompanyMember;
        return [self, ...tenantInstructors.filter((member) => member.userId !== user.id)];
      }
      return tenantInstructors;
    },
    [activeRole, canAssignInstructor, members, user?.email, user?.fullName, user?.id],
  );
  const createInstructorUnavailable = canCreateCourse && instructorMembers.length === 0;

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
  const translateCourseReadiness = useCallback((course: Course, groupCount?: number, sessionCount?: number) => {
    const readiness = getCourseReadiness(course, {
      canApproveCourses,
      canEditCourse,
      groupCount,
      sessionCount,
    });
    return {
      ...readiness,
      label: t(readiness.labelKey),
      detail: t(readiness.detailKey),
    };
  }, [canApproveCourses, canEditCourse, t]);
  const selectedCourseReadiness = useMemo(() => (
    selectedCourse ? translateCourseReadiness(selectedCourse, selectedGroupCount, selectedSessionCount) : null
  ), [selectedCourse, selectedGroupCount, selectedSessionCount, translateCourseReadiness]);
  const getCatalogCourseReadiness = (course: Course) => {
    const courseId = courseIdValue(course);
    const summary = courseHealth[courseId];
    const groupCount = summary?.groupCount ?? course.health?.groupCount ?? course.groupCount;
    const sessionCount = summary?.sessionCount ?? course.health?.sessionCount ?? course.sessionCount;
    return translateCourseReadiness(course, groupCount, sessionCount);
  };
  const workflowChecklist = useMemo(() => {
    if (!selectedCourse) return [];
    const deliveryTypeReady = ['offline', 'online_live'].includes(String(selectedCourse.courseType ?? ''));
    const deliveryTypeLabel = enumLabel(selectedCourse.courseType, courseTypeLabelKeys, t);
    const approved = selectedCourse.status === 'approved';
    const published = selectedCourse.isPublished === true;
    const approvalAction = approved
      ? null
      : canApproveCourses
        ? { type: 'approve' as CourseNextAction, label: t('courses.approveAndPublish') }
        : { type: 'submit' as CourseNextAction, label: t('courses.submitForApproval') };
    const steps = [
      {
        label: t('courses.workflowApproval'),
        detail: approved ? t('courses.workflowReady') : t('courses.workflowSubmitApprove'),
        complete: approved,
        action: approvalAction,
      },
      {
        label: t('courses.workflowPublish'),
        detail: published ? t('courses.workflowReady') : approved ? t('courses.workflowPublishDetail') : t('courses.workflowPublishAutoDetail'),
        complete: published,
        action: !published && approved && canApproveCourses ? { type: 'publish' as CourseNextAction, label: t('courses.publishCourse') } : null,
      },
      {
        label: t('courses.workflowDeliveryType'),
        detail: deliveryTypeReady ? deliveryTypeLabel : t('courses.blockerDeliveryType'),
        complete: deliveryTypeReady,
        action: !deliveryTypeReady && canEditCourse ? { type: 'edit' as CourseNextAction, label: t('courses.editCourse') } : null,
      },
      {
        label: t('courses.workflowGroups'),
        detail: selectedGroupCount ? t('courses.workflowCountReady', { count: selectedGroupCount }) : t('courses.workflowCreateGroup'),
        complete: selectedGroupCount > 0,
        action: selectedGroupCount === 0 && selectedCourseDeliveryReady ? { type: 'groups' as CourseNextAction, label: t('courses.createGroup') } : null,
      },
      {
        label: t('courses.workflowSessions'),
        detail: selectedSessionCount ? t('courses.workflowCountReady', { count: selectedSessionCount }) : t('courses.workflowScheduleSession'),
        complete: selectedSessionCount > 0,
        action: selectedSessionCount === 0 && selectedGroupCount > 0 && selectedCourseDeliveryReady
          ? { type: 'sessions' as CourseNextAction, label: t('courses.scheduleSession') }
          : null,
      },
    ];
    const currentIndex = steps.findIndex((step) => !step.complete);
    return steps.map((step, index) => ({
      ...step,
      state: step.complete ? 'complete' as const : index === currentIndex ? 'current' as const : 'upcoming' as const,
    }));
  }, [canApproveCourses, canEditCourse, selectedCourse, selectedCourseDeliveryReady, selectedGroupCount, selectedSessionCount, t]);

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
    if (!createForm.instructorId) errors.instructorId = createInstructorUnavailable ? t('courses.noInstructorsTitle') : t('courses.instructorRequired');
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
      toast.error(getApiErrorMessage(error, t('courses.createFailed')));
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
      toast.error(getApiErrorMessage(error, t('courses.updateFailed')));
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
      toast.error(getApiErrorMessage(error, t('courses.statusUpdateFailed')));
    } finally {
      setStatusUpdating(false);
    }
  };

  const publishCourse = async (courseId: number) => {
    setStatusUpdating(true);
    try {
      await publishTenantCourse(courseId);
      await reloadCourses(courseId);
      toast.success(t('courses.published'));
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, t('courses.updateFailed')));
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
      toast.error(getApiErrorMessage(error, t('courses.deleteFailed')));
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

  const renderCourseAction = (action: CourseNextAction, label: string, className = 'primary-button') => {
    if (!selectedCourse || !action) return null;
    const courseId = courseIdValue(selectedCourse);
    if (action === 'approve') {
      return (
        <button type="button" className={className} disabled={statusUpdating} onClick={() => changeCourseStatus(courseId, 'approved')}>
          {label}
        </button>
      );
    }
    if (action === 'submit') {
      return (
        <button type="button" className={className} disabled={statusUpdating} onClick={() => changeCourseStatus(courseId, 'pending')}>
          {label}
        </button>
      );
    }
    if (action === 'publish') {
      return (
        <button type="button" className={className} disabled={statusUpdating} onClick={() => publishCourse(courseId)}>
          {label}
        </button>
      );
    }
    if (action === 'edit') {
      return (
        <button type="button" className={className} onClick={openEditModal}>
          <FiEdit2 />
          {label}
        </button>
      );
    }
    if (action === 'groups') {
      return <Link className={className} to={workflowPath('/groups', selectedScope)}>{label}</Link>;
    }
    if (action === 'sessions') {
      return <Link className={className} to={workflowPath('/sessions', selectedScope)}>{label}</Link>;
    }
    if (action === 'openSessions') {
      return <Link className={className} to={workflowPath('/sessions', selectedScope)}>{label}</Link>;
    }
    return null;
  };

  const renderReadinessAction = () => {
    if (!selectedCourseReadiness?.nextAction) return null;
    const labels: Record<Exclude<CourseNextAction, null>, string> = {
      approve: t('courses.approveAndPublish'),
      submit: t('courses.submitForApproval'),
      publish: t('courses.publishCourse'),
      edit: t('courses.editCourse'),
      groups: t('courses.createGroup'),
      sessions: t('courses.scheduleSession'),
      openSessions: t('courses.openSessions'),
    };
    const className = selectedCourseReadiness.nextAction === 'openSessions' ? 'secondary-link-button' : 'primary-button';
    return renderCourseAction(selectedCourseReadiness.nextAction, labels[selectedCourseReadiness.nextAction], className);
  };

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
      <CourseToolbar
        query={query}
        setQuery={setQuery}
        courses={courses}
        selectedCourseId={selectedCourseId}
        selectCourse={selectCourse}
      />
      {showCourseHealthFilters && courses.length ? (
        <CourseHealthFilterBar
          healthFilter={healthFilter}
          healthCounts={healthCounts}
          courseHealthComplete={courseHealthComplete}
          setHealthFilter={setHealthFilter}
          healthFilterLabel={healthFilterLabel}
        />
      ) : null}
      {!courses.length ? (
        <CourseEmptyOnboarding
          canCreateCourse={canCreateCourse}
          courseTypeOptionsAvailable={Boolean(courseTypeOptions.length)}
          openCreateModal={openCreateModal}
        />
      ) : (
        <>
          <StatGrid items={stats} />
          {selectedCourse ? (
            <CourseSummaryBanner
              course={selectedCourse}
              courseType={courseTypeLabel(selectedCourse.courseType)}
              readiness={selectedCourseReadiness}
              fallbackDetail={selectedCourseOperational ? t('courses.operationalDetail') : courseBlockerMessage}
              groupCount={selectedGroupCount}
              sessionCount={selectedSessionCount}
              action={renderReadinessAction()}
            />
          ) : null}
          <div className="workspace-grid">
            <section className="content-section">
              <h2>{t('courses.tenantCatalog')}</h2>
              <CourseCatalogTable
                courses={filteredCourses}
                selectedCourseId={selectedCourseId}
                selectCourse={selectCourse}
                courseTypeLabel={courseTypeLabel}
                getReadiness={getCatalogCourseReadiness}
              />
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
                    <CourseWorkflowChecklist steps={workflowChecklist} renderAction={renderCourseAction} />
                    {canApproveCourses && selectedCourse.status === 'pending' ? (
                      <div className="course-review-actions" aria-label={t('courses.reviewActions')}>
                        <button type="button" className="secondary-button" disabled={statusUpdating} onClick={() => setCourseRejectPending(selectedCourse)}>
                          {t('courses.reject')}
                        </button>
                      </div>
                    ) : null}
                    <CourseOperationsGrid
                      courseId={courseIdValue(selectedCourse)}
                      scope={selectedScope}
                      deliveryReady={selectedCourseDeliveryReady}
                      operationalReady={selectedCourseOperational}
                      attendanceEnabled={attendanceEnabled}
                      homeworkEnabled={homeworkEnabled}
                      certificatesEnabled={certificatesEnabled}
                    />
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

                  <CourseStatePanel
                    course={selectedCourse}
                    canEditCourse={canEditCourse}
                    canApproveCourses={canApproveCourses}
                    canDeleteCourse={canDeleteCourse}
                    statusUpdating={statusUpdating}
                    deletingCourse={deletingCourse}
                    courseTypeLabel={courseTypeLabel}
                    statusLabel={statusLabel}
                    publishLabel={publishLabel}
                    openEditModal={openEditModal}
                    changeCourseStatus={(courseId, status) => void changeCourseStatus(courseId, status)}
                    setCourseRejectPending={setCourseRejectPending}
                    setCourseDeletePending={setCourseDeletePending}
                  />

                  <SelectedGroupPanel
                    groups={groups}
                    selectedGroupId={selectedGroupId}
                    selectedGroup={selectedGroup}
                    courseDetailLoading={courseDetailLoad.loading}
                    loadCourseDetails={() => void loadSelectedCourseDetails()}
                    setSelectedGroupId={setSelectedGroupId}
                    statusLabel={statusLabel}
                    deliveryModeLabel={deliveryModeLabel}
                    studentCount={students.length}
                    sessionCount={sessions.length}
                    completedStudents={completedStudents}
                    groupProgressAverage={groupProgressAverage}
                  />

                  <RecentSessionsPanel
                    sessions={sessions}
                    selectedGroup={selectedGroup}
                    statusLabel={statusLabel}
                    deliveryModeLabel={deliveryModeLabel}
                  />
                </div>
              )}
            </aside>
          </div>

          {selectedGroup ? (
            <GroupRosterSection
              selectedGroup={selectedGroup}
              students={students}
              studentQuery={studentQuery}
              progressFilter={progressFilter}
              setStudentQuery={setStudentQuery}
              setProgressFilter={setProgressFilter}
              clearFilters={() => {
                setStudentQuery('');
                setProgressFilter('all');
              }}
            />
          ) : null}
        </>
      )}
      {createModalOpen ? (
        <CourseCreateModal
          form={createForm}
          errors={createErrors}
          courseTypeOptions={courseTypeOptions}
          instructorMembers={instructorMembers}
          activeRole={activeRole}
          isInstructorCreator={isInstructorCreator}
          createInstructorUnavailable={createInstructorUnavailable}
          creatingCourse={creatingCourse}
          videoEnabled={activeTenant?.featureFlags?.['courses.video.enabled'] === true}
          setForm={setCreateForm}
          courseTypeDetail={courseTypeDetail}
          onClose={() => setCreateModalOpen(false)}
          onSubmit={submitCourse}
        />
      ) : null}
      {editModalOpen && selectedCourse ? (
        <CourseEditModal
          form={createForm}
          errors={createErrors}
          courseTypeOptions={courseTypeOptions}
          instructorMembers={instructorMembers}
          activeRole={activeRole}
          savingCourse={savingCourse}
          setForm={setCreateForm}
          courseTypeDetail={courseTypeDetail}
          onClose={() => { setEditModalOpen(false); setCreateErrors({}); }}
          onSubmit={saveCourse}
        />
      ) : null}
      {courseRejectPending ? (
        <CourseRejectDialog
          course={courseRejectPending}
          statusUpdating={statusUpdating}
          onClose={() => setCourseRejectPending(null)}
          onConfirm={() => {
            const courseId = courseIdValue(courseRejectPending);
            setCourseRejectPending(null);
            void changeCourseStatus(courseId, 'rejected');
          }}
        />
      ) : null}
      {courseDeletePending ? (
        <CourseDeleteDialog
          course={courseDeletePending}
          deletingCourse={deletingCourse}
          onClose={() => setCourseDeletePending(null)}
          onConfirm={() => void deleteCourse(courseDeletePending)}
        />
      ) : null}
    </>
  );
}
