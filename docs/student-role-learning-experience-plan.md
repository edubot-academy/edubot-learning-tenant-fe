# Student Role Learning Experience Plan

Last updated: 2026-05-15.

This document converts the student-role UX/UI and frontend review into detailed product, frontend, backend, API, QA, and rollout tasks. The goal is to make the student workspace feel like a focused learner portal, not a compressed staff dashboard.

## Implementation Status

Legend:

- `[x]` Completed in tenant frontend.
- `[~]` Partially completed or temporary frontend fallback.
- `[ ]` Not started / requires backend or product decision.

Current frontend state:

- `[x]` Student accounts are routed away from the staff overview and into `/student/today`.
- `[x]` Student navigation is focused on Today, To do, Courses, Materials, Progress, and Help.
- `[x]` Student dashboard loads courses, upcoming sessions, tasks, homework, materials, recordings, attendance, and certificates.
- `[x]` Student dashboard supports homework/activity submission, file upload, and quiz attempts.
- `[x]` Student dashboard respects tenant feature flags for homework, attendance, and certificates.
- `[x]` Student settings resolve to personal theme and language preferences, with tenant/admin controls hidden for students.
- `[~]` Student learning data is split into learner routes, but the implementation still lives mostly in `StudentDashboardPage.tsx`.
- `[~]` Dedicated student course detail page is wired to `GET /student/courses/:courseId`; reusable component extraction remains.
- `[x]` Dedicated student session detail page is wired to `GET /student/sessions/:sessionId` and shows student attendance when returned.
- `[x]` Dedicated task/to-do page exists with status filters, feedback/score summaries, and submission history preview.
- `[x]` Dedicated task/to-do page honors frontend submission method requirements when returned by the API and keeps file uploads separate from link submissions.
- `[x]` Dedicated materials and recordings library exists with type/course filters, backend query params, and load-more pagination UI.
- `[x]` Dedicated progress/grades/certificates page exists with completion milestones and grade history.
- `[x]` Student-facing help/support/contact workflow can create and list student support requests.
- `[x]` Notification/reminder feed, preferences, unread indicator, and compact dropdown are wired.
- `[x]` Backend aggregated student home endpoint is implemented and wired.
- `[x]` Backend student course/session/task/progress/support endpoints are implemented and wired.
- `[ ]` Visual QA with real student fixture data.

## Product Goal

Students should enter the workspace and immediately understand:

- What class or task needs attention today.
- What is overdue or waiting for revision.
- Where to join the next live session.
- Where to find materials and recordings.
- How they are progressing in each course.
- What feedback, score, or certificate status changed recently.
- How to ask for help when blocked.

The student workspace should avoid tenant administration, operational dashboards, workspace setup, staff terminology, broad metrics, and feature/configuration surfaces.

## Current Gaps

- Student navigation is too small and does not match real learner workflows.
- `Settings` is too prominent for students because it mainly contains personal theme/language preferences.
- The student dashboard is overloaded with many unrelated sections.
- Homework appears twice conceptually: once as tasks and again as a homework panel.
- The dashboard repeats high-level stats and lists without clear hierarchy.
- There is no course detail route for syllabus, modules, progress, instructor, sessions, and materials.
- There is no session detail route that combines live link, materials, recording, attendance, activities, and homework.
- There is no full task/to-do route with filters for open, overdue, submitted, revision required, graded, and completed.
- There is no gradebook or feedback center, even though task attempts and scores are already partly represented.
- There is no student-facing support workflow. Existing `/support` is an assistant/staff support workspace.
- There is no notification center, reminder preference, or due-date calendar.
- Student dashboard makes up to eight separate API calls on load, which increases latency and partial-failure complexity.
- The frontend uses flexible local student types rather than shared domain response types, which makes contract drift easier.

## Target Student Navigation

Recommended default navigation:

- **Today**: next live session, urgent tasks, overdue/revision items, recent feedback.
- **To do**: homework, quizzes, activities, filters by status and due date.
- **Courses**: active courses and course detail pages.
- **Materials**: resources and recordings grouped by course/session.
- **Progress**: progress, scores, attendance, certificates.
- **Help**: contact instructor/support, request help, view support responses.

Move these out of primary navigation:

- **Settings**: place in account/avatar menu or mobile more menu.
- **Certificates**: keep inside Progress unless certificates are a major product pillar.
- **Attendance**: keep inside Progress unless attendance is the primary student outcome.

## Information Architecture Tasks

### 1. Replace Student Primary Navigation

Status: `[x]`

Frontend tasks:

