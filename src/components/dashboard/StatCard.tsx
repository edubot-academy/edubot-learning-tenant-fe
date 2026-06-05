import type { ReactNode } from 'react';
import { DashboardCard } from './DashboardCard';
import { cx } from './dashboardUtils';

type StatCardProps = {
  label: ReactNode;
  value: ReactNode;
  icon?: ReactNode;
  detail?: ReactNode;
  className?: string;
};

export function StatCard({ label, value, icon, detail, className }: StatCardProps) {
  return (
    <DashboardCard variant="stat" className={cx('dashboard-stat-card', className)}>
      {icon ? <span className="dashboard-stat-icon" aria-hidden="true">{icon}</span> : null}
      <span className="dashboard-stat-copy">
        <strong>{value}</strong>
        <span>{label}</span>
        {detail ? <small>{detail}</small> : null}
      </span>
    </DashboardCard>
  );
}
