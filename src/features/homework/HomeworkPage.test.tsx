import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../i18n/config';
import i18n from '../../i18n/config';
import { HomeworkPage } from './HomeworkPage';

const api = vi.hoisted(() => ({
  acceptAiGeneration: vi.fn(),
  createSessionHomework: vi.fn(),
  deleteSessionHomework: vi.fn(),
  generateAiFeedbackDraft: vi.fn(),
  generateAiHomeworkDraft: vi.fn(),
  getAiLmsCapabilities: vi.fn(),
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
  rejectAiGeneration: vi.fn(),
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
    api.getAiLmsCapabilities.mockResolvedValue({ feedbackDraft: { enabled: true }, homeworkDraft: { enabled: true } });
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

  it('does not request a review roster with stale homework when switching sessions', async () => {
    api.listGroupSessions.mockResolvedValue([session, otherSession]);
    api.listSessionHomework.mockImplementation((sessionId: number) => (
      Promise.resolve(sessionId === 901 ? [{
        id: 501,
        sessionId: 901,
        courseId: 101,
        groupId: 301,
        title: 'Session 1 homework',
        isPublished: true,
      }] : [])
    ));
    api.getHomeworkReviewRoster.mockResolvedValue({
      items: [],
      summary: { total: 0, needsReview: 0, missing: 0, needsRevision: 0, late: 0 },
    });

    renderPage('/homework?courseId=101&groupId=301&sessionId=901');

    expect(await screen.findByText('Session 1 homework')).toBeInTheDocument();
    await waitFor(() => expect(api.getHomeworkReviewRoster).toHaveBeenCalledWith(901, 501));
    api.getHomeworkReviewRoster.mockClear();

    fireEvent.change(screen.getAllByRole('combobox')[2], { target: { value: '902' } });

    await waitFor(() => expect(api.listSessionHomework).toHaveBeenLastCalledWith(902));
    expect(api.getHomeworkReviewRoster).not.toHaveBeenCalledWith(902, 501);
  });

  it('ignores session homework rows without a matching session id', async () => {
    api.listSessionHomework.mockResolvedValue([{
      id: 501,
      courseId: 101,
      groupId: 301,
      title: 'Malformed homework',
      isPublished: true,
    }]);
    api.getHomeworkReviewRoster.mockResolvedValue({
      items: [],
      summary: { total: 0, needsReview: 0, missing: 0, needsRevision: 0, late: 0 },
    });

    renderPage('/homework?courseId=101&groupId=301&sessionId=901');

    await waitFor(() => expect(api.listSessionHomework).toHaveBeenCalledWith(901));
    expect(screen.queryByText('Malformed homework')).not.toBeInTheDocument();
    expect(api.getHomeworkReviewRoster).not.toHaveBeenCalledWith(901, 501);
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

  it('generates an AI feedback draft and copies it into the review form', async () => {
    api.listSessionHomework.mockResolvedValue([{
      id: 501,
      sessionId: 901,
      courseId: 101,
      groupId: 301,
      title: 'Equation practice',
      maxScore: 10,
      isPublished: true,
    }]);
    api.getHomeworkReviewRoster.mockResolvedValue({
      items: [{
        studentId: 201,
        fullName: 'Aida Student',
        reviewState: 'needs_review',
        hasSubmission: true,
        isLate: false,
        submission: {
          id: 701,
          homeworkId: 501,
          studentId: 201,
          answerText: 'x = 1',
          status: 'submitted',
        },
      }],
      summary: { total: 1, pendingSubmission: 0, missing: 0, needsReview: 1, approved: 0, rejected: 0, needsRevision: 0, late: 0 },
    });
    api.generateAiFeedbackDraft.mockResolvedValue({
      generationId: 9001,
      status: 'draft',
      output: {
        feedback: 'Good start. Add one more explanation step.',
        suggestedScore: 8,
        nextStep: 'Show the equation balance step.',
      },
    });

    renderPage('/homework?courseId=101&groupId=301&sessionId=901&homeworkId=501');

    await waitFor(() => expect(screen.getByRole('option', { name: /Lesson 1/ })).toBeInTheDocument(), { timeout: 5000 });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Review' })).toBeInTheDocument(), { timeout: 5000 });
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    fireEvent.click(screen.getByRole('button', { name: 'Suggest feedback with AI' }));

    await waitFor(() => expect(api.generateAiFeedbackDraft).toHaveBeenCalledWith(701, {
      submissionType: 'homework',
      language: 'en',
      tone: 'encouraging',
      includeScoreSuggestion: true,
    }));
    expect(await screen.findByDisplayValue('Good start. Add one more explanation step.')).toBeInTheDocument();
    expect(screen.getByText('Show the equation balance step.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Use draft' }));

    await waitFor(() => expect(api.acceptAiGeneration).toHaveBeenCalledWith(9001));
    expect(screen.getAllByDisplayValue('Good start. Add one more explanation step.').length).toBeGreaterThan(0);
    expect(screen.getAllByDisplayValue('8').length).toBeGreaterThan(0);
  });

  it('uses an AI homework draft in the create form without creating homework automatically', async () => {
    api.generateAiHomeworkDraft.mockResolvedValue({
      generationId: 9003,
      status: 'draft',
      output: {
        title: 'Linear equations homework',
        description: 'Solve three equations and explain each step.',
        rubric: [
          { criterion: 'Correct answers', points: 6 },
          { criterion: 'Clear explanation', points: 4 },
        ],
        maxScore: 10,
      },
    });

    renderPage('/homework?courseId=101&groupId=301&sessionId=901');

    await waitFor(() => expect(screen.getByRole('option', { name: /Lesson 1/ })).toBeInTheDocument(), { timeout: 5000 });
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Create homework' })[0]).toBeEnabled(), { timeout: 5000 });
    fireEvent.click(screen.getAllByRole('button', { name: 'Create homework' })[0]);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Create homework' })).toBeInTheDocument(), { timeout: 5000 });
    fireEvent.click(screen.getByRole('button', { name: 'AI draft' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Suggest homework with AI' })).toBeInTheDocument(), { timeout: 5000 });
    fireEvent.change(screen.getByLabelText('Instructions for AI'), {
      target: { value: 'Create 5 tasks and include one challenge question.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Suggest homework with AI' }));

    await waitFor(() => expect(api.generateAiHomeworkDraft).toHaveBeenCalledWith(901, {
      language: 'en',
      topic: 'Lesson 1',
      instructions: 'Create 5 tasks and include one challenge question.',
      maxScore: undefined,
    }));
    expect(await screen.findByDisplayValue('Linear equations homework')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Use in manual form' }));

    await waitFor(() => expect(api.acceptAiGeneration).toHaveBeenCalledWith(9003));
    expect(screen.getByRole('button', { name: 'Manual' })).toHaveClass('active');
    expect(screen.getByDisplayValue('Linear equations homework')).toBeInTheDocument();
    expect(screen.getByDisplayValue(/Solve three equations/)).toBeInTheDocument();
    expect(screen.getByDisplayValue('10')).toBeInTheDocument();
    expect(api.createSessionHomework).not.toHaveBeenCalled();
  }, 10000);

  it('does not submit manual homework while AI draft mode is active', async () => {
    renderPage('/homework?courseId=101&groupId=301&sessionId=901');

    await waitFor(() => expect(screen.getByRole('option', { name: /Lesson 1/ })).toBeInTheDocument(), { timeout: 5000 });
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Create homework' })[0]).toBeEnabled(), { timeout: 5000 });
    fireEvent.click(screen.getAllByRole('button', { name: 'Create homework' })[0]);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Create homework' })).toBeInTheDocument(), { timeout: 5000 });
    fireEvent.click(screen.getByRole('button', { name: 'AI draft' }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'AI seed topic' } });

    const createForm = screen.getByLabelText('Title').closest('form');
    expect(createForm).not.toBeNull();
    fireEvent.submit(createForm!);

    expect(api.createSessionHomework).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'AI draft' })).toHaveClass('active');
  });
});
