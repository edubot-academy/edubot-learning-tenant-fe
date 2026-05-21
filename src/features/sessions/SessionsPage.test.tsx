import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../i18n/config';
import i18n from '../../i18n/config';
import { SessionsPage } from './SessionsPage';

const api = vi.hoisted(() => ({
  createCourseGroup: vi.fn(),
  createIndividualCourseGroup: vi.fn(),
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

const offlineCourse = {
  id: 103,
  title: 'Offline Math',
  courseType: 'offline',
  status: 'approved',
  isPublished: true,
};

const group = {
  id: 301,
  courseId: 101,
  name: 'Group A',
  status: 'active',
  deliveryMode: 'group',
  startDate: '2026-05-25',
  endDate: '2026-06-30',
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
    api.searchUsers.mockResolvedValue([]);
    api.createGroupSession.mockResolvedValue(createdSession);
    api.createIndividualCourseGroup.mockResolvedValue({
      group: { ...group, id: 302, name: 'Aida individual', deliveryMode: 'individual', seatLimit: 1 },
      enrollment: { id: 701 },
      firstSession: null,
    });
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

  it('prefills session creation from the selected group schedule', async () => {
    renderPage();

    await waitFor(() => expect(api.listCourseGroups).toHaveBeenCalledWith(101));

    const scheduleButton = screen
      .getAllByRole('button', { name: 'Schedule session' })
      .find((button) => !button.hasAttribute('disabled'));
    if (!scheduleButton) throw new Error('Enabled schedule session button not found');
    fireEvent.click(scheduleButton);

    expect(await screen.findByLabelText('Title')).toHaveValue('Session 1');
    expect(screen.getByLabelText('Starts')).toHaveValue('2026-05-25T10:00');
    expect(screen.getByLabelText('Ends')).toHaveValue('2026-05-25T11:00');
  });

  it('shows inline validation when group end date is before start date', async () => {
    renderPage();

    await waitFor(() => expect(api.listCourseGroups).toHaveBeenCalledWith(101));

    const createGroupButton = screen
      .getAllByRole('button', { name: 'Create group' })
      .find((button) => !button.hasAttribute('disabled'));
    if (!createGroupButton) throw new Error('Enabled create group button not found');
    fireEvent.click(createGroupButton);

    await screen.findByRole('heading', { name: 'Create group' });
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Bad dates' } });
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-05-20' } });
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-05-18' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Create group' }).at(-1)!);

    expect(await screen.findByText('End date must be after the start date')).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith('End date must be after the start date');
    expect(api.createCourseGroup).not.toHaveBeenCalled();
  });

  it('prevents duplicate group creation submissions from the sessions modal', async () => {
    api.createCourseGroup.mockResolvedValueOnce({
      id: 401,
      courseId: 101,
      name: 'Weekend group',
      status: 'planned',
      deliveryMode: 'group',
    });
    api.listCourseGroups
      .mockResolvedValueOnce([group])
      .mockResolvedValueOnce([{ id: 401, courseId: 101, name: 'Weekend group', status: 'planned', deliveryMode: 'group' }]);

    renderPage();

    await waitFor(() => expect(api.listCourseGroups).toHaveBeenCalledWith(101));

    const createGroupButton = screen
      .getAllByRole('button', { name: 'Create group' })
      .find((button) => !button.hasAttribute('disabled'));
    if (!createGroupButton) throw new Error('Enabled create group button not found');
    fireEvent.click(createGroupButton);

    await screen.findByRole('heading', { name: 'Create group' });
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Weekend group' } });

    const submitButton = screen.getAllByRole('button', { name: 'Create group' }).at(-1)!;
    fireEvent.click(submitButton);
    fireEvent.click(submitButton);

    await waitFor(() => expect(api.createCourseGroup).toHaveBeenCalledTimes(1));
  });

  it('hides meeting fields and omits them from offline group creation', async () => {
    api.listTenantCourses.mockResolvedValue([offlineCourse]);
    api.listCourseGroups.mockResolvedValue([]);
    api.createCourseGroup.mockResolvedValue({ id: 401, courseId: 103, name: 'Offline group' });

    renderPage();

    await waitFor(() => expect(api.listCourseGroups).toHaveBeenCalledWith(103));

    const createGroupButton = screen
      .getAllByRole('button', { name: 'Create group' })
      .find((button) => !button.hasAttribute('disabled'));
    if (!createGroupButton) throw new Error('Enabled create group button not found');
    fireEvent.click(createGroupButton);

    await screen.findByRole('heading', { name: 'Create group' });
    expect(screen.queryByLabelText('Meeting provider')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Meeting URL')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Offline group' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Create group' }).at(-1)!);

    await waitFor(() => expect(api.createCourseGroup).toHaveBeenCalled());
    expect(api.createCourseGroup.mock.calls[0][0]).not.toHaveProperty('meetingProvider');
    expect(api.createCourseGroup.mock.calls[0][0]).not.toHaveProperty('meetingUrl');
  });

  it('creates an individual group with a new student from the sessions modal', async () => {
    api.inviteTenantMember.mockResolvedValueOnce({
      userId: 202,
      role: 'student',
      fullName: 'Aida Student',
      email: 'aida@example.test',
      onboarding: { emailSent: false },
    });
    api.listCourseGroups
      .mockResolvedValueOnce([group])
      .mockResolvedValueOnce([{ ...group, id: 302, name: 'Aida individual', deliveryMode: 'individual', seatLimit: 1 }]);

    renderPage();

    await waitFor(() => expect(api.listCourseGroups).toHaveBeenCalledWith(101));

    const createGroupButton = screen
      .getAllByRole('button', { name: 'Create group' })
      .find((button) => !button.hasAttribute('disabled'));
    if (!createGroupButton) throw new Error('Enabled create group button not found');
    fireEvent.click(createGroupButton);

    await screen.findByRole('heading', { name: 'Create group' });
    fireEvent.click(screen.getByRole('button', { name: 'Individual' }));
    fireEvent.click(screen.getByRole('button', { name: 'New student' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Aida individual' } });
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Aida Student' } });
    fireEvent.change(screen.getByPlaceholderText('student@example.com'), { target: { value: 'aida@example.test' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Create group' }).at(-1)!);

    await waitFor(() => expect(api.inviteTenantMember).toHaveBeenCalledWith(42, expect.objectContaining({
      fullName: 'Aida Student',
      email: 'aida@example.test',
      role: 'student',
    })));
    expect(api.createIndividualCourseGroup).toHaveBeenCalledWith(expect.objectContaining({
      courseId: 101,
      studentId: 202,
      name: 'Aida individual',
    }));
  });

  it('shows inline validation for invalid edit group dates', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText('Group A')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Edit group' }));

    await screen.findByRole('heading', { name: 'Edit group' });
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-05-20' } });
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-05-18' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save group' }));

    expect(await screen.findByText('End date must be after the start date')).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith('End date must be after the start date');
    expect(api.updateCourseGroup).not.toHaveBeenCalled();
  });
});
