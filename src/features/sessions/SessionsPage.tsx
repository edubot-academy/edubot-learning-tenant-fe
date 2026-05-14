import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState, LoadingState } from '../../components/DataState';
import { FormModal, Modal } from '../../components/Modal';
import { WorkspaceTabs } from '../../components/WorkspaceTabs';
import {
  createSessionActivity,
  createCourseGroup,
  createGroupSession,
  createLiveMeeting,
  deleteLiveMeeting,
  deleteSessionActivity,
  enrollUser,
  generateGroupSessions,
  getLiveMeeting,
  getSessionActivityResponses,
  getSessionAttendance,
  getSessionInsights,
  inviteTenantMember,
  listCourseGroups,
  listGroupSessions,
  listGroupStudents,
  listSessionHomework,
  listTenantMembers,
  listTenantCourses,
  previewGeneratedSessions,
  searchUsers,
  reviewSessionActivitySubmission,
  updateCourseGroup,
  updateGroupSession,
  updateLiveMeeting,
  updateSessionActivity,
  unenrollUser,
  uploadSessionMaterial,
} from '../../services/api';
import type { AttendanceRecord, CompanyMember, Course, CourseGroup, CourseSession, GroupStudent, LiveMeeting, SessionActivity, SessionActivityResponseSet, SessionActivityStatus, SessionActivityType, SessionGenerationPreview, SessionHomework, SessionInsights, UserSummary } from '../../types/domain';
import { formatDate } from '../../lib/format';
import { activityTypeLabelKeys, commonStatusLabelKeys, enumLabel } from '../../lib/enumLabels';
import { useTenant } from '../tenant/TenantProvider';
import { useAuth } from '../auth/AuthProvider';
import { canCoordinateTenantLearning, canEnrollTenantStudents, canTeachAssignedSessions, isTenantAdmin } from '../tenant/tenantRoles';
import { isCourseWorkflowReady, nextWorkflowSearchParams } from '../workflows/workflowContext';

type GroupStatus = 'planned' | 'open' | 'active' | 'completed' | 'cancelled';
type ScheduleDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
type ScheduleBlockForm = { day: ScheduleDay; startTime: string; endTime: string };

const emptyScheduleBlock = (): ScheduleBlockForm => ({
  day: 'mon',
  startTime: '',
  endTime: '',
});

const emptyGroupForm = {
  name: '',
  code: '',
  status: 'active' as GroupStatus,
  startDate: '',
  endDate: '',
  seatLimit: '',
  timezone: 'Asia/Bishkek',
  location: '',
  meetingProvider: '',
  meetingUrl: '',
  scheduleNote: '',
  scheduleBlocks: [emptyScheduleBlock()],
  instructorId: '',
};

const emptySessionForm = {
  title: '',
  startsAt: '',
  endsAt: '',
  notes: '',
};

const emptyEditGroupForm = {
  name: '',
  code: '',
  status: 'active' as GroupStatus,
  startDate: '',
  endDate: '',
  seatLimit: '',
  timezone: 'Asia/Bishkek',
  location: '',
  meetingProvider: '',
  meetingUrl: '',
  scheduleNote: '',
  scheduleBlocks: [emptyScheduleBlock()],
  instructorId: '',
};

const emptyStudentInviteForm = {
  fullName: '',
  email: '',
  sendEmail: false,
};

