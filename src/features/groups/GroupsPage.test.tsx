import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../i18n/config';
import i18n from '../../i18n/config';
import { GroupsPage } from './GroupsPage';

const api = vi.hoisted(() => ({
  createCourseGroup: vi.fn(),
  createIndividualCourseGroup: vi.fn(),
  enrollUser: vi.fn(),
  generateGroupSessions: vi.fn(),
  inviteTenantMember: vi.fn(),
  listCourseGroups: vi.fn(),
  listGroupSessions: vi.fn(),
  listGroupStudents: vi.fn(),
  listTenantCourses: vi.fn(),
  listTenantMembers: vi.fn(),
  previewGeneratedSessions: vi.fn(),
  searchUsers: vi.fn(),
  unenrollUser: vi.fn(),
  updateCourseGroup: vi.fn(),
}));

const tenantPermissions = vi.hoisted(() => ({
  current: {
    canCoordinateGroups: true,
    canEnrollStudents: true,
    canManageCourses: true,
    canManageMembers: true,
  },
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
      permissions: tenantPermissions.current,
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

const unpublishedCourse = {
  id: 102,
  title: 'Draft Math',
  courseType: 'online_live',
  status: 'approved',
  isPublished: false,
};

const individualGroup = {
  id: 301,
  courseId: 101,
  name: 'Live Math - Aida',
  code: 'IND-101-201',
  status: 'planned',
  deliveryMode: 'individual',
  seatLimit: 1,
};

const studentMember = {
  userId: 201,
  role: 'student',
  fullName: 'Aida Student',
  email: 'aida@example.test',
};

function renderPage() {
  return render(
    <MemoryRouter>
      <GroupsPage />
    </MemoryRouter>,
  );
}

async function selectCourse() {
  const courseTitle = await screen.findByText('Live Math');
  fireEvent.click(courseTitle.closest('button') as HTMLButtonElement);
  await waitFor(() => expect(api.listCourseGroups).toHaveBeenCalledWith(101));
  await waitFor(() => expect(getPrimaryCreateButton()).not.toBeDisabled());
}

function getPrimaryCreateButton() {
  const button = screen
    .getAllByRole('button', { name: /create group/i })
    .find((item) => item.className.includes('primary-button'));
  if (!button) throw new Error('Primary create group button not found');
  return button;
}

async function openCreateGroupModal() {
  fireEvent.click(getPrimaryCreateButton());
  await screen.findByRole('heading', { name: /create group/i });
}

describe('GroupsPage individual delivery', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    vi.clearAllMocks();
    tenantPermissions.current = {
      canCoordinateGroups: true,
      canEnrollStudents: true,
      canManageCourses: true,
      canManageMembers: true,
    };
    api.listTenantCourses.mockResolvedValue([course]);
    api.listTenantMembers.mockResolvedValue([studentMember]);
    api.listCourseGroups.mockResolvedValue([]);
    api.listGroupSessions.mockResolvedValue([]);
    api.listGroupStudents.mockResolvedValue([]);
    api.createIndividualCourseGroup.mockResolvedValue({ group: individualGroup, enrollment: { id: 701 }, firstSession: null });
  });

  afterEach(() => {
    cleanup();
  });

  it('locks capacity to one when creating an individual group', async () => {
    renderPage();
    await selectCourse();

    await openCreateGroupModal();
    fireEvent.click(screen.getByRole('button', { name: 'Individual' }));

    const seatLimit = screen.getByLabelText(/seat limit/i);
    expect(seatLimit).toHaveValue(1);
    expect(seatLimit).toBeDisabled();
  });

  it('shows only eligible courses in the course selector', async () => {
    api.listTenantCourses.mockResolvedValue([course, unpublishedCourse]);

    renderPage();

    expect(await screen.findByText('Live Math')).toBeInTheDocument();
    expect(screen.queryByText('Draft Math')).not.toBeInTheDocument();
  });

  it('keeps the groups page usable when tenant member loading is forbidden', async () => {
    api.listTenantMembers.mockRejectedValueOnce({ response: { status: 403 } });

    renderPage();

    expect(await screen.findByText('Live Math')).toBeInTheDocument();
    await waitFor(() => expect(api.listCourseGroups).toHaveBeenCalledWith(101));
  });

  it('hides individual delivery when enrollment permission is unavailable', async () => {
    tenantPermissions.current = {
      canCoordinateGroups: true,
      canEnrollStudents: false,
      canManageCourses: true,
      canManageMembers: true,
    };

    renderPage();
    await selectCourse();
    await openCreateGroupModal();

    expect(screen.getByRole('button', { name: 'Group' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Individual' })).not.toBeInTheDocument();
  });

  it('requires a selected student for the individual convenience flow', async () => {
    renderPage();
    await selectCourse();

    await openCreateGroupModal();
    fireEvent.click(screen.getByRole('button', { name: 'Individual' }));
    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'Aida individual' } });
    fireEvent.click(screen.getAllByRole('button', { name: /create group/i }).at(-1) as HTMLElement);

    expect(toast.error).toHaveBeenCalledWith('Select a student for the individual course');
    expect(api.createIndividualCourseGroup).not.toHaveBeenCalled();
  });

  it('requires schedule setup before creating the first individual session', async () => {
    renderPage();
    await selectCourse();

    await openCreateGroupModal();
    fireEvent.click(screen.getByRole('button', { name: 'Individual' }));
    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'Aida individual' } });
    fireEvent.change(screen.getByLabelText(/individual student/i), { target: { value: 'aida' } });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));

    const studentOption = await screen.findByRole('option', { name: /aida student/i });
    fireEvent.change(studentOption.closest('select') as HTMLSelectElement, { target: { value: '201' } });
    fireEvent.click(screen.getByLabelText(/create first session/i));
    fireEvent.click(screen.getAllByRole('button', { name: /create group/i }).at(-1) as HTMLElement);

    expect(toast.error).toHaveBeenCalledWith('Add a start date and one complete schedule block before creating the first session.');
    expect(api.createIndividualCourseGroup).not.toHaveBeenCalled();
  });

  it('searches individual students when pressing Enter in the create modal search field', async () => {
    renderPage();
    await selectCourse();

    await openCreateGroupModal();
    fireEvent.click(screen.getByRole('button', { name: 'Individual' }));
    fireEvent.change(screen.getByLabelText(/individual student/i), { target: { value: 'aida' } });
    fireEvent.keyDown(screen.getByLabelText(/individual student/i), { key: 'Enter' });

    expect(await screen.findByRole('option', { name: /aida student/i })).toBeInTheDocument();
    expect(api.searchUsers).not.toHaveBeenCalled();
    expect(api.createIndividualCourseGroup).not.toHaveBeenCalled();
  });

  it('shows an empty result message when individual student search has no matches', async () => {
    renderPage();
    await selectCourse();

    await openCreateGroupModal();
    fireEvent.click(screen.getByRole('button', { name: 'Individual' }));
    fireEvent.change(screen.getByLabelText(/individual student/i), { target: { value: 'missing' } });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));

    expect(await screen.findByText('No matching students found')).toBeInTheDocument();
  });

  it('sends createFirstSession and only supported individual fields', async () => {
    api.listCourseGroups
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([individualGroup]);

    renderPage();
    await selectCourse();

    await openCreateGroupModal();
    fireEvent.click(screen.getByRole('button', { name: 'Individual' }));
    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'Aida individual' } });
    fireEvent.change(screen.getByLabelText(/individual student/i), { target: { value: 'aida' } });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));

    const studentOption = await screen.findByRole('option', { name: /aida student/i });
    fireEvent.change(studentOption.closest('select') as HTMLSelectElement, { target: { value: '201' } });
    fireEvent.change(screen.getByLabelText(/start date/i), { target: { value: '2026-05-18' } });
    fireEvent.change(screen.getByLabelText(/starts/i), { target: { value: '10:00' } });
    fireEvent.change(screen.getByLabelText(/ends/i), { target: { value: '11:00' } });
    fireEvent.click(screen.getByLabelText(/create first session/i));
    fireEvent.click(screen.getAllByRole('button', { name: /create group/i }).at(-1) as HTMLElement);

    await waitFor(() => expect(api.createIndividualCourseGroup).toHaveBeenCalled());
    expect(api.createIndividualCourseGroup).toHaveBeenCalledWith(expect.objectContaining({
      courseId: 101,
      studentId: 201,
      name: 'Aida individual',
      startDate: '2026-05-18',
      createFirstSession: true,
      scheduleBlocks: [{ day: 'mon', startTime: '10:00', endTime: '11:00' }],
    }));
    expect(api.createIndividualCourseGroup.mock.calls[0][0]).not.toHaveProperty('code');
    expect(api.createIndividualCourseGroup.mock.calls[0][0]).not.toHaveProperty('status');
    expect(api.createIndividualCourseGroup.mock.calls[0][0]).not.toHaveProperty('scheduleNote');
  });

  it('shows individual badges in the group list', async () => {
    api.listCourseGroups.mockResolvedValue([individualGroup]);

    renderPage();
    await selectCourse();

    await waitFor(() => expect(screen.getAllByText('Live Math - Aida').length).toBeGreaterThan(0));
    expect(screen.getAllByText('Individual').length).toBeGreaterThan(0);
  });
});
