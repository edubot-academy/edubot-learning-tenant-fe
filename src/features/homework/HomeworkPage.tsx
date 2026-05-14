import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { FiBookOpen, FiCalendar, FiCheckCircle, FiClipboard, FiPlus, FiUsers } from 'react-icons/fi';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState, LoadingState } from '../../components/DataState';
import { FormModal, Modal } from '../../components/Modal';
import { CountFilterRow } from '../../components/CountFilterRow';
import {
  filterHomeworkReviewItems,
  getHomeworkFormErrors,
  getHomeworkReviewBlocker,
  isHomeworkSessionReady,
  reviewFilters,
  type ReviewFilter,
} from './homeworkWorkflow';
import {
  createSessionHomework,
  deleteSessionHomework,
  getHomeworkReviewQueue,
  getHomeworkReviewRoster,
  getHomeworkSummary,
  listCourseGroups,
  listGroupSessions,
  listGroupStudents,
  listHomework,
  listSessionHomework,
  listTenantCourses,
  openHomeworkSubmissionAttachment,
  reviewHomeworkSubmission,
  updateSessionHomework,
} from '../../services/api';
import type { Course, CourseGroup, CourseSession, GroupStudent, HomeworkReviewQueue, HomeworkReviewRoster, SessionHomework } from '../../types/domain';
import { useTenant } from '../tenant/TenantProvider';
import { formatDate } from '../../lib/format';
import { commonStatusLabelKeys, enumLabel } from '../../lib/enumLabels';
import { isCourseWorkflowReady, nextWorkflowSearchParams } from '../workflows/workflowContext';

const emptyForm = {
  title: '',
  description: '',
  dueAt: '',
  maxScore: '',
  isPublished: true,
  assignedStudentIds: [] as number[],
};

function isHomeworkCourseReady(course: Course | undefined | null) {
  return isCourseWorkflowReady(course);
}

