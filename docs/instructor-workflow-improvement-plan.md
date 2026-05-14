# Instructor Workflow Improvement Plan

Last updated: 2026-05-14.

This document converts the instructor-role review into an implementation plan for product, frontend, backend, API, QA, and rollout work. The goal is to make the instructor experience focused on teaching assigned learners, not administering the tenant.

## Product Goal

Instructors should enter the workspace and immediately understand:

- What they teach today.
- Which session needs action next.
- Which attendance records are missing.
- Which homework or activity submissions need review.
- Which students need attention.
- Which materials or meetings are ready for the next class.

Instructor screens should avoid tenant administration, organization setup, member management, billing/platform details, broad reports, and course catalog governance unless the instructor has explicit extra permissions.

## Current Gaps

- Instructor access is based on broad staff access through `canOperateTenantLearning`, so instructors can reach many coordinator/admin operations.
- Settings are visible to instructors and include mostly tenant/admin tabs.
- Course and group screens are catalog/setup-heavy instead of teaching-task-heavy.
- Group creation, enrollment, student removal, session generation, and course setup are available in instructor-facing flows.
- The frontend uses broad list endpoints such as tenant courses and course groups, so assigned-scope filtering needs backend support.
- Existing session insight data is useful but not promoted to the instructor home experience.
- Certificate access mixes instructor approval/review needs with admin branding/rule management.

## Target Instructor Navigation

Recommended default navigation for plain instructors:

- **Home**: today, next session, queues, attention students.
- **Schedule**: assigned sessions, session detail, meeting, materials, activities.
- **Attendance**: unmarked and recent attendance for assigned sessions.
- **Homework Review**: submissions, missing work, late work, revision queue.
- **My Groups**: assigned groups, rosters, learner progress, contact context if allowed.
- **Materials**: optional if materials become a first-class workflow.
- **Personal Settings**: language, theme, account preferences.

Hide by default unless explicitly permissioned:

- Tenant settings.
- Members.
- Reports.
- Certificate branding.
- Certificate course rules.
- Course approval.
- Course creation.
- Group creation.
- Enrollment and unenrollment.
- Session generation.
- Workspace policies and feature flags.

## Permission Model

Replace broad role checks with capability checks. Role names should remain labels; capabilities should decide access.

Suggested backend/frontend permission fields:

```ts
type TenantPermissions = {
  canEnterWorkspace: boolean;
  canTeachAssignedSessions?: boolean;
  canViewAssignedCourses?: boolean;
  canViewAssignedGroups?: boolean;
  canManageAssignedAttendance?: boolean;
  canManageAssignedHomework?: boolean;
  canManageAssignedActivities?: boolean;
  canManageAssignedMaterials?: boolean;
  canManageAssignedLiveMeetings?: boolean;
  canApproveAssignedCertificates?: boolean;
  canCoordinateGroups?: boolean;
  canEnrollStudents?: boolean;
  canManageCourses?: boolean;
  canApproveCourses?: boolean;
  canViewReports?: boolean;
  canManageMembers?: boolean;
  canManageTenant?: boolean;
  canManageBranding?: boolean;
  canManageSettings?: boolean;
  canManageCertificates?: boolean;
};
```

Recommended default capabilities:

| Capability | Instructor | Assistant | Coordinator/Admin |
| --- | --- | --- | --- |
| View assigned courses/groups/sessions | Yes | Yes | Yes |
| Mark assigned attendance | Yes | Optional | Yes |
| Create/review assigned homework | Yes | Optional | Yes |
| Manage assigned activities/materials | Yes | Optional | Yes |
| Manage assigned live meeting | Yes | Optional | Yes |
| View assigned student roster | Yes | Yes | Yes |
| Enroll/remove students | No | No/Optional | Yes |
| Create/edit groups | No | No/Optional | Yes |
| Generate sessions | No | No/Optional | Yes |
| Create/edit/approve courses | No/Optional authoring only | No | Yes |
| Manage certificate branding/rules | No | No | Yes |
| Approve assigned certificates | Only if configured | Optional | Yes |
| Tenant settings/members/reports | No | No | Yes |

## Backend Tasks

### 1. Add Assigned Scope Resolution