- Update `studentNavItems` in `src/components/appNavigation.ts`.
- Replace `Settings` as primary student nav with student workflows.
- Add routes for `/student/today`, `/student/todo`, `/student/courses`, `/student/materials`, `/student/progress`, and `/student/help`.
- Keep `/student` as a redirect to `/student/today`.
- Keep `/settings` accessible through user/account controls.
- Update mobile navigation so students do not lose core actions behind the more menu.

Backend tasks:

- None required for basic routing if existing student list endpoints remain.
- Add backend endpoints listed below before building rich detail pages.

Acceptance criteria:

- Student sees learner-first navigation, not admin/settings-first navigation.
- Staff/admin routes remain inaccessible to students by direct URL.
- Existing `/student` links continue to work.

### 2. Split The Current Dashboard Into Student Views

Status: `[~]`

Frontend tasks:

- Extract data-loading and presentation from `StudentDashboardPage.tsx`.
- Create reusable student components:
  - `StudentTodayPage`
  - `StudentTodoPage`
  - `StudentCoursesPage`
  - `StudentMaterialsPage`
  - `StudentProgressPage`
  - `StudentHelpPage`
  - `StudentTaskModal`
  - `StudentCourseCard`
  - `StudentSessionCard`
  - `StudentMaterialList`
- Move submission and quiz logic into a reusable task submission component.
- Remove duplicate homework list from the Today view once To do exists.
- Keep the Today view focused on the next session, urgent tasks, and recent feedback.

Backend tasks:

- Add a student home summary endpoint to reduce dashboard fan-out.

Acceptance criteria:

- Today page loads quickly and shows only high-priority actions.
- To do page owns all homework/activity/quiz work.
- Courses, materials, and progress have dedicated places.
- No task appears twice in the same student view unless there is a clear reason.

## Frontend Tasks

### 1. Student Today Page

Status: `[~]`

Purpose:

Give students a short, decisive home screen.

Required sections:

- Next live session with join button when available.
- Next due task with due date and submit/open action.
- Overdue/revision-required count.
- Recent feedback or score changes.
- Active course progress summary.

Suggested data:

- `GET /student/home`
- Fallback temporarily to existing:
  - `GET /student/sessions/upcoming`
  - `GET /student/tasks`
  - `GET /student/homework`
  - `GET /student/courses`

Acceptance criteria:

- Student can decide what to do next within five seconds.
- Empty state says what happens next, not just "no data".
- Live join action is visually primary only when the session is joinable.

### 2. Student To Do Page

Status: `[~]`

Purpose:

Unify homework, quizzes, activities, revisions, and pending submissions.

Required sections:

- Filters: Open, Overdue, Submitted, Needs revision, Completed.
- Sort: due soon, course, status.
- Task cards with course, session, due date, status, score/feedback if available.
- Submit/update modal for homework and non-quiz activities.
- Quiz attempt flow.
- Attachment upload.
- Submission history preview.

Frontend tasks:

- Replace separate homework panel with unified task list.
- Normalize task status mapping in one helper.
- Show `reviewState`, `mySubmission.status`, `mySubmission.score`, `mySubmission.reviewComment`, and `myAttempt.score` where available.
- Add loading, error, empty, and partial-load states.

Backend tasks:

- Extend `GET /student/tasks` to include all student-actionable work:
  - homework
  - activities
  - quizzes
  - revisions
  - missing submissions
  - graded/completed records when requested
- Add filters:
  - `status`
  - `courseId`
  - `groupId`
  - `from`
  - `to`
  - `page`
  - `limit`
- Return stable fields for each task type.

Suggested response shape:

```ts
type StudentTaskItem = {
  id: number;
  kind: 'homework' | 'activity' | 'quiz';
  sessionId: number;
  courseId?: number;
  groupId?: number;
  title: string;
  description?: string | null;
  courseTitle?: string | null;
  sessionTitle?: string | null;
  dueAt?: string | null;
  status: 'open' | 'overdue' | 'submitted' | 'needs_revision' | 'approved' | 'completed' | 'graded';
  submission?: {
    id: number;
    answerText?: string | null;
    attachmentUrl?: string | null;
    submittedAt?: string | null;
    score?: number | null;
    reviewComment?: string | null;
    status?: string | null;
  } | null;
  attempt?: {
    id: number;
    score?: number | null;
    passed?: boolean | null;
    createdAt?: string | null;
  } | null;
};
```

Acceptance criteria:

- Student never has to check both Tasks and Homework for the same work.
- Overdue and needs-revision tasks are visually prioritized.
- Submitted work is visible but not mixed with urgent open work by default.

### 3. Student Courses Page

Status: `[~]`

Purpose:

Show all enrolled courses and provide a path into course detail.

Required sections:

