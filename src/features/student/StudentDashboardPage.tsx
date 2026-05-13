import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FiAward, FiBookOpen, FiCalendar, FiCheckCircle, FiClock, FiFileText, FiPlayCircle } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState, LoadingState } from '../../components/DataState';
import { FormModal } from '../../components/Modal';
import {
  downloadCertificatePdf,
  listStudentAttendance,
  listStudentCertificates,
  listStudentCourses,
  listStudentHomework,
  listStudentRecordings,
  listStudentResources,
  listStudentTasks,
  listStudentUpcomingSessions,
  submitStudentActivity,
  submitStudentActivityQuiz,
  submitStudentHomework,
  uploadStudentActivityAttachment,
  uploadStudentHomeworkAttachment,
} from '../../services/api';
import { formatDate, readable } from '../../lib/format';
import { useTenant } from '../tenant/TenantProvider';
import { isTenantFeatureEnabled } from '../tenant/tenantFeatures';
import type { AttendanceRecord } from '../../types/domain';

type StudentCourse = {
  id?: number;
  courseId?: number;
  title?: string;
  courseTitle?: string;
  progress?: number;
  progressPercent?: number;
  status?: string;
  groupName?: string;
};

type StudentSession = {
  id?: number;
  title?: string;
  sessionTitle?: string;
  courseTitle?: string;
  groupName?: string;
  startsAt?: string;
  liveJoinUrl?: string | null;
  url?: string | null;
  materials?: Array<{ title?: string; url?: string; type?: string }>;
  activities?: StudentActivity[];
};

type StudentHomework = {
  id?: number;
  sessionId?: number;
  kind?: string;
  title?: string;
  description?: string | null;
  courseTitle?: string;
  sessionTitle?: string;
  deadline?: string | null;
  dueAt?: string | null;
  status?: string;
  reviewState?: string;
  mySubmission?: {
    id?: number;
    answerText?: string | null;
    attachmentUrl?: string | null;
    status?: string | null;
    score?: number | null;
    reviewComment?: string | null;
  } | null;
};

type StudentCertificate = {
  id?: number;
  publicId?: string;
  courseTitle?: string;
  status?: string;
  issuedAt?: string | null;
  downloadUrl?: string | null;
  verificationUrl?: string | null;
};

type StudentTask = {
  id?: number;
  sessionId?: number;
  kind?: string;
  taskType?: string;
  activityType?: string;
  title?: string;
  description?: string | null;
  type?: string;
  status?: string;
  dueAt?: string | null;
  courseTitle?: string;
  mySubmission?: StudentHomework['mySubmission'];
  myAttempt?: { score?: number; passed?: boolean; createdAt?: string } | null;
  questions?: Array<{
    id: number;
    prompt: string;
    questionMode?: 'single_choice' | 'multiple_choice';
    options: Array<{ id: number; text: string }>;
  }>;
};

type StudentActivity = StudentTask;

function isActivityTask(task: StudentTask | StudentHomework): task is StudentTask {
  return task.kind === 'activity';
}

