import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
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
import { getTenantOverview } from '../../services/api';
import type { TenantOverview } from '../../types/domain';
import { useTenant } from '../tenant/TenantProvider';
import { formatDate, readable } from '../../lib/format';
import { isTenantFeatureEnabled } from '../tenant/tenantFeatures';

function statValue(value: unknown) {
  if (typeof value === 'number' || typeof value === 'string') return value;
  return 0;
}

function statNumber(value: unknown) {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : 0;
}

function displayText(value?: string | number | null, fallback = 'Not set') {
  return value === null || value === undefined || value === '' ? fallback : readable(value);
}

export function OverviewPage() {
  const { activeTenant } = useTenant();
  const activeTenantId = activeTenant?.id;
  const [overview, setOverview] = useState<TenantOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setOverview(null);
    if (!activeTenantId) return;
    let cancelled = false;
    setLoading(true);
    getTenantOverview(activeTenantId)
      .then((nextOverview) => {
        if (!cancelled) setOverview(nextOverview);
      })
      .catch(() => {
        if (!cancelled) toast.error('Could not load tenant overview');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTenantId]);

  const canManageMembers = Boolean(overview?.permissions.canManageMembers);
  const canManageCertificates = Boolean(overview?.permissions.canManageCertificates);
  const canCreateCourses = Boolean(overview?.permissions.canCreateCourses);
  const isAssistant = overview?.role === 'assistant';
  const homeworkEnabled = isTenantFeatureEnabled(activeTenant, 'homework.enabled');
  const certificatesEnabled = isTenantFeatureEnabled(activeTenant, 'certificates.enabled');
  const attendanceEnabled = isTenantFeatureEnabled(activeTenant, 'attendance.enabled');

  const stats = useMemo(() => {
    if (!overview) return [];
    if (!canManageMembers) {
      return [
        { label: isAssistant ? 'Courses' : 'My courses', value: statValue(overview.stats.courses), hint: 'Tenant courses in scope' },
        { label: 'Upcoming sessions', value: statValue(overview.stats.upcomingSessions), hint: 'Scheduled classes' },
        ...(homeworkEnabled ? [{ label: 'Needs review', value: statValue(overview.stats.homeworkNeedsReview), hint: 'Homework queue' }] : []),
        ...(certificatesEnabled ? [{ label: 'Certificates', value: statValue(overview.stats.certificatesPending), hint: 'Pending approvals' }] : []),
      ];
    }
    return [
      { label: 'Courses', value: statValue(overview.stats.courses), hint: 'Tenant-private catalog' },
      { label: 'Live/offline', value: statValue(overview.stats.deliveryCourses), hint: 'Delivery courses' },
      { label: 'Students', value: statValue(overview.stats.students), hint: 'Active learners' },
      { label: 'Today', value: statValue(overview.stats.todaySessions), hint: 'Scheduled sessions' },
      ...(homeworkEnabled ? [{ label: 'Needs review', value: statValue(overview.stats.homeworkNeedsReview), hint: 'Homework submissions' }] : []),
    ];
  }, [canManageMembers, certificatesEnabled, homeworkEnabled, isAssistant, overview]);

  const actionCards = useMemo(() => {
    if (!overview) return [];
    return [
      ...(canCreateCourses ? [{
        to: '/courses',
        icon: FiPlusCircle,
        title: 'Create or manage courses',
        detail: 'Draft, submit, and manage tenant courses.',
        metric: `${overview.stats.draftCourses ?? 0} draft`,
      }] : []),
      {
        to: '/groups',
        icon: FiCalendar,
        title: 'Groups and sessions',
        detail: 'Plan cohorts, schedules, and sessions.',
        metric: `${overview.stats.activeGroups ?? 0} active groups`,
      },
      {
        to: '/attendance',
        icon: FiCheckSquare,
        title: 'Attendance',
        detail: 'Mark live and offline classes.',
        metric: `${overview.stats.unmarkedAttendance ?? 0} unmarked`,
        disabled: !attendanceEnabled,
        disabledReason: 'Attendance is disabled for this tenant.',
      },
      {
        to: '/homework',
        icon: FiBookOpen,
        title: 'Homework review',
        detail: 'Review submissions and revisions.',
        metric: `${overview.stats.homeworkNeedsReview ?? 0} need review`,
        disabled: !homeworkEnabled,
        disabledReason: 'Homework is disabled for this tenant.',
      },
      ...(canManageCertificates ? [{
        to: '/certificates',
        icon: FiAward,
        title: 'Certificates',
        detail: 'Issue certificates and approvals.',
        metric: `${overview.certificates.pending} pending`,
        disabled: !certificatesEnabled,
        disabledReason: 'Certificates are disabled for this tenant.',
      }] : []),
    ];
  }, [attendanceEnabled, canCreateCourses, canManageCertificates, certificatesEnabled, homeworkEnabled, overview]);

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
        title: 'Draft courses',
        detail: `${draftCourses} course${draftCourses === 1 ? '' : 's'} waiting to be finished.`,
        tone: 'warning' as const,
      }] : []),
      ...(canCreateCourses && pendingCourses > 0 ? [{
        to: '/courses',
        icon: FiAlertTriangle,
        title: 'Pending approvals',
        detail: `${pendingCourses} course${pendingCourses === 1 ? '' : 's'} waiting for approval.`,
        tone: 'warning' as const,
      }] : []),
      ...(attendanceEnabled && unmarkedAttendance > 0 ? [{
        to: '/attendance',
        icon: FiCheckSquare,
        title: 'Attendance not marked',
        detail: `${unmarkedAttendance} session${unmarkedAttendance === 1 ? '' : 's'} need attendance records.`,
        tone: 'warning' as const,
      }] : []),
      ...(homeworkEnabled && homeworkNeedsReview > 0 ? [{
        to: '/homework',
        icon: FiBookOpen,
        title: 'Homework review',
        detail: `${homeworkNeedsReview} submission${homeworkNeedsReview === 1 ? '' : 's'} need review.`,
        tone: 'info' as const,
      }] : []),
      ...(certificatesEnabled && canManageCertificates && overview.certificates.pending > 0 ? [{
        to: '/certificates',
        icon: FiAward,
        title: 'Certificate approvals',
        detail: `${overview.certificates.pending} certificate${overview.certificates.pending === 1 ? '' : 's'} pending approval.`,
        tone: 'info' as const,
      }] : []),
      ...(certificatesEnabled && canManageCertificates && overview.certificates.coursesWithoutConfig > 0 ? [{
        to: '/certificates',
        icon: FiAlertTriangle,
        title: 'Certificate setup',
        detail: `${overview.certificates.coursesWithoutConfig} course${overview.certificates.coursesWithoutConfig === 1 ? '' : 's'} need certificate configuration.`,
        tone: 'warning' as const,
      }] : []),
    ];
  }, [attendanceEnabled, canCreateCourses, canManageCertificates, certificatesEnabled, homeworkEnabled, overview]);

  const operationStats = useMemo(() => {
    if (!overview) return [];
    return [
      ...(attendanceEnabled ? [
        { label: 'Attendance rate', value: overview.stats.attendanceRate === null ? '-' : `${overview.stats.attendanceRate}%` },
        { label: 'Unmarked', value: overview.sessions.unmarkedAttendance },
        { label: 'Cancelled', value: overview.sessions.cancelled },
      ] : [
        { label: 'Attendance', value: 'Disabled' },
      ]),
      ...(canCreateCourses ? [{ label: 'Pending courses', value: overview.stats.pendingCourses ?? 0 }] : []),
    ];
  }, [attendanceEnabled, canCreateCourses, overview]);

  if (!activeTenant) return <EmptyState title="No tenant assigned" detail="Ask a platform admin to add your user to a tenant." />;
  if (loading) return <LoadingState label="Loading tenant overview" />;
  if (!overview) return <EmptyState title="Overview unavailable" detail="Refresh the workspace and try again." />;

  const heading = canManageMembers ? 'Tenant overview' : isAssistant ? 'Assistant overview' : 'Instructor overview';

  return (
    <>
      <PageHeader
        title={activeTenant.name}
        eyebrow={heading}
        actions={(
          <>
            {canManageMembers ? <Link className="secondary-link-button" to="/members"><FiUsers /> Members</Link> : null}
            <Link className="secondary-link-button" to="/settings"><FiSettings /> Settings</Link>
          </>
        )}
      />
      <StatGrid items={stats} />

      <section className={`overview-priority-strip ${priorityItems.length ? '' : 'all-clear'}`} aria-label="Needs attention">
        {priorityItems.length ? (
          <>
          <div className="overview-priority-heading">
            <span className="ui-kicker">Needs attention</span>
            <strong>{priorityItems.length} active item{priorityItems.length === 1 ? '' : 's'}</strong>
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
              <span className="ui-kicker">Needs attention</span>
              <strong>No active blockers</strong>
            </div>
            <div className="overview-priority-list">
              <article className="overview-priority-card info static">
                <FiCheckSquare />
                <span>
                  <strong>Workspace is clear</strong>
                  <small>Drafts, attendance, homework, and certificate queues will appear here when they need attention.</small>
                </span>
              </article>
            </div>
          </>
        )}
      </section>

      <section className="overview-action-grid" aria-label="Primary tenant actions">
        {actionCards.map((action) => {
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
              <h2>{canManageMembers ? 'Recent courses' : 'Courses in scope'}</h2>
              <span>Tenant-private course workspace</span>
            </div>
            <Link className="link-button" to="/courses">View all</Link>
          </div>
          <div className="table-wrap overview-course-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Students</th>
                </tr>
              </thead>
              <tbody>
                {overview.courses.map((course) => (
                  <tr key={course.id}>
                    <td>
                      <Link className="table-primary-link" to={`/courses?courseId=${course.id}`}>{course.title}</Link>
                      {course.instructor?.fullName ? <small>{course.instructor.fullName}</small> : null}
                    </td>
                    <td><span className="status-badge">{displayText(course.courseType, 'Video')}</span></td>
                    <td><span className={`status-badge ${course.status || 'draft'}`}>{displayText(course.status, 'Draft')}</span></td>
                    <td>{course.enrolledStudents ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!overview.courses.length ? (
            <EmptyState
              title="No tenant courses yet"
              detail={canCreateCourses ? 'Open courses to create the first tenant course.' : 'Ask a tenant admin to assign courses or groups to your account.'}
              action={canCreateCourses ? <Link className="secondary-link-button" to="/courses">Open courses</Link> : undefined}
            />
          ) : null}
        </section>

        <aside className="settings-panel workflow-context-panel overview-upcoming-panel">
          <div className="section-heading-row compact">
            <div>
              <h2>Upcoming sessions</h2>
              <span>{overview.sessions.today} scheduled today</span>
            </div>
          </div>
          <div className="stack-list">
            {overview.sessions.upcoming.map((session) => (
              <article className="stack-list-item" key={session.id}>
                <div>
                  <strong>{session.title}</strong>
                  <span className="overview-session-meta">
                    <span>{formatDate(session.startsAt)}</span>
                    <span className={`status-badge ${session.status || 'scheduled'}`}>{displayText(session.status, 'Scheduled')}</span>
                  </span>
                  {session.groupName || session.courseTitle ? (
                    <span className="overview-session-context">{session.courseTitle ?? 'Course not set'} · {session.groupName ?? 'Group not set'}</span>
                  ) : null}
                </div>
                <Link className="link-button" to="/sessions">Open</Link>
              </article>
            ))}
            {!overview.sessions.upcoming.length ? (
              <EmptyState
                title="No upcoming sessions"
                detail="Scheduled group sessions will appear here."
                action={<Link className="secondary-link-button" to="/sessions">Open sessions</Link>}
              />
            ) : null}
          </div>
        </aside>
      </div>

      <div className="settings-grid overview-lower-grid">
        <section className="settings-panel">
          <div className="section-heading-row">
            <div>
              <h2>Operations</h2>
              <span>Live/offline course signals</span>
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
                <h2>Homework queue</h2>
                <span>Assignments that need attention</span>
              </div>
              <Link className="link-button" to="/homework">Open queue</Link>
            </div>
            <div className="stat-grid compact session-stat-grid">
              {['total', 'needsReview', 'missing', 'overdue'].map((key) => (
                <section className="stat-tile" key={key}>
                  <span>{readable(key)}</span>
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
                      <span className={`status-badge ${item.isPublished ? 'published' : 'draft'}`}>{item.isPublished ? 'Published' : 'Draft'}</span>
                      {' '}{item.courseTitle ?? 'Course not set'} · {item.groupName ?? 'Group not set'} · {formatDate(item.deadline ?? item.dueAt)}
                    </span>
                  </div>
                  <span className={`status-badge ${(item.queue?.needsReview ?? 0) > 0 ? 'pending_approval' : 'approved'}`}>{item.queue?.needsReview ?? 0} review</span>
                </article>
              ))}
              {!overview.homework.queue.length ? <EmptyState title="No homework in the current queue" detail="Assignments that need review will appear here." /> : null}
            </div>
          </section>
        ) : null}

        {certificatesEnabled && canManageCertificates ? (
          <section className="settings-panel">
            <div className="section-heading-row">
              <div>
                <h2>Certificates</h2>
                <span>Manual issue and approval workload</span>
              </div>
              <Link className="link-button" to="/certificates">Open</Link>
            </div>
            <div className="stat-grid compact session-stat-grid">
              <section className="stat-tile"><span>Pending</span><strong>{overview.certificates.pending}</strong></section>
              <section className="stat-tile"><span>Not issued</span><strong>{overview.certificates.waiting ?? overview.certificates.eligibleWaiting}</strong></section>
              <section className="stat-tile"><span>Issued</span><strong>{overview.certificates.issued}</strong></section>
              <section className="stat-tile"><span>Needs config</span><strong>{overview.certificates.coursesWithoutConfig}</strong></section>
            </div>
          </section>
        ) : null}

        <section className="settings-panel">
          <div className="section-heading-row">
            <div>
              <h2>Workspace readiness</h2>
              <span>{overview.setup.progress}% configured</span>
            </div>
          </div>
          <div className="progress-cell overview-progress">
            <span style={{ width: `${overview.setup.progress}%` }} />
            <strong>{overview.setup.progress}%</strong>
          </div>
          <div className="stack-list">
            {overview.setup.items.map((item) => (
              <article className="stack-list-item" key={item.label}>
                <div>
                  <strong>{item.label}</strong>
                  <span>{item.hint}</span>
                </div>
                <strong>{readable(item.value)}</strong>
              </article>
            ))}
          </div>
        </section>

        {canManageMembers ? (
          <section className="settings-panel">
            <div className="section-heading-row">
              <div>
                <h2>Workspace tools</h2>
                <span>Default and platform-managed features</span>
              </div>
              <FiActivity />
            </div>
            <div className="flag-grid">
              {overview.features.map((feature) => (
                <div className="flag-row" key={feature.key}>
                  <span>{feature.key}</span>
                  <strong className={`status-badge ${feature.enabled ? 'published' : 'destructive'}`}>{feature.enabled ? 'Enabled' : 'Disabled'}</strong>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      {overview.permissions.canViewActivity ? (
        <section className="settings-panel full overview-activity-panel">
          <h2>Recent activity</h2>
          <div className="stack-list activity-timeline">
            {overview.activity.map((item) => (
              <article className="stack-list-item" key={item.id}>
                <div>
                  <strong>{readable(item.action)}</strong>
                  <span>{item.actorFullName || item.actorEmail || 'System'} · {formatDate(item.createdAt)}</span>
                </div>
                <strong>{readable(item.targetType || item.targetId || 'tenant')}</strong>
              </article>
            ))}
            {!overview.activity.length ? <EmptyState title="No tenant activity recorded yet" detail="Backend activity events will appear here when tenant changes are recorded." /> : null}
          </div>
        </section>
      ) : null}
    </>
  );
}
