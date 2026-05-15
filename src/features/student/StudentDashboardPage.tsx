import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiAward, FiBell, FiBookOpen, FiCalendar, FiCheckCircle, FiClock, FiFileText, FiHelpCircle, FiPlayCircle } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../../components/DataState';
import { FormModal } from '../../components/Modal';
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
import { isCurrentStudentLoad, nextStudentLoadId, prioritizeStudentTasks, settledStudentValue, sortOpenStudentTasks, studentTaskDueDate } from './studentDashboardData';

type StudentMaterialListItem = {
  kind: 'resource' | 'recording';
  session: StudentSessionSummary;
  key: string;
  material?: { title?: string; url?: string | null; type?: string };
};

export type StudentDashboardView = 'today' | 'todo' | 'courses' | 'courseDetail' | 'sessionDetail' | 'materials' | 'progress' | 'help';
type TodoFilter = 'open' | 'overdue' | 'submitted' | 'needs_revision' | 'completed';
type MaterialFilter = 'all' | 'resources' | 'recordings';
type CertificateStatusFilter = 'all' | 'issued' | 'pending' | 'rejected' | 'revoked';

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

function supportOptionLabel(option: string | { id?: string; value?: string; label?: string }) {
  return typeof option === 'string' ? readable(option) : option.label ?? readable(option.value ?? option.id);
}

function courseId(course: StudentCourseSummary) {
  return course.courseId ?? course.id;
}

function courseTitle(course: StudentCourseSummary, fallback: string) {
  return course.title ?? course.courseTitle ?? fallback;
}

function sessionId(session: StudentSessionSummary) {
  return session.id;
}

function normalizeMaterialItem(item: StudentSessionSummary | StudentMaterialItem, kind: 'resource' | 'recording', index: number): StudentMaterialListItem {
  if ('sessionId' in item || 'sessionTitle' in item || 'fileName' in item) {
    const flat = item as StudentMaterialItem;
    return {
      kind,
      key: String(flat.id ?? `${kind}-${flat.sessionId ?? 'unknown'}-${index}`),
      session: {
        id: flat.sessionId,
        courseId: flat.courseId,
        title: flat.sessionTitle ?? flat.title,
        sessionTitle: flat.sessionTitle ?? flat.title,
        courseTitle: flat.courseTitle ?? undefined,
        groupName: flat.groupName ?? undefined,
        startsAt: flat.createdAt,
        url: flat.url,
        materials: kind === 'resource' ? [{ title: flat.title, url: flat.url, type: flat.type }] : undefined,
      },
      material: { title: flat.title, url: flat.url, type: flat.type },
    };
  }

  const session = item as StudentSessionSummary;
  return {
    kind,
    key: `${kind}-${session.id ?? index}`,
    session,
    material: kind === 'resource' ? session.materials?.[0] : { title: session.title ?? session.sessionTitle, url: session.url, type: 'recording' },
  };
}

function progressLabel(value: number, labels: { completed: string; notStarted: string; inProgress: string }) {
  if (value >= 100) return labels.completed;
  if (value <= 0) return labels.notStarted;
  return labels.inProgress;
}

