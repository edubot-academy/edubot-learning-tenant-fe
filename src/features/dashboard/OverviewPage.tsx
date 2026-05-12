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
      { label: 'Needs review', value: statValue(overview.stats.homeworkNeedsReview), hint: 'Homework submissions' },
    ];
  }, [canManageMembers, certificatesEnabled, homeworkEnabled, isAssistant, overview]);

  const actionCards = useMemo(() => {
    if (!overview) return [];
    const cards = [
      ...(canCreateCourses ? [{
        to: '/courses',
        icon: FiPlusCircle,
        title: 'Create or manage courses',
        detail: 'Draft tenant courses, submit approvals, and manage course setup.',
        metric: `${overview.stats.draftCourses ?? 0} draft`,
      }] : []),
      {
        to: '/groups',
        icon: FiCalendar,
        title: 'Groups and sessions',
        detail: 'Plan cohorts, enroll learners, generate schedules, and open sessions.',
        metric: `${overview.stats.activeGroups ?? 0} active groups`,
      },
      {
        to: '/attendance',
        icon: FiCheckSquare,
        title: 'Attendance',
        detail: 'Mark attendance for live and offline classes.',
        metric: `${overview.stats.unmarkedAttendance ?? 0} unmarked`,
        disabled: !attendanceEnabled,
      },
      {
        to: '/homework',
        icon: FiBookOpen,
        title: 'Homework review',
        detail: 'Review submitted work, missing assignments, and revisions.',
        metric: `${overview.stats.homeworkNeedsReview ?? 0} need review`,
        disabled: !homeworkEnabled,
      },
      ...(canManageCertificates ? [{
        to: '/certificates',
        icon: FiAward,
        title: 'Certificates',
        detail: 'Issue eligible certificates and handle approvals.',
        metric: `${overview.certificates.pending} pending`,
        disabled: !certificatesEnabled,
      }] : []),
    ];
    return cards;
  }, [attendanceEnabled, canCreateCourses, canManageCertificates, certificatesEnabled, homeworkEnabled, overview]);

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

      <section className="overview-action-grid" aria-label="Primary tenant actions">
        {actionCards.map((action) => {
          const Icon = action.icon;
          const content = (
            <>
              <div className="action-card-icon"><Icon /></div>
              <div>
                <strong>{action.title}</strong>
                <span>{action.detail}</span>
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
          <div className="table-wrap">
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
                      <strong>{course.title}</strong>
                      {course.instructor?.fullName ? <small>{course.instructor.fullName}</small> : null}
                    </td>
                    <td>{course.courseType || 'video'}</td>
                    <td><span className={`status-badge ${course.status || 'draft'}`}>{course.status || 'draft'}</span></td>
                    <td>{course.enrolledStudents ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!overview.courses.length ? <EmptyState title="No tenant courses yet" detail={canCreateCourses ? 'Create a tenant course to start planning groups.' : 'Ask a tenant admin to assign courses or groups to your account.'} /> : null}
        </section>

        <aside className="settings-panel">
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
                  <span>{formatDate(session.startsAt)} · {readable(session.status || 'scheduled')}</span>
                  {session.groupName || session.courseTitle ? <span>{session.courseTitle ?? 'Course'} · {session.groupName ?? 'Group'}</span> : null}
                </div>
                <Link className="link-button" to="/sessions">Open</Link>
              </article>
            ))}
            {!overview.sessions.upcoming.length ? <span className="muted-text">No upcoming sessions scheduled.</span> : null}
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
            <section className="stat-tile">
              <span>Attendance rate</span>
              <strong>{overview.stats.attendanceRate === null ? '-' : `${overview.stats.attendanceRate}%`}</strong>
            </section>
            <section className="stat-tile">
              <span>Unmarked</span>
              <strong>{overview.sessions.unmarkedAttendance}</strong>
            </section>
            <section className="stat-tile">
              <span>Cancelled</span>
              <strong>{overview.sessions.cancelled}</strong>
            </section>
            <section className="stat-tile">
              <span>Pending courses</span>
              <strong>{overview.stats.pendingCourses ?? 0}</strong>
            </section>
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
                      {' '}{item.courseTitle ?? 'Course'} · {item.groupName ?? 'Group'} · {formatDate(item.deadline ?? item.dueAt)}
                    </span>
                  </div>
                  <strong>{item.queue?.needsReview ?? 0} review</strong>
                </article>
              ))}
              {!overview.homework.queue.length ? <span className="muted-text">No homework in the current queue.</span> : null}
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
                <strong className={feature.enabled ? '' : 'danger-text'}>{feature.enabled ? 'Enabled' : 'Disabled'}</strong>
              </div>
            ))}
          </div>
        </section>

        {overview.stats.unmarkedAttendance || overview.certificates.coursesWithoutConfig ? (
          <section className="settings-panel">
            <div className="section-heading-row">
              <div>
                <h2>Needs attention</h2>
                <span>Items that can block smooth operations</span>
              </div>
              <FiAlertTriangle />
            </div>
            <div className="stack-list">
              {overview.stats.unmarkedAttendance ? (
                <article className="stack-list-item">
                  <div>
                    <strong>Attendance not marked</strong>
                    <span>{overview.stats.unmarkedAttendance} past sessions need attendance records.</span>
                  </div>
                  <Link className="link-button" to="/attendance">Fix</Link>
                </article>
              ) : null}
              {overview.certificates.coursesWithoutConfig ? (
                <article className="stack-list-item">
                  <div>
                    <strong>Certificate setup incomplete</strong>
                    <span>{overview.certificates.coursesWithoutConfig} courses do not have enabled certificate settings.</span>
                  </div>
                  <Link className="link-button" to="/certificates">Review</Link>
                </article>
              ) : null}
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
            {!overview.activity.length ? <span className="muted-text">No tenant activity recorded yet.</span> : null}
          </div>
        </section>
      ) : null}
    </>
  );
}
