import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../i18n/config';
import i18n from '../../i18n/config';
import { OverviewPage } from './OverviewPage';

const api = vi.hoisted(() => ({
  getActivityReviewQueue: vi.fn(),
  getInstructorDashboard: vi.fn(),
  getTenantDashboard: vi.fn(),
  getTenantReportTimeSeries: vi.fn(),
}));

const toast = vi.hoisted(() => ({
  error: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  default: toast,
}));

vi.mock('../../services/api', () => api);

vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({
    user: { id: 7, role: 'assistant', email: 'assistant@test.dev' },
  }),
}));

vi.mock('../tenant/TenantProvider', () => ({
  useTenant: () => ({
    activeTenant: {
      id: 42,
      name: 'EduPro',
      role: 'assistant',
      featureFlags: {
        'attendance.enabled': true,
        'homework.enabled': true,
        'certificates.enabled': true,
      },
      permissions: {
        canEnterWorkspace: true,
        canSupportOperations: true,
        canViewOperationalCourses: true,
        canViewOperationalGroups: true,
        canViewOperationalSessions: true,
        canViewStudentSupportContext: true,
        canViewOperationalReports: true,
        canEscalateOperationalIssues: true,
        canManageStudentSupportNotes: true,
        canContactStudents: true,
        canViewGuardianContext: true,
        canContactGuardians: false,
        canCoordinateGroups: true,
        canEnrollStudents: true,
      },
    },
  }),
}));

const assistantOverview = {
  generatedAt: '2026-05-14T00:00:00.000Z',
  workspace: {
    type: 'tenant',
    companyId: 42,
    role: 'assistant',
    permissions: {
      canManageMembers: false,
      canManageCertificates: false,
      canCreateCourses: false,
      canViewActivity: false,
      canSupportOperations: true,
      canViewStudentSupportContext: true,
    },
  },
  tenant: { id: 42, name: 'EduPro', timezone: 'Asia/Bishkek', locale: 'en', featureFlags: {}, branding: null },
  permissions: {
    canManageMembers: false,
    canManageCertificates: false,
    canCreateCourses: false,
    canViewActivity: false,
    canSupportOperations: true,
    canViewStudentSupportContext: true,
  },
  stats: {
    courses: 3,
    students: 12,
    activeGroups: 2,
    upcomingSessions: 1,
    homeworkNeedsReview: 0,
    certificatesPending: 0,
  },
  courses: [],
  sessions: {
    upcoming: [],
    today: 0,
    unmarkedAttendance: 0,
    cancelled: 0,
  },
  homework: { summary: { needsReview: 0, missing: 0 }, queue: [] },
  certificates: {
    pending: 0,
    issued: 0,
    rejected: 0,
    revoked: 0,
    configuredCourses: 0,
    coursesWithoutConfig: 0,
    eligibleWaiting: 0,
  },
  setup: { progress: 100, items: [] },
  features: [],
  activity: [],
};

function renderPage() {
  return render(
    <MemoryRouter>
      <OverviewPage />
    </MemoryRouter>,
  );
}

describe('OverviewPage', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(async () => {
    await i18n.changeLanguage('en');
    vi.clearAllMocks();
    api.getTenantDashboard.mockResolvedValue(assistantOverview);
    api.getInstructorDashboard.mockResolvedValue(null);
    api.getActivityReviewQueue.mockResolvedValue(null);
    api.getTenantReportTimeSeries.mockResolvedValue(null);
  });

  it('uses workspace role from dashboard responses for assistant overview', async () => {
    renderPage();

    expect(await screen.findByText('Assistant overview')).toBeInTheDocument();
    expect(screen.getAllByText('Support').length).toBeGreaterThan(0);
    expect(screen.queryByText('Instructor overview')).not.toBeInTheDocument();
    expect(api.getInstructorDashboard).not.toHaveBeenCalled();
  });
});
