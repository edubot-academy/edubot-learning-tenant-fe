import { useCallback, useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { FiCalendar, FiCheckSquare, FiClipboard, FiEdit2, FiPlus } from 'react-icons/fi';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState, LoadingState } from '../../components/DataState';
import { FormModal, Modal } from '../../components/Modal';
import {
  createCourseGroup,
  createIndividualCourseGroup,
  enrollUser,
  generateGroupSessions,
  inviteTenantMember,
  listCourseGroups,
  listGroupSessions,
  listGroupStudents,
  listTenantCourses,
  listTenantMembers,
  previewGeneratedSessions,
  unenrollUser,
  updateCourseGroup,
} from '../../services/api';
import type { CompanyMember, Course, CourseGroup, CourseSession, GroupStudent, SessionGenerationPreview, UserSummary } from '../../types/domain';
import { formatDate } from '../../lib/format';
import { commonStatusLabelKeys, courseTypeLabelKeys, enumLabel } from '../../lib/enumLabels';
import { useAuth } from '../auth/AuthProvider';
import { useTenant } from '../tenant/TenantProvider';
import { canCoordinateTenantLearning, canEnrollTenantStudents, isTenantAdmin } from '../tenant/tenantRoles';
import { isCourseWorkflowReady, nextWorkflowSearchParams, workflowPath } from '../workflows/workflowContext';

type GroupStatus = 'planned' | 'open' | 'active' | 'completed' | 'cancelled';
type DeliveryMode = 'group' | 'individual';
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
  deliveryMode: 'group' as DeliveryMode,
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
  createFirstSession: false,
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
    deliveryMode: group.deliveryMode ?? 'group',
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
    createFirstSession: false,
  };
}

