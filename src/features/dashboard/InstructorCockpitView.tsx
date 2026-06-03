import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { IconType } from 'react-icons';
import { FiCheckSquare, FiSettings } from 'react-icons/fi';
import { EmptyState } from '../../components/DataState';
import type { Tenant, TenantOverview } from '../../types/domain';

export type CockpitStat = {
  label: string;
  value: ReactNode;
  hint?: string;
};

export type CockpitAction = {
  to: string;
  icon: IconType;
  title: string;
  detail: string;
  metric?: string;
  disabled?: boolean;
  disabledReason?: string;
  external?: boolean;
};

export type CockpitPriorityItem = {
  to: string;
  icon: IconType;
  title: string;
  detail: string;
  tone: 'warning' | 'info';
};

export type CockpitTodayOperation = {
  to: string;
  icon: IconType;
  label: string;
  value: ReactNode;
  detail: string;
  enabled: boolean;
  external?: boolean;
};

export type InstructorCockpitViewProps = {
  tenant: Tenant;
  overview: TenantOverview;
  stats: CockpitStat[];
  primaryAction: CockpitPriorityItem | null;
  todayOperations: CockpitTodayOperation[];
  priorityItems: CockpitPriorityItem[];
  actionCards: CockpitAction[];
  courseWorkspacePath: string;
  courseDetailPath: (courseId: number) => string;
  courseTypeLabel: (value?: string | null) => string;
  courseStatusLabel: (value?: string | null) => string;
  canCreateCourses: boolean;
};

function CockpitLinkCard({ action }: { action: CockpitAction }) {
  const Icon = action.icon;
  const content = (
    <>
      <span className="instructor-cockpit-icon"><Icon aria-hidden="true" /></span>
      <span className="instructor-cockpit-action-copy">
        <strong>{action.title}</strong>
        <small>{action.disabled ? action.disabledReason : action.detail}</small>
        {action.metric ? <em>{action.metric}</em> : null}
      </span>
    </>
  );

  if (action.disabled) {
    return <article className="instructor-cockpit-action disabled">{content}</article>;
  }

  if (action.external) {
    return <a className="instructor-cockpit-action" href={action.to} target="_blank" rel="noreferrer">{content}</a>;
  }

  return <Link className="instructor-cockpit-action" to={action.to}>{content}</Link>;
}

function TodayOperationCard({ item }: { item: CockpitTodayOperation }) {
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
    return <a className="instructor-today-card" href={item.to} target="_blank" rel="noreferrer">{content}</a>;
  }

  return item.enabled ? (
    <Link className="instructor-today-card" to={item.to}>{content}</Link>
  ) : (
    <article className="instructor-today-card disabled">{content}</article>
  );
}

