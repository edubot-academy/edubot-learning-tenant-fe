import { describe, expect, it } from 'vitest';
import {
  isCurrentStudentLoad,
  isStudentUpcomingSession,
  isStudentVisibleSession,
  nextStudentLoadId,
  prioritizeStudentTasks,
  settledStudentValue,
  sortOpenStudentTasks,
  studentSessionEndsAt,
  studentSessionId,
  studentSessionStartsAt,
  studentTaskState,
  studentVisibleLiveJoinUrl,
} from './studentDashboardData';

const now = Date.parse('2026-05-13T12:00:00.000Z');

describe('student dashboard data helpers', () => {
  it('sorts open tasks by overdue state, due date, then title', () => {
    const tasks = [
      { id: 1, title: 'No due date', status: 'pending' },
      { id: 2, title: 'Due tomorrow', status: 'pending', dueAt: '2026-05-14T09:00:00.000Z', kind: 'activity' },
      { id: 3, title: 'Overdue B', status: 'pending', dueAt: '2026-05-12T09:00:00.000Z', kind: 'activity' },
      { id: 4, title: 'Done', status: 'completed', dueAt: '2026-05-11T09:00:00.000Z', kind: 'activity' },
      { id: 5, title: 'Overdue A', status: 'pending', dueAt: '2026-05-12T09:00:00.000Z', kind: 'activity' },
    ];

    expect(sortOpenStudentTasks(tasks, now).map((task) => task.id)).toEqual([5, 3, 2, 1]);
  });

  it('keeps closed tasks after prioritized open tasks', () => {
    const tasks = [
      { id: 1, title: 'Completed', status: 'completed', dueAt: '2026-05-11T09:00:00.000Z', kind: 'activity' },
      { id: 2, title: 'Open soon', status: 'pending', dueAt: '2026-05-13T13:00:00.000Z', kind: 'activity' },
      { id: 3, title: 'Overdue', status: 'pending', dueAt: '2026-05-12T09:00:00.000Z', kind: 'activity' },
    ];

    expect(prioritizeStudentTasks(tasks, now).map((task) => task.id)).toEqual([3, 2, 1]);
  });

  it('uses review and submission state when deciding task priority', () => {
    const tasks = [
      { id: 1, title: 'Submitted homework', status: 'assigned', mySubmission: { status: 'submitted' }, kind: 'homework' },
      { id: 1, title: 'Open activity', status: 'assigned', dueAt: '2026-05-12T09:00:00.000Z', kind: 'activity' },
      { id: 2, title: 'Needs revision', status: 'submitted', reviewState: 'needs_revision', kind: 'homework' },
    ];

    expect(studentTaskState(tasks[0])).toBe('submitted');
    expect(studentTaskState(tasks[2])).toBe('needs_revision');
    expect(prioritizeStudentTasks(tasks, now).map((task) => task.title)).toEqual(['Open activity', 'Needs revision', 'Submitted homework']);
  });

  it('returns fallback values for failed optional student endpoints', () => {
    const failed = Promise.reject(new Error('endpoint failed'));

    return failed
      .then((value) => ({ status: 'fulfilled' as const, value }))
      .catch((reason) => ({ status: 'rejected' as const, reason }))
      .then((result) => {
        expect(settledStudentValue(result, [])).toEqual([]);
      });
  });

  it('identifies stale tenant-switch load results', () => {
    const firstLoadId = nextStudentLoadId(0);
    const secondLoadId = nextStudentLoadId(firstLoadId);

    expect(isCurrentStudentLoad(firstLoadId, secondLoadId)).toBe(false);
    expect(isCurrentStudentLoad(secondLoadId, secondLoadId)).toBe(true);
  });

  it('normalizes student session ids and hides non-visible sessions', () => {
    expect(studentSessionId({ sessionId: 42 })).toBe(42);
    expect(studentSessionStartsAt({ startAt: '2026-05-13T13:00:00.000Z' })).toBe('2026-05-13T13:00:00.000Z');
    expect(studentSessionEndsAt({ endAt: '2026-05-13T14:00:00.000Z' })).toBe('2026-05-13T14:00:00.000Z');
    expect(isStudentVisibleSession({ status: 'planned' })).toBe(false);
    expect(isStudentVisibleSession({ status: 'cancelled' })).toBe(false);
    expect(isStudentVisibleSession({ status: 'scheduled' })).toBe(true);
    expect(isStudentVisibleSession({ status: 'completed' })).toBe(true);
    expect(isStudentVisibleSession({ status: 'scheduled', groupStatus: 'planned' })).toBe(false);
  });

  it('treats only future scheduled sessions as upcoming', () => {
    expect(isStudentUpcomingSession({ status: 'scheduled', startsAt: '2026-05-13T13:00:00.000Z' }, now)).toBe(true);
    expect(isStudentUpcomingSession({ status: 'scheduled', startAt: '2026-05-13T13:00:00.000Z' }, now)).toBe(true);
    expect(isStudentUpcomingSession({ status: 'completed', startsAt: '2026-05-13T13:00:00.000Z' }, now)).toBe(false);
    expect(isStudentUpcomingSession({ status: 'scheduled', startsAt: '2026-05-13T11:00:00.000Z' }, now)).toBe(false);
  });

  it('only exposes live join urls inside the student join window', () => {
    const session = {
      status: 'scheduled',
      startsAt: '2026-05-13T12:15:00.000Z',
      endsAt: '2026-05-13T13:00:00.000Z',
      liveJoinUrl: 'https://meet.test/session',
    };

    expect(studentVisibleLiveJoinUrl(session, now)).toBe('https://meet.test/session');
    expect(studentVisibleLiveJoinUrl(session, Date.parse('2026-05-13T11:59:00.000Z'))).toBeNull();
    expect(studentVisibleLiveJoinUrl(session, Date.parse('2026-05-13T13:31:00.000Z'))).toBeNull();
    expect(studentVisibleLiveJoinUrl({ ...session, status: 'completed' }, now)).toBeNull();
  });
});
