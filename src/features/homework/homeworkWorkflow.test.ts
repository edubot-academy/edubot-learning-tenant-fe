import { beforeEach, describe, expect, it } from 'vitest';
import type { HomeworkReviewRoster } from '../../types/domain';
import i18n from '../../i18n/config';
import { filterHomeworkReviewItems, getHomeworkFormErrors, getHomeworkReviewBlocker } from './homeworkWorkflow';

const rows: HomeworkReviewRoster['items'] = [
  { studentId: 1, reviewState: 'needs_review', hasSubmission: true, isLate: false },
  { studentId: 2, reviewState: 'approved', hasSubmission: true, isLate: true },
  { studentId: 3, reviewState: 'missing', hasSubmission: false, isLate: true },
];

describe('homework workflow helpers', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('filters review roster by canonical review filters', () => {
    expect(filterHomeworkReviewItems(rows, 'needsReview').map((item) => item.studentId)).toEqual([1]);
    expect(filterHomeworkReviewItems(rows, 'late').map((item) => item.studentId)).toEqual([2, 3]);
    expect(filterHomeworkReviewItems(rows, 'total')).toHaveLength(3);
  });

  it('requires comments for revision and rejection decisions', () => {
    expect(getHomeworkReviewBlocker('needs_revision', { score: '', reviewComment: '' })).toBe('Review comment is required.');
    expect(getHomeworkReviewBlocker('rejected', { score: '', reviewComment: 'Incomplete' })).toBe('');
  });

  it('validates review scores against numeric and max score bounds', () => {
    expect(getHomeworkReviewBlocker('approved', { score: 'abc', reviewComment: '' }, 10)).toBe('Score must be a number.');
    expect(getHomeworkReviewBlocker('approved', { score: '-1', reviewComment: '' }, 10)).toBe('Score cannot be negative.');
    expect(getHomeworkReviewBlocker('approved', { score: '11', reviewComment: '' }, 10)).toBe('Score cannot be greater than 10.');
    expect(getHomeworkReviewBlocker('approved', { score: '10', reviewComment: '' }, 10)).toBe('');
  });

  it('validates homework form title, session state, and score', () => {
    expect(getHomeworkFormErrors({ title: '', maxScore: '-1' }, false)).toMatchObject({
      session: 'Select a scheduled or completed session before creating homework.',
      title: 'Homework title is required.',
      maxScore: 'Max score cannot be negative.',
    });
    expect(getHomeworkFormErrors({ title: 'Essay', maxScore: '100' }, true)).toEqual({});
  });
});
