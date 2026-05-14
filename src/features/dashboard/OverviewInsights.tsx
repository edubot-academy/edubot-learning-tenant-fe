import { useId } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
import type { TenantReportPoint, TenantReportTimeSeries } from '../../types/domain';

export type OverviewWorkloadPoint = {
  label: string;
  value: number;
};

type InsightState = 'ready' | 'loading' | 'error';

function reportPeriodLabel(period: string) {
  return period?.slice(0, 7) || period;
}

function pointValue(point: TenantReportPoint, key: 'count' | 'rate') {
  return Number(point[key] ?? 0);
}

function OverviewMiniTrend({
  title,
  detail,
  rows,
  valueKey = 'count',
}: {
  title: string;
  detail: string;
  rows: TenantReportPoint[];
  valueKey?: 'count' | 'rate';
}) {
  const chartId = useId().replace(/:/g, '');
  const gradientId = `overview-trend-${chartId}-${valueKey}`;
  const data = rows.slice(-6).map((row) => ({
    period: reportPeriodLabel(row.period),
    value: pointValue(row, valueKey),
  }));

  return (
    <section className="settings-panel overview-insight-panel">
      <div className="section-heading-row compact">
        <div>
          <h2>{title}</h2>
          <span>{detail}</span>
        </div>
      </div>
      {data.length ? (
        <div className="overview-mini-chart">
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={data} margin={{ top: 8, right: 6, bottom: 0, left: -24 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--brand-primary)" stopOpacity={0.32} />
                  <stop offset="95%" stopColor="var(--brand-primary)" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="period" tickLine={false} axisLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} domain={valueKey === 'rate' ? [0, 100] : undefined} />
              <Tooltip
                formatter={(value) => valueKey === 'rate' ? `${value}%` : value}
                contentStyle={{ borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)' }}
              />
              <Area type="monotone" dataKey="value" stroke="var(--brand-primary)" strokeWidth={2.25} fill={`url(#${gradientId})`} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="overview-insight-empty">{detail}</div>
      )}
    </section>
  );
}

function OverviewWorkloadChart({
  title,
  detail,
  data,
}: {
  title: string;
  detail: string;
  data: OverviewWorkloadPoint[];
}) {
  return (
    <section className="settings-panel overview-insight-panel">
      <div className="section-heading-row compact">
        <div>
          <h2>{title}</h2>
          <span>{detail}</span>
        </div>
      </div>
      <div className="overview-mini-chart">
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={data} margin={{ top: 8, right: 6, bottom: 0, left: -24 }}>
            <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
            <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)' }} />
            <Bar dataKey="value" fill="var(--brand-primary)" radius={[6, 6, 2, 2]} maxBarSize={34} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function OverviewSetupRing({ progress, label }: { progress: number; label: string }) {
  return (
    <section className="settings-panel overview-insight-panel overview-ring-panel">
      <div className="overview-progress-ring" style={{ '--progress': `${Math.max(0, Math.min(100, progress))}%` } as CSSProperties}>
        <strong>{progress}%</strong>
        <span>{label}</span>
      </div>
    </section>
  );
}

function trendState(insightsLoading: boolean, insightsError: boolean): InsightState {
  if (insightsLoading) return 'loading';
  if (insightsError) return 'error';
  return 'ready';
}

export default function OverviewInsights({
  timeSeries,
  workloadChartData,
  setupProgress,
  insightsLoading,
  insightsError,
}: {
  timeSeries: TenantReportTimeSeries | null;
  workloadChartData: OverviewWorkloadPoint[];
  setupProgress: number;
  insightsLoading: boolean;
  insightsError: boolean;
}) {
  const { t } = useTranslation();
  const state = trendState(insightsLoading, insightsError);
  const trendDetail = state === 'loading'
    ? t('overview.insightsLoading')
    : state === 'error'
      ? t('overview.insightsUnavailable')
      : undefined;

  return (
    <section className="overview-insights-section" aria-label={t('overview.operationalInsights')}>
      <div className="section-heading-row">
        <div>
          <h2>{t('overview.operationalInsights')}</h2>
          <span>{t('overview.operationalInsightsDetail')}</span>
        </div>
        <Link className="link-button" to="/reports">{t('navigation.reports')}</Link>
      </div>
      <div className="overview-insight-grid">
        <OverviewMiniTrend
          title={t('reports.enrollmentTrend')}
          detail={trendDetail ?? t('overview.noEnrollmentTrend')}
          rows={timeSeries?.series.enrollments ?? []}
        />
        <OverviewMiniTrend
          title={t('overview.attendanceTrend')}
          detail={trendDetail ?? t('overview.noAttendanceTrend')}
          rows={timeSeries?.series.attendance ?? []}
          valueKey="rate"
        />
        <OverviewWorkloadChart
          title={t('overview.workloadBreakdown')}
          detail={t('overview.workloadBreakdownDetail')}
          data={workloadChartData}
        />
        <OverviewSetupRing
          progress={setupProgress}
          label={t('overview.setupProgress')}
        />
      </div>
    </section>
  );
}
