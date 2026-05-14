import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../i18n/config';
import { ReportsPage } from './ReportsPage';

const api = vi.hoisted(() => ({
  getTenantDashboard: vi.fn(),
  getTenantReportSummary: vi.fn(),
  getTenantReportTimeSeries: vi.fn(),
}));

const toast = vi.hoisted(() => ({
  error: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  default: toast,
}));

vi.mock('recharts', () => ({
  Area: () => null,
  AreaChart: () => <div />,
  Bar: () => null,
  BarChart: () => <div />,
  CartesianGrid: () => null,
  ResponsiveContainer: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

vi.mock('../../services/api', () => api);

vi.mock('../tenant/TenantProvider', () => ({
  useTenant: () => ({ activeTenant: { id: 42, name: 'Tenant A', featureFlags: {} } }),
}));

const overview = {
  stats: {
    courses: 3,
    students: 12,
    activeGroups: 2,
    draftCourses: 1,
    pendingCourses: 1,
    attendanceRate: 88,
  },
  sessions: {
    today: 1,
    upcoming: 2,
    unmarkedAttendance: 0,
    cancelled: 0,
  },
  homework: {
    needsReview: 0,
    overdue: 0,
  },
  certificates: {
    pending: 1,
    issued: 4,
    rejected: 0,
    revoked: 0,
    eligibleWaiting: 0,
    coursesWithoutConfig: 1,
  },
  setup: {
    progress: 75,
    items: [],
  },
  activity: [],
};

describe('ReportsPage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    vi.clearAllMocks();
    api.getTenantDashboard.mockResolvedValue(overview);
    api.getTenantReportSummary.mockRejectedValue(new Error('summary failed'));
    api.getTenantReportTimeSeries.mockResolvedValue({
      generatedAt: '2026-05-14T00:00:00.000Z',
      series: {
        enrollments: [{ period: '2026-05-01', count: 2 }],
        attendance: [{ period: '2026-05-01', rate: 88 }],
        completions: [],
        certificates: [],
      },
    });
  });

  it('keeps dashboard reports visible when one report endpoint fails', async () => {
    render(<ReportsPage />);

    expect(await screen.findByText('Reports')).toBeInTheDocument();
    expect(screen.getByText('Executive summary')).toBeInTheDocument();
    expect(screen.getByText('Current snapshot')).toBeInTheDocument();

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Could not load reports'));
    expect(api.getTenantDashboard).toHaveBeenCalledWith(42);
    expect(api.getTenantReportSummary).toHaveBeenCalledWith(42);
    expect(api.getTenantReportTimeSeries).toHaveBeenCalledWith(42);
  });
});