Create a shared backend helper that determines whether the current user can access an object:

- Tenant access by membership.
- Course access by `course.instructorId` or group assignment.
- Group access by `courseGroup.instructorId` or parent course instructor.
- Session access by parent group/course assignment.
- Student roster access by assigned group.
- Homework/activity access by parent session assignment.

Acceptance criteria:

- Instructor cannot access another instructor's course/group/session by direct URL or ID.
- Tenant admins and explicit coordinators keep full tenant access.
- Permission checks are centralized, not duplicated per controller.

### 2. Scope Read Endpoints

Update existing list endpoints to support instructor scope.

Endpoints to review:

- `GET /companies/:tenantId/courses`
- `GET /courses/:courseId/students`
- `GET /course-groups`
- `GET /course-groups/:groupId/students`
- `GET /group-sessions`
- `GET /group-sessions/:sessionId/insights`
- `GET /attendance/sessions/:sessionId`
- `GET /group-sessions/:sessionId/homework`
- `GET /group-sessions/:sessionId/homework/:homeworkId/review-roster`
- `GET /companies/:tenantId/certificate-branding`
- `GET /courses/:courseId/certificate-settings`
- `GET /courses/:courseId/certificates`

Recommended behavior:

- Admin/coordinator: full tenant result.
- Instructor: only assigned courses, groups, sessions, rosters, and work queues.
- Assistant: only assigned scope unless explicitly granted coordinator capabilities.
- Student: existing student-only scope.

Acceptance criteria:

- Broad tenant endpoints do not leak unassigned courses or groups to instructors.
- Empty states caused by scoping are distinguishable from true no-data states where useful.

### 3. Restrict Write Endpoints

Protect these as coordinator/admin actions by default:

- `POST /courses`
- `PATCH /courses/:courseId`
- `PATCH /courses/:courseId/status`
- `POST /course-groups`
- `PATCH /course-groups/:groupId`
- `GET /course-groups/:groupId/session-generation/preview`
- `POST /course-groups/:groupId/session-generation`
- `POST /enrollments/enroll`
- `DELETE /enrollments/:courseId/unenroll/:userId`
- `POST /companies/:tenantId/invitations`
- `PATCH /companies/:tenantId/members/:userId`
- Tenant settings, branding, policies, features, and activity endpoints.
- Certificate branding and certificate course-rule endpoints.

Allow these for instructors only within assigned scope:

- `POST /attendance/sessions/:sessionId/bulk`
- `POST /group-sessions/:sessionId/homework`
- `PATCH /group-sessions/:sessionId/homework/:homeworkId`
- `DELETE /group-sessions/:sessionId/homework/:homeworkId`
- `PATCH /group-sessions/:sessionId/homework/:homeworkId/submissions/:submissionId`
- `POST /group-sessions/:sessionId/activities`
- `PATCH /group-sessions/:sessionId/activities/:activityId`
- `POST /group-sessions/:sessionId/activities/:activityId/delete`
- `PATCH /group-sessions/:sessionId/activities/:activityId/submissions/:submissionId`
- `POST /group-sessions/:sessionId/materials/upload`
- Live meeting create/update/delete for assigned sessions, if the product allows instructors to manage meeting links.

Acceptance criteria:

- Direct API calls cannot perform hidden UI actions.
- Backend returns `403` for unauthorized actions and clear error codes for the frontend.

### 4. Add Instructor Dashboard Endpoint

Add one dedicated endpoint to avoid the instructor home stitching together many broad lists.

Suggested endpoint:

`GET /companies/:tenantId/instructor-dashboard`

Suggested response:

```ts
type InstructorDashboard = {
  generatedAt: string;
  instructor: { id: number; fullName?: string; email: string };
  today: {
    sessions: InstructorSessionSummary[];
    nextSession?: InstructorSessionSummary | null;
  };
  queues: {
    unmarkedAttendance: number;
    homeworkNeedsReview: number;
    activityNeedsReview: number;
    missingHomework: number;
    upcomingWithoutMaterials: number;
  };
  attentionStudents: Array<{
    studentId: number;
    fullName: string;
    groupId: number;
    groupName: string;
    severity: 'high' | 'medium' | 'low';
    reasons: Array<{ code: string; label: string; route?: string }>;
  }>;
  assignedCourses: Array<{ id: number; title: string; groupCount: number; activeStudentCount: number }>;
  assignedGroups: Array<{ id: number; name: string; courseId: number; courseTitle: string; studentCount: number }>;
};
```

