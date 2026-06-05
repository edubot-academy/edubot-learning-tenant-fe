import { FiBell, FiBookOpen, FiCheckSquare, FiPlusCircle, FiTarget } from 'react-icons/fi';
import type { TFunction } from 'i18next';
import type { Tenant, TenantOverviewPermissions } from '../../types/domain';
import { isTenantFeatureEnabled } from '../tenant/tenantFeatures';
import type { InstructorQuickActionItem } from './InstructorQuickActions';

export type InstructorQuickActionContext = {
  activeTenant?: Tenant | null;
  permissions?: Partial<TenantOverviewPermissions> | null;
  homeworkNeedsReviewCount?: number;
};

function optionalFeatureEnabled(activeTenant: Tenant | null | undefined, key: string) {
  const flags = activeTenant?.featureFlags ?? {};
  return flags[key] !== false;
}

export function mapInstructorQuickActions(
  t: TFunction,
  {
    activeTenant,
    permissions,
    homeworkNeedsReviewCount = 0,
  }: InstructorQuickActionContext,
): InstructorQuickActionItem[] {
  const homeworkEnabled = isTenantFeatureEnabled(activeTenant, 'homework.enabled');
  const activitiesEnabled = optionalFeatureEnabled(activeTenant, 'activities.enabled');
  const announcementsEnabled = optionalFeatureEnabled(activeTenant, 'announcements.enabled');
  const challengesEnabled = optionalFeatureEnabled(activeTenant, 'challenges.enabled');

  const canCreateCourseContent = Boolean(
    permissions?.canCreateCourses ||
    permissions?.canManageCourses ||
    permissions?.canManageAssignedMaterials ||
    permissions?.canTeachAssignedSessions,
  );
  const canManageActivities = Boolean(
    permissions?.canManageAssignedActivities ||
    permissions?.canTeachAssignedSessions,
  );
  const canManageHomework = Boolean(
    permissions?.canManageAssignedHomework ||
    permissions?.canTeachAssignedSessions,
  );

  return [
    {
      key: 'create-lesson-activity',
      label: t('overview.quickActions.createLessonActivity', { defaultValue: 'Create lesson/activity' }),
      detail: t('overview.quickActions.createLessonActivityDetail', { defaultValue: 'Prepare content for your next class.' }),
      disabledReason: t('overview.quickActions.noContentPermission', { defaultValue: 'You do not have permission to manage course content yet.' }),
      to: '/courses',
      icon: <FiPlusCircle />,
      tone: 'primary',
      disabled: !canCreateCourseContent || !activitiesEnabled,
    },
    {
      key: 'post-announcement',
      label: t('overview.quickActions.postAnnouncement', { defaultValue: 'Post announcement' }),
      detail: t('overview.quickActions.postAnnouncementDetail', { defaultValue: 'Share updates with assigned students.' }),
      disabledReason: announcementsEnabled
        ? t('overview.quickActions.noAnnouncementPermission', { defaultValue: 'Announcement permissions are not enabled for this role.' })
        : t('overview.quickActions.announcementsDisabled', { defaultValue: 'Announcements are not enabled for this workspace.' }),
      to: '/sessions',
      icon: <FiBell />,
      tone: 'secondary',
      disabled: !announcementsEnabled || !canManageActivities,
    },
    {
      key: 'set-weekly-challenge',
      label: t('overview.quickActions.setWeeklyChallenge', { defaultValue: 'Set weekly challenge' }),
      detail: t('overview.quickActions.setWeeklyChallengeDetail', { defaultValue: 'Create a small goal to keep students engaged.' }),
      disabledReason: challengesEnabled
        ? t('overview.quickActions.noChallengePermission', { defaultValue: 'Challenge permissions are not enabled for this role.' })
        : t('overview.quickActions.challengesDisabled', { defaultValue: 'Weekly challenges are not enabled yet.' }),
      to: '/homework',
      icon: <FiTarget />,
      tone: 'accent',
      disabled: !challengesEnabled || !canManageActivities,
    },
    {
      key: 'review-grading',
      label: t('overview.quickActions.reviewGrading', { defaultValue: 'Review grading' }),
      detail: homeworkNeedsReviewCount > 0
        ? t('overview.submissionsNeedReview', { count: homeworkNeedsReviewCount })
        : t('overview.quickActions.reviewGradingDetail', { defaultValue: 'Check submitted homework and activities.' }),
      disabledReason: homeworkEnabled
        ? t('overview.quickActions.noGradingPermission', { defaultValue: 'Grading permission is not enabled for this role.' })
        : t('overview.homeworkDisabled'),
      to: '/homework',
      icon: homeworkNeedsReviewCount > 0 ? <FiCheckSquare /> : <FiBookOpen />,
      tone: homeworkNeedsReviewCount > 0 ? 'danger' : 'success',
      disabled: !homeworkEnabled || !canManageHomework,
    },
  ];
}
