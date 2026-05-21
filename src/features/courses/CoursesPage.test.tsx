import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../i18n/config';
import i18n from '../../i18n/config';
import { CoursesPage } from './CoursesPage';

const api = vi.hoisted(() => ({
  createTenantCourse: vi.fn(),
  deleteTenantCourse: vi.fn(),
  listCourseGroups: vi.fn(),
  listGroupSessions: vi.fn(),
  listGroupStudents: vi.fn(),
  listHomework: vi.fn(),
  listTenantCourses: vi.fn(),
  listTenantMembers: vi.fn(),
  publishTenantCourse: vi.fn(),
  updateCourseStatus: vi.fn(),
  updateTenantCourse: vi.fn(),
}));

const authState = vi.hoisted(() => ({
  user: { id: 7, role: 'company_admin', email: 'admin@test.dev', fullName: 'Admin User' },
}));

const tenantState = vi.hoisted(() => ({
  tenant: {
    id: 42,
    name: 'EduPro',
    role: 'company_admin',
    permissions: {
      canApproveCourses: true,
      canManageCourses: true,
    },
    featureFlags: {},
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
    user: authState.user,
  }),
}));

vi.mock('../tenant/TenantProvider', () => ({
  useTenant: () => ({
    activeTenant: tenantState.tenant,
  }),
}));

const approvedUnpublishedCourse = {
  id: 101,
  title: 'Live Math',
  description: 'Algebra basics',
  courseType: 'online_live',
  status: 'approved',
  isPublished: false,
  instructor: { id: 11, fullName: 'Aida Instructor' },
  groupCount: 0,
  sessionCount: 0,
};

const readyForGroupCourse = {
  ...approvedUnpublishedCourse,
  isPublished: true,
};

const instructorDraftCourse = {
  ...approvedUnpublishedCourse,
  status: 'draft',
  isPublished: false,
  instructor: { id: 7, fullName: 'Instructor User' },
};

const pendingCourse = {
  ...approvedUnpublishedCourse,
  status: 'pending',
  isPublished: false,
};

const instructorMember = {
  userId: 11,
  role: 'instructor',
  fullName: 'Aida Instructor',
  email: 'aida@example.test',
};

function renderPage() {
  return render(
    <MemoryRouter>
      <CoursesPage />
    </MemoryRouter>,
  );
}

function clickCreateCourse() {
  const button = screen.getAllByRole('button', { name: /create course/i }).find((item) => !item.hasAttribute('disabled'));
  if (!button) throw new Error('Create course button not found');
  fireEvent.click(button);
}

