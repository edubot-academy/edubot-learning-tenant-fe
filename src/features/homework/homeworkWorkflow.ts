import type { CourseSession, HomeworkReviewRoster } from '../../types/domain';
import i18n from '../../i18n/config';

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
    return i18n.t('homework.errorReviewCommentRequired');
  }
  if (score !== undefined && !Number.isFinite(score)) {
    return i18n.t('homework.errorScoreNumber');
  }
  return '';
}

export function getHomeworkFormErrors(form: { title: string; maxScore: string }, sessionReady: boolean) {
  const errors: Record<string, string> = {};
  if (!sessionReady) errors.session = i18n.t('homework.errorSessionReady');
  if (!form.title.trim()) errors.title = i18n.t('homework.errorTitleRequired');
  if (form.maxScore && Number(form.maxScore) < 0) errors.maxScore = i18n.t('homework.errorMaxScoreNegative');
  return errors;
}
