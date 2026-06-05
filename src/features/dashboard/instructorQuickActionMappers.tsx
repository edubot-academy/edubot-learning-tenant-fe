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

function quickActionText(t: TFunction, key: string, fallback: string) {
  const translationKey = `overview.quickActions.${key}`;
  const translated = t(translationKey);
  return translated === translationKey ? fallback : translated;
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
      label: quickActionText(t, 'createCourseLesson', 'Курс/сабак түзүү'),
      detail: t('overview.createManageCoursesDetail'),
      disabledReason: t('overview.courseNoAccessDetail'),
      to: '/courses',
      icon: <FiPlusCircle />,
      tone: 'primary',
      disabled: !canCreateCourseContent || !activitiesEnabled,
    },
    {
      key: 'post-announcement',
      label: quickActionText(t, 'postAnnouncement', 'Жарыя кылуу'),
      detail: t('overview.assistantSessionsDetail'),
      disabledReason: announcementsEnabled
        ? t('overview.assistantSupportDisabled')
        : t('errors.featureDisabledDetail'),
      to: '/sessions',
      icon: <FiBell />,
      tone: 'secondary',
      disabled: !announcementsEnabled || !canManageActivities,
    },
    {
      key: 'set-weekly-challenge',
      label: quickActionText(t, 'weeklyChallenge', 'Апталык тапшырма'),
      detail: t('overview.homeworkReviewDetail'),
      disabledReason: challengesEnabled
        ? t('overview.homeworkQueueEmptyDetail')
        : t('errors.featureDisabledDetail'),
      to: '/homework',
      icon: <FiTarget />,
      tone: 'accent',
      disabled: !challengesEnabled || !canManageActivities,
    },
    {
      key: 'review-grading',
      label: quickActionText(t, 'reviewGrading', 'Текшерүү'),
      detail: homeworkNeedsReviewCount > 0
        ? t('overview.submissionsNeedReview', { count: homeworkNeedsReviewCount })
        : t('overview.homeworkReviewDetail'),
      disabledReason: homeworkEnabled
        ? t('overview.homeworkQueueEmptyDetail')
        : t('overview.homeworkDisabled'),
      to: '/homework',
      icon: homeworkNeedsReviewCount > 0 ? <FiCheckSquare /> : <FiBookOpen />,
      tone: homeworkNeedsReviewCount > 0 ? 'danger' : 'success',
      disabled: !homeworkEnabled || !canManageHomework,
    },
  ];
}
