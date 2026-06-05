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

const context = vi.hoisted(() => ({
  user: { id: 7, role: 'assistant', email: 'assistant@test.dev' },
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
}));

vi.mock('react-hot-toast', () => ({
  default: toast,
}));

vi.mock('../../services/api', () => api);

vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({
    user: context.user,
  }),
}));

vi.mock('../tenant/TenantProvider', () => ({
  useTenant: () => ({
    activeTenant: context.activeTenant,
  }),
}));

const baseTenant = {
  id: 42,
  name: 'EduPro',
  timezone: 'Asia/Bishkek',
  locale: 'en',
  featureFlags: {},
  branding: null,
};

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
  tenant: baseTenant,
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

const instructorOverview = {
  ...assistantOverview,
  workspace: {
    ...assistantOverview.workspace,
    role: 'instructor',
    permissions: {
      canManageMembers: false,
      canManageCertificates: true,
      canCreateCourses: true,
      canViewActivity: true,
      canTeachAssignedSessions: true,
      canManageAssignedHomework: true,
      canManageAssignedActivities: true,
      canManageAssignedMaterials: true,
    },
  },
  permissions: {
    canManageMembers: false,
    canManageCertificates: true,
    canCreateCourses: true,
    canViewActivity: true,
    canTeachAssignedSessions: true,
    canManageAssignedHomework: true,
    canManageAssignedActivities: true,
    canManageAssignedMaterials: true,
  },
  stats: {
    ...assistantOverview.stats,
    students: 18,
    homeworkNeedsReview: 2,
    attendanceRate: 92,
    certificatesPending: 1,
  },
  courses: [
    {
      id: 1,
      title: 'Frontend Basics',
      courseType: 'offline',
      status: 'published',
      enrolledStudents: 18,
      instructor: { fullName: 'Bekten' },
    },
  ],
  sessions: {
    upcoming: [
      {
        id: 11,
        title: 'React practice',
        startsAt: '2026-06-06T10:00:00.000Z',
        status: 'scheduled',
        courseTitle: 'Frontend Basics',
        groupName: 'Group A',
      },
    ],
    today: 1,
    unmarkedAttendance: 1,
    cancelled: 0,
  },
  homework: {
    summary: { total: 2, needsReview: 2, needsRevision: 0, missing: 0, overdue: 0 },
    queue: [
      {
        id: 5,
        title: 'Build a card layout',
        courseTitle: 'Frontend Basics',
        groupName: 'Group A',
        deadline: '2026-06-07T10:00:00.000Z',
        isPublished: true,
        queue: { needsReview: 2, needsRevision: 0, missing: 0 },
      },
    ],
  },
  certificates: {
    pending: 1,
    issued: 3,
    rejected: 0,
    revoked: 0,
    configuredCourses: 1,
    coursesWithoutConfig: 0,
    eligibleWaiting: 2,
    waiting: 2,
  },
  activity: [
    {
      id: 'activity-1',
      action: 'submitted',
      targetType: 'homework',
      targetId: '5',
      actorFullName: 'Aida Student',
      actorEmail: 'aida@test.dev',
      metadata: { title: 'Build a card layout' },
      createdAt: '2026-06-05T09:00:00.000Z',
    },
  ],
};

const instructorDashboard = {
  generatedAt: '2026-06-05T09:00:00.000Z',
  instructor: { id: 7, fullName: 'Instructor', email: 'instructor@test.dev' },
  tenant: baseTenant,
  permissions: instructorOverview.permissions,
  queues: {
    unmarkedAttendance: 1,
    homeworkNeedsReview: 2,
    activityNeedsReview: 1,
    upcomingWithoutMaterials: 1,
  },
  today: {
    sessions: [
      {
        id: 11,
        title: 'React practice',
        startsAt: '2026-06-06T10:00:00.000Z',
        status: 'scheduled',
        courseTitle: 'Frontend Basics',
        groupName: 'Group A',
      },
    ],
    nextSession: {
      id: 11,
      title: 'React practice',
      startsAt: '2026-06-06T10:00:00.000Z',
      status: 'scheduled',
      courseTitle: 'Frontend Basics',
      groupName: 'Group A',
    },
  },
  upcomingSessions: [
    {
      id: 12,
      title: 'Homework review',
      startsAt: '2026-06-07T10:00:00.000Z',
      status: 'scheduled',
      courseTitle: 'Frontend Basics',
      groupName: 'Group A',
    },
  ],
  attentionStudents: [
    {
      studentId: 77,
      fullName: 'Aida Student',
      groupId: 3,
      groupName: 'Group A',
      severity: 'high',
      reasons: [
        { code: 'missing_homework', label: 'Missing homework', route: '/homework' },
      ],
    },
  ],
};

function renderPage() {
  return render(
    <MemoryRouter>
      <OverviewPage />
    </MemoryRouter>,
  );
}

function setAssistantContext() {
  context.user = { id: 7, role: 'assistant', email: 'assistant@test.dev' };
  context.activeTenant = {
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
  };
}

function setInstructorContext() {
  context.user = { id: 7, role: 'instructor', email: 'instructor@test.dev' };
  context.activeTenant = {
    id: 42,
    name: 'EduPro',
    role: 'instructor',
    featureFlags: {
      'attendance.enabled': true,
      'homework.enabled': true,
      'certificates.enabled': true,
      'activities.enabled': true,
      'announcements.enabled': true,
      'challenges.enabled': true,
    },
    permissions: {
      canEnterWorkspace: true,
      canTeachAssignedSessions: true,
      canViewAssignedCourses: true,
      canViewAssignedGroups: true,
      canManageAssignedAttendance: true,
      canManageAssignedHomework: true,
      canManageAssignedActivities: true,
      canManageAssignedMaterials: true,
      canApproveAssignedCertificates: true,
    },
  };
}

describe('OverviewPage', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(async () => {
    await i18n.changeLanguage('en');
    vi.clearAllMocks();
    setAssistantContext();
    api.getTenantDashboard.mockResolvedValue(assistantOverview);
    api.getInstructorDashboard.mockResolvedValue(null);
    api.getActivityReviewQueue.mockResolvedValue({ summary: { needsReview: 0 }, items: [] });
    api.getTenantReportTimeSeries.mockResolvedValue(null);
  });

  it('uses workspace role from dashboard responses for assistant overview', async () => {
    renderPage();

    expect(await screen.findByText('Assistant overview')).toBeInTheDocument();
    expect(screen.getAllByText('Support').length).toBeGreaterThan(0);
    expect(screen.queryByText('Instructor overview')).not.toBeInTheDocument();
    expect(api.getInstructorDashboard).not.toHaveBeenCalled();
  });

  it('renders extracted instructor learning overview for instructor workspaces', async () => {
    setInstructorContext();
    api.getTenantDashboard.mockResolvedValue(instructorOverview);
    api.getInstructorDashboard.mockResolvedValue(instructorDashboard);
    api.getActivityReviewQueue.mockResolvedValue({ summary: { needsReview: 1 }, items: [] });

    renderPage();

    expect(await screen.findByText('Instructor overview')).toBeInTheDocument();
    expect(await screen.findByText('Кутман күн, инструктор! 👋')).toBeInTheDocument();
    expect(screen.getAllByText('Aida Student').length).toBeGreaterThan(0);
    expect(screen.queryByText('Leaderboard needs data model')).not.toBeInTheDocument();
    expect(screen.getAllByText('Build a card layout').length).toBeGreaterThan(0);
    expect(api.getInstructorDashboard).toHaveBeenCalledWith(42);
    expect(screen.queryByText('Assistant overview')).not.toBeInTheDocument();
  });
});
