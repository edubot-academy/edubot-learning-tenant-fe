import { describe, expect, it } from 'vitest';
import type { Course } from '../../types/domain';
import { getCourseReadiness } from './courseReadiness';

const course = (overrides: Partial<Course>): Course => ({
  id: 1,
  title: 'Course',
  courseType: 'online_live',
  status: 'draft',
  isPublished: false,
  ...overrides,
});

describe('course readiness', () => {
  it('guides admins through approval and publishing', () => {
    expect(getCourseReadiness(course({ status: 'draft' }), {
      canApproveCourses: true,
      canEditCourse: true,
    })).toMatchObject({
      labelKey: 'courses.readinessDraft',
      nextAction: 'approve',
    });

    expect(getCourseReadiness(course({ status: 'approved', isPublished: false }), {
      canApproveCourses: true,
      canEditCourse: true,
    })).toMatchObject({
      labelKey: 'courses.readinessApprovedUnpublished',
      nextAction: 'publish',
    });
  });

  it('guides instructors toward approval without admin-only actions', () => {
    expect(getCourseReadiness(course({ status: 'draft' }), {
      canApproveCourses: false,
      canEditCourse: true,
    })).toMatchObject({
      detailKey: 'courses.readinessDraftDetail',
      nextAction: 'submit',
    });

    expect(getCourseReadiness(course({ status: 'pending' }), {
      canApproveCourses: false,
      canEditCourse: true,
    })).toMatchObject({
      detailKey: 'courses.readinessPendingDetail',
      nextAction: null,
    });
  });

  it('moves published delivery courses through group and session setup', () => {
    const published = course({ status: 'approved', isPublished: true });

    expect(getCourseReadiness(published, {
      canApproveCourses: true,
      canEditCourse: true,
      groupCount: 0,
      sessionCount: 0,
    })).toMatchObject({
      labelKey: 'courses.readinessNeedsGroup',
      nextAction: 'groups',
    });

    expect(getCourseReadiness(published, {
      canApproveCourses: true,
      canEditCourse: true,
      groupCount: 1,
      sessionCount: 0,
    })).toMatchObject({
      labelKey: 'courses.readinessNeedsSession',
      nextAction: 'sessions',
    });

    expect(getCourseReadiness(published, {
      canApproveCourses: true,
      canEditCourse: true,
      groupCount: 1,
      sessionCount: 1,
    })).toMatchObject({
      labelKey: 'courses.readinessReady',
      tone: 'ready',
      nextAction: 'openSessions',
    });
  });
});
