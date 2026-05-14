# Assistant Role Operational Support Plan

Last updated: 2026-05-14.

## Implementation Status

Legend:

- `[x]` Completed in tenant frontend.
- `[~]` Partially completed or temporary frontend fallback.
- `[ ]` Not started / requires backend or product decision.

Frontend completed:

- `[x]` Assistant is kept out of instructor teaching-role defaults.
- `[x]` Assistant operational permission helpers were added in `src/features/tenant/tenantRoles.ts`.
- `[x]` Assistant navigation now exposes operational workspace items: Overview, Operations, Groups, Sessions, Support, and Settings.
- `[x]` Explicit assistant permissions can expose optional Reports, Members, Courses, and Certificates navigation.
- `[x]` Attendance and Homework routes are no longer reachable through broad staff/operational support access.
- `[x]` Assistant Overview avoids default teaching queues and points toward coordination/support actions.
- `[x]` `/support` Student Support page uses the backend support queue by default and only falls back to legacy course/group/student APIs if the support endpoint fails.
- `[x]` Student Support queue pagination is wired to the backend `page`, `limit`, and `totalPages` response.
- `[x]` Student Support filters now switch whole sections for All, Students, and Groups.
- `[x]` Support note create/edit and guardian record create/list workflows are visible in the student support detail modal.
- `[x]` Student contact, student support notes, and guardian contact are not granted by default; they require explicit permissions.
- `[x]` Assistant permission/navigation/localization tests were added or updated.

Partially completed:

- `[~]` Direct student contact is represented as permission-driven UI only; no outbound communication/audit workflow exists yet.
- `[~]` Escalation is still mostly represented through action links/status context; a richer escalation workflow can be added later.

Not completed:

- `[ ]` Outbound student/guardian communication workflow and immutable contact audit log.
- `[ ]` Parent/guardian contact policy, consent rules, and enabled communication workflows.
- `[ ]` Visual QA with real fixture accounts for owner, company admin, assistant, instructor, and student.

## Role Definition

The assistant role is an operational support role, not a teaching role.

Assistant users act as the bridge between owner/admin users, instructors, and students. Their default workspace should help them coordinate learning operations, follow up on learners, support scheduling and enrollment, and keep instructor/student workflows moving. They should not be treated as instructors unless explicitly granted teaching permissions.

## Product Positioning

Role hierarchy:

- **Owner**: tenant ownership, owner/admin governance, high-risk tenant controls.
- **Company admin**: tenant administration, courses, groups, enrollment, reporting, operational setup.
- **Assistant**: operational support and coordination between admins, instructors, and students.
- **Instructor**: assigned teaching delivery, attendance, homework, activities, materials, live sessions.
- **Student**: learner experience.

## Current Implementation Review

The tenant frontend now separates assistant from instructor defaults:

- `src/features/tenant/tenantRoles.ts` keeps `teachingRoles` limited to `instructor`.
- Plain assistants no longer pass `canTeachAssignedSessions` by role fallback.
- Plain assistant navigation exposes operational read/support surfaces instead of teaching delivery surfaces.
- Instructor dashboard data is loaded only when `canTeachAssignedSessions` is true.
- Attendance and Homework are protected by management-specific route guards instead of the broad staff route.
- `/support` exists as an initial assistant support workspace.

This is the right security direction, but the backend product model is still incomplete.

Remaining gaps:

- Outbound student/guardian communication still needs a policy-backed backend workflow and audit log.
- Escalation beyond support-note metadata can be expanded into a dedicated assignment/handoff workflow.
- Parent/guardian contact remains disabled until consent and tenant policy are finalized.

The remaining work is not only to remove instructor behavior. It is to add the missing assistant operating model.

## Things Assistants Should Not Get By Default

These surfaces are unnecessary or risky for the assistant role unless explicitly granted:

- Attendance marking and attendance save actions.
- Homework creation, review, grading, approval, rejection, and revision requests.
- Activity creation, editing, response review, and scoring.
- Teaching material uploads and edits.
- Live teaching meeting creation/editing/host controls.
- Certificate approval or issuing.
- Course creation, editing, approval, or publication.
- Tenant branding, billing, feature flags, settings, and owner management.
- Instructor-style "today teaching" dashboard cards.
- Admin setup/readiness dashboards as the primary assistant home.

