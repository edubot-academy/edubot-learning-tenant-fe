import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiBookOpen, FiCalendar, FiCheckSquare, FiChevronDown, FiEdit2, FiFileText, FiFilter, FiPlus, FiTrash2, FiUsers } from 'react-icons/fi';
import { EmptyState } from '../../components/DataState';
import { formatDate } from '../../lib/format';
import { workflowPath, type WorkflowScope } from '../workflows/workflowContext';
import { courseHealthFilters, type CourseHealthFilter } from './courseHealth';
import type { CourseProgressFilter } from './courseRosterFilters';
import type { CourseNextAction } from './courseReadiness';
import type { Course, CourseGroup, CourseSession, GroupStudent } from '../../types/domain';

export type TenantCourseType = 'offline' | 'online_live' | 'video';
export type CourseFormState = {
  title: string;
  description: string;
  courseType: TenantCourseType;
  instructorId: number | undefined;
};
export type CourseTypeOption = { value: TenantCourseType; label: string };
export type TranslatedCourseReadiness = {
  label: string;
  detail: string;
  tone: 'ready' | 'blocked' | 'pending';
  nextAction: CourseNextAction;
};
export type CourseWorkflowStep = {
  label: string;
  detail: string;
  complete: boolean;
  state: 'complete' | 'current' | 'upcoming';
  action: { type: CourseNextAction; label: string } | null;
};
type CourseTypeLabel = (value: Course['courseType'] | string | undefined | null) => string;
type StatusLabel = (value: string | undefined | null) => string;
type PublishLabel = (published?: boolean | null) => string;
type DeliveryModeLabel = (value?: CourseGroup['deliveryMode'] | CourseSession['groupDeliveryMode'] | string | null) => string;

const summaryHealthFilters = new Set<CourseHealthFilter>(['no_groups', 'no_sessions', 'certificate_missing']);
const courseIdValue = (course: Pick<Course, 'id'>) => Number(course.id);

function readinessBadge(readiness: TranslatedCourseReadiness) {
  return <span className={`status-badge readiness-${readiness.tone}`}>{readiness.label}</span>;
}

function statusBadge(status: string | undefined | null, label: string, fallback: string) {
  return <span className={`status-badge ${status || fallback}`}>{label}</span>;
}

function publishBadge(published: boolean | undefined | null, label: string) {
  return <span className={`status-badge ${published ? 'published' : 'draft'}`}>{label}</span>;
}

function deliveryBadge(value: string | undefined | null, label: string) {
  return <span className={`status-badge delivery-${value ?? 'group'}`}>{label}</span>;
}

function progressCell(percent: number | undefined | null, label: string, className = 'progress-cell') {
  const safePercent = Math.min(100, Math.max(0, percent ?? 0));
  return (
    <div className={className}>
      <span style={{ width: `${safePercent}%` }} />
      <strong>{label}</strong>
    </div>
  );
}

export function CourseSummaryBanner({
  course,
  courseType,
  readiness,
  fallbackDetail,
  groupCount,
  sessionCount,
  action,
}: {
  course: Course;
  courseType: string;
  readiness: TranslatedCourseReadiness | null;
  fallbackDetail: string;
  groupCount: number;
  sessionCount: number;
  action: ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <section className="course-context-strip workflow-context-panel" aria-label={t('courses.selectedSummary')}>
      <div>
        <span className="ui-kicker">{readiness?.label ?? t('courses.selectedCourse')}</span>
        <h2>{course.title}</h2>
        <p>{readiness?.detail ?? fallbackDetail}</p>
        <div className="course-context-metrics">
          <span><strong>{groupCount}</strong> {t('courses.groupsLower')}</span>
          <span><strong>{course.enrolledStudents ?? 0}</strong> {t('courses.enrolledLower')}</span>
          <span><strong>{sessionCount}</strong> {t('courses.sessionsLower')}</span>
        </div>
      </div>
      <div className="course-context-badges">
        <span className="muted-text">{courseType}</span>
        {readiness ? readinessBadge(readiness) : null}
        <span className="course-primary-next-action">{action}</span>
      </div>
    </section>
  );
}

export function CourseWorkflowChecklist({
  steps,
  renderAction,
}: {
  steps: CourseWorkflowStep[];
  renderAction: (action: CourseNextAction, label: string, className?: string) => ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <div className="course-workflow-checklist" aria-label={t('courses.workflowChecklist')}>
      {steps.map((step) => (
        <article className={step.state} key={step.label}>
          <FiCheckSquare aria-hidden="true" />
          <span>
            <strong>{step.label}</strong>
            <small>{step.detail}</small>
            {step.action ? (
              <span className="course-workflow-action">
                {renderAction(step.action.type, step.action.label, 'secondary-button compact')}
              </span>
            ) : null}
          </span>
        </article>
      ))}
    </div>
  );
}

