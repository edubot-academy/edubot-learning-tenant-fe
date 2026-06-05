import type { ReactNode } from 'react';
import { FiAward, FiLock } from 'react-icons/fi';

export type InstructorEngagementBlockedPanelProps = {
  title: ReactNode;
  detail: ReactNode;
  requirements?: ReactNode[];
};

export function InstructorEngagementBlockedPanel({
  title,
  detail,
  requirements = [],
}: InstructorEngagementBlockedPanelProps) {
  return (
    <section className="instructor-learning-card instructor-learning-blocked-panel" aria-label={String(title)}>
      <div className="instructor-learning-section-heading">
        <div className="instructor-learning-heading-with-icon">
          <span className="instructor-learning-icon tone-muted" aria-hidden="true"><FiLock /></span>
          <span>
            <h2>{title}</h2>
            <p>{detail}</p>
          </span>
        </div>
      </div>

      {requirements.length ? (
        <ul className="instructor-learning-blocked-list">
          {requirements.map((requirement, index) => (
            <li key={index}>
              <FiAward aria-hidden="true" />
              <span>{requirement}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export default InstructorEngagementBlockedPanel;
