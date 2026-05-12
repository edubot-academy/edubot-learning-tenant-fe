import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import { formatDate, readable } from '../../lib/format';
import { useTenant } from '../tenant/TenantProvider';
import { useAuth } from '../auth/AuthProvider';
import { isTenantAdmin } from '../tenant/tenantRoles';
import { courseWorkflowBlocker, isCourseWorkflowReady, nextWorkflowSearchParams } from '../workflows/workflowContext';

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
  { key: 'overview', label: 'Overview' },
  { key: 'activities', label: 'Activities' },
  { key: 'meeting', label: 'Live meeting' },
  { key: 'materials', label: 'Materials' },
  { key: 'insights', label: 'Insights' },
];

export function SessionsPage() {
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
  const selectedCourseBlocker = courseWorkflowBlocker(selectedCourse);
  const selectedGroup = useMemo(() => groups.find((group) => group.id === groupId), [groupId, groups]);
  const selectedSession = useMemo(() => sessions.find((session) => session.id === sessionId), [sessionId, sessions]);
  const canAssignInstructor = isTenantAdmin(user, activeTenant);
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
  const generationReady = savedScheduleReady && generationDatesReady;
  const pendingRemovalTitle = pendingRemoval?.type === 'student'
    ? (pendingRemoval.student.fullName || pendingRemoval.student.email || `Student #${pendingRemoval.student.userId}`)
    : pendingRemoval?.type === 'activity'
      ? (sessionActivities.find((activity) => activity.id === pendingRemoval.activityId)?.title ?? 'this activity')
      : pendingRemoval?.type === 'material'
        ? ((selectedSession?.materials ?? [])[pendingRemoval.materialIndex]?.title ?? `Material ${pendingRemoval.materialIndex + 1}`)
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
      label: 'Course',
      value: selectedCourse?.title ?? 'Choose course',
      state: selectedCourse ? 'ready' : 'current',
    },
    {
      label: 'Group',
      value: selectedGroup?.name ?? (selectedCourse ? 'Choose or create group' : 'Waiting for course'),
      state: selectedGroup ? 'ready' : selectedCourse ? 'current' : 'locked',
    },
    {
      label: 'Session',
      value: selectedSession?.title ?? (selectedGroup ? 'Choose or schedule session' : 'Waiting for group'),
      state: selectedSession ? 'ready' : selectedGroup ? 'current' : 'locked',
    },
    {
      label: 'Operate',
      value: selectedSession ? 'Attendance, homework, materials' : 'Session tools unlock here',
      state: selectedSession ? 'current' : 'locked',
    },
  ], [selectedCourse, selectedGroup, selectedSession]);

  useEffect(() => {
    setCourses([]);
    setGroups([]);
    setSessions([]);
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
    setTenantMembers([]);
    if (!activeTenantId || !canAssignInstructor) return;
    let cancelled = false;
    listTenantMembers(activeTenantId)
      .then((members) => {
        if (!cancelled) setTenantMembers(members);
      })
      .catch(() => {
        if (!cancelled) toast.error('Could not load tenant instructors');
      });
    return () => {
      cancelled = true;
    };
  }, [activeTenantId, canAssignInstructor]);

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
        if (!cancelled) toast.error('Could not load group sessions');
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
        if (!cancelled) toast.error('Could not load session detail');
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

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
    const nextErrors: Record<string, string> = {};
    if (!courseId) {
      nextErrors.course = 'Select a course before creating a group.';
    }
    if (!groupForm.name.trim()) {
      nextErrors.groupName = 'Group name is required.';
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
      toast.success('Group created');
    } catch {
      toast.error('Could not create group');
    } finally {
      setSavingGroup(false);
    }
  };

  const submitGroupUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!groupId || !courseId) return;
    if (!editGroupForm.name.trim()) {
      toast.error('Group name is required');
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
      toast.success('Group updated');
    } catch {
      toast.error('Could not update group');
    } finally {
      setUpdatingGroup(false);
    }
  };

  const submitSession = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!groupId) {
      nextErrors.group = 'Select a group before scheduling a session.';
    }
    if (!sessionForm.title.trim()) nextErrors.sessionTitle = 'Session title is required.';
    if (!sessionForm.startsAt) nextErrors.startsAt = 'Start date and time are required.';
    if (!sessionForm.endsAt) nextErrors.endsAt = 'End date and time are required.';
    if (sessionForm.startsAt && sessionForm.endsAt && new Date(sessionForm.endsAt) <= new Date(sessionForm.startsAt)) {
      nextErrors.endsAt = 'End time must be after the start time.';
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
      toast.success('Session scheduled');
    } catch {
      toast.error('Could not schedule session');
    } finally {
      setSavingSession(false);
    }
  };

  const previewSessionGeneration = async () => {
    if (!groupId) return;
    if (!generationReady) {
      toast.error('Complete saved schedule and generation dates first');
      return;
    }

    setGenerationLoading(true);
    try {
      const preview = await previewGeneratedSessions(groupId, generationRange);
      setGenerationPreview(preview);
      toast.success('Preview ready');
    } catch {
      toast.error('Could not preview sessions. Check group schedule settings.');
    } finally {
      setGenerationLoading(false);
    }
  };

  const generateSessions = async () => {
    if (!groupId) return;
    if (!generationPreview?.newCount) {
      toast.error('Preview new sessions first');
      return;
    }

    setGenerationLoading(true);
    try {
      const result = await generateGroupSessions(groupId, generationRange);
      await reloadSessions(groupId);
      setGenerationPreview(null);
      toast.success(`Created ${result.createdCount} sessions`);
    } catch {
      toast.error('Could not generate sessions');
    } finally {
      setGenerationLoading(false);
    }
  };

  const searchStudents = async () => {
    setEnrolling(true);
    try {
      const results = await searchUsers({ search: studentSearch, role: 'student', limit: 12 });
      setStudentResults(results);
      setSelectedStudentId(results[0]?.id);
    } catch {
      toast.error('Could not search students');
    } finally {
      setEnrolling(false);
    }
  };

  const submitEnrollment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!courseId || !groupId || !selectedStudentId) {
      nextErrors.student = 'Select a student to enroll.';
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
      toast.success('Student enrolled');
    } catch {
      toast.error('Could not enroll student');
    } finally {
      setEnrolling(false);
    }
  };

  const submitInviteAndEnroll = async () => {
    if (!activeTenantId || !courseId || !groupId) return;
    if (!studentInviteForm.fullName.trim() || !studentInviteForm.email.trim()) {
      toast.error('Student name and email are required');
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
      toast.success(member.onboarding?.emailSent ? 'Student invited and enrolled' : 'Student created and enrolled');
    } catch {
      toast.error('Could not create and enroll student');
    } finally {
      setEnrolling(false);
    }
  };

  const removeStudentFromGroup = async (student: GroupStudent) => {
    if (!courseId || !groupId) return;
    setRemovingStudentId(student.userId);
    try {
      await unenrollUser(courseId, student.userId);
      await reloadSessions(groupId);
      toast.success('Student removed from group');
    } catch {
      toast.error('Could not remove student');
    } finally {
      setRemovingStudentId(undefined);
      setPendingRemoval(null);
    }
  };

  const submitSessionUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!sessionId || !groupId) return;
    const nextErrors: Record<string, string> = {};
    if (!editSessionForm.title.trim()) nextErrors.title = 'Session title is required.';
    if (!editSessionForm.startsAt) nextErrors.startsAt = 'Start date and time are required.';
    if (!editSessionForm.endsAt) nextErrors.endsAt = 'End date and time are required.';
    if (editSessionForm.startsAt && editSessionForm.endsAt && new Date(editSessionForm.endsAt) <= new Date(editSessionForm.startsAt)) {
      nextErrors.endsAt = 'End time must be after the start time.';
    }
    if (editSessionForm.recordingUrl.trim() && !/^https?:\/\/\S+\.\S+/.test(editSessionForm.recordingUrl.trim())) {
      nextErrors.recordingUrl = 'Use a full recording URL.';
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
      toast.success('Session updated');
    } catch {
      toast.error('Could not update session');
    } finally {
      setUpdatingSession(false);
    }
  };

  const uploadMaterial = async (file: File | undefined) => {
    if (!file) {
      setMaterialError('Choose a file to upload.');
      toast.error('Choose a file to upload');
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
      toast.success('Material uploaded');
    } catch {
      toast.error('Could not upload material');
    } finally {
      setUploadingMaterial(false);
    }
  };

  const saveLiveMeeting = async () => {
    if (!sessionId || !groupId) return;
    const nextErrors: Record<string, string> = {};
    if (meetingForm.provider !== 'zoom' && !meetingForm.customJoinUrl.trim()) {
      nextErrors.customJoinUrl = 'Meeting URL is required.';
    }
    if (meetingForm.provider !== 'zoom' && meetingForm.customJoinUrl.trim() && !/^https?:\/\/\S+\.\S+/.test(meetingForm.customJoinUrl.trim())) {
      nextErrors.customJoinUrl = 'Use a full meeting URL.';
    }
    if (meetingForm.provider === 'zoom' && !meetingForm.hostUserId.trim()) {
      nextErrors.hostUserId = 'Zoom host user ID is required.';
    }
    if (meetingForm.durationMinutes && Number(meetingForm.durationMinutes) < 1) {
      nextErrors.durationMinutes = 'Duration must be at least 1 minute.';
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
      toast.success('Live meeting saved');
    } catch {
      toast.error('Could not save live meeting');
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
      toast.success('Live meeting removed');
    } catch {
      toast.error('Could not remove live meeting');
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
      toast.success('Material removed');
    } catch {
      toast.error('Could not remove material');
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
      nextErrors.activityTitle = 'Activity title is required.';
    }
    if (activityForm.type === 'quiz') {
      if (!activityForm.quizPrompt.trim()) nextErrors.quizPrompt = 'Quiz question is required.';
      if (!activityForm.quizOptionA.trim()) nextErrors.quizOptionA = 'Option A is required.';
      if (!activityForm.quizOptionB.trim()) nextErrors.quizOptionB = 'Option B is required.';
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
      toast.success('Activity added');
    } catch {
      toast.error('Could not save activity');
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
      toast.success('Activity updated');
    } catch {
      toast.error('Could not update activity');
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
      toast.success('Activity removed');
    } catch {
      toast.error('Could not remove activity');
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
      toast.error('Could not load activity responses');
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
      toast.error('Review comment is required');
      return;
    }
    if (score !== undefined && !Number.isFinite(score)) {
      toast.error('Score must be a number');
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
      toast.success('Review saved');
    } catch {
      toast.error('Could not save review');
    } finally {
      setReviewingSubmission(undefined);
    }
  };

  return (
    <>
      <PageHeader title="Sessions" eyebrow={activeTenant?.name} />
      <div className="filters-row three">
        <select value={courseId ?? ''} onChange={(event) => setCourseId(Number(event.target.value) || undefined)}>
          <option value="">Select course</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.title}{isCourseWorkflowReady(course) ? '' : ' - locked'}
            </option>
          ))}
        </select>
        <select value={groupId ?? ''} onChange={(event) => setGroupId(Number(event.target.value) || undefined)} disabled={!groups.length}>
          <option value="">Select group</option>
          {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
        </select>
        <select value={sessionId ?? ''} onChange={(event) => setSessionId(Number(event.target.value) || undefined)} disabled={!sessions.length}>
          <option value="">Select session</option>
          {sessions.map((session) => (
            <option key={session.id} value={session.id}>
              {session.title} {session.startsAt ? `- ${formatDate(session.startsAt)}` : ''}
            </option>
          ))}
        </select>
      </div>
      <section className="session-workflow-strip" aria-label="Session workflow">
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
      {loading ? <LoadingState label="Loading sessions" /> : null}
      <section className="workflow-section workflow-context-panel">
        <div className="section-heading-row">
          <div>
            <h2>Set up learning operations</h2>
            <span>Create the container first, then schedule sessions and enroll learners.</span>
          </div>
          <div className="page-actions">
            <button type="button" className="secondary-button" onClick={() => setCreateModal('group')} disabled={!courseId || !selectedCourseReady || savingGroup} title={!selectedCourseReady ? selectedCourseBlocker : undefined}>
              Create group
            </button>
            <button type="button" className="secondary-button" onClick={() => setCreateModal('session')} disabled={!groupId || savingSession}>
              Schedule session
            </button>
            <button type="button" className="secondary-button" onClick={() => setCreateModal('enrollment')} disabled={!courseId || !groupId || enrolling}>
              Enroll student
            </button>
          </div>
        </div>
        <div className="create-action-grid">
          <article>
            <strong>{selectedCourseReady ? 'Group ready to create' : selectedCourse ? 'Course locked for groups' : 'Choose a course first'}</strong>
            <span>{selectedCourseReady ? 'Groups organize learners and unlock scheduling.' : selectedCourseBlocker}</span>
          </article>
          <article>
            <strong>{selectedGroup ? 'Schedule the next class' : 'Choose or create a group'}</strong>
            <span>Sessions hold live links, materials, homework, and activities.</span>
          </article>
          <article>
            <strong>{selectedGroup ? `${students.length} enrolled` : 'Enrollment unlocks after group selection'}</strong>
            <span>Add existing student accounts to the selected group.</span>
          </article>
        </div>
      </section>

      {selectedGroup ? (
        <section className="settings-panel group-edit-panel workflow-section workflow-context-panel">
          <div className="section-heading-row">
            <div>
              <h2>Group schedule and defaults</h2>
              <span>{selectedCourse?.title ?? 'Selected course'}</span>
            </div>
            <button type="button" className="secondary-button" onClick={() => setEditGroupOpen(true)}>Edit group</button>
          </div>
          <div className="group-summary-grid">
            <section><span>Status</span><strong>{readable(selectedGroup.status ?? 'planned')}</strong></section>
            <section><span>Dates</span><strong>{selectedGroup.startDate || selectedGroup.endDate ? `${selectedGroup.startDate ?? '-'} - ${selectedGroup.endDate ?? '-'}` : 'Not scheduled'}</strong></section>
            <section><span>Schedule</span><strong>{savedScheduleReady ? `${selectedGroup.scheduleBlocks?.filter((block) => block.startTime && block.endTime).length ?? 0} block${(selectedGroup.scheduleBlocks?.filter((block) => block.startTime && block.endTime).length ?? 0) === 1 ? '' : 's'}` : 'Needs setup'}</strong></section>
            <section><span>Students</span><strong>{students.length}</strong></section>
            <section><span>Capacity</span><strong>{selectedGroup.seatLimit ?? 'Open'}</strong></section>
            <section><span>Location</span><strong>{selectedGroup.location || selectedGroup.meetingProvider || 'Not set'}</strong></section>
          </div>
          <div className="session-generation-panel">
            <div className="section-heading-row compact">
              <div>
                <h3>Generate sessions</h3>
                <span>Uses the saved group schedule above</span>
              </div>
            </div>
            <p className={`panel-note ${generationReady ? 'success' : ''}`}>
              {generationReady ? 'Schedule and dates are ready for preview.' : 'Add at least one complete saved schedule block and choose generation dates before previewing sessions.'}
            </p>
            <div className="three-col">
              <label>
                From
                <input type="date" value={generationRange.fromDate} onChange={(event) => setGenerationRange((current) => ({ ...current, fromDate: event.target.value }))} />
              </label>
              <label>
                To
                <input type="date" value={generationRange.toDate} onChange={(event) => setGenerationRange((current) => ({ ...current, toDate: event.target.value }))} />
              </label>
              <div className="generation-actions">
                <button type="button" className="secondary-button" onClick={() => void previewSessionGeneration()} disabled={generationLoading || !generationReady}>
                  Preview
                </button>
                <button type="button" onClick={() => void generateSessions()} disabled={generationLoading || !generationPreview?.newCount}>
                  Generate
                </button>
              </div>
            </div>
            {generationPreview ? (
              <div className="generation-preview">
                <span>Total <strong>{generationPreview.total}</strong></span>
                <span>New <strong>{generationPreview.newCount}</strong></span>
                <span>Existing <strong>{generationPreview.existingCount}</strong></span>
                <div className="stack-list">
                  {generationPreview.items.slice(0, 5).map((item) => (
                    <article key={`${item.kind}-${item.sessionIndex}-${item.startsAt}`} className="stack-list-item">
                      <div>
                        <strong>{item.title}</strong>
                        <span>{item.day} · {formatDate(item.startsAt)} - {formatDate(item.endsAt)}</span>
                      </div>
                      <span className={`status-badge ${item.kind === 'new' ? 'pending' : 'scheduled'}`}>{readable(item.kind)}</span>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          <div className="group-roster-panel">
            <div className="section-heading-row compact">
              <div>
                <h3>Group roster</h3>
                <span>{students.length} active learner{students.length === 1 ? '' : 's'}</span>
              </div>
              <button type="button" className="secondary-button" onClick={() => setCreateModal('enrollment')} disabled={!courseId || !groupId || enrolling}>
                Enroll student
              </button>
            </div>
            <div className="stack-list">
              {students.map((student) => (
                <article key={student.userId} className="stack-list-item">
                  <div>
                    <strong>{student.fullName || student.email || `Student #${student.userId}`}</strong>
                    <span>
                      {student.email || 'No email'} · progress {Math.round(student.progressPercent ?? 0)}%
                      {student.completed ? ' · completed' : ''}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="link-button danger"
                    onClick={() => setPendingRemoval({ type: 'student', student })}
                    disabled={removingStudentId === student.userId}
                  >
                    {removingStudentId === student.userId ? 'Removing...' : 'Remove'}
                  </button>
                </article>
              ))}
              {!students.length ? (
                <EmptyState
                  title="No students enrolled in this group"
                  detail="Enroll students before running attendance, homework, and activity reviews for this group."
                />
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {!loading && !sessions.length ? (
        <EmptyState
          title={selectedGroup ? 'No sessions scheduled' : 'No sessions selected'}
          detail={selectedGroup ? 'Schedule a session manually or generate sessions from the saved group schedule.' : 'Choose or create a course group, then schedule sessions for learners.'}
          action={(
            <>
              <button type="button" className="secondary-button" onClick={() => setCreateModal('group')} disabled={!courseId || !selectedCourseReady || savingGroup} title={!selectedCourseReady ? selectedCourseBlocker : undefined}>Create group</button>
              <button type="button" className="primary-button" onClick={() => setCreateModal('session')} disabled={!groupId || savingSession}>Schedule session</button>
            </>
          )}
        />
      ) : null}
      {!!sessions.length && (
        <div className="workspace-grid session-workspace-grid">
          <section className="content-section">
            <div className="section-heading-row">
              <div>
                <h2>Session schedule</h2>
                <span>Select a session to open its operations panel.</span>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Session</th>
                    <th>Starts</th>
                    <th>Status</th>
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
                      <td><span className={`status-badge ${session.status || 'scheduled'}`}>{readable(session.status || 'scheduled')}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="settings-panel workflow-context-panel">
            <div className="section-heading-row compact">
              <div>
                <h2>Session workspace</h2>
                <span>{selectedSession?.title ?? 'Select a session'}</span>
              </div>
            </div>
            {!selectedSession ? (
              <EmptyState title="Choose a session" detail="Select a session row or use the session dropdown." />
            ) : (
              <>
                <WorkspaceTabs
                  tabs={sessionOperationTabs}
                  activeTab={sessionOperationTab}
                  onChange={setSessionOperationTab}
                  ariaLabel="Session operations"
                  className="session-operation-tabs"
                />
                {sessionOperationTab === 'activities' ? (
                  <div className="session-activities-panel">
                    <div className="section-heading-row compact">
                      <div>
                        <h3>Activities</h3>
                        <span>{selectedSession.title}</span>
                      </div>
                      <button type="button" className="secondary-button" onClick={() => setCreateModal('activity')} disabled={savingActivity}>
                        Add activity
                      </button>
                    </div>
                    <div className="stack-list activity-list">
                      {sessionActivities.map((activity) => (
                        <article key={activity.id} className="stack-list-item activity-list-item">
                          <div>
                            <strong>{activity.title}</strong>
                            <span>{readable(activity.type)} · <span className={`status-badge ${activity.status}`}>{readable(activity.status)}</span></span>
                          </div>
                          <div className="activity-actions">
                            {activity.status !== 'active' ? (
                              <button type="button" className="secondary-button" onClick={() => void setActivityStatus(activity, 'active')} disabled={savingActivity}>Start</button>
                            ) : null}
                            {activity.status !== 'done' ? (
                              <button type="button" className="secondary-button" onClick={() => void setActivityStatus(activity, 'done')} disabled={savingActivity}>Done</button>
                            ) : null}
                            <button type="button" className="secondary-button" onClick={() => void loadActivityResponses(activity.id)} disabled={loadingResponses && selectedActivityId === activity.id}>Responses</button>
                            <button type="button" className="link-button danger" onClick={() => setPendingRemoval({ type: 'activity', activityId: activity.id })} disabled={savingActivity}>Remove</button>
                          </div>
                        </article>
                      ))}
                      {!sessionActivities.length ? (
                        <EmptyState
                          title="No activities planned yet"
                          detail="Add an activity when this session needs discussion, exercise, quiz, or group work tracking."
                        />
                      ) : null}
                    </div>
                    {activityResponses ? (
                      <div className="activity-responses-panel">
                        <div className="section-heading-row compact">
                          <div>
                            <h3>Responses</h3>
                            <span>{activityResponses.activity.title} · {readable(activityResponses.mode)}</span>
                          </div>
                        </div>
                        {loadingResponses ? <LoadingState label="Loading responses" /> : null}
                        <div className="stack-list">
                          {activityResponses.items.map((item) => (
                            <article key={`${item.id ?? item.latestAttemptId ?? item.studentId}`} className="stack-list-item activity-response-item">
                              <div>
                                <strong>{item.studentName || `Student #${item.studentId}`}</strong>
                                {activityResponses.mode === 'quiz' ? (
                                  <span>
                                    {item.passed ? 'Passed' : 'Not passed'} · score {item.score ?? 0} · attempts {item.attemptsCount ?? 0}
                                  </span>
                                ) : (
                                  <>
                                    <span>{readable(item.status ?? 'submitted')}{item.updatedAt ? ` · ${formatDate(item.updatedAt)}` : ''}</span>
                                    {item.answerText ? <p>{item.answerText}</p> : null}
                                    {item.attachmentUrl ? <a href={item.attachmentUrl} target="_blank" rel="noreferrer">Open attachment</a> : null}
                                  </>
                                )}
                              </div>
                              {activityResponses.mode === 'submission' && item.id ? (
                                <div className="review-controls">
                                  <input
                                    value={reviewDrafts[item.id]?.score ?? ''}
                                    onChange={(event) => setReviewDrafts((current) => ({ ...current, [item.id!]: { score: event.target.value, reviewComment: current[item.id!]?.reviewComment ?? '' } }))}
                                    placeholder="Score"
                                    inputMode="numeric"
                                  />
                                  <input
                                    value={reviewDrafts[item.id]?.reviewComment ?? ''}
                                    onChange={(event) => setReviewDrafts((current) => ({ ...current, [item.id!]: { score: current[item.id!]?.score ?? '', reviewComment: event.target.value } }))}
                                    placeholder="Review comment"
                                  />
                                  <div className="activity-actions">
                                    <button type="button" className="secondary-button" onClick={() => void submitActivityReview(activityResponses.activity.id, item.id!, 'approved')} disabled={reviewingSubmission === item.id}>Approve</button>
                                    <button type="button" className="secondary-button" onClick={() => void submitActivityReview(activityResponses.activity.id, item.id!, 'needs_revision')} disabled={reviewingSubmission === item.id}>Revise</button>
                                    <button type="button" className="link-button danger" onClick={() => void submitActivityReview(activityResponses.activity.id, item.id!, 'rejected')} disabled={reviewingSubmission === item.id}>Reject</button>
                                  </div>
                                </div>
                              ) : null}
                            </article>
                          ))}
                          {!activityResponses.items.length ? (
                            <EmptyState
                              title="No responses yet"
                              detail="Learner responses will appear here after the activity has submissions or quiz attempts."
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
                  <span>Course</span><strong>{selectedCourse?.title ?? '-'}</strong>
                  <span>Group</span><strong>{selectedGroup?.name ?? '-'}</strong>
                  <span>Starts</span><strong>{formatDate(selectedSession.startsAt)}</strong>
                  <span>Ends</span><strong>{formatDate(selectedSession.endsAt)}</strong>
                  <span>Status</span><strong><span className={`status-badge ${selectedSession.status || 'scheduled'}`}>{readable(selectedSession.status || 'scheduled')}</span></strong>
                  <span>Recording</span><strong>{selectedSession.recordingUrl ? 'Attached' : 'Not attached'}</strong>
                </div>
                <div className="session-summary-actions">
                  <button type="button" className="secondary-button" onClick={() => setEditSessionOpen(true)}>
                    Edit session
                  </button>
                </div>
                  </>
                ) : null}
                {sessionOperationTab === 'meeting' ? (
                <div className="session-live-panel">
                  <div className="section-heading-row compact">
                    <div>
                      <h3>Live meeting</h3>
                      <span>{liveMeeting?.joinUrl || selectedSession.liveJoinUrl ? 'Meeting attached' : 'No meeting attached'}</span>
                    </div>
                  </div>
                  <div className="two-col">
                    <label>
                      Provider
                      <select value={meetingForm.provider} onChange={(event) => setMeetingForm((current) => ({ ...current, provider: event.target.value as 'zoom' | 'google_meet' | 'custom' }))}>
                        <option value="custom">Custom</option>
                        <option value="google_meet">Google Meet</option>
                        <option value="zoom">Zoom</option>
                      </select>
                    </label>
                    <label>
                      Duration
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
                      Join URL
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
                      Zoom host user ID
                      <input
                        value={meetingForm.hostUserId}
                        onChange={(event) => {
                          setMeetingForm((current) => ({ ...current, hostUserId: event.target.value }));
                          setMeetingErrors((current) => ({ ...current, hostUserId: '' }));
                        }}
                        className={meetingErrors.hostUserId ? 'input-error' : ''}
                        aria-invalid={!!meetingErrors.hostUserId}
                        placeholder="me or Zoom user email"
                      />
                      {meetingErrors.hostUserId ? <span className="field-error">{meetingErrors.hostUserId}</span> : null}
                    </label>
                  )}
                  <label>
                    Topic
                    <input value={meetingForm.topic} onChange={(event) => setMeetingForm((current) => ({ ...current, topic: event.target.value }))} />
                  </label>
                  <div className="live-meeting-actions">
                    <button type="button" onClick={() => void saveLiveMeeting()} disabled={savingMeeting}>
                      {savingMeeting ? 'Saving...' : 'Save meeting'}
                    </button>
                    {(liveMeeting?.joinUrl || selectedSession.liveJoinUrl) ? (
                      <>
                        <a href={liveMeeting?.joinUrl ?? selectedSession.liveJoinUrl ?? '#'} target="_blank" rel="noreferrer">Open meeting</a>
                        <button type="button" className="secondary-button" onClick={() => void removeLiveMeeting()} disabled={savingMeeting}>Remove</button>
                      </>
                    ) : null}
                  </div>
                </div>
                ) : null}
                {sessionOperationTab === 'materials' ? (
                <div className="session-materials-panel">
                  <div className="section-heading-row compact">
                    <div>
                      <h3>Materials</h3>
                      <span>Files shared for this session</span>
                    </div>
                    <label className="file-button">
                      {uploadingMaterial ? 'Uploading...' : 'Upload'}
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
                          <strong>{material.title || `Material ${index + 1}`}</strong>
                          <a href={material.url} target="_blank" rel="noreferrer">Open file</a>
                        </div>
                        <button type="button" className="link-button danger" onClick={() => setPendingRemoval({ type: 'material', materialIndex: index })} disabled={updatingSession}>
                          Remove
                        </button>
                      </article>
                    ))}
                    {!selectedSession.materials?.length ? (
                      <EmptyState
                        title="No materials uploaded yet"
                        detail="Upload files when learners need session-specific material."
                      />
                    ) : null}
                  </div>
                </div>
                ) : null}
                {detailLoading ? <LoadingState label="Loading detail" /> : (
                  <>
                    {sessionOperationTab === 'overview' ? (
                      <>
                    <div className="stat-grid compact session-stat-grid">
                      <section className="stat-tile">
                        <span>Students</span>
                        <strong>{students.length}</strong>
                      </section>
                      <section className="stat-tile">
                        <span>Marked</span>
                        <strong>{attendance.length}</strong>
                      </section>
                      <section className="stat-tile">
                        <span>Homework</span>
                        <strong>{homework.length}</strong>
                      </section>
                      <section className="stat-tile">
                        <span>Published</span>
                        <strong>{homework.filter((item) => item.isPublished).length}</strong>
                      </section>
                    </div>
                      </>
                    ) : null}
                    {sessionOperationTab === 'insights' && insights ? (
                      <div className="session-insights-panel">
                        <div className="section-heading-row compact">
                          <div>
                            <h3>Insights</h3>
                            <span>Follow-up and session health</span>
                          </div>
                        </div>
                        <div className="insight-metrics">
                          <span>Queue <strong>{insights.summary?.teacherQueue ?? 0}</strong></span>
                          <span>Follow-ups <strong>{insights.summary?.followUpStudents ?? 0}</strong></span>
                          <span>Positive <strong>{insights.summary?.positiveStudents ?? 0}</strong></span>
                        </div>
                        <div className="insight-columns">
                          <div>
                            <strong>Needs attention</strong>
                            {(insights.attentionStudents ?? []).slice(0, 4).map((student) => (
                              <article key={student.studentId} className={`insight-row ${student.severity ?? 'low'}`}>
                                <span>{student.fullName}</span>
                                <small>{student.reasons?.[0]?.label ?? 'Review student progress'}</small>
                              </article>
                            ))}
                            {!insights.attentionStudents?.length ? <span className="muted-text">No urgent follow-up.</span> : null}
                          </div>
                          <div>
                            <strong>Positive signals</strong>
                            {(insights.positiveStudents ?? []).slice(0, 4).map((student) => (
                              <article key={student.studentId} className="insight-row positive">
                                <span>{student.fullName}</span>
                                <small>{student.signals?.[0] ?? `Attendance streak ${student.streak ?? 0}`}</small>
                              </article>
                            ))}
                            {!insights.positiveStudents?.length ? <span className="muted-text">No positive signals yet.</span> : null}
                          </div>
                        </div>
                      </div>
                    ) : null}
                    {sessionOperationTab === 'insights' && !insights ? <EmptyState title="No insights yet" detail="Insights appear after attendance, homework, and activity data are available." /> : null}
                    {sessionOperationTab === 'overview' ? (
                    <div className="stack-list">
                      {homework.slice(0, 4).map((item) => (
                        <article key={item.id} className="stack-list-item">
                          <div>
                            <strong>{item.title}</strong>
                            <span>{item.isPublished ? 'Published' : 'Draft'}{item.deadline || item.dueAt ? ` · ${formatDate(item.deadline ?? item.dueAt)}` : ''}</span>
                          </div>
                          <strong>{item.queue?.needsReview ?? 0}</strong>
                        </article>
                      ))}
                      {!homework.length ? (
                        <EmptyState
                          title="No homework for this session"
                          detail="Session homework appears here after it is created for this class."
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
      {editGroupOpen && selectedGroup ? (
        <FormModal labelledBy="edit-group-title" onClose={() => setEditGroupOpen(false)} onSubmit={submitGroupUpdate}>
          <div className="modal-header-block">
            <span>{selectedCourse?.title ?? 'Selected course'}</span>
            <h2 id="edit-group-title">Edit group</h2>
            <p>Update the saved group defaults used for scheduling and generation.</p>
          </div>
          <section className="form-section">
            <h3>Group details</h3>
            <div className="two-col">
              <label>
                Name
                <input value={editGroupForm.name} onChange={(event) => setEditGroupForm((current) => ({ ...current, name: event.target.value }))} autoFocus />
              </label>
              <label>
                Code
                <input value={editGroupForm.code} onChange={(event) => setEditGroupForm((current) => ({ ...current, code: event.target.value }))} placeholder="Auto if empty" />
              </label>
            </div>
            <div className="two-col">
              <label>
                Status
                <select value={editGroupForm.status} onChange={(event) => setEditGroupForm((current) => ({ ...current, status: event.target.value as GroupStatus }))}>
                  <option value="planned">Planned</option>
                  <option value="open">Open</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </label>
              <label>
                Seat limit
                <input type="number" min="1" value={editGroupForm.seatLimit} onChange={(event) => setEditGroupForm((current) => ({ ...current, seatLimit: event.target.value }))} placeholder="No limit" />
              </label>
            </div>
            <div className="two-col">
              <label>
                Start date
                <input type="date" value={editGroupForm.startDate} onChange={(event) => setEditGroupForm((current) => ({ ...current, startDate: event.target.value }))} />
              </label>
              <label>
                End date
                <input type="date" value={editGroupForm.endDate} onChange={(event) => setEditGroupForm((current) => ({ ...current, endDate: event.target.value }))} />
              </label>
            </div>
            <div className="two-col">
              <label>
                Timezone
                <input value={editGroupForm.timezone} onChange={(event) => setEditGroupForm((current) => ({ ...current, timezone: event.target.value }))} placeholder="Asia/Bishkek" />
              </label>
              {canAssignInstructor ? (
                <label>
                  Group instructor
                  <select value={editGroupForm.instructorId} onChange={(event) => setEditGroupForm((current) => ({ ...current, instructorId: event.target.value }))}>
                    <option value="">Use course instructor</option>
                    {instructorOptions.map((member) => (
                      <option key={member.userId} value={member.userId}>
                        {member.fullName || member.user?.fullName || member.email || member.user?.email || `Instructor #${member.userId}`}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
            <label>
              Location
              <input value={editGroupForm.location} onChange={(event) => setEditGroupForm((current) => ({ ...current, location: event.target.value }))} placeholder="Room, branch, or city" />
            </label>
            <div className="two-col">
              <label>
                Meeting provider
                <input value={editGroupForm.meetingProvider} onChange={(event) => setEditGroupForm((current) => ({ ...current, meetingProvider: event.target.value }))} placeholder="Zoom, Google Meet, branch room" />
              </label>
              <label>
                Meeting URL
                <input value={editGroupForm.meetingUrl} onChange={(event) => setEditGroupForm((current) => ({ ...current, meetingUrl: event.target.value }))} placeholder="https://..." />
              </label>
            </div>
          </section>
          <section className="form-section">
            <h3>Recurring schedule</h3>
            <div className="schedule-block-list">
              {editGroupForm.scheduleBlocks.map((block, index) => (
                <div className="three-col" key={`${index}-${block.day}`}>
                  <label>
                    Schedule day
                    <select value={block.day} onChange={(event) => setEditGroupForm((current) => ({
                      ...current,
                      scheduleBlocks: current.scheduleBlocks.map((item, itemIndex) => itemIndex === index ? { ...item, day: event.target.value as ScheduleDay } : item),
                    }))}>
                      <option value="mon">Monday</option>
                      <option value="tue">Tuesday</option>
                      <option value="wed">Wednesday</option>
                      <option value="thu">Thursday</option>
                      <option value="fri">Friday</option>
                      <option value="sat">Saturday</option>
                      <option value="sun">Sunday</option>
                    </select>
                  </label>
                  <label>
                    Starts
                    <input type="time" value={block.startTime} onChange={(event) => setEditGroupForm((current) => ({
                      ...current,
                      scheduleBlocks: current.scheduleBlocks.map((item, itemIndex) => itemIndex === index ? { ...item, startTime: event.target.value } : item),
                    }))} />
                  </label>
                  <label>
                    Ends
                    <input type="time" value={block.endTime} onChange={(event) => setEditGroupForm((current) => ({
                      ...current,
                      scheduleBlocks: current.scheduleBlocks.map((item, itemIndex) => itemIndex === index ? { ...item, endTime: event.target.value } : item),
                    }))} />
                  </label>
                  {editGroupForm.scheduleBlocks.length > 1 ? (
                    <button type="button" className="secondary-button" onClick={() => setEditGroupForm((current) => ({
                      ...current,
                      scheduleBlocks: current.scheduleBlocks.filter((_, itemIndex) => itemIndex !== index),
                    }))}>Remove block</button>
                  ) : null}
                </div>
              ))}
              <button type="button" className="secondary-button" onClick={() => setEditGroupForm((current) => ({
                ...current,
                scheduleBlocks: [...current.scheduleBlocks, emptyScheduleBlock()],
              }))}>Add schedule block</button>
            </div>
            <label>
              Schedule note
              <input value={editGroupForm.scheduleNote} onChange={(event) => setEditGroupForm((current) => ({ ...current, scheduleNote: event.target.value }))} placeholder="Optional recurring schedule note" />
            </label>
          </section>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={() => setEditGroupOpen(false)} disabled={updatingGroup}>Cancel</button>
            <button type="submit" disabled={updatingGroup}>{updatingGroup ? 'Saving...' : 'Save group'}</button>
          </div>
        </FormModal>
      ) : null}
      {editSessionOpen && selectedSession ? (
        <FormModal labelledBy="edit-session-title" onClose={() => setEditSessionOpen(false)} onSubmit={submitSessionUpdate}>
          <div className="modal-header-block">
            <span>{selectedGroup?.name ?? 'Selected group'}</span>
            <h2 id="edit-session-title">Edit session</h2>
            <p>Update schedule, status, notes, and recording details for this session.</p>
          </div>
          <label>
            Title
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
              Starts
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
              Ends
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
            Status
            <select value={editSessionForm.status} onChange={(event) => setEditSessionForm((current) => ({ ...current, status: event.target.value as 'scheduled' | 'completed' | 'cancelled' }))}>
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <label>
            Recording URL
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
            Notes
            <textarea value={editSessionForm.notes} onChange={(event) => setEditSessionForm((current) => ({ ...current, notes: event.target.value }))} />
          </label>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={() => setEditSessionOpen(false)} disabled={updatingSession}>Cancel</button>
            <button type="submit" disabled={updatingSession}>{updatingSession ? 'Saving...' : 'Save session'}</button>
          </div>
        </FormModal>
      ) : null}
      {pendingRemoval ? (
        <Modal labelledBy="confirm-removal-title" onClose={() => setPendingRemoval(null)}>
          <div className="modal-header-block">
            <span>Confirm removal</span>
            <h2 id="confirm-removal-title">Remove {pendingRemoval.type}</h2>
            <p>This changes the selected group or session immediately.</p>
          </div>
          <p className="muted-text">Remove <strong>{pendingRemovalTitle}</strong>?</p>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={() => setPendingRemoval(null)} disabled={pendingRemovalBusy}>Cancel</button>
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
              {pendingRemovalBusy ? 'Removing...' : 'Remove'}
            </button>
          </div>
        </Modal>
      ) : null}
      {createModal === 'group' ? (
        <FormModal labelledBy="create-group-title" onClose={() => setCreateModal(null)} onSubmit={submitGroup}>
            <div className="modal-header-block">
              <span>{selectedCourse?.title ?? 'Course required'}</span>
              <h2 id="create-group-title">Create group</h2>
              <p>Groups organize learners inside the selected tenant course.</p>
            </div>
            <div className="two-col">
              <label>
                Name
                <input
                  value={groupForm.name}
                  onChange={(event) => {
                    setGroupForm((current) => ({ ...current, name: event.target.value }));
                    setCreateErrors((current) => ({ ...current, groupName: '' }));
                  }}
                  className={createErrors.groupName ? 'input-error' : ''}
                  aria-invalid={!!createErrors.groupName}
                  placeholder="Spring A1 group"
                  autoFocus
                />
                {createErrors.groupName ? <span className="field-error">{createErrors.groupName}</span> : null}
              </label>
              <label>
                Code
                <input value={groupForm.code} onChange={(event) => setGroupForm((current) => ({ ...current, code: event.target.value }))} placeholder="Auto if empty" />
              </label>
            </div>
            <div className="two-col">
              <label>
                Status
                <select value={groupForm.status} onChange={(event) => setGroupForm((current) => ({ ...current, status: event.target.value as 'planned' | 'open' | 'active' | 'completed' | 'cancelled' }))}>
                  <option value="planned">Planned</option>
                  <option value="open">Open</option>
                  <option value="active">Active</option>
                </select>
              </label>
              <label>
                Seat limit
                <input type="number" min="1" value={groupForm.seatLimit} onChange={(event) => setGroupForm((current) => ({ ...current, seatLimit: event.target.value }))} placeholder="No limit" />
              </label>
            </div>
            <div className="two-col">
              <label>
                Start date
                <input type="date" value={groupForm.startDate} onChange={(event) => setGroupForm((current) => ({ ...current, startDate: event.target.value }))} />
              </label>
              <label>
                End date
                <input type="date" value={groupForm.endDate} onChange={(event) => setGroupForm((current) => ({ ...current, endDate: event.target.value }))} />
              </label>
            </div>
            <div className="two-col">
              <label>
                Timezone
                <input value={groupForm.timezone} onChange={(event) => setGroupForm((current) => ({ ...current, timezone: event.target.value }))} placeholder="Asia/Bishkek" />
              </label>
              {canAssignInstructor ? (
                <label>
                  Group instructor
                  <select value={groupForm.instructorId} onChange={(event) => setGroupForm((current) => ({ ...current, instructorId: event.target.value }))}>
                    <option value="">Use course instructor</option>
                    {instructorOptions.map((member) => (
                      <option key={member.userId} value={member.userId}>
                        {member.fullName || member.user?.fullName || member.email || member.user?.email || `Instructor #${member.userId}`}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
            <label>
              Location
              <input value={groupForm.location} onChange={(event) => setGroupForm((current) => ({ ...current, location: event.target.value }))} placeholder="Room, branch, or city" />
            </label>
            <div className="two-col">
              <label>
                Meeting provider
                <input value={groupForm.meetingProvider} onChange={(event) => setGroupForm((current) => ({ ...current, meetingProvider: event.target.value }))} placeholder="Zoom, Google Meet, branch room" />
              </label>
              <label>
                Meeting URL
                <input value={groupForm.meetingUrl} onChange={(event) => setGroupForm((current) => ({ ...current, meetingUrl: event.target.value }))} placeholder="https://..." />
              </label>
            </div>
            <div className="schedule-block-list">
              {groupForm.scheduleBlocks.map((block, index) => (
                <div className="three-col" key={`${index}-${block.day}`}>
                  <label>
                    Schedule day
                    <select value={block.day} onChange={(event) => setGroupForm((current) => ({
                      ...current,
                      scheduleBlocks: current.scheduleBlocks.map((item, itemIndex) => itemIndex === index ? { ...item, day: event.target.value as ScheduleDay } : item),
                    }))}>
                      <option value="mon">Monday</option>
                      <option value="tue">Tuesday</option>
                      <option value="wed">Wednesday</option>
                      <option value="thu">Thursday</option>
                      <option value="fri">Friday</option>
                      <option value="sat">Saturday</option>
                      <option value="sun">Sunday</option>
                    </select>
                  </label>
                  <label>
                    Starts
                    <input type="time" value={block.startTime} onChange={(event) => setGroupForm((current) => ({
                      ...current,
                      scheduleBlocks: current.scheduleBlocks.map((item, itemIndex) => itemIndex === index ? { ...item, startTime: event.target.value } : item),
                    }))} />
                  </label>
                  <label>
                    Ends
                    <input type="time" value={block.endTime} onChange={(event) => setGroupForm((current) => ({
                      ...current,
                      scheduleBlocks: current.scheduleBlocks.map((item, itemIndex) => itemIndex === index ? { ...item, endTime: event.target.value } : item),
                    }))} />
                  </label>
                  {groupForm.scheduleBlocks.length > 1 ? (
                    <button type="button" className="secondary-button" onClick={() => setGroupForm((current) => ({
                      ...current,
                      scheduleBlocks: current.scheduleBlocks.filter((_, itemIndex) => itemIndex !== index),
                    }))}>Remove block</button>
                  ) : null}
                </div>
              ))}
              <button type="button" className="secondary-button" onClick={() => setGroupForm((current) => ({
                ...current,
                scheduleBlocks: [...current.scheduleBlocks, emptyScheduleBlock()],
              }))}>Add schedule block</button>
            </div>
            <label>
              Schedule note
              <input value={groupForm.scheduleNote} onChange={(event) => setGroupForm((current) => ({ ...current, scheduleNote: event.target.value }))} placeholder="Optional recurring schedule note" />
            </label>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setCreateModal(null)} disabled={savingGroup}>Cancel</button>
              <button type="submit" disabled={!courseId || savingGroup}>{savingGroup ? 'Creating...' : 'Create group'}</button>
            </div>
        </FormModal>
      ) : null}
      {createModal === 'session' ? (
        <FormModal labelledBy="schedule-session-title" onClose={() => setCreateModal(null)} onSubmit={submitSession}>
            <div className="modal-header-block">
              <span>{selectedGroup?.name ?? 'Group required'}</span>
              <h2 id="schedule-session-title">Schedule session</h2>
              <p>Sessions hold live meeting links, materials, attendance, activities, and homework.</p>
            </div>
            <label>
              Title
              <input
                value={sessionForm.title}
                onChange={(event) => {
                  setSessionForm((current) => ({ ...current, title: event.target.value }));
                  setCreateErrors((current) => ({ ...current, sessionTitle: '' }));
                }}
                className={createErrors.sessionTitle ? 'input-error' : ''}
                aria-invalid={!!createErrors.sessionTitle}
                placeholder={`Session ${nextSessionIndex}`}
                autoFocus
              />
              {createErrors.sessionTitle ? <span className="field-error">{createErrors.sessionTitle}</span> : null}
            </label>
            <div className="two-col">
              <label>
                Starts
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
                Ends
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
              Notes
              <input value={sessionForm.notes} onChange={(event) => setSessionForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Optional internal note" />
            </label>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setCreateModal(null)} disabled={savingSession}>Cancel</button>
              <button type="submit" disabled={!groupId || savingSession}>{savingSession ? 'Scheduling...' : 'Schedule session'}</button>
            </div>
        </FormModal>
      ) : null}
      {createModal === 'enrollment' ? (
        <FormModal
          labelledBy="enroll-student-title"
          onClose={() => setCreateModal(null)}
          onSubmit={enrollmentMode === 'existing' ? submitEnrollment : (event) => {
            event.preventDefault();
            void submitInviteAndEnroll();
          }}
        >
            <div className="modal-header-block">
              <span>{selectedGroup?.name ?? 'Group required'}</span>
              <h2 id="enroll-student-title">Enroll student</h2>
              <p>Add an existing learner account or create a tenant student and enroll them.</p>
            </div>
            <div className="enrollment-tabs" role="tablist" aria-label="Enrollment mode">
              <button type="button" className={enrollmentMode === 'existing' ? 'active' : ''} onClick={() => setEnrollmentMode('existing')}>
                Existing student
              </button>
              <button type="button" className={enrollmentMode === 'new' ? 'active' : ''} onClick={() => setEnrollmentMode('new')}>
                New student
              </button>
            </div>
            {enrollmentMode === 'existing' ? (
              <>
                <div className="student-search-row">
                  <label>
                    Search student
                    <input value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} placeholder="Name or email" autoFocus />
                  </label>
                  <button type="button" className="secondary-button" onClick={() => void searchStudents()} disabled={enrolling}>
                    Search
                  </button>
                </div>
                <label>
                  Student
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
                    <option value="">Select student</option>
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
                    Full name
                    <input
                      value={studentInviteForm.fullName}
                      onChange={(event) => setStudentInviteForm((current) => ({ ...current, fullName: event.target.value }))}
                      placeholder="Full name"
                      autoFocus
                    />
                  </label>
                  <label>
                    Email
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
                  Send setup email
                </label>
              </>
            )}
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setCreateModal(null)} disabled={enrolling}>Cancel</button>
              <button type="submit" disabled={!courseId || !groupId || (enrollmentMode === 'existing' && !selectedStudentId) || enrolling}>
                {enrolling ? 'Working...' : enrollmentMode === 'existing' ? 'Enroll student' : 'Create and enroll'}
              </button>
            </div>
        </FormModal>
      ) : null}
      {createModal === 'activity' ? (
        <FormModal labelledBy="add-activity-title" onClose={() => setCreateModal(null)} onSubmit={submitActivity}>
            <div className="modal-header-block">
              <span>{selectedSession?.title ?? 'Session required'}</span>
              <h2 id="add-activity-title">Add activity</h2>
              <p>Create a discussion, exercise, group work item, or quiz for the selected session.</p>
            </div>
            <div className="two-col">
              <label>
                Title
                <input
                  value={activityForm.title}
                  onChange={(event) => {
                    setActivityForm((current) => ({ ...current, title: event.target.value }));
                    setCreateErrors((current) => ({ ...current, activityTitle: '' }));
                  }}
                  className={createErrors.activityTitle ? 'input-error' : ''}
                  aria-invalid={!!createErrors.activityTitle}
                  placeholder="Warm-up discussion"
                  autoFocus
                />
                {createErrors.activityTitle ? <span className="field-error">{createErrors.activityTitle}</span> : null}
              </label>
              <label>
                Type
                <select value={activityForm.type} onChange={(event) => setActivityForm((current) => ({ ...current, type: event.target.value as SessionActivityType }))}>
                  <option value="discussion">Discussion</option>
                  <option value="exercise">Exercise</option>
                  <option value="group_work">Group work</option>
                  <option value="quiz">Quiz</option>
                </select>
              </label>
            </div>
            <div className="two-col">
              <label>
                Status
                <select value={activityForm.status} onChange={(event) => setActivityForm((current) => ({ ...current, status: event.target.value as SessionActivityStatus }))}>
                  <option value="planned">Planned</option>
                  <option value="active">Active</option>
                  <option value="done">Done</option>
                </select>
              </label>
              <label>
                Description
                <input value={activityForm.description} onChange={(event) => setActivityForm((current) => ({ ...current, description: event.target.value }))} placeholder="Optional instruction" />
              </label>
            </div>
            {activityForm.type === 'quiz' ? (
              <div className="quiz-builder">
                <label>
                  Question
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
                    Option A
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
                    Option B
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
                  Correct answer
                  <select value={activityForm.quizCorrectOption} onChange={(event) => setActivityForm((current) => ({ ...current, quizCorrectOption: event.target.value as 'a' | 'b' }))}>
                    <option value="a">Option A</option>
                    <option value="b">Option B</option>
                  </select>
                </label>
              </div>
            ) : null}
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setCreateModal(null)} disabled={savingActivity}>Cancel</button>
              <button type="submit" disabled={savingActivity}>{savingActivity ? 'Saving...' : 'Add activity'}</button>
            </div>
        </FormModal>
      ) : null}
    </>
  );
}
