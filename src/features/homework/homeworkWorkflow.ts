import type { CourseSession, HomeworkReviewRoster } from '../../types/domain';

export type ReviewFilter = 'total' | 'needsReview' | 'missing' | 'approved' | 'needsRevision' | 'late';

export const reviewFilters: ReviewFilter[] = ['total', 'needsReview', 'missing', 'approved', 'needsRevision', 'late'];

export const reviewFilterLabels: Record<ReviewFilter, string> = {
  total: 'All',
  needsReview: 'Needs review',
  missing: 'Missing',
  approved: 'Approved',
  needsRevision: 'Needs revision',
  late: 'Late',
};

export function isHomeworkSessionReady(session: CourseSession | undefined | null) {
  return Boolean(session && ['scheduled', 'completed'].includes(String(session.status ?? 'scheduled')));
}

export function filterHomeworkReviewItems(
  rows: HomeworkReviewRoster['items'],
  reviewFilter: ReviewFilter,
) {
  if (reviewFilter === 'total') return rows;
  if (reviewFilter === 'late') return rows.filter((item) => item.isLate);
  if (reviewFilter === 'needsReview') return rows.filter((item) => item.reviewState === 'needs_review');
  if (reviewFilter === 'needsRevision') return rows.filter((item) => item.reviewState === 'needs_revision');
  return rows.filter((item) => item.reviewState === reviewFilter);
}

export function getHomeworkReviewBlocker(
  status: 'approved' | 'rejected' | 'needs_revision',
  draft: { score: string; reviewComment: string },
) {
  const score = draft.score.trim() ? Number(draft.score) : undefined;
  if ((status === 'rejected' || status === 'needs_revision') && !draft.reviewComment.trim()) {
    return 'Review comment is required.';
  }
  if (score !== undefined && !Number.isFinite(score)) {
    return 'Score must be a number.';
  }
  return '';
}

export function getHomeworkFormErrors(form: { title: string; maxScore: string }, sessionReady: boolean) {
  const errors: Record<string, string> = {};
  if (!sessionReady) errors.session = 'Select a scheduled or completed session before creating homework.';
  if (!form.title.trim()) errors.title = 'Homework title is required.';
  if (form.maxScore && Number(form.maxScore) < 0) errors.maxScore = 'Max score cannot be negative.';
  return errors;
}