export function CourseOperationsGrid({
  courseId,
  scope,
  deliveryReady,
  operationalReady,
  attendanceEnabled,
  homeworkEnabled,
  certificatesEnabled,
}: {
  courseId: number;
  scope: WorkflowScope;
  deliveryReady: boolean;
  operationalReady: boolean;
  attendanceEnabled: boolean;
  homeworkEnabled: boolean;
  certificatesEnabled: boolean;
}) {
  const { t } = useTranslation();
  const items = [
    { key: 'groups', label: t('courses.groups'), icon: <FiUsers />, to: workflowPath('/groups', scope), enabled: deliveryReady, visible: true },
    { key: 'sessions', label: t('courses.sessions'), icon: <FiCalendar />, to: workflowPath('/sessions', scope), enabled: deliveryReady, visible: true },
    { key: 'attendance', label: t('navigation.attendance'), icon: <FiCheckSquare />, to: workflowPath('/attendance', scope), enabled: deliveryReady, visible: attendanceEnabled },
    { key: 'homework', label: t('courses.homework'), icon: <FiFileText />, to: workflowPath('/homework', scope), enabled: operationalReady, visible: homeworkEnabled },
    { key: 'certificates', label: t('navigation.certificates'), icon: <FiBookOpen />, to: workflowPath('/certificates', { courseId, tab: 'rules' }), enabled: operationalReady, visible: certificatesEnabled },
  ];

  return (
    <div className="course-action-grid">
      {items.filter((item) => item.visible).map((item) => (
        item.enabled ? (
          <Link className="course-action-card" to={item.to} key={item.key}>
            {item.icon}
            <span>{item.label}</span>
          </Link>
        ) : (
          <span className="course-action-card disabled" key={item.key}>
            {item.icon}
            <span>{item.label}</span>
          </span>
        )
      ))}
    </div>
  );
}

