import { FiActivity, FiAlertTriangle } from 'react-icons/fi';
import type { TFunction } from 'i18next';
import type { InstructorDashboard, TenantActivityLog, TenantOverview } from '../../types/domain';
import { activityActionLabelKeys, activityTargetLabelKeys, enumLabel } from '../../lib/enumLabels';
import { formatDate } from '../../lib/format';
import type { InstructorActivityFeedItem } from './InstructorActivityFeed';
import type { InstructorAtRiskStudentItem } from './InstructorAtRiskStudents';
import type { InstructorLearningTone } from './InstructorLearningDashboard';

function severityTone(value?: string | null): InstructorLearningTone {
  if (value === 'high') return 'danger';
  if (value === 'medium') return 'accent';
  if (value === 'low') return 'secondary';
  return 'muted';
}

function activitySubjectLabel(metadata?: Record<string, unknown> | null) {
  const subject = metadata?.courseTitle ?? metadata?.groupTitle ?? metadata?.sessionTitle ?? metadata?.title ?? metadata?.name;
  return typeof subject === 'string' && subject.trim() ? subject.trim() : null;
}

function activityTargetLabel(t: TFunction, value?: string | null, id?: string | null) {
  const target = enumLabel(value, activityTargetLabelKeys, t, t('overview.targetWorkspace'));
  return id ? t('overview.activityTargetWithId', { target, id }) : target;
}

function activityActionLabel(t: TFunction, value?: string | null) {
  return enumLabel(value, activityActionLabelKeys, t, t('overview.tenantTarget'));
}

export function mapInstructorActivityFeedItems(
  t: TFunction,
  overview: Pick<TenantOverview, 'activity'> | null | undefined,
): InstructorActivityFeedItem[] {
  return (overview?.activity ?? []).slice(0, 6).map((item: TenantActivityLog) => {
    const subject = activitySubjectLabel(item.metadata);
    const createdAt = item.createdAt ? new Date(item.createdAt) : null;
    const hasReviewSignal = ['review', 'submitted', 'pending'].some((signal) => item.action?.toLowerCase().includes(signal));

    return {
      id: item.id,
      title: subject ?? activityActionLabel(t, item.action),
      detail: subject
        ? `${activityActionLabel(t, item.action)} · ${activityTargetLabel(t, item.targetType, item.targetId)}`
        : activityTargetLabel(t, item.targetType, item.targetId),
      meta: item.actorFullName || item.actorEmail || undefined,
      time: createdAt && !Number.isNaN(createdAt.getTime()) ? formatDate(item.createdAt) : undefined,
      icon: hasReviewSignal ? <FiAlertTriangle /> : <FiActivity />,
      tone: hasReviewSignal ? 'accent' : 'success',
      to: '/sessions',
    };
  });
}

export function mapInstructorAtRiskStudents(
  t: TFunction,
  instructorDashboard: Pick<InstructorDashboard, 'attentionStudents'> | null | undefined,
): InstructorAtRiskStudentItem[] {
  return (instructorDashboard?.attentionStudents ?? []).slice(0, 5).map((student) => {
    const tone = severityTone(student.severity);
    const firstReasonRoute = student.reasons?.find((reason) => reason.route)?.route;

    return {
      id: student.studentId,
      name: student.fullName || t('overview.studentFallback', { id: student.studentId }),
      detail: [student.groupName, student.reasons?.length ? t('overview.activeItemCount', { count: student.reasons.length }) : null]
        .filter(Boolean)
        .join(' · '),
      severityLabel: student.severity ? t(`overview.riskSeverity.${student.severity}`, { defaultValue: student.severity }) : undefined,
      severityTone: tone,
      reasons: student.reasons?.map((reason) => ({
        label: reason.label || reason.code,
        to: reason.route,
      })),
      to: firstReasonRoute || '/groups',
    };
  });
}
