import { useEffect, useId, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { FiActivity, FiAlertTriangle, FiAward, FiBarChart2, FiBookOpen, FiTrendingUp, FiUsers } from 'react-icons/fi';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PageHeader } from '../../components/PageHeader';
import { StatGrid } from '../../components/StatGrid';
import { EmptyState, LoadingState } from '../../components/DataState';
import { getTenantDashboard, getTenantReportSummary, getTenantReportTimeSeries } from '../../services/api';
import type { TenantOverview, TenantReportPoint, TenantReportSummary, TenantReportTimeSeries } from '../../types/domain';
import { useTenant } from '../tenant/TenantProvider';

function statNumber(value: unknown) {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : 0;
}

function percentValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '-';
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? `${nextValue}%` : String(value);
}

function reportPeriodLabel(period: string) {
  return period?.slice(0, 7) || period;
}

function chartValue(row: TenantReportPoint, valueKey: 'count' | 'rate') {
  return Number(row[valueKey] ?? 0);
}

function ReportChartPanel({
  title,
  detail,
  rows,
  valueKey,
  variant = 'bar',
}: {
  title: string;
  detail: string;
  rows: TenantReportPoint[];
  valueKey?: 'count' | 'rate';
  variant?: 'bar' | 'area';
}) {
  const metricKey = valueKey ?? 'count';
  const chartId = useId().replace(/:/g, '');
  const gradientId = `report-area-${chartId}-${metricKey}`;
  const data = rows.slice(-12).map((row) => ({
    period: reportPeriodLabel(row.period),
    value: chartValue(row, metricKey),
  }));

  return (
    <section className="settings-panel report-chart-panel">
      <div className="section-heading-row">
        <div>
          <h2>{title}</h2>
          <span>{detail}</span>
        </div>
        <FiBarChart2 />
      </div>
      {data.length ? (
        <div className="report-chart-frame">
          <ResponsiveContainer width="100%" height={240}>
            {variant === 'area' ? (
              <AreaChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--brand-primary)" stopOpacity={0.38} />
                    <stop offset="95%" stopColor="var(--brand-primary)" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="period" tickLine={false} axisLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} domain={metricKey === 'rate' ? [0, 100] : undefined} />
                <Tooltip formatter={(value) => metricKey === 'rate' ? `${value}%` : value} contentStyle={{ borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)' }} />
                <Area type="monotone" dataKey="value" stroke="var(--brand-primary)" strokeWidth={2.5} fill={`url(#${gradientId})`} />
              </AreaChart>
            ) : (
              <BarChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="period" tickLine={false} axisLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                <Tooltip formatter={(value) => metricKey === 'rate' ? `${value}%` : value} contentStyle={{ borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)' }} />
                <Bar dataKey="value" fill="var(--brand-primary)" radius={[6, 6, 2, 2]} maxBarSize={42} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      ) : <EmptyState title={title} detail={detail} />}
    </section>
  );
}

export function ReportsPage() {
  const { t } = useTranslation();
  const { activeTenant } = useTenant();
  const activeTenantId = activeTenant?.id;
  const [overview, setOverview] = useState<TenantOverview | null>(null);
  const [reportSummary, setReportSummary] = useState<TenantReportSummary | null>(null);
  const [timeSeries, setTimeSeries] = useState<TenantReportTimeSeries | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setOverview(null);
    setReportSummary(null);
    setTimeSeries(null);
    if (!activeTenantId) return;
    let cancelled = false;
    setLoading(true);
    Promise.allSettled([
      getTenantDashboard(activeTenantId),
      getTenantReportSummary(activeTenantId),
      getTenantReportTimeSeries(activeTenantId),
    ])
      .then(([overviewResult, summaryResult, timeSeriesResult]) => {
        if (cancelled) return;
        if (overviewResult.status === 'fulfilled') setOverview(overviewResult.value);
        if (summaryResult.status === 'fulfilled') setReportSummary(summaryResult.value);
        if (timeSeriesResult.status === 'fulfilled') setTimeSeries(timeSeriesResult.value);
        if ([overviewResult, summaryResult, timeSeriesResult].some((result) => result.status === 'rejected')) {
          toast.error(t('reports.loadFailed'));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTenantId, t]);

  const summaryStats = useMemo(() => {
    if (!overview) return [];
    return [
      { label: t('reports.activeLearners'), value: statNumber(reportSummary?.summary.totalStudents ?? overview.stats.students), hint: t('overview.studentsHint') },
      { label: t('navigation.courses'), value: statNumber(reportSummary?.summary.totalCourses ?? overview.stats.courses), hint: t('overview.tenantCatalog') },
      { label: t('overview.activeGroupsLabel'), value: statNumber(overview.stats.activeGroups), hint: t('overview.activeGroupsHint') },
      { label: t('overview.attendanceRate'), value: percentValue(reportSummary?.summary.attendanceRate ?? overview.stats.attendanceRate), hint: t('reports.attendanceRateHint') },
    ];
  }, [overview, reportSummary, t]);

  const signalRows = useMemo(() => {
    if (!overview) return [];
    return [
      {
        icon: FiBookOpen,
        label: t('reports.coursePipeline'),
        value: t('reports.coursePipelineValue', {
          draft: statNumber(overview.stats.draftCourses),
          pending: statNumber(overview.stats.pendingCourses),
        }),
        detail: t('reports.coursePipelineDetail'),
      },
      {
        icon: FiActivity,
        label: t('reports.sessionHealth'),
        value: t('reports.sessionHealthValue', {
          today: overview.sessions.today,
          unmarked: overview.sessions.unmarkedAttendance,
          cancelled: overview.sessions.cancelled,
        }),
        detail: t('reports.sessionHealthDetail'),
      },
      {
        icon: FiAward,
        label: t('navigation.certificates'),
        value: t('reports.certificateValue', {
          pending: reportSummary?.summary.certificates?.pending ?? overview.certificates.pending,
          issued: reportSummary?.summary.certificates?.issued ?? overview.certificates.issued,
        }),
        detail: t('reports.certificateDetail', { count: overview.certificates.coursesWithoutConfig }),
      },
      {
        icon: FiAlertTriangle,
        label: t('reports.workspaceReadiness'),
        value: `${overview.setup.progress}%`,
        detail: t('reports.workspaceReadinessDetail'),
      },
    ];
  }, [overview, reportSummary, t]);

  if (!activeTenant) return <EmptyState title={t('overview.noTenantAssignedTitle')} detail={t('overview.noTenantAssignedDetail')} />;
  if (loading) return <LoadingState label={t('reports.loading')} />;
  if (!overview) return <EmptyState title={t('reports.unavailableTitle')} detail={t('reports.unavailableDetail')} />;

  return (
    <>
      <PageHeader
        title={t('reports.title')}
        eyebrow={activeTenant.name}
      />

      <StatGrid items={summaryStats} />

      <div className="settings-grid overview-lower-grid">
        <section className="settings-panel full">
          <div className="section-heading-row">
            <div>
              <h2>{t('reports.executiveSummary')}</h2>
              <span>{t('reports.dedicatedEndpointsDetail')}</span>
            </div>
            <FiBarChart2 />
          </div>
          <div className="stack-list">
            <article className="stack-list-item">
              <div>
                <strong>{t('reports.reportEndpointsActive')}</strong>
                <span>{t('reports.reportEndpointsActiveDetail')}</span>
              </div>
              <strong>{reportSummary?.generatedAt ? t('reports.generated') : t('reports.currentSnapshot')}</strong>
            </article>
          </div>
        </section>

        <ReportChartPanel
          title={t('reports.enrollmentTrend')}
          detail={t('reports.enrollmentTrendDetail')}
          rows={timeSeries?.series.enrollments ?? []}
        />

        <ReportChartPanel
          title={t('reports.attendanceTrend')}
          detail={t('reports.attendanceTrendDetail')}
          rows={timeSeries?.series.attendance ?? []}
          valueKey="rate"
          variant="area"
        />

        <ReportChartPanel
          title={t('reports.completionTrend')}
          detail={t('reports.completionTrendDetail')}
          rows={timeSeries?.series.completions ?? []}
        />

        <ReportChartPanel
          title={t('reports.certificateTrend')}
          detail={t('reports.certificateTrendDetail')}
          rows={timeSeries?.series.certificates ?? []}
        />

        <section className="settings-panel">
          <div className="section-heading-row">
            <div>
              <h2>{t('reports.operationalSignals')}</h2>
              <span>{t('reports.operationalSignalsDetail')}</span>
            </div>
            <FiTrendingUp />
          </div>
          <div className="stack-list">
            {signalRows.map((row) => {
              const Icon = row.icon;
              return (
                <article className="stack-list-item" key={row.label}>
                  <div>
                    <strong><Icon aria-hidden="true" /> {row.label}</strong>
                    <span>{row.detail}</span>
                  </div>
                  <strong>{row.value}</strong>
                </article>
              );
            })}
          </div>
        </section>

        <section className="settings-panel">
          <div className="section-heading-row">
            <div>
              <h2>{t('reports.analyticsNotes')}</h2>
              <span>{t('reports.analyticsNotesDetail')}</span>
            </div>
            <FiUsers />
          </div>
          <div className="definition-grid">
            <span>{t('overview.attendanceRate')}</span><strong>{percentValue(reportSummary?.summary.attendanceRate ?? overview.stats.attendanceRate)}</strong>
            <span>{t('reports.groupFillRate')}</span><strong>{percentValue(reportSummary?.summary.groupFillRate)}</strong>
            <span>{t('reports.dropoutRisk')}</span><strong>{reportSummary?.summary.dropoutRisk ? `${reportSummary.summary.dropoutRisk.high ?? 0} / ${reportSummary.summary.dropoutRisk.medium ?? 0} / ${reportSummary.summary.dropoutRisk.low ?? 0}` : t('states.notSet')}</strong>
          </div>
        </section>
      </div>
    </>
  );
}