Assistants may need visibility into some of these areas, but visibility should be separated from mutation. For example, an assistant can see that attendance is unmarked and escalate to the instructor without being able to mark attendance.

## Missing Assistant Capabilities

The assistant role should become a bridge between owner/admin, instructor, student, and future parent/guardian workflows.

Missing product capabilities:

- Operational support home: one place to see what needs follow-up today.
- Student support queue: students with missed sessions, missing homework, low progress, pending onboarding, or no recent activity.
- Group coordination queue: groups without instructor, schedule, seats, start/end dates, location, or meeting details.
- Session coordination queue: sessions missing meeting links, cancelled/rescheduled sessions, sessions with no attendance submitted, sessions with missing materials, and upcoming sessions needing admin/instructor confirmation.
- Enrollment and invitation queue: pending invitations, incomplete setup, waitlisted students, failed invites, and students not assigned to groups.
- Escalation actions: ask admin, ask instructor, contact student, and later contact parent/guardian.
- Read-only student context: contact info, group/course assignment, instructor, attendance trend, homework missing count, progress, certificate eligibility status.
- Internal notes or handoff status: who is responsible, due date, last contact, next action.
- Parent/guardian-ready data model: guardian contact, relationship, communication preference, consent/status, and allowed visibility.

Suggested assistant home questions:

- Which students need support or onboarding help?
- Which groups or sessions are blocked operationally?
- Which upcoming sessions need meeting links, instructor confirmation, or schedule changes?
- Which enrollments or invitations are stuck?
- What should be escalated to admin?
- What should be escalated to instructor?
- What should be communicated to student now?
- In the future, what should be communicated to parent/guardian?

## Target Assistant Defaults

Default assistant permissions should be operational, not instructional.

Recommended default capabilities:

| Capability | Default |
| --- | --- |
| Enter tenant workspace | Yes |
| View operational courses/groups/sessions | Yes |
| View rosters/student context | Yes |
| Coordinate groups/schedules | Yes, if assistant is expected to handle logistics |
| Enroll/invite students | Yes, if assistant handles onboarding |
| View operational reports | Limited/Yes |
| Manage attendance | No by default |
| Review/grade homework | No by default |
| Manage activities | No by default |
| Manage teaching materials | No by default |
| Manage live teaching meetings | No by default |
| Approve certificates | No |
| Create/edit/approve courses | No |
| Manage tenant members broadly | No by default |
| Manage tenant settings/branding/features | No |
| Manage owners | No |

## Permission Model Changes

Split role groups into three separate concepts:

```ts
tenantAdminRoles = ['owner', 'company_admin'];
operationalSupportRoles = ['assistant'];
teachingRoles = ['instructor'];
```

Assistant should receive operational defaults through assistant-specific capability checks, not through instructor fallback behavior.

Recommended capability fields:

```ts
type TenantPermissions = {
  canEnterWorkspace: boolean;

  // Admin/governance
  canManageTenant?: boolean;
  canManageOwners?: boolean;
  canManageMembers?: boolean;
  canManageBranding?: boolean;
  canManageSettings?: boolean;

  // Course/catalog governance
  canManageCourses?: boolean;
  canApproveCourses?: boolean;

  // Operational support
  canSupportOperations?: boolean;
  canViewOperationalCourses?: boolean;
  canViewOperationalGroups?: boolean;
  canViewOperationalSessions?: boolean;
  canViewStudentSupportContext?: boolean;
  canCoordinateGroups?: boolean;
  canEnrollStudents?: boolean;
  canViewOperationalReports?: boolean;
  canEscalateOperationalIssues?: boolean;
  canManageStudentSupportNotes?: boolean;
  canContactStudents?: boolean;
  canViewGuardianContext?: boolean;
  canContactGuardians?: boolean;

  // Teaching delivery
  canTeachAssignedSessions?: boolean;
  canViewAssignedCourses?: boolean;
  canViewAssignedGroups?: boolean;
  canManageAssignedAttendance?: boolean;
  canManageAssignedHomework?: boolean;
  canManageAssignedActivities?: boolean;
  canManageAssignedMaterials?: boolean;
  canManageAssignedLiveMeetings?: boolean;
  canApproveAssignedCertificates?: boolean;

  // Certificates
  canManageCertificates?: boolean;
};
```

## Backend Tasks

### 1. Split Assistant From Teaching Role Defaults

[x] Status: Completed in backend.

