import type { ReactNode } from 'react';
import { cx } from './dashboardUtils';

type DashboardPageHeaderProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  rightSlot?: ReactNode;
  className?: string;
};

export function DashboardPageHeader({
  eyebrow,
  title,
  description,
  rightSlot,
  className,
}: DashboardPageHeaderProps) {
  return (
    <header className={cx('page-header dashboard-page-header', className)}>
      <div className="dashboard-page-header-copy">
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {rightSlot ? <div className="dashboard-page-header-actions">{rightSlot}</div> : null}
    </header>
  );
}
