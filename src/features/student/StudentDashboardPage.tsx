import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FiAward, FiBookOpen, FiCalendar, FiCheckCircle, FiClock, FiFileText, FiPlayCircle } from 'react-icons/fi';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState, LoadingState } from '../../components/DataState';
import { FormModal } from '../../components/Modal';
import {
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

export function StudentDashboardPage() {
  const { activeTenant } = useTenant();
  const [courses, setCourses] = useState<StudentCourse[]>([]);
  const [sessions, setSessions] = useState<StudentSession[]>([]);
  const [homework, setHomework] = useState<StudentHomework[]>([]);
  const [certificates, setCertificates] = useState<StudentCertificate[]>([]);
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

  useEffect(() => {
    setLoading(true);
    Promise.all([
      listStudentCourses(),
      listStudentUpcomingSessions({ limit: 6 }),
      homeworkEnabled ? listStudentHomework({ limit: 8 }) : Promise.resolve([]),
      certificatesEnabled ? listStudentCertificates() : Promise.resolve([]),
      listStudentTasks({ limit: 8 }),
      listStudentResources({ limit: 6 }),
      listStudentRecordings({ limit: 6 }),
    ])
      .then(([nextCourses, nextSessions, nextHomework, nextCertificates, nextTasks, nextResources, nextRecordings]) => {
        setCourses(nextCourses);
        setSessions(nextSessions);
        setHomework(nextHomework);
        setCertificates(nextCertificates);
        setTasks(homeworkEnabled ? nextTasks : nextTasks.filter((task: StudentTask) => task.kind !== 'homework'));
        setResources(nextResources);
        setRecordings(nextRecordings);
      })
      .catch(() => toast.error('Could not load student workspace'))
      .finally(() => setLoading(false));
  }, [activeTenant?.id, certificatesEnabled, homeworkEnabled]);

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

  const stats = useMemo(() => {
    const pendingHomework = homework.filter((item) => {
      const status = String(item.status ?? item.reviewState ?? '').toLowerCase();
      return !['approved', 'submitted', 'completed'].includes(status);
    }).length;
    return [
      { label: 'Courses', value: courses.length, icon: FiBookOpen },
      { label: 'Upcoming sessions', value: sessions.length, icon: FiCalendar },
      ...(homeworkEnabled ? [{ label: 'Open homework', value: pendingHomework, icon: FiFileText }] : []),
      ...(certificatesEnabled ? [{ label: 'Certificates', value: certificates.length, icon: FiAward }] : []),
    ];
  }, [certificates.length, certificatesEnabled, courses.length, homework, homeworkEnabled, sessions.length]);

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

  const averageProgress = useMemo(() => {
    if (!courses.length) return 0;
    const total = courses.reduce((sum, course) => sum + (course.progressPercent ?? course.progress ?? 0), 0);
    return Math.round(total / courses.length);
  }, [courses]);

  if (loading) return <LoadingState label="Loading student workspace" />;

  return (
    <>
      <PageHeader title="My learning" eyebrow={activeTenant?.name} />

      <div className="stat-grid compact">
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

      <section className="student-focus-grid">
        <article className="student-focus-card primary">
          <div className="student-focus-icon"><FiClock /></div>
          <div>
            <span className="eyebrow">Next live session</span>
            <h2>{nextSession?.title ?? nextSession?.sessionTitle ?? 'No upcoming session'}</h2>
            <p>{nextSession ? `${readable(nextSession.courseTitle)} · ${formatDate(nextSession.startsAt)}` : 'You are clear for now. New sessions will appear here when scheduled.'}</p>
          </div>
          <div className="student-focus-actions">
            {nextSession?.liveJoinUrl ? (
              <a className="primary-link-button" href={nextSession.liveJoinUrl} target="_blank" rel="noreferrer">
                Join session
              </a>
            ) : (
              <span className="status-badge draft">{nextSession ? readable(nextSession.groupName) : 'Clear'}</span>
            )}
          </div>
        </article>

        <article className="student-focus-card">
          <div className="student-focus-icon"><FiCheckCircle /></div>
          <div>
            <span className="eyebrow">Next task</span>
            <h2>{featuredTask?.title ?? nextHomework?.title ?? 'No open tasks'}</h2>
            <p>
              {featuredTask
                ? `${readable(featuredTask.courseTitle)} · due ${formatDate(featuredTask.dueAt)}`
                : nextHomework
                  ? `${readable(nextHomework.courseTitle ?? nextHomework.sessionTitle)} · due ${formatDate(nextHomework.deadline ?? nextHomework.dueAt)}`
                  : 'Assignments and quizzes will appear here.'}
            </p>
          </div>
          {featuredTask ? (
            <button type="button" className="secondary-button" onClick={() => selectTask(featuredTask)}>Open</button>
          ) : nextHomework ? (
            <button type="button" className="secondary-button" onClick={() => selectTask(nextHomework)}>Open</button>
          ) : (
            <span className="status-badge approved">Complete</span>
          )}
        </article>

        <article className="student-focus-card">
          <div className="student-focus-icon"><FiPlayCircle /></div>
          <div>
            <span className="eyebrow">Course progress</span>
            <h2>{averageProgress}% average</h2>
            <p>{courses.length ? `${courses.length} active course${courses.length === 1 ? '' : 's'} in progress` : 'Enrollments will appear once your instructor adds you to a group.'}</p>
          </div>
          <div className="progress-cell student-focus-progress">
            <span style={{ width: `${Math.max(0, Math.min(100, averageProgress))}%` }} />
            <strong>{averageProgress}%</strong>
          </div>
        </article>
      </section>

      <div className="student-workspace-grid">
        <section className="content-section">
          <div className="student-panel-heading">
            <FiBookOpen />
            <h2>My courses</h2>
          </div>
          {!courses.length ? <EmptyState title="No active courses" /> : (
            <div className="stack-list">
              {courses.slice(0, 6).map((course, index) => {
                const progress = course.progressPercent ?? course.progress ?? 0;
                return (
                  <article className="stack-list-item" key={course.id ?? course.courseId ?? index}>
                    <div>
                      <strong>{course.title ?? course.courseTitle ?? `Course ${index + 1}`}</strong>
                      <span>{readable(course.groupName)}</span>
                      <span className={`status-badge ${statusClass(course.status)}`}>{readable(course.status)}</span>
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
            <h2>Resources</h2>
          </div>
          {!resources.length ? <EmptyState title="No resources yet" /> : (
            <div className="stack-list">
              {resources.map((session, index) => (
                <article className="stack-list-item" key={session.id ?? index}>
                  <div>
                    <strong>{session.sessionTitle ?? session.title ?? `Session ${index + 1}`}</strong>
                    <span>{readable(session.courseTitle)} · {formatDate(session.startsAt)}</span>
                    {session.materials?.slice(0, 3).map((material, materialIndex) => (
                      <a key={`${material.url}-${materialIndex}`} href={material.url} target="_blank" rel="noreferrer">{material.title ?? readable(material.type)}</a>
                    ))}
                  </div>
                  {session.liveJoinUrl ? <a href={session.liveJoinUrl} target="_blank" rel="noreferrer">Join</a> : null}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="content-section">
          <div className="student-panel-heading">
            <FiPlayCircle />
            <h2>Recordings</h2>
          </div>
          {!recordings.length ? <EmptyState title="No recordings yet" /> : (
            <div className="stack-list">
              {recordings.map((recording, index) => (
                <article className="stack-list-item" key={recording.id ?? index}>
                  <div>
                    <strong>{recording.title ?? recording.sessionTitle ?? `Recording ${index + 1}`}</strong>
                    <span>{readable(recording.courseTitle)} · {formatDate(recording.startsAt)}</span>
                  </div>
                  {'url' in recording && typeof recording.url === 'string' ? <a href={recording.url} target="_blank" rel="noreferrer">Open</a> : null}
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
          {!sessions.length ? <EmptyState title="No upcoming sessions" /> : (
            <div className="stack-list">
              {sessions.map((session, index) => (
                <article className="stack-list-item" key={session.id ?? index}>
                  <div>
                    <strong>{session.title ?? `Session ${index + 1}`}</strong>
                    <span>{readable(session.courseTitle)} · {formatDate(session.startsAt)}</span>
                    <span className="status-badge draft">{readable(session.groupName)}</span>
                  </div>
                  {session.liveJoinUrl ? <a href={session.liveJoinUrl} target="_blank" rel="noreferrer">Join</a> : null}
                </article>
              ))}
            </div>
          )}
        </section>

        {homeworkEnabled ? (
          <section className="content-section">
            <div className="student-panel-heading">
              <FiCheckCircle />
              <h2>Homework</h2>
            </div>
            {!homework.length ? <EmptyState title="No homework assigned" /> : (
              <div className="stack-list">
                {homework.slice(0, 8).map((item, index) => (
                  <article className="stack-list-item" key={item.id ?? index}>
                    <div>
                      <strong>{item.title ?? `Homework ${index + 1}`}</strong>
                      <span>{readable(item.courseTitle ?? item.sessionTitle)} · due {formatDate(item.deadline ?? item.dueAt)}</span>
                      <span className={`status-badge ${statusClass(item.reviewState ?? item.status)}`}>{readable(item.reviewState ?? item.status)}</span>
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
            {!certificates.length ? <EmptyState title="No certificates yet" /> : (
              <div className="stack-list">
                {certificates.slice(0, 6).map((certificate, index) => (
                  <article className="stack-list-item" key={certificate.id ?? certificate.publicId ?? index}>
                    <div>
                      <strong>{certificate.courseTitle ?? certificate.publicId ?? `Certificate ${index + 1}`}</strong>
                      <span>{formatDate(certificate.issuedAt)}</span>
                      <span className={`status-badge ${statusClass(certificate.status)}`}>{readable(certificate.status)}</span>
                    </div>
                    {certificate.downloadUrl ? <a href={certificate.downloadUrl} target="_blank" rel="noreferrer">Download</a> : null}
                  </article>
                ))}
              </div>
            )}
          </section>
        ) : null}
      </div>

      <section className="content-section homework-list-section">
        <div className="section-heading-row">
          <div>
            <h2>Tasks</h2>
            <span>{openTasks.length} open task{openTasks.length === 1 ? '' : 's'} need attention</span>
          </div>
        </div>
        {!tasks.length ? <EmptyState title="No tasks right now" /> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Course</th>
                  <th>Due</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task, index) => (
                  <tr key={task.id ?? index}>
                    <td>
                      <strong>{task.title ?? readable(task.type)}</strong>
                      <small>{readable(task.type)}</small>
                    </td>
                    <td>{readable(task.courseTitle)}</td>
                    <td>{formatDate(task.dueAt)}</td>
                    <td>
                      <div className="student-task-action">
                        <span className={`status-badge ${statusClass(task.status)}`}>{readable(task.status)}</span>
                        <button type="button" className="secondary-button" onClick={() => selectTask(task)}>Open</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedTask ? (
        <FormModal
          labelledBy="student-submit-title"
          className="decision-modal form-modal student-submit-panel"
          onClose={() => setSelectedTask(null)}
          onSubmit={submitSelectedTask}
        >
            <div>
              <span className={`status-badge ${statusClass(selectedTask.status)}`}>{readable(selectedTask.status)}</span>
              <h2 id="student-submit-title">{selectedTask.title ?? 'Submit task'}</h2>
              <p>{readable(selectedTask.courseTitle)}</p>
            </div>
            {selectedTask.description ? <p className="panel-note">{selectedTask.description}</p> : null}
            {isActivityTask(selectedTask) && selectedTask.taskType === 'quiz' ? (
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
                        {option.text}
                      </label>
                    ))}
                  </fieldset>
                ))}
              </div>
            ) : (
              <>
                <label>
                  Answer
                  <textarea value={submitForm.answerText} onChange={(event) => setSubmitForm((current) => ({ ...current, answerText: event.target.value }))} />
                </label>
                <label>
                  Attachment link or uploaded key
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
              <button type="submit" disabled={submitting}>{submitting ? 'Submitting...' : 'Submit'}</button>
            </div>
        </FormModal>
      ) : null}
    </>
  );
}