const emptySubmitForm = {
  answerText: '',
  attachmentUrl: '',
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

function taskContext(task?: StudentTask | StudentHomework | null) {
  if (!task) return '';
  return task.courseTitle ?? (!isActivityTask(task) ? task.sessionTitle : undefined) ?? '';
}

function taskDueDate(task?: StudentTask | StudentHomework | null) {
  if (!task) return undefined;
  return isActivityTask(task) ? task.dueAt : task.deadline ?? task.dueAt;
}

function progressLabel(value: number, labels: { completed: string; notStarted: string; inProgress: string }) {
  if (value >= 100) return labels.completed;
  if (value <= 0) return labels.notStarted;
  return labels.inProgress;
}

export function StudentDashboardPage() {
  const { t } = useTranslation();
  const { activeTenant } = useTenant();
  const [courses, setCourses] = useState<StudentCourse[]>([]);
  const [sessions, setSessions] = useState<StudentSession[]>([]);
  const [homework, setHomework] = useState<StudentHomework[]>([]);
  const [certificates, setCertificates] = useState<StudentCertificate[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [tasks, setTasks] = useState<StudentTask[]>([]);
  const [resources, setResources] = useState<StudentSession[]>([]);
  const [recordings, setRecordings] = useState<StudentSession[]>([]);
  const [selectedTask, setSelectedTask] = useState<StudentTask | StudentHomework | null>(null);
  const [submitForm, setSubmitForm] = useState(emptySubmitForm);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number[]>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const homeworkEnabled = isTenantFeatureEnabled(activeTenant, 'homework.enabled');
  const certificatesEnabled = isTenantFeatureEnabled(activeTenant, 'certificates.enabled');
  const attendanceEnabled = isTenantFeatureEnabled(activeTenant, 'attendance.enabled');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      listStudentCourses(),
      listStudentUpcomingSessions({ limit: 6 }),
      homeworkEnabled ? listStudentHomework({ limit: 8 }) : Promise.resolve([]),
      certificatesEnabled ? listStudentCertificates() : Promise.resolve([]),
      attendanceEnabled ? listStudentAttendance({ limit: 8 }) : Promise.resolve([]),
      listStudentTasks({ limit: 8 }),
      listStudentResources({ limit: 6 }),
      listStudentRecordings({ limit: 6 }),
    ])
      .then(([nextCourses, nextSessions, nextHomework, nextCertificates, nextAttendance, nextTasks, nextResources, nextRecordings]) => {
        setCourses(nextCourses);
        setSessions(nextSessions);
        setHomework(nextHomework);
        setCertificates(nextCertificates);
        setAttendance(nextAttendance);
        setTasks(homeworkEnabled ? nextTasks : nextTasks.filter((task: StudentTask) => task.kind !== 'homework'));
        setResources(nextResources);
        setRecordings(nextRecordings);
      })
      .catch(() => toast.error(t('student.couldNotLoad')))
      .finally(() => setLoading(false));
  }, [activeTenant?.id, attendanceEnabled, certificatesEnabled, homeworkEnabled, t]);

  const reloadStudentData = async () => {
    const [nextHomework, nextTasks] = await Promise.all([
      homeworkEnabled ? listStudentHomework({ limit: 8 }) : Promise.resolve([]),
      listStudentTasks({ limit: 8 }),
    ]);
    setHomework(nextHomework);
    setTasks(homeworkEnabled ? nextTasks : nextTasks.filter((task: StudentTask) => task.kind !== 'homework'));
  };

  const selectTask = (task: StudentTask | StudentHomework) => {
    setSelectedTask(task);
    setSubmitForm({
      answerText: task.mySubmission?.answerText ?? '',
      attachmentUrl: task.mySubmission?.attachmentUrl ?? '',
    });
    setQuizAnswers({});
  };

  const uploadAttachment = async (file?: File) => {
    if (!file || !selectedTask?.id || !selectedTask.sessionId) return;

    setSubmitting(true);
    try {
      const uploaded = selectedTask.kind === 'activity'
        ? await uploadStudentActivityAttachment(selectedTask.sessionId, selectedTask.id, file)
        : await uploadStudentHomeworkAttachment(selectedTask.sessionId, selectedTask.id, file);
      setSubmitForm((current) => ({ ...current, attachmentUrl: uploaded.key || uploaded.url }));
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

    setSubmitting(true);
    try {
      if (isActivityTask(selectedTask) && selectedTask.taskType === 'quiz') {
        await submitStudentActivityQuiz(
          selectedTask.sessionId,
          selectedTask.id,
          Object.entries(quizAnswers).map(([questionId, optionIds]) => ({ questionId: Number(questionId), optionIds })),
        );
      } else if (isActivityTask(selectedTask)) {
        await submitStudentActivity(selectedTask.sessionId, selectedTask.id, {
          text: submitForm.answerText.trim() || undefined,
          link: submitForm.attachmentUrl.trim() || undefined,
        });
      } else {
        await submitStudentHomework(selectedTask.sessionId, selectedTask.id, {
          answerText: submitForm.answerText.trim() || undefined,
          attachmentUrl: submitForm.attachmentUrl.trim() || undefined,
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

  const openTasks = useMemo(() => {
    return tasks.filter((task) => {
      const status = String(task.status ?? '').toLowerCase();
      return !['approved', 'completed', 'submitted', 'passed'].includes(status);
    });
  }, [tasks]);

  const nextHomework = useMemo(() => {
    return homework.find((item) => {
      const status = String(item.status ?? item.reviewState ?? '').toLowerCase();
      return !['approved', 'completed', 'submitted'].includes(status);
    }) ?? homework[0] ?? null;
  }, [homework]);

  const featuredTask = openTasks[0] ?? tasks[0] ?? null;
  const primaryTask = featuredTask ?? nextHomework;
  const dateText = (value?: string | null, fallback = t('student.dateNotScheduled')) => displayDate(value, fallback);
  const dueText = (value?: string | null) => dueLabel(value, (date) => t('student.due', { date }), t('student.noDueDate'));
  const statusLabel = (value: string | null | undefined, fallback: string) => {
    const status = String(value ?? '').trim();
    const key = status.toLowerCase();
    const labels: Record<string, string> = {
      absent: t('attendance.statusAbsent'),
      approved: t('homework.reviewApproved'),
      completed: t('student.completed'),
      draft: t('courses.draft'),
      excused: t('attendance.statusExcused'),
      issued: t('certificates.statusIssued'),
      late: t('attendance.statusLate'),
      missing: t('homework.reviewMissing'),
      needs_review: t('homework.reviewNeedsReview'),
      needs_revision: t('homework.reviewNeedsRevision'),
      passed: t('student.completed'),
      pending: t('student.pending'),
      pending_approval: t('overview.pendingApprovals'),
      pending_submission: t('homework.reviewMissing'),
      present: t('attendance.statusPresent'),
      rejected: t('homework.reviewRejected'),
      revoked: t('certificates.statusRevoked'),
      submitted: t('student.submitted'),
    };
    return status ? labels[key] ?? readable(status) : fallback;
  };
  const activityTypeLabel = (value: string | number | boolean | null | undefined, fallback: string) => {
    const key = String(value ?? '').trim().toLowerCase();
    const labels: Record<string, string> = {
      discussion: t('sessions.activityTypeDiscussion'),
      exercise: t('sessions.activityTypeExercise'),
      group_work: t('sessions.activityTypeGroupWork'),
      homework: t('navigation.homework'),
      quiz: t('sessions.activityTypeQuiz'),
      resource: t('student.resource'),
      submission: t('sessions.activityTypeSubmission'),
    };
    return key ? labels[key] ?? readable(value) : fallback;
  };
  const progressText = (value: number) => progressLabel(value, {
    completed: t('student.completed'),
    notStarted: t('student.notStarted'),
    inProgress: t('student.inProgress'),
  });
  const primaryAction = nextSession?.liveJoinUrl
    ? {
      eyebrow: t('student.continueLearning'),
      title: nextSession.title ?? nextSession.sessionTitle ?? t('student.joinSession'),
      detail: `${displayText(nextSession.courseTitle, t('student.courseNotSet'))} · ${dateText(nextSession.startsAt)}`,
      action: <a className="primary-link-button" href={nextSession.liveJoinUrl} target="_blank" rel="noreferrer">{t('student.joinSession')}</a>,
      icon: FiClock,
    }
    : primaryTask
      ? {
        eyebrow: t('student.continueLearning'),
        title: primaryTask.title ?? t('student.openYourNextTask'),
        detail: `${displayText(taskContext(primaryTask), t('student.courseNotSet'))} · ${dueText(taskDueDate(primaryTask))}`,
        action: <button type="button" onClick={() => selectTask(primaryTask)}>{t('student.openTask')}</button>,
        icon: FiCheckCircle,
      }
      : {
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
  const materialItems = useMemo(() => [
    ...resources.map((session, index) => ({ kind: 'resource' as const, session, key: `resource-${session.id ?? index}` })),
    ...recordings.map((session, index) => ({ kind: 'recording' as const, session, key: `recording-${session.id ?? index}` })),
  ].slice(0, 8), [recordings, resources]);
  const selectedQuizTotal = selectedTask && isActivityTask(selectedTask) && selectedTask.taskType === 'quiz'
    ? selectedTask.questions?.length ?? 0
    : 0;
  const selectedQuizAnswered = selectedTask && isActivityTask(selectedTask) && selectedTask.taskType === 'quiz'
    ? selectedTask.questions?.filter((question) => (quizAnswers[question.id] ?? []).length > 0).length ?? 0
    : 0;
  const canSubmitSelectedTask = !selectedQuizTotal || selectedQuizAnswered === selectedQuizTotal;
  const PrimaryActionIcon = primaryAction.icon;

  if (loading) return <LoadingState label={t('student.loading')} />;

  return (
    <>
      <PageHeader title={t('student.myLearning')} eyebrow={activeTenant?.name} />

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
            <span className="status-badge draft">{nextSession ? readable(nextSession.groupName) : t('student.clear')}</span>
          )}
        </article>

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

      <section className="content-section student-task-section">
        <div className="section-heading-row">
          <div>
            <h2>{t('student.tasks')}</h2>
            <span>{t('student.openTasksNeedAttention', { count: openTasks.length })}</span>
          </div>
        </div>
        {!tasks.length ? <EmptyState title={t('student.tasksEmptyTitle')} detail={t('student.tasksEmptyDetail')} /> : (
          <div className="student-task-list">
            {tasks.map((task, index) => (
              <article className="student-task-card" key={task.id ?? index}>
                <div>
                  <strong>{task.title ?? activityTypeLabel(task.type, t('student.activity'))}</strong>
                  <span>{displayText(task.courseTitle, t('student.courseNotSet'))} · {dueText(task.dueAt)}</span>
                  <small>{activityTypeLabel(task.type ?? task.taskType ?? task.activityType, t('student.activity'))}</small>
                </div>
                <div className="student-task-action">
                  <span className={`status-badge ${statusClass(task.status)}`}>{statusLabel(task.status, t('student.open'))}</span>
                  <button type="button" className="secondary-button" onClick={() => selectTask(task)}>{t('student.open')}</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="student-workspace-grid">
        <section className="content-section">
          <div className="student-panel-heading">
            <FiBookOpen />
            <h2>{t('student.myCourses')}</h2>
          </div>
          {!courses.length ? <EmptyState title={t('student.coursesEmptyTitle')} detail={t('student.coursesEmptyDetail')} /> : (
            <div className="stack-list">
              {courses.slice(0, 6).map((course, index) => {
                const progress = course.progressPercent ?? course.progress ?? 0;
                return (
                  <article className="stack-list-item" key={course.id ?? course.courseId ?? index}>
                    <div>
                      <strong>{course.title ?? course.courseTitle ?? t('student.courseFallback', { number: index + 1 })}</strong>
                      <span>{displayText(course.groupName, t('student.groupNotAssigned'))}</span>
                      <span className={`status-badge ${statusClass(course.status)}`}>{statusLabel(course.status, t('student.activeStatus'))}</span>
                      <span>{progressText(progress)}</span>
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

        <section className="content-section">
          <div className="student-panel-heading">
            <FiFileText />
            <h2>{t('student.materials')}</h2>
          </div>
          {!materialItems.length ? <EmptyState title={t('student.materialsEmptyTitle')} detail={t('student.materialsEmptyDetail')} /> : (
            <div className="stack-list">
              {materialItems.map(({ kind, session, key }, index) => (
                <article className="stack-list-item" key={key}>
                  <div>
                    <strong>{session.sessionTitle ?? session.title ?? (kind === 'recording' ? t('student.recording') : t('student.sessionFallback', { number: index + 1 }))}</strong>
                    <span>{displayText(session.courseTitle, t('student.courseNotSet'))} · {dateText(session.startsAt)}</span>
                    <span className="status-badge draft">{kind === 'recording' ? t('student.recording') : t('student.resource')}</span>
                  </div>
                  <div className="student-material-actions">
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
            </div>
          )}
        </section>

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
                    <span className="status-badge draft">{displayText(session.groupName, t('student.groupNotSet'))}</span>
                  </div>
                  {session.liveJoinUrl ? <a href={session.liveJoinUrl} target="_blank" rel="noreferrer">{t('student.join')}</a> : null}
                </article>
              ))}
            </div>
          )}
        </section>

        {attendanceEnabled ? (
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

        {homeworkEnabled ? (
          <section className="content-section">
            <div className="student-panel-heading">
              <FiCheckCircle />
              <h2>{t('navigation.homework')}</h2>
            </div>
            {!homework.length ? <EmptyState title={t('student.homeworkEmptyTitle')} detail={t('student.homeworkEmptyDetail')} /> : (
              <div className="stack-list">
                {homework.slice(0, 8).map((item, index) => (
                  <article className="stack-list-item" key={item.id ?? index}>
                    <div>
                      <strong>{item.title ?? t('student.homeworkFallback', { number: index + 1 })}</strong>
                      <span>{displayText(item.courseTitle ?? item.sessionTitle, t('student.courseNotSet'))} · {dueText(item.deadline ?? item.dueAt)}</span>
                      <span className={`status-badge ${statusClass(item.reviewState ?? item.status)}`}>{statusLabel(item.reviewState ?? item.status, t('student.open'))}</span>
                      {item.mySubmission?.reviewComment ? <span>{item.mySubmission.reviewComment}</span> : null}
                    </div>
                    <button type="button" className="secondary-button" onClick={() => selectTask(item)}>
                      {item.mySubmission ? t('student.update') : t('student.submit')}
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {certificatesEnabled ? (
          <section className="content-section">
            <div className="student-panel-heading">
              <FiAward />
              <h2>{t('navigation.certificates')}</h2>
            </div>
            {!certificates.length ? <EmptyState title={t('student.certificatesEmptyTitle')} detail={t('student.certificatesEmptyDetail')} /> : (
              <div className="stack-list">
                {certificates.slice(0, 6).map((certificate, index) => (
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
              </div>
            )}
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
              <span>{statusLabel(selectedTask.status, t('student.open'))}</span>
              <h2 id="student-submit-title">{selectedTask.title ?? t('student.submitTask')}</h2>
              <p>{readable(taskContext(selectedTask))} · {dueText(taskDueDate(selectedTask))}</p>
            </div>
            {selectedTask.description ? <p className="panel-note">{selectedTask.description}</p> : null}
            {isActivityTask(selectedTask) && selectedTask.taskType === 'quiz' ? (
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
                <label>
                  {t('student.answer')}
                  <textarea value={submitForm.answerText} onChange={(event) => setSubmitForm((current) => ({ ...current, answerText: event.target.value }))} />
                </label>
                <label>
                  {t('student.attachmentLink')}
                  <input value={submitForm.attachmentUrl} onChange={(event) => setSubmitForm((current) => ({ ...current, attachmentUrl: event.target.value }))} />
                </label>
                <label className="file-button">
                  {submitting ? t('student.uploading') : t('student.uploadAttachment')}
                  <input type="file" disabled={submitting} onChange={(event) => void uploadAttachment(event.target.files?.[0])} />
                </label>
              </>
            )}
            {selectedTask.mySubmission?.reviewComment ? <p className="panel-note">{t('student.review')}: {selectedTask.mySubmission.reviewComment}</p> : null}
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setSelectedTask(null)} disabled={submitting}>{t('student.cancel')}</button>
              <button type="submit" disabled={submitting || !canSubmitSelectedTask}>{submitting ? t('student.submitting') : t('student.submit')}</button>
            </div>
        </FormModal>
      ) : null}
    </>
  );
}
