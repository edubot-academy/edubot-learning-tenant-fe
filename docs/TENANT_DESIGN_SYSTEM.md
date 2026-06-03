# EduBot Tenant Design System

_Last updated: 2026-06-03_

## Purpose

The tenant app should feel like a modern learning center workspace, not a generic admin dashboard. This design foundation prepares the app for future role-specific redesigns such as Instructor Cockpit, Student Today, Attendance, Homework Review, and Run Class mode.

This document defines the visual rules, reusable UI patterns, and implementation boundaries for the tenant frontend.

## Product Positioning

**EduBot Learning Center Cabinet** is a modern workspace for learning centers to manage classes, students, groups, sessions, attendance, homework, materials, progress, support, and certificates.

- Kyrgyz: **EduBot Окуу борборунун кабинети**
- Russian: **EduBot Кабинет учебного центра**

## Experience Target

EduBot should combine:

- Canvas workflow clarity
- Google Classroom simplicity
- Kahoot-style live classroom energy later
- Duolingo-style student motivation where appropriate
- EduBot local learning center operations
- Kyrgyz/Russian localization

## Role-Specific Visual Rules

### Staff/Admin

Staff and admin screens should feel:

- premium
- calm
- operational
- professional
- clear
- not playful

Use these screens for reports, settings, members, certificates, and operational overview.

### Instructor

Instructor screens should feel like a teaching cockpit:

- action-first
- next class visible
- work queue visible
- fast scanning
- classroom-ready

Primary design goal: the instructor should immediately know what to teach, mark, prepare, or review today.

### Student

Student screens should feel like a modern learning app:

- motivating
- progress-focused
- friendly
- clear next action
- easy access to feedback, materials, and help

Primary design goal: the student should immediately know what to do next.

### Live Class Mode

Run Class mode can be more dynamic and interactive later. It may use more energetic visuals for quizzes, polls, timers, participation, and instant results. This is not the default style for admin screens.

## Design Tokens

Tokens live in `src/styles/tenant-design-system.css` and are exposed to Tailwind through `tailwind.config.js`.

### Colors

- Navy: trust, shell, serious workspace identity
- Orange: primary action, next action, urgent workflow CTA
- Teal: success, progress, completion, positive state
- Blue-gray: app background and quiet surfaces
- White surface: cards, panels, forms
- Muted surface: secondary panels and empty states
- Semantic status colors: success, warning, danger, info

### Radius

Use radius intentionally:

- `--radius-control` / `rounded-control`: inputs, buttons, small controls
- `--radius-compact` / `rounded-compact`: compact cards and table-like rows
- `--radius-card` / `rounded-card`: default cards and dashboard panels
- `--radius-hero` / `rounded-hero`: next-action cards and main workflow cards

### Shadows

Use shadows to create hierarchy, not decoration:

- `--shadow-xs` / `shadow-xs`: subtle row/card depth
- `--shadow-card` / `shadow-card`: standard dashboard cards
- `--shadow-hero` / `shadow-hero`: main workflow/next-action cards
- `--shadow-primary-hover` / `shadow-brand`: primary action hover

### Spacing

Use consistent layout spacing:

- `--page-padding`
- `--page-padding-mobile`
- `--section-gap`
- `--card-padding`
- `--grid-gap`

## Reusable CSS Classes

Use these classes for future page redesigns.

### Page Structure

```tsx
<main className="ui-page">
  <header className="ui-page-header">
    <div>
      <p className="ui-page-kicker">Instructor</p>
      <h1 className="ui-page-title">Окутуу кокпити</h1>
      <p className="ui-page-description">Бүгүн эмне кылуу керек экенин бир жерден көрүңүз.</p>
    </div>
    <a className="ui-primary-action" href="/sessions">Кийинки сабак</a>
  </header>
</main>
```

### Cards

- `.ui-card`: normal dashboard card
- `.ui-card-compact`: compact content block
- `.ui-hero-card`: primary next-action card
- `.ui-action-card`: clickable workflow/action card
- `.ui-stat-card`: metric card
- `.ui-panel`: backwards-compatible card class
- `.ui-panel-muted`: backwards-compatible muted panel class
- `.ui-workflow-card`: backwards-compatible action card class
- `.ui-metric-link`: backwards-compatible metric card class

### Status Chips

Use semantic status chips:

```tsx
<span className="ui-status-chip ui-status-success">Даяр</span>
<span className="ui-status-chip ui-status-warning">Текшерүү керек</span>
<span className="ui-status-chip ui-status-danger">Кечикти</span>
<span className="ui-status-chip ui-status-info">Маалымат</span>
```

### Actions

- `.ui-primary-action`: the main action for a section or page
- `.ui-secondary-action`: secondary action

Use one primary action per major section whenever possible.

### Grids and Lists

- `.ui-dashboard-grid`: responsive card grid
- `.ui-work-queue`: vertical list of work items
- `.ui-timeline`: session/today timeline
- `.ui-empty-state`: no data/no access/disabled feature state

## Page Layout Pattern

Every major page should eventually follow this structure:

1. PageHeader
   - kicker
   - title
   - description
   - primary action

2. PrimarySection
   - next action or main workflow

3. SecondaryGrid
   - stats
   - work queues
   - recent items

4. SupportSection
   - help
   - empty states
   - secondary actions

## Sidebar Rules

The sidebar should feel like a learning center cabinet, not a heavy admin panel.

Rules:

- grouped navigation feel
- softer active state
- no huge orange active block
- clear workspace identity
- clear user/role area
- settings/logout separated
- mobile bottom nav should feel app-like
- do not make staff/admin navigation playful

## Mobile Rules

- prioritize the primary action
- avoid wide tables on mobile
- use card lists instead of matrix layouts where needed
- keep bottom navigation touch-friendly
- avoid hiding urgent tasks behind secondary menus

## What Not To Do

Avoid:

- card-inside-card clutter
- huge decorative hero blocks without workflow purpose
- equal-weight dashboard grids where urgent work is hidden
- raw backend enum values in UI
- visible translation keys
- game-like admin screens
- separate CSS override files for design-system changes
- excessive animation that slows classroom work

## Acceptance Criteria For Design Foundation PRs

A design foundation PR should meet these rules:

- design tokens live in the normal app CSS pipeline
- Tailwind exposes key tokens
- no long-term external visual override file is used
- `index.html` does not load custom visual CSS after the app bundle
- no route, data, permission, or business-logic changes
- existing app still builds
- sidebar/layout remains functional
- UI classes are reusable for future Student Today and Instructor Cockpit redesigns

## Next Redesign Slices

After this foundation, redesign pages in small slices:

1. Instructor Overview → Teaching Cockpit
2. Student Today → Learning Cockpit
3. Attendance → Mark, Monthly Overview, Student History
4. Homework Review → Fast review queue
5. Run Class Mode → live classroom workflow