function rawTaskStatus(task: StudentTaskItem | StudentHomeworkItem) {
  return String(isActivityTask(task) ? task.status ?? '' : task.reviewState ?? task.status ?? '').toLowerCase();
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

function settledValue<T>(result: PromiseSettledResult<T>, fallback: T) {
  return settledStudentValue(result, fallback);
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
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  const [notificationPage, setNotificationPage] = useState(1);
  const [notificationTotalPages, setNotificationTotalPages] = useState(1);
  const [reminders, setReminders] = useState<StudentReminder[]>([]);
  const [selectedTask, setSelectedTask] = useState<StudentTaskItem | StudentHomeworkItem | null>(null);
  const [submitForm, setSubmitForm] = useState(emptySubmitForm);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number[]>>({});
  const [todoFilter, setTodoFilter] = useState<TodoFilter>('open');
  const [materialFilter, setMaterialFilter] = useState<MaterialFilter>('all');
  const [materialCourseFilter, setMaterialCourseFilter] = useState('all');
  const [materialVisibleCount, setMaterialVisibleCount] = useState(12);
  const [resourcePage, setResourcePage] = useState(1);
  const [recordingPage, setRecordingPage] = useState(1);
  const [certificatePage, setCertificatePage] = useState(1);
  const [certificateTotalPages, setCertificateTotalPages] = useState(1);
  const [hasMoreResources, setHasMoreResources] = useState(false);
  const [hasMoreRecordings, setHasMoreRecordings] = useState(false);
  const [loadingMoreMaterials, setLoadingMoreMaterials] = useState(false);
  const [loadingMoreCertificates, setLoadingMoreCertificates] = useState(false);
  const [certificateStatusFilter, setCertificateStatusFilter] = useState<CertificateStatusFilter>('all');
  const [certificateCourseFilter, setCertificateCourseFilter] = useState('all');
  const [supportForm, setSupportForm] = useState({ category: 'general', priority: 'medium' as 'high' | 'medium' | 'low', message: '' });
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
  const selectedMaterialCourseId = useMemo(() => {
    if (materialCourseFilter === 'all') return undefined;
    const numeric = Number(materialCourseFilter);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined;
  }, [materialCourseFilter]);
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
    const shouldLoadCourses = view === 'today' || view === 'courses' || view === 'help';
    const shouldLoadTasks = view === 'today' || view === 'todo';
    const shouldLoadMaterials = view === 'materials';
    const shouldLoadResourceMaterials = shouldLoadMaterials && materialFilter !== 'recordings';
    const shouldLoadRecordingMaterials = shouldLoadMaterials && materialFilter !== 'resources';
    const shouldLoadProgress = view === 'progress';
    const shouldLoadCertificates = view === 'progress' && certificatesEnabled;
    const shouldLoadCourseDetail = view === 'courseDetail' && typeof activeCourseId === 'number';
    const shouldLoadSessionDetail = view === 'sessionDetail' && typeof activeSessionId === 'number';
    const shouldLoadSupport = view === 'help';
    const shouldLoadNotifications = view === 'today';

    Promise.allSettled([
      shouldLoadHome ? getStudentHome({ limit: 8 }) : Promise.resolve(null),
      shouldLoadCourses ? listStudentCourses() : Promise.resolve([]),
      shouldLoadHome ? listStudentUpcomingSessions({ limit: 6 }) : Promise.resolve([]),
      Promise.resolve([]),
      shouldLoadCertificates ? getStudentCertificatesPage({
        page: 1,
        limit: 20,
        courseId: selectedCertificateCourseId,
        status: certificateStatusFilter === 'all' ? undefined : certificateStatusFilter,
      }) : Promise.resolve({ items: [], page: 1, totalPages: 1 }),
      Promise.resolve([]),
      shouldLoadTasks ? listStudentTasks({ limit: 50 }) : Promise.resolve([]),
      shouldLoadResourceMaterials ? getStudentResourcesPage({ page: 1, limit: 50, courseId: selectedMaterialCourseId }) : Promise.resolve({ items: [], page: 1, totalPages: 1 }),
      shouldLoadRecordingMaterials ? getStudentRecordingsPage({ page: 1, limit: 50, courseId: selectedMaterialCourseId }) : Promise.resolve({ items: [], page: 1, totalPages: 1 }),
      shouldLoadProgress ? getStudentProgressSummary({ limit: 8 }) : Promise.resolve(null),
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
        const nextSessions = settledValue(sessionsResult, []);
        const nextHomework = settledValue(homeworkResult, []);
        const nextCertificatesPage = settledValue(certificatesResult, { items: [], page: 1, totalPages: 1 }) as StudentPagedResponse<StudentCertificateSummary>;
        const nextAttendance = settledValue(attendanceResult, []);
        const nextTasks = settledValue(tasksResult, []);
        const nextResourcesPage = settledValue(resourcesResult, { items: [], page: 1, totalPages: 1 }) as StudentPagedResponse<StudentSessionSummary | StudentMaterialItem>;
        const nextRecordingsPage = settledValue(recordingsResult, { items: [], page: 1, totalPages: 1 }) as StudentPagedResponse<StudentSessionSummary | StudentMaterialItem>;
        const nextResources = nextResourcesPage.items ?? [];
        const nextRecordings = nextRecordingsPage.items ?? [];
        const nextProgress = settledValue(progressResult, null) as StudentProgressSummary | null;
        const nextCourseDetail = settledValue(courseDetailResult, null) as StudentCourseDetail | null;
        const nextSessionDetail = settledValue(sessionDetailResult, null) as StudentSessionDetail | null;
        const nextSupportOptions = settledValue(supportOptionsResult, null) as StudentSupportOptions | null;
        const nextSupportRequests = settledValue(supportRequestsResult, []) as StudentSupportRequest[];
        const nextNotificationsPage = settledValue(notificationsResult, { items: [], page: 1, totalPages: 1 }) as StudentNotificationPage | StudentNotification[];
        const nextNotifications = Array.isArray(nextNotificationsPage) ? nextNotificationsPage : nextNotificationsPage.items ?? [];
        const nextUnreadCount = settledValue(notificationUnreadCountResult, { count: 0 }) as { count?: number; hasUnread?: boolean };
        const nextReminders = settledValue(remindersResult, []) as StudentReminder[];

        setCourses(nextHome?.activeCourses?.length ? nextHome.activeCourses : nextCourseDetail?.course ? [nextCourseDetail.course] : nextProgress?.courses?.length ? nextProgress.courses : nextCourses);
        setSessions(nextHome?.nextSession ? [nextHome.nextSession, ...nextSessions.filter((session: StudentSessionSummary) => session.id !== nextHome.nextSession?.id)] : nextSessions);
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

        const rejectedCount = [homeResult, coursesResult, sessionsResult, homeworkResult, certificatesResult, attendanceResult, tasksResult, resourcesResult, recordingsResult, progressResult, courseDetailResult, sessionDetailResult, supportOptionsResult, supportRequestsResult, notificationsResult, notificationUnreadCountResult, remindersResult]
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
  }, [activeCourseId, activeSessionId, activeTenant?.id, attendanceEnabled, certificateStatusFilter, certificatesEnabled, homeworkEnabled, materialFilter, selectedCertificateCourseId, selectedMaterialCourseId, startStudentLoad, studentReloadToken, succeedStudentLoad, t, view]);

  const reloadStudentData = async () => {
    const [nextHomework, nextTasks] = await Promise.all([
      homeworkEnabled ? listStudentHomework({ limit: 8 }) : Promise.resolve([]),
      listStudentTasks({ limit: 50 }),
    ]);
    setHomework(nextHomework);
    setTasks(homeworkEnabled ? nextTasks : nextTasks.filter((task: StudentTaskItem) => task.kind !== 'homework'));

    if (view === 'courseDetail' && typeof activeCourseId === 'number') {
      setCourseDetail(await getStudentCourseDetail(activeCourseId));
    }
    if (view === 'sessionDetail' && typeof activeSessionId === 'number') {
      setSessionDetail(await getStudentSessionDetail(activeSessionId));
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
          attachmentUrl: submitForm.attachmentKey.trim() || submitForm.attachmentUrl.trim() || submitForm.linkUrl.trim() || undefined,
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
    const matchingTotal = materialItems.filter(({ kind, session }) => {
      if (materialFilter === 'resources' && kind !== 'resource') return false;
      if (materialFilter === 'recordings' && kind !== 'recording') return false;
      if (materialCourseFilter !== 'all' && String(session.courseId ?? session.courseTitle) !== materialCourseFilter) return false;
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
        shouldLoadResources ? getStudentResourcesPage({ page: resourcePage + 1, limit: 50, courseId: selectedMaterialCourseId }) : Promise.resolve({ items: [], page: resourcePage, totalPages: resourcePage }),
        shouldLoadRecordings ? getStudentRecordingsPage({ page: recordingPage + 1, limit: 50, courseId: selectedMaterialCourseId }) : Promise.resolve({ items: [], page: recordingPage, totalPages: recordingPage }),
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

  const missedAttendanceCount = useMemo(
    () => attendance.filter((record) => record.status === 'absent' || record.status === 'late').length,
    [attendance],
  );

  const stats = useMemo(() => {
    const pendingHomework = homework.filter((item) => {
      const status = String(item.status ?? item.reviewState ?? '').toLowerCase();
      return !['approved', 'submitted', 'completed'].includes(status);
    }).length;
    return [
      { label: t('navigation.courses'), value: courses.length, icon: FiBookOpen },
      { label: t('student.upcomingSessions'), value: sessions.length, icon: FiCalendar },
      ...(attendanceEnabled ? [{ label: t('navigation.attendance'), value: attendance.length ? `${attendanceRate}%` : t('states.notSet'), icon: FiCheckCircle }] : []),
      ...(homeworkEnabled ? [{ label: t('student.openHomework'), value: pendingHomework, icon: FiFileText }] : []),
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
  const filteredWorkItems = useMemo(() => (
    view === 'today'
      ? studentWorkItems.slice(0, 3)
      : studentWorkItems.filter((task) => taskFilterKey(task) === todoFilter)
  ), [studentWorkItems, todoFilter, view]);

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
      detail: `${displayText(nextSession.courseTitle, t('student.courseNotSet'))} · ${dateText(nextSession.startsAt)}`,
      action: <a className="primary-link-button" href={nextSession.liveJoinUrl} target="_blank" rel="noreferrer">{t('student.joinSession')}</a>,
      icon: FiClock,
    }
    : primaryTask
      ? {
        kind: 'task' as const,
        eyebrow: t('student.continueLearning'),
        title: primaryTask.title ?? t('student.openYourNextTask'),
        detail: `${displayText(taskContext(primaryTask), t('student.courseNotSet'))} · ${dueText(studentTaskDueDate(primaryTask))}`,
        action: <button type="button" onClick={() => selectTask(primaryTask)}>{t('student.openTask')}</button>,
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

  const averageProgress = useMemo(() => {
    if (!courses.length) return 0;
    const total = courses.reduce((sum, course) => sum + (course.progressPercent ?? course.progress ?? 0), 0);
    return Math.round(total / courses.length);
  }, [courses]);
  const progressCourses = progressSummary?.courses?.length ? progressSummary.courses : courses;
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
  const materialItems = useMemo<StudentMaterialListItem[]>(() => [
    ...resources.map((item, index) => normalizeMaterialItem(item, 'resource', index)),
    ...recordings.map((item, index) => normalizeMaterialItem(item, 'recording', index)),
  ], [recordings, resources]);
  const materialCourseOptions = useMemo(() => {
    const options = new Map<string, string>();
    materialItems.forEach(({ session }) => {
      if (!session.courseTitle) return;
      options.set(String(session.courseId ?? session.courseTitle), session.courseTitle);
    });
    return Array.from(options.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((first, second) => first.label.localeCompare(second.label));
  }, [materialItems]);
  const filteredMaterialItems = useMemo(() => materialItems.filter(({ kind, session }) => {
    if (materialFilter === 'resources' && kind !== 'resource') return false;
    if (materialFilter === 'recordings' && kind !== 'recording') return false;
    if (materialCourseFilter !== 'all' && String(session.courseId ?? session.courseTitle) !== materialCourseFilter) return false;
    return true;
  }), [materialCourseFilter, materialFilter, materialItems]);
  const visibleMaterialItems = useMemo(() => filteredMaterialItems.slice(0, materialVisibleCount), [filteredMaterialItems, materialVisibleCount]);
  const canLoadMoreMaterials = materialVisibleCount < filteredMaterialItems.length || (materialFilter !== 'recordings' && hasMoreResources) || (materialFilter !== 'resources' && hasMoreRecordings);
  const selectedCourseSessions = useMemo(() => {
    if (courseDetail?.sessions?.length) return courseDetail.sessions;
    if (!selectedCourseTitle) return [];
    return sessions.filter((session) => session.courseTitle === selectedCourseTitle);
  }, [courseDetail?.sessions, selectedCourseTitle, sessions]);
  const selectedCourseMaterials = useMemo(() => {
    if (courseDetail?.materials && Array.isArray(courseDetail.materials)) {
      return [
        ...courseDetail.materials.map((item, index) => normalizeMaterialItem(item, 'resource', index)),
        ...(courseDetail.recordings ?? []).map((item, index) => normalizeMaterialItem(item, 'recording', index)),
      ];
    }
    if (!selectedCourseTitle) return [];
    return materialItems.filter(({ session }) => session.courseTitle === selectedCourseTitle).slice(0, 8);
  }, [courseDetail?.materials, courseDetail?.recordings, materialItems, selectedCourseTitle]);
  const selectedCourseTasks = useMemo(() => {
    if (courseDetail?.tasks?.length) return courseDetail.tasks;
    if (!selectedCourseTitle) return [];
    return studentWorkItems.filter((task) => taskContext(task) === selectedCourseTitle).slice(0, 8);
  }, [courseDetail?.tasks, selectedCourseTitle, studentWorkItems]);
  const selectedSessionTasks = useMemo(() => {
    if (sessionDetail?.tasks?.length || sessionDetail?.homework?.length) {
      return [...(sessionDetail.tasks ?? []), ...(sessionDetail.homework ?? [])];
    }
    if (typeof activeSessionId !== 'number') return [];
    return studentWorkItems.filter((task) => task.sessionId === activeSessionId);
  }, [activeSessionId, sessionDetail?.homework, sessionDetail?.tasks, studentWorkItems]);
  const selectedSessionMaterials = useMemo(() => {
    if (typeof activeSessionId !== 'number') return [];
    return materialItems.filter(({ session }) => session.id === activeSessionId);
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
  const pageTitle = {
    today: t('student.today'),
    todo: t('student.toDo'),
    courses: t('navigation.courses'),
    courseDetail: selectedCourseTitle || t('student.courseDetail'),
    sessionDetail: selectedSessionTitle || t('student.sessionDetail'),
    materials: t('student.materials'),
    progress: t('student.progress'),
    help: t('student.help'),
  }[view];

  useEffect(() => {
    setMaterialVisibleCount(12);
  }, [materialCourseFilter, materialFilter]);

  if (studentLoad.loading) return <LoadingState label={t('student.loading')} />;

  return (
    <>
      <PageHeader title={pageTitle} eyebrow={activeTenant?.name} />

      {studentLoad.failed ? (
        <ErrorState
          message={t('student.couldNotLoad')}
          action={<button type="button" className="secondary-button" onClick={retryStudentLoad}>{t('actions.retry')}</button>}
        />
      ) : null}

      {view === 'today' ? (
      <section className="student-focus-grid">
        <article className="student-focus-card primary">
          <div className="student-focus-icon"><PrimaryActionIcon /></div>
          <div>
            <span className="eyebrow">{primaryAction.eyebrow}</span>
            <h2>{primaryAction.title}</h2>
            <p>{primaryAction.detail}</p>
          </div>
          <div className="student-focus-actions">{primaryAction.action}</div>
        </article>

        {primaryAction.kind !== 'session' ? (
        <article className="student-focus-card">
          <div className="student-focus-icon"><FiClock /></div>
          <div>
            <span className="eyebrow">{t('student.nextLiveSession')}</span>
            <h2>{nextSession?.title ?? nextSession?.sessionTitle ?? t('student.noUpcomingSession')}</h2>
            <p>{nextSession ? `${displayText(nextSession.courseTitle, t('student.courseNotSet'))} · ${dateText(nextSession.startsAt)}` : t('student.nothingDueDetail')}</p>
          </div>
          {nextSession?.liveJoinUrl ? (
            <a className="secondary-link-button" href={nextSession.liveJoinUrl} target="_blank" rel="noreferrer">{t('student.join')}</a>
          ) : (
            <span className="muted-text">{nextSession ? readable(nextSession.groupName) : t('student.clear')}</span>
          )}
        </article>
        ) : null}

        <article className="student-focus-card">
          <div className="student-focus-icon"><FiPlayCircle /></div>
          <div>
            <span className="eyebrow">{t('student.courseProgress')}</span>
            <h2>{averageProgress}% {t('student.averageProgress')}</h2>
            <p>{courses.length ? `${courses.length} ${t(courses.length === 1 ? 'student.activeCourse' : 'student.activeCourses')} · ${progressText(averageProgress)}` : t('student.progressEnrollments')}</p>
          </div>
          <div className="progress-cell student-focus-progress">
            <span style={{ width: `${Math.max(0, Math.min(100, averageProgress))}%` }} />
            <strong>{averageProgress}%</strong>
          </div>
        </article>
      </section>
      ) : null}

      {view === 'today' || view === 'progress' ? (
      <div className="stat-grid compact student-stat-grid">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <section className="stat-tile" key={stat.label}>
              <Icon />
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
            </section>
          );
        })}
      </div>
      ) : null}

      {view === 'today' ? (
        <section className="content-section full student-reminder-section">
          <div className="section-heading-row">
            <div className="student-panel-heading">
              <FiBell />
              <h2>{t('student.reminders')}</h2>
            </div>
            <span className="status-badge pending">{t('student.reminderCount', { count: reminders.length })}</span>
          </div>
          {!reminders.length ? <EmptyState title={t('student.remindersEmptyTitle')} detail={t('student.remindersEmptyDetail')} /> : (
            <div className="stack-list">
              {reminders.map((reminder, index) => (
                <article className="stack-list-item student-reminder-item" key={reminder.id ?? index}>
                  <div>
                    <strong>{reminder.title ?? t('student.reminder')}</strong>
                    <span>{displayText(reminder.courseTitle, t('student.courseNotSet'))} · {dateText(reminder.dueAt, t('student.noDueDate'))}</span>
                    {reminder.message ? <small>{reminder.message}</small> : null}
                  </div>
                  <div className="student-material-actions">
                    <span className={`status-badge ${statusClass(reminder.priority ?? reminder.status)}`}>{displayText(reminder.status, t('student.pending'))}</span>
                    {reminder.actionUrl ? <Link className="secondary-link-button" to={reminder.actionUrl}>{t('student.open')}</Link> : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {view === 'today' ? (
        <section className="content-section full student-notification-section">
          <div className="section-heading-row">
            <div className="student-panel-heading">
              <FiBell />
              <h2>{t('student.notifications')}</h2>
            </div>
            {notificationUnreadCount ? (
              <button type="button" className="secondary-button" onClick={markAllNotificationsRead}>{t('student.markAllRead')}</button>
            ) : <span className="status-badge approved">{t('student.allCaughtUp')}</span>}
          </div>
          {!notifications.length ? <EmptyState title={t('student.notificationsEmptyTitle')} detail={t('student.notificationsEmptyDetail')} /> : (
            <>
              <div className="stack-list">
                {notifications.map((notification, index) => (
                  <article className={`stack-list-item student-notification-item ${notification.isRead ? 'read' : 'unread'}`} key={notification.id ?? index}>
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
              </div>
              {notificationPage < notificationTotalPages ? (
                <div className="student-load-more-row">
                  <button type="button" className="secondary-button" disabled={loadingMoreNotifications} onClick={() => void loadMoreNotifications()}>
                    {loadingMoreNotifications ? t('student.notificationsLoading') : t('student.loadMoreNotifications')}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </section>
      ) : null}

      {view === 'today' || view === 'todo' ? (
      <section className="content-section student-task-section">
        <div className="section-heading-row">
          <div>
            <h2>{t('student.tasks')}</h2>
            <span>{t('student.openTasksNeedAttention', { count: openWorkItems.length })}</span>
          </div>
        </div>
        {view === 'todo' && studentWorkItems.length ? (
          <CountFilterRow
            className="student-filter-row"
            ariaLabel={t('student.taskFilters')}
            items={(['open', 'overdue', 'submitted', 'needs_revision', 'completed'] as const).map((key) => ({
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
            {filteredWorkItems.map((task, index) => (
              <article className="student-task-card" key={task.id ?? index}>
                <div>
                  <strong>{task.title ?? (isActivityTask(task) ? activityTypeLabel(task.type, t('student.activity')) : t('student.homeworkFallback', { number: index + 1 }))}</strong>
                  <span>{displayText(taskContext(task), t('student.courseNotSet'))} · {dueText(studentTaskDueDate(task))}</span>
                  <small>{isActivityTask(task) ? activityTypeLabel(task.type ?? task.taskType ?? task.activityType, t('student.activity')) : t('navigation.homework')}</small>
                  {taskSubmission(task)?.reviewComment ? <small>{t('student.review')}: {taskSubmission(task)?.reviewComment}</small> : null}
                  {taskSubmission(task)?.score != null || (isActivityTask(task) && taskAttempt(task)?.score != null) ? (
                    <small>{t('student.score')}: {taskSubmission(task)?.score ?? (isActivityTask(task) ? taskAttempt(task)?.score : null)}</small>
                  ) : null}
                </div>
                <div className="student-task-action">
                  <span className={`status-badge ${statusClass(isActivityTask(task) ? task.status : task.reviewState ?? task.status)}`}>{statusLabel(isActivityTask(task) ? task.status : task.reviewState ?? task.status, t('student.open'))}</span>
                  <button type="button" className="secondary-button" onClick={() => selectTask(task)}>{t('student.open')}</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      ) : null}

      <div className="student-workspace-grid">
        {view === 'courses' ? (
        <section className="content-section">
          <div className="student-panel-heading">
            <FiBookOpen />
            <h2>{t('student.myCourses')}</h2>
          </div>
          {!courses.length ? <EmptyState title={t('student.coursesEmptyTitle')} detail={t('student.coursesEmptyDetail')} /> : (
            <div className="stack-list">
              {courses.slice(0, 6).map((course, index) => {
                const progress = course.progressPercent ?? course.progress ?? 0;
                const id = courseId(course);
                return (
                  <article className="stack-list-item" key={course.id ?? course.courseId ?? index}>
                    <div>
                      <strong>{courseTitle(course, t('student.courseFallback', { number: index + 1 }))}</strong>
                      <span>{displayText(course.groupName, t('student.groupNotAssigned'))}</span>
                      <span>{statusLabel(course.status, t('student.activeStatus'))} · {progressText(progress)}</span>
                    </div>
                    <div className="student-course-actions">
                      <div className="progress-cell">
                        <span style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
                        <strong>{Math.round(progress)}%</strong>
                      </div>
                      {id ? <Link className="secondary-link-button" to={`/student/courses/${id}`}>{t('student.openCourse')}</Link> : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
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
                    {selectedCourseSessions.map((session, index) => (
                      <article className="stack-list-item" key={session.id ?? index}>
                        <div>
                          <strong>{session.title ?? session.sessionTitle ?? t('student.sessionFallback', { number: index + 1 })}</strong>
                          <span>{dateText(session.startsAt)}</span>
                          <small>{displayText(session.groupName, t('student.groupNotSet'))}</small>
                        </div>
                        <div className="student-material-actions">
                          {session.id ? <Link className="secondary-link-button" to={`/student/sessions/${session.id}`}>{t('student.sessionDetails')}</Link> : null}
                          {session.liveJoinUrl ? <a className="secondary-link-button" href={session.liveJoinUrl} target="_blank" rel="noreferrer">{t('student.join')}</a> : null}
                        </div>
                      </article>
                    ))}
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
                {!selectedCourseMaterials.length ? <EmptyState title={t('student.materialsEmptyTitle')} detail={t('student.materialsEmptyDetail')} /> : (
                  <div className="stack-list">
                    {selectedCourseMaterials.map(({ kind, session, key }, index) => (
                      <article className="stack-list-item" key={key}>
                        <div>
                          <strong>{session.sessionTitle ?? session.title ?? (kind === 'recording' ? t('student.recording') : t('student.sessionFallback', { number: index + 1 }))}</strong>
                          <span>{dateText(session.startsAt)}</span>
                          <small>{kind === 'recording' ? t('student.recording') : t('student.resource')}</small>
                        </div>
                        <div className="student-material-actions">
                          {session.id ? <Link className="secondary-link-button" to={`/student/sessions/${session.id}`}>{t('student.sessionDetails')}</Link> : null}
                          {kind === 'recording' && typeof session.url === 'string' ? <a className="secondary-link-button" href={session.url} target="_blank" rel="noreferrer">{t('student.open')}</a> : null}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </>
          ) : (
            <section className="content-section full">
              <EmptyState title={t('student.courseNotFoundTitle')} detail={t('student.courseNotFoundDetail')} action={<Link className="secondary-link-button" to="/student/courses">{t('navigation.courses')}</Link>} />
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
                    <p>{dateText(selectedSession.startsAt)} · {displayText(selectedSession.groupName, t('student.groupNotSet'))}</p>
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
                        <span>{dateText(selectedSessionAttendance.sessionDate ?? selectedSession.startsAt)}</span>
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
                {!selectedSessionMaterials.length && !selectedSession.materials?.length && !selectedSession.url && !('recordingUrl' in selectedSession && selectedSession.recordingUrl) ? <EmptyState title={t('student.materialsEmptyTitle')} detail={t('student.materialsEmptyDetail')} /> : (
                  <div className="stack-list">
                    {selectedSession.materials?.map((material, index) => (
                      <article className="stack-list-item" key={`${material.url ?? material.title}-${index}`}>
                        <div>
                          <strong>{material.title ?? displayText(material.type, t('student.resource'))}</strong>
                          <span>{displayText(material.type, t('student.resource'))}</span>
                        </div>
                        {material.url ? <a className="secondary-link-button" href={material.url} target="_blank" rel="noreferrer">{t('student.open')}</a> : null}
                      </article>
                    ))}
                    {(selectedSession.url || ('recordingUrl' in selectedSession && selectedSession.recordingUrl)) ? (
                      <article className="stack-list-item">
                        <div>
                          <strong>{t('student.recording')}</strong>
                          <span>{dateText(selectedSession.startsAt)}</span>
                        </div>
                        <a className="secondary-link-button" href={String(selectedSession.url ?? ('recordingUrl' in selectedSession ? selectedSession.recordingUrl ?? '' : ''))} target="_blank" rel="noreferrer">{t('student.open')}</a>
                      </article>
                    ) : null}
                  </div>
                )}
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
              <EmptyState title={t('student.sessionNotFoundTitle')} detail={t('student.sessionNotFoundDetail')} action={<Link className="secondary-link-button" to="/student/today">{t('student.today')}</Link>} />
            </section>
          )
        ) : null}

        {view === 'materials' ? (
        <section className="content-section">
          <div className="student-panel-heading">
            <FiFileText />
            <h2>{t('student.materials')}</h2>
          </div>
          {materialItems.length ? (
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
              {materialCourseOptions.length ? (
                <label>
                  {t('student.courseFilter')}
                  <select value={materialCourseFilter} onChange={(event) => setMaterialCourseFilter(event.target.value)}>
                    <option value="all">{t('student.allCourses')}</option>
                    {materialCourseOptions.map((course) => <option key={course.value} value={course.value}>{course.label}</option>)}
                  </select>
                </label>
              ) : null}
            </div>
          ) : null}
          {!materialItems.length ? <EmptyState title={t('student.materialsEmptyTitle')} detail={t('student.materialsEmptyDetail')} /> : !filteredMaterialItems.length ? (
            <EmptyState title={t('student.materialsFilteredEmptyTitle')} detail={t('student.materialsFilteredEmptyDetail')} />
          ) : (
            <div className="stack-list">
              {visibleMaterialItems.map(({ kind, session, key }, index) => (
                <article className="stack-list-item" key={key}>
                  <div>
                    <strong>{session.sessionTitle ?? session.title ?? (kind === 'recording' ? t('student.recording') : t('student.sessionFallback', { number: index + 1 }))}</strong>
                    <span>{displayText(session.courseTitle, t('student.courseNotSet'))} · {dateText(session.startsAt)}</span>
                    <small>{kind === 'recording' ? t('student.recording') : t('student.resource')}</small>
                  </div>
                  <div className="student-material-actions">
                    {session.id ? <Link className="secondary-link-button" to={`/student/sessions/${session.id}`}>{t('student.sessionDetails')}</Link> : null}
                    {kind === 'resource' ? session.materials?.slice(0, 3).map((material, materialIndex) => (
                      material.url ? (
                        <a className="secondary-link-button" key={`${material.url}-${materialIndex}`} href={material.url} target="_blank" rel="noreferrer">
                          {material.title ?? displayText(material.type, t('student.open'))}
                        </a>
                      ) : null
                    )) : null}
                    {kind === 'recording' && typeof session.url === 'string' ? <a className="secondary-link-button" href={session.url} target="_blank" rel="noreferrer">{t('student.open')}</a> : null}
                  </div>
                </article>
              ))}
              <div className="student-pagination-row">
                <span>{t('student.showingMaterials', { shown: visibleMaterialItems.length, total: filteredMaterialItems.length })}</span>
                {canLoadMoreMaterials ? (
                  <button type="button" className="secondary-button" disabled={loadingMoreMaterials} onClick={() => void loadMoreMaterials()}>
                    {loadingMoreMaterials ? t('student.loadingMoreMaterials') : t('student.loadMoreMaterials')}
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </section>
        ) : null}

        {view === 'today' ? (
        <section className="content-section">
          <div className="student-panel-heading">
            <FiCalendar />
            <h2>{t('student.upcomingSessions')}</h2>
          </div>
          {!sessions.length ? <EmptyState title={t('student.sessionsEmptyTitle')} detail={t('student.sessionsEmptyDetail')} /> : (
            <div className="stack-list">
              {sessions.map((session, index) => (
                <article className="stack-list-item" key={session.id ?? index}>
                  <div>
                    <strong>{session.title ?? t('student.sessionFallback', { number: index + 1 })}</strong>
                    <span>{displayText(session.courseTitle, t('student.courseNotSet'))} · {dateText(session.startsAt)}</span>
                    <small>{displayText(session.groupName, t('student.groupNotSet'))}</small>
                  </div>
                  <div className="student-material-actions">
                    {session.id ? <Link className="secondary-link-button" to={`/student/sessions/${session.id}`}>{t('student.sessionDetails')}</Link> : null}
                    {session.liveJoinUrl ? <a className="secondary-link-button" href={session.liveJoinUrl} target="_blank" rel="noreferrer">{t('student.join')}</a> : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
        ) : null}

        {view === 'progress' ? (
          <section className="content-section">
            <div className="student-panel-heading">
              <FiPlayCircle />
              <h2>{t('student.courseProgress')}</h2>
            </div>
            {!progressCourses.length ? <EmptyState title={t('student.coursesEmptyTitle')} detail={t('student.progressEnrollments')} /> : (
              <div className="stack-list">
                {progressCourses.slice(0, 8).map((course, index) => {
                  const progress = course.progressPercent ?? course.progress ?? 0;
                  return (
                    <article className="stack-list-item" key={course.id ?? course.courseId ?? index}>
                      <div>
                        <strong>{course.title ?? course.courseTitle ?? t('student.courseFallback', { number: index + 1 })}</strong>
                        <span>{displayText(course.groupName, t('student.groupNotAssigned'))}</span>
                        <span>{progressText(progress)}{typeof course.attendanceRate === 'number' ? ` · ${t('navigation.attendance')} ${Math.round(course.attendanceRate)}%` : ''}</span>
                        <div className="student-milestone-row">
                          {[0, 50, 100].map((milestone) => (
                            <span className={`student-milestone ${progress >= milestone ? 'complete' : ''}`} key={milestone}>
                              {milestone === 0 ? t('student.milestoneStarted') : milestone === 50 ? t('student.milestoneHalfway') : t('student.milestoneComplete')}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="progress-cell">
                        <span style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
                        <strong>{Math.round(progress)}%</strong>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        ) : null}

        {attendanceEnabled && view === 'progress' ? (
          <section className="content-section">
            <div className="student-panel-heading">
              <FiCheckCircle />
              <h2>{t('navigation.attendance')}</h2>
            </div>
            {!attendance.length ? <EmptyState title={t('student.noAttendanceTitle')} detail={t('student.noAttendanceDetail')} /> : (
              <>
                <div className="student-attendance-summary">
                  <strong>{attendanceRate}%</strong>
                  <span>{missedAttendanceCount} {t('student.attendanceRecent')}</span>
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
            )}
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
          <section className="content-section">
            <div className="student-panel-heading">
              <FiAward />
              <h2>{t('navigation.certificates')}</h2>
            </div>
            <div className="student-filter-toolbar">
              <div className="segmented-control" aria-label={t('navigation.certificates')}>
                {(['all', 'issued', 'pending', 'rejected', 'revoked'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={certificateStatusFilter === option ? 'active' : ''}
                    onClick={() => setCertificateStatusFilter(option)}
                  >
                    {option === 'all' ? t('student.materialFilter.all') : readable(option)}
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
            {!certificates.length ? <EmptyState title={t('student.certificatesEmptyTitle')} detail={t('student.certificatesEmptyDetail')} /> : (
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
            )}
          </section>
        ) : null}

        {view === 'help' ? (
          <section className="content-section full">
            <div className="student-panel-heading">
              <FiHelpCircle />
              <h2>{t('student.helpTitle')}</h2>
            </div>
            <div className="student-help-grid">
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
            </div>
            <form className="student-support-form" onSubmit={submitSupportRequest}>
              <div className="two-col">
                <label>
                  {t('student.supportCategory')}
                  <select value={supportForm.category} onChange={(event) => setSupportForm((current) => ({ ...current, category: event.target.value }))}>
                    {(supportOptions?.categories?.length ? supportOptions.categories : ['general', 'course', 'task', 'schedule', 'access']).map((option) => {
                      const value = supportOptionValue(option);
                      return <option key={value} value={value}>{supportOptionLabel(option)}</option>;
                    })}
                  </select>
                </label>
                <label>
                  {t('student.supportPriority')}
                  <select value={supportForm.priority} onChange={(event) => setSupportForm((current) => ({ ...current, priority: event.target.value as 'high' | 'medium' | 'low' }))}>
                    {(supportOptions?.priorities?.length ? supportOptions.priorities : ['medium', 'high', 'low']).map((option) => {
                      const value = supportOptionValue(option) as 'high' | 'medium' | 'low';
                      return <option key={value} value={value}>{supportOptionLabel(option)}</option>;
                    })}
                  </select>
                </label>
              </div>
              <label>
                {t('student.supportMessage')}
                <textarea value={supportForm.message} onChange={(event) => setSupportForm((current) => ({ ...current, message: event.target.value }))} rows={4} />
              </label>
              <div className="modal-actions">
                <button type="submit" disabled={submitting || !supportForm.message.trim()}>{submitting ? t('student.submitting') : t('student.sendSupportRequest')}</button>
              </div>
            </form>
            {supportRequests.length ? (
              <div className="stack-list">
                {supportRequests.map((request, index) => (
                  <article className="stack-list-item" key={request.id ?? index}>
                    <div>
                      <strong>{request.message || t('student.supportRequest')}</strong>
                      <span>{displayText(request.category, t('student.supportCategory'))} · {dateText(request.createdAt, t('student.dateNotScheduled'))}</span>
                    </div>
                    <span className={`status-badge ${statusClass(request.status)}`}>{statusLabel(request.status, t('student.pending'))}</span>
                  </article>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}
      </div>

      {selectedTask ? (
        <FormModal
          labelledBy="student-submit-title"
          className="decision-modal form-modal student-submit-panel"
          onClose={() => setSelectedTask(null)}
          onSubmit={submitSelectedTask}
        >
            <div className="modal-header-block">
              <span>{statusLabel(isActivityTask(selectedTask) ? selectedTask.status : selectedTask.reviewState ?? selectedTask.status, t('student.open'))}</span>
              <h2 id="student-submit-title">{selectedTask.title ?? t('student.submitTask')}</h2>
              <p>{readable(taskContext(selectedTask))} · {dueText(studentTaskDueDate(selectedTask))}</p>
            </div>
            {selectedTask.description ? <p className="panel-note">{selectedTask.description}</p> : null}
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
                  <label>
                    {t('student.answer')}
                    <textarea value={submitForm.answerText} onChange={(event) => setSubmitForm((current) => ({ ...current, answerText: event.target.value }))} />
                  </label>
                ) : null}
                {selectedTaskRequirements.allowLink ? (
                  <label>
                    {t('student.attachmentLink')}
                    <input value={submitForm.linkUrl} onChange={(event) => setSubmitForm((current) => ({ ...current, linkUrl: event.target.value }))} />
                  </label>
                ) : null}
                {selectedTaskRequirements.allowFile ? (
                  <label className="file-button">
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
                  <p className="panel-note">{t('student.uploadedAttachment')}: {submitForm.attachmentUrl}</p>
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
                        {submission.attachmentUrl ? <a className="secondary-link-button" href={submission.attachmentUrl} target="_blank" rel="noreferrer">{t('homework.openAttachment')}</a> : null}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setSelectedTask(null)} disabled={submitting}>{t('student.cancel')}</button>
              <button type="submit" disabled={submitting || !canSubmitSelectedTask}>{submitting ? t('student.submitting') : t('student.submit')}</button>
            </div>
        </FormModal>
      ) : null}
    </>
  );
}
