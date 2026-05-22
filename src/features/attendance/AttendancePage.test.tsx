import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../i18n/config';
import i18n from '../../i18n/config';
import { AttendancePage } from './AttendancePage';

const api = vi.hoisted(() => ({
  getSessionAttendance: vi.fn(),
  listCourseGroups: vi.fn(),
  listGroupSessions: vi.fn(),
  listGroupStudents: vi.fn(),
  listTenantCourses: vi.fn(),
  saveSessionAttendance: vi.fn(),
}));

const toast = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}));

const authState = vi.hoisted(() => ({
  user: { id: 7, role: 'company_admin', email: 'admin@test.dev' },
}));

const tenantState = vi.hoisted(() => ({
  activeTenant: {
    id: 42,
    name: 'EduPro',
    role: 'company_admin',
    permissions: {
      canManageCourses: true,
    },
  } as {
    id: number;
    name: string;
    role: string;
    permissions: Record<string, boolean>;
  },
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

const course = {
  id: 101,
  title: 'Live Math',
  courseType: 'online_live',
  status: 'approved',
  isPublished: true,
};

const otherCourse = {
  id: 102,
  title: 'Other Course',
  courseType: 'online_live',
  status: 'approved',
  isPublished: true,
};

const group = {
  id: 301,
  courseId: 101,
  name: 'Group A',
  deliveryMode: 'group',
};

const otherGroup = {
  id: 302,
  courseId: 101,
  name: 'Group B',
  deliveryMode: 'group',
};

const session = {
  id: 901,
  courseId: 101,
  groupId: 301,
  title: 'Lesson 1',
  startsAt: '2026-05-21T04:00:00.000Z',
  status: 'scheduled',
};

const otherSession = {
  id: 902,
  courseId: 101,
  groupId: 301,
  title: 'Lesson 2',
  startsAt: '2026-05-22T04:00:00.000Z',
  status: 'scheduled',
};

const students = [
  { id: 1, userId: 201, fullName: 'Aida Student', email: 'aida@example.test', progressPercent: 80 },
  { id: 2, userId: 202, fullName: 'Ben Student', email: 'ben@example.test', progressPercent: 40 },
];

function renderPage(initialEntry = '/attendance?courseId=101&groupId=301&sessionId=901') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <AttendancePage />
    </MemoryRouter>,
  );
}

describe('AttendancePage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    vi.clearAllMocks();
    authState.user = { id: 7, role: 'company_admin', email: 'admin@test.dev' };
    tenantState.activeTenant = {
      id: 42,
      name: 'EduPro',
      role: 'company_admin',
      permissions: {
        canManageCourses: true,
      },
    };
    api.listTenantCourses.mockResolvedValue([course]);
    api.listCourseGroups.mockResolvedValue([group]);
    api.listGroupSessions.mockResolvedValue([session]);
    api.listGroupStudents.mockResolvedValue(students);
    api.getSessionAttendance.mockResolvedValue([
      { id: 1, userId: 201, status: 'present', notes: '' },
      { id: 2, userId: 202, status: 'late', notes: '' },
    ]);
    api.saveSessionAttendance.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    cleanup();
  });

  it('saves only rows changed from the loaded attendance state', async () => {
    renderPage();

    const benStatus = await screen.findByLabelText('Attendance status for Ben Student');
    fireEvent.change(benStatus, {
      target: { value: 'absent' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save attendance' }));

    await waitFor(() => expect(api.saveSessionAttendance).toHaveBeenCalledTimes(1));
    expect(api.saveSessionAttendance).toHaveBeenCalledWith(901, [
      { studentId: 202, status: 'absent', notes: undefined },
    ]);
  });

  it('does not silently fall back when a deep-linked session is unavailable', async () => {
    renderPage('/attendance?courseId=101&groupId=301&sessionId=999');

    await screen.findByText('Session unavailable');

    expect(screen.queryByRole('button', { name: 'Save attendance' })).not.toBeInTheDocument();
    expect(api.getSessionAttendance).not.toHaveBeenCalled();
  });

  it('filters selectors to assigned sessions for assigned-only instructors', async () => {
    authState.user = { id: 8, role: 'instructor', email: 'teacher@test.dev' };
    tenantState.activeTenant = {
      id: 42,
      name: 'EduPro',
      role: 'instructor',
      permissions: {
        canManageAssignedAttendance: true,
        canTeachAssignedSessions: true,
      },
    };
    api.listTenantCourses.mockResolvedValue([course, otherCourse]);
    api.listCourseGroups.mockResolvedValue([group, otherGroup]);
    api.listGroupSessions.mockImplementation((groupId?: number) => {
      if (!groupId) return Promise.resolve([session]);
      return Promise.resolve([session, otherSession]);
    });

    renderPage();

    await screen.findByText('Aida Student');

    expect(screen.getByRole('option', { name: 'Live Math' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Other Course' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Group A' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Group B' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Lesson 1/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Lesson 2/ })).not.toBeInTheDocument();
  });
});
