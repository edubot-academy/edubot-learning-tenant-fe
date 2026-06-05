import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowRight, FiAward, FiCalendar, FiCheckSquare, FiClock, FiExternalLink, FiZap } from 'react-icons/fi';
import { cx } from '../../components/dashboard/dashboardUtils';

export type InstructorLearningTone = 'primary' | 'secondary' | 'accent' | 'success' | 'danger' | 'muted';

export type InstructorInsightItem = {
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  icon: ReactNode;
  tone?: InstructorLearningTone;
};

export type InstructorAttentionItem = {
  label: ReactNode;
  detail?: ReactNode;
  count: ReactNode;
  to: string;
  icon: ReactNode;
  tone?: InstructorLearningTone;
  disabled?: boolean;
};

export type InstructorSessionItem = {
  id: string | number;
  title: ReactNode;
  detail?: ReactNode;
  time?: ReactNode;
  statusLabel?: ReactNode;
  status?: 'live' | 'soon' | 'upcoming' | 'done' | 'muted';
  attendees?: ReactNode;
  to?: string;
  external?: boolean;
};

export type InstructorLaunchPanelProps = {
  eyebrow: ReactNode;
  title: ReactNode;
  detail?: ReactNode;
  actionLabel: ReactNode;
  to: string;
  external?: boolean;
  code?: ReactNode;
  disabled?: boolean;
};

export type InstructorHomeworkStat = {
  label: ReactNode;
  value: ReactNode;
  tone?: InstructorLearningTone;
};

export type InstructorHomeworkItem = {
  id: string | number;
  title: ReactNode;
  detail?: ReactNode;
  statusLabel?: ReactNode;
  statusTone?: InstructorLearningTone;
  age?: ReactNode;
  to?: string;
};

export type InstructorCertificateTile = {
  label: ReactNode;
  value: ReactNode;
  tone?: InstructorLearningTone;
};

export type InstructorSessionGroup = {
  key: string;
  label: ReactNode;
  sessions: InstructorSessionItem[];
};

export function InstructorInsightsRow({ items }: { items: InstructorInsightItem[] }) {
  return (
    <section className="instructor-learning-insights" aria-label="Instructor insights">
      {items.map((item, index) => (
        <article className={cx('instructor-learning-stat', `tone-${item.tone ?? 'primary'}`)} key={`${item.label}-${index}`}>
          <span className="instructor-learning-icon" aria-hidden="true">{item.icon}</span>
          <span className="instructor-learning-stat-label">{item.label}</span>
          <strong>{item.value}</strong>
          {item.detail ? <small>{item.detail}</small> : null}
        </article>
      ))}
    </section>
  );
}

export function InstructorAttentionQueue({
  title,
  detail,
  emptyLabel,
  items,
}: {
  title: ReactNode;
  detail?: ReactNode;
  emptyLabel: ReactNode;
  items: InstructorAttentionItem[];
}) {
  const enabledItems = items.filter((item) => !item.disabled);

  return (
    <section className="instructor-learning-card instructor-learning-attention" aria-label={String(title)}>
      <div className="instructor-learning-section-heading">
        <div>
          <h2>{title}</h2>
          {detail ? <p>{detail}</p> : null}
        </div>
        <span className={cx('instructor-learning-chip', enabledItems.length ? 'tone-danger' : 'tone-success')}>
          {enabledItems.length || emptyLabel}
        </span>
      </div>

      {enabledItems.length ? (
        <div className="instructor-learning-attention-grid">
          {enabledItems.map((item, index) => (
            <Link className={cx('instructor-learning-queue-item', `tone-${item.tone ?? 'primary'}`)} to={item.to} key={`${item.to}-${index}`}>
              <span className="instructor-learning-icon" aria-hidden="true">{item.icon}</span>
              <span className="instructor-learning-queue-copy">
                <span>
                  <strong>{item.count}</strong>
                  <b>{item.label}</b>
                </span>
                {item.detail ? <small>{item.detail}</small> : null}
              </span>
              <FiArrowRight aria-hidden="true" />
            </Link>
          ))}
        </div>
      ) : (
        <div className="instructor-learning-empty">
          <FiCheckSquare aria-hidden="true" />
          <strong>{emptyLabel}</strong>
        </div>
      )}
    </section>
  );
}

