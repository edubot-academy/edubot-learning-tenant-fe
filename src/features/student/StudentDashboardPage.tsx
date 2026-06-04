import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiArrowLeft, FiAward, FiBell, FiBookOpen, FiCalendar, FiCheckCircle, FiClock, FiExternalLink, FiFileText, FiHelpCircle, FiPlayCircle } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../../components/DataState';
import { FormModal } from '../../components/Modal';
import { MaterialPreviewModal, type MaterialPreview } from '../../components/MaterialPreviewModal';
import { CountFilterRow } from '../../components/CountFilterRow';
import {
  createStudentSupportRequest,
  downloadCertificatePdf,
  getStudentCourseDetail,
  getStudentHome,
  getStudentCertificatesPage,
  getStudentNotificationUnreadCount,
  getStudentNotificationsPage,
  getStudentProgressSummary,
  getStudentRecordingsPage,
  getStudentResourcesPage,
  getStudentSessionDetail,
  getStudentSupportOptions,
  listStudentAttendance,
  listStudentCourses,
  listStudentHomework,
  listStudentReminders,
  listStudentSupportRequests,
  listStudentTasks,
  listStudentUpcomingSessions,
  markAllStudentNotificationsRead,
  markStudentNotificationRead,
  submitStudentActivity,
  submitStudentActivityQuiz,
  submitStudentHomework,
  uploadStudentActivityAttachment,
  uploadStudentHomeworkAttachment,
} from '../../services/api';
import { formatDate, readable } from '../../lib/format';
import { activityTypeLabelKeys, commonStatusLabelKeys, enumLabel } from '../../lib/enumLabels';
import { useAsyncLoadState } from '../../lib/asyncState';
import { useTenant } from '../tenant/TenantProvider';
import { isTenantFeatureEnabled } from '../tenant/tenantFeatures';
import type {
  AttendanceRecord,
  StudentCertificateSummary,
  StudentCourseDetail,
  StudentCourseSummary,
  StudentHomeworkItem,
  StudentMaterialItem,
  StudentNotification,
  StudentNotificationPage,
  StudentProgressSummary,
  StudentReminder,
  StudentSessionDetail,
  StudentSessionSummary,
  StudentSubmission,
  StudentSupportOptions,
  StudentSupportRequest,
  StudentTaskItem,
  StudentTaskSubmissionRequirements,
} from '../../types/domain';
import type { StudentPagedResponse } from '../../services/api';
import {
  isCurrentStudentLoad,
  isStudentUpcomingSession,
  isStudentVisibleSession,
  nextStudentLoadId,
  prioritizeStudentTasks,
  settledStudentValue,
  sortOpenStudentTasks,
  studentSessionId,
  studentSessionStartsAt,
  studentTaskDueDate,
  studentTaskState,
  studentVisibleLiveJoinUrl,
} from './studentDashboardData';

type StudentMaterialListItem = {
  kind: 'resource' | 'recording';
  session: StudentSessionSummary;
  key: string;
  material?: { title?: string; url?: string | null; type?: string; lessonId?: number | null; lessonTitle?: string | null };
};

export type StudentDashboardView = 'today' | 'todo' | 'courses' | 'courseDetail' | 'sessionDetail' | 'materials' | 'progress' | 'help';
type TodoFilter = 'open' | 'overdue' | 'submitted' | 'needs_revision' | 'completed';
type MaterialFilter = 'all' | 'resources' | 'recordings';
type CertificateStatusFilter = 'all' | 'issued' | 'pending' | 'rejected' | 'revoked';
type StudentSectionError = 'courses' | 'sessions' | 'homework' | 'tasks' | 'materials' | 'progress' | 'certificates' | 'attendance' | 'supportOptions' | 'supportRequests' | 'notifications' | 'reminders' | 'courseDetail' | 'sessionDetail';

function isActivityTask(task: StudentTaskItem | StudentHomeworkItem): task is StudentTaskItem {
  return task.kind === 'activity' || task.kind === 'quiz' || 'taskType' in task || 'activityType' in task;
}

const emptySubmitForm = {
  answerText: '',
  linkUrl: '',
  attachmentUrl: '',
  attachmentKey: '',
};

function statusClass(value?: string | null) {
  return String(value || 'draft').toLowerCase().replace(/[^a-z0-9_-]+/g, '_');
}

function displayDate(value: string | null | undefined, fallback: string) {
  return value ? formatDate(value) : fallback;
}

function displayText(value: string | number | boolean | null | undefined, fallback: string) {
  return value === null || value === undefined || value === '' ? fallback : readable(value);
}

function dueLabel(value: string | null | undefined, dueTemplate: (date: string) => string, noDueDate: string) {
  return value ? dueTemplate(formatDate(value)) : noDueDate;
}

function taskContext(task?: StudentTaskItem | StudentHomeworkItem | null) {
  if (!task) return '';
  return task.courseTitle ?? (!isActivityTask(task) ? task.sessionTitle : undefined) ?? '';
}

function taskCourseTitle(task?: StudentTaskItem | StudentHomeworkItem | null) {
  return task?.courseTitle ?? '';
}

function taskSessionTitle(task?: StudentTaskItem | StudentHomeworkItem | null) {
  return task?.sessionTitle ?? '';
}

function taskSubmission(task?: StudentTaskItem | StudentHomeworkItem | null) {
  if (!task) return null;
  return isActivityTask(task) ? task.submission ?? task.mySubmission ?? null : task.mySubmission ?? null;
}

function taskSubmissionHistory(task?: StudentTaskItem | StudentHomeworkItem | null): StudentSubmission[] {
  if (!task) return [];
  const history = task.submissionHistory ?? task.submissions ?? [];
  const current = taskSubmission(task);
  const combined = current ? [current, ...history.filter((item) => item.id !== current.id)] : history;
  return combined
    .filter((item): item is StudentSubmission => Boolean(item))
    .sort((first, second) => {
      const firstTime = Date.parse(first.submittedAt ?? first.updatedAt ?? first.createdAt ?? '');
      const secondTime = Date.parse(second.submittedAt ?? second.updatedAt ?? second.createdAt ?? '');
      return (Number.isFinite(secondTime) ? secondTime : 0) - (Number.isFinite(firstTime) ? firstTime : 0);
    });
}

function taskAttempt(task?: StudentTaskItem | null) {
  return task?.attempt ?? task?.myAttempt ?? null;
}

function taskSubmissionRequirements(task?: StudentTaskItem | StudentHomeworkItem | null): Required<Pick<StudentTaskSubmissionRequirements, 'allowText' | 'allowFile' | 'allowLink'>> & Pick<StudentTaskSubmissionRequirements, 'maxFileSize' | 'allowedFileTypes'> {
  const requirements = task?.submissionRequirements ?? task ?? {};
  return {
    allowText: requirements.allowText !== false,
    allowFile: requirements.allowFile !== false,
    allowLink: requirements.allowLink !== false,
    maxFileSize: requirements.maxFileSize ?? null,
    allowedFileTypes: requirements.allowedFileTypes ?? null,
  };
}

function fileMatchesAllowedType(file: File, allowedType: string) {
  const normalized = allowedType.trim().toLowerCase();
  if (!normalized) return false;
  const fileType = file.type.toLowerCase();
  const fileName = file.name.toLowerCase();
  if (normalized.startsWith('.')) return fileName.endsWith(normalized);
  if (normalized.endsWith('/*')) return fileType.startsWith(normalized.slice(0, -1));
  return fileType === normalized;
}

function fileMatchesAllowedTypes(file: File, allowedTypes?: string[] | null) {
  if (!allowedTypes?.length) return true;
  return allowedTypes.some((allowedType) => fileMatchesAllowedType(file, allowedType));
}

function supportOptionValue(option: string | { id?: string; value?: string; label?: string }) {
  return typeof option === 'string' ? option : option.id ?? option.value ?? option.label ?? '';
}

function supportOptionLabel(option: string | { id?: string; value?: string; label?: string }, translate?: (key: string) => string) {
  const value = supportOptionValue(option).toLowerCase();
  const translationKey = value ? `student.supportOption.${value}` : '';
  if (translationKey && translate) {
    const translated = translate(translationKey);
    if (translated !== translationKey) return translated;
  }
  const label = typeof option === 'string' ? readable(option) : option.label ?? readable(option.value ?? option.id);
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : label;
}

function courseId(course: StudentCourseSummary) {
  return course.courseId ?? course.id;
}

function courseTitle(course: StudentCourseSummary, fallback: string) {
  return course.title ?? course.courseTitle ?? fallback;
}

function sessionId(session: StudentSessionSummary) {
  return studentSessionId(session);
}

function sessionStartsAt(session?: StudentSessionSummary | null) {
  return studentSessionStartsAt(session);
}

function normalizeMaterialItem(item: StudentSessionSummary | StudentMaterialItem, kind: 'resource' | 'recording', index: number): StudentMaterialListItem {
  if ('sessionId' in item || 'sessionTitle' in item || 'fileName' in item) {
    const flat = item as StudentMaterialItem;
    return {
      kind,
      key: String(flat.id ?? `${kind}-${flat.sessionId ?? 'unknown'}-${index}`),
      session: {
        id: flat.sessionId ?? undefined,
        courseId: flat.courseId,
        title: flat.sessionTitle ?? flat.title,
        sessionTitle: flat.sessionTitle ?? flat.title,
        lessonId: flat.lessonId ?? undefined,
        lessonTitle: flat.lessonTitle ?? undefined,
        status: flat.status,
        courseTitle: flat.courseTitle ?? undefined,
        groupId: flat.groupId ?? undefined,
        groupName: flat.groupName ?? undefined,
        groupStatus: flat.groupStatus ?? undefined,
        startsAt: flat.createdAt,
        url: flat.url,
        materials: kind === 'resource' ? [{ title: flat.title, url: flat.url, type: flat.type, lessonId: flat.lessonId, lessonTitle: flat.lessonTitle }] : undefined,
      },
      material: { title: flat.title, url: flat.url, type: flat.type, lessonId: flat.lessonId, lessonTitle: flat.lessonTitle },
    };
  }

  const session = item as StudentSessionSummary;
  return {
    kind,
    key: `${kind}-${sessionId(session) ?? index}`,
    session,
    material: kind === 'resource' ? session.materials?.[0] : { title: session.title ?? session.sessionTitle, url: session.url, type: 'recording' },
  };
}

function progressLabel(value: number, labels: { completed: string; notStarted: string; inProgress: string }) {
  if (value >= 100) return labels.completed;
  if (value <= 0) return labels.notStarted;
  return labels.inProgress;
}

function materialTitle(item: StudentMaterialListItem, fallback: string) {
  const { kind, session, material } = item;
  return (kind === 'resource'
    ? material?.title ?? session.sessionTitle ?? session.title
    : session.sessionTitle ?? session.title ?? material?.title) ?? fallback;
}

function materialUrl(item: StudentMaterialListItem) {
  const { kind, session, material } = item;
  if (kind === 'recording') return typeof session.url === 'string' ? session.url : material?.url ?? null;
  return material?.url ?? session.materials?.find((entry) => entry.url)?.url ?? null;
}

function materialTypeText(item: StudentMaterialListItem, fallback: string) {
  const value = item.kind === 'recording' ? 'recording' : item.material?.type;
  if (value) return readable(value).toUpperCase();
  const url = materialUrl(item) ?? '';
  const extension = url.split('?')[0]?.split('.').pop();
  return extension && extension.length <= 5 ? extension.toUpperCase() : fallback;
}

function isRecentlyAdded(value?: string | null) {
  const timestamp = Date.parse(value ?? '');
  if (!Number.isFinite(timestamp)) return false;
  const fourteenDays = 14 * 24 * 60 * 60 * 1000;
  return Date.now() - timestamp >= 0 && Date.now() - timestamp <= fourteenDays;
}

function isStudentVisibleMaterialSession(session?: StudentSessionSummary | null) {
  if (!isStudentVisibleSession(session)) return false;
  if (session?.status == null) return true;
  return String(session.status).toLowerCase() === 'completed';
}

function materialLessonValue(session: StudentSessionSummary, material?: StudentMaterialListItem['material']) {
  const lessonId = session.lessonId ?? material?.lessonId;
  const lessonTitle = session.lessonTitle ?? material?.lessonTitle;
  return lessonId ? String(lessonId) : lessonTitle ?? '';
}

function materialFilterOptionsWithActive(
  options: Array<{ value: string; label: string }>,
  activeValue: string,
  fallbackLabel: string,
) {
  if (activeValue === 'all' || options.some((option) => option.value === activeValue)) return options;
  return [{ value: activeValue, label: fallbackLabel }, ...options];
}

function rawTaskStatus(task: StudentTaskItem | StudentHomeworkItem) {
  return studentTaskState(task);
}

function taskFilterKey(task: StudentTaskItem | StudentHomeworkItem, now = Date.now()): TodoFilter {
  const status = rawTaskStatus(task);
  if (['needs_revision', 'revision_required', 'rejected'].includes(status)) return 'needs_revision';
  if (['approved', 'completed', 'passed', 'graded'].includes(status)) return 'completed';
  if (['submitted', 'pending_review'].includes(status)) return 'submitted';
  const dueTime = Date.parse(studentTaskDueDate(task) ?? '');
  if (Number.isFinite(dueTime) && dueTime < now) return 'overdue';
  return 'open';
}

function taskSortWeight(task: StudentTaskItem | StudentHomeworkItem) {
  const state = taskFilterKey(task);
  const stateWeight: Record<TodoFilter, number> = {
    needs_revision: 0,
    overdue: 1,
    open: 2,
    submitted: 3,
    completed: 4,
  };
  const dueTime = Date.parse(studentTaskDueDate(task) ?? '');
  return [stateWeight[state], Number.isFinite(dueTime) ? dueTime : Number.MAX_SAFE_INTEGER] as const;
}

function settledValue<T>(result: PromiseSettledResult<T>, fallback: T) {
  return settledStudentValue(result, fallback);
}

function isRejected(result: PromiseSettledResult<unknown>) {
  return result.status === 'rejected';
}

function formattedStudentTaskDescription(value?: string | null) {
  return value?.replace(/\\n/g, '\n') || '';
}

