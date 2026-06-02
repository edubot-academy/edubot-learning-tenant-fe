import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
    vi.mocked(api.createStudentSupportRequest).mockResolvedValue({});
    vi.mocked(api.listStudentCourses).mockImplementation(() => {
      const load = deferred<Array<{ id: number; title: string }>>();
      courseLoads.push(load);
      return load.promise;
    });
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

    fireEvent.click(await screen.findByRole('button', { name: 'Start task' }));
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
        description: 'Goal: improve the text\\n\\n1. Hero headline\\n2. Hero subtitle\\n3. CTA text',
        status: 'submitted',
        mySubmission: { id: 1, answerText: 'Latest answer', status: 'submitted', submittedAt: '2026-01-02T00:00:00.000Z', score: 82, reviewComment: 'Good revision' },
        submissionHistory: [{ id: 2, answerText: 'First answer', status: 'rejected', submittedAt: '2026-01-01T00:00:00.000Z', reviewComment: 'Add evidence', attachmentUrl: 'https://example.test/evidence.pdf' }],
      },
    ]);

    render(<MemoryRouter><StudentDashboardPage view="todo" /></MemoryRouter>);

    fireEvent.click(await screen.findByRole('button', { name: /Submitted/ }));
    fireEvent.click(screen.getByRole('button', { name: 'View submission' }));

    expect(document.querySelector('.student-task-description')?.textContent).toBe('Goal: improve the text\n\n1. Hero headline\n2. Hero subtitle\n3. CTA text');
    expect(screen.getByText('Submission history')).toBeInTheDocument();
    expect(screen.getAllByText('Latest answer').length).toBeGreaterThan(0);
    expect(screen.getByText('First answer')).toBeInTheDocument();
    expect(screen.getAllByText(/Good revision/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Open attachment' }));
    expect(screen.getAllByRole('dialog', { name: 'Draft response' })).toHaveLength(2);
    expect(screen.getByTitle('Draft response')).toHaveAttribute('src', 'https://example.test/evidence.pdf');
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

    fireEvent.click(await screen.findByRole('button', { name: 'Start task' }));

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

    fireEvent.click(await screen.findByRole('button', { name: 'Start task' }));
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
    vi.mocked(api.listStudentCourses).mockResolvedValue([{ id: 101, title: 'Math' }]);
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
    fireEvent.click(screen.getAllByRole('button', { name: 'Open' })[0]);
    expect(screen.getByRole('dialog', { name: 'Resource 1' })).toBeInTheDocument();
    expect(screen.getByTitle('Resource 1')).toHaveAttribute('src', 'https://example.test/resource-1');
    fireEvent.click(screen.getByRole('button', { name: 'Close modal' }));

    fireEvent.click(screen.getByRole('button', { name: 'Recordings' }));
    expect(await screen.findByText('Recorded session')).toBeInTheDocument();
    expect(screen.queryByText('Resource 1')).not.toBeInTheDocument();
    expect(api.getStudentRecordingsPage).toHaveBeenLastCalledWith({ page: 1, limit: 50, courseId: undefined });
    expect(api.getStudentResourcesPage).toHaveBeenLastCalledWith({ page: 1, limit: 50, courseId: undefined });
  });

  it('keeps material filters visible when the selected type has no results', async () => {
    vi.mocked(api.listStudentCourses).mockResolvedValue([{ id: 101, title: 'Math' }]);
    vi.mocked(api.getStudentResourcesPage).mockResolvedValue({
      items: [
        { id: 'resource-1', title: 'Resource 1', url: 'https://example.test/resource-1', sessionId: 1, sessionTitle: 'Session 1', courseId: 101, courseTitle: 'Math' },
      ],
      page: 1,
      totalPages: 1,
      total: 1,
    });
    vi.mocked(api.getStudentRecordingsPage).mockResolvedValue({
      items: [],
      page: 1,
      totalPages: 1,
      total: 0,
    });

    render(<MemoryRouter><StudentDashboardPage view="materials" /></MemoryRouter>);

    expect(await screen.findByText('Resource 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Recordings' }));

    expect(await screen.findByText('No materials match these filters')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resources' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recordings' })).toBeInTheDocument();
    expect(screen.getByLabelText('Course')).toBeInTheDocument();
  });

  it('shows every enrolled course on the courses page', async () => {
    vi.mocked(api.listStudentCourses).mockResolvedValue(
      Array.from({ length: 7 }, (_, index) => ({ id: index + 1, title: `Course ${index + 1}` })),
    );

    render(<MemoryRouter><StudentDashboardPage view="courses" /></MemoryRouter>);

    expect(await screen.findByText('Course 1')).toBeInTheDocument();
    expect(screen.getByText('Course 7')).toBeInTheDocument();
  });

  it('loads course-scoped fallback data when course detail is sparse', async () => {
    vi.mocked(api.listStudentCourses).mockResolvedValue([{ id: 101, title: 'Math' }]);
    vi.mocked(api.getStudentCourseDetail).mockResolvedValue({
      course: { id: 101, title: 'Math', groupName: 'Group A' },
      progress: { progressPercent: 30 },
    });
    vi.mocked(api.listStudentUpcomingSessions).mockResolvedValue([
      { id: 501, courseId: 101, title: 'Algebra live', startsAt: '2099-06-01T10:00:00.000Z' },
    ]);
    vi.mocked(api.listStudentTasks).mockResolvedValue([
      { id: 701, sessionId: 501, courseId: 101, kind: 'activity', title: 'Algebra quiz', status: 'assigned' },
    ]);
    vi.mocked(api.getStudentResourcesPage).mockResolvedValue({
      items: [{ id: 'm1', sessionId: 501, courseId: 101, title: 'Formula sheet', url: 'https://example.test/formula.pdf' }],
      page: 1,
      totalPages: 1,
      total: 1,
    });

    render(<MemoryRouter><StudentDashboardPage view="courseDetail" courseId={101} /></MemoryRouter>);

    expect(await screen.findByText('Algebra live')).toBeInTheDocument();
    expect(screen.getByText('Algebra quiz')).toBeInTheDocument();
    expect(screen.getByText('Formula sheet')).toBeInTheDocument();
    const materialRow = screen.getByText('Formula sheet').closest('article');
    expect(materialRow).not.toBeNull();
    fireEvent.click(within(materialRow!).getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('dialog', { name: 'Formula sheet' })).toBeInTheDocument();
    expect(screen.getByTitle('Formula sheet')).toHaveAttribute('src', 'https://example.test/formula.pdf');
    expect(api.listStudentTasks).toHaveBeenCalledWith({ limit: 50, courseId: 101 });
    expect(api.getStudentResourcesPage).toHaveBeenCalledWith({ page: 1, limit: 50, courseId: 101 });
  });

  it('defensively hides non-visible course sessions from course detail', async () => {
    vi.mocked(api.listStudentCourses).mockResolvedValue([{ id: 101, title: 'Math' }]);
    vi.mocked(api.getStudentCourseDetail).mockResolvedValue({
      course: { id: 101, title: 'Math', groupName: 'Group A' },
      sessions: [
        { sessionId: 501, courseId: 101, title: 'Visible live', startsAt: '2099-06-01T10:00:00.000Z', status: 'scheduled' },
        { sessionId: 502, courseId: 101, title: 'Planned live', startsAt: '2099-06-02T10:00:00.000Z', status: 'planned' },
      ],
    });

    render(<MemoryRouter><StudentDashboardPage view="courseDetail" courseId={101} /></MemoryRouter>);

    expect(await screen.findByText('Visible live')).toBeInTheDocument();
    expect(screen.queryByText('Planned live')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Session details' })).toHaveAttribute('href', '/student/sessions/501');
  });

  it('keeps homework link submissions separate from uploaded files', async () => {
    vi.mocked(api.listStudentTasks).mockResolvedValue([]);
    vi.mocked(api.listStudentHomework).mockResolvedValue([
      {
        id: 22,
        sessionId: 220,
        kind: 'homework',
        title: 'Research link',
        status: 'assigned',
        submissionRequirements: { allowText: false, allowLink: true, allowFile: false },
      },
    ]);
    vi.mocked(api.submitStudentHomework).mockResolvedValue({});

    render(<MemoryRouter><StudentDashboardPage view="todo" /></MemoryRouter>);

    fireEvent.click(await screen.findByRole('button', { name: 'Start task' }));
    fireEvent.change(screen.getByLabelText('Attachment link'), { target: { value: 'https://example.test/research' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    });

    expect(api.submitStudentHomework).toHaveBeenCalledWith(220, 22, {
      answerText: undefined,
      linkUrl: 'https://example.test/research',
      attachmentUrl: undefined,
      attachmentKey: undefined,
    });
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

    expect(await screen.findAllByText('Biology')).not.toHaveLength(0);
    expect(screen.queryByRole('heading', { name: 'Attendance' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Certificates' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Grade history' })).toBeInTheDocument();
  });

  it('shows all progress courses returned by the progress summary', async () => {
    vi.mocked(api.getStudentProgressSummary).mockResolvedValue({
      courses: Array.from({ length: 10 }, (_, index) => ({
        id: index + 1,
        title: `Progress course ${index + 1}`,
        progressPercent: index * 10,
      })),
    });

    render(<MemoryRouter><StudentDashboardPage view="progress" /></MemoryRouter>);

    expect((await screen.findAllByText('Progress course 1')).length).toBeGreaterThan(0);
    expect(screen.getByText('Progress course 10')).toBeInTheDocument();
    expect(api.getStudentProgressSummary).toHaveBeenCalledWith();
  });

  it('submits support requests with selected learning context', async () => {
    vi.mocked(api.listStudentCourses).mockResolvedValue([{ id: 101, title: 'Math' }]);
    vi.mocked(api.listStudentUpcomingSessions).mockResolvedValue([
      { id: 501, courseId: 101, title: 'Algebra live', startsAt: '2099-06-01T10:00:00.000Z' },
    ]);
    vi.mocked(api.createStudentSupportRequest).mockResolvedValue({
      id: 1,
      category: 'task',
      priority: 'high',
      message: 'I cannot open the quiz',
      status: 'open',
      createdAt: '2099-06-01T10:00:00.000Z',
    });

    render(<MemoryRouter><StudentDashboardPage view="help" /></MemoryRouter>);

    expect((await screen.findAllByText('Send request')).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText('What do you need help with?'), { target: { value: 'task' } });
    fireEvent.change(screen.getByLabelText('How urgent is it?'), { target: { value: 'high' } });
    fireEvent.change(screen.getByLabelText('Related course'), { target: { value: '101' } });
    fireEvent.change(screen.getByLabelText('Related session'), { target: { value: '501' } });
    fireEvent.change(screen.getByLabelText('Describe the issue'), { target: { value: 'I cannot open the quiz' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send request' }));
    });

    expect(api.createStudentSupportRequest).toHaveBeenCalledWith({
      category: 'task',
      priority: 'high',
      courseId: 101,
      sessionId: 501,
      message: 'I cannot open the quiz',
    });
  });

  it('does not offer hidden sessions as support request context', async () => {
    vi.mocked(api.listStudentCourses).mockResolvedValue([{ id: 101, title: 'Math' }]);
    vi.mocked(api.listStudentUpcomingSessions).mockResolvedValue([
      { sessionId: 501, courseId: 101, title: 'Visible live', startsAt: '2099-06-01T10:00:00.000Z', status: 'scheduled' },
      { sessionId: 502, courseId: 101, title: 'Planned live', startsAt: '2099-06-02T10:00:00.000Z', status: 'planned' },
    ]);

    render(<MemoryRouter><StudentDashboardPage view="help" /></MemoryRouter>);

    expect((await screen.findAllByText('Send request')).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText('Related course'), { target: { value: '101' } });

    const sessionSelect = screen.getByLabelText('Related session');
    expect(sessionSelect).toHaveTextContent('Visible live');
    expect(sessionSelect).not.toHaveTextContent('Planned live');
  });

  it('keeps today usable when the home summary endpoint fails', async () => {
    vi.mocked(api.getStudentHome).mockRejectedValue(new Error('home failed'));
    vi.mocked(api.listStudentCourses).mockResolvedValue([{ id: 101, title: 'Math' }]);
    vi.mocked(api.listStudentUpcomingSessions).mockResolvedValue([
      { id: 501, courseId: 101, title: 'Algebra live', startsAt: '2099-06-01T10:00:00.000Z' },
    ]);
    vi.mocked(api.listStudentTasks).mockResolvedValue([
      { id: 701, sessionId: 501, courseId: 101, kind: 'activity', title: 'Algebra quiz', status: 'assigned' },
    ]);

    render(<MemoryRouter><StudentDashboardPage view="today" /></MemoryRouter>);

    expect((await screen.findAllByText('Algebra quiz')).length).toBeGreaterThan(0);
    expect(screen.getByText('Algebra live')).toBeInTheDocument();
    expect(screen.queryByText('Could not load student workspace')).not.toBeInTheDocument();
  });

  it('renders student session dates when the API returns startAt aliases', async () => {
    vi.mocked(api.getStudentHome).mockResolvedValue(null);
    vi.mocked(api.listStudentCourses).mockResolvedValue([{ id: 101, title: 'Math' }]);
    vi.mocked(api.listStudentUpcomingSessions).mockResolvedValue([
      { sessionId: 501, courseId: 101, courseTitle: 'Math', title: 'Alias live', startAt: '2099-06-01T10:00:00.000Z', status: 'scheduled' },
    ]);

    render(<MemoryRouter><StudentDashboardPage view="today" /></MemoryRouter>);

    expect(await screen.findByText('Alias live')).toBeInTheDocument();
    expect(screen.getAllByText(/Jun 1/).length).toBeGreaterThan(0);
  });

  it('keeps the help form usable when support options and history fail', async () => {
    vi.mocked(api.getStudentSupportOptions).mockRejectedValue(new Error('options failed'));
    vi.mocked(api.listStudentSupportRequests).mockRejectedValue(new Error('history failed'));
    vi.mocked(api.listStudentCourses).mockResolvedValue([]);

    render(<MemoryRouter><StudentDashboardPage view="help" /></MemoryRouter>);

    expect((await screen.findAllByText('Send request')).length).toBeGreaterThan(0);
    expect(screen.getByLabelText('What do you need help with?')).toBeInTheDocument();
    expect(screen.getByLabelText('Describe the issue')).toBeInTheDocument();
    expect(screen.getByText('Could not load Support options. Retry or continue with the rest of the workspace.')).toBeInTheDocument();
    expect(screen.getByText('Could not load Your requests. Retry or continue with the rest of the workspace.')).toBeInTheDocument();
    expect(screen.queryByText('Could not load student workspace')).not.toBeInTheDocument();
  });
});
