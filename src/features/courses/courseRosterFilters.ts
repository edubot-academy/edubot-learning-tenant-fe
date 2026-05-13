export type CourseProgressFilter = 'all' | 'not_started' | 'in_progress' | 'completed';

export function isDefaultCourseRosterFilter(studentQuery: string, progressFilter: CourseProgressFilter) {
  return !studentQuery.trim() && progressFilter === 'all';
}

export function courseRosterFilterParams(studentQuery: string, progressFilter: CourseProgressFilter) {
  return {
    q: studentQuery.trim() || undefined,
    progressGte: progressFilter === 'completed' ? 100 : progressFilter === 'in_progress' ? 1 : undefined,
    progressLte: progressFilter === 'not_started' ? 0 : progressFilter === 'in_progress' ? 99 : undefined,
    limit: 200,
  };
}
