export type StudentTaskLike = {
  id?: number;
  kind?: string;
  title?: string;
  status?: string | null;
  dueAt?: string | null;
  deadline?: string | null;
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

export function isOpenStudentTask(task: StudentTaskLike) {
  const status = String(task.status ?? '').toLowerCase();
  return !['approved', 'completed', 'submitted', 'passed'].includes(status);
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
  const openTaskIds = new Set(openTasks.map((task) => task.id).filter((id): id is number => typeof id === 'number'));
  const closedTasks = tasks.filter((task) => !isOpenStudentTask(task) || (typeof task.id === 'number' && !openTaskIds.has(task.id)));
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
