import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { FiArrowRight, FiCalendar, FiCheckSquare, FiClipboard, FiEdit2, FiPlus, FiUsers } from 'react-icons/fi';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState, LoadingState } from '../../components/DataState';
import { FormModal, Modal } from '../../components/Modal';
import {
  createCourseGroup,
  createIndividualCourseGroup,
  enrollUser,
  generateGroupSessions,
  inviteTenantMember,
  listCourseGroups,
  listGroupSessions,
  listGroupStudents,
  listTenantCourses,
  listTenantMembers,
  previewGeneratedSessions,
  removeUserFromGroup,
  searchUsers,
  updateCourseGroup,
} from '../../services/api';
import type { CompanyMember, Course, CourseGroup, CourseSession, GroupStudent, SessionGenerationPreview, UserSummary } from '../../types/domain';
import { formatDate } from '../../lib/format';
import { commonStatusLabelKeys, courseTypeLabelKeys, enumLabel } from '../../lib/enumLabels';
import { getApiErrorMessage } from '../../lib/apiErrors';
import { useAuth } from '../auth/AuthProvider';
import { useTenant } from '../tenant/TenantProvider';
import { canCoordinateTenantLearning, canEnrollTenantStudents, isTenantAdmin } from '../tenant/tenantRoles';
import { isCourseWorkflowReady, nextWorkflowSearchParams, workflowPath } from '../workflows/workflowContext';
import {
  browserTimezone,
  emptyGroupForm,
  emptyScheduleBlock,
  groupToForm,
  positiveNumber,
  scheduleBlocksPayload,
  validateGroupForm as validateSharedGroupForm,
  type DeliveryMode,
  type GroupForm,
  type GroupStatus,
  type GroupValidationErrors,
  type ScheduleDay,
} from './groupForm';

const emptyStudentInviteForm = {
  fullName: '',
  email: '',
  sendEmail: false,
};

type GroupWorkspaceTab = 'overview' | 'students' | 'sessions' | 'settings';

const groupWorkspaceTabs: GroupWorkspaceTab[] = ['overview', 'students', 'sessions', 'settings'];

function validGroupWorkspaceTab(value: string | null): GroupWorkspaceTab {
  return groupWorkspaceTabs.includes(value as GroupWorkspaceTab) ? value as GroupWorkspaceTab : 'overview';
}

