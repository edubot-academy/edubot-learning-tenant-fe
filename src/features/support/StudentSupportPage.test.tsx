import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../i18n/config';
import i18n from '../../i18n/config';
import { StudentSupportPage } from './StudentSupportPage';

const api = vi.hoisted(() => ({
  createStudentGuardian: vi.fn(),
  createStudentSupportNote: vi.fn(),
  getAssistantDashboard: vi.fn(),
  getAssistantSupport: vi.fn(),
  listCourseGroups: vi.fn(),
  listGroupStudents: vi.fn(),
  listStudentGuardians: vi.fn(),
  listStudentSupportNotes: vi.fn(),
  listTenantCourses: vi.fn(),
  updateStudentSupportNote: vi.fn(),
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
    user: { id: 7, role: 'assistant', email: 'assistant@test.dev' },
  }),
}));

vi.mock('../tenant/TenantProvider', () => ({
  useTenant: () => ({
    activeTenant: {
      id: 42,
      name: 'Tenant A',
      role: 'assistant',
      featureFlags: {},
      permissions: {
        canSupportOperations: true,
        canViewOperationalCourses: true,
        canViewOperationalGroups: true,
        canViewOperationalSessions: true,
        canViewStudentSupportContext: true,
        canEscalateOperationalIssues: true,
        canManageStudentSupportNotes: true,
        canContactStudents: true,
      },
    },
  }),
}));

const supportResponse = {
  items: [{
    studentId: 21,
    fullName: 'Aida Student',
    email: 'aida@test.dev',
    groupId: 31,
    groupName: 'Group A',
    courseId: 11,
    courseTitle: 'Operations 101',
    reasons: [{ code: 'missing_homework', count: 2, severity: 'medium' }],
    nextAction: 'Ask about blockers',
    guardianSummary: { hasGuardian: true, contactAllowed: false, preferredChannel: 'email' },
  }],
  total: 1,
  page: 1,
  limit: 25,
  totalPages: 1,
  summary: {
    studentsNeedingSupport: 1,
    pendingInvitations: 0,
    pendingEnrollments: 0,
    sessionsWithoutMeeting: 0,
  },
};

const dashboardResponse = {
  generatedAt: '2026-05-14T00:00:00.000Z',
  assistant: { id: 7, fullName: 'Assistant', email: 'assistant@test.dev' },
  tenant: { id: 42, name: 'Tenant A' },
  permissions: {},
  operations: {
    activeGroups: 1,
    upcomingSessions: 0,
    pendingEnrollments: 0,
    studentsNeedingSupport: 1,
    groupsWithoutInstructor: 0,
    sessionsWithoutMeeting: 0,
    pendingInvitations: 0,
    blockedItems: 1,
  },
  actionQueue: [],
  groups: [],
  studentSupportQueue: supportResponse.items,
};

function renderPage() {
  return render(
    <MemoryRouter>
      <StudentSupportPage />
    </MemoryRouter>,
  );
}

