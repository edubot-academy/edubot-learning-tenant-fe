# Changelog

All notable changes to EduBot Learning Tenant FE are documented in this file.

This project follows [Semantic Versioning](https://semver.org/) and uses the
[Keep a Changelog](https://keepachangelog.com/) structure.

## Versioning Rules

- Versions use `MAJOR.MINOR.PATCH`, for example `1.4.2`.
- `MAJOR` changes are for incompatible API, routing, data-contract, permission, authentication, or deployment changes.
- `MINOR` changes are for backward-compatible features, new workflows, new pages, new tenant capabilities, or meaningful UX expansions.
- `PATCH` changes are for backward-compatible bug fixes, security hardening, dependency updates, copy fixes, styling fixes, and small internal improvements.
- Until `1.0.0`, the app is considered pre-stable. Breaking changes should still be called out clearly under `Changed`, `Removed`, or `Migration Notes`.
- Every release entry should include a date in `YYYY-MM-DD` format.
- Use these sections when relevant: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`, `Dependencies`, `Tests`, and `Migration Notes`.
- Do not rewrite released entries except to correct factual mistakes. Add new changes under `Unreleased`.
- Release tags should match the package version, for example `v0.1.0`.

## Unreleased

## 1.16.1 - 2026-05-31

### Added

- Added editable AI homework draft mode with teacher instructions, draft review fields, and manual-form transfer before homework creation.
- Added in-app student material previews with download and open-in-new-tab fallback actions.

### Changed

- Redesigned the student materials page with lighter filters, clearer material cards, recent-material badges, lesson context, and modal-based opening.
- Redesigned the student homework/task page to prioritize revision and overdue work, simplify task summaries, make due-date metadata quieter, and use state-aware actions.
- Improved the student homework submission modal with task instructions, guided answer placeholders, grouped attachments, sticky submit controls, and clearer readiness messaging.
- Localized the new student materials, task, submission, and AI homework draft copy in English, Kyrgyz, and Russian.

### Fixed

- Prevented AI homework draft mode from accidentally submitting the manual homework form through implicit form submission.
- Stabilized homework AI draft regression tests under the full concurrent test suite.

### Tests

- Added and updated coverage for AI homework draft mode, AI-mode submit prevention, student material previews, and state-aware student task actions.
- `npm test -- HomeworkPage.test.tsx StudentDashboardPage.test.tsx api.test.ts` passes.
- `npm test` passes with 36 test files and 223 tests.
- `npm run lint` passes.
- `npm run build` passes.
- `git diff --check` passes.

## 1.16.0 - 2026-05-28

### Added

- Added AI-assisted draft workflows for course outlines, homework, session quizzes, session worksheets, activity feedback, and student support messages.
- Added tenant AI capability checks so AI controls only appear when the backend enables the relevant workflow.
- Added API contracts, domain types, and request-error handling for AI draft generation, acceptance, rejection, and backend request IDs.

### Changed

- Kept AI draft actions explicitly draft-only: course, homework, quiz, feedback, worksheet, and support-message drafts require user review before they affect forms or workflows.
- Improved Kyrgyz, Russian, and English AI copy, including clearer Russian `ИИ` terminology and Kyrgyz student/support wording.

### Fixed

- Prevented support-message AI drafts from appearing or generating when the user cannot contact students.
- Kept worksheet and support-message drafts open when clipboard copy fails instead of marking the generation as accepted.
- Cleared session AI draft state when switching or creating sessions so stale drafts do not carry across lesson contexts.

### Tests

- Added coverage for AI draft flows in courses, homework, sessions, support, API clients, and backend error handling.
- `npm test` passes with 36 test files and 222 tests.
- `npm test -- --run src/features/courses/CoursesPage.test.tsx src/features/homework/HomeworkPage.test.tsx src/features/sessions/SessionsPage.test.tsx src/features/support/StudentSupportPage.test.tsx src/services/api.test.ts src/lib/apiErrors.test.ts src/i18n/translationKeys.test.ts` passes.
- `npm run lint` passes.
- `npm run build` passes.
- `git diff --check` passes.

## 1.15.6 - 2026-05-26

### Added

- Added tenant course delivery-context loading so course readiness can reflect backend delivery issues and summary counts.

### Changed

- Refined Kyrgyz and Russian UI copy across course, group, session, support, report, and dashboard flows for clearer product terminology.
- Standardized Kyrgyz terms for статус, фильтр, прогресс, студент, инструктор, онлайн, and translated report wording to Kyrgyz баяндама terminology.

### Fixed

- Fixed online individual group setup so creating the first session requires a valid meeting URL.
- Fixed planned group enrollment controls so newly created planned groups can accept students before activation.
- Fixed course readiness checks to honor backend group, session, and live-meeting delivery issues.

### Tests

- Added regression coverage for online individual group meeting URL validation and updated group/session creation coverage.
- `npm test -- --run src/features/groups/groupForm.test.ts src/features/groups/GroupsPage.test.tsx src/features/sessions/SessionsPage.test.tsx src/features/courses/CoursesPage.test.tsx src/i18n/translationKeys.test.ts` passes.
- `npm test` passes with 36 test files and 213 tests.
- `npm run lint` passes.
- `npm run build` passes.
- `git diff --check` passes.

## 1.15.5 - 2026-05-26

### Fixed

- Localized tenant activity action keys from the backend, including CRM link updates, member invitations, and member role changes, so audit feeds no longer expose raw enum keys.
- Split activity target labels from navigation labels so audit targets render as singular human-readable labels with IDs.
- Humanized unmapped backend enum fallbacks before display to keep future unknown values readable.

### Tests

- Added enum label regression coverage for backend activity keys, singular audit targets, and humanized fallbacks.
- `npm test -- --run src/lib/enumLabels.test.ts src/i18n/translationKeys.test.ts` passes.
- `npm test` passes with 36 test files and 212 tests.
- `npm run lint` passes.
- `npm run build` passes.

## 1.15.4 - 2026-05-25

### Changed

- Replaced tenant broad user search with tenant-scoped exact email or phone member resolution.
- Updated member, group, and session student lookup flows to reuse existing main-app accounts only after tenant-safe resolution.
- Updated member add-existing copy and localized messages for exact lookup behavior.

### Tests

- Added API and page coverage for tenant member resolution in members, groups, and sessions flows.
- `npm test -- src/services/api.test.ts src/features/members/MembersPage.test.tsx src/features/groups/GroupsPage.test.tsx src/features/sessions/SessionsPage.test.tsx` passes.
- `npm run build` passes.
- `git diff --check` passes.

## 1.15.3 - 2026-05-24

### Changed

- Updated tenant course management to honor backend course scope flags.
- Licensed main-app courses now keep operational actions available while hiding master content edit, approval, publish, reject, and delete actions.

### Tests

- Added CoursesPage coverage for licensed tenant courses with operational access but no content-edit permission.
- `npm test -- CoursesPage.test.tsx` passes.
- `npm run build` passes.
- `git diff --check` passes.

## 1.15.2 - 2026-05-24

### Fixed

- Kept staging and API platform hosts tenant-neutral so the app does not lock tenant selection or attempt tenant-domain resolution on those hosts.

### Tests

- Added tenant host-resolution coverage for platform, staging, API, and tenant subdomain hosts.
- Added frontend role-contract coverage for backend assistant permissions: session coordination/enrollment/support are allowed, while attendance/homework teaching defaults stay disabled.
- `npm test -- src/features/tenant/TenantProvider.test.ts src/features/tenant/tenantRoles.test.ts src/components/appNavigation.test.ts` passes.
- `npm test` passes with 35 test files and 208 tests.
- `npm run lint` passes.
- `git diff --check` passes.
- `npm run build` passes.

## 1.15.1 - 2026-05-24

### Fixed

- Fixed instructor-capable users with stale student role metadata so the app shell no longer enters learner mode or calls student-only notification endpoints.

### Tests

- Added direct AppLayout regression coverage for stale `student` role data with instructor permissions.
- `npm run lint` passes.
- `npm test` passes with 34 test files and 205 tests.
- `npm run build` passes.

## 1.15.0 - 2026-05-24

### Added

- Added course-scoped student detail data so course pages can show fallback sessions, tasks, resources, recordings, and progress even when the detail endpoint is sparse.
- Added student help request context selectors for related course and session, with support request history and clearer support form states.
- Added student setup-link actions in group rosters, including copy, open, resend, and setup-link modal flows for newly created or enrolled students.
- Added student notification language and timezone preferences with dirty-state tracking.

### Changed

- Redesigned the student dashboard, progress, materials, help, and settings experiences with denser learning summaries, clearer task states, improved empty states, and responsive styling.
- Updated student task prioritization to use review, submission, and attempt state instead of only the top-level task status.
- Updated student access routing to show a dedicated inactive or pending enrollment state instead of a generic access-denied screen.
- Updated homework submission payloads so text, link URLs, attachment URLs, and uploaded attachment keys remain distinct.
- Updated English, Kyrgyz, and Russian localization for the new student, settings, access, and group onboarding copy.
- Package version updated to `1.15.0`.

### Fixed

- Fixed student progress so all returned progress courses are shown instead of limiting the list to the first eight.
- Fixed optional student endpoint failures so home summary, support options, and support history errors do not block otherwise usable dashboard or help-page content.
- Fixed material filters so they remain visible when the selected material type has no results.
- Fixed student attendance summary counts so late attendance is counted as attended and only absences count as missed.
- Fixed group roster resend controls so resend invite appears only for students with an active setup link.

### Tests

- Added regression coverage for student course detail fallbacks, material filters, progress list size, support request context, optional endpoint failures, homework link submissions, task state priority, and group setup-link resend visibility.
- `npm run lint` passes.
- `npm test` passes with 34 test files and 202 tests.
- `npm run build` passes.

## 1.14.0 - 2026-05-23

### Added

- Added a role-aware certificate approval inbox for instructors with assigned-course scoping and pending approval defaults.
- Added certificate regression coverage for owner/admin paginated rosters, instructor approval scoping, and certificate issue/approval display-name payloads.

### Changed

- Redesigned certificate branding, course rules, and registry workspaces with clearer admin actions, course context, eligibility summaries, certificate status filters, and empty states.
- Redesigned the owner/company admin overview into a denser operations dashboard with setup progress, priority actions, certificate workload, latest courses, upcoming lessons, and recent activity.
- Updated overview and certificate localization for English, Kyrgyz, and Russian.
- Package version updated to `1.14.0`.

### Fixed

- Fixed owner/company admin certificate registry roster loading so all roster pages are fetched before local filtering.
- Fixed instructor certificate access so directly owned courses remain visible even when group lookup is unavailable.
- Fixed certificate deep links so `courseId` is preserved while course data is still loading.
- Fixed certificate approval and issue requests so selected student display names are sent to the backend.
- Fixed certificate registry layout spacing and release-readiness test stability.

### Tests

- `npm test` passes with 34 test files and 192 tests.
- `npm run lint` passes.
- `npm run build` passes.
- `git diff --check` passes.

## 1.13.0 - 2026-05-22

### Added

- Added role-aware attendance and homework scoping so assigned instructors work from their assigned sessions while owners and admins retain full course/group visibility.
- Added focused regression coverage for attendance deep links, assigned-only selector filtering, homework session selection, stale URL cleanup, and review score validation.

### Changed

- Redesigned the homework workspace with clearer session assignment cards, icon-first release/edit/delete actions, release confirmation, and a compact all-homework disclosure.
- Refined attendance row alignment, bulk actions, session workflow states, and assigned-session entry points for a cleaner instructor marking flow.
- Updated the instructor groups workspace with quick links to the next session, attendance, homework, and students.

### Fixed

- Fixed owner homework visibility when a selected group has homework on a later session than the default selected session.
- Fixed unavailable deep links for attendance and homework so invalid course, group, session, or homework IDs no longer silently fall back to another record.
- Fixed homework action-card keyboard behavior and dark-theme active/hover styling.
- Fixed the groups “next session” quick action so it opens the exact displayed session.

### Tests

- `npm test -- --run src/features/homework/HomeworkPage.test.tsx src/features/homework/homeworkWorkflow.test.ts src/features/attendance/AttendancePage.test.tsx src/features/groups/GroupsPage.test.tsx src/i18n/translationKeys.test.ts` passes.
- `npm run build` passes.

## 1.12.0 - 2026-05-22

### Added

- Added instructor-capable session scheduling for assigned groups while keeping group creation and enrollment controls scoped to admins, owners, and assistants.
- Added session workflow handoffs for planning, running, and reviewing sessions with role-aware links to meetings, materials, attendance, homework, and insights.
- Added delivery-record impact warnings and explicit confirmation before changing session date, time, or status when attendance or homework records already exist.
- Added frontend support for group-only student removal through the backend group roster removal API.
- Added multi-question quiz activity creation with per-question answer options, correct-answer selection, and accessible labels for each quiz field.

### Changed

- Split shared API transport, auth, tenant, and shell APIs into smaller modules and refined Vite manual chunks so the app shell no longer loads the full feature API barrel.
- Changed instructor Sessions course visibility to derive from assigned ready groups, hiding unpublished courses and courses with no assigned group.
- Updated Sessions and Groups removal copy to clarify that removing a learner from a group keeps course access active.
- Updated the Sessions activity modal with a denser, role-aware quiz builder that supports adding/removing questions and options without ambiguous screen-reader labels.
- Added Kyrgyz translations for the new Sessions workflow and edit-impact copy.

### Fixed

- Fixed the production large chunk warning by isolating React, app i18n, charts, transport, shell APIs, and feature API chunks.
- Fixed session detail loading so unavailable attendance/homework permissions do not block the selected session workspace.
- Fixed stale selected-session detail loading so newly created sessions do not repeatedly trigger insight, homework, meeting, or attendance requests for the previous session.

### Tests

- `npm run lint` passes.
- `npm test` passes with 31 test files and 180 tests.
- `npm run build` passes without the previous Vite large chunk warning.
- Backend touched tests pass with 5 suites and 72 tests.
- Backend `npm run build` passes.

## 1.11.0 - 2026-05-21

### Added

- Added a focused group workspace with overview, students, sessions, and settings tabs, deep-link support, keyboard tab navigation, and next-best-action guidance.
- Added modal-based student enrollment from group workflows with existing-student search, new-student invite-and-enroll, and backend search fallback for individual group creation.
- Added shared group form helpers for defaults, payload shaping, timezone/URL/date/schedule validation, and reuse across Groups and Sessions.
- Added schedule-aware session creation defaults so new sessions prefill from the selected group's saved dates and recurring schedule.
- Added support for creating individual groups with new students from both Groups and Sessions workflows.

### Changed

- Moved group enrollment into a modal and reorganized the group detail page into task-focused workspace tabs.
- Updated group and session creation modals with required-field states, inline validation, clearer disabled states, and offline/live-online conditional fields.
- Made course leads optional during course creation and editing, and removed the no-instructor health filter from course diagnostics.
- Updated removal copy to match the current course-level unenrollment API behavior.
- Package version updated to `1.11.0`.

### Fixed

- Prevented duplicate group create/update submissions from rapid double-clicks or repeated Enter submits.
- Reduced duplicate group detail reloads after group refresh by separating form hydration from group roster/session loading.
- Fixed group workspace tab URL synchronization for direct links such as `?tab=sessions`.
- Fixed checkbox visibility and disabled button contrast across light and dark themes.
- Fixed backend API error handling in group and session operations so stable backend messages surface consistently.

### Tests

- Added regression coverage for group form validation, offline meeting-field omission, duplicate create submission guards, workspace tab deep links and keyboard navigation, session prefill from group schedules, and individual/new-student group creation.
- `npm test -- --run` passes with 31 test files and 169 tests.
- `npm run lint` passes.
- `npm run build` passes with the existing Vite large chunk warning.

### Migration Notes

- Student removal in group/session rosters still uses the existing course-level unenrollment endpoint: `DELETE /enrollments/:courseId/unenroll/:userId`.
- Release with backend support already used by prior versions for individual groups and generated sessions.

## 1.10.0 - 2026-05-21

### Added

- Added a guided course setup experience with readiness states, lifecycle checklist actions, selected-course summary, first-course onboarding, and pending review actions.
- Added dedicated course publish API usage through `PATCH /courses/:courseId/publish`.
- Added existing-member setup-link handling so tenant admins can copy onboarding links when adding platform users who still need account setup.
- Added regression coverage for course readiness, course setup flows, course API payloads, member setup links, and localization keys.

### Changed

- Moved course health filters into a secondary admin diagnostics disclosure so setup actions stay primary.
- Split course page UI into focused course components and modal components for maintainability.
- Updated course creation UX with delivery-type guidance, description guidance, no-instructor messaging, and instructor self-assignment behavior when instructors are allowed to create courses.
- Updated member invitation copy so setup-link states are role-neutral instead of student-only.
- Package version updated to `1.10.0`.

### Fixed

- Fixed mobile course catalog layout so catalog cards scroll horizontally and show a visible next-card affordance.
- Fixed mobile overflow around course operations, course tables, modal layering, and the language switcher dropdown.
- Fixed approved course publishing flow so the frontend uses the backend publish contract instead of a generic course update payload.

### Tests

- `npm test -- --run` passes with 30 test files and 153 tests.
- `npm run build` passes with the existing Vite large chunk warning.

### Migration Notes

- Release this frontend with backend support for `PATCH /courses/:courseId/publish`.
- Owner and company admin approval continues to rely on backend auto-publish behavior.

## 1.9.3 - 2026-05-21

### Changed

- Package version updated to `1.9.3`.

### Fixed

- Reduced session creation API fan-out by inserting the created session into local state instead of refetching the full group session and student roster immediately after create.

### Tests

- Added regression coverage to verify session creation does not repeat group session or student roster fetches.
- `npm test` passes with 27 test files and 138 tests.
- `npm run lint` passes.
- `npm run build` passes with the existing Vite large chunk warning.

## 1.9.2 - 2026-05-21

### Changed

- Hardened tenant API error localization to support nested backend error payloads, `errorCode`, `messageKey`, `labelKey`, main-app `errors.*` keys, and stable category fallbacks.
- Added `apiMessages.*` locale resources for backend success message keys so password reset responses render frontend-owned localized copy.
- Package version updated to `1.9.2`.

### Fixed

- Prevented backend prose from leaking into login, password reset, course, and certificate error states when stable backend keys or codes are available.
- Preserved CSRF retry compatibility while keeping backend message parsing out of user-facing error rendering.

### Tests

- Added API error helper coverage for nested error codes, alternate `errorCode`, translation keys, label keys, mirrored API message keys, category fallback, and no-backend-prose fallback.
- `npm test` passes with 26 test files and 137 tests.
- `npm run lint` passes.
- `npm run build` passes with the existing Vite large chunk warning.

## 1.9.1 - 2026-05-15

### Changed

- Centralized backend API error formatting so auth setup and password reset flows can show localized messages from backend error codes.
- Updated locale initialization to use the shared locale resolver.
- Package version updated to `1.9.1`.

### Fixed

- Fixed CSRF retry detection so backend responses using `CSRF_TOKEN_INVALID` still trigger the one-time profile refresh and request retry.
- Fixed modal localization test setup so close-button assertions run against the expected Kyrgyz language state.

### Tests

- Added API error helper coverage for backend code extraction, translated known errors, and unknown-code fallback messages.
- `npm test` passes with 26 test files and 131 tests.
- `npm run lint` passes.
- `npm run build` passes with the existing Vite large chunk warning.

## 1.9.0 - 2026-05-15

### Added

- Added individual course group creation with tenant-scoped student selection, one-to-one delivery badges, first-session creation support, and validation for required schedule setup.
- Added delivery-mode indicators across groups, sessions, courses, and attendance views.
- Added course deletion for unpublished courses where the tenant role is allowed to remove them.
- Added frontend API helpers and domain typing for individual course groups, group delivery mode, session group delivery mode, and course deletion.
- Added regression coverage for individual group creation, tenant-scoped student search, permission gating, API payload shape, and attendance one-to-one session copy.

### Changed

- Reduced course creation follow-up fan-out by selecting the newly created course locally and avoiding eager course detail calls.
- Changed Groups course selection to show only eligible approved, published offline/live courses.
- Changed course health filters so summary-dependent filters are disabled when the backend does not provide catalog health summaries instead of showing misleading counts.
- Improved async load state updates to avoid no-op state churn.
- Package version updated to `1.9.0`.

### Fixed

- Fixed course creation selection so the newly created course remains selected instead of falling back to the previous course.
- Fixed repeated render/API churn around selected course detail loading.
- Fixed individual student search in the create-group modal so typing searches tenant students without calling forbidden global `/users` endpoints.
- Fixed Groups page loading so member-roster permission failures do not block course/group access.
- Fixed individual group creation permission gating so users without enrollment permission do not see the individual delivery mode.
- Fixed course health summary behavior for newly created courses and later detail reloads.

### Tests

- `npm run lint` passes.
- `npm test` passes.
- `npm run build` passes with the existing Vite large chunk warning.

### Migration Notes

- Release this frontend with backend support for `POST /course-groups/individual`, `deliveryMode` on course groups, `groupDeliveryMode` on sessions, catalog health summary fields on course list responses when course health filters should be enabled, and `DELETE /courses/:courseId` for unpublished course deletion.

## 1.8.0 - 2026-05-15

### Added

- Added a multi-page learner portal with Today, To do, Courses, course detail, session detail, Materials, Progress, and Help routes.
- Added student access pre-checks, student-specific navigation, and learner route titles.
- Added learner notifications in the app shell, unread badges, mark-read behavior, notification list paging, and learner notification preferences in Settings.
- Added typed student DTOs and frontend API helpers for student home, access, courses, sessions, tasks, materials, recordings, progress, certificates, reminders, notifications, and support requests.
- Added task submission UX for text, link, file, and quiz tasks, including submission requirements, file validation, upload state, submission history, review comments, and scores.
- Added materials and recordings library filters with backend pagination and load-more behavior.
- Added Progress certificate filters and paged certificate loading.
- Added localized learner portal copy in English, Russian, and Kyrgyz.
- Added regression coverage for student navigation, task filters, quiz validation, submission history, submission requirements, file uploads, material filters, feature flags, and shell notification behavior.

### Changed

- Redirect student home access from `/student` to `/student/today`.
- Updated student submissions to use student-scoped homework endpoints and activity submission payloads that preserve uploaded attachment keys.
- Updated learner Settings so student notification settings reload when the active tenant changes.
- Package version updated to `1.8.0`.

### Fixed

- Fixed material filtering so the frontend no longer sends an invalid `type=resource` query to `/student/resources`.
- Fixed homework link-only submissions so links are submitted instead of being dropped.
- Fixed empty non-quiz task submissions by requiring at least one allowed submission value before enabling Submit.
- Fixed frontend tests for the new paged student materials API helpers.

### Tests

- `npm test` passes with 24 test files and 115 tests.
- `npm run build` passes with the existing Vite large chunk warning.

### Migration Notes

- Release this frontend with the matching backend student portal endpoints, including `/student/access`, `/student/home`, student course/session detail, paged materials/recordings/certificates, student notifications/reminders, student support requests, student-scoped homework submission endpoints, and activity submission attachment handling.

## 1.7.0 - 2026-05-14

### Added

- Added assistant-specific overview behavior for operational support users, including support, groups, and sessions actions instead of instructor teaching queues.
- Added a Student Support workspace with backend support queue integration, support note create/edit workflows, guardian record management, and support queue pagination.
- Added frontend service bindings and domain types for assistant dashboard, assistant support queue, student support notes, and student guardian records.
- Added regression coverage for assistant overview role resolution, support queue pagination, backend-success/fallback loading, support notes, guardian records, and support section filters.

### Changed

- Updated assistant support to rely on the backend paginated support queue by default and only use legacy course/group/roster fan-out as a failure fallback.
- Changed Student Support filters so All, Students, and Groups show whole relevant sections instead of rendering hidden-section empty states.
- Narrowed guardian create API typing to match the backend create DTO; consent and contact permission fields now remain response-only in the frontend contract.
- Package version updated to `1.7.0`.

### Fixed

- Fixed tenant dashboard role resolution so `/companies/:tenantId/dashboard` responses with `workspace.role: "assistant"` render the assistant overview instead of falling back to instructor overview.
- Fixed assistant support pagination so tenants with more than one support page can navigate beyond the first backend page.
- Fixed the support page scale issue where successful backend support loading still triggered full course, group, and roster loading.

### Tests

- `npm test -- --run` passes with 24 test files and 107 tests.
- `npm run build` passes with the existing Vite large chunk warning.

## 1.6.0 - 2026-05-14

### Added

- Added instructor-specific navigation focused on overview, sessions, attendance, homework, assigned groups, certificates, and personal settings.
- Added instructor dashboard integration for today's sessions, next session, assigned queues, assigned courses, and assigned groups.
- Added assigned homework and activity review queue API wrappers and frontend domain types.
- Added an assistant operational-support planning document to keep assistant behavior separate from instructor teaching workflows.

### Changed

- Split instructor teaching permissions from coordinator/admin operations so plain instructors no longer inherit course, group, session setup, enrollment, or tenant administration actions.
- Restricted course creation, course editing, course approval, group setup, session scheduling, session generation, enrollment, and student removal UI behind explicit management capabilities.
- Updated certificates, settings, overview, sessions, attendance, homework, courses, and groups pages to render actions from granular role capabilities.
- Package version updated to `1.6.0`.

### Fixed

- Fixed plain assistant navigation so assistant no longer inherits instructor teaching surfaces by default.
- Fixed instructor overview noise by removing workspace readiness/setup content from non-admin teaching views.

### Tests

- Added and updated role, route, and navigation coverage for instructor, assistant, tenant admin, and explicit permission override behavior.
- `npx vitest run src/components/appNavigation.test.ts src/features/tenant/tenantRoles.test.ts src/app/routePermissions.test.ts --environment node` passes with 30 tests.
- `npm test` passes with 22 test files and 93 tests.
- `npm run lint` passes.
- `npm run build` passes with the existing Vite large chunk warning.

### Dependencies

- Pinned `jsdom` to `26.1.0` so the Vitest jsdom environment remains compatible with the current Node 20.17 local release runtime.

### Migration Notes

- Release this frontend with the matching backend instructor-scope changes, including granular tenant permissions, assigned-scope enforcement, `GET /companies/:tenantId/instructor-dashboard`, `GET /homework/review-queue`, and `GET /group-sessions/activity-review-queue`.

## 1.5.0 - 2026-05-14

### Added

- Added owner/admin operations hub for course, group, session, attendance, homework, and certificate workflows.
- Added reports page with backend-backed summary and time-series chart panels.
- Added overview insight charts for enrollment, attendance, workload, and setup progress.
- Added tenant route permission helpers, course health helpers, and admin setup checklist coverage.
- Added Recharts for release-ready reporting visualizations.

### Changed

- Reworked owner/admin overview around readiness, operational blockers, reports, and setup actions.
- Updated tenant navigation to separate admin, reporting, and operational surfaces by permission.
- Updated member, settings, course, certificate, and session surfaces for owner/admin permissions and feature flags.
- Localized owner/admin operational copy across English, Russian, and Kyrgyz.
- Package version updated to `1.5.0`.

### Fixed

- Fixed feature flag handling so dotted flags and backend simple aliases both work.
- Fixed report-only users seeing or opening tenant settings.
- Fixed overview chart loading/error states so missing trend data is not shown as an empty-state too early.

### Tests

- `npm run lint` passes.
- `npm test -- --run` passes with 22 test files and 90 tests.
- `npm run build` passes with the existing Vite main chunk-size warning.

## 1.4.2 - 2026-05-13

### Fixed

- Added CSRF token headers for unsafe API requests and a one-time profile refresh retry when the backend rejects an expired or missing CSRF token.
- Package version updated to `1.4.2`.

### Tests

- Added API client coverage for CSRF token headers, safe-method exclusions, one-time retry behavior, and retry-loop prevention.
- `npm run lint` passes.
- `npm test` passes with 18 test files and 65 tests.
- `npm run build` passes.

## 1.4.1 - 2026-05-13

### Changed

- Refined student dashboard visual hierarchy so the primary learner action is more dominant and secondary cards/stats are quieter.
- Tightened tablet/small-laptop layout density and moved secondary workflow controls toward neutral active/hover states.
- Package version updated to `1.4.1`.

### Tests

- Added course roster filter helper coverage for reset-to-full-roster behavior.
- Added student dashboard helper and component coverage for deterministic task priority, partial endpoint fallback behavior, and stale tenant-switch load guards.
- `npm run lint` passes.
- `npm test` passes with 18 test files and 61 tests.
- `npm run build` passes.

## 1.4.0 - 2026-05-13

### Added

- Course workflow checklist with actionable readiness steps for approval, publishing, delivery type, groups, and sessions.
- Today operations strip on the overview dashboard with today’s sessions, unmarked attendance, homework reviews, and next live link status.
- Mobile more-menu interaction tests for open, Escape close, outside-click close, and route-close behavior.
- Shared enum label helper for localized backend status, role, course type, activity type, and activity action labels.

### Changed

- Student dashboard now orders open tasks deterministically by overdue state and due date before closed tasks.
- Empty states now include clearer next actions for inviting members, enrolling students, and scheduling sessions.
- Unknown backend enum values now render through a localized explicit unknown-value fallback instead of prettified English.
- Package version updated to `1.4.0`.

### Fixed

- Fixed overview crash when backend dashboard payloads omit top-level `permissions` by falling back to workspace permissions and safe defaults.
- Added confirmation before rejecting pending courses.
- Associated course create/edit form validation errors with their fields through `aria-describedby`.

### Tests

- `npm run lint` passes.
- `npm test` passes with 15 test files and 54 tests.
- `npm run build` passes.

## 1.3.0 - 2026-05-13

### Added

- Tenant workspace contract support through `/companies/workspaces` and `/companies/workspaces/switch`, including workspace roles, permissions, availability, branding, host, billing, and CRM link metadata.
- Vercel SPA rewrite configuration so direct visits to tenant frontend routes load the React app instead of Vercel 404 pages.
- Shared async load-state helper for consistent loading, retry, and partial-failure state handling.
- Inline retryable error states for course workspace loading and student dashboard partial data failures.
- Access-denied states for unauthorized tenant routes instead of silent redirects.

### Changed

- Updated tenant access resolution to prefer workspace membership data and to honor both scalar `role` and multi-role `roles` arrays.
- Blocked tenant entry when workspace availability is disabled or `canEnterWorkspace` is false.
- Switched tenant selection to the workspace switch contract and disabled unavailable tenant options in the selector.
- Prioritized mobile navigation by tenant role so instructors and assistants see daily teaching tools first.
- Promoted clearer primary next actions on overview and student dashboard screens.
- Reduced non-critical status badge noise in dense course and student lists.
- Split Vite output into React, i18n, icons, and vendor chunks to keep the initial app bundle under the warning threshold.
- Package version updated to `1.3.0`.

### Fixed

- Fixed stale course roster results after clearing student search/progress filters.
- Fixed student dashboard tenant-switch races by ignoring stale in-flight responses.
- Fixed student dashboard loading so one failed endpoint no longer blocks other learner data from rendering.
- Fixed course operations loading so course-detail and group-detail requests cannot clear each other’s loading/error state.
- Fixed tenant owner recognition for main app admin accounts whose tenant membership is returned through the workspace `roles` array.

### Tests

- `npm run lint` passes.
- `npm test` passes with 14 test files and 52 tests.
- `npm run build` passes without the previous Vite large initial chunk warning.

## 1.2.0 - 2026-05-13

### Added

- Shared language menu component used by both authenticated app shell and unauthenticated login screens.
- Login-page language switching before sign-in with compact `KG`, `RU`, and `US` options.

### Changed

- Reused the same icon-only language menu across the authenticated sidebar and login page.
- Repositioned the login language menu as a top-right page utility and tightened the branded gateway layout.
- Updated login workspace wording in English, Russian, and Kyrgyz to better match the tenant workspace experience.
- Linked the login page EduBot Learning attribution to the public learning platform.
- Updated locale resolution to use a resolved tenant domain locale before authentication when no user language override exists.
- Updated unauthenticated document titles and favicon handling to use the resolved tenant domain when available.
- Package version updated to `1.2.0`.

### Fixed

- Fixed tenant app layout shift during route/tab switches by keeping the app shell mounted, avoiding route-error-boundary remounts, and showing lazy-page loading inside the main content area.

### Tests

- `npm run lint` passes.
- `npm test` passes with 14 test files and 49 tests.
- `npm run build` passes with the existing Vite chunk-size warning.

## 1.1.0 - 2026-05-13

### Added

- Tenant frontend localization for Kyrgyz, Russian, and English with Kyrgyz as the default fallback language.
- i18n runtime setup with semantic locale files, language resolution, document language sync, and translation key parity tests.
- Compact sidebar language menu with `KG`, `RU`, and `US` options.
- `Accept-Language` header support in tenant frontend API requests.
- Localized date/readable formatting helpers using the active runtime language.
- Localization implementation plan covering tenant frontend, shared backend, main frontend, and cross-app language contracts.
- API client coverage for tenant-header opt-out requests that still send the active language.
- Additional release documentation for the main-platform and backend localization follow-up plan.
- Settings form hydration helpers for tenant profile, branding, and policy state.

### Changed

- Refined the app-shell brand area by moving language selection into an icon-only globe menu beside the tenant name.
- Tightened the language menu dropdown width and centered compact language labels for a cleaner sidebar layout.
- Updated app navigation metadata to use translation keys while preserving role-aware and feature-aware navigation visibility.
- Improved tenant settings feature visibility display so platform-managed feature rows use stable user-facing labels while keeping technical keys secondary.
- Updated shared workflow and validation helpers so their messages are sourced consistently from the runtime copy system.
- Replaced broad hardcoded tenant UI copy across auth, navigation, overview, courses, groups, sessions, attendance, homework, certificates, members, settings, and student dashboard flows.
- Reworked tenant settings locale editing to use supported language options instead of free-text locale entry.
- Updated tenant readiness, feature visibility, workflow blocker, validation, status, empty-state, and toast copy to use locale keys.
- Polished Kyrgyz product copy for tenant-facing localization and avoided user-facing technical English where practical.
- Updated tenant neutral host defaults and query-host construction from `learning.edubot.it.com` to `lms.edubot.it.com`.
- Hardened tenant selection in `TenantProvider` by normalizing tenant IDs before matching stored, resolved, or query-selected tenants.
- Localized `TenantProvider` domain resolution, tenant access, and tenant load fallback messages.
- Reworked Settings tabs so the Activity tab is only shown to tenant admins and redirects back to Profile if access changes.
- Reworked Settings platform-managed, access, profile, branding, policies, features, and activity sections to use localized labels, notes, statuses, buttons, validation, and empty/loading copy.
- Reworked Settings tenant locale editing to normalize existing locale values and save a supported locale, defaulting to `ky`.
- Reworked Settings activity rows to use localized action/target labels and locale-aware timestamps.
- Reworked Settings branding preview and policy read-only summaries to use localized fallbacks and status labels.
- Package version updated to `1.1.0`.

### Fixed

- Fixed runtime language mismatch between visible UI, API `Accept-Language`, and date formatting by centralizing the current locale.
- Fixed unknown platform-managed feature flag labels so raw feature keys are not used as primary visible labels.
- Fixed remaining raw date formatting in tenant activity so activity timestamps follow the same locale-aware formatter as the rest of the app.
- Fixed translated fallback labels for unset values in shared display helpers.
- Fixed tenant loading state cleanup when a user signs out while tenant access is still loading.
- Fixed tenant access load errors to use localized fallback copy instead of raw backend error messages.
- Fixed Settings cancel actions so profile, branding, and policy edits discard unsaved form changes and clear validation errors.
- Fixed Settings activity access so non-admin users cannot keep or load the Activity tab after permission state changes.
- Fixed Settings form validation messages for tenant profile, branding, and policy saves to render localized field errors and toasts.
- Fixed Settings platform-managed unknown feature rows so they show a stable platform-managed label while keeping the raw feature key as secondary detail.

### Dependencies

- Added `i18next` and `react-i18next`.

### Tests

- Added locale resolution, translation key parity, and API language header coverage.
- `npm run lint` passes.
- `npm test` passes with 14 test files and 49 tests.
- `npm run build` passes with the existing Vite chunk-size warning.

### Migration Notes

- Backend localization work is not included in this release. The tenant frontend sends `Accept-Language`, but the shared backend still needs CORS/header support, locale validation, backend message localization, and generated-content locale handling.

## 1.0.0 - 2026-05-13

### Added

- UI/UX roadmap documentation for the completed 0.1 through 1.0 improvement plan.
- Design-system documentation and a visual QA checklist for future page-level changes.
- Shared workflow helpers for course readiness, blocker copy, workflow paths, and URL parameter preservation.
- Shared tested helpers for attendance counts, attendance change detection, attendance save blocking, and attendance roster filtering.
- Shared tested helpers for homework review filtering, homework form validation, session readiness, and review blocking.
- Shared tested helpers for certificate tabs, eligibility messaging, student/certificate filtering, certificate settings validation, and decision blocking.
- Shared tested helpers for auth password validation, tenant member display/role duplication, tenant feature defaults, and app navigation visibility.
- Route-level lazy loading for auth, dashboard, course, group, session, attendance, homework, certificate, member, settings, and student pages.
- Route-level recovery UI for failed workspace views.
- Mobile bottom tab bar with More menu, Escape/outside-click behavior, and mobile Sign out access.
- Focus-trapped modals with Escape handling, backdrop close, focus restoration, hidden-control filtering, and regression tests.
- Keyboard-tested workspace tabs with roving tab index, arrow navigation, Home, and End behavior.
- Reduced-motion handling for transitions and loading animation.

### Changed

- Stabilized the shared visual language across buttons, panels, cards, tables, status badges, stat tiles, modals, tabs, filters, empty states, loading states, dark mode, and responsive layouts.
- Reworked the app shell and sidebar for clearer tenant branding, less duplicate tenant/role information, aligned Sign out controls, and feature/role-safe navigation.
- Reworked the student dashboard around a stronger continue-learning priority, responsive task cards, clearer material/recording grouping, learner-facing status labels, and better certificate actions.
- Reworked the staff overview with clearer operational hierarchy, priority items, role-aware stats, feature-disabled explanations, existing queues, and responsive layout using current tenant data.
- Improved Courses, Groups, and Sessions workflow consistency with shared context panels, readiness copy, selected ID preservation, deep links, session setup flow, group summaries, and generated-session previews.
- Improved Attendance and Homework ergonomics with clearer workflow hierarchy, mobile rosters/review layouts, save states, bulk actions, validation copy, and destructive confirmations where supported.
- Refined Certificates with stronger tab structure, branding/course preview context, exact preview behavior, eligibility and issue flows, searchable student picker, registry pagination, mobile actions, and decision modals.
- Improved Settings, Members, and Auth flows with better grouping, validation, save/disabled states, feature visibility presentation, tenant branding, member cards, invite/add-existing messaging, duplicate-role prevention, and actionable auth/setup errors.
- Replaced broad initial route imports with dynamic route chunks, reducing the initial JavaScript bundle and removing the Vite oversized initial chunk warning.
- Updated package version to `1.0.0`.

### Fixed

- Fixed mobile tab bar flicker and disappearing behavior caused by overflowing page content and unstable navigation layout.
- Fixed Sessions repeated API calls by separating data-fetch effects from URL-driven selection effects.
- Fixed Attendance and Homework repeated API calls by applying the same fetch/selection separation pattern.
- Fixed Groups deep links so requested group IDs are preserved after group data loads.
- Fixed mobile overflows in overview/course session panels and table-heavy workflows.
- Fixed certificate preview overflow and dense registry scanability issues.
- Fixed modal focus cycling so hidden file inputs and inert/hidden content are skipped.
- Fixed member role changes and invite/add-existing flows so duplicate tenant-role assignments are blocked.
- Fixed tenant/setup-token and auth error states so they are visible and actionable.

### Tests

- Added focused Vitest coverage for workflow readiness and URL helpers.
- Added focused Vitest coverage for attendance, homework, certificate, auth password, member access, tenant role, tenant feature, navigation, workspace tab, and modal focus behavior.
- `npm run lint` passes.
- `npm test` passes with 12 test files and 43 tests.
- `npm run build` passes with route chunks and no oversized initial chunk warning.

### Migration Notes

- This release is a frontend production-readiness release. No backend API migration is required.
- Browser spot checks are still recommended for mobile and dark-mode views when deploying to a tenant with real rosters, certificates, and long course/session names.

## 0.3.0 - 2026-05-12

### Added

- Tenant groups workspace with course/group selection, group creation/editing, instructor assignment, schedule blocks, session generation, student search, student creation, enrollment, and quick links into sessions, attendance, and homework.
- Course detail workflow parity for tenant-private courses, including query-param deep links, instructor assignment, edit flow, approval/submission actions, and operational gating for draft/unapproved courses.
- Session workspace expansion with group creation/editing, session scheduling/editing, live meeting management, materials, insights, activities, attendance, homework review, student enrollment, and schedule generation.
- Attendance workspace support for deep-linked course/group/session selection, scheduled/completed session gating, bulk marking, and marked-row-only saves.
- Homework workspace support for deep-linked course/group/session selection, session homework creation/editing/deletion, submission review, missing/late filters, score/comment drafts, and roster workflow.
- Certificate page parity for tenant workflows, including branding, course rules, registry, inline preview, modal preview, manual issue, eligibility warning/override, approval/rejection, revoke, regenerate, and PDF download.
- Tenant settings tabs for profile, branding, policies, access, platform-managed data, features, and activity.
- Role-aware overview backed by the tenant overview API with setup readiness, course/session/homework/certificate metrics, attention items, feature state, and activity.
- Account setup and password reset screens for tenant-created users.
- Student dashboard additions for attendance, tasks, certificates, and tenant course progress signals.

### Changed

- Tenant certificate colors now default from company branding where course-specific branding is not configured.
- Offline and online-live course certificates are treated as manual issue flows in tenant UI.
- Instructor certificate actions now include manual issue when the instructor manages the course or assigned group.
- Course, group, session, attendance, and homework navigation now preserves selected IDs through query parameters without repeated URL rewrites.
- Tenant member loading is avoided for instructor-only pages where admins are the only users who need full member lists.
- Certificate downloads use authenticated Axios only for same-origin API URLs and direct browser links for external or presigned URLs.
- Package version updated to `0.3.0`.

### Fixed

- Reduced page flicker caused by unconditional query-param replacement in groups, attendance, homework, and sessions.
- Fixed instructor 403s from certificate roster/student API usage by relying on tenant-scoped course student access.
- Fixed certificate preview sizing and overflow behavior for inline and modal previews.
- Removed admin-only certificate course-rule controls from instructor-only views.
- Fixed stale course/group/session state when selected resources become unavailable after tenant or course changes.

### Tests

- `npm run lint` passes.
- `npm run build` passes.

## 0.2.0 - 2026-05-12

### Added

- Tenant-domain resolution for white-label tenant workspaces through `/tenant-context/resolve`.
- Neutral-host tenant overrides through `tenant` and `tenantId` query parameters for local and shared environments.
- Environment-based neutral host and tenant query base-domain configuration.
- Tenant provider state for resolved tenants, hostname locking, tenant-resolution loading, and tenant-resolution errors.
- Tenant-locked navigation behavior when a workspace is resolved from a hostname or explicit tenant override.
- Tenant-branded login page using the resolved tenant name and logo before authentication.
- Tenant logo rendering on the login page without the default logo badge background.
- Dynamic document favicon support using the active tenant logo with a workspace icon fallback.
- Instructor-focused overview content with upcoming sessions, assigned courses, homework queue, and feature-aware actions.
- Instructor overview session loading for non-admin staff users.
- Tenant course creation flow for enabled offline, online live, and video course types.
- Course approval, rejection, and instructor submission actions.
- API helpers for tenant course creation and course status updates.
- Regression coverage for tenant role scoping and tenant-header opt-out behavior.

### Changed

- Login and app-shell text now foreground the tenant or organization workspace, with EduBot Learning shown only as platform attribution.
- Browser metadata, PWA manifest text, PWA icon accessibility label, and default loading copy now use neutral “Learning Workspace” wording.
- Document titles now use tenant/workspace names instead of appending EduBot Learning to every page title.
- Sidebar tenant switching is hidden for hostname-locked tenant workspaces.
- Login submit state now waits for tenant resolution and blocks sign-in when the resolved tenant domain is invalid.
- Login brand spacing and logo sizing were adjusted for larger tenant logos.
- Super admin users are kept out of tenant workspace access and directed away from tenant routes.
- Platform-level `superadmin` is no longer treated as tenant staff/admin/certificate access inside tenant routes.
- Tenant activity is shown only to users who can manage tenant members.
- Course empty states now distinguish between users who can create tenant courses and users waiting for assigned courses.
- Package version updated to `0.2.0`.
- Dependency lockfile updated for the `0.2.0` package metadata and installed test/dependency state.

### Fixed

- Tenant-domain resolution requests now skip the active `X-Company-Id` header so stale tenant selections cannot affect hostname lookup.
- Tenant reload logic now preserves resolved hostname tenants when unauthenticated and validates authenticated access against the resolved tenant.
- Tenant resolution failures now clear stale stored tenant IDs and expose a tenant-domain-specific error.
- Course loading clears stale loading state when no tenant is active.

### Files Covered

- `CHANGELOG.md`: added this `0.2.0` release entry.
- `index.html`: neutral workspace metadata and loading copy.
- `package.json`: version bumped to `0.2.0`.
- `package-lock.json`: lockfile metadata updated for the package/dependency state.
- `public/edubot-icon.svg`: default icon accessible label changed to Learning Workspace.
- `public/manifest.webmanifest`: neutral PWA name, short name, and description.
- `src/app/App.tsx`: tenant-aware titles, dynamic favicon, tenant-resolution route guards, and super admin tenant-workspace block.
- `src/components/AppLayout.tsx`: hostname-locked tenant switcher behavior.
- `src/features/auth/LoginPage.tsx`: resolved-tenant branding, copy, tenant logo rendering, and tenant-resolution sign-in handling.
- `src/features/courses/CoursesPage.tsx`: tenant course creation, course type feature filtering, course status actions, and empty-state updates.
- `src/features/dashboard/OverviewPage.tsx`: instructor overview, upcoming sessions, role-aware tenant activity, and expanded data loading.
- `src/features/tenant/TenantProvider.tsx`: hostname/query tenant resolution, tenant lock state, and access validation.
- `src/features/tenant/tenantRoles.ts`: platform and tenant role separation.
- `src/features/tenant/tenantRoles.test.ts`: updated role-scope expectations.
- `src/services/api.ts`: tenant resolver, tenant course/status API helpers, and tenant-header opt-out support.
- `src/services/api.test.ts`: storage tests plus tenant-header opt-out regression coverage.
- `src/styles/app.css`: login tenant-logo sizing and unframed logo styling.

## 0.1.0 - 2026-05-11

First release of the EduBot Learning tenant workspace frontend.

### Added

- React 19, TypeScript, and Vite application shell.
- Browser-router based tenant workspace routes:
  - `/login`
  - `/`
  - `/student`
  - `/courses`
  - `/sessions`
  - `/attendance`
  - `/homework`
  - `/certificates`
  - `/members`
  - `/settings`
- Application layout with sidebar navigation, tenant switcher, signed-in role display, feature-aware navigation, skip link, and protected content outlet.
- Auth provider with login, profile loading, sign-out, expired-auth event handling, and token cleanup.
- Tenant provider with tenant loading, active tenant persistence, tenant switching, tenant load error state, retry behavior, and stale reload protection.
- Theme provider with system, light, and dark preferences stored per browser.
- Document title management per route and active tenant.
- Role and permission helpers for platform, tenant admin, instructor, assistant, and student access.
- Tenant feature flag support for:
  - Video courses
  - Offline courses
  - Online live courses
  - Attendance
  - Homework
  - Certificates
  - AI assistant visibility
- Axios API client with bearer auth, active tenant header, credential support, tenant persistence, auth-expiration handling, and typed endpoint wrappers.
- Shared UI primitives:
  - App layout
  - Page header
  - Modal and form modal
  - Data loading and empty states
  - Count filter row
  - Workspace tabs
  - Stat grid
- Shared formatting helpers for dates, text labels, numbers, and readable fallback output.
- Domain model types for auth users, tenants, members, courses, groups, sessions, attendance, homework, certificates, activities, student dashboard data, live meetings, and activity logs.

### Tenant Overview

- Tenant dashboard with setup progress, tenant-linked course stats, delivery course stats, member counts, homework review counts, and certificate branding status.
- Quick actions for session planning, attendance, homework review, certificate management, members, and settings.
- Recent tenant activity feed.
- Feature-aware overview content based on tenant flags and current user permissions.

### Courses

- Tenant course catalog with search, selected course detail, publication status, course type, instructor display, and enrolled student counts.
- Course operations panel with shortcuts to sessions, attendance, homework, and certificates.
- Course group selection with group metadata, schedule dates, status, roster metrics, session counts, completed student counts, and average progress.
- Group roster view with student search and progress filters.
- Stale request protection and tenant-change reset behavior for course, group, session, homework, and roster data.

### Sessions

- Course, group, and session workflow for planning and operating live/offline learning sessions.
- Course group creation and editing.
- Manual session creation and editing.
- Generated session preview and generation flow.
- Student enrollment flow using user search.
- Session materials upload and update support.
- Live meeting create, update, delete, and fetch support for custom, Zoom, and Google Meet providers.
- Session activity creation, update, deletion, response loading, and review handling.
- Session insight loading for attendance, homework, activity, attention, and positive student signals.
- Stale request protection and tenant-change reset behavior for course, group, session, attendance, homework, meeting, activity, and insight data.

### Attendance

- Course, group, and session selection workflow.
- Group student roster loading.
- Saved session attendance loading.
- Attendance editing for present, late, absent, and excused statuses.
- Bulk mark visible students and mark unmarked students.
- Unsaved change tracking.
- Attendance filtering by student search, status, and unmarked state.
- Bulk attendance save endpoint integration.
- Stale request protection and tenant-change reset behavior for course, group, session, student, and attendance data.

### Homework

- Homework summary and assignment listing by course and group.
- Course, group, and session workflow for assignment management.
- Session homework listing.
- Homework creation, editing, deletion, and refresh behavior.
- Review roster loading with review-state filters.
- Submission review with score and review comment drafts.
- Submission attachment opening support.
- Stale request protection and tenant-change reset behavior for course, group, session, assignment, summary, and review data.

### Certificates

- Tenant certificate branding workspace.
- Course certificate settings workspace.
- Certificate registry workspace.
- Certificate branding fields for brand name, title, issuer, colors, language, orientation, and logos.
- Certificate logo upload.
- Course certificate rule editing, eligibility thresholds, approval settings, and signature upload.
- Certificate search and status filters.
- Certificate issuing, previewing, approval, rejection, revocation, and regeneration flows.
- Permission-aware certificate admin and registry controls.
- Stale request protection and tenant-change reset behavior for branding, course, settings, and registry data.

### Members

- Tenant member list with role counts, stats, search, and role filters.
- Add existing user to tenant through user search.
- Invite new tenant member with optional email sending.
- Invite link result modal and clipboard copy support.
- Resend invitation support.
- Tenant member role replacement.
- Tenant member role removal confirmation.
- Permission-aware member management controls.

### Settings

- Tenant profile view and edit mode.
- Tenant profile fields for name, timezone, locale, website, email, phone, contact info, address, social links, tax ID, and notes.
- Tenant logo upload.
- Access tab with signed-in user and tenant assignment context.
- Appearance settings for system, light, and dark themes.
- Platform-managed read-only tenant status, billing, plan, and domain context.
- Feature flag visibility for known and unknown tenant features.
- Permission-aware tenant profile editing.

### Student Workspace

- Student dashboard route for learner users.
- Student learning overview, homework/task handling, file upload support, activity submission, homework submission, and quiz attempt integration.
- Student-only route guard and staff-to-learner routing behavior.

### Security

- Bearer tokens are written to `sessionStorage` instead of persistent `localStorage`.
- Old local bearer tokens are removed when a new session token is stored.
- Sign-out and auth-expiration clear both session and local token storage.
- Active tenant ID validation rejects invalid or non-positive tenant IDs.
- Tenant load failures now show an explicit retryable error instead of being confused with missing tenant access.
- Platform-scope permission handling treats only `superadmin` as platform-wide; `admin` is evaluated through tenant membership scope.

### Fixed

- Fixed stale tenant, course, group, and session selections surviving tenant switches.
- Fixed older async route requests being able to overwrite newer state after fast navigation or selector changes.
- Fixed tenant reload races after sign-out or account changes.
- Fixed certificate permission checks to use the shared tenant role helpers.

### Dependencies

- Added Vitest, jsdom, and Testing Library packages for automated testing.
- Updated dependency lockfile through `npm audit fix`.
- Resolved the reported moderate PostCSS audit finding.

### Tests

- Added automated tests for tenant role scoping.
- Added automated tests for auth token and active tenant browser storage behavior.
- Added `npm run test`.
- Verified this release with:
  - `npm run test`
  - `npm run lint`
  - `npm run build`

### Repository

- Added `.env` and `*.tsbuildinfo` to `.gitignore`.
- Included `.env.example` with `VITE_API_BASE_URL`.
- Included production build support through Vite.
- Included PWA manifest and EduBot icon assets.

### Known Notes

- The app is a frontend tenant workspace and expects the EduBot Learning backend API from `VITE_API_BASE_URL`.
- Current local Node produced an engine warning for a transitive eslint package when installing dependencies. Lint, tests, and build pass, but Node `22.13+` is recommended to remove the warning.
