import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState, LoadingState } from '../../components/DataState';
import { FormModal, Modal } from '../../components/Modal';
import { WorkspaceTabs } from '../../components/WorkspaceTabs';
import {
  createSessionActivity,
  createCourseGroup,
  createIndividualCourseGroup,
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
  removeUserFromGroup,
  resolveTenantMemberCandidate,
  reviewSessionActivitySubmission,
  updateCourseGroup,
  updateGroupSession,
  updateLiveMeeting,
  updateSessionActivity,
  uploadSessionMaterial,
} from '../../services/api';
import type { AttendanceRecord, CompanyMember, Course, CourseGroup, CourseSession, GroupStudent, LiveMeeting, SessionActivity, SessionActivityResponseSet, SessionActivityStatus, SessionActivityType, SessionGenerationPreview, SessionHomework, SessionInsights, UserSummary } from '../../types/domain';
import { formatDate } from '../../lib/format';
import { activityTypeLabelKeys, commonStatusLabelKeys, enumLabel } from '../../lib/enumLabels';
import { getApiErrorMessage } from '../../lib/apiErrors';
import { useTenant } from '../tenant/TenantProvider';
import { useAuth } from '../auth/AuthProvider';
import { isTenantFeatureEnabled } from '../tenant/tenantFeatures';
import {
  canCoordinateTenantLearning,
  canEnrollTenantStudents,
  canManageAssignedActivities,
  canManageAssignedAttendance,
  canManageAssignedHomework,
  canManageAssignedLiveMeetings,
  canManageAssignedMaterials,
  canManageTenantCourses,
  canTeachAssignedSessions,
  isTenantAdmin,
} from '../tenant/tenantRoles';
import { isCourseWorkflowReady, nextWorkflowSearchParams, workflowPath } from '../workflows/workflowContext';
import {
  emptyGroupForm,
  emptyScheduleBlock,
  groupToForm,
  positiveNumber,
  scheduleBlocksPayload,
  validateGroupForm as validateSharedGroupForm,
  type GroupForm,
  type GroupStatus,
  type GroupValidationErrors,
  type ScheduleDay,
} from '../groups/groupForm';

const emptySessionForm = {
  title: '',
  startsAt: '',
  endsAt: '',
  notes: '',
};

const scheduleDayIndex: Record<ScheduleDay, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

const dateInputValue = (date: Date) => {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
};

const dateTimeLocalValue = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : dateInputValue(date);
};

const dateOnly = (value?: string | null) => {
  if (!value) return undefined;
  return value.slice(0, 10);
};

const combineDateTime = (dateValue: string, timeValue: string) => {
  const candidate = new Date(`${dateValue}T${timeValue}`);
  return Number.isNaN(candidate.getTime()) ? undefined : candidate;
};

