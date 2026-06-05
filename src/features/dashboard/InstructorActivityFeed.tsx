import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { FiActivity, FiArrowRight, FiCheckSquare } from 'react-icons/fi';
import { cx } from '../../components/dashboard/dashboardUtils';
import type { InstructorLearningTone } from './InstructorLearningDashboard';

export type InstructorActivityFeedItem = {
  id: string | number;
  title: ReactNode;
  detail?: ReactNode;
  meta?: ReactNode;
  time?: ReactNode;
  icon?: ReactNode;
  tone?: InstructorLearningTone;
  to?: string;
};

export type InstructorActivityFeedProps = {
  title: ReactNode;
  detail?: ReactNode;
  allLabel?: ReactNode;
  allTo?: string;
  emptyLabel: ReactNode;
  items: InstructorActivityFeedItem[];
};

export function InstructorActivityFeed({
  title,
  detail,
  allLabel,
  allTo = '/sessions',
  emptyLabel,
  items,
}: InstructorActivityFeedProps) {
  return (
    <section className="instructor-learning-card instructor-learning-activity-feed" aria-label={String(title)}>
      <div className="instructor-learning-section-heading">
        <div className="instructor-learning-heading-with-icon">
          <span className="instructor-learning-icon tone-success" aria-hidden="true"><FiActivity /></span>
          <span>
            <h2>{title}</h2>
            {detail ? <p>{detail}</p> : null}
          </span>
        </div>
        {allLabel ? <Link className="instructor-learning-text-link" to={allTo}>{allLabel}</Link> : null}
      </div>

      {items.length ? (
        <ul className="instructor-learning-homework-list">
          {items.map((item) => {
            const content = (
              <>
                <span className={cx('instructor-learning-homework-avatar', `tone-${item.tone ?? 'success'}`)} aria-hidden="true">
                  {item.icon ?? <FiActivity />}
                </span>
                <span className="instructor-learning-homework-copy">
                  <b>{item.title}</b>
                  {item.detail ? <small>{item.detail}</small> : null}
                </span>
                {item.meta ? (
                  <span className={cx('instructor-learning-chip', `tone-${item.tone ?? 'muted'}`)}>
                    {item.meta}
                  </span>
                ) : null}
                {item.time ? <span className="instructor-learning-homework-age">{item.time}</span> : null}
              </>
            );

            return (
              <li key={item.id}>
                {item.to ? (
                  <Link className="instructor-learning-homework-row" to={item.to}>
                    {content}
                    <FiArrowRight aria-hidden="true" />
                  </Link>
                ) : (
                  <article className="instructor-learning-homework-row">{content}</article>
                )}
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

export default InstructorActivityFeed;
