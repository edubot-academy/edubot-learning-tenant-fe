import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiCalendar, FiCheckSquare, FiClipboard, FiEdit2, FiPlus } from 'react-icons/fi';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState, LoadingState } from '../../components/DataState';
import { FormModal, Modal } from '../../components/Modal';
import {
  createCourseGroup,
  enrollUser,
  generateGroupSessions,
  inviteTenantMember,
  listCourseGroups,
  listGroupSessions,
  listGroupStudents,
  listTenantCourses,
  listTenantMembers,
  previewGeneratedSessions,
  searchUsers,
  unenrollUser,
  updateCourseGroup,
} from '../../services/api';
import type { CompanyMember, Course, CourseGroup, CourseSession, GroupStudent, SessionGenerationPreview, UserSummary } from '../../types/domain';
import { formatDate, readable } from '../../lib/format';
import { useAuth } from '../auth/AuthProvider';
import { useTenant } from '../tenant/TenantProvider';
import { isTenantAdmin } from '../tenant/tenantRoles';
import { courseWorkflowBlocker, formatCourseType, isCourseWorkflowReady, nextWorkflowSearchParams, workflowPath } from '../workflows/workflowContext';

type GroupStatus = 'planned' | 'open' | 'active' | 'completed' | 'cancelled';
type ScheduleDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
type ScheduleBlockForm = { day: ScheduleDay; startTime: string; endTime: string };

const emptyScheduleBlock = (): ScheduleBlockForm => ({
  day: 'mon',
  startTime: '',
  endTime: '',
});

const emptyGroupForm = {
  name: '',
  code: '',
  status: 'active' as GroupStatus,
  startDate: '',
  endDate: '',
  seatLimit: '',
  timezone: 'Asia/Bishkek',
  location: '',
  meetingProvider: '',
  meetingUrl: '',
  scheduleNote: '',
  scheduleBlocks: [emptyScheduleBlock()],
  instructorId: '',
};

const emptyStudentInviteForm = {
  fullName: '',
  email: '',
  sendEmail: false,
};

function positiveNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function groupToForm(group?: CourseGroup | null) {
  const scheduleBlocks = Array.isArray(group?.scheduleBlocks) && group.scheduleBlocks.length
    ? group.scheduleBlocks.map((block) => ({
      day: (['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].includes(String(block.day)) ? block.day : 'mon') as ScheduleDay,
      startTime: block.startTime ?? '',
      endTime: block.endTime ?? '',
    }))
    : [emptyScheduleBlock()];
  if (!group) return emptyGroupForm;
  return {
    name: group.name ?? '',
    code: group.code ?? '',
    status: ['planned', 'open', 'active', 'completed', 'cancelled'].includes(String(group.status))
      ? group.status as GroupStatus
      : 'active',
    startDate: group.startDate?.slice(0, 10) ?? '',
    endDate: group.endDate?.slice(0, 10) ?? '',
    seatLimit: group.seatLimit ? String(group.seatLimit) : '',
    timezone: group.timezone ?? 'Asia/Bishkek',
    location: group.location ?? '',
    meetingProvider: group.meetingProvider ?? '',
    meetingUrl: group.meetingUrl ?? '',
    scheduleNote: group.scheduleNote ?? '',
    scheduleBlocks,
    instructorId: group.instructorId ? String(group.instructorId) : '',
  };
}

export function GroupsPage() {
  const { activeTenant } = useTenant();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTenantId = activeTenant?.id;
  const canAssignInstructor = isTenantAdmin(user, activeTenant);

  const initialCourseId = Number(searchParams.get('courseId')) || undefined;
  const initialGroupId = Number(searchParams.get('groupId')) || undefined;
  const searchParamsString = searchParams.toString();

  const [courses, setCourses] = useState<Course[]>([]);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [groups, setGroups] = useState<CourseGroup[]>([]);
  const [sessions, setSessions] = useState<CourseSession[]>([]);
  const [students, setStudents] = useState<GroupStudent[]>([]);
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [courseId, setCourseId] = useState<number | undefined>(initialCourseId);
  const [groupId, setGroupId] = useState<number | undefined>(initialGroupId);
  const [courseQuery, setCourseQuery] = useState('');
  const [studentQuery, setStudentQuery] = useState('');
  const [studentResults, setStudentResults] = useState<UserSummary[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<number | undefined>();
  const [studentInviteForm, setStudentInviteForm] = useState(emptyStudentInviteForm);
  const [groupForm, setGroupForm] = useState(emptyGroupForm);
  const [generationRange, setGenerationRange] = useState({ fromDate: '', toDate: '' });
  const [generationPreview, setGenerationPreview] = useState<SessionGenerationPreview | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [enrollmentMode, setEnrollmentMode] = useState<'existing' | 'new'>('existing');
  const [studentToRemove, setStudentToRemove] = useState<GroupStudent | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [savingGroup, setSavingGroup] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [removingStudentId, setRemovingStudentId] = useState<number | undefined>();
  const [generationLoading, setGenerationLoading] = useState(false);

  const selectedCourse = useMemo(() => courses.find((course) => course.id === courseId), [courseId, courses]);
  const selectedGroup = useMemo(() => groups.find((group) => group.id === groupId), [groupId, groups]);
  const instructorOptions = useMemo(
    () => members.filter((member) => String(member.role).toLowerCase() === 'instructor'),
    [members],
  );
  const filteredCourses = useMemo(() => {
    const normalized = courseQuery.trim().toLowerCase();
    return normalized
      ? courses.filter((course) => course.title.toLowerCase().includes(normalized) || String(course.courseType ?? '').includes(normalized))
      : courses;
  }, [courseQuery, courses]);
  const ineligibleCourseCount = allCourses.filter((course) => !isCourseWorkflowReady(course)).length;
  const scheduleBlocksReady = Boolean(selectedGroup?.scheduleBlocks?.some((block) => block.day && block.startTime && block.endTime));
  const scheduleDatesReady = Boolean(generationRange.fromDate && generationRange.toDate);
  const generationReady = scheduleBlocksReady && scheduleDatesReady;
  const selectedCourseReady = isCourseWorkflowReady(selectedCourse);
  const selectedCourseBlocker = courseWorkflowBlocker(selectedCourse);
  const selectedScope = { courseId: selectedGroup?.courseId ?? selectedCourse?.id, groupId: selectedGroup?.id };
  const nextSessionLink = workflowPath('/sessions', selectedScope);
  const attendanceLink = workflowPath('/attendance', selectedScope);
  const homeworkLink = workflowPath('/homework', selectedScope);

  useEffect(() => {
    setCourses([]);
    setAllCourses([]);
    setGroups([]);
    setSessions([]);
    setStudents([]);
    setMembers([]);
    if (!activeTenantId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      listTenantCourses(activeTenantId),
      canAssignInstructor ? listTenantMembers(activeTenantId) : Promise.resolve([]),
    ])
      .then(([nextCourses, nextMembers]) => {
        if (cancelled) return;
        setAllCourses(nextCourses);
        setCourses(nextCourses);
        setMembers(nextMembers);
      })
      .catch(() => {
        if (!cancelled) toast.error('Could not load groups workspace');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTenantId, canAssignInstructor]);

  useEffect(() => {
    setCourseId((current) => {
      if (!courses.length) return undefined;
      if (initialCourseId && courses.some((course) => course.id === initialCourseId)) return initialCourseId;
      return current && courses.some((course) => course.id === current) ? current : courses[0]?.id;
    });
  }, [courses, initialCourseId]);

  useEffect(() => {
    setGroups([]);
    setSessions([]);
    setStudents([]);
    setGroupId(undefined);
    if (!courseId) return;
    let cancelled = false;
    setDetailLoading(true);
    listCourseGroups(courseId)
      .then((nextGroups) => {
        if (cancelled) return;
        setGroups(nextGroups);
      })
      .catch(() => {
        if (!cancelled) toast.error('Could not load course groups');
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  useEffect(() => {
    setGroupId((current) => {
      if (!groups.length) return undefined;
      if (initialGroupId && groups.some((group) => group.id === initialGroupId)) return initialGroupId;
      return current && groups.some((group) => group.id === current) ? current : groups[0]?.id;
    });
  }, [groups, initialGroupId]);

  useEffect(() => {
    setSessions([]);
    setStudents([]);
    if (!groupId) {
      setGroupForm(emptyGroupForm);
      return;
    }
    const group = groups.find((item) => item.id === groupId);
    setGroupForm(groupToForm(group));
    setGenerationRange({
      fromDate: group?.startDate?.slice(0, 10) ?? '',
      toDate: group?.endDate?.slice(0, 10) ?? '',
    });
    setGenerationPreview(null);

    let cancelled = false;
    setDetailLoading(true);
    Promise.all([listGroupSessions(groupId), listGroupStudents(groupId, { limit: 200 })])
      .then(([nextSessions, nextStudents]) => {
        if (cancelled) return;
        setSessions(nextSessions);
        setStudents(nextStudents);
      })
      .catch(() => {
        if (!cancelled) toast.error('Could not load group detail');
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [groupId, groups]);

  useEffect(() => {
    const next = nextWorkflowSearchParams(searchParamsString, { courseId, groupId });
    if (next.toString() !== searchParamsString) setSearchParams(next, { replace: true });
  }, [courseId, groupId, searchParamsString, setSearchParams]);

  const reloadGroups = async (nextCourseId = courseId, preferredGroupId = groupId) => {
    if (!nextCourseId) return;
    const nextGroups = await listCourseGroups(nextCourseId);
    setGroups(nextGroups);
    setGroupId(preferredGroupId && nextGroups.some((group) => group.id === preferredGroupId) ? preferredGroupId : nextGroups[0]?.id);
  };

  const reloadGroupDetail = async (nextGroupId = groupId) => {
    if (!nextGroupId) return;
    const [nextSessions, nextStudents] = await Promise.all([
      listGroupSessions(nextGroupId),
      listGroupStudents(nextGroupId, { limit: 200 }),
    ]);
    setSessions(nextSessions);
    setStudents(nextStudents);
  };

  const toPayload = () => ({
    name: groupForm.name.trim(),
    code: groupForm.code.trim() || undefined,
    status: groupForm.status,
    startDate: groupForm.startDate || undefined,
    endDate: groupForm.endDate || undefined,
    seatLimit: positiveNumber(groupForm.seatLimit),
    timezone: groupForm.timezone.trim() || undefined,
    location: groupForm.location.trim() || undefined,
    meetingProvider: groupForm.meetingProvider.trim() || undefined,
    meetingUrl: groupForm.meetingUrl.trim() || undefined,
    scheduleNote: groupForm.scheduleNote.trim() || undefined,
    scheduleBlocks: groupForm.scheduleBlocks
      .map((block) => ({
        day: block.day,
        startTime: block.startTime,
        endTime: block.endTime,
      }))
      .filter((block) => block.day && block.startTime && block.endTime),
    instructorId: canAssignInstructor ? positiveNumber(groupForm.instructorId) : undefined,
  });

  const submitCreateGroup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!courseId) return toast.error('Select a course first');
    if (!groupForm.name.trim()) return toast.error('Group name is required');
    setSavingGroup(true);
    try {
      const payload = toPayload();
      const saved = await createCourseGroup({
        ...payload,
        code: payload.code || `${courseId}-${Date.now().toString(36)}`.toUpperCase(),
        courseId,
      });
      await reloadGroups(courseId, saved.id);
      setIsCreateOpen(false);
      toast.success('Group created');
    } catch {
      toast.error('Could not create group');
    } finally {
      setSavingGroup(false);
    }
  };

  const submitUpdateGroup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!groupId || !courseId) return;
    if (!groupForm.name.trim()) return toast.error('Group name is required');
    setSavingGroup(true);
    try {
      await updateCourseGroup(groupId, toPayload());
      await reloadGroups(courseId, groupId);
      setIsEditOpen(false);
      toast.success('Group updated');
    } catch {
      toast.error('Could not update group');
    } finally {
      setSavingGroup(false);
    }
  };

  const searchStudents = async () => {
    setEnrolling(true);
    try {
      const results = await searchUsers({ search: studentQuery, role: 'student', limit: 12 });
      setStudentResults(results);
      setSelectedStudentId(results[0]?.id);
    } catch {
      toast.error('Could not search students');
    } finally {
      setEnrolling(false);
    }
  };

  const submitEnrollment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!courseId || !groupId || !selectedStudentId) return toast.error('Select a student to enroll');
    setEnrolling(true);
    try {
      await enrollUser({ courseId, groupId, userId: selectedStudentId });
      await reloadGroupDetail(groupId);
      setStudentQuery('');
      setStudentResults([]);
      setSelectedStudentId(undefined);
      toast.success('Student enrolled');
    } catch {
      toast.error('Could not enroll student');
    } finally {
      setEnrolling(false);
    }
  };

  const submitInviteAndEnroll = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeTenantId || !courseId || !groupId) return;
    if (!studentInviteForm.fullName.trim() || !studentInviteForm.email.trim()) {
      toast.error('Student name and email are required');
      return;
    }
    setEnrolling(true);
    try {
      const member = await inviteTenantMember(activeTenantId, {
        fullName: studentInviteForm.fullName.trim(),
        email: studentInviteForm.email.trim(),
        role: 'student',
        sendEmail: studentInviteForm.sendEmail,
      });
      await enrollUser({ courseId, groupId, userId: member.userId });
      await reloadGroupDetail(groupId);
      setStudentInviteForm(emptyStudentInviteForm);
      toast.success(member.onboarding?.emailSent ? 'Student invited and enrolled' : 'Student created and enrolled');
    } catch {
      toast.error('Could not create and enroll student');
    } finally {
      setEnrolling(false);
    }
  };

  const removeStudent = async (student: GroupStudent) => {
    if (!courseId || !groupId) return;
    setRemovingStudentId(student.userId);
    try {
      await unenrollUser(courseId, student.userId);
      await reloadGroupDetail(groupId);
      toast.success('Student removed');
    } catch {
      toast.error('Could not remove student');
    } finally {
      setRemovingStudentId(undefined);
      setStudentToRemove(null);
    }
  };

  const previewGeneration = async () => {
    if (!groupId) return;
    if (!generationReady) return toast.error('Complete schedule blocks and generation dates first');
    setGenerationLoading(true);
    try {
      setGenerationPreview(await previewGeneratedSessions(groupId, generationRange));
      toast.success('Preview ready');
    } catch {
      toast.error('Could not preview sessions. Check schedule settings.');
    } finally {
      setGenerationLoading(false);
    }
  };

  const generateSessions = async () => {
    if (!groupId || !generationPreview?.newCount) return toast.error('Preview new sessions first');
    setGenerationLoading(true);
    try {
      const result = await generateGroupSessions(groupId, generationRange);
      await reloadGroupDetail(groupId);
      setGenerationPreview(null);
      toast.success(`Created ${result.createdCount} sessions`);
    } catch {
      toast.error('Could not generate sessions');
    } finally {
      setGenerationLoading(false);
    }
  };

  const renderGroupForm = () => (
    <>
      <section className="form-section">
        <h3>Group basics</h3>
        <div className="two-col">
          <label>Name<input value={groupForm.name} onChange={(event) => setGroupForm((current) => ({ ...current, name: event.target.value }))} /></label>
          <label>Code<input value={groupForm.code} onChange={(event) => setGroupForm((current) => ({ ...current, code: event.target.value }))} placeholder="Auto-generated if empty" /></label>
        </div>
        <label>Status<select value={groupForm.status} onChange={(event) => setGroupForm((current) => ({ ...current, status: event.target.value as GroupStatus }))}>
          <option value="planned">Planned</option><option value="open">Open</option><option value="active">Active</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
        </select></label>
      </section>
      <section className="form-section">
        <h3>Dates and capacity</h3>
        <div className="two-col">
          <label>Start date<input type="date" value={groupForm.startDate} onChange={(event) => setGroupForm((current) => ({ ...current, startDate: event.target.value }))} /></label>
          <label>End date<input type="date" value={groupForm.endDate} onChange={(event) => setGroupForm((current) => ({ ...current, endDate: event.target.value }))} /></label>
        </div>
        <div className="two-col">
          <label>Seat limit<input type="number" min="1" value={groupForm.seatLimit} onChange={(event) => setGroupForm((current) => ({ ...current, seatLimit: event.target.value }))} placeholder="No limit" /></label>
          <label>Timezone<input value={groupForm.timezone} onChange={(event) => setGroupForm((current) => ({ ...current, timezone: event.target.value }))} /></label>
        </div>
      </section>
      <section className="form-section">
        <h3>Instructor and location</h3>
        {canAssignInstructor ? (
          <label>Instructor<select value={groupForm.instructorId} onChange={(event) => setGroupForm((current) => ({ ...current, instructorId: event.target.value }))}>
            <option value="">Use course instructor</option>
            {instructorOptions.map((member) => <option key={member.userId} value={member.userId}>{member.fullName || member.user?.fullName || member.email || member.user?.email || `Instructor #${member.userId}`}</option>)}
          </select></label>
        ) : null}
        <label>Location<input value={groupForm.location} onChange={(event) => setGroupForm((current) => ({ ...current, location: event.target.value }))} /></label>
        <div className="two-col">
          <label>Meeting provider<input value={groupForm.meetingProvider} onChange={(event) => setGroupForm((current) => ({ ...current, meetingProvider: event.target.value }))} /></label>
          <label>Meeting URL<input value={groupForm.meetingUrl} onChange={(event) => setGroupForm((current) => ({ ...current, meetingUrl: event.target.value }))} /></label>
        </div>
      </section>
      <section className="form-section">
        <h3>Recurring schedule</h3>
        <div className="schedule-block-list">
          {groupForm.scheduleBlocks.map((block, index) => (
            <div className="three-col" key={`${index}-${block.day}`}>
              <label>Schedule day<select value={block.day} onChange={(event) => setGroupForm((current) => ({
                ...current,
                scheduleBlocks: current.scheduleBlocks.map((item, itemIndex) => itemIndex === index ? { ...item, day: event.target.value as ScheduleDay } : item),
              }))}>
                <option value="mon">Monday</option><option value="tue">Tuesday</option><option value="wed">Wednesday</option><option value="thu">Thursday</option><option value="fri">Friday</option><option value="sat">Saturday</option><option value="sun">Sunday</option>
              </select></label>
              <label>Starts<input type="time" value={block.startTime} onChange={(event) => setGroupForm((current) => ({
                ...current,
                scheduleBlocks: current.scheduleBlocks.map((item, itemIndex) => itemIndex === index ? { ...item, startTime: event.target.value } : item),
              }))} /></label>
              <label>Ends<input type="time" value={block.endTime} onChange={(event) => setGroupForm((current) => ({
                ...current,
                scheduleBlocks: current.scheduleBlocks.map((item, itemIndex) => itemIndex === index ? { ...item, endTime: event.target.value } : item),
              }))} /></label>
              {groupForm.scheduleBlocks.length > 1 ? (
                <button type="button" className="secondary-button" onClick={() => setGroupForm((current) => ({
                  ...current,
                  scheduleBlocks: current.scheduleBlocks.filter((_, itemIndex) => itemIndex !== index),
                }))}>Remove block</button>
              ) : null}
            </div>
          ))}
          <button type="button" className="secondary-button" onClick={() => setGroupForm((current) => ({
            ...current,
            scheduleBlocks: [...current.scheduleBlocks, emptyScheduleBlock()],
          }))}>Add schedule block</button>
        </div>
        <label>Schedule note<textarea value={groupForm.scheduleNote} onChange={(event) => setGroupForm((current) => ({ ...current, scheduleNote: event.target.value }))} /></label>
      </section>
    </>
  );

  return (
    <>
      <PageHeader title="Groups" eyebrow={activeTenant?.name} />
      <div className="workspace-grid">
        <section className="content-section">
          <div className="section-heading-row">
            <div><h2>Courses</h2><span>Select a tenant course, then manage its groups.</span></div>
            <button type="button" className="primary-button" onClick={() => { setGroupForm(emptyGroupForm); setIsCreateOpen(true); }} disabled={!selectedCourseReady} title={!selectedCourseReady ? selectedCourseBlocker : undefined}><FiPlus /> Create group</button>
          </div>
          {ineligibleCourseCount > 0 ? (
            <p className="panel-note">{ineligibleCourseCount} course{ineligibleCourseCount === 1 ? '' : 's'} shown but locked because groups require approved, published offline or live courses.</p>
          ) : null}
          <input value={courseQuery} onChange={(event) => setCourseQuery(event.target.value)} placeholder="Search courses" />
          {loading ? <LoadingState label="Loading courses" /> : null}
          <div className="stack-list">
            {filteredCourses.map((course) => (
              <button key={course.id} type="button" className={`stack-list-item ${course.id === courseId ? 'active' : ''}`} onClick={() => setCourseId(course.id)}>
                <div><strong>{course.title}</strong><span>{formatCourseType(course.courseType)} · {readable(course.status ?? 'draft')}</span></div>
                <strong className="muted-count">{course.id === courseId ? isCourseWorkflowReady(course) ? `${groups.length} groups` : 'Locked' : 'Select'}</strong>
              </button>
            ))}
            {!filteredCourses.length ? <EmptyState title="No matching courses" detail="Clear the search or open Courses to create a tenant course." action={<Link className="secondary-link-button" to="/courses">Open courses</Link>} /> : null}
          </div>
        </section>

        <aside className="settings-panel workflow-context-panel">
          <div className="section-heading-row compact">
            <div><h2>Course groups</h2><span>{selectedCourse?.title ?? 'Choose a course'}</span></div>
          </div>
          {detailLoading ? <LoadingState label="Loading groups" /> : null}
          <div className="stack-list">
            {groups.map((group) => (
              <button key={group.id} type="button" className={`stack-list-item ${group.id === groupId ? 'active' : ''}`} onClick={() => setGroupId(group.id)}>
                <div><strong>{group.name}</strong><span>{group.code ?? '-'} · {readable(group.status ?? 'planned')}</span></div>
                <span className={`status-badge ${group.status ?? 'planned'}`}>{readable(group.status ?? 'planned')}</span>
              </button>
            ))}
            {!groups.length ? (
              <EmptyState
                title="No groups for this course"
                detail={selectedCourseReady ? 'Create a group when this course is ready for a cohort, roster, and generated sessions.' : selectedCourseBlocker}
                action={selectedCourseReady ? (
                  <button type="button" className="secondary-button" onClick={() => { setGroupForm(emptyGroupForm); setIsCreateOpen(true); }}>
                    Create group
                  </button>
                ) : null}
              />
            ) : null}
          </div>
        </aside>
      </div>

      {selectedGroup ? (
        <section className="workflow-section workflow-context-panel">
          <div className="section-heading-row">
            <div><h2>{selectedGroup.name}</h2><span>{selectedCourse?.title ?? 'Selected course'}</span></div>
            <div className="page-actions">
              <span className={`status-badge ${selectedGroup.status ?? 'planned'}`}>{readable(selectedGroup.status ?? 'planned')}</span>
              <button type="button" className="secondary-button" onClick={() => { setGroupForm(groupToForm(selectedGroup)); setIsEditOpen(true); }}><FiEdit2 /> Edit group</button>
              <Link className="secondary-link-button" to={nextSessionLink}><FiCalendar /> Sessions</Link>
              <Link className="secondary-link-button" to={attendanceLink}><FiCheckSquare /> Attendance</Link>
              <Link className="secondary-link-button" to={homeworkLink}><FiClipboard /> Homework</Link>
            </div>
          </div>
          <div className="group-summary-grid">
            <section>
              <span>Dates</span>
              <strong>{selectedGroup.startDate || selectedGroup.endDate ? `${selectedGroup.startDate ?? '-'} - ${selectedGroup.endDate ?? '-'}` : 'Not scheduled'}</strong>
            </section>
            <section>
              <span>Schedule</span>
              <strong>
                {scheduleBlocksReady
                  ? `${selectedGroup.scheduleBlocks?.filter((block) => block.startTime && block.endTime).length ?? 0} block${(selectedGroup.scheduleBlocks?.filter((block) => block.startTime && block.endTime).length ?? 0) === 1 ? '' : 's'}`
                  : 'Needs setup'}
              </strong>
            </section>
            <section>
              <span>Location</span>
              <strong>{selectedGroup.location || selectedGroup.meetingProvider || 'Not set'}</strong>
            </section>
          </div>
          <div className="stat-grid compact">
            <section className="stat-tile"><span>Students</span><strong>{students.length}</strong></section>
            <section className="stat-tile"><span>Sessions</span><strong>{sessions.length}</strong></section>
            <section className="stat-tile"><span>Capacity</span><strong>{selectedGroup.seatLimit ?? 'Open'}</strong></section>
            <section className="stat-tile"><span>Timezone</span><strong>{selectedGroup.timezone ?? '-'}</strong></section>
          </div>
          <div className="settings-panel session-generation-panel workflow-context-panel compact">
            <div className="section-heading-row compact"><div><h3>Generate sessions</h3><span>Uses the saved recurring schedule.</span></div></div>
            <p className={`panel-note ${generationReady ? 'success' : ''}`}>
              {generationReady ? 'Schedule and dates are ready for preview.' : 'Add at least one complete schedule block and choose generation dates before previewing sessions.'}
            </p>
            <div className="three-col">
              <label>From<input type="date" value={generationRange.fromDate} onChange={(event) => setGenerationRange((current) => ({ ...current, fromDate: event.target.value }))} /></label>
              <label>To<input type="date" value={generationRange.toDate} onChange={(event) => setGenerationRange((current) => ({ ...current, toDate: event.target.value }))} /></label>
              <div className="generation-actions">
                <button type="button" className="secondary-button" onClick={() => void previewGeneration()} disabled={generationLoading || !generationReady}>Preview</button>
                <button type="button" onClick={() => void generateSessions()} disabled={generationLoading || !generationPreview?.newCount}>Generate</button>
              </div>
            </div>
            {generationPreview ? (
              <div className="generation-preview">
                <span>Total <strong>{generationPreview.total}</strong></span>
                <span>New <strong>{generationPreview.newCount}</strong></span>
                <span>Existing <strong>{generationPreview.existingCount}</strong></span>
                <div className="stack-list">
                  {generationPreview.items.slice(0, 6).map((item) => (
                    <article key={`${item.kind}-${item.sessionIndex}-${item.startsAt}`} className="stack-list-item">
                      <div><strong>{item.title}</strong><span>{item.day} · {formatDate(item.startsAt)}</span></div>
                      <span className={`status-badge ${item.kind === 'new' ? 'pending' : 'scheduled'}`}>{readable(item.kind)}</span>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          <div className="workspace-grid">
            <section className="content-section">
              <div className="section-heading-row">
                <div><h2>Roster</h2><span>{students.length} active learner{students.length === 1 ? '' : 's'}</span></div>
              </div>
              <div className="segmented-control enrollment-tabs" role="tablist" aria-label="Enrollment mode">
                <button type="button" className={enrollmentMode === 'existing' ? 'active' : ''} onClick={() => setEnrollmentMode('existing')}>Existing student</button>
                <button type="button" className={enrollmentMode === 'new' ? 'active' : ''} onClick={() => setEnrollmentMode('new')}>New student</button>
              </div>
              {enrollmentMode === 'existing' ? (
                <form className="student-search-row" onSubmit={submitEnrollment}>
                  <label>Search student<input value={studentQuery} onChange={(event) => setStudentQuery(event.target.value)} placeholder="Name or email" /></label>
                  <button type="button" className="secondary-button" onClick={() => void searchStudents()} disabled={enrolling}>Search</button>
                  <select value={selectedStudentId ?? ''} onChange={(event) => setSelectedStudentId(Number(event.target.value) || undefined)} disabled={!studentResults.length}>
                    <option value="">Select student</option>
                    {studentResults.map((student) => <option key={student.id} value={student.id}>{student.fullName || student.email} ({student.email})</option>)}
                  </select>
                  <button type="submit" className="primary-button" disabled={!selectedStudentId || enrolling}>Enroll</button>
                </form>
              ) : (
                <form className="student-search-row" onSubmit={submitInviteAndEnroll}>
                  <label>New student<input value={studentInviteForm.fullName} onChange={(event) => setStudentInviteForm((current) => ({ ...current, fullName: event.target.value }))} placeholder="Full name" /></label>
                  <label>Email<input type="email" value={studentInviteForm.email} onChange={(event) => setStudentInviteForm((current) => ({ ...current, email: event.target.value }))} placeholder="student@example.com" /></label>
                  <label className="inline-check"><input type="checkbox" checked={studentInviteForm.sendEmail} onChange={(event) => setStudentInviteForm((current) => ({ ...current, sendEmail: event.target.checked }))} /> Send setup email</label>
                  <button type="submit" className="primary-button" disabled={enrolling}>Create and enroll</button>
                </form>
              )}
              <div className="stack-list">
                {students.map((student) => (
                  <article key={student.userId} className="stack-list-item">
                    <div><strong>{student.fullName || student.email || `Student #${student.userId}`}</strong><span>{student.email || 'No email'} · progress {Math.round(student.progressPercent ?? 0)}%</span></div>
                    <button type="button" className="link-button danger" onClick={() => setStudentToRemove(student)} disabled={removingStudentId === student.userId}>
                      {removingStudentId === student.userId ? 'Removing...' : 'Remove'}
                    </button>
                  </article>
                ))}
                {!students.length ? (
                  <EmptyState
                    title="No students enrolled yet"
                    detail="Search an existing student or create a tenant student above to enroll them in this group."
                  />
                ) : null}
              </div>
            </section>
            <aside className="settings-panel workflow-context-panel">
              <div className="section-heading-row compact"><div><h2>Upcoming sessions</h2><span>{selectedGroup.name}</span></div></div>
              <div className="stack-list">
                {sessions.slice(0, 8).map((session) => (
                  <article key={session.id} className="stack-list-item">
                    <div><strong>{session.title}</strong><span>{formatDate(session.startsAt)}</span></div>
                    <span className={`status-badge ${session.status ?? 'scheduled'}`}>{readable(session.status ?? 'scheduled')}</span>
                  </article>
                ))}
                {!sessions.length ? (
                  <EmptyState
                    title="No sessions scheduled yet"
                    detail="Use the saved group schedule to preview and generate sessions."
                  />
                ) : null}
              </div>
            </aside>
          </div>
        </section>
      ) : null}

      {isEditOpen && selectedGroup ? (
        <FormModal labelledBy="edit-group-title" onClose={() => setIsEditOpen(false)} onSubmit={submitUpdateGroup}>
          <div className="modal-header-block">
            <span>{selectedCourse?.title ?? 'Selected course'}</span>
            <h2 id="edit-group-title">Edit group</h2>
          </div>
          {renderGroupForm()}
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={() => setIsEditOpen(false)} disabled={savingGroup}>Cancel</button>
            <button type="submit" className="primary-button" disabled={savingGroup}>{savingGroup ? 'Saving...' : 'Save group'}</button>
          </div>
        </FormModal>
      ) : null}

      {isCreateOpen ? (
        <FormModal labelledBy="create-group-title" onClose={() => setIsCreateOpen(false)} onSubmit={submitCreateGroup}>
          <div className="modal-header-block">
            <span>{selectedCourse?.title ?? 'Course required'}</span>
            <h2 id="create-group-title">Create group</h2>
          </div>
          {renderGroupForm()}
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={() => setIsCreateOpen(false)} disabled={savingGroup}>Cancel</button>
            <button type="submit" className="primary-button" disabled={savingGroup}>{savingGroup ? 'Saving...' : 'Create group'}</button>
          </div>
        </FormModal>
      ) : null}
      {studentToRemove ? (
        <Modal labelledBy="remove-student-title" onClose={() => setStudentToRemove(null)}>
          <div className="modal-header-block">
            <span>Remove enrollment</span>
            <h2 id="remove-student-title">Remove student from group?</h2>
          </div>
          <p className="muted-text">
            {studentToRemove.fullName || studentToRemove.email || `Student #${studentToRemove.userId}`} will be removed from this group roster.
          </p>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={() => setStudentToRemove(null)} disabled={removingStudentId === studentToRemove.userId}>Cancel</button>
            <button type="button" className="danger-button" onClick={() => void removeStudent(studentToRemove)} disabled={removingStudentId === studentToRemove.userId}>
              {removingStudentId === studentToRemove.userId ? 'Removing...' : 'Remove student'}
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
