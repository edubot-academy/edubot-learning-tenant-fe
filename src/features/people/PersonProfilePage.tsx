import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { FiBookOpen, FiCheckSquare, FiClipboard, FiMail, FiPhone, FiUserCheck, FiUsers } from 'react-icons/fi';
import { EmptyState, LoadingState } from '../../components/DataState';
import { PageHeader } from '../../components/PageHeader';
import { StatGrid } from '../../components/StatGrid';
import { getTenantPersonProfile } from '../../services/api';
import type { TenantPersonProfile } from '../../types/domain';
import { formatDate } from '../../lib/format';
import { enumLabel, roleLabelKeys } from '../../lib/enumLabels';
import { useTenant } from '../tenant/TenantProvider';

function statNumber(value: unknown) {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : 0;
}

function progressValue(value: unknown) {
  return `${Math.round(statNumber(value))}%`;
}

function boundedProgress(value: unknown) {
  return Math.max(0, Math.min(100, Math.round(statNumber(value))));
}

function ProgressMeter({ value, label }: { value: unknown; label: string }) {
  const progress = boundedProgress(value);
  return (
    <div className="people-progress-meter" aria-label={label}>
      <span style={{ width: `${progress}%` }} />
    </div>
  );
}

export function PersonProfilePage() {
  const { t } = useTranslation();
  const { activeTenant } = useTenant();
  const { userId: userIdParam } = useParams();
  const activeTenantId = activeTenant?.id;
  const userId = Number(userIdParam);
  const [profile, setProfile] = useState<TenantPersonProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setProfile(null);
    if (!activeTenantId || !Number.isFinite(userId)) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getTenantPersonProfile(activeTenantId, userId)
      .then((value) => {
        if (!cancelled) setProfile(value);
      })
      .catch(() => toast.error(t('people.profileLoadFailed')))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTenantId, t, userId]);

  const stats = useMemo(() => {
    if (!profile) return [];
    const base = [
      { label: t('reports.avgProgress'), value: progressValue(profile.summary.avgProgress), hint: t('people.avgProgressHint') },
      { label: t('navigation.courses'), value: profile.summary.courses, hint: t('people.coursesHint') },
      { label: t('navigation.groups'), value: profile.summary.groups, hint: t('people.groupsHint') },
    ];
    if (profile.summary.students !== null && profile.summary.students !== undefined) {
      base.push({ label: t('members.students'), value: profile.summary.students, hint: t('people.assignedStudentsHint') });
    } else {
      base.push({ label: t('reports.atRiskStudents'), value: profile.summary.atRisk, hint: t('people.atRiskHint') });
    }
    return base;
  }, [profile, t]);

  if (!activeTenant) return <EmptyState title={t('overview.noTenantAssignedTitle')} detail={t('overview.noTenantAssignedDetail')} />;
  if (loading) return <LoadingState label={t('people.loadingProfile')} />;
  if (!profile) return <EmptyState title={t('people.profileUnavailable')} detail={t('reports.unavailableDetail')} />;

  const roleLabel = enumLabel(profile.person.role || 'student', roleLabelKeys, t);
  const attendanceRate = profile.attendance?.rate ?? null;
  const homeworkRate = profile.homework?.approvalRate ?? null;
  const profileName = profile.person.fullName || profile.person.email || t('people.profile');
  const joinedAt = profile.person.createdAt ? formatDate(profile.person.createdAt) : null;

  return (
    <>
      <PageHeader
        title={profileName}
        eyebrow={`${activeTenant.name} - ${roleLabel}`}
      />

      <section className="settings-panel people-profile-hero">
        <div className="people-profile-avatar" aria-hidden="true">
          {profile.person.avatar ? <img src={profile.person.avatar} alt="" /> : <span>{profileName.slice(0, 1).toUpperCase()}</span>}
        </div>
        <div className="people-profile-main">
          <div className="people-profile-title-row">
            <div>
              <h2>{profile.person.fullName || t('states.notSet')}</h2>
              <span>{profile.person.title || roleLabel}</span>
            </div>
            <span className="status-badge approved"><FiUserCheck aria-hidden="true" />{roleLabel}</span>
          </div>
          <div className="people-profile-meta">
            <span>{t('people.profileScope', { courses: profile.summary.courses, groups: profile.summary.groups })}</span>
            {joinedAt ? <span>{t('people.joinedAt', { date: joinedAt })}</span> : null}
          </div>
          <div className="people-contact-row">
            {profile.person.email ? <a href={`mailto:${profile.person.email}`}><FiMail /> {profile.person.email}</a> : null}
            {profile.person.phoneNumber ? <a href={`tel:${profile.person.phoneNumber}`}><FiPhone /> {profile.person.phoneNumber}</a> : null}
          </div>
        </div>
      </section>

      <div className="people-stat-grid">
        <StatGrid items={stats} />
      </div>

      <div className="settings-grid overview-lower-grid">
        {profile.attendance || profile.homework ? (
          <section className="settings-panel full">
            <div className="section-heading-row">
              <div>
                <h2>{t('people.learningSignals')}</h2>
                <span>{t('people.learningSignalsDetail')}</span>
              </div>
              <FiCheckSquare />
            </div>
            <div className="people-signal-grid">
              {profile.attendance ? (
                <article>
                  <strong>{t('navigation.attendance')}</strong>
                  <span>{attendanceRate === null ? t('states.notSet') : progressValue(attendanceRate)}</span>
                  <small>{t('people.attendanceLine', {
                    attended: profile.attendance.attended,
                    total: profile.attendance.total,
                    missed: profile.attendance.missed,
                  })}</small>
                </article>
              ) : null}
              {profile.homework ? (
                <article>
                  <strong>{t('navigation.homework')}</strong>
                  <span>{homeworkRate === null ? t('states.notSet') : progressValue(homeworkRate)}</span>
                  <small>{t('people.homeworkLine', {
                    approved: profile.homework.approved,
                    total: profile.homework.total,
                    missing: profile.homework.missing,
                  })}</small>
                </article>
              ) : null}
            </div>
          </section>
        ) : null}

        <section className="settings-panel">
          <div className="section-heading-row">
            <div>
              <h2>{t('navigation.courses')}</h2>
              <span>{t('people.coursesDetail')}</span>
            </div>
            <FiBookOpen />
          </div>
          <div className="stack-list">
            {profile.courses.map((course) => (
              <article className="stack-list-item people-progress-row" key={course.courseId}>
                <div>
                  <strong>{course.courseTitle || t('states.notSet')}</strong>
                  <span>{t('people.courseLine', { groups: course.groupCount, students: course.studentCount })}</span>
                  <ProgressMeter value={course.avgProgress} label={t('people.progressFor', { name: course.courseTitle || t('states.notSet') })} />
                </div>
                <strong>{progressValue(course.avgProgress)}</strong>
              </article>
            ))}
            {!profile.courses.length ? <EmptyState title={t('people.noCourses')} detail={t('people.noCoursesDetail')} /> : null}
          </div>
        </section>

        <section className="settings-panel">
          <div className="section-heading-row">
            <div>
              <h2>{t('navigation.groups')}</h2>
              <span>{t('people.groupsDetail')}</span>
            </div>
            <FiUsers />
          </div>
          <div className="stack-list">
            {profile.groups.slice(0, 12).map((group) => (
              <article className="stack-list-item people-progress-row" key={`${group.groupId}-${group.courseId}`}>
                <div>
                  <strong>{group.groupName || t('states.notSet')}</strong>
                  <span>{group.courseTitle || t('states.notSet')}{group.enrolledAt ? ` - ${formatDate(group.enrolledAt)}` : ''}</span>
                  <ProgressMeter value={group.progressPercent ?? group.avgProgress ?? 0} label={t('people.progressFor', { name: group.groupName || t('states.notSet') })} />
                </div>
                <strong>{progressValue(group.progressPercent ?? group.avgProgress ?? 0)}</strong>
              </article>
            ))}
          </div>
        </section>

        {profile.students.length ? (
          <section className="settings-panel full people-students-panel">
            <div className="section-heading-row">
              <div>
                <h2>{t('people.assignedStudents')}</h2>
                <span>{t('people.assignedStudentsDetail')}</span>
              </div>
              <FiClipboard />
            </div>
            <div className="stack-list">
              {profile.students.slice(0, 20).map((student) => {
                const studentContent = (
                  <div>
                    <strong>{student.fullName || student.email || t('states.notSet')}</strong>
                    <span>{student.groupName || t('states.notSet')} - {student.courseTitle || t('states.notSet')}</span>
                    <ProgressMeter value={student.progressPercent} label={t('people.progressFor', { name: student.fullName || student.email || t('states.notSet') })} />
                  </div>
                );
                return student.studentId ? (
                  <Link className="stack-list-item people-progress-row" key={student.enrollmentId} to={`/people/${student.studentId}`}>
                    {studentContent}
                    <strong>{student.completed ? t('reports.completed') : progressValue(student.progressPercent)}</strong>
                  </Link>
                ) : (
                  <article className="stack-list-item people-progress-row" key={student.enrollmentId}>
                    {studentContent}
                    <strong>{student.completed ? t('reports.completed') : progressValue(student.progressPercent)}</strong>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}
