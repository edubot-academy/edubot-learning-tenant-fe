import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { FiAlertTriangle, FiCalendar, FiChevronLeft, FiChevronRight, FiEdit3, FiFileText, FiLifeBuoy, FiMail, FiPlus, FiUsers } from 'react-icons/fi';
import { EmptyState, LoadingState } from '../../components/DataState';
import { FormModal } from '../../components/Modal';
import { PageHeader } from '../../components/PageHeader';
import { StatGrid } from '../../components/StatGrid';
import {
  createStudentGuardian,
  createStudentSupportNote,
  getAssistantDashboard,
  getAssistantSupport,
  listCourseGroups,
  listGroupStudents,
  listStudentGuardians,
  listStudentSupportNotes,
  listTenantCourses,
  updateStudentSupportNote,
} from '../../services/api';
import type {
  AssistantDashboard,
  AssistantSupportItem,
  AssistantSupportReason,
  AssistantSupportResponse,
  Course,
  CourseGroup,
  GroupStudent,
  StudentGuardian,
  StudentSupportNote,
} from '../../types/domain';
import { formatDate } from '../../lib/format';
import { useAuth } from '../auth/AuthProvider';
import { useTenant } from '../tenant/TenantProvider';
import { canContactStudents, canEscalateOperationalIssues, canManageStudentSupportNotes } from '../tenant/tenantRoles';

type SupportReason = {
  key: string;
  tone: 'warning' | 'info';
  count?: number;
};

type SupportStudent = {
  userId: number;
  fullName?: string | null;
  email?: string | null;
  courseTitle: string;
  courseId?: number | null;
  groupName: string;
  groupId?: number | null;
  reasons: SupportReason[];
  nextAction?: string | null;
  guardianSummary?: AssistantSupportItem['guardianSummary'];
};

type GroupReadinessIssue = {
  key: string;
  route: string;
  title: string;
  detail: string;
  tone: 'warning' | 'info';
};

type NoteFormState = {
  note: string;
  priority: 'high' | 'medium' | 'low';
  status: 'open' | 'in_progress' | 'resolved';
  nextAction: string;
};

type GuardianFormState = {
  fullName: string;
  relationship: string;
  email: string;
  phone: string;
  preferredChannel: string;
  notes: string;
};

const emptyNoteForm: NoteFormState = {
  note: '',
  priority: 'medium',
  status: 'open',
  nextAction: '',
};

const emptyGuardianForm: GuardianFormState = {
  fullName: '',
  relationship: '',
  email: '',
  phone: '',
  preferredChannel: '',
  notes: '',
};

const SUPPORT_PAGE_LIMIT = 25;

function hasSchedule(group: CourseGroup) {
  return Boolean(group.scheduleBlocks?.some((block) => block.day && block.startTime && block.endTime));
}

function supportReasons(student: GroupStudent): SupportReason[] {
  const reasons: SupportReason[] = [];
  const progress = Number(student.progressPercent ?? 0);
  if (Number.isFinite(progress) && progress > 0 && progress < 35) reasons.push({ key: 'lowProgress', tone: 'warning' });
  if (!student.email) reasons.push({ key: 'missingEmail', tone: 'warning' });
  if (student.certificateEligible === false) reasons.push({ key: 'certificateBlocked', tone: 'info' });
  if (student.enrolledAt) {
    const enrolledAt = new Date(student.enrolledAt).getTime();
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    if (Number.isFinite(enrolledAt) && enrolledAt >= sevenDaysAgo) reasons.push({ key: 'recentEnrollment', tone: 'info' });
  }
  return reasons;
}

function backendReasonTone(reason: AssistantSupportReason): SupportReason['tone'] {
  return reason.severity === 'high' || reason.severity === 'medium' ? 'warning' : 'info';
}

function supportReasonsFromBackend(item: AssistantSupportItem): SupportReason[] {
  return (item.reasons ?? []).map((reason) => ({
    key: reason.code,
    tone: backendReasonTone(reason),
    count: reason.count,
  }));
}

