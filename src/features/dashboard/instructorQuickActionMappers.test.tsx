import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import { mapInstructorQuickActions } from './instructorQuickActionMappers';
import type { Tenant, TenantOverviewPermissions } from '../../types/domain';

const t = ((key: string, options?: { defaultValue?: string; count?: number }) => {
  if (key === 'overview.submissionsNeedReview' && typeof options?.count === 'number') {
    return `${options.count} submissions need review`;
  }
  return options?.defaultValue ?? key;
}) as TFunction;

function tenantWithFlags(featureFlags: Record<string, boolean>): Tenant {
  return {
    id: 42,
    name: 'EduPro',
    role: 'instructor',
    featureFlags,
    permissions: {},
  } as Tenant;
}

const instructorPermissions: Partial<TenantOverviewPermissions> = {
  canCreateCourses: true,
  canManageCourses: true,
  canTeachAssignedSessions: true,
  canManageAssignedHomework: true,
  canManageAssignedActivities: true,
  canManageAssignedMaterials: true,
};

describe('mapInstructorQuickActions', () => {
  it('uses existing tenant frontend routes for enabled actions', () => {
    const actions = mapInstructorQuickActions(t, {
      activeTenant: tenantWithFlags({
        'homework.enabled': true,
        'activities.enabled': true,
        'announcements.enabled': true,
        'challenges.enabled': true,
      }),
      permissions: instructorPermissions,
      homeworkNeedsReviewCount: 3,
    });

    expect(actions.map((action) => action.to)).toEqual(['/courses', '/sessions', '/homework', '/homework']);
    expect(actions.every((action) => action.disabled === false)).toBe(true);
    expect(actions.find((action) => action.key === 'review-grading')?.detail).toBe('3 submissions need review');
  });

  it('disables actions when optional feature flags are off', () => {
    const actions = mapInstructorQuickActions(t, {
      activeTenant: tenantWithFlags({
        'homework.enabled': false,
        'activities.enabled': false,
        'announcements.enabled': false,
        'challenges.enabled': false,
      }),
      permissions: instructorPermissions,
      homeworkNeedsReviewCount: 1,
    });

    expect(actions.every((action) => action.disabled === true)).toBe(true);
    expect(actions.find((action) => action.key === 'create-lesson-activity')?.to).toBe('/courses');
    expect(actions.find((action) => action.key === 'post-announcement')?.to).toBe('/sessions');
    expect(actions.find((action) => action.key === 'set-weekly-challenge')?.to).toBe('/homework');
    expect(actions.find((action) => action.key === 'review-grading')?.to).toBe('/homework');
  });

  it('disables grading when homework permission is missing even if homework is enabled', () => {
    const actions = mapInstructorQuickActions(t, {
      activeTenant: tenantWithFlags({
        'homework.enabled': true,
        'activities.enabled': true,
        'announcements.enabled': true,
        'challenges.enabled': true,
      }),
      permissions: {
        canCreateCourses: true,
        canManageCourses: true,
        canManageAssignedActivities: true,
        canManageAssignedMaterials: true,
      },
      homeworkNeedsReviewCount: 2,
    });

    expect(actions.find((action) => action.key === 'review-grading')?.disabled).toBe(true);
    expect(actions.find((action) => action.key === 'create-lesson-activity')?.disabled).toBe(false);
  });
});