function groupToForm(group?: CourseGroup | null) {
  if (!group) return emptyEditGroupForm;
  const scheduleBlocks = Array.isArray(group.scheduleBlocks) && group.scheduleBlocks.length
    ? group.scheduleBlocks.map((block) => ({
      day: (['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].includes(String(block.day)) ? block.day : 'mon') as ScheduleDay,
      startTime: block.startTime ?? '',
      endTime: block.endTime ?? '',
    }))
    : [emptyScheduleBlock()];
  return {
    name: group.name ?? '',
    code: group.code ?? '',
    status: ['planned', 'open', 'active', 'completed', 'cancelled'].includes(String(group.status))
      ? group.status as GroupStatus
      : 'active',
    startDate: group.startDate ? group.startDate.slice(0, 10) : '',
    endDate: group.endDate ? group.endDate.slice(0, 10) : '',
    seatLimit: group.seatLimit ? String(group.seatLimit) : '',
    timezone: group.timezone ?? 'Asia/Bishkek',
    location: group.location ?? '',
    meetingProvider: group.meetingProvider ?? '',
    meetingUrl: group.meetingUrl ?? '',
    scheduleNote: group.scheduleNote ?? '',
    scheduleBlocks,
    instructorId: group.instructorId ? String(group.instructorId) : '',
  };
}

const emptyEditSessionForm = {
  title: '',
  startsAt: '',
  endsAt: '',
  status: 'scheduled' as 'scheduled' | 'completed' | 'cancelled',
  notes: '',
  recordingUrl: '',
};

const emptyMeetingForm = {
  provider: 'custom' as 'zoom' | 'google_meet' | 'custom',
  customJoinUrl: '',
  topic: '',
  agenda: '',
  durationMinutes: '60',
  hostUserId: '',
};

const emptyActivityForm = {
  title: '',
  description: '',
  type: 'discussion' as SessionActivityType,
  status: 'planned' as SessionActivityStatus,
  quizPrompt: '',
  quizOptionA: '',
  quizOptionB: '',
  quizCorrectOption: 'a' as 'a' | 'b',
};

type SessionOperationTab = 'overview' | 'activities' | 'meeting' | 'materials' | 'insights';
type PendingRemoval =
  | { type: 'student'; student: GroupStudent }
  | { type: 'activity'; activityId: number }
  | { type: 'material'; materialIndex: number };

const sessionOperationTabs: Array<{ key: SessionOperationTab; label: string }> = [
  { key: 'overview', label: 'sessions.tabOverview' },
  { key: 'activities', label: 'sessions.tabActivities' },
  { key: 'meeting', label: 'sessions.tabMeeting' },
  { key: 'materials', label: 'sessions.tabMaterials' },
  { key: 'insights', label: 'sessions.tabInsights' },
];

export function SessionsPage() {
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
  const [tenantMembers, setTenantMembers] = useState<CompanyMember[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [homework, setHomework] = useState<SessionHomework[]>([]);
  const [insights, setInsights] = useState<SessionInsights | null>(null);
  const [liveMeeting, setLiveMeeting] = useState<LiveMeeting | null>(null);
  const [courseId, setCourseId] = useState<number | undefined>();
  const [groupId, setGroupId] = useState<number | undefined>();
  const [sessionId, setSessionId] = useState<number | undefined>();
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [savingGroup, setSavingGroup] = useState(false);
  const [updatingGroup, setUpdatingGroup] = useState(false);
  const [savingSession, setSavingSession] = useState(false);
  const [updatingSession, setUpdatingSession] = useState(false);
  const [uploadingMaterial, setUploadingMaterial] = useState(false);
  const [savingMeeting, setSavingMeeting] = useState(false);
  const [savingActivity, setSavingActivity] = useState(false);
  const [loadingResponses, setLoadingResponses] = useState(false);
  const [reviewingSubmission, setReviewingSubmission] = useState<number | undefined>();
  const [generationLoading, setGenerationLoading] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [removingStudentId, setRemovingStudentId] = useState<number | undefined>();
  const [groupForm, setGroupForm] = useState(emptyGroupForm);
  const [editGroupForm, setEditGroupForm] = useState(emptyEditGroupForm);
  const [sessionForm, setSessionForm] = useState(emptySessionForm);
  const [editSessionForm, setEditSessionForm] = useState(emptyEditSessionForm);
  const [meetingForm, setMeetingForm] = useState(emptyMeetingForm);
  const [activityForm, setActivityForm] = useState(emptyActivityForm);
  const [selectedActivityId, setSelectedActivityId] = useState<number | undefined>();
  const [activityResponses, setActivityResponses] = useState<SessionActivityResponseSet | null>(null);
  const [reviewDrafts, setReviewDrafts] = useState<Record<number, { score: string; reviewComment: string }>>({});
  const [generationRange, setGenerationRange] = useState({ fromDate: '', toDate: '' });
  const [generationPreview, setGenerationPreview] = useState<SessionGenerationPreview | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentResults, setStudentResults] = useState<UserSummary[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<number | undefined>();
  const [studentInviteForm, setStudentInviteForm] = useState(emptyStudentInviteForm);
  const [createModal, setCreateModal] = useState<'group' | 'session' | 'enrollment' | 'activity' | null>(null);
  const [editGroupOpen, setEditGroupOpen] = useState(false);
  const [editSessionOpen, setEditSessionOpen] = useState(false);
  const [enrollmentMode, setEnrollmentMode] = useState<'existing' | 'new'>('existing');
  const [pendingRemoval, setPendingRemoval] = useState<PendingRemoval | null>(null);
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [sessionEditErrors, setSessionEditErrors] = useState<Record<string, string>>({});
  const [meetingErrors, setMeetingErrors] = useState<Record<string, string>>({});
  const [materialError, setMaterialError] = useState('');
  const [sessionOperationTab, setSessionOperationTab] = useState<SessionOperationTab>('overview');

  const selectedCourse = useMemo(() => courses.find((course) => course.id === courseId), [courseId, courses]);
  const selectedCourseReady = isCourseWorkflowReady(selectedCourse);
  const selectedCourseBlocker = (() => {
    if (!selectedCourse) return t('courses.blockerChooseCourse');
    if (!['offline', 'online_live'].includes(String(selectedCourse.courseType ?? ''))) return t('courses.blockerDeliveryType');
    if (selectedCourse.status !== 'approved') return t('courses.blockerApproval');
    if (selectedCourse.isPublished !== true) return t('courses.blockerPublish');
    return '';
  })();
  const selectedGroup = useMemo(() => groups.find((group) => group.id === groupId), [groupId, groups]);
  const selectedSession = useMemo(() => sessions.find((session) => session.id === sessionId), [sessionId, sessions]);
  const canAssignInstructor = isTenantAdmin(user, activeTenant);
  const canCoordinateGroups = canCoordinateTenantLearning(user, activeTenant);
  const canManageEnrollment = canEnrollTenantStudents(user, activeTenant);
  const canUseAssignedSessionPicker = canTeachAssignedSessions(user, activeTenant);
  const instructorOptions = useMemo(
    () => tenantMembers.filter((member) => String(member.role).toLowerCase() === 'instructor'),
    [tenantMembers],
  );
  const nextSessionIndex = useMemo(
    () => Math.max(0, ...sessions.map((session) => session.sessionIndex ?? 0)) + 1,
    [sessions],
  );
  const sessionActivities = selectedSession?.activities ?? [];
  const savedScheduleReady = Boolean(selectedGroup?.scheduleBlocks?.some((block) => block.day && block.startTime && block.endTime));
  const generationDatesReady = Boolean(generationRange.fromDate && generationRange.toDate);
  const generationReady = canCoordinateGroups && savedScheduleReady && generationDatesReady;
  const statusLabel = (value: string | undefined | null) => {
    return enumLabel(value || 'scheduled', commonStatusLabelKeys, t);
  };
  const materialFallback = (index: number) => t('sessions.materialFallback', { number: index + 1 });
  const studentFallback = (id: number) => t('courses.studentFallback', { id });
  const instructorFallback = (id: number) => t('groups.instructorFallback', { id });
  const activityTypeLabel = (value: string | undefined | null) => {
    return enumLabel(value, activityTypeLabelKeys, t, t('student.activity'));
  };
  const removalTypeLabel = (value: PendingRemoval['type']) => {
    const removalTypeKeys: Record<PendingRemoval['type'], string> = {
      activity: 'sessions.removalTypeActivity',
      material: 'sessions.removalTypeMaterial',
      student: 'sessions.removalTypeStudent',
    };
    return t(removalTypeKeys[value]);
  };
  const sessionPlaceholder = (index: number) => t('sessions.sessionPlaceholder', { index });
  const translatedSessionTabs = useMemo(
    () => sessionOperationTabs.map((tab) => ({ ...tab, label: t(tab.label) })),
    [t],
  );
  const pendingRemovalTitle = pendingRemoval?.type === 'student'
    ? (pendingRemoval.student.fullName || pendingRemoval.student.email || studentFallback(pendingRemoval.student.userId))
    : pendingRemoval?.type === 'activity'
      ? (sessionActivities.find((activity) => activity.id === pendingRemoval.activityId)?.title ?? t('sessions.thisActivity'))
      : pendingRemoval?.type === 'material'
        ? ((selectedSession?.materials ?? [])[pendingRemoval.materialIndex]?.title ?? materialFallback(pendingRemoval.materialIndex))
        : '';
  const pendingRemovalBusy = pendingRemoval?.type === 'student'
    ? removingStudentId === pendingRemoval.student.userId
    : pendingRemoval?.type === 'activity'
      ? savingActivity
      : pendingRemoval?.type === 'material'
        ? updatingSession
        : false;
  const workflowSteps = useMemo(() => [
    {
      label: t('courses.course'),
      value: selectedCourse?.title ?? t('sessions.chooseCourse'),
      state: selectedCourse ? 'ready' : 'current',
    },
    {
      label: t('courses.group'),
      value: selectedGroup?.name ?? (selectedCourse ? t('sessions.chooseOrCreateGroup') : t('sessions.waitingForCourse')),
      state: selectedGroup ? 'ready' : selectedCourse ? 'current' : 'locked',
    },
    {
      label: t('sessions.session'),
      value: selectedSession?.title ?? (selectedGroup ? t('sessions.chooseOrScheduleSession') : t('sessions.waitingForGroup')),
      state: selectedSession ? 'ready' : selectedGroup ? 'current' : 'locked',
    },
    {
      label: t('sessions.operate'),
      value: selectedSession ? t('sessions.toolsReady') : t('sessions.toolsLocked'),
      state: selectedSession ? 'current' : 'locked',
    },
  ], [selectedCourse, selectedGroup, selectedSession, t]);
  const upcomingAssignedSessions = useMemo(() => {
    const now = Date.now();
    return assignedSessions
      .filter((session) => !session.startsAt || new Date(session.startsAt).getTime() >= now || session.status === 'scheduled')
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
    setTenantMembers([]);
    setAttendance([]);
    setHomework([]);
    setInsights(null);
    setLiveMeeting(null);
    setCourseId(undefined);
    setGroupId(undefined);
    setSessionId(undefined);
    if (!activeTenantId) return;
    let cancelled = false;
    setLoading(true);
    listTenantCourses(activeTenantId)
      .then((nextCourses) => {
        if (cancelled) return;
        setCourses(nextCourses);
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
    setTenantMembers([]);
    if (!activeTenantId || !canAssignInstructor) return;
    let cancelled = false;
    listTenantMembers(activeTenantId)
      .then((members) => {
        if (!cancelled) setTenantMembers(members);
      })
      .catch(() => {
        if (!cancelled) toast.error(t('sessions.instructorsLoadFailed'));
      });
    return () => {
      cancelled = true;
    };
  }, [activeTenantId, canAssignInstructor, t]);

  useEffect(() => {
    setGroups([]);
    setSessions([]);
    setStudents([]);
    setAttendance([]);
    setHomework([]);
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
    setAttendance([]);
    setHomework([]);
    setSessionId(undefined);
    if (!groupId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([listGroupSessions(groupId), listGroupStudents(groupId)])
      .then(([nextSessions, nextStudents]) => {
        if (cancelled) return;
        setSessions(nextSessions);
        setStudents(nextStudents);
      })
      .catch(() => {
        if (!cancelled) toast.error(t('sessions.groupSessionsLoadFailed'));
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
    setAttendance([]);
    setHomework([]);
    setInsights(null);
    setLiveMeeting(null);
    setSelectedActivityId(undefined);
    setActivityResponses(null);
    setReviewDrafts({});
    setSessionOperationTab('overview');
    if (!sessionId) return;
    let cancelled = false;
    setDetailLoading(true);
    Promise.all([
      getSessionAttendance(sessionId),
      listSessionHomework(sessionId),
      getSessionInsights(sessionId),
      getLiveMeeting(sessionId).catch(() => null),
    ])
      .then(([nextAttendance, nextHomework, nextInsights, nextLiveMeeting]) => {
        if (cancelled) return;
        setAttendance(nextAttendance);
        setHomework(nextHomework);
        setInsights(nextInsights);
        setLiveMeeting(nextLiveMeeting);
      })
      .catch(() => {
        if (!cancelled) toast.error(t('sessions.detailLoadFailed'));
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, t]);

  useEffect(() => {
    if (!createModal) setCreateErrors({});
  }, [createModal]);

  useEffect(() => {
    if (!selectedGroup) {
      setEditGroupForm(emptyEditGroupForm);
      return;
    }

    setEditGroupForm(groupToForm(selectedGroup));
    setGenerationRange({
      fromDate: selectedGroup.startDate?.slice(0, 10) ?? '',
      toDate: selectedGroup.endDate?.slice(0, 10) ?? '',
    });
    setGenerationPreview(null);
  }, [selectedGroup]);

  useEffect(() => {
    if (!selectedSession) {
      setEditSessionForm(emptyEditSessionForm);
      return;
    }

    setEditSessionForm({
      title: selectedSession.title ?? '',
      startsAt: selectedSession.startsAt ? selectedSession.startsAt.slice(0, 16) : '',
      endsAt: selectedSession.endsAt ? selectedSession.endsAt.slice(0, 16) : '',
      status: selectedSession.status === 'completed' || selectedSession.status === 'cancelled' ? selectedSession.status : 'scheduled',
      notes: selectedSession.notes ?? '',
      recordingUrl: selectedSession.recordingUrl ?? '',
    });
    setMeetingForm({
      provider: selectedSession.liveProvider === 'zoom' || selectedSession.liveProvider === 'google_meet' || selectedSession.liveProvider === 'custom'
        ? selectedSession.liveProvider
        : 'custom',
      customJoinUrl: selectedSession.liveJoinUrl ?? '',
      topic: selectedSession.title ?? '',
      agenda: selectedSession.notes ?? '',
      durationMinutes: selectedSession.startsAt && selectedSession.endsAt
        ? String(Math.max(1, Math.round((new Date(selectedSession.endsAt).getTime() - new Date(selectedSession.startsAt).getTime()) / 60000)))
        : '60',
      hostUserId: '',
    });
  }, [selectedSession]);

  const reloadGroups = async (nextCourseId = courseId) => {
    if (!nextCourseId) return;
    const nextGroups = await listCourseGroups(nextCourseId);
    setGroups(nextGroups);
    if (!nextGroups.some((group) => group.id === groupId)) {
      setGroupId(nextGroups[0]?.id);
    }
  };

  const reloadSessions = async (nextGroupId = groupId) => {
    if (!nextGroupId) return;
    const [nextSessions, nextStudents] = await Promise.all([
      listGroupSessions(nextGroupId),
      listGroupStudents(nextGroupId),
    ]);
    setSessions(nextSessions);
    setStudents(nextStudents);
    if (!nextSessions.some((session) => session.id === sessionId)) {
      setSessionId(nextSessions[0]?.id);
    }
  };

  const optionalPositiveNumber = (value: string) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  };

  const scheduleBlocksPayload = (blocks: ScheduleBlockForm[]) => blocks
    .map((block) => ({
      day: block.day,
      startTime: block.startTime,
      endTime: block.endTime,
    }))
    .filter((block) => block.day && block.startTime && block.endTime);

  const submitGroup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCoordinateGroups) return;
    const nextErrors: Record<string, string> = {};
    if (!courseId) {
      nextErrors.course = t('sessions.selectCourseBeforeGroup');
    }
    if (!groupForm.name.trim()) {
      nextErrors.groupName = t('groups.groupNameRequired');
    }
    if (Object.keys(nextErrors).length) {
      setCreateErrors(nextErrors);
      toast.error(nextErrors.groupName ?? nextErrors.course);
      return;
    }

    setCreateErrors({});
    const activeCourseId = courseId!;
    setSavingGroup(true);
    try {
      const saved = await createCourseGroup({
        courseId: activeCourseId,
        name: groupForm.name.trim(),
        code: groupForm.code.trim() || `${activeCourseId}-${Date.now().toString(36)}`.toUpperCase(),
        status: groupForm.status,
        startDate: groupForm.startDate || undefined,
        endDate: groupForm.endDate || undefined,
        seatLimit: optionalPositiveNumber(groupForm.seatLimit),
        timezone: groupForm.timezone.trim() || undefined,
        location: groupForm.location.trim() || undefined,
        meetingProvider: groupForm.meetingProvider.trim() || undefined,
        meetingUrl: groupForm.meetingUrl.trim() || undefined,
        scheduleNote: groupForm.scheduleNote.trim() || undefined,
        scheduleBlocks: scheduleBlocksPayload(groupForm.scheduleBlocks),
        instructorId: canAssignInstructor ? optionalPositiveNumber(groupForm.instructorId) : undefined,
      });
      await reloadGroups(activeCourseId);
      setGroupId(saved.id);
      setGroupForm(emptyGroupForm);
      setCreateModal(null);
      setCreateErrors({});
      toast.success(t('groups.groupCreated'));
    } catch {
      toast.error(t('groups.groupCreateFailed'));
    } finally {
      setSavingGroup(false);
    }
  };

  const submitGroupUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCoordinateGroups) return;
    if (!groupId || !courseId) return;
    if (!editGroupForm.name.trim()) {
      toast.error(t('groups.groupNameRequired'));
      return;
    }

    setUpdatingGroup(true);
    try {
      await updateCourseGroup(groupId, {
        name: editGroupForm.name.trim(),
        code: editGroupForm.code.trim() || undefined,
        status: editGroupForm.status,
        startDate: editGroupForm.startDate || undefined,
        endDate: editGroupForm.endDate || undefined,
        seatLimit: optionalPositiveNumber(editGroupForm.seatLimit),
        timezone: editGroupForm.timezone.trim() || undefined,
        location: editGroupForm.location.trim() || undefined,
        meetingProvider: editGroupForm.meetingProvider.trim() || undefined,
        meetingUrl: editGroupForm.meetingUrl.trim() || undefined,
        scheduleNote: editGroupForm.scheduleNote.trim() || undefined,
        scheduleBlocks: scheduleBlocksPayload(editGroupForm.scheduleBlocks),
        instructorId: canAssignInstructor ? optionalPositiveNumber(editGroupForm.instructorId) : undefined,
      });
      await reloadGroups(courseId);
      setEditGroupOpen(false);
      toast.success(t('groups.groupUpdated'));
    } catch {
      toast.error(t('groups.groupUpdateFailed'));
    } finally {
      setUpdatingGroup(false);
    }
  };

  const submitSession = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCoordinateGroups) return;
    const nextErrors: Record<string, string> = {};
    if (!groupId) {
      nextErrors.group = t('sessions.selectGroupBeforeSession');
    }
    if (!sessionForm.title.trim()) nextErrors.sessionTitle = t('sessions.sessionTitleRequired');
    if (!sessionForm.startsAt) nextErrors.startsAt = t('sessions.startRequired');
    if (!sessionForm.endsAt) nextErrors.endsAt = t('sessions.endRequired');
    if (sessionForm.startsAt && sessionForm.endsAt && new Date(sessionForm.endsAt) <= new Date(sessionForm.startsAt)) {
      nextErrors.endsAt = t('sessions.endAfterStart');
    }
    if (Object.keys(nextErrors).length) {
      setCreateErrors(nextErrors);
      toast.error(nextErrors.sessionTitle ?? nextErrors.startsAt ?? nextErrors.endsAt ?? nextErrors.group);
      return;
    }

    setCreateErrors({});
    const activeGroupId = groupId!;
    setSavingSession(true);
    try {
      const saved = await createGroupSession({
        groupId: activeGroupId,
        sessionIndex: nextSessionIndex,
        title: sessionForm.title.trim(),
        startsAt: new Date(sessionForm.startsAt).toISOString(),
        endsAt: new Date(sessionForm.endsAt).toISOString(),
        status: 'scheduled',
        notes: sessionForm.notes.trim() || undefined,
      });
      await reloadSessions(activeGroupId);
      setSessionId(saved.id);
      setSessionForm(emptySessionForm);
      setCreateModal(null);
      setCreateErrors({});
      toast.success(t('sessions.sessionScheduled'));
    } catch {
      toast.error(t('sessions.sessionScheduleFailed'));
    } finally {
      setSavingSession(false);
    }
  };

  const previewSessionGeneration = async () => {
    if (!canCoordinateGroups) return;
    if (!groupId) return;
    if (!generationReady) {
      toast.error(t('sessions.completeSavedScheduleFirst'));
      return;
    }

    setGenerationLoading(true);
    try {
      const preview = await previewGeneratedSessions(groupId, generationRange);
      setGenerationPreview(preview);
      toast.success(t('groups.previewReady'));
    } catch {
      toast.error(t('sessions.previewFailed'));
    } finally {
      setGenerationLoading(false);
    }
  };

  const generateSessions = async () => {
    if (!canCoordinateGroups) return;
    if (!groupId) return;
    if (!generationPreview?.newCount) {
      toast.error(t('groups.previewNewSessionsFirst'));
      return;
    }

    setGenerationLoading(true);
    try {
      const result = await generateGroupSessions(groupId, generationRange);
      await reloadSessions(groupId);
      setGenerationPreview(null);
      toast.success(t('groups.sessionsCreated', { count: result.createdCount }));
    } catch {
      toast.error(t('groups.generateFailed'));
    } finally {
      setGenerationLoading(false);
    }
  };

  const searchStudents = async () => {
    if (!canManageEnrollment) return;
    setEnrolling(true);
    try {
      const results = await searchUsers({ search: studentSearch, role: 'student', limit: 12 });
      setStudentResults(results);
      setSelectedStudentId(results[0]?.id);
    } catch {
      toast.error(t('groups.studentSearchFailed'));
    } finally {
      setEnrolling(false);
    }
  };

  const submitEnrollment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManageEnrollment) return;
    const nextErrors: Record<string, string> = {};
    if (!courseId || !groupId || !selectedStudentId) {
      nextErrors.student = t('groups.selectStudentToEnroll');
    }
    if (Object.keys(nextErrors).length) {
      setCreateErrors(nextErrors);
      toast.error(nextErrors.student);
      return;
    }

    setCreateErrors({});
    const activeCourseId = courseId!;
    const activeGroupId = groupId!;
    const selectedStudent = selectedStudentId!;
    setEnrolling(true);
    try {
      await enrollUser({ courseId: activeCourseId, groupId: activeGroupId, userId: selectedStudent });
      await reloadSessions(activeGroupId);
      setCreateModal(null);
      setStudentSearch('');
      setStudentResults([]);
      setSelectedStudentId(undefined);
      setCreateErrors({});
      toast.success(t('groups.studentEnrolled'));
    } catch {
      toast.error(t('groups.studentEnrollFailed'));
    } finally {
      setEnrolling(false);
    }
  };

  const submitInviteAndEnroll = async () => {
    if (!canManageEnrollment) return;
    if (!activeTenantId || !courseId || !groupId) return;
    if (!studentInviteForm.fullName.trim() || !studentInviteForm.email.trim()) {
      toast.error(t('groups.studentNameEmailRequired'));
      return;
    }

    const activeCourseId = courseId;
    const activeGroupId = groupId;
    setEnrolling(true);
    try {
      const member = await inviteTenantMember(activeTenantId, {
        fullName: studentInviteForm.fullName.trim(),
        email: studentInviteForm.email.trim(),
        role: 'student',
        sendEmail: studentInviteForm.sendEmail,
      });
      await enrollUser({ courseId: activeCourseId, groupId: activeGroupId, userId: member.userId });
      await reloadSessions(activeGroupId);
      setStudentInviteForm(emptyStudentInviteForm);
      setCreateModal(null);
      toast.success(member.onboarding?.emailSent ? t('groups.studentInvitedEnrolled') : t('groups.studentCreatedEnrolled'));
    } catch {
      toast.error(t('groups.studentCreateEnrollFailed'));
    } finally {
      setEnrolling(false);
    }
  };

  const removeStudentFromGroup = async (student: GroupStudent) => {
    if (!canManageEnrollment) return;
    if (!courseId || !groupId) return;
    setRemovingStudentId(student.userId);
    try {
      await unenrollUser(courseId, student.userId);
      await reloadSessions(groupId);
      toast.success(t('sessions.studentRemovedFromGroup'));
    } catch {
      toast.error(t('groups.studentRemoveFailed'));
    } finally {
      setRemovingStudentId(undefined);
      setPendingRemoval(null);
    }
  };

  const submitSessionUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCoordinateGroups) return;
    if (!sessionId || !groupId) return;
    const nextErrors: Record<string, string> = {};
    if (!editSessionForm.title.trim()) nextErrors.title = t('sessions.sessionTitleRequired');
    if (!editSessionForm.startsAt) nextErrors.startsAt = t('sessions.startRequired');
    if (!editSessionForm.endsAt) nextErrors.endsAt = t('sessions.endRequired');
    if (editSessionForm.startsAt && editSessionForm.endsAt && new Date(editSessionForm.endsAt) <= new Date(editSessionForm.startsAt)) {
      nextErrors.endsAt = t('sessions.endAfterStart');
    }
    if (editSessionForm.recordingUrl.trim() && !/^https?:\/\/\S+\.\S+/.test(editSessionForm.recordingUrl.trim())) {
      nextErrors.recordingUrl = t('sessions.fullRecordingUrl');
    }
    if (Object.keys(nextErrors).length) {
      setSessionEditErrors(nextErrors);
      toast.error(nextErrors.title ?? nextErrors.startsAt ?? nextErrors.endsAt ?? nextErrors.recordingUrl);
      return;
    }

    setSessionEditErrors({});
    setUpdatingSession(true);
    try {
      await updateGroupSession(sessionId, {
        title: editSessionForm.title.trim(),
        startsAt: new Date(editSessionForm.startsAt).toISOString(),
        endsAt: new Date(editSessionForm.endsAt).toISOString(),
        status: editSessionForm.status,
        notes: editSessionForm.notes.trim() || undefined,
        recordingUrl: editSessionForm.recordingUrl.trim() || undefined,
      });
      await reloadSessions(groupId);
      setEditSessionOpen(false);
      toast.success(t('sessions.sessionUpdated'));
    } catch {
      toast.error(t('sessions.sessionUpdateFailed'));
    } finally {
      setUpdatingSession(false);
    }
  };

  const uploadMaterial = async (file: File | undefined) => {
    if (!file) {
      setMaterialError(t('sessions.chooseFile'));
      toast.error(t('sessions.chooseFile'));
      return;
    }
    if (!sessionId || !groupId || !selectedSession) return;
    setMaterialError('');
    setUploadingMaterial(true);
    try {
      const uploaded = await uploadSessionMaterial(sessionId, file);
      const currentMaterials = Array.isArray(selectedSession.materials) ? selectedSession.materials : [];
      await updateGroupSession(sessionId, {
        materials: [...currentMaterials, uploaded],
      });
      await reloadSessions(groupId);
      toast.success(t('sessions.materialUploaded'));
    } catch {
      toast.error(t('sessions.materialUploadFailed'));
    } finally {
      setUploadingMaterial(false);
    }
  };

  const saveLiveMeeting = async () => {
    if (!sessionId || !groupId) return;
    const nextErrors: Record<string, string> = {};
    if (meetingForm.provider !== 'zoom' && !meetingForm.customJoinUrl.trim()) {
      nextErrors.customJoinUrl = t('sessions.meetingUrlRequired');
    }
    if (meetingForm.provider !== 'zoom' && meetingForm.customJoinUrl.trim() && !/^https?:\/\/\S+\.\S+/.test(meetingForm.customJoinUrl.trim())) {
      nextErrors.customJoinUrl = t('sessions.fullMeetingUrl');
    }
    if (meetingForm.provider === 'zoom' && !meetingForm.hostUserId.trim()) {
      nextErrors.hostUserId = t('sessions.zoomHostRequired');
    }
    if (meetingForm.durationMinutes && Number(meetingForm.durationMinutes) < 1) {
      nextErrors.durationMinutes = t('sessions.durationMin');
    }
    if (Object.keys(nextErrors).length) {
      setMeetingErrors(nextErrors);
      toast.error(nextErrors.customJoinUrl ?? nextErrors.hostUserId ?? nextErrors.durationMinutes);
      return;
    }

    setMeetingErrors({});
    setSavingMeeting(true);
    try {
      const payload = {
        provider: meetingForm.provider,
        customJoinUrl: meetingForm.customJoinUrl.trim() || undefined,
        topic: meetingForm.topic.trim() || selectedSession?.title,
        agenda: meetingForm.agenda.trim() || undefined,
        startTime: selectedSession?.startsAt,
        durationMinutes: meetingForm.durationMinutes ? Number(meetingForm.durationMinutes) : undefined,
        timezone: selectedGroup?.timezone ?? undefined,
        hostUserId: meetingForm.hostUserId.trim() || undefined,
      };
      const saved = liveMeeting?.joinUrl || selectedSession?.liveJoinUrl
        ? await updateLiveMeeting(sessionId, payload)
        : await createLiveMeeting(sessionId, payload);
      setLiveMeeting(saved);
      await reloadSessions(groupId);
      toast.success(t('sessions.liveMeetingSaved'));
    } catch {
      toast.error(t('sessions.liveMeetingSaveFailed'));
    } finally {
      setSavingMeeting(false);
    }
  };

  const removeLiveMeeting = async () => {
    if (!sessionId || !groupId) return;
    setSavingMeeting(true);
    try {
      await deleteLiveMeeting(sessionId, meetingForm.provider);
      setLiveMeeting(null);
      await reloadSessions(groupId);
      toast.success(t('sessions.liveMeetingRemoved'));
    } catch {
      toast.error(t('sessions.liveMeetingRemoveFailed'));
    } finally {
      setSavingMeeting(false);
    }
  };

  const removeMaterial = async (materialIndex: number) => {
    if (!sessionId || !groupId || !selectedSession) return;
    const currentMaterials = Array.isArray(selectedSession.materials) ? selectedSession.materials : [];
    setUpdatingSession(true);
    try {
      await updateGroupSession(sessionId, {
        materials: currentMaterials.filter((_, index) => index !== materialIndex),
      });
      await reloadSessions(groupId);
      toast.success(t('sessions.materialRemoved'));
    } catch {
      toast.error(t('sessions.materialRemoveFailed'));
    } finally {
      setUpdatingSession(false);
      setPendingRemoval(null);
    }
  };

  const buildActivityPayload = (activity: SessionActivity) => ({
    title: activity.title,
    description: activity.description ?? null,
    type: activity.type,
    status: activity.status,
    questions: activity.type === 'quiz'
      ? (activity.questions ?? []).map((question) => ({
          prompt: question.prompt,
          questionMode: question.questionMode ?? 'single_choice',
          options: question.options.map((option) => ({
            text: option.text,
            isCorrect: Boolean(option.isCorrect),
          })),
        }))
      : undefined,
  });

  const submitActivity = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!sessionId || !groupId) return;
    const nextErrors: Record<string, string> = {};
    if (!activityForm.title.trim()) {
      nextErrors.activityTitle = t('sessions.activityTitleRequired');
    }
    if (activityForm.type === 'quiz') {
      if (!activityForm.quizPrompt.trim()) nextErrors.quizPrompt = t('sessions.quizQuestionRequired');
      if (!activityForm.quizOptionA.trim()) nextErrors.quizOptionA = t('sessions.optionARequired');
      if (!activityForm.quizOptionB.trim()) nextErrors.quizOptionB = t('sessions.optionBRequired');
    }
    if (Object.keys(nextErrors).length) {
      setCreateErrors(nextErrors);
      toast.error(nextErrors.activityTitle ?? nextErrors.quizPrompt ?? nextErrors.quizOptionA ?? nextErrors.quizOptionB);
      return;
    }

    setCreateErrors({});
    const payload = {
      title: activityForm.title.trim(),
      description: activityForm.description.trim() || null,
      type: activityForm.type,
      status: activityForm.status,
      questions: activityForm.type === 'quiz'
        ? [{
            prompt: activityForm.quizPrompt.trim(),
            questionMode: 'single_choice' as const,
            options: [
              { text: activityForm.quizOptionA.trim(), isCorrect: activityForm.quizCorrectOption === 'a' },
              { text: activityForm.quizOptionB.trim(), isCorrect: activityForm.quizCorrectOption === 'b' },
            ],
          }]
        : undefined,
    };

    setSavingActivity(true);
    try {
      await createSessionActivity(sessionId, payload);
      await reloadSessions(groupId);
      setActivityForm(emptyActivityForm);
      setCreateModal(null);
      setCreateErrors({});
      toast.success(t('sessions.activityAdded'));
    } catch {
      toast.error(t('sessions.activitySaveFailed'));
    } finally {
      setSavingActivity(false);
    }
  };

  const setActivityStatus = async (activity: SessionActivity, status: SessionActivityStatus) => {
    if (!sessionId || !groupId) return;
    setSavingActivity(true);
    try {
      await updateSessionActivity(sessionId, activity.id, {
        ...buildActivityPayload(activity),
        status,
      });
      await reloadSessions(groupId);
      toast.success(t('sessions.activityUpdated'));
    } catch {
      toast.error(t('sessions.activityUpdateFailed'));
    } finally {
      setSavingActivity(false);
    }
  };

  const removeActivity = async (activityId: number) => {
    if (!sessionId || !groupId) return;
    setSavingActivity(true);
    try {
      await deleteSessionActivity(sessionId, activityId);
      await reloadSessions(groupId);
      toast.success(t('sessions.activityRemoved'));
    } catch {
      toast.error(t('sessions.activityRemoveFailed'));
    } finally {
      setSavingActivity(false);
      setPendingRemoval(null);
    }
  };

  const loadActivityResponses = async (activityId: number) => {
    if (!sessionId) return;
    setSelectedActivityId(activityId);
    setLoadingResponses(true);
    try {
      const responses = await getSessionActivityResponses(sessionId, activityId);
      setActivityResponses(responses);
      const nextDrafts: Record<number, { score: string; reviewComment: string }> = {};
      responses.items.forEach((item) => {
        if (item.id) {
          nextDrafts[item.id] = {
            score: item.score === undefined || item.score === null ? '' : String(item.score),
            reviewComment: item.reviewComment ?? '',
          };
        }
      });
      setReviewDrafts(nextDrafts);
    } catch {
      toast.error(t('sessions.responsesLoadFailed'));
    } finally {
      setLoadingResponses(false);
    }
  };

  const submitActivityReview = async (
    activityId: number,
    submissionId: number,
    status: 'approved' | 'rejected' | 'needs_revision',
  ) => {
    if (!sessionId) return;
    const draft = reviewDrafts[submissionId] ?? { score: '', reviewComment: '' };
    const score = draft.score.trim() ? Number(draft.score) : undefined;
    if ((status === 'rejected' || status === 'needs_revision') && !draft.reviewComment.trim()) {
      toast.error(t('sessions.reviewCommentRequired'));
      return;
    }
    if (score !== undefined && !Number.isFinite(score)) {
      toast.error(t('sessions.scoreNumberRequired'));
      return;
    }

    setReviewingSubmission(submissionId);
    try {
      await reviewSessionActivitySubmission(sessionId, activityId, submissionId, {
        status,
        score,
        reviewComment: draft.reviewComment.trim() || undefined,
      });
      await loadActivityResponses(activityId);
      toast.success(t('sessions.reviewSaved'));
    } catch {
      toast.error(t('sessions.reviewSaveFailed'));
    } finally {
      setReviewingSubmission(undefined);
    }
  };

  return (
    <>
      <PageHeader title={t('navigation.sessions')} eyebrow={activeTenant?.name} />
      <div className="filters-row three">
        <select value={courseId ?? ''} onChange={(event) => setCourseId(Number(event.target.value) || undefined)}>
          <option value="">{t('courses.selectCourse')}</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.title}{isCourseWorkflowReady(course) ? '' : ` - ${t('groups.locked')}`}
            </option>
          ))}
        </select>
        <select value={groupId ?? ''} onChange={(event) => setGroupId(Number(event.target.value) || undefined)} disabled={!groups.length}>
          <option value="">{t('courses.selectGroup')}</option>
          {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
        </select>
        <select value={sessionId ?? ''} onChange={(event) => setSessionId(Number(event.target.value) || undefined)} disabled={!sessions.length}>
          <option value="">{t('sessions.selectSession')}</option>
          {sessions.map((session) => (
            <option key={session.id} value={session.id}>
              {session.title} {session.startsAt ? `- ${formatDate(session.startsAt)}` : ''}
            </option>
          ))}
        </select>
      </div>
      {canUseAssignedSessionPicker && upcomingAssignedSessions.length ? (
        <section className="content-section workflow-context-panel">
          <div className="section-heading-row">
            <div>
              <h2>{t('homework.assigned')} {t('navigation.sessions')}</h2>
              <span>{t('sessions.sessionScheduleDetail')}</span>
            </div>
          </div>
          <div className="stack-list">
            {upcomingAssignedSessions.map((session) => (
              <article className="stack-list-item" key={session.id}>
                <div>
                  <strong>{session.title}</strong>
                  <span>
                    {formatDate(session.startsAt)} · <span className={`status-badge ${session.status || 'scheduled'}`}>{statusLabel(session.status)}</span>
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
      <section className="session-workflow-strip" aria-label={t('sessions.workflow')}>
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
      {loading ? <LoadingState label={t('sessions.loading')} /> : null}
      {canCoordinateGroups || canManageEnrollment ? (
      <section className="workflow-section workflow-context-panel">
        <div className="section-heading-row">
          <div>
            <h2>{t('sessions.setupTitle')}</h2>
            <span>{t('sessions.setupDetail')}</span>
          </div>
          {canCoordinateGroups || canManageEnrollment ? (
            <div className="page-actions">
              {canCoordinateGroups ? (
                <>
                  <button type="button" className="secondary-button" onClick={() => setCreateModal('group')} disabled={!courseId || !selectedCourseReady || savingGroup} title={!selectedCourseReady ? selectedCourseBlocker : undefined}>
                    {t('groups.createGroup')}
                  </button>
                  <button type="button" className="secondary-button" onClick={() => setCreateModal('session')} disabled={!groupId || savingSession}>
                    {t('sessions.scheduleSession')}
                  </button>
                </>
              ) : null}
              {canManageEnrollment ? (
                <button type="button" className="secondary-button" onClick={() => setCreateModal('enrollment')} disabled={!courseId || !groupId || enrolling}>
                  {t('sessions.enrollStudent')}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="create-action-grid">
          <article>
            <strong>{selectedCourseReady ? t('sessions.groupReady') : selectedCourse ? t('sessions.courseLocked') : t('sessions.chooseCourseFirst')}</strong>
            <span>{selectedCourseReady ? t('sessions.groupReadyDetail') : selectedCourseBlocker}</span>
          </article>
          <article>
            <strong>{selectedGroup ? t('sessions.scheduleNextClass') : t('sessions.chooseOrCreateGroup')}</strong>
            <span>{t('sessions.sessionToolsDetail')}</span>
          </article>
          <article>
            <strong>{selectedGroup ? t('sessions.enrolledCount', { count: students.length }) : t('sessions.enrollmentLocked')}</strong>
            <span>{t('sessions.enrollmentDetail')}</span>
          </article>
        </div>
      </section>
      ) : null}

      {selectedGroup ? (
        <section className="settings-panel group-edit-panel workflow-section workflow-context-panel">
          <div className="section-heading-row">
            <div>
              <h2>{t('sessions.groupScheduleDefaults')}</h2>
              <span>{selectedCourse?.title ?? t('courses.selectedCourse')}</span>
            </div>
            {canCoordinateGroups ? <button type="button" className="secondary-button" onClick={() => setEditGroupOpen(true)}>{t('groups.editGroup')}</button> : null}
          </div>
          <div className="group-summary-grid">
            <section><span>{t('courses.status')}</span><strong>{statusLabel(selectedGroup.status)}</strong></section>
            <section><span>{t('groups.dates')}</span><strong>{selectedGroup.startDate || selectedGroup.endDate ? `${selectedGroup.startDate ?? '-'} - ${selectedGroup.endDate ?? '-'}` : t('groups.notScheduled')}</strong></section>
            <section><span>{t('groups.schedule')}</span><strong>{savedScheduleReady ? t('groups.scheduleBlockCount', { count: selectedGroup.scheduleBlocks?.filter((block) => block.startTime && block.endTime).length ?? 0 }) : t('groups.needsSetup')}</strong></section>
            <section><span>{t('courses.students')}</span><strong>{students.length}</strong></section>
            <section><span>{t('groups.capacity')}</span><strong>{selectedGroup.seatLimit ?? t('groups.capacityOpen')}</strong></section>
            <section><span>{t('groups.location')}</span><strong>{selectedGroup.location || selectedGroup.meetingProvider || t('states.notSet')}</strong></section>
          </div>
          {canCoordinateGroups ? (
          <div className="session-generation-panel">
            <div className="section-heading-row compact">
              <div>
                <h3>{t('groups.generateSessions')}</h3>
                <span>{t('sessions.generateSessionsHint')}</span>
              </div>
            </div>
            <p className={`panel-note ${generationReady ? 'success' : ''}`}>
              {generationReady ? t('groups.generationReady') : t('sessions.generationNeedsSetup')}
            </p>
            <div className="three-col">
              <label>
                {t('groups.from')}
                <input type="date" value={generationRange.fromDate} onChange={(event) => setGenerationRange((current) => ({ ...current, fromDate: event.target.value }))} />
              </label>
              <label>
                {t('groups.to')}
                <input type="date" value={generationRange.toDate} onChange={(event) => setGenerationRange((current) => ({ ...current, toDate: event.target.value }))} />
              </label>
              <div className="generation-actions">
                <button type="button" className="secondary-button" onClick={() => void previewSessionGeneration()} disabled={generationLoading || !generationReady}>
                  {t('groups.preview')}
                </button>
                <button type="button" onClick={() => void generateSessions()} disabled={generationLoading || !generationPreview?.newCount}>
                  {t('groups.generate')}
                </button>
              </div>
            </div>
            {generationPreview ? (
              <div className="generation-preview">
                <span>{t('groups.total')} <strong>{generationPreview.total}</strong></span>
                <span>{t('groups.new')} <strong>{generationPreview.newCount}</strong></span>
                <span>{t('groups.existing')} <strong>{generationPreview.existingCount}</strong></span>
                <div className="stack-list">
                  {generationPreview.items.slice(0, 5).map((item) => (
                    <article key={`${item.kind}-${item.sessionIndex}-${item.startsAt}`} className="stack-list-item">
                      <div>
                        <strong>{item.title}</strong>
                        <span>{item.day} · {formatDate(item.startsAt)} - {formatDate(item.endsAt)}</span>
                      </div>
                      <span className={`status-badge ${item.kind === 'new' ? 'pending' : 'scheduled'}`}>{statusLabel(item.kind)}</span>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          ) : null}
          <div className="group-roster-panel">
            <div className="section-heading-row compact">
              <div>
                <h3>{t('courses.groupRoster')}</h3>
                <span>{t('groups.activeLearnerCount', { count: students.length })}</span>
              </div>
              {canManageEnrollment ? (
              <button type="button" className="secondary-button" onClick={() => setCreateModal('enrollment')} disabled={!courseId || !groupId || enrolling}>
                {t('sessions.enrollStudent')}
              </button>
              ) : null}
            </div>
            <div className="stack-list">
              {students.map((student) => (
                <article key={student.userId} className="stack-list-item">
                  <div>
                    <strong>{student.fullName || student.email || studentFallback(student.userId)}</strong>
                    <span>
                      {student.email || t('groups.noEmail')} · {t('groups.progressPercent', { percent: Math.round(student.progressPercent ?? 0) })}
                      {student.completed ? ` · ${t('courses.completed')}` : ''}
                    </span>
                  </div>
                  {canManageEnrollment ? (
                    <button
                      type="button"
                      className="link-button danger"
                      onClick={() => setPendingRemoval({ type: 'student', student })}
                      disabled={removingStudentId === student.userId}
                    >
                      {removingStudentId === student.userId ? t('groups.removing') : t('groups.remove')}
                    </button>
                  ) : null}
                </article>
              ))}
              {!students.length ? (
                <EmptyState
                  title={t('sessions.noStudentsInGroup')}
                  detail={t('sessions.noStudentsInGroupDetail')}
                  action={canManageEnrollment ? (
                    <button type="button" className="secondary-button" onClick={() => setCreateModal('enrollment')} disabled={!courseId || !groupId || enrolling}>
                      {t('sessions.enrollStudent')}
                    </button>
                  ) : null}
                />
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {!loading && !sessions.length ? (
        <EmptyState
          title={selectedGroup ? t('sessions.emptyScheduledTitle') : t('sessions.emptySelectedTitle')}
          detail={selectedGroup ? t('sessions.emptyScheduledDetail') : t('sessions.emptySelectedDetail')}
          action={(
            <>
              {canCoordinateGroups ? (
                <>
                  <button type="button" className="secondary-button" onClick={() => setCreateModal('group')} disabled={!courseId || !selectedCourseReady || savingGroup} title={!selectedCourseReady ? selectedCourseBlocker : undefined}>{t('groups.createGroup')}</button>
                  <button type="button" className="primary-button" onClick={() => setCreateModal('session')} disabled={!groupId || savingSession}>{t('sessions.scheduleSession')}</button>
                </>
              ) : null}
            </>
          )}
        />
      ) : null}
      {!!sessions.length && (
        <div className="workspace-grid session-workspace-grid">
          <section className="content-section">
            <div className="section-heading-row">
              <div>
                <h2>{t('sessions.sessionSchedule')}</h2>
                <span>{t('sessions.sessionScheduleDetail')}</span>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t('sessions.session')}</th>
                    <th>{t('groups.starts')}</th>
                    <th>{t('courses.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => (
                    <tr
                      key={session.id}
                      className={session.id === sessionId ? 'selected-row' : ''}
                    >
                      <td>
                        <button
                          type="button"
                          className="table-row-button"
                          aria-pressed={session.id === sessionId}
                          onClick={() => setSessionId(session.id)}
                        >
                          <strong>{session.title}</strong>
                        </button>
                      </td>
                      <td>{formatDate(session.startsAt)}</td>
                      <td><span className={`status-badge ${session.status || 'scheduled'}`}>{statusLabel(session.status)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="settings-panel workflow-context-panel">
            <div className="section-heading-row compact">
              <div>
                <h2>{t('sessions.workspace')}</h2>
                <span>{selectedSession?.title ?? t('sessions.selectSession')}</span>
              </div>
            </div>
            {!selectedSession ? (
              <EmptyState title={t('sessions.chooseSession')} detail={t('sessions.chooseSessionDetail')} />
            ) : (
              <>
                <WorkspaceTabs
                  tabs={translatedSessionTabs}
                  activeTab={sessionOperationTab}
                  onChange={setSessionOperationTab}
                  ariaLabel={t('sessions.operations')}
                  className="session-operation-tabs"
                />
                {sessionOperationTab === 'activities' ? (
                  <div className="session-activities-panel">
                    <div className="section-heading-row compact">
                      <div>
                        <h3>{t('sessions.tabActivities')}</h3>
                        <span>{selectedSession.title}</span>
                      </div>
                      <button type="button" className="secondary-button" onClick={() => setCreateModal('activity')} disabled={savingActivity}>
                        {t('sessions.addActivity')}
                      </button>
                    </div>
                    <div className="stack-list activity-list">
                      {sessionActivities.map((activity) => (
                        <article key={activity.id} className="stack-list-item activity-list-item">
                          <div>
                            <strong>{activity.title}</strong>
                            <span>{activityTypeLabel(activity.type)} · <span className={`status-badge ${activity.status}`}>{statusLabel(activity.status)}</span></span>
                          </div>
                          <div className="activity-actions">
                            {activity.status !== 'active' ? (
                              <button type="button" className="secondary-button" onClick={() => void setActivityStatus(activity, 'active')} disabled={savingActivity}>{t('sessions.startActivity')}</button>
                            ) : null}
                            {activity.status !== 'done' ? (
                              <button type="button" className="secondary-button" onClick={() => void setActivityStatus(activity, 'done')} disabled={savingActivity}>{t('sessions.statusDone')}</button>
                            ) : null}
                            <button type="button" className="secondary-button" onClick={() => void loadActivityResponses(activity.id)} disabled={loadingResponses && selectedActivityId === activity.id}>{t('sessions.responses')}</button>
                            <button type="button" className="link-button danger" onClick={() => setPendingRemoval({ type: 'activity', activityId: activity.id })} disabled={savingActivity}>{t('groups.remove')}</button>
                          </div>
                        </article>
                      ))}
                      {!sessionActivities.length ? (
                        <EmptyState
                          title={t('sessions.noActivitiesTitle')}
                          detail={t('sessions.noActivitiesDetail')}
                        />
                      ) : null}
                    </div>
                    {activityResponses ? (
                      <div className="activity-responses-panel">
                        <div className="section-heading-row compact">
                          <div>
                            <h3>{t('sessions.responses')}</h3>
                            <span>{activityResponses.activity.title} · {activityTypeLabel(activityResponses.mode)}</span>
                          </div>
                        </div>
                        {loadingResponses ? <LoadingState label={t('sessions.loadingResponses')} /> : null}
                        <div className="stack-list">
                          {activityResponses.items.map((item) => (
                            <article key={`${item.id ?? item.latestAttemptId ?? item.studentId}`} className="stack-list-item activity-response-item">
                              <div>
                                <strong>{item.studentName || studentFallback(item.studentId)}</strong>
                                {activityResponses.mode === 'quiz' ? (
                                  <span>
                                    {item.passed ? t('sessions.passed') : t('sessions.notPassed')} · {t('sessions.scoreValue', { score: item.score ?? 0 })} · {t('sessions.attemptsValue', { count: item.attemptsCount ?? 0 })}
                                  </span>
                                ) : (
                                  <>
                                    <span>{statusLabel(item.status ?? 'submitted')}{item.updatedAt ? ` · ${formatDate(item.updatedAt)}` : ''}</span>
                                    {item.answerText ? <p>{item.answerText}</p> : null}
                                    {item.attachmentUrl ? <a href={item.attachmentUrl} target="_blank" rel="noreferrer">{t('sessions.openAttachment')}</a> : null}
                                  </>
                                )}
                              </div>
                              {activityResponses.mode === 'submission' && item.id ? (
                                <div className="review-controls">
                                  <input
                                    value={reviewDrafts[item.id]?.score ?? ''}
                                    onChange={(event) => setReviewDrafts((current) => ({ ...current, [item.id!]: { score: event.target.value, reviewComment: current[item.id!]?.reviewComment ?? '' } }))}
                                    placeholder={t('sessions.score')}
                                    inputMode="numeric"
                                  />
                                  <input
                                    value={reviewDrafts[item.id]?.reviewComment ?? ''}
                                    onChange={(event) => setReviewDrafts((current) => ({ ...current, [item.id!]: { score: current[item.id!]?.score ?? '', reviewComment: event.target.value } }))}
                                    placeholder={t('sessions.reviewComment')}
                                  />
                                  <div className="activity-actions">
                                    <button type="button" className="secondary-button" onClick={() => void submitActivityReview(activityResponses.activity.id, item.id!, 'approved')} disabled={reviewingSubmission === item.id}>{t('courses.approve')}</button>
                                    <button type="button" className="secondary-button" onClick={() => void submitActivityReview(activityResponses.activity.id, item.id!, 'needs_revision')} disabled={reviewingSubmission === item.id}>{t('sessions.revise')}</button>
                                    <button type="button" className="link-button danger" onClick={() => void submitActivityReview(activityResponses.activity.id, item.id!, 'rejected')} disabled={reviewingSubmission === item.id}>{t('courses.reject')}</button>
                                  </div>
                                </div>
                              ) : null}
                            </article>
                          ))}
                          {!activityResponses.items.length ? (
                            <EmptyState
                              title={t('sessions.noResponsesTitle')}
                              detail={t('sessions.noResponsesDetail')}
                            />
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {sessionOperationTab === 'overview' ? (
                  <>
                <div className="definition-grid">
                  <span>{t('courses.course')}</span><strong>{selectedCourse?.title ?? '-'}</strong>
                  <span>{t('courses.group')}</span><strong>{selectedGroup?.name ?? '-'}</strong>
                  <span>{t('groups.starts')}</span><strong>{formatDate(selectedSession.startsAt)}</strong>
                  <span>{t('groups.ends')}</span><strong>{formatDate(selectedSession.endsAt)}</strong>
                  <span>{t('courses.status')}</span><strong><span className={`status-badge ${selectedSession.status || 'scheduled'}`}>{statusLabel(selectedSession.status)}</span></strong>
                  <span>{t('sessions.recording')}</span><strong>{selectedSession.recordingUrl ? t('sessions.attached') : t('sessions.notAttached')}</strong>
                </div>
                <div className="session-summary-actions">
                  {canCoordinateGroups ? (
                  <button type="button" className="secondary-button" onClick={() => setEditSessionOpen(true)}>
                    {t('sessions.editSession')}
                  </button>
                  ) : null}
                </div>
                  </>
                ) : null}
                {sessionOperationTab === 'meeting' ? (
                <div className="session-live-panel">
                  <div className="section-heading-row compact">
                    <div>
                      <h3>{t('sessions.tabMeeting')}</h3>
                      <span>{liveMeeting?.joinUrl || selectedSession.liveJoinUrl ? t('sessions.meetingAttached') : t('sessions.noMeetingAttached')}</span>
                    </div>
                  </div>
                  <div className="two-col">
                    <label>
                      {t('sessions.provider')}
                      <select value={meetingForm.provider} onChange={(event) => setMeetingForm((current) => ({ ...current, provider: event.target.value as 'zoom' | 'google_meet' | 'custom' }))}>
                        <option value="custom">{t('sessions.providerCustom')}</option>
                        <option value="google_meet">Google Meet</option>
                        <option value="zoom">Zoom</option>
                      </select>
                    </label>
                    <label>
                      {t('sessions.duration')}
                      <input
                        type="number"
                        min="1"
                        value={meetingForm.durationMinutes}
                        onChange={(event) => {
                          setMeetingForm((current) => ({ ...current, durationMinutes: event.target.value }));
                          setMeetingErrors((current) => ({ ...current, durationMinutes: '' }));
                        }}
                        className={meetingErrors.durationMinutes ? 'input-error' : ''}
                        aria-invalid={!!meetingErrors.durationMinutes}
                      />
                      {meetingErrors.durationMinutes ? <span className="field-error">{meetingErrors.durationMinutes}</span> : null}
                    </label>
                  </div>
                  {meetingForm.provider !== 'zoom' ? (
                    <label>
                      {t('sessions.joinUrl')}
                      <input
                        value={meetingForm.customJoinUrl}
                        onChange={(event) => {
                          setMeetingForm((current) => ({ ...current, customJoinUrl: event.target.value }));
                          setMeetingErrors((current) => ({ ...current, customJoinUrl: '' }));
                        }}
                        className={meetingErrors.customJoinUrl ? 'input-error' : ''}
                        aria-invalid={!!meetingErrors.customJoinUrl}
                        placeholder="https://meet.google.com/..."
                      />
                      {meetingErrors.customJoinUrl ? <span className="field-error">{meetingErrors.customJoinUrl}</span> : null}
                    </label>
                  ) : (
                    <label>
                      {t('sessions.zoomHostUserId')}
                      <input
                        value={meetingForm.hostUserId}
                        onChange={(event) => {
                          setMeetingForm((current) => ({ ...current, hostUserId: event.target.value }));
                          setMeetingErrors((current) => ({ ...current, hostUserId: '' }));
                        }}
                        className={meetingErrors.hostUserId ? 'input-error' : ''}
                        aria-invalid={!!meetingErrors.hostUserId}
                        placeholder={t('sessions.zoomHostPlaceholder')}
                      />
                      {meetingErrors.hostUserId ? <span className="field-error">{meetingErrors.hostUserId}</span> : null}
                    </label>
                  )}
                  <label>
                    {t('sessions.topic')}
                    <input value={meetingForm.topic} onChange={(event) => setMeetingForm((current) => ({ ...current, topic: event.target.value }))} />
                  </label>
                  <div className="live-meeting-actions">
                    <button type="button" onClick={() => void saveLiveMeeting()} disabled={savingMeeting}>
                      {savingMeeting ? t('courses.saving') : t('sessions.saveMeeting')}
                    </button>
                    {(liveMeeting?.joinUrl || selectedSession.liveJoinUrl) ? (
                      <>
                        <a href={liveMeeting?.joinUrl ?? selectedSession.liveJoinUrl ?? '#'} target="_blank" rel="noreferrer">{t('sessions.openMeeting')}</a>
                        <button type="button" className="secondary-button" onClick={() => void removeLiveMeeting()} disabled={savingMeeting}>{t('groups.remove')}</button>
                      </>
                    ) : null}
                  </div>
                </div>
                ) : null}
                {sessionOperationTab === 'materials' ? (
                <div className="session-materials-panel">
                  <div className="section-heading-row compact">
                    <div>
                      <h3>{t('sessions.tabMaterials')}</h3>
                      <span>{t('sessions.materialsHint')}</span>
                    </div>
                    <label className="file-button">
                      {uploadingMaterial ? t('sessions.uploading') : t('sessions.upload')}
                      <input
                        type="file"
                        disabled={uploadingMaterial}
                        onChange={(event) => void uploadMaterial(event.target.files?.[0])}
                      />
                    </label>
                  </div>
                  {materialError ? <span className="field-error">{materialError}</span> : null}
                  <div className="stack-list">
                    {(selectedSession.materials ?? []).map((material, index) => (
                      <article key={`${material.storageKey ?? material.url}-${index}`} className="stack-list-item material-list-item">
                        <div>
                          <strong>{material.title || materialFallback(index)}</strong>
                          <a href={material.url} target="_blank" rel="noreferrer">{t('sessions.openFile')}</a>
                        </div>
                        <button type="button" className="link-button danger" onClick={() => setPendingRemoval({ type: 'material', materialIndex: index })} disabled={updatingSession}>
                          {t('groups.remove')}
                        </button>
                      </article>
                    ))}
                    {!selectedSession.materials?.length ? (
                      <EmptyState
                        title={t('sessions.noMaterialsTitle')}
                        detail={t('sessions.noMaterialsDetail')}
                      />
                    ) : null}
                  </div>
                </div>
                ) : null}
                {detailLoading ? <LoadingState label={t('sessions.loadingDetail')} /> : (
                  <>
                    {sessionOperationTab === 'overview' ? (
                      <>
                    <div className="stat-grid compact session-stat-grid">
                      <section className="stat-tile">
                        <span>{t('courses.students')}</span>
                        <strong>{students.length}</strong>
                      </section>
                      <section className="stat-tile">
                        <span>{t('sessions.marked')}</span>
                        <strong>{attendance.length}</strong>
                      </section>
                      <section className="stat-tile">
                        <span>{t('courses.homework')}</span>
                        <strong>{homework.length}</strong>
                      </section>
                      <section className="stat-tile">
                        <span>{t('courses.published')}</span>
                        <strong>{homework.filter((item) => item.isPublished).length}</strong>
                      </section>
                    </div>
                      </>
                    ) : null}
                    {sessionOperationTab === 'insights' && insights ? (
                      <div className="session-insights-panel">
                        <div className="section-heading-row compact">
                          <div>
                            <h3>{t('sessions.tabInsights')}</h3>
                            <span>{t('sessions.insightsHint')}</span>
                          </div>
                        </div>
                        <div className="insight-metrics">
                          <span>{t('sessions.queue')} <strong>{insights.summary?.teacherQueue ?? 0}</strong></span>
                          <span>{t('sessions.followUps')} <strong>{insights.summary?.followUpStudents ?? 0}</strong></span>
                          <span>{t('sessions.positive')} <strong>{insights.summary?.positiveStudents ?? 0}</strong></span>
                        </div>
                        <div className="insight-columns">
                          <div>
                            <strong>{t('sessions.needsAttention')}</strong>
                            {(insights.attentionStudents ?? []).slice(0, 4).map((student) => (
                              <article key={student.studentId} className={`insight-row ${student.severity ?? 'low'}`}>
                                <span>{student.fullName}</span>
                                <small>{student.reasons?.[0]?.label ?? t('sessions.reviewStudentProgress')}</small>
                              </article>
                            ))}
                            {!insights.attentionStudents?.length ? <span className="muted-text">{t('sessions.noUrgentFollowUp')}</span> : null}
                          </div>
                          <div>
                            <strong>{t('sessions.positiveSignals')}</strong>
                            {(insights.positiveStudents ?? []).slice(0, 4).map((student) => (
                              <article key={student.studentId} className="insight-row positive">
                                <span>{student.fullName}</span>
                                <small>{student.signals?.[0] ?? t('sessions.attendanceStreak', { count: student.streak ?? 0 })}</small>
                              </article>
                            ))}
                            {!insights.positiveStudents?.length ? <span className="muted-text">{t('sessions.noPositiveSignals')}</span> : null}
                          </div>
                        </div>
                      </div>
                    ) : null}
                    {sessionOperationTab === 'insights' && !insights ? <EmptyState title={t('sessions.noInsightsTitle')} detail={t('sessions.noInsightsDetail')} /> : null}
                    {sessionOperationTab === 'overview' ? (
                    <div className="stack-list">
                      {homework.slice(0, 4).map((item) => (
                        <article key={item.id} className="stack-list-item">
                          <div>
                            <strong>{item.title}</strong>
                            <span>{item.isPublished ? t('courses.published') : t('courses.draft')}{item.deadline || item.dueAt ? ` · ${formatDate(item.deadline ?? item.dueAt)}` : ''}</span>
                          </div>
                          <strong>{item.queue?.needsReview ?? 0}</strong>
                        </article>
                      ))}
                      {!homework.length ? (
                        <EmptyState
                          title={t('sessions.noHomeworkTitle')}
                          detail={t('sessions.noHomeworkDetail')}
                        />
                      ) : null}
                    </div>
                    ) : null}
                  </>
                )}
              </>
            )}
          </aside>
        </div>
      )}
      {editGroupOpen && selectedGroup && canCoordinateGroups ? (
        <FormModal labelledBy="edit-group-title" onClose={() => setEditGroupOpen(false)} onSubmit={submitGroupUpdate}>
          <div className="modal-header-block">
            <span>{selectedCourse?.title ?? t('courses.selectedCourse')}</span>
            <h2 id="edit-group-title">{t('groups.editGroup')}</h2>
            <p>{t('sessions.editGroupDetail')}</p>
          </div>
          <section className="form-section">
            <h3>{t('sessions.groupDetails')}</h3>
            <div className="two-col">
              <label>
                {t('groups.name')}
                <input value={editGroupForm.name} onChange={(event) => setEditGroupForm((current) => ({ ...current, name: event.target.value }))} autoFocus />
              </label>
              <label>
                {t('groups.code')}
                <input value={editGroupForm.code} onChange={(event) => setEditGroupForm((current) => ({ ...current, code: event.target.value }))} placeholder={t('sessions.autoIfEmpty')} />
              </label>
            </div>
            <div className="two-col">
              <label>
                {t('courses.status')}
                <select value={editGroupForm.status} onChange={(event) => setEditGroupForm((current) => ({ ...current, status: event.target.value as GroupStatus }))}>
                  <option value="planned">{t('courses.statusPlanned')}</option>
                  <option value="open">{t('groups.statusOpen')}</option>
                  <option value="active">{t('groups.statusActive')}</option>
                  <option value="completed">{t('groups.statusCompleted')}</option>
                  <option value="cancelled">{t('groups.statusCancelled')}</option>
                </select>
              </label>
              <label>
                {t('groups.seatLimit')}
                <input type="number" min="1" value={editGroupForm.seatLimit} onChange={(event) => setEditGroupForm((current) => ({ ...current, seatLimit: event.target.value }))} placeholder={t('groups.noLimit')} />
              </label>
            </div>
            <div className="two-col">
              <label>
                {t('groups.startDate')}
                <input type="date" value={editGroupForm.startDate} onChange={(event) => setEditGroupForm((current) => ({ ...current, startDate: event.target.value }))} />
              </label>
              <label>
                {t('groups.endDate')}
                <input type="date" value={editGroupForm.endDate} onChange={(event) => setEditGroupForm((current) => ({ ...current, endDate: event.target.value }))} />
              </label>
            </div>
            <div className="two-col">
              <label>
                {t('groups.timezone')}
                <input value={editGroupForm.timezone} onChange={(event) => setEditGroupForm((current) => ({ ...current, timezone: event.target.value }))} placeholder="Asia/Bishkek" />
              </label>
              {canAssignInstructor ? (
                <label>
                  {t('sessions.groupInstructor')}
                  <select value={editGroupForm.instructorId} onChange={(event) => setEditGroupForm((current) => ({ ...current, instructorId: event.target.value }))}>
                    <option value="">{t('groups.useCourseInstructor')}</option>
                    {instructorOptions.map((member) => (
                      <option key={member.userId} value={member.userId}>
                        {member.fullName || member.user?.fullName || member.email || member.user?.email || instructorFallback(member.userId)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
            <label>
              {t('groups.location')}
              <input value={editGroupForm.location} onChange={(event) => setEditGroupForm((current) => ({ ...current, location: event.target.value }))} placeholder={t('sessions.locationPlaceholder')} />
            </label>
            <div className="two-col">
              <label>
                {t('groups.meetingProvider')}
                <input value={editGroupForm.meetingProvider} onChange={(event) => setEditGroupForm((current) => ({ ...current, meetingProvider: event.target.value }))} placeholder={t('sessions.meetingProviderPlaceholder')} />
              </label>
              <label>
                {t('groups.meetingUrl')}
                <input value={editGroupForm.meetingUrl} onChange={(event) => setEditGroupForm((current) => ({ ...current, meetingUrl: event.target.value }))} placeholder="https://..." />
              </label>
            </div>
          </section>
          <section className="form-section">
            <h3>{t('groups.recurringSchedule')}</h3>
            <div className="schedule-block-list">
              {editGroupForm.scheduleBlocks.map((block, index) => (
                <div className="three-col" key={`${index}-${block.day}`}>
                  <label>
                    {t('groups.scheduleDay')}
                    <select value={block.day} onChange={(event) => setEditGroupForm((current) => ({
                      ...current,
                      scheduleBlocks: current.scheduleBlocks.map((item, itemIndex) => itemIndex === index ? { ...item, day: event.target.value as ScheduleDay } : item),
                    }))}>
                      <option value="mon">{t('groups.dayMon')}</option>
                      <option value="tue">{t('groups.dayTue')}</option>
                      <option value="wed">{t('groups.dayWed')}</option>
                      <option value="thu">{t('groups.dayThu')}</option>
                      <option value="fri">{t('groups.dayFri')}</option>
                      <option value="sat">{t('groups.daySat')}</option>
                      <option value="sun">{t('groups.daySun')}</option>
                    </select>
                  </label>
                  <label>
                    {t('groups.starts')}
                    <input type="time" value={block.startTime} onChange={(event) => setEditGroupForm((current) => ({
                      ...current,
                      scheduleBlocks: current.scheduleBlocks.map((item, itemIndex) => itemIndex === index ? { ...item, startTime: event.target.value } : item),
                    }))} />
                  </label>
                  <label>
                    {t('groups.ends')}
                    <input type="time" value={block.endTime} onChange={(event) => setEditGroupForm((current) => ({
                      ...current,
                      scheduleBlocks: current.scheduleBlocks.map((item, itemIndex) => itemIndex === index ? { ...item, endTime: event.target.value } : item),
                    }))} />
                  </label>
                  {editGroupForm.scheduleBlocks.length > 1 ? (
                    <button type="button" className="secondary-button" onClick={() => setEditGroupForm((current) => ({
                      ...current,
                      scheduleBlocks: current.scheduleBlocks.filter((_, itemIndex) => itemIndex !== index),
                    }))}>{t('groups.removeBlock')}</button>
                  ) : null}
                </div>
              ))}
              <button type="button" className="secondary-button" onClick={() => setEditGroupForm((current) => ({
                ...current,
                scheduleBlocks: [...current.scheduleBlocks, emptyScheduleBlock()],
              }))}>{t('groups.addScheduleBlock')}</button>
            </div>
            <label>
              {t('groups.scheduleNote')}
              <input value={editGroupForm.scheduleNote} onChange={(event) => setEditGroupForm((current) => ({ ...current, scheduleNote: event.target.value }))} placeholder={t('sessions.scheduleNotePlaceholder')} />
            </label>
          </section>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={() => setEditGroupOpen(false)} disabled={updatingGroup}>{t('courses.cancel')}</button>
            <button type="submit" disabled={updatingGroup}>{updatingGroup ? t('courses.saving') : t('groups.saveGroup')}</button>
          </div>
        </FormModal>
      ) : null}
      {editSessionOpen && selectedSession && canCoordinateGroups ? (
        <FormModal labelledBy="edit-session-title" onClose={() => setEditSessionOpen(false)} onSubmit={submitSessionUpdate}>
          <div className="modal-header-block">
            <span>{selectedGroup?.name ?? t('courses.selectedGroup')}</span>
            <h2 id="edit-session-title">{t('sessions.editSession')}</h2>
            <p>{t('sessions.editSessionDetail')}</p>
          </div>
          <label>
            {t('courses.title')}
            <input
              value={editSessionForm.title}
              onChange={(event) => {
                setEditSessionForm((current) => ({ ...current, title: event.target.value }));
                setSessionEditErrors((current) => ({ ...current, title: '' }));
              }}
              className={sessionEditErrors.title ? 'input-error' : ''}
              aria-invalid={!!sessionEditErrors.title}
              autoFocus
            />
            {sessionEditErrors.title ? <span className="field-error">{sessionEditErrors.title}</span> : null}
          </label>
          <div className="two-col">
            <label>
              {t('groups.starts')}
              <input
                type="datetime-local"
                value={editSessionForm.startsAt}
                onChange={(event) => {
                  setEditSessionForm((current) => ({ ...current, startsAt: event.target.value }));
                  setSessionEditErrors((current) => ({ ...current, startsAt: '', endsAt: '' }));
                }}
                className={sessionEditErrors.startsAt ? 'input-error' : ''}
                aria-invalid={!!sessionEditErrors.startsAt}
              />
              {sessionEditErrors.startsAt ? <span className="field-error">{sessionEditErrors.startsAt}</span> : null}
            </label>
            <label>
              {t('groups.ends')}
              <input
                type="datetime-local"
                value={editSessionForm.endsAt}
                onChange={(event) => {
                  setEditSessionForm((current) => ({ ...current, endsAt: event.target.value }));
                  setSessionEditErrors((current) => ({ ...current, endsAt: '' }));
                }}
                className={sessionEditErrors.endsAt ? 'input-error' : ''}
                aria-invalid={!!sessionEditErrors.endsAt}
              />
              {sessionEditErrors.endsAt ? <span className="field-error">{sessionEditErrors.endsAt}</span> : null}
            </label>
          </div>
          <label>
            {t('courses.status')}
            <select value={editSessionForm.status} onChange={(event) => setEditSessionForm((current) => ({ ...current, status: event.target.value as 'scheduled' | 'completed' | 'cancelled' }))}>
              <option value="scheduled">{t('courses.statusScheduled')}</option>
              <option value="completed">{t('groups.statusCompleted')}</option>
              <option value="cancelled">{t('groups.statusCancelled')}</option>
            </select>
          </label>
          <label>
            {t('sessions.recordingUrl')}
            <input
              value={editSessionForm.recordingUrl}
              onChange={(event) => {
                setEditSessionForm((current) => ({ ...current, recordingUrl: event.target.value }));
                setSessionEditErrors((current) => ({ ...current, recordingUrl: '' }));
              }}
              className={sessionEditErrors.recordingUrl ? 'input-error' : ''}
              aria-invalid={!!sessionEditErrors.recordingUrl}
            />
            {sessionEditErrors.recordingUrl ? <span className="field-error">{sessionEditErrors.recordingUrl}</span> : null}
          </label>
          <label>
            {t('sessions.notes')}
            <textarea value={editSessionForm.notes} onChange={(event) => setEditSessionForm((current) => ({ ...current, notes: event.target.value }))} />
          </label>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={() => setEditSessionOpen(false)} disabled={updatingSession}>{t('courses.cancel')}</button>
            <button type="submit" disabled={updatingSession}>{updatingSession ? t('courses.saving') : t('sessions.saveSession')}</button>
          </div>
        </FormModal>
      ) : null}
      {pendingRemoval ? (
        <Modal labelledBy="confirm-removal-title" onClose={() => setPendingRemoval(null)}>
          <div className="modal-header-block">
            <span>{t('sessions.confirmRemoval')}</span>
            <h2 id="confirm-removal-title">{t('sessions.removeType', { type: removalTypeLabel(pendingRemoval.type) })}</h2>
            <p>{t('sessions.removalImmediate')}</p>
          </div>
          <p className="muted-text">{t('sessions.removeItemQuestion', { name: pendingRemovalTitle })}</p>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={() => setPendingRemoval(null)} disabled={pendingRemovalBusy}>{t('courses.cancel')}</button>
            <button
              type="button"
              className="danger-button"
              disabled={pendingRemovalBusy}
              onClick={() => {
                if (pendingRemoval.type === 'student') {
                  void removeStudentFromGroup(pendingRemoval.student);
                  return;
                }
                if (pendingRemoval.type === 'activity') {
                  void removeActivity(pendingRemoval.activityId);
                  return;
                }
                void removeMaterial(pendingRemoval.materialIndex);
              }}
            >
              {pendingRemovalBusy ? t('groups.removing') : t('groups.remove')}
            </button>
          </div>
        </Modal>
      ) : null}
      {createModal === 'group' && canCoordinateGroups ? (
        <FormModal labelledBy="create-group-title" onClose={() => setCreateModal(null)} onSubmit={submitGroup}>
            <div className="modal-header-block">
              <span>{selectedCourse?.title ?? t('groups.courseRequired')}</span>
              <h2 id="create-group-title">{t('groups.createGroup')}</h2>
              <p>{t('sessions.createGroupDetail')}</p>
            </div>
            <div className="two-col">
              <label>
                {t('groups.name')}
                <input
                  value={groupForm.name}
                  onChange={(event) => {
                    setGroupForm((current) => ({ ...current, name: event.target.value }));
                    setCreateErrors((current) => ({ ...current, groupName: '' }));
                  }}
                  className={createErrors.groupName ? 'input-error' : ''}
                  aria-invalid={!!createErrors.groupName}
                  placeholder={t('sessions.groupNamePlaceholder')}
                  autoFocus
                />
                {createErrors.groupName ? <span className="field-error">{createErrors.groupName}</span> : null}
              </label>
              <label>
                {t('groups.code')}
                <input value={groupForm.code} onChange={(event) => setGroupForm((current) => ({ ...current, code: event.target.value }))} placeholder={t('sessions.autoIfEmpty')} />
              </label>
            </div>
            <div className="two-col">
              <label>
                {t('courses.status')}
                <select value={groupForm.status} onChange={(event) => setGroupForm((current) => ({ ...current, status: event.target.value as 'planned' | 'open' | 'active' | 'completed' | 'cancelled' }))}>
                  <option value="planned">{t('courses.statusPlanned')}</option>
                  <option value="open">{t('groups.statusOpen')}</option>
                  <option value="active">{t('groups.statusActive')}</option>
                </select>
              </label>
              <label>
                {t('groups.seatLimit')}
                <input type="number" min="1" value={groupForm.seatLimit} onChange={(event) => setGroupForm((current) => ({ ...current, seatLimit: event.target.value }))} placeholder={t('groups.noLimit')} />
              </label>
            </div>
            <div className="two-col">
              <label>
                {t('groups.startDate')}
                <input type="date" value={groupForm.startDate} onChange={(event) => setGroupForm((current) => ({ ...current, startDate: event.target.value }))} />
              </label>
              <label>
                {t('groups.endDate')}
                <input type="date" value={groupForm.endDate} onChange={(event) => setGroupForm((current) => ({ ...current, endDate: event.target.value }))} />
              </label>
            </div>
            <div className="two-col">
              <label>
                {t('groups.timezone')}
                <input value={groupForm.timezone} onChange={(event) => setGroupForm((current) => ({ ...current, timezone: event.target.value }))} placeholder="Asia/Bishkek" />
              </label>
              {canAssignInstructor ? (
                <label>
                  {t('sessions.groupInstructor')}
                  <select value={groupForm.instructorId} onChange={(event) => setGroupForm((current) => ({ ...current, instructorId: event.target.value }))}>
                    <option value="">{t('groups.useCourseInstructor')}</option>
                    {instructorOptions.map((member) => (
                      <option key={member.userId} value={member.userId}>
                        {member.fullName || member.user?.fullName || member.email || member.user?.email || instructorFallback(member.userId)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
            <label>
              {t('groups.location')}
              <input value={groupForm.location} onChange={(event) => setGroupForm((current) => ({ ...current, location: event.target.value }))} placeholder={t('sessions.locationPlaceholder')} />
            </label>
            <div className="two-col">
              <label>
                {t('groups.meetingProvider')}
                <input value={groupForm.meetingProvider} onChange={(event) => setGroupForm((current) => ({ ...current, meetingProvider: event.target.value }))} placeholder={t('sessions.meetingProviderPlaceholder')} />
              </label>
              <label>
                {t('groups.meetingUrl')}
                <input value={groupForm.meetingUrl} onChange={(event) => setGroupForm((current) => ({ ...current, meetingUrl: event.target.value }))} placeholder="https://..." />
              </label>
            </div>
            <div className="schedule-block-list">
              {groupForm.scheduleBlocks.map((block, index) => (
                <div className="three-col" key={`${index}-${block.day}`}>
                  <label>
                    {t('groups.scheduleDay')}
                    <select value={block.day} onChange={(event) => setGroupForm((current) => ({
                      ...current,
                      scheduleBlocks: current.scheduleBlocks.map((item, itemIndex) => itemIndex === index ? { ...item, day: event.target.value as ScheduleDay } : item),
                    }))}>
                      <option value="mon">{t('groups.dayMon')}</option>
                      <option value="tue">{t('groups.dayTue')}</option>
                      <option value="wed">{t('groups.dayWed')}</option>
                      <option value="thu">{t('groups.dayThu')}</option>
                      <option value="fri">{t('groups.dayFri')}</option>
                      <option value="sat">{t('groups.daySat')}</option>
                      <option value="sun">{t('groups.daySun')}</option>
                    </select>
                  </label>
                  <label>
                    {t('groups.starts')}
                    <input type="time" value={block.startTime} onChange={(event) => setGroupForm((current) => ({
                      ...current,
                      scheduleBlocks: current.scheduleBlocks.map((item, itemIndex) => itemIndex === index ? { ...item, startTime: event.target.value } : item),
                    }))} />
                  </label>
                  <label>
                    {t('groups.ends')}
                    <input type="time" value={block.endTime} onChange={(event) => setGroupForm((current) => ({
                      ...current,
                      scheduleBlocks: current.scheduleBlocks.map((item, itemIndex) => itemIndex === index ? { ...item, endTime: event.target.value } : item),
                    }))} />
                  </label>
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
            <label>
              {t('groups.scheduleNote')}
              <input value={groupForm.scheduleNote} onChange={(event) => setGroupForm((current) => ({ ...current, scheduleNote: event.target.value }))} placeholder={t('sessions.scheduleNotePlaceholder')} />
            </label>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setCreateModal(null)} disabled={savingGroup}>{t('courses.cancel')}</button>
              <button type="submit" disabled={!courseId || savingGroup}>{savingGroup ? t('courses.creating') : t('groups.createGroup')}</button>
            </div>
        </FormModal>
      ) : null}
      {createModal === 'session' && canCoordinateGroups ? (
        <FormModal labelledBy="schedule-session-title" onClose={() => setCreateModal(null)} onSubmit={submitSession}>
            <div className="modal-header-block">
              <span>{selectedGroup?.name ?? t('sessions.groupRequired')}</span>
              <h2 id="schedule-session-title">{t('sessions.scheduleSession')}</h2>
              <p>{t('sessions.scheduleSessionDetail')}</p>
            </div>
            <label>
              {t('courses.title')}
              <input
                value={sessionForm.title}
                onChange={(event) => {
                  setSessionForm((current) => ({ ...current, title: event.target.value }));
                  setCreateErrors((current) => ({ ...current, sessionTitle: '' }));
                }}
                className={createErrors.sessionTitle ? 'input-error' : ''}
                aria-invalid={!!createErrors.sessionTitle}
                placeholder={sessionPlaceholder(nextSessionIndex)}
                autoFocus
              />
              {createErrors.sessionTitle ? <span className="field-error">{createErrors.sessionTitle}</span> : null}
            </label>
            <div className="two-col">
              <label>
                {t('groups.starts')}
                <input
                  type="datetime-local"
                  value={sessionForm.startsAt}
                  onChange={(event) => {
                    setSessionForm((current) => ({ ...current, startsAt: event.target.value }));
                    setCreateErrors((current) => ({ ...current, startsAt: '', endsAt: '' }));
                  }}
                  className={createErrors.startsAt ? 'input-error' : ''}
                  aria-invalid={!!createErrors.startsAt}
                />
                {createErrors.startsAt ? <span className="field-error">{createErrors.startsAt}</span> : null}
              </label>
              <label>
                {t('groups.ends')}
                <input
                  type="datetime-local"
                  value={sessionForm.endsAt}
                  onChange={(event) => {
                    setSessionForm((current) => ({ ...current, endsAt: event.target.value }));
                    setCreateErrors((current) => ({ ...current, endsAt: '' }));
                  }}
                  className={createErrors.endsAt ? 'input-error' : ''}
                  aria-invalid={!!createErrors.endsAt}
                />
                {createErrors.endsAt ? <span className="field-error">{createErrors.endsAt}</span> : null}
              </label>
            </div>
            <label>
              {t('sessions.notes')}
              <input value={sessionForm.notes} onChange={(event) => setSessionForm((current) => ({ ...current, notes: event.target.value }))} placeholder={t('sessions.optionalInternalNote')} />
            </label>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setCreateModal(null)} disabled={savingSession}>{t('courses.cancel')}</button>
              <button type="submit" disabled={!groupId || savingSession}>{savingSession ? t('sessions.scheduling') : t('sessions.scheduleSession')}</button>
            </div>
        </FormModal>
      ) : null}
      {createModal === 'enrollment' && canManageEnrollment ? (
        <FormModal
          labelledBy="enroll-student-title"
          onClose={() => setCreateModal(null)}
          onSubmit={enrollmentMode === 'existing' ? submitEnrollment : (event) => {
            event.preventDefault();
            void submitInviteAndEnroll();
          }}
        >
            <div className="modal-header-block">
              <span>{selectedGroup?.name ?? t('sessions.groupRequired')}</span>
              <h2 id="enroll-student-title">{t('sessions.enrollStudent')}</h2>
              <p>{t('sessions.enrollStudentDetail')}</p>
            </div>
            <div className="enrollment-tabs" role="tablist" aria-label={t('groups.enrollmentMode')}>
              <button type="button" className={enrollmentMode === 'existing' ? 'active' : ''} onClick={() => setEnrollmentMode('existing')}>
                {t('groups.existingStudent')}
              </button>
              <button type="button" className={enrollmentMode === 'new' ? 'active' : ''} onClick={() => setEnrollmentMode('new')}>
                {t('groups.newStudent')}
              </button>
            </div>
            {enrollmentMode === 'existing' ? (
              <>
                <div className="student-search-row">
                  <label>
                    {t('groups.searchStudent')}
                    <input value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} placeholder={t('groups.nameOrEmail')} autoFocus />
                  </label>
                  <button type="button" className="secondary-button" onClick={() => void searchStudents()} disabled={enrolling}>
                    {t('groups.search')}
                  </button>
                </div>
                <label>
                  {t('courses.student')}
                  <select
                    value={selectedStudentId ?? ''}
                    onChange={(event) => {
                      setSelectedStudentId(Number(event.target.value) || undefined);
                      setCreateErrors((current) => ({ ...current, student: '' }));
                    }}
                    disabled={!studentResults.length}
                    className={createErrors.student ? 'input-error' : ''}
                    aria-invalid={!!createErrors.student}
                  >
                    <option value="">{t('groups.selectStudent')}</option>
                    {studentResults.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.fullName || student.email} ({student.email})
                      </option>
                    ))}
                  </select>
                  {createErrors.student ? <span className="field-error">{createErrors.student}</span> : null}
                </label>
              </>
            ) : (
              <>
                <div className="two-col">
                  <label>
                    {t('groups.fullName')}
                    <input
                      value={studentInviteForm.fullName}
                      onChange={(event) => setStudentInviteForm((current) => ({ ...current, fullName: event.target.value }))}
                      placeholder={t('groups.fullName')}
                      autoFocus
                    />
                  </label>
                  <label>
                    {t('groups.email')}
                    <input
                      type="email"
                      value={studentInviteForm.email}
                      onChange={(event) => setStudentInviteForm((current) => ({ ...current, email: event.target.value }))}
                      placeholder="student@example.com"
                    />
                  </label>
                </div>
                <label className="inline-check">
                  <input
                    type="checkbox"
                    checked={studentInviteForm.sendEmail}
                    onChange={(event) => setStudentInviteForm((current) => ({ ...current, sendEmail: event.target.checked }))}
                  />
                  {t('groups.sendSetupEmail')}
                </label>
              </>
            )}
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setCreateModal(null)} disabled={enrolling}>{t('courses.cancel')}</button>
              <button type="submit" disabled={!courseId || !groupId || (enrollmentMode === 'existing' && !selectedStudentId) || enrolling}>
                {enrolling ? t('auth.working') : enrollmentMode === 'existing' ? t('sessions.enrollStudent') : t('groups.createAndEnroll')}
              </button>
            </div>
        </FormModal>
      ) : null}
      {createModal === 'activity' ? (
        <FormModal labelledBy="add-activity-title" onClose={() => setCreateModal(null)} onSubmit={submitActivity}>
            <div className="modal-header-block">
              <span>{selectedSession?.title ?? t('sessions.sessionRequired')}</span>
              <h2 id="add-activity-title">{t('sessions.addActivity')}</h2>
              <p>{t('sessions.addActivityDetail')}</p>
            </div>
            <div className="two-col">
              <label>
                {t('courses.title')}
                <input
                  value={activityForm.title}
                  onChange={(event) => {
                    setActivityForm((current) => ({ ...current, title: event.target.value }));
                    setCreateErrors((current) => ({ ...current, activityTitle: '' }));
                  }}
                  className={createErrors.activityTitle ? 'input-error' : ''}
                  aria-invalid={!!createErrors.activityTitle}
                  placeholder={t('sessions.activityTitlePlaceholder')}
                  autoFocus
                />
                {createErrors.activityTitle ? <span className="field-error">{createErrors.activityTitle}</span> : null}
              </label>
              <label>
                {t('courses.type')}
                <select value={activityForm.type} onChange={(event) => setActivityForm((current) => ({ ...current, type: event.target.value as SessionActivityType }))}>
                  <option value="discussion">{t('sessions.activityTypeDiscussion')}</option>
                  <option value="exercise">{t('sessions.activityTypeExercise')}</option>
                  <option value="group_work">{t('sessions.activityTypeGroupWork')}</option>
                  <option value="quiz">{t('sessions.activityTypeQuiz')}</option>
                </select>
              </label>
            </div>
            <div className="two-col">
              <label>
                {t('courses.status')}
                <select value={activityForm.status} onChange={(event) => setActivityForm((current) => ({ ...current, status: event.target.value as SessionActivityStatus }))}>
                  <option value="planned">{t('courses.statusPlanned')}</option>
                  <option value="active">{t('groups.statusActive')}</option>
                  <option value="done">{t('sessions.statusDone')}</option>
                </select>
              </label>
              <label>
                {t('courses.description')}
                <input value={activityForm.description} onChange={(event) => setActivityForm((current) => ({ ...current, description: event.target.value }))} placeholder={t('sessions.optionalInstruction')} />
              </label>
            </div>
            {activityForm.type === 'quiz' ? (
              <div className="quiz-builder">
                <label>
                  {t('sessions.question')}
                  <input
                    value={activityForm.quizPrompt}
                    onChange={(event) => {
                      setActivityForm((current) => ({ ...current, quizPrompt: event.target.value }));
                      setCreateErrors((current) => ({ ...current, quizPrompt: '' }));
                    }}
                    className={createErrors.quizPrompt ? 'input-error' : ''}
                    aria-invalid={!!createErrors.quizPrompt}
                  />
                  {createErrors.quizPrompt ? <span className="field-error">{createErrors.quizPrompt}</span> : null}
                </label>
                <div className="two-col">
                  <label>
                    {t('sessions.optionA')}
                    <input
                      value={activityForm.quizOptionA}
                      onChange={(event) => {
                        setActivityForm((current) => ({ ...current, quizOptionA: event.target.value }));
                        setCreateErrors((current) => ({ ...current, quizOptionA: '' }));
                      }}
                      className={createErrors.quizOptionA ? 'input-error' : ''}
                      aria-invalid={!!createErrors.quizOptionA}
                    />
                    {createErrors.quizOptionA ? <span className="field-error">{createErrors.quizOptionA}</span> : null}
                  </label>
                  <label>
                    {t('sessions.optionB')}
                    <input
                      value={activityForm.quizOptionB}
                      onChange={(event) => {
                        setActivityForm((current) => ({ ...current, quizOptionB: event.target.value }));
                        setCreateErrors((current) => ({ ...current, quizOptionB: '' }));
                      }}
                      className={createErrors.quizOptionB ? 'input-error' : ''}
                      aria-invalid={!!createErrors.quizOptionB}
                    />
                    {createErrors.quizOptionB ? <span className="field-error">{createErrors.quizOptionB}</span> : null}
                  </label>
                </div>
                <label>
                  {t('sessions.correctAnswer')}
                  <select value={activityForm.quizCorrectOption} onChange={(event) => setActivityForm((current) => ({ ...current, quizCorrectOption: event.target.value as 'a' | 'b' }))}>
                    <option value="a">{t('sessions.optionA')}</option>
                    <option value="b">{t('sessions.optionB')}</option>
                  </select>
                </label>
              </div>
            ) : null}
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setCreateModal(null)} disabled={savingActivity}>{t('courses.cancel')}</button>
              <button type="submit" disabled={savingActivity}>{savingActivity ? t('courses.saving') : t('sessions.addActivity')}</button>
            </div>
        </FormModal>
      ) : null}
    </>
  );
}
