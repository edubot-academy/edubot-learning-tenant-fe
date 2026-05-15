import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../i18n/config';
import * as api from '../../services/api';
import { StudentDashboardPage } from './StudentDashboardPage';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

let activeTenant = { id: 1, name: 'Old tenant', featureFlags: {} };
const courseLoads: Array<Deferred<Array<{ id: number; title: string }>>> = [];

vi.mock('../tenant/TenantProvider', () => ({
  useTenant: () => ({ activeTenant }),
}));

vi.mock('../../services/api', () => ({
  createStudentSupportRequest: vi.fn(),
  downloadCertificatePdf: vi.fn(),
  getStudentCourseDetail: vi.fn(() => Promise.resolve(null)),
  getStudentCertificatesPage: vi.fn(() => Promise.resolve({ items: [], page: 1, totalPages: 1 })),
  getStudentHome: vi.fn(() => Promise.resolve(null)),
  getStudentNotificationUnreadCount: vi.fn(() => Promise.resolve({ count: 0, hasUnread: false })),
  getStudentNotificationsPage: vi.fn(() => Promise.resolve({ items: [], page: 1, totalPages: 1 })),
  getStudentProgressSummary: vi.fn(() => Promise.resolve(null)),
  getStudentRecordingsPage: vi.fn(() => Promise.resolve({ items: [], page: 1, totalPages: 1 })),
  getStudentResourcesPage: vi.fn(() => Promise.resolve({ items: [], page: 1, totalPages: 1 })),
  getStudentSessionDetail: vi.fn(() => Promise.resolve(null)),
  getStudentSupportOptions: vi.fn(() => Promise.resolve(null)),
  listStudentAttendance: vi.fn(() => Promise.resolve([])),
  listStudentCertificates: vi.fn(() => Promise.resolve([])),
  listStudentCourses: vi.fn(() => {
    const load = deferred<Array<{ id: number; title: string }>>();
    courseLoads.push(load);
    return load.promise;
  }),
  listStudentHomework: vi.fn(() => Promise.resolve([])),
  listStudentNotifications: vi.fn(() => Promise.resolve([])),
  listStudentRecordings: vi.fn(() => Promise.resolve([])),
  listStudentReminders: vi.fn(() => Promise.resolve([])),
  listStudentResources: vi.fn(() => Promise.resolve([])),
  listStudentSupportRequests: vi.fn(() => Promise.resolve([])),
  listStudentTasks: vi.fn(() => Promise.resolve([])),
  listStudentUpcomingSessions: vi.fn(() => Promise.resolve([])),
  markAllStudentNotificationsRead: vi.fn(),
  markStudentNotificationRead: vi.fn(),
  submitStudentActivity: vi.fn(),
  submitStudentActivityQuiz: vi.fn(),
  submitStudentHomework: vi.fn(),
  uploadStudentActivityAttachment: vi.fn(),
  uploadStudentHomeworkAttachment: vi.fn(),
}));

