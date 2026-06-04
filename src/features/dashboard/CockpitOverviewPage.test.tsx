import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../i18n/config';
import i18n from '../../i18n/config';
import { OverviewPage } from './CockpitOverviewPage';

const api = vi.hoisted(() => ({
  getActivityReviewQueue: vi.fn(),
  getInstructorDashboard: vi.fn(),
  getTenantDashboard: vi.fn(),
}));

const tenantState = vi.hoisted((): { activeTenant: Record<string, unknown> } => ({
  activeTenant: {
    id: 42,
    name: 'EduPro',
    role: 'instructor',
    featureFlags: {
      'attendance.enabled': true,
      'homework.enabled': true,
      'certificates.enabled': true,
    },
    permissions: {
      canEnterWorkspace: true,
      canTeachAssignedSessions: true,
      canViewAssignedCourses: true,
      canViewAssignedGroups: true,
      canManageAssignedAttendance: true,
      canManageAssignedHomework: true,
    },
  },
}));

const authState = vi.hoisted((): { user: Record<string, unknown> } => ({
  user: { id: 7, role: 'instructor', email: 'instructor@test.dev' },
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
    user: authState.user,
  }),
}));

vi.mock('../tenant/TenantProvider', () => ({
  useTenant: () => ({
    activeTenant: tenantState.activeTenant,
  }),
}));

vi.mock('./OverviewPage', () => ({
  OverviewPage: () => <div>Legacy overview</div>,
}));

const baseOverview = {
  generatedAt: '2026-06-03T00:00:00.000Z',
  workspace: {
    type: 'tenant',
    companyId: 42,
    role: 'instructor',
    permissions: {
      canManageMembers: false,
      canManageCertificates: false,
      canCreateCourses: false,
      canViewActivity: false,
    },
  },
  tenant: { id: 42, name: 'EduPro', timezone: 'Asia/Bishkek', locale: 'en', featureFlags: {}, branding: null },
  permissions: {
    canManageMembers: false,
    canManageCertificates: false,
    canCreateCourses: false,
    canViewActivity: false,
  },
  stats: {
    courses: 2,
    students: 16,
    activeGroups: 2,
    upcomingSessions: 1,
    homeworkNeedsReview: 0,
    certificatesPending: 0,
    unmarkedAttendance: 0,
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

describe('CockpitOverviewPage', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(async () => {
    await i18n.changeLanguage('en');
    vi.clearAllMocks();
    authState.user = { id: 7, role: 'instructor', email: 'instructor@test.dev' };
    tenantState.activeTenant = {
      id: 42,
      name: 'EduPro',
      role: 'instructor',
      featureFlags: {
        'attendance.enabled': true,
        'homework.enabled': true,
        'certificates.enabled': true,
      },
      permissions: {
        canEnterWorkspace: true,
        canTeachAssignedSessions: true,
        canViewAssignedCourses: true,
        canViewAssignedGroups: true,
        canManageAssignedAttendance: true,
        canManageAssignedHomework: true,
      },
    };
    api.getTenantDashboard.mockResolvedValue(baseOverview);
    api.getInstructorDashboard.mockResolvedValue({
      queues: {
        unmarkedAttendance: 0,
        homeworkNeedsReview: 0,
        activityNeedsReview: 0,
        upcomingWithoutMaterials: 0,
      },
      today: {
        sessions: [],
        nextSession: null,
      },
      upcomingSessions: [],
    });
    api.getActivityReviewQueue.mockResolvedValue({ summary: { needsReview: 0 }, items: [] });
  });

  it('shows the instructor cockpit for users who can teach assigned sessions', async () => {
    renderPage();

    expect(await screen.findByText("Today's teaching")).toBeInTheDocument();
    expect(screen.queryByText('Legacy overview')).not.toBeInTheDocument();
    expect(api.getInstructorDashboard).toHaveBeenCalledWith(42);
  });

  it('keeps assistant users on the existing operational overview', async () => {
    authState.user = { id: 8, role: 'assistant', email: 'assistant@test.dev' };
    tenantState.activeTenant = {
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
      },
    };
    api.getTenantDashboard.mockResolvedValue({
      ...baseOverview,
      workspace: {
        ...baseOverview.workspace,
        role: 'assistant',
      },
      permissions: {
        ...baseOverview.permissions,
        canViewStudentSupportContext: true,
        canSupportOperations: true,
      },
    });

    renderPage();

    expect(await screen.findByText('Legacy overview')).toBeInTheDocument();
    expect(screen.queryByText("Today's teaching")).not.toBeInTheDocument();
    expect(api.getInstructorDashboard).not.toHaveBeenCalled();
  });
});
