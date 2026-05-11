import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState, LoadingState } from '../../components/DataState';
import { FormModal } from '../../components/Modal';
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
  listCourseGroups,
  listGroupSessions,
  listGroupStudents,
  listSessionHomework,
  listTenantCourses,
  previewGeneratedSessions,
  searchUsers,
  reviewSessionActivitySubmission,
  updateCourseGroup,
  updateGroupSession,
  updateLiveMeeting,
  updateSessionActivity,
  uploadSessionMaterial,
} from '../../services/api';
import type { AttendanceRecord, Course, CourseGroup, CourseSession, GroupStudent, LiveMeeting, SessionActivity, SessionActivityResponseSet, SessionActivityStatus, SessionActivityType, SessionGenerationPreview, SessionHomework, SessionInsights, UserSummary } from '../../types/domain';
import { formatDate } from '../../lib/format';
import { useTenant } from '../tenant/TenantProvider';

const emptyGroupForm = {
  name: '',
  code: '',
  status: 'active' as const,
  startDate: '',
  endDate: '',
  location: '',
  meetingProvider: '',
  meetingUrl: '',
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
  status: 'active' as 'planned' | 'open' | 'active' | 'completed' | 'cancelled',
  startDate: '',
  endDate: '',
  location: '',
  meetingProvider: '',
  meetingUrl: '',
  scheduleNote: '',
  scheduleDay: 'mon' as 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun',
  scheduleStartTime: '',
  scheduleEndTime: '',
};

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

const sessionOperationTabs: Array<{ key: SessionOperationTab; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'activities', label: 'Activities' },
  { key: 'meeting', label: 'Live meeting' },
  { key: 'materials', label: 'Materials' },
  { key: 'insights', label: 'Insights' },
];