Update backend tenant workspace permissions so:

- `[x]` `instructor` gets teaching delivery defaults.
- `[x]` `assistant` gets operational support defaults.
- `[x]` Assistant does not inherit `canTeachAssignedSessions`.
- `[x]` Assistant does not inherit assigned attendance/homework/activity/material/live-meeting management.

Acceptance criteria:

- `[x]` Assistant workspace payload has `canTeachAssignedSessions: false`.
- `[x]` Assistant has no teaching mutation permissions unless explicitly granted.
- `[x]` Instructor permissions remain unchanged.

### 2. Add Assistant Operational Defaults

[x] Status: Completed in backend for the first operational-support slice.

Add assistant-specific defaults:

- `[x]` `canSupportOperations: true`
- `[x]` `canViewOperationalCourses: true`
- `[x]` `canViewOperationalGroups: true`
- `[x]` `canViewOperationalSessions: true`
- `[x]` `canViewStudentSupportContext: true`
- `[x]` `canCoordinateGroups: true` for tenant assistants.
- `[x]` `canEnrollStudents: true` for tenant assistants.
- `[x]` `canViewOperationalReports: true` and `canViewReports: true` for tenant assistants.
- `[x]` `canEscalateOperationalIssues: true`
- `[x]` `canManageStudentSupportNotes: true` in the permission payload.
- `[x]` `canContactStudents: true` in the permission payload.
- `[x]` `canViewGuardianContext: false` until parent/guardian workflows are designed.
- `[x]` `canContactGuardians: false` until parent/guardian permissions and consent rules are designed.

Backend implementation notes:

- Tenant-role resolution now uses the resolved tenant membership role instead of trusting the global JWT role for assistant operations.
- Assistant coordination writes are tenant-scoped and do not grant teaching delivery permissions.
- Assistant session updates cannot set teaching materials, recordings, activities, or completion status.

Decision needed:

- `[x]` Assistants can create/edit groups and coordinate sessions for the active tenant.
- `[x]` Assistants can enroll/unenroll students and invite/resend invitations for students only.
- `[x]` Assistants currently see tenant-wide operational groups/sessions.
- `[~]` Direct student contact is represented as a permission flag only; no backend communication/audit workflow has been added yet.
- `[x]` Student support context now has a backend queue plus support notes/escalation metadata.
- `[x]` Frontend support modal now supports visible support note create/edit and guardian record management workflows.
- `[x]` Parent/guardian records and consent fields now exist as a non-contact foundation.
- `[ ]` Parent/guardian communication remains future work and requires consent/audit policy.

### 3. Backend Endpoint Authorization Review

[~] Status: Partially completed in backend.

Review assistant access on these endpoints:

- `[x]` `GET /companies/:tenantId/courses`
- `[x]` `GET /course-groups`
- `[x]` `GET /group-sessions`
- `[x]` `GET /course-groups/:groupId/students`
- `[x]` `POST /course-groups`
- `[x]` `PATCH /course-groups/:groupId`
- `[x]` `POST /group-sessions`
- `[x]` `PATCH /group-sessions/:id`
- `[x]` `POST /enrollments/enroll`
- `[x]` `DELETE /enrollments/:courseId/unenroll/:userId`
- `[x]` `POST /companies/:tenantId/invitations` for student invitations only.
- `[x]` Student support context endpoints use existing roster/progress/dashboard signals plus support notes.
- `[ ]` Student/guardian contact endpoints when introduced.
- `[x]` Operational note/escalation endpoints.
- `[x]` Attendance, homework, activities, materials, and live-meeting teaching endpoints deny assistant by default.

Recommended behavior:

- `[x]` Operational read endpoints: allow assistant based on operational support permission.
- `[x]` Enrollment/scheduling writes: allow assistant for the active tenant.
- `[x]` Student support notes/escalations: backend note/escalation metadata is implemented.
- `[~]` Student contact: permission field exists; backend communication/audit workflow is not implemented yet.
- `[x]` Parent/guardian contact: denied while guardian consent and audit logging are prepared.
- `[x]` Teaching writes: deny assistant by default.

### 4. Optional Assistant Dashboard Endpoint

[x] Status: Implemented initial backend endpoint.

Consider adding a dedicated endpoint:

`GET /companies/:tenantId/assistant-dashboard`

Current backend response includes:

