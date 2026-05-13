P0 Bugs / UX Breakage

[done] Fix stale roster after clearing filters

Weakness: Course roster can stay filtered/empty after clearing search/progress filters.
Task: In CoursesPage, reload full group roster when studentQuery === '' and progressFilter === 'all'.
Suggested implementation: call listGroupStudents(selectedGroupId, { limit: 200 }) when filters reset, or keep a cached unfiltered roster and derive filtered rows locally.
[done] Prevent stale student dashboard data after tenant switch

Weakness: StudentDashboardPage does not cancel in-flight requests, so old tenant data can overwrite new tenant state.
Task: Add a cancellation guard to the student dashboard loading effect.
Suggested implementation: follow the cancelled pattern already used in OverviewPage and CoursesPage.
[done] Make student dashboard partial-load tolerant

Weakness: One failed endpoint can degrade the whole learner dashboard.
Task: Replace the single Promise.all load with Promise.allSettled or separate fetch states.
Suggested implementation: render courses/sessions even if certificates, attendance, resources, or recordings fail.
P1 Product UX

[done] Improve staff mobile navigation priority

Weakness: Daily instructor workflows like Attendance and Homework are hidden under “More”.
Task: Make mobile nav role-aware.
Suggested priority:
Instructor/assistant: Sessions, Attendance, Homework, Courses
Admin/owner: Overview, Courses, Members, Settings
Certificate manager: include Certificates
[done] Add access-denied states instead of silent redirects

Weakness: Unauthorized deep links silently redirect users, which is confusing from notifications or shared links.
Task: Replace route-guard redirects with a small “No access” state where appropriate.
Suggested implementation: show reason + available destination, e.g. “Go to My Learning” or “Go to Overview”.
[done] Sharpen “what should I do next?” hierarchy

Weakness: Some screens present many equally weighted cards/actions.
Task: Define one primary next action per role and page.
Suggested examples:
Student: join next session, submit next task, continue course.
Instructor: mark attendance, review homework, prepare next session.
Admin: approve courses, invite members, configure certificates.
[done] Reduce status-badge overload

Weakness: Many repeated badges can make screens visually noisy.
Task: Audit pages for redundant status chips.
Suggested rule: keep badges for decision-critical state; move secondary state into muted metadata text.
P1 Frontend Architecture

[done] Split large initial bundle

Weakness: Build passes but initial JS chunk is over Vite’s warning threshold.
Task: Add manual chunks or inspect root imports pulling too much into the shell.
Suggested implementation: separate vendor chunks for React/router/i18n/icons and review shared imports in app shell.
[done] Normalize repeated page loading patterns

Weakness: Pages use slightly different loading, cancellation, toast, and reload behavior.
Task: Introduce a small reusable async-load hook or local convention.
Suggested implementation: standardize loading, error, cancelled, reload, and toast handling.
[done] Strengthen error states beyond toast-only failures

Weakness: Many fetch failures only show a toast, leaving the page empty or stale.
Task: Add inline error panels for primary page data.
Suggested implementation: toasts for transient actions, inline states for page-level data failure.
P2 LMS Workflow

[done] Improve course workflow guidance

Improve course workflow guidance
Weakness: Course readiness blockers exist, but users may still need clearer next steps.
Task: Turn blocker messages into actionable checklist items.
Suggested examples: “Approve course”, “Publish course”, “Create group”, “Schedule sessions”.
[done] Make instructor daily view more explicit

Make instructor daily view more explicit
Weakness: Overview is useful, but instructors need a daily teaching queue.
Task: Add or emphasize a “Today” operational section.
Suggested content: today’s sessions, unmarked attendance, pending homework reviews, next live links.
[done] Make student task priority deterministic

Make student task priority deterministic
Weakness: “next task” appears to be based mostly on list order/open status.
Task: Sort open tasks by due date, overdue state, and session timing.
Suggested priority: overdue first, due soon, live-session-related, then no due date.
Add clearer empty-state intent
Weakness: Some empty states explain absence but do not always orient the user’s next workflow.
Task: Review every empty state for role-specific next action.
Suggested examples:
Instructor with no groups: link to course/group setup.
Student with no courses: explain enrollment/admin contact.
Admin with no members: invite first instructor/student.
[done] Add clearer empty-state intent

P2 Accessibility / Form UX

[done] Audit form labels and helper text

Audit form labels and helper text
Weakness: Many forms are dense; some rely heavily on placeholders.
Task: Verify every input/select has a visible label and useful error association.
Suggested implementation: add aria-describedby for field errors and helper text where validation exists.
[done] Improve destructive-action confirmation consistency

Improve destructive-action confirmation consistency
Weakness: Design docs require confirmation for destructive backend actions; ensure every destructive flow follows it.
Task: Audit member removal, certificate revoke/reject, course reject, session cancellation, etc.
Suggested implementation: centralize confirmation modal copy pattern.
[done] Add keyboard checks for mobile/menu interactions

Add keyboard checks for mobile/menu interactions
Weakness: Mobile more menu has good basics, but should be verified end-to-end.
Task: Add interaction tests for open, Escape close, outside click close, and route close.
Suggested file: extend AppLayout or navigation tests.
P2 Localization

Check real text length in Kyrgyz and Russian
Weakness: Key sync is tested, but layout resilience for longer localized text is not automatically verified.
Task: Run visual QA in ky, ru, and en on core pages.
Suggested pages: login, overview, courses, sessions, attendance, student dashboard, settings.
Avoid backend enum leakage
Weakness: Some fallback rendering uses readable() for unknown backend values, which is practical but can expose awkward English strings in localized UI.
Task: Add translation maps for common backend enums and log/handle unknowns intentionally.
Suggested areas: statuses, course types, roles, activity types.
[done] Avoid backend enum leakage

P3 Visual Polish

[done] Refine student dashboard visual hierarchy

Refine student dashboard visual hierarchy
Weakness: Multiple cards compete with the primary learner action.
Task: Make the next action visually dominant and demote secondary stats.
Suggested implementation: one strong primary panel, compact secondary row below.
Review density on small laptops/tablets
Weakness: Operational density is good, but some two-pane pages may feel cramped.
Task: Test 1024px and 768px widths for courses, sessions, certificates.
Suggested implementation: collapse right-side workflow panels below main content earlier where needed.
[done] Implement small laptop/tablet density CSS
Pending: visual QA at 1024px and 768px with real tenant data.

Review color balance
Weakness: Orange is strong and can dominate if used for too many active/primary states.
Task: Audit primary buttons, active nav, warnings, and hover states together.
Suggested implementation: keep orange for primary actions/brand, use neutral surfaces for secondary workflow emphasis.
[done] Implement neutral secondary control color balance
Pending: visual QA against live screens.

P3 Testing

[done] Add regression test for roster filter reset

Add regression test for roster filter reset
Weakness: Current tests pass but do not catch the stale roster issue.
Task: Add a test that filters students, clears filters, and expects full roster reload.
[done] Add test for student dashboard partial failure

Add test for student dashboard partial failure
Weakness: A single rejected request currently risks bad learner UX.
Task: Mock one failing student endpoint and assert other sections still render.
Add test for tenant-switch race
Weakness: In-flight responses can overwrite state.
Task: Simulate tenant change before old student request resolves and assert stale response is ignored.
[done] Add test for tenant-switch race
