import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import {
  FiActivity,
  FiAlertTriangle,
  FiAward,
  FiBarChart2,
  FiBookOpen,
  FiCalendar,
  FiCheckSquare,
  FiGrid,
  FiLifeBuoy,
  FiPlusCircle,
  FiSettings,
  FiUsers,
} from 'react-icons/fi';
import { PageHeader } from '../../components/PageHeader';
import { StatGrid } from '../../components/StatGrid';
import { EmptyState, LoadingState } from '../../components/DataState';
import { TenantDashboardShell } from '../../components/dashboard';
import { getActivityReviewQueue, getInstructorDashboard, getTenantDashboard, getTenantReportTimeSeries } from '../../services/api';
import type { ActivityReviewQueue, InstructorDashboard, TenantOverview, TenantReportTimeSeries } from '../../types/domain';
import { useAuth } from '../auth/AuthProvider';
import { useTenant } from '../tenant/TenantProvider';
import { canTeachAssignedSessions, canViewStudentSupportContext } from '../tenant/tenantRoles';
import { formatDate } from '../../lib/format';
import { activityActionLabelKeys, activityTargetLabelKeys, commonStatusLabelKeys, courseTypeLabelKeys, enumLabel } from '../../lib/enumLabels';
import { isTenantFeatureEnabled } from '../tenant/tenantFeatures';
import { getAdminSetupChecklist } from './adminSetupChecklist';
import type { OverviewWorkloadPoint } from './OverviewInsights';
import {
  InstructorAttentionQueue,
  InstructorCertificatesPanel,
  InstructorHomeworkQueue,
  InstructorInsightsRow,
  InstructorLaunchPanel,
  InstructorTodaySessions,
  InstructorUpcomingSessionsPanel,
  type InstructorAttentionItem,
  type InstructorCertificateTile,
  type InstructorHomeworkItem,
  type InstructorHomeworkStat,
  type InstructorInsightItem,
  type InstructorSessionGroup,
  type InstructorSessionItem,
} from './InstructorLearningDashboard';

const OverviewInsights = lazy(() => import('./OverviewInsights'));

function statValue(value: unknown) {
  if (typeof value === 'number' || typeof value === 'string') return value;
  return 0;
}

function statNumber(value: unknown) {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : 0;
}

function localDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function OverviewPage() {
  const { t } = useTranslation();
  const { activeTenant } = useTenant();
  const { user } = useAuth();
  const activeTenantId = activeTenant?.id;
  const [overview, setOverview] = useState<TenantOverview | null>(null);
  const [instructorDashboard, setInstructorDashboard] = useState<InstructorDashboard | null>(null);
  const [activityQueue, setActivityQueue] = useState<ActivityReviewQueue | null>(null);
  const [timeSeries, setTimeSeries] = useState<TenantReportTimeSeries | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState(false);
  const [showCompletedSetup, setShowCompletedSetup] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setOverview(null);
    setInstructorDashboard(null);
    setActivityQueue(null);
    setTimeSeries(null);
    setInsightsLoading(false);
    setInsightsError(false);
    if (!activeTenantId) return;
    let cancelled = false;
    const shouldLoadInstructorDashboard = canTeachAssignedSessions(user, activeTenant);
    setLoading(true);
    getTenantDashboard(activeTenantId)
      .then((nextOverview) => {
        if (cancelled) return;
        setOverview(nextOverview);
        if (shouldLoadInstructorDashboard) {
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
        }
        const permissions = nextOverview.permissions ?? nextOverview.workspace?.permissions;
        if (permissions?.canViewReports || permissions?.canManageMembers) {
          setInsightsLoading(true);
          setInsightsError(false);
          getTenantReportTimeSeries(activeTenantId)
            .then((nextTimeSeries) => {
              if (!cancelled) setTimeSeries(nextTimeSeries);
            })
            .catch(() => {
              if (!cancelled) setInsightsError(true);
            })
            .finally(() => {
              if (!cancelled) setInsightsLoading(false);
            });
        }
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
  }, [activeTenant, activeTenantId, t, user]);

  const overviewPermissions = overview?.permissions ?? overview?.workspace?.permissions;
  const canManageMembers = Boolean(overviewPermissions?.canManageMembers);
  const canManageCertificates = Boolean(overviewPermissions?.canManageCertificates);
  const canCreateCourses = Boolean(overviewPermissions?.canCreateCourses);
  const canViewActivity = Boolean(overviewPermissions?.canViewActivity);
  const overviewRole = overview?.role ?? overview?.workspace?.role ?? activeTenant?.role;
  const isAssistant = overviewRole === 'assistant';
  const homeworkEnabled = isTenantFeatureEnabled(activeTenant, 'homework.enabled');
  const certificatesEnabled = isTenantFeatureEnabled(activeTenant, 'certificates.enabled');
  const attendanceEnabled = isTenantFeatureEnabled(activeTenant, 'attendance.enabled');
  const assistantSupportEnabled = isAssistant && canViewStudentSupportContext(user, activeTenant);
  const instructorQueues = instructorDashboard?.queues;
  const instructorTodaySessions = useMemo(() => instructorDashboard?.today.sessions ?? [], [instructorDashboard]);
  const instructorUpcomingSessions = useMemo(() => instructorDashboard?.upcomingSessions ?? [], [instructorDashboard]);
  const instructorNextSession = instructorDashboard?.today.nextSession ?? instructorUpcomingSessions[0] ?? null;
  const unmarkedAttendanceCount = instructorQueues?.unmarkedAttendance ?? statNumber(overview?.stats.unmarkedAttendance);
  const homeworkNeedsReviewCount = instructorQueues?.homeworkNeedsReview ?? statNumber(overview?.stats.homeworkNeedsReview);
  const activityNeedsReviewCount = activityQueue?.summary.needsReview ?? instructorQueues?.activityNeedsReview ?? 0;
  const upcomingWithoutMaterialsCount = instructorQueues?.upcomingWithoutMaterials ?? 0;

  const stats = useMemo(() => {
    if (!overview) return [];
    if (!canManageMembers) {
      if (isAssistant) {
        return [
          { label: t('navigation.courses'), value: statValue(overview.stats.courses), hint: t('overview.coursesScopeHint') },
          { label: t('student.upcomingSessions'), value: statValue(overview.stats.upcomingSessions), hint: t('overview.scheduledClasses') },
          { label: t('overview.activeGroupsLabel'), value: statValue(overview.stats.activeGroups), hint: t('overview.activeGroupsHint') },
          { label: t('navigation.support'), value: assistantSupportEnabled ? t('overview.enabled') : '-', hint: t('overview.assistantSupportDetail') },
        ];
      }
      return [
        { label: isAssistant ? t('navigation.courses') : t('student.myCourses'), value: statValue(overview.stats.courses), hint: t('overview.coursesScopeHint') },
        { label: t('student.upcomingSessions'), value: statValue(overview.stats.upcomingSessions), hint: t('overview.scheduledClasses') },
        ...(homeworkEnabled ? [{ label: t('overview.needsReview'), value: homeworkNeedsReviewCount, hint: t('overview.homeworkQueueHint') }] : []),
        ...(certificatesEnabled ? [{ label: t('navigation.certificates'), value: statValue(overview.stats.certificatesPending), hint: t('overview.certificatesHint') }] : []),
      ];
    }
    return [
      { label: t('navigation.courses'), value: statValue(overview.stats.courses), hint: t('overview.tenantCatalog') },
      { label: t('overview.students'), value: statValue(overview.stats.students), hint: t('overview.studentsHint') },
      { label: t('overview.activeGroupsLabel'), value: statValue(overview.stats.activeGroups), hint: t('overview.activeGroupsHint') },
      { label: t('overview.workspaceReadiness'), value: `${overview.setup.progress}%`, hint: t('overview.configured', { percent: overview.setup.progress }) },
    ];
  }, [assistantSupportEnabled, canManageMembers, certificatesEnabled, homeworkEnabled, homeworkNeedsReviewCount, isAssistant, overview, t]);

  const actionCards = useMemo(() => {
    if (!overview) return [];
    if (isAssistant) {
      return [
        {
          to: '/groups',
          icon: FiCalendar,
          title: t('overview.groupsSessions'),
          detail: t('overview.groupsSessionsDetail'),
          metric: t('overview.activeGroups', { count: overview.stats.activeGroups ?? 0 }),
        },
        {
          to: '/sessions',
          icon: FiCalendar,
          title: t('navigation.sessions'),
          detail: t('overview.assistantSessionsDetail'),
          metric: t('overview.scheduledToday', { count: overview.sessions.today ?? 0 }),
        },
        ...(assistantSupportEnabled ? [{
          to: '/support',
          icon: FiLifeBuoy,
          title: t('navigation.support'),
          detail: t('overview.assistantSupportDetail'),
          metric: t('overview.students', { count: overview.stats.students ?? 0 }),
        }] : []),
      ];
    }
    return [
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
    ];
  }, [assistantSupportEnabled, attendanceEnabled, canCreateCourses, canManageCertificates, certificatesEnabled, homeworkEnabled, homeworkNeedsReviewCount, isAssistant, overview, t, unmarkedAttendanceCount]);

  const priorityItems = useMemo(() => {
    if (!overview) return [];
    const draftCourses = statNumber(overview.stats.draftCourses);
    const pendingCourses = statNumber(overview.stats.pendingCourses);
    const unmarkedAttendance = unmarkedAttendanceCount;
    const homeworkNeedsReview = homeworkNeedsReviewCount;
    return [
      ...(canManageMembers && overview.setup.progress < 100 ? [{
        to: '/settings',
        icon: FiSettings,
        title: t('overview.workspaceSetupIncomplete'),
        detail: t('overview.workspaceSetupIncompleteDetail', { percent: overview.setup.progress }),
        tone: 'warning' as const,
      }] : []),
      ...(canCreateCourses && draftCourses > 0 ? [{
        to: '/courses',
        icon: FiPlusCircle,
        title: t('overview.draftCourses'),
        detail: t('overview.draftCoursesDetail', { count: draftCourses }),
        tone: 'warning' as const,
      }] : []),
      ...(canCreateCourses && pendingCourses > 0 ? [{
        to: '/courses',
        icon: FiAlertTriangle,
        title: t('overview.pendingApprovals'),
        detail: t('overview.pendingApprovalsDetail', { count: pendingCourses }),
        tone: 'warning' as const,
      }] : []),
      ...(!isAssistant && attendanceEnabled && unmarkedAttendance > 0 ? [{
        to: '/attendance',
        icon: FiCheckSquare,
        title: t('overview.unmarked'),
        detail: t('overview.unmarkedMetric', { count: unmarkedAttendance }),
        tone: 'warning' as const,
      }] : []),
      ...(!isAssistant && homeworkEnabled && homeworkNeedsReview > 0 ? [{
        to: '/homework',
        icon: FiBookOpen,
        title: t('overview.homeworkReview'),
        detail: t('overview.submissionsNeedReview', { count: homeworkNeedsReview }),
        tone: 'info' as const,
      }] : []),
      ...(!isAssistant && activityNeedsReviewCount > 0 ? [{
        to: '/sessions',
        icon: FiActivity,
        title: t('overview.activity'),
        detail: t('overview.activeItemCount', { count: activityNeedsReviewCount }),
        tone: 'info' as const,
      }] : []),
      ...(!isAssistant && upcomingWithoutMaterialsCount > 0 ? [{
        to: '/sessions',
        icon: FiAlertTriangle,
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
      ...(certificatesEnabled && canManageCertificates && overview.certificates.coursesWithoutConfig > 0 ? [{
        to: '/certificates',
        icon: FiAlertTriangle,
        title: t('overview.certificateSetup'),
        detail: t('overview.certificateSetupDetail', { count: overview.certificates.coursesWithoutConfig }),
        tone: 'warning' as const,
      }] : []),
    ].sort((left, right) => (left.tone === right.tone ? 0 : left.tone === 'warning' ? -1 : 1));
  }, [activityNeedsReviewCount, attendanceEnabled, canCreateCourses, canManageCertificates, canManageMembers, certificatesEnabled, homeworkEnabled, homeworkNeedsReviewCount, isAssistant, overview, t, unmarkedAttendanceCount, upcomingWithoutMaterialsCount]);

  const operationStats = useMemo(() => {
    if (!overview) return [];
    return [
      ...(attendanceEnabled ? [
        { label: t('overview.attendanceRate'), value: overview.stats.attendanceRate === null ? '-' : `${overview.stats.attendanceRate}%` },
        { label: t('overview.unmarked'), value: unmarkedAttendanceCount },
        { label: t('overview.cancelled'), value: overview.sessions.cancelled },
      ] : [
        { label: t('navigation.attendance'), value: t('overview.disabled') },
      ]),
      ...(canCreateCourses ? [{ label: t('overview.pendingCourses'), value: overview.stats.pendingCourses ?? 0 }] : []),
    ];
  }, [attendanceEnabled, canCreateCourses, overview, t, unmarkedAttendanceCount]);

  const workloadChartData = useMemo<OverviewWorkloadPoint[]>(() => {
    if (!overview) return [];
    return [
      { label: t('overview.unmarkedShort'), value: attendanceEnabled ? unmarkedAttendanceCount : 0 },
      { label: t('overview.homeworkShort'), value: homeworkEnabled ? homeworkNeedsReviewCount : 0 },
      { label: t('overview.certificatesShort'), value: certificatesEnabled ? statNumber(overview.certificates.pending) : 0 },
      { label: t('overview.setupShort'), value: certificatesEnabled ? statNumber(overview.certificates.coursesWithoutConfig) : 0 },
    ];
  }, [attendanceEnabled, certificatesEnabled, homeworkEnabled, homeworkNeedsReviewCount, overview, t, unmarkedAttendanceCount]);

  const adminSetupChecklist = useMemo(() => {
    if (!overview || !canManageMembers) return [];
    return getAdminSetupChecklist(overview, activeTenant, {
      canManageCertificates,
      certificatesEnabled,
    });
  }, [activeTenant, canManageCertificates, canManageMembers, certificatesEnabled, overview]);
  const incompleteSetupCount = adminSetupChecklist.filter((item) => !item.complete).length;
  const visibleSetupChecklist = showCompletedSetup ? adminSetupChecklist : adminSetupChecklist.filter((item) => !item.complete);

  const todayOperations = useMemo(() => {
    if (!overview) return [];
    if (isAssistant) {
      const firstSession = overview.sessions.upcoming[0];
      return [
        {
          to: '/sessions',
          label: t('overview.todaySessions'),
          value: overview.sessions.today,
          detail: firstSession
            ? `${firstSession.title} · ${formatDate(firstSession.startsAt)}`
            : t('overview.noSessionsToday'),
          icon: FiCalendar,
          enabled: true,
        },
        {
          to: '/support',
          label: t('navigation.support'),
          value: assistantSupportEnabled ? t('overview.enabled') : '-',
          detail: assistantSupportEnabled ? t('overview.assistantSupportDetail') : t('overview.assistantSupportDisabled'),
          icon: FiLifeBuoy,
          enabled: assistantSupportEnabled,
        },
      ];
    }
    const visibleUpcomingSessions = instructorDashboard
      ? [...instructorTodaySessions, ...instructorUpcomingSessions]
      : overview.sessions.upcoming;
    const nextLiveSession = visibleUpcomingSessions.find((session) => session.liveJoinUrl || session.liveHostUrl);
    const firstSession = instructorNextSession ?? visibleUpcomingSessions[0];
    return [
      {
        to: '/sessions',
        label: t('overview.todaySessions'),
        value: instructorDashboard ? instructorTodaySessions.length : overview.sessions.today,
        detail: firstSession
          ? `${firstSession.title} · ${formatDate(firstSession.startsAt)}`
          : t('overview.noSessionsToday'),
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
  }, [assistantSupportEnabled, attendanceEnabled, homeworkEnabled, homeworkNeedsReviewCount, instructorDashboard, instructorNextSession, instructorTodaySessions, instructorUpcomingSessions, isAssistant, overview, t, unmarkedAttendanceCount]);

  const upcomingSessionGroups = useMemo(() => {
    const sessions = overview?.sessions.upcoming ?? [];
    const todayKey = localDateKey(new Date());
    return sessions.reduce<Array<{ key: string; label: string; sessions: typeof sessions }>>((groups, session) => {
      const startDate = session.startsAt ? new Date(session.startsAt) : null;
      const dateKey = !startDate || Number.isNaN(startDate.getTime()) ? 'unknown' : localDateKey(startDate);
      const label = dateKey === todayKey
        ? t('overview.today')
        : !startDate || Number.isNaN(startDate.getTime())
          ? t('overview.scheduledSessions')
          : startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const existing = groups.find((group) => group.key === dateKey);
      if (existing) existing.sessions.push(session);
      else groups.push({ key: dateKey, label, sessions: [session] });
      return groups;
    }, []);
  }, [overview?.sessions.upcoming, t]);

  const activityGroups = useMemo(() => {
    const items = overview?.activity ?? [];
    const todayKey = new Date().toDateString();
    return items.reduce<Array<{ key: string; label: string; items: typeof items }>>((groups, item) => {
      const createdAt = new Date(item.createdAt);
      const key = Number.isNaN(createdAt.getTime()) ? 'unknown' : createdAt.toDateString();
      const label = key === todayKey
        ? t('overview.today')
        : Number.isNaN(createdAt.getTime())
          ? t('overview.recentActivity')
          : createdAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      const existing = groups.find((group) => group.key === key);
      if (existing) existing.items.push(item);
      else groups.push({ key, label, items: [item] });
      return groups;
    }, []);
  }, [overview?.activity, t]);

  const overviewCourseTypeLabel = (value?: string | null) => {
    return value ? enumLabel(value, courseTypeLabelKeys, t) : t('overview.courseTypeDefault');
  };
  const overviewStatusLabel = (value?: string | null) => {
    return enumLabel(value || 'draft', {
      ...commonStatusLabelKeys,
      completed: 'courses.completed',
      scheduled: 'overview.scheduledSessions',
      submitted: 'student.submitted',
    }, t);
  };
  const activityActionLabel = (value?: string | null) => {
    return enumLabel(value, activityActionLabelKeys, t, t('overview.tenantTarget'));
  };
  const activityTargetLabel = (value?: string | null, id?: string | null) => {
    const target = enumLabel(value, activityTargetLabelKeys, t, t('overview.targetWorkspace'));
    return id ? t('overview.activityTargetWithId', { target, id }) : target;
  };
  const activitySubjectLabel = (metadata?: Record<string, unknown> | null) => {
    const subject = metadata?.courseTitle ?? metadata?.groupTitle ?? metadata?.sessionTitle ?? metadata?.title ?? metadata?.name;
    return typeof subject === 'string' && subject.trim() ? subject.trim() : null;
  };

  if (!activeTenant) return <EmptyState title={t('overview.noTenantAssignedTitle')} detail={t('overview.noTenantAssignedDetail')} />;
  if (loading) return <LoadingState label={t('overview.loading')} />;
  if (!overview) return <EmptyState title={t('overview.overviewUnavailableTitle')} detail={t('overview.overviewUnavailableDetail')} />;

  const heading = canManageMembers ? t('overview.tenantOverview') : isAssistant ? t('overview.assistantOverview') : t('overview.instructorOverview');
  const showInstructorLearningDashboard = !canManageMembers && !isAssistant;
  const primaryPriorityItem = priorityItems[0];
  const primaryAvailableAction = canManageMembers
    ? {
      to: '/operations',
      icon: FiGrid,
      title: t('overview.openOperations'),
      detail: t('overview.openOperationsDetail'),
      metric: t('operations.availableTools'),
    }
    : actionCards.find((action) => !action.disabled);
  const primaryOverviewAction = primaryPriorityItem
    ? {
      to: primaryPriorityItem.to,
      icon: primaryPriorityItem.icon,
      title: primaryPriorityItem.title,
      detail: primaryPriorityItem.detail,
      tone: primaryPriorityItem.tone,
    }
    : primaryAvailableAction
      ? {
        to: primaryAvailableAction.to,
        icon: primaryAvailableAction.icon,
        title: primaryAvailableAction.title,
        detail: primaryAvailableAction.detail,
        tone: 'info' as const,
      }
      : null;
  const supportingActionCards = primaryPriorityItem
    ? actionCards
    : actionCards.filter((action) => action.title !== primaryAvailableAction?.title);
  const PrimaryOverviewIcon = primaryOverviewAction?.icon;
  const courseWorkspacePath = canCreateCourses ? '/courses' : '/groups';
  const courseDetailPath = (courseId: number) => canCreateCourses ? `/courses?courseId=${courseId}` : `/groups?courseId=${courseId}`;
  const instructorLearningInsights: InstructorInsightItem[] = [
    {
      label: t('overview.students'),
      value: statValue(overview.stats.students),
      detail: t('overview.coursesScopeHint'),
      icon: <FiUsers />,
      tone: 'primary',
    },
    {
      label: t('overview.todaySessions'),
      value: instructorDashboard ? instructorTodaySessions.length : overview.sessions.today,
      detail: t('overview.scheduledToday', { count: instructorDashboard ? instructorTodaySessions.length : overview.sessions.today }),
      icon: <FiCalendar />,
      tone: 'secondary',
    },
    {
      label: t('overview.needsReview'),
      value: homeworkEnabled ? homeworkNeedsReviewCount : '-',
      detail: homeworkEnabled ? t('overview.homeworkQueueHint') : t('overview.homeworkDisabled'),
      icon: <FiBookOpen />,
      tone: homeworkNeedsReviewCount > 0 ? 'accent' : 'success',
    },
    {
      label: t('overview.attendanceRate'),
      value: overview.stats.attendanceRate == null ? '-' : `${overview.stats.attendanceRate}%`,
      detail: attendanceEnabled ? t('overview.markClasses') : t('overview.attendanceDisabled'),
      icon: <FiCheckSquare />,
      tone: 'success',
    },
  ];
  const instructorAttentionItems: InstructorAttentionItem[] = [
    {
      to: '/homework',
      icon: <FiBookOpen />,
      label: t('overview.homeworkReview'),
      detail: t('overview.homeworkReviewDetail'),
      count: homeworkNeedsReviewCount,
      tone: homeworkNeedsReviewCount > 0 ? 'danger' : 'success',
      disabled: !homeworkEnabled || homeworkNeedsReviewCount <= 0,
    },
    {
      to: '/attendance',
      icon: <FiCheckSquare />,
      label: t('overview.unmarked'),
      detail: t('overview.markClasses'),
      count: unmarkedAttendanceCount,
      tone: unmarkedAttendanceCount > 0 ? 'accent' : 'success',
      disabled: !attendanceEnabled || unmarkedAttendanceCount <= 0,
    },
    {
      to: '/sessions',
      icon: <FiActivity />,
      label: t('overview.activity'),
      detail: t('overview.activeItemCount', { count: activityNeedsReviewCount }),
      count: activityNeedsReviewCount,
      tone: activityNeedsReviewCount > 0 ? 'secondary' : 'success',
      disabled: activityNeedsReviewCount <= 0,
    },
    {
      to: '/sessions',
      icon: <FiAlertTriangle />,
      label: t('sessions.materials'),
      detail: t('overview.activeItemCount', { count: upcomingWithoutMaterialsCount }),
      count: upcomingWithoutMaterialsCount,
      tone: upcomingWithoutMaterialsCount > 0 ? 'accent' : 'success',
      disabled: upcomingWithoutMaterialsCount <= 0,
    },
    {
      to: '/certificates',
      icon: <FiAward />,
      label: t('overview.certificateApprovals'),
      detail: t('overview.certificatesWorkload'),
      count: overview.certificates.pending,
      tone: overview.certificates.pending > 0 ? 'primary' : 'success',
      disabled: !certificatesEnabled || !canManageCertificates || overview.certificates.pending <= 0,
    },
  ];
  const instructorVisibleSessions: InstructorSessionItem[] = (instructorDashboard
    ? [...instructorTodaySessions, ...instructorUpcomingSessions].slice(0, 4)
    : overview.sessions.upcoming.slice(0, 4)
  ).map((session, index) => {
    const startsAt = session.startsAt ? new Date(session.startsAt) : null;
    const isLive = Boolean(session.liveHostUrl || session.liveJoinUrl);
    const status = isLive ? 'live' : index === 0 ? 'soon' : 'upcoming';
    return {
      id: session.id ?? index,
      title: session.title ?? t('student.sessionFallback', { number: index + 1 }),
      detail: [session.courseTitle, session.groupName].filter(Boolean).join(' · '),
      time: startsAt && !Number.isNaN(startsAt.getTime())
        ? startsAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
        : undefined,
      status,
      statusLabel: isLive ? t('overview.ready') : index === 0 ? t('overview.nextLiveLink') : t('overview.scheduledSessions'),
      to: session.liveHostUrl || session.liveJoinUrl || '/sessions',
      external: Boolean(session.liveHostUrl || session.liveJoinUrl),
    };
  });
  const instructorUpcomingSessionGroups: InstructorSessionGroup[] = (instructorDashboard
    ? instructorUpcomingSessions
    : overview.sessions.upcoming
  ).slice(0, 8).reduce<InstructorSessionGroup[]>((groups, session, index) => {
    const startsAt = session.startsAt ? new Date(session.startsAt) : null;
    const dateKey = !startsAt || Number.isNaN(startsAt.getTime()) ? 'unknown' : localDateKey(startsAt);
    const todayKey = localDateKey(new Date());
    const label = dateKey === todayKey
      ? t('overview.today')
      : !startsAt || Number.isNaN(startsAt.getTime())
        ? t('overview.scheduledSessions')
        : startsAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const isLive = Boolean(session.liveHostUrl || session.liveJoinUrl);
    const item: InstructorSessionItem = {
      id: session.id ?? `${dateKey}-${index}`,
      title: session.title ?? t('student.sessionFallback', { number: index + 1 }),
      detail: [session.courseTitle, session.groupName].filter(Boolean).join(' · '),
      time: startsAt && !Number.isNaN(startsAt.getTime())
        ? startsAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
        : undefined,
      status: isLive ? 'live' : dateKey === todayKey ? 'soon' : 'upcoming',
      statusLabel: isLive ? t('overview.ready') : dateKey === todayKey ? t('overview.nextLiveLink') : overviewStatusLabel(session.status || 'scheduled'),
      to: session.liveHostUrl || session.liveJoinUrl || '/sessions',
      external: Boolean(session.liveHostUrl || session.liveJoinUrl),
    };
    const existing = groups.find((group) => group.key === dateKey);
    if (existing) existing.sessions.push(item);
    else groups.push({ key: dateKey, label, sessions: [item] });
    return groups;
  }, []);
  const instructorLaunchTitle = instructorNextSession?.title ?? instructorVisibleSessions[0]?.title ?? t('overview.noSessionsToday');
  const instructorLaunchDetail = instructorNextSession
    ? [instructorNextSession.courseTitle, instructorNextSession.groupName, instructorNextSession.startsAt ? formatDate(instructorNextSession.startsAt) : null].filter(Boolean).join(' · ')
    : instructorVisibleSessions[0]?.detail ?? t('overview.noLiveLinkReady');
  const instructorLaunchTo = instructorNextSession?.liveHostUrl || instructorNextSession?.liveJoinUrl || instructorVisibleSessions[0]?.to || '/sessions';
  const instructorLaunchExternal = Boolean(instructorNextSession?.liveHostUrl || instructorNextSession?.liveJoinUrl || instructorVisibleSessions[0]?.external);
  const instructorHomeworkStats: InstructorHomeworkStat[] = [
    {
      label: t('overview.needsReview'),
      value: overview.homework.summary.needsReview ?? homeworkNeedsReviewCount,
      tone: homeworkNeedsReviewCount > 0 ? 'danger' : 'success',
    },
    {
      label: overviewStatusLabel('needs_revision'),
      value: overview.homework.summary.needsRevision ?? overview.homework.summary.needs_revision ?? 0,
      tone: 'accent',
    },
    {
      label: overviewStatusLabel('submitted'),
      value: overview.homework.summary.submitted ?? 0,
      tone: 'primary',
    },
    {
      label: overviewStatusLabel('missing'),
      value: overview.homework.summary.missing ?? 0,
      tone: 'muted',
    },
  ];
  const instructorHomeworkItems: InstructorHomeworkItem[] = overview.homework.queue.slice(0, 5).map((item) => {
    const needsReview = item.queue?.needsReview ?? item.queue?.needsReviewCount ?? 0;
    const needsRevision = item.queue?.needsRevision ?? item.queue?.needsRevisionCount ?? 0;
    const missing = item.queue?.missing ?? item.queue?.missingCount ?? 0;
    const statusKey = needsReview > 0 ? 'submitted' : needsRevision > 0 ? 'needs_revision' : missing > 0 ? 'missing' : item.isPublished ? 'published' : 'draft';
    return {
      id: item.id,
      title: item.title,
      detail: [item.courseTitle, item.groupName, item.deadline ?? item.dueAt ? formatDate(item.deadline ?? item.dueAt) : null].filter(Boolean).join(' · '),
      statusLabel: needsReview > 0 ? t('overview.submissionsNeedReview', { count: needsReview }) : overviewStatusLabel(statusKey),
      statusTone: needsReview > 0 ? 'danger' : needsRevision > 0 ? 'accent' : missing > 0 ? 'muted' : 'success',
      age: needsReview > 0 ? needsReview : undefined,
      to: '/homework',
    };
  });
  const instructorCertificateTiles: InstructorCertificateTile[] = [
    {
      label: t('overview.pending'),
      value: overview.certificates.pending,
      tone: overview.certificates.pending > 0 ? 'danger' : 'success',
    },
    {
      label: t('overview.notIssued'),
      value: overview.certificates.waiting ?? overview.certificates.eligibleWaiting,
      tone: 'accent',
    },
    {
      label: t('overview.issued'),
      value: overview.certificates.issued,
      tone: 'success',
    },
    {
      label: t('overview.needsConfig'),
      value: overview.certificates.coursesWithoutConfig,
      tone: overview.certificates.coursesWithoutConfig > 0 ? 'secondary' : 'success',
    },
  ];

  return (
    <TenantDashboardShell
      variant={canManageMembers ? 'default' : 'engagement'}
      tone={canManageMembers ? 'neutral' : 'instructor'}
      className={canManageMembers ? undefined : 'instructor-learning-dashboard'}
    >
      <PageHeader
        title={activeTenant.name}
        eyebrow={heading}
        actions={(
          <>
            {canManageMembers ? <Link className="secondary-link-button" to="/members"><FiUsers /> {t('overview.members')}</Link> : null}
            <Link className="secondary-link-button" to="/settings"><FiSettings /> {t('overview.settings')}</Link>
          </>
        )}
      />
      {canManageMembers ? (
        <section className="overview-admin-command-center" aria-label={t('overview.tenantOverview')}>
          <div className="overview-admin-command-main">
            <div className="overview-admin-command-heading">
              <span className="ui-kicker">{t('overview.primaryActions')}</span>
              <h2>{primaryOverviewAction?.title ?? t('overview.workspaceClear')}</h2>
              <p>{primaryOverviewAction?.detail ?? t('overview.adminAllClearDetail')}</p>
              <div className="overview-admin-command-actions">
                <Link className="primary-link-button" to={primaryOverviewAction?.to ?? '/operations'}>{t('student.open')}</Link>
                <Link className="secondary-link-button" to="/operations"><FiGrid /> {t('overview.openOperations')}</Link>
              </div>
            </div>
            <div className="overview-admin-metrics" aria-label={t('overview.workspaceReadiness')}>
              {stats.map((item) => (
                <article className="overview-admin-metric" key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  {item.hint ? <small>{item.hint}</small> : null}
                </article>
              ))}
            </div>
          </div>
          <div className="overview-admin-queue">
            <div className="section-heading-row compact">
              <div>
                <h2>{t('overview.adminAttentionQueue')}</h2>
                <span>{priorityItems.length ? t('overview.activeItemCount', { count: priorityItems.length }) : t('overview.noAdminBlockers')}</span>
              </div>
            </div>
            <div className="overview-admin-queue-list">
              {priorityItems.length ? priorityItems.slice(0, 5).map((item) => {
                const Icon = item.icon;
                return (
                  <Link className={`overview-admin-queue-item ${item.tone}`} to={item.to} key={`${item.to}-${item.title}`}>
                    <Icon aria-hidden="true" />
                    <span>
                      <strong>{item.title}</strong>
                      <small>{item.detail}</small>
                    </span>
                  </Link>
                );
              }) : (
                <article className="overview-admin-queue-item info static">
                  <FiCheckSquare aria-hidden="true" />
                  <span>
                    <strong>{t('overview.workspaceClear')}</strong>
                    <small>{t('overview.adminAllClearDetail')}</small>
                  </span>
                </article>
              )}
            </div>
          </div>
        </section>
      ) : showInstructorLearningDashboard ? (
        <div className="instructor-learning-overview">
          <InstructorInsightsRow items={instructorLearningInsights} />
          <InstructorAttentionQueue
            title={t('overview.needsAttention')}
            detail={t('overview.liveOfflineSignals')}
            emptyLabel={t('overview.noActiveBlockers')}
            items={instructorAttentionItems}
          />
          <section className="instructor-learning-primary-grid">
            <InstructorLaunchPanel
              eyebrow={instructorLaunchExternal ? t('overview.nextLiveLink') : t('overview.primaryActions')}
              title={instructorLaunchTitle}
              detail={instructorLaunchDetail}
              actionLabel={instructorLaunchExternal ? t('overview.ready') : t('overview.openSessions')}
              to={instructorLaunchTo}
              external={instructorLaunchExternal}
              disabled={!instructorLaunchExternal && !instructorVisibleSessions.length}
            />
            <InstructorTodaySessions
              title={t('overview.todaySessions')}
              detail={t('overview.scheduledToday', { count: instructorDashboard ? instructorTodaySessions.length : overview.sessions.today })}
              emptyLabel={t('overview.noSessionsToday')}
              allLabel={t('overview.viewAll')}
              sessions={instructorVisibleSessions}
            />
          </section>
          {(homeworkEnabled || (certificatesEnabled && canManageCertificates)) ? (
            <section className="instructor-learning-workload-grid">
              {homeworkEnabled ? (
                <InstructorHomeworkQueue
                  title={t('overview.homeworkQueue')}
                  detail={t('overview.homeworkReviewDetail')}
                  allLabel={t('overview.openQueue')}
                  emptyLabel={t('overview.homeworkQueueEmptyTitle')}
                  stats={instructorHomeworkStats}
                  items={instructorHomeworkItems}
                />
              ) : null}
              {certificatesEnabled && canManageCertificates ? (
                <InstructorCertificatesPanel
                  title={t('navigation.certificates')}
                  detail={t('overview.certificatesWorkload')}
                  actionLabel={t('overview.configure')}
                  tiles={instructorCertificateTiles}
                />
              ) : null}
            </section>
          ) : null}
          <InstructorUpcomingSessionsPanel
            title={t('student.upcomingSessions')}
            detail={t('overview.upcomingSessionsCount', { count: instructorDashboard ? instructorUpcomingSessions.length : overview.sessions.upcoming.length })}
            emptyLabel={t('student.sessionsEmptyTitle')}
            allLabel={t('overview.viewAll')}
            groups={instructorUpcomingSessionGroups}
          />
        </div>
      ) : (
        <StatGrid items={stats} />
      )}

      {!showInstructorLearningDashboard && !canManageMembers && primaryOverviewAction && PrimaryOverviewIcon ? (
        <Link className={`overview-next-action ${primaryOverviewAction.tone}`} to={primaryOverviewAction.to} aria-label={primaryOverviewAction.title}>
          <span className="ui-icon-tile overview-action-icon"><PrimaryOverviewIcon /></span>
          <span>
            <span className="ui-kicker">{t('overview.primaryActions')}</span>
            <strong>{primaryOverviewAction.title}</strong>
            <small>{primaryOverviewAction.detail}</small>
          </span>
          <span className="primary-link-button">{t('student.open')}</span>
        </Link>
      ) : null}

      {!showInstructorLearningDashboard ? (
      <section className="overview-today-strip" aria-label={t('overview.todayOperations')}>
        <div className="overview-today-heading">
          <span className="ui-kicker">{t('overview.today')}</span>
          <strong>{t('overview.todayOperations')}</strong>
        </div>
        <div className="overview-today-list">
          {todayOperations.map((item) => {
            const Icon = item.icon;
            const content = (
              <>
                <Icon aria-hidden="true" />
                <span>
                  <strong>{item.value}</strong>
                  <small>{item.label}</small>
                  <em>{item.detail}</em>
                </span>
              </>
            );
            if (item.external && item.enabled) {
              return <a className="overview-today-card" href={item.to} target="_blank" rel="noreferrer" key={item.label}>{content}</a>;
            }
            return item.enabled ? (
              <Link className="overview-today-card" to={item.to} key={item.label}>{content}</Link>
            ) : (
              <article className="overview-today-card disabled" key={item.label}>{content}</article>
            );
          })}
        </div>
      </section>
      ) : null}

      {!showInstructorLearningDashboard && !canManageMembers ? (
      <section className={`overview-priority-strip ${priorityItems.length ? '' : 'all-clear'}`} aria-label={t('overview.needsAttention')}>
        {priorityItems.length ? (
          <>
          <div className="overview-priority-heading">
            <span className="ui-kicker">{canManageMembers ? t('overview.adminAttentionQueue') : t('overview.needsAttention')}</span>
            <strong>{t('overview.activeItemCount', { count: priorityItems.length })}</strong>
          </div>
          <div className="overview-priority-list">
            {priorityItems.slice(0, 4).map((item) => {
              const Icon = item.icon;
              return (
                <Link className={`overview-priority-card ${item.tone}`} to={item.to} key={`${item.to}-${item.title}`}>
                  <Icon />
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.detail}</small>
                  </span>
                </Link>
              );
            })}
          </div>
          </>
        ) : (
          <>
            <div className="overview-priority-heading">
              <span className="ui-kicker">{canManageMembers ? t('overview.adminAttentionQueue') : t('overview.needsAttention')}</span>
              <strong>{canManageMembers ? t('overview.noAdminBlockers') : t('overview.noActiveBlockers')}</strong>
            </div>
            <div className="overview-priority-list">
              <article className="overview-priority-card info static">
                <FiCheckSquare />
                <span>
                  <strong>{t('overview.workspaceClear')}</strong>
                  <small>{canManageMembers ? t('overview.adminAllClearDetail') : t('overview.allClearDetail')}</small>
                </span>
              </article>
            </div>
          </>
        )}
      </section>
      ) : null}

      {canManageMembers ? (
        <div className="settings-grid overview-lower-grid overview-admin-grid">
          <section className="settings-panel overview-setup-checklist">
            <div className="section-heading-row compact">
              <div>
                <h2>{t('overview.setupChecklist.title')}</h2>
                <span>{incompleteSetupCount ? t('overview.setupChecklist.remaining', { count: incompleteSetupCount }) : t('overview.setupChecklist.complete')}</span>
              </div>
              <button type="button" className="link-button" onClick={() => setShowCompletedSetup((current) => !current)}>
                {showCompletedSetup ? t('overview.setupChecklist.hideCompleted') : t('overview.setupChecklist.showCompleted')}
              </button>
            </div>
            <div className="progress-cell overview-progress setup-progress">
              <span style={{ width: `${overview.setup.progress}%` }} />
              <strong>{overview.setup.progress}%</strong>
            </div>
            <div className="overview-setup-list">
              {visibleSetupChecklist.map((item) => (
                <Link className={`setup-checklist-item ${item.complete ? 'complete' : 'current'}`} to={item.to} key={item.key}>
                  <FiCheckSquare aria-hidden="true" />
                  <div>
                    <strong>{t(item.labelKey)}</strong>
                    <span>{t(item.detailKey)}</span>
                  </div>
                  <span className={`status-badge ${item.complete ? 'published' : 'pending'}`}>
                    {item.complete ? t('overview.setupChecklist.done') : t('overview.setupChecklist.todo')}
                  </span>
                </Link>
              ))}
              {!visibleSetupChecklist.length ? (
                <article className="setup-checklist-item complete static">
                  <FiCheckSquare aria-hidden="true" />
                  <div>
                    <strong>{t('overview.setupChecklist.complete')}</strong>
                    <span>{t('overview.adminAllClearDetail')}</span>
                  </div>
                </article>
              ) : null}
            </div>
          </section>

          <section className="settings-panel overview-workload-panel">
            <div className="section-heading-row">
              <div>
                <h2>{t('navigation.operations')}</h2>
                <span>{t('overview.adminOperationsDetail')}</span>
              </div>
              <Link className="link-button" to="/operations">{t('overview.openOperations')}</Link>
            </div>
            <div className="overview-workload-list">
              <Link className="overview-workload-row primary" to="/operations">
                <FiGrid aria-hidden="true" />
                <span>
                  <strong>{t('overview.openOperations')}</strong>
                  <small>{t('overview.openOperationsDetail')}</small>
                </span>
              </Link>
              <div className="overview-workload-row">
                <span>{t('navigation.courses')}</span>
                <strong>{overview.stats.courses ?? 0}</strong>
              </div>
              <div className="overview-workload-row">
                <span>{t('navigation.groups')}</span>
                <strong>{overview.stats.activeGroups ?? 0}</strong>
              </div>
              <div className="overview-workload-row">
                <span>{t('overview.pendingCourses')}</span>
                <strong>{overview.stats.pendingCourses ?? 0}</strong>
              </div>
              <div className="overview-workload-row">
                <span>{t('overview.unmarked')}</span>
                <strong>{attendanceEnabled ? overview.sessions.unmarkedAttendance : t('overview.disabled')}</strong>
              </div>
            </div>
          </section>

        </div>
      ) : null}

      {!showInstructorLearningDashboard && !canManageMembers ? (
      <section className="overview-action-grid" aria-label={t('overview.primaryActions')}>
        {supportingActionCards.map((action) => {
          const Icon = action.icon;
          const content = (
            <>
              <span className="ui-icon-tile overview-action-icon"><Icon /></span>
              <div>
                <strong>{action.title}</strong>
                <span>{action.disabled ? action.disabledReason : action.detail}</span>
              </div>
              <small className={action.disabled ? 'status-badge destructive' : 'status-badge published'}>{action.metric}</small>
            </>
          );
          return action.disabled ? (
            <article className="overview-action-card disabled" key={action.title}>{content}</article>
          ) : (
            <Link className="overview-action-card" to={action.to} key={action.title}>{content}</Link>
          );
        })}
      </section>
      ) : null}

      <div className="workspace-grid overview-grid">
        <section className="content-section">
          <div className="section-heading-row">
            <div>
              <h2>{canManageMembers ? t('overview.recentCourses') : t('overview.coursesInScope')}</h2>
              <span>{t('overview.tenantCourseWorkspace')}</span>
            </div>
            <Link className="link-button" to={courseWorkspacePath}>{t('overview.viewAll')}</Link>
          </div>
          <div className="table-wrap overview-course-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('overview.course')}</th>
                  <th>{t('overview.type')}</th>
                  <th>{t('overview.status')}</th>
                  <th>{t('overview.students')}</th>
                </tr>
              </thead>
              <tbody>
                {overview.courses.map((course) => (
                  <tr key={course.id}>
                    <td>
                      <Link className="table-primary-link" to={courseDetailPath(course.id)}>{course.title}</Link>
                      {course.instructor?.fullName ? <small>{course.instructor.fullName}</small> : null}
                    </td>
                    <td><span className="metadata-text">{overviewCourseTypeLabel(course.courseType)}</span></td>
                    <td><span className={`status-badge ${course.status || 'draft'}`}>{overviewStatusLabel(course.status)}</span></td>
                    <td>{course.enrolledStudents ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!overview.courses.length ? (
            <EmptyState
              title={t('overview.tenantCoursesEmptyTitle')}
              detail={canCreateCourses ? t('overview.tenantCoursesEmptyDetail') : t('overview.courseNoAccessDetail')}
              action={canCreateCourses ? <Link className="secondary-link-button" to="/courses">{t('overview.openCourses')}</Link> : undefined}
            />
          ) : null}
        </section>

        <div className="overview-side-stack">
          {canManageMembers && certificatesEnabled && canManageCertificates ? (
            <section className="settings-panel overview-workload-panel certificate-workload-panel compact">
              <div className="section-heading-row compact">
                <div>
                  <h2>{t('navigation.certificates')}</h2>
                  <span>{t('overview.certificatesWorkload')}</span>
                </div>
                <Link className="link-button" to="/certificates">{t('overview.configureCertificates')}</Link>
              </div>
              <Link className="overview-certificate-focus" to="/certificates">
                <strong>{overview.certificates.coursesWithoutConfig}</strong>
                <span>{t('overview.certificateSetupDetail', { count: overview.certificates.coursesWithoutConfig })}</span>
              </Link>
              <div className="overview-workload-list compact certificate-secondary-list">
                <div className="overview-workload-row">
                  <span>{t('overview.notIssued')}</span>
                  <strong>{overview.certificates.waiting ?? overview.certificates.eligibleWaiting}</strong>
                </div>
                <div className="overview-workload-row">
                  <span>{t('overview.pending')}</span>
                  <strong>{overview.certificates.pending}</strong>
                </div>
                <div className="overview-workload-row">
                  <span>{t('overview.issued')}</span>
                  <strong>{overview.certificates.issued}</strong>
                </div>
              </div>
            </section>
          ) : null}

          {!showInstructorLearningDashboard ? (
          <aside className="settings-panel workflow-context-panel overview-upcoming-panel">
            <div className="section-heading-row compact">
              <div>
                <h2>{t('student.upcomingSessions')}</h2>
                <span>{t('overview.upcomingSessionsCount', { count: overview.sessions.upcoming.length })}</span>
              </div>
              <Link className="link-button" to="/sessions">{t('overview.viewAll')}</Link>
            </div>
            <div className="stack-list overview-session-list">
              {upcomingSessionGroups.map((group) => (
                <section className="overview-session-date-group" key={group.key}>
                  <h3>{group.label}</h3>
                  <div className="stack-list">
                    {group.sessions.map((session) => (
                      <article className="stack-list-item" key={session.id}>
                        <div>
                          <strong>{session.title}</strong>
                          <span className="overview-session-meta">
                            <span>{formatDate(session.startsAt)}</span>
                            <span className={`status-badge ${session.status || 'scheduled'}`}>{overviewStatusLabel(session.status)}</span>
                          </span>
                          {session.groupName || session.courseTitle ? (
                            <span className="overview-session-context">{session.courseTitle ?? t('student.courseNotSet')} · {session.groupName ?? t('student.groupNotSet')}</span>
                          ) : null}
                        </div>
                        <Link className="overview-session-open-link" to="/sessions">{t('student.open')}</Link>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
              {!overview.sessions.upcoming.length ? (
                <EmptyState
                  title={t('student.sessionsEmptyTitle')}
                  detail={t('student.sessionsEmptyDetail')}
                  action={<Link className="secondary-link-button" to="/sessions">{t('overview.openSessions')}</Link>}
                />
              ) : null}
            </div>
          </aside>
          ) : null}
        </div>
      </div>

      {canManageMembers ? (
        <Suspense fallback={<div className="overview-insight-empty">{t('overview.insightsLoading')}</div>}>
          <OverviewInsights
            timeSeries={timeSeries}
            workloadChartData={workloadChartData}
            setupProgress={statNumber(overview.setup.progress)}
            insightsLoading={insightsLoading}
            insightsError={insightsError}
          />
        </Suspense>
      ) : null}

      <div className="settings-grid overview-lower-grid">
        {!canManageMembers ? (
        <section className="settings-panel">
          <div className="section-heading-row">
            <div>
              <h2>{t('overview.operations')}</h2>
              <span>{t('overview.liveOfflineSignals')}</span>
            </div>
            <FiBarChart2 />
          </div>
          <div className="stat-grid compact session-stat-grid">
            {operationStats.map((stat) => (
              <section className="stat-tile" key={stat.label}>
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
              </section>
            ))}
          </div>
        </section>
        ) : null}

        {homeworkEnabled && !showInstructorLearningDashboard && !canManageMembers ? (
          <section className="settings-panel">
            <div className="section-heading-row">
              <div>
                <h2>{t('overview.homeworkQueue')}</h2>
                <span>{t('overview.needsAttention')}</span>
              </div>
              <Link className="link-button" to="/homework">{t('overview.openQueue')}</Link>
            </div>
            <div className="stat-grid compact session-stat-grid">
              {['total', 'needsReview', 'missing', 'overdue'].map((key) => (
                <section className="stat-tile" key={key}>
                  <span>{overviewStatusLabel(key)}</span>
                  <strong>{overview.homework.summary[key] ?? 0}</strong>
                </section>
              ))}
            </div>
            <div className="stack-list">
              {overview.homework.queue.map((item) => (
                <article className="stack-list-item" key={item.id}>
                  <div>
                    <strong>{item.title}</strong>
                    <span>
                      <span className={`status-badge ${item.isPublished ? 'published' : 'draft'}`}>{item.isPublished ? t('overview.published') : t('overview.draft')}</span>
                      {' '}{item.courseTitle ?? t('student.courseNotSet')} · {item.groupName ?? t('student.groupNotSet')} · {formatDate(item.deadline ?? item.dueAt)}
                    </span>
                  </div>
                  <span className={`status-badge ${(item.queue?.needsReview ?? 0) > 0 ? 'pending_approval' : 'approved'}`}>{t('overview.submissionsNeedReview', { count: item.queue?.needsReview ?? 0 })}</span>
                </article>
              ))}
              {!overview.homework.queue.length ? <EmptyState title={t('overview.homeworkQueueEmptyTitle')} detail={t('overview.homeworkQueueEmptyDetail')} /> : null}
            </div>
          </section>
        ) : null}

        {certificatesEnabled && canManageCertificates && !showInstructorLearningDashboard && !canManageMembers ? (
          <section className="settings-panel">
            <div className="section-heading-row">
              <div>
                <h2>{t('navigation.certificates')}</h2>
                <span>{t('overview.certificatesWorkload')}</span>
              </div>
              <Link className="link-button" to="/certificates">{t('student.open')}</Link>
            </div>
            <div className="stat-grid compact session-stat-grid">
              <section className="stat-tile"><span>{t('overview.pending')}</span><strong>{overview.certificates.pending}</strong></section>
              <section className="stat-tile"><span>{t('overview.notIssued')}</span><strong>{overview.certificates.waiting ?? overview.certificates.eligibleWaiting}</strong></section>
              <section className="stat-tile"><span>{t('overview.issued')}</span><strong>{overview.certificates.issued}</strong></section>
              <section className="stat-tile"><span>{t('overview.needsConfig')}</span><strong>{overview.certificates.coursesWithoutConfig}</strong></section>
            </div>
          </section>
        ) : null}

      </div>

      {canViewActivity ? (
        <section className="settings-panel full overview-activity-panel">
          <div className="section-heading-row compact">
            <div>
              <h2>{t('overview.recentActivity')}</h2>
              <span>{overview.activity.length ? t('overview.activeItemCount', { count: overview.activity.length }) : t('overview.activityEmptyTitle')}</span>
            </div>
          </div>
          <div className="activity-timeline">
            {activityGroups.map((group) => (
              <section className="activity-date-group" key={group.key}>
                <h3>{group.label}</h3>
                <div className="activity-feed-list">
                  {group.items.map((item) => {
                    const subject = activitySubjectLabel(item.metadata);
                    return (
                      <article className="activity-feed-item" key={item.id}>
                        <span className="activity-feed-dot" aria-hidden="true" />
                        <div className="activity-feed-copy">
                          <div className="activity-feed-title-row">
                            <strong>{subject ? `${subject} · ${activityActionLabel(item.action)}` : activityActionLabel(item.action)}</strong>
                            <span className="status-badge neutral">{activityTargetLabel(item.targetType, item.targetId)}</span>
                          </div>
                          <span>{item.actorFullName || item.actorEmail || t('overview.system')} · {formatDate(item.createdAt)}</span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
            {!overview.activity.length ? <EmptyState title={t('overview.activityEmptyTitle')} detail={t('overview.activityEmptyDetail')} /> : null}
          </div>
        </section>
      ) : null}
    </TenantDashboardShell>
  );
}
