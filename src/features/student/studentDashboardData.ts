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
