import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowRight, FiLock, FiPlusCircle } from 'react-icons/fi';
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
  const visibleItems = items.filter(Boolean).slice(0, 4);

  return (
    <section className="instructor-learning-quick-actions" aria-label={String(title)}>
      <div className="instructor-learning-quick-actions-heading">
        <h2>{title}</h2>
        {detail ? <p>{detail}</p> : null}
      </div>

      {visibleItems.length ? (
        <div className="instructor-learning-quick-action-grid">
          {visibleItems.map((item, index) => {
            const content = (
              <>
                <span className={cx('instructor-learning-quick-action-icon', `tone-${item.tone ?? 'primary'}`)} aria-hidden="true">
                  {item.disabled ? <FiLock /> : item.icon ?? <FiPlusCircle />}
                </span>
                <span className="instructor-learning-quick-action-copy">
                  <b>{item.label}</b>
                  {item.disabled && item.disabledReason ? <small>{item.disabledReason}</small> : item.detail ? <small>{item.detail}</small> : null}
                </span>
                {index >= 2 && !item.disabled ? <FiArrowRight aria-hidden="true" /> : null}
              </>
            );
            const className = cx('instructor-learning-quick-action', index >= 2 && 'is-wide', item.disabled && 'disabled');

            if (item.disabled) {
              return <article className={className} key={item.key}>{content}</article>;
            }

            if (item.external) {
              return <a className={className} href={item.to} target="_blank" rel="noreferrer" key={item.key}>{content}</a>;
            }

            return <Link className={className} to={item.to} key={item.key}>{content}</Link>;
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
