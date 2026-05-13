import { describe, expect, it } from 'vitest';
import { courseRosterFilterParams, isDefaultCourseRosterFilter } from './courseRosterFilters';

describe('course roster filters', () => {
  it('detects the reset state that should restore the cached full roster', () => {
    expect(isDefaultCourseRosterFilter('', 'all')).toBe(true);
    expect(isDefaultCourseRosterFilter('   ', 'all')).toBe(true);
    expect(isDefaultCourseRosterFilter('ada', 'all')).toBe(false);
    expect(isDefaultCourseRosterFilter('', 'completed')).toBe(false);
  });

  it('builds backend filter params for progress filters', () => {
    expect(courseRosterFilterParams(' Ada ', 'in_progress')).toEqual({
      q: 'Ada',
      progressGte: 1,
      progressLte: 99,
      limit: 200,
    });
    expect(courseRosterFilterParams('', 'not_started')).toEqual({
      q: undefined,
      progressGte: undefined,
      progressLte: 0,
      limit: 200,
    });
    expect(courseRosterFilterParams('', 'completed')).toEqual({
      q: undefined,
      progressGte: 100,
      progressLte: undefined,
      limit: 200,
    });
  });
});
