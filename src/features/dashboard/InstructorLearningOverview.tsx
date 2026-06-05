import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { FiActivity, FiAlertTriangle, FiAward, FiBookOpen, FiCalendar, FiCheckSquare, FiUsers } from 'react-icons/fi';
import type { InstructorDashboard, Tenant, TenantOverview } from '../../types/domain';
import { commonStatusLabelKeys, enumLabel } from '../../lib/enumLabels';
import { formatDate } from '../../lib/format';
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
import { InstructorActivityFeed } from './InstructorActivityFeed';
import { InstructorAtRiskStudents } from './InstructorAtRiskStudents';
import { InstructorQuickActions } from './InstructorQuickActions';
import { InstructorTopBar } from './InstructorTopBar';
import { mapInstructorActivityFeedItems, mapInstructorAtRiskStudents } from './instructorLearningMappers';
import { mapInstructorQuickActions } from './instructorQuickActionMappers';

export type InstructorLearningOverviewProps = {
  activeTenant: Tenant;
  overview: TenantOverview;
  instructorDashboard: InstructorDashboard | null;
  homeworkEnabled: boolean;
  attendanceEnabled: boolean;
  certificatesEnabled: boolean;
  canManageCertificates: boolean;
  homeworkNeedsReviewCount: number;
  activityNeedsReviewCount: number;
  upcomingWithoutMaterialsCount: number;
};

function statValue(value: unknown) {
  if (typeof value === 'number' || typeof value === 'string') return value;
  return 0;
}

function localDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function translationWithFallback(t: ReturnType<typeof useTranslation>['t'], key: string, fallback: string) {
  const translated = t(key);
  return translated === key ? fallback : translated;
}

function CompactEmptyNote({
  icon,
  title,
  detail,
}: {
  icon: ReactNode;
  title: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <article className="instructor-learning-compact-empty">
      <span className="instructor-learning-icon tone-muted" aria-hidden="true">{icon}</span>
      <span>
        <strong>{title}</strong>
        {detail ? <small>{detail}</small> : null}
      </span>
    </article>
  );
}