`InstructorSessionSummary` should include:

- `sessionId`
- `title`
- `courseId`
- `courseTitle`
- `groupId`
- `groupName`
- `startsAt`
- `endsAt`
- `status`
- `location`
- `meetingProvider`
- `joinUrl`
- `hostUrl` if allowed
- `attendanceMarked`
- `homeworkNeedsReview`
- `materialsCount`
- `activitiesCount`

Acceptance criteria:

- The instructor home renders from a single endpoint.
- Dashboard data is scoped server-side.
- Counts link to exact filtered routes.

### 5. Return Granular Permissions In Workspace Payload

Update workspace/tenant response objects so the frontend can render nav and actions from capabilities.

Affected response shapes:

- Active workspace.
- Tenant list.
- Tenant dashboard/workspace metadata.

Acceptance criteria:

- Frontend does not infer important behavior from role strings alone.
- Role labels can be translated independently from permissions.

### 6. Audit Logging

Add or verify activity logs for instructor actions:

- Attendance saved.
- Homework created/updated/deleted.
- Homework reviewed.
- Activity created/updated/deleted.
- Activity response reviewed.
- Material uploaded/removed.
- Meeting created/updated/deleted.

Acceptance criteria:

- Admins can audit instructor operational changes.
- Logs include tenant, actor, target type, target ID, and parent course/group/session IDs where applicable.

## Frontend Tasks

### Frontend Implementation Status

Completed on 2026-05-14:

- [x] Added granular instructor/coordinator capability fields to frontend domain types.
- [x] Added frontend capability helpers for assigned teaching, coordination, enrollment, course approval, and certificate approval.
- [x] Added instructor-specific navigation focused on overview, sessions, attendance, homework, groups, certificates, and personal settings.
- [x] Removed plain instructors from the Operations hub by default.
- [x] Removed tenant certificate management fallback from plain instructors while preserving assigned certificate approval access.
- [x] Gated course creation, course editing, and course approval behind course management/approval capabilities.
- [x] Gated group creation, group editing, session generation, scheduling, enrollment, and student removal behind coordinator/enrollment capabilities.
- [x] Reduced instructor settings to personal settings by default; admin settings tabs are now permission-based.
- [x] Restricted certificate branding/rules/issue/revoke/regenerate actions to certificate admins; instructor approval remains available when configured.
- [x] Removed workspace readiness/setup content from the non-admin overview surface.
- [x] Integrated the dedicated instructor dashboard endpoint into the overview to enrich today, next-session, and queue counts.
- [x] Added queue-first homework review across assigned sessions through the assigned homework review queue endpoint.
- [x] Added assigned-session quick pickers to Schedule and Attendance using the backend scoped session query.
- [x] Updated permission and navigation tests for instructor behavior.

Pending frontend work that depends on backend contracts or product decisions:

- [ ] Add visual QA pass with real instructor fixtures after backend scoping is available.

## Backend Implementation Status

Completed backend work:

- [x] Added granular tenant capability fields for assigned teaching, coordination, enrollment, and course approval.
- [x] Removed default instructor course-management permissions from tenant workspace payloads.
- [x] Restricted course create, status, publish, edit, delete, and cover upload actions to tenant admins/platform admins.
- [x] Restricted group create/edit and session generation to tenant admins/platform admins.
- [x] Restricted session create/edit scheduling actions to tenant admins/platform admins.
- [x] Restricted enrollment and unenrollment mutations to tenant admins/platform admins, while preserving student self-enrollment.
- [x] Restricted manual certificate issue to tenant admins/platform admins.
- [x] Preserved assigned instructor access for group/course rosters, sessions, attendance, homework, activities, materials, certificate list/settings, and configured certificate approval.
- [x] Added `GET /companies/:tenantId/instructor-dashboard` with instructor profile, today's sessions, next session, queues, assigned courses, and assigned groups.
- [x] Added `GET /homework/review-queue` for assigned homework review/missing/late work.
- [x] Added `GET /group-sessions/activity-review-queue` for assigned activity submissions that need review.
- [x] Added backend metadata tests that verify default instructors cannot call restricted course setup, group setup, session scheduling, enrollment, or manual certificate issue endpoints.
- [x] Added a centralized assigned-scope authorization helper and migrated attendance, groups, sessions, homework, activity queues, and tenant overview scoping to use it.
- [x] Added service tests for instructor dashboard response shaping, non-teaching dashboard denial, assigned-scope helper behavior, and homework review queue filtering/summary.

