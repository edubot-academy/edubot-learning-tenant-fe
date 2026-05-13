import type { Course } from '../../types/domain';
import { readable } from '../../lib/format';
import i18n from '../../i18n/config';

export type WorkflowScope = {
  courseId?: number;
  groupId?: number;
  sessionId?: number;
  tab?: string;
};

export function isDeliveryCourseType(course: Course | undefined | null) {
  return ['offline', 'online_live'].includes(String(course?.courseType ?? ''));
}

export function isCourseWorkflowReady(course: Course | undefined | null, requireDelivery = true) {
  return Boolean(
    course
    && (!requireDelivery || isDeliveryCourseType(course))
    && course.status === 'approved'
    && course.isPublished === true,
  );
}

export function courseWorkflowBlocker(course: Course | undefined | null, requireDelivery = true) {
  if (!course) return i18n.t('courses.blockerChooseCourse');
  if (requireDelivery && !isDeliveryCourseType(course)) {
    return i18n.t('courses.blockerDeliveryType');
  }
  if (course.status !== 'approved') {
    return i18n.t('courses.blockerApproval');
  }
  if (course.isPublished !== true) {
    return i18n.t('courses.blockerPublish');
  }
  return '';
}

export function formatCourseType(value: Course['courseType'] | string | undefined | null) {
  const labels: Record<string, string> = {
    offline: i18n.t('courses.typeOffline'),
    online_live: i18n.t('courses.typeOnlineLive'),
    video: i18n.t('courses.typeVideo'),
  };
  return labels[String(value || 'video')] ?? readable(value || 'video');
}

export function workflowPath(path: string, scope: WorkflowScope) {
  const params = new URLSearchParams();
  if (scope.courseId) params.set('courseId', String(scope.courseId));
  if (scope.groupId) params.set('groupId', String(scope.groupId));
  if (scope.sessionId) params.set('sessionId', String(scope.sessionId));
  if (scope.tab) params.set('tab', scope.tab);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export function nextWorkflowSearchParams(searchParamsString: string, scope: WorkflowScope) {
  const next = new URLSearchParams(searchParamsString);
  if (scope.courseId) next.set('courseId', String(scope.courseId)); else next.delete('courseId');
  if (scope.groupId) next.set('groupId', String(scope.groupId)); else next.delete('groupId');
  if (scope.sessionId) next.set('sessionId', String(scope.sessionId)); else next.delete('sessionId');
  if (scope.tab) next.set('tab', scope.tab); else next.delete('tab');
  return next;
}