export function InstructorLearningOverview({
  activeTenant,
  overview,
  instructorDashboard,
  homeworkEnabled,
  attendanceEnabled,
  certificatesEnabled,
  canManageCertificates,
  homeworkNeedsReviewCount,
  activityNeedsReviewCount,
  upcomingWithoutMaterialsCount,
}: InstructorLearningOverviewProps) {
  const { t } = useTranslation();
  const instructorTodaySessions = useMemo(() => instructorDashboard?.today.sessions ?? [], [instructorDashboard]);
  const instructorUpcomingSessions = useMemo(() => instructorDashboard?.upcomingSessions ?? [], [instructorDashboard]);
  const instructorNextSession = instructorDashboard?.today.nextSession ?? instructorUpcomingSessions[0] ?? null;

  const overviewStatusLabel = (value?: string | null) => {
    return enumLabel(value || 'draft', {
      ...commonStatusLabelKeys,
      completed: 'courses.completed',
      scheduled: 'overview.scheduledSessions',
      submitted: 'student.submitted',
    }, t);
  };

  const insights: InstructorInsightItem[] = [
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

  const attentionItems: InstructorAttentionItem[] = [
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
      count: instructorDashboard?.queues.unmarkedAttendance ?? overview.sessions.unmarkedAttendance,
      tone: (instructorDashboard?.queues.unmarkedAttendance ?? overview.sessions.unmarkedAttendance) > 0 ? 'accent' : 'success',
      disabled: !attendanceEnabled || (instructorDashboard?.queues.unmarkedAttendance ?? overview.sessions.unmarkedAttendance) <= 0,
    },
    {
      to: '/sessions',
      icon: <FiActivity />,
      label: t('overview.recentActivity'),
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

  const visibleSessions: InstructorSessionItem[] = (instructorDashboard
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

  const upcomingGroups: InstructorSessionGroup[] = (instructorDashboard
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

  const launchTitle = instructorNextSession?.title ?? visibleSessions[0]?.title ?? t('overview.noSessionsToday');
  const launchDetail = instructorNextSession
    ? [instructorNextSession.courseTitle, instructorNextSession.groupName, instructorNextSession.startsAt ? formatDate(instructorNextSession.startsAt) : null].filter(Boolean).join(' · ')
    : visibleSessions[0]?.detail ?? t('overview.noLiveLinkReady');
  const launchTo = instructorNextSession?.liveHostUrl || instructorNextSession?.liveJoinUrl || visibleSessions[0]?.to || '/sessions';
  const launchExternal = Boolean(instructorNextSession?.liveHostUrl || instructorNextSession?.liveJoinUrl || visibleSessions[0]?.external);

  const homeworkStats: InstructorHomeworkStat[] = [
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

  const homeworkItems: InstructorHomeworkItem[] = overview.homework.queue.slice(0, 5).map((item) => {
    const homeworkItem = item as typeof item & {
      queue?: Record<string, number | undefined>;
      courseTitle?: string | null;
      groupName?: string | null;
      deadline?: string | null;
      dueAt?: string | null;
      isPublished?: boolean;
    };
    const needsReview = homeworkItem.queue?.needsReview ?? homeworkItem.queue?.needsReviewCount ?? 0;
    const needsRevision = homeworkItem.queue?.needsRevision ?? homeworkItem.queue?.needsRevisionCount ?? 0;
    const missing = homeworkItem.queue?.missing ?? homeworkItem.queue?.missingCount ?? 0;
    const statusKey = needsReview > 0 ? 'submitted' : needsRevision > 0 ? 'needs_revision' : missing > 0 ? 'missing' : homeworkItem.isPublished ? 'published' : 'draft';
    return {
      id: homeworkItem.id,
      title: homeworkItem.title,
      detail: [homeworkItem.courseTitle, homeworkItem.groupName, homeworkItem.deadline ?? homeworkItem.dueAt ? formatDate(homeworkItem.deadline ?? homeworkItem.dueAt) : null].filter(Boolean).join(' · '),
      statusLabel: needsReview > 0 ? t('overview.submissionsNeedReview', { count: needsReview }) : overviewStatusLabel(statusKey),
      statusTone: needsReview > 0 ? 'danger' : needsRevision > 0 ? 'accent' : missing > 0 ? 'muted' : 'success',
      age: needsReview > 0 ? needsReview : undefined,
      to: '/homework',
    };
  });

  const certificateTiles: InstructorCertificateTile[] = [
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

  const quickActions = mapInstructorQuickActions(t, {
    activeTenant,
    permissions: overview.permissions ?? overview.workspace?.permissions,
    homeworkNeedsReviewCount,
  });
  const activityItems = mapInstructorActivityFeedItems(t, overview);
  const atRiskStudents = mapInstructorAtRiskStudents(t, instructorDashboard);
  const upcomingSessionCount = upcomingGroups.reduce((count, group) => count + group.sessions.length, 0);
  const showAtRisk = atRiskStudents.length > 0;
  const showActivity = activityItems.length > 0;
  const showUpcoming = upcomingSessionCount > 0;
  const topbarTitle = translationWithFallback(t, 'overview.instructorGreetingTitle', 'Кутман күн, инструктор! 👋');
  const topbarDetail = translationWithFallback(t, 'overview.instructorGreetingDetail', 'Бүгүн окуучулар менен иштөөгө даярсызбы?');
  const compactEmptyNotes = [
    !showAtRisk ? {
      key: 'at-risk',
      icon: <FiCheckSquare />,
      title: t('overview.noActiveBlockers'),
      detail: t('overview.liveOfflineSignals'),
    } : null,
    !showActivity ? {
      key: 'activity',
      icon: <FiActivity />,
      title: t('overview.recentActivity'),
      detail: t('overview.noActiveBlockers'),
    } : null,
    !showUpcoming ? {
      key: 'upcoming',
      icon: <FiCalendar />,
      title: t('student.upcomingSessions'),
      detail: t('student.sessionsEmptyTitle'),
    } : null,
  ].filter(Boolean) as Array<{ key: string; icon: ReactNode; title: ReactNode; detail?: ReactNode }>;

  return (
    <div className="instructor-learning-overview">
      <InstructorTopBar
        title={topbarTitle}
        detail={topbarDetail}
        tenantName={activeTenant.name}
        todaySessionsLabel={t('overview.todaySessions')}
        todaySessionsValue={instructorDashboard ? instructorTodaySessions.length : overview.sessions.today}
        reviewLabel={t('overview.needsReview')}
        reviewValue={homeworkNeedsReviewCount}
        settingsLabel={t('overview.settings')}
      />

      <InstructorInsightsRow items={insights} />
      <InstructorAttentionQueue
        title={t('overview.needsAttention')}
        detail={t('overview.liveOfflineSignals')}
        emptyLabel={t('overview.noActiveBlockers')}
        items={attentionItems}
      />

      <section className="instructor-learning-hero-actions-grid">
        <InstructorLaunchPanel
          eyebrow={launchExternal ? t('overview.nextLiveLink') : t('overview.primaryActions')}
          title={launchTitle}
          detail={launchDetail}
          actionLabel={launchExternal ? t('overview.ready') : t('overview.openSessions')}
          to={launchTo}
          external={launchExternal}
          disabled={!launchExternal && !visibleSessions.length}
        />
        <InstructorQuickActions
          title={t('overview.primaryActions')}
          detail={topbarDetail}
          emptyLabel={t('overview.noActiveBlockers')}
          items={quickActions}
        />
      </section>

      <section className={showAtRisk ? 'instructor-learning-today-side-grid' : 'instructor-learning-today-side-grid is-single'}>
        <InstructorTodaySessions
          title={t('overview.todaySessions')}
          detail={t('overview.scheduledToday', { count: instructorDashboard ? instructorTodaySessions.length : overview.sessions.today })}
          emptyLabel={t('overview.noSessionsToday')}
          allLabel={t('overview.viewAll')}
          sessions={visibleSessions}
        />
        {showAtRisk ? (
          <InstructorAtRiskStudents
            title={t('overview.needsAttention')}
            detail={t('overview.liveOfflineSignals')}
            allLabel={t('overview.viewAll')}
            allTo="/groups"
            emptyLabel={t('overview.noActiveBlockers')}
            items={atRiskStudents}
          />
        ) : null}
      </section>

      {(homeworkEnabled || (certificatesEnabled && canManageCertificates)) ? (
        <section className="instructor-learning-workload-grid">
          {homeworkEnabled ? (
            <InstructorHomeworkQueue
              title={t('overview.homeworkQueue')}
              detail={t('overview.homeworkReviewDetail')}
              allLabel={t('overview.openQueue')}
              emptyLabel={t('overview.homeworkQueueEmptyTitle')}
              stats={homeworkStats}
              items={homeworkItems}
            />
          ) : null}
          {certificatesEnabled && canManageCertificates ? (
            <InstructorCertificatesPanel
              title={t('navigation.certificates')}
              detail={t('overview.certificatesWorkload')}
              actionLabel={t('overview.settings')}
              tiles={certificateTiles}
            />
          ) : null}
        </section>
      ) : null}

      {showActivity ? (
        <InstructorActivityFeed
          title={t('overview.recentActivity')}
          detail={t('overview.liveOfflineSignals')}
          allLabel={t('overview.viewAll')}
          allTo="/sessions"
          emptyLabel={t('overview.noActiveBlockers')}
          items={activityItems}
        />
      ) : null}

      {showUpcoming ? (
        <InstructorUpcomingSessionsPanel
          title={t('student.upcomingSessions')}
          detail={t('overview.upcomingSessionsCount', { count: instructorDashboard ? instructorUpcomingSessions.length : overview.sessions.upcoming.length })}
          emptyLabel={t('student.sessionsEmptyTitle')}
          allLabel={t('overview.viewAll')}
          groups={upcomingGroups}
        />
      ) : null}

      {compactEmptyNotes.length ? (
        <section className="instructor-learning-compact-empty-grid" aria-label={t('overview.noActiveBlockers')}>
          {compactEmptyNotes.map((note) => (
            <CompactEmptyNote key={note.key} icon={note.icon} title={note.title} detail={note.detail} />
          ))}
        </section>
      ) : null}
    </div>
  );
}

export default InstructorLearningOverview;
