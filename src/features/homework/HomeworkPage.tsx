import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
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
  reviewFilterLabels,
  reviewFilters,
  type ReviewFilter,
} from './homeworkWorkflow';
import {
  createSessionHomework,
  deleteSessionHomework,
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
import type { Course, CourseGroup, CourseSession, GroupStudent, HomeworkReviewRoster, SessionHomework } from '../../types/domain';
import { useTenant } from '../tenant/TenantProvider';
import { formatDate, readable } from '../../lib/format';
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

const summaryLabels: Record<string, string> = {
  total: 'Assignments',
  needsReview: 'Need review',
  missing: 'Missing',
  overdue: 'Overdue',
};

export function HomeworkPage() {
  const { activeTenant } = useTenant();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTenantId = activeTenant?.id;
  const requestedCourseId = Number(searchParams.get('courseId')) || undefined;
  const requestedGroupId = Number(searchParams.get('groupId')) || undefined;
  const requestedSessionId = Number(searchParams.get('sessionId')) || undefined;
  const searchParamsString = searchParams.toString();
  const [courses, setCourses] = useState<Course[]>([]);
  const [groups, setGroups] = useState<CourseGroup[]>([]);
  const [sessions, setSessions] = useState<CourseSession[]>([]);
  const [students, setStudents] = useState<GroupStudent[]>([]);
  const [courseId, setCourseId] = useState<number | undefined>();
  const [groupId, setGroupId] = useState<number | undefined>();
  const [sessionId, setSessionId] = useState<number | undefined>();
  const [summary, setSummary] = useState<Record<string, number> | null>(null);
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
      label: 'Course',
      value: selectedCourse?.title ?? 'Choose course',
      icon: FiBookOpen,
      state: courseId ? 'ready' : 'current',
    },
    {
      label: 'Group',
      value: selectedGroup?.name ?? 'Choose group',
      icon: FiUsers,
      state: groupId ? 'ready' : courseId ? 'current' : 'locked',
    },
    {
      label: 'Session',
      value: selectedSession?.title ?? 'Choose session',
      icon: FiCalendar,
      state: sessionId ? 'ready' : groupId ? 'current' : 'locked',
    },
    {
      label: 'Review',
      value: selectedHomework?.title ?? 'Select homework',
      icon: FiCheckCircle,
      state: selectedHomeworkId ? 'ready' : sessionId ? 'current' : 'locked',
    },
  ];

  const filteredReviewItems = useMemo(() => {
    const rows = reviewRoster?.items ?? [];
    return filterHomeworkReviewItems(rows, reviewFilter);
  }, [reviewFilter, reviewRoster?.items]);

  useEffect(() => {
    setCourses([]);
    setGroups([]);
    setSessions([]);
    setStudents([]);
    setCourseId(undefined);
    setGroupId(undefined);
    setSessionId(undefined);
    setItems([]);
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
        if (!cancelled) toast.error('Could not load courses');
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
        if (!cancelled) toast.error('Could not load homework');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [courseId, groupId]);

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
        if (!cancelled) toast.error('Could not load groups');
      });
    return () => {
      cancelled = true;
    };
  }, [courseId]);

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
        if (!cancelled) toast.error('Could not load sessions');
      });
    return () => {
      cancelled = true;
    };
  }, [groupId]);

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
        if (!cancelled) toast.error('Could not load session homework');
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const loadReviewRoster = async (homeworkId: number) => {
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
      toast.error('Could not load review roster');
    } finally {
      setReviewLoading(false);
    }
  };

  const reloadHomeworkLists = async () => {
    const [nextSessionItems, nextSummary, nextItems] = await Promise.all([
      sessionId ? listSessionHomework(sessionId) : Promise.resolve([]),
      getHomeworkSummary(courseId, groupId),
      listHomework(courseId, groupId),
    ]);
    setSessionItems(nextSessionItems);
    setSummary(nextSummary);
    setItems(nextItems);
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
      nextErrors.session = 'Select a session before creating homework.';
    }
    if (Object.keys(nextErrors).length) {
      setFormErrors(nextErrors);
      toast.error(nextErrors.title ?? nextErrors.session ?? nextErrors.maxScore);
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
      toast.success('Homework created');
    } catch {
      toast.error('Could not create homework');
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
      nextErrors.editTitle = 'Homework title is required.';
    }
    if (editForm.maxScore && Number(editForm.maxScore) < 0) {
      nextErrors.editMaxScore = 'Max score cannot be negative.';
    }
    if (Object.keys(nextErrors).length) {
      setFormErrors(nextErrors);
      toast.error(nextErrors.editTitle ?? nextErrors.editMaxScore);
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
      toast.success('Homework updated');
    } catch {
      toast.error('Could not update homework');
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
      toast.success('Homework deleted');
      setHomeworkPendingDelete(null);
    } catch {
      toast.error('Could not delete homework');
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
      toast.error(blocker);
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
      toast.success('Review saved');
    } catch {
      toast.error('Could not save review');
    } finally {
      setReviewingSubmission(undefined);
    }
  };

  return (
    <>
      <PageHeader
        title="Homework"
        eyebrow={activeTenant?.name}
        actions={(
          <button type="button" className="primary-button" onClick={() => setIsCreateModalOpen(true)} disabled={!sessionId || !selectedSessionReady || saving}>
            <FiPlus />
            Create homework
          </button>
        )}
      />
      <div className="filters-row three">
        <select value={courseId ?? ''} onChange={(event) => setCourseId(Number(event.target.value) || undefined)}>
          <option value="">Choose course</option>
          {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
        </select>
        <select value={groupId ?? ''} onChange={(event) => setGroupId(Number(event.target.value) || undefined)} disabled={!groups.length}>
          <option value="">Choose group</option>
          {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
        </select>
        <select value={sessionId ?? ''} onChange={(event) => setSessionId(Number(event.target.value) || undefined)} disabled={!sessions.length}>
          <option value="">Choose session</option>
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
      {loading ? <LoadingState label="Loading homework" /> : null}
      {summary ? (
        <div className="stat-grid compact">
          {['total', 'needsReview', 'missing', 'overdue'].map((key) => (
            <section className="stat-tile" key={key}>
              <FiClipboard />
              <span>{summaryLabels[key] ?? readable(key)}</span>
              <strong>{summary[key] ?? 0}</strong>
            </section>
          ))}
        </div>
      ) : null}

      <div className="workspace-grid homework-workspace-grid">
        <section className="settings-panel full workflow-context-panel">
          <div className="settings-panel-heading">
            <FiCalendar />
            <div>
              <h2>Session assignments</h2>
              <span className="panel-note">{selectedSession ? `${selectedSession.title} · ${formatDate(selectedSession.startsAt)}` : 'Choose a session to manage assignments.'}</span>
            </div>
          </div>
          <div className="homework-session-summary" aria-label="Selected session homework summary">
            <section><span>Assignments</span><strong>{sessionHomeworkSummary.total}</strong></section>
            <section><span>Need review</span><strong>{sessionHomeworkSummary.needsReview}</strong></section>
            <section><span>Missing</span><strong>{sessionHomeworkSummary.missing}</strong></section>
            <section><span>Assigned</span><strong>{sessionHomeworkSummary.assigned}</strong></section>
          </div>
          {!sessionId ? (
            <EmptyState
              title="No session selected"
              detail="Choose a course, group, and session to create or review homework."
              action={<Link className="secondary-link-button" to="/sessions">Open sessions</Link>}
            />
          ) : !sessionItems.length ? (
            <EmptyState
              title="No homework in this session"
              detail="Create the first assignment for this selected session."
              action={<button type="button" className="primary-button" onClick={() => setIsCreateModalOpen(true)} disabled={!selectedSessionReady}>Create homework</button>}
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
                    <span><span className={`status-badge ${homework.isPublished ? 'published' : 'draft'}`}>{homework.isPublished ? 'Published' : 'Draft'}</span>{homework.deadline || homework.dueAt ? ` · due ${formatDate(homework.deadline ?? homework.dueAt)}` : ''}</span>
                    <small>{selectedHomeworkId === homework.id ? 'Review roster open' : 'Open review roster'}</small>
                  </button>
                  <div className="activity-actions">
                    <span className={`status-badge ${(homework.queue?.needsReview ?? 0) > 0 ? 'pending_approval' : 'approved'}`}>
                      {homework.queue?.needsReview ?? 0} review
                    </span>
                    <button type="button" className="secondary-button" onClick={() => startEditHomework(homework)}>Edit</button>
                    <button type="button" className="link-button danger" disabled={saving} onClick={() => setHomeworkPendingDelete(homework)}>Delete</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="settings-panel homework-review-panel workflow-context-panel">
          <div className="section-heading-row compact">
            <div>
              <h2>Review roster</h2>
              <span>{selectedHomework?.title ?? 'Select an assignment'}</span>
            </div>
          </div>
          {reviewLoading ? <LoadingState label="Loading review roster" /> : null}
          {!selectedHomeworkId ? (
            <EmptyState title="Select homework to review" detail="Choose an assignment from the session list." />
          ) : reviewRoster ? (
            <>
              <CountFilterRow
                className="review-summary-row"
                ariaLabel="Homework review filters"
                items={reviewFilters.map((key) => ({
                  key,
                  label: reviewFilterLabels[key],
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
                        <strong>{item.fullName || item.email || `Student #${item.studentId}`}</strong>
                        <span>
                          <span className={`status-badge ${item.reviewState}`}>{readable(item.reviewState)}</span>
                          {item.isLate ? ' · late' : ''}
                        </span>
                        {item.submission?.answerText ? <p>{isExpanded ? item.submission.answerText : `${item.submission.answerText.slice(0, 110)}${item.submission.answerText.length > 110 ? '...' : ''}`}</p> : null}
                        {item.submission?.attachmentUrl && item.submission.id ? (
                          <button
                            type="button"
                            className="link-button"
                            onClick={() => void openHomeworkSubmissionAttachment(sessionId!, selectedHomeworkId!, item.submission!.id)}
                          >
                            Open attachment
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
                            {isExpanded ? 'Hide review' : 'Review'}
                          </button>
                          {isExpanded ? (
                            <>
                              <label>
                                Score
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
                                Review comment
                                <textarea
                                  value={reviewDrafts[item.submission.id]?.reviewComment ?? ''}
                                  onChange={(event) => setReviewDrafts((current) => ({
                                    ...current,
                                    [item.submission!.id]: {
                                      score: current[item.submission!.id]?.score ?? '',
                                      reviewComment: event.target.value,
                                    },
                                  }))}
                                  placeholder="Required for revision or rejection"
                                />
                              </label>
                              <div className="activity-actions">
                                <button type="button" className="secondary-button" onClick={() => void submitReview(item.submission!.id, 'approved')} disabled={reviewingSubmission === item.submission.id}>Approve</button>
                                <button type="button" className="secondary-button" onClick={() => void submitReview(item.submission!.id, 'needs_revision')} disabled={reviewingSubmission === item.submission.id}>Revise</button>
                                <button type="button" className="link-button danger" onClick={() => void submitReview(item.submission!.id, 'rejected')} disabled={reviewingSubmission === item.submission.id}>Reject</button>
                              </div>
                            </>
                          ) : null}
                        </div>
                      ) : (
                        <span className={`status-badge ${item.hasSubmission ? 'pending_approval' : 'destructive'}`}>
                          {item.hasSubmission ? 'No review' : 'No submission'}
                        </span>
                      )}
                    </article>
                  );
                })}
                {!filteredReviewItems.length ? <EmptyState title="No students in this filter" detail="Choose another review status or select a different homework item." /> : null}
              </div>
            </>
          ) : (
            <EmptyState title="Review roster not loaded" detail="Choose an assignment again if the roster did not load." />
          )}
        </aside>
      </div>

      {editHomeworkId ? (
        <FormModal labelledBy="edit-homework-title" onClose={closeEditModal} onSubmit={saveHomeworkEdit}>
          <div className="modal-header-block">
            <span>{selectedSession?.title ?? 'Selected session'}</span>
            <h2 id="edit-homework-title">Edit homework</h2>
            <p>{sessionItems.find((item) => item.id === editHomeworkId)?.title ?? 'Selected homework'}</p>
          </div>
          <label>
            Title
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
            Description
            <textarea value={editForm.description} onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))} />
          </label>
          <div className="two-col">
            <label>
              Due date
              <input type="datetime-local" value={editForm.dueAt} onChange={(event) => setEditForm((current) => ({ ...current, dueAt: event.target.value }))} />
            </label>
            <label>
              Max score
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
            Published
          </label>
          <div className="settings-panel compact assignee-panel">
            <div className="section-heading-row compact">
              <div>
                <h3>Assignees</h3>
                <span>{editForm.assignedStudentIds.length ? `${editForm.assignedStudentIds.length} selected` : 'All students in this group'}</span>
              </div>
              <button type="button" className="secondary-button" onClick={() => setEditForm((current) => ({ ...current, assignedStudentIds: [] }))}>
                All students
              </button>
            </div>
            <label>
              Find student
              <input value={assigneeQuery} onChange={(event) => setAssigneeQuery(event.target.value)} placeholder="Name, email, or ID" />
            </label>
            <div className="stack-list compact assignee-list">
              {visibleAssignees.map((student) => (
                <label className="checkbox-row" key={student.userId}>
                  <input
                    type="checkbox"
                    checked={editForm.assignedStudentIds.includes(student.userId)}
                    onChange={() => toggleAssignee(setEditForm, student.userId)}
                  />
                  {student.fullName || student.email || `Student #${student.userId}`}
                </label>
              ))}
              {!students.length ? (
                <EmptyState
                  title="No students enrolled in this group"
                  detail="Homework can be assigned after learners are enrolled in the selected group."
                />
              ) : null}
              {students.length > 0 && !visibleAssignees.length ? (
                <EmptyState title="No matching students" detail="Clear the assignee search to see the full roster." />
              ) : null}
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={closeEditModal} disabled={saving}>Cancel</button>
            <button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save homework'}</button>
          </div>
        </FormModal>
      ) : null}

      {!loading && !items.length ? (
        <EmptyState
          title={sessionId ? 'No homework in this scope' : 'No homework scope selected'}
          detail={sessionId ? 'Homework appears here after assignments are created for the selected session.' : 'Choose a course, group, and session to create or review homework.'}
          action={<button type="button" className="primary-button" onClick={() => setIsCreateModalOpen(true)} disabled={!sessionId || !selectedSessionReady}>Create homework</button>}
        />
      ) : null}
      {!loading && !!items.length ? (
        <section className="content-section homework-list-section">
          <div className="section-heading-row">
            <div>
              <h2>Homework queue</h2>
              <span>{items.length} assignment{items.length === 1 ? '' : 's'} across the selected scope</span>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Homework</th>
                  <th>Course</th>
                  <th>Group</th>
                  <th>Due</th>
                  <th>Review</th>
                  <th>Status</th>
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
                    <td>{homework.queue?.needsReview ?? 0}</td>
                    <td><span className={`status-badge ${homework.isPublished ? 'published' : 'draft'}`}>{homework.isPublished ? 'Published' : 'Draft'}</span></td>
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
              <span>{selectedSession ? formatDate(selectedSession.startsAt) : 'Session required'}</span>
              <h2 id="create-homework-title">Create homework</h2>
              <p>{selectedSession ? `This assignment will be added to ${selectedSession.title}.` : 'Choose a session before creating homework.'}</p>
            </div>
            <label>
              Title
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
              Description
              <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
            </label>
            <div className="two-col">
              <label>
                Due date
                <input type="datetime-local" value={form.dueAt} onChange={(event) => setForm((current) => ({ ...current, dueAt: event.target.value }))} />
              </label>
              <label>
                Max score
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
              Publish immediately
            </label>
            <div className="settings-panel compact assignee-panel">
              <div className="section-heading-row compact">
                <div>
                  <h3>Assignees</h3>
                  <span>{form.assignedStudentIds.length ? `${form.assignedStudentIds.length} selected` : 'All students in this group'}</span>
                </div>
                <button type="button" className="secondary-button" onClick={() => setForm((current) => ({ ...current, assignedStudentIds: [] }))}>
                  All students
                </button>
              </div>
              <label>
                Find student
                <input value={assigneeQuery} onChange={(event) => setAssigneeQuery(event.target.value)} placeholder="Name, email, or ID" />
              </label>
              <div className="stack-list compact assignee-list">
                {visibleAssignees.map((student) => (
                  <label className="checkbox-row" key={student.userId}>
                    <input
                      type="checkbox"
                      checked={form.assignedStudentIds.includes(student.userId)}
                      onChange={() => toggleAssignee(setForm, student.userId)}
                    />
                    {student.fullName || student.email || `Student #${student.userId}`}
                  </label>
                ))}
                {!students.length ? (
                  <EmptyState
                    title="No students enrolled in this group"
                    detail="Homework can be assigned after learners are enrolled in the selected group."
                  />
                ) : null}
                {students.length > 0 && !visibleAssignees.length ? (
                  <EmptyState title="No matching students" detail="Clear the assignee search to see the full roster." />
                ) : null}
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={closeCreateModal} disabled={saving}>Cancel</button>
              <button type="submit" disabled={!sessionId || !selectedSessionReady || saving}>{saving ? 'Creating...' : 'Create homework'}</button>
            </div>
        </FormModal>
      ) : null}
      {homeworkPendingDelete ? (
        <Modal labelledBy="delete-homework-title" onClose={() => setHomeworkPendingDelete(null)}>
            <div className="modal-header-block">
              <span>Delete</span>
              <h2 id="delete-homework-title">Delete homework</h2>
              <p>{homeworkPendingDelete.title}</p>
            </div>
            <p className="panel-note">Homework with submitted work cannot be deleted. This action removes the assignment from the selected session.</p>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setHomeworkPendingDelete(null)} disabled={saving}>Cancel</button>
              <button type="button" className="danger-button" onClick={() => void deleteHomework(homeworkPendingDelete.id)} disabled={saving}>
                {saving ? 'Deleting...' : 'Delete homework'}
              </button>
            </div>
        </Modal>
      ) : null}
    </>
  );
}
