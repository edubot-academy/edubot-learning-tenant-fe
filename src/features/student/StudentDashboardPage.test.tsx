import { act, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../../i18n/config';
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
  downloadCertificatePdf: vi.fn(),
  listStudentAttendance: vi.fn(() => Promise.resolve([])),
  listStudentCertificates: vi.fn(() => Promise.resolve([])),
  listStudentCourses: vi.fn(() => {
    const load = deferred<Array<{ id: number; title: string }>>();
    courseLoads.push(load);
    return load.promise;
  }),
  listStudentHomework: vi.fn(() => Promise.resolve([])),
  listStudentRecordings: vi.fn(() => Promise.resolve([])),
  listStudentResources: vi.fn(() => Promise.resolve([])),
  listStudentTasks: vi.fn(() => Promise.resolve([])),
  listStudentUpcomingSessions: vi.fn(() => Promise.resolve([])),
  submitStudentActivity: vi.fn(),
  submitStudentActivityQuiz: vi.fn(),
  submitStudentHomework: vi.fn(),
  uploadStudentActivityAttachment: vi.fn(),
  uploadStudentHomeworkAttachment: vi.fn(),
}));

describe('StudentDashboardPage loading', () => {
  beforeEach(() => {
    activeTenant = { id: 1, name: 'Old tenant', featureFlags: {} };
    courseLoads.length = 0;
  });

  it('ignores stale student data after a tenant switch', async () => {
    const { rerender } = render(<StudentDashboardPage />);

    await waitFor(() => expect(courseLoads).toHaveLength(1));

    activeTenant = { id: 2, name: 'New tenant', featureFlags: {} };
    rerender(<StudentDashboardPage />);

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
});