Remaining backend work:

- [ ] Add real fixture-based QA for owner, company admin, instructor, and student tenant workspaces.

### 1. Introduce Instructor Capability Helpers

Update role helpers in `src/features/tenant/tenantRoles.ts`.

Add helpers such as:

- `canTeachAssignedSessions`
- `canViewAssignedLearning`
- `canManageAssignedAttendance`
- `canManageAssignedHomework`
- `canCoordinateTenantLearning`
- `canManageCourseGovernance`

Acceptance criteria:

- Existing broad helpers are replaced or narrowed where instructor behavior matters.
- Tests cover owner, company admin, instructor, student, and explicit-permission overrides.

### 2. Redesign Instructor Navigation

Update `src/components/appNavigation.ts`.

Tasks:

- Add instructor-specific nav items.
- Remove tenant settings from default instructor nav, or show only personal settings.
- Hide operations/admin grouping from plain instructors.
- Keep mobile priority focused on schedule, attendance, homework, and home.

Acceptance criteria:

- Plain instructor sees teaching tools only.
- Coordinator/admin still sees admin and operations tools.
- Direct routes still enforce access.

### 3. Build Instructor Home

Create a focused instructor home experience, either by adapting `OverviewPage` or adding a dedicated `InstructorDashboardPage`.

Recommended sections:

- Next session panel with time, group, location/meeting, materials, and actions.
- Today timeline.
- Teaching queue: attendance, homework review, activity review.
- Attention students.
- Assigned groups summary.
- Recent submissions or review activity.

Primary actions:

- Open next session.
- Mark attendance.
- Review homework.
- Open meeting.
- Upload materials.

Acceptance criteria:

- Instructor lands on actionable teaching work.
- No tenant setup/admin cards appear for plain instructors.
- Empty state explains there are no assigned sessions or groups.

### 4. Split Coordinator Operations From Teaching Screens

Review `CoursesPage`, `GroupsPage`, and `SessionsPage`.

Tasks:

- Hide course creation for plain instructors unless authoring is explicitly supported.
- Hide course approval actions for plain instructors.
- Hide group creation/editing unless `canCoordinateGroups`.
- Hide enrollment and removal unless `canEnrollStudents`.
- Hide session generation unless `canCoordinateGroups`.
- Keep session detail, materials, activities, insights, and meeting tools for assigned sessions.

Acceptance criteria:

- Plain instructor cannot accidentally mutate setup/enrollment structures.
- Coordinator users retain current operational workflows.
- Disabled buttons are removed where the action is not part of the role.

### 5. Improve Attendance Workflow

Tasks:

- Default attendance page to unmarked assigned sessions.
- Add quick filters: Today, This Week, Unmarked, Recently Saved.
- Add clear saved/unsaved state and last saved time if backend provides it.
- Keep bulk actions: mark visible present, mark visible absent, mark unmarked present.
- Consider a compact mobile-first roster mode for class-time use.

Acceptance criteria:

- Instructor can mark a class in under one minute for a normal roster.
- The page never shows sessions outside assigned scope.
- Empty states point to schedule only when the user can actually manage schedule.

### 6. Improve Homework Review Workflow

Tasks:

- Add a queue-first view showing all assigned submissions needing review.
- Keep session/homework scoped review as secondary context.
- Add filters: Needs review, Late, Missing, Needs revision, Approved.
- Support next/previous submission behavior for fast review.
- Preserve comment-required rules for rejection/revision.

Acceptance criteria:

