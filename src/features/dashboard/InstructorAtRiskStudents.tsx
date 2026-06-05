import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { FiAlertTriangle, FiArrowRight, FiCheckSquare, FiUser } from 'react-icons/fi';
import { cx } from '../../components/dashboard/dashboardUtils';
import type { InstructorLearningTone } from './InstructorLearningDashboard';

export type InstructorAtRiskReason = {
  label: ReactNode;
  to?: string;
};

export type InstructorAtRiskStudentItem = {
  id: string | number;
  name: ReactNode;
  detail?: ReactNode;
  severityLabel?: ReactNode;
  severityTone?: InstructorLearningTone;
  reasons?: InstructorAtRiskReason[];
  to?: string;
};

export type InstructorAtRiskStudentsProps = {
  title: ReactNode;
  detail?: ReactNode;
  allLabel?: ReactNode;
  allTo?: string;
  emptyLabel: ReactNode;
  items: InstructorAtRiskStudentItem[];
};

function initialsFromName(value: ReactNode) {
  if (typeof value !== 'string') return <FiUser />;
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return <FiUser />;
  return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

export function InstructorAtRiskStudents({
  title,
  detail,
  allLabel,
  allTo = '/support',
  emptyLabel,
  items,
}: InstructorAtRiskStudentsProps) {
  return (
    <section className="instructor-learning-card instructor-learning-at-risk" aria-label={String(title)}>
      <div className="instructor-learning-section-heading">
        <div className="instructor-learning-heading-with-icon">
          <span className="instructor-learning-icon tone-danger" aria-hidden="true"><FiAlertTriangle /></span>
          <span>
            <h2>{title}</h2>
            {detail ? <p>{detail}</p> : null}
          </span>
        </div>
        {allLabel ? <Link className="instructor-learning-text-link" to={allTo}>{allLabel}</Link> : null}
      </div>

      {items.length ? (
        <ul className="instructor-learning-homework-list">
          {items.map((student) => {
            const content = (
              <>
                <span className={cx('instructor-learning-homework-avatar', `tone-${student.severityTone ?? 'danger'}`)} aria-hidden="true">
                  {initialsFromName(student.name)}
                </span>
                <span className="instructor-learning-homework-copy">
                  <b>{student.name}</b>
                  {student.detail ? <small>{student.detail}</small> : null}
                  {student.reasons?.length ? (
                    <span className="instructor-learning-reason-list">
                      {student.reasons.slice(0, 3).map((reason, index) => reason.to ? (
                        <Link to={reason.to} key={`${student.id}-reason-${index}`}>{reason.label}</Link>
                      ) : (
                        <em key={`${student.id}-reason-${index}`}>{reason.label}</em>
                      ))}
                    </span>
                  ) : null}
                </span>
                {student.severityLabel ? (
                  <span className={cx('instructor-learning-chip', `tone-${student.severityTone ?? 'danger'}`)}>
                    {student.severityLabel}
                  </span>
                ) : null}
              </>
            );

            return (
              <li key={student.id}>
                {student.to ? (
                  <Link className="instructor-learning-homework-row" to={student.to}>
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

export default InstructorAtRiskStudents;