- Active courses.
- Completed courses.
- Course progress.
- Group/cohort assignment.
- Instructor name if available.
- Next session per course.
- Course detail link.

Backend tasks:

- Extend `GET /student/courses` to include:
  - `courseId`
  - `groupId`
  - `title`
  - `description`
  - `thumbnailUrl`
  - `instructor`
  - `groupName`
  - `progressPercent`
  - `status`
  - `nextSession`
  - `completedAt`

Acceptance criteria:

- Student can see what they are enrolled in.
- Course cards do not expose admin course status language unless it matters to the student.
- Completed courses are separate from active courses.

### 4. Student Course Detail Page

Status: `[~]`

Purpose:

Make each course inspectable.

Route:

- `/student/courses/:courseId`

Required sections:

- Course overview and instructor.
- Progress and completion requirements.
- Sessions/modules list.
- Materials and recordings for the course.
- Open and recent tasks for the course.
- Certificate eligibility if enabled.

Backend tasks:

- Add `GET /student/courses/:courseId`.
- Enforce enrollment-scoped access.
- Return sessions/modules, materials summary, task summary, progress, and certificate status.

Acceptance criteria:

- Student cannot access another student's or unenrolled course by direct URL.
- Detail page can be rendered from one endpoint.
- Course progress explains what is complete and what remains.

### 5. Student Session Detail Page

Status: `[~]`

Purpose:

Give each lesson/session one canonical place.

Route:

- `/student/sessions/:sessionId`

Required sections:

- Title, course, group, date/time.
- Join link when available.
- Recording link after session.
- Materials.
- Activities.
- Homework.
- Attendance status for that session.
- Instructor notes if student-visible.

Backend tasks:

- Add `GET /student/sessions/:sessionId`.
- Enforce student enrollment and group membership.
- Include student-specific submission/attempt status.

Acceptance criteria:

- Session cards link to session detail.
- Student can find everything for one class in one place.
- Session detail never leaks staff-only notes or roster data.

### 6. Student Materials Page

Status: `[~]`

Purpose:

Make resources and recordings searchable and reusable.

Required sections:

- Course filter.
- Type filter: document, link, video, recording.
- Recent materials.
- Recordings.
- Empty state per course.

Backend tasks:

- Extend `GET /student/resources` and `GET /student/recordings` with pagination and filters.
- Return material metadata:
  - title
  - type
  - url
  - fileName
  - size
  - sessionId
  - courseId
  - createdAt

Acceptance criteria:

- Student can find an older recording without scrolling the dashboard.
- Materials are grouped by course/session.
- Broken or missing material URLs are handled gracefully.

### 7. Student Progress Page

Status: `[~]`

Purpose:

Move attendance, grades, completion, and certificates into a single progress area.

Required sections:

- Course progress.
- Attendance summary and recent attendance.
- Scores/grades from homework and activities.
- Certificate status and downloads.
- Completion milestones.

Backend tasks:

- Add `GET /student/progress`.
- Add optional course filter.
- Include:
  - progress by course
  - attendance rate by course/group
  - graded tasks
  - certificate eligibility and issued certificates
  - recent feedback

Acceptance criteria:

- Student can understand performance without interpreting admin metrics.
- Certificates are visible only when enabled and relevant.
- Attendance is framed as personal progress, not operational tracking.

### 8. Student Help Page

Status: `[x]`

Purpose:

Give students a simple way to ask for help without exposing internal staff support tools.

Required sections:

- Contact instructor for a course/session.
- Contact tenant support/admin.
- Request help form with category and message.
- Previous help requests, if supported.
- Emergency/offline contact instructions from tenant settings if available.

Backend tasks:

- Add student-facing support endpoints:
  - `GET /student/support/options`
  - `GET /student/support/requests`
  - `POST /student/support/requests`
- Connect student requests to existing assistant support queue or a new support-request table.
- Add audit fields:
  - requester student ID
  - assigned owner role/user
  - category
  - priority
  - status
  - message
  - createdAt
  - resolvedAt
- Add tenant policy fields for whether students can contact instructors/admins directly.

Acceptance criteria:

- Student can ask for help from inside the portal.
- Staff can see the request in support workflows.
- Students cannot see internal notes unless explicitly marked student-visible.

### 9. Student Settings Cleanup

Status: `[~]`

Purpose:

Make settings appropriately small for students.

Frontend tasks:

- Keep student settings to personal preferences:
  - language
  - theme
  - notification preferences once available
  - account/profile fields if backend supports them
- Move settings from primary student nav to account menu.
- Hide tenant-oriented labels and workspace language where possible.

Backend tasks:

