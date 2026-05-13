import { useEffect, useMemo, useState } from 'react';
import type { TFunction } from 'i18next';
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
  FiPlusCircle,
  FiSettings,
  FiUsers,
} from 'react-icons/fi';
import { PageHeader } from '../../components/PageHeader';
import { StatGrid } from '../../components/StatGrid';
import { EmptyState, LoadingState } from '../../components/DataState';
import { getTenantDashboard } from '../../services/api';
import type { TenantOverview } from '../../types/domain';
import { useTenant } from '../tenant/TenantProvider';
import { formatDate, readable } from '../../lib/format';
import { activityActionLabelKeys, commonStatusLabelKeys, courseTypeLabelKeys, enumLabel } from '../../lib/enumLabels';
import { isTenantFeatureEnabled } from '../tenant/tenantFeatures';

function statValue(value: unknown) {
  if (typeof value === 'number' || typeof value === 'string') return value;
  return 0;
}

function statNumber(value: unknown) {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : 0;
}

type SetupItem = TenantOverview['setup']['items'][number];

const readinessItemKeys: Record<string, string> = {
  courses: 'courses',
  groups: 'groups',
  locale: 'locale',
  certificates: 'certificates',
};

function normalizeReadinessText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function translateReadinessValue(value: string, itemKey: string | undefined, t: TFunction) {
  const normalizedValue = normalizeReadinessText(value);
  const linkedMatch = normalizedValue.match(/^(\d+)\s+linked$/);

  if (itemKey === 'courses' && linkedMatch) {
    return t('overview.readiness.courses.linkedCount', { count: Number(linkedMatch[1]) });
  }

  if (itemKey === 'groups' && normalizedValue === 'no groups') {
    return t('overview.readiness.groups.noGroups');
  }

  if (itemKey === 'certificates' && normalizedValue === 'needs setup') {
    return t('overview.readiness.certificates.needsSetup');
  }

  return readable(value);
}

function getReadinessItemCopy(item: SetupItem, t: TFunction) {
  const itemKey = readinessItemKeys[normalizeReadinessText(item.label)];

  return {
    label: itemKey ? t(`overview.readiness.${itemKey}.label`) : readable(item.label),
    hint: itemKey ? t(`overview.readiness.${itemKey}.hint`) : readable(item.hint),
    value: translateReadinessValue(item.value, itemKey, t),
  };
}

