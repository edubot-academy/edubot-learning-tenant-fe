# Visual QA Checklist

Last updated: 2026-05-13.

Use this checklist for Release 0.1 design-system acceptance and future UI changes.

## Viewports

- Desktop: 1440 x 900.
- Laptop: 1280 x 800.
- Tablet: 768 x 1024.
- Mobile: 390 x 844.
- Small mobile: 360 x 740.

## Themes

- Light theme: default surfaces, borders, shadows, status colors.
- Dark theme: contrast, hover states, modals, table rows, certificate preview, and sidebar.

## Global Shell

- Sidebar brand, tenant, role, workspace, navigation, and logout fit without overlap.
- Active nav state is visible.
- Mobile tab bar does not hide page actions or form footers.
- Tenant switcher remains usable when multiple tenants exist.
- Skip link appears on keyboard focus.

## Shared Primitives

- Page headers wrap actions cleanly.
- Primary, secondary, ghost, link, and danger buttons are visually distinct.
- Disabled buttons retain readable labels.
- Status badges use correct tone and do not overflow.
- Empty, loading, and error states align and read clearly.
- Tables scroll horizontally only when needed.
- Stack list items do not collapse action buttons or metadata.
- Modals center correctly, scroll internally when long, and keep close buttons visible.

## Page Coverage

- Overview: sparse data, active queues, disabled feature actions, recent activity.
- Courses: empty catalog, filtered catalog, selected course context, operational blocker states, roster table.
- Groups: no approved live courses, group details, roster, generated sessions preview.
- Sessions: course/group/session workflow, edit group modal, edit session modal, materials, activities, insights.
- Attendance: empty roster, unmarked roster, changed rows, mobile roster cards, save disabled/enabled state.
- Homework: assignment list, review roster, long submissions, assignee filtering, create/edit modals.
- Certificates: branding, rules, registry, issue picker, eligibility override, regeneration confirmation, portrait and landscape preview.
- Members: role filters, invitations, read-only owner states, compact mobile rows.
- Settings: profile, branding preview, policies, platform info, features, activity.
- Student Dashboard: continue-learning priority, tasks, materials, attendance, homework, certificates, empty states.
- Auth pages: login, password reset, account setup, tenant resolution errors.

## Acceptance Checks

- No overlapping text or controls at listed viewports.
- No button or badge text clipped inside its container.
- No horizontal page scroll except intentional table wrappers.
- Interactive controls have visible hover and focus states.
- Destructive actions are visually distinct and confirmation copy names the affected object.
- Status colors are not the only indicator when state affects action availability.
- Page sections use shared primitives instead of new one-off card styles.
- Dark mode does not reduce text contrast below readable levels.
- All visible commands map to existing routes or API-backed actions.
