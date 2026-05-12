import { FiAlertCircle, FiInbox, FiLoader } from 'react-icons/fi';
import type { ReactNode } from 'react';

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="state-panel loading-state" role="status" aria-live="polite">
      <FiLoader aria-hidden="true" />
      <strong>{label}</strong>
      <span>Preparing the latest workspace data.</span>
    </div>
  );
}

export function EmptyState({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="state-panel">
      <FiInbox aria-hidden="true" />
      <strong>{title}</strong>
      {detail ? <span>{detail}</span> : null}
      {action ? <div className="state-panel-action">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="state-panel error-state" role="alert">
      <FiAlertCircle aria-hidden="true" />
      <strong>Something went wrong</strong>
      <span>{message}</span>
    </div>
  );
}
