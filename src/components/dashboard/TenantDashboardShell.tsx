import type { ReactNode } from 'react';
import { cx } from './dashboardUtils';

type TenantDashboardShellVariant = 'default' | 'engagement';
type TenantDashboardShellTone = 'student' | 'instructor' | 'neutral';

type TenantDashboardShellProps = {
  children: ReactNode;
  variant?: TenantDashboardShellVariant;
  tone?: TenantDashboardShellTone;
  className?: string;
};

export function TenantDashboardShell({
  children,
  variant = 'default',
  tone = 'neutral',
  className,
}: TenantDashboardShellProps) {
  const isEngagement = variant === 'engagement';

  return (
    <div
      className={cx(
        'tenant-dashboard-shell',
        isEngagement && 'engagement-theme',
        isEngagement && tone === 'student' && 'engagement-theme--student',
        isEngagement && tone === 'instructor' && 'engagement-theme--instructor',
        className,
      )}
    >
      {children}
    </div>
  );
}