describe('CoursesPage course setup flow', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    vi.clearAllMocks();
    authState.user = { id: 7, role: 'company_admin', email: 'admin@test.dev', fullName: 'Admin User' };
    tenantState.tenant = {
      id: 42,
      name: 'EduPro',
      role: 'company_admin',
      permissions: {
        canApproveCourses: true,
        canManageCourses: true,
      },
      featureFlags: {},
    };
    api.listTenantCourses.mockResolvedValue([approvedUnpublishedCourse]);
    api.listTenantMembers.mockResolvedValue([instructorMember]);
    api.listCourseGroups.mockResolvedValue([]);
    api.listGroupSessions.mockResolvedValue([]);
    api.listGroupStudents.mockResolvedValue([]);
    api.listHomework.mockResolvedValue([]);
    api.publishTenantCourse.mockResolvedValue({ ...approvedUnpublishedCourse, isPublished: true });
    api.updateCourseStatus.mockResolvedValue({ success: true, status: 'approved' });
  });

  afterEach(() => {
    cleanup();
  });

  it('shows publish as the primary action for approved unpublished courses', async () => {
    renderPage();

    expect((await screen.findAllByText('Approved, not published')).length).toBeGreaterThan(0);
    expect(screen.getByRole('columnheader', { name: 'Readiness' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Published' })).not.toBeInTheDocument();
    const publishButtons = await screen.findAllByRole('button', { name: 'Publish course' });
    fireEvent.click(publishButtons[0]);

    await waitFor(() => expect(api.publishTenantCourse).toHaveBeenCalledWith(101));
  });

  it('keeps course health filters in a secondary admin diagnostics disclosure', async () => {
    renderPage();

    await screen.findByText('Approved, not published');
    const detail = screen.getByText('Admin diagnostics for larger catalogs.');
    const disclosure = detail.closest('details');

    expect(disclosure).not.toHaveAttribute('open');
    fireEvent.click(screen.getByText('Course health filters'));
    expect(disclosure).toHaveAttribute('open');
    expect(screen.getByRole('button', { name: /Approved unpublished 1/i })).toBeInTheDocument();
  });

  it('shows a checklist action to create the first group when a course is published', async () => {
    api.listTenantCourses.mockResolvedValue([readyForGroupCourse]);

    renderPage();

    expect((await screen.findAllByText('Create first group')).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /live math aida instructor/i }));
    const createGroupLinks = screen.getAllByRole('link', { name: 'Create group' });
    expect(createGroupLinks[0]).toHaveAttribute('href', '/groups?courseId=101');
  });

  it('keeps approve and reject together for pending admin review', async () => {
    api.listTenantCourses.mockResolvedValue([pendingCourse]);

    renderPage();

    expect((await screen.findAllByText('Pending approval')).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /live math aida instructor/i }));

    expect(screen.getAllByRole('button', { name: 'Approve and publish' }).length).toBeGreaterThan(0);
    expect(within(screen.getByLabelText('Review actions')).getByRole('button', { name: 'Reject' })).toBeInTheDocument();
  });

  it('explains the no-instructor state before course creation', async () => {
    api.listTenantCourses.mockResolvedValue([]);
    api.listTenantMembers.mockResolvedValue([]);

    renderPage();
    await screen.findByText('Set up your first course');
    expect(screen.getByText('Create the course')).toBeInTheDocument();
    expect(screen.getByText('Assign an instructor')).toBeInTheDocument();
    expect(screen.getByText('Approve and publish')).toBeInTheDocument();
    expect(screen.getByText('Create the first group')).toBeInTheDocument();
    expect(screen.getByText('Schedule the first session')).toBeInTheDocument();
    clickCreateCourse();

    expect(await screen.findByText('No instructors available.')).toBeInTheDocument();
    expect(screen.getByText('Add an instructor before creating a course.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Invite instructor' })).toHaveAttribute('href', '/members');
    expect(screen.getAllByRole('button', { name: /create course/i }).at(-1)).toBeDisabled();
  });

  it('does not offer course creation to instructors without create permission', async () => {
    authState.user = { id: 7, role: 'instructor', email: 'teacher@test.dev', fullName: 'Instructor User' };
    tenantState.tenant = {
      id: 42,
      name: 'EduPro',
      role: 'instructor',
      permissions: {
        canApproveCourses: false,
        canManageCourses: false,
      },
      featureFlags: {},
    };
    api.listTenantCourses.mockResolvedValue([]);
    api.listTenantMembers.mockResolvedValue([]);

    renderPage();

    await screen.findByText('Set up your first course');
    expect(screen.queryByRole('button', { name: /create course/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Create course draft')).not.toBeInTheDocument();
    expect(api.listTenantMembers).not.toHaveBeenCalled();
  });

  it('shows create validation errors before calling the API', async () => {
    renderPage();

    await screen.findByText('Approved, not published');
    clickCreateCourse();
    fireEvent.click(screen.getAllByRole('button', { name: /create course/i }).at(-1)!);

    expect(await screen.findByText('Course title is required.')).toBeInTheDocument();
    expect(screen.getByText('Add a short course description.')).toBeInTheDocument();
    expect(api.createTenantCourse).not.toHaveBeenCalled();
  });

  it('creates a course and selects it for setup', async () => {
    const createdCourse = {
      id: 202,
      title: 'Physics Live',
      description: 'Physics foundations',
      courseType: 'offline',
      status: 'draft',
      isPublished: false,
      instructor: { id: 11, fullName: 'Aida Instructor' },
      groupCount: 0,
      sessionCount: 0,
    };
    api.createTenantCourse.mockResolvedValue(createdCourse);

    renderPage();

    await screen.findByText('Approved, not published');
    clickCreateCourse();
    fireEvent.change(screen.getByPlaceholderText('Course title'), { target: { value: 'Physics Live' } });
    fireEvent.change(screen.getByPlaceholderText('Short description for staff and students'), { target: { value: 'Physics foundations' } });
    fireEvent.click(screen.getAllByRole('button', { name: /create course/i }).at(-1)!);

    await waitFor(() => expect(api.createTenantCourse).toHaveBeenCalledWith(42, {
      title: 'Physics Live',
      description: 'Physics foundations',
      courseType: 'offline',
      instructorId: 11,
    }));
    expect(await screen.findByRole('heading', { name: 'Physics Live' })).toBeInTheDocument();
    expect(screen.getAllByText('Approve and publish this course when the basics are ready.').length).toBeGreaterThan(0);
    expect(toast.success).toHaveBeenCalledWith('Course created');
  });

  it('keeps instructor-created courses self-assigned and focused on approval', async () => {
    authState.user = { id: 7, role: 'instructor', email: 'teacher@test.dev', fullName: 'Instructor User' };
    tenantState.tenant = {
      id: 42,
      name: 'EduPro',
      role: 'instructor',
      permissions: {
        canApproveCourses: false,
        canManageCourses: true,
      },
      featureFlags: {},
    };
    api.listTenantCourses.mockResolvedValue([instructorDraftCourse]);
    api.listTenantMembers.mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText('Setup in progress')).toBeInTheDocument();
    expect(screen.queryByLabelText('Course health filters')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /live math instructor user/i }));
    expect(screen.getAllByRole('button', { name: 'Submit for approval' }).length).toBeGreaterThan(0);

    clickCreateCourse();

    expect(await screen.findByText('Create course draft')).toBeInTheDocument();
    expect(screen.getByText(/assigned to you/i)).toBeInTheDocument();
    const instructorSelect = screen.getByLabelText('Instructor');
    expect(instructorSelect).toHaveValue('7');
    expect(instructorSelect).toBeDisabled();
    expect(screen.getAllByRole('button', { name: /create course/i }).at(-1)).not.toBeDisabled();
  });
});