export function OverviewPage() {
  const { t } = useTranslation();
  const { activeTenant } = useTenant();
  const activeTenantId = activeTenant?.id;
  const [overview, setOverview] = useState<TenantOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setOverview(null);
    if (!activeTenantId) return;
    let cancelled = false;
    setLoading(true);
    getTenantDashboard(activeTenantId)
      .then((nextOverview) => {
        if (!cancelled) setOverview(nextOverview);
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

  const overviewPermissions = overview?.permissions ?? overview?.workspace?.permissions;
  const canManageMembers = Boolean(overviewPermissions?.canManageMembers);
  const canManageCertificates = Boolean(overviewPermissions?.canManageCertificates);
  const canCreateCourses = Boolean(overviewPermissions?.canCreateCourses);
  const canViewActivity = Boolean(overviewPermissions?.canViewActivity);
  const isAssistant = overview?.role === 'assistant';
  const homeworkEnabled = isTenantFeatureEnabled(activeTenant, 'homework.enabled');
  const certificatesEnabled = isTenantFeatureEnabled(activeTenant, 'certificates.enabled');
  const attendanceEnabled = isTenantFeatureEnabled(activeTenant, 'attendance.enabled');

  const stats = useMemo(() => {
    if (!overview) return [];
    if (!canManageMembers) {
      return [
        { label: isAssistant ? t('navigation.courses') : t('student.myCourses'), value: statValue(overview.stats.courses), hint: t('overview.coursesScopeHint') },
        { label: t('student.upcomingSessions'), value: statValue(overview.stats.upcomingSessions), hint: t('overview.scheduledClasses') },
        ...(homeworkEnabled ? [{ label: t('overview.needsReview'), value: statValue(overview.stats.homeworkNeedsReview), hint: t('overview.homeworkQueueHint') }] : []),
        ...(certificatesEnabled ? [{ label: t('navigation.certificates'), value: statValue(overview.stats.certificatesPending), hint: t('overview.certificatesHint') }] : []),
      ];
    }
    return [
      { label: t('navigation.courses'), value: statValue(overview.stats.courses), hint: t('overview.tenantCatalog') },
      { label: t('overview.liveOffline'), value: statValue(overview.stats.deliveryCourses), hint: t('overview.deliveryCourses') },
      { label: t('overview.students'), value: statValue(overview.stats.students), hint: t('overview.studentsHint') },
      { label: t('overview.today'), value: statValue(overview.stats.todaySessions), hint: t('overview.scheduledSessions') },
      ...(homeworkEnabled ? [{ label: t('overview.needsReview'), value: statValue(overview.stats.homeworkNeedsReview), hint: t('navigation.homework') }] : []),
    ];
  }, [canManageMembers, certificatesEnabled, homeworkEnabled, isAssistant, overview, t]);

  const actionCards = useMemo(() => {
    if (!overview) return [];
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
        metric: t('overview.unmarkedMetric', { count: overview.stats.unmarkedAttendance ?? 0 }),
        disabled: !attendanceEnabled,
        disabledReason: t('overview.attendanceDisabled'),
      },
      {
        to: '/homework',
        icon: FiBookOpen,
        title: t('overview.homeworkReview'),
        detail: t('overview.homeworkReviewDetail'),
        metric: t('overview.submissionsNeedReview', { count: overview.stats.homeworkNeedsReview ?? 0 }),
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
  }, [attendanceEnabled, canCreateCourses, canManageCertificates, certificatesEnabled, homeworkEnabled, overview, t]);

  const priorityItems = useMemo(() => {
    if (!overview) return [];
    const draftCourses = statNumber(overview.stats.draftCourses);
    const pendingCourses = statNumber(overview.stats.pendingCourses);
    const unmarkedAttendance = statNumber(overview.stats.unmarkedAttendance);
    const homeworkNeedsReview = statNumber(overview.stats.homeworkNeedsReview);
    return [
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
      ...(attendanceEnabled && unmarkedAttendance > 0 ? [{
        to: '/attendance',
        icon: FiCheckSquare,
        title: t('overview.unmarked'),
        detail: t('overview.unmarkedMetric', { count: unmarkedAttendance }),
        tone: 'warning' as const,
      }] : []),
      ...(homeworkEnabled && homeworkNeedsReview > 0 ? [{
        to: '/homework',
        icon: FiBookOpen,
        title: t('overview.homeworkReview'),
        detail: t('overview.submissionsNeedReview', { count: homeworkNeedsReview }),
        tone: 'info' as const,
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
    ];
  }, [attendanceEnabled, canCreateCourses, canManageCertificates, certificatesEnabled, homeworkEnabled, overview, t]);

  const operationStats = useMemo(() => {
    if (!overview) return [];
    return [
      ...(attendanceEnabled ? [
        { label: t('overview.attendanceRate'), value: overview.stats.attendanceRate === null ? '-' : `${overview.stats.attendanceRate}%` },
        { label: t('overview.unmarked'), value: overview.sessions.unmarkedAttendance },
        { label: t('overview.cancelled'), value: overview.sessions.cancelled },
      ] : [
        { label: t('navigation.attendance'), value: t('overview.disabled') },
      ]),
      ...(canCreateCourses ? [{ label: t('overview.pendingCourses'), value: overview.stats.pendingCourses ?? 0 }] : []),
    ];
  }, [attendanceEnabled, canCreateCourses, overview, t]);

  const todayOperations = useMemo(() => {
    if (!overview) return [];
    const nextLiveSession = overview.sessions.upcoming.find((session) => session.liveJoinUrl || session.liveHostUrl);
    return [
      {
        to: '/sessions',
        label: t('overview.todaySessions'),
        value: overview.sessions.today,
        detail: overview.sessions.upcoming[0]
          ? `${overview.sessions.upcoming[0].title} · ${formatDate(overview.sessions.upcoming[0].startsAt)}`
          : t('overview.noSessionsToday'),
        icon: FiCalendar,
        enabled: true,
      },
      {
        to: '/attendance',
        label: t('overview.unmarkedAttendance'),
        value: attendanceEnabled ? overview.sessions.unmarkedAttendance : t('overview.disabled'),
        detail: attendanceEnabled ? t('overview.markClasses') : t('overview.attendanceDisabled'),
        icon: FiCheckSquare,
        enabled: attendanceEnabled,
      },
      {
        to: '/homework',
        label: t('overview.pendingHomeworkReviews'),
        value: homeworkEnabled ? overview.stats.homeworkNeedsReview ?? 0 : t('overview.disabled'),
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
  }, [attendanceEnabled, homeworkEnabled, overview, t]);

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

  if (!activeTenant) return <EmptyState title={t('overview.noTenantAssignedTitle')} detail={t('overview.noTenantAssignedDetail')} />;
  if (loading) return <LoadingState label={t('overview.loading')} />;
  if (!overview) return <EmptyState title={t('overview.overviewUnavailableTitle')} detail={t('overview.overviewUnavailableDetail')} />;

  const heading = canManageMembers ? t('overview.tenantOverview') : isAssistant ? t('overview.assistantOverview') : t('overview.instructorOverview');
  const primaryPriorityItem = priorityItems[0];
  const primaryAvailableAction = actionCards.find((action) => !action.disabled);
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

  return (
    <>
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
      <StatGrid items={stats} />

      {primaryOverviewAction && PrimaryOverviewIcon ? (
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

      <section className={`overview-priority-strip ${priorityItems.length ? '' : 'all-clear'}`} aria-label={t('overview.needsAttention')}>
        {priorityItems.length ? (
          <>
          <div className="overview-priority-heading">
            <span className="ui-kicker">{t('overview.needsAttention')}</span>
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
              <span className="ui-kicker">{t('overview.needsAttention')}</span>
              <strong>{t('overview.noActiveBlockers')}</strong>
            </div>
            <div className="overview-priority-list">
              <article className="overview-priority-card info static">
                <FiCheckSquare />
                <span>
                  <strong>{t('overview.workspaceClear')}</strong>
                  <small>{t('overview.allClearDetail')}</small>
                </span>
              </article>
            </div>
          </>
        )}
      </section>

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

      <div className="workspace-grid overview-grid">
        <section className="content-section">
          <div className="section-heading-row">
            <div>
              <h2>{canManageMembers ? t('overview.recentCourses') : t('overview.coursesInScope')}</h2>
              <span>{t('overview.tenantCourseWorkspace')}</span>
            </div>
            <Link className="link-button" to="/courses">{t('overview.viewAll')}</Link>
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
                      <Link className="table-primary-link" to={`/courses?courseId=${course.id}`}>{course.title}</Link>
                      {course.instructor?.fullName ? <small>{course.instructor.fullName}</small> : null}
                    </td>
                    <td><span className="status-badge">{overviewCourseTypeLabel(course.courseType)}</span></td>
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

        <aside className="settings-panel workflow-context-panel overview-upcoming-panel">
          <div className="section-heading-row compact">
            <div>
              <h2>{t('student.upcomingSessions')}</h2>
              <span>{t('overview.scheduledToday', { count: overview.sessions.today })}</span>
            </div>
          </div>
          <div className="stack-list">
            {overview.sessions.upcoming.map((session) => (
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
                <Link className="link-button" to="/sessions">{t('student.open')}</Link>
              </article>
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
      </div>

      <div className="settings-grid overview-lower-grid">
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

        {homeworkEnabled ? (
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

        {certificatesEnabled && canManageCertificates ? (
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

        <section className="settings-panel">
          <div className="section-heading-row">
            <div>
              <h2>{t('overview.workspaceReadiness')}</h2>
              <span>{t('overview.configured', { percent: overview.setup.progress })}</span>
            </div>
          </div>
          <div className="progress-cell overview-progress">
            <span style={{ width: `${overview.setup.progress}%` }} />
            <strong>{overview.setup.progress}%</strong>
          </div>
          <div className="stack-list">
            {overview.setup.items.map((item) => {
              const itemCopy = getReadinessItemCopy(item, t);
              return (
                <article className="stack-list-item" key={item.label}>
                  <div>
                    <strong>{itemCopy.label}</strong>
                    <span>{itemCopy.hint}</span>
                  </div>
                  <strong>{itemCopy.value}</strong>
                </article>
              );
            })}
          </div>
        </section>

        {canManageMembers ? (
          <section className="settings-panel">
            <div className="section-heading-row">
              <div>
                <h2>{t('overview.tools')}</h2>
                <span>{t('overview.toolsHint')}</span>
              </div>
              <FiActivity />
            </div>
            <div className="flag-grid">
              {overview.features.map((feature) => (
                <div className="flag-row" key={feature.key}>
                  <span>{feature.key}</span>
                  <strong className={`status-badge ${feature.enabled ? 'published' : 'destructive'}`}>{feature.enabled ? t('overview.enabled') : t('overview.disabled')}</strong>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      {canViewActivity ? (
        <section className="settings-panel full overview-activity-panel">
          <h2>{t('overview.recentActivity')}</h2>
          <div className="stack-list activity-timeline">
            {overview.activity.map((item) => (
              <article className="stack-list-item" key={item.id}>
                <div>
                  <strong>{activityActionLabel(item.action)}</strong>
                  <span>{item.actorFullName || item.actorEmail || t('overview.system')} · {formatDate(item.createdAt)}</span>
                </div>
                <strong>{activityActionLabel(item.targetType || item.targetId || t('overview.tenantTarget'))}</strong>
              </article>
            ))}
            {!overview.activity.length ? <EmptyState title={t('overview.activityEmptyTitle')} detail={t('overview.activityEmptyDetail')} /> : null}
          </div>
        </section>
      ) : null}
    </>
  );
}
