import type { Course } from '../../types/domain';

export type CourseNextAction =
  | 'approve'
  | 'submit'
  | 'publish'
  | 'edit'
  | 'groups'
  | 'sessions'
  | 'openSessions'
  | null;

export type CourseReadinessTone = 'ready' | 'blocked' | 'pending';

export type CourseReadiness = {
  labelKey: string;
  detailKey: string;
  tone: CourseReadinessTone;
  nextAction: CourseNextAction;
};

export type CourseReadinessOptions = {
  canApproveCourses: boolean;
  canEditCourse: boolean;
  groupCount?: number;
  sessionCount?: number;
};

export function getCourseReadiness(course: Course, options: CourseReadinessOptions): CourseReadiness {
  const status = course.status || 'draft';
  const deliveryTypeReady = ['offline', 'online_live'].includes(String(course.courseType ?? ''));

  if (status === 'pending') {
    return {
      labelKey: 'courses.readinessPending',
      detailKey: options.canApproveCourses ? 'courses.readinessPendingAdminDetail' : 'courses.readinessPendingDetail',
      tone: 'pending',
      nextAction: options.canApproveCourses ? 'approve' : null,
    };
  }

  if (status !== 'approved') {
    return {
      labelKey: 'courses.readinessDraft',
      detailKey: options.canApproveCourses ? 'courses.readinessDraftAdminDetail' : 'courses.readinessDraftDetail',
      tone: 'blocked',
      nextAction: options.canApproveCourses ? 'approve' : 'submit',
    };
  }

  if (course.isPublished !== true) {
    return {
      labelKey: 'courses.readinessApprovedUnpublished',
      detailKey: 'courses.blockerPublish',
      tone: 'blocked',
      nextAction: options.canApproveCourses ? 'publish' : null,
    };
  }

  if (!deliveryTypeReady) {
    return {
      labelKey: 'courses.readinessNeedsDeliveryType',
      detailKey: 'courses.blockerDeliveryType',
      tone: 'blocked',
      nextAction: options.canEditCourse ? 'edit' : null,
    };
  }

  if (options.groupCount === 0) {
    return {
      labelKey: 'courses.readinessNeedsGroup',
      detailKey: 'courses.workflowCreateGroup',
      tone: 'pending',
      nextAction: 'groups',
    };
  }

  if (options.sessionCount === 0) {
    return {
      labelKey: 'courses.readinessNeedsSession',
      detailKey: 'courses.workflowScheduleSession',
      tone: 'pending',
      nextAction: 'sessions',
    };
  }

  return {
    labelKey: 'courses.readinessReady',
    detailKey: 'courses.operationalDetail',
    tone: 'ready',
    nextAction: 'openSessions',
  };
}
