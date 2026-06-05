import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from './dashboardUtils';

type DashboardCardProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  variant?: 'default' | 'hero' | 'compact' | 'stat' | 'task';
};

export function DashboardCard({
  children,
  variant = 'default',
  className,
  ...props
}: DashboardCardProps) {
  return (
    <section
      className={cx(
        'dashboard-card',
        variant === 'hero' && 'dashboard-card--hero student-priority-card',
        variant === 'compact' && 'dashboard-card--compact student-compact-card',
        variant === 'stat' && 'dashboard-card--stat stat-card',
        variant === 'task' && 'dashboard-card--task',
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}
