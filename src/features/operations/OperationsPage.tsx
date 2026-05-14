import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiArrowRight, FiAward, FiBookOpen, FiCalendar, FiCheckSquare, FiClipboard, FiUsers } from 'react-icons/fi';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState } from '../../components/DataState';
import { StatGrid } from '../../components/StatGrid';
import { getVisibleOperationalNavItems } from '../../components/appNavigation';
import { useAuth } from '../auth/AuthProvider';
import { useTenant } from '../tenant/TenantProvider';

const operationDetailKeys: Record<string, string> = {
  '/courses': 'operations.coursesDetail',
  '/groups': 'operations.groupsDetail',
  '/sessions': 'operations.sessionsDetail',
  '/attendance': 'operations.attendanceDetail',
  '/homework': 'operations.homeworkDetail',
  '/certificates': 'operations.certificatesDetail',
};

const operationMetricKeys: Record<string, string> = {
  '/courses': 'operations.courseMetric',
  '/groups': 'operations.groupMetric',
  '/sessions': 'operations.sessionMetric',
  '/attendance': 'operations.attendanceMetric',
  '/homework': 'operations.homeworkMetric',
  '/certificates': 'operations.certificateMetric',
};

const iconByRoute = {
  '/courses': FiBookOpen,
  '/groups': FiUsers,
  '/sessions': FiCalendar,
  '/attendance': FiCheckSquare,
  '/homework': FiClipboard,
  '/certificates': FiAward,
};

export function OperationsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { activeTenant } = useTenant();
  const operationItems = getVisibleOperationalNavItems(user, activeTenant);

  return (
    <>
      <PageHeader
        title={t('operations.title')}
        eyebrow={activeTenant?.name}
      />

      <StatGrid
        items={[
          {
            label: t('operations.availableTools'),
            value: operationItems.length,
            hint: t('operations.availableToolsHint'),
          },
          {
            label: t('operations.workspaceFlow'),
            value: t('operations.adminFlowValue'),
            hint: t('operations.workspaceFlowHint'),
          },
          {
            label: t('operations.deepLinks'),
            value: t('overview.enabled'),
            hint: t('operations.deepLinksHint'),
          },
        ]}
      />

      {operationItems.length ? (
        <section className="overview-action-grid" aria-label={t('operations.title')}>
          {operationItems.map((item) => {
            const Icon = iconByRoute[item.to as keyof typeof iconByRoute] ?? item.icon;
            return (
              <Link className="overview-action-card" to={item.to} key={item.to}>
                <span className="ui-icon-tile overview-action-icon"><Icon /></span>
                <div>
                  <strong>{t(item.labelKey)}</strong>
                  <span>{t(operationDetailKeys[item.to] ?? 'operations.defaultDetail')}</span>
                </div>
                <small className="status-badge published">
                  {t(operationMetricKeys[item.to] ?? 'operations.openTool')}
                  <FiArrowRight aria-hidden="true" />
                </small>
              </Link>
            );
          })}
        </section>
      ) : (
        <EmptyState
          title={t('operations.emptyTitle')}
          detail={t('operations.emptyDetail')}
        />
      )}
    </>
  );
}