- `generatedAt`
- `assistant`
- `tenant`
- `permissions`
- `operations`
- `actionQueue`
- `groups`
- `studentSupportQueue`

Implemented follow-up slice:

- Dashboard counts now include pending student invitations, delivery enrollments without groups, and online live sessions missing meeting links.
- `studentSupportQueue` now uses roster/progress/homework/support-note/guardian signals.
- Support notes can track priority, status, owner role, next action, due date, and last contact.
- Guardian records include relationship, contact details, update permissions, and consent status.

Known gaps for later slices:

- No outbound student/guardian communication endpoint yet.
- No immutable communication audit log yet beyond tenant activity events for support note and guardian record changes.
- Guardian contact remains disabled at the product/API level until consent and tenant policy are finalized.

Suggested response:

```ts
type AssistantDashboard = {
  generatedAt: string;
  assistant: { id: number; fullName?: string | null; email?: string | null };
  tenant: { id: number; name: string; timezone?: string | null; locale?: string | null };
  permissions: TenantPermissions;
  operations: {
    activeGroups: number;
    upcomingSessions: number;
    pendingEnrollments: number;
    studentsNeedingSupport: number;
    groupsWithoutInstructor: number;
    sessionsWithoutMeeting: number;
    pendingInvitations: number;
    blockedItems: number;
  };
  actionQueue: Array<{
    id: string;
    type:
      | 'student_support'
      | 'pending_invitation'
      | 'missing_instructor'
      | 'missing_schedule'
      | 'missing_meeting'
      | 'unmarked_attendance'
      | 'missing_homework'
      | 'admin_escalation'
      | 'instructor_escalation';
    priority: 'high' | 'medium' | 'low';
    title: string;
    detail?: string | null;
    route?: string | null;
    ownerRole?: 'assistant' | 'admin' | 'instructor' | 'student' | 'guardian';
    dueAt?: string | null;
  }>;
  groups: Array<{
    id: number;
    name: string;
    courseId: number;
    courseTitle: string;
    instructorName?: string | null;
    studentCount: number;
    nextSessionAt?: string | null;
  }>;
  studentSupportQueue: Array<{
    studentId: number;
    fullName?: string | null;
    email?: string | null;
    groupId?: number | null;
    groupName?: string | null;
    instructorName?: string | null;
    reasons: Array<{
      code: string;
      label: string;
      severity: 'high' | 'medium' | 'low';
      route?: string | null;
    }>;
    lastContactAt?: string | null;
    nextAction?: string | null;
    guardianSummary?: {
      hasGuardian: boolean;
      contactAllowed: boolean;
      preferredChannel?: string | null;
    };
  }>;
};
```

### 5. Parent/Guardian Foundation

[x] Status: Backend data foundation implemented; communication remains disabled.

Parent support should not be bolted onto the student model informally. Add a clear guardian contract before exposing parent communication.

Suggested future model:

```ts
type StudentGuardian = {
  id: number;
  studentId: number;
  fullName: string;
  relationship?: 'parent' | 'guardian' | 'relative' | 'other' | string;
  email?: string | null;
  phone?: string | null;
  preferredChannel?: 'email' | 'sms' | 'whatsapp' | 'telegram' | 'phone' | string;
  canReceiveProgressUpdates: boolean;
  canReceiveAttendanceUpdates: boolean;
  canReceiveHomeworkUpdates: boolean;
  consentStatus: 'pending' | 'granted' | 'revoked';
  notes?: string | null;
};
```

Requirements before enabling parent contact:

- `[x]` Consent and visibility fields per guardian.
- `[ ]` Audit log for every parent/guardian communication.
- `[ ]` Tenant-level policy for whether assistants can contact parents.
- `[x]` Clear separation between student contact, guardian contact, and instructor/admin escalation at the data model/permission level.

## Frontend Tasks

### 1. Split Role Helpers

[x] Status: Completed in tenant frontend.

Update `src/features/tenant/tenantRoles.ts`:

- Keep assistant out of `teachingRoles`.
- Add `operationalSupportRoles`.
- Add helpers:
  - `canSupportTenantOperations`
  - `canViewOperationalLearning`
  - `canViewStudentSupportContext`
  - `canViewOperationalReports`
  - `canEscalateOperationalIssues`
  - `canManageStudentSupportNotes`
  - `canContactStudents`
  - `canViewGuardianContext`
  - `canContactGuardians`
