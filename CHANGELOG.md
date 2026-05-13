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