export function GroupsPage() {
  const { t } = useTranslation();
  const { activeTenant } = useTenant();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTenantId = activeTenant?.id;
  const canAssignInstructor = isTenantAdmin(user, activeTenant);
  const canCoordinateGroups = canCoordinateTenantLearning(user, activeTenant);
  const canManageEnrollment = canEnrollTenantStudents(user, activeTenant);

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
  const [studentSearchAttempted, setStudentSearchAttempted] = useState(false);
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
  const selectedIndividualStudent = selectedGroup?.deliveryMode === 'individual' ? students[0] : undefined;
  const selectedIndividualStudentName = selectedIndividualStudent
    ? selectedIndividualStudent.fullName || selectedIndividualStudent.email || t('courses.studentFallback', { id: selectedIndividualStudent.userId })
    : '';
  const instructorOptions = useMemo(
    () => members.filter((member) => String(member.role).toLowerCase() === 'instructor'),
    [members],
  );
  const tenantStudentOptions = useMemo(
    () => members
      .filter((member) => String(member.role).toLowerCase() === 'student')
      .map((member) => ({
        id: member.userId,
        email: member.email ?? '',
        fullName: member.fullName,
        role: member.role,
      })),
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
  const generationReady = canCoordinateGroups && scheduleBlocksReady && scheduleDatesReady;
  const selectedCourseReady = isCourseWorkflowReady(selectedCourse);
  const courseTypeLabel = (value: Course['courseType'] | string | undefined | null) => enumLabel(value, courseTypeLabelKeys, t);
  const statusLabel = (value: string | undefined | null) => {
    return enumLabel(value || 'planned', commonStatusLabelKeys, t);
  };
  const deliveryModeLabel = (value?: DeliveryMode | string | null) => (
    value === 'individual' ? t('groups.deliveryIndividual') : t('groups.deliveryGroup')
  );
  const selectedCourseBlocker = (() => {
    if (!selectedCourse) return t('courses.blockerChooseCourse');
    if (!['offline', 'online_live'].includes(String(selectedCourse.courseType ?? ''))) return t('courses.blockerDeliveryType');
    if (selectedCourse.status !== 'approved') return t('courses.blockerApproval');
    if (selectedCourse.isPublished !== true) return t('courses.blockerPublish');
    return '';
  })();
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
      canAssignInstructor || canManageEnrollment
        ? listTenantMembers(activeTenantId).catch(() => [] as CompanyMember[])
        : Promise.resolve([] as CompanyMember[]),
    ])
      .then(([nextCourses, nextMembers]) => {
        if (cancelled) return;
        const eligibleCourses = nextCourses.filter((course) => isCourseWorkflowReady(course));
        setAllCourses(nextCourses);
        setCourses(eligibleCourses);
        setMembers(nextMembers);
      })
      .catch(() => {
        if (!cancelled) toast.error(t('groups.workspaceLoadFailed'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTenantId, canAssignInstructor, canManageEnrollment, t]);

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
        if (!cancelled) toast.error(t('groups.courseGroupsLoadFailed'));
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [courseId, t]);

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
        if (!cancelled) toast.error(t('groups.groupDetailLoadFailed'));
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [groupId, groups, t]);

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
    deliveryMode: groupForm.deliveryMode,
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
    if (!canCoordinateGroups) return;
    if (!courseId) return toast.error(t('groups.selectCourseFirst'));
    if (!groupForm.name.trim()) return toast.error(t('groups.groupNameRequired'));
    if (groupForm.deliveryMode === 'individual' && !canManageEnrollment) {
      return toast.error(t('groups.individualEnrollmentNotAllowed'));
    }
    if (groupForm.deliveryMode === 'individual' && !selectedStudentId) {
      return toast.error(t('groups.selectStudentForIndividual'));
    }
    const payload = toPayload();
    if (groupForm.deliveryMode === 'individual' && groupForm.createFirstSession && (!payload.startDate || !payload.scheduleBlocks.length)) {
      return toast.error(t('groups.createFirstSessionSetupRequired'));
    }
    setSavingGroup(true);
    try {
      const saved = groupForm.deliveryMode === 'individual'
        ? (await createIndividualCourseGroup({
          courseId,
          studentId: selectedStudentId as number,
          name: payload.name,
          startDate: payload.startDate,
          endDate: payload.endDate,
          timezone: payload.timezone,
          location: payload.location,
          meetingProvider: payload.meetingProvider,
          meetingUrl: payload.meetingUrl,
          scheduleBlocks: payload.scheduleBlocks,
          instructorId: payload.instructorId,
          createFirstSession: groupForm.createFirstSession,
        })).group
        : await createCourseGroup({
          ...payload,
          code: payload.code || `${courseId}-${Date.now().toString(36)}`.toUpperCase(),
          courseId,
        });
      await reloadGroups(courseId, saved.id);
      setIsCreateOpen(false);
      setStudentQuery('');
      setStudentResults([]);
      setSelectedStudentId(undefined);
      toast.success(t('groups.groupCreated'));
    } catch {
      toast.error(t('groups.groupCreateFailed'));
    } finally {
      setSavingGroup(false);
    }
  };

  const submitUpdateGroup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCoordinateGroups) return;
    if (!groupId || !courseId) return;
    if (!groupForm.name.trim()) return toast.error(t('groups.groupNameRequired'));
    setSavingGroup(true);
    try {
      await updateCourseGroup(groupId, toPayload());
      await reloadGroups(courseId, groupId);
      setIsEditOpen(false);
      toast.success(t('groups.groupUpdated'));
    } catch {
      toast.error(t('groups.groupUpdateFailed'));
    } finally {
      setSavingGroup(false);
    }
  };

  const searchStudents = useCallback(async () => {
    setStudentSearchAttempted(true);
    const normalized = studentQuery.trim().toLowerCase();
    const results = tenantStudentOptions
      .filter((student) => !normalized
        || student.fullName?.toLowerCase().includes(normalized)
        || student.email.toLowerCase().includes(normalized))
      .slice(0, 12);
    setStudentResults(results);
    setSelectedStudentId(results[0]?.id);
  }, [studentQuery, tenantStudentOptions]);

  const handleStudentSearchChange = (value: string) => {
    setStudentQuery(value);
    setStudentResults([]);
    setSelectedStudentId(undefined);
    setStudentSearchAttempted(false);
  };

  const handleStudentSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    void searchStudents();
  };

  useEffect(() => {
    const canSearchInCreateModal = isCreateOpen && groupForm.deliveryMode === 'individual';
    const canSearchInRoster = selectedGroup && enrollmentMode === 'existing';
    if (!canSearchInCreateModal && !canSearchInRoster) return;
    if (!studentQuery.trim()) {
      setStudentResults([]);
      setSelectedStudentId(undefined);
      setStudentSearchAttempted(false);
      return;
    }
    const timer = window.setTimeout(() => {
      void searchStudents();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [enrollmentMode, groupForm.deliveryMode, isCreateOpen, searchStudents, selectedGroup, studentQuery]);

  const submitEnrollment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManageEnrollment) return;
    if (!courseId || !groupId || !selectedStudentId) return toast.error(t('groups.selectStudentToEnroll'));
    setEnrolling(true);
    try {
      await enrollUser({ courseId, groupId, userId: selectedStudentId });
      await reloadGroupDetail(groupId);
      setStudentQuery('');
      setStudentResults([]);
      setSelectedStudentId(undefined);
      toast.success(t('groups.studentEnrolled'));
    } catch {
      toast.error(t('groups.studentEnrollFailed'));
    } finally {
      setEnrolling(false);
    }
  };

  const submitInviteAndEnroll = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManageEnrollment) return;
    if (!activeTenantId || !courseId || !groupId) return;
    if (!studentInviteForm.fullName.trim() || !studentInviteForm.email.trim()) {
      toast.error(t('groups.studentNameEmailRequired'));
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
      toast.success(member.onboarding?.emailSent ? t('groups.studentInvitedEnrolled') : t('groups.studentCreatedEnrolled'));
    } catch {
      toast.error(t('groups.studentCreateEnrollFailed'));
    } finally {
      setEnrolling(false);
    }
  };

  const removeStudent = async (student: GroupStudent) => {
    if (!canManageEnrollment) return;
    if (!courseId || !groupId) return;
    setRemovingStudentId(student.userId);
    try {
      await unenrollUser(courseId, student.userId);
      await reloadGroupDetail(groupId);
      toast.success(t('groups.studentRemoved'));
    } catch {
      toast.error(t('groups.studentRemoveFailed'));
    } finally {
      setRemovingStudentId(undefined);
      setStudentToRemove(null);
    }
  };

  const previewGeneration = async () => {
    if (!canCoordinateGroups) return;
    if (!groupId) return;
    if (!generationReady) return toast.error(t('groups.completeScheduleFirst'));
    setGenerationLoading(true);
    try {
      setGenerationPreview(await previewGeneratedSessions(groupId, generationRange));
      toast.success(t('groups.previewReady'));
    } catch {
      toast.error(t('groups.previewFailed'));
    } finally {
      setGenerationLoading(false);
    }
  };

  const generateSessions = async () => {
    if (!canCoordinateGroups) return;
    if (!groupId || !generationPreview?.newCount) return toast.error(t('groups.previewNewSessionsFirst'));
    setGenerationLoading(true);
    try {
      const result = await generateGroupSessions(groupId, generationRange);
      await reloadGroupDetail(groupId);
      setGenerationPreview(null);
      toast.success(t('groups.sessionsCreated', { count: result.createdCount }));
    } catch {
      toast.error(t('groups.generateFailed'));
    } finally {
      setGenerationLoading(false);
    }
  };

  const renderGroupForm = (mode: 'create' | 'edit' = 'edit') => (
    <>
      <section className="form-section">
        <h3>{t('groups.groupBasics')}</h3>
        {mode === 'create' ? (
          <>
            <div className="segmented-control delivery-mode-tabs" role="tablist" aria-label={t('groups.deliveryMode')}>
              <button type="button" className={groupForm.deliveryMode === 'group' ? 'active' : ''} onClick={() => setGroupForm((current) => ({ ...current, deliveryMode: 'group', seatLimit: current.seatLimit === '1' ? '' : current.seatLimit }))}>
                {t('groups.deliveryGroup')}
              </button>
              {canManageEnrollment ? (
                <button type="button" className={groupForm.deliveryMode === 'individual' ? 'active' : ''} onClick={() => setGroupForm((current) => ({ ...current, deliveryMode: 'individual', seatLimit: '1' }))}>
                  {t('groups.deliveryIndividual')}
                </button>
              ) : null}
            </div>
            {groupForm.deliveryMode === 'individual' ? (
              <>
                <div className="student-search-row compact">
                  <label>{t('groups.individualStudent')}<input value={studentQuery} onChange={(event) => handleStudentSearchChange(event.target.value)} onKeyDown={handleStudentSearchKeyDown} placeholder={t('groups.nameOrEmail')} /></label>
                  <button type="button" className="secondary-button" onClick={() => void searchStudents()} disabled={enrolling}>{enrolling ? t('groups.searchingStudents') : t('groups.search')}</button>
                  <select value={selectedStudentId ?? ''} onChange={(event) => setSelectedStudentId(Number(event.target.value) || undefined)} disabled={!studentResults.length}>
                    <option value="">{t('groups.selectStudent')}</option>
                    {studentResults.map((student) => <option key={student.id} value={student.id}>{student.fullName || student.email} ({student.email})</option>)}
                  </select>
                  {studentSearchAttempted && !enrolling && !studentResults.length ? <span className="field-note">{t('groups.noMatchingStudents')}</span> : null}
                </div>
                <label className="inline-check">
                  <input
                    type="checkbox"
                    checked={groupForm.createFirstSession}
                    onChange={(event) => setGroupForm((current) => ({ ...current, createFirstSession: event.target.checked }))}
                  /> {t('groups.createFirstSession')}
                </label>
                {groupForm.createFirstSession ? <p className="panel-note">{t('groups.createFirstSessionHint')}</p> : null}
              </>
            ) : null}
          </>
        ) : (
          <span className={`status-badge delivery-${groupForm.deliveryMode}`}>{deliveryModeLabel(groupForm.deliveryMode)}</span>
        )}
        <div className={groupForm.deliveryMode === 'individual' ? '' : 'two-col'}>
          <label>{t('groups.name')}<input value={groupForm.name} onChange={(event) => setGroupForm((current) => ({ ...current, name: event.target.value }))} /></label>
          {groupForm.deliveryMode !== 'individual' ? (
            <label>{t('groups.code')}<input value={groupForm.code} onChange={(event) => setGroupForm((current) => ({ ...current, code: event.target.value }))} placeholder={t('groups.codePlaceholder')} /></label>
          ) : null}
        </div>
        {groupForm.deliveryMode !== 'individual' ? (
          <label>{t('groups.status')}<select value={groupForm.status} onChange={(event) => setGroupForm((current) => ({ ...current, status: event.target.value as GroupStatus }))}>
            <option value="planned">{t('courses.statusPlanned')}</option><option value="open">{t('groups.statusOpen')}</option><option value="active">{t('groups.statusActive')}</option><option value="completed">{t('groups.statusCompleted')}</option><option value="cancelled">{t('groups.statusCancelled')}</option>
          </select></label>
        ) : null}
      </section>
      <section className="form-section">
        <h3>{t('groups.datesCapacity')}</h3>
        <div className="two-col">
          <label>{t('groups.startDate')}<input type="date" value={groupForm.startDate} onChange={(event) => setGroupForm((current) => ({ ...current, startDate: event.target.value }))} /></label>
          <label>{t('groups.endDate')}<input type="date" value={groupForm.endDate} onChange={(event) => setGroupForm((current) => ({ ...current, endDate: event.target.value }))} /></label>
        </div>
        <div className="two-col">
          <label>{t('groups.seatLimit')}<input type="number" min="1" value={groupForm.deliveryMode === 'individual' ? '1' : groupForm.seatLimit} onChange={(event) => setGroupForm((current) => ({ ...current, seatLimit: event.target.value }))} placeholder={t('groups.noLimit')} disabled={groupForm.deliveryMode === 'individual'} /></label>
          <label>{t('groups.timezone')}<input value={groupForm.timezone} onChange={(event) => setGroupForm((current) => ({ ...current, timezone: event.target.value }))} /></label>
        </div>
      </section>
      <section className="form-section">
        <h3>{t('groups.instructorLocation')}</h3>
        {canAssignInstructor ? (
          <label>{t('groups.instructor')}<select value={groupForm.instructorId} onChange={(event) => setGroupForm((current) => ({ ...current, instructorId: event.target.value }))}>
            <option value="">{t('groups.useCourseInstructor')}</option>
            {instructorOptions.map((member) => <option key={member.userId} value={member.userId}>{member.fullName || member.user?.fullName || member.email || member.user?.email || t('groups.instructorFallback', { id: member.userId })}</option>)}
          </select></label>
        ) : null}
        <label>{t('groups.location')}<input value={groupForm.location} onChange={(event) => setGroupForm((current) => ({ ...current, location: event.target.value }))} /></label>
        <div className="two-col">
          <label>{t('groups.meetingProvider')}<input value={groupForm.meetingProvider} onChange={(event) => setGroupForm((current) => ({ ...current, meetingProvider: event.target.value }))} /></label>
          <label>{t('groups.meetingUrl')}<input value={groupForm.meetingUrl} onChange={(event) => setGroupForm((current) => ({ ...current, meetingUrl: event.target.value }))} /></label>
        </div>
      </section>
      <section className="form-section">
        <h3>{t('groups.recurringSchedule')}</h3>
        <div className="schedule-block-list">
          {groupForm.scheduleBlocks.map((block, index) => (
            <div className="three-col" key={`${index}-${block.day}`}>
              <label>{t('groups.scheduleDay')}<select value={block.day} onChange={(event) => setGroupForm((current) => ({
                ...current,
                scheduleBlocks: current.scheduleBlocks.map((item, itemIndex) => itemIndex === index ? { ...item, day: event.target.value as ScheduleDay } : item),
              }))}>
                <option value="mon">{t('groups.dayMon')}</option><option value="tue">{t('groups.dayTue')}</option><option value="wed">{t('groups.dayWed')}</option><option value="thu">{t('groups.dayThu')}</option><option value="fri">{t('groups.dayFri')}</option><option value="sat">{t('groups.daySat')}</option><option value="sun">{t('groups.daySun')}</option>
              </select></label>
              <label>{t('groups.starts')}<input type="time" value={block.startTime} onChange={(event) => setGroupForm((current) => ({
                ...current,
                scheduleBlocks: current.scheduleBlocks.map((item, itemIndex) => itemIndex === index ? { ...item, startTime: event.target.value } : item),
              }))} /></label>
              <label>{t('groups.ends')}<input type="time" value={block.endTime} onChange={(event) => setGroupForm((current) => ({
                ...current,
                scheduleBlocks: current.scheduleBlocks.map((item, itemIndex) => itemIndex === index ? { ...item, endTime: event.target.value } : item),
              }))} /></label>
              {groupForm.scheduleBlocks.length > 1 ? (
                <button type="button" className="secondary-button" onClick={() => setGroupForm((current) => ({
                  ...current,
                  scheduleBlocks: current.scheduleBlocks.filter((_, itemIndex) => itemIndex !== index),
                }))}>{t('groups.removeBlock')}</button>
              ) : null}
            </div>
          ))}
          <button type="button" className="secondary-button" onClick={() => setGroupForm((current) => ({
            ...current,
            scheduleBlocks: [...current.scheduleBlocks, emptyScheduleBlock()],
          }))}>{t('groups.addScheduleBlock')}</button>
        </div>
        {groupForm.deliveryMode !== 'individual' ? (
          <label>{t('groups.scheduleNote')}<textarea value={groupForm.scheduleNote} onChange={(event) => setGroupForm((current) => ({ ...current, scheduleNote: event.target.value }))} /></label>
        ) : null}
      </section>
    </>
  );

  return (
    <>
      <PageHeader title={t('navigation.groups')} eyebrow={activeTenant?.name} />
      <div className="workspace-grid">
        <section className="content-section">
          <div className="section-heading-row">
            <div><h2>{t('navigation.courses')}</h2><span>{t('groups.courseSelectionHint')}</span></div>
            {canCoordinateGroups ? (
              <button type="button" className="primary-button" onClick={() => { setGroupForm(emptyGroupForm); setStudentQuery(''); setStudentResults([]); setSelectedStudentId(undefined); setIsCreateOpen(true); }} disabled={!selectedCourseReady} title={!selectedCourseReady ? selectedCourseBlocker : undefined}><FiPlus /> {t('groups.createGroup')}</button>
            ) : null}
          </div>
          {ineligibleCourseCount > 0 ? (
            <p className="panel-note">{t('groups.ineligibleCourses', { count: ineligibleCourseCount })}</p>
          ) : null}
          <input value={courseQuery} onChange={(event) => setCourseQuery(event.target.value)} placeholder={t('groups.searchCourses')} />
          {loading ? <LoadingState label={t('courses.loading')} /> : null}
          <div className="stack-list">
            {filteredCourses.map((course) => (
              <button key={course.id} type="button" className={`stack-list-item ${course.id === courseId ? 'active' : ''}`} onClick={() => setCourseId(course.id)}>
                <div><strong>{course.title}</strong><span>{courseTypeLabel(course.courseType)} · {statusLabel(course.status)}</span></div>
                <strong className="muted-count">{course.id === courseId ? isCourseWorkflowReady(course) ? t('groups.groupCount', { count: groups.length }) : t('groups.locked') : t('groups.select')}</strong>
              </button>
            ))}
            {!filteredCourses.length ? <EmptyState title={t('courses.noMatchesTitle')} detail={t('groups.noMatchingCoursesDetail')} action={<Link className="secondary-link-button" to="/courses">{t('overview.openCourses')}</Link>} /> : null}
          </div>
        </section>

        <aside className="settings-panel workflow-context-panel">
          <div className="section-heading-row compact">
            <div><h2>{t('groups.courseGroups')}</h2><span>{selectedCourse?.title ?? t('groups.chooseCourse')}</span></div>
          </div>
          {detailLoading ? <LoadingState label={t('groups.loadingGroups')} /> : null}
          <div className="stack-list">
            {groups.map((group) => (
              <button key={group.id} type="button" className={`stack-list-item ${group.id === groupId ? 'active' : ''}`} onClick={() => setGroupId(group.id)}>
                <div><strong>{group.name}</strong><span>{group.code ?? '-'} · {statusLabel(group.status)}</span></div>
                <span className={`status-badge delivery-${group.deliveryMode ?? 'group'}`}>{deliveryModeLabel(group.deliveryMode)}</span>
              </button>
            ))}
            {!groups.length ? (
              <EmptyState
                title={t('groups.emptyGroupsTitle')}
                detail={selectedCourseReady ? t('groups.emptyGroupsDetail') : selectedCourseBlocker}
                action={selectedCourseReady && canCoordinateGroups ? (
                  <button type="button" className="secondary-button" onClick={() => { setGroupForm(emptyGroupForm); setStudentQuery(''); setStudentResults([]); setSelectedStudentId(undefined); setIsCreateOpen(true); }}>
                    {t('groups.createGroup')}
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
            <div><h2>{selectedGroup.name}</h2><span>{selectedIndividualStudentName || selectedCourse?.title || t('courses.selectedCourse')}</span></div>
            <div className="page-actions">
              <span className={`status-badge ${selectedGroup.status ?? 'planned'}`}>{statusLabel(selectedGroup.status)}</span>
              <span className={`status-badge delivery-${selectedGroup.deliveryMode ?? 'group'}`}>{deliveryModeLabel(selectedGroup.deliveryMode)}</span>
              {canCoordinateGroups ? (
                <button type="button" className="secondary-button" onClick={() => { setGroupForm(groupToForm(selectedGroup)); setIsEditOpen(true); }}><FiEdit2 /> {t('groups.editGroup')}</button>
              ) : null}
              <Link className="secondary-link-button" to={nextSessionLink}><FiCalendar /> {t('navigation.sessions')}</Link>
              <Link className="secondary-link-button" to={attendanceLink}><FiCheckSquare /> {t('navigation.attendance')}</Link>
              <Link className="secondary-link-button" to={homeworkLink}><FiClipboard /> {t('navigation.homework')}</Link>
            </div>
          </div>
          <div className="group-summary-grid">
            <section>
              <span>{t('groups.dates')}</span>
              <strong>{selectedGroup.startDate || selectedGroup.endDate ? `${selectedGroup.startDate ?? '-'} - ${selectedGroup.endDate ?? '-'}` : t('groups.notScheduled')}</strong>
            </section>
            <section>
              <span>{t('groups.schedule')}</span>
              <strong>
                {scheduleBlocksReady
                  ? t('groups.scheduleBlockCount', { count: selectedGroup.scheduleBlocks?.filter((block) => block.startTime && block.endTime).length ?? 0 })
                  : t('groups.needsSetup')}
              </strong>
            </section>
            <section>
              <span>{t('groups.deliveryMode')}</span>
              <strong>{deliveryModeLabel(selectedGroup.deliveryMode)}</strong>
            </section>
            <section>
              <span>{t('groups.location')}</span>
              <strong>{selectedGroup.location || selectedGroup.meetingProvider || t('states.notSet')}</strong>
            </section>
          </div>
          <div className="stat-grid compact">
            <section className="stat-tile"><span>{t('courses.students')}</span><strong>{students.length}</strong></section>
            <section className="stat-tile"><span>{t('courses.sessions')}</span><strong>{sessions.length}</strong></section>
            <section className="stat-tile"><span>{t('groups.capacity')}</span><strong>{selectedGroup.seatLimit ?? t('groups.capacityOpen')}</strong></section>
            <section className="stat-tile"><span>{t('groups.timezone')}</span><strong>{selectedGroup.timezone ?? '-'}</strong></section>
          </div>
          {canCoordinateGroups ? (
          <div className="settings-panel session-generation-panel workflow-context-panel compact">
            <div className="section-heading-row compact"><div><h3>{t('groups.generateSessions')}</h3><span>{t('groups.generateSessionsHint')}</span></div></div>
            <p className={`panel-note ${generationReady ? 'success' : ''}`}>
              {generationReady ? t('groups.generationReady') : t('groups.generationNeedsSetup')}
            </p>
            <div className="three-col">
              <label>{t('groups.from')}<input type="date" value={generationRange.fromDate} onChange={(event) => setGenerationRange((current) => ({ ...current, fromDate: event.target.value }))} /></label>
              <label>{t('groups.to')}<input type="date" value={generationRange.toDate} onChange={(event) => setGenerationRange((current) => ({ ...current, toDate: event.target.value }))} /></label>
              <div className="generation-actions">
                <button type="button" className="secondary-button" onClick={() => void previewGeneration()} disabled={generationLoading || !generationReady}>{t('groups.preview')}</button>
                <button type="button" onClick={() => void generateSessions()} disabled={generationLoading || !generationPreview?.newCount}>{t('groups.generate')}</button>
              </div>
            </div>
            {generationPreview ? (
              <div className="generation-preview">
                <span>{t('groups.total')} <strong>{generationPreview.total}</strong></span>
                <span>{t('groups.new')} <strong>{generationPreview.newCount}</strong></span>
                <span>{t('groups.existing')} <strong>{generationPreview.existingCount}</strong></span>
                <div className="stack-list">
                  {generationPreview.items.slice(0, 6).map((item) => (
                    <article key={`${item.kind}-${item.sessionIndex}-${item.startsAt}`} className="stack-list-item">
                      <div><strong>{item.title}</strong><span>{item.day} · {formatDate(item.startsAt)}</span></div>
                      <span className={`status-badge ${item.kind === 'new' ? 'pending' : 'scheduled'}`}>{statusLabel(item.kind)}</span>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          ) : null}
          <div className="workspace-grid">
            <section className="content-section">
              <div className="section-heading-row">
                <div><h2>{t('groups.roster')}</h2><span>{t('groups.activeLearnerCount', { count: students.length })}</span></div>
              </div>
              {canManageEnrollment ? (
              <>
              <div className="segmented-control enrollment-tabs" role="tablist" aria-label={t('groups.enrollmentMode')}>
                <button type="button" className={enrollmentMode === 'existing' ? 'active' : ''} onClick={() => setEnrollmentMode('existing')}>{t('groups.existingStudent')}</button>
                <button type="button" className={enrollmentMode === 'new' ? 'active' : ''} onClick={() => setEnrollmentMode('new')}>{t('groups.newStudent')}</button>
              </div>
              {enrollmentMode === 'existing' ? (
                <form className="student-search-row" onSubmit={submitEnrollment}>
                  <label>{t('groups.searchStudent')}<input value={studentQuery} onChange={(event) => handleStudentSearchChange(event.target.value)} onKeyDown={handleStudentSearchKeyDown} placeholder={t('groups.nameOrEmail')} /></label>
                  <button type="button" className="secondary-button" onClick={() => void searchStudents()} disabled={enrolling}>{enrolling ? t('groups.searchingStudents') : t('groups.search')}</button>
                  <select value={selectedStudentId ?? ''} onChange={(event) => setSelectedStudentId(Number(event.target.value) || undefined)} disabled={!studentResults.length}>
                    <option value="">{t('groups.selectStudent')}</option>
                    {studentResults.map((student) => <option key={student.id} value={student.id}>{student.fullName || student.email} ({student.email})</option>)}
                  </select>
                  {studentSearchAttempted && !enrolling && !studentResults.length ? <span className="field-note">{t('groups.noMatchingStudents')}</span> : null}
                  <button type="submit" className="primary-button" disabled={!selectedStudentId || enrolling}>{t('groups.enroll')}</button>
                </form>
              ) : (
                <form className="student-search-row" onSubmit={submitInviteAndEnroll}>
                  <label>{t('groups.newStudent')}<input value={studentInviteForm.fullName} onChange={(event) => setStudentInviteForm((current) => ({ ...current, fullName: event.target.value }))} placeholder={t('groups.fullName')} /></label>
                  <label>{t('groups.email')}<input type="email" value={studentInviteForm.email} onChange={(event) => setStudentInviteForm((current) => ({ ...current, email: event.target.value }))} placeholder="student@example.com" /></label>
                  <label className="inline-check"><input type="checkbox" checked={studentInviteForm.sendEmail} onChange={(event) => setStudentInviteForm((current) => ({ ...current, sendEmail: event.target.checked }))} /> {t('groups.sendSetupEmail')}</label>
                  <button type="submit" className="primary-button" disabled={enrolling}>{t('groups.createAndEnroll')}</button>
                </form>
              )}
              </>
              ) : null}
              <div className="stack-list">
                {students.map((student) => (
                  <article key={student.userId} className="stack-list-item">
                    <div><strong>{student.fullName || student.email || t('courses.studentFallback', { id: student.userId })}</strong><span>{student.email || t('groups.noEmail')} · {t('groups.progressPercent', { percent: Math.round(student.progressPercent ?? 0) })}</span></div>
                    {canManageEnrollment ? (
                      <button type="button" className="link-button danger" onClick={() => setStudentToRemove(student)} disabled={removingStudentId === student.userId}>
                        {removingStudentId === student.userId ? t('groups.removing') : t('groups.remove')}
                      </button>
                    ) : null}
                  </article>
                ))}
                {!students.length ? (
                  <EmptyState
                    title={t('groups.noStudentsTitle')}
                    detail={t('groups.noStudentsDetail')}
                    action={canManageEnrollment ? (
                      <button type="button" className="secondary-button" onClick={() => setEnrollmentMode('new')}>
                        {t('groups.newStudent')}
                      </button>
                    ) : null}
                  />
                ) : null}
              </div>
            </section>
            <aside className="settings-panel workflow-context-panel">
              <div className="section-heading-row compact"><div><h2>{t('groups.upcomingSessions')}</h2><span>{selectedGroup.name}</span></div></div>
              <div className="stack-list">
                {sessions.slice(0, 8).map((session) => (
                  <article key={session.id} className="stack-list-item">
                    <div><strong>{session.title}</strong><span>{selectedIndividualStudentName ? `${selectedIndividualStudentName} · ${formatDate(session.startsAt)}` : formatDate(session.startsAt)}</span></div>
                    <span className={`status-badge ${session.status ?? 'scheduled'}`}>{statusLabel(session.status)}</span>
                  </article>
                ))}
                {!sessions.length ? (
                  <EmptyState
                    title={t('groups.noSessionsTitle')}
                    detail={t('groups.noSessionsDetail')}
                    action={<Link className="secondary-link-button" to={nextSessionLink}>{t('attendance.scheduleSessions')}</Link>}
                  />
                ) : null}
              </div>
            </aside>
          </div>
        </section>
      ) : null}

      {isEditOpen && selectedGroup && canCoordinateGroups ? (
        <FormModal labelledBy="edit-group-title" onClose={() => setIsEditOpen(false)} onSubmit={submitUpdateGroup}>
          <div className="modal-header-block">
            <span>{selectedCourse?.title ?? t('courses.selectedCourse')}</span>
            <h2 id="edit-group-title">{t('groups.editGroup')}</h2>
          </div>
          {renderGroupForm('edit')}
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={() => setIsEditOpen(false)} disabled={savingGroup}>{t('courses.cancel')}</button>
            <button type="submit" className="primary-button" disabled={savingGroup}>{savingGroup ? t('courses.saving') : t('groups.saveGroup')}</button>
          </div>
        </FormModal>
      ) : null}

      {isCreateOpen && canCoordinateGroups ? (
        <FormModal labelledBy="create-group-title" onClose={() => setIsCreateOpen(false)} onSubmit={submitCreateGroup}>
          <div className="modal-header-block">
            <span>{selectedCourse?.title ?? t('groups.courseRequired')}</span>
            <h2 id="create-group-title">{t('groups.createGroup')}</h2>
          </div>
          {renderGroupForm('create')}
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={() => setIsCreateOpen(false)} disabled={savingGroup}>{t('courses.cancel')}</button>
            <button type="submit" className="primary-button" disabled={savingGroup}>{savingGroup ? t('courses.saving') : t('groups.createGroup')}</button>
          </div>
        </FormModal>
      ) : null}
      {studentToRemove && canManageEnrollment ? (
        <Modal labelledBy="remove-student-title" onClose={() => setStudentToRemove(null)}>
          <div className="modal-header-block">
            <span>{t('groups.removeEnrollment')}</span>
            <h2 id="remove-student-title">{t('groups.removeStudentTitle')}</h2>
          </div>
          <p className="muted-text">
            {t('groups.removeStudentDetail', { name: studentToRemove.fullName || studentToRemove.email || t('courses.studentFallback', { id: studentToRemove.userId }) })}
          </p>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={() => setStudentToRemove(null)} disabled={removingStudentId === studentToRemove.userId}>{t('courses.cancel')}</button>
            <button type="button" className="danger-button" onClick={() => void removeStudent(studentToRemove)} disabled={removingStudentId === studentToRemove.userId}>
              {removingStudentId === studentToRemove.userId ? t('groups.removing') : t('groups.removeStudent')}
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