- Keep instructor helpers specific to instructor/teaching capabilities.

Acceptance criteria:

- Assistant no longer passes `canTeachAssignedSessions` by role fallback.
- Assistant does not see instructor dashboard/task queues by default.
- Instructor still sees assigned teaching dashboard/task queues.
- Assistant can access operational read surfaces without being granted teaching mutation permissions.
- Assistant can have coordination write permissions without automatically gaining attendance/homework/activity/material/live-meeting writes.

### 2. Navigation Changes

[x] Status: Completed in tenant frontend.

Assistant navigation should focus on operational coordination:

- Home
- Operations
- Groups/Sessions
- Students or Support, not broad Members by default
- Attendance overview only if it is read-only or escalation-focused
- Reports if operational reports are enabled
- Settings only personal settings unless explicit admin permissions exist

Hide by default:

- Homework grading workflow.
- Instructor teaching task dashboard.
- Certificate approval queue.
- Teaching materials/activity management unless explicitly granted.
- Tenant branding/settings/owners.

Recommended assistant primary navigation:

- `/` Assistant Home
- `/operations` Coordination Hub
- `/groups` Groups
- `/sessions` Sessions
- `/support` Student Support, new page
- `/settings` Profile/Preferences

Optional navigation:

- `/reports` only with `canViewOperationalReports` or `canViewReports`
- `/attendance` only as read-only overview, not the current marking workflow. Current frontend keeps `/attendance` hidden from assistant defaults until a read-only attendance overview exists.
- `/members` only with `canManageMembers`
- `/courses` only with `canManageCourses`
- `/certificates` only with `canManageCertificates`

### 3. Page Behavior Changes

[~] Status: Mostly completed in tenant frontend; backend-supported support actions are still pending.

Update page permissions:

- Sessions/Groups: assistant can see coordination surfaces if `canCoordinateGroups` or operational read permissions exist.
- Enrollment actions: assistant only sees them if `canEnrollStudents`.
- Attendance: assistant should not mark attendance unless `canManageAssignedAttendance`.
- Homework: assistant should not review/grade unless `canManageAssignedHomework`.
- Activities/materials/live meetings: assistant should not edit unless explicit capability exists.
- Courses: assistant should not enter course admin unless `canManageCourses`; use Groups/Sessions/Operations for coordination instead.
- Settings: assistant should see profile/preferences by default, not tenant settings/branding/features.
- Members: assistant should not manage staff broadly unless `canManageMembers`; create a student support page instead of overloading Members.

Current frontend risks to fix:

- `[x]` `src/app/App.tsx` used broad `StaffRoute` for attendance and homework. This was split into route guards:
  - `OperationalLearningRoute` for groups/sessions read/coordination.
  - `AttendanceManagementRoute` requiring `canManageAssignedAttendance`.
  - `HomeworkManagementRoute` requiring `canManageAssignedHomework`.
- `[x]` `src/features/attendance/AttendancePage.tsx` can save attendance after page access, so the route is now blocked unless attendance/course-management permission exists.
- `[x]` `src/features/homework/HomeworkPage.tsx` can create, edit, delete, and review homework after page access, so the route is now blocked unless homework/course-management permission exists.
- `[x]` `src/features/dashboard/OverviewPage.tsx` renders assistant-specific coordination/support actions when role is assistant.
- `[x]` `src/components/appNavigation.ts` does not show teaching pages for assistants with only coordination support.
- `[~]` A true read-only attendance/homework support view is not implemented yet.

Suggested page split:

| Page | Assistant default | Notes |
| --- | --- | --- |
| Overview | Yes | Assistant-specific queue, not instructor/admin overview |
| Operations | Yes | Coordination hub |
| Groups | Yes | View; edit only with `canCoordinateGroups` |
| Sessions | Yes | View; create/edit only with `canCoordinateGroups` |
| Student Support | Yes | New page for follow-up, notes, escalation |
| Attendance | No mutation | Optional read-only overview or escalation only |
| Homework | No mutation | Optional read-only missing/submitted signal only |
| Courses | No | Course admin only with `canManageCourses` |
| Members | No | Broad member management only with `canManageMembers` |
| Reports | Optional | Use operational reports permission |
| Settings | Personal only | Tenant settings only with admin permissions |

### 4. Assistant Home UX

[x] Status: Completed for the current tenant frontend release scope.

Assistant home should be a work queue, not a dashboard of generic stats.

