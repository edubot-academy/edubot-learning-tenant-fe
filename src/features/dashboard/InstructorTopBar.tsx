import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { FiCalendar, FiCheckSquare, FiSettings, FiZap } from 'react-icons/fi';

export type InstructorTopBarProps = {
  title: ReactNode;
  detail: ReactNode;
  tenantName?: ReactNode;
  todaySessionsLabel: ReactNode;
  todaySessionsValue: ReactNode;
  reviewLabel: ReactNode;
  reviewValue: ReactNode;
  settingsLabel: ReactNode;
};

export function InstructorTopBar({
  title,
  detail,
  tenantName,
  todaySessionsLabel,
  todaySessionsValue,
  reviewLabel,
  reviewValue,
  settingsLabel,
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

      <div className="instructor-learning-topbar-right">
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
        <Link className="instructor-learning-settings-link" to="/settings">
          <FiSettings aria-hidden="true" />
          {settingsLabel}
        </Link>
      </div>
    </header>
  );
}

export default InstructorTopBar;
