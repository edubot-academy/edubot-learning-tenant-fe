import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import {
  FiActivity,
  FiAward,
  FiBookOpen,
  FiCalendar,
  FiCheckSquare,
  FiGrid,
  FiLifeBuoy,
  FiPlusCircle,
  FiSettings,
} from 'react-icons/fi';
import { EmptyState, LoadingState } from '../../components/DataState';
import { getActivityReviewQueue, getInstructorDashboard, getTenantDashboard } from '../../services/api';
import type { ActivityReviewQueue, InstructorDashboard, TenantOverview } from '../../types/domain';
import { enumLabel, commonStatusLabelKeys, courseTypeLabelKeys } from '../../lib/enumLabels';
import { isTenantFeatureEnabled } from '../tenant/tenantFeatures';
import { useTenant } from '../tenant/TenantProvider';
import { useAuth } from '../auth/AuthProvider';
import { canViewStudentSupportContext } from '../tenant/tenantRoles';
import { OverviewPage as LegacyOverviewPage } from './OverviewPage';
import { InstructorCockpitView, type CockpitAction, type CockpitPriorityItem, type CockpitTodayOperation } from './InstructorCockpitView';

function statValue(value: unknown) {
  if (typeof value === 'number' || typeof value === 'string') return value;
  return 0;
}

function statNumber(value: unknown) {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : 0;
}

