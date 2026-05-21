import { type Dispatch, type FormEvent, type SetStateAction } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FormModal, Modal } from '../../components/Modal';
import type { CompanyMember, Course } from '../../types/domain';
import type { CourseFormState, CourseTypeOption, TenantCourseType } from './courseComponents';

function memberDisplayName(member: CompanyMember, fallback: string) {
  return member.fullName || member.user?.fullName || member.email || member.user?.email || fallback;
}

function CourseFormFields({
  idPrefix,
  form,
  errors,
  courseTypeOptions,
  instructorMembers,
  instructorDisabled,
  showGuidance,
  showNoInstructorCallout,
  setForm,
  courseTypeDetail,
}: {
  idPrefix: string;
  form: CourseFormState;
  errors: Record<string, string>;
  courseTypeOptions: CourseTypeOption[];
  instructorMembers: CompanyMember[];
  instructorDisabled: boolean;
  showGuidance: boolean;
  showNoInstructorCallout: boolean;
  setForm: Dispatch<SetStateAction<CourseFormState>>;
  courseTypeDetail: (value: TenantCourseType) => string;
}) {
  const { t } = useTranslation();
  const titleErrorId = `${idPrefix}-title-error`;
  const typeErrorId = `${idPrefix}-type-error`;
  const descriptionErrorId = `${idPrefix}-description-error`;
  const instructorErrorId = `${idPrefix}-instructor-error`;

  return (
    <>
      <label>
        {t('courses.title')}
        <input
          className={errors.title ? 'input-error' : undefined}
          aria-invalid={Boolean(errors.title)}
          aria-describedby={errors.title ? titleErrorId : undefined}
          value={form.title}
          onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
          placeholder={t('courses.titlePlaceholder')}
          autoFocus
        />
        {errors.title ? <small className="field-error" id={titleErrorId}>{errors.title}</small> : null}
      </label>
      <label>
        {t('courses.type')}
        <select
          className={errors.courseType ? 'input-error' : undefined}
          aria-invalid={Boolean(errors.courseType)}
          aria-describedby={errors.courseType || showGuidance ? typeErrorId : undefined}
          value={form.courseType}
          onChange={(event) => setForm((current) => ({ ...current, courseType: event.target.value as TenantCourseType }))}
        >
          {courseTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        {errors.courseType || showGuidance ? (
          <small className={errors.courseType ? 'field-error' : 'muted-text'} id={typeErrorId}>
            {errors.courseType || courseTypeDetail(form.courseType)}
          </small>
        ) : null}
      </label>
      <label>
        {t('courses.description')}
        <textarea
          className={errors.description ? 'input-error' : undefined}
          aria-invalid={Boolean(errors.description)}
          aria-describedby={errors.description || showGuidance ? descriptionErrorId : undefined}
          value={form.description}
          onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
          placeholder={t('courses.descriptionPlaceholder')}
          rows={4}
        />
        {errors.description || showGuidance ? (
          <small className={errors.description ? 'field-error' : 'muted-text'} id={descriptionErrorId}>
            {errors.description || t('courses.descriptionGuidance')}
          </small>
        ) : null}
      </label>
      <label>
        {t('courses.instructor')}
        <select
          className={errors.instructorId ? 'input-error' : undefined}
          aria-invalid={Boolean(errors.instructorId)}
          aria-describedby={errors.instructorId ? instructorErrorId : undefined}
          value={form.instructorId ?? ''}
          onChange={(event) => setForm((current) => ({ ...current, instructorId: Number(event.target.value) || undefined }))}
          disabled={instructorDisabled}
        >
          <option value="">{t('courses.selectInstructor')}</option>
          {instructorMembers.map((member) => (
            <option key={`${member.userId}-${member.role}`} value={member.userId}>
              {memberDisplayName(member, t('courses.userFallback', { id: member.userId }))}
            </option>
          ))}
        </select>
        {errors.instructorId ? <small className="field-error" id={instructorErrorId}>{errors.instructorId}</small> : null}
        {showNoInstructorCallout ? (
          <span className="field-error course-field-note">
            <strong>{t('courses.noInstructorsTitle')}</strong>
            <span>
              {t('courses.noInstructorsDetail')}{' '}
              <Link to="/members">{t('courses.inviteInstructor')}</Link>
            </span>
          </span>
        ) : null}
      </label>
    </>
  );
}

export function CourseCreateModal({
  form,
  errors,
  courseTypeOptions,
  instructorMembers,
  activeRole,
  isInstructorCreator,
  createInstructorUnavailable,
  creatingCourse,
  videoEnabled,
  setForm,
  courseTypeDetail,
  onClose,
  onSubmit,
}: {
  form: CourseFormState;
  errors: Record<string, string>;
  courseTypeOptions: CourseTypeOption[];
  instructorMembers: CompanyMember[];
  activeRole: string | null | undefined;
  isInstructorCreator: boolean;
  createInstructorUnavailable: boolean;
  creatingCourse: boolean;
  videoEnabled: boolean;
  setForm: Dispatch<SetStateAction<CourseFormState>>;
  courseTypeDetail: (value: TenantCourseType) => string;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const { t } = useTranslation();

  return (
    <FormModal labelledBy="create-course-title" onClose={onClose} onSubmit={onSubmit}>
      <div className="modal-header-block">
        <span>{isInstructorCreator ? t('courses.createModalInstructorEyebrow') : t('courses.createModalEyebrow')}</span>
        <h2 id="create-course-title">{t('courses.newCourse')}</h2>
        {isInstructorCreator ? <p>{t('courses.instructorCreateDetail')}</p> : null}
      </div>
      <CourseFormFields
        idPrefix="create-course"
        form={form}
        errors={errors}
        courseTypeOptions={courseTypeOptions}
        instructorMembers={instructorMembers}
        instructorDisabled={activeRole === 'instructor' || createInstructorUnavailable}
        showGuidance
        showNoInstructorCallout={createInstructorUnavailable}
        setForm={setForm}
        courseTypeDetail={courseTypeDetail}
      />
      {!videoEnabled ? <p className="muted-text">{t('courses.videoControlled')}</p> : null}
      <div className="modal-actions">
        <button type="button" className="secondary-button" onClick={onClose}>{t('courses.cancel')}</button>
        <button type="submit" className="primary-button" disabled={creatingCourse || !courseTypeOptions.length || createInstructorUnavailable}>
          {creatingCourse ? t('courses.creating') : t('courses.createCourse')}
        </button>
      </div>
    </FormModal>
  );
}

export function CourseEditModal({
  form,
  errors,
  courseTypeOptions,
  instructorMembers,
  activeRole,
  savingCourse,
  setForm,
  courseTypeDetail,
  onClose,
  onSubmit,
}: {
  form: CourseFormState;
  errors: Record<string, string>;
  courseTypeOptions: CourseTypeOption[];
  instructorMembers: CompanyMember[];
  activeRole: string | null | undefined;
  savingCourse: boolean;
  setForm: Dispatch<SetStateAction<CourseFormState>>;
  courseTypeDetail: (value: TenantCourseType) => string;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const { t } = useTranslation();

  return (
    <FormModal labelledBy="edit-course-title" onClose={onClose} onSubmit={onSubmit}>
      <div className="modal-header-block">
        <span>{t('courses.privateTenantCourse')}</span>
        <h2 id="edit-course-title">{t('courses.editCourse')}</h2>
      </div>
      <CourseFormFields
        idPrefix="edit-course"
        form={form}
        errors={errors}
        courseTypeOptions={courseTypeOptions}
        instructorMembers={instructorMembers}
        instructorDisabled={activeRole === 'instructor'}
        showGuidance={false}
        showNoInstructorCallout={false}
        setForm={setForm}
        courseTypeDetail={courseTypeDetail}
      />
      <p className="muted-text">{t('courses.privateScopeNote')}</p>
      <div className="modal-actions">
        <button type="button" className="secondary-button" onClick={onClose} disabled={savingCourse}>{t('courses.cancel')}</button>
        <button type="submit" className="primary-button" disabled={savingCourse || !courseTypeOptions.length}>
          {savingCourse ? t('courses.saving') : t('courses.saveCourse')}
        </button>
      </div>
    </FormModal>
  );
}

export function CourseRejectDialog({
  course,
  statusUpdating,
  onClose,
  onConfirm,
}: {
  course: Course;
  statusUpdating: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Modal labelledBy="reject-course-title" onClose={onClose}>
      <div className="modal-header-block">
        <span>{t('courses.reject')}</span>
        <h2 id="reject-course-title">{t('courses.rejectCourseTitle')}</h2>
        <p>{t('courses.rejectCourseDetail', { title: course.title })}</p>
      </div>
      <div className="modal-actions">
        <button type="button" className="secondary-button" onClick={onClose} disabled={statusUpdating}>{t('courses.cancel')}</button>
        <button type="button" className="danger-button" disabled={statusUpdating} onClick={onConfirm}>
          {statusUpdating ? t('auth.working') : t('courses.reject')}
        </button>
      </div>
    </Modal>
  );
}

export function CourseDeleteDialog({
  course,
  deletingCourse,
  onClose,
  onConfirm,
}: {
  course: Course;
  deletingCourse: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Modal labelledBy="delete-course-title" onClose={onClose}>
      <div className="modal-header-block">
        <span>{t('courses.deleteCourse')}</span>
        <h2 id="delete-course-title">{t('courses.deleteCourseTitle')}</h2>
        <p>{t('courses.deleteCourseDetail', { title: course.title })}</p>
      </div>
      <div className="modal-actions">
        <button type="button" className="secondary-button" onClick={onClose} disabled={deletingCourse}>{t('courses.cancel')}</button>
        <button type="button" className="danger-button" disabled={deletingCourse} onClick={onConfirm}>
          {deletingCourse ? t('courses.deleting') : t('courses.deleteCourse')}
        </button>
      </div>
    </Modal>
  );
}
