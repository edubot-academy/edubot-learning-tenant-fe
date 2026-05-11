import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiBookOpen, FiCalendar, FiCheckSquare, FiFileText, FiUsers } from 'react-icons/fi';
import { PageHeader } from '../../components/PageHeader';
import { StatGrid } from '../../components/StatGrid';
import { EmptyState, LoadingState } from '../../components/DataState';
import { listCourseGroups, listGroupSessions, listGroupStudents, listHomework, listTenantCourses } from '../../services/api';
import type { Course, CourseGroup, CourseSession, GroupStudent, SessionHomework } from '../../types/domain';
import { useTenant } from '../tenant/TenantProvider';
import { formatDate } from '../../lib/format';

export function CoursesPage() {
  const { activeTenant } = useTenant();
  const activeTenantId = activeTenant?.id;
  const [courses, setCourses] = useState<Course[]>([]);
  const [groups, setGroups] = useState<CourseGroup[]>([]);
  const [sessions, setSessions] = useState<CourseSession[]>([]);
  const [students, setStudents] = useState<GroupStudent[]>([]);
  const [homework, setHomework] = useState<SessionHomework[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | undefined>();
  const [selectedGroupId, setSelectedGroupId] = useState<number | undefined>();
  const [query, setQuery] = useState('');
  const [studentQuery, setStudentQuery] = useState('');
  const [progressFilter, setProgressFilter] = useState<'all' | 'not_started' | 'in_progress' | 'completed'>('all');
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const filteredCourses = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return courses;
    return courses.filter((course) => (
      course.title.toLowerCase().includes(normalized)
      || (course.courseType ?? '').toLowerCase().includes(normalized)
      || (course.status ?? '').toLowerCase().includes(normalized)
    ));
  }, [courses, query]);

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === selectedCourseId),
    [courses, selectedCourseId],
  );

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId),
    [groups, selectedGroupId],
  );

  useEffect(() => {
    setCourses([]);
    setGroups([]);
    setSessions([]);
    setStudents([]);
    setHomework([]);
    setSelectedCourseId(undefined);
    setSelectedGroupId(undefined);
    if (!activeTenantId) return;
    let cancelled = false;
    setLoading(true);
    listTenantCourses(activeTenantId)
      .then((items) => {
        if (cancelled) return;
        setCourses(items);
        setSelectedCourseId(items[0]?.id);
      })
      .catch(() => {
        if (!cancelled) toast.error('Could not load courses');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTenantId]);

  useEffect(() => {
    setGroups([]);
    setSessions([]);
    setStudents([]);
    setHomework([]);
    setSelectedGroupId(undefined);
    if (!selectedCourseId) return;

    let cancelled = false;
    setDetailLoading(true);
    Promise.all([listCourseGroups(selectedCourseId), listHomework(selectedCourseId)])
      .then(([nextGroups, nextHomework]) => {
        if (cancelled) return;
        setGroups(nextGroups);
        setHomework(nextHomework);
        setSelectedGroupId(nextGroups[0]?.id);
      })
      .catch(() => {
        if (!cancelled) toast.error('Could not load course detail');
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCourseId]);

  useEffect(() => {
    setSessions([]);
    setStudents([]);
    if (!selectedGroupId) return;

    let cancelled = false;
    setDetailLoading(true);
    Promise.all([listGroupSessions(selectedGroupId), listGroupStudents(selectedGroupId, { limit: 200 })])
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
  }, [selectedGroupId]);

  useEffect(() => {
    if (!selectedGroupId) return;
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      const params = {
        q: studentQuery.trim() || undefined,
        progressGte: progressFilter === 'completed' ? 100 : progressFilter === 'in_progress' ? 1 : undefined,
        progressLte: progressFilter === 'not_started' ? 0 : progressFilter === 'in_progress' ? 99 : undefined,
        limit: 200,
      };
      listGroupStudents(selectedGroupId, params)
        .then((nextStudents) => {
          if (!cancelled) setStudents(nextStudents);
        })
        .catch(() => {
          if (!cancelled) toast.error('Could not filter students');
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [progressFilter, selectedGroupId, studentQuery]);

  const stats = useMemo(() => [
    { label: 'Groups', value: groups.length, hint: selectedCourse?.title ?? 'Selected course' },
    { label: 'Sessions', value: sessions.length, hint: selectedGroup?.name ?? 'Selected group' },
    { label: 'Students', value: students.length, hint: 'Current group roster' },
    { label: 'Homework', value: homework.length, hint: 'Course assignments' },
  ], [groups.length, homework.length, selectedCourse?.title, selectedGroup?.name, sessions.length, students.length]);

  const groupProgressAverage = useMemo(() => {
    if (!students.length) return 0;
    const total = students.reduce((sum, student) => sum + (student.progressPercent ?? 0), 0);
    return Math.round(total / students.length);
  }, [students]);

  const completedStudents = useMemo(
    () => students.filter((student) => student.completed || (student.progressPercent ?? 0) >= 100).length,
    [students],
  );

  if (loading) return <LoadingState label="Loading courses" />;

  return (
    <>
      <PageHeader title="Courses" eyebrow={activeTenant?.name} />
      <div className="filters-row">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search tenant courses"
        />
        <select value={selectedCourseId ?? ''} onChange={(event) => setSelectedCourseId(Number(event.target.value) || undefined)}>
          <option value="">Select course</option>
          {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
        </select>
      </div>
      {!courses.length ? (
        <EmptyState
          title="No tenant courses yet"
          detail="Courses are created and assigned in platform management. This tenant workspace focuses on delivery once courses are assigned."
          action={<Link className="secondary-link-button" to="/settings">Review tenant settings</Link>}
        />
      ) : (
        <>
          <StatGrid items={stats} />
          <div className="workspace-grid">
            <section className="content-section">
              <h2>Tenant catalog</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Course</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Published</th>
                      <th>Students</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCourses.map((course) => (
                      <tr
                        key={course.id}
                        className={`interactive-row ${course.id === selectedCourseId ? 'selected-row' : ''}`}
                        role="button"
                        tabIndex={0}
                        aria-pressed={course.id === selectedCourseId}
                        onClick={() => setSelectedCourseId(course.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setSelectedCourseId(course.id);
                          }
                        }}
                      >
                    <td>
                      <strong>{course.title}</strong>
                      {course.instructor?.fullName ? <small>{course.instructor.fullName}</small> : null}
                    </td>
                    <td><span className="status-badge">{(course.courseType || 'video').replace('_', ' ')}</span></td>
                    <td><span className={`status-badge ${course.status || 'draft'}`}>{course.status || 'draft'}</span></td>
                    <td><span className={`status-badge ${course.isPublished ? 'published' : 'draft'}`}>{course.isPublished ? 'Published' : 'Draft'}</span></td>
                    <td>{course.enrolledStudents ?? 0}</td>
                  </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!filteredCourses.length ? (
                <EmptyState
                  title="No matching courses"
                  detail="Clear the search or choose a course from the selector above."
                  action={<button type="button" className="secondary-button" onClick={() => setQuery('')}>Clear search</button>}
                />
              ) : null}
            </section>

            <aside className="settings-panel">
              <div className="section-heading-row compact">
                <div>
                  <h2>Course operations</h2>
                  <span>{selectedCourse?.title ?? 'Select a course'}</span>
                </div>
              </div>
              {!selectedCourse ? (
                <EmptyState title="Select a course" detail="Choose a course from the catalog to see groups, sessions, learners, and next actions." />
              ) : detailLoading ? (
                <LoadingState label="Loading course detail" />
              ) : (
                <>
                  <div className="course-action-grid">
                    <Link className="course-action-card" to="/sessions">
                      <FiCalendar />
                      <span>Sessions</span>
                    </Link>
                    <Link className="course-action-card" to="/attendance">
                      <FiCheckSquare />
                      <span>Attendance</span>
                    </Link>
                    <Link className="course-action-card" to="/homework">
                      <FiFileText />
                      <span>Homework</span>
                    </Link>
                    <Link className="course-action-card" to="/certificates">
                      <FiBookOpen />
                      <span>Certificates</span>
                    </Link>
                  </div>
                  <div className="definition-grid">
                    <span>Course</span><strong>{selectedCourse.title}</strong>
                    <span>Type</span><strong>{(selectedCourse.courseType || 'video').replace('_', ' ')}</strong>
                    <span>Status</span><strong><span className={`status-badge ${selectedCourse.status || 'draft'}`}>{selectedCourse.status || 'draft'}</span></strong>
                    <span>Published</span><strong><span className={`status-badge ${selectedCourse.isPublished ? 'published' : 'draft'}`}>{selectedCourse.isPublished ? 'Published' : 'Draft'}</span></strong>
                  </div>

                  <label>
                    Group
                    <select value={selectedGroupId ?? ''} onChange={(event) => setSelectedGroupId(Number(event.target.value) || undefined)} disabled={!groups.length}>
                      <option value="">Select group</option>
                      {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                    </select>
                  </label>

                  {selectedGroup ? (
                    <div className="course-group-summary">
                      <div className="definition-grid">
                        <span>Code</span><strong>{selectedGroup.code ?? '-'}</strong>
                        <span>Group status</span><strong><span className={`status-badge ${selectedGroup.status ?? 'planned'}`}>{selectedGroup.status ?? 'planned'}</span></strong>
                        <span>Dates</span><strong>{selectedGroup.startDate || selectedGroup.endDate ? `${selectedGroup.startDate ?? '-'} - ${selectedGroup.endDate ?? '-'}` : '-'}</strong>
                      </div>
                      <div className="course-group-metrics">
                        <span><FiUsers /><strong>{students.length}</strong> students</span>
                        <span><FiCalendar /><strong>{sessions.length}</strong> sessions</span>
                        <span><FiCheckSquare /><strong>{completedStudents}</strong> completed</span>
                      </div>
                      <div className="progress-cell course-progress-cell">
                        <span style={{ width: `${groupProgressAverage}%` }} />
                        <strong>{groupProgressAverage}% average progress</strong>
                      </div>
                    </div>
                  ) : null}

                  <div className="stack-list">
                    {sessions.slice(0, 5).map((session) => (
                      <article className="stack-list-item" key={session.id}>
                        <div>
                          <strong>{session.title}</strong>
                          <span>{formatDate(session.startsAt)}</span>
                        </div>
                        <strong><span className={`status-badge ${session.status || 'scheduled'}`}>{session.status || 'scheduled'}</span></strong>
                      </article>
                    ))}
                    {!sessions.length ? <span className="muted-text">No sessions for the selected group.</span> : null}
                  </div>
                </>
              )}
            </aside>
          </div>

          {selectedGroup ? (
            <section className="content-section course-roster-section">
              <div className="section-heading-row">
                <div>
                  <h2>Group roster</h2>
                  <span>{selectedGroup.name}</span>
                </div>
              </div>
              <div className="filters-row three roster-filters">
                <input
                  value={studentQuery}
                  onChange={(event) => setStudentQuery(event.target.value)}
                  placeholder="Search student"
                />
                <select value={progressFilter} onChange={(event) => setProgressFilter(event.target.value as 'all' | 'not_started' | 'in_progress' | 'completed')}>
                  <option value="all">All progress</option>
                  <option value="not_started">Not started</option>
                  <option value="in_progress">In progress</option>
                  <option value="completed">Completed</option>
                </select>
                <button type="button" className="secondary-button" onClick={() => {
                  setStudentQuery('');
                  setProgressFilter('all');
                }}>
                  Clear filters
                </button>
              </div>
              {!students.length ? (
                <EmptyState title="No students found" />
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Email</th>
                        <th>Progress</th>
                        <th>Completed</th>
                        <th>Enrolled</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student) => (
                        <tr key={student.userId}>
                          <td>
                            <strong>{student.fullName || `Student #${student.userId}`}</strong>
                            {student.phoneNumber ? <small>{student.phoneNumber}</small> : null}
                          </td>
                          <td>{student.email ?? '-'}</td>
                          <td>
                            <div className="progress-cell">
                              <span style={{ width: `${Math.min(100, Math.max(0, student.progressPercent ?? 0))}%` }} />
                              <strong>{student.progressPercent ?? 0}%</strong>
                            </div>
                          </td>
                          <td><span className={`status-badge ${student.completed ? 'published' : 'draft'}`}>{student.completed ? 'Completed' : 'In progress'}</span></td>
                          <td>{formatDate(student.enrolledAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ) : null}
        </>
      )}
    </>
  );
}
