Phase 1: Design System Foundation

✅ Define learning dashboard tokens

Source: instructor-s-hub/src/styles.css
Bring over the design language, not the exact Tailwind 4 setup.
Tokens needed:
learning-primary: EduBot orange
learning-secondary: EduBot navy
learning-accent: yellow/gold
learning-success: teal
learning-danger: red
chunky shadows
24-32px card radii
large icon tiles
✅ Create reusable learning card styles

Needed variants:
learning-card
learning-card--hero
learning-card--queue
learning-card--compact
learning-card--stat
Goal: stop writing one-off CSS per dashboard section.
✅ Create reusable status/tone utilities

Needed tones:
primary
secondary
accent
success
danger
muted
Used by attention queues, homework statuses, certificates, sessions.
Phase 2: Instructor Dashboard Widgets
✅ 4. Port InsightsRow concept

Source: InsightsRow.tsx
Tenant data source:
active students
sessions this week/today
pending grading
average completion/progress
Make it prop-driven, not hardcoded.
✅ Port AttentionQueue concept

Source: AttentionQueue.tsx
Tenant data source:
unmarkedAttendance
homeworkNeedsReview
activityNeedsReview
certificates.pending
upcomingWithoutMaterials
Each item should navigate to the correct page.
✅ Port TodaySessions concept

Source: TodaySessions.tsx
Tenant data source:
instructorDashboard.today.sessions
instructorDashboard.today.nextSession
Support live/upcoming/soon states.
✅ Port HomeworkQueue concept

Source: HomeworkQueue.tsx
Tenant data source:
overview.homework.summary
overview.homework.queue
Replace fake statuses with tenant homework/submission states.
✅ Port CertificatesPanel concept

Source: CertificatesPanel.tsx
Tenant data source:
overview.certificates.pending
waiting
issued
coursesWithoutConfig
Only show when certificates feature/permission is enabled.
✅ Port UpcomingSessionsPanel concept

Source: UpcomingSessionsPanel.tsx
Tenant data source:
overview.sessions.upcoming
instructor upcoming sessions
Group by date.
✅ Port ActivityFeed concept

Source: ActivityFeed.tsx
Tenant data source:
overview.activity
Use existing activity labels/i18n.
✅ Added prop-driven InstructorActivityFeed component shell.
✅ Added mapInstructorActivityFeedItems helper for real overview.activity data.
Next: render widget in OverviewPage instructor branch after safe file patch.
⏳ Port AtRiskStudents concept

Source: AtRiskStudents.tsx
Tenant requirement:
Needs real backend/data support or derived heuristic.
First version can derive from:
missed assignments
missed sessions
low progress
broken attendance/streak signal if available.
✅ Added prop-driven InstructorAtRiskStudents component shell using real instructor attention-student shape.
✅ Added mapInstructorAtRiskStudents helper for real instructorDashboard.attentionStudents data.
Next: render widget in OverviewPage instructor branch after safe file patch.
Phase 3: Hero + Engagement
✅ 12. Adapt LaunchQuizHero
- Source: LaunchQuizHero.tsx
- Tenant data source:
- next live session
- generated/join PIN if live quiz feature exists
- If no live quiz backend exists yet, show “Start live session” or “Open session”.

⏳ Adapt QuickActions

Source: QuickActions.tsx
Tenant actions:
create lesson/activity
post announcement
set weekly challenge
review grading
Must respect permissions and feature flags.
✅ Added prop-driven InstructorQuickActions component shell with disabled/permission states.
Next: add mapper from tenant permissions/feature flags and render in instructor branch.
Adapt leaderboard/milestone later

Source:
Leaderboard.tsx
MilestoneCard.tsx
Blocker:
Need real XP/leaderboard/badge data model.
Phase 4: Role-Aware Assembly
⏳ 15. Refactor tenant instructor overview composition
- File: src/features/dashboard/OverviewPage.tsx
- Do not show all widgets to everyone.
- Instructor view:
- ✅ insights
- ✅ attention queue
- ✅ live/session hero
- ✅ today sessions
- ✅ homework queue
- ✅ dark instructor canvas + white card shell from instructor-s-hub
- ✅ upcoming sessions
- Admin view:
- should stay operations/EduPro-style, not QuestLMS-heavy.

Split admin vs instructor widgets

Admin-only:
setup checklist
✅ tenant-wide certificates config
members/setup health
Instructor:
sessions
grading
assigned courses/classes
at-risk students
activity relevant to assigned groups.
Add feature-flag guards

Homework widget only if homework enabled.
Attendance queue only if attendance enabled.
Certificates widget only if certificates enabled.
Live quiz hero only if live quiz/session feature exists.
Phase 5: Student Dashboard Alignment
18. Use same visual language for student
- Same card shapes, chunky shadows, icon tiles.
- Student-specific widgets:
- today’s next task
- upcoming session
- progress stats
- courses
- tasks
- achievements later.

Avoid instructor-only concepts on student
No admin queue.
No certificate approval.
No grading workload.
Student sees personal progress, tasks, streaks, rewards.
Phase 6: Quality Gates
20. Make every adopted component prop-driven
- No mock arrays.
- No hardcoded names, counts, dates, XP.
- All display text through i18n.

Add tests

Dashboard renders based on permissions.
Feature flags hide/show widgets.
Empty states render correctly.
Queue links point to correct routes.
Visual QA

Desktop 1440px+
Laptop 1280px
Tablet
Mobile
Check no text overflow in Kyrgyz/Russian/English.
Performance check

Avoid loading every widget’s data separately.
Prefer existing OverviewPage aggregate responses.
Add backend aggregation only if current data is insufficient.