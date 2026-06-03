# EduBot Tenant LMS UX & Product Roadmap

_Last updated: 2026-06-03_

## Executive Summary
EduBot Learning Tenant LMS should become a modern learning center workspace: serious and efficient for admins/instructors, motivating for students, and interactive for live/offline classes. The platform already has a strong operational foundation. The next step is to turn existing capabilities into a clear, attractive, role-specific experience.

The guiding principle is simple: every user should immediately know what to do next.

## Product Positioning
**EduBot Learning Center Cabinet** is a modern workspace for learning centers to manage classes, students, groups, sessions, attendance, homework, materials, progress, support, and certificates.

Kyrgyz: **EduBot Окуу борборунун кабинети**
Russian: **EduBot Кабинет учебного центра**

EduBot should blend the best patterns from modern education products:
- Canvas-style structure and reliability
- Udemy-style video course flow
- Google Classroom-style homework simplicity
- Kahoot-style live classroom interaction
- Duolingo-style motivation and learning progress
- EduBot AI and CRM/student follow-up
- Kyrgyz/Russian localization

## North Star Experience
Role-specific dashboards should answer one question immediately:

| Role | Main question |
|---|---|
| Student | What should I do next? |
| Instructor | What do I need to teach, prepare, mark, or review today? |
| Assistant | Which operational blockers need follow-up? |
| Admin / Company admin | Is the learning center configured, healthy, and ready? |

## Visual Direction
The current tenant app is functionally strong, but visually it can feel too much like a generic admin panel. The redesign should make it feel premium, modern, and education-focused.

### Staff/Admin/Instructor Side
- Premium calm workspace
- Soft blue-gray background
- White or glass-like cards
- Navy text for trust
- Orange primary actions
- Teal success/progress states
- Clear status chips
- Grouped sidebar navigation
- Less heavy active navigation states

### Student Side
- Motivating learning app
- Clear next-action card
- Today timeline
- Progress ring or progress summary
- Streaks, goals, milestones later
- Friendly empty states
- Clear feedback and help surfaces

### Design System Rules
- 8px radius: inputs, chips, compact controls
- 12px radius: compact cards/table rows
- 16px radius: normal cards
- 20-24px radius: hero cards/next-action cards
- One primary action per screen section
- Avoid card-inside-card clutter
- Avoid decorative blocks that do not support workflow

## Roadmap Overview

| Phase | Goal | Main Deliverables |
|---|---|---|
| P0 | Visual + dashboard foundation | Tenant layout/sidebar, Student Today, Instructor Overview |
| P1 | Operational workflow polish | Attendance, homework review, materials, feedback, student risk |
| P2 | Differentiation | Run Class mode, live quiz/poll, streaks/goals, AI learning support |

## P0 — Visual + Dashboard Foundation

### 1. Tenant Layout and Sidebar
Improve the tenant shell so it feels like a modern learning center cabinet.

Deliverables:
- Softer background and premium card system
- Cleaner sidebar with grouped navigation
- Less heavy active state
- Better tenant/company identity area
- Mobile bottom navigation polish
- Better wording: avoid “tenant” in user-facing UI

Preferred wording:

| Avoid | Use instead |
|---|---|
| Tenant | Company / Learning center / Workspace / Cabinet |
| Operations | Окуу процесси / Учебный процесс |
| Generic Dashboard | Today / Overview / Башкы бет |

### 2. Student Today Page
The Student Today page should become the main learning cockpit.

Top area:
- Primary next action: Join class, Submit homework, Review feedback, Continue lesson, Open material, or Request help
- Today’s class/session
- Due task or urgent task
- Latest feedback or new material

Recommended components:
- StudentTodayView
- StudentNextActionCard
- StudentTodayTimeline
- StudentTodoPanel
- ActiveCoursesProgress
- RecentFeedbackPreview
- RecentMaterialsPanel
- StudentHelpCard

Acceptance criteria:
- Student sees one obvious next action within the first viewport
- Mobile layout prioritizes the next action
- No raw backend enum values or translation keys
- Kyrgyz/Russian labels are natural

### 3. Instructor Overview Page
The Instructor Overview should become a teaching cockpit.

Top area:
- Next class card
- Run Class CTA placeholder
- Mark Attendance CTA
- Open Materials CTA

Main sections:
- Today’s sessions strip
- Session readiness checklist
- Work queue
- Assigned courses/groups
- At-risk students preview

Before-class checklist:
- Meeting link ready
- Materials attached
- Homework prepared
- Activity/quiz prepared
- Student roster ready
- Location/live link confirmed

After-class checklist:
- Attendance saved
- Homework published
- Materials/recording shared
- Activity submissions reviewed
- Students needing follow-up flagged
- Session notes saved

Acceptance criteria:
- Instructor can see the next class and next teaching action immediately
- Work queue shows urgent operational tasks
- Dashboard feels like a cockpit, not a generic report page

## P1 — Operational Workflow Polish

### 4. Attendance
Attendance should support three levels:
1. Session attendance: fast marking during or after class
2. Monthly group attendance: student-by-session matrix
3. Course/curriculum attendance: long-term learning health

Recommended Attendance tabs:
- Mark Attendance
- Monthly Overview
- Student History

Key UX features:
- Average attendance
- Present/late/absent/excused counts
- Students at risk
- Default at-risk threshold: below 80%
- Sticky student names on desktop matrix
- Mobile student cards instead of wide tables

Future endpoints:
- GET /attendance/summary?courseId=&groupId=&from=&to=
- GET /attendance/matrix?courseId=&groupId=&from=&to=
- GET /attendance/students/:studentId/history?courseId=&groupId=
- GET /attendance/risk?courseId=&groupId=&threshold=80

### 5. Homework Review
Homework review should be fast and instructor-oriented.

Improvements:
- Review queue sorted by urgency
- Batch review flow
- Next unreviewed submission action
- Inline score/rubric
- Common feedback snippets
- Needs revision / approved / missing / late states
- AI feedback draft later
- Clear return-to-student action

### 6. Materials
The material preview modal should become the standard material interaction everywhere.

Material actions:
- Preview
- Open in new tab
- Download
- Attach to lesson/session
- Replace
- Remove
- Mark visible to students
- Show draft/published state

### 7. Feedback Center
Students need one place to understand instructor feedback.

Include:
- Returned homework comments
- Quiz/activity results
- Instructor notes visible to student
- Revision requests
- Suggested next steps
- Link back to relevant course/session/task

Future endpoint:
- GET /student/feedback

### 8. Student Risk and Follow-up
Add instructor-facing student risk panels.

Signals:
- Low attendance
- Consecutive absences
- Repeated late arrival
- Missing homework
- Low progress
- Needs revision
- No recent activity

Recommended placement:
- Instructor dashboard
- Group detail
- Reports
- Student profile

Future endpoint:
- GET /instructor/students/risk?courseId=&groupId=&threshold=

## P2 — Differentiation and Engagement

### 9. Run Class Mode
Run Class mode can become a major EduBot differentiator.

Flow:
1. Instructor opens next session
2. Instructor clicks Run Class
3. Screen shows meeting/location, attendance, materials, activities
4. Instructor launches quiz, poll, or quick check
5. Students respond live
6. Instructor sees results instantly
7. Class ends with summary and follow-up checklist

Run Class blocks:
- Meeting / Location
- Attendance
- Materials
- Live Quiz / Poll
- Activity Prompt
- Homework Assignment
- End-Class Summary

Future endpoints:
- POST /group-sessions/:sessionId/live-activities
- PATCH /group-sessions/:sessionId/live-activities/:activityId/start
- PATCH /group-sessions/:sessionId/live-activities/:activityId/end
- POST /student/live-activities/:activityId/responses
- GET /group-sessions/:sessionId/live-activities/:activityId/results

### 10. Student Engagement System
Add motivation carefully.

Recommended additions:
- Attendance streak
- Homework streak
- Weekly learning goal
- Course milestone badges
- Certificate progress
- Quiz score celebration
- Live class participation
- Progress moments

Avoid:
- Excessive leaderboards
- Noisy animations
- Rewards for random clicks
- Game-like admin screens

### 11. AI Learning Support
AI should help instructors and students, but not replace the core workflow.

Possible AI features:
- Generate quiz from lesson/session
- Generate homework draft
- Suggest feedback draft
- Explain lesson in Kyrgyz/Russian
- Identify weak topics
- Summarize student risk reasons

## Backend Roadmap
Use existing APIs first for P0. Add new endpoints only when the UX requires cleaner data.

Priority future endpoints:
- GET /student/dashboard/next-action
- GET /student/tasks/priority
- GET /student/feedback
- GET /student/courses/:courseId/map
- GET /student/materials?groupBy=course
- PATCH /student/materials/:materialId/seen
- GET /student/attendance/summary
- GET /student/progress/gradebook
- GET /attendance/summary
- GET /attendance/matrix
- GET /attendance/students/:studentId/history
- GET /attendance/risk
- GET /instructor/students/risk
- GET /instructor/dashboard/next-action

## Frontend Architecture Roadmap

### Student Components
- StudentTodayView
- StudentNextActionCard
- StudentCourseMap
- StudentTodoPanel
- StudentProgressSummary
- StudentMaterialsPanel
- StudentFeedbackPanel
- StudentHelpPanel

### Instructor Components
- InstructorOverviewPage
- InstructorNextClassCard
- SessionReadinessChecklist
- InstructorTodaySessions
- InstructorWorkQueue
- InstructorAssignedScope
- InstructorAtRiskStudents

### Shared UI Components
- NextActionCard
- StatusChip
- ProgressRing
- WorkQueueList
- TimelineList
- EmptyState
- MaterialPreviewModal
- DashboardSection
- MobileCardList

## QA and Acceptance Criteria

Global acceptance criteria:
- Each role dashboard has one clear primary next action
- Student pages feel like a learning app
- Instructor pages feel like a teaching cockpit
- Admin pages stay calm and operational
- No raw backend enum values or translation keys are visible
- Materials use shared preview wherever possible
- Empty states explain no data, no access, or disabled functionality
- Mobile views avoid wide tables where cards are more usable
- Core workflows pass keyboard, focus, and responsive layout checks
- Kyrgyz/Russian localization is supported naturally

## Suggested First Agent Task

```txt
You are a Senior Product Designer, UX Expert, and React Frontend Engineer.

We are improving EduBot Learning tenant frontend.

Goal:
Make the tenant app feel like a modern educational platform and learning center workspace, not a generic admin dashboard.

Use docs/platform-ux-proposals.md and this roadmap as product direction.

Do not build new backend endpoints yet.
Use existing APIs/data where possible.
Do not change routes or backend logic unless absolutely necessary.

Phase 1 scope:
1. Upgrade visual system.
2. Improve tenant sidebar/layout.
3. Redesign Student Today page.
4. Redesign Instructor Overview page.

Design direction:
- Staff/admin: premium calm workspace.
- Instructor: teaching cockpit.
- Student: motivating learning app.
- Live sessions: interactive classroom energy later.

Requirements:
- One obvious primary next action per role.
- Orange for primary action.
- Teal for progress/success.
- Navy for trust.
- Soft blue-gray background.
- White/glass-like cards.
- Bigger radius for cards.
- Clear status chips.
- Mobile-first student experience.
- Kyrgyz/Russian localization.
- No raw backend enum values.
- No card-inside-card clutter.
- No decorative blocks that do not support workflow.

Output:
1. Current file/component structure.
2. Proposed component structure.
3. Exact files to update/create.
4. Data mapping from existing APIs.
5. Desktop and mobile layout plan.
6. Step-by-step implementation tasks.
7. Acceptance criteria.
Then implement in small safe commits.
```
