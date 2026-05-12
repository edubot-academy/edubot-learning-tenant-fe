import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FiAward, FiBookOpen, FiCalendar, FiCheckCircle, FiClock, FiFileText, FiPlayCircle } from 'react-icons/fi';
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

function displayDate(value?: string | null, fallback = 'Date not scheduled') {
  return value ? formatDate(value) : fallback;
}

function displayText(value?: string | number | boolean | null, fallback = 'Not set') {
  return value === null || value === undefined || value === '' ? fallback : readable(value);
}

function dueLabel(value?: string | null) {
  return value ? `Due ${formatDate(value)}` : 'No due date';
}

function taskContext(task?: StudentTask | StudentHomework | null) {
  if (!task) return '';
  return task.courseTitle ?? (!isActivityTask(task) ? task.sessionTitle : undefined) ?? '';
}

function taskDueDate(task?: StudentTask | StudentHomework | null) {
  if (!task) return undefined;
  return isActivityTask(task) ? task.dueAt : task.deadline ?? task.dueAt;
}

function progressLabel(value: number) {
  if (value >= 100) return 'Completed';
  if (value <= 0) return 'Not started';
  return 'In progress';
}

function taskStatusLabel(value?: string | null) {
  const status = String(value ?? '').trim();
  return status ? readable(status) : 'Open';
}

function certificateStatusLabel(value?: string | null) {
  const status = String(value ?? '').trim();
  return status ? readable(status) : 'Pending';
}

