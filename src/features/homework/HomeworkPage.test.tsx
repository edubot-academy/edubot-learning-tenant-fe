import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../i18n/config';
import i18n from '../../i18n/config';
import { HomeworkPage } from './HomeworkPage';

const api = vi.hoisted(() => ({
  createSessionHomework: vi.fn(),
  deleteSessionHomework: vi.fn(),
  getHomeworkReviewQueue: vi.fn(),
  getHomeworkReviewRoster: vi.fn(),
  getHomeworkSummary: vi.fn(),
  listCourseGroups: vi.fn(),
  listGroupSessions: vi.fn(),
  listGroupStudents: vi.fn(),
  listHomework: vi.fn(),
  listSessionHomework: vi.fn(),
  listTenantCourses: vi.fn(),
  openHomeworkSubmissionAttachment: vi.fn(),
  reviewHomeworkSubmission: vi.fn(),
  updateSessionHomework: vi.fn(),
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

function renderPage(initialEntry = '/homework?courseId=101&groupId=301&sessionId=901') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <HomeworkPage />
    </MemoryRouter>,
  );
}

describe('HomeworkPage', () => {
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
    api.listGroupStudents.mockResolvedValue([{ id: 1, userId: 201, fullName: 'Aida Student', email: 'aida@example.test' }]);
    api.listSessionHomework.mockResolvedValue([]);
    api.getHomeworkSummary.mockResolvedValue({ total: 0, needsReview: 0, missing: 0, overdue: 0 });
    api.getHomeworkReviewQueue.mockResolvedValue({
      items: [],
      summary: { total: 0, needsReview: 0, missing: 0, needsRevision: 0, late: 0, actionRequired: 0 },
    });
    api.listHomework.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  it('does not silently fall back when a deep-linked session is unavailable', async () => {
    renderPage('/homework?courseId=101&groupId=301&sessionId=999');

    await screen.findByText('Session unavailable');

    expect(api.listSessionHomework).not.toHaveBeenCalled();
    expect(screen.queryByText('Lesson 1 · May 21, 10:00 AM')).not.toBeInTheDocument();
  });

  it('filters selectors to assigned sessions for assigned-only instructors', async () => {
    authState.user = { id: 8, role: 'instructor', email: 'teacher@test.dev' };
    tenantState.activeTenant = {
      id: 42,
      name: 'EduPro',
      role: 'instructor',
      permissions: {
        canManageAssignedHomework: true,
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

    await waitFor(() => expect(api.listGroupStudents).toHaveBeenCalledWith(301));

    expect(screen.getByRole('option', { name: 'Live Math' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Other Course' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Group A' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Group B' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Lesson 1/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Lesson 2/ })).not.toBeInTheDocument();
  });

  it('prefers a session with homework when opening a group-level homework link', async () => {
    api.listGroupSessions.mockResolvedValue([session, otherSession]);
    api.listHomework.mockResolvedValue([{
      id: 501,
      sessionId: 902,
      courseId: 101,
      groupId: 301,
      title: 'Owner visible homework',
      isPublished: true,
    }]);
    api.listSessionHomework.mockImplementation((sessionId: number) => (
      Promise.resolve(sessionId === 902 ? [{
        id: 501,
        sessionId: 902,
        courseId: 101,
        groupId: 301,
        title: 'Owner visible homework',
        isPublished: true,
      }] : [])
    ));
    api.getHomeworkReviewRoster.mockResolvedValue({
      items: [],
      summary: { total: 0, needsReview: 0, missing: 0, needsRevision: 0, late: 0 },
    });

    renderPage('/homework?courseId=101&groupId=301');

    expect(await screen.findByText('Owner visible homework')).toBeInTheDocument();
    await waitFor(() => expect(api.listSessionHomework).toHaveBeenLastCalledWith(902));
  });

  it('clears stale dependent params when switching course from a deep link', async () => {
    api.listTenantCourses.mockResolvedValue([course, otherCourse]);
    api.listCourseGroups.mockImplementation((courseId: number) => (
      Promise.resolve(courseId === 102 ? [otherGroup] : [group])
    ));
    api.listGroupSessions.mockImplementation((groupId?: number) => (
      Promise.resolve(groupId === 302 ? [otherSession] : [session])
    ));

    renderPage('/homework?courseId=101&groupId=999&sessionId=999&homeworkId=999');

    await screen.findByText('Group unavailable');
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: '102' } });

    await waitFor(() => expect(api.listCourseGroups).toHaveBeenCalledWith(102));
    expect(screen.queryByText('Group unavailable')).not.toBeInTheDocument();
  });
});
