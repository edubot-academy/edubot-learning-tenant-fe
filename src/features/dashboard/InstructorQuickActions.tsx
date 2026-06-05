import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowRight, FiLock, FiPlusCircle, FiZap } from 'react-icons/fi';
import { cx } from '../../components/dashboard/dashboardUtils';
import type { InstructorLearningTone } from './InstructorLearningDashboard';

export type InstructorQuickActionItem = {
  key: string;
  label: ReactNode;
  detail?: ReactNode;
  to: string;
  icon?: ReactNode;
  tone?: InstructorLearningTone;
  disabled?: boolean;
  disabledReason?: ReactNode;
  external?: boolean;
};

export type InstructorQuickActionsProps = {
  title: ReactNode;
  detail?: ReactNode;
  emptyLabel: ReactNode;
  items: InstructorQuickActionItem[];
};

export function InstructorQuickActions({
  title,
  detail,
  emptyLabel,
  items,
}: InstructorQuickActionsProps) {
  const visibleItems = items.filter(Boolean);

  return (
    <section className="instructor-learning-card instructor-learning-quick-actions" aria-label={String(title)}>
      <div className="instructor-learning-section-heading">
        <div className="instructor-learning-heading-with-icon">
          <span className="instructor-learning-icon tone-primary" aria-hidden="true"><FiZap /></span>
          <span>
            <h2>{title}</h2>
            {detail ? <p>{detail}</p> : null}
          </span>
        </div>
      </div>

      {visibleItems.length ? (
        <div className="instructor-learning-quick-action-grid">
          {visibleItems.map((item) => {
            const content = (
              <>
                <span className={cx('instructor-learning-homework-avatar', `tone-${item.tone ?? 'primary'}`)} aria-hidden="true">
                  {item.disabled ? <FiLock /> : item.icon ?? <FiPlusCircle />}
                </span>
                <span className="instructor-learning-homework-copy">
                  <b>{item.label}</b>
                  {item.disabled && item.disabledReason ? <small>{item.disabledReason}</small> : item.detail ? <small>{item.detail}</small> : null}
                </span>
                {!item.disabled ? <FiArrowRight aria-hidden="true" /> : null}
              </>
            );

            if (item.disabled) {
              return <article className="instructor-learning-quick-action disabled" key={item.key}>{content}</article>;
            }

            if (item.external) {
              return <a className="instructor-learning-quick-action" href={item.to} target="_blank" rel="noreferrer" key={item.key}>{content}</a>;
            }

            return <Link className="instructor-learning-quick-action" to={item.to} key={item.key}>{content}</Link>;
          })}
        </div>
      ) : (
        <div className="instructor-learning-empty">
          <FiLock aria-hidden="true" />
          <strong>{emptyLabel}</strong>
        </div>
      )}
    </section>
  );
}

export default InstructorQuickActions;