export function CourseCatalogTable({
  courses,
  selectedCourseId,
  selectCourse,
  courseTypeLabel,
  getReadiness,
}: {
  courses: Course[];
  selectedCourseId: number | undefined;
  selectCourse: (courseId: number) => void;
  courseTypeLabel: CourseTypeLabel;
  getReadiness: (course: Course) => TranslatedCourseReadiness;
}) {
  const { t } = useTranslation();

  return (
    <div className="table-wrap course-catalog-table">
      <table>
        <thead>
          <tr>
            <th>{t('courses.course')}</th>
            <th>{t('courses.type')}</th>
            <th>{t('courses.readiness')}</th>
            <th>{t('courses.students')}</th>
          </tr>
        </thead>
        <tbody>
          {courses.map((course) => {
            const id = courseIdValue(course);
            const readiness = getReadiness(course);
            return (
              <tr
                key={id}
                className={`interactive-row ${id === selectedCourseId ? 'selected-row' : ''}`}
                tabIndex={0}
                onClick={() => selectCourse(id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    selectCourse(id);
                  }
                }}
              >
                <td data-label={t('courses.course')}>
                  <button
                    type="button"
                    className="table-row-button"
                    aria-pressed={id === selectedCourseId}
                    onClick={(event) => {
                      event.stopPropagation();
                      selectCourse(id);
                    }}
                  >
                    <strong>{course.title}</strong>
                    {course.instructor?.fullName ? <small>{course.instructor.fullName}</small> : null}
                  </button>
                </td>
                <td data-label={t('courses.type')}>{courseTypeLabel(course.courseType)}</td>
                <td data-label={t('courses.readiness')}>
                  <span className="course-readiness-cell">
                    {readinessBadge(readiness)}
                    <small>{readiness.detail}</small>
                  </span>
                </td>
                <td data-label={t('courses.students')}>{course.enrolledStudents ?? 0}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function CourseEmptyOnboarding({
  canCreateCourse,
  courseTypeOptionsAvailable,
  openCreateModal,
}: {
  canCreateCourse: boolean;
  courseTypeOptionsAvailable: boolean;
  openCreateModal: () => void;
}) {
  const { t } = useTranslation();
  const steps = [
    t('courses.emptyStepCourse'),
    t('courses.emptyStepInstructor'),
    t('courses.emptyStepPublish'),
    t('courses.emptyStepGroup'),
    t('courses.emptyStepSession'),
  ];

  return (
    <section className="course-empty-onboarding state-panel">
      <FiBookOpen aria-hidden="true" />
      <strong>{t('courses.emptyTitle')}</strong>
      <span>{canCreateCourse ? t('courses.emptyCreateDetail') : t('courses.emptyAssignedDetail')}</span>
      <div className="course-empty-steps" aria-label={t('courses.emptySetupSteps')}>
        {steps.map((step, index) => (
          <article key={step}>
            <small>{index + 1}</small>
            <span>{step}</span>
          </article>
        ))}
      </div>
      <div className="state-panel-action">
        {canCreateCourse ? (
          <button type="button" className="primary-button" onClick={openCreateModal} disabled={!courseTypeOptionsAvailable}>
            <FiPlus />
            {t('courses.createCourse')}
          </button>
        ) : (
          <Link className="secondary-link-button" to="/settings">{t('courses.reviewSettings')}</Link>
        )}
      </div>
    </section>
  );
}

export function CourseHealthFilterBar({
  healthFilter,
  healthCounts,
  courseHealthComplete,
  setHealthFilter,
  healthFilterLabel,
}: {
  healthFilter: CourseHealthFilter;
  healthCounts: Record<CourseHealthFilter, number>;
  courseHealthComplete: boolean;
  setHealthFilter: (filter: CourseHealthFilter) => void;
  healthFilterLabel: (filter: CourseHealthFilter) => string;
}) {
  const { t } = useTranslation();

  return (
    <details className="course-health-disclosure">
      <summary>
        <span>
          <FiFilter aria-hidden="true" />
          <strong>{t('courses.healthFilters')}</strong>
          <small>{t('courses.healthFiltersDetail')}</small>
        </span>
        <span className="disclosure-summary-meta">
          <span className="status-badge neutral">{healthFilterLabel(healthFilter)}</span>
          <FiChevronDown className="disclosure-chevron" aria-hidden="true" />
        </span>
      </summary>
      <div className="member-role-chips course-health-filters" aria-label={t('courses.healthFilters')}>
        {courseHealthFilters.map((filter) => {
          const disabled = summaryHealthFilters.has(filter) && !courseHealthComplete;
          return (
            <button
              key={filter}
              type="button"
              className={healthFilter === filter ? 'active' : ''}
              disabled={disabled}
              title={disabled ? t('courses.healthSummaryUnavailable') : undefined}
              onClick={() => setHealthFilter(filter)}
            >
              {healthFilterLabel(filter)}
              <strong>{healthCounts[filter] ?? 0}</strong>
            </button>
          );
        })}
        {!courseHealthComplete ? <span className="panel-note compact">{t('courses.healthSummaryUnavailable')}</span> : null}
      </div>
    </details>
  );
}

export function CourseToolbar({
  query,
  setQuery,
  courses,
  selectedCourseId,
  selectCourse,
}: {
  query: string;
  setQuery: (query: string) => void;
  courses: Course[];
  selectedCourseId: number | undefined;
  selectCourse: (courseId: number | undefined) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="filters-row">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t('courses.searchPlaceholder')}
      />
      <select value={selectedCourseId ?? ''} onChange={(event) => selectCourse(Number(event.target.value) || undefined)}>
        <option value="">{t('courses.selectCourse')}</option>
        {courses.map((course) => {
          const id = courseIdValue(course);
          return <option key={id} value={id}>{course.title}</option>;
        })}
      </select>
    </div>
  );
}

export function CourseStatePanel({
  course,
  canEditCourse,
  canApproveCourses,
  canDeleteCourse,
  statusUpdating,
  deletingCourse,
  courseTypeLabel,
  statusLabel,
  publishLabel,
  openEditModal,
  changeCourseStatus,
  setCourseRejectPending,
  setCourseDeletePending,
}: {
  course: Course;
  canEditCourse: boolean;
  canApproveCourses: boolean;
  canDeleteCourse: boolean;
  statusUpdating: boolean;
  deletingCourse: boolean;
  courseTypeLabel: CourseTypeLabel;
  statusLabel: StatusLabel;
  publishLabel: PublishLabel;
  openEditModal: () => void;
  changeCourseStatus: (courseId: number, status: 'pending' | 'approved' | 'rejected') => void;
  setCourseRejectPending: (course: Course) => void;
  setCourseDeletePending: (course: Course) => void;
}) {
  const { t } = useTranslation();
  const courseId = courseIdValue(course);
  const courseStatus = course.status || 'draft';
  const canApproveDraft = canApproveCourses && ['draft', 'rejected'].includes(courseStatus);
  const canSubmitDraft = !canApproveCourses && ['draft', 'rejected'].includes(courseStatus);

  return (
    <details className="course-panel-block course-secondary-panel">
      <summary>
        <h3>{t('courses.courseState')}</h3>
        <span className="disclosure-summary-meta">
          {statusBadge(course.status, statusLabel(course.status), 'draft')}
          <FiChevronDown className="disclosure-chevron" aria-hidden="true" />
        </span>
      </summary>
      <div className="definition-grid">
        <span>{t('courses.course')}</span><strong>{course.title}</strong>
        <span>{t('courses.type')}</span><strong>{courseTypeLabel(course.courseType)}</strong>
        <span>{t('courses.status')}</span><strong>{statusBadge(course.status, statusLabel(course.status), 'draft')}</strong>
        <span>{t('courses.publishedColumn')}</span><strong>{publishBadge(course.isPublished, publishLabel(course.isPublished))}</strong>
      </div>
      <div className="modal-actions">
        {canEditCourse ? (
          <button type="button" className="secondary-button" onClick={openEditModal}>
            <FiEdit2 />
            {t('courses.editCourse')}
          </button>
        ) : null}
        {canApproveCourses && course.status === 'pending' ? (
          <button type="button" className="primary-button" disabled={statusUpdating} onClick={() => changeCourseStatus(courseId, 'approved')}>
            {t('courses.approveAndPublish')}
          </button>
        ) : null}
        {canApproveCourses && course.status === 'pending' ? (
          <button type="button" className="secondary-button" disabled={statusUpdating} onClick={() => setCourseRejectPending(course)}>
            {t('courses.reject')}
          </button>
        ) : null}
        {canApproveDraft ? (
          <button type="button" className="primary-button" disabled={statusUpdating} onClick={() => changeCourseStatus(courseId, 'approved')}>
            {t('courses.approveAndPublish')}
          </button>
        ) : null}
        {canSubmitDraft ? (
          <button type="button" className="secondary-button" disabled={statusUpdating} onClick={() => changeCourseStatus(courseId, 'pending')}>
            {t('courses.submitForApproval')}
          </button>
        ) : null}
        {canDeleteCourse ? (
          <button type="button" className="danger-button" disabled={statusUpdating || deletingCourse} onClick={() => setCourseDeletePending(course)}>
            <FiTrash2 />
            {t('courses.deleteCourse')}
          </button>
        ) : null}
      </div>
    </details>
  );
}

export function SelectedGroupPanel({
  groups,
  selectedGroupId,
  selectedGroup,
  courseDetailLoading,
  loadCourseDetails,
  setSelectedGroupId,
  statusLabel,
  deliveryModeLabel,
  studentCount,
  sessionCount,
  completedStudents,
  groupProgressAverage,
}: {
  groups: CourseGroup[];
  selectedGroupId: number | undefined;
  selectedGroup: CourseGroup | undefined;
  courseDetailLoading: boolean;
  loadCourseDetails: () => void;
  setSelectedGroupId: (groupId: number | undefined) => void;
  statusLabel: StatusLabel;
  deliveryModeLabel: DeliveryModeLabel;
  studentCount: number;
  sessionCount: number;
  completedStudents: number;
  groupProgressAverage: number;
}) {
  const { t } = useTranslation();

  return (
    <section className="course-panel-block">
      <h3>{t('courses.selectedGroup')}</h3>
      <label>
        {t('courses.group')}
        <select
          value={selectedGroupId ?? ''}
          onFocus={loadCourseDetails}
          onMouseDown={loadCourseDetails}
          onChange={(event) => setSelectedGroupId(Number(event.target.value) || undefined)}
          disabled={courseDetailLoading}
        >
          <option value="">{t('courses.selectGroup')}</option>
          {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
        </select>
      </label>

      {selectedGroup ? (
        <div className="course-group-summary workflow-context-panel compact">
          <div className="definition-grid">
            <span>{t('courses.code')}</span><strong>{selectedGroup.code ?? '-'}</strong>
            <span>{t('courses.groupStatus')}</span><strong>{statusBadge(selectedGroup.status, statusLabel(selectedGroup.status), 'planned')}</strong>
            <span>{t('groups.deliveryMode')}</span><strong>{deliveryBadge(selectedGroup.deliveryMode, deliveryModeLabel(selectedGroup.deliveryMode))}</strong>
            <span>{t('courses.dates')}</span><strong>{selectedGroup.startDate || selectedGroup.endDate ? `${selectedGroup.startDate ?? '-'} - ${selectedGroup.endDate ?? '-'}` : '-'}</strong>
          </div>
          <div className="course-group-metrics">
            <span><FiUsers /><strong>{studentCount}</strong> {t('courses.studentsLower')}</span>
            <span><FiCalendar /><strong>{sessionCount}</strong> {t('courses.sessionsLower')}</span>
            <span><FiCheckSquare /><strong>{completedStudents}</strong> {t('courses.completedLower')}</span>
          </div>
          {progressCell(groupProgressAverage, t('courses.averageProgress', { percent: groupProgressAverage }), 'progress-cell course-progress-cell')}
        </div>
      ) : null}
    </section>
  );
}

export function RecentSessionsPanel({
  sessions,
  selectedGroup,
  statusLabel,
  deliveryModeLabel,
}: {
  sessions: CourseSession[];
  selectedGroup: CourseGroup | undefined;
  statusLabel: StatusLabel;
  deliveryModeLabel: DeliveryModeLabel;
}) {
  const { t } = useTranslation();

  return (
    <details className="course-panel-block course-secondary-panel">
      <summary>
        <h3>{t('courses.recentSessions')}</h3>
        <span className="disclosure-summary-meta">
          <span className="muted-count">{sessions.length}</span>
          <FiChevronDown className="disclosure-chevron" aria-hidden="true" />
        </span>
      </summary>
      <div className="stack-list">
        {sessions.slice(0, 5).map((session) => {
          const deliveryMode = session.groupDeliveryMode ?? selectedGroup?.deliveryMode;
          return (
            <article className="stack-list-item" key={session.id}>
              <div>
                <strong>{session.title}</strong>
                <span>{formatDate(session.startsAt)}</span>
              </div>
              <strong>
                {statusBadge(session.status, statusLabel(session.status), 'scheduled')}
                {' '}{deliveryBadge(deliveryMode, deliveryModeLabel(deliveryMode))}
              </strong>
            </article>
          );
        })}
        {!sessions.length ? <span className="muted-text">{t('courses.noSessions')}</span> : null}
      </div>
    </details>
  );
}

export function GroupRosterSection({
  selectedGroup,
  students,
  studentQuery,
  progressFilter,
  setStudentQuery,
  setProgressFilter,
  clearFilters,
}: {
  selectedGroup: CourseGroup;
  students: GroupStudent[];
  studentQuery: string;
  progressFilter: CourseProgressFilter;
  setStudentQuery: (query: string) => void;
  setProgressFilter: (filter: CourseProgressFilter) => void;
  clearFilters: () => void;
}) {
  const { t } = useTranslation();
  const hasActiveFilters = Boolean(studentQuery.trim()) || progressFilter !== 'all';

  return (
    <section className="content-section course-roster-section">
      <div className="section-heading-row">
        <div>
          <h2>{t('courses.groupRoster')}</h2>
          <span>{selectedGroup.name}</span>
        </div>
        <strong className="muted-count">{t('courses.shownCount', { count: students.length })}</strong>
      </div>
      <div className="filters-row three roster-filters">
        <input value={studentQuery} onChange={(event) => setStudentQuery(event.target.value)} placeholder={t('courses.searchStudent')} />
        <select value={progressFilter} onChange={(event) => setProgressFilter(event.target.value as CourseProgressFilter)}>
          <option value="all">{t('courses.allProgress')}</option>
          <option value="not_started">{t('courses.progressNotStarted')}</option>
          <option value="in_progress">{t('courses.progressInProgress')}</option>
          <option value="completed">{t('courses.completed')}</option>
        </select>
        <button type="button" className="secondary-button" onClick={clearFilters}>
          {t('courses.clearFilters')}
        </button>
      </div>
      {!students.length ? (
        <EmptyState
          title={hasActiveFilters ? t('courses.noMatchingStudents') : t('courses.noStudentsTitle')}
          detail={hasActiveFilters ? t('courses.noMatchingStudentsDetail') : t('courses.noStudentsDetail')}
          action={hasActiveFilters ? (
            <button type="button" className="secondary-button" onClick={clearFilters}>
              {t('courses.clearFilters')}
            </button>
          ) : null}
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('courses.student')}</th>
                <th>{t('courses.email')}</th>
                <th>{t('courses.progress')}</th>
                <th>{t('courses.completed')}</th>
                <th>{t('courses.enrolled')}</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.userId}>
                  <td>
                    <strong>{student.fullName || t('courses.studentFallback', { id: student.userId })}</strong>
                    {student.phoneNumber ? <small>{student.phoneNumber}</small> : null}
                  </td>
                  <td>{student.email ?? '-'}</td>
                  <td>
                    {progressCell(student.progressPercent, `${student.progressPercent ?? 0}%`)}
                  </td>
                  <td>{student.completed ? t('courses.completed') : t('courses.progressInProgress')}</td>
                  <td>{formatDate(student.enrolledAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