export function OverviewPage() {
  const { t } = useTranslation();
  const { activeTenant } = useTenant();
  const { user } = useAuth();
  const activeTenantId = activeTenant?.id;
  const [overview, setOverview] = useState<TenantOverview | null>(null);
  const [instructorDashboard, setInstructorDashboard] = useState<InstructorDashboard | null>(null);
  const [activityQueue, setActivityQueue] = useState<ActivityReviewQueue | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setOverview(null);
    setInstructorDashboard(null);
    setActivityQueue(null);
    if (!activeTenantId) return;

    let cancelled = false;
    setLoading(true);

    getTenantDashboard(activeTenantId)
      .then((nextOverview) => {
        if (cancelled) return;
        setOverview(nextOverview);
        if (nextOverview.permissions?.canManageMembers) return;

        void Promise.all([
          getInstructorDashboard(activeTenantId),
          getActivityReviewQueue({ limit: 20 }),
        ])
          .then(([nextInstructorDashboard, nextActivityQueue]) => {
            if (cancelled) return;
            setInstructorDashboard(nextInstructorDashboard);
            setActivityQueue(nextActivityQueue);
          })
          .catch(() => {
            if (!cancelled) {
              setInstructorDashboard(null);
              setActivityQueue(null);
            }
          });
      })
      .catch(() => {
        if (!cancelled) toast.error(t('overview.overviewUnavailableTitle'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTenantId, t]);

  const homeworkEnabled = isTenantFeatureEnabled(activeTenant, 'homework.enabled');
  const certificatesEnabled = isTenantFeatureEnabled(activeTenant, 'certificates.enabled');
  const attendanceEnabled = isTenantFeatureEnabled(activeTenant, 'attendance.enabled');
  const overviewPermissions = overview?.permissions ?? overview?.workspace?.permissions;
  const canManageMembers = Boolean(overviewPermissions?.canManageMembers);
  const canManageCertificates = Boolean(overviewPermissions?.canManageCertificates);
  const canCreateCourses = Boolean(overviewPermissions?.canCreateCourses);
  const assistantSupportEnabled = overview?.role === 'assistant' && canViewStudentSupportContext(user, activeTenant);

  const instructorQueues = instructorDashboard?.queues;
  const instructorTodaySessions = instructorDashboard?.today.sessions ?? [];
  const instructorUpcomingSessions = instructorDashboard?.upcomingSessions ?? [];
  const instructorNextSession = instructorDashboard?.today.nextSession ?? instructorUpcomingSessions[0] ?? null;
  const unmarkedAttendanceCount = instructorQueues?.unmarkedAttendance ?? statNumber(overview?.stats.unmarkedAttendance);
  const homeworkNeedsReviewCount = instructorQueues?.homeworkNeedsReview ?? statNumber(overview?.stats.homeworkNeedsReview);
  const activityNeedsReviewCount = activityQueue?.summary.needsReview ?? instructorQueues?.activityNeedsReview ?? 0;
  const upcomingWithoutMaterialsCount = instructorQueues?.upcomingWithoutMaterials ?? 0;

  const stats = useMemo(() => {
    if (!overview) return [];
    return [
      { label: t('student.myCourses'), value: statValue(overview.stats.courses), hint: t('overview.coursesScopeHint') },
      { label: t('student.upcomingSessions'), value: statValue(overview.stats.upcomingSessions), hint: t('overview.scheduledClasses') },
      ...(homeworkEnabled ? [{ label: t('overview.needsReview'), value: homeworkNeedsReviewCount, hint: t('overview.homeworkQueueHint') }] : []),
      ...(certificatesEnabled ? [{ label: t('navigation.certificates'), value: statValue(overview.stats.certificatesPending), hint: t('overview.certificatesHint') }] : []),
    ];
  }, [certificatesEnabled, homeworkEnabled, homeworkNeedsReviewCount, overview, t]);

  const actionCards = useMemo<CockpitAction[]>(() => {
    if (!overview) return [];
    const items: CockpitAction[] = [
      ...(canCreateCourses ? [{
        to: '/courses',
        icon: FiPlusCircle,
        title: t('overview.createManageCourses'),
        detail: t('overview.createManageCoursesDetail'),
        metric: t('overview.draftMetric', { count: overview.stats.draftCourses ?? 0 }),
      }] : []),
      {
        to: '/groups',
        icon: FiCalendar,
        title: t('overview.groupsSessions'),
        detail: t('overview.groupsSessionsDetail'),
        metric: t('overview.activeGroups', { count: overview.stats.activeGroups ?? 0 }),
      },
      {
        to: '/attendance',
        icon: FiCheckSquare,
        title: t('navigation.attendance'),
        detail: t('overview.markClasses'),
        metric: t('overview.unmarkedMetric', { count: unmarkedAttendanceCount }),
        disabled: !attendanceEnabled,
        disabledReason: t('overview.attendanceDisabled'),
      },
      {
        to: '/homework',
        icon: FiBookOpen,
        title: t('overview.homeworkReview'),
        detail: t('overview.homeworkReviewDetail'),
        metric: t('overview.submissionsNeedReview', { count: homeworkNeedsReviewCount }),
        disabled: !homeworkEnabled,
        disabledReason: t('overview.homeworkDisabled'),
      },
      ...(canManageCertificates ? [{
        to: '/certificates',
        icon: FiAward,
        title: t('navigation.certificates'),
        detail: t('overview.certificatesWorkload'),
        metric: t('overview.certificateApprovalsDetail', { count: overview.certificates.pending }),
        disabled: !certificatesEnabled,
        disabledReason: t('errors.featureDisabledDetail'),
      }] : []),
      ...(assistantSupportEnabled ? [{
        to: '/support',
        icon: FiLifeBuoy,
        title: t('navigation.support'),
        detail: t('overview.assistantSupportDetail'),
        metric: t('overview.students', { count: overview.stats.students ?? 0 }),
      }] : []),
    ];
    return items;
  }, [assistantSupportEnabled, attendanceEnabled, canCreateCourses, canManageCertificates, certificatesEnabled, homeworkEnabled, homeworkNeedsReviewCount, overview, t, unmarkedAttendanceCount]);

  const priorityItems = useMemo<CockpitPriorityItem[]>(() => {
    if (!overview) return [];
    const items: CockpitPriorityItem[] = [
      ...(attendanceEnabled && unmarkedAttendanceCount > 0 ? [{
        to: '/attendance',
        icon: FiCheckSquare,
        title: t('overview.unmarked'),
        detail: t('overview.unmarkedMetric', { count: unmarkedAttendanceCount }),
        tone: 'warning' as const,
      }] : []),
      ...(homeworkEnabled && homeworkNeedsReviewCount > 0 ? [{
        to: '/homework',
        icon: FiBookOpen,
        title: t('overview.homeworkReview'),
        detail: t('overview.submissionsNeedReview', { count: homeworkNeedsReviewCount }),
        tone: 'info' as const,
      }] : []),
      ...(activityNeedsReviewCount > 0 ? [{
        to: '/sessions',
        icon: FiActivity,
        title: t('overview.activity'),
        detail: t('overview.activeItemCount', { count: activityNeedsReviewCount }),
        tone: 'info' as const,
      }] : []),
      ...(upcomingWithoutMaterialsCount > 0 ? [{
        to: '/sessions',
        icon: FiGrid,
        title: t('sessions.materials'),
        detail: t('overview.activeItemCount', { count: upcomingWithoutMaterialsCount }),
        tone: 'warning' as const,
      }] : []),
      ...(certificatesEnabled && canManageCertificates && overview.certificates.pending > 0 ? [{
        to: '/certificates',
        icon: FiAward,
        title: t('overview.certificateApprovals'),
        detail: t('overview.certificateApprovalsDetail', { count: overview.certificates.pending }),
        tone: 'info' as const,
      }] : []),
    ];
    return items.sort((left, right) => (left.tone === right.tone ? 0 : left.tone === 'warning' ? -1 : 1));
  }, [activityNeedsReviewCount, attendanceEnabled, canManageCertificates, certificatesEnabled, homeworkEnabled, homeworkNeedsReviewCount, overview, t, unmarkedAttendanceCount, upcomingWithoutMaterialsCount]);

  const todayOperations = useMemo<CockpitTodayOperation[]>(() => {
    if (!overview) return [];
    const visibleSessions = instructorDashboard
      ? [...instructorTodaySessions, ...instructorUpcomingSessions]
      : overview.sessions.upcoming;
    const nextLiveSession = visibleSessions.find((session) => session.liveHostUrl || session.liveJoinUrl);
    const firstSession = instructorNextSession ?? visibleSessions[0];

    return [
      {
        to: '/sessions',
        label: t('overview.todaySessions'),
        value: instructorDashboard ? instructorTodaySessions.length : overview.sessions.today,
        detail: firstSession ? firstSession.title : t('overview.noSessionsToday'),
        icon: FiCalendar,
        enabled: true,
      },
      {
        to: '/attendance',
        label: t('overview.unmarkedAttendance'),
        value: attendanceEnabled ? unmarkedAttendanceCount : t('overview.disabled'),
        detail: attendanceEnabled ? t('overview.markClasses') : t('overview.attendanceDisabled'),
        icon: FiCheckSquare,
        enabled: attendanceEnabled,
      },
      {
        to: '/homework',
        label: t('overview.pendingHomeworkReviews'),
        value: homeworkEnabled ? homeworkNeedsReviewCount : t('overview.disabled'),
        detail: homeworkEnabled ? t('overview.homeworkReviewDetail') : t('overview.homeworkDisabled'),
        icon: FiBookOpen,
        enabled: homeworkEnabled,
      },
      {
        to: nextLiveSession?.liveHostUrl || nextLiveSession?.liveJoinUrl || '/sessions',
        label: t('overview.nextLiveLink'),
        value: nextLiveSession ? t('overview.ready') : '-',
        detail: nextLiveSession ? nextLiveSession.title : t('overview.noLiveLinkReady'),
        icon: FiActivity,
        enabled: Boolean(nextLiveSession),
        external: Boolean(nextLiveSession?.liveHostUrl || nextLiveSession?.liveJoinUrl),
      },
    ];
  }, [attendanceEnabled, homeworkEnabled, homeworkNeedsReviewCount, instructorDashboard, instructorNextSession, instructorTodaySessions, instructorUpcomingSessions, overview, t, unmarkedAttendanceCount]);

  const primaryAction = priorityItems[0] ?? actionCards.find((action) => !action.disabled) ?? null;
  const normalizedPrimaryAction: CockpitPriorityItem | null = primaryAction
    ? {
      to: primaryAction.to,
      icon: primaryAction.icon,
      title: primaryAction.title,
      detail: 'detail' in primaryAction ? primaryAction.detail : '',
      tone: 'tone' in primaryAction ? primaryAction.tone : 'info',
    }
    : null;

  if (!activeTenant) return <EmptyState title={t('overview.noTenantAssignedTitle')} detail={t('overview.noTenantAssignedDetail')} />;
  if (loading) return <LoadingState label={t('overview.loading')} />;
  if (!overview) return <EmptyState title={t('overview.overviewUnavailableTitle')} detail={t('overview.overviewUnavailableDetail')} />;

  if (canManageMembers) {
    return <LegacyOverviewPage />;
  }

  return (
    <InstructorCockpitView
      tenant={activeTenant}
      overview={overview}
      stats={stats}
      primaryAction={normalizedPrimaryAction}
      todayOperations={todayOperations}
      priorityItems={priorityItems}
      actionCards={actionCards.filter((action) => action.title !== normalizedPrimaryAction?.title)}
      courseWorkspacePath={canCreateCourses ? '/courses' : '/groups'}
      courseDetailPath={(courseId) => canCreateCourses ? `/courses?courseId=${courseId}` : `/groups?courseId=${courseId}`}
      courseTypeLabel={(value) => value ? enumLabel(value, courseTypeLabelKeys, t) : t('overview.courseTypeDefault')}
      courseStatusLabel={(value) => enumLabel(value || 'draft', {
        ...commonStatusLabelKeys,
        completed: 'courses.completed',
        scheduled: 'overview.scheduledSessions',
        submitted: 'student.submitted',
      }, t)}
      canCreateCourses={canCreateCourses}
    />
  );
}