describe('StudentDashboardPage loading', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    activeTenant = { id: 1, name: 'Old tenant', featureFlags: {} };
    courseLoads.length = 0;
    vi.mocked(api.getStudentCourseDetail).mockResolvedValue(null);
    vi.mocked(api.getStudentCertificatesPage).mockResolvedValue({ items: [], page: 1, totalPages: 1 });
    vi.mocked(api.getStudentHome).mockResolvedValue(null);
    vi.mocked(api.getStudentNotificationUnreadCount).mockResolvedValue({ count: 0, hasUnread: false });
    vi.mocked(api.getStudentNotificationsPage).mockResolvedValue({ items: [], page: 1, totalPages: 1 });
    vi.mocked(api.getStudentProgressSummary).mockResolvedValue(null);
    vi.mocked(api.getStudentRecordingsPage).mockResolvedValue({ items: [], page: 1, totalPages: 1 });
    vi.mocked(api.getStudentResourcesPage).mockResolvedValue({ items: [], page: 1, totalPages: 1 });
    vi.mocked(api.getStudentSessionDetail).mockResolvedValue(null);
    vi.mocked(api.getStudentSupportOptions).mockResolvedValue(null);
    vi.mocked(api.listStudentHomework).mockResolvedValue([]);
    vi.mocked(api.listStudentRecordings).mockResolvedValue([]);
    vi.mocked(api.listStudentReminders).mockResolvedValue([]);
    vi.mocked(api.listStudentResources).mockResolvedValue([]);
    vi.mocked(api.listStudentSupportRequests).mockResolvedValue([]);
    vi.mocked(api.listStudentTasks).mockResolvedValue([]);
    vi.mocked(api.listStudentUpcomingSessions).mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  it('ignores stale student data after a tenant switch', async () => {
    const { rerender } = render(<MemoryRouter><StudentDashboardPage view="courses" /></MemoryRouter>);

    await waitFor(() => expect(courseLoads).toHaveLength(1));

    activeTenant = { id: 2, name: 'New tenant', featureFlags: {} };
    rerender(<MemoryRouter><StudentDashboardPage view="courses" /></MemoryRouter>);

    await waitFor(() => expect(courseLoads).toHaveLength(2));

    await act(async () => {
      courseLoads[1].resolve([{ id: 2, title: 'New tenant course' }]);
      await courseLoads[1].promise;
    });

    expect(await screen.findByText('New tenant course')).toBeInTheDocument();

    await act(async () => {
      courseLoads[0].resolve([{ id: 1, title: 'Old tenant course' }]);
      await courseLoads[0].promise;
    });

    expect(screen.getByText('New tenant course')).toBeInTheDocument();
    expect(screen.queryByText('Old tenant course')).not.toBeInTheDocument();
  });

  it('filters the To do page by overdue and completed work', async () => {
    vi.mocked(api.listStudentTasks).mockResolvedValue([
      { id: 1, sessionId: 10, kind: 'activity', title: 'Open essay', dueAt: '2099-01-01T10:00:00.000Z', status: 'assigned', courseTitle: 'Writing' },
      { id: 2, sessionId: 10, kind: 'activity', title: 'Late quiz', dueAt: '2020-01-01T10:00:00.000Z', status: 'assigned', courseTitle: 'Writing' },
      { id: 3, sessionId: 10, kind: 'activity', title: 'Graded task', dueAt: '2020-01-02T10:00:00.000Z', status: 'graded', courseTitle: 'Writing' },
    ]);

    render(<MemoryRouter><StudentDashboardPage view="todo" /></MemoryRouter>);

    expect(await screen.findByText('Open essay')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Overdue/i }));
    expect(screen.getByText('Late quiz')).toBeInTheDocument();
    expect(screen.queryByText('Open essay')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Completed/i }));
    expect(screen.getByText('Graded task')).toBeInTheDocument();
    expect(screen.queryByText('Late quiz')).not.toBeInTheDocument();
  });

  it('requires every quiz question before submission', async () => {
    vi.mocked(api.listStudentTasks).mockResolvedValue([
      {
        id: 7,
        sessionId: 70,
        kind: 'quiz',
        taskType: 'quiz',
        title: 'Safety quiz',
        status: 'assigned',
        questions: [
          { id: 1, prompt: 'First question', options: [{ id: 11, text: 'A' }] },
          { id: 2, prompt: 'Second question', options: [{ id: 21, text: 'B' }] },
        ],
      },
    ]);

    render(<MemoryRouter><StudentDashboardPage view="todo" /></MemoryRouter>);

    fireEvent.click(await screen.findByRole('button', { name: 'Open' }));
    const submit = screen.getByRole('button', { name: 'Submit' });
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByLabelText('A'));
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByLabelText('B'));
    expect(submit).toBeEnabled();
  });

  it('shows submission history and review feedback in the task modal', async () => {
    vi.mocked(api.listStudentTasks).mockResolvedValue([
      {
        id: 8,
        sessionId: 80,
        kind: 'activity',
        title: 'Draft response',
        status: 'submitted',
        mySubmission: { id: 1, answerText: 'Latest answer', status: 'submitted', submittedAt: '2026-01-02T00:00:00.000Z', score: 82, reviewComment: 'Good revision' },
        submissionHistory: [{ id: 2, answerText: 'First answer', status: 'rejected', submittedAt: '2026-01-01T00:00:00.000Z', reviewComment: 'Add evidence' }],
      },
    ]);

    render(<MemoryRouter><StudentDashboardPage view="todo" /></MemoryRouter>);

    fireEvent.click(await screen.findByRole('button', { name: /Submitted/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));

    expect(screen.getByText('Submission history')).toBeInTheDocument();
    expect(screen.getAllByText('Latest answer').length).toBeGreaterThan(0);
    expect(screen.getByText('First answer')).toBeInTheDocument();
    expect(screen.getAllByText(/Good revision/).length).toBeGreaterThan(0);
  });

  it('uses task submission requirements to hide unavailable methods', async () => {
    vi.mocked(api.listStudentTasks).mockResolvedValue([
      {
        id: 9,
        sessionId: 90,
        kind: 'activity',
        title: 'Read-only task',
        status: 'assigned',
        submissionRequirements: { allowText: false, allowLink: false, allowFile: false },
      },
    ]);

    render(<MemoryRouter><StudentDashboardPage view="todo" /></MemoryRouter>);

    fireEvent.click(await screen.findByRole('button', { name: 'Open' }));

    expect(screen.queryByLabelText('Answer')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Attachment link')).not.toBeInTheDocument();
    expect(screen.getByText('No submission method is available for this task yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled();
  });

  it('submits uploaded activity files separately from link submissions', async () => {
    vi.mocked(api.listStudentTasks).mockResolvedValue([
      {
        id: 10,
        sessionId: 100,
        kind: 'activity',
        title: 'Upload evidence',
        status: 'assigned',
        submissionRequirements: { allowText: false, allowLink: false, allowFile: true, allowedFileTypes: ['.pdf'] },
      },
    ]);
    vi.mocked(api.uploadStudentActivityAttachment).mockResolvedValue({
      key: 'uploads/evidence.pdf',
      url: 'https://example.test/evidence.pdf',
      fileName: 'evidence.pdf',
      contentType: 'application/pdf',
      size: 100,
    });
    vi.mocked(api.submitStudentActivity).mockResolvedValue({});

    render(<MemoryRouter><StudentDashboardPage view="todo" /></MemoryRouter>);

    fireEvent.click(await screen.findByRole('button', { name: 'Open' }));
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['pdf'], 'evidence.pdf', { type: 'application/pdf' });
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    expect(await screen.findByText(/Uploaded attachment/)).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    });

    expect(api.submitStudentActivity).toHaveBeenCalledWith(100, 10, {
      text: undefined,
      link: undefined,
      attachmentUrl: 'https://example.test/evidence.pdf',
      attachmentKey: 'uploads/evidence.pdf',
    });
  });

  it('filters materials by resource type and shows load more when more items are available', async () => {
    vi.mocked(api.getStudentResourcesPage).mockResolvedValue({
      items: Array.from({ length: 13 }, (_, index) => ({
      id: `resource-${index}`,
      title: `Resource ${index + 1}`,
      url: `https://example.test/resource-${index + 1}`,
      sessionId: index + 1,
      sessionTitle: `Session ${index + 1}`,
      courseTitle: 'Math',
    })),
      page: 1,
      totalPages: 1,
    });
    vi.mocked(api.getStudentRecordingsPage).mockResolvedValue({
      items: [
        { id: 'recording-1', title: 'Recording 1', url: 'https://example.test/recording-1', sessionId: 50, sessionTitle: 'Recorded session', courseTitle: 'Math' },
      ],
      page: 1,
      totalPages: 1,
    });

    render(<MemoryRouter><StudentDashboardPage view="materials" /></MemoryRouter>);

    expect(await screen.findByText('Resource 1')).toBeInTheDocument();
    expect(screen.getByText('Showing 12 of 14')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Recordings' }));
    expect(await screen.findByText('Recorded session')).toBeInTheDocument();
    expect(screen.queryByText('Resource 1')).not.toBeInTheDocument();
    expect(api.getStudentRecordingsPage).toHaveBeenLastCalledWith({ page: 1, limit: 50, courseId: undefined });
    expect(api.getStudentResourcesPage).toHaveBeenLastCalledWith({ page: 1, limit: 50, courseId: undefined });
  });

  it('hides attendance and certificates when progress feature flags are disabled', async () => {
    activeTenant = {
      id: 1,
      name: 'Old tenant',
      featureFlags: {
        'attendance.enabled': false,
        'certificates.enabled': false,
      },
    };
    vi.mocked(api.getStudentProgressSummary).mockResolvedValue({
      courses: [{ id: 1, title: 'Biology', progressPercent: 55, attendanceRate: 90 }],
      attendance: { recent: [{ id: 1, userId: 1, status: 'present', sessionDate: '2026-01-01T00:00:00.000Z' }] },
      certificates: [{ id: 1, courseTitle: 'Biology', status: 'issued' }],
      gradedTasks: [{ id: 1, title: 'Lab quiz', status: 'graded', myAttempt: { score: 90 } }],
    });

    render(<MemoryRouter><StudentDashboardPage view="progress" /></MemoryRouter>);

    expect(await screen.findByText('Biology')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Attendance' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Certificates' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Grade history' })).toBeInTheDocument();
  });
});
