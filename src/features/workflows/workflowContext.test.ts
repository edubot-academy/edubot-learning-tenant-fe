import { beforeEach, describe, expect, it } from 'vitest';
import type { Course } from '../../types/domain';
import i18n from '../../i18n/config';
import { courseWorkflowBlocker, isCourseWorkflowReady, nextWorkflowSearchParams, workflowPath } from './workflowContext';

const course = (overrides: Partial<Course>): Course => ({
  id: 1,
  title: 'Course',
  courseType: 'offline',
  status: 'approved',
  isPublished: true,
  ...overrides,
});

describe('workflow context helpers', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('requires approved published delivery courses for group and session workflows', () => {
    expect(isCourseWorkflowReady(course({}))).toBe(true);
    expect(isCourseWorkflowReady(course({ courseType: 'video' }))).toBe(false);
    expect(isCourseWorkflowReady(course({ status: 'draft' }))).toBe(false);
    expect(isCourseWorkflowReady(course({ isPublished: false }))).toBe(false);
  });

  it('allows non-delivery courses for course-level workflows when requested', () => {
    expect(isCourseWorkflowReady(course({ courseType: 'video' }), false)).toBe(true);
    expect(courseWorkflowBlocker(course({ courseType: 'video' }))).toContain('offline or online live');
  });

  it('builds and syncs workflow query parameters consistently', () => {
    expect(workflowPath('/sessions', { courseId: 3, groupId: 5, sessionId: 8 })).toBe('/sessions?courseId=3&groupId=5&sessionId=8');

    const next = nextWorkflowSearchParams('courseId=1&groupId=2&tab=rules', { courseId: 9 });
    expect(next.toString()).toBe('courseId=9');
  });
});