function supportStudentFromBackend(item: AssistantSupportItem, fallbackCourseTitle: string, fallbackGroupName: string): SupportStudent {
  return {
    userId: item.studentId,
    fullName: item.fullName,
    email: item.email,
    courseId: item.courseId ?? undefined,
    groupId: item.groupId ?? undefined,
    groupName: item.groupName ?? fallbackGroupName,
    courseTitle: item.courseTitle ?? fallbackCourseTitle,
    reasons: supportReasonsFromBackend(item),
    nextAction: item.nextAction,
    guardianSummary: item.guardianSummary,
  };
}

export function StudentSupportPage() {
  const { t } = useTranslation();
  const { activeTenant } = useTenant();
  const { user } = useAuth();
  const activeTenantId = activeTenant?.id;
  const [courses, setCourses] = useState<Course[]>([]);
  const [groups, setGroups] = useState<CourseGroup[]>([]);
  const [students, setStudents] = useState<SupportStudent[]>([]);
  const [assistantDashboard, setAssistantDashboard] = useState<AssistantDashboard | null>(null);
  const [assistantSupport, setAssistantSupport] = useState<AssistantSupportResponse | null>(null);
  const [assistantSupportLoaded, setAssistantSupportLoaded] = useState(false);
  const [supportPage, setSupportPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'students' | 'groups'>('all');
  const [selectedStudent, setSelectedStudent] = useState<SupportStudent | null>(null);
  const [supportNotes, setSupportNotes] = useState<StudentSupportNote[]>([]);
  const [guardians, setGuardians] = useState<StudentGuardian[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [savingGuardian, setSavingGuardian] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [noteForm, setNoteForm] = useState<NoteFormState>(emptyNoteForm);
  const [guardianForm, setGuardianForm] = useState<GuardianFormState>(emptyGuardianForm);

  const canContact = canContactStudents(user, activeTenant);
  const canEscalate = canEscalateOperationalIssues(user, activeTenant);
  const canAddNotes = canManageStudentSupportNotes(user, activeTenant);

  const refreshAssistantSupport = async () => {
    if (!activeTenantId) return;
    const nextSupport = await getAssistantSupport(activeTenantId, { page: supportPage, limit: SUPPORT_PAGE_LIMIT, status: 'all' });
    setAssistantSupport(nextSupport);
    setAssistantSupportLoaded(true);
  };

  const loadLegacySupportFallback = useCallback(async (tenantId: number, cancelled: () => boolean) => {
    const nextCourses = await listTenantCourses(tenantId);
    if (cancelled()) return;
    setCourses(nextCourses);
    const groupResults = await Promise.all(
      nextCourses.map((course) => listCourseGroups(course.id).catch(() => [] as CourseGroup[])),
    );
    if (cancelled()) return;
    const nextGroups = groupResults.flat();
    setGroups(nextGroups);
    const courseTitleById = new Map(nextCourses.map((course) => [course.id, course.title]));
    const groupStudents = await Promise.all(
      nextGroups.map(async (group) => {
        const rows = await listGroupStudents(group.id).catch(() => [] as GroupStudent[]);
        return rows.map((student): SupportStudent => ({
          userId: student.userId,
          fullName: student.fullName,
          email: student.email,
          courseId: group.courseId,
          groupId: group.id,
          groupName: group.name,
          courseTitle: courseTitleById.get(group.courseId) ?? t('student.courseNotSet'),
          reasons: supportReasons(student),
        }));
      }),
    );
    if (!cancelled()) setStudents(groupStudents.flat());
  }, [t]);

  const loadStudentDetails = async (student: SupportStudent) => {
    if (!activeTenantId) return;
    setSelectedStudent(student);
    setSupportNotes([]);
    setGuardians([]);
    setEditingNoteId(null);
    setNoteForm(emptyNoteForm);
    setGuardianForm(emptyGuardianForm);
    setDetailLoading(true);
    try {
      const [nextNotes, nextGuardians] = await Promise.all([
        listStudentSupportNotes(activeTenantId, student.userId),
        listStudentGuardians(activeTenantId, student.userId),
      ]);
      setSupportNotes(nextNotes);
      setGuardians(nextGuardians);
    } catch {
      toast.error(t('support.detailLoadFailed'));
    } finally {
      setDetailLoading(false);
    }
  };

  const resetNoteForm = () => {
    setEditingNoteId(null);
    setNoteForm(emptyNoteForm);
  };

  const editNote = (note: StudentSupportNote) => {
    setEditingNoteId(note.id);
    setNoteForm({
      note: note.note,
      priority: note.priority === 'high' || note.priority === 'low' ? note.priority : 'medium',
      status: note.status === 'in_progress' || note.status === 'resolved' ? note.status : 'open',
      nextAction: note.nextAction ?? '',
    });
  };

  const submitNote = async () => {
    if (!activeTenantId || !selectedStudent || !noteForm.note.trim()) return;
    setSavingNote(true);
    try {
      if (editingNoteId) {
        const saved = await updateStudentSupportNote(activeTenantId, editingNoteId, {
          note: noteForm.note.trim(),
          priority: noteForm.priority,
          status: noteForm.status,
          nextAction: noteForm.nextAction.trim() || null,
        });
        setSupportNotes((current) => current.map((note) => (note.id === saved.id ? saved : note)));
        toast.success(t('support.noteUpdated'));
      } else {
        const saved = await createStudentSupportNote(activeTenantId, {
          studentId: selectedStudent.userId,
          note: noteForm.note.trim(),
          priority: noteForm.priority,
          ownerRole: 'assistant',
          nextAction: noteForm.nextAction.trim() || null,
        });
        setSupportNotes((current) => [saved, ...current]);
        toast.success(t('support.noteCreated'));
      }
      resetNoteForm();
      await refreshAssistantSupport().catch(() => undefined);
    } catch {
      toast.error(t('support.noteSaveFailed'));
    } finally {
      setSavingNote(false);
    }
  };

  const submitGuardian = async () => {
    if (!activeTenantId || !selectedStudent || !guardianForm.fullName.trim()) return;
    setSavingGuardian(true);
    try {
      const saved = await createStudentGuardian(activeTenantId, {
        studentId: selectedStudent.userId,
        fullName: guardianForm.fullName.trim(),
        relationship: guardianForm.relationship.trim() || null,
        email: guardianForm.email.trim() || null,
        phone: guardianForm.phone.trim() || null,
        preferredChannel: guardianForm.preferredChannel.trim() || null,
        notes: guardianForm.notes.trim() || null,
      });
      setGuardians((current) => [saved, ...current]);
      setGuardianForm(emptyGuardianForm);
      toast.success(t('support.guardianCreated'));
      await refreshAssistantSupport().catch(() => undefined);
    } catch {
      toast.error(t('support.guardianSaveFailed'));
    } finally {
      setSavingGuardian(false);
    }
  };

  useEffect(() => {
    setCourses([]);
    setGroups([]);
    setStudents([]);
    setAssistantDashboard(null);
    setAssistantSupport(null);
    setAssistantSupportLoaded(false);
    setSupportPage(1);
    if (!activeTenantId) setLoading(false);
  }, [activeTenantId]);

  useEffect(() => {
    if (!activeTenantId) return;
    let cancelled = false;
    void getAssistantDashboard(activeTenantId)
      .then((nextDashboard) => {
        if (!cancelled) setAssistantDashboard(nextDashboard);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [activeTenantId]);

  useEffect(() => {
    if (!activeTenantId) return;
    let cancelled = false;
    setLoading(true);
    void getAssistantSupport(activeTenantId, { page: supportPage, limit: SUPPORT_PAGE_LIMIT, status: 'all' })
      .then((nextSupport) => {
        if (cancelled) return;
        setAssistantSupport(nextSupport);
        setAssistantSupportLoaded(true);
      })
      .catch(async () => {
        if (cancelled) return;
        setAssistantSupportLoaded(false);
        await loadLegacySupportFallback(activeTenantId, () => cancelled);
      })
      .catch(() => {
        if (!cancelled) toast.error(t('support.loadFailed'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTenantId, loadLegacySupportFallback, supportPage, t]);

  const dashboardActions = useMemo(() => assistantDashboard?.actionQueue ?? [], [assistantDashboard?.actionQueue]);
  const actionRoute = useCallback((route?: string | null) => {
    return route && route.startsWith('/') ? route : '/support';
  }, []);
  const actionTone = useCallback((priority?: string | null) => {
    return priority === 'high' ? 'warning' : 'info';
  }, []);
  const actionTitle = useCallback((action: AssistantDashboard['actionQueue'][number]) => {
    return action.i18nKey ? t(action.i18nKey, action.params ?? {}) : action.title ?? action.type;
  }, [t]);
  const groupIssues = useMemo<GroupReadinessIssue[]>(() => {
    if (assistantDashboard) {
      const groupActionTypes = new Set(['missing_instructor', 'missing_schedule', 'missing_meeting']);
      return dashboardActions
        .filter((action) => groupActionTypes.has(action.type))
        .map((action) => ({
          key: action.id,
          route: actionRoute(action.route),
          title: actionTitle(action),
          detail: action.detail ?? t('support.groupReadiness'),
          tone: actionTone(action.priority),
        }));
    }
    const courseTitleById = new Map(courses.map((course) => [course.id, course.title]));
    return groups.flatMap((group) => {
      const route = `/sessions?courseId=${group.courseId}&groupId=${group.id}`;
      const context = `${courseTitleById.get(group.courseId) ?? t('student.courseNotSet')} · ${group.name}`;
      return [
        ...(!group.instructorId ? [{
          key: `instructor-${group.id}`,
          route,
          title: t('support.missingInstructor'),
          detail: context,
          tone: 'warning' as const,
        }] : []),
        ...(!hasSchedule(group) ? [{
          key: `schedule-${group.id}`,
          route,
          title: t('support.missingSchedule'),
          detail: context,
          tone: 'warning' as const,
        }] : []),
        ...(!group.meetingUrl ? [{
          key: `meeting-${group.id}`,
          route,
          title: t('support.missingMeeting'),
          detail: context,
          tone: 'info' as const,
        }] : []),
      ];
    });
  }, [actionRoute, actionTitle, actionTone, assistantDashboard, courses, dashboardActions, groups, t]);

  const backendSupportStudents = useMemo(
    () => (assistantSupport?.items ?? []).map((item) => supportStudentFromBackend(
      item,
      t('student.courseNotSet'),
      t('support.groupNotSet'),
    )),
    [assistantSupport?.items, t],
  );
  const supportStudents = useMemo(
    () => (assistantSupportLoaded ? backendSupportStudents : students.filter((student) => student.reasons.length > 0)),
    [assistantSupportLoaded, backendSupportStudents, students],
  );
  const showStudentSection = filter !== 'groups';
  const showGroupSection = filter !== 'students';
  const visibleStudents = showStudentSection ? supportStudents : [];
  const visibleGroupIssues = showGroupSection ? groupIssues : [];

  const reasonLabel = (reason: SupportReason) => {
    const labels: Record<string, string> = {
      lowProgress: t('support.reasonLowProgress'),
      missingEmail: t('support.reasonMissingEmail'),
      certificateBlocked: t('support.reasonCertificateBlocked'),
      recentEnrollment: t('support.reasonRecentEnrollment'),
      low_progress: t('support.reasonLowProgress'),
      missing_homework: t('support.reasonMissingHomework', { count: reason.count ?? 0 }),
      open_support_note: t('support.reasonOpenSupportNote'),
    };
    return labels[reason.key] ?? reason.key;
  };
  const groupRoute = (student: SupportStudent) => {
    const params = new URLSearchParams();
    if (student.courseId) params.set('courseId', String(student.courseId));
    if (student.groupId) params.set('groupId', String(student.groupId));
    const query = params.toString();
    return query ? `/sessions?${query}` : '/support';
  };
  const currentSupportPage = assistantSupport?.page ?? supportPage;
  const totalSupportPages = assistantSupport?.totalPages ?? 0;
  const hasSupportPagination = assistantSupportLoaded && totalSupportPages > 1 && filter !== 'groups';

  if (loading) return <LoadingState label={t('support.loading')} />;

  return (
    <>
      <PageHeader
        title={t('support.title')}
        eyebrow={activeTenant?.name}
        actions={(
          <div className="segmented-control" aria-label={t('support.filters')}>
            {(['all', 'students', 'groups'] as const).map((item) => (
              <button type="button" className={filter === item ? 'active' : ''} onClick={() => setFilter(item)} key={item}>
                {t(`support.filter.${item}`)}
              </button>
            ))}
          </div>
        )}
      />

      <StatGrid
        items={[
          { label: t('support.studentsToSupport'), value: assistantSupport?.summary.studentsNeedingSupport ?? assistantDashboard?.operations.studentsNeedingSupport ?? supportStudents.length, hint: t('support.studentsToSupportHint') },
          { label: t('support.groupIssues'), value: assistantDashboard?.operations.blockedItems ?? groupIssues.length, hint: t('support.groupIssuesHint') },
          { label: t('support.activeGroups'), value: assistantDashboard?.operations.activeGroups ?? groups.length, hint: t('support.activeGroupsHint') },
          { label: t('support.supportActions'), value: [canContact, canEscalate, canAddNotes].filter(Boolean).length, hint: t('support.supportActionsHint') },
        ]}
      />

      <section className="overview-priority-strip" aria-label={t('support.queue')}>
        <div className="overview-priority-heading">
          <span className="ui-kicker">{t('support.queue')}</span>
          <strong>{t('overview.activeItemCount', { count: dashboardActions.length || assistantSupport?.total || visibleStudents.length + visibleGroupIssues.length })}</strong>
        </div>
        <div className="overview-priority-list">
          {dashboardActions.slice(0, 4).map((action) => (
            <Link className={`overview-priority-card ${actionTone(action.priority)}`} to={actionRoute(action.route)} key={action.id}>
              <FiAlertTriangle />
              <span>
                <strong>{actionTitle(action)}</strong>
                {action.detail ? <small>{action.detail}</small> : null}
              </span>
            </Link>
          ))}
          {!dashboardActions.length ? visibleGroupIssues.slice(0, 4).map((issue) => (
            <Link className={`overview-priority-card ${issue.tone}`} to={issue.route} key={issue.key}>
              <FiAlertTriangle />
              <span>
                <strong>{issue.title}</strong>
                <small>{issue.detail}</small>
              </span>
            </Link>
          )) : null}
          {!dashboardActions.length ? visibleStudents.slice(0, Math.max(0, 4 - visibleGroupIssues.length)).map((student) => (
            <Link className="overview-priority-card warning" to={groupRoute(student)} key={`${student.groupId ?? 'student'}-${student.userId}`}>
              <FiLifeBuoy />
              <span>
                <strong>{student.fullName || student.email || t('courses.studentFallback', { id: student.userId })}</strong>
                <small>{student.reasons.map((reason) => reasonLabel(reason)).join(' · ')}</small>
              </span>
            </Link>
          )) : null}
        </div>
      </section>

      <div className="workspace-grid overview-grid">
        {showStudentSection ? (
        <section className="content-section">
          <div className="section-heading-row">
            <div>
              <h2>{t('support.studentQueue')}</h2>
              <span>{t('support.studentQueueDetail')}</span>
            </div>
            <FiUsers />
          </div>
          {visibleStudents.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t('courses.student')}</th>
                    <th>{t('courses.group')}</th>
                    <th>{t('support.reasons')}</th>
                    <th>{t('support.nextAction')}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleStudents.map((student) => (
                    <tr key={`${student.groupId ?? 'student'}-${student.userId}`}>
                      <td>
                        <strong>{student.fullName || student.email || t('courses.studentFallback', { id: student.userId })}</strong>
                        {student.email ? <small>{student.email}</small> : null}
                      </td>
                      <td>
                        <Link className="table-primary-link" to={groupRoute(student)}>{student.groupName}</Link>
                        <small>{student.courseTitle}</small>
                      </td>
                      <td>
                        <div className="activity-actions">
                          {student.reasons.map((reason) => (
                            <span className={`status-badge ${reason.tone === 'warning' ? 'pending_approval' : 'published'}`} key={reason.key}>
                              {reasonLabel(reason)}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <div className="activity-actions">
                          {canContact && student.email ? (
                            <a className="secondary-link-button" href={`mailto:${student.email}`}><FiMail /> {t('support.contact')}</a>
                          ) : null}
                          {canEscalate ? <Link className="link-button" to={groupRoute(student)}>{t('support.escalate')}</Link> : null}
                          {canAddNotes ? (
                            <button type="button" className="secondary-button" onClick={() => void loadStudentDetails(student)}>
                              <FiFileText /> {t('support.manageSupport')}
                            </button>
                          ) : null}
                          {!canContact && !canEscalate && !canAddNotes ? <span className="metadata-text">{t('support.viewOnly')}</span> : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title={t('support.noStudentIssuesTitle')} detail={t('support.noStudentIssuesDetail')} />
          )}
          {hasSupportPagination ? (
            <div className="page-actions" aria-label={t('support.pagination')}>
              <button
                type="button"
                className="secondary-button"
                disabled={currentSupportPage <= 1}
                onClick={() => setSupportPage((current) => Math.max(1, current - 1))}
                aria-label={t('support.previousPage')}
              >
                <FiChevronLeft /> {t('support.previousPage')}
              </button>
              <span className="metadata-text">{t('support.pageSummary', { page: currentSupportPage, totalPages: totalSupportPages })}</span>
              <button
                type="button"
                className="secondary-button"
                disabled={currentSupportPage >= totalSupportPages}
                onClick={() => setSupportPage((current) => Math.min(totalSupportPages, current + 1))}
                aria-label={t('support.nextPage')}
              >
                {t('support.nextPage')} <FiChevronRight />
              </button>
            </div>
          ) : null}
        </section>
        ) : null}

        {showGroupSection ? (
        <aside className="settings-panel workflow-context-panel">
          <div className="section-heading-row compact">
            <div>
              <h2>{t('support.groupReadiness')}</h2>
              <span>{t('support.groupReadinessDetail')}</span>
            </div>
            <FiCalendar />
          </div>
          <div className="stack-list">
            {visibleGroupIssues.map((issue) => (
              <Link className="stack-list-item" to={issue.route} key={issue.key}>
                <div>
                  <strong>{issue.title}</strong>
                  <span>{issue.detail}</span>
                </div>
                <span className={`status-badge ${issue.tone === 'warning' ? 'pending_approval' : 'published'}`}>{t('student.open')}</span>
              </Link>
            ))}
            {!visibleGroupIssues.length ? <EmptyState title={t('support.noGroupIssuesTitle')} detail={t('support.noGroupIssuesDetail')} /> : null}
          </div>
        </aside>
        ) : null}
      </div>

      <section className="settings-panel full">
        <div className="section-heading-row">
          <div>
            <h2>{t('support.guardianReadiness')}</h2>
            <span>{t('support.guardianReadinessDetail')}</span>
          </div>
          <span className="status-badge pending">{t('support.future')}</span>
        </div>
        <div className="stat-grid compact session-stat-grid">
          <section className="stat-tile"><span>{t('support.guardianVisibility')}</span><strong>{t('overview.disabled')}</strong></section>
          <section className="stat-tile"><span>{t('support.guardianContact')}</span><strong>{t('overview.disabled')}</strong></section>
          <section className="stat-tile"><span>{t('support.lastLoaded')}</span><strong>{formatDate(new Date().toISOString())}</strong></section>
        </div>
      </section>

      {selectedStudent ? (
        <FormModal
          labelledBy="support-student-detail-title"
          className="decision-modal form-modal support-detail-modal"
          onClose={() => setSelectedStudent(null)}
          onSubmit={(event) => event.preventDefault()}
        >
          <div className="modal-header-block">
            <span>{selectedStudent.groupName}</span>
            <h2 id="support-student-detail-title">
              {selectedStudent.fullName || selectedStudent.email || t('courses.studentFallback', { id: selectedStudent.userId })}
            </h2>
            <p>{selectedStudent.courseTitle}</p>
          </div>

          {detailLoading ? <LoadingState label={t('support.loadingDetails')} /> : (
            <>
              <section className="settings-panel full">
                <div className="section-heading-row">
                  <div>
                    <h3>{t('support.supportNotes')}</h3>
                    <span>{t('support.supportNotesDetail')}</span>
                  </div>
                  <span className="status-badge published">{supportNotes.length}</span>
                </div>
                <div className="stack-list">
                  {supportNotes.map((note) => (
                    <article className="stack-list-item" key={note.id}>
                      <div>
                        <strong>{note.nextAction || t('support.noteFallbackTitle')}</strong>
                        <span>{note.note}</span>
                        <small className="metadata-text">{formatDate(note.updatedAt ?? note.createdAt ?? new Date().toISOString())}</small>
                      </div>
                      <div className="activity-actions">
                        <span className={`status-badge ${note.status === 'resolved' ? 'published' : 'pending_approval'}`}>
                          {t(`support.noteStatus.${note.status === 'in_progress' || note.status === 'resolved' ? note.status : 'open'}`)}
                        </span>
                        <button type="button" className="secondary-button" onClick={() => editNote(note)}>
                          <FiEdit3 /> {t('common.edit')}
                        </button>
                      </div>
                    </article>
                  ))}
                  {!supportNotes.length ? <EmptyState title={t('support.noNotesTitle')} detail={t('support.noNotesDetail')} /> : null}
                </div>

                <div className="two-col support-form-grid">
                  <label className="wide-field">
                    <span>{t('support.note')}</span>
                    <textarea value={noteForm.note} onChange={(event) => setNoteForm((current) => ({ ...current, note: event.target.value }))} placeholder={t('support.notePlaceholder')} />
                  </label>
                  <label>
                    <span>{t('support.priority')}</span>
                    <select value={noteForm.priority} onChange={(event) => setNoteForm((current) => ({ ...current, priority: event.target.value as NoteFormState['priority'] }))}>
                      <option value="high">{t('support.priorityLabel.high')}</option>
                      <option value="medium">{t('support.priorityLabel.medium')}</option>
                      <option value="low">{t('support.priorityLabel.low')}</option>
                    </select>
                  </label>
                  <label>
                    <span>{t('support.status')}</span>
                    <select value={noteForm.status} onChange={(event) => setNoteForm((current) => ({ ...current, status: event.target.value as NoteFormState['status'] }))}>
                      <option value="open">{t('support.noteStatus.open')}</option>
                      <option value="in_progress">{t('support.noteStatus.in_progress')}</option>
                      <option value="resolved">{t('support.noteStatus.resolved')}</option>
                    </select>
                  </label>
                  <label className="wide-field">
                    <span>{t('support.nextAction')}</span>
                    <input value={noteForm.nextAction} onChange={(event) => setNoteForm((current) => ({ ...current, nextAction: event.target.value }))} placeholder={t('support.nextActionPlaceholder')} />
                  </label>
                </div>
                <div className="modal-actions">
                  {editingNoteId ? <button type="button" className="secondary-button" onClick={resetNoteForm}>{t('student.cancel')}</button> : null}
                  <button type="button" onClick={() => void submitNote()} disabled={savingNote || !noteForm.note.trim()}>
                    {editingNoteId ? t('support.updateNote') : t('support.createNote')}
                  </button>
                </div>
              </section>

              <section className="settings-panel full">
                <div className="section-heading-row">
                  <div>
                    <h3>{t('support.guardians')}</h3>
                    <span>{t('support.guardiansDetail')}</span>
                  </div>
                  <span className="status-badge pending">{t('support.guardianContactDisabled')}</span>
                </div>
                <div className="stack-list">
                  {guardians.map((guardian) => (
                    <article className="stack-list-item" key={guardian.id}>
                      <div>
                        <strong>{guardian.fullName}</strong>
                        <span>{[guardian.relationship, guardian.email, guardian.phone].filter(Boolean).join(' · ') || t('states.notSet')}</span>
                        {guardian.notes ? <small className="metadata-text">{guardian.notes}</small> : null}
                      </div>
                      <span className={`status-badge ${guardian.consentStatus === 'granted' ? 'approved' : 'pending'}`}>
                        {t(`support.guardianConsent.${guardian.consentStatus === 'granted' || guardian.consentStatus === 'revoked' ? guardian.consentStatus : 'pending'}`)}
                      </span>
                    </article>
                  ))}
                  {!guardians.length ? <EmptyState title={t('support.noGuardiansTitle')} detail={t('support.noGuardiansDetail')} /> : null}
                </div>

                <div className="two-col support-form-grid">
                  <label>
                    <span>{t('support.guardianName')}</span>
                    <input value={guardianForm.fullName} onChange={(event) => setGuardianForm((current) => ({ ...current, fullName: event.target.value }))} placeholder={t('support.guardianNamePlaceholder')} />
                  </label>
                  <label>
                    <span>{t('support.relationship')}</span>
                    <input value={guardianForm.relationship} onChange={(event) => setGuardianForm((current) => ({ ...current, relationship: event.target.value }))} placeholder={t('support.relationshipPlaceholder')} />
                  </label>
                  <label>
                    <span>{t('support.guardianEmail')}</span>
                    <input type="email" value={guardianForm.email} onChange={(event) => setGuardianForm((current) => ({ ...current, email: event.target.value }))} placeholder="parent@example.com" />
                  </label>
                  <label>
                    <span>{t('support.guardianPhone')}</span>
                    <input value={guardianForm.phone} onChange={(event) => setGuardianForm((current) => ({ ...current, phone: event.target.value }))} placeholder="+996" />
                  </label>
                  <label>
                    <span>{t('support.preferredChannel')}</span>
                    <select value={guardianForm.preferredChannel} onChange={(event) => setGuardianForm((current) => ({ ...current, preferredChannel: event.target.value }))}>
                      <option value="">{t('states.notSet')}</option>
                      <option value="email">{t('support.channel.email')}</option>
                      <option value="phone">{t('support.channel.phone')}</option>
                      <option value="whatsapp">{t('support.channel.whatsapp')}</option>
                    </select>
                  </label>
                  <label className="wide-field">
                    <span>{t('support.guardianNotes')}</span>
                    <textarea value={guardianForm.notes} onChange={(event) => setGuardianForm((current) => ({ ...current, notes: event.target.value }))} placeholder={t('support.guardianNotesPlaceholder')} />
                  </label>
                </div>
                <p className="metadata-text">{t('support.guardianPolicyNote')}</p>
                <div className="modal-actions">
                  <button type="button" onClick={() => void submitGuardian()} disabled={savingGuardian || !guardianForm.fullName.trim()}>
                    <FiPlus /> {t('support.addGuardian')}
                  </button>
                </div>
              </section>
            </>
          )}
        </FormModal>
      ) : null}
    </>
  );
}
