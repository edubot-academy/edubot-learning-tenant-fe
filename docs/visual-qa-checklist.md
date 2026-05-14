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

## Owner/Admin Scenarios

Run these checks at desktop, tablet, mobile, and small mobile widths. Repeat the language pass in English, Russian, and Kyrgyz because owner/admin labels are longer and more likely to wrap.

- Tenant owner with full permissions:
  - Overview shows admin stats, attention queue, setup checklist, operations summary, certificate backlog, and expected primary actions.
  - Navigation shows Overview, Reports, Operations, People, Settings, and the permitted operational routes.
  - People & Access shows owner management actions, invite actions, pending setup state, multi-role summaries, and last-owner protection.
  - Settings shows Organization Profile, Branding, Learning Policies, Platform & Billing, Features, Access & Roles, Personal Preferences, and Audit Log without tab clipping.
- Company admin without owner permissions:
  - Owner-only actions are hidden or read-only with clear copy.
  - Member and course management actions remain available when the matching permissions are enabled.
  - Access & Roles explains owner boundaries without implying the admin can remove or demote owners.
- Admin with reports permission disabled:
  - Reports navigation is hidden.
  - Direct report route access is denied with a usable fallback.
  - Overview keeps operational content useful without chart-only dependencies.
- Admin with certificates disabled:
  - Certificate navigation and certificate-related actions are hidden.
  - Overview and Operations do not show dead certificate actions.
  - Empty states avoid telling the admin to configure unavailable certificate features.
- Admin with multiple tenants:
  - Tenant switcher remains readable and reachable.
  - Active tenant context is clear in sidebar, mobile navigation, overview, and settings.
  - Switching tenants does not leave stale selected course, group, or member context visible.
- Mobile owner/admin navigation:
  - Top-level owner/admin routes fit the mobile tab bar without overlap.
  - Operations routes remain discoverable without crowding the primary navigation.
  - Modals and page actions remain reachable above the mobile tab bar.
- Empty new tenant:
  - Overview setup checklist gives the next useful action.
  - People, Courses, Groups, Sessions, Certificates, Reports, and Settings empty states are role-appropriate.
  - Disabled feature copy distinguishes unavailable features from missing data.
- Established tenant with many members/courses:
  - Filters, tables, metadata rows, and action menus remain scannable.
  - Reduced badge usage keeps dense admin pages readable.
  - Long names, emails, course titles, group names, and localized labels wrap without pushing actions off screen.

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