- Instructor can start from a queue without selecting course -> group -> session manually.
- Review actions are available only inside assigned scope.
- Long submissions and attachments remain readable on mobile.

### 7. Improve Session Detail Workflow

Tasks:

- Make session detail the center of instructor work: overview, attendance, homework, activities, meeting, materials, insights.
- Keep existing tabs but prioritize class-time actions.
- Show session readiness: meeting link, material count, activities, attendance status, homework queue.
- Add direct route from dashboard cards to selected session tabs.

Acceptance criteria:

- One session page can answer "what do I need to do for this class?"
- Activities/materials/meeting actions are permissioned by assigned scope.

### 8. Reduce Instructor Settings

Tasks:

- For plain instructors, show only personal preferences by default.
- Optionally include read-only workspace identity.
- Hide profile, branding, policies, platform, features, access, and activity tabs unless matching permissions exist.

Acceptance criteria:

- Instructor settings are short and account-focused.
- No read-only admin tabs create noise.

### 9. Adjust Certificates For Instructor Role

Tasks:

- Hide branding and course-rule tabs from plain instructors.
- Show registry only for assigned courses if certificates are relevant.
- Allow approval only when course settings say `approvalMode: 'instructor'` and the instructor is assigned.
- Hide revoke/regenerate/admin actions.

Acceptance criteria:

- Instructor sees only certificate actions tied to assigned learners.
- Certificate admin remains unchanged for tenant admins.

### 10. Localization Updates

Add translation keys for:

- Instructor home.
- Teaching queue.
- Assigned courses/groups.
- No assigned sessions.
- No assigned groups.
- Permission-limited empty states.
- Instructor-specific route labels.

Acceptance criteria:

- English, Russian, and Kyrgyz have complete keys.
- Long labels fit in desktop and mobile navigation.

## API Contract Changes Needed In Frontend

Add or update wrappers in `src/services/api.ts`:

- `getInstructorDashboard(tenantId)`
- Optional scoped endpoints if backend does not scope automatically:
  - `listInstructorCourses(tenantId)`
  - `listInstructorGroups(tenantId)`
  - `listInstructorSessions(tenantId, params)`
  - `listInstructorReviewQueue(tenantId, params)`

Recommended query parameters for queue endpoints:

- `from`
- `to`
- `status`
- `courseId`
- `groupId`
- `sessionId`
- `limit`
- `cursor` or `page`

Frontend should prefer backend-scoped endpoints over fetching broad tenant data and filtering client-side.

## Data Model Additions

Consider adding these frontend domain types in `src/types/domain.ts`:

```ts
export type InstructorDashboard = {
  generatedAt: string;
  today: {
    sessions: InstructorSessionSummary[];
    nextSession?: InstructorSessionSummary | null;
  };
  queues: {
    unmarkedAttendance: number;
    homeworkNeedsReview: number;
    activityNeedsReview: number;
    missingHomework: number;
    upcomingWithoutMaterials: number;
  };
  attentionStudents: InstructorAttentionStudent[];
  assignedCourses: InstructorCourseSummary[];
  assignedGroups: InstructorGroupSummary[];
};

export type InstructorSessionSummary = {
  sessionId: number;
  title: string;
  courseId: number;
  courseTitle: string;
  groupId: number;
  groupName: string;
  startsAt?: string | null;
  endsAt?: string | null;
  status?: string | null;
  location?: string | null;
  meetingProvider?: string | null;
  joinUrl?: string | null;
  hostUrl?: string | null;
  attendanceMarked?: boolean;
  homeworkNeedsReview?: number;
  activityNeedsReview?: number;
  materialsCount?: number;
  activitiesCount?: number;
};

export type InstructorAttentionStudent = {
  studentId: number;
  fullName: string;
  groupId: number;
  groupName: string;
  severity?: 'high' | 'medium' | 'low';
  reasons?: Array<{ code?: string; label: string; route?: string }>;
};
```

## Suggested Implementation Phases

### Phase 1: Security And Scope

- Add backend permission/capability fields.
- Add assigned-scope backend guards.
- Scope instructor read endpoints.
- Restrict instructor write endpoints.
- Add frontend permission helpers and tests.
- Hide unsafe frontend actions.

