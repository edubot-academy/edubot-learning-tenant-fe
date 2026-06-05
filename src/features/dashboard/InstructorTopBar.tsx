import type { ReactNode } from 'react';
import { FiCalendar, FiCheckSquare, FiZap } from 'react-icons/fi';

export type InstructorTopBarProps = {
  title: ReactNode;
  detail: ReactNode;
  tenantName?: ReactNode;
  todaySessionsLabel: ReactNode;
  todaySessionsValue: ReactNode;
  reviewLabel: ReactNode;
  reviewValue: ReactNode;
};

export function InstructorTopBar({
  title,
  detail,
  tenantName,
  todaySessionsLabel,
  todaySessionsValue,
  reviewLabel,
  reviewValue,
}: InstructorTopBarProps) {
  return (
    <header className="instructor-learning-topbar">
      <div className="instructor-learning-topbar-copy">
        <span className="instructor-learning-live-chip">
          <FiZap aria-hidden="true" />
          {tenantName}
        </span>
        <h1>{title}</h1>
        <p>{detail}</p>
      </div>

      <div className="instructor-learning-topbar-metrics" aria-label={String(title)}>
        <article>
          <FiCalendar aria-hidden="true" />
          <span>{todaySessionsLabel}</span>
          <strong>{todaySessionsValue}</strong>
        </article>
        <article>
          <FiCheckSquare aria-hidden="true" />
          <span>{reviewLabel}</span>
          <strong>{reviewValue}</strong>
        </article>
      </div>
    </header>
  );
}

export default InstructorTopBar;