export function InstructorLaunchPanel({
  eyebrow,
  title,
  detail,
  actionLabel,
  to,
  external,
  code,
  disabled,
}: InstructorLaunchPanelProps) {
  const action = (
    <span className={cx('instructor-learning-launch-action', disabled && 'is-disabled')}>
      <FiZap aria-hidden="true" />
      {actionLabel}
      {external ? <FiExternalLink aria-hidden="true" /> : null}
    </span>
  );

  return (
    <section className="instructor-learning-launch">
      <div className="instructor-learning-launch-copy">
        <span className="instructor-learning-live-chip">{eyebrow}</span>
        <h2>{title}</h2>
        {detail ? <p>{detail}</p> : null}
      </div>
      <div className="instructor-learning-launch-controls">
        {code ? <span className="instructor-learning-code">{code}</span> : null}
        {disabled ? action : external ? (
          <a href={to} target="_blank" rel="noreferrer">{action}</a>
        ) : (
          <Link to={to}>{action}</Link>
        )}
      </div>
    </section>
  );
}

export function InstructorTodaySessions({
  title,
  detail,
  emptyLabel,
  allLabel,
  sessions,
}: {
  title: ReactNode;
  detail?: ReactNode;
  emptyLabel: ReactNode;
  allLabel: ReactNode;
  sessions: InstructorSessionItem[];
}) {
  return (
    <section className="instructor-learning-card instructor-learning-sessions" aria-label={String(title)}>
      <div className="instructor-learning-section-heading">
        <div className="instructor-learning-heading-with-icon">
          <span className="instructor-learning-icon tone-secondary" aria-hidden="true"><FiCalendar /></span>
          <span>
            <h2>{title}</h2>
            {detail ? <p>{detail}</p> : null}
          </span>
        </div>
        <Link className="instructor-learning-text-link" to="/sessions">{allLabel}</Link>
      </div>

      {sessions.length ? (
        <div className="instructor-learning-session-list">
          {sessions.map((session) => {
            const content = (
              <>
                <span className="instructor-learning-session-time">
                  <FiClock aria-hidden="true" />
                  <strong>{session.time ?? '--:--'}</strong>
                </span>
                <span className="instructor-learning-session-copy">
                  {session.statusLabel ? (
                    <span className={cx('instructor-learning-chip', `tone-${session.status ?? 'muted'}`)}>
                      {session.statusLabel}
                    </span>
                  ) : null}
                  <b>{session.title}</b>
                  {session.detail ? <small>{session.detail}</small> : null}
                </span>
                {session.attendees ? <span className="instructor-learning-session-count">{session.attendees}</span> : null}
              </>
            );
            if (session.to && session.external) {
              return <a className="instructor-learning-session-row" href={session.to} target="_blank" rel="noreferrer" key={session.id}>{content}</a>;
            }
            if (session.to) {
              return <Link className="instructor-learning-session-row" to={session.to} key={session.id}>{content}</Link>;
            }
            return <article className="instructor-learning-session-row" key={session.id}>{content}</article>;
          })}
        </div>
      ) : (
        <div className="instructor-learning-empty">
          <FiCalendar aria-hidden="true" />
          <strong>{emptyLabel}</strong>
        </div>
      )}
    </section>
  );
}