- Add notification preference fields if notifications are implemented.
- Add safe profile update endpoint if students can edit name/contact details.

Acceptance criteria:

- Student settings do not mention tenant controls, workspace settings, feature flags, billing, CRM, access boundaries, or admin concepts.
- Student can still change language and theme.

## Backend API Tasks

### 1. Add Aggregated Student Home Endpoint

Status: `[x]`

Endpoint:

- `GET /student/home`

Purpose:

Replace multiple first-load calls with one student-specific summary.

Suggested response:

```ts
type StudentHome = {
  generatedAt: string;
  student: {
    id: number;
    fullName?: string | null;
    email?: string | null;
  };
  nextSession?: StudentSessionSummary | null;
  urgentTasks: StudentTaskItem[];
  recentFeedback: StudentFeedbackItem[];
  activeCourses: StudentCourseSummary[];
  progress: {
    averageProgressPercent: number;
    openTasks: number;
    overdueTasks: number;
    attendanceRate?: number | null;
    certificatesIssued?: number;
  };
};
```

Acceptance criteria:

- Endpoint returns only data for the authenticated student.
- Endpoint supports tenant scoping through the existing tenant header.
- Endpoint remains useful when homework, attendance, or certificates are disabled.

### 2. Harden Student Scope Authorization

Status: `[x]`

Backend tasks:

- Centralize student access checks:
  - current user is a student in the active tenant
  - course enrollment belongs to current student
  - group membership belongs to current student
  - session belongs to student's group/course
  - homework/activity belongs to accessible session
  - certificate belongs to current student
- Apply checks to all `/student/*` endpoints and submission endpoints.

Acceptance criteria:

- Student cannot access another student's task, certificate, session, or course by direct ID.
- Unauthorized access returns `403` or `404` consistently based on backend policy.
- Tests cover cross-tenant and cross-student access attempts.

### 3. Standardize Student Response Types

Status: `[~]`

Backend tasks:

- Define stable DTOs for:
  - `StudentCourseSummary`
  - `StudentCourseDetail`
  - `StudentSessionSummary`
  - `StudentSessionDetail`
  - `StudentTaskItem`
  - `StudentSubmission`
  - `StudentMaterialItem`
  - `StudentProgressSummary`
  - `StudentSupportRequest`
- Avoid inconsistent aliases like `title` vs `courseTitle` unless intentionally documented.

Frontend tasks:

- `[x]` Move student DTOs into `src/types/domain.ts`.
- `[x]` Replace local ad hoc student types in `StudentDashboardPage.tsx`.
- `[~]` Remove fallback aliases after backend DTOs are finalized and contract tests are available.

Acceptance criteria:

- Frontend does not need multiple fallback field names for the same concept.
- API contract tests cover student DTOs.

### 4. Add Pagination And Filtering

Status: `[x]`

Endpoints to update:

- `GET /student/tasks`
- `GET /student/resources`
- `GET /student/recordings`
- `GET /student/attendance`
- `GET /student/certificates`

Required query params:

- `page`
- `limit`
- `courseId`
- `groupId`
- `from`
- `to`
- `status`
- `type`

Acceptance criteria:

- Large student histories do not overload the UI.
- Frontend can implement filters without fetching everything.
- Default limits are documented.

### 5. Add Notifications And Reminders

Status: `[~]`

Backend tasks:

- Add notification events for:
  - upcoming live session
  - homework due soon
  - overdue task
  - submission reviewed
  - revision requested
  - certificate issued
  - support request updated
- `[x]` Add `GET /student/notifications`.
- `[x]` Add `GET /student/notifications/unread-count`.
- `[x]` Add `POST /student/notifications/:id/read`.
- `[x]` Add `POST /student/notifications/read-all`.
- `[x]` Add `GET /student/reminders`.
- `[x]` Add `GET /student/notification-settings`.
- `[x]` Add `PATCH /student/notification-settings`.
- Decide delivery channels:
  - in-app
  - email
  - Telegram
  - WhatsApp

Frontend tasks:

- `[x]` Add notification indicator in app shell.
- `[x]` Add notification and reminder sections to the student Today view.
- `[x]` Add compact notification dropdown.
- `[x]` Add notification preferences in student settings.

Acceptance criteria:

- Student can see recent important changes without scanning every page.
- Notification preferences respect tenant communication policy.

## Security And Privacy Tasks

### 1. Prevent Staff Data Leakage

Status: `[~]`

Backend tasks:

- Ensure student detail endpoints never return:
  - full roster
  - other student submissions
  - staff-only notes
  - internal support notes
  - tenant member management fields
  - billing/platform fields

Frontend tasks:

- Avoid rendering admin/status labels directly from shared staff DTOs.

Acceptance criteria:

- Student payloads are minimal and student-specific.
- Security tests cover direct URL and direct API access.

### 2. Student Support Visibility Rules

Status: `[~]`

Backend tasks:

- Distinguish internal support notes from student-visible replies.
- Add support request status visible to student.
- Add permission/policy for direct instructor contact.

Acceptance criteria:

- Student can see their own help request status.
- Student cannot see internal triage notes.

## UX/UI Tasks

### 1. Reduce Cognitive Load On Student Home

Status: `[~]`

Design tasks:

- Remove repeated stats from the top of student home.
- Use one primary action area.
- Show only 2-4 secondary cards.
- Put historical/reference content on dedicated pages.

Acceptance criteria:

- First viewport answers "What should I do now?"
- No first-viewport section is decorative only.
- Mobile view keeps join/submit actions reachable.

### 2. Use Student-Friendly Language

Status: `[~]`

Content tasks:

- Replace staff/admin vocabulary:
  - "tenant" -> school/academy/workspace only where needed
  - "attendance" -> attendance record or class attendance
  - "review state" -> feedback/status
  - "activity" -> task/quiz/exercise based on type
- Add student-specific empty states.
- Review English, Russian, and Kyrgyz translation keys.

Acceptance criteria:

- Student screens do not expose internal implementation terms.
- Empty states explain what students can expect next.

### 3. Improve Submission Experience

Status: `[~]`

Frontend tasks:

- Show task instructions, due date, course/session context, and status in the submit modal.
- Show existing submission before editing.
- Show uploaded file name and remove/replace action.
- `[x]` Support link-only, text-only, file-only, and mixed submissions based on backend task config when those fields are returned.
- Confirm successful submission with updated status.

Backend tasks:

- Include submission requirements per task:
  - allowText
  - allowFile
  - allowLink
  - maxFileSize
  - allowedFileTypes

Acceptance criteria:

- Student understands what can be submitted.
- Student sees whether submission succeeded and what was sent.

## Testing Tasks

### 1. Permission And Navigation Tests

Status: `[~]`

Frontend tests:

- Student nav exposes student routes only.
- Student direct access to staff routes shows access denied.
- Settings remains reachable outside primary nav.
- Feature flags hide/show attendance, homework, and certificates correctly.

Backend tests:

- Cross-student access is blocked.
- Cross-tenant access is blocked.
- Student support requests are scoped to the current student.

### 2. Student Workflow Tests

Status: `[x]`

Frontend tests:

- Today page renders next session and urgent tasks.
- To do filters show correct status groups.
- Homework submission posts correct payload.
- Activity submission posts correct payload.
- Quiz submission requires all questions when configured.
- Materials page handles resources and recordings.
- Progress page handles disabled attendance/certificates.

### 3. Visual QA

Status: `[ ]`

QA tasks:

- Test desktop and mobile layouts.
- Use fixture students with:
  - no enrollments
  - one active course
  - multiple courses
  - overdue homework
  - revision-requested homework
  - graded quiz
  - issued certificate
  - disabled homework feature
  - disabled attendance feature
- Verify no text overlap in English, Russian, and Kyrgyz.

## Rollout Plan

### Phase 1: Cleanup Without Backend Changes

Status: `[~]`

Tasks:

- Move Settings out of primary student navigation.
- Rename `/student` conceptually to Today while preserving route compatibility.
- Remove duplicate homework section from the main dashboard or demote it below To do.
- Extract task modal and task list components.
- Add tests for student navigation and feature flags.

### Phase 2: Backend Student Home And To Do

Status: `[~]`

Tasks:

- Add `GET /student/home`.
- Standardize `GET /student/tasks`.
- Build Today and To do pages.
- Add frontend DTOs and contract tests.

### Phase 3: Course, Session, Materials, Progress

Status: `[x]`

Tasks:

- Add course detail endpoint and page.
- Add session detail endpoint and page.
- Add materials filters and pagination.
- Add progress endpoint and page.

### Phase 4: Help, Notifications, And Polish

Status: `[~]`

Tasks:

- Add student support request workflow.
- Add notification center and preferences.
- Complete localization review.
- Run visual QA with fixture accounts.

## Open Product Decisions

- Should students contact instructors directly, or should all requests go through support/admin?
- Should students see attendance as a primary metric, or only inside progress?
- Should certificates be a top-level page for certificate-heavy tenants?
- Should course detail follow a module/lesson model or a session/cohort model?
- Should students be able to edit profile/contact details?
- Which notification channels are allowed per tenant?
- Should parent/guardian workflows be visible to students or only to staff?