export function HomeworkPage() {
  const { t } = useTranslation();
  const { activeTenant } = useTenant();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTenantId = activeTenant?.id;
  const requestedCourseId = Number(searchParams.get('courseId')) || undefined;
  const requestedGroupId = Number(searchParams.get('groupId')) || undefined;
  const requestedSessionId = Number(searchParams.get('sessionId')) || undefined;
  const requestedHomeworkId = Number(searchParams.get('homeworkId')) || undefined;
  const searchParamsString = searchParams.toString();
  const [courses, setCourses] = useState<Course[]>([]);
  const [groups, setGroups] = useState<CourseGroup[]>([]);
  const [sessions, setSessions] = useState<CourseSession[]>([]);
  const [students, setStudents] = useState<GroupStudent[]>([]);
  const [courseId, setCourseId] = useState<number | undefined>();
  const [groupId, setGroupId] = useState<number | undefined>();
  const [sessionId, setSessionId] = useState<number | undefined>();
  const [summary, setSummary] = useState<Record<string, number> | null>(null);
  const [reviewQueue, setReviewQueue] = useState<HomeworkReviewQueue | null>(null);
  const [items, setItems] = useState<SessionHomework[]>([]);
  const [sessionItems, setSessionItems] = useState<SessionHomework[]>([]);
  const [selectedHomeworkId, setSelectedHomeworkId] = useState<number | undefined>();
  const [reviewRoster, setReviewRoster] = useState<HomeworkReviewRoster | null>(null);
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('needsReview');
  const [reviewDrafts, setReviewDrafts] = useState<Record<number, { score: string; reviewComment: string }>>({});
  const [expandedReviewStudentId, setExpandedReviewStudentId] = useState<number | undefined>();
  const [assigneeQuery, setAssigneeQuery] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editHomeworkId, setEditHomeworkId] = useState<number | undefined>();
  const [editForm, setEditForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [homeworkPendingDelete, setHomeworkPendingDelete] = useState<SessionHomework | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewingSubmission, setReviewingSubmission] = useState<number | undefined>();

  const selectedCourse = useMemo(() => courses.find((course) => course.id === courseId), [courseId, courses]);
  const selectedGroup = useMemo(() => groups.find((group) => group.id === groupId), [groupId, groups]);
  const selectedSession = useMemo(() => sessions.find((session) => session.id === sessionId), [sessionId, sessions]);
  const selectedSessionReady = isHomeworkSessionReady(selectedSession);
  const selectedHomework = useMemo(
    () => sessionItems.find((item) => item.id === selectedHomeworkId),
    [selectedHomeworkId, sessionItems],
  );
  const sessionHomeworkSummary = useMemo(() => {
    const needsReview = sessionItems.reduce((total, item) => total + (item.queue?.needsReview ?? 0), 0);
    const missing = sessionItems.reduce((total, item) => total + (item.queue?.missing ?? 0), 0);
    const assigned = sessionItems.reduce((total, item) => total + (item.queue?.assigned ?? 0), 0);
    return { total: sessionItems.length, needsReview, missing, assigned };
  }, [sessionItems]);
  const visibleAssignees = useMemo(() => {
    const normalized = assigneeQuery.trim().toLowerCase();
    if (!normalized) return students;
    return students.filter((student) => (
      (student.fullName ?? '').toLowerCase().includes(normalized)
      || (student.email ?? '').toLowerCase().includes(normalized)
      || String(student.userId).includes(normalized)
    ));
  }, [assigneeQuery, students]);

  const workflowSteps = [
    {
      label: t('courses.course'),
      value: selectedCourse?.title ?? t('sessions.chooseCourse'),
      icon: FiBookOpen,
      state: courseId ? 'ready' : 'current',
    },
    {
      label: t('courses.group'),
      value: selectedGroup?.name ?? t('attendance.chooseGroup'),
      icon: FiUsers,
      state: groupId ? 'ready' : courseId ? 'current' : 'locked',
    },
    {
      label: t('courses.sessions'),
      value: selectedSession?.title ?? t('sessions.chooseSession'),
      icon: FiCalendar,
      state: sessionId ? 'ready' : groupId ? 'current' : 'locked',
    },
    {
      label: t('homework.review'),
      value: selectedHomework?.title ?? t('homework.selectHomework'),
      icon: FiCheckCircle,
      state: selectedHomeworkId ? 'ready' : sessionId ? 'current' : 'locked',
    },
  ];

  const filteredReviewItems = useMemo(() => {
    const rows = reviewRoster?.items ?? [];
    return filterHomeworkReviewItems(rows, reviewFilter);
  }, [reviewFilter, reviewRoster?.items]);
  const homeworkFormMessage = (message?: string) => {
    if (!message) return '';
    const messages: Record<string, string> = {
      'Select a scheduled or completed session before creating homework.': t('homework.errorSessionReady'),
      'Select a session before creating homework.': t('homework.errorSessionRequired'),
      'Homework title is required.': t('homework.errorTitleRequired'),
      'Max score cannot be negative.': t('homework.errorMaxScoreNegative'),
    };
    return messages[message] ?? message;
  };
  const reviewBlockerMessage = (message?: string) => {
    if (!message) return '';
    const messages: Record<string, string> = {
      'Review comment is required.': t('homework.errorReviewCommentRequired'),
      'Score must be a number.': t('homework.errorScoreNumber'),
    };
    return messages[message] ?? message;
  };
  const summaryLabel = (key: string) => {
    const labels: Record<string, string> = {
      assigned: t('homework.assigned'),
      missing: t('homework.missing'),
      needsReview: t('homework.needReview'),
      overdue: t('homework.overdue'),
      total: t('homework.assignments'),
    };
    return labels[key] ?? enumLabel(key, commonStatusLabelKeys, t);
  };
  const reviewFilterLabel = (key: ReviewFilter) => {
    const labels: Record<ReviewFilter, string> = {
      approved: t('homework.reviewApproved'),
      late: t('homework.reviewLate'),
      missing: t('homework.reviewMissing'),
      needsReview: t('homework.reviewNeedsReview'),
      needsRevision: t('homework.reviewNeedsRevision'),
      total: t('homework.reviewAll'),
    };
    return labels[key];
  };
  const reviewStateLabel = (state: string) => {
    const labels: Record<string, string> = {
      approved: t('homework.reviewApproved'),
      missing: t('homework.reviewMissing'),
      needs_review: t('homework.reviewNeedsReview'),
      needs_revision: t('homework.reviewNeedsRevision'),
      rejected: t('homework.reviewRejected'),
      submitted: t('homework.reviewSubmitted'),
    };
    return labels[state] ?? enumLabel(state, commonStatusLabelKeys, t);
  };
  const homeworkQueueCount = (
    homework: SessionHomework,
    key: 'needsReview' | 'missing' | 'needsRevision' | 'assigned' | 'submitted' | 'late',
  ) => {
    const queue = homework.queue;
    if (!queue) return 0;
    const countKey = `${key}Count` as keyof NonNullable<SessionHomework['queue']>;
    return Number(queue[key] ?? queue[countKey] ?? 0);
  };
  const studentFallback = (id: number) => t('courses.studentFallback', { id });
  const selectedCountLabel = (count: number) => (
    count ? t('homework.selectedCount', { count }) : t('homework.allStudentsInGroup')
  );

  useEffect(() => {
    setCourses([]);
    setGroups([]);
    setSessions([]);
    setStudents([]);
    setCourseId(undefined);
    setGroupId(undefined);
    setSessionId(undefined);
    setItems([]);
    setReviewQueue(null);
    setSessionItems([]);
    setSummary(null);
    setSelectedHomeworkId(undefined);
    setReviewRoster(null);
    if (!activeTenantId) return;
    let cancelled = false;
    listTenantCourses(activeTenantId)
      .then((nextCourses) => {
        if (cancelled) return;
        const readyCourses = nextCourses.filter(isHomeworkCourseReady);
        setCourses(readyCourses);
      })
      .catch(() => {
        if (!cancelled) toast.error(t('courses.loadFailed'));
      });
    return () => {
      cancelled = true;
    };
  }, [activeTenantId, t]);

  useEffect(() => {
    setReviewQueue(null);
    if (!activeTenantId) return;
    let cancelled = false;
    getHomeworkReviewQueue({ limit: 20 })
      .then((nextQueue) => {
        if (!cancelled) setReviewQueue(nextQueue);
      })
      .catch(() => {
        if (!cancelled) setReviewQueue(null);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTenantId]);

  useEffect(() => {
    setCourseId((current) => {
      if (!courses.length) return undefined;
      if (requestedCourseId && courses.some((course) => course.id === requestedCourseId)) return requestedCourseId;
      return current && courses.some((course) => course.id === current) ? current : courses[0]?.id;
    });
  }, [courses, requestedCourseId]);

  useEffect(() => {
    if (!courseId) {
      setSummary(null);
      setItems([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    Promise.all([getHomeworkSummary(courseId, groupId), listHomework(courseId, groupId)])
      .then(([nextSummary, nextItems]) => {
        if (cancelled) return;
        setSummary(nextSummary);
        setItems(nextItems);
      })
      .catch(() => {
        if (!cancelled) toast.error(t('homework.loadFailed'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [courseId, groupId, t]);

  useEffect(() => {
    setGroups([]);
    setSessions([]);
    setStudents([]);
    setSessionItems([]);
    setSelectedHomeworkId(undefined);
    setReviewRoster(null);
    setReviewFilter('needsReview');
    setReviewDrafts({});
    setExpandedReviewStudentId(undefined);
    setGroupId(undefined);
    setSessionId(undefined);
    if (!courseId) return;
    let cancelled = false;
    listCourseGroups(courseId)
      .then((nextGroups) => {
        if (cancelled) return;
        setGroups(nextGroups);
      })
      .catch(() => {
        if (!cancelled) toast.error(t('groups.courseGroupsLoadFailed'));
      });
    return () => {
      cancelled = true;
    };
  }, [courseId, t]);

  useEffect(() => {
    setGroupId((current) => {
      if (!groups.length) return undefined;
      if (requestedGroupId && groups.some((group) => group.id === requestedGroupId)) return requestedGroupId;
      return current && groups.some((group) => group.id === current) ? current : groups[0]?.id;
    });
  }, [groups, requestedGroupId]);

  useEffect(() => {
    setSessions([]);
    setStudents([]);
    setSessionItems([]);
    setSelectedHomeworkId(undefined);
    setReviewRoster(null);
    setReviewFilter('needsReview');
    setReviewDrafts({});
    setExpandedReviewStudentId(undefined);
    setEditHomeworkId(undefined);
    setSessionId(undefined);
    if (!groupId) return;
    let cancelled = false;
    Promise.all([listGroupSessions(groupId), listGroupStudents(groupId)])
      .then(([nextSessions, nextStudents]) => {
        if (cancelled) return;
        const readySessions = nextSessions.filter(isHomeworkSessionReady);
        setSessions(readySessions);
        setStudents(nextStudents);
      })
      .catch(() => {
        if (!cancelled) toast.error(t('sessions.groupSessionsLoadFailed'));
      });
    return () => {
      cancelled = true;
    };
  }, [groupId, t]);

  useEffect(() => {
    setSessionId((current) => {
      if (!sessions.length) return undefined;
      if (requestedSessionId && sessions.some((session) => session.id === requestedSessionId)) return requestedSessionId;
      return current && sessions.some((session) => session.id === current) ? current : sessions[0]?.id;
    });
  }, [sessions, requestedSessionId]);

  useEffect(() => {
    const next = nextWorkflowSearchParams(searchParamsString, { courseId, groupId, sessionId });
    if (next.toString() !== searchParamsString) setSearchParams(next, { replace: true });
  }, [courseId, groupId, sessionId, searchParamsString, setSearchParams]);

  useEffect(() => {
    setSessionItems([]);
    setSelectedHomeworkId(undefined);
    setReviewRoster(null);
    setReviewFilter('needsReview');
    setReviewDrafts({});
    setExpandedReviewStudentId(undefined);
    setEditHomeworkId(undefined);
    if (!sessionId) return;
    let cancelled = false;
    listSessionHomework(sessionId)
      .then((nextSessionItems) => {
        if (!cancelled) setSessionItems(nextSessionItems);
      })
      .catch(() => {
        if (!cancelled) toast.error(t('homework.sessionLoadFailed'));
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, t]);

  const loadReviewRoster = useCallback(async (homeworkId: number) => {
    if (!sessionId) return;
    setSelectedHomeworkId(homeworkId);
    setReviewFilter('needsReview');
    setExpandedReviewStudentId(undefined);
    setReviewLoading(true);
    try {
      const roster = await getHomeworkReviewRoster(sessionId, homeworkId);
      setReviewRoster(roster);
      const drafts: Record<number, { score: string; reviewComment: string }> = {};
      roster.items.forEach((item) => {
        if (item.submission?.id) {
          drafts[item.submission.id] = {
            score: item.submission.score === undefined || item.submission.score === null ? '' : String(item.submission.score),
            reviewComment: item.submission.reviewComment ?? '',
          };
        }
      });
      setReviewDrafts(drafts);
    } catch {
      toast.error(t('homework.reviewRosterLoadFailed'));
    } finally {
      setReviewLoading(false);
    }
  }, [sessionId, t]);

  useEffect(() => {
    if (!requestedHomeworkId || !sessionId || selectedHomeworkId === requestedHomeworkId) return;
    if (!sessionItems.some((item) => item.id === requestedHomeworkId)) return;
    void loadReviewRoster(requestedHomeworkId);
  }, [loadReviewRoster, requestedHomeworkId, selectedHomeworkId, sessionId, sessionItems]);

  const reloadHomeworkLists = async () => {
    const [nextSessionItems, nextSummary, nextItems, nextReviewQueue] = await Promise.all([
      sessionId ? listSessionHomework(sessionId) : Promise.resolve([]),
      getHomeworkSummary(courseId, groupId),
      listHomework(courseId, groupId),
      getHomeworkReviewQueue({ limit: 20 }),
    ]);
    setSessionItems(nextSessionItems);
    setSummary(nextSummary);
    setItems(nextItems);
    setReviewQueue(nextReviewQueue);
  };

  const startEditHomework = (homework: SessionHomework) => {
    setEditHomeworkId(homework.id);
    setEditForm({
      title: homework.title ?? '',
      description: homework.description ?? '',
      dueAt: (homework.deadline ?? homework.dueAt ?? '').slice(0, 16),
      maxScore: homework.maxScore === undefined || homework.maxScore === null ? '' : String(homework.maxScore),
      isPublished: homework.isPublished ?? true,
      assignedStudentIds: homework.assignedStudentIds ?? [],
    });
  };

  const toggleAssignee = (
    setter: Dispatch<SetStateAction<typeof emptyForm>>,
    studentId: number,
  ) => {
    setter((current) => ({
      ...current,
      assignedStudentIds: current.assignedStudentIds.includes(studentId)
        ? current.assignedStudentIds.filter((id) => id !== studentId)
        : [...current.assignedStudentIds, studentId],
    }));
  };

  const assigneePayload = (ids: number[]) => (ids.length ? ids : undefined);

  const submitHomework = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = getHomeworkFormErrors(form, Boolean(sessionId && selectedSessionReady));
    if (!sessionId) {
      nextErrors.session = t('homework.errorSessionRequired');
    }
    if (Object.keys(nextErrors).length) {
      setFormErrors(Object.fromEntries(Object.entries(nextErrors).map(([key, value]) => [key, homeworkFormMessage(value)])));
      toast.error(homeworkFormMessage(nextErrors.title ?? nextErrors.session ?? nextErrors.maxScore));
      return;
    }

    setFormErrors({});
    const activeSessionId = sessionId!;
    setSaving(true);
    try {
      await createSessionHomework(activeSessionId, {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : undefined,
        maxScore: form.maxScore ? Number(form.maxScore) : undefined,
        isPublished: form.isPublished,
        assignedStudentIds: assigneePayload(form.assignedStudentIds),
      });
      await reloadHomeworkLists();
      setForm(emptyForm);
      setIsCreateModalOpen(false);
      toast.success(t('homework.created'));
    } catch {
      toast.error(t('homework.createFailed'));
    } finally {
      setSaving(false);
    }
  };

  const closeCreateModal = () => {
    setIsCreateModalOpen(false);
    setForm(emptyForm);
    setFormErrors({});
    setAssigneeQuery('');
  };

  const closeEditModal = () => {
    setEditHomeworkId(undefined);
    setEditForm(emptyForm);
    setFormErrors({});
    setAssigneeQuery('');
  };

  const saveHomeworkEdit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!sessionId || !editHomeworkId) return;
    const nextErrors: Record<string, string> = {};
    if (!editForm.title.trim()) {
      nextErrors.editTitle = t('homework.errorTitleRequired');
    }
    if (editForm.maxScore && Number(editForm.maxScore) < 0) {
      nextErrors.editMaxScore = t('homework.errorMaxScoreNegative');
    }
    if (Object.keys(nextErrors).length) {
      setFormErrors(Object.fromEntries(Object.entries(nextErrors).map(([key, value]) => [key, homeworkFormMessage(value)])));
      toast.error(homeworkFormMessage(nextErrors.editTitle ?? nextErrors.editMaxScore));
      return;
    }

    setFormErrors({});
    setSaving(true);
    try {
      await updateSessionHomework(sessionId, editHomeworkId, {
        title: editForm.title.trim(),
        description: editForm.description.trim() || null,
        dueAt: editForm.dueAt ? new Date(editForm.dueAt).toISOString() : null,
        maxScore: editForm.maxScore ? Number(editForm.maxScore) : null,
        isPublished: editForm.isPublished,
        assignedStudentIds: editForm.assignedStudentIds.length ? editForm.assignedStudentIds : null,
      });
      await reloadHomeworkLists();
      if (selectedHomeworkId === editHomeworkId) {
        await loadReviewRoster(editHomeworkId);
      }
      closeEditModal();
      toast.success(t('homework.updated'));
    } catch {
      toast.error(t('homework.updateFailed'));
    } finally {
      setSaving(false);
    }
  };

  const deleteHomework = async (homeworkId: number) => {
    if (!sessionId) return;

    setSaving(true);
    try {
      await deleteSessionHomework(sessionId, homeworkId);
      if (selectedHomeworkId === homeworkId) {
        setSelectedHomeworkId(undefined);
        setReviewRoster(null);
      }
      if (editHomeworkId === homeworkId) {
        setEditHomeworkId(undefined);
      }
      await reloadHomeworkLists();
      toast.success(t('homework.deleted'));
      setHomeworkPendingDelete(null);
    } catch {
      toast.error(t('homework.deleteFailed'));
    } finally {
      setSaving(false);
    }
  };

  const submitReview = async (
    submissionId: number,
    status: 'approved' | 'rejected' | 'needs_revision',
  ) => {
    if (!sessionId || !selectedHomeworkId) return;
    const draft = reviewDrafts[submissionId] ?? { score: '', reviewComment: '' };
    const score = draft.score.trim() ? Number(draft.score) : undefined;

    const blocker = getHomeworkReviewBlocker(status, draft);
    if (blocker) {
      toast.error(reviewBlockerMessage(blocker));
      return;
    }

    setReviewingSubmission(submissionId);
    try {
      await reviewHomeworkSubmission(sessionId, selectedHomeworkId, submissionId, {
        status,
        score,
        reviewComment: draft.reviewComment.trim() || undefined,
      });
      const [nextRoster, nextSummary, nextItems, nextSessionItems] = await Promise.all([
        getHomeworkReviewRoster(sessionId, selectedHomeworkId),
        getHomeworkSummary(courseId, groupId),
        listHomework(courseId, groupId),
        listSessionHomework(sessionId),
      ]);
      setReviewRoster(nextRoster);
      setSummary(nextSummary);
      setItems(nextItems);
      setSessionItems(nextSessionItems);
      void getHomeworkReviewQueue({ limit: 20 })
        .then(setReviewQueue)
        .catch(() => undefined);
      toast.success(t('homework.reviewSaved'));
    } catch {
      toast.error(t('homework.reviewSaveFailed'));
    } finally {
      setReviewingSubmission(undefined);
    }
  };

  return (
    <>
      <PageHeader
        title={t('homework.title')}
        eyebrow={activeTenant?.name}
        actions={(
          <button type="button" className="primary-button" onClick={() => setIsCreateModalOpen(true)} disabled={!sessionId || !selectedSessionReady || saving}>
            <FiPlus />
            {t('homework.createHomework')}
          </button>
        )}
      />
      <div className="filters-row three">
        <select value={courseId ?? ''} onChange={(event) => setCourseId(Number(event.target.value) || undefined)}>
          <option value="">{t('sessions.chooseCourse')}</option>
          {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
        </select>
        <select value={groupId ?? ''} onChange={(event) => setGroupId(Number(event.target.value) || undefined)} disabled={!groups.length}>
          <option value="">{t('attendance.chooseGroup')}</option>
          {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
        </select>
        <select value={sessionId ?? ''} onChange={(event) => setSessionId(Number(event.target.value) || undefined)} disabled={!sessions.length}>
          <option value="">{t('sessions.chooseSession')}</option>
          {sessions.map((session) => (
            <option key={session.id} value={session.id}>
              {session.title} {session.startsAt ? `- ${formatDate(session.startsAt)}` : ''}
            </option>
          ))}
        </select>
      </div>
      <section className="homework-workflow-strip">
        {workflowSteps.map((step, index) => {
          const Icon = step.icon;
          return (
            <article className={`workflow-step ${step.state}`} key={step.label}>
              <span>{index + 1}</span>
              <Icon />
              <div>
                <strong>{step.label}</strong>
                <small>{step.value}</small>
              </div>
            </article>
          );
        })}
      </section>
      {loading ? <LoadingState label={t('homework.loading')} /> : null}
      {summary ? (
        <div className="stat-grid compact">
          {['total', 'needsReview', 'missing', 'overdue'].map((key) => (
            <section className="stat-tile" key={key}>
              <FiClipboard />
              <span>{summaryLabel(key)}</span>
              <strong>{summary[key] ?? 0}</strong>
            </section>
          ))}
        </div>
      ) : null}

      {reviewQueue ? (
        <section className="content-section homework-list-section">
          <div className="section-heading-row">
            <div>
              <h2>{t('homework.reviewRoster')}</h2>
              <span>{t('homework.assignmentScopeCount', { count: reviewQueue.summary.actionRequired })}</span>
            </div>
          </div>
          {reviewQueue.items.length ? (
            <div className="stack-list homework-assignment-list">
              {reviewQueue.items.slice(0, 6).map((homework) => {
                const next = new URLSearchParams();
                if (homework.courseId) next.set('courseId', String(homework.courseId));
                if (homework.groupId) next.set('groupId', String(homework.groupId));
                if (homework.sessionId) next.set('sessionId', String(homework.sessionId));
                next.set('homeworkId', String(homework.id));
                return (
                  <Link className="stack-list-item homework-assignment-item" to={`/homework?${next.toString()}`} key={homework.id}>
                    <div>
                      <strong>{homework.title}</strong>
                      <span>
                        {homework.courseTitle ?? t('student.courseNotSet')} · {homework.groupName ?? t('student.groupNotSet')} · {formatDate(homework.deadline ?? homework.dueAt)}
                      </span>
                      <small>{homework.sessionTitle ?? t('homework.selectedSession')}</small>
                    </div>
                    <div className="activity-actions">
                      <span className="status-badge pending_approval">{t('homework.reviewCount', { count: homeworkQueueCount(homework, 'needsReview') })}</span>
                      <span className="status-badge destructive">{t('homework.reviewMissing')}: {homeworkQueueCount(homework, 'missing')}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <EmptyState title={t('overview.homeworkQueueEmptyTitle')} detail={t('overview.homeworkQueueEmptyDetail')} />
          )}
        </section>
      ) : null}

      <div className="workspace-grid homework-workspace-grid">
        <section className="settings-panel full workflow-context-panel">
          <div className="settings-panel-heading">
            <FiCalendar />
            <div>
              <h2>{t('homework.sessionAssignments')}</h2>
              <span className="panel-note">{selectedSession ? `${selectedSession.title} · ${formatDate(selectedSession.startsAt)}` : t('homework.chooseSessionManage')}</span>
            </div>
          </div>
          <div className="homework-session-summary" aria-label={t('homework.selectedSessionSummary')}>
            <section><span>{t('homework.assignments')}</span><strong>{sessionHomeworkSummary.total}</strong></section>
            <section><span>{t('homework.needReview')}</span><strong>{sessionHomeworkSummary.needsReview}</strong></section>
            <section><span>{t('homework.missing')}</span><strong>{sessionHomeworkSummary.missing}</strong></section>
            <section><span>{t('homework.assigned')}</span><strong>{sessionHomeworkSummary.assigned}</strong></section>
          </div>
          {!sessionId ? (
            <EmptyState
              title={t('homework.noSessionSelected')}
              detail={t('homework.noScopeDetail')}
              action={<Link className="secondary-link-button" to="/sessions">{t('attendance.openSessions')}</Link>}
            />
          ) : !sessionItems.length ? (
            <EmptyState
              title={t('homework.noSessionHomework')}
              detail={t('homework.createFirstAssignment')}
              action={<button type="button" className="primary-button" onClick={() => setIsCreateModalOpen(true)} disabled={!selectedSessionReady}>{t('homework.createHomework')}</button>}
            />
          ) : (
            <div className="stack-list homework-assignment-list">
              {sessionItems.map((homework) => (
                <article
                  key={homework.id}
                  className={`stack-list-item homework-assignment-item ${selectedHomeworkId === homework.id ? 'active' : ''}`}
                >
                  <button type="button" className="stack-list-content-button" onClick={() => void loadReviewRoster(homework.id)}>
                    <strong>{homework.title}</strong>
                    <span><span className={`status-badge ${homework.isPublished ? 'published' : 'draft'}`}>{homework.isPublished ? t('courses.published') : t('courses.draft')}</span>{homework.deadline || homework.dueAt ? ` · ${t('homework.dueWithDate', { date: formatDate(homework.deadline ?? homework.dueAt) })}` : ''}</span>
                    <small>{selectedHomeworkId === homework.id ? t('homework.reviewRosterOpen') : t('homework.openReviewRoster')}</small>
                  </button>
                  <div className="activity-actions">
                    <span className={`status-badge ${(homework.queue?.needsReview ?? 0) > 0 ? 'pending_approval' : 'approved'}`}>
                      {t('homework.reviewCount', { count: homework.queue?.needsReview ?? 0 })}
                    </span>
                    <button type="button" className="secondary-button" onClick={() => startEditHomework(homework)}>{t('homework.edit')}</button>
                    <button type="button" className="link-button danger" disabled={saving} onClick={() => setHomeworkPendingDelete(homework)}>{t('homework.delete')}</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="settings-panel homework-review-panel workflow-context-panel">
          <div className="section-heading-row compact">
            <div>
              <h2>{t('homework.reviewRoster')}</h2>
              <span>{selectedHomework?.title ?? t('homework.selectAssignment')}</span>
            </div>
          </div>
          {reviewLoading ? <LoadingState label={t('homework.loadingReviewRoster')} /> : null}
          {!selectedHomeworkId ? (
            <EmptyState title={t('homework.selectHomeworkToReview')} detail={t('homework.chooseAssignmentDetail')} />
          ) : reviewRoster ? (
            <>
              <CountFilterRow
                className="review-summary-row"
                ariaLabel={t('homework.reviewFilters')}
                items={reviewFilters.map((key) => ({
                  key,
                  label: reviewFilterLabel(key),
                  count: reviewRoster.summary[key] ?? 0,
                  active: reviewFilter === key,
                }))}
                onSelect={setReviewFilter}
              />
              <div className="stack-list">
                {filteredReviewItems.map((item) => {
                  const isExpanded = expandedReviewStudentId === item.studentId;
                  return (
                    <article key={item.studentId} className={`stack-list-item homework-review-item ${item.reviewState}`}>
                      <div className="homework-review-summary">
                        <strong>{item.fullName || item.email || studentFallback(item.studentId)}</strong>
                        <span>
                          <span className={`status-badge ${item.reviewState}`}>{reviewStateLabel(item.reviewState)}</span>
                          {item.isLate ? ` · ${t('homework.reviewLate')}` : ''}
                        </span>
                        {item.submission?.answerText ? <p>{isExpanded ? item.submission.answerText : `${item.submission.answerText.slice(0, 110)}${item.submission.answerText.length > 110 ? '...' : ''}`}</p> : null}
                        {item.submission?.attachmentUrl && item.submission.id ? (
                          <button
                            type="button"
                            className="link-button"
                            onClick={() => void openHomeworkSubmissionAttachment(sessionId!, selectedHomeworkId!, item.submission!.id)}
                          >
                            {t('homework.openAttachment')}
                          </button>
                        ) : null}
                      </div>
                      {item.submission?.id ? (
                        <div className="review-controls homework-review-controls">
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => setExpandedReviewStudentId(isExpanded ? undefined : item.studentId)}
                          >
                            {isExpanded ? t('homework.hideReview') : t('homework.review')}
                          </button>
                          {isExpanded ? (
                            <>
                              <label>
                                {t('homework.score')}
                                <input
                                  value={reviewDrafts[item.submission.id]?.score ?? ''}
                                  onChange={(event) => setReviewDrafts((current) => ({
                                    ...current,
                                    [item.submission!.id]: {
                                      score: event.target.value,
                                      reviewComment: current[item.submission!.id]?.reviewComment ?? '',
                                    },
                                  }))}
                                  inputMode="numeric"
                                />
                              </label>
                              <label>
                                {t('homework.reviewComment')}
                                <textarea
                                  value={reviewDrafts[item.submission.id]?.reviewComment ?? ''}
                                  onChange={(event) => setReviewDrafts((current) => ({
                                    ...current,
                                    [item.submission!.id]: {
                                      score: current[item.submission!.id]?.score ?? '',
                                      reviewComment: event.target.value,
                                    },
                                  }))}
                                  placeholder={t('homework.reviewCommentPlaceholder')}
                                />
                              </label>
                              <div className="activity-actions">
                                <button type="button" className="secondary-button" onClick={() => void submitReview(item.submission!.id, 'approved')} disabled={reviewingSubmission === item.submission.id}>{t('courses.approve')}</button>
                                <button type="button" className="secondary-button" onClick={() => void submitReview(item.submission!.id, 'needs_revision')} disabled={reviewingSubmission === item.submission.id}>{t('sessions.revise')}</button>
                                <button type="button" className="link-button danger" onClick={() => void submitReview(item.submission!.id, 'rejected')} disabled={reviewingSubmission === item.submission.id}>{t('courses.reject')}</button>
                              </div>
                            </>
                          ) : null}
                        </div>
                      ) : (
                        <span className={`status-badge ${item.hasSubmission ? 'pending_approval' : 'destructive'}`}>
                          {item.hasSubmission ? t('homework.noReview') : t('homework.noSubmission')}
                        </span>
                      )}
                    </article>
                  );
                })}
                {!filteredReviewItems.length ? <EmptyState title={t('homework.noStudentsInFilter')} detail={t('homework.noStudentsInFilterDetail')} /> : null}
              </div>
            </>
          ) : (
            <EmptyState title={t('homework.reviewRosterNotLoaded')} detail={t('homework.reviewRosterNotLoadedDetail')} />
          )}
        </aside>
      </div>

      {editHomeworkId ? (
        <FormModal labelledBy="edit-homework-title" onClose={closeEditModal} onSubmit={saveHomeworkEdit}>
          <div className="modal-header-block">
            <span>{selectedSession?.title ?? t('homework.selectedSession')}</span>
            <h2 id="edit-homework-title">{t('homework.editHomework')}</h2>
            <p>{sessionItems.find((item) => item.id === editHomeworkId)?.title ?? t('homework.selectedHomework')}</p>
          </div>
          <label>
            {t('courses.title')}
            <input
              value={editForm.title}
              onChange={(event) => {
                setEditForm((current) => ({ ...current, title: event.target.value }));
                setFormErrors((current) => ({ ...current, editTitle: '' }));
              }}
              className={formErrors.editTitle ? 'input-error' : ''}
              aria-invalid={!!formErrors.editTitle}
              autoFocus
            />
            {formErrors.editTitle ? <span className="field-error">{formErrors.editTitle}</span> : null}
          </label>
          <label>
            {t('courses.description')}
            <textarea value={editForm.description} onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))} />
          </label>
          <div className="two-col">
            <label>
              {t('homework.dueDate')}
              <input type="datetime-local" value={editForm.dueAt} onChange={(event) => setEditForm((current) => ({ ...current, dueAt: event.target.value }))} />
            </label>
            <label>
              {t('homework.maxScore')}
              <input
                type="number"
                min="0"
                max="1000"
                value={editForm.maxScore}
                onChange={(event) => {
                  setEditForm((current) => ({ ...current, maxScore: event.target.value }));
                  setFormErrors((current) => ({ ...current, editMaxScore: '' }));
                }}
                className={formErrors.editMaxScore ? 'input-error' : ''}
                aria-invalid={!!formErrors.editMaxScore}
              />
              {formErrors.editMaxScore ? <span className="field-error">{formErrors.editMaxScore}</span> : null}
            </label>
          </div>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={editForm.isPublished}
              onChange={(event) => setEditForm((current) => ({ ...current, isPublished: event.target.checked }))}
            />
            {t('courses.published')}
          </label>
          <div className="settings-panel compact assignee-panel">
            <div className="section-heading-row compact">
              <div>
                <h3>{t('homework.assignees')}</h3>
                <span>{selectedCountLabel(editForm.assignedStudentIds.length)}</span>
              </div>
              <button type="button" className="secondary-button" onClick={() => setEditForm((current) => ({ ...current, assignedStudentIds: [] }))}>
                {t('homework.allStudents')}
              </button>
            </div>
            <label>
              {t('attendance.findStudent')}
              <input value={assigneeQuery} onChange={(event) => setAssigneeQuery(event.target.value)} placeholder={t('attendance.studentSearchPlaceholder')} />
            </label>
            <div className="stack-list compact assignee-list">
              {visibleAssignees.map((student) => (
                <label className="checkbox-row" key={student.userId}>
                  <input
                    type="checkbox"
                    checked={editForm.assignedStudentIds.includes(student.userId)}
                    onChange={() => toggleAssignee(setEditForm, student.userId)}
                  />
                  {student.fullName || student.email || studentFallback(student.userId)}
                </label>
              ))}
              {!students.length ? (
                <EmptyState
                  title={t('courses.noStudentsTitle')}
                  detail={t('homework.noAssigneeStudentsDetail')}
                />
              ) : null}
              {students.length > 0 && !visibleAssignees.length ? (
                <EmptyState title={t('courses.noMatchingStudents')} detail={t('homework.noMatchingAssigneesDetail')} />
              ) : null}
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={closeEditModal} disabled={saving}>{t('courses.cancel')}</button>
            <button type="submit" disabled={saving}>{saving ? t('courses.saving') : t('homework.saveHomework')}</button>
          </div>
        </FormModal>
      ) : null}

      {!loading && !items.length ? (
        <EmptyState
          title={sessionId ? t('homework.noHomeworkInScope') : t('homework.noHomeworkScope')}
          detail={sessionId ? t('homework.noHomeworkInScopeDetail') : t('homework.noScopeDetail')}
          action={<button type="button" className="primary-button" onClick={() => setIsCreateModalOpen(true)} disabled={!sessionId || !selectedSessionReady}>{t('homework.createHomework')}</button>}
        />
      ) : null}
      {!loading && !!items.length ? (
        <section className="content-section homework-list-section">
          <div className="section-heading-row">
            <div>
              <h2>{t('homework.queue')}</h2>
              <span>{t('homework.assignmentScopeCount', { count: items.length })}</span>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('homework.title')}</th>
                  <th>{t('courses.course')}</th>
                  <th>{t('courses.group')}</th>
                  <th>{t('homework.due')}</th>
                  <th>{t('homework.review')}</th>
                  <th>{t('courses.status')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((homework) => (
                  <tr key={homework.id}>
                    <td>
                      <button
                        type="button"
                        className="table-row-button"
                        onClick={() => {
                          const next = new URLSearchParams(searchParamsString);
                          if (homework.courseId) next.set('courseId', String(homework.courseId));
                          if (homework.groupId) next.set('groupId', String(homework.groupId));
                          next.set('sessionId', String(homework.sessionId));
                          next.set('homeworkId', String(homework.id));
                          setSearchParams(next);
                          setSelectedHomeworkId(undefined);
                          setReviewRoster(null);
                        }}
                      >
                        <strong>{homework.title}</strong>
                      </button>
                      <small>{homework.sessionTitle}</small>
                    </td>
                    <td>{homework.courseTitle ?? '-'}</td>
                    <td>{homework.groupName ?? '-'}</td>
                    <td>{formatDate(homework.deadline ?? homework.dueAt)}</td>
                    <td>{homeworkQueueCount(homework, 'needsReview')}</td>
                    <td><span className={`status-badge ${homework.isPublished ? 'published' : 'draft'}`}>{homework.isPublished ? t('courses.published') : t('courses.draft')}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
      {isCreateModalOpen ? (
        <FormModal labelledBy="create-homework-title" onClose={closeCreateModal} onSubmit={submitHomework}>
            <div className="modal-header-block">
              <span>{selectedSession ? formatDate(selectedSession.startsAt) : t('homework.sessionRequired')}</span>
              <h2 id="create-homework-title">{t('homework.createHomework')}</h2>
              <p>{selectedSession ? t('homework.assignmentAddedToSession', { title: selectedSession.title }) : t('homework.chooseSessionBeforeCreate')}</p>
            </div>
            <label>
              {t('courses.title')}
              <input
                value={form.title}
                onChange={(event) => {
                  setForm((current) => ({ ...current, title: event.target.value }));
                  setFormErrors((current) => ({ ...current, title: '' }));
                }}
                className={formErrors.title ? 'input-error' : ''}
                aria-invalid={!!formErrors.title}
                autoFocus
              />
              {formErrors.title ? <span className="field-error">{formErrors.title}</span> : null}
            </label>
            <label>
              {t('courses.description')}
              <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
            </label>
            <div className="two-col">
              <label>
                {t('homework.dueDate')}
                <input type="datetime-local" value={form.dueAt} onChange={(event) => setForm((current) => ({ ...current, dueAt: event.target.value }))} />
              </label>
              <label>
                {t('homework.maxScore')}
                <input
                  type="number"
                  min="0"
                  max="1000"
                  value={form.maxScore}
                  onChange={(event) => {
                    setForm((current) => ({ ...current, maxScore: event.target.value }));
                    setFormErrors((current) => ({ ...current, maxScore: '' }));
                  }}
                  className={formErrors.maxScore ? 'input-error' : ''}
                  aria-invalid={!!formErrors.maxScore}
                />
                {formErrors.maxScore ? <span className="field-error">{formErrors.maxScore}</span> : null}
              </label>
            </div>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.isPublished}
                onChange={(event) => setForm((current) => ({ ...current, isPublished: event.target.checked }))}
              />
              {t('homework.publishImmediately')}
            </label>
            <div className="settings-panel compact assignee-panel">
              <div className="section-heading-row compact">
                <div>
                  <h3>{t('homework.assignees')}</h3>
                  <span>{selectedCountLabel(form.assignedStudentIds.length)}</span>
                </div>
                <button type="button" className="secondary-button" onClick={() => setForm((current) => ({ ...current, assignedStudentIds: [] }))}>
                  {t('homework.allStudents')}
                </button>
              </div>
              <label>
                {t('attendance.findStudent')}
                <input value={assigneeQuery} onChange={(event) => setAssigneeQuery(event.target.value)} placeholder={t('attendance.studentSearchPlaceholder')} />
              </label>
              <div className="stack-list compact assignee-list">
                {visibleAssignees.map((student) => (
                  <label className="checkbox-row" key={student.userId}>
                    <input
                      type="checkbox"
                      checked={form.assignedStudentIds.includes(student.userId)}
                      onChange={() => toggleAssignee(setForm, student.userId)}
                    />
                    {student.fullName || student.email || studentFallback(student.userId)}
                  </label>
                ))}
                {!students.length ? (
                  <EmptyState
                    title={t('courses.noStudentsTitle')}
                    detail={t('homework.noAssigneeStudentsDetail')}
                  />
                ) : null}
                {students.length > 0 && !visibleAssignees.length ? (
                  <EmptyState title={t('courses.noMatchingStudents')} detail={t('homework.noMatchingAssigneesDetail')} />
                ) : null}
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={closeCreateModal} disabled={saving}>{t('courses.cancel')}</button>
              <button type="submit" disabled={!sessionId || !selectedSessionReady || saving}>{saving ? t('courses.creating') : t('homework.createHomework')}</button>
            </div>
        </FormModal>
      ) : null}
      {homeworkPendingDelete ? (
        <Modal labelledBy="delete-homework-title" onClose={() => setHomeworkPendingDelete(null)}>
            <div className="modal-header-block">
              <span>{t('homework.delete')}</span>
              <h2 id="delete-homework-title">{t('homework.deleteHomework')}</h2>
              <p>{homeworkPendingDelete.title}</p>
            </div>
            <p className="panel-note">{t('homework.deleteDetail')}</p>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setHomeworkPendingDelete(null)} disabled={saving}>{t('courses.cancel')}</button>
              <button type="button" className="danger-button" onClick={() => void deleteHomework(homeworkPendingDelete.id)} disabled={saving}>
                {saving ? t('homework.deleting') : t('homework.deleteHomework')}
              </button>
            </div>
        </Modal>
      ) : null}
    </>
  );
}
