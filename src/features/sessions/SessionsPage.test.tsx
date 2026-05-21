import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../i18n/config';
import i18n from '../../i18n/config';
import { SessionsPage } from './SessionsPage';

const api = vi.hoisted(() => ({
  createCourseGroup: vi.fn(),
  createGroupSession: vi.fn(),
  createLiveMeeting: vi.fn(),
  createSessionActivity: vi.fn(),
  deleteLiveMeeting: vi.fn(),
  deleteSessionActivity: vi.fn(),
  enrollUser: vi.fn(),
  generateGroupSessions: vi.fn(),
  getLiveMeeting: vi.fn(),
  getSessionActivityResponses: vi.fn(),
  getSessionAttendance: vi.fn(),
  getSessionInsights: vi.fn(),
  inviteTenantMember: vi.fn(),
  listCourseGroups: vi.fn(),
  listGroupSessions: vi.fn(),
  listGroupStudents: vi.fn(),
  listSessionHomework: vi.fn(),
  listTenantCourses: vi.fn(),
  listTenantMembers: vi.fn(),
  previewGeneratedSessions: vi.fn(),
  reviewSessionActivitySubmission: vi.fn(),
  searchUsers: vi.fn(),
  unenrollUser: vi.fn(),
  updateCourseGroup: vi.fn(),
  updateGroupSession: vi.fn(),
  updateLiveMeeting: vi.fn(),
  updateSessionActivity: vi.fn(),
  uploadSessionMaterial: vi.fn(),
}));

const toast = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  default: toast,
}));

vi.mock('../../services/api', () => api);

vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({
    user: { id: 7, role: 'company_admin', email: 'admin@test.dev' },
  }),
}));

vi.mock('../tenant/TenantProvider', () => ({
  useTenant: () => ({
    activeTenant: {
      id: 42,
      name: 'EduPro',
      role: 'company_admin',
      permissions: {
        canCoordinateGroups: true,
        canEnrollStudents: true,
        canManageCourses: true,
      },
    },
  }),
}));

const course = {
  id: 101,
  title: 'Live Math',
  courseType: 'online_live',
  status: 'approved',
  isPublished: true,
};

const group = {
  id: 301,
  courseId: 101,
  name: 'Group A',
  status: 'active',
  deliveryMode: 'group',
  scheduleBlocks: [{ day: 'mon', startTime: '10:00', endTime: '11:00' }],
};

const createdSession = {
  id: 901,
  courseId: 101,
  groupId: 301,
  title: 'Lesson 1',
  sessionIndex: 1,
  startsAt: '2026-05-21T04:00:00.000Z',
  endsAt: '2026-05-21T05:00:00.000Z',
  status: 'scheduled',
};

function renderPage() {
  return render(
    <MemoryRouter>
      <SessionsPage />
    </MemoryRouter>,
  );
}

describe('SessionsPage session creation', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    vi.clearAllMocks();
    api.listTenantCourses.mockResolvedValue([course]);
    api.listCourseGroups.mockResolvedValue([group]);
    api.listGroupSessions.mockResolvedValue([]);
    api.listGroupStudents.mockResolvedValue([]);
    api.listTenantMembers.mockResolvedValue([]);
    api.createGroupSession.mockResolvedValue(createdSession);
    api.getSessionAttendance.mockResolvedValue([]);
    api.listSessionHomework.mockResolvedValue([]);
    api.getSessionInsights.mockResolvedValue(null);
    api.getLiveMeeting.mockRejectedValue({ response: { status: 404 } });
  });

  afterEach(() => {
    cleanup();
  });

  it('adds a created session locally instead of refetching the session roster', async () => {
    renderPage();

    await waitFor(() => expect(api.listGroupSessions).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(api.listGroupStudents).toHaveBeenCalledTimes(1));

    const scheduleButton = screen
      .getAllByRole('button', { name: 'Schedule session' })
      .find((button) => !button.hasAttribute('disabled'));
    if (!scheduleButton) throw new Error('Enabled schedule session button not found');
    fireEvent.click(scheduleButton);

    fireEvent.change(await screen.findByLabelText('Title'), { target: { value: 'Lesson 1' } });
    fireEvent.change(screen.getByLabelText('Starts'), { target: { value: '2026-05-21T10:00' } });
    fireEvent.change(screen.getByLabelText('Ends'), { target: { value: '2026-05-21T11:00' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Schedule session' }).at(-1)!);

    await waitFor(() => expect(api.createGroupSession).toHaveBeenCalledTimes(1));
    expect(api.listGroupSessions).toHaveBeenCalledTimes(1);
    expect(api.listGroupStudents).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getAllByText('Lesson 1').length).toBeGreaterThan(0));
  });
});