export function InstructorUpcomingSessionsPanel({
  title,
  detail,
  emptyLabel,
  allLabel,
  groups,
}: {
  title: ReactNode;
  detail?: ReactNode;
  emptyLabel: ReactNode;
  allLabel: ReactNode;
  groups: InstructorSessionGroup[];
}) {
  const sessionCount = groups.reduce((count, group) => count + group.sessions.length, 0);

  return (
    <section className="instructor-learning-card instructor-learning-upcoming" aria-label={String(title)}>
      <div className="instructor-learning-section-heading">
        <div className="instructor-learning-heading-with-icon">
          <span className="instructor-learning-icon tone-secondary" aria-hidden="true"><FiCalendar /></span>
          <span>
            <h2>{title}</h2>
            {detail ? <p>{detail}</p> : null}
          </span>
        </div>
        <Link className="instructor-learning-text-link" to="/sessions">{allLabel}</Link>
      </div>

      {sessionCount ? (
        <div className="instructor-learning-upcoming-groups">
          {groups.map((group) => (
            <section className="instructor-learning-upcoming-group" key={group.key}>
              <h3>{group.label}</h3>
              <div className="instructor-learning-session-list">
                {group.sessions.map((session) => {
                  const content = (
                    <>
                      <span className="instructor-learning-session-time">
                        <FiClock aria-hidden="true" />
                        <strong>{session.time ?? '--:--'}</strong>
                      </span>
                      <span className="instructor-learning-session-copy">
                        {session.statusLabel ? (
                          <span className={cx('instructor-learning-chip', `tone-${session.status ?? 'muted'}`)}>
                            {session.statusLabel}
                          </span>
                        ) : null}
                        <b>{session.title}</b>
                        {session.detail ? <small>{session.detail}</small> : null}
                      </span>
                      {session.attendees ? <span className="instructor-learning-session-count">{session.attendees}</span> : null}
                    </>
                  );
                  if (session.to && session.external) {
                    return <a className="instructor-learning-session-row" href={session.to} target="_blank" rel="noreferrer" key={session.id}>{content}</a>;
                  }
                  if (session.to) {
                    return <Link className="instructor-learning-session-row" to={session.to} key={session.id}>{content}</Link>;
                  }
                  return <article className="instructor-learning-session-row" key={session.id}>{content}</article>;
                })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="instructor-learning-empty">
          <FiCalendar aria-hidden="true" />
          <strong>{emptyLabel}</strong>
        </div>
      )}
    </section>
  );
}

export function InstructorHomeworkQueue({
  title,
  detail,
  allLabel,
  emptyLabel,
  stats,
  items,
}: {
  title: ReactNode;
  detail?: ReactNode;
  allLabel: ReactNode;
  emptyLabel: ReactNode;
  stats: InstructorHomeworkStat[];
  items: InstructorHomeworkItem[];
}) {
  return (
    <section className="instructor-learning-card instructor-learning-homework" aria-label={String(title)}>
      <div className="instructor-learning-section-heading">
        <div className="instructor-learning-heading-with-icon">
          <span className="instructor-learning-icon tone-accent" aria-hidden="true"><FiCheckSquare /></span>
          <span>
            <h2>{title}</h2>
            {detail ? <p>{detail}</p> : null}
          </span>
        </div>
        <Link className="instructor-learning-text-link" to="/homework">{allLabel}</Link>
      </div>

      <div className="instructor-learning-homework-stats">
        {stats.map((stat, index) => (
          <article className={cx('instructor-learning-mini-stat', `tone-${stat.tone ?? 'primary'}`)} key={`${stat.label}-${index}`}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </article>
        ))}
      </div>

      {items.length ? (
        <ul className="instructor-learning-homework-list">
          {items.map((item) => {
            const content = (
              <>
                <span className="instructor-learning-homework-avatar" aria-hidden="true">
                  {String(item.title ?? '?').trim().slice(0, 2).toUpperCase()}
                </span>
                <span className="instructor-learning-homework-copy">
                  <b>{item.title}</b>
                  {item.detail ? <small>{item.detail}</small> : null}
                </span>
                {item.statusLabel ? (
                  <span className={cx('instructor-learning-chip', `tone-${item.statusTone ?? 'muted'}`)}>
                    {item.statusLabel}
                  </span>
                ) : null}
                {item.age ? <span className="instructor-learning-homework-age">{item.age}</span> : null}
              </>
            );
            return (
              <li key={item.id}>
                {item.to ? <Link className="instructor-learning-homework-row" to={item.to}>{content}</Link> : <article className="instructor-learning-homework-row">{content}</article>}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="instructor-learning-empty">
          <FiCheckSquare aria-hidden="true" />
          <strong>{emptyLabel}</strong>
        </div>
      )}
    </section>
  );
}

export function InstructorCertificatesPanel({
  title,
  detail,
  actionLabel,
  tiles,
}: {
  title: ReactNode;
  detail?: ReactNode;
  actionLabel: ReactNode;
  tiles: InstructorCertificateTile[];
}) {
  return (
    <section className="instructor-learning-card instructor-learning-certificates" aria-label={String(title)}>
      <div className="instructor-learning-section-heading">
        <div className="instructor-learning-heading-with-icon">
          <span className="instructor-learning-icon tone-primary" aria-hidden="true"><FiAward /></span>
          <span>
            <h2>{title}</h2>
            {detail ? <p>{detail}</p> : null}
          </span>
        </div>
        <Link className="instructor-learning-text-link" to="/certificates">{actionLabel}</Link>
      </div>
      <div className="instructor-learning-certificate-grid">
        {tiles.map((tile, index) => (
          <article className={cx('instructor-learning-mini-stat', `tone-${tile.tone ?? 'primary'}`)} key={`${tile.label}-${index}`}>
            <span>{tile.label}</span>
            <strong>{tile.value}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}