Exit criteria:

- Instructors cannot access or mutate unassigned/admin objects through UI or API.

### Phase 2: Instructor Home And Navigation

- Add instructor-specific nav.
- Build instructor dashboard endpoint.
- Build instructor home page.
- Add deep links into sessions, attendance, homework, and groups.

Exit criteria:

- Instructor landing page is focused on today, next class, and review queues.

### Phase 3: Teaching Workflows

- Improve attendance queue.
- Improve homework review queue.
- Improve session detail as the teaching workspace.
- Add mobile QA pass for class-time workflows.

Exit criteria:

- Instructor can run daily class workflows with minimal route switching.

### Phase 4: Role Cleanup

- Reduce instructor settings.
- Adjust certificate experience.
- Keep assistant/coordinator differences in the separate assistant operational-support plan.
- Update docs, changelog, localization, and visual QA checklist.

Exit criteria:

- Each role has a distinct, minimal workspace.

## Testing Plan

Backend tests:

- Instructor cannot list unassigned courses/groups/sessions.
- Instructor cannot access unassigned session detail by ID.
- Instructor can mark attendance for assigned session.
- Instructor cannot enroll or remove students without permission.
- Instructor cannot create groups without coordinator permission.
- Instructor cannot update tenant settings.
- Instructor can review homework for assigned session.
- Instructor cannot review homework for unassigned session.
- Certificate approval obeys assigned scope and `approvalMode`.

Frontend tests:

- Navigation for instructor, coordinator, company admin, owner, student.
- Route denial for hidden instructor admin routes.
- Instructor dashboard empty state.
- Instructor dashboard with today sessions and queues.
- Action visibility in courses, groups, sessions, attendance, homework, certificates, settings.
- Permission override cases.

Visual QA:

- Desktop: 1440 x 900 and 1280 x 800.
- Tablet: 768 x 1024.
- Mobile: 390 x 844 and 360 x 740.
- Light and dark themes.
- English, Russian, and Kyrgyz.
- Long course, group, student, and instructor names.
- Empty assigned scope.
- Many sessions and many submissions.

## UX Acceptance Criteria

- Instructor home answers "what do I need to do now?" without opening multiple pages.
- Instructor navigation does not include tenant-admin concepts unless permissioned.
- Teaching actions are reachable within two clicks from home.
- Attendance, homework, activities, materials, and meeting actions are scoped to assigned sessions.
- Empty states explain whether data is missing because nothing is assigned, nothing is scheduled, or a feature is disabled.
- Mobile screens support class-time use without clipped buttons or hidden save actions.

## Open Product Decisions

- Can instructors create courses, or only teach assigned approved courses?
- Can instructors create groups, or should coordinators/admins own groups?
- Can instructors enroll/remove students, or only view rosters?
- Should instructors manage live meeting host links, or only see join/start links?
- Should instructor certificate approval be course-level configurable or tenant-level configurable?
- Should "My Groups" include student contact details, or only learning status?

## Related Frontend Files

- `src/features/tenant/tenantRoles.ts`
- `src/components/appNavigation.ts`
- `src/app/App.tsx`
- `src/features/dashboard/OverviewPage.tsx`
- `src/features/courses/CoursesPage.tsx`
- `src/features/groups/GroupsPage.tsx`
- `src/features/sessions/SessionsPage.tsx`
- `src/features/attendance/AttendancePage.tsx`
- `src/features/homework/HomeworkPage.tsx`
- `src/features/certificates/CertificatesPage.tsx`
- `src/features/settings/SettingsPage.tsx`
- `src/services/api.ts`
- `src/types/domain.ts`
- `src/i18n/locales/en/common.json`
- `src/i18n/locales/ru/common.json`
- `src/i18n/locales/ky/common.json`

## Definition Of Done

- Backend enforces assigned scope and role capabilities.
- Frontend renders instructor-specific navigation and home.
- Instructor cannot access admin/coordinator actions through direct routes.
- Instructor daily workflows work with assigned data only.
- Tests cover permission and role edge cases.
- Visual QA passes for desktop, tablet, mobile, light/dark, and supported locales.
- Changelog documents role and workflow changes.