describe('StudentSupportPage', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(async () => {
    await i18n.changeLanguage('en');
    vi.clearAllMocks();
    api.getAssistantDashboard.mockResolvedValue(dashboardResponse);
    api.getAssistantSupport.mockResolvedValue(supportResponse);
    api.listTenantCourses.mockResolvedValue([]);
    api.listCourseGroups.mockResolvedValue([]);
    api.listGroupStudents.mockResolvedValue([]);
    api.listStudentSupportNotes.mockResolvedValue([]);
    api.listStudentGuardians.mockResolvedValue([]);
    api.createStudentSupportNote.mockResolvedValue({
      id: 101,
      companyId: 42,
      studentId: 21,
      category: 'general',
      priority: 'medium',
      status: 'open',
      ownerRole: 'assistant',
      note: 'Created note',
      nextAction: null,
      createdAt: '2026-05-14T00:00:00.000Z',
      updatedAt: '2026-05-14T00:00:00.000Z',
    });
    api.updateStudentSupportNote.mockResolvedValue({
      id: 77,
      companyId: 42,
      studentId: 21,
      category: 'general',
      priority: 'high',
      status: 'in_progress',
      ownerRole: 'assistant',
      note: 'Updated note',
      nextAction: 'Call tomorrow',
      createdAt: '2026-05-13T00:00:00.000Z',
      updatedAt: '2026-05-14T00:00:00.000Z',
    });
    api.createStudentGuardian.mockResolvedValue({
      id: 201,
      companyId: 42,
      studentId: 21,
      fullName: 'Parent One',
      relationship: 'Parent',
      email: 'parent@test.dev',
      phone: null,
      preferredChannel: 'email',
      canReceiveProgressUpdates: false,
      canReceiveAttendanceUpdates: false,
      canReceiveHomeworkUpdates: false,
      consentStatus: 'pending',
      notes: null,
      createdAt: '2026-05-14T00:00:00.000Z',
      updatedAt: '2026-05-14T00:00:00.000Z',
    });
  });

  it('renders backend support queue data and opens support details', async () => {
    api.listStudentSupportNotes.mockResolvedValue([{
      id: 77,
      companyId: 42,
      studentId: 21,
      category: 'general',
      priority: 'high',
      status: 'open',
      ownerRole: 'assistant',
      note: 'Needs personal follow-up',
      nextAction: 'Call tomorrow',
      createdAt: '2026-05-13T00:00:00.000Z',
      updatedAt: '2026-05-14T00:00:00.000Z',
    }]);
    api.listStudentGuardians.mockResolvedValue([{
      id: 201,
      companyId: 42,
      studentId: 21,
      fullName: 'Parent One',
      relationship: 'Parent',
      email: 'parent@test.dev',
      phone: null,
      preferredChannel: 'email',
      canReceiveProgressUpdates: false,
      canReceiveAttendanceUpdates: false,
      canReceiveHomeworkUpdates: false,
      consentStatus: 'pending',
      notes: 'Use email first',
      createdAt: '2026-05-14T00:00:00.000Z',
      updatedAt: '2026-05-14T00:00:00.000Z',
    }]);

    renderPage();

    expect(await screen.findAllByText('Aida Student')).toHaveLength(2);
    expect(screen.getAllByText('2 missing homework')).toHaveLength(2);
    expect(screen.getByText('Operations 101')).toBeInTheDocument();
    expect(api.listTenantCourses).not.toHaveBeenCalled();
    expect(api.listCourseGroups).not.toHaveBeenCalled();
    expect(api.listGroupStudents).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByRole('button', { name: /manage/i })[0]);

    expect(await screen.findByRole('dialog', { name: /aida student/i })).toBeInTheDocument();
    expect(await screen.findByText('Needs personal follow-up')).toBeInTheDocument();
    expect(await screen.findByText('Parent One')).toBeInTheDocument();
    expect(screen.getByText('Contact disabled')).toBeInTheDocument();
    expect(api.listStudentSupportNotes).toHaveBeenCalledWith(42, 21);
    expect(api.listStudentGuardians).toHaveBeenCalledWith(42, 21);
  });

  it('creates and updates support notes from the detail modal', async () => {
    api.listStudentSupportNotes.mockResolvedValue([{
      id: 77,
      companyId: 42,
      studentId: 21,
      category: 'general',
      priority: 'medium',
      status: 'open',
      ownerRole: 'assistant',
      note: 'Existing note',
      nextAction: 'Check homework',
      createdAt: '2026-05-13T00:00:00.000Z',
      updatedAt: '2026-05-13T00:00:00.000Z',
    }]);

    renderPage();
    await screen.findAllByText('Aida Student');
    fireEvent.click(screen.getAllByRole('button', { name: /manage/i })[0]);

    const noteField = await screen.findByPlaceholderText('Describe the student support context');
    fireEvent.change(noteField, { target: { value: 'Created note' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create note' }));

    await waitFor(() => expect(api.createStudentSupportNote).toHaveBeenCalledWith(42, expect.objectContaining({
      studentId: 21,
      note: 'Created note',
      priority: 'medium',
      ownerRole: 'assistant',
    })));
    expect(toast.success).toHaveBeenCalledWith('Support note created');

    const existingNote = await screen.findByText('Existing note');
    const existingNoteRow = existingNote.closest('article');
    expect(existingNoteRow).not.toBeNull();
    fireEvent.click(within(existingNoteRow as HTMLElement).getByRole('button', { name: /edit/i }));

    fireEvent.change(screen.getByPlaceholderText('Describe the student support context'), { target: { value: 'Updated note' } });
    fireEvent.change(screen.getByDisplayValue('Open'), { target: { value: 'in_progress' } });
    fireEvent.change(screen.getByDisplayValue('Medium'), { target: { value: 'high' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update note' }));

    await waitFor(() => expect(api.updateStudentSupportNote).toHaveBeenCalledWith(42, 77, expect.objectContaining({
      note: 'Updated note',
      status: 'in_progress',
      priority: 'high',
    })));
    expect(toast.success).toHaveBeenCalledWith('Support note updated');
  });

  it('adds guardian records while keeping guardian contact disabled', async () => {
    renderPage();
    await screen.findAllByText('Aida Student');
    fireEvent.click(screen.getAllByRole('button', { name: /manage/i })[0]);

    fireEvent.change(await screen.findByPlaceholderText('Full name'), { target: { value: 'Parent One' } });
    fireEvent.change(screen.getByPlaceholderText('Parent, guardian, relative'), { target: { value: 'Parent' } });
    fireEvent.change(screen.getByPlaceholderText('parent@example.com'), { target: { value: 'parent@test.dev' } });
    fireEvent.change(screen.getByDisplayValue('Not set'), { target: { value: 'email' } });
    fireEvent.click(screen.getByRole('button', { name: /add guardian/i }));

    await waitFor(() => expect(api.createStudentGuardian).toHaveBeenCalledWith(42, expect.objectContaining({
      studentId: 21,
      fullName: 'Parent One',
      relationship: 'Parent',
      email: 'parent@test.dev',
      preferredChannel: 'email',
    })));
    expect(await screen.findByText('Parent One')).toBeInTheDocument();
    expect(screen.getByText('Consent pending')).toBeInTheDocument();
    expect(screen.getByText('Contact disabled')).toBeInTheDocument();
  });

  it('paginates the backend support queue', async () => {
    api.getAssistantSupport.mockImplementation((_tenantId: number, params: { page: number; limit: number }) => Promise.resolve({
      ...supportResponse,
      items: [{
        ...supportResponse.items[0],
        studentId: params.page === 1 ? 21 : 22,
        fullName: params.page === 1 ? 'Aida Student' : 'Beka Student',
        email: params.page === 1 ? 'aida@test.dev' : 'beka@test.dev',
      }],
      total: 51,
      page: params.page,
      limit: params.limit,
      totalPages: 3,
      summary: {
        ...supportResponse.summary,
        studentsNeedingSupport: 51,
      },
    }));

    renderPage();

    expect(await screen.findByText('Page 1 of 3')).toBeInTheDocument();
    expect(api.getAssistantSupport).toHaveBeenCalledWith(42, { page: 1, limit: 25, status: 'all' });

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => expect(api.getAssistantSupport).toHaveBeenCalledWith(42, { page: 2, limit: 25, status: 'all' }));
    expect(await screen.findAllByText('Beka Student')).toHaveLength(2);
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));

    await waitFor(() => expect(api.getAssistantSupport).toHaveBeenCalledWith(42, { page: 1, limit: 25, status: 'all' }));
  });

  it('switches support filters by hiding unrelated sections', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Student support queue' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Group readiness' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Students' }));

    expect(screen.getByRole('heading', { name: 'Student support queue' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Group readiness' })).not.toBeInTheDocument();
    expect(screen.queryByText('No group setup issues')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Groups' }));

    expect(screen.queryByRole('heading', { name: 'Student support queue' })).not.toBeInTheDocument();
    expect(screen.queryByText('No student support issues')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Group readiness' })).toBeInTheDocument();
  });

  it('falls back to legacy roster loading only when backend support fails', async () => {
    api.getAssistantSupport.mockRejectedValue(new Error('support unavailable'));
    api.listTenantCourses.mockResolvedValue([{ id: 11, title: 'Operations 101' }]);
    api.listCourseGroups.mockResolvedValue([{
      id: 31,
      courseId: 11,
      name: 'Group A',
      instructorId: 7,
      meetingUrl: 'https://meet.test/group-a',
      scheduleBlocks: [{ day: 'monday', startTime: '09:00', endTime: '10:00' }],
    }]);
    api.listGroupStudents.mockResolvedValue([{
      userId: 24,
      fullName: 'Fallback Student',
      email: null,
      progressPercent: 20,
      certificateEligible: true,
    }]);

    renderPage();

    expect(await screen.findAllByText('Fallback Student')).toHaveLength(2);
    expect(api.listTenantCourses).toHaveBeenCalledWith(42);
    expect(api.listCourseGroups).toHaveBeenCalledWith(11);
    expect(api.listGroupStudents).toHaveBeenCalledWith(31);
  });
});
