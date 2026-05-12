# LMS Design System

Last updated: 2026-05-13.

This design system documents the current tenant LMS UI primitives. It is intentionally scoped to behavior and data that already exist in the application.

## Principles

- Staff screens are operational: dense, predictable, and optimized for repeated scanning.
- Student screens are action-first: next session, next task, progress, materials, and certificates should be easy to identify.
- Do not add visible controls unless the route, API, permission, and feature flag already support the action.
- Prefer shared primitives over page-specific styling.
- Keep radii compact. Default radius is `8px`; pills are reserved for status badges.
- Use icons only when they improve recognition of actions or page context.
- Empty states must explain the real reason data is missing and point to an existing action only when one exists.

## Tokens

Primary tokens live in [src/styles/app.css](/Users/bektenorunbaev/Documents/projects/edubot-learning/edubot-learning-tenant-fe/src/styles/app.css) and are mirrored into Tailwind in [tailwind.config.js](/Users/bektenorunbaev/Documents/projects/edubot-learning/edubot-learning-tenant-fe/tailwind.config.js).

- `--brand-primary`, `--brand-primary-strong`, `--brand-primary-dark`: primary actions and active navigation.
- `--surface`, `--surface-muted`, `--surface-hover`: panel, nested content, and hover surfaces.
- `--line`, `--line-strong`: borders and field outlines.
- `--text`, `--text-muted`, `--text-soft`: body, supporting, and low-emphasis text.
- `--status-success-*`, `--status-warning-*`, `--status-danger-*`, `--status-info-*`: status badge families.
- `--focus-ring`, `--focus-shadow`, `--transition-ui`: shared interaction primitives.
- `--shadow-xs`, `--shadow-sm`, `--shadow-md`: elevation levels.
- `--radius`: default component radius.

## Layout

- `AppLayout` owns tenant context, role context, sidebar navigation, and mobile tab navigation.
- Main page content should use `PageHeader` for page title and action wrapping.
- Use full-width sections and grids for pages. Do not nest cards inside cards.
- Use `workspace-grid` for two-pane operational pages and `settings-panel` or `content-section` for the main panels.
- Use `workflow-context-panel` when a panel represents the selected course, group, session, homework, or certificate context.

## Buttons And Links

Use the existing variants:

- Default `button`: primary action.
- `.primary-button`: explicit primary action when the element already needs a class.
- `.secondary-button`: neutral secondary action.
- `.primary-link-button`: primary navigation link styled as a command.
- `.secondary-link-button`: neutral navigation link styled as a command.
- `.ghost-button`: low-emphasis shell/sidebar action.
- `.danger-button`: destructive confirmation action.
- `.link-button`: compact inline action inside rows and lists.

Rules:

- Destructive actions must use confirmation when the action immediately changes backend state.
- Row-level actions should use `.link-button` or compact secondary buttons.
- Icon buttons need accessible labels or adjacent text.
- Disabled buttons should remain visible only when the disabled reason is clear nearby.

## Panels And Lists

- `content-section`: primary page content panels.
- `settings-panel`: secondary or right-side operational panels.
- `workflow-context-panel`: selected-object context panels with stronger visual orientation.
- `state-panel`: loading, empty, and error states.
- `table-wrap`: horizontal table container.
- `stack-list` and `stack-list-item`: responsive row/card lists.
- `definition-grid`: label/value metadata.
- `form-section`: grouped modal or settings form sections.

Rules:

- Use tables for desktop-scale admin comparison.
- Use stack lists or responsive card tables for mobile-heavy workflows.
- Keep compact panel headings at `h2`/`h3` scale, not hero scale.
- Use `section-heading-row` for title plus actions.

## Status Badges

Use `.status-badge` plus semantic status classes. Current status families:

- Success: `issued`, `approve`, `approved`, `published`, `completed`, `complete`, `passed`, `present`, `active`, `open`.
- Warning: `pending_approval`, `pending`, `pending_submission`, `draft`, `planned`, `scheduled`, `submitted`, `needs_review`, `needs_revision`, `late`.
- Danger: `reject`, `rejected`, `revoke`, `revoked`, `cancelled`, `canceled`, `missing`, `overdue`, `expired`, `failed`, `absent`, `destructive`.
- Info: `in_progress`, `in-progress`, `processing`, `reviewed`, `eligible`.
- Attendance-specific: `attendance-present`, `attendance-late`, `attendance-absent`, `attendance-excused`, `attendance-unmarked`.
- Role-specific: `role-owner`, `role-company_admin`, `role-instructor`, `role-assistant`, `role-student`.

Status text should use `readable()` when rendering backend enum values.

## Forms And Modals

- Use `FormModal` for forms and `Modal` for confirmations.
- Use `modal-header-block` for modal title groups.
- Use `modal-actions` for footer commands.
- Use field-level errors for validation that blocks submission.
- Long forms should use `form-section`.
- Modal close, Escape handling, focus trap, and focus return are centralized in [Modal.tsx](/Users/bektenorunbaev/Documents/projects/edubot-learning/edubot-learning-tenant-fe/src/components/Modal.tsx).

## Tables

- Put tables inside `table-wrap`.
- Use `table-row-button` for selectable row labels instead of making the full row a button.
- Use status badges for enum columns.
- Preserve mobile alternatives for attendance and dense workflow pages.

## Typography

- Page titles come from `PageHeader`.
- `ui-kicker` is reserved for uppercase context labels.
- Cards and panels should use compact headings: 14-18px depending on density.
- Metadata and helper copy use `--text-muted` and 12-14px text.
- Avoid viewport-scaled font sizes.

## Implementation Checklist

Before adding or changing a screen:

- Reuse existing primitives before adding CSS.
- Confirm all actions are permissioned and feature-flag-safe.
- Confirm empty states do not promise unsupported workflows.
- Check desktop, tablet, and mobile layout.
- Check light and dark themes.
- Check focus states and keyboard operation for interactive controls.
- Run `npm run build`, `npm run lint`, and `npm test`.