const emptyStudentInviteForm = {
  fullName: '',
  email: '',
  sendEmail: false,
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

type QuizQuestionForm = {
  prompt: string;
  options: string[];
  correctOptionIndex: number;
};

const emptyQuizQuestion = (): QuizQuestionForm => ({
  prompt: '',
  options: ['', ''],
  correctOptionIndex: 0,
});

const emptyActivityForm = {
  title: '',
  description: '',
  type: 'discussion' as SessionActivityType,
  status: 'planned' as SessionActivityStatus,
  quizQuestions: [emptyQuizQuestion()],
};

const supportedMeetingProviders = new Set(['zoom', 'google_meet', 'custom']);

const meetingProviderValue = (value?: string | null): 'zoom' | 'google_meet' | 'custom' | undefined => {
  return supportedMeetingProviders.has(String(value)) ? value as 'zoom' | 'google_meet' | 'custom' : undefined;
};

function upsertSessionList(items: CourseSession[], nextSession: CourseSession) {
  return [nextSession, ...items.filter((session) => session.id !== nextSession.id)]
    .sort((first, second) => {
      const firstIndex = first.sessionIndex ?? Number.MAX_SAFE_INTEGER;
      const secondIndex = second.sessionIndex ?? Number.MAX_SAFE_INTEGER;
      if (firstIndex !== secondIndex) return firstIndex - secondIndex;
      return String(first.startsAt ?? '').localeCompare(String(second.startsAt ?? ''));
    });
}

const quizOptionLetter = (index: number) => String.fromCharCode(65 + index);

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
  const [groupForm, setGroupForm] = useState<GroupForm>(() => emptyGroupForm());
  const [editGroupForm, setEditGroupForm] = useState<GroupForm>(() => emptyGroupForm());
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
  const [sessionImpactConfirmed, setSessionImpactConfirmed] = useState(false);
  const [enrollmentMode, setEnrollmentMode] = useState<'existing' | 'new'>('existing');
  const [pendingRemoval, setPendingRemoval] = useState<PendingRemoval | null>(null);
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [editGroupErrors, setEditGroupErrors] = useState<GroupValidationErrors>({});
  const [sessionEditErrors, setSessionEditErrors] = useState<Record<string, string>>({});
  const [meetingErrors, setMeetingErrors] = useState<Record<string, string>>({});
  const [materialError, setMaterialError] = useState('');
  const [sessionOperationTab, setSessionOperationTab] = useState<SessionOperationTab>('overview');
  const [preferredSessionId, setPreferredSessionId] = useState<number | undefined>();
  const savingGroupRef = useRef(false);
  const savingSessionRef = useRef(false);
  const createModalRef = useRef(createModal);
  const submittedSessionKeyRef = useRef<string | null>(null);
  const locallyCreatedSessionIdsRef = useRef<Set<number>>(new Set());
  const loadedCourseScopeRef = useRef<string | null>(null);
  const loadedAssignedSessionsScopeRef = useRef<string | null>(null);
  const loadedMembersScopeRef = useRef<string | null>(null);
  const loadedGroupsScopeRef = useRef<string | null>(null);
  const loadedGroupSessionsScopeRef = useRef<string | null>(null);
  const loadedSessionDetailScopeRef = useRef<string | null>(null);
  const loadingCourseScopeRef = useRef<string | null>(null);
  const loadingAssignedSessionsScopeRef = useRef<string | null>(null);
  const loadingMembersScopeRef = useRef<string | null>(null);
  const loadingGroupsScopeRef = useRef<string | null>(null);
  const loadingGroupSessionsScopeRef = useRef<string | null>(null);
  const loadingSessionDetailScopeRef = useRef<string | null>(null);
  const courseLoadRequestRef = useRef(0);
  const assignedSessionsLoadRequestRef = useRef(0);
  const membersLoadRequestRef = useRef(0);
  const groupsLoadRequestRef = useRef(0);
  const groupSessionsLoadRequestRef = useRef(0);
  const sessionDetailLoadRequestRef = useRef(0);
  const tRef = useRef(t);
  const assignedGroupsByCourseIdRef = useRef<Record<number, CourseGroup[]>>({});

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  useEffect(() => {
    createModalRef.current = createModal;
    if (createModal !== 'session') submittedSessionKeyRef.current = null;
  }, [createModal]);

  const selectedCourse = useMemo(() => courses.find((course) => course.id === courseId), [courseId, courses]);
  const selectedCourseReady = isCourseWorkflowReady(selectedCourse);
  const selectedCourseLiveOnline = selectedCourse?.courseType === 'online_live';
  const selectedCourseOffline = selectedCourse?.courseType === 'offline';
  const selectedCourseBlocker = (() => {
    if (!selectedCourse) return t('courses.blockerChooseCourse');
    if (!['offline', 'online_live'].includes(String(selectedCourse.courseType ?? ''))) return t('courses.blockerDeliveryType');
    if (selectedCourse.status !== 'approved') return t('courses.blockerApproval');
    if (selectedCourse.isPublished !== true) return t('courses.blockerPublish');
    return '';
  })();
  const selectedGroup = useMemo(() => groups.find((group) => group.id === groupId), [groupId, groups]);
  const selectedSession = useMemo(() => sessions.find((session) => session.id === sessionId), [sessionId, sessions]);
  const preferredSessionAvailable = Boolean(
    preferredSessionId
    && sessions.some((session) => session.id === preferredSessionId),
  );
  const requestedSessionPending = Boolean(
    requestedSessionId
    && preferredSessionId !== requestedSessionId
    && !sessions.some((session) => session.id === requestedSessionId),
  );
  const selectedSessionScope = {
    courseId: selectedSession?.courseId ?? courseId,
    groupId: selectedSession?.groupId ?? groupId,
    sessionId: selectedSession?.id,
  };
  const canAssignInstructor = isTenantAdmin(user, activeTenant);
  const canCoordinateGroups = canCoordinateTenantLearning(user, activeTenant);
  const canManageEnrollment = canEnrollTenantStudents(user, activeTenant);
  const canUseAssignedSessionPicker = canTeachAssignedSessions(user, activeTenant);
  const canScheduleSessions = canCoordinateGroups || canTeachAssignedSessions(user, activeTenant);
  const isAssignedInstructorView = canUseAssignedSessionPicker && !canCoordinateGroups;
  const canManageSessionActivities = canCoordinateGroups || canManageAssignedActivities(user, activeTenant);
  const canManageSessionMaterials = canCoordinateGroups || canManageAssignedMaterials(user, activeTenant);
  const canManageSessionMeetings = canCoordinateGroups || canManageAssignedLiveMeetings(user, activeTenant);
  const attendanceEnabled = isTenantFeatureEnabled(activeTenant, 'attendance.enabled');
  const homeworkEnabled = isTenantFeatureEnabled(activeTenant, 'homework.enabled');
  const canUseAttendanceWorkflow = attendanceEnabled && (canManageAssignedAttendance(user, activeTenant) || canManageTenantCourses(user, activeTenant));
  const canUseHomeworkWorkflow = homeworkEnabled && (canManageAssignedHomework(user, activeTenant) || canManageTenantCourses(user, activeTenant));
  const instructorOptions = useMemo(
    () => tenantMembers.filter((member) => String(member.role).toLowerCase() === 'instructor'),
    [tenantMembers],
  );
  const tenantStudentOptions = useMemo(
    () => tenantMembers
      .filter((member) => String(member.role).toLowerCase() === 'student')
      .map((member) => ({
        id: member.userId,
        email: member.email ?? '',
        fullName: member.fullName,
        role: member.role,
      })),
    [tenantMembers],
  );
  const sessionPlaceholder = useCallback((index: number) => t('sessions.sessionPlaceholder', { index }), [t]);
  const nextSessionIndex = useMemo(
    () => Math.max(0, ...sessions.map((session) => session.sessionIndex ?? 0)) + 1,
    [sessions],
  );
  const defaultSessionForm = useMemo(() => {
    const title = sessionPlaceholder(nextSessionIndex);
    const completeBlocks = selectedGroup?.scheduleBlocks
      ?.filter((block) => block.day && block.startTime && block.endTime)
      .sort((left, right) => scheduleDayIndex[left.day as ScheduleDay] - scheduleDayIndex[right.day as ScheduleDay]) ?? [];
    const groupStart = dateOnly(selectedGroup?.startDate);
    const groupEnd = dateOnly(selectedGroup?.endDate);
    const latestSessionEnd = sessions
      .map((session) => new Date(session.endsAt || session.startsAt || ''))
      .filter((date) => !Number.isNaN(date.getTime()))
      .sort((left, right) => right.getTime() - left.getTime())[0];
    const anchor = latestSessionEnd && groupStart
      ? new Date(Math.max(latestSessionEnd.getTime() + 60000, new Date(`${groupStart}T00:00`).getTime()))
      : groupStart
        ? new Date(`${groupStart}T00:00`)
        : latestSessionEnd
          ? new Date(latestSessionEnd.getTime() + 60000)
          : new Date();
    anchor.setHours(0, 0, 0, 0);

    for (let offset = 0; offset < 370; offset += 1) {
      const candidateDate = new Date(anchor);
      candidateDate.setDate(anchor.getDate() + offset);
      const candidateDay = candidateDate.getDay();
      const dateValue = dateInputValue(candidateDate).slice(0, 10);
      if (groupStart && dateValue < groupStart) continue;
      if (groupEnd && dateValue > groupEnd) break;
      const block = completeBlocks.find((item) => scheduleDayIndex[item.day as ScheduleDay] === candidateDay);
      if (!block) continue;
      const startsAt = combineDateTime(dateValue, block.startTime);
      const endsAt = combineDateTime(dateValue, block.endTime);
      if (!startsAt || !endsAt || endsAt <= startsAt) continue;
      if (latestSessionEnd && endsAt <= latestSessionEnd) continue;
      return {
        title,
        startsAt: dateInputValue(startsAt),
        endsAt: dateInputValue(endsAt),
        notes: '',
      };
    }

    return { ...emptySessionForm, title };
  }, [nextSessionIndex, selectedGroup, sessionPlaceholder, sessions]);
  const sessionActivities = selectedSession?.activities ?? [];
  const savedScheduleReady = Boolean(selectedGroup?.scheduleBlocks?.some((block) => block.day && block.startTime && block.endTime));
  const generationDatesReady = Boolean(generationRange.fromDate && generationRange.toDate);
  const generationReady = canCoordinateGroups && savedScheduleReady && generationDatesReady;
  const statusLabel = (value: string | undefined | null) => {
    return enumLabel(value || 'scheduled', commonStatusLabelKeys, t);
  };
  const deliveryModeLabel = (value?: CourseGroup['deliveryMode'] | CourseSession['groupDeliveryMode'] | string | null) => (
    value === 'individual' ? t('groups.deliveryIndividual') : t('groups.deliveryGroup')
  );
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
  const translatedSessionTabs = useMemo(
    () => sessionOperationTabs
      .filter((tab) => {
        if (tab.key === 'activities') return canManageSessionActivities || Boolean(selectedSession?.activities?.length);
        if (tab.key === 'meeting') return canManageSessionMeetings || Boolean(selectedSession?.liveJoinUrl || liveMeeting?.joinUrl);
        if (tab.key === 'materials') return canManageSessionMaterials || Boolean(selectedSession?.materials?.length);
        return true;
      })
      .map((tab) => ({ ...tab, label: t(tab.label) })),
    [canManageSessionActivities, canManageSessionMaterials, canManageSessionMeetings, liveMeeting?.joinUrl, selectedSession, t],
  );
  const currentMeetingProvider = meetingProviderValue(liveMeeting?.provider) ?? meetingProviderValue(selectedSession?.liveProvider) ?? meetingForm.provider;
  const sessionWorkflowLink = (path: string, session: CourseSession) => workflowPath(path, {
    courseId: session.courseId,
    groupId: session.groupId ?? groupId,
    sessionId: session.id,
  });
  const sessionToolsSummary = (session: CourseSession) => {
    const parts = [
      session.liveJoinUrl || session.liveHostUrl ? t('sessions.meetingReady') : t('sessions.meetingMissing'),
      t('sessions.materialCount', { count: session.materials?.length ?? 0 }),
      t('sessions.activityCount', { count: session.activities?.length ?? 0 }),
    ];
    return parts.join(' · ');
  };
  const selectedAttendanceLink = workflowPath('/attendance', selectedSessionScope);
  const selectedHomeworkLink = workflowPath('/homework', selectedSessionScope);
  const sessionDetailScopeKey = useCallback((nextSessionId?: number) => (
    nextSessionId
      ? `${nextSessionId}:${canUseAttendanceWorkflow ? 'attendance' : 'no-attendance'}:${canUseHomeworkWorkflow ? 'homework' : 'no-homework'}`
      : null
  ), [canUseAttendanceWorkflow, canUseHomeworkWorkflow]);
  const planModeTarget = translatedSessionTabs.some((tab) => tab.key === 'meeting')
    ? 'meeting'
    : translatedSessionTabs.some((tab) => tab.key === 'materials')
      ? 'materials'
      : 'overview';
  const runModeTarget = translatedSessionTabs.some((tab) => tab.key === 'activities') ? 'activities' : 'overview';
  const planModeDetail = planModeTarget === 'meeting'
    ? t('sessions.modePlanDetail')
    : planModeTarget === 'materials'
      ? t('sessions.modePlanMaterialsDetail')
      : t('sessions.modePlanOverviewDetail');
  const reviewWorkflowLink = canUseHomeworkWorkflow ? selectedHomeworkLink : selectedAttendanceLink;
  const reviewModeDetail = canUseHomeworkWorkflow
    ? t('sessions.modeReviewDetail')
    : canUseAttendanceWorkflow
      ? t('sessions.modeReviewAttendanceDetail')
      : t('sessions.modeReviewInsightsDetail');
  const runModeDetail = canUseAttendanceWorkflow ? t('sessions.modeRunDetail') : t('sessions.modeRunActivitiesDetail');
  const hasSessionDeliveryRecords = Boolean(attendance.length || homework.length);
  const sessionEditChangesDeliveryFields = Boolean(
    selectedSession
    && (
      editSessionForm.startsAt !== dateTimeLocalValue(selectedSession.startsAt)
      || editSessionForm.endsAt !== dateTimeLocalValue(selectedSession.endsAt)
      || editSessionForm.status !== (selectedSession.status === 'completed' || selectedSession.status === 'cancelled' ? selectedSession.status : 'scheduled')
    ),
  );
  const sessionEditNeedsImpactConfirmation = hasSessionDeliveryRecords && sessionEditChangesDeliveryFields;
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
  const instructorHasNoAssignedGroups = Boolean(isAssignedInstructorView && !loading && !groups.length);
  const canShowScheduleAction = canScheduleSessions && !instructorHasNoAssignedGroups;
  const emptySessionsTitle = instructorHasNoAssignedGroups
    ? t('sessions.noAssignedGroupsTitle')
    : selectedGroup ? t('sessions.emptyScheduledTitle') : t('sessions.emptySelectedTitle');
  const emptySessionsDetail = instructorHasNoAssignedGroups
    ? t('sessions.noAssignedGroupsDetail')
    : selectedGroup ? t('sessions.emptyScheduledDetail') : t('sessions.emptySelectedDetail');
  const openAssignedSession = (session: CourseSession) => {
    const next = new URLSearchParams(searchParamsString);
    next.set('courseId', String(session.courseId));
    if (session.groupId) next.set('groupId', String(session.groupId));
    next.set('sessionId', String(session.id));
    setSearchParams(next);
  };

  useEffect(() => {
    const scopeKey = activeTenantId ? `${activeTenantId}:${isAssignedInstructorView ? 'assigned' : 'full'}` : null;
    if (loadedCourseScopeRef.current === scopeKey) return;
    if (loadingCourseScopeRef.current === scopeKey) return;
    loadedAssignedSessionsScopeRef.current = null;
    loadedMembersScopeRef.current = null;
    loadedGroupsScopeRef.current = null;
    loadedGroupSessionsScopeRef.current = null;
    loadedSessionDetailScopeRef.current = null;
    loadingAssignedSessionsScopeRef.current = null;
    loadingMembersScopeRef.current = null;
    loadingGroupsScopeRef.current = null;
    loadingGroupSessionsScopeRef.current = null;
    loadingSessionDetailScopeRef.current = null;
    setCourses([]);
    setGroups([]);
    setSessions([]);
    setAssignedSessions([]);
    assignedGroupsByCourseIdRef.current = {};
    setStudents([]);
    setTenantMembers([]);
    setAttendance([]);
    setHomework([]);
    setInsights(null);
    setLiveMeeting(null);
    setCourseId(undefined);
    setGroupId(undefined);
    setSessionId(undefined);
    if (!activeTenantId) {
      courseLoadRequestRef.current += 1;
      loadedCourseScopeRef.current = scopeKey;
      loadingCourseScopeRef.current = null;
      return;
    }
    const requestId = courseLoadRequestRef.current + 1;
    courseLoadRequestRef.current = requestId;
    loadingCourseScopeRef.current = scopeKey;
    setLoading(true);
    listTenantCourses(activeTenantId)
      .then(async (nextCourses) => {
        if (courseLoadRequestRef.current !== requestId) return;
        if (!isAssignedInstructorView) {
          assignedGroupsByCourseIdRef.current = {};
          setCourses(nextCourses);
          return;
        }

        const readyCourses = nextCourses.filter((course) => isCourseWorkflowReady(course));
        const assignedCoursePairs = await Promise.all(readyCourses.map(async (course) => {
          try {
            const nextGroups = await listCourseGroups(course.id);
            return { course, groups: nextGroups };
          } catch {
            return { course, groups: [] };
          }
        }));
        if (courseLoadRequestRef.current !== requestId) return;
        const nextAssignedGroupsByCourseId = Object.fromEntries(
          assignedCoursePairs.map((item) => [item.course.id, item.groups]),
        );
        assignedGroupsByCourseIdRef.current = nextAssignedGroupsByCourseId;
        setCourses(assignedCoursePairs
          .filter((item) => item.groups.length > 0)
          .map((item) => item.course));
      })
      .catch(() => {
        if (courseLoadRequestRef.current === requestId) toast.error(tRef.current('courses.loadFailed'));
      })
      .finally(() => {
        if (courseLoadRequestRef.current === requestId) {
          loadedCourseScopeRef.current = scopeKey;
          loadingCourseScopeRef.current = null;
          setLoading(false);
        }
      });
  }, [activeTenantId, isAssignedInstructorView]);

  useEffect(() => {
    const scopeKey = activeTenantId && canUseAssignedSessionPicker ? `${activeTenantId}:assigned-sessions` : null;
    if (loadedAssignedSessionsScopeRef.current === scopeKey) return;
    if (loadingAssignedSessionsScopeRef.current === scopeKey) return;
    setAssignedSessions([]);
    if (!activeTenantId || !canUseAssignedSessionPicker) {
      assignedSessionsLoadRequestRef.current += 1;
      loadedAssignedSessionsScopeRef.current = scopeKey;
      loadingAssignedSessionsScopeRef.current = null;
      return;
    }
    const requestId = assignedSessionsLoadRequestRef.current + 1;
    assignedSessionsLoadRequestRef.current = requestId;
    loadingAssignedSessionsScopeRef.current = scopeKey;
    listGroupSessions()
      .then((nextSessions) => {
        if (assignedSessionsLoadRequestRef.current === requestId) {
          setAssignedSessions(nextSessions);
          loadedAssignedSessionsScopeRef.current = scopeKey;
          loadingAssignedSessionsScopeRef.current = null;
        }
      })
      .catch(() => {
        if (assignedSessionsLoadRequestRef.current === requestId) {
          setAssignedSessions([]);
          loadedAssignedSessionsScopeRef.current = scopeKey;
          loadingAssignedSessionsScopeRef.current = null;
        }
      });
  }, [activeTenantId, canUseAssignedSessionPicker]);

  useEffect(() => {
    setCourseId((current) => {
      if (!courses.length) return undefined;
      if (requestedCourseId && courses.some((course) => course.id === requestedCourseId)) return requestedCourseId;
      return current && courses.some((course) => course.id === current) ? current : courses[0]?.id;
    });
  }, [courses, requestedCourseId]);

  useEffect(() => {
    const scopeKey = activeTenantId && (canAssignInstructor || canManageEnrollment)
      ? `${activeTenantId}:${canAssignInstructor ? 'assign' : 'view'}:${canManageEnrollment ? 'enroll' : 'no-enroll'}`
      : null;
    if (loadedMembersScopeRef.current === scopeKey) return;
    if (loadingMembersScopeRef.current === scopeKey) return;
    setTenantMembers([]);
    if (!activeTenantId || (!canAssignInstructor && !canManageEnrollment)) {
      membersLoadRequestRef.current += 1;
      loadedMembersScopeRef.current = scopeKey;
      loadingMembersScopeRef.current = null;
      return;
    }
    const requestId = membersLoadRequestRef.current + 1;
    membersLoadRequestRef.current = requestId;
    loadingMembersScopeRef.current = scopeKey;
    listTenantMembers(activeTenantId)
      .then((members) => {
        if (membersLoadRequestRef.current === requestId) {
          setTenantMembers(members);
          loadedMembersScopeRef.current = scopeKey;
          loadingMembersScopeRef.current = null;
        }
      })
      .catch(() => {
        if (membersLoadRequestRef.current === requestId && canAssignInstructor) toast.error(tRef.current('sessions.instructorsLoadFailed'));
        if (membersLoadRequestRef.current === requestId) {
          loadedMembersScopeRef.current = scopeKey;
          loadingMembersScopeRef.current = null;
        }
      });
  }, [activeTenantId, canAssignInstructor, canManageEnrollment]);

  useEffect(() => {
    const scopeKey = courseId ? `${courseId}:${isAssignedInstructorView ? 'assigned' : 'full'}` : null;
    if (loadedGroupsScopeRef.current === scopeKey) return;
    if (loadingGroupsScopeRef.current === scopeKey) return;
    loadedGroupSessionsScopeRef.current = null;
    loadedSessionDetailScopeRef.current = null;
    loadingGroupSessionsScopeRef.current = null;
    loadingSessionDetailScopeRef.current = null;
    setGroups([]);
    setSessions([]);
    setStudents([]);
    setAttendance([]);
    setHomework([]);
    setGroupId(undefined);
    setSessionId(undefined);
    if (!courseId) {
      groupsLoadRequestRef.current += 1;
      loadedGroupsScopeRef.current = scopeKey;
      loadingGroupsScopeRef.current = null;
      return;
    }
    if (isAssignedInstructorView && Object.prototype.hasOwnProperty.call(assignedGroupsByCourseIdRef.current, courseId)) {
      setGroups(assignedGroupsByCourseIdRef.current[courseId] ?? []);
      loadedGroupsScopeRef.current = scopeKey;
      return;
    }
    const requestId = groupsLoadRequestRef.current + 1;
    groupsLoadRequestRef.current = requestId;
    loadingGroupsScopeRef.current = scopeKey;
    setLoading(true);
    listCourseGroups(courseId)
      .then((nextGroups) => {
        if (groupsLoadRequestRef.current !== requestId) return;
        setGroups(nextGroups);
      })
      .catch(() => {
        if (groupsLoadRequestRef.current === requestId) toast.error(tRef.current('groups.courseGroupsLoadFailed'));
      })
      .finally(() => {
        if (groupsLoadRequestRef.current === requestId) {
          loadedGroupsScopeRef.current = scopeKey;
          loadingGroupsScopeRef.current = null;
          setLoading(false);
        }
      });
  }, [courseId, isAssignedInstructorView]);

  useEffect(() => {
    setGroupId((current) => {
      if (!groups.length) return undefined;
      if (requestedGroupId && groups.some((group) => group.id === requestedGroupId)) return requestedGroupId;
      return current && groups.some((group) => group.id === current) ? current : groups[0]?.id;
    });
  }, [groups, requestedGroupId]);

  useEffect(() => {
    const scopeKey = groupId ? `${groupId}` : null;
    if (loadedGroupSessionsScopeRef.current === scopeKey) return;
    if (loadingGroupSessionsScopeRef.current === scopeKey) return;
    loadedSessionDetailScopeRef.current = null;
    loadingSessionDetailScopeRef.current = null;
    setSessions([]);
    setStudents([]);
    setAttendance([]);
    setHomework([]);
    setSessionId(undefined);
    if (!groupId) {
      groupSessionsLoadRequestRef.current += 1;
      loadedGroupSessionsScopeRef.current = scopeKey;
      loadingGroupSessionsScopeRef.current = null;
      return;
    }
    const requestId = groupSessionsLoadRequestRef.current + 1;
    groupSessionsLoadRequestRef.current = requestId;
    loadingGroupSessionsScopeRef.current = scopeKey;
    setLoading(true);
    Promise.all([listGroupSessions(groupId), listGroupStudents(groupId)])
      .then(([nextSessions, nextStudents]) => {
        if (groupSessionsLoadRequestRef.current !== requestId) return;
        setSessions(nextSessions);
        setStudents(nextStudents);
      })
      .catch(() => {
        if (groupSessionsLoadRequestRef.current === requestId) toast.error(tRef.current('sessions.groupSessionsLoadFailed'));
      })
      .finally(() => {
        if (groupSessionsLoadRequestRef.current === requestId) {
          loadedGroupSessionsScopeRef.current = scopeKey;
          loadingGroupSessionsScopeRef.current = null;
          setLoading(false);
        }
      });
  }, [groupId]);

  useEffect(() => {
    setSessionId((current) => {
      if (!sessions.length) return undefined;
      if (preferredSessionId) {
        return sessions.some((session) => session.id === preferredSessionId) ? preferredSessionId : current;
      }
      if (requestedSessionId) {
        return sessions.some((session) => session.id === requestedSessionId) ? requestedSessionId : undefined;
      }
      return current && sessions.some((session) => session.id === current) ? current : sessions[0]?.id;
    });
  }, [preferredSessionId, requestedSessionId, sessions]);

  useEffect(() => {
    const nextSessionId = preferredSessionAvailable
      ? preferredSessionId
      : sessionId ?? (requestedSessionPending ? requestedSessionId : undefined);
    const next = nextWorkflowSearchParams(searchParamsString, { courseId, groupId, sessionId: nextSessionId });
    if (next.toString() !== searchParamsString) setSearchParams(next, { replace: true });
  }, [courseId, groupId, preferredSessionAvailable, preferredSessionId, requestedSessionId, requestedSessionPending, sessionId, searchParamsString, setSearchParams]);

  useEffect(() => {
    if (preferredSessionId && requestedSessionId === preferredSessionId && sessionId === preferredSessionId) {
      setPreferredSessionId(undefined);
    }
  }, [preferredSessionId, requestedSessionId, sessionId]);

  useEffect(() => {
    if (!translatedSessionTabs.some((tab) => tab.key === sessionOperationTab)) {
      setSessionOperationTab('overview');
    }
  }, [sessionOperationTab, translatedSessionTabs]);

  useEffect(() => {
    const scopeKey = sessionDetailScopeKey(sessionId);
    if (loadedSessionDetailScopeRef.current === scopeKey) return;
    if (loadingSessionDetailScopeRef.current === scopeKey) return;
    if (preferredSessionId && sessionId !== preferredSessionId) {
      sessionDetailLoadRequestRef.current += 1;
      return;
    }
    setAttendance([]);
    setHomework([]);
    setInsights(null);
    setLiveMeeting(null);
    setSelectedActivityId(undefined);
    setActivityResponses(null);
    setReviewDrafts({});
    setSessionOperationTab('overview');
    if (!sessionId) {
      sessionDetailLoadRequestRef.current += 1;
      loadedSessionDetailScopeRef.current = scopeKey;
      loadingSessionDetailScopeRef.current = null;
      return;
    }
    if (!selectedSession) {
      sessionDetailLoadRequestRef.current += 1;
      return;
    }
    if (locallyCreatedSessionIdsRef.current.has(sessionId)) {
      locallyCreatedSessionIdsRef.current.delete(sessionId);
      loadedSessionDetailScopeRef.current = scopeKey;
      setDetailLoading(false);
      return;
    }
    const requestId = sessionDetailLoadRequestRef.current + 1;
    sessionDetailLoadRequestRef.current = requestId;
    loadingSessionDetailScopeRef.current = scopeKey;
    setDetailLoading(true);
    Promise.allSettled([
      canUseAttendanceWorkflow ? getSessionAttendance(sessionId) : Promise.resolve([] as AttendanceRecord[]),
      canUseHomeworkWorkflow ? listSessionHomework(sessionId) : Promise.resolve([] as SessionHomework[]),
      getSessionInsights(sessionId),
      getLiveMeeting(sessionId),
    ])
      .then(([attendanceResult, homeworkResult, insightsResult, meetingResult]) => {
        if (sessionDetailLoadRequestRef.current !== requestId) return;
        setAttendance(attendanceResult.status === 'fulfilled' ? attendanceResult.value : []);
        setHomework(homeworkResult.status === 'fulfilled' ? homeworkResult.value : []);
        setInsights(insightsResult.status === 'fulfilled' ? insightsResult.value : null);
        setLiveMeeting(meetingResult.status === 'fulfilled' ? meetingResult.value : null);
        if (attendanceResult.status === 'rejected' || homeworkResult.status === 'rejected' || insightsResult.status === 'rejected') {
          toast.error(tRef.current('sessions.detailPartialLoadFailed'));
        }
      })
      .finally(() => {
        if (sessionDetailLoadRequestRef.current === requestId) {
          loadedSessionDetailScopeRef.current = scopeKey;
          loadingSessionDetailScopeRef.current = null;
          setDetailLoading(false);
        }
      });
  }, [canUseAttendanceWorkflow, canUseHomeworkWorkflow, preferredSessionId, selectedSession, sessionDetailScopeKey, sessionId]);

  useEffect(() => {
    if (!createModal) setCreateErrors({});
  }, [createModal]);

  useEffect(() => {
    if (!selectedGroup) {
      setEditGroupForm(emptyGroupForm());
      setEditGroupErrors({});
      return;
    }

    setEditGroupForm(groupToForm(selectedGroup));
    setEditGroupErrors({});
    setGenerationRange({
      fromDate: selectedGroup.startDate?.slice(0, 10) ?? '',
      toDate: selectedGroup.endDate?.slice(0, 10) ?? '',
    });
    setGenerationPreview(null);
  }, [selectedGroup]);

  useEffect(() => {
    if (!selectedSession) {
      setEditSessionForm(emptyEditSessionForm);
      setSessionImpactConfirmed(false);
      return;
    }

    setEditSessionForm({
      title: selectedSession.title ?? '',
      startsAt: dateTimeLocalValue(selectedSession.startsAt),
      endsAt: dateTimeLocalValue(selectedSession.endsAt),
      status: selectedSession.status === 'completed' || selectedSession.status === 'cancelled' ? selectedSession.status : 'scheduled',
      notes: selectedSession.notes ?? '',
      recordingUrl: selectedSession.recordingUrl ?? '',
    });
    setSessionImpactConfirmed(false);
    setMeetingForm({
      provider: meetingProviderValue(selectedSession.liveProvider) ?? 'custom',
      customJoinUrl: selectedSession.liveJoinUrl ?? '',
      topic: selectedSession.title ?? '',
      agenda: selectedSession.notes ?? '',
      durationMinutes: selectedSession.startsAt && selectedSession.endsAt
        ? String(Math.max(1, Math.round((new Date(selectedSession.endsAt).getTime() - new Date(selectedSession.startsAt).getTime()) / 60000)))
        : '60',
      hostUserId: '',
    });
  }, [selectedSession]);

  const reloadGroups = async (nextCourseId = courseId, preferredGroupId = groupId) => {
    if (!nextCourseId) return;
    const nextGroups = await listCourseGroups(nextCourseId);
    setGroups(nextGroups);
    setGroupId(preferredGroupId && nextGroups.some((group) => group.id === preferredGroupId) ? preferredGroupId : nextGroups[0]?.id);
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

  const validateGroupSetup = (form: GroupForm, mode: 'create' | 'edit') => validateSharedGroupForm(selectedCourseLiveOnline ? form : { ...form, meetingProvider: '', meetingUrl: '' }, {
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
    courseRequired: t('sessions.selectCourseBeforeGroup'),
  }, {
    mode,
    requireCourse: mode === 'create' && !courseId,
    deliveryMode: form.deliveryMode,
    enrollmentMode,
    selectedStudentId,
    newStudent: studentInviteForm,
    createFirstSession: form.createFirstSession,
  });

  const clearCreateError = (key: string) => {
    setCreateErrors((current) => ({ ...current, [key]: '' }));
  };

  const updateQuizQuestion = (questionIndex: number, updater: (question: QuizQuestionForm) => QuizQuestionForm) => {
    setActivityForm((current) => ({
      ...current,
      quizQuestions: current.quizQuestions.map((question, index) => (index === questionIndex ? updater(question) : question)),
    }));
    clearCreateError('quizQuestions');
  };

  const clearEditGroupError = (key: keyof GroupValidationErrors) => {
    setEditGroupErrors((current) => ({ ...current, [key]: undefined }));
  };

  const submitGroup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (savingGroupRef.current) return;
    if (!canCoordinateGroups) return;
    if (groupForm.deliveryMode === 'individual' && !canManageEnrollment) {
      return toast.error(t('groups.individualEnrollmentNotAllowed'));
    }
    const nextErrors = validateGroupSetup(groupForm, 'create');
    if (Object.keys(nextErrors).length) {
      setCreateErrors(nextErrors);
      toast.error(Object.values(nextErrors)[0]);
      return;
    }

    setCreateErrors({});
    const activeCourseId = courseId!;
    savingGroupRef.current = true;
    setSavingGroup(true);
    try {
      let saved: CourseGroup;
      let firstSession: CourseSession | null | undefined;
      if (groupForm.deliveryMode === 'individual') {
        let individualStudentId = selectedStudentId;
        if (enrollmentMode === 'new') {
          if (!activeTenantId) throw new Error('Missing active tenant');
          const member = await inviteTenantMember(activeTenantId, {
            fullName: studentInviteForm.fullName.trim(),
            email: studentInviteForm.email.trim(),
            role: 'student',
            sendEmail: studentInviteForm.sendEmail,
          });
          individualStudentId = member.userId;
        }
        const result = await createIndividualCourseGroup({
          courseId: activeCourseId,
          studentId: individualStudentId as number,
          name: groupForm.name.trim(),
          startDate: groupForm.startDate || undefined,
          endDate: groupForm.endDate || undefined,
          timezone: groupForm.timezone.trim() || undefined,
          ...(selectedCourseOffline ? { location: groupForm.location.trim() || undefined } : {}),
          ...(selectedCourseLiveOnline ? {
            meetingProvider: groupForm.meetingProvider.trim() || undefined,
            meetingUrl: groupForm.meetingUrl.trim() || undefined,
          } : {}),
          scheduleBlocks: scheduleBlocksPayload(groupForm.scheduleBlocks),
          instructorId: canAssignInstructor ? positiveNumber(groupForm.instructorId) : undefined,
          createFirstSession: groupForm.createFirstSession,
        });
        saved = result.group;
        firstSession = result.firstSession;
      } else {
        saved = await createCourseGroup({
          courseId: activeCourseId,
          name: groupForm.name.trim(),
          code: groupForm.code.trim() || `${activeCourseId}-${Date.now().toString(36)}`.toUpperCase(),
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
      }
      await reloadGroups(activeCourseId, saved.id);
      setGroupId(saved.id);
      if (firstSession) {
        locallyCreatedSessionIdsRef.current.add(firstSession.id);
        setSessions((current) => upsertSessionList(current, firstSession));
        setSessionId(firstSession.id);
      }
      setGroupForm(emptyGroupForm(activeTenant?.timezone ?? undefined));
      setStudentSearch('');
      setStudentResults([]);
      setSelectedStudentId(undefined);
      setStudentInviteForm(emptyStudentInviteForm);
      setEnrollmentMode('existing');
      setCreateModal(null);
      setCreateErrors({});
      toast.success(t('groups.groupCreated'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('groups.groupCreateFailed')));
    } finally {
      savingGroupRef.current = false;
      setSavingGroup(false);
    }
  };

  const submitGroupUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (savingGroupRef.current) return;
    if (!canCoordinateGroups) return;
    if (!groupId || !courseId) return;
    const nextErrors = validateGroupSetup(editGroupForm, 'edit');
    if (Object.keys(nextErrors).length) {
      setEditGroupErrors(nextErrors);
      toast.error(Object.values(nextErrors)[0]);
      return;
    }

    setEditGroupErrors({});
    savingGroupRef.current = true;
    setUpdatingGroup(true);
    try {
      await updateCourseGroup(groupId, {
        name: editGroupForm.name.trim(),
        code: editGroupForm.code.trim() || undefined,
        status: editGroupForm.status,
        startDate: editGroupForm.startDate || undefined,
        endDate: editGroupForm.endDate || undefined,
        seatLimit: positiveNumber(editGroupForm.seatLimit),
        timezone: editGroupForm.timezone.trim() || undefined,
        ...(selectedCourseOffline ? { location: editGroupForm.location.trim() || undefined } : {}),
        ...(selectedCourseLiveOnline ? {
          meetingProvider: editGroupForm.meetingProvider.trim() || undefined,
          meetingUrl: editGroupForm.meetingUrl.trim() || undefined,
        } : {}),
        scheduleNote: editGroupForm.scheduleNote.trim() || undefined,
        scheduleBlocks: scheduleBlocksPayload(editGroupForm.scheduleBlocks),
        instructorId: canAssignInstructor ? positiveNumber(editGroupForm.instructorId) : undefined,
      });
      await reloadGroups(courseId);
      setEditGroupOpen(false);
      setEditGroupErrors({});
      toast.success(t('groups.groupUpdated'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('groups.groupUpdateFailed')));
    } finally {
      savingGroupRef.current = false;
      setUpdatingGroup(false);
    }
  };

  const submitSession = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (createModalRef.current !== 'session') return;
    if (savingSessionRef.current) return;
    if (!canScheduleSessions) return;
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
    const submissionKey = JSON.stringify({
      groupId: activeGroupId,
      title: sessionForm.title.trim(),
      startsAt: sessionForm.startsAt,
      endsAt: sessionForm.endsAt,
      notes: sessionForm.notes.trim(),
    });
    if (submittedSessionKeyRef.current === submissionKey) return;
    submittedSessionKeyRef.current = submissionKey;
    savingSessionRef.current = true;
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
      setPreferredSessionId(saved.id);
      setSessions((current) => upsertSessionList(current, saved));
      locallyCreatedSessionIdsRef.current.add(saved.id);
      loadedSessionDetailScopeRef.current = sessionDetailScopeKey(saved.id);
      setAttendance([]);
      setHomework([]);
      setInsights(null);
      setLiveMeeting(null);
      setSelectedActivityId(undefined);
      setActivityResponses(null);
      setReviewDrafts({});
      setSessionOperationTab('overview');
      setSessionId(saved.id);
      setSessionForm(emptySessionForm);
      createModalRef.current = null;
      setCreateModal(null);
      setCreateErrors({});
      toast.success(t('sessions.sessionScheduled'));
    } catch (error) {
      submittedSessionKeyRef.current = null;
      toast.error(getApiErrorMessage(error, t('sessions.sessionScheduleFailed')));
    } finally {
      savingSessionRef.current = false;
      setSavingSession(false);
    }
  };

  const openScheduleSessionModal = () => {
    if (!canScheduleSessions) return;
    setSessionForm(defaultSessionForm);
    setCreateErrors({});
    submittedSessionKeyRef.current = null;
    createModalRef.current = 'session';
    setCreateModal('session');
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
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('sessions.previewFailed')));
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
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('groups.generateFailed')));
    } finally {
      setGenerationLoading(false);
    }
  };

  const searchStudents = async () => {
    if (!canManageEnrollment) return;
    setEnrolling(true);
    try {
      const normalized = studentSearch.trim().toLowerCase();
      const localResults = createModal === 'group' && groupForm.deliveryMode === 'individual'
        ? tenantStudentOptions
          .filter((student) => !normalized
            || student.fullName?.toLowerCase().includes(normalized)
            || student.email.toLowerCase().includes(normalized))
          .slice(0, 12)
        : [];
      const remoteResults = (normalized || createModal !== 'group') && activeTenantId
        ? await resolveTenantMemberCandidate(activeTenantId, normalized.includes('@')
          ? { email: studentSearch.trim() }
          : { phoneNumber: studentSearch.trim() }).then((result) => (
          result.found && result.user && result.membership?.isActiveStudent ? [result.user] : []
        )).catch((error) => {
          if (localResults.length) return [] as UserSummary[];
          throw error;
        })
        : [];
      const seen = new Set<number>();
      const results = [...localResults, ...remoteResults].filter((student) => {
        if (seen.has(student.id)) return false;
        seen.add(student.id);
        return true;
      }).slice(0, 12);
      setStudentResults(results);
      setSelectedStudentId(results[0]?.id);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('groups.studentSearchFailed')));
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
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('groups.studentEnrollFailed')));
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
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('groups.studentCreateEnrollFailed')));
    } finally {
      setEnrolling(false);
    }
  };

  const removeStudentFromGroup = async (student: GroupStudent) => {
    if (!canManageEnrollment) return;
    if (!courseId || !groupId) return;
    setRemovingStudentId(student.userId);
    try {
      await removeUserFromGroup(groupId, student.userId);
      await reloadSessions(groupId);
      toast.success(t('sessions.studentRemovedFromGroup'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('groups.studentRemoveFailed')));
    } finally {
      setRemovingStudentId(undefined);
      setPendingRemoval(null);
    }
  };

  const submitSessionUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canScheduleSessions) return;
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
    if (sessionEditNeedsImpactConfirmation && !sessionImpactConfirmed) {
      nextErrors.impactConfirmation = t('sessions.editImpactConfirmationRequired');
    }
    if (Object.keys(nextErrors).length) {
      setSessionEditErrors(nextErrors);
      toast.error(nextErrors.title ?? nextErrors.startsAt ?? nextErrors.endsAt ?? nextErrors.recordingUrl ?? nextErrors.impactConfirmation);
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
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('sessions.sessionUpdateFailed')));
    } finally {
      setUpdatingSession(false);
    }
  };

  const uploadMaterial = async (file: File | undefined) => {
    if (!canManageSessionMaterials) return;
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
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('sessions.materialUploadFailed')));
    } finally {
      setUploadingMaterial(false);
    }
  };

  const saveLiveMeeting = async () => {
    if (!canManageSessionMeetings) return;
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
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('sessions.liveMeetingSaveFailed')));
    } finally {
      setSavingMeeting(false);
    }
  };

  const removeLiveMeeting = async () => {
    if (!canManageSessionMeetings) return;
    if (!sessionId || !groupId) return;
    setSavingMeeting(true);
    try {
      await deleteLiveMeeting(sessionId, currentMeetingProvider);
      setLiveMeeting(null);
      await reloadSessions(groupId);
      toast.success(t('sessions.liveMeetingRemoved'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('sessions.liveMeetingRemoveFailed')));
    } finally {
      setSavingMeeting(false);
    }
  };

  const removeMaterial = async (materialIndex: number) => {
    if (!canManageSessionMaterials) return;
    if (!sessionId || !groupId || !selectedSession) return;
    const currentMaterials = Array.isArray(selectedSession.materials) ? selectedSession.materials : [];
    setUpdatingSession(true);
    try {
      await updateGroupSession(sessionId, {
        materials: currentMaterials.filter((_, index) => index !== materialIndex),
      });
      await reloadSessions(groupId);
      toast.success(t('sessions.materialRemoved'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('sessions.materialRemoveFailed')));
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
    if (!canManageSessionActivities) return;
    if (!sessionId || !groupId) return;
    const nextErrors: Record<string, string> = {};
    if (!activityForm.title.trim()) {
      nextErrors.activityTitle = t('sessions.activityTitleRequired');
    }
    if (activityForm.type === 'quiz') {
      activityForm.quizQuestions.forEach((question) => {
        const filledOptions = question.options
          .map((option) => option.trim())
          .filter(Boolean);
        if (!question.prompt.trim()) nextErrors.quizQuestions = t('sessions.quizQuestionRequired');
        if (filledOptions.length < 2) nextErrors.quizQuestions = t('sessions.quizOptionsRequired');
        if (!question.options[question.correctOptionIndex]?.trim()) nextErrors.quizQuestions = t('sessions.correctOptionRequired');
      });
    }
    if (Object.keys(nextErrors).length) {
      setCreateErrors(nextErrors);
      toast.error(nextErrors.activityTitle ?? nextErrors.quizQuestions);
      return;
    }

    setCreateErrors({});
    const payload = {
      title: activityForm.title.trim(),
      description: activityForm.description.trim() || null,
      type: activityForm.type,
      status: activityForm.status,
      questions: activityForm.type === 'quiz'
        ? activityForm.quizQuestions.map((question) => ({
            prompt: question.prompt.trim(),
            questionMode: 'single_choice' as const,
            options: question.options
              .map((option, index) => ({ option, index }))
              .filter(({ option }) => option.trim())
              .map(({ option, index }) => ({
                text: option.trim(),
                isCorrect: index === question.correctOptionIndex,
              })),
          }))
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
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('sessions.activitySaveFailed')));
    } finally {
      setSavingActivity(false);
    }
  };

  const setActivityStatus = async (activity: SessionActivity, status: SessionActivityStatus) => {
    if (!canManageSessionActivities) return;
    if (!sessionId || !groupId) return;
    setSavingActivity(true);
    try {
      await updateSessionActivity(sessionId, activity.id, {
        ...buildActivityPayload(activity),
        status,
      });
      await reloadSessions(groupId);
      toast.success(t('sessions.activityUpdated'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('sessions.activityUpdateFailed')));
    } finally {
      setSavingActivity(false);
    }
  };

  const removeActivity = async (activityId: number) => {
    if (!canManageSessionActivities) return;
    if (!sessionId || !groupId) return;
    setSavingActivity(true);
    try {
      await deleteSessionActivity(sessionId, activityId);
      await reloadSessions(groupId);
      toast.success(t('sessions.activityRemoved'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('sessions.activityRemoveFailed')));
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
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('sessions.responsesLoadFailed')));
    } finally {
      setLoadingResponses(false);
    }
  };

  const submitActivityReview = async (
    activityId: number,
    submissionId: number,
    status: 'approved' | 'rejected' | 'needs_revision',
  ) => {
    if (!canManageSessionActivities) return;
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
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('sessions.reviewSaveFailed')));
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
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}{isAssignedInstructorView ? ` - ${t('sessions.assignedGroup')}` : ''}
            </option>
          ))}
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
      {canUseAssignedSessionPicker && upcomingAssignedSessions.length && !courseId && !groupId && !selectedSession ? (
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
                    {' '}<span className={`status-badge delivery-${session.groupDeliveryMode ?? 'group'}`}>{deliveryModeLabel(session.groupDeliveryMode)}</span>
                    {isAssignedInstructorView ? <> <span className="status-badge assigned">{t('sessions.assignedGroup')}</span></> : null}
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
      {!selectedSession && !isAssignedInstructorView ? (
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
      ) : null}
      {loading ? <LoadingState label={t('sessions.loading')} /> : null}
      {!selectedSession && (canCoordinateGroups || canManageEnrollment || (canScheduleSessions && !isAssignedInstructorView)) ? (
      <section className="workflow-section workflow-context-panel">
        <div className="section-heading-row">
          <div>
            <h2>{t('sessions.setupTitle')}</h2>
            <span>{t('sessions.setupDetail')}</span>
          </div>
          {canCoordinateGroups || canManageEnrollment || canScheduleSessions ? (
            <div className="page-actions">
              {canCoordinateGroups ? (
                <>
                  <button type="button" className="secondary-button" onClick={() => { setGroupForm(emptyGroupForm(activeTenant?.timezone ?? undefined)); setEnrollmentMode('existing'); setStudentSearch(''); setStudentResults([]); setSelectedStudentId(undefined); setStudentInviteForm(emptyStudentInviteForm); setCreateErrors({}); setCreateModal('group'); }} disabled={!courseId || !selectedCourseReady || savingGroup} title={!selectedCourseReady ? selectedCourseBlocker : undefined}>
                    {t('groups.createGroup')}
                  </button>
                </>
              ) : null}
              {canShowScheduleAction ? (
                <button type="button" className="secondary-button" onClick={openScheduleSessionModal} disabled={!groupId || savingSession}>
                  {t('sessions.scheduleSession')}
                </button>
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

      {selectedGroup && !selectedSession && (canCoordinateGroups || canManageEnrollment) ? (
        <section className="settings-panel group-edit-panel workflow-section workflow-context-panel">
          <div className="section-heading-row">
            <div>
              <h2>{t('sessions.groupScheduleDefaults')}</h2>
              <span>{selectedCourse?.title ?? t('courses.selectedCourse')}</span>
            </div>
            {canCoordinateGroups ? <button type="button" className="secondary-button" onClick={() => { setEditGroupErrors({}); setEditGroupOpen(true); }}>{t('groups.editGroup')}</button> : null}
          </div>
          <div className="group-summary-grid">
            <section><span>{t('courses.status')}</span><strong>{statusLabel(selectedGroup.status)}</strong></section>
            <section><span>{t('groups.deliveryMode')}</span><strong>{deliveryModeLabel(selectedGroup.deliveryMode)}</strong></section>
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
                <input type="date" value={generationRange.fromDate} onChange={(event) => { setGenerationRange((current) => ({ ...current, fromDate: event.target.value })); setGenerationPreview(null); }} />
              </label>
              <label>
                {t('groups.to')}
                <input type="date" value={generationRange.toDate} onChange={(event) => { setGenerationRange((current) => ({ ...current, toDate: event.target.value })); setGenerationPreview(null); }} />
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
          title={emptySessionsTitle}
          detail={emptySessionsDetail}
          action={(
            <>
              {canCoordinateGroups || canShowScheduleAction ? (
                <>
                  {canCoordinateGroups ? (
                    <button type="button" className="secondary-button" onClick={() => { setGroupForm(emptyGroupForm(activeTenant?.timezone ?? undefined)); setEnrollmentMode('existing'); setStudentSearch(''); setStudentResults([]); setSelectedStudentId(undefined); setStudentInviteForm(emptyStudentInviteForm); setCreateErrors({}); setCreateModal('group'); }} disabled={!courseId || !selectedCourseReady || savingGroup} title={!selectedCourseReady ? selectedCourseBlocker : undefined}>{t('groups.createGroup')}</button>
                  ) : null}
                  {canShowScheduleAction ? (
                    <button type="button" className="primary-button" onClick={openScheduleSessionModal} disabled={!groupId || savingSession}>{t('sessions.scheduleSession')}</button>
                  ) : null}
                </>
              ) : null}
            </>
          )}
        />
      ) : null}
      {!!sessions.length && (
        <div className="workspace-grid session-workspace-grid">
          <section className="content-section session-schedule-panel">
            <div className="section-heading-row">
              <div>
                <h2>{t('sessions.sessionSchedule')}</h2>
                <span>{t('sessions.sessionScheduleDetail')}</span>
              </div>
              {canShowScheduleAction ? (
                <button type="button" className="secondary-button" onClick={openScheduleSessionModal} disabled={!groupId || savingSession}>
                  {t('sessions.scheduleSession')}
                </button>
              ) : null}
            </div>
            <div className="session-schedule-list">
              {sessions.map((session) => (
                <article
                  key={session.id}
                  className={`session-schedule-card ${session.id === sessionId ? 'active' : ''}`}
                >
                  <button
                    type="button"
                    className="session-schedule-card-main"
                    aria-pressed={session.id === sessionId}
                    onClick={() => setSessionId(session.id)}
                  >
                    <strong>{session.title}</strong>
                    <span>{formatDate(session.startsAt)} - {formatDate(session.endsAt)}</span>
                  </button>
                  <div className="session-schedule-card-status">
                    <span className={`status-badge ${session.status || 'scheduled'}`}>{statusLabel(session.status)}</span>
                    <span className={`status-badge delivery-${session.groupDeliveryMode ?? selectedGroup?.deliveryMode ?? 'group'}`}>{deliveryModeLabel(session.groupDeliveryMode ?? selectedGroup?.deliveryMode)}</span>
                  </div>
                  <div className="session-tools-cell">
                    <span>{sessionToolsSummary(session)}</span>
                    <div className="session-row-links">
                      {canUseAttendanceWorkflow ? (
                        <Link to={sessionWorkflowLink('/attendance', session)}>{t('navigation.attendance')}</Link>
                      ) : null}
                      {canUseHomeworkWorkflow ? (
                        <Link to={sessionWorkflowLink('/homework', session)}>{t('navigation.homework')}</Link>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <aside className="settings-panel workflow-context-panel session-detail-panel">
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
                <div className="session-mode-strip" aria-label={t('sessions.workflowModes')}>
                  <button
                    type="button"
                    className={`session-mode-button ${sessionOperationTab === planModeTarget ? 'active' : ''}`}
                    aria-pressed={sessionOperationTab === planModeTarget}
                    onClick={() => setSessionOperationTab(planModeTarget)}
                  >
                    <strong>{t('sessions.modePlan')}</strong>
                    <span>{planModeDetail}</span>
                  </button>
                  <button
                    type="button"
                    className={`session-mode-button ${sessionOperationTab === runModeTarget && sessionOperationTab !== planModeTarget ? 'active' : ''}`}
                    aria-pressed={sessionOperationTab === runModeTarget && sessionOperationTab !== planModeTarget}
                    onClick={() => setSessionOperationTab(runModeTarget)}
	                  >
	                    <strong>{t('sessions.modeRun')}</strong>
	                    <span>{runModeDetail}</span>
	                  </button>
	                  {canUseHomeworkWorkflow || canUseAttendanceWorkflow ? (
	                    <Link className="session-mode-button" to={reviewWorkflowLink}>
	                      <strong>{t('sessions.modeReview')}</strong>
	                      <span>{reviewModeDetail}</span>
	                    </Link>
	                  ) : (
	                    <button
                        type="button"
                        className={`session-mode-button ${sessionOperationTab === 'insights' ? 'active' : ''}`}
                        aria-pressed={sessionOperationTab === 'insights'}
                        onClick={() => setSessionOperationTab('insights')}
                      >
	                      <strong>{t('sessions.modeReview')}</strong>
	                      <span>{reviewModeDetail}</span>
	                    </button>
	                  )}
                </div>
                {sessionOperationTab === 'activities' ? (
                  <div className="session-activities-panel">
                    <div className="section-heading-row compact">
                      <div>
                        <h3>{t('sessions.tabActivities')}</h3>
                        <span>{selectedSession.title}</span>
                      </div>
                      {canManageSessionActivities ? (
                      <button type="button" className="secondary-button" onClick={() => setCreateModal('activity')} disabled={savingActivity}>
                        {t('sessions.addActivity')}
                      </button>
                      ) : null}
                    </div>
                    <div className="stack-list activity-list">
                      {sessionActivities.map((activity) => (
                        <article key={activity.id} className="stack-list-item activity-list-item">
                          <div>
                            <strong>{activity.title}</strong>
                            <span>{activityTypeLabel(activity.type)} · <span className={`status-badge ${activity.status}`}>{statusLabel(activity.status)}</span></span>
                          </div>
                          <div className="activity-actions">
                            {canManageSessionActivities && activity.status !== 'active' ? (
                              <button type="button" className="secondary-button" onClick={() => void setActivityStatus(activity, 'active')} disabled={savingActivity}>{t('sessions.startActivity')}</button>
                            ) : null}
                            {canManageSessionActivities && activity.status !== 'done' ? (
                              <button type="button" className="secondary-button" onClick={() => void setActivityStatus(activity, 'done')} disabled={savingActivity}>{t('sessions.statusDone')}</button>
                            ) : null}
                            <button type="button" className="secondary-button" onClick={() => void loadActivityResponses(activity.id)} disabled={loadingResponses && selectedActivityId === activity.id}>{t('sessions.responses')}</button>
                            {canManageSessionActivities ? (
                              <button type="button" className="link-button danger" onClick={() => setPendingRemoval({ type: 'activity', activityId: activity.id })} disabled={savingActivity}>{t('groups.remove')}</button>
                            ) : null}
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
                              {canManageSessionActivities && activityResponses.mode === 'submission' && item.id ? (
                                <div className="review-controls">
                                  <label>
                                    {t('sessions.score')}
                                  <input
                                    value={reviewDrafts[item.id]?.score ?? ''}
                                    onChange={(event) => setReviewDrafts((current) => ({ ...current, [item.id!]: { score: event.target.value, reviewComment: current[item.id!]?.reviewComment ?? '' } }))}
                                    placeholder={t('sessions.score')}
                                    inputMode="numeric"
                                  />
                                  </label>
                                  <label>
                                    {t('sessions.reviewComment')}
                                  <input
                                    value={reviewDrafts[item.id]?.reviewComment ?? ''}
                                    onChange={(event) => setReviewDrafts((current) => ({ ...current, [item.id!]: { score: current[item.id!]?.score ?? '', reviewComment: event.target.value } }))}
                                    placeholder={t('sessions.reviewComment')}
                                  />
                                  </label>
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
                  {canScheduleSessions ? (
                  <button type="button" className="secondary-button" onClick={() => setEditSessionOpen(true)}>
                    {t('sessions.editSession')}
                  </button>
                  ) : null}
                  {canUseAttendanceWorkflow ? (
                    <Link className="secondary-link-button" to={selectedAttendanceLink}>{t('navigation.attendance')}</Link>
                  ) : null}
                  {canUseHomeworkWorkflow ? (
                    <Link className="secondary-link-button" to={selectedHomeworkLink}>{t('navigation.homework')}</Link>
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
                      <select disabled={!canManageSessionMeetings} value={meetingForm.provider} onChange={(event) => setMeetingForm((current) => ({ ...current, provider: event.target.value as 'zoom' | 'google_meet' | 'custom' }))}>
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
                        disabled={!canManageSessionMeetings}
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
                        disabled={!canManageSessionMeetings}
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
                        disabled={!canManageSessionMeetings}
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
                    <input disabled={!canManageSessionMeetings} value={meetingForm.topic} onChange={(event) => setMeetingForm((current) => ({ ...current, topic: event.target.value }))} />
                  </label>
                  <div className="live-meeting-actions">
                    {canManageSessionMeetings ? (
                    <button type="button" onClick={() => void saveLiveMeeting()} disabled={savingMeeting}>
                      {savingMeeting ? t('courses.saving') : t('sessions.saveMeeting')}
                    </button>
                    ) : null}
                    {(liveMeeting?.joinUrl || selectedSession.liveJoinUrl) ? (
                      <>
                        <a href={liveMeeting?.joinUrl ?? selectedSession.liveJoinUrl ?? '#'} target="_blank" rel="noreferrer">{t('sessions.openMeeting')}</a>
                        {canManageSessionMeetings ? (
                          <button type="button" className="secondary-button" onClick={() => void removeLiveMeeting()} disabled={savingMeeting}>{t('groups.remove')}</button>
                        ) : null}
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
                    {canManageSessionMaterials ? (
                    <label className="file-button">
                      {uploadingMaterial ? t('sessions.uploading') : t('sessions.upload')}
                      <input
                        type="file"
                        disabled={uploadingMaterial}
                        onChange={(event) => void uploadMaterial(event.target.files?.[0])}
                      />
                    </label>
                    ) : null}
                  </div>
                  {materialError ? <span className="field-error">{materialError}</span> : null}
                  <div className="stack-list">
                    {(selectedSession.materials ?? []).map((material, index) => (
                      <article key={`${material.storageKey ?? material.url}-${index}`} className="stack-list-item material-list-item">
                        <div>
                          <strong>{material.title || materialFallback(index)}</strong>
                          <a href={material.url} target="_blank" rel="noreferrer">{t('sessions.openFile')}</a>
                        </div>
                        {canManageSessionMaterials ? (
                        <button type="button" className="link-button danger" onClick={() => setPendingRemoval({ type: 'material', materialIndex: index })} disabled={updatingSession}>
                          {t('groups.remove')}
                        </button>
                        ) : null}
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
        <FormModal labelledBy="edit-group-title" className="decision-modal form-modal group-form-modal" onClose={() => setEditGroupOpen(false)} onSubmit={submitGroupUpdate}>
          <div className="modal-header-block">
            <span>{selectedCourse?.title ?? t('courses.selectedCourse')}</span>
            <h2 id="edit-group-title">{t('groups.editGroup')}</h2>
            <p>{t('sessions.editGroupDetail')}</p>
          </div>
          <section className="form-section">
            <h3>{t('sessions.groupDetails')}</h3>
            <div className="two-col">
              <label className="required-field">
                {t('groups.name')}
                <input required value={editGroupForm.name} onChange={(event) => { setEditGroupForm((current) => ({ ...current, name: event.target.value })); clearEditGroupError('groupName'); clearEditGroupError('name'); }} className={editGroupErrors.groupName ? 'input-error' : ''} aria-invalid={!!editGroupErrors.groupName} autoFocus />
                {editGroupErrors.groupName ? <span className="field-error">{editGroupErrors.groupName}</span> : null}
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
                <input type="number" min="1" step="1" value={editGroupForm.seatLimit} onChange={(event) => { setEditGroupForm((current) => ({ ...current, seatLimit: event.target.value })); clearEditGroupError('seatLimit'); }} placeholder={t('groups.noLimit')} className={editGroupErrors.seatLimit ? 'input-error' : ''} aria-invalid={!!editGroupErrors.seatLimit} />
                {editGroupErrors.seatLimit ? <span className="field-error">{editGroupErrors.seatLimit}</span> : null}
              </label>
            </div>
            <div className="two-col">
              <label>
                {t('groups.startDate')}
                <input type="date" value={editGroupForm.startDate} onChange={(event) => { setEditGroupForm((current) => ({ ...current, startDate: event.target.value })); clearEditGroupError('dates'); }} className={editGroupErrors.dates ? 'input-error' : ''} aria-invalid={!!editGroupErrors.dates} />
              </label>
              <label>
                {t('groups.endDate')}
                <input type="date" value={editGroupForm.endDate} onChange={(event) => { setEditGroupForm((current) => ({ ...current, endDate: event.target.value })); clearEditGroupError('dates'); }} className={editGroupErrors.dates ? 'input-error' : ''} aria-invalid={!!editGroupErrors.dates} />
              </label>
            </div>
            {editGroupErrors.dates ? <span className="field-error">{editGroupErrors.dates}</span> : null}
            <div className="two-col">
              <label>
                {t('groups.timezone')}
                <input value={editGroupForm.timezone} onChange={(event) => { setEditGroupForm((current) => ({ ...current, timezone: event.target.value })); clearEditGroupError('timezone'); }} placeholder="Asia/Bishkek" className={editGroupErrors.timezone ? 'input-error' : ''} aria-invalid={!!editGroupErrors.timezone} />
                {editGroupErrors.timezone ? <span className="field-error">{editGroupErrors.timezone}</span> : null}
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
            {selectedCourseOffline ? (
              <label>
                {t('groups.location')}
                <input value={editGroupForm.location} onChange={(event) => setEditGroupForm((current) => ({ ...current, location: event.target.value }))} placeholder={t('sessions.locationPlaceholder')} />
              </label>
            ) : null}
            {selectedCourseLiveOnline ? (
              <div className="two-col">
                <label>
                  {t('groups.meetingProvider')}
                  <input value={editGroupForm.meetingProvider} onChange={(event) => setEditGroupForm((current) => ({ ...current, meetingProvider: event.target.value }))} placeholder={t('sessions.meetingProviderPlaceholder')} />
                </label>
                <label>
                  {t('groups.meetingUrl')}
                  <input value={editGroupForm.meetingUrl} onChange={(event) => { setEditGroupForm((current) => ({ ...current, meetingUrl: event.target.value })); clearEditGroupError('meetingUrl'); }} placeholder="https://..." className={editGroupErrors.meetingUrl ? 'input-error' : ''} aria-invalid={!!editGroupErrors.meetingUrl} />
                  {editGroupErrors.meetingUrl ? <span className="field-error">{editGroupErrors.meetingUrl}</span> : null}
                </label>
              </div>
            ) : null}
          </section>
          <section className="form-section">
            <h3>{t('groups.recurringSchedule')}</h3>
            <div className="schedule-block-list">
              {editGroupForm.scheduleBlocks.map((block, index) => (
                <div className="three-col" key={`${index}-${block.day}`}>
                  <label>
                    {t('groups.scheduleDay')}
                    <select value={block.day} onChange={(event) => { setEditGroupForm((current) => ({
                      ...current,
                      scheduleBlocks: current.scheduleBlocks.map((item, itemIndex) => itemIndex === index ? { ...item, day: event.target.value as ScheduleDay } : item),
                    })); clearEditGroupError('schedule'); }} className={editGroupErrors.schedule ? 'input-error' : ''} aria-invalid={!!editGroupErrors.schedule}>
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
                    <input type="time" value={block.startTime} onChange={(event) => { setEditGroupForm((current) => ({
                      ...current,
                      scheduleBlocks: current.scheduleBlocks.map((item, itemIndex) => itemIndex === index ? { ...item, startTime: event.target.value } : item),
                    })); clearEditGroupError('schedule'); }} className={editGroupErrors.schedule ? 'input-error' : ''} aria-invalid={!!editGroupErrors.schedule} />
                  </label>
                  <label>
                    {t('groups.ends')}
                    <input type="time" value={block.endTime} onChange={(event) => { setEditGroupForm((current) => ({
                      ...current,
                      scheduleBlocks: current.scheduleBlocks.map((item, itemIndex) => itemIndex === index ? { ...item, endTime: event.target.value } : item),
                    })); clearEditGroupError('schedule'); }} className={editGroupErrors.schedule ? 'input-error' : ''} aria-invalid={!!editGroupErrors.schedule} />
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
            {editGroupErrors.schedule ? <span className="field-error">{editGroupErrors.schedule}</span> : null}
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
      {editSessionOpen && selectedSession && canScheduleSessions ? (
        <FormModal labelledBy="edit-session-title" onClose={() => setEditSessionOpen(false)} onSubmit={submitSessionUpdate}>
          <div className="modal-header-block">
            <span>{selectedGroup?.name ?? t('courses.selectedGroup')}</span>
            <h2 id="edit-session-title">{t('sessions.editSession')}</h2>
            <p>{t('sessions.editSessionDetail')}</p>
          </div>
          {hasSessionDeliveryRecords ? (
            <div className="session-edit-impact-warning" role="note">
              <strong>{t('sessions.editImpactWarningTitle')}</strong>
              <span>{t('sessions.editImpactWarningDetail')}</span>
            </div>
          ) : null}
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
          {sessionEditNeedsImpactConfirmation ? (
            <label className="session-impact-confirmation">
              <input
                type="checkbox"
                checked={sessionImpactConfirmed}
                onChange={(event) => {
                  setSessionImpactConfirmed(event.target.checked);
                  setSessionEditErrors((current) => ({ ...current, impactConfirmation: '' }));
                }}
              />
              <span>{t('sessions.editImpactConfirmation')}</span>
              {sessionEditErrors.impactConfirmation ? <span className="field-error">{sessionEditErrors.impactConfirmation}</span> : null}
            </label>
          ) : null}
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
            <p>{pendingRemoval.type === 'student' ? t('sessions.studentRemovalGroupDetail') : t('sessions.removalImmediate')}</p>
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
        <FormModal labelledBy="create-group-title" className="decision-modal form-modal group-form-modal" onClose={() => setCreateModal(null)} onSubmit={submitGroup}>
            <div className="modal-header-block">
              <span>{selectedCourse?.title ?? t('groups.courseRequired')}</span>
              <h2 id="create-group-title">{t('groups.createGroup')}</h2>
              <p>{t('sessions.createGroupDetail')}</p>
            </div>
            <div className="segmented-control delivery-mode-tabs" aria-label={t('groups.deliveryMode')}>
              <button type="button" aria-pressed={groupForm.deliveryMode === 'group'} className={groupForm.deliveryMode === 'group' ? 'active' : ''} onClick={() => { setGroupForm((current) => ({ ...current, deliveryMode: 'group', seatLimit: current.seatLimit === '1' ? '' : current.seatLimit })); setCreateErrors({}); }}>
                {t('groups.deliveryGroup')}
              </button>
              {canManageEnrollment ? (
                <button type="button" aria-pressed={groupForm.deliveryMode === 'individual'} className={groupForm.deliveryMode === 'individual' ? 'active' : ''} onClick={() => { setGroupForm((current) => ({ ...current, deliveryMode: 'individual', seatLimit: '1' })); setCreateErrors({}); }}>
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
                    <label>
                      {t('groups.individualStudent')}
                      <input value={studentSearch} onChange={(event) => { setStudentSearch(event.target.value); clearCreateError('student'); }} placeholder={t('groups.nameOrEmail')} className={createErrors.student ? 'input-error' : ''} aria-invalid={!!createErrors.student} />
                    </label>
                    <button type="button" className="secondary-button" onClick={() => void searchStudents()} disabled={enrolling}>{enrolling ? t('groups.searchingStudents') : t('groups.search')}</button>
                    <select value={selectedStudentId ?? ''} onChange={(event) => { setSelectedStudentId(Number(event.target.value) || undefined); clearCreateError('student'); }} disabled={!studentResults.length} className={createErrors.student ? 'input-error' : ''} aria-invalid={!!createErrors.student}>
                      <option value="">{t('groups.selectStudent')}</option>
                      {studentResults.map((student) => <option key={student.id} value={student.id}>{student.fullName || student.email} ({student.email})</option>)}
                    </select>
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
                  <input type="checkbox" checked={groupForm.createFirstSession} onChange={(event) => setGroupForm((current) => ({ ...current, createFirstSession: event.target.checked }))} />
                  {t('groups.createFirstSession')}
                </label>
                {groupForm.createFirstSession ? <p className="panel-note">{t('groups.createFirstSessionHint')}</p> : null}
              </>
            ) : null}
            <div className={groupForm.deliveryMode === 'individual' ? '' : 'two-col'}>
              <label className="required-field">
                <span>{t('groups.name')}</span>
                <input
                  required
                  value={groupForm.name}
	                  onChange={(event) => {
	                    setGroupForm((current) => ({ ...current, name: event.target.value }));
	                    clearCreateError('groupName');
	                  }}
                  className={createErrors.groupName ? 'input-error' : ''}
                  aria-invalid={!!createErrors.groupName}
                  placeholder={t('sessions.groupNamePlaceholder')}
                  autoFocus
                />
                {createErrors.groupName ? <span className="field-error">{createErrors.groupName}</span> : null}
              </label>
              {groupForm.deliveryMode !== 'individual' ? (
                <label>
                  {t('groups.code')}
                  <input value={groupForm.code} onChange={(event) => setGroupForm((current) => ({ ...current, code: event.target.value }))} placeholder={t('sessions.autoIfEmpty')} />
                </label>
              ) : null}
            </div>
            <div className={groupForm.deliveryMode === 'individual' ? '' : 'two-col'}>
              {groupForm.deliveryMode !== 'individual' ? (
                <label>
                  {t('courses.status')}
                  <select value={groupForm.status} onChange={(event) => setGroupForm((current) => ({ ...current, status: event.target.value as 'planned' | 'open' | 'active' | 'completed' | 'cancelled' }))}>
                    <option value="planned">{t('courses.statusPlanned')}</option>
                    <option value="open">{t('groups.statusOpen')}</option>
                    <option value="active">{t('groups.statusActive')}</option>
                  </select>
                </label>
              ) : null}
              <label>
                {t('groups.seatLimit')}
	                <input type="number" min="1" step="1" value={groupForm.deliveryMode === 'individual' ? '1' : groupForm.seatLimit} onChange={(event) => { setGroupForm((current) => ({ ...current, seatLimit: event.target.value })); clearCreateError('seatLimit'); }} placeholder={t('groups.noLimit')} disabled={groupForm.deliveryMode === 'individual'} className={createErrors.seatLimit ? 'input-error' : ''} aria-invalid={!!createErrors.seatLimit} />
	                {createErrors.seatLimit ? <span className="field-error">{createErrors.seatLimit}</span> : null}
	              </label>
            </div>
            <div className="two-col">
              <label>
                {t('groups.startDate')}
	                <input type="date" value={groupForm.startDate} onChange={(event) => { setGroupForm((current) => ({ ...current, startDate: event.target.value })); clearCreateError('dates'); }} className={createErrors.dates ? 'input-error' : ''} aria-invalid={!!createErrors.dates} />
	              </label>
	              <label>
	                {t('groups.endDate')}
	                <input type="date" value={groupForm.endDate} onChange={(event) => { setGroupForm((current) => ({ ...current, endDate: event.target.value })); clearCreateError('dates'); }} className={createErrors.dates ? 'input-error' : ''} aria-invalid={!!createErrors.dates} />
	              </label>
	            </div>
	            {createErrors.dates ? <span className="field-error">{createErrors.dates}</span> : null}
	            <div className="two-col">
	              <label>
	                {t('groups.timezone')}
	                <input value={groupForm.timezone} onChange={(event) => { setGroupForm((current) => ({ ...current, timezone: event.target.value })); clearCreateError('timezone'); }} placeholder="Asia/Bishkek" className={createErrors.timezone ? 'input-error' : ''} aria-invalid={!!createErrors.timezone} />
	                {createErrors.timezone ? <span className="field-error">{createErrors.timezone}</span> : null}
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
            {selectedCourseOffline ? (
              <label>
                {t('groups.location')}
                <input value={groupForm.location} onChange={(event) => setGroupForm((current) => ({ ...current, location: event.target.value }))} placeholder={t('sessions.locationPlaceholder')} />
              </label>
            ) : null}
            {selectedCourseLiveOnline ? (
              <div className="two-col">
                <label>
                  {t('groups.meetingProvider')}
                  <input value={groupForm.meetingProvider} onChange={(event) => setGroupForm((current) => ({ ...current, meetingProvider: event.target.value }))} placeholder={t('sessions.meetingProviderPlaceholder')} />
                </label>
                <label>
                  {t('groups.meetingUrl')}
	                <input value={groupForm.meetingUrl} onChange={(event) => { setGroupForm((current) => ({ ...current, meetingUrl: event.target.value })); clearCreateError('meetingUrl'); }} placeholder="https://..." className={createErrors.meetingUrl ? 'input-error' : ''} aria-invalid={!!createErrors.meetingUrl} />
	                {createErrors.meetingUrl ? <span className="field-error">{createErrors.meetingUrl}</span> : null}
	              </label>
              </div>
            ) : null}
            <div className="schedule-block-list">
              {groupForm.scheduleBlocks.map((block, index) => (
                <div className="three-col" key={`${index}-${block.day}`}>
                  <label>
                    {t('groups.scheduleDay')}
	                    <select value={block.day} onChange={(event) => { setGroupForm((current) => ({
	                      ...current,
	                      scheduleBlocks: current.scheduleBlocks.map((item, itemIndex) => itemIndex === index ? { ...item, day: event.target.value as ScheduleDay } : item),
	                    })); clearCreateError('schedule'); }} className={createErrors.schedule ? 'input-error' : ''} aria-invalid={!!createErrors.schedule}>
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
	                    <input type="time" value={block.startTime} onChange={(event) => { setGroupForm((current) => ({
	                      ...current,
	                      scheduleBlocks: current.scheduleBlocks.map((item, itemIndex) => itemIndex === index ? { ...item, startTime: event.target.value } : item),
	                    })); clearCreateError('schedule'); }} className={createErrors.schedule ? 'input-error' : ''} aria-invalid={!!createErrors.schedule} />
                  </label>
                  <label>
                    {t('groups.ends')}
	                    <input type="time" value={block.endTime} onChange={(event) => { setGroupForm((current) => ({
	                      ...current,
	                      scheduleBlocks: current.scheduleBlocks.map((item, itemIndex) => itemIndex === index ? { ...item, endTime: event.target.value } : item),
	                    })); clearCreateError('schedule'); }} className={createErrors.schedule ? 'input-error' : ''} aria-invalid={!!createErrors.schedule} />
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
	            {createErrors.schedule ? <span className="field-error">{createErrors.schedule}</span> : null}
            {groupForm.deliveryMode !== 'individual' ? (
              <label>
                {t('groups.scheduleNote')}
                <input value={groupForm.scheduleNote} onChange={(event) => setGroupForm((current) => ({ ...current, scheduleNote: event.target.value }))} placeholder={t('sessions.scheduleNotePlaceholder')} />
              </label>
            ) : null}
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setCreateModal(null)} disabled={savingGroup}>{t('courses.cancel')}</button>
              <button type="submit" disabled={!courseId || savingGroup}>{savingGroup ? t('courses.creating') : t('groups.createGroup')}</button>
            </div>
        </FormModal>
      ) : null}
      {createModal === 'session' && canScheduleSessions ? (
        <FormModal labelledBy="schedule-session-title" className="decision-modal form-modal session-form-modal" onClose={() => setCreateModal(null)} onSubmit={submitSession}>
            <div className="modal-header-block">
              <span>{selectedGroup?.name ?? t('sessions.groupRequired')}</span>
              <h2 id="schedule-session-title">{t('sessions.scheduleSession')}</h2>
              <p>{t('sessions.scheduleSessionDetail')}</p>
            </div>
            <label className="required-field">
              <span>{t('courses.title')}</span>
              <input
                required
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
              <label className="required-field">
                <span>{t('groups.starts')}</span>
                <input
                  type="datetime-local"
                  required
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
              <label className="required-field">
                <span>{t('groups.ends')}</span>
                <input
                  type="datetime-local"
                  required
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
          className="decision-modal form-modal enrollment-form-modal"
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
      {createModal === 'activity' && canManageSessionActivities ? (
        <FormModal labelledBy="add-activity-title" className="decision-modal form-modal activity-form-modal" onClose={() => setCreateModal(null)} onSubmit={submitActivity}>
            <div className="modal-header-block">
              <span>{selectedSession?.title ?? t('sessions.sessionRequired')}</span>
              <h2 id="add-activity-title">{t('sessions.addActivity')}</h2>
              <p>{t('sessions.addActivityDetail')}</p>
            </div>
            <div className="activity-modal-grid">
              <label className="wide-field">
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
              <fieldset className="activity-type-picker wide-field">
                <legend>{t('courses.type')}</legend>
                {([
                  ['discussion', t('sessions.activityTypeDiscussion')],
                  ['exercise', t('sessions.activityTypeExercise')],
                  ['group_work', t('sessions.activityTypeGroupWork')],
                  ['quiz', t('sessions.activityTypeQuiz')],
                ] as Array<[SessionActivityType, string]>).map(([type, label]) => (
                  <button
                    key={type}
                    type="button"
                    className={activityForm.type === type ? 'active' : ''}
                    aria-pressed={activityForm.type === type}
                    onClick={() => {
                      setActivityForm((current) => ({ ...current, type }));
                      setCreateErrors((current) => ({ ...current, quizQuestions: '' }));
                    }}
                  >
                    {label}
                  </button>
                ))}
              </fieldset>
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
                {activityForm.quizQuestions.map((question, questionIndex) => (
                  <section className="quiz-question-card" key={questionIndex}>
                    <div className="quiz-question-header">
                      <strong>{t('sessions.questionLabel', { number: questionIndex + 1 })}</strong>
                      <button
                        type="button"
                        className="link-button danger"
                        onClick={() => {
                          setActivityForm((current) => ({
                            ...current,
                            quizQuestions: current.quizQuestions.filter((_, index) => index !== questionIndex),
                          }));
                          clearCreateError('quizQuestions');
                        }}
                        disabled={activityForm.quizQuestions.length <= 1}
                        aria-label={t('sessions.removeQuestionLabel', { number: questionIndex + 1 })}
                      >
                        {t('groups.remove')}
                      </button>
                    </div>
                    <label>
                      {t('sessions.question')}
                      <input
                        value={question.prompt}
                        aria-label={t('sessions.questionPromptLabel', { number: questionIndex + 1 })}
                        onChange={(event) => updateQuizQuestion(questionIndex, (currentQuestion) => ({
                          ...currentQuestion,
                          prompt: event.target.value,
                        }))}
                        className={createErrors.quizQuestions ? 'input-error' : ''}
                        aria-invalid={!!createErrors.quizQuestions}
                      />
                    </label>
                    <div className="quiz-options-list">
                      {question.options.map((option, optionIndex) => (
                        <div className="quiz-option-row" key={optionIndex}>
                          <label>
                            {t('sessions.optionLabel', { letter: quizOptionLetter(optionIndex) })}
                            <input
                              value={option}
                              aria-label={t('sessions.questionOptionLabel', { number: questionIndex + 1, letter: quizOptionLetter(optionIndex) })}
                              onChange={(event) => {
                                const nextValue = event.target.value;
                                updateQuizQuestion(questionIndex, (currentQuestion) => ({
                                  ...currentQuestion,
                                  options: currentQuestion.options.map((item, itemIndex) => (itemIndex === optionIndex ? nextValue : item)),
                                }));
                              }}
                              className={createErrors.quizQuestions ? 'input-error' : ''}
                              aria-invalid={!!createErrors.quizQuestions}
                            />
                          </label>
                          <button
                            type="button"
                            className="secondary-button quiz-option-remove"
                            onClick={() => updateQuizQuestion(questionIndex, (currentQuestion) => {
                              const nextOptions = currentQuestion.options.filter((_, itemIndex) => itemIndex !== optionIndex);
                              return {
                                ...currentQuestion,
                                options: nextOptions,
                                correctOptionIndex: Math.min(
                                  currentQuestion.correctOptionIndex === optionIndex ? 0 : currentQuestion.correctOptionIndex > optionIndex ? currentQuestion.correctOptionIndex - 1 : currentQuestion.correctOptionIndex,
                                  Math.max(0, nextOptions.length - 1),
                                ),
                              };
                            })}
                            disabled={question.options.length <= 2}
                            aria-label={t('sessions.removeQuestionOptionLabel', { number: questionIndex + 1, letter: quizOptionLetter(optionIndex) })}
                          >
                            {t('groups.remove')}
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="secondary-button quiz-option-add"
                        onClick={() => updateQuizQuestion(questionIndex, (currentQuestion) => ({
                          ...currentQuestion,
                          options: [...currentQuestion.options, ''],
                        }))}
                        disabled={question.options.length >= 6}
                        aria-label={t('sessions.addOptionToQuestionLabel', { number: questionIndex + 1 })}
                      >
                        {t('sessions.addOption')}
                      </button>
                    </div>
                    <fieldset className="activity-type-picker answer-picker" aria-label={t('sessions.questionCorrectAnswerLabel', { number: questionIndex + 1 })}>
                      <legend>{t('sessions.correctAnswer')}</legend>
                      {question.options.map((_, optionIndex) => (
                        <button
                          key={optionIndex}
                          type="button"
                          className={question.correctOptionIndex === optionIndex ? 'active' : ''}
                          aria-pressed={question.correctOptionIndex === optionIndex}
                          onClick={() => updateQuizQuestion(questionIndex, (currentQuestion) => ({
                            ...currentQuestion,
                            correctOptionIndex: optionIndex,
                          }))}
                          aria-label={t('sessions.questionCorrectOptionLabel', { number: questionIndex + 1, letter: quizOptionLetter(optionIndex) })}
                        >
                          {quizOptionLetter(optionIndex)}
                        </button>
                      ))}
                    </fieldset>
                  </section>
                ))}
                {createErrors.quizQuestions ? <span className="field-error">{createErrors.quizQuestions}</span> : null}
                <button
                  type="button"
                  className="secondary-button quiz-question-add"
                  onClick={() => {
                    setActivityForm((current) => ({
                      ...current,
                      quizQuestions: [...current.quizQuestions, emptyQuizQuestion()],
                    }));
                    clearCreateError('quizQuestions');
                  }}
                  disabled={activityForm.quizQuestions.length >= 20}
                >
                  {t('sessions.addQuestion')}
                </button>
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