export function GroupsPage() {
  const { t } = useTranslation();
  const { activeTenant } = useTenant();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTenantId = activeTenant?.id;
  const defaultTimezone = activeTenant?.timezone || browserTimezone();
  const canAssignInstructor = isTenantAdmin(user, activeTenant);
  const canCoordinateGroups = canCoordinateTenantLearning(user, activeTenant);
  const canManageEnrollment = canEnrollTenantStudents(user, activeTenant);

  const initialCourseId = Number(searchParams.get('courseId')) || undefined;
  const initialGroupId = Number(searchParams.get('groupId')) || undefined;
  const urlTabParam = searchParams.get('tab');
  const requestedTab = validGroupWorkspaceTab(urlTabParam);
  const searchParamsString = searchParams.toString();

  const [courses, setCourses] = useState<Course[]>([]);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [groups, setGroups] = useState<CourseGroup[]>([]);
  const [sessions, setSessions] = useState<CourseSession[]>([]);
  const [students, setStudents] = useState<GroupStudent[]>([]);
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [courseId, setCourseId] = useState<number | undefined>(initialCourseId);
  const [groupId, setGroupId] = useState<number | undefined>(initialGroupId);
  const [courseQuery, setCourseQuery] = useState('');
  const [studentQuery, setStudentQuery] = useState('');
  const [studentResults, setStudentResults] = useState<UserSummary[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<number | undefined>();
  const [studentSearchAttempted, setStudentSearchAttempted] = useState(false);
  const [studentInviteForm, setStudentInviteForm] = useState(emptyStudentInviteForm);
  const [groupForm, setGroupForm] = useState<GroupForm>(() => emptyGroupForm(defaultTimezone));
  const [createErrors, setCreateErrors] = useState<GroupValidationErrors>({});
  const [generationRange, setGenerationRange] = useState({ fromDate: '', toDate: '' });
  const [generationPreview, setGenerationPreview] = useState<SessionGenerationPreview | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isEnrollmentOpen, setIsEnrollmentOpen] = useState(false);
  const [selectorsExpanded, setSelectorsExpanded] = useState(false);
  const [groupWorkspaceTab, setGroupWorkspaceTab] = useState<GroupWorkspaceTab>(requestedTab);
  const [enrollmentMode, setEnrollmentMode] = useState<'existing' | 'new'>('existing');
  const [studentToRemove, setStudentToRemove] = useState<GroupStudent | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [savingGroup, setSavingGroup] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [removingStudentId, setRemovingStudentId] = useState<number | undefined>();
  const [generationLoading, setGenerationLoading] = useState(false);
  const savingGroupRef = useRef(false);

  const selectedCourse = useMemo(() => courses.find((course) => course.id === courseId), [courseId, courses]);
  const selectedGroup = useMemo(() => groups.find((group) => group.id === groupId), [groupId, groups]);
  const selectedIndividualStudent = selectedGroup?.deliveryMode === 'individual' ? students[0] : undefined;
  const selectedIndividualStudentName = selectedIndividualStudent
    ? selectedIndividualStudent.fullName || selectedIndividualStudent.email || t('courses.studentFallback', { id: selectedIndividualStudent.userId })
    : '';
  const instructorOptions = useMemo(
    () => members.filter((member) => String(member.role).toLowerCase() === 'instructor'),
    [members],
  );
  const tenantStudentOptions = useMemo(
    () => members
      .filter((member) => String(member.role).toLowerCase() === 'student')
      .map((member) => ({
        id: member.userId,
        email: member.email ?? '',
        fullName: member.fullName,
        role: member.role,
      })),
    [members],
  );
  const filteredCourses = useMemo(() => {
    const normalized = courseQuery.trim().toLowerCase();
    return normalized
      ? courses.filter((course) => course.title.toLowerCase().includes(normalized) || String(course.courseType ?? '').includes(normalized))
      : courses;
  }, [courseQuery, courses]);
  const ineligibleCourseCount = allCourses.filter((course) => !isCourseWorkflowReady(course)).length;
  const scheduleBlocksReady = Boolean(selectedGroup?.scheduleBlocks?.some((block) => block.day && block.startTime && block.endTime));
  const scheduleDatesReady = Boolean(generationRange.fromDate && generationRange.toDate);
  const generationReady = canCoordinateGroups && scheduleBlocksReady && scheduleDatesReady;
  const selectedCourseReady = isCourseWorkflowReady(selectedCourse);
  const selectedCourseLiveOnline = selectedCourse?.courseType === 'online_live';
  const selectedCourseOffline = selectedCourse?.courseType === 'offline';
  const courseTypeLabel = (value: Course['courseType'] | string | undefined | null) => enumLabel(value, courseTypeLabelKeys, t);
  const statusLabel = (value: string | undefined | null) => {
    return enumLabel(value || 'planned', commonStatusLabelKeys, t);
  };
  const deliveryModeLabel = (value?: DeliveryMode | string | null) => (
    value === 'individual' ? t('groups.deliveryIndividual') : t('groups.deliveryGroup')
  );
  const scheduleDayLabel = (value: string) => {
    const labels: Record<string, string> = {
      mon: t('groups.dayMon'),
      tue: t('groups.dayTue'),
      wed: t('groups.dayWed'),
      thu: t('groups.dayThu'),
      fri: t('groups.dayFri'),
      sat: t('groups.daySat'),
      sun: t('groups.daySun'),
    };
    return labels[value] ?? value;
  };
  const completeScheduleBlocks = selectedGroup?.scheduleBlocks?.filter((block) => block.day && block.startTime && block.endTime) ?? [];
  const scheduleBlockSummary = completeScheduleBlocks.length
    ? completeScheduleBlocks.map((block) => `${scheduleDayLabel(block.day)} ${block.startTime}-${block.endTime}`).join(', ')
    : t('groups.needsSetup');
  const sortedSessions = useMemo(
    () => [...sessions].sort((left, right) => new Date(left.startsAt ?? 0).getTime() - new Date(right.startsAt ?? 0).getTime()),
    [sessions],
  );
  const nextSession = useMemo(() => {
    const now = Date.now();
    return sortedSessions.find((session) => new Date(session.startsAt ?? 0).getTime() >= now) ?? sortedSessions[0];
  }, [sortedSessions]);
  const selectedCourseBlocker = (() => {
    if (!selectedCourse) return t('courses.blockerChooseCourse');
    if (!['offline', 'online_live'].includes(String(selectedCourse.courseType ?? ''))) return t('courses.blockerDeliveryType');
    if (selectedCourse.status !== 'approved') return t('courses.blockerApproval');
    if (selectedCourse.isPublished !== true) return t('courses.blockerPublish');
    return '';
  })();
  const selectedScope = { courseId: selectedGroup?.courseId ?? selectedCourse?.id, groupId: selectedGroup?.id };
  const nextSessionLink = workflowPath('/sessions', { ...selectedScope, sessionId: nextSession?.id });
  const attendanceLink = workflowPath('/attendance', selectedScope);
  const homeworkLink = workflowPath('/homework', selectedScope);
  const groupTabs: Array<{ id: GroupWorkspaceTab; label: string }> = [
    { id: 'overview', label: t('groups.overviewTab') },
    { id: 'students', label: t('groups.studentsTab') },
    { id: 'sessions', label: t('groups.sessionsTab') },
    { id: 'settings', label: t('groups.settingsTab') },
  ];
  const nextBestAction = (() => {
    if (!selectedGroup) return null;
    if (!scheduleBlocksReady && canCoordinateGroups) {
      return {
        tone: 'warning',
        title: t('groups.nextCompleteScheduleTitle'),
        detail: t('groups.nextCompleteScheduleDetail'),
        action: <button type="button" className="primary-button" onClick={() => { setGroupForm(groupToForm(selectedGroup, defaultTimezone)); setCreateErrors({}); setIsEditOpen(true); }}>{t('groups.editGroup')}</button>,
      };
    }
    if (!sessions.length && canCoordinateGroups) {
      return {
        tone: 'info',
        title: t('groups.nextCreateSessionsTitle'),
        detail: t('groups.nextCreateSessionsDetail'),
        action: <button type="button" className="primary-button" onClick={() => setGroupWorkspaceTab('sessions')}>{t('groups.sessionsTab')}</button>,
      };
    }
    if (!students.length && canManageEnrollment) {
      return {
        tone: 'warning',
        title: t('groups.nextAddStudentsTitle'),
        detail: t('groups.nextAddStudentsDetail'),
        action: <button type="button" className="primary-button" onClick={() => openEnrollmentModal('existing')}>{t('sessions.enrollStudent')}</button>,
      };
    }
    return {
      tone: 'success',
      title: t('groups.nextReadyTitle'),
      detail: t('groups.nextReadyDetail'),
      action: <Link className="secondary-link-button" to={nextSessionLink}>{t('navigation.sessions')}</Link>,
    };
  })();

  useEffect(() => {
    setCourses([]);
    setAllCourses([]);
    setGroups([]);
    setSessions([]);
    setStudents([]);
    setMembers([]);
    if (!activeTenantId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      listTenantCourses(activeTenantId),
      canAssignInstructor || canManageEnrollment
        ? listTenantMembers(activeTenantId).catch(() => [] as CompanyMember[])
        : Promise.resolve([] as CompanyMember[]),
    ])
      .then(([nextCourses, nextMembers]) => {
        if (cancelled) return;
        const eligibleCourses = nextCourses.filter((course) => isCourseWorkflowReady(course));
        setAllCourses(nextCourses);
        setCourses(eligibleCourses);
        setMembers(nextMembers);
      })
      .catch(() => {
        if (!cancelled) toast.error(t('groups.workspaceLoadFailed'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTenantId, canAssignInstructor, canManageEnrollment, t]);

  useEffect(() => {
    setCourseId((current) => {
      if (!courses.length) return undefined;
      if (initialCourseId && courses.some((course) => course.id === initialCourseId)) return initialCourseId;
      return current && courses.some((course) => course.id === current) ? current : courses[0]?.id;
    });
  }, [courses, initialCourseId]);

  useEffect(() => {
    setGroups([]);
    setSessions([]);
    setStudents([]);
    setGroupId(undefined);
    if (!courseId) return;
    let cancelled = false;
    setDetailLoading(true);
    listCourseGroups(courseId)
      .then((nextGroups) => {
        if (cancelled) return;
        setGroups(nextGroups);
      })
      .catch(() => {
        if (!cancelled) toast.error(t('groups.courseGroupsLoadFailed'));
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [courseId, t]);

  useEffect(() => {
    setGroupId((current) => {
      if (!groups.length) return undefined;
      if (initialGroupId && groups.some((group) => group.id === initialGroupId)) return initialGroupId;
      return current && groups.some((group) => group.id === current) ? current : groups[0]?.id;
    });
  }, [groups, initialGroupId]);

  useEffect(() => {
    if (!groupId) {
      setGroupForm(emptyGroupForm(defaultTimezone));
      setGenerationRange({ fromDate: '', toDate: '' });
      setGenerationPreview(null);
      return;
    }
    setGroupForm(groupToForm(selectedGroup, defaultTimezone));
    setGenerationRange({
      fromDate: selectedGroup?.startDate?.slice(0, 10) ?? '',
      toDate: selectedGroup?.endDate?.slice(0, 10) ?? '',
    });
    setGenerationPreview(null);
  }, [defaultTimezone, groupId, selectedGroup]);

  useEffect(() => {
    setSessions([]);
    setStudents([]);
    if (!groupId) return;
    let cancelled = false;
    setDetailLoading(true);
    Promise.all([listGroupSessions(groupId), listGroupStudents(groupId, { limit: 200 })])
      .then(([nextSessions, nextStudents]) => {
        if (cancelled) return;
        setSessions(nextSessions);
        setStudents(nextStudents);
      })
      .catch(() => {
        if (!cancelled) toast.error(t('groups.groupDetailLoadFailed'));
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [groupId, t]);

  useEffect(() => {
    if (!urlTabParam) return;
    const nextTab = validGroupWorkspaceTab(urlTabParam);
    setGroupWorkspaceTab((current) => current === nextTab ? current : nextTab);
  }, [urlTabParam]);

  useEffect(() => {
    const urlTab = validGroupWorkspaceTab(urlTabParam);
    if (urlTabParam && urlTab !== groupWorkspaceTab) return;
    const next = nextWorkflowSearchParams(searchParamsString, { courseId, groupId, tab: groupId ? groupWorkspaceTab : undefined });
    if (next.toString() !== searchParamsString) setSearchParams(next, { replace: true });
  }, [courseId, groupId, groupWorkspaceTab, searchParamsString, setSearchParams, urlTabParam]);

  const reloadGroups = async (nextCourseId = courseId, preferredGroupId = groupId) => {
    if (!nextCourseId) return;
    const nextGroups = await listCourseGroups(nextCourseId);
    setGroups(nextGroups);
    setGroupId(preferredGroupId && nextGroups.some((group) => group.id === preferredGroupId) ? preferredGroupId : nextGroups[0]?.id);
  };

  const reloadGroupDetail = async (nextGroupId = groupId) => {
    if (!nextGroupId) return;
    const [nextSessions, nextStudents] = await Promise.all([
      listGroupSessions(nextGroupId),
      listGroupStudents(nextGroupId, { limit: 200 }),
    ]);
    setSessions(nextSessions);
    setStudents(nextStudents);
  };

  const toPayload = () => ({
    name: groupForm.name.trim(),
    code: groupForm.code.trim() || undefined,
    deliveryMode: groupForm.deliveryMode,
    status: groupForm.status,
    startDate: groupForm.startDate || undefined,
    endDate: groupForm.endDate || undefined,
    seatLimit: positiveNumber(groupForm.seatLimit),
    timezone: groupForm.timezone.trim() || undefined,
    ...(selectedCourseOffline ? { location: groupForm.location.trim() || undefined } : {}),
    ...(selectedCourseLiveOnline ? {
      meetingProvider: groupForm.meetingProvider.trim() || undefined,
      meetingUrl: groupForm.meetingUrl.trim() || undefined,
    } : {}),
    scheduleNote: groupForm.scheduleNote.trim() || undefined,
    scheduleBlocks: scheduleBlocksPayload(groupForm.scheduleBlocks),
    instructorId: canAssignInstructor ? positiveNumber(groupForm.instructorId) : undefined,
  });

  const validateGroupForm = (mode: 'create' | 'edit') => {
    const validationForm = selectedCourseLiveOnline ? groupForm : { ...groupForm, meetingProvider: '', meetingUrl: '' };
    const nextErrors = validateSharedGroupForm(validationForm, {
      groupNameRequired: t('groups.groupNameRequired'),
      selectStudentForIndividual: t('groups.selectStudentForIndividual'),
      studentNameEmailRequired: t('groups.studentNameEmailRequired'),
      endDateAfterStart: t('groups.endDateAfterStart'),
      seatLimitInvalid: t('groups.seatLimitInvalid'),
      timezoneInvalid: t('groups.timezoneInvalid'),
      meetingUrlInvalid: t('groups.meetingUrlInvalid'),
      scheduleBlockIncomplete: t('groups.scheduleBlockIncomplete'),
      scheduleTimeInvalid: t('groups.scheduleTimeInvalid'),
      createFirstSessionSetupRequired: t('groups.createFirstSessionSetupRequired'),
    }, {
      mode,
      deliveryMode: groupForm.deliveryMode,
      enrollmentMode,
      selectedStudentId,
      newStudent: studentInviteForm,
      createFirstSession: groupForm.createFirstSession,
    });
    setCreateErrors(nextErrors);
    return nextErrors;
  };

  const clearCreateError = (key: keyof GroupValidationErrors) => {
    setCreateErrors((current) => ({ ...current, [key]: undefined }));
  };

  const submitCreateGroup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (savingGroupRef.current) return;
    if (!canCoordinateGroups) return;
    if (!courseId) return toast.error(t('groups.selectCourseFirst'));
    if (groupForm.deliveryMode === 'individual' && !canManageEnrollment) {
      return toast.error(t('groups.individualEnrollmentNotAllowed'));
    }
    const validationErrors = validateGroupForm('create');
    if (Object.keys(validationErrors).length) return toast.error(Object.values(validationErrors)[0] as string);
    const payload = toPayload();
    savingGroupRef.current = true;
    setSavingGroup(true);
    try {
      let individualStudentId = selectedStudentId;
      if (groupForm.deliveryMode === 'individual' && enrollmentMode === 'new') {
        if (!activeTenantId) throw new Error('Missing active tenant');
        const member = await inviteTenantMember(activeTenantId, {
          fullName: studentInviteForm.fullName.trim(),
          email: studentInviteForm.email.trim(),
          role: 'student',
          sendEmail: studentInviteForm.sendEmail,
        });
        individualStudentId = member.userId;
      }
      const saved = groupForm.deliveryMode === 'individual'
        ? (await createIndividualCourseGroup({
          courseId,
          studentId: individualStudentId as number,
          name: payload.name,
          startDate: payload.startDate,
          endDate: payload.endDate,
          timezone: payload.timezone,
          location: payload.location,
          meetingProvider: payload.meetingProvider,
          meetingUrl: payload.meetingUrl,
          scheduleBlocks: payload.scheduleBlocks,
          instructorId: payload.instructorId,
          createFirstSession: groupForm.createFirstSession,
        })).group
        : await createCourseGroup({
          ...payload,
          code: payload.code || `${courseId}-${Date.now().toString(36)}`.toUpperCase(),
          courseId,
        });
      await reloadGroups(courseId, saved.id);
      setIsCreateOpen(false);
      setStudentQuery('');
      setStudentResults([]);
      setSelectedStudentId(undefined);
      setStudentInviteForm(emptyStudentInviteForm);
      setEnrollmentMode('existing');
      setCreateErrors({});
      toast.success(t('groups.groupCreated'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('groups.groupCreateFailed')));
    } finally {
      savingGroupRef.current = false;
      setSavingGroup(false);
    }
  };

  const submitUpdateGroup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (savingGroupRef.current) return;
    if (!canCoordinateGroups) return;
    if (!groupId || !courseId) return;
    const validationErrors = validateGroupForm('edit');
    if (Object.keys(validationErrors).length) return toast.error(Object.values(validationErrors)[0] as string);
    savingGroupRef.current = true;
    setSavingGroup(true);
    try {
      await updateCourseGroup(groupId, toPayload());
      await reloadGroups(courseId, groupId);
      setIsEditOpen(false);
      setCreateErrors({});
      toast.success(t('groups.groupUpdated'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('groups.groupUpdateFailed')));
    } finally {
      savingGroupRef.current = false;
      setSavingGroup(false);
    }
  };

  const searchStudents = useCallback(async () => {
    setStudentSearchAttempted(true);
    const normalized = studentQuery.trim().toLowerCase();
    const localResults = tenantStudentOptions
      .filter((student) => !normalized
        || student.fullName?.toLowerCase().includes(normalized)
        || student.email.toLowerCase().includes(normalized))
      .slice(0, 12);
    try {
      const remoteResults = normalized ? await searchUsers({ search: studentQuery, role: 'student', limit: 12 }) : [];
      const seen = new Set<number>();
      const results = [...localResults, ...remoteResults].filter((student) => {
        if (seen.has(student.id)) return false;
        seen.add(student.id);
        return true;
      }).slice(0, 12);
      setStudentResults(results);
      setSelectedStudentId(results[0]?.id);
    } catch (error) {
      if (localResults.length) {
        setStudentResults(localResults);
        setSelectedStudentId(localResults[0]?.id);
        return;
      }
      toast.error(getApiErrorMessage(error, t('groups.studentSearchFailed')));
    }
  }, [studentQuery, t, tenantStudentOptions]);

  const handleStudentSearchChange = (value: string) => {
    setStudentQuery(value);
    setStudentResults([]);
    setSelectedStudentId(undefined);
    setStudentSearchAttempted(false);
  };

  const handleStudentSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    void searchStudents();
  };

  useEffect(() => {
    const canSearchInCreateModal = isCreateOpen && groupForm.deliveryMode === 'individual';
    const canSearchInRoster = isEnrollmentOpen && selectedGroup && enrollmentMode === 'existing';
    if (!canSearchInCreateModal && !canSearchInRoster) return;
    if (!studentQuery.trim()) {
      setStudentResults([]);
      setSelectedStudentId(undefined);
      setStudentSearchAttempted(false);
      return;
    }
    const timer = window.setTimeout(() => {
      void searchStudents();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [enrollmentMode, groupForm.deliveryMode, isCreateOpen, isEnrollmentOpen, searchStudents, selectedGroup, studentQuery]);

  const submitEnrollment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManageEnrollment) return;
    if (!courseId || !groupId || !selectedStudentId) return toast.error(t('groups.selectStudentToEnroll'));
    setEnrolling(true);
    try {
      await enrollUser({ courseId, groupId, userId: selectedStudentId });
      await reloadGroupDetail(groupId);
      setStudentQuery('');
      setStudentResults([]);
      setSelectedStudentId(undefined);
      setIsEnrollmentOpen(false);
      toast.success(t('groups.studentEnrolled'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('groups.studentEnrollFailed')));
    } finally {
      setEnrolling(false);
    }
  };

  const submitInviteAndEnroll = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManageEnrollment) return;
    if (!activeTenantId || !courseId || !groupId) return;
    if (!studentInviteForm.fullName.trim() || !studentInviteForm.email.trim()) {
      toast.error(t('groups.studentNameEmailRequired'));
      return;
    }
    setEnrolling(true);
    try {
      const member = await inviteTenantMember(activeTenantId, {
        fullName: studentInviteForm.fullName.trim(),
        email: studentInviteForm.email.trim(),
        role: 'student',
        sendEmail: studentInviteForm.sendEmail,
      });
      await enrollUser({ courseId, groupId, userId: member.userId });
      await reloadGroupDetail(groupId);
      setStudentInviteForm(emptyStudentInviteForm);
      setIsEnrollmentOpen(false);
      toast.success(member.onboarding?.emailSent ? t('groups.studentInvitedEnrolled') : t('groups.studentCreatedEnrolled'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('groups.studentCreateEnrollFailed')));
    } finally {
      setEnrolling(false);
    }
  };

  function openEnrollmentModal(mode: 'existing' | 'new' = 'existing') {
    setEnrollmentMode(mode);
    setStudentQuery('');
    setStudentResults([]);
    setSelectedStudentId(undefined);
    setStudentSearchAttempted(false);
    setStudentInviteForm(emptyStudentInviteForm);
    setIsEnrollmentOpen(true);
  }

  const removeStudent = async (student: GroupStudent) => {
    if (!canManageEnrollment) return;
    if (!courseId || !groupId) return;
    setRemovingStudentId(student.userId);
    try {
      await removeUserFromGroup(groupId, student.userId);
      await reloadGroupDetail(groupId);
      toast.success(t('groups.studentRemoved'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('groups.studentRemoveFailed')));
    } finally {
      setRemovingStudentId(undefined);
      setStudentToRemove(null);
    }
  };

  const previewGeneration = async () => {
    if (!canCoordinateGroups) return;
    if (!groupId) return;
    if (!generationReady) return toast.error(t('groups.completeScheduleFirst'));
    setGenerationLoading(true);
    try {
      setGenerationPreview(await previewGeneratedSessions(groupId, generationRange));
      toast.success(t('groups.previewReady'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('groups.previewFailed')));
    } finally {
      setGenerationLoading(false);
    }
  };

  const generateSessions = async () => {
    if (!canCoordinateGroups) return;
    if (!groupId || !generationPreview?.newCount) return toast.error(t('groups.previewNewSessionsFirst'));
    setGenerationLoading(true);
    try {
      const result = await generateGroupSessions(groupId, generationRange);
      await reloadGroupDetail(groupId);
      setGenerationPreview(null);
      toast.success(t('groups.sessionsCreated', { count: result.createdCount }));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('groups.generateFailed')));
    } finally {
      setGenerationLoading(false);
    }
  };

  const renderGroupForm = (mode: 'create' | 'edit' = 'edit') => (
    <>
      <section className="form-section">
        <h3>{t('groups.groupBasics')}</h3>
        {mode === 'create' ? (
          <>
            <div className="segmented-control delivery-mode-tabs" aria-label={t('groups.deliveryMode')}>
              <button type="button" aria-pressed={groupForm.deliveryMode === 'group'} className={groupForm.deliveryMode === 'group' ? 'active' : ''} onClick={() => setGroupForm((current) => ({ ...current, deliveryMode: 'group', seatLimit: current.seatLimit === '1' ? '' : current.seatLimit }))}>
                {t('groups.deliveryGroup')}
              </button>
              {canManageEnrollment ? (
                <button type="button" aria-pressed={groupForm.deliveryMode === 'individual'} className={groupForm.deliveryMode === 'individual' ? 'active' : ''} onClick={() => setGroupForm((current) => ({ ...current, deliveryMode: 'individual', seatLimit: '1' }))}>
                  {t('groups.deliveryIndividual')}
                </button>
              ) : null}
            </div>
            {groupForm.deliveryMode === 'individual' ? (
              <>
                <div className="segmented-control enrollment-tabs" aria-label={t('groups.enrollmentMode')}>
                  <button type="button" aria-pressed={enrollmentMode === 'existing'} className={enrollmentMode === 'existing' ? 'active' : ''} onClick={() => { setEnrollmentMode('existing'); clearCreateError('student'); }}>{t('groups.existingStudent')}</button>
                  <button type="button" aria-pressed={enrollmentMode === 'new'} className={enrollmentMode === 'new' ? 'active' : ''} onClick={() => { setEnrollmentMode('new'); clearCreateError('student'); }}>{t('groups.newStudent')}</button>
                </div>
                {enrollmentMode === 'existing' ? (
                  <div className="student-search-row compact">
                    <label>{t('groups.individualStudent')}<input value={studentQuery} onChange={(event) => { handleStudentSearchChange(event.target.value); clearCreateError('student'); }} onKeyDown={handleStudentSearchKeyDown} placeholder={t('groups.nameOrEmail')} className={createErrors.student ? 'input-error' : ''} aria-invalid={!!createErrors.student} /></label>
                    <button type="button" className="secondary-button" onClick={() => void searchStudents()} disabled={enrolling}>{enrolling ? t('groups.searchingStudents') : t('groups.search')}</button>
                    <select value={selectedStudentId ?? ''} onChange={(event) => { setSelectedStudentId(Number(event.target.value) || undefined); clearCreateError('student'); }} disabled={!studentResults.length} className={createErrors.student ? 'input-error' : ''} aria-invalid={!!createErrors.student}>
                      <option value="">{t('groups.selectStudent')}</option>
                      {studentResults.map((student) => <option key={student.id} value={student.id}>{student.fullName || student.email} ({student.email})</option>)}
                    </select>
                    {studentSearchAttempted && !enrolling && !studentResults.length ? <span className="field-note">{t('groups.noMatchingStudents')}</span> : null}
                  </div>
                ) : (
                  <div className="student-search-row compact">
                    <label>{t('groups.fullName')}<input value={studentInviteForm.fullName} onChange={(event) => { setStudentInviteForm((current) => ({ ...current, fullName: event.target.value })); clearCreateError('student'); }} placeholder={t('groups.fullName')} className={createErrors.student ? 'input-error' : ''} aria-invalid={!!createErrors.student} /></label>
                    <label>{t('groups.email')}<input type="email" value={studentInviteForm.email} onChange={(event) => { setStudentInviteForm((current) => ({ ...current, email: event.target.value })); clearCreateError('student'); }} placeholder="student@example.com" className={createErrors.student ? 'input-error' : ''} aria-invalid={!!createErrors.student} /></label>
                    <label className="inline-check"><input type="checkbox" checked={studentInviteForm.sendEmail} onChange={(event) => setStudentInviteForm((current) => ({ ...current, sendEmail: event.target.checked }))} /> {t('groups.sendSetupEmail')}</label>
                  </div>
                )}
                {createErrors.student ? <span className="field-error">{createErrors.student}</span> : null}
                <label className="inline-check">
                  <input
                    type="checkbox"
                    checked={groupForm.createFirstSession}
                    onChange={(event) => setGroupForm((current) => ({ ...current, createFirstSession: event.target.checked }))}
                  /> {t('groups.createFirstSession')}
                </label>
                {groupForm.createFirstSession ? <p className="panel-note">{t('groups.createFirstSessionHint')}</p> : null}
              </>
            ) : null}
          </>
        ) : (
          <span className={`status-badge delivery-${groupForm.deliveryMode}`}>{deliveryModeLabel(groupForm.deliveryMode)}</span>
        )}
        <div className={groupForm.deliveryMode === 'individual' ? '' : 'two-col'}>
          <label className="required-field"><span>{t('groups.name')}</span><input required value={groupForm.name} onChange={(event) => { setGroupForm((current) => ({ ...current, name: event.target.value })); clearCreateError('name'); }} className={createErrors.name ? 'input-error' : ''} aria-invalid={!!createErrors.name} />{createErrors.name ? <span className="field-error">{createErrors.name}</span> : null}</label>
          {groupForm.deliveryMode !== 'individual' ? (
            <label>{t('groups.code')}<input value={groupForm.code} onChange={(event) => setGroupForm((current) => ({ ...current, code: event.target.value }))} placeholder={t('groups.codePlaceholder')} /></label>
          ) : null}
        </div>
        {groupForm.deliveryMode !== 'individual' ? (
          <label>{t('groups.status')}<select value={groupForm.status} onChange={(event) => setGroupForm((current) => ({ ...current, status: event.target.value as GroupStatus }))}>
            <option value="planned">{t('courses.statusPlanned')}</option><option value="open">{t('groups.statusOpen')}</option><option value="active">{t('groups.statusActive')}</option><option value="completed">{t('groups.statusCompleted')}</option><option value="cancelled">{t('groups.statusCancelled')}</option>
          </select></label>
        ) : null}
      </section>
      <section className="form-section">
        <h3>{t('groups.datesCapacity')}</h3>
        <div className="two-col">
          <label>{t('groups.startDate')}<input type="date" value={groupForm.startDate} onChange={(event) => { setGroupForm((current) => ({ ...current, startDate: event.target.value })); clearCreateError('dates'); clearCreateError('schedule'); }} className={createErrors.dates ? 'input-error' : ''} aria-invalid={!!createErrors.dates} /></label>
          <label>{t('groups.endDate')}<input type="date" value={groupForm.endDate} onChange={(event) => { setGroupForm((current) => ({ ...current, endDate: event.target.value })); clearCreateError('dates'); }} className={createErrors.dates ? 'input-error' : ''} aria-invalid={!!createErrors.dates} /></label>
        </div>
        {createErrors.dates ? <span className="field-error">{createErrors.dates}</span> : null}
        <div className="two-col">
          <label>{t('groups.seatLimit')}<input type="number" min="1" step="1" value={groupForm.deliveryMode === 'individual' ? '1' : groupForm.seatLimit} onChange={(event) => { setGroupForm((current) => ({ ...current, seatLimit: event.target.value })); clearCreateError('seatLimit'); }} placeholder={t('groups.noLimit')} disabled={groupForm.deliveryMode === 'individual'} className={createErrors.seatLimit ? 'input-error' : ''} aria-invalid={!!createErrors.seatLimit} />{createErrors.seatLimit ? <span className="field-error">{createErrors.seatLimit}</span> : null}</label>
          <label>{t('groups.timezone')}<input value={groupForm.timezone} onChange={(event) => { setGroupForm((current) => ({ ...current, timezone: event.target.value })); clearCreateError('timezone'); }} className={createErrors.timezone ? 'input-error' : ''} aria-invalid={!!createErrors.timezone} />{createErrors.timezone ? <span className="field-error">{createErrors.timezone}</span> : null}</label>
        </div>
      </section>
      <section className="form-section">
        <h3>{t('groups.instructorLocation')}</h3>
        {canAssignInstructor ? (
          <label>{t('groups.instructor')}<select value={groupForm.instructorId} onChange={(event) => setGroupForm((current) => ({ ...current, instructorId: event.target.value }))}>
            <option value="">{t('groups.useCourseInstructor')}</option>
            {instructorOptions.map((member) => <option key={member.userId} value={member.userId}>{member.fullName || member.user?.fullName || member.email || member.user?.email || t('groups.instructorFallback', { id: member.userId })}</option>)}
          </select></label>
        ) : null}
        {selectedCourseOffline ? (
          <label>{t('groups.location')}<input value={groupForm.location} onChange={(event) => setGroupForm((current) => ({ ...current, location: event.target.value }))} /></label>
        ) : null}
        {selectedCourseLiveOnline ? (
          <div className="two-col">
            <label>{t('groups.meetingProvider')}<input value={groupForm.meetingProvider} onChange={(event) => setGroupForm((current) => ({ ...current, meetingProvider: event.target.value }))} /></label>
            <label>{t('groups.meetingUrl')}<input value={groupForm.meetingUrl} onChange={(event) => { setGroupForm((current) => ({ ...current, meetingUrl: event.target.value })); clearCreateError('meetingUrl'); }} className={createErrors.meetingUrl ? 'input-error' : ''} aria-invalid={!!createErrors.meetingUrl} />{createErrors.meetingUrl ? <span className="field-error">{createErrors.meetingUrl}</span> : null}</label>
          </div>
        ) : null}
      </section>
      <section className="form-section">
        <h3>{t('groups.recurringSchedule')}</h3>
        <div className="schedule-block-list">
          {groupForm.scheduleBlocks.map((block, index) => (
            <div className="three-col" key={`${index}-${block.day}`}>
              <label>{t('groups.scheduleDay')}<select value={block.day} onChange={(event) => setGroupForm((current) => ({
                ...current,
                scheduleBlocks: current.scheduleBlocks.map((item, itemIndex) => itemIndex === index ? { ...item, day: event.target.value as ScheduleDay } : item),
              }))} onFocus={() => clearCreateError('schedule')} className={createErrors.schedule ? 'input-error' : ''} aria-invalid={!!createErrors.schedule}>
                <option value="mon">{t('groups.dayMon')}</option><option value="tue">{t('groups.dayTue')}</option><option value="wed">{t('groups.dayWed')}</option><option value="thu">{t('groups.dayThu')}</option><option value="fri">{t('groups.dayFri')}</option><option value="sat">{t('groups.daySat')}</option><option value="sun">{t('groups.daySun')}</option>
              </select></label>
              <label>{t('groups.starts')}<input type="time" value={block.startTime} onChange={(event) => setGroupForm((current) => ({
                ...current,
                scheduleBlocks: current.scheduleBlocks.map((item, itemIndex) => itemIndex === index ? { ...item, startTime: event.target.value } : item),
              }))} onFocus={() => clearCreateError('schedule')} className={createErrors.schedule ? 'input-error' : ''} aria-invalid={!!createErrors.schedule} /></label>
              <label>{t('groups.ends')}<input type="time" value={block.endTime} onChange={(event) => setGroupForm((current) => ({
                ...current,
                scheduleBlocks: current.scheduleBlocks.map((item, itemIndex) => itemIndex === index ? { ...item, endTime: event.target.value } : item),
              }))} onFocus={() => clearCreateError('schedule')} className={createErrors.schedule ? 'input-error' : ''} aria-invalid={!!createErrors.schedule} /></label>
              {groupForm.scheduleBlocks.length > 1 ? (
                <button type="button" className="secondary-button" onClick={() => setGroupForm((current) => ({
                  ...current,
                  scheduleBlocks: current.scheduleBlocks.filter((_, itemIndex) => itemIndex !== index),
                }))}>{t('groups.removeBlock')}</button>
              ) : null}
            </div>
          ))}
          <button type="button" className="secondary-button" onClick={() => setGroupForm((current) => ({
            ...current,
            scheduleBlocks: [...current.scheduleBlocks, emptyScheduleBlock()],
          }))}>{t('groups.addScheduleBlock')}</button>
        </div>
        {createErrors.schedule ? <span className="field-error">{createErrors.schedule}</span> : null}
        {groupForm.deliveryMode !== 'individual' ? (
          <label>{t('groups.scheduleNote')}<textarea value={groupForm.scheduleNote} onChange={(event) => setGroupForm((current) => ({ ...current, scheduleNote: event.target.value }))} /></label>
        ) : null}
      </section>
    </>
  );

  return (
    <>
      <PageHeader title={t('navigation.groups')} eyebrow={activeTenant?.name} />
      {selectedCourse && selectedGroup && !selectorsExpanded ? (
        <section className="group-context-strip">
          <div>
            <span>{t('navigation.courses')}</span>
            <strong>{selectedCourse.title}</strong>
          </div>
          <div>
            <span>{t('groups.courseGroups')}</span>
            <strong>{selectedGroup.name}</strong>
          </div>
          <button type="button" className="secondary-button" onClick={() => setSelectorsExpanded(true)}>
            {t('groups.changeSelection')}
          </button>
        </section>
      ) : (
        <div className="workspace-grid">
          <section className="content-section">
            <div className="section-heading-row">
              <div><h2>{t('navigation.courses')}</h2><span>{t('groups.courseSelectionHint')}</span></div>
              {canCoordinateGroups ? (
                <button type="button" className="primary-button" onClick={() => { setGroupForm(emptyGroupForm(defaultTimezone)); setCreateErrors({}); setEnrollmentMode('existing'); setStudentQuery(''); setStudentResults([]); setSelectedStudentId(undefined); setStudentInviteForm(emptyStudentInviteForm); setIsCreateOpen(true); }} disabled={!selectedCourseReady} title={!selectedCourseReady ? selectedCourseBlocker : undefined}><FiPlus /> {t('groups.createGroup')}</button>
              ) : null}
            </div>
            {selectedCourse && selectedGroup ? (
              <div className="context-collapse-action">
                <button type="button" className="secondary-button" onClick={() => setSelectorsExpanded(false)}>{t('groups.collapseSelection')}</button>
              </div>
            ) : null}
            {canCoordinateGroups && !selectedCourseReady ? (
              <p className="panel-note">{selectedCourseBlocker}</p>
            ) : null}
            {ineligibleCourseCount > 0 ? (
              <p className="panel-note">{t('groups.ineligibleCourses', { count: ineligibleCourseCount })}</p>
            ) : null}
            <input value={courseQuery} onChange={(event) => setCourseQuery(event.target.value)} placeholder={t('groups.searchCourses')} />
            {loading ? <LoadingState label={t('courses.loading')} /> : null}
            <div className="stack-list">
              {filteredCourses.map((course) => (
                <button key={course.id} type="button" className={`stack-list-item ${course.id === courseId ? 'active' : ''}`} onClick={() => setCourseId(course.id)}>
                  <div><strong>{course.title}</strong><span>{courseTypeLabel(course.courseType)} · {statusLabel(course.status)}</span></div>
                  <strong className="muted-count">{course.id === courseId ? isCourseWorkflowReady(course) ? t('groups.groupCount', { count: groups.length }) : t('groups.locked') : t('groups.select')}</strong>
                </button>
              ))}
              {!filteredCourses.length ? <EmptyState title={t('courses.noMatchesTitle')} detail={t('groups.noMatchingCoursesDetail')} action={<Link className="secondary-link-button" to="/courses">{t('overview.openCourses')}</Link>} /> : null}
            </div>
          </section>

          <aside className="settings-panel workflow-context-panel">
            <div className="section-heading-row compact">
              <div><h2>{t('groups.courseGroups')}</h2><span>{selectedCourse?.title ?? t('groups.chooseCourse')}</span></div>
            </div>
            {detailLoading ? <LoadingState label={t('groups.loadingGroups')} /> : null}
            <div className="stack-list">
              {groups.map((group) => (
                <button key={group.id} type="button" className={`stack-list-item ${group.id === groupId ? 'active' : ''}`} onClick={() => setGroupId(group.id)}>
                  <div><strong>{group.name}</strong><span>{group.code ?? '-'} · {statusLabel(group.status)}</span></div>
                  <span className={`status-badge delivery-${group.deliveryMode ?? 'group'}`}>{deliveryModeLabel(group.deliveryMode)}</span>
                </button>
              ))}
              {!groups.length ? (
                <EmptyState
                  title={t('groups.emptyGroupsTitle')}
                  detail={selectedCourseReady ? t('groups.emptyGroupsDetail') : selectedCourseBlocker}
                  action={selectedCourseReady && canCoordinateGroups ? (
                    <button type="button" className="secondary-button" onClick={() => { setGroupForm(emptyGroupForm(defaultTimezone)); setCreateErrors({}); setEnrollmentMode('existing'); setStudentQuery(''); setStudentResults([]); setSelectedStudentId(undefined); setStudentInviteForm(emptyStudentInviteForm); setIsCreateOpen(true); }}>
                      {t('groups.createGroup')}
                    </button>
                  ) : null}
                />
              ) : null}
            </div>
          </aside>
        </div>
      )}

      {selectedGroup ? (
        <section className="workflow-section workflow-context-panel group-workspace-panel">
          <div className="section-heading-row group-detail-header">
            <div>
              <div className="group-title-row">
                <h2>{selectedGroup.name}</h2>
                <span className={`status-badge ${selectedGroup.status ?? 'planned'}`}>{statusLabel(selectedGroup.status)}</span>
                <span className={`status-badge delivery-${selectedGroup.deliveryMode ?? 'group'}`}>{deliveryModeLabel(selectedGroup.deliveryMode)}</span>
              </div>
              <span>{selectedIndividualStudentName || selectedCourse?.title || t('courses.selectedCourse')}</span>
            </div>
            <div className="page-actions group-action-bar">
              {canCoordinateGroups ? (
                <button type="button" className="secondary-button" onClick={() => { setGroupForm(groupToForm(selectedGroup, defaultTimezone)); setCreateErrors({}); setIsEditOpen(true); }}><FiEdit2 /> {t('groups.editGroup')}</button>
              ) : null}
              <Link className="secondary-link-button" to={nextSessionLink}><FiCalendar /> {t('navigation.sessions')}</Link>
              <Link className="secondary-link-button" to={attendanceLink}><FiCheckSquare /> {t('navigation.attendance')}</Link>
              <Link className="secondary-link-button" to={homeworkLink}><FiClipboard /> {t('navigation.homework')}</Link>
            </div>
          </div>
          {nextBestAction ? (
            <div className={`group-next-action ${nextBestAction.tone}`}>
              <div>
                <strong>{nextBestAction.title}</strong>
                <span>{nextBestAction.detail}</span>
              </div>
              {nextBestAction.action}
            </div>
          ) : null}
          <div className="group-workspace-tabs" role="tablist" aria-label={t('groups.workspaceTabs')}>
            {groupTabs.map((tab, index) => (
              <button
                key={tab.id}
                id={`group-workspace-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={groupWorkspaceTab === tab.id}
                aria-controls={`group-workspace-panel-${tab.id}`}
                tabIndex={groupWorkspaceTab === tab.id ? 0 : -1}
                className={groupWorkspaceTab === tab.id ? 'active' : ''}
                onClick={() => setGroupWorkspaceTab(tab.id)}
                onKeyDown={(event) => {
                  const direction = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
                  if (!direction) return;
                  event.preventDefault();
                  const nextIndex = (index + direction + groupTabs.length) % groupTabs.length;
                  const nextTab = groupTabs[nextIndex];
                  setGroupWorkspaceTab(nextTab.id);
                  window.requestAnimationFrame(() => document.getElementById(`group-workspace-tab-${nextTab.id}`)?.focus());
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {groupWorkspaceTab === 'overview' ? (
            <div id="group-workspace-panel-overview" role="tabpanel" aria-labelledby="group-workspace-tab-overview">
              <div className="group-operations-strip" aria-label={t('groups.quickActions')}>
                <Link to={nextSessionLink}>
                  <FiCalendar />
                  <span>{t('groups.nextSession')}</span>
                  <strong>{nextSession ? formatDate(nextSession.startsAt) : t('groups.noSessionsTitle')}</strong>
                  <FiArrowRight />
                </Link>
                <Link to={attendanceLink}>
                  <FiCheckSquare />
                  <span>{t('navigation.attendance')}</span>
                  <strong>{students.length ? t('groups.activeLearnerCount', { count: students.length }) : t('groups.noStudentsTitle')}</strong>
                  <FiArrowRight />
                </Link>
                <Link to={homeworkLink}>
                  <FiClipboard />
                  <span>{t('navigation.homework')}</span>
                  <strong>{t('groups.groupHomeworkAction')}</strong>
                  <FiArrowRight />
                </Link>
                <button type="button" onClick={() => setGroupWorkspaceTab('students')}>
                  <FiUsers />
                  <span>{t('groups.studentsTab')}</span>
                  <strong>{students.length}</strong>
                  <FiArrowRight />
                </button>
              </div>
              <div className="group-summary-grid">
                <section>
                  <span>{t('courses.students')}</span>
                  <strong>{students.length}</strong>
                </section>
                <section>
                  <span>{t('courses.sessions')}</span>
                  <strong>{sessions.length}</strong>
                </section>
                <section>
                  <span>{t('groups.capacity')}</span>
                  <strong>{selectedGroup.seatLimit ?? t('groups.capacityOpen')}</strong>
                </section>
                <section>
                  <span>{t('groups.dates')}</span>
                  <strong>{selectedGroup.startDate || selectedGroup.endDate ? `${selectedGroup.startDate ?? '-'} - ${selectedGroup.endDate ?? '-'}` : t('groups.notScheduled')}</strong>
                </section>
                <section className="wide-field">
                  <span>{t('groups.schedule')}</span>
                  <strong>{scheduleBlockSummary}</strong>
                </section>
                <section>
                  <span>{t('groups.location')}</span>
                  <strong>{selectedGroup.location || selectedGroup.meetingProvider || t('states.notSet')}</strong>
                </section>
              </div>
              <div className="group-overview-secondary">
                <section>
                  <span>{t('groups.deliveryMode')}</span>
                  <strong>{deliveryModeLabel(selectedGroup.deliveryMode)}</strong>
                </section>
                <section>
                  <span>{t('groups.timezone')}</span>
                  <strong>{selectedGroup.timezone ?? '-'}</strong>
                </section>
              </div>
            </div>
          ) : null}
          {groupWorkspaceTab === 'students' ? (
            <section id="group-workspace-panel-students" role="tabpanel" aria-labelledby="group-workspace-tab-students" className="content-section group-roster-panel">
              <div className="section-heading-row">
                <div><h2>{t('groups.roster')}</h2><span>{t('groups.activeLearnerCount', { count: students.length })}</span></div>
                {canManageEnrollment ? (
                  <button type="button" className="secondary-button" onClick={() => openEnrollmentModal('existing')} disabled={!courseId || !groupId || enrolling}>
                    {t('sessions.enrollStudent')}
                  </button>
                ) : null}
              </div>
              <div className="stack-list">
                {students.map((student) => (
                  <article key={student.userId} className="stack-list-item">
                    <div><strong>{student.fullName || student.email || t('courses.studentFallback', { id: student.userId })}</strong><span>{student.email || t('groups.noEmail')} · {t('groups.progressPercent', { percent: Math.round(student.progressPercent ?? 0) })}</span></div>
                    {canManageEnrollment ? (
                      <button type="button" className="link-button danger" onClick={() => setStudentToRemove(student)} disabled={removingStudentId === student.userId}>
                        {removingStudentId === student.userId ? t('groups.removing') : t('groups.remove')}
                      </button>
                    ) : null}
                  </article>
                ))}
                {!students.length ? (
                  <EmptyState
                    title={t('groups.noStudentsTitle')}
                    detail={t('groups.noStudentsDetail')}
                    action={canManageEnrollment ? (
                      <button type="button" className="secondary-button" onClick={() => openEnrollmentModal('new')}>
                        {t('groups.newStudent')}
                      </button>
                    ) : null}
                  />
                ) : null}
              </div>
            </section>
          ) : null}
          {groupWorkspaceTab === 'sessions' ? (
            <div id="group-workspace-panel-sessions" role="tabpanel" aria-labelledby="group-workspace-tab-sessions" className="workspace-grid group-detail-grid">
              {canCoordinateGroups ? (
                <div className="settings-panel session-generation-panel workflow-context-panel compact group-generation-panel">
                  <div className="section-heading-row compact"><div><h3>{t('groups.generateSessions')}</h3><span>{t('groups.generateSessionsHint')}</span></div></div>
                  <p className={`panel-note ${generationReady ? 'success' : ''}`}>
                    {generationReady ? t('groups.generationReady') : t('groups.generationNeedsSetup')}
                  </p>
                  <div className="group-schedule-preview">
                    <span>{t('groups.schedule')}</span>
                    <strong>{scheduleBlockSummary}</strong>
                  </div>
                  <div className="three-col">
                    <label>{t('groups.from')}<input type="date" value={generationRange.fromDate} onChange={(event) => setGenerationRange((current) => ({ ...current, fromDate: event.target.value }))} /></label>
                    <label>{t('groups.to')}<input type="date" value={generationRange.toDate} onChange={(event) => setGenerationRange((current) => ({ ...current, toDate: event.target.value }))} /></label>
                    <div className="generation-actions">
                      <button type="button" className="secondary-button" onClick={() => void previewGeneration()} disabled={generationLoading || !generationReady}>{t('groups.preview')}</button>
                      <button type="button" onClick={() => void generateSessions()} disabled={generationLoading || !generationPreview?.newCount}>{t('groups.generate')}</button>
                    </div>
                  </div>
                  {generationPreview ? (
                    <div className="generation-preview">
                      <span>{t('groups.total')} <strong>{generationPreview.total}</strong></span>
                      <span>{t('groups.new')} <strong>{generationPreview.newCount}</strong></span>
                      <span>{t('groups.existing')} <strong>{generationPreview.existingCount}</strong></span>
                      <div className="stack-list">
                        {generationPreview.items.slice(0, 6).map((item) => (
                          <article key={`${item.kind}-${item.sessionIndex}-${item.startsAt}`} className="stack-list-item">
                            <div><strong>{item.title}</strong><span>{item.day} · {formatDate(item.startsAt)}</span></div>
                            <span className={`status-badge ${item.kind === 'new' ? 'pending' : 'scheduled'}`}>{statusLabel(item.kind)}</span>
                          </article>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <aside className="settings-panel workflow-context-panel upcoming-sessions-panel">
              <div className="section-heading-row compact"><div><h2>{t('groups.upcomingSessions')}</h2><span>{selectedGroup.name}</span></div></div>
              <div className="stack-list">
                {sessions.slice(0, 8).map((session) => (
                  <article key={session.id} className="stack-list-item">
                    <div><strong>{session.title}</strong><span>{selectedIndividualStudentName ? `${selectedIndividualStudentName} · ${formatDate(session.startsAt)}` : formatDate(session.startsAt)}</span></div>
                    <span className={`status-badge ${session.status ?? 'scheduled'}`}>{statusLabel(session.status)}</span>
                  </article>
                ))}
                {!sessions.length ? (
                  <EmptyState
                    title={t('groups.noSessionsTitle')}
                    detail={t('groups.noSessionsDetail')}
                    action={<Link className="secondary-link-button" to={nextSessionLink}>{t('attendance.scheduleSessions')}</Link>}
                  />
                ) : null}
              </div>
              </aside>
            </div>
          ) : null}
          {groupWorkspaceTab === 'settings' ? (
            <div id="group-workspace-panel-settings" role="tabpanel" aria-labelledby="group-workspace-tab-settings" className="settings-panel group-settings-panel">
              <div className="definition-grid">
                <span>{t('navigation.courses')}</span><strong>{selectedCourse?.title ?? '-'}</strong>
                <span>{t('groups.code')}</span><strong>{selectedGroup.code ?? '-'}</strong>
                <span>{t('groups.deliveryMode')}</span><strong>{deliveryModeLabel(selectedGroup.deliveryMode)}</strong>
                <span>{t('groups.timezone')}</span><strong>{selectedGroup.timezone ?? '-'}</strong>
                <span>{t('groups.location')}</span><strong>{selectedGroup.location || selectedGroup.meetingProvider || t('states.notSet')}</strong>
              </div>
              {canCoordinateGroups ? (
                <div className="modal-actions">
                  <button type="button" className="primary-button" onClick={() => { setGroupForm(groupToForm(selectedGroup, defaultTimezone)); setCreateErrors({}); setIsEditOpen(true); }}><FiEdit2 /> {t('groups.editGroup')}</button>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {isEditOpen && selectedGroup && canCoordinateGroups ? (
        <FormModal labelledBy="edit-group-title" className="decision-modal form-modal group-form-modal" onClose={() => setIsEditOpen(false)} onSubmit={submitUpdateGroup}>
          <div className="modal-header-block">
            <span>{selectedCourse?.title ?? t('courses.selectedCourse')}</span>
            <h2 id="edit-group-title">{t('groups.editGroup')}</h2>
          </div>
          {renderGroupForm('edit')}
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={() => setIsEditOpen(false)} disabled={savingGroup}>{t('courses.cancel')}</button>
            <button type="submit" className="primary-button" disabled={savingGroup}>{savingGroup ? t('courses.saving') : t('groups.saveGroup')}</button>
          </div>
        </FormModal>
      ) : null}

      {isCreateOpen && canCoordinateGroups ? (
        <FormModal labelledBy="create-group-title" className="decision-modal form-modal group-form-modal" onClose={() => setIsCreateOpen(false)} onSubmit={submitCreateGroup}>
          <div className="modal-header-block">
            <span>{selectedCourse?.title ?? t('groups.courseRequired')}</span>
            <h2 id="create-group-title">{t('groups.createGroup')}</h2>
          </div>
          {renderGroupForm('create')}
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={() => setIsCreateOpen(false)} disabled={savingGroup}>{t('courses.cancel')}</button>
            <button type="submit" className="primary-button" disabled={savingGroup}>{savingGroup ? t('courses.saving') : t('groups.createGroup')}</button>
          </div>
        </FormModal>
      ) : null}
      {isEnrollmentOpen && selectedGroup && canManageEnrollment ? (
        <FormModal
          labelledBy="enroll-student-title"
          className="decision-modal form-modal enrollment-form-modal"
          onClose={() => setIsEnrollmentOpen(false)}
          onSubmit={enrollmentMode === 'existing' ? submitEnrollment : submitInviteAndEnroll}
        >
          <div className="modal-header-block">
            <span>{selectedGroup.name}</span>
            <h2 id="enroll-student-title">{t('sessions.enrollStudent')}</h2>
            <p>{t('sessions.enrollStudentDetail')}</p>
          </div>
          <div className="segmented-control enrollment-tabs" aria-label={t('groups.enrollmentMode')}>
            <button type="button" aria-pressed={enrollmentMode === 'existing'} className={enrollmentMode === 'existing' ? 'active' : ''} onClick={() => setEnrollmentMode('existing')}>
              {t('groups.existingStudent')}
            </button>
            <button type="button" aria-pressed={enrollmentMode === 'new'} className={enrollmentMode === 'new' ? 'active' : ''} onClick={() => setEnrollmentMode('new')}>
              {t('groups.newStudent')}
            </button>
          </div>
          {enrollmentMode === 'existing' ? (
            <>
              <div className="student-search-row">
                <label>
                  {t('groups.searchStudent')}
                  <input value={studentQuery} onChange={(event) => handleStudentSearchChange(event.target.value)} onKeyDown={handleStudentSearchKeyDown} placeholder={t('groups.nameOrEmail')} autoFocus />
                </label>
                <button type="button" className="secondary-button" onClick={() => void searchStudents()} disabled={enrolling}>
                  {enrolling ? t('groups.searchingStudents') : t('groups.search')}
                </button>
              </div>
              <label>
                {t('courses.student')}
                <select value={selectedStudentId ?? ''} onChange={(event) => setSelectedStudentId(Number(event.target.value) || undefined)} disabled={!studentResults.length}>
                  <option value="">{t('groups.selectStudent')}</option>
                  {studentResults.map((student) => <option key={student.id} value={student.id}>{student.fullName || student.email} ({student.email})</option>)}
                </select>
              </label>
              {studentSearchAttempted && !enrolling && !studentResults.length ? <span className="field-note">{t('groups.noMatchingStudents')}</span> : null}
            </>
          ) : (
            <>
              <div className="two-col">
                <label>{t('groups.fullName')}<input value={studentInviteForm.fullName} onChange={(event) => setStudentInviteForm((current) => ({ ...current, fullName: event.target.value }))} placeholder={t('groups.fullName')} autoFocus /></label>
                <label>{t('groups.email')}<input type="email" value={studentInviteForm.email} onChange={(event) => setStudentInviteForm((current) => ({ ...current, email: event.target.value }))} placeholder="student@example.com" /></label>
              </div>
              <label className="inline-check"><input type="checkbox" checked={studentInviteForm.sendEmail} onChange={(event) => setStudentInviteForm((current) => ({ ...current, sendEmail: event.target.checked }))} /> {t('groups.sendSetupEmail')}</label>
            </>
          )}
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={() => setIsEnrollmentOpen(false)} disabled={enrolling}>{t('courses.cancel')}</button>
            <button type="submit" className="primary-button" disabled={!courseId || !groupId || (enrollmentMode === 'existing' && !selectedStudentId) || enrolling}>
              {enrolling ? t('auth.working') : enrollmentMode === 'existing' ? t('sessions.enrollStudent') : t('groups.createAndEnroll')}
            </button>
          </div>
        </FormModal>
      ) : null}
      {studentToRemove && canManageEnrollment ? (
        <Modal labelledBy="remove-student-title" onClose={() => setStudentToRemove(null)}>
          <div className="modal-header-block">
            <span>{t('groups.removeEnrollment')}</span>
            <h2 id="remove-student-title">{t('groups.removeStudentTitle')}</h2>
          </div>
          <p className="muted-text">
            {t('groups.removeStudentDetail', { name: studentToRemove.fullName || studentToRemove.email || t('courses.studentFallback', { id: studentToRemove.userId }) })}
          </p>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={() => setStudentToRemove(null)} disabled={removingStudentId === studentToRemove.userId}>{t('courses.cancel')}</button>
            <button type="button" className="danger-button" onClick={() => void removeStudent(studentToRemove)} disabled={removingStudentId === studentToRemove.userId}>
              {removingStudentId === studentToRemove.userId ? t('groups.removing') : t('groups.removeStudent')}
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
