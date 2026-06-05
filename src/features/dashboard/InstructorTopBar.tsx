import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { FiCalendar, FiCheckSquare, FiSettings, FiZap } from 'react-icons/fi';

export type InstructorTopBarProps = {
  title: ReactNode;
  detail: ReactNode;
  tenantName?: ReactNode;
  instructorName?: string | null;
  instructorEmail?: string | null;
  profileLabel: ReactNode;
  todaySessionsLabel: ReactNode;
  todaySessionsValue: ReactNode;
  reviewLabel: ReactNode;
  reviewValue: ReactNode;
  settingsLabel: ReactNode;
};

function initialsFromName(value?: string | null) {
  const cleanValue = value?.trim();
  if (!cleanValue) return 'IN';
  const parts = cleanValue.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

export function InstructorTopBar({
  title,
  detail,
  tenantName,
  instructorName,
  instructorEmail,
  profileLabel,
  todaySessionsLabel,
  todaySessionsValue,
  reviewLabel,
  reviewValue,
  settingsLabel,
}: InstructorTopBarProps) {
  const displayName = instructorName?.trim() || instructorEmail?.trim() || String(profileLabel);

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
        <div className="instructor-learning-profile-card">
          <span className="instructor-learning-profile-avatar" aria-hidden="true">
            {initialsFromName(displayName)}
          </span>
          <span className="instructor-learning-profile-copy">
            <small>{profileLabel}</small>
            <strong>{displayName}</strong>
          </span>
        </div>
        <Link className="instructor-learning-settings-link" to="/settings" aria-label={String(settingsLabel)}>
          <FiSettings aria-hidden="true" />
          <span>{settingsLabel}</span>
        </Link>
      </div>
    </header>
  );
}

export default InstructorTopBar;