export function StudentDashboardPage({
  view = 'today',
  courseId: activeCourseId,
  sessionId: activeSessionId,
}: {
  view?: StudentDashboardView;
  courseId?: number;
  sessionId?: number;
}) {
  const { t } = useTranslation();
  const { activeTenant } = useTenant();
  const [courses, setCourses] = useState<StudentCourseSummary[]>([]);
  const [sessions, setSessions] = useState<StudentSessionSummary[]>([]);
  const [homework, setHomework] = useState<StudentHomeworkItem[]>([]);
  const [certificates, setCertificates] = useState<StudentCertificateSummary[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [tasks, setTasks] = useState<StudentTaskItem[]>([]);
  const [resources, setResources] = useState<Array<StudentSessionSummary | StudentMaterialItem>>([]);
  const [recordings, setRecordings] = useState<Array<StudentSessionSummary | StudentMaterialItem>>([]);
  const [courseDetail, setCourseDetail] = useState<StudentCourseDetail | null>(null);
  const [sessionDetail, setSessionDetail] = useState<StudentSessionDetail | null>(null);
  const [progressSummary, setProgressSummary] = useState<StudentProgressSummary | null>(null);
  const [supportOptions, setSupportOptions] = useState<StudentSupportOptions | null>(null);
  const [supportRequests, setSupportRequests] = useState<StudentSupportRequest[]>([]);
  const [notifications, setNotifications] = useState<StudentNotification[]>([]);
  const [sectionErrors, setSectionErrors] = useState<Set<StudentSectionError>>(new Set());
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  const [notificationPage, setNotificationPage] = useState(1);
  const [notificationTotalPages, setNotificationTotalPages] = useState(1);
  const [reminders, setReminders] = useState<StudentReminder[]>([]);
  const [selectedTask, setSelectedTask] = useState<StudentTaskItem | StudentHomeworkItem | null>(null);
  const [selectedMaterialPreview, setSelectedMaterialPreview] = useState<MaterialPreview | null>(null);
  const [submitForm, setSubmitForm] = useState(emptySubmitForm);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number[]>>({});
  const [todoFilter, setTodoFilter] = useState<TodoFilter>('open');
  const [materialFilter, setMaterialFilter] = useState<MaterialFilter>('all');
  const [materialCourseFilter, setMaterialCourseFilter] = useState('all');
  const [materialGroupFilter, setMaterialGroupFilter] = useState('all');
  const [materialSessionFilter, setMaterialSessionFilter] = useState('all');
  const [materialLessonFilter, setMaterialLessonFilter] = useState('all');
  const [materialVisibleCount, setMaterialVisibleCount] = useState(12);
  const [resourcePage, setResourcePage] = useState(1);
  const [recordingPage, setRecordingPage] = useState(1);
  const [resourceTotal, setResourceTotal] = useState(0);
  const [recordingTotal, setRecordingTotal] = useState(0);
  const [certificatePage, setCertificatePage] = useState(1);
  const [certificateTotalPages, setCertificateTotalPages] = useState(1);
  const [hasMoreResources, setHasMoreResources] = useState(false);
  const [hasMoreRecordings, setHasMoreRecordings] = useState(false);
  const [loadingMoreMaterials, setLoadingMoreMaterials] = useState(false);
  const [loadingMoreCertificates, setLoadingMoreCertificates] = useState(false);
  const [certificateStatusFilter, setCertificateStatusFilter] = useState<CertificateStatusFilter>('all');
  const [certificateCourseFilter, setCertificateCourseFilter] = useState('all');
  const [supportForm, setSupportForm] = useState({
    category: 'general',
    priority: 'medium' as 'high' | 'medium' | 'low',
    courseId: 'none',
    sessionId: 'none',
    message: '',
  });
  const openDocumentPreview = (preview: MaterialPreview) => {
    setSelectedMaterialPreview(preview);
  };
  const [submitting, setSubmitting] = useState(false);
  const [loadingMoreNotifications, setLoadingMoreNotifications] = useState(false);
  const studentLoadIdRef = useRef(0);
  const studentLoad = useAsyncLoadState(true);
  const {
    start: startStudentLoad,
    succeed: succeedStudentLoad,
    reloadToken: studentReloadToken,
    retry: retryStudentLoad,
  } = studentLoad;
  const homeworkEnabled = isTenantFeatureEnabled(activeTenant, 'homework.enabled');
  const certificatesEnabled = isTenantFeatureEnabled(activeTenant, 'certificates.enabled');
  const attendanceEnabled = isTenantFeatureEnabled(activeTenant, 'attendance.enabled');
  const supportMessageLength = supportForm.message.trim().length;
  const canSubmitSupportRequest = supportMessageLength > 0 && !submitting;
  const selectedMaterialCourseId = useMemo(() => {
    if (materialCourseFilter === 'all') return undefined;
    const numeric = Number(materialCourseFilter);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined;
  }, [materialCourseFilter]);
  const selectedMaterialGroupId = useMemo(() => {
    if (materialGroupFilter === 'all') return undefined;
    const numeric = Number(materialGroupFilter);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined;
  }, [materialGroupFilter]);
  const selectedMaterialSessionId = useMemo(() => {
    if (materialSessionFilter === 'all') return undefined;
    const numeric = Number(materialSessionFilter);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined;
  }, [materialSessionFilter]);
  const selectedMaterialLessonId = useMemo(() => {
    if (materialLessonFilter === 'all') return undefined;
    const numeric = Number(materialLessonFilter);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined;
  }, [materialLessonFilter]);
  const selectedCertificateCourseId = useMemo(() => {
    if (certificateCourseFilter === 'all') return undefined;
    const numeric = Number(certificateCourseFilter);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined;
  }, [certificateCourseFilter]);

  useEffect(() => {
    let cancelled = false;
    const loadId = nextStudentLoadId(studentLoadIdRef.current);
    studentLoadIdRef.current = loadId;
    startStudentLoad();
    const shouldLoadHome = view === 'today';
    const shouldLoadSessions = view === 'today' || view === 'courseDetail' || view === 'help';
    const shouldLoadCourses = view === 'today' || view === 'courses' || view === 'materials' || view === 'courseDetail' || view === 'help';
    const shouldLoadHomework = homeworkEnabled && (view === 'today' || view === 'todo' || view === 'courseDetail');
    const shouldLoadTasks = view === 'today' || view === 'todo' || view === 'courseDetail';
    const shouldLoadMaterials = view === 'materials' || view === 'courseDetail';
    const shouldLoadResourceMaterials = shouldLoadMaterials && (view === 'courseDetail' || materialFilter !== 'recordings');
    const shouldLoadRecordingMaterials = shouldLoadMaterials && (view === 'courseDetail' || materialFilter !== 'resources');
    const shouldLoadProgress = view === 'progress';
    const shouldLoadAttendance = attendanceEnabled && (view === 'today' || view === 'progress');
    const shouldLoadCertificates = view === 'progress' && certificatesEnabled;
    const shouldLoadCourseDetail = view === 'courseDetail' && typeof activeCourseId === 'number';
    const shouldLoadSessionDetail = view === 'sessionDetail' && typeof activeSessionId === 'number';
    const shouldLoadSupport = view === 'help';
    const shouldLoadNotifications = view === 'today';

    Promise.allSettled([
      shouldLoadHome ? getStudentHome({ limit: 8 }) : Promise.resolve(null),
      shouldLoadCourses ? listStudentCourses() : Promise.resolve([]),
      shouldLoadSessions ? listStudentUpcomingSessions({ limit: view === 'today' ? 6 : 50, courseId: view === 'courseDetail' ? activeCourseId : undefined }) : Promise.resolve([]),
      shouldLoadHomework ? listStudentHomework({ limit: view === 'today' ? 8 : 50, courseId: view === 'courseDetail' ? activeCourseId : undefined }) : Promise.resolve([]),
      shouldLoadCertificates ? getStudentCertificatesPage({
        page: 1,
        limit: 20,
        courseId: selectedCertificateCourseId,
        status: certificateStatusFilter === 'all' ? undefined : certificateStatusFilter,
      }) : Promise.resolve({ items: [], page: 1, totalPages: 1 }),
      shouldLoadAttendance ? listStudentAttendance({ limit: view === 'today' ? 8 : 20 }) : Promise.resolve([]),
      shouldLoadTasks ? listStudentTasks({ limit: 50, courseId: view === 'courseDetail' ? activeCourseId : undefined }) : Promise.resolve([]),
      shouldLoadResourceMaterials ? getStudentResourcesPage({ page: 1, limit: 50, courseId: view === 'courseDetail' ? activeCourseId : selectedMaterialCourseId, groupId: selectedMaterialGroupId, sessionId: selectedMaterialSessionId, lessonId: selectedMaterialLessonId }) : Promise.resolve({ items: [], page: 1, totalPages: 1 }),
      shouldLoadRecordingMaterials ? getStudentRecordingsPage({ page: 1, limit: 50, courseId: view === 'courseDetail' ? activeCourseId : selectedMaterialCourseId, groupId: selectedMaterialGroupId, sessionId: selectedMaterialSessionId, lessonId: selectedMaterialLessonId }) : Promise.resolve({ items: [], page: 1, totalPages: 1 }),
      shouldLoadProgress ? getStudentProgressSummary() : Promise.resolve(null),
      shouldLoadCourseDetail ? getStudentCourseDetail(activeCourseId) : Promise.resolve(null),
      shouldLoadSessionDetail ? getStudentSessionDetail(activeSessionId) : Promise.resolve(null),
      shouldLoadSupport ? getStudentSupportOptions() : Promise.resolve(null),
      shouldLoadSupport ? listStudentSupportRequests({ limit: 5 }) : Promise.resolve([]),
      shouldLoadNotifications ? getStudentNotificationsPage({ page: 1, limit: 10 }) : Promise.resolve({ items: [], page: 1, totalPages: 1 }),
      shouldLoadNotifications ? getStudentNotificationUnreadCount() : Promise.resolve({ count: 0, hasUnread: false }),
      shouldLoadNotifications ? listStudentReminders({ page: 1, limit: 6 }) : Promise.resolve([]),
    ])
      .then(([
        homeResult,
        coursesResult,
        sessionsResult,
        homeworkResult,
        certificatesResult,
        attendanceResult,
        tasksResult,
        resourcesResult,
        recordingsResult,
        progressResult,
        courseDetailResult,
        sessionDetailResult,
        supportOptionsResult,
        supportRequestsResult,
        notificationsResult,
        notificationUnreadCountResult,
        remindersResult,
      ]) => {
        if (cancelled || !isCurrentStudentLoad(loadId, studentLoadIdRef.current)) return;
        const nextHome = settledValue(homeResult, null) as { activeCourses?: StudentCourseSummary[]; nextSession?: StudentSessionSummary | null; urgentTasks?: StudentTaskItem[]; recentFeedback?: StudentTaskItem[] } | null;
        const nextCourses = settledValue(coursesResult, []);
        const nextSessions = (settledValue(sessionsResult, []) as StudentSessionSummary[])
          .filter((session) => isStudentUpcomingSession(session))
          .map((session) => ({ ...session, liveJoinUrl: studentVisibleLiveJoinUrl(session) }));
        const nextHomework = settledValue(homeworkResult, []);
        const nextCertificatesPage = settledValue(certificatesResult, { items: [], page: 1, totalPages: 1 }) as StudentPagedResponse<StudentCertificateSummary>;
        const nextAttendance = settledValue(attendanceResult, []);
        const nextTasks = settledValue(tasksResult, []);
        const nextResourcesPage = settledValue(resourcesResult, { items: [], page: 1, totalPages: 1 }) as StudentPagedResponse<StudentSessionSummary | StudentMaterialItem>;
        const nextRecordingsPage = settledValue(recordingsResult, { items: [], page: 1, totalPages: 1 }) as StudentPagedResponse<StudentSessionSummary | StudentMaterialItem>;
        const nextResources = nextResourcesPage.items ?? [];
        const nextRecordings = nextRecordingsPage.items ?? [];
        const nextProgress = settledValue(progressResult, null) as StudentProgressSummary | null;
        const nextCourseDetailRaw = settledValue(courseDetailResult, null) as StudentCourseDetail | null;
        const nextCourseDetail = nextCourseDetailRaw
          ? {
              ...nextCourseDetailRaw,
              sessions: nextCourseDetailRaw.sessions?.filter(isStudentVisibleSession).map((session) => ({
                ...session,
                liveJoinUrl: studentVisibleLiveJoinUrl(session),
              })),
            }
          : null;
        const nextSessionDetailRaw = settledValue(sessionDetailResult, null) as StudentSessionDetail | null;
        const nextSessionDetail = nextSessionDetailRaw && isStudentVisibleSession(nextSessionDetailRaw)
          ? { ...nextSessionDetailRaw, liveJoinUrl: studentVisibleLiveJoinUrl(nextSessionDetailRaw) }
          : null;
        const nextSupportOptions = settledValue(supportOptionsResult, null) as StudentSupportOptions | null;
        const nextSupportRequests = settledValue(supportRequestsResult, []) as StudentSupportRequest[];
        const nextNotificationsPage = settledValue(notificationsResult, { items: [], page: 1, totalPages: 1 }) as StudentNotificationPage | StudentNotification[];
        const nextNotifications = Array.isArray(nextNotificationsPage) ? nextNotificationsPage : nextNotificationsPage.items ?? [];
        const nextUnreadCount = settledValue(notificationUnreadCountResult, { count: 0 }) as { count?: number; hasUnread?: boolean };
        const nextReminders = settledValue(remindersResult, []) as StudentReminder[];

        setCourses(nextHome?.activeCourses?.length ? nextHome.activeCourses : nextCourseDetail?.course ? [nextCourseDetail.course] : nextProgress?.courses?.length ? nextProgress.courses : nextCourses);
        const rawNextHomeSession = nextHome?.nextSession ?? null;
        const nextHomeSession = isStudentUpcomingSession(rawNextHomeSession)
          ? { ...rawNextHomeSession, liveJoinUrl: studentVisibleLiveJoinUrl(rawNextHomeSession) } as StudentSessionSummary
          : null;
        setSessions(nextHomeSession ? [nextHomeSession, ...nextSessions.filter((session: StudentSessionSummary) => sessionId(session) !== sessionId(nextHomeSession))] : nextSessions);
        setHomework(nextHomework);
        setCertificates(shouldLoadCertificates ? nextCertificatesPage.items ?? [] : nextProgress?.certificates ?? []);
        setCertificatePage(nextCertificatesPage.page ?? 1);
        setCertificateTotalPages(nextCertificatesPage.totalPages ?? 1);
        setAttendance(nextProgress?.attendance?.recent?.length ? nextProgress.attendance.recent : nextAttendance);
        setTasks(nextHome?.urgentTasks?.length ? nextHome.urgentTasks : homeworkEnabled ? nextTasks : nextTasks.filter((task: StudentTaskItem) => task.kind !== 'homework'));
        setResources(nextResources);
        setRecordings(nextRecordings);
        setResourcePage(nextResourcesPage.page ?? 1);
        setRecordingPage(nextRecordingsPage.page ?? 1);
        setResourceTotal(nextResourcesPage.total ?? nextResources.length);
        setRecordingTotal(nextRecordingsPage.total ?? nextRecordings.length);
        setHasMoreResources(shouldLoadResourceMaterials ? (nextResourcesPage.page ?? 1) < (nextResourcesPage.totalPages ?? 1) : false);
        setHasMoreRecordings(shouldLoadRecordingMaterials ? (nextRecordingsPage.page ?? 1) < (nextRecordingsPage.totalPages ?? 1) : false);
        setMaterialVisibleCount(12);
        setProgressSummary(nextProgress);
        setCourseDetail(nextCourseDetail);
        setSessionDetail(nextSessionDetail);
        setSupportOptions(nextSupportOptions);
        setSupportRequests(nextSupportRequests);
        setNotifications(nextNotifications);
        setNotificationPage(Array.isArray(nextNotificationsPage) ? 1 : nextNotificationsPage.page ?? 1);
        setNotificationTotalPages(Array.isArray(nextNotificationsPage) ? 1 : nextNotificationsPage.totalPages ?? 1);
        setNotificationUnreadCount(nextUnreadCount.count ?? 0);
        setReminders(nextReminders);

        const nextSectionErrors = new Set<StudentSectionError>();
        if (shouldLoadCourses && isRejected(coursesResult)) nextSectionErrors.add('courses');
        if (shouldLoadSessions && isRejected(sessionsResult)) nextSectionErrors.add('sessions');
        if (shouldLoadHomework && isRejected(homeworkResult)) nextSectionErrors.add('homework').add('tasks');
        if (shouldLoadCertificates && isRejected(certificatesResult)) nextSectionErrors.add('certificates');
        if (shouldLoadAttendance && isRejected(attendanceResult)) nextSectionErrors.add('attendance');
        if (shouldLoadTasks && isRejected(tasksResult)) nextSectionErrors.add('tasks');
        if ((shouldLoadResourceMaterials && isRejected(resourcesResult)) || (shouldLoadRecordingMaterials && isRejected(recordingsResult))) nextSectionErrors.add('materials');
        if (shouldLoadProgress && isRejected(progressResult)) nextSectionErrors.add('progress');
        if (shouldLoadCourseDetail && isRejected(courseDetailResult)) nextSectionErrors.add('courseDetail');
        if (shouldLoadSessionDetail && isRejected(sessionDetailResult)) nextSectionErrors.add('sessionDetail');
        if (shouldLoadSupport && isRejected(supportOptionsResult)) nextSectionErrors.add('supportOptions');
        if (shouldLoadSupport && isRejected(supportRequestsResult)) nextSectionErrors.add('supportRequests');
        if (shouldLoadNotifications && (isRejected(notificationsResult) || isRejected(notificationUnreadCountResult))) nextSectionErrors.add('notifications');
        if (shouldLoadNotifications && isRejected(remindersResult)) nextSectionErrors.add('reminders');
        setSectionErrors(nextSectionErrors);

        const criticalResults = [
          coursesResult,
          sessionsResult,
          homeworkResult,
          certificatesResult,
          attendanceResult,
          tasksResult,
          resourcesResult,
          recordingsResult,
          progressResult,
          courseDetailResult,
          sessionDetailResult,
          notificationsResult,
          notificationUnreadCountResult,
          remindersResult,
        ];
        const rejectedCount = criticalResults
          .filter((result) => result.status === 'rejected')
          .length;
        succeedStudentLoad(rejectedCount);
        if (rejectedCount > 0) {
          toast.error(t('student.couldNotLoad'));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeCourseId, activeSessionId, activeTenant?.id, attendanceEnabled, certificateStatusFilter, certificatesEnabled, homeworkEnabled, materialFilter, selectedCertificateCourseId, selectedMaterialCourseId, selectedMaterialGroupId, selectedMaterialLessonId, selectedMaterialSessionId, startStudentLoad, studentReloadToken, succeedStudentLoad, t, view]);

  const reloadStudentData = async () => {
    const [nextHomework, nextTasks] = await Promise.all([
      homeworkEnabled ? listStudentHomework({ limit: 8 }) : Promise.resolve([]),
      listStudentTasks({ limit: 50 }),
    ]);
    setHomework(nextHomework);
    setTasks(homeworkEnabled ? nextTasks : nextTasks.filter((task: StudentTaskItem) => task.kind !== 'homework'));

    if (view === 'courseDetail' && typeof activeCourseId === 'number') {
      const nextCourseDetail = await getStudentCourseDetail(activeCourseId);
      setCourseDetail(nextCourseDetail
        ? {
            ...nextCourseDetail,
            sessions: nextCourseDetail.sessions?.filter(isStudentVisibleSession).map((session) => ({
              ...session,
              liveJoinUrl: studentVisibleLiveJoinUrl(session),
            })),
          }
        : null);
    }
    if (view === 'sessionDetail' && typeof activeSessionId === 'number') {
      const nextSessionDetail = await getStudentSessionDetail(activeSessionId);
      setSessionDetail(nextSessionDetail && isStudentVisibleSession(nextSessionDetail)
        ? { ...nextSessionDetail, liveJoinUrl: studentVisibleLiveJoinUrl(nextSessionDetail) }
        : null);
    }
  };

  const selectTask = (task: StudentTaskItem | StudentHomeworkItem) => {
    setSelectedTask(task);
    const submission = taskSubmission(task);
    setSubmitForm({
      answerText: submission?.answerText ?? '',
      linkUrl: '',
      attachmentUrl: submission?.attachmentUrl ?? '',
      attachmentKey: submission?.attachmentKey ?? '',
    });
    setQuizAnswers({});
  };

  const uploadAttachment = async (file?: File) => {
    if (!file || !selectedTask?.id || !selectedTask.sessionId) return;
    const requirements = taskSubmissionRequirements(selectedTask);
    if (!requirements.allowFile) {
      toast.error(t('student.fileUploadNotAllowed'));
      return;
    }
    if (requirements.maxFileSize && file.size > requirements.maxFileSize) {
      toast.error(t('student.fileTooLarge'));
      return;
    }
    if (!fileMatchesAllowedTypes(file, requirements.allowedFileTypes)) {
      toast.error(t('student.fileTypeNotAllowed'));
      return;
    }

    setSubmitting(true);
    try {
      const uploaded = isActivityTask(selectedTask)
        ? await uploadStudentActivityAttachment(selectedTask.sessionId, selectedTask.id, file)
        : await uploadStudentHomeworkAttachment(selectedTask.sessionId, selectedTask.id, file);
      setSubmitForm((current) => ({ ...current, attachmentUrl: uploaded.url || uploaded.key, attachmentKey: uploaded.key || '' }));
      toast.success(t('student.attachmentUploaded'));
    } catch {
      toast.error(t('student.couldNotUpload'));
    } finally {
      setSubmitting(false);
    }
  };

  const submitSelectedTask = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedTask?.id || !selectedTask.sessionId) return;
    if (selectedTaskIsQuiz && !canSubmitSelectedTask) return;

    setSubmitting(true);
    try {
      if (isActivityTask(selectedTask) && (selectedTask.kind === 'quiz' || selectedTask.taskType === 'quiz')) {
        await submitStudentActivityQuiz(
          selectedTask.sessionId,
          selectedTask.id,
          Object.entries(quizAnswers).map(([questionId, optionIds]) => ({ questionId: Number(questionId), optionIds })),
        );
      } else if (isActivityTask(selectedTask)) {
        await submitStudentActivity(selectedTask.sessionId, selectedTask.id, {
          text: submitForm.answerText.trim() || undefined,
          link: submitForm.linkUrl.trim() || undefined,
          attachmentUrl: submitForm.attachmentUrl.trim() || undefined,
          attachmentKey: submitForm.attachmentKey.trim() || undefined,
        });
      } else {
        await submitStudentHomework(selectedTask.sessionId, selectedTask.id, {
          answerText: submitForm.answerText.trim() || undefined,
          linkUrl: submitForm.linkUrl.trim() || undefined,
          attachmentUrl: submitForm.attachmentUrl.trim() || undefined,
          attachmentKey: submitForm.attachmentKey.trim() || undefined,
        });
      }
      await reloadStudentData();
      setSelectedTask(null);
      setSubmitForm(emptySubmitForm);
      toast.success(t('student.submitted'));
    } catch {
      toast.error(t('student.couldNotSubmit'));
    } finally {
      setSubmitting(false);
    }
  };

  const submitSupportRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = supportForm.message.trim();
    if (!message) {
      toast.error(t('student.supportMessageRequired'));
      return;
    }

    setSubmitting(true);
    try {
      const created = await createStudentSupportRequest({
        category: supportForm.category,
        priority: supportForm.priority,
        courseId: supportForm.courseId !== 'none' ? Number(supportForm.courseId) : undefined,
        sessionId: supportForm.sessionId !== 'none' ? Number(supportForm.sessionId) : undefined,
        message,
      });
      setSupportRequests((current) => [created, ...current]);
      setSupportForm((current) => ({ ...current, message: '' }));
      toast.success(t('student.supportRequestSent'));
    } catch {
      toast.error(t('student.supportRequestFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const markNotificationRead = async (notification: StudentNotification) => {
    if (!notification.id || notification.isRead) return;
    try {
      await markStudentNotificationRead(notification.id);
      setNotifications((current) => current.map((item) => (
        item.id === notification.id ? { ...item, isRead: true } : item
      )));
      setNotificationUnreadCount((current) => Math.max(0, current - 1));
      window.dispatchEvent(new Event('student-notifications-updated'));
    } catch {
      toast.error(t('student.notificationReadFailed'));
    }
  };

  const markAllNotificationsRead = async () => {
    if (!notificationUnreadCount) return;
    try {
      await markAllStudentNotificationsRead();
      setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
      setNotificationUnreadCount(0);
      window.dispatchEvent(new Event('student-notifications-updated'));
    } catch {
      toast.error(t('student.notificationReadFailed'));
    }
  };

  const loadMoreNotifications = async () => {
    if (loadingMoreNotifications || notificationPage >= notificationTotalPages) return;
    setLoadingMoreNotifications(true);
    try {
      const nextPage = await getStudentNotificationsPage({ page: notificationPage + 1, limit: 10 }) as StudentNotificationPage;
      setNotifications((current) => [...current, ...(nextPage.items ?? [])]);
      setNotificationPage(nextPage.page ?? notificationPage + 1);
      setNotificationTotalPages(nextPage.totalPages ?? notificationTotalPages);
    } catch {
      toast.error(t('student.couldNotLoad'));
    } finally {
      setLoadingMoreNotifications(false);
    }
  };

  const loadMoreMaterials = async () => {
    if (loadingMoreMaterials) return;
    const matchingTotal = materialItems.filter(({ kind, session, material }) => {
      if (materialFilter === 'resources' && kind !== 'resource') return false;
      if (materialFilter === 'recordings' && kind !== 'recording') return false;
      if (materialCourseFilter !== 'all' && String(session.courseId ?? session.courseTitle) !== materialCourseFilter) return false;
      if (materialGroupFilter !== 'all' && String(session.groupId ?? session.groupName) !== materialGroupFilter) return false;
      if (materialSessionFilter !== 'all' && String(sessionId(session) ?? '') !== materialSessionFilter) return false;
      if (materialLessonFilter !== 'all' && materialLessonValue(session, material) !== materialLessonFilter) return false;
      return true;
    }).length;
    if (materialVisibleCount < matchingTotal) {
      setMaterialVisibleCount((current) => current + 12);
      return;
    }
    const shouldLoadResources = materialFilter !== 'recordings' && hasMoreResources;
    const shouldLoadRecordings = materialFilter !== 'resources' && hasMoreRecordings;
    if (!shouldLoadResources && !shouldLoadRecordings) return;

    setLoadingMoreMaterials(true);
    try {
      const [nextResourcesPage, nextRecordingsPage] = await Promise.all([
        shouldLoadResources ? getStudentResourcesPage({ page: resourcePage + 1, limit: 50, courseId: selectedMaterialCourseId, groupId: selectedMaterialGroupId, sessionId: selectedMaterialSessionId, lessonId: selectedMaterialLessonId }) : Promise.resolve({ items: [], page: resourcePage, total: resources.length, totalPages: resourcePage }),
        shouldLoadRecordings ? getStudentRecordingsPage({ page: recordingPage + 1, limit: 50, courseId: selectedMaterialCourseId, groupId: selectedMaterialGroupId, sessionId: selectedMaterialSessionId, lessonId: selectedMaterialLessonId }) : Promise.resolve({ items: [], page: recordingPage, total: recordings.length, totalPages: recordingPage }),
      ]);
      const nextResources = nextResourcesPage.items ?? [];
      const nextRecordings = nextRecordingsPage.items ?? [];
      if (nextResources.length) {
        setResources((current) => [...current, ...nextResources]);
        setResourcePage(nextResourcesPage.page ?? resourcePage + 1);
      }
      if (nextRecordings.length) {
        setRecordings((current) => [...current, ...nextRecordings]);
        setRecordingPage(nextRecordingsPage.page ?? recordingPage + 1);
      }
      setResourceTotal(nextResourcesPage.total ?? resourceTotal);
      setRecordingTotal(nextRecordingsPage.total ?? recordingTotal);
      setMaterialVisibleCount((current) => current + 12);
      setHasMoreResources((nextResourcesPage.page ?? resourcePage) < (nextResourcesPage.totalPages ?? resourcePage));
      setHasMoreRecordings((nextRecordingsPage.page ?? recordingPage) < (nextRecordingsPage.totalPages ?? recordingPage));
    } catch {
      toast.error(t('student.couldNotLoad'));
    } finally {
      setLoadingMoreMaterials(false);
    }
  };

  const loadMoreCertificates = async () => {
    if (loadingMoreCertificates || certificatePage >= certificateTotalPages) return;
    setLoadingMoreCertificates(true);
    try {
      const nextPage = await getStudentCertificatesPage({
        page: certificatePage + 1,
        limit: 20,
        courseId: selectedCertificateCourseId,
        status: certificateStatusFilter === 'all' ? undefined : certificateStatusFilter,
      });
      setCertificates((current) => [...current, ...(nextPage.items ?? [])]);
      setCertificatePage(nextPage.page ?? certificatePage + 1);
      setCertificateTotalPages(nextPage.totalPages ?? certificateTotalPages);
    } catch {
      toast.error(t('student.couldNotLoad'));
    } finally {
      setLoadingMoreCertificates(false);
    }
  };

  const toggleQuizOption = (questionId: number, optionId: number, mode?: string) => {
    setQuizAnswers((current) => {
      const currentValues = current[questionId] ?? [];
      const hasOption = currentValues.includes(optionId);
      const nextValues = mode === 'multiple_choice'
        ? hasOption
          ? currentValues.filter((id) => id !== optionId)
          : [...currentValues, optionId]
        : hasOption
          ? []
          : [optionId];
      return { ...current, [questionId]: nextValues };
    });
  };

  const attendanceRate = useMemo(() => {
    if (!attendance.length) return 0;
    const positive = attendance.filter((record) => record.status === 'present' || record.status === 'late').length;
    return Math.round((positive / attendance.length) * 100);
  }, [attendance]);

  const attendedAttendanceCount = useMemo(
    () => attendance.filter((record) => record.status === 'present' || record.status === 'late').length,
    [attendance],
  );

  const missedAttendanceCount = useMemo(
    () => attendance.filter((record) => record.status === 'absent').length,
    [attendance],
  );

  const stats = useMemo(() => {
    const pendingHomework = homework.filter((item) => {
      const status = String(item.status ?? item.reviewState ?? '').toLowerCase();
      return !['approved', 'submitted', 'completed'].includes(status);
    }).length;
    return [
      ...(homeworkEnabled ? [{ label: t('student.openHomework'), value: pendingHomework, icon: FiFileText }] : []),
      { label: t('student.upcomingSessions'), value: sessions.length, icon: FiCalendar },
      { label: t('navigation.courses'), value: courses.length, icon: FiBookOpen },
      ...(attendanceEnabled ? [{ label: t('navigation.attendance'), value: attendance.length ? `${attendanceRate}%` : t('states.notSet'), icon: FiCheckCircle }] : []),
      ...(certificatesEnabled ? [{ label: t('navigation.certificates'), value: certificates.length, icon: FiAward }] : []),
    ];
  }, [attendance.length, attendanceEnabled, attendanceRate, certificates.length, certificatesEnabled, courses.length, homework, homeworkEnabled, sessions.length, t]);

  const nextSession = useMemo(() => sessions[0] ?? null, [sessions]);
  const selectedCourse = useMemo(() => (
    courseDetail?.course
      ?? (typeof activeCourseId === 'number'
        ? courses.find((course) => courseId(course) === activeCourseId) ?? null
        : null)
  ), [activeCourseId, courseDetail?.course, courses]);
  const selectedCourseTitle = selectedCourse ? courseTitle(selectedCourse, t('student.courseFallback', { number: 1 })) : '';
  const selectedSession = useMemo(() => {
    if (sessionDetail) return sessionDetail;
    if (typeof activeSessionId !== 'number') return null;
    const combinedSessions = [
      ...sessions,
      ...resources.map((item, index) => normalizeMaterialItem(item, 'resource', index).session),
      ...recordings.map((item, index) => normalizeMaterialItem(item, 'recording', index).session),
    ];
    return combinedSessions.find((session) => sessionId(session) === activeSessionId) ?? null;
  }, [activeSessionId, recordings, resources, sessionDetail, sessions]);
  const selectedSessionTitle = selectedSession?.title ?? selectedSession?.sessionTitle ?? '';
  const selectedSessionAttendance = selectedSession && 'attendance' in selectedSession
    ? selectedSession.attendance as AttendanceRecord | null | undefined
    : null;

  const studentWorkItems = useMemo<Array<StudentTaskItem | StudentHomeworkItem>>(() => {
    const taskKeys = new Set(tasks.map((task) => `${task.kind ?? 'activity'}-${task.id ?? ''}`));
    const homeworkNotInTasks = homework.filter((item) => !taskKeys.has(`homework-${item.id ?? ''}`));
    return prioritizeStudentTasks([...tasks, ...homeworkNotInTasks]);
  }, [homework, tasks]);

  const openWorkItems = useMemo(() => sortOpenStudentTasks(studentWorkItems), [studentWorkItems]);
  const todoCounts = useMemo<Record<TodoFilter, number>>(() => {
    return studentWorkItems.reduce<Record<TodoFilter, number>>((counts, task) => {
      counts[taskFilterKey(task)] += 1;
      return counts;
    }, {
      open: 0,
      overdue: 0,
      submitted: 0,
      needs_revision: 0,
      completed: 0,
    });
  }, [studentWorkItems]);
  const sortedWorkItems = useMemo(() => [...studentWorkItems].sort((first, second) => {
    const [firstState, firstDue] = taskSortWeight(first);
    const [secondState, secondDue] = taskSortWeight(second);
    return firstState - secondState || firstDue - secondDue;
  }), [studentWorkItems]);
  const filteredWorkItems = useMemo(() => (
    view === 'today'
      ? sortedWorkItems.slice(0, 3)
      : sortedWorkItems.filter((task) => taskFilterKey(task) === todoFilter)
  ), [sortedWorkItems, todoFilter, view]);
  const actionableTaskCount = todoCounts.open + todoCounts.overdue + todoCounts.needs_revision;
  const nextActionTask = sortedWorkItems.find((task) => ['needs_revision', 'overdue', 'open'].includes(taskFilterKey(task))) ?? null;

  const nextHomework = useMemo(() => {
    return homework.find((item) => {
      const status = String(item.status ?? item.reviewState ?? '').toLowerCase();
      return !['approved', 'completed', 'submitted'].includes(status);
    }) ?? homework[0] ?? null;
  }, [homework]);

  const featuredTask = openWorkItems[0] ?? studentWorkItems[0] ?? null;
  const primaryTask = featuredTask ?? nextHomework;
  const dateText = (value?: string | null, fallback = t('student.dateNotScheduled')) => displayDate(value, fallback);
  const dueText = (value?: string | null) => dueLabel(value, (date) => t('student.due', { date }), t('student.noDueDate'));
  const statusLabel = (value: string | null | undefined, fallback: string) => {
    const status = String(value ?? '').trim();
    return status ? enumLabel(status, {
      ...commonStatusLabelKeys,
      approved: 'homework.reviewApproved',
      completed: 'student.completed',
      draft: 'courses.draft',
      pending: 'student.pending',
      rejected: 'homework.reviewRejected',
      submitted: 'student.submitted',
    }, t) : fallback;
  };
  const activityTypeLabel = (value: string | number | boolean | null | undefined, fallback: string) => {
    return value === null || value === undefined || value === '' ? fallback : enumLabel(value, activityTypeLabelKeys, t);
  };
  const progressText = (value: number) => progressLabel(value, {
    completed: t('student.completed'),
    notStarted: t('student.notStarted'),
    inProgress: t('student.inProgress'),
  });
  const primaryAction = nextSession?.liveJoinUrl
    ? {
      kind: 'session' as const,
      eyebrow: t('student.continueLearning'),
      title: nextSession.title ?? nextSession.sessionTitle ?? t('student.joinSession'),
      detail: `${displayText(nextSession.courseTitle, t('student.courseNotSet'))} · ${dateText(sessionStartsAt(nextSession))}`,
      action: <a className="primary-link-button" href={nextSession.liveJoinUrl} target="_blank" rel="noreferrer">{t('student.joinSession')}</a>,
      icon: FiClock,
    }
    : primaryTask
      ? {
        kind: 'task' as const,
        eyebrow: t('student.continueLearning'),
        title: primaryTask.title ?? t('student.openYourNextTask'),
        detail: `${displayText(taskContext(primaryTask), t('student.courseNotSet'))} · ${dueText(studentTaskDueDate(primaryTask))}`,
        action: <button type="button" onClick={() => selectTask(primaryTask)}>{t('student.startTask')}</button>,
        icon: FiCheckCircle,
      }
      : {
        kind: 'clear' as const,
        eyebrow: t('student.continueLearning'),
        title: t('student.nothingDueTitle'),
        detail: t('student.nothingDueDetail'),
        action: <span className="status-badge approved">{t('student.clear')}</span>,
        icon: FiCheckCircle,
      };

  const progressCourses = progressSummary?.courses?.length ? progressSummary.courses : courses;
  const averageProgress = useMemo(() => {
    if (!progressCourses.length) return 0;
    const total = progressCourses.reduce((sum, course) => sum + (course.progressPercent ?? course.progress ?? 0), 0);
    return Math.round(total / progressCourses.length);
  }, [progressCourses]);
  const progressGuidance = progressCourses.length
    ? averageProgress <= 0
      ? t('student.progressStartHint')
      : averageProgress >= 100
        ? t('student.progressCompleteHint')
        : t('student.progressContinueHint')
    : t('student.progressEnrollments');
  const firstProgressCourse = progressCourses[0] ?? null;
  const firstProgressCourseId = firstProgressCourse?.courseId ?? firstProgressCourse?.id;
  const firstProgressCourseTitle = firstProgressCourse?.title ?? firstProgressCourse?.courseTitle ?? t('student.courseProgress');
  const progressNextDetail = firstProgressCourse
    ? averageProgress <= 0
      ? t('student.progressOpenFirstCourse')
      : t('student.progressResumeCourse')
    : t('student.progressEnrollments');
  const progressSummaryItems = [
    {
      label: t('student.averageProgressLabel'),
      value: `${averageProgress}%`,
      detail: progressGuidance,
      icon: FiPlayCircle,
    },
    {
      label: t('navigation.courses'),
      value: String(progressCourses.length || courses.length),
      detail: t((progressCourses.length || courses.length) === 1 ? 'student.activeCourse' : 'student.activeCourses'),
      icon: FiBookOpen,
    },
    ...(attendanceEnabled ? [{
      label: t('navigation.attendance'),
      value: attendance.length ? `${attendedAttendanceCount}/${attendance.length}` : t('states.notSet'),
      detail: attendance.length
        ? t('student.attendanceRatio', { attended: attendedAttendanceCount, total: attendance.length })
        : t('student.noAttendanceTitle'),
      icon: FiCheckCircle,
    }] : []),
    ...(certificatesEnabled ? [{
      label: t('navigation.certificates'),
      value: String(certificates.length),
      detail: certificates.length ? t('student.certificatesIssued', { count: certificates.length }) : t('student.certificatesEmptyTitle'),
      icon: FiAward,
    }] : []),
  ];
  const certificateCourseOptions = useMemo(() => {
    const options = new Map<string, string>();
    progressCourses.forEach((course) => {
      const id = course.courseId ?? course.id;
      const title = course.courseTitle ?? course.title;
      if (id && title) options.set(String(id), title);
    });
    certificates.forEach((certificate) => {
      if (certificate.courseId && certificate.courseTitle) {
        options.set(String(certificate.courseId), certificate.courseTitle);
      }
    });
    return Array.from(options.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((first, second) => first.label.localeCompare(second.label));
  }, [certificates, progressCourses]);
  const supportCourseOptions = useMemo(() => {
    const options = new Map<string, string>();
    courses.forEach((course) => {
      const id = courseId(course);
      const title = courseTitle(course, '');
      if (id && title) options.set(String(id), title);
    });
    sessions.forEach((session) => {
      if (session.courseId && session.courseTitle) options.set(String(session.courseId), session.courseTitle);
    });
    return Array.from(options.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((first, second) => first.label.localeCompare(second.label));
  }, [courses, sessions]);
  const supportSessionOptions = useMemo(() => {
    return sessions
      .filter((session) => supportForm.courseId === 'none' || String(session.courseId) === supportForm.courseId)
      .map((session, index) => ({
        value: String(session.id ?? session.sessionId ?? ''),
        label: `${session.title ?? session.sessionTitle ?? t('student.sessionFallback', { number: index + 1 })}${sessionStartsAt(session) ? ` · ${formatDate(sessionStartsAt(session))}` : ''}`,
      }))
      .filter((session) => session.value);
  }, [sessions, supportForm.courseId, t]);
  const hasActiveCertificateFilter = certificateStatusFilter !== 'all' || certificateCourseFilter !== 'all';
  const materialItems = useMemo<StudentMaterialListItem[]>(() => [
    ...resources.map((item, index) => normalizeMaterialItem(item, 'resource', index)),
    ...recordings.map((item, index) => normalizeMaterialItem(item, 'recording', index)),
  ].filter(({ session }) => isStudentVisibleMaterialSession(session)), [recordings, resources]);
  const materialCourseOptions = useMemo(() => {
    const options = new Map<string, string>();
    courses.forEach((course) => {
      const id = courseId(course);
      const title = courseTitle(course, '');
      if (id && title) options.set(String(id), title);
    });
    materialItems.forEach(({ session }) => {
      if (!session.courseTitle) return;
      options.set(String(session.courseId ?? session.courseTitle), session.courseTitle);
    });
    return Array.from(options.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((first, second) => first.label.localeCompare(second.label));
  }, [courses, materialItems]);
  const materialGroupOptions = useMemo(() => {
    const options = new Map<string, string>();
    courses.forEach((course) => {
      if (!course.groupName) return;
      options.set(String(course.groupId ?? course.groupName), course.groupName);
    });
    materialItems.forEach(({ session }) => {
      if (!session.groupName) return;
      options.set(String(session.groupId ?? session.groupName), session.groupName);
    });
    return Array.from(options.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((first, second) => first.label.localeCompare(second.label));
  }, [courses, materialItems]);
  const materialLessonOptions = useMemo(() => {
    const options = new Map<string, string>();
    materialItems.forEach(({ session, material }) => {
      const lessonId = session.lessonId ?? material?.lessonId;
      const lessonTitle = session.lessonTitle ?? material?.lessonTitle;
      if (!lessonTitle) return;
      options.set(lessonId ? String(lessonId) : lessonTitle, lessonTitle);
    });
    return Array.from(options.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((first, second) => first.label.localeCompare(second.label));
  }, [materialItems]);
  const materialSessionOptions = useMemo(() => {
    const options = new Map<string, string>();
    materialItems.forEach(({ session }, index) => {
      const id = sessionId(session);
      if (!id) return;
      const title = session.sessionTitle ?? session.title ?? t('student.sessionFallback', { number: index + 1 });
      const startsAt = sessionStartsAt(session);
      options.set(String(id), `${title}${startsAt ? ` · ${formatDate(startsAt)}` : ''}`);
    });
    return Array.from(options.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((first, second) => first.label.localeCompare(second.label));
  }, [materialItems, t]);
  const materialCourseSelectOptions = useMemo(
    () => materialFilterOptionsWithActive(materialCourseOptions, materialCourseFilter, materialCourseFilter),
    [materialCourseFilter, materialCourseOptions],
  );
  const materialGroupSelectOptions = useMemo(
    () => materialFilterOptionsWithActive(materialGroupOptions, materialGroupFilter, materialGroupFilter),
    [materialGroupFilter, materialGroupOptions],
  );
  const materialSessionSelectOptions = useMemo(
    () => materialFilterOptionsWithActive(
      materialSessionOptions,
      materialSessionFilter,
      t('student.sessionFallback', { number: materialSessionFilter }),
    ),
    [materialSessionFilter, materialSessionOptions, t],
  );
  const materialLessonSelectOptions = useMemo(
    () => materialFilterOptionsWithActive(materialLessonOptions, materialLessonFilter, materialLessonFilter),
    [materialLessonFilter, materialLessonOptions],
  );
  const filteredMaterialItems = useMemo(() => materialItems.filter(({ kind, session, material }) => {
    if (materialFilter === 'resources' && kind !== 'resource') return false;
    if (materialFilter === 'recordings' && kind !== 'recording') return false;
    if (materialCourseFilter !== 'all' && String(session.courseId ?? session.courseTitle) !== materialCourseFilter) return false;
    if (materialGroupFilter !== 'all' && String(session.groupId ?? session.groupName) !== materialGroupFilter) return false;
    if (materialSessionFilter !== 'all' && String(sessionId(session) ?? '') !== materialSessionFilter) return false;
    if (materialLessonFilter !== 'all' && materialLessonValue(session, material) !== materialLessonFilter) return false;
    return true;
  }), [materialCourseFilter, materialFilter, materialGroupFilter, materialItems, materialLessonFilter, materialSessionFilter]);
  const visibleMaterialItems = useMemo(() => filteredMaterialItems.slice(0, materialVisibleCount), [filteredMaterialItems, materialVisibleCount]);
  const canLoadMoreMaterials = materialVisibleCount < filteredMaterialItems.length || (materialFilter !== 'recordings' && hasMoreResources) || (materialFilter !== 'resources' && hasMoreRecordings);
  const loadedMaterialTotal = filteredMaterialItems.length;
  const serverMaterialTotal = materialFilter === 'resources'
    ? resourceTotal
    : materialFilter === 'recordings'
      ? recordingTotal
      : resourceTotal + recordingTotal;
  const materialDisplayTotal = Math.max(loadedMaterialTotal, serverMaterialTotal);
  const hasActiveMaterialFilter = materialFilter !== 'all' || materialCourseFilter !== 'all' || materialGroupFilter !== 'all' || materialSessionFilter !== 'all' || materialLessonFilter !== 'all';
  const showMaterialToolbar = materialItems.length > 0 || materialCourseSelectOptions.length > 0 || materialGroupSelectOptions.length > 0 || materialSessionSelectOptions.length > 0 || materialLessonSelectOptions.length > 0 || hasActiveMaterialFilter;
  const selectedCourseSessions = useMemo(() => {
    if (courseDetail?.sessions?.length) return courseDetail.sessions;
    if (typeof activeCourseId === 'number') return sessions;
    if (!selectedCourseTitle) return [];
    return sessions.filter((session) => session.courseTitle === selectedCourseTitle);
  }, [activeCourseId, courseDetail?.sessions, selectedCourseTitle, sessions]);
  const selectedCourseMaterials = useMemo(() => {
    if (Array.isArray(courseDetail?.materials) || Array.isArray(courseDetail?.recordings)) {
      return [
        ...(courseDetail?.materials ?? []).map((item, index) => normalizeMaterialItem(item, 'resource', index)),
        ...(courseDetail.recordings ?? []).map((item, index) => normalizeMaterialItem(item, 'recording', index)),
      ].filter(({ session }) => isStudentVisibleMaterialSession(session));
    }
    if (typeof activeCourseId === 'number') return materialItems.slice(0, 20);
    if (!selectedCourseTitle) return [];
    return materialItems.filter(({ session }) => session.courseTitle === selectedCourseTitle).slice(0, 8);
  }, [activeCourseId, courseDetail?.materials, courseDetail?.recordings, materialItems, selectedCourseTitle]);
  const selectedCourseTasks = useMemo(() => {
    if (courseDetail?.tasks?.length) return courseDetail.tasks;
    if (typeof activeCourseId === 'number') return studentWorkItems.slice(0, 20);
    if (!selectedCourseTitle) return [];
    return studentWorkItems.filter((task) => taskContext(task) === selectedCourseTitle).slice(0, 8);
  }, [activeCourseId, courseDetail?.tasks, selectedCourseTitle, studentWorkItems]);
  const selectedSessionTasks = useMemo(() => {
    if (sessionDetail?.tasks?.length || sessionDetail?.homework?.length) {
      return [...(sessionDetail.tasks ?? []), ...(sessionDetail.homework ?? [])];
    }
    if (typeof activeSessionId !== 'number') return [];
    return studentWorkItems.filter((task) => task.sessionId === activeSessionId);
  }, [activeSessionId, sessionDetail?.homework, sessionDetail?.tasks, studentWorkItems]);
  const selectedSessionMaterials = useMemo(() => {
    if (typeof activeSessionId !== 'number') return [];
    return materialItems.filter(({ session }) => sessionId(session) === activeSessionId);
  }, [activeSessionId, materialItems]);
  const selectedCourseProgress = courseDetail?.progress?.progressPercent ?? selectedCourse?.progressPercent ?? selectedCourse?.progress ?? 0;
  const gradedTasks = useMemo(() => progressSummary?.gradedTasks?.length ? progressSummary.gradedTasks : progressSummary?.recentFeedback ?? [], [progressSummary?.gradedTasks, progressSummary?.recentFeedback]);
  const selectedTaskRequirements = taskSubmissionRequirements(selectedTask);
  const selectedTaskIsQuiz = selectedTask && isActivityTask(selectedTask) && (selectedTask.kind === 'quiz' || selectedTask.taskType === 'quiz');
  const selectedQuizTotal = selectedTaskIsQuiz
    ? selectedTask.questions?.length ?? 0
    : 0;
  const selectedQuizAnswered = selectedTaskIsQuiz
    ? selectedTask.questions?.filter((question) => (quizAnswers[question.id] ?? []).length > 0).length ?? 0
    : 0;
  const canSubmitSelectedTask = selectedTaskIsQuiz
    ? selectedQuizTotal > 0 && selectedQuizAnswered === selectedQuizTotal
    : (selectedTaskRequirements.allowText && Boolean(submitForm.answerText.trim()))
      || (selectedTaskRequirements.allowLink && Boolean(submitForm.linkUrl.trim()))
      || (selectedTaskRequirements.allowFile && Boolean(submitForm.attachmentUrl.trim() || submitForm.attachmentKey.trim()));
  const PrimaryActionIcon = primaryAction.icon;
  const visibleNotifications = notifications.slice(0, 3);
  const visibleReminders = reminders.slice(0, 4);
  const nextSessionKey = sessionId(nextSession);
  const visibleTodaySessions = sessions
    .filter((session) => !nextSessionKey || sessionId(session) !== nextSessionKey)
    .slice(0, 4);
  const hasTodayUpdates = visibleNotifications.length > 0 || visibleReminders.length > 0;
  const reminderDetail = (reminder: StudentReminder) => {
    if (reminder.kind === 'session') return t('student.sessionScheduled');
    if (reminder.kind === 'task') return t('student.taskWaiting');
    return reminder.message ?? '';
  };
  const reminderActionLabel = (reminder: StudentReminder) => {
    if (reminder.kind === 'session') return t('student.sessionDetails');
    if (reminder.kind === 'task') return t('student.startTask');
    return t('student.open');
  };
  const pageTitle = {
    today: t('student.today'),
    todo: t('student.tasks'),
    courses: t('navigation.courses'),
    courseDetail: selectedCourseTitle || t('student.courseDetail'),
    sessionDetail: selectedSessionTitle || t('student.sessionDetail'),
    materials: t('student.materials'),
    progress: t('student.progress'),
    help: t('student.help'),
  }[view];
  const pageHeaderActions = view === 'courseDetail'
    ? <Link className="secondary-link-button student-back-link" to="/student/courses"><FiArrowLeft aria-hidden="true" /> {t('student.backToCourses')}</Link>
    : view === 'sessionDetail'
      ? <Link className="secondary-link-button student-back-link" to="/student/today"><FiArrowLeft aria-hidden="true" /> {t('student.backToToday')}</Link>
      : undefined;
  const sectionError = (section: StudentSectionError, label: string) => (
    sectionErrors.has(section)
      ? <ErrorState message={t('student.sectionCouldNotLoad', { section: label })} action={<button type="button" className="secondary-button" onClick={retryStudentLoad}>{t('actions.retry')}</button>} />
      : null
  );
  const taskActionLabel = (state: TodoFilter) => {
    if (state === 'needs_revision') return t('student.resubmitTask');
    if (state === 'submitted') return t('student.viewSubmission');
    if (state === 'completed') return t('student.viewResult');
    return t('student.startTask');
  };
  const taskStateLabel = (state: TodoFilter) => t(`student.taskFilter.${state}`);
  const taskDueClass = (task: StudentTaskItem | StudentHomeworkItem, state: TodoFilter) => {
    if (!studentTaskDueDate(task)) return 'no-deadline';
    return state;
  };
  const taskDueSummary = (task: StudentTaskItem | StudentHomeworkItem, state: TodoFilter) => {
    const dueAt = studentTaskDueDate(task);
    if (!dueAt) return t('student.noDueDate');
    if (state === 'overdue') return t('student.overdueSince', { date: formatDate(dueAt) });
    return dueText(dueAt);
  };
  const taskSummaryText = actionableTaskCount
    ? [
        t('student.taskSummaryTodo', { count: actionableTaskCount }),
        todoCounts.overdue ? t('student.taskSummaryOverdue', { count: todoCounts.overdue }) : '',
        todoCounts.needs_revision ? t('student.taskSummaryRevision', { count: todoCounts.needs_revision }) : '',
      ].filter(Boolean).join(' · ')
    : t('student.tasksNoUrgentDeadlines');
  const taskSection = (
    <section className={`content-section student-task-section ${view === 'todo' ? 'student-task-page-section' : ''}`}>
      <div className="section-heading-row">
        <div>
          <h2>{t('student.tasks')}</h2>
          <span>{taskSummaryText}</span>
        </div>
      </div>
      {sectionError('tasks', t('student.tasks')) ?? (
        <>
          {view === 'todo' && studentWorkItems.length ? (
            <div className="student-task-summary-strip">
              <div>
                <strong>{nextActionTask ? t('student.nextTaskLabel', { title: nextActionTask.title ?? t('student.task') }) : t('student.allCaughtUp')}</strong>
                <span>{nextActionTask ? taskDueSummary(nextActionTask, taskFilterKey(nextActionTask)) : t('student.tasksNoUrgentDeadlines')}</span>
              </div>
            </div>
          ) : null}
          {view === 'todo' && studentWorkItems.length ? (
            <CountFilterRow
              className="student-filter-row student-task-filter-row"
              ariaLabel={t('student.taskFilters')}
              items={(['needs_revision', 'overdue', 'open', 'submitted', 'completed'] as const).map((key) => ({
                key,
                label: t(`student.taskFilter.${key}`),
                count: todoCounts[key],
                active: todoFilter === key,
              }))}
              onSelect={setTodoFilter}
            />
          ) : null}
          {!studentWorkItems.length ? <EmptyState title={t('student.tasksEmptyTitle')} detail={t('student.tasksEmptyDetail')} /> : !filteredWorkItems.length ? (
            <EmptyState title={t('student.tasksFilteredEmptyTitle')} detail={t('student.tasksFilteredEmptyDetail')} />
          ) : (
            <div className="student-task-list">
              {filteredWorkItems.map((task, index) => {
                const state = taskFilterKey(task);
                const title = task.title ?? (isActivityTask(task) ? activityTypeLabel(task.type, t('student.activity')) : t('student.homeworkFallback', { number: index + 1 }));
                const courseTitle = taskCourseTitle(task);
                const sessionTitle = taskSessionTitle(task);
                const showSessionTitle = Boolean(sessionTitle && sessionTitle !== courseTitle);
                const score = taskSubmission(task)?.score ?? (isActivityTask(task) ? taskAttempt(task)?.score : null);
                return (
                  <article className={`student-task-card state-${state}${task === nextActionTask ? ' is-next-task' : ''}`} key={task.id ?? index}>
                    <div className="student-task-main">
                      <div className="student-task-title-row">
                        <strong>{title}</strong>
                        {state === 'open' ? null : <span className={`status-badge ${statusClass(state)}`}>{taskStateLabel(state)}</span>}
                      </div>
                      <div className="student-task-meta">
                        <span className="student-task-course"><FiBookOpen aria-hidden="true" />{displayText(courseTitle || taskContext(task), t('student.courseNotSet'))}</span>
                        {showSessionTitle ? <span className="student-task-session"><FiCalendar aria-hidden="true" />{sessionTitle}</span> : null}
                        <span className={`student-task-due ${taskDueClass(task, state)}`}><FiClock aria-hidden="true" /> {dueText(studentTaskDueDate(task))}</span>
                        <small>{isActivityTask(task) ? activityTypeLabel(task.type ?? task.taskType ?? task.activityType, t('student.activity')) : t('navigation.homework')}</small>
                      </div>
                      {taskSubmission(task)?.reviewComment ? <small className="student-task-feedback">{t('student.review')}: {taskSubmission(task)?.reviewComment}</small> : null}
                      {score != null ? (
                        <small className="student-task-score">{t('student.score')}: {score}</small>
                      ) : null}
                    </div>
                    <div className="student-task-action">
                      <button
                        type="button"
                        className={`student-task-start-button${view === 'today' && primaryTask && task.id === primaryTask.id ? ' secondary' : ''}`}
                        onClick={() => selectTask(task)}
                      >
                        {taskActionLabel(state)}
                      </button>
                    </div>
                  </article>
                );
              })}
              {view === 'todo' && filteredWorkItems.length === studentWorkItems.length ? (
                <p className="student-task-list-note">{t('student.tasksListComplete')}</p>
              ) : null}
            </div>
          )}
        </>
      )}
    </section>
  );
  const todayOverview = (
    <>
      <section className="student-home-hero">
        <div className="student-home-main">
          <article className="student-priority-card">
            <div className="student-priority-icon"><PrimaryActionIcon /></div>
            <div className="student-priority-copy">
              <span className="eyebrow">{t('student.todayPriority')}</span>
              <h2>{primaryAction.title}</h2>
              <p>{primaryAction.detail}</p>
            </div>
            <div className="student-priority-actions">{primaryAction.action}</div>
          </article>

          <section className="student-summary-strip" aria-label={t('student.learningSummary')}>
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <article className="student-summary-item" key={stat.label}>
                  <Icon aria-hidden="true" />
                  <span>{stat.label}</span>
                  <strong>{stat.value}</strong>
                </article>
              );
            })}
          </section>
        </div>

        <div className="student-home-side">
          <article className="student-compact-card">
            <div className="student-panel-heading compact">
              <FiClock />
              <h2>{t('student.nextLiveSession')}</h2>
            </div>
            <strong>{nextSession?.title ?? nextSession?.sessionTitle ?? t('student.noUpcomingSession')}</strong>
            <span>{nextSession ? `${displayText(nextSession.courseTitle, t('student.courseNotSet'))} · ${dateText(sessionStartsAt(nextSession))}` : t('student.nothingDueDetail')}</span>
            <div className="student-compact-actions">
              {nextSession?.liveJoinUrl ? (
                <a className="secondary-link-button" href={nextSession.liveJoinUrl} target="_blank" rel="noreferrer">{t('student.joinSession')}</a>
              ) : nextSession && sessionId(nextSession) ? (
                <Link className="secondary-link-button" to={`/student/sessions/${sessionId(nextSession)}`}>{t('student.sessionDetails')}</Link>
              ) : (
                <span className="status-badge approved">{t('student.clear')}</span>
              )}
            </div>
          </article>

          <article className="student-compact-card student-home-progress-card">
            <div className="student-panel-heading compact">
              <FiPlayCircle />
              <h2>{t('student.courseProgress')}</h2>
            </div>
            <strong>{averageProgress}% {t('student.averageProgress')}</strong>
            <span>{progressGuidance}</span>
            <div className="progress-cell student-focus-progress">
              <span style={{ width: `${Math.max(0, Math.min(100, averageProgress))}%` }} />
            </div>
          </article>
        </div>
      </section>
    </>
  );
  const updatesSection = (
    <section className="content-section full student-updates-section">
      <div className="section-heading-row">
        <div className="student-panel-heading">
          <FiBell />
          <h2>{t('student.updates')}</h2>
        </div>
        {notificationUnreadCount ? (
          <button type="button" className="secondary-button" onClick={markAllNotificationsRead}>{t('student.markAllRead')}</button>
        ) : <span className="status-badge approved">{t('student.allCaughtUp')}</span>}
      </div>
      {sectionError('notifications', t('student.notifications')) ?? sectionError('reminders', t('student.reminders')) ?? (!hasTodayUpdates ? (
        <EmptyState title={t('student.updatesEmptyTitle')} detail={t('student.updatesEmptyDetail')} />
      ) : (
        <div className="student-update-list">
          {visibleReminders.map((reminder, index) => (
            <article className="student-update-row" key={`reminder-${reminder.id ?? index}`}>
              <div className="student-update-type"><FiClock /></div>
              <div>
                <strong>{reminder.title ?? t('student.reminder')}</strong>
                <span>{displayText(reminder.courseTitle, t('student.courseNotSet'))} · {dateText(reminder.dueAt, t('student.noDueDate'))}</span>
                {reminderDetail(reminder) ? <small>{reminderDetail(reminder)}</small> : null}
              </div>
              {reminder.actionUrl ? <Link className="secondary-link-button" to={reminder.actionUrl}>{reminderActionLabel(reminder)}</Link> : null}
            </article>
          ))}
          {visibleNotifications.map((notification, index) => (
            <article className={`student-update-row ${notification.isRead ? 'read' : 'unread'}`} key={`notification-${notification.id ?? index}`}>
              <div className="student-update-type"><FiBell /></div>
              <div>
                <strong>{notification.title ?? t('student.notification')}</strong>
                <span>{notification.body ?? displayText(notification.type, t('student.notification'))}</span>
                <small>{dateText(notification.createdAt, t('student.dateNotScheduled'))}</small>
              </div>
              <button type="button" className="secondary-button" disabled={notification.isRead} onClick={() => void markNotificationRead(notification)}>
                {notification.isRead ? t('student.read') : t('student.markRead')}
              </button>
            </article>
          ))}
          {notificationPage < notificationTotalPages ? (
            <div className="student-load-more-row">
              <button type="button" className="secondary-button" disabled={loadingMoreNotifications} onClick={() => void loadMoreNotifications()}>
                {loadingMoreNotifications ? t('student.notificationsLoading') : t('student.loadMoreNotifications')}
              </button>
            </div>
          ) : null}
        </div>
      ))}
    </section>
  );

  useEffect(() => {
    setMaterialVisibleCount(12);
  }, [materialCourseFilter, materialFilter]);

  if (studentLoad.loading) return <LoadingState label={t('student.loading')} />;

  return (
    <>
      <PageHeader title={pageTitle} eyebrow={activeTenant?.name} actions={pageHeaderActions} />

      {studentLoad.failed ? (
        <ErrorState
          message={t('student.couldNotLoad')}
          action={<button type="button" className="secondary-button" onClick={retryStudentLoad}>{t('actions.retry')}</button>}
        />
      ) : null}

      {view === 'today' ? todayOverview : null}
      {view === 'today' && visibleTodaySessions.length ? (
        <section className="content-section full student-today-sessions-section">
          <div className="section-heading-row">
            <div className="student-panel-heading">
              <FiCalendar />
              <h2>{t('student.upcomingSessions')}</h2>
            </div>
            <span className="status-badge pending">{t('student.upcomingSessionsCount', { count: sessions.length })}</span>
          </div>
          {sectionError('sessions', t('student.upcomingSessions')) ?? (
            <div className="student-today-session-grid">
              {visibleTodaySessions.map((session, index) => {
                const currentSessionId = sessionId(session);
                const sessionTitle = session.title ?? session.sessionTitle ?? t('student.sessionFallback', { number: index + 1 });
                return (
                  <article className="student-today-session-card" key={currentSessionId ?? index}>
                    <div>
                      <strong>{sessionTitle}</strong>
                      <span>{displayText(session.courseTitle, t('student.courseNotSet'))}</span>
                      <small><FiClock aria-hidden="true" />{dateText(sessionStartsAt(session))}</small>
                    </div>
                    <div className="student-today-session-actions">
                      {session.liveJoinUrl ? (
                        <a className="primary-link-button" href={session.liveJoinUrl} target="_blank" rel="noreferrer">{t('student.joinSession')}</a>
                      ) : currentSessionId ? (
                        <Link className="secondary-link-button" to={`/student/sessions/${currentSessionId}`}>{t('student.sessionDetails')}</Link>
                      ) : (
                        <span className="status-badge pending">{t('student.pending')}</span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {view === 'progress' ? (
      <section className="student-progress-summary" aria-label={t('student.learningHealth')}>
        {progressSummaryItems.map((item) => {
          const Icon = item.icon;
          return (
            <article className="student-progress-summary-item" key={item.label}>
              <Icon aria-hidden="true" />
              <div>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.detail}</small>
              </div>
            </article>
          );
        })}
      </section>
      ) : null}

      {view === 'progress' ? (
        <section className="student-progress-next-step" aria-label={t('student.progressNextStep')}>
          <div className="student-priority-icon">
            <FiPlayCircle aria-hidden="true" />
          </div>
          <div className="student-progress-next-copy">
            <span>{t('student.progressNextStep')}</span>
            <strong>{firstProgressCourse ? firstProgressCourseTitle : t('student.coursesEmptyTitle')}</strong>
            <p>{progressNextDetail}</p>
          </div>
          {firstProgressCourseId ? (
            <Link className="primary-link-button" to={`/student/courses/${firstProgressCourseId}`}>{t('student.openCourse')}</Link>
          ) : (
            <span className="status-badge pending">{t('student.notStarted')}</span>
          )}
        </section>
      ) : null}

      {view === 'today' ? taskSection : null}
      {view === 'today' ? updatesSection : null}

      {view === 'todo' ? taskSection : null}

      <div className="student-workspace-grid">
        {view === 'courses' ? (
        <section className="content-section full student-courses-section">
          <div className="student-panel-heading">
            <FiBookOpen />
            <h2>{t('student.myCourses')}</h2>
          </div>
          {sectionError('courses', t('navigation.courses')) ?? (!courses.length ? <EmptyState title={t('student.coursesEmptyTitle')} detail={t('student.coursesEmptyDetail')} /> : (
            <div className="student-course-grid">
              {courses.map((course, index) => {
                const progress = course.progressPercent ?? course.progress ?? 0;
                const id = courseId(course);
                const normalizedProgress = Math.max(0, Math.min(100, progress));
                return (
                  <article className="student-course-card" key={course.id ?? course.courseId ?? index}>
                    <div className="student-course-card-main">
                      <strong>{courseTitle(course, t('student.courseFallback', { number: index + 1 }))}</strong>
                      <span>{displayText(course.groupName, t('student.groupNotAssigned'))}</span>
                      <div className="student-course-badges">
                        <span className="status-badge approved">{statusLabel(course.status, t('student.activeStatus'))}</span>
                        <span>{progressLabel(normalizedProgress, { completed: t('student.completed'), notStarted: t('student.notStarted'), inProgress: t('student.inProgress') })}</span>
                      </div>
                    </div>
                    <div className="student-course-progress" aria-label={t('student.courseProgress')}>
                      <div className="student-course-progress-track">
                        <span style={{ width: `${normalizedProgress}%` }} />
                      </div>
                      <strong>{Math.round(normalizedProgress)}%</strong>
                    </div>
                    <div className="student-course-actions">
                      {id ? <Link className="primary-link-button" to={`/student/courses/${id}`}>{t('student.openCourse')}</Link> : null}
                    </div>
                  </article>
                );
              })}
            </div>
          ))}
        </section>
        ) : null}

        {view === 'courseDetail' ? (
          selectedCourse ? (
            <>
              <section className="content-section full">
                <div className="student-detail-header">
                  <div>
                    <span className="eyebrow">{t('student.courseDetail')}</span>
                    <h2>{selectedCourseTitle}</h2>
                    <p>{displayText(selectedCourse.groupName, t('student.groupNotAssigned'))}</p>
                  </div>
                  <div className="progress-cell">
                    <span style={{ width: `${Math.max(0, Math.min(100, selectedCourseProgress))}%` }} />
                    <strong>{Math.round(selectedCourseProgress)}%</strong>
                  </div>
                </div>
              </section>

              <section className="content-section">
                <div className="student-panel-heading">
                  <FiCalendar />
                  <h2>{t('student.upcomingSessions')}</h2>
                </div>
                {!selectedCourseSessions.length ? <EmptyState title={t('student.sessionsEmptyTitle')} detail={t('student.sessionsEmptyDetail')} /> : (
                  <div className="stack-list">
                    {selectedCourseSessions.map((session, index) => {
                      const currentSessionId = sessionId(session);
                      return (
                      <article className="stack-list-item" key={currentSessionId ?? index}>
                        <div>
                          <strong>{session.title ?? session.sessionTitle ?? t('student.sessionFallback', { number: index + 1 })}</strong>
                          <span>{dateText(sessionStartsAt(session))}</span>
                          <small>{displayText(session.groupName, t('student.groupNotSet'))}</small>
                        </div>
                        <div className="student-material-actions">
                          {currentSessionId ? <Link className="secondary-link-button" to={`/student/sessions/${currentSessionId}`}>{t('student.sessionDetails')}</Link> : null}
                          {session.liveJoinUrl ? <a className="secondary-link-button" href={session.liveJoinUrl} target="_blank" rel="noreferrer">{t('student.join')}</a> : null}
                        </div>
                      </article>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="content-section">
                <div className="student-panel-heading">
                  <FiCheckCircle />
                  <h2>{t('student.tasks')}</h2>
                </div>
                {!selectedCourseTasks.length ? <EmptyState title={t('student.tasksEmptyTitle')} detail={t('student.tasksEmptyDetail')} /> : (
                  <div className="stack-list">
                    {selectedCourseTasks.map((task, index) => (
                      <article className="stack-list-item" key={task.id ?? index}>
                        <div>
                          <strong>{task.title ?? (isActivityTask(task) ? activityTypeLabel(task.type, t('student.activity')) : t('student.homeworkFallback', { number: index + 1 }))}</strong>
                          <span>{dueText(studentTaskDueDate(task))}</span>
                          <span className={`status-badge ${statusClass(isActivityTask(task) ? task.status : task.reviewState ?? task.status)}`}>{statusLabel(isActivityTask(task) ? task.status : task.reviewState ?? task.status, t('student.open'))}</span>
                        </div>
                        <button type="button" className="secondary-button" onClick={() => selectTask(task)}>{t('student.open')}</button>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section className="content-section full">
                <div className="student-panel-heading">
                  <FiFileText />
                  <h2>{t('student.materials')}</h2>
                </div>
                {sectionError('materials', t('student.materials')) ?? (!selectedCourseMaterials.length ? <EmptyState title={t('student.materialsEmptyTitle')} detail={t('student.materialsEmptyDetail')} /> : (
                  <div className="stack-list">
                    {selectedCourseMaterials.map(({ kind, session, key, material }, index) => {
                      const currentSessionId = sessionId(session);
                      const title = (kind === 'resource' ? material?.title ?? session.sessionTitle ?? session.title : session.sessionTitle ?? session.title ?? material?.title) ?? (kind === 'recording' ? t('student.recording') : t('student.sessionFallback', { number: index + 1 }));
                      const typeText = kind === 'recording' ? t('student.recording') : displayText(material?.type, t('student.resource'));
                      const documentUrl = kind === 'resource' ? material?.url : typeof session.url === 'string' ? session.url : null;
                      const context = [displayText(session.courseTitle, t('student.courseNotSet')), session.sessionTitle ?? session.title].filter(Boolean).join(' · ');
                      return (
                      <article className="stack-list-item" key={key}>
                        <div>
                          <strong>{title}</strong>
                          <span>{dateText(sessionStartsAt(session))}</span>
                          <small>{typeText}</small>
                        </div>
                        <div className="student-material-actions">
                          {currentSessionId ? <Link className="secondary-link-button" to={`/student/sessions/${currentSessionId}`}>{t('student.sessionDetails')}</Link> : null}
                          {documentUrl ? (
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => openDocumentPreview({ title, url: documentUrl, typeText, context })}
                            >
                              {t('student.open')}
                            </button>
                          ) : null}
                        </div>
                      </article>
                      );
                    })}
                  </div>
                ))}
              </section>
            </>
          ) : (
            <section className="content-section full">
              {sectionError('courseDetail', t('student.courseDetail')) ?? <EmptyState title={t('student.courseNotFoundTitle')} detail={t('student.courseNotFoundDetail')} action={<Link className="secondary-link-button" to="/student/courses">{t('navigation.courses')}</Link>} />}
            </section>
          )
        ) : null}

        {view === 'sessionDetail' ? (
          selectedSession ? (
            <>
              <section className="content-section full">
                <div className="student-detail-header">
                  <div>
                    <span className="eyebrow">{displayText(selectedSession.courseTitle, t('student.courseNotSet'))}</span>
                    <h2>{selectedSessionTitle || t('student.sessionFallback', { number: 1 })}</h2>
                    <p>{dateText(sessionStartsAt(selectedSession))} · {displayText(selectedSession.groupName, t('student.groupNotSet'))}</p>
                  </div>
                  {selectedSession.liveJoinUrl ? <a className="primary-link-button" href={selectedSession.liveJoinUrl} target="_blank" rel="noreferrer">{t('student.joinSession')}</a> : null}
                </div>
              </section>

              {attendanceEnabled && selectedSessionAttendance !== null ? (
                <section className="content-section">
                  <div className="student-panel-heading">
                    <FiCheckCircle />
                    <h2>{t('navigation.attendance')}</h2>
                  </div>
                  {selectedSessionAttendance ? (
                    <article className="stack-list-item">
                      <div>
                        <strong>{statusLabel(selectedSessionAttendance.status, t('student.pending'))}</strong>
                        <span>{dateText(selectedSessionAttendance.sessionDate ?? sessionStartsAt(selectedSession))}</span>
                        {selectedSessionAttendance.notes ? <small>{selectedSessionAttendance.notes}</small> : null}
                      </div>
                      <span className={`status-badge ${statusClass(selectedSessionAttendance.status)}`}>{statusLabel(selectedSessionAttendance.status, t('student.pending'))}</span>
                    </article>
                  ) : (
                    <EmptyState title={t('student.noAttendanceTitle')} detail={t('student.noAttendanceDetail')} />
                  )}
                </section>
              ) : null}

              <section className="content-section">
                <div className="student-panel-heading">
                  <FiFileText />
                  <h2>{t('student.materials')}</h2>
                </div>
                {sectionError('materials', t('student.materials')) ?? (!selectedSessionMaterials.length && !selectedSession.materials?.length && !selectedSession.url && !('recordingUrl' in selectedSession && selectedSession.recordingUrl) ? <EmptyState title={t('student.materialsEmptyTitle')} detail={t('student.materialsEmptyDetail')} /> : (
                  <div className="stack-list">
                    {selectedSession.materials?.map((material, index) => {
                      const title = material.title ?? displayText(material.type, t('student.resource'));
                      const typeText = displayText(material.type, t('student.resource'));
                      const context = [displayText(selectedSession.courseTitle, t('student.courseNotSet')), selectedSessionTitle].filter(Boolean).join(' · ');
                      return (
                      <article className="stack-list-item" key={`${material.url ?? material.title}-${index}`}>
                        <div>
                          <strong>{title}</strong>
                          <span>{typeText}</span>
                        </div>
                        {material.url ? (
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => openDocumentPreview({ title, url: material.url!, typeText, context })}
                          >
                            {t('student.open')}
                          </button>
                        ) : null}
                      </article>
                      );
                    })}
                    {!selectedSession.materials?.length ? selectedSessionMaterials.map(({ kind, key, material }) => {
                      const title = material?.title ?? (kind === 'recording' ? t('student.recording') : t('student.resource'));
                      const typeText = kind === 'recording' ? t('student.recording') : displayText(material?.type, t('student.resource'));
                      const context = [displayText(selectedSession.courseTitle, t('student.courseNotSet')), selectedSessionTitle].filter(Boolean).join(' · ');
                      return (
                      <article className="stack-list-item" key={key}>
                        <div>
                          <strong>{title}</strong>
                          <span>{typeText}</span>
                        </div>
                        {material?.url ? (
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => openDocumentPreview({ title, url: material.url!, typeText, context })}
                          >
                            {t('student.open')}
                          </button>
                        ) : null}
                      </article>
                      );
                    }) : null}
                    {(selectedSession.url || ('recordingUrl' in selectedSession && selectedSession.recordingUrl)) ? (
                      <article className="stack-list-item">
                        <div>
                          <strong>{t('student.recording')}</strong>
                          <span>{dateText(sessionStartsAt(selectedSession))}</span>
                        </div>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => openDocumentPreview({
                            title: t('student.recording'),
                            url: String(selectedSession.url ?? ('recordingUrl' in selectedSession ? selectedSession.recordingUrl ?? '' : '')),
                            typeText: t('student.recording'),
                            context: [displayText(selectedSession.courseTitle, t('student.courseNotSet')), selectedSessionTitle].filter(Boolean).join(' · '),
                          })}
                        >
                          {t('student.open')}
                        </button>
                      </article>
                    ) : null}
                  </div>
                ))}
              </section>

              <section className="content-section">
                <div className="student-panel-heading">
                  <FiCheckCircle />
                  <h2>{t('student.tasks')}</h2>
                </div>
                {!selectedSessionTasks.length ? <EmptyState title={t('student.tasksEmptyTitle')} detail={t('student.tasksEmptyDetail')} /> : (
                  <div className="stack-list">
                    {selectedSessionTasks.map((task, index) => (
                      <article className="stack-list-item" key={task.id ?? index}>
                        <div>
                          <strong>{task.title ?? (isActivityTask(task) ? activityTypeLabel(task.type, t('student.activity')) : t('student.homeworkFallback', { number: index + 1 }))}</strong>
                          <span>{dueText(studentTaskDueDate(task))}</span>
                          <span className={`status-badge ${statusClass(isActivityTask(task) ? task.status : task.reviewState ?? task.status)}`}>{statusLabel(isActivityTask(task) ? task.status : task.reviewState ?? task.status, t('student.open'))}</span>
                        </div>
                        <button type="button" className="secondary-button" onClick={() => selectTask(task)}>{t('student.open')}</button>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </>
          ) : (
            <section className="content-section full">
              {sectionError('sessionDetail', t('student.sessionDetail')) ?? <EmptyState title={t('student.sessionNotFoundTitle')} detail={t('student.sessionNotFoundDetail')} action={<Link className="secondary-link-button" to="/student/today">{t('student.today')}</Link>} />}
            </section>
          )
        ) : null}

        {view === 'materials' ? (
        <section className="content-section full student-materials-section">
          <div className="student-materials-summary">
            <div>
              <strong>{t('student.materialsAvailable', { count: materialDisplayTotal })}</strong>
              <span>{t('student.materialsLibraryHint')}</span>
            </div>
          </div>
          {showMaterialToolbar ? (
            <div className="student-filter-toolbar">
              <div className="segmented-control" aria-label={t('student.materialTypeFilter')}>
                {(['all', 'resources', 'recordings'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={materialFilter === option ? 'active' : ''}
                    onClick={() => setMaterialFilter(option)}
                  >
                    {t(`student.materialFilter.${option}`)}
                  </button>
                ))}
              </div>
              {materialCourseSelectOptions.length || materialCourseFilter !== 'all' ? (
                <label>
                  {t('student.courseFilter')}
                  <select value={materialCourseFilter} onChange={(event) => setMaterialCourseFilter(event.target.value)}>
                    <option value="all">{t('student.allCourses')}</option>
                    {materialCourseSelectOptions.map((course) => <option key={course.value} value={course.value}>{course.label}</option>)}
                  </select>
                </label>
              ) : null}
              {materialGroupSelectOptions.length || materialGroupFilter !== 'all' ? (
                <label>
                  {t('student.groupFilter')}
                  <select value={materialGroupFilter} onChange={(event) => setMaterialGroupFilter(event.target.value)}>
                    <option value="all">{t('student.allGroups')}</option>
                    {materialGroupSelectOptions.map((group) => <option key={group.value} value={group.value}>{group.label}</option>)}
                  </select>
                </label>
              ) : null}
              {materialSessionSelectOptions.length || materialSessionFilter !== 'all' ? (
                <label>
                  {t('student.sessionFilter')}
                  <select value={materialSessionFilter} onChange={(event) => setMaterialSessionFilter(event.target.value)}>
                    <option value="all">{t('student.allSessions')}</option>
                    {materialSessionSelectOptions.map((session) => <option key={session.value} value={session.value}>{session.label}</option>)}
                  </select>
                </label>
              ) : null}
              {materialLessonSelectOptions.length || materialLessonFilter !== 'all' ? (
                <label>
                  {t('student.lessonFilter')}
                  <select value={materialLessonFilter} onChange={(event) => setMaterialLessonFilter(event.target.value)}>
                    <option value="all">{t('student.allLessons')}</option>
                    {materialLessonSelectOptions.map((lesson) => <option key={lesson.value} value={lesson.value}>{lesson.label}</option>)}
                  </select>
                </label>
              ) : null}
            </div>
          ) : null}
          {sectionError('materials', t('student.materials')) ?? (!materialItems.length && !hasActiveMaterialFilter ? <EmptyState title={t('student.materialsEmptyTitle')} detail={t('student.materialsEmptyDetail')} /> : !filteredMaterialItems.length ? (
            <EmptyState title={t('student.materialsFilteredEmptyTitle')} detail={t('student.materialsFilteredEmptyDetail')} />
          ) : (
            <div className="student-material-list">
              {visibleMaterialItems.map((item, index) => {
                const { kind, session, key } = item;
                const title = materialTitle(item, kind === 'recording' ? t('student.recording') : t('student.sessionFallback', { number: index + 1 }));
                const typeText = materialTypeText(item, kind === 'recording' ? t('student.recording') : t('student.resource'));
                const openUrl = materialUrl(item);
                const sessionTitle = session.sessionTitle ?? session.title;
                const showSessionTitle = Boolean(sessionTitle && sessionTitle !== title);
                const lessonTitle = session.lessonTitle ?? item.material?.lessonTitle;
                const addedAt = sessionStartsAt(session);
                const courseLabel = displayText(session.courseTitle, t('student.courseNotSet'));
                const MaterialIcon = kind === 'recording' ? FiPlayCircle : FiFileText;
                return (
                <article className="student-material-row" key={key}>
                  <div className="student-material-type" aria-hidden="true">
                    <MaterialIcon />
                    <span>{typeText}</span>
                  </div>
                  <div className="student-material-copy">
                    <div className="student-material-title-row">
                      <strong>{title}</strong>
                      {isRecentlyAdded(addedAt) ? <span className="student-material-new-badge">{t('student.newMaterial')}</span> : null}
                    </div>
                    <div className="student-material-context">
                      <span><FiBookOpen aria-hidden="true" />{courseLabel}</span>
                      {lessonTitle ? <span><FiBookOpen aria-hidden="true" />{lessonTitle}</span> : null}
                      {showSessionTitle ? <span><FiCalendar aria-hidden="true" />{sessionTitle}</span> : null}
                      <span>{kind === 'recording' ? t('student.recordingMaterial') : t('student.fileMaterial')}</span>
                      {addedAt ? <span>{t('student.addedOn', { date: dateText(addedAt) })}</span> : null}
                    </div>
                  </div>
                  <div className="student-material-actions">
                    {openUrl ? (
                      <button
                        type="button"
                        className="primary-link-button"
                        onClick={() => openDocumentPreview({
                          title,
                          url: openUrl,
                          typeText,
                          context: [courseLabel, lessonTitle, showSessionTitle ? sessionTitle : null].filter(Boolean).join(' · '),
                        })}
                      >
                        <FiExternalLink aria-hidden="true" />
                        {t('student.openMaterial')}
                      </button>
                    ) : null}
                    {sessionId(session) ? <Link className="secondary-link-button subtle" to={`/student/sessions/${sessionId(session)}`}><FiBookOpen aria-hidden="true" />{t('student.relatedLesson')}</Link> : null}
                  </div>
                </article>
              );
              })}
              {canLoadMoreMaterials || materialDisplayTotal > 1 ? (
              <div className="student-pagination-row student-material-pagination">
                <span>{t('student.showingMaterials', { shown: visibleMaterialItems.length, total: materialDisplayTotal })}</span>
                {canLoadMoreMaterials ? (
                  <button type="button" className="secondary-button" disabled={loadingMoreMaterials} onClick={() => void loadMoreMaterials()}>
                    {loadingMoreMaterials ? t('student.loadingMoreMaterials') : t('student.loadMoreMaterials')}
                  </button>
                ) : null}
              </div>
              ) : null}
            </div>
          ))}
        </section>
        ) : null}

        {view === 'progress' ? (
          <section className="content-section">
            <div className="student-panel-heading">
              <FiPlayCircle />
              <h2>{t('student.courseProgress')}</h2>
            </div>
            {sectionError('progress', t('student.progress')) ?? (!progressCourses.length ? <EmptyState title={t('student.coursesEmptyTitle')} detail={t('student.progressEnrollments')} /> : (
              <div className="stack-list">
	                {progressCourses.map((course, index) => {
	                  const progress = course.progressPercent ?? course.progress ?? 0;
                    const normalizedProgress = Math.max(0, Math.min(100, progress));
                    const id = course.courseId ?? course.id;
	                  return (
	                    <article className={`student-progress-course-row${normalizedProgress <= 0 ? ' not-started' : ''}`} key={course.id ?? course.courseId ?? index}>
	                      <div className="student-progress-course-copy">
	                        <strong>{course.title ?? course.courseTitle ?? t('student.courseFallback', { number: index + 1 })}</strong>
	                        <span>{displayText(course.groupName, t('student.groupNotAssigned'))}</span>
	                        <small>{progressText(progress)}{typeof course.attendanceRate === 'number' ? ` · ${t('navigation.attendance')} ${Math.round(course.attendanceRate)}%` : ''}</small>
                          <div className="student-progress-track" aria-label={t('student.courseProgress')}>
                            <span style={{ width: `${normalizedProgress}%` }} />
                          </div>
	                      </div>
	                      <div className="student-progress-course-side">
	                        <strong>{Math.round(progress)}%</strong>
                          {id ? <Link className="secondary-link-button subtle" to={`/student/courses/${id}`}>{t('student.openCourse')}</Link> : null}
	                      </div>
	                    </article>
	                  );
                })}
              </div>
            ))}
          </section>
        ) : null}

        {attendanceEnabled && view === 'progress' ? (
          <section className="content-section student-progress-attendance-section">
            <div className="student-panel-heading">
              <FiCheckCircle />
              <h2>{t('navigation.attendance')}</h2>
            </div>
            {sectionError('attendance', t('navigation.attendance')) ?? (!attendance.length ? <EmptyState title={t('student.noAttendanceTitle')} detail={t('student.noAttendanceDetail')} /> : (
	              <>
	                <div className="student-attendance-summary">
	                  <strong>{t('student.attendanceRatio', { attended: attendedAttendanceCount, total: attendance.length })}</strong>
	                  <span>{missedAttendanceCount ? t('student.missedSessions', { count: missedAttendanceCount }) : t('student.attendanceClear')}</span>
	                </div>
                <div className="stack-list">
                  {attendance.slice(0, 6).map((record, index) => (
                    <article className="stack-list-item" key={record.id ?? `${record.sessionId}-${index}`}>
                      <div>
                        <strong>{dateText(record.sessionDate)}</strong>
                        <span>{t('student.sessionAttendance')}</span>
                        {record.notes ? <span>{record.notes}</span> : null}
                      </div>
                      <span className={`status-badge ${statusClass(record.status)}`}>{statusLabel(record.status, t('student.open'))}</span>
                    </article>
                  ))}
                </div>
              </>
            ))}
          </section>
        ) : null}

        {view === 'progress' && gradedTasks.length ? (
          <section className="content-section">
            <div className="student-panel-heading">
              <FiCheckCircle />
              <h2>{t('student.gradeHistory')}</h2>
            </div>
            <div className="stack-list">
              {gradedTasks.slice(0, 8).map((task, index) => (
                <article className="stack-list-item" key={task.id ?? index}>
                  <div>
                    <strong>{task.title ?? t('student.activity')}</strong>
                    <span>{displayText(task.courseTitle, t('student.courseNotSet'))} · {dueText(task.dueAt)}</span>
                    {taskSubmission(task)?.reviewComment ? <span>{taskSubmission(task)?.reviewComment}</span> : null}
                  </div>
                  <span className="status-badge approved">{taskSubmission(task)?.score ?? taskAttempt(task)?.score ?? statusLabel(task.status, t('student.completed'))}</span>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {certificatesEnabled && view === 'progress' ? (
          <section className={`content-section student-certificates-section${!certificates.length ? ' certificate-quiet-empty' : ''}`}>
            <div className="student-panel-heading">
              <FiAward />
              <h2>{t('navigation.certificates')}</h2>
            </div>
            {certificates.length || hasActiveCertificateFilter ? (
            <div className="student-filter-toolbar student-certificate-filter-toolbar">
              <div className="segmented-control" aria-label={t('navigation.certificates')}>
                {(['all', 'issued', 'pending', 'rejected', 'revoked'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={certificateStatusFilter === option ? 'active' : ''}
                    onClick={() => setCertificateStatusFilter(option)}
                  >
                    {t(`student.certificateFilter.${option}`)}
                  </button>
                ))}
              </div>
              {certificateCourseOptions.length ? (
                <label>
                  {t('student.courseFilter')}
                  <select value={certificateCourseFilter} onChange={(event) => setCertificateCourseFilter(event.target.value)}>
                    <option value="all">{t('student.allCourses')}</option>
                    {certificateCourseOptions.map((course) => <option key={course.value} value={course.value}>{course.label}</option>)}
                  </select>
                </label>
              ) : null}
            </div>
            ) : null}
            {sectionError('certificates', t('navigation.certificates')) ?? (!certificates.length ? <EmptyState title={t('student.certificatesEmptyTitle')} detail={t('student.certificatesEmptyDetail')} /> : (
              <div className="stack-list">
                {certificates.map((certificate, index) => (
                  <article className="stack-list-item" key={certificate.id ?? certificate.publicId ?? index}>
                    <div>
                      <strong>{certificate.courseTitle ?? certificate.publicId ?? t('student.certificateFallback', { number: index + 1 })}</strong>
                      <span>{dateText(certificate.issuedAt, t('student.notIssuedYet'))}</span>
                      <span className={`status-badge ${statusClass(certificate.status)}`}>{statusLabel(certificate.status, t('student.pending'))}</span>
                    </div>
                    <div className="student-certificate-actions">
                      {certificate.verificationUrl ? (
                        <a className="secondary-link-button" href={certificate.verificationUrl} target="_blank" rel="noreferrer">{t('student.verify')}</a>
                      ) : null}
                      {certificate.downloadUrl ? (
                        <button type="button" className="secondary-button" onClick={() => void downloadCertificatePdf(certificate.downloadUrl!, `certificate-${certificate.publicId ?? certificate.id ?? 'issued'}.pdf`).catch(() => toast.error(t('student.certificateNoDownload')))}>
                          {t('student.download')}
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}
                {certificatePage < certificateTotalPages ? (
                  <div className="student-pagination-row">
                    <button type="button" className="secondary-button" disabled={loadingMoreCertificates} onClick={() => void loadMoreCertificates()}>
                      {loadingMoreCertificates ? t('student.loadingMoreMaterials') : t('certificates.showMoreCertificates')}
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </section>
        ) : null}

        {view === 'help' ? (
          <section className="content-section full student-help-section">
            <div className="student-help-header">
              <div className="student-panel-heading">
              <FiHelpCircle />
              <h2>{t('student.helpTitle')}</h2>
              </div>
              <p>{t('student.helpIntro')}</p>
            </div>
            <div className="student-help-layout">
            <form className="student-support-form" onSubmit={submitSupportRequest}>
              <div className="student-support-form-heading">
                <strong>{t('student.sendSupportRequest')}</strong>
                <span>{t('student.supportFormHint')}</span>
              </div>
              {sectionError('supportOptions', t('student.supportOptions'))}
              <div className="two-col">
                <label>
                  {t('student.supportCategoryPrompt')}
                  <select value={supportForm.category} onChange={(event) => setSupportForm((current) => ({ ...current, category: event.target.value }))}>
                    {(supportOptions?.categories?.length ? supportOptions.categories : ['general', 'course', 'task', 'schedule', 'access']).map((option) => {
                      const value = supportOptionValue(option);
                      return <option key={value} value={value}>{supportOptionLabel(option, t)}</option>;
                    })}
                  </select>
                </label>
                <label>
                  {t('student.supportPriorityPrompt')}
                  <select value={supportForm.priority} onChange={(event) => setSupportForm((current) => ({ ...current, priority: event.target.value as 'high' | 'medium' | 'low' }))}>
                    {(supportOptions?.priorities?.length ? supportOptions.priorities : ['medium', 'high', 'low']).map((option) => {
                      const value = supportOptionValue(option) as 'high' | 'medium' | 'low';
                      return <option key={value} value={value}>{supportOptionLabel(option, t)}</option>;
                    })}
                  </select>
                </label>
                <label>
                  {t('student.supportCoursePrompt')}
                  <select
                    value={supportForm.courseId}
                    onChange={(event) => setSupportForm((current) => ({ ...current, courseId: event.target.value, sessionId: 'none' }))}
                  >
                    <option value="none">{t('student.supportNoCourse')}</option>
                    {supportCourseOptions.map((course) => <option key={course.value} value={course.value}>{course.label}</option>)}
                  </select>
                </label>
                <label>
                  {t('student.supportSessionPrompt')}
                  <select
                    value={supportForm.sessionId}
                    onChange={(event) => setSupportForm((current) => ({ ...current, sessionId: event.target.value }))}
                    disabled={!supportSessionOptions.length}
                  >
                    <option value="none">{supportSessionOptions.length ? t('student.supportNoSession') : t('student.supportNoSessionsAvailable')}</option>
                    {supportSessionOptions.map((session) => <option key={session.value} value={session.value}>{session.label}</option>)}
                  </select>
                </label>
              </div>
              <label>
                {t('student.supportMessagePrompt')}
                <textarea
                  value={supportForm.message}
                  onChange={(event) => setSupportForm((current) => ({ ...current, message: event.target.value }))}
                  rows={5}
                  placeholder={t('student.supportMessagePlaceholder')}
                />
              </label>
              <div className="student-support-form-footer">
                <span className={supportMessageLength ? 'ready' : ''}>
                  {supportMessageLength ? t('student.supportMessageReady') : t('student.supportMessageRequired')}
                </span>
                <small>{t('student.supportMessageCharacters', { count: supportMessageLength })}</small>
              </div>
              <div className="modal-actions">
                <button type="submit" disabled={!canSubmitSupportRequest}>{submitting ? t('student.submitting') : t('student.sendSupportRequest')}</button>
              </div>
            </form>

            <aside className="student-help-side">
              <article className="student-help-card">
                <strong>{t('student.contactInstructor')}</strong>
                <span>{courses.length ? t('student.contactInstructorDetail') : t('student.contactInstructorNoCourses')}</span>
                {courses.length ? <span className="status-badge approved">{courses.length} {t(courses.length === 1 ? 'student.activeCourse' : 'student.activeCourses')}</span> : null}
              </article>
              <article className="student-help-card">
                <strong>{t('student.contactSupport')}</strong>
                <span>{t('student.contactSupportDetail')}</span>
                {supportOptions?.supportEmail || activeTenant?.email || activeTenant?.contactEmail ? (
                  <a className="secondary-link-button" href={`mailto:${supportOptions?.supportEmail ?? activeTenant?.contactEmail ?? activeTenant?.email}`}>{t('student.emailSupport')}</a>
                ) : (
                  <span className="muted-text">{t('student.supportContactMissing')}</span>
                )}
              </article>
              <article className="student-help-card">
                <strong>{t('student.blockedLearning')}</strong>
                <span>{t('student.blockedLearningDetail')}</span>
              </article>
            </aside>

            <section className="student-support-history">
              <div className="section-heading-row">
                <div>
                  <h2>{t('student.supportRequestHistory')}</h2>
                  <span>{supportRequests.length ? t('student.supportRequestHistoryDetail') : t('student.supportRequestHistoryEmptyHint')}</span>
                </div>
              </div>
              {sectionError('supportRequests', t('student.supportRequestHistory')) ?? (supportRequests.length ? (
                <div className="stack-list">
                  {supportRequests.map((request, index) => (
                    <article className="stack-list-item" key={request.id ?? index}>
                      <div>
                        <strong>{request.message || t('student.supportRequest')}</strong>
                        <span>{supportOptionLabel(request.category ?? t('student.supportCategory'), t)} · {dateText(request.createdAt, t('student.dateNotScheduled'))}</span>
                      </div>
                      <span className={`status-badge ${statusClass(request.status)}`}>{statusLabel(request.status, t('student.pending'))}</span>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="student-support-empty">
                  <div>
                    <strong>{t('student.supportRequestsEmptyTitle')}</strong>
                    <span>{t('student.supportRequestsEmptyDetail')}</span>
                  </div>
                </div>
              ))}
            </section>
            </div>
          </section>
        ) : null}
      </div>

      {selectedMaterialPreview ? (
        <MaterialPreviewModal preview={selectedMaterialPreview} onClose={() => setSelectedMaterialPreview(null)} />
      ) : null}

      {selectedTask ? (
        <FormModal
          labelledBy="student-submit-title"
          className="decision-modal form-modal student-submit-panel"
          onClose={() => setSelectedTask(null)}
          onSubmit={submitSelectedTask}
        >
            <div className="modal-header-block">
              <span>{t('student.submitTask')}</span>
              <h2 id="student-submit-title">{selectedTask.title ?? t('student.submitTask')}</h2>
              <p>{readable(taskContext(selectedTask))} · {dueText(studentTaskDueDate(selectedTask))}</p>
            </div>
            <div className="student-task-brief">
              <strong>{t('student.taskInstructions')}</strong>
              <p className="student-task-description">{formattedStudentTaskDescription(selectedTask.description) || t('student.taskInstructionsFallback')}</p>
            </div>
            {isActivityTask(selectedTask) && (selectedTask.kind === 'quiz' || selectedTask.taskType === 'quiz') ? (
              <>
                <p className={`panel-note ${canSubmitSelectedTask ? 'success' : ''}`}>
                  {selectedQuizTotal ? t('student.questionsAnswered', { answered: selectedQuizAnswered, total: selectedQuizTotal }) : t('student.noQuizQuestions')}
                </p>
                <div className="stack-list">
                  {selectedTask.questions?.map((question) => (
                    <fieldset className="quiz-question" key={question.id}>
                      <legend>{question.prompt}</legend>
                      {question.options.map((option) => (
                        <label className="checkbox-row" key={option.id}>
                          <input
                            type={question.questionMode === 'multiple_choice' ? 'checkbox' : 'radio'}
                            checked={(quizAnswers[question.id] ?? []).includes(option.id)}
                            onChange={() => toggleQuizOption(question.id, option.id, question.questionMode)}
                          />
                          <span><strong>{option.text}</strong></span>
                        </label>
                      ))}
                    </fieldset>
                  ))}
                </div>
              </>
            ) : (
              <>
                {selectedTaskRequirements.allowText ? (
                  <label className="student-answer-field">
                    {t('student.answer')}
                    <textarea
                      value={submitForm.answerText}
                      onChange={(event) => setSubmitForm((current) => ({ ...current, answerText: event.target.value }))}
                      placeholder={t('student.answerPlaceholder')}
                      autoFocus
                    />
                  </label>
                ) : null}
                {selectedTaskRequirements.allowLink || selectedTaskRequirements.allowFile ? (
                  <div className="student-attachment-panel">
                    <div>
                      <strong>{t('student.attachYourWork')}</strong>
                      <span>{t('student.attachYourWorkHint')}</span>
                    </div>
                    {selectedTaskRequirements.allowLink ? (
                      <label>
                        {t('student.attachmentLink')}
                        <input
                          value={submitForm.linkUrl}
                          onChange={(event) => setSubmitForm((current) => ({ ...current, linkUrl: event.target.value }))}
                          placeholder={t('student.attachmentLinkPlaceholder')}
                        />
                      </label>
                    ) : null}
                    {selectedTaskRequirements.allowFile ? (
                      <label className="file-button student-upload-button">
                        {submitting ? t('student.uploading') : t('student.uploadAttachment')}
                        <input
                          type="file"
                          disabled={submitting}
                          accept={selectedTaskRequirements.allowedFileTypes?.join(',') || undefined}
                          onChange={(event) => void uploadAttachment(event.target.files?.[0])}
                        />
                      </label>
                    ) : null}
                    {selectedTaskRequirements.allowFile && submitForm.attachmentUrl ? (
                      <p className="panel-note success">{t('student.uploadedAttachment')}: {submitForm.attachmentUrl}</p>
                    ) : null}
                  </div>
                ) : null}
                {!selectedTaskRequirements.allowText && !selectedTaskRequirements.allowLink && !selectedTaskRequirements.allowFile ? (
                  <p className="panel-note">{t('student.noSubmissionMethods')}</p>
                ) : null}
              </>
            )}
            {taskSubmission(selectedTask)?.reviewComment ? <p className="panel-note">{t('student.review')}: {taskSubmission(selectedTask)?.reviewComment}</p> : null}
            {isActivityTask(selectedTask) && taskAttempt(selectedTask)?.score != null ? <p className="panel-note">{t('student.score')}: {taskAttempt(selectedTask)?.score}</p> : null}
            {taskSubmissionHistory(selectedTask).length ? (
              <div className="student-submission-history">
                <strong>{t('student.submissionHistory')}</strong>
                <div className="stack-list">
                  {taskSubmissionHistory(selectedTask).slice(0, 4).map((submission, index) => (
                    <article className="stack-list-item" key={submission.id ?? `${submission.submittedAt ?? submission.updatedAt ?? index}`}>
                      <div>
                        <span>{dateText(submission.submittedAt ?? submission.updatedAt ?? submission.createdAt, t('student.dateNotScheduled'))}</span>
                        {submission.answerText ? <small>{submission.answerText}</small> : null}
                        {submission.reviewComment ? <small>{t('student.review')}: {submission.reviewComment}</small> : null}
                      </div>
                      <div className="student-material-actions">
                        <span className={`status-badge ${statusClass(submission.status)}`}>{statusLabel(submission.status, t('student.submitted'))}</span>
                        {submission.score != null ? <span className="status-badge approved">{t('student.score')}: {submission.score}</span> : null}
                        {submission.attachmentUrl ? (
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => openDocumentPreview({
                              title: selectedTask.title ?? t('homework.openAttachment'),
                              url: submission.attachmentUrl!,
                              typeText: t('homework.openAttachment'),
                              context: dateText(submission.submittedAt ?? submission.updatedAt ?? submission.createdAt, t('student.dateNotScheduled')),
                            })}
                          >
                            {t('homework.openAttachment')}
                          </button>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="student-submit-readiness">
              <span className={canSubmitSelectedTask ? 'ready' : ''}>
                {canSubmitSelectedTask ? t('student.readyToSubmit') : t('student.submitRequirementHint')}
              </span>
            </div>
            <div className="modal-actions student-submit-actions">
              <button type="button" className="secondary-button" onClick={() => setSelectedTask(null)} disabled={submitting}>{t('student.cancel')}</button>
              <button type="submit" disabled={submitting || !canSubmitSelectedTask}>{submitting ? t('student.submitting') : t('student.submit')}</button>
            </div>
        </FormModal>
      ) : null}
    </>
  );
}
