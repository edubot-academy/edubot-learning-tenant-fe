import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from './dashboardUtils';

type DashboardButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon';
};

export function DashboardButton({
  children,
  variant = 'primary',
  className,
  type = 'button',
  ...props
}: DashboardButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        'dashboard-button',
        variant === 'primary' && 'primary-button',
        variant === 'secondary' && 'secondary-button',
        variant === 'ghost' && 'ghost-button',
        variant === 'danger' && 'danger-button',
        variant === 'icon' && 'icon-button',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