export function SessionsPage() {
  const { activeTenant } = useTenant();
  const activeTenantId = activeTenant?.id;
  const [courses, setCourses] = useState<Course[]>([]);
  const [groups, setGroups] = useState<CourseGroup[]>([]);
  const [sessions, setSessions] = useState<CourseSession[]>([]);
  const [students, setStudents] = useState<GroupStudent[]>([]);
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
  const [createModal, setCreateModal] = useState<'group' | 'session' | 'enrollment' | 'activity' | null>(null);
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [sessionEditErrors, setSessionEditErrors] = useState<Record<string, string>>({});
  const [meetingErrors, setMeetingErrors] = useState<Record<string, string>>({});
  const [materialError, setMaterialError] = useState('');
  const [sessionOperationTab, setSessionOperationTab] = useState<SessionOperationTab>('overview');

  const selectedCourse = useMemo(() => courses.find((course) => course.id === courseId), [courseId, courses]);
  const selectedGroup = useMemo(() => groups.find((group) => group.id === groupId), [groupId, groups]);
  const selectedSession = useMemo(() => sessions.find((session) => session.id === sessionId), [sessionId, sessions]);
  const nextSessionIndex = useMemo(
    () => Math.max(0, ...sessions.map((session) => session.sessionIndex ?? 0)) + 1,
    [sessions],
  );
  const sessionActivities = selectedSession?.activities ?? [];
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
        if (!cancelled) setCourses(nextCourses);
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
    setAttendance([]);
    setHomework([]);
    setGroupId(undefined);
    setSessionId(undefined);
    if (!courseId) return;
    let cancelled = false;
    setLoading(true);
    listCourseGroups(courseId)
      .then((nextGroups) => {
        if (!cancelled) setGroups(nextGroups);
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

    setEditGroupForm({
      name: selectedGroup.name ?? '',
      code: selectedGroup.code ?? '',
      status: selectedGroup.status === 'planned'
        || selectedGroup.status === 'open'
        || selectedGroup.status === 'completed'
        || selectedGroup.status === 'cancelled'
        ? selectedGroup.status
        : 'active',
      startDate: selectedGroup.startDate ? selectedGroup.startDate.slice(0, 10) : '',
      endDate: selectedGroup.endDate ? selectedGroup.endDate.slice(0, 10) : '',
      location: selectedGroup.location ?? '',
      meetingProvider: selectedGroup.meetingProvider ?? '',
      meetingUrl: selectedGroup.meetingUrl ?? '',
      scheduleNote: selectedGroup.scheduleNote ?? '',
      scheduleDay: (selectedGroup.scheduleBlocks?.[0]?.day as 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun') ?? 'mon',
      scheduleStartTime: selectedGroup.scheduleBlocks?.[0]?.startTime ?? '',
      scheduleEndTime: selectedGroup.scheduleBlocks?.[0]?.endTime ?? '',
    });
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
        location: groupForm.location.trim() || undefined,
        meetingProvider: groupForm.meetingProvider.trim() || undefined,
        meetingUrl: groupForm.meetingUrl.trim() || undefined,
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
        location: editGroupForm.location.trim() || undefined,
        meetingProvider: editGroupForm.meetingProvider.trim() || undefined,
        meetingUrl: editGroupForm.meetingUrl.trim() || undefined,
        scheduleNote: editGroupForm.scheduleNote.trim() || undefined,
        scheduleBlocks: editGroupForm.scheduleStartTime && editGroupForm.scheduleEndTime
          ? [{
              day: editGroupForm.scheduleDay,
              startTime: editGroupForm.scheduleStartTime,
              endTime: editGroupForm.scheduleEndTime,
            }]
          : null,
      });
      await reloadGroups(courseId);
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
    if (!generationRange.fromDate || !generationRange.toDate) {
      toast.error('Select generation dates');
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
          {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
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
      <section className="workflow-section">
        <div className="section-heading-row">
          <div>
            <h2>Set up learning operations</h2>
            <span>Create the container first, then schedule sessions and enroll learners.</span>
          </div>
          <div className="page-actions">
            <button type="button" className="secondary-button" onClick={() => setCreateModal('group')} disabled={!courseId || savingGroup}>
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
            <strong>{selectedCourse ? 'Group ready to create' : 'Choose a course first'}</strong>
            <span>Groups organize learners and unlock scheduling.</span>
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
        <form className="settings-panel group-edit-panel workflow-section" onSubmit={submitGroupUpdate}>
          <div className="section-heading-row">
            <div>
              <h2>Group schedule and defaults</h2>
              <span>{selectedCourse?.title ?? 'Selected course'}</span>
            </div>
            <button type="submit" disabled={updatingGroup}>{updatingGroup ? 'Saving...' : 'Save group'}</button>
          </div>
          <div className="two-col">
            <label>
              Name
              <input value={editGroupForm.name} onChange={(event) => setEditGroupForm((current) => ({ ...current, name: event.target.value }))} />
            </label>
            <label>
              Code
              <input value={editGroupForm.code} onChange={(event) => setEditGroupForm((current) => ({ ...current, code: event.target.value }))} />
            </label>
          </div>
          <div className="two-col">
            <label>
              Status
              <select value={editGroupForm.status} onChange={(event) => setEditGroupForm((current) => ({ ...current, status: event.target.value as 'planned' | 'open' | 'active' | 'completed' | 'cancelled' }))}>
                <option value="planned">Planned</option>
                <option value="open">Open</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>
            <label>
              Location
              <input value={editGroupForm.location} onChange={(event) => setEditGroupForm((current) => ({ ...current, location: event.target.value }))} />
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
              Meeting provider
              <input value={editGroupForm.meetingProvider} onChange={(event) => setEditGroupForm((current) => ({ ...current, meetingProvider: event.target.value }))} />
            </label>
            <label>
              Meeting URL
              <input value={editGroupForm.meetingUrl} onChange={(event) => setEditGroupForm((current) => ({ ...current, meetingUrl: event.target.value }))} />
            </label>
          </div>
          <div className="three-col">
            <label>
              Schedule day
              <select value={editGroupForm.scheduleDay} onChange={(event) => setEditGroupForm((current) => ({ ...current, scheduleDay: event.target.value as 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun' }))}>
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
              <input type="time" value={editGroupForm.scheduleStartTime} onChange={(event) => setEditGroupForm((current) => ({ ...current, scheduleStartTime: event.target.value }))} />
            </label>
            <label>
              Ends
              <input type="time" value={editGroupForm.scheduleEndTime} onChange={(event) => setEditGroupForm((current) => ({ ...current, scheduleEndTime: event.target.value }))} />
            </label>
          </div>
          <label>
            Schedule note
            <textarea value={editGroupForm.scheduleNote} onChange={(event) => setEditGroupForm((current) => ({ ...current, scheduleNote: event.target.value }))} />
          </label>
          <div className="session-generation-panel">
            <div className="section-heading-row compact">
              <div>
                <h3>Generate sessions</h3>
                <span>Uses the saved group schedule above</span>
              </div>
            </div>
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
                <button type="button" className="secondary-button" onClick={() => void previewSessionGeneration()} disabled={generationLoading || updatingGroup}>
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
                      <strong>{item.kind}</strong>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </form>
      ) : null}

      {!loading && !sessions.length ? (
        <EmptyState
          title="No sessions selected"
          detail="Choose or create a course group, then schedule sessions for learners."
          action={(
            <>
              <button type="button" className="secondary-button" onClick={() => setCreateModal('group')} disabled={!courseId || savingGroup}>Create group</button>
              <button type="button" onClick={() => setCreateModal('session')} disabled={!groupId || savingSession}>Schedule session</button>
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
                      className={`interactive-row ${session.id === sessionId ? 'selected-row' : ''}`}
                      role="button"
                      tabIndex={0}
                      aria-pressed={session.id === sessionId}
                      onClick={() => setSessionId(session.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setSessionId(session.id);
                        }
                      }}
                    >
                      <td>{session.title}</td>
                      <td>{formatDate(session.startsAt)}</td>
                      <td>{session.status || 'scheduled'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {selectedSession && sessionOperationTab === 'activities' ? (
              <div className="session-activities-panel">
                <div className="section-heading-row">
                  <div>
                    <h2>Activities</h2>
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
                        <span>{activity.type.replace('_', ' ')} · {activity.status}</span>
                      </div>
                      <div className="activity-actions">
                        {activity.status !== 'active' ? (
                          <button type="button" className="secondary-button" onClick={() => void setActivityStatus(activity, 'active')} disabled={savingActivity}>Start</button>
                        ) : null}
                        {activity.status !== 'done' ? (
                          <button type="button" className="secondary-button" onClick={() => void setActivityStatus(activity, 'done')} disabled={savingActivity}>Done</button>
                        ) : null}
                        <button type="button" className="secondary-button" onClick={() => void loadActivityResponses(activity.id)} disabled={loadingResponses && selectedActivityId === activity.id}>Responses</button>
                        <button type="button" className="link-button danger" onClick={() => void removeActivity(activity.id)} disabled={savingActivity}>Remove</button>
                      </div>
                    </article>
                  ))}
                  {!sessionActivities.length ? <span className="muted-text">No activities planned yet.</span> : null}
                </div>
                {activityResponses ? (
                  <div className="activity-responses-panel">
                    <div className="section-heading-row compact">
                      <div>
                        <h3>Responses</h3>
                        <span>{activityResponses.activity.title} · {activityResponses.mode}</span>
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
                                <span>{item.status ?? 'submitted'}{item.updatedAt ? ` · ${formatDate(item.updatedAt)}` : ''}</span>
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
                      {!activityResponses.items.length ? <span className="muted-text">No responses yet.</span> : null}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>

          <aside className="settings-panel">
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
                  <div className="session-tab-empty">
                    <strong>Activities open beside the schedule</strong>
                    <span>Use the left panel to add activities and review responses for this session.</span>
                  </div>
                ) : null}
                {sessionOperationTab === 'overview' ? (
                  <>
                <div className="definition-grid">
                  <span>Course</span><strong>{selectedCourse?.title ?? '-'}</strong>
                  <span>Group</span><strong>{selectedGroup?.name ?? '-'}</strong>
                  <span>Starts</span><strong>{formatDate(selectedSession.startsAt)}</strong>
                  <span>Ends</span><strong>{formatDate(selectedSession.endsAt)}</strong>
                  <span>Status</span><strong>{selectedSession.status || 'scheduled'}</strong>
                </div>
                <form className="session-edit-form" onSubmit={submitSessionUpdate}>
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
                  <button type="submit" disabled={updatingSession}>{updatingSession ? 'Updating...' : 'Update session'}</button>
                </form>
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
                        <button type="button" className="link-button danger" onClick={() => void removeMaterial(index)} disabled={updatingSession}>
                          Remove
                        </button>
                      </article>
                    ))}
                    {!selectedSession.materials?.length ? <span className="muted-text">No materials uploaded yet.</span> : null}
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
                      {!homework.length ? <span className="muted-text">No homework for this session yet.</span> : null}
                    </div>
                    ) : null}
                  </>
                )}
              </>
            )}
          </aside>
        </div>
      )}
      {createModal === 'group' ? (
        <FormModal labelledBy="create-group-title" onClose={() => setCreateModal(null)} onSubmit={submitGroup}>
            <div>
              <span className="status-badge published">{selectedCourse?.title ?? 'Course required'}</span>
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
                Start date
                <input type="date" value={groupForm.startDate} onChange={(event) => setGroupForm((current) => ({ ...current, startDate: event.target.value }))} />
              </label>
              <label>
                End date
                <input type="date" value={groupForm.endDate} onChange={(event) => setGroupForm((current) => ({ ...current, endDate: event.target.value }))} />
              </label>
            </div>
            <label>
              Location
              <input value={groupForm.location} onChange={(event) => setGroupForm((current) => ({ ...current, location: event.target.value }))} placeholder="Room, branch, or city" />
            </label>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setCreateModal(null)} disabled={savingGroup}>Cancel</button>
              <button type="submit" disabled={!courseId || savingGroup}>{savingGroup ? 'Creating...' : 'Create group'}</button>
            </div>
        </FormModal>
      ) : null}
      {createModal === 'session' ? (
        <FormModal labelledBy="schedule-session-title" onClose={() => setCreateModal(null)} onSubmit={submitSession}>
            <div>
              <span className="status-badge published">{selectedGroup?.name ?? 'Group required'}</span>
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
        <FormModal labelledBy="enroll-student-title" onClose={() => setCreateModal(null)} onSubmit={submitEnrollment}>
            <div>
              <span className="status-badge published">{selectedGroup?.name ?? 'Group required'}</span>
              <h2 id="enroll-student-title">Enroll student</h2>
              <p>Add an existing learner account to this group.</p>
            </div>
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
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setCreateModal(null)} disabled={enrolling}>Cancel</button>
              <button type="submit" disabled={!courseId || !groupId || !selectedStudentId || enrolling}>
                {enrolling ? 'Working...' : 'Enroll student'}
              </button>
            </div>
        </FormModal>
      ) : null}
      {createModal === 'activity' ? (
        <FormModal labelledBy="add-activity-title" onClose={() => setCreateModal(null)} onSubmit={submitActivity}>
            <div>
              <span className="status-badge published">{selectedSession?.title ?? 'Session required'}</span>
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
