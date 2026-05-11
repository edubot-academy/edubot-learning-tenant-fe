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

- No unreleased changes yet.

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
