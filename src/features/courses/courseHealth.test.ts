import { describe, expect, it } from 'vitest';
import type { Course } from '../../types/domain';
import { courseMatchesHealthFilter, getCourseHealthCounts } from './courseHealth';

const course = (overrides: Partial<Course>): Course => ({
  id: 1,
  title: 'Course',
  status: 'draft',
  isPublished: false,
  ...overrides,
});

describe('course health helpers', () => {
  it('matches admin decision filters from course and readiness summary data', () => {
    expect(courseMatchesHealthFilter(course({ status: 'draft' }), 'draft', {})).toBe(true);
    expect(courseMatchesHealthFilter(course({ status: 'pending' }), 'pending', {})).toBe(true);
    expect(courseMatchesHealthFilter(course({ status: 'approved', isPublished: false }), 'approved_unpublished', {})).toBe(true);
    expect(courseMatchesHealthFilter(course({ instructor: undefined }), 'no_instructor', {})).toBe(true);
    expect(courseMatchesHealthFilter(course({ status: 'approved' }), 'no_groups', { groupCount: 0 })).toBe(true);
    expect(courseMatchesHealthFilter(course({ status: 'approved' }), 'no_sessions', { groupCount: 1, sessionCount: 0 })).toBe(true);
    expect(courseMatchesHealthFilter(course({ status: 'approved' }), 'certificate_missing', { certificateConfigured: false })).toBe(true);
  });

  it('counts health filters across a catalog', () => {
    const courses = [
      course({ id: 1, status: 'draft' }),
      course({ id: 2, status: 'pending', instructor: { id: 10, fullName: 'Instructor' } }),
      course({ id: 3, status: 'approved', isPublished: false, instructor: { id: 11, fullName: 'Instructor' } }),
    ];

    expect(getCourseHealthCounts(courses, {
      1: { groupCount: 0, sessionCount: 0, certificateConfigured: false },
      2: { groupCount: 1, sessionCount: 0, certificateConfigured: true },
      3: { groupCount: 1, sessionCount: 2, certificateConfigured: false },
    })).toMatchObject({
      all: 3,
      draft: 1,
      pending: 1,
      approved_unpublished: 1,
      no_instructor: 1,
      no_groups: 1,
      no_sessions: 1,
      certificate_missing: 2,
    });
  });
});