Recommended layout:

- Top row: Today, Blocked, Students to contact, Pending invites.
- Primary queue: prioritized actions grouped by `Student`, `Group`, `Session`, `Admin escalation`, `Instructor escalation`.
- Student support panel: students with reason chips such as missed sessions, missing homework, low progress, onboarding incomplete.
- Group/session readiness panel: missing instructor, missing schedule, missing meeting link, capacity issue, cancelled/rescheduled.
- Communication panel: recent contacts, pending replies, future parent/guardian follow-up when enabled.
- Escalation panel: items waiting on admin or instructor.

Assistant action language should be operational:

- "Contact student"
- "Assign follow-up"
- "Ask instructor"
- "Escalate to admin"
- "Open group"
- "Open session"
- "Mark resolved"

Avoid teaching language by default:

- "Grade"
- "Review submission"
- "Mark attendance"
- "Start live class"
- "Upload teaching material"
- "Approve certificate"

### 5. Student Support Page

[x] Status: Completed for the current tenant frontend release scope.

Add a dedicated student support page instead of using broad member management for assistant work.

Core table fields:

- Student name/contact.
- Course/group.
- Instructor.
- Support status.
- Reasons needing attention.
- Last contact.
- Next action.
- Owner.

Expected filters:

- Needs onboarding.
- Missed attendance.
- Missing homework.
- Low progress.
- Pending invitation.
- No group assigned.
- Waiting on instructor.
- Waiting on admin.
- Future: parent/guardian follow-up allowed.

Expected actions:

- `[x]` Open group/session context.
- `[x]` Contact student is hidden by default and requires explicit `canContactStudents`.
- `[x]` Support notes are hidden by default and require explicit `canManageStudentSupportNotes`.
- `[~]` Escalation is currently a link/status behavior; a real escalation workflow requires backend support.
- `[ ]` Future: contact guardian, only when consent and permission allow it.

### 6. Tests

[x] Status: Completed for the current frontend scope.

Add or update tests for:

- Assistant is not a teaching role.
- Assistant does not get instructor navigation by default.
- Assistant can access operational support pages.
- Assistant cannot access homework review/attendance marking by default.
- Explicit permission override can grant a teaching capability if needed.
- Assistant with `canCoordinateGroups` can access Groups/Sessions/Operations but not Attendance/Homework mutations.
- Assistant with `canEnrollStudents` can invite/enroll students but cannot manage staff.
- Assistant with operational report permission can see operational reports without tenant settings/member management.
- Assistant support page hides guardian contact when guardian permissions or consent are missing.
- Assistant overview uses `workspace.role` from `/dashboard` responses when top-level role is not present.
- Student Support pagination calls the backend with the selected page.
- Student Support uses legacy roster loading only when backend support loading fails.
- Student Support filters hide unrelated sections instead of showing misleading empty states.

## UX Direction

Summary:

Assistant home should answer:

- Which groups/sessions need operational follow-up?
- Which students need support or onboarding help?
- Which groups are missing instructor/session/meeting setup?
- Which enrollments/invitations need action?
- What should be escalated to admin or instructor?

Assistant home should not look like:

- Instructor teaching queue.
- Admin setup dashboard.
- Student learning dashboard.

## Rollout Plan

1. `[ ]` Update backend default permissions for assistant.
2. `[x]` Update frontend role helpers and route permissions.
3. `[x]` Adjust navigation and page-level action gates.
4. `[x]` Add assistant-specific tests.
5. `[ ]` Validate with fixture accounts:
   - Owner.
   - Company admin.
   - Assistant.
   - Instructor.
   - Student.
6. `[ ]` Run visual QA for assistant workspace against instructor/admin workspaces.

## Open Product Decisions

- Should assistant see all tenant groups/sessions or only assigned operational scopes?
- Should assistant be allowed to create/edit groups and sessions?
- Should assistant be allowed to invite/enroll/remove students?
- Should assistant see members, students, or both?
- Should assistant have read-only attendance visibility?
- Should assistant have operational reports or only task queues?
- Should assistant contact students directly, or only create follow-up/escalation tasks?
- Should student support notes be visible to instructors, admins, or students?
- Should assistant support scope be tenant-wide or limited to assigned courses/groups?
- What parent/guardian fields are required for the first release?
- What consent rules must exist before assistants can view or contact guardians?