export function InstructorCockpitView({
  tenant,
  overview,
  stats,
  primaryAction,
  todayOperations,
  priorityItems,
  actionCards,
  courseWorkspacePath,
  courseDetailPath,
  courseTypeLabel,
  courseStatusLabel,
  canCreateCourses,
}: InstructorCockpitViewProps) {
  const { t } = useTranslation();
  const PrimaryIcon = primaryAction?.icon ?? FiCheckSquare;
  const upcomingSessions = overview.sessions.upcoming.slice(0, 4);
  const homeworkQueue = overview.homework.queue.slice(0, 5);

  return (
    <main className="instructor-cockpit-page">
      <header className="instructor-cockpit-header">
        <div>
          <span className="ui-page-kicker">{t('overview.instructorOverview')}</span>
          <h1 className="ui-page-title">{t('overview.instructorCockpitTitle')}</h1>
          <p className="ui-page-description">
            {t('overview.instructorCockpitDescription', { tenant: tenant.name })}
          </p>
        </div>
        <Link className="ui-secondary-action" to="/settings"><FiSettings /> {t('overview.settings')}</Link>
      </header>

      <section className="instructor-cockpit-hero" aria-label={t('overview.primaryActions')}>
        <span className="instructor-cockpit-hero-icon"><PrimaryIcon aria-hidden="true" /></span>
        <div>
          <span className="ui-page-kicker">{t('overview.primaryActions')}</span>
          <h2>{primaryAction?.title ?? t('overview.workspaceClear')}</h2>
          <p>{primaryAction?.detail ?? t('overview.allClearDetail')}</p>
        </div>
        <Link className="ui-primary-action" to={primaryAction?.to ?? '/sessions'}>{t('student.open')}</Link>
      </section>

      <section className="instructor-cockpit-section" aria-label={t('overview.todayOperations')}>
        <div className="instructor-cockpit-section-heading">
          <div>
            <span className="ui-page-kicker">{t('overview.today')}</span>
            <h2>{t('overview.todayOperations')}</h2>
          </div>
        </div>
        <div className="instructor-today-grid">
          {todayOperations.map((item) => <TodayOperationCard item={item} key={item.label} />)}
        </div>
      </section>

      <section className="instructor-cockpit-work-row">
        <div className="instructor-work-queue">
          <div className="instructor-cockpit-section-heading compact">
            <div>
              <span className="ui-page-kicker">{t('overview.needsAttention')}</span>
              <h2>{priorityItems.length ? t('overview.activeItemCount', { count: priorityItems.length }) : t('overview.noActiveBlockers')}</h2>
            </div>
          </div>
          <div className="instructor-work-list">
            {priorityItems.length ? priorityItems.slice(0, 5).map((item) => {
              const Icon = item.icon;
              return (
                <Link className={`instructor-work-item ${item.tone}`} to={item.to} key={`${item.to}-${item.title}`}>
                  <Icon aria-hidden="true" />
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.detail}</small>
                  </span>
                </Link>
              );
            }) : (
              <article className="instructor-work-item info static">
                <FiCheckSquare aria-hidden="true" />
                <span>
                  <strong>{t('overview.workspaceClear')}</strong>
                  <small>{t('overview.allClearDetail')}</small>
                </span>
              </article>
            )}
          </div>
        </div>

        <div className="instructor-stat-panel">
          <div className="instructor-cockpit-section-heading compact">
            <div>
              <span className="ui-page-kicker">{t('overview.coursesInScope')}</span>
              <h2>{t('overview.workspaceReadiness')}</h2>
            </div>
          </div>
          <div className="instructor-stat-grid">
            {stats.map((item) => (
              <article className="instructor-stat-card" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                {item.hint ? <small>{item.hint}</small> : null}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="instructor-cockpit-section" aria-label={t('overview.primaryActions')}>
        <div className="instructor-cockpit-section-heading">
          <div>
            <span className="ui-page-kicker">{t('overview.primaryActions')}</span>
            <h2>{t('overview.quickActions')}</h2>
          </div>
        </div>
        <div className="instructor-action-grid">
          {actionCards.map((action) => <CockpitLinkCard action={action} key={action.title} />)}
        </div>
      </section>

      <section className="instructor-cockpit-lower-grid">
        <section className="instructor-cockpit-panel">
          <div className="instructor-cockpit-section-heading">
            <div>
              <h2>{t('overview.coursesInScope')}</h2>
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
                {overview.courses.slice(0, 6).map((course) => (
                  <tr key={course.id}>
                    <td>
                      <Link className="table-primary-link" to={courseDetailPath(course.id)}>{course.title}</Link>
                      {course.instructor?.fullName ? <small>{course.instructor.fullName}</small> : null}
                    </td>
                    <td><span className="metadata-text">{courseTypeLabel(course.courseType)}</span></td>
                    <td><span className={`status-badge ${course.status || 'draft'}`}>{courseStatusLabel(course.status)}</span></td>
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

        <aside className="instructor-cockpit-side-stack">
          <section className="instructor-cockpit-panel compact">
            <div className="instructor-cockpit-section-heading">
              <div>
                <h2>{t('overview.upcomingSessions')}</h2>
                <span>{t('overview.activeItemCount', { count: upcomingSessions.length })}</span>
              </div>
              <Link className="link-button" to="/sessions">{t('overview.viewAll')}</Link>
            </div>
            <div className="instructor-session-list">
              {upcomingSessions.length ? upcomingSessions.map((session) => (
                <Link className="instructor-session-item" to="/sessions" key={session.id}>
                  <strong>{session.title}</strong>
                  <small>{session.groupName || session.courseTitle || t('overview.scheduledSessions')}</small>
                </Link>
              )) : (
                <EmptyState
                  title={t('overview.noSessionsToday')}
                  detail={t('overview.sessionsEmptyDetail')}
                  action={<Link className="secondary-link-button" to="/sessions">{t('overview.openSessions')}</Link>}
                />
              )}
            </div>
          </section>

          <section className="instructor-cockpit-panel compact">
            <div className="instructor-cockpit-section-heading">
              <div>
                <h2>{t('overview.homeworkReview')}</h2>
                <span>{t('overview.needsAttention')}</span>
              </div>
              <Link className="link-button" to="/homework">{t('overview.openQueue')}</Link>
            </div>
            <div className="instructor-homework-list">
              {homeworkQueue.length ? homeworkQueue.map((homework) => (
                <Link className="instructor-homework-item" to="/homework" key={homework.id}>
                  <strong>{homework.title}</strong>
                  <small>{homework.courseTitle || homework.groupName || t('overview.homeworkReview')}</small>
                  <span className="ui-status-chip ui-status-success">{t('overview.submissionsNeedReview', { count: homework.queue?.needsReview ?? homework.queue?.needsReviewCount ?? 0 })}</span>
                </Link>
              )) : (
                <article className="ui-empty-state">
                  <strong>{t('overview.workspaceClear')}</strong>
                  <span>{t('overview.allClearDetail')}</span>
                </article>
              )}
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}
