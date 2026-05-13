import { FiAlertCircle, FiInbox, FiLoader } from 'react-icons/fi';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export function LoadingState({ label }: { label?: string }) {
  const { t } = useTranslation();
  return (
    <div className="state-panel loading-state" role="status" aria-live="polite">
      <FiLoader aria-hidden="true" />
      <strong>{label ?? t('states.loading')}</strong>
      <span>{t('states.loadingDetail')}</span>
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

export function ErrorState({ message, action }: { message: string; action?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="state-panel error-state" role="alert">
      <FiAlertCircle aria-hidden="true" />
      <strong>{t('states.somethingWentWrong')}</strong>
      <span>{message}</span>
      {action ? <div className="state-panel-action">{action}</div> : null}
    </div>
  );
}
