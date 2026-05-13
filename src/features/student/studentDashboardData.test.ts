import { describe, expect, it } from 'vitest';
import { isCurrentStudentLoad, nextStudentLoadId, prioritizeStudentTasks, settledStudentValue, sortOpenStudentTasks } from './studentDashboardData';

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
});
