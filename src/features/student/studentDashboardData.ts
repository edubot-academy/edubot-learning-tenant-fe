export type StudentTaskLike = {
  id?: number;
  kind?: string;
  title?: string;
  status?: string | null;
  reviewState?: string | null;
  dueAt?: string | null;
  deadline?: string | null;
  mySubmission?: { status?: string | null } | null;
  submission?: { status?: string | null } | null;
  myAttempt?: { passed?: boolean | null; score?: number | null } | null;
  attempt?: { passed?: boolean | null; score?: number | null } | null;
};

export type StudentSessionLike = {
  id?: number;
  sessionId?: number;
  status?: string | null;
  groupStatus?: string | null;
  startsAt?: string | null;
  startAt?: string | null;
  endsAt?: string | null;
  endAt?: string | null;
  liveJoinUrl?: string | null;
};

const studentVisibleSessionStatuses = new Set(['scheduled', 'completed']);
const studentVisibleGroupStatuses = new Set(['open', 'active', 'completed']);

export function studentSessionId(session?: StudentSessionLike | null) {
  return session?.id ?? session?.sessionId;
}

export function studentSessionStartsAt(session?: StudentSessionLike | null) {
  return session?.startsAt ?? session?.startAt ?? null;
}

export function studentSessionEndsAt(session?: StudentSessionLike | null) {
  return session?.endsAt ?? session?.endAt ?? null;
}

export function studentSessionTime(value?: string | null) {
  if (!value) return Number.NaN;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : Number.NaN;
}

export function isStudentVisibleSession(session?: StudentSessionLike | null) {
  if (!session) return false;
  if (session.groupStatus != null) {
    const groupStatus = String(session.groupStatus).toLowerCase();
    if (!studentVisibleGroupStatuses.has(groupStatus)) return false;
  }
  const status = String(session.status ?? 'scheduled').toLowerCase();
  return studentVisibleSessionStatuses.has(status);
}

export function isStudentUpcomingSession(session?: StudentSessionLike | null, now = Date.now()) {
  if (!isStudentVisibleSession(session)) return false;
  const status = String(session?.status ?? 'scheduled').toLowerCase();
  const startsAt = studentSessionTime(studentSessionStartsAt(session));
  return status === 'scheduled' && Number.isFinite(startsAt) && startsAt >= now;
}

export function studentVisibleLiveJoinUrl(session?: StudentSessionLike | null, now = Date.now()) {
  if (!session?.liveJoinUrl) return null;
  if (String(session.status ?? 'scheduled').toLowerCase() !== 'scheduled') return null;
  const startsAt = studentSessionTime(studentSessionStartsAt(session));
  const endsAt = studentSessionTime(studentSessionEndsAt(session));
  if (!Number.isFinite(startsAt)) return null;
  const openAt = startsAt - 15 * 60 * 1000;
  const closeAt = (Number.isFinite(endsAt) ? endsAt : startsAt) + 30 * 60 * 1000;
  return now >= openAt && now <= closeAt ? session.liveJoinUrl : null;
}

export function studentTaskDueDate(task?: StudentTaskLike | null) {
  if (!task) return undefined;
  return task.kind === 'activity' ? task.dueAt : task.deadline ?? task.dueAt;
}

export function studentTaskDueTime(task?: StudentTaskLike | null) {
  const value = studentTaskDueDate(task);
  if (!value) return Number.POSITIVE_INFINITY;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
}

export function studentTaskState(task?: StudentTaskLike | null) {
  if (!task) return '';
  const taskStatus = String(task.status ?? '').toLowerCase();
  const reviewState = String(task.reviewState ?? '').toLowerCase();
  const submissionStatus = String(task.mySubmission?.status ?? task.submission?.status ?? '').toLowerCase();
  const attempt = task.myAttempt ?? task.attempt;

  if (['needs_revision', 'revision_required', 'rejected'].includes(reviewState)) return 'needs_revision';
  if (['needs_revision', 'revision_required', 'rejected'].includes(submissionStatus)) return 'needs_revision';
  if (['needs_revision', 'revision_required', 'rejected'].includes(taskStatus)) return 'needs_revision';
  if (['approved', 'completed', 'passed', 'graded'].includes(reviewState)) return 'completed';
  if (['approved', 'completed', 'passed', 'graded'].includes(submissionStatus)) return 'completed';
  if (['approved', 'completed', 'passed', 'graded'].includes(taskStatus)) return 'completed';
  if (attempt?.passed === true) return 'completed';
  if (['submitted', 'pending_review'].includes(reviewState)) return 'submitted';
  if (['submitted', 'pending_review'].includes(submissionStatus)) return 'submitted';
  if (['submitted', 'pending_review'].includes(taskStatus)) return 'submitted';
  return taskStatus || reviewState || submissionStatus;
}

export function isOpenStudentTask(task: StudentTaskLike) {
  const status = studentTaskState(task);
  return !['approved', 'completed', 'submitted', 'passed'].includes(status);
}

function studentTaskIdentity(task: StudentTaskLike) {
  return `${task.kind ?? 'activity'}-${task.id ?? task.title ?? ''}`;
}

export function sortOpenStudentTasks<T extends StudentTaskLike>(tasks: T[], now = Date.now()) {
  return [...tasks]
    .filter(isOpenStudentTask)
    .sort((first, second) => {
      const firstTime = studentTaskDueTime(first);
      const secondTime = studentTaskDueTime(second);
      const firstOverdue = firstTime < now ? 0 : 1;
      const secondOverdue = secondTime < now ? 0 : 1;
      if (firstOverdue !== secondOverdue) return firstOverdue - secondOverdue;
      if (firstTime !== secondTime) return firstTime - secondTime;
      return String(first.title ?? first.id ?? '').localeCompare(String(second.title ?? second.id ?? ''));
    });
}

export function prioritizeStudentTasks<T extends StudentTaskLike>(tasks: T[], now = Date.now()) {
  const openTasks = sortOpenStudentTasks(tasks, now);
  const openTaskKeys = new Set(openTasks.map(studentTaskIdentity));
  const closedTasks = tasks.filter((task) => !openTaskKeys.has(studentTaskIdentity(task)));
  return [...openTasks, ...closedTasks];
}

export function settledStudentValue<T>(result: PromiseSettledResult<T>, fallback: T) {
  return result.status === 'fulfilled' ? result.value : fallback;
}

export function nextStudentLoadId(currentLoadId: number) {
  return currentLoadId + 1;
}

export function isCurrentStudentLoad(loadId: number, currentLoadId: number) {
  return loadId === currentLoadId;
}