export function StudentDashboardPage() {
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
      .catch(() => toast.error('Could not load student workspace'))
      .finally(() => setLoading(false));
  }, [activeTenant?.id, attendanceEnabled, certificatesEnabled, homeworkEnabled]);

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
      toast.success('Attachment uploaded');
    } catch {
      toast.error('Could not upload attachment');
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
      toast.success('Submitted');
    } catch {
      toast.error('Could not submit');
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
      { label: 'Courses', value: courses.length, icon: FiBookOpen },
      { label: 'Upcoming sessions', value: sessions.length, icon: FiCalendar },
      ...(attendanceEnabled ? [{ label: 'Attendance', value: attendance.length ? `${attendanceRate}%` : 'N/A', icon: FiCheckCircle }] : []),
      ...(homeworkEnabled ? [{ label: 'Open homework', value: pendingHomework, icon: FiFileText }] : []),
      ...(certificatesEnabled ? [{ label: 'Certificates', value: certificates.length, icon: FiAward }] : []),
    ];
  }, [attendance.length, attendanceEnabled, attendanceRate, certificates.length, certificatesEnabled, courses.length, homework, homeworkEnabled, sessions.length]);

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
  const primaryAction = nextSession?.liveJoinUrl
    ? {
      eyebrow: 'Continue learning',
      title: nextSession.title ?? nextSession.sessionTitle ?? 'Join your next session',
      detail: `${displayText(nextSession.courseTitle, 'Course not set')} · ${displayDate(nextSession.startsAt)}`,
      action: <a className="primary-link-button" href={nextSession.liveJoinUrl} target="_blank" rel="noreferrer">Join session</a>,
      icon: FiClock,
    }
    : primaryTask
      ? {
        eyebrow: 'Continue learning',
        title: primaryTask.title ?? 'Open your next task',
        detail: `${displayText(taskContext(primaryTask), 'Course not set')} · ${dueLabel(taskDueDate(primaryTask))}`,
        action: <button type="button" onClick={() => selectTask(primaryTask)}>Open task</button>,
        icon: FiCheckCircle,
      }
      : {
        eyebrow: 'Continue learning',
        title: 'Nothing due right now',
        detail: 'New sessions, homework, and activities will appear here when assigned.',
        action: <span className="status-badge approved">Clear</span>,
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

  if (loading) return <LoadingState label="Loading student workspace" />;

  return (
    <>
      <PageHeader title="My learning" eyebrow={activeTenant?.name} />

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
            <span className="eyebrow">Next live session</span>
            <h2>{nextSession?.title ?? nextSession?.sessionTitle ?? 'No upcoming session'}</h2>
            <p>{nextSession ? `${displayText(nextSession.courseTitle, 'Course not set')} · ${displayDate(nextSession.startsAt)}` : 'You are clear for now. New sessions will appear here when scheduled.'}</p>
          </div>
          {nextSession?.liveJoinUrl ? (
            <a className="secondary-link-button" href={nextSession.liveJoinUrl} target="_blank" rel="noreferrer">Join</a>
          ) : (
            <span className="status-badge draft">{nextSession ? readable(nextSession.groupName) : 'Clear'}</span>
          )}
        </article>

        <article className="student-focus-card">
          <div className="student-focus-icon"><FiPlayCircle /></div>
          <div>
            <span className="eyebrow">Course progress</span>
            <h2>{averageProgress}% average</h2>
            <p>{courses.length ? `${courses.length} active course${courses.length === 1 ? '' : 's'} · ${progressLabel(averageProgress)}` : 'Enrollments will appear once your instructor adds you to a group.'}</p>
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
            <h2>Tasks</h2>
            <span>{openTasks.length} open task{openTasks.length === 1 ? '' : 's'} need attention</span>
          </div>
        </div>
        {!tasks.length ? <EmptyState title="No tasks right now" detail="Assigned homework and required learning actions will appear here when they are available." /> : (
          <div className="student-task-list">
            {tasks.map((task, index) => (
              <article className="student-task-card" key={task.id ?? index}>
                <div>
                  <strong>{task.title ?? readable(task.type)}</strong>
                  <span>{displayText(task.courseTitle, 'Course not set')} · {dueLabel(task.dueAt)}</span>
                  <small>{displayText(task.type ?? task.taskType ?? task.activityType, 'Activity')}</small>
                </div>
                <div className="student-task-action">
                  <span className={`status-badge ${statusClass(task.status)}`}>{taskStatusLabel(task.status)}</span>
                  <button type="button" className="secondary-button" onClick={() => selectTask(task)}>Open</button>
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
            <h2>My courses</h2>
          </div>
          {!courses.length ? <EmptyState title="No active courses" detail="Courses appear here after your account is enrolled in a tenant course or group." /> : (
            <div className="stack-list">
              {courses.slice(0, 6).map((course, index) => {
                const progress = course.progressPercent ?? course.progress ?? 0;
                return (
                  <article className="stack-list-item" key={course.id ?? course.courseId ?? index}>
                    <div>
                      <strong>{course.title ?? course.courseTitle ?? `Course ${index + 1}`}</strong>
                      <span>{displayText(course.groupName, 'Group not assigned')}</span>
                      <span className={`status-badge ${statusClass(course.status)}`}>{displayText(course.status, 'Active')}</span>
                      <span>{progressLabel(progress)}</span>
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
            <h2>Materials</h2>
          </div>
          {!materialItems.length ? <EmptyState title="No materials yet" detail="Session resources and recordings will appear here when instructors publish them." /> : (
            <div className="stack-list">
              {materialItems.map(({ kind, session, key }, index) => (
                <article className="stack-list-item" key={key}>
                  <div>
                    <strong>{session.sessionTitle ?? session.title ?? `${kind === 'recording' ? 'Recording' : 'Session'} ${index + 1}`}</strong>
                    <span>{displayText(session.courseTitle, 'Course not set')} · {displayDate(session.startsAt)}</span>
                    <span className="status-badge draft">{kind === 'recording' ? 'Recording' : 'Resource'}</span>
                  </div>
                  <div className="student-material-actions">
                    {kind === 'resource' ? session.materials?.slice(0, 3).map((material, materialIndex) => (
                      material.url ? (
                        <a className="secondary-link-button" key={`${material.url}-${materialIndex}`} href={material.url} target="_blank" rel="noreferrer">
                          {material.title ?? displayText(material.type, 'Open')}
                        </a>
                      ) : null
                    )) : null}
                    {kind === 'recording' && typeof session.url === 'string' ? <a className="secondary-link-button" href={session.url} target="_blank" rel="noreferrer">Open</a> : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="content-section">
          <div className="student-panel-heading">
            <FiCalendar />
            <h2>Upcoming sessions</h2>
          </div>
          {!sessions.length ? <EmptyState title="No upcoming sessions" detail="Scheduled live or offline classes will appear here once your groups have upcoming sessions." /> : (
            <div className="stack-list">
              {sessions.map((session, index) => (
                <article className="stack-list-item" key={session.id ?? index}>
                  <div>
                    <strong>{session.title ?? `Session ${index + 1}`}</strong>
                    <span>{displayText(session.courseTitle, 'Course not set')} · {displayDate(session.startsAt)}</span>
                    <span className="status-badge draft">{displayText(session.groupName, 'Group not set')}</span>
                  </div>
                  {session.liveJoinUrl ? <a href={session.liveJoinUrl} target="_blank" rel="noreferrer">Join</a> : null}
                </article>
              ))}
            </div>
          )}
        </section>

        {attendanceEnabled ? (
          <section className="content-section">
            <div className="student-panel-heading">
              <FiCheckCircle />
              <h2>Attendance</h2>
            </div>
            {!attendance.length ? <EmptyState title="No attendance marked yet" detail="Attendance records will appear after instructors mark your session attendance." /> : (
              <>
                <div className="student-attendance-summary">
                  <strong>{attendanceRate}%</strong>
                  <span>{missedAttendanceCount} absence or late mark{missedAttendanceCount === 1 ? '' : 's'} in recent sessions</span>
                </div>
                <div className="stack-list">
                  {attendance.slice(0, 6).map((record, index) => (
                    <article className="stack-list-item" key={record.id ?? `${record.sessionId}-${index}`}>
                      <div>
                        <strong>{displayDate(record.sessionDate)}</strong>
                        <span>Session attendance</span>
                        {record.notes ? <span>{record.notes}</span> : null}
                      </div>
                      <span className={`status-badge ${statusClass(record.status)}`}>{readable(record.status)}</span>
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
              <h2>Homework</h2>
            </div>
            {!homework.length ? <EmptyState title="No homework assigned" detail="Homework appears here when an instructor assigns work to your course, group, or session." /> : (
              <div className="stack-list">
                {homework.slice(0, 8).map((item, index) => (
                  <article className="stack-list-item" key={item.id ?? index}>
                    <div>
                      <strong>{item.title ?? `Homework ${index + 1}`}</strong>
                      <span>{displayText(item.courseTitle ?? item.sessionTitle, 'Course not set')} · {dueLabel(item.deadline ?? item.dueAt)}</span>
                      <span className={`status-badge ${statusClass(item.reviewState ?? item.status)}`}>{taskStatusLabel(item.reviewState ?? item.status)}</span>
                      {item.mySubmission?.reviewComment ? <span>{item.mySubmission.reviewComment}</span> : null}
                    </div>
                    <button type="button" className="secondary-button" onClick={() => selectTask(item)}>
                      {item.mySubmission ? 'Update' : 'Submit'}
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
              <h2>Certificates</h2>
            </div>
            {!certificates.length ? <EmptyState title="No certificates yet" detail="Issued certificates will appear here when you become eligible and a certificate is released." /> : (
              <div className="stack-list">
                {certificates.slice(0, 6).map((certificate, index) => (
                  <article className="stack-list-item" key={certificate.id ?? certificate.publicId ?? index}>
                    <div>
                      <strong>{certificate.courseTitle ?? certificate.publicId ?? `Certificate ${index + 1}`}</strong>
                      <span>{displayDate(certificate.issuedAt, 'Not issued yet')}</span>
                      <span className={`status-badge ${statusClass(certificate.status)}`}>{certificateStatusLabel(certificate.status)}</span>
                    </div>
                    <div className="student-certificate-actions">
                      {certificate.verificationUrl ? (
                        <a className="secondary-link-button" href={certificate.verificationUrl} target="_blank" rel="noreferrer">Verify</a>
                      ) : null}
                      {certificate.downloadUrl ? (
                        <button type="button" className="secondary-button" onClick={() => void downloadCertificatePdf(certificate.downloadUrl!, `certificate-${certificate.publicId ?? certificate.id ?? 'issued'}.pdf`).catch(() => toast.error('Could not download certificate'))}>
                          Download
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
              <span>{readable(selectedTask.status)}</span>
              <h2 id="student-submit-title">{selectedTask.title ?? 'Submit task'}</h2>
              <p>{readable(taskContext(selectedTask))} · {dueLabel(taskDueDate(selectedTask))}</p>
            </div>
            {selectedTask.description ? <p className="panel-note">{selectedTask.description}</p> : null}
            {isActivityTask(selectedTask) && selectedTask.taskType === 'quiz' ? (
              <>
                <p className={`panel-note ${canSubmitSelectedTask ? 'success' : ''}`}>
                  {selectedQuizTotal ? `${selectedQuizAnswered} of ${selectedQuizTotal} question${selectedQuizTotal === 1 ? '' : 's'} answered` : 'No quiz questions are available yet.'}
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
                  Answer
                  <textarea value={submitForm.answerText} onChange={(event) => setSubmitForm((current) => ({ ...current, answerText: event.target.value }))} />
                </label>
                <label>
                  Attachment link
                  <input value={submitForm.attachmentUrl} onChange={(event) => setSubmitForm((current) => ({ ...current, attachmentUrl: event.target.value }))} />
                </label>
                <label className="file-button">
                  {submitting ? 'Uploading...' : 'Upload attachment'}
                  <input type="file" disabled={submitting} onChange={(event) => void uploadAttachment(event.target.files?.[0])} />
                </label>
              </>
            )}
            {selectedTask.mySubmission?.reviewComment ? <p className="panel-note">Review: {selectedTask.mySubmission.reviewComment}</p> : null}
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setSelectedTask(null)} disabled={submitting}>Cancel</button>
              <button type="submit" disabled={submitting || !canSubmitSelectedTask}>{submitting ? 'Submitting...' : 'Submit'}</button>
            </div>
        </FormModal>
      ) : null}
    </>
  );
}
