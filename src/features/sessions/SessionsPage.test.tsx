import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../i18n/config';
import i18n from '../../i18n/config';
import { SessionsPage } from './SessionsPage';

type TestTenant = {
  id: number;
  name: string;
  role: string;
  permissions: Record<string, boolean>;
};

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
  removeUserFromGroup: vi.fn(),
  reviewSessionActivitySubmission: vi.fn(),
  searchUsers: vi.fn(),
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

const tenantState = vi.hoisted((): { activeTenant: TestTenant } => ({
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

const offlineCourse = {
  id: 103,
  title: 'Offline Math',
  courseType: 'offline',
  status: 'approved',
  isPublished: true,
};

const unpublishedCourse = {
  id: 104,
  title: 'Draft Math',
  courseType: 'online_live',
  status: 'approved',
  isPublished: false,
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

function renderPage(initialRoute = '/') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <SessionsPage />
    </MemoryRouter>,
  );
}

describe('SessionsPage session creation', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    vi.clearAllMocks();
    tenantState.activeTenant = {
      id: 42,
      name: 'EduPro',
      role: 'company_admin',
      permissions: {
        canCoordinateGroups: true,
        canEnrollStudents: true,
        canManageCourses: true,
      },
    };
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

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
    const scheduleButton = screen
      .getAllByRole('button', { name: 'Schedule session' })
      .find((button) => !button.hasAttribute('disabled'));
    if (!scheduleButton) throw new Error('Enabled schedule session button not found');
    fireEvent.click(scheduleButton);

    fireEvent.change(await screen.findByLabelText('Title'), { target: { value: 'Lesson 1' } });
    fireEvent.change(screen.getByLabelText('Starts'), { target: { value: '2026-05-21T10:00' } });
    fireEvent.change(screen.getByLabelText('Ends'), { target: { value: '2026-05-21T11:00' } });
    const submitButton = screen.getAllByRole('button', { name: 'Schedule session' }).at(-1)!;
    fireEvent.click(submitButton);
    fireEvent.submit(submitButton.closest('form')!);

    await waitFor(() => expect(api.createGroupSession).toHaveBeenCalledTimes(1));
    expect(api.listGroupSessions).toHaveBeenCalledTimes(1);
    expect(api.listGroupStudents).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getAllByText('Lesson 1').length).toBeGreaterThan(0));
    expect(api.getSessionAttendance).not.toHaveBeenCalled();
    expect(api.listSessionHomework).not.toHaveBeenCalled();
    expect(api.getSessionInsights).not.toHaveBeenCalled();
    expect(api.getLiveMeeting).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Plan Meeting and materials/ }));

    expect(api.getSessionInsights).not.toHaveBeenCalled();
  });

  it('prefills session creation from the selected group schedule', async () => {
    renderPage();

    await waitFor(() => expect(api.listCourseGroups).toHaveBeenCalledWith(101));

    let scheduleButton: HTMLElement | undefined;
    await waitFor(() => {
      scheduleButton = screen
        .getAllByRole('button', { name: 'Schedule session' })
        .find((button) => !button.hasAttribute('disabled'));
      expect(scheduleButton).toBeDefined();
    });
    fireEvent.click(scheduleButton!);

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

  it('clears stale generation preview when generation dates change', async () => {
    api.previewGeneratedSessions.mockResolvedValue({
      total: 1,
      newCount: 1,
      existingCount: 0,
      items: [{
        kind: 'new',
        sessionIndex: 1,
        title: 'Session 1',
        startsAt: '2026-05-25T04:00:00.000Z',
        endsAt: '2026-05-25T05:00:00.000Z',
        day: 'mon',
      }],
    });

    renderPage();

    await waitFor(() => expect(screen.getByText('Group A')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Preview' })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    await waitFor(() => expect(api.previewGeneratedSessions).toHaveBeenCalledWith(301, {
      fromDate: '2026-05-25',
      toDate: '2026-06-30',
    }));
    await waitFor(() => expect(screen.getAllByText('New').length).toBeGreaterThan(0));
    expect(screen.getByRole('button', { name: 'Generate' })).not.toBeDisabled();

    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-07-15' } });

    expect(screen.queryAllByText('New')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Generate' })).toBeDisabled();
  });

  it('links session operations directly to attendance and homework with selected scope', async () => {
    api.listGroupSessions.mockResolvedValueOnce([{
      ...createdSession,
      materials: [{ title: 'Deck', url: 'https://files.example.test/deck.pdf' }],
      activities: [{ id: 77, title: 'Warmup', type: 'discussion', status: 'planned' }],
      liveJoinUrl: 'https://meet.example.test/lesson-1',
    }]);

    renderPage('/sessions?courseId=101&groupId=301&sessionId=901');

    await waitFor(() => expect(api.getSessionAttendance).toHaveBeenCalledWith(901));
    await waitFor(() => expect(api.listSessionHomework).toHaveBeenCalledWith(901));

    const attendanceLinks = await screen.findAllByRole('link', { name: 'Attendance' });
    const homeworkLinks = await screen.findAllByRole('link', { name: 'Homework' });

    expect(attendanceLinks.some((link) => link.getAttribute('href') === '/attendance?courseId=101&groupId=301&sessionId=901')).toBe(true);
    expect(homeworkLinks.some((link) => link.getAttribute('href') === '/homework?courseId=101&groupId=301&sessionId=901')).toBe(true);
    expect(screen.getByRole('button', { name: /Plan Meeting and materials/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Run Activities and attendance/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Review Homework and insights/ })).toHaveAttribute(
      'href',
      '/homework?courseId=101&groupId=301&sessionId=901',
    );
  });

  it('warns before editing a session with attendance or homework records', async () => {
    api.listGroupSessions.mockResolvedValueOnce([createdSession]);
    api.getSessionAttendance.mockResolvedValueOnce([{ id: 1, studentId: 202, status: 'present' }]);
    api.listSessionHomework.mockResolvedValueOnce([{ id: 11, title: 'Practice', status: 'published' }]);
    api.updateGroupSession.mockResolvedValueOnce({ ...createdSession, startsAt: '2026-05-21T04:30:00.000Z' });

    renderPage('/sessions?courseId=101&groupId=301&sessionId=901');

    await waitFor(() => expect(api.getSessionAttendance).toHaveBeenCalledWith(901));
    fireEvent.click(await screen.findByRole('button', { name: 'Edit session' }));

    expect(screen.getByText('This session already has delivery records')).toBeInTheDocument();
    expect(screen.getByText('Changing date, time, or status can affect already recorded attendance and homework follow-up.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Starts'), { target: { value: '2026-05-21T10:30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save session' }));

    expect(await screen.findByText('Confirm the delivery-record impact before saving.')).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith('Confirm the delivery-record impact before saving.');
    expect(api.updateGroupSession).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('checkbox', { name: /I understand this change may affect attendance and homework records/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save session' }));

    await waitFor(() => expect(api.updateGroupSession).toHaveBeenCalledWith(901, expect.objectContaining({
      startsAt: new Date('2026-05-21T10:30').toISOString(),
    })));
  });

  it('hides attendance and homework handoffs when the role cannot manage those workflows', async () => {
    tenantState.activeTenant = {
      id: 42,
      name: 'EduPro',
      role: 'company_admin',
      permissions: {
        canCoordinateGroups: true,
        canEnrollStudents: true,
        canManageCourses: false,
        canManageAssignedAttendance: false,
        canManageAssignedHomework: false,
      },
    };
    api.listGroupSessions.mockResolvedValueOnce([createdSession]);

    renderPage('/sessions?courseId=101&groupId=301&sessionId=901');

    await waitFor(() => expect(screen.getByText('Lesson 1')).toBeInTheDocument());

    expect(api.getSessionAttendance).not.toHaveBeenCalled();
    expect(api.listSessionHomework).not.toHaveBeenCalled();
    expect(screen.queryByRole('link', { name: 'Attendance' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Homework' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Run Activities/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Review Insights/ })).toBeInTheDocument();
  });

  it('falls back to overview copy when plan tools are not available', async () => {
    tenantState.activeTenant = {
      id: 42,
      name: 'EduPro',
      role: 'company_admin',
      permissions: {
        canCoordinateGroups: false,
        canEnrollStudents: false,
        canManageCourses: false,
        canManageAssignedActivities: true,
        canManageAssignedLiveMeetings: false,
        canManageAssignedMaterials: false,
      },
    };
    api.listGroupSessions.mockResolvedValueOnce([createdSession]);

    renderPage('/sessions?courseId=101&groupId=301&sessionId=901');

    expect(await screen.findByRole('button', { name: /Plan Session overview/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Plan Meeting and materials/ })).not.toBeInTheDocument();
  });

  it('lets assigned instructors schedule sessions without group or enrollment controls', async () => {
    tenantState.activeTenant = {
      id: 42,
      name: 'EduPro',
      role: 'instructor',
      permissions: {
        canTeachAssignedSessions: true,
        canCoordinateGroups: false,
        canEnrollStudents: false,
        canManageCourses: false,
      },
    };

    renderPage('/sessions?courseId=101&groupId=301');

    await waitFor(() => expect(api.listCourseGroups).toHaveBeenCalledWith(101));
    await waitFor(() => expect(screen.getByRole('option', { name: 'Group A - Assigned group' })).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Create group' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enroll student' })).not.toBeInTheDocument();

    await waitFor(() => expect(api.listGroupSessions).toHaveBeenCalledWith(301));
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(screen.getByText('No sessions scheduled')).toBeInTheDocument();
    });
    const scheduleButton = screen
      .getAllByRole('button', { name: 'Schedule session' })
      .find((button) => !button.hasAttribute('disabled'));
    if (!scheduleButton) throw new Error('Enabled schedule session button not found');
    fireEvent.click(scheduleButton!);
    await screen.findByRole('heading', { name: 'Schedule session' });

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Instructor-led session' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Schedule session' }).at(-1)!);

    await waitFor(() => expect(api.createGroupSession).toHaveBeenCalledWith(expect.objectContaining({
      groupId: 301,
      title: 'Instructor-led session',
      status: 'scheduled',
    })));
  });

  it('creates quiz activities with multiple questions and additional answer options', async () => {
    api.listGroupSessions.mockResolvedValue([{ ...createdSession, activities: [] }]);
    api.createSessionActivity.mockResolvedValueOnce([]);

    renderPage('/sessions?courseId=101&groupId=301&sessionId=901');

    await waitFor(() => expect(screen.getAllByText('Lesson 1').length).toBeGreaterThan(0));
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('tab', { name: 'Activities' }));
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Activities' })).toHaveAttribute('aria-selected', 'true'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add activity' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Add activity' }));

    await screen.findByRole('heading', { name: 'Add activity' });
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Quick check' } });
    fireEvent.click(screen.getByRole('button', { name: 'Quiz' }));
    fireEvent.change(screen.getByLabelText('Question 1 prompt'), { target: { value: 'Which answer is correct?' } });
    fireEvent.change(screen.getByLabelText('Question 1 option A'), { target: { value: 'First answer' } });
    fireEvent.change(screen.getByLabelText('Question 1 option B'), { target: { value: 'Second answer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add option to question 1' }));
    fireEvent.change(screen.getByLabelText('Question 1 option C'), { target: { value: 'Third answer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Question 1 correct answer C' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add question' }));
    fireEvent.change(screen.getByLabelText('Question 2 prompt'), { target: { value: 'Which second answer is correct?' } });
    fireEvent.change(screen.getByLabelText('Question 2 option A'), { target: { value: 'Second question A' } });
    fireEvent.change(screen.getByLabelText('Question 2 option B'), { target: { value: 'Second question B' } });
    fireEvent.click(screen.getByRole('button', { name: 'Question 2 correct answer B' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Add activity' }).at(-1)!);

    await waitFor(() => expect(api.createSessionActivity).toHaveBeenCalledWith(901, expect.objectContaining({
      title: 'Quick check',
      type: 'quiz',
      questions: [
        {
          prompt: 'Which answer is correct?',
          questionMode: 'single_choice',
          options: [
            { text: 'First answer', isCorrect: false },
            { text: 'Second answer', isCorrect: false },
            { text: 'Third answer', isCorrect: true },
          ],
        },
        {
          prompt: 'Which second answer is correct?',
          questionMode: 'single_choice',
          options: [
            { text: 'Second question A', isCorrect: false },
            { text: 'Second question B', isCorrect: true },
          ],
        },
      ],
    })));
  });

  it('limits instructor course choices to published courses with assigned groups', async () => {
    tenantState.activeTenant = {
      id: 42,
      name: 'EduPro',
      role: 'instructor',
      permissions: {
        canTeachAssignedSessions: true,
        canCoordinateGroups: false,
        canEnrollStudents: false,
        canManageCourses: false,
      },
    };
    api.listTenantCourses.mockResolvedValueOnce([unpublishedCourse, course, offlineCourse]);
    api.listCourseGroups
      .mockResolvedValueOnce([group])
      .mockResolvedValueOnce([]);

    renderPage();

    await waitFor(() => expect(api.listCourseGroups).toHaveBeenCalledWith(101));
    await waitFor(() => expect(screen.getByRole('option', { name: 'Live Math' })).toBeInTheDocument());

    expect(api.listCourseGroups).not.toHaveBeenCalledWith(104);
    expect(screen.queryByRole('option', { name: /Draft Math/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Offline Math/ })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('option', { name: 'Group A - Assigned group' })).toBeInTheDocument());
  });

  it('does not load detail APIs for a fallback session while a requested session is pending', async () => {
    api.listGroupSessions.mockResolvedValueOnce([{
      ...createdSession,
      id: 166,
      title: 'Older session',
    }]);

    renderPage('/sessions?courseId=101&groupId=301&sessionId=173');

    await waitFor(() => expect(screen.getByText('Older session')).toBeInTheDocument());

    expect(api.getSessionAttendance).not.toHaveBeenCalledWith(166);
    expect(api.listSessionHomework).not.toHaveBeenCalledWith(166);
    expect(api.getSessionInsights).not.toHaveBeenCalledWith(166);
    expect(api.getLiveMeeting).not.toHaveBeenCalledWith(166);
  });

  it('does not reload detail APIs for the previous session while selecting a newly created session', async () => {
    const previousSession = {
      ...createdSession,
      id: 166,
      title: 'Existing session',
    };
    const nextCreatedSession = {
      ...createdSession,
      id: 174,
      title: 'New session',
      sessionIndex: 2,
    };
    api.listGroupSessions.mockResolvedValueOnce([previousSession]);
    api.createGroupSession.mockResolvedValueOnce(nextCreatedSession);

    renderPage('/sessions?courseId=101&groupId=301&sessionId=166');

    await waitFor(() => expect(api.getSessionInsights).toHaveBeenCalledWith(166));
    vi.clearAllMocks();
    api.createGroupSession.mockResolvedValueOnce(nextCreatedSession);

    const scheduleButton = screen
      .getAllByRole('button', { name: 'Schedule session' })
      .find((button) => !button.hasAttribute('disabled'));
    if (!scheduleButton) throw new Error('Enabled schedule session button not found');
    fireEvent.click(scheduleButton);

    fireEvent.change(await screen.findByLabelText('Title'), { target: { value: 'New session' } });
    fireEvent.change(screen.getByLabelText('Starts'), { target: { value: '2026-05-28T10:00' } });
    fireEvent.change(screen.getByLabelText('Ends'), { target: { value: '2026-05-28T11:00' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Schedule session' }).at(-1)!);

    await waitFor(() => expect(api.createGroupSession).toHaveBeenCalledTimes(1));
    expect(api.getSessionAttendance).not.toHaveBeenCalledWith(166);
    expect(api.listSessionHomework).not.toHaveBeenCalledWith(166);
    expect(api.getSessionInsights).not.toHaveBeenCalledWith(166);
    expect(api.getLiveMeeting).not.toHaveBeenCalledWith(166);
    expect(api.getSessionAttendance).not.toHaveBeenCalledWith(174);
    expect(api.listSessionHomework).not.toHaveBeenCalledWith(174);
    expect(api.getSessionInsights).not.toHaveBeenCalledWith(174);
    expect(api.getLiveMeeting).not.toHaveBeenCalledWith(174);
  });

  it('shows a specific empty state when instructors have no assigned groups', async () => {
    tenantState.activeTenant = {
      id: 42,
      name: 'EduPro',
      role: 'instructor',
      permissions: {
        canTeachAssignedSessions: true,
        canCoordinateGroups: false,
        canEnrollStudents: false,
        canManageCourses: false,
      },
    };
    api.listCourseGroups.mockResolvedValueOnce([]);

    renderPage('/sessions?courseId=101');

    expect(await screen.findByText('No ready assigned groups')).toBeInTheDocument();
    expect(screen.getByText('Ask an admin or assistant to assign you to a published course group before scheduling sessions.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Schedule session' })).not.toBeInTheDocument();
  });
});
