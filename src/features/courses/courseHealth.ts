import type { Course } from '../../types/domain';

export type CourseHealthFilter =
  | 'all'
  | 'draft'
  | 'pending'
  | 'approved_unpublished'
  | 'no_instructor'
  | 'no_groups'
  | 'no_sessions'
  | 'certificate_missing';

export type CourseHealthSummary = {
  groupCount?: number;
  sessionCount?: number;
  certificateConfigured?: boolean;
};

export const courseHealthFilters: CourseHealthFilter[] = [
  'all',
  'draft',
  'pending',
  'approved_unpublished',
  'no_instructor',
  'no_groups',
  'no_sessions',
  'certificate_missing',
];

export function courseMatchesHealthFilter(
  course: Course,
  filter: CourseHealthFilter,
  summary: CourseHealthSummary | undefined,
) {
  if (filter === 'all') return true;
  if (filter === 'draft') return (course.status ?? 'draft') === 'draft';
  if (filter === 'pending') return course.status === 'pending';
  if (filter === 'approved_unpublished') return course.status === 'approved' && course.isPublished !== true;
  if (filter === 'no_instructor') return !course.instructor?.id;
  if (filter === 'no_groups') return summary?.groupCount === 0;
  if (filter === 'no_sessions') return (summary?.groupCount ?? 0) > 0 && summary?.sessionCount === 0;
  if (filter === 'certificate_missing') return summary?.certificateConfigured === false;
  return true;
}

export function getCourseHealthCounts(
  courses: Course[],
  summaries: Record<number, CourseHealthSummary>,
) {
  return courseHealthFilters.reduce<Record<CourseHealthFilter, number>>((acc, filter) => {
    acc[filter] = filter === 'all'
      ? courses.length
      : courses.filter((course) => courseMatchesHealthFilter(course, filter, summaries[course.id])).length;
    return acc;
  }, {} as Record<CourseHealthFilter, number>);
}
