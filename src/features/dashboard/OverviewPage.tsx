import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiAward, FiBookOpen, FiCalendar, FiCheckSquare, FiSettings, FiUsers } from 'react-icons/fi';
import { PageHeader } from '../../components/PageHeader';
import { StatGrid } from '../../components/StatGrid';
import { EmptyState, LoadingState } from '../../components/DataState';
import { getCertificateBranding, getHomeworkSummary, listGroupSessions, listHomework, listTenantActivity, listTenantCourses, listTenantMembers } from '../../services/api';
import type { CertificateBranding, CompanyMember, Course, CourseSession, SessionHomework, TenantActivityLog } from '../../types/domain';
import { useTenant } from '../tenant/TenantProvider';
import { formatDate, readable } from '../../lib/format';
import { isTenantFeatureEnabled } from '../tenant/tenantFeatures';
import { useAuth } from '../auth/AuthProvider';
import { canManageTenantCertificates, canManageTenantMembers } from '../tenant/tenantRoles';

export function OverviewPage() {
  const { user } = useAuth();
  const { activeTenant } = useTenant();
  const activeTenantId = activeTenant?.id;
  const canManageMembers = canManageTenantMembers(user, activeTenant);
  const canViewTenantActivity = canManageMembers;
  const canManageCertificates = canManageTenantCertificates(user, activeTenant);
  const homeworkEnabled = isTenantFeatureEnabled(activeTenant, 'homework.enabled');
  const certificatesEnabled = isTenantFeatureEnabled(activeTenant, 'certificates.enabled');
  const [courses, setCourses] = useState<Course[]>([]);
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [sessions, setSessions] = useState<CourseSession[]>([]);
  const [homeworkSummary, setHomeworkSummary] = useState<Record<string, number>>({});
  const [homework, setHomework] = useState<SessionHomework[]>([]);
  const [certificateBranding, setCertificateBranding] = useState<CertificateBranding | null>(null);
  const [activity, setActivity] = useState<TenantActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setCourses([]);
    setMembers([]);
    setSessions([]);
    setHomeworkSummary({});
    setHomework([]);
    setCertificateBranding(null);
    setActivity([]);
    if (!activeTenantId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      listTenantCourses(activeTenantId),
      canManageMembers ? listTenantMembers(activeTenantId) : Promise.resolve([]),
      !canManageMembers ? listGroupSessions() : Promise.resolve([]),
      homeworkEnabled ? getHomeworkSummary() : Promise.resolve({}),
      homeworkEnabled ? listHomework() : Promise.resolve([]),
      certificatesEnabled ? getCertificateBranding(activeTenantId) : Promise.resolve(null),
      canViewTenantActivity ? listTenantActivity(activeTenantId, { limit: 8 }) : Promise.resolve([]),
    ])
      .then(([courseRows, memberRows, sessionRows, nextHomeworkSummary, homeworkRows, nextCertificateBranding, activityRows]) => {
        if (cancelled) return;
        setCourses(courseRows);
        setMembers(memberRows);
        setSessions(sessionRows);
        setHomeworkSummary(nextHomeworkSummary);
        setHomework(homeworkRows);
        setCertificateBranding(nextCertificateBranding);
        setActivity(activityRows);
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
  }, [activeTenantId, canManageMembers, canViewTenantActivity, certificatesEnabled, homeworkEnabled]);

  const stats = useMemo(() => [
    { label: 'Courses', value: courses.length, hint: 'Tenant-linked catalog' },
    { label: 'Live/offline', value: courses.filter((course) => course.courseType !== 'video').length, hint: 'Delivery courses' },
    ...(canManageMembers ? [{ label: 'Members', value: members.length, hint: 'Owners, admins, instructors, assistants' }] : []),
    ...(homeworkEnabled ? [{ label: 'Needs review', value: homeworkSummary.needsReview ?? 0, hint: 'Homework queue' }] : []),
  ], [canManageMembers, courses, homeworkEnabled, homeworkSummary.needsReview, members.length]);

  const enabledFeatures = useMemo(() => (
    Object.entries(activeTenant?.featureFlags ?? {})
      .filter(([, enabled]) => enabled !== false)
      .map(([key]) => key)
  ), [activeTenant?.featureFlags]);

  const quickActions = useMemo(() => [
    {
      to: '/sessions',
      icon: FiCalendar,
      title: 'Plan sessions',
      detail: 'Create groups, schedule classes, attach meetings and materials.',
      metric: `${courses.filter((course) => course.courseType !== 'video').length} delivery courses`,
    },
    {
      to: '/attendance',
      icon: FiCheckSquare,
      title: 'Mark attendance',
      detail: 'Open a scheduled session and update attendance in bulk.',
      metric: isTenantFeatureEnabled(activeTenant, 'attendance.enabled') ? 'Enabled' : 'Disabled',
      disabled: !isTenantFeatureEnabled(activeTenant, 'attendance.enabled'),
    },
    {
      to: '/homework',
      icon: FiBookOpen,
      title: 'Review homework',
      detail: 'Work through submitted assignments and missing work.',
      metric: `${homeworkSummary.needsReview ?? 0} need review`,
      disabled: !homeworkEnabled,
    },
    ...(canManageCertificates ? [{
      to: '/certificates',
      icon: FiAward,
      title: 'Manage certificates',
      detail: 'Tune rules, issue certificates, and approve pending awards.',
      metric: certificateBranding?.primaryBrandName ? 'Brand ready' : 'Needs brand',
      disabled: !certificatesEnabled,
    }] : []),
  ], [activeTenant, canManageCertificates, certificateBranding?.primaryBrandName, certificatesEnabled, courses, homeworkEnabled, homeworkSummary.needsReview]);

  const setupProgress = useMemo(() => {
    const checks = [
      courses.length > 0,
      !canManageMembers || members.length > 0,
      Boolean(activeTenant?.timezone || activeTenant?.locale),
      !certificatesEnabled || Boolean(certificateBranding?.primaryBrandName || certificateBranding?.primaryBrandLogoUrl),
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [activeTenant?.locale, activeTenant?.timezone, canManageMembers, certificateBranding, certificatesEnabled, courses.length, members.length]);

  const setupItems = useMemo(() => [
    { label: 'Courses', value: courses.length ? `${courses.length} linked` : 'None yet', hint: 'Platform assigns courses to this tenant' },
    ...(canManageMembers ? [{ label: 'Members', value: members.length ? `${members.length} assigned` : 'No members', hint: 'People who can operate this workspace' }] : []),
    ...(certificatesEnabled ? [{ label: 'Certificate brand', value: certificateBranding?.primaryBrandName || activeTenant?.name || 'Not set', hint: certificateBranding?.primaryBrandLogoUrl ? 'Logo configured' : 'Using tenant/default logo' }] : []),
    { label: 'Locale', value: activeTenant?.locale || 'Default', hint: activeTenant?.timezone || 'Timezone not set' },
  ], [activeTenant, canManageMembers, certificateBranding, certificatesEnabled, courses.length, members.length]);

  const upcomingSessions = useMemo(() => {
    const now = Date.now();
    return sessions
      .filter((session) => {
        const startsAt = session.startsAt ? new Date(session.startsAt).getTime() : 0;
        return startsAt >= now && session.status !== 'cancelled';
      })
      .sort((a, b) => new Date(a.startsAt ?? 0).getTime() - new Date(b.startsAt ?? 0).getTime())
      .slice(0, 5);
  }, [sessions]);

  const instructorStats = useMemo(() => [
    { label: 'My courses', value: courses.length, hint: 'Assigned tenant courses' },
    { label: 'Upcoming sessions', value: upcomingSessions.length, hint: 'Scheduled classes' },
    ...(homeworkEnabled ? [{ label: 'Needs review', value: homeworkSummary.needsReview ?? 0, hint: 'Homework queue' }] : []),
    ...(certificatesEnabled ? [{ label: 'Certificates', value: 'On', hint: canManageCertificates ? 'Registry access' : 'Tenant enabled' }] : []),
  ], [canManageCertificates, certificatesEnabled, courses.length, homeworkEnabled, homeworkSummary.needsReview, upcomingSessions.length]);

  if (!activeTenant) return <EmptyState title="No tenant assigned" detail="Ask a platform admin to add your user to a tenant." />;
  if (loading) return <LoadingState label="Loading tenant overview" />;

  if (!canManageMembers) {
    const teachingActions = [
      {
        to: '/sessions',
        icon: FiCalendar,
        title: 'Today and upcoming sessions',
        detail: 'Open groups, run sessions, attach materials, and manage meeting links.',
        metric: `${upcomingSessions.length} upcoming`,
      },
      {
        to: '/attendance',
        icon: FiCheckSquare,
        title: 'Attendance',
        detail: 'Mark attendance for scheduled live and offline classes.',
        metric: isTenantFeatureEnabled(activeTenant, 'attendance.enabled') ? 'Enabled' : 'Disabled',
        disabled: !isTenantFeatureEnabled(activeTenant, 'attendance.enabled'),
      },
      {
        to: '/homework',
        icon: FiBookOpen,
        title: 'Homework review',
        detail: 'Review submitted work, missing assignments, and student revisions.',
        metric: `${homeworkSummary.needsReview ?? 0} need review`,
        disabled: !homeworkEnabled,
      },
      ...(canManageCertificates ? [{
        to: '/certificates',
        icon: FiAward,
        title: 'Certificates',
        detail: 'View the course certificate registry and handle instructor approvals when enabled.',
        metric: certificatesEnabled ? 'Available' : 'Disabled',
        disabled: !certificatesEnabled,
      }] : []),
    ];

    return (
      <>
        <PageHeader
          title={activeTenant.name}
          eyebrow="Instructor overview"
          actions={<Link className="secondary-link-button" to="/settings"><FiSettings /> Settings</Link>}
        />
        <StatGrid items={instructorStats} />
        <section className="overview-action-grid" aria-label="Instructor actions">
          {teachingActions.map((action) => {
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
                <h2>My courses</h2>
                <span>Courses available to you in this tenant</span>
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
                  {courses.slice(0, 6).map((course) => (
                    <tr key={course.id}>
                      <td><strong>{course.title}</strong></td>
                      <td>{course.courseType || 'video'}</td>
                      <td><span className={`status-badge ${course.status || 'draft'}`}>{course.status || 'draft'}</span></td>
                      <td>{course.enrolledStudents ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!courses.length ? <EmptyState title="No assigned courses yet" detail="Ask a tenant admin to assign courses or groups to your account." /> : null}
          </section>

          <aside className="settings-panel">
            <div className="section-heading-row compact">
              <div>
                <h2>Upcoming sessions</h2>
                <span>Your next scheduled classes</span>
              </div>
            </div>
            <div className="stack-list">
              {upcomingSessions.map((session) => (
                <article className="stack-list-item" key={session.id}>
                  <div>
                    <strong>{session.title}</strong>
                    <span>{formatDate(session.startsAt)} · {readable(session.status || 'scheduled')}</span>
                  </div>
                  <Link className="link-button" to="/sessions">Open</Link>
                </article>
              ))}
              {!upcomingSessions.length ? <span className="muted-text">No upcoming sessions scheduled.</span> : null}
            </div>
          </aside>
        </div>

        {homeworkEnabled ? (
          <section className="settings-panel full">
            <div className="section-heading-row">
              <div>
                <h2>Homework queue</h2>
                <span>Assignments that need instructor attention</span>
              </div>
              <Link className="link-button" to="/homework">Open queue</Link>
            </div>
            <div className="stat-grid compact session-stat-grid">
              {['total', 'needsReview', 'missing', 'overdue'].map((key) => (
                <section className="stat-tile" key={key}>
                  <span>{key}</span>
                  <strong>{homeworkSummary[key] ?? 0}</strong>
                </section>
              ))}
            </div>
            <div className="stack-list">
              {homework.slice(0, 5).map((item) => (
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
              {!homework.length ? <span className="muted-text">No homework in your current queue.</span> : null}
            </div>
          </section>
        ) : null}
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={activeTenant.name}
        eyebrow="Tenant overview"
        actions={(
          <>
            {canManageMembers ? <Link className="secondary-link-button" to="/members"><FiUsers /> Members</Link> : null}
            <Link className="secondary-link-button" to="/settings"><FiSettings /> Settings</Link>
          </>
        )}
      />
      <StatGrid items={stats} />
      <section className="overview-action-grid" aria-label="Primary tenant actions">
        {quickActions.map((action) => {
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
              <h2>Recent courses</h2>
              <span>Courses available in this tenant workspace</span>
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
                {courses.slice(0, 6).map((course) => (
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
          {!courses.length ? <EmptyState title="No tenant courses yet" /> : null}
        </section>

        <aside className="settings-panel">
          <div className="section-heading-row compact">
            <div>
              <h2>Workspace readiness</h2>
              <span>{setupProgress}% configured</span>
            </div>
          </div>
          <div className="progress-cell overview-progress">
            <span style={{ width: `${setupProgress}%` }} />
            <strong>{setupProgress}%</strong>
          </div>
          <div className="stack-list">
            {setupItems.map((item) => (
              <article className="stack-list-item" key={item.label}>
                <div>
                  <strong>{item.label}</strong>
                  <span>{item.hint}</span>
                </div>
                <strong>{readable(item.value)}</strong>
              </article>
            ))}
          </div>
        </aside>
      </div>

      <div className="settings-grid overview-lower-grid">
        {homeworkEnabled ? (
          <section className="settings-panel">
          <div className="section-heading-row">
            <div>
              <h2>Homework queue</h2>
              <span>Assignments that may need instructor attention</span>
            </div>
            <Link className="link-button" to="/homework">Open queue</Link>
          </div>
          <div className="stat-grid compact session-stat-grid">
            {['total', 'needsReview', 'missing', 'overdue'].map((key) => (
              <section className="stat-tile" key={key}>
                <span>{key}</span>
                <strong>{homeworkSummary[key] ?? 0}</strong>
              </section>
            ))}
          </div>
          <div className="stack-list">
            {homework.slice(0, 5).map((item) => (
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
            {!homework.length ? <span className="muted-text">No homework in the current tenant queue.</span> : null}
          </div>
          </section>
        ) : null}

        <section className="settings-panel">
          <h2>Enabled workspace tools</h2>
          <div className="flag-grid">
            {enabledFeatures.slice(0, 8).map((feature) => (
              <div className="flag-row" key={feature}>
                <span>{feature}</span>
                <strong>Enabled</strong>
              </div>
            ))}
            {!enabledFeatures.length ? <span className="muted-text">No explicit feature flags configured. Default-enabled features still work.</span> : null}
          </div>
        </section>
      </div>

      {canViewTenantActivity ? (
        <section className="settings-panel full overview-activity-panel">
          <h2>Recent activity</h2>
          <div className="stack-list activity-timeline">
            {activity.map((item) => (
              <article className="stack-list-item" key={item.id}>
                <div>
                  <strong>{readable(item.action)}</strong>
                  <span>
                    {item.actorFullName || item.actorEmail || 'System'} · {formatDate(item.createdAt)}
                  </span>
                </div>
                <strong>{readable(item.targetType || item.targetId || 'tenant')}</strong>
              </article>
            ))}
            {!activity.length ? <span className="muted-text">No tenant activity recorded yet.</span> : null}
          </div>
        </section>
      ) : null}
    </>
  );
}
