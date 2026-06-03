# Platform UX Proposals

Last updated: 2026-06-03.

This document summarizes product and UX proposals for improving the Edubot tenant LMS experience, with emphasis on instructor workflows, attendance visibility, dashboard design, and role-specific product focus.

## Executive Summary

The platform has a strong operational foundation: courses, groups, sessions, attendance, homework, reports, certificates, student support, and role-based navigation are already represented. The next design step is to make each role's first screen and daily workflow more action-oriented.

The most important product question for each role should be answered immediately:

- Instructor: What do I need to teach, prepare, mark, or review today?
- Student: What should I attend, complete, or read next?
- Assistant: Which operational blockers need follow-up?
- Admin: Is the tenant configured, healthy, and ready?

The current product structure is stronger than the visual hierarchy. The main design improvement is not adding decoration; it is making the next action obvious.

## Current Strengths

- Role separation is a strong product decision.
- Instructor navigation is focused on teaching work: overview, sessions, attendance, homework, groups, reports, certificates, and settings.
- Sessions already act as a practical teaching workbench with meeting, materials, activities, homework, attendance, and insights.
- The platform has useful backend-driven signals such as unmarked attendance, homework review queue, activity review queue, upcoming sessions, and sessions missing materials.
- The shared material preview modal improves consistency and keeps learners/instructors inside the platform instead of forcing every file into a new tab.
- The white/light operational dashboard direction is clearer and more usable than the heavy dark dashboard for core teaching workflows.

## Main Design Issues

- Some pages still feel like admin modules instead of role-specific workspaces.
- Many panels have similar visual weight, so urgent work does not stand out enough.
- Some dashboard cards show data, but not enough guidance about what the user should do next.
- The instructor dashboard should be more of a teaching cockpit and less of a general report page.
- Status text and labels must always be localized and human-readable, not raw backend values or translation keys.
- Card usage should stay disciplined. Avoid cards inside cards and avoid large decorative dashboard blocks that do not support a workflow.

## Recommended Design Direction

Use the light operational style as the default for core workflows:

- White panels on soft blue-gray page background.
- Orange for primary actions.
- Compact 8px cards and panels.
- Clear borders instead of heavy shadows.
- Status chips for operational state.
- Dense but readable layouts optimized for scanning.

Avoid:

- Heavy dark mode as the default for teaching/admin work.
- Oversized decorative hero cards.
- Equal-weight grids where every metric competes for attention.
- Raw technical wording such as backend enum values.
- Landing-page style composition inside app workflows.

## Instructor Experience Proposal

### Product Goal

Instructors should enter the platform and immediately understand:

- What class is next.
- Whether the class is ready.
- Whether attendance is missing.
- Which homework or activity submissions need review.
- Which students need follow-up.
- Which materials or recordings are available.

### Recommended Instructor Dashboard

The instructor dashboard should have a first-viewport command center:

1. Primary next action
   - Join next class.
   - Mark attendance.
   - Review submissions.
   - Add missing materials.
   - Open the assigned group/session.

2. Today strip
   - Today's sessions.
   - Session time and group.
   - Meeting status.
   - Materials status.
   - Attendance status.

3. Work queue
   - Unmarked attendance.
   - Homework needing review.
   - Activity submissions needing review.
   - Sessions missing materials.
   - Students needing attention.

4. Assigned scope
   - Assigned courses.
   - Assigned groups.
   - Active students.
   - Upcoming sessions.

### Before Class

Add a session readiness checklist:

- Meeting link ready.
- Materials attached.
- Homework prepared.
- Activity or quiz prepared.
- Student roster present.
- Location or live link confirmed.

This checklist should appear on the dashboard for the next session and inside session detail.

### During Class

The session page should prioritize:

- Join or open live meeting.
- Mark attendance.
- Open materials.
- Run activity.
- Add quick session notes.

The instructor should not need to jump between unrelated pages during class.

### After Class

Add a post-class checklist:

- Attendance saved.
- Homework published.
- Materials/recording shared.
- Activity submissions reviewed.
- Students needing follow-up flagged.
- Session notes saved.

This could appear after the session ends or when the instructor opens a completed session.

## Attendance Proposal

### Current Issue

Per-session attendance is necessary for marking attendance, but it does not show the whole picture. Instructors also need monthly and course-level attendance visibility.

### Best Practice

Keep three levels of attendance:

1. Session attendance
   - Used during or right after class.
   - Fast marking.
   - Present, late, absent, excused.
   - Notes per student.

2. Monthly group attendance
   - Used for weekly/monthly follow-up.
   - Student by session matrix.
   - Attendance percentage per student.
   - Absent/late counts.
   - At-risk highlighting.

3. Curriculum/course attendance
   - Used for long-term learning health.
   - Attendance over the full course lifecycle.
   - Trend over time.
   - Correlation with homework/progress.
   - Exportable report.

### Recommended Attendance Page Structure

Tabs:

- Mark Attendance
- Monthly Overview
- Student History

Top filters:

- Course.
- Group.
- Date range.
- Status.

Summary cards:

- Average attendance.
- Present count.
- Late count.
- Absent count.
- Excused count.
- Students at risk.

Main monthly view:

- Rows: students.
- Columns: sessions/dates.
- Cells: present, late, absent, excused, unmarked.
- Sticky student names on desktop.
- Horizontal scroll for large groups.

Mobile view:

- Student cards instead of a wide matrix.
- Attendance percentage.
- Missed sessions.
- Latest status.
- Button to view student history.

At-risk rules:

- Default threshold: below 80 percent attendance.
- Show repeated late arrivals separately from absences.
- Include missed recent sessions as a stronger signal than old absences.

### Attendance Backend Needs

Suggested endpoints:

```txt
GET /attendance/summary?courseId=&groupId=&from=&to=
GET /attendance/matrix?courseId=&groupId=&from=&to=
GET /attendance/students/:studentId/history?courseId=&groupId=
GET /attendance/risk?courseId=&groupId=&threshold=80
```

Suggested matrix response:

```ts
type AttendanceMatrixResponse = {
  summary: {
    totalSessions: number;
    averageAttendanceRate: number;
    present: number;
    late: number;
    absent: number;
    excused: number;
    unmarked: number;
    atRiskStudents: number;
  };
  sessions: Array<{
    id: number;
    title?: string | null;
    startsAt: string;
  }>;
  students: Array<{
    studentId: number;
    fullName: string;
    email?: string | null;
    attendanceRate: number;
    present: number;
    late: number;
    absent: number;
    excused: number;
    unmarked: number;
    records: Array<{
      sessionId: number;
      status: 'present' | 'late' | 'absent' | 'excused' | 'unmarked';
      notes?: string | null;
    }>;
  }>;
};
```

## Homework Review Proposal

Homework review should become faster and more instructor-oriented.

Recommended improvements:

- Review queue sorted by urgency.
- Batch review flow.
- Next unreviewed submission action.
- Score/rubric inline.
- Common feedback snippets.
- Needs revision, approved, missing, and late states.
- AI feedback draft when enabled.
- Clear return-to-student action.

Backend improvements:

- Batch submission review endpoint.
- Review queue endpoint scoped to instructor assignments.
- Feedback template/snippet support.
- Per-submission audit trail.

## Student Risk And Follow-Up Proposal

Add an instructor-facing student risk panel.

Signals:

- Low attendance.
- Consecutive absences.
- Repeated late arrival.
- Missing homework.
- Low progress.
- Needs revision.
- No recent activity.

Recommended placement:

- Instructor dashboard.
- Group detail.
- Reports.
- Student profile.

Suggested endpoint:

```txt
GET /instructor/students/risk?courseId=&groupId=&threshold=
```

## Teaching Notes Proposal

Instructors need private notes that are not the same as public feedback.

Recommended note targets:

- Student.
- Group.
- Session.

Use cases:

- Follow-up reminders.
- Learning observations.
- Parent/support context.
- Lesson pacing notes.

Suggested endpoints:

```txt
GET /instructor/notes?targetType=&targetId=
POST /instructor/notes
PATCH /instructor/notes/:noteId
DELETE /instructor/notes/:noteId
```

Notes should support visibility rules:

- Private to instructor.
- Shared with assistant/admin.
- Public to student only when explicitly converted into feedback.

## Materials Proposal

The shared material preview modal should become the standard material interaction across dashboards and operational screens.

Recommended material actions:

- Preview.
- Open in new tab.
- Download.
- Attach to lesson/session.
- Replace.
- Remove.
- Mark visible to students.
- Show draft/published visibility state.

Backend fields needed:

```ts
type Material = {
  id: string | number;
  title: string;
  url: string;
  type?: string | null;
  uploadedBy?: number | null;
  uploadedAt?: string | null;
  visibleToStudents?: boolean;
  published?: boolean;
  lessonId?: number | null;
  sessionId?: number | null;
};
```

## Role-Specific Dashboard Principles

### Instructor

Focus on:

- Next class.
- Readiness.
- Attendance.
- Review queue.
- At-risk students.
- Materials.

Avoid by default:

- Tenant setup.
- Billing/platform controls.
- Member administration.
- Broad course governance.

### Student

Focus on:

- Today.
- Due tasks.
- Upcoming sessions.
- Materials.
- Progress.
- Feedback/support.

## Student Experience Audit

### Product Goal

The student experience should answer four questions immediately:

- What should I do next?
- What is due or urgent?
- How am I progressing?
- Where do I get help or feedback?

The current student feature set is already broad: today view, courses, sessions, tasks, homework, materials, recordings, progress, support, and reminders are represented. The main gap is not feature count. The gap is turning those features into a clear learning journey.

### Current Student Strengths

- Student navigation is focused and understandable: Today, To do, Courses, Materials, Progress, and Help.
- Student dashboard data already covers many useful learning objects: courses, sessions, homework, materials, recordings, attendance, certificates, reminders, and support requests.
- Students can submit work and preview materials without leaving the platform.
- Feature flags make it possible to turn homework, attendance, certificates, and other student areas on or off per tenant.
- The reusable material preview modal is a strong foundation for consistent material access across student, instructor, and session screens.

### Main Student UX Gaps

- The dashboard needs one obvious prioritized next action.
- Progress needs to feel like a learning path, not only a collection of stats.
- Course pages need clearer module, lesson, homework, material, and recording structure.
- To-do views should prioritize urgency: due today, overdue, needs revision, waiting for review, and completed recently.
- Feedback from instructors should be easier to discover and act on.
- Materials should be grouped by course, module, and session, with read/unread or new states.
- Student motivation is light. There are opportunities for streaks, milestones, certificates, and progress moments.
- The student dashboard implementation should continue moving toward reusable view components instead of one large page.

### Recommended Student Dashboard

The student dashboard should become a learning cockpit.

Top section:

- Next class or session.
- Next required task.
- Latest instructor feedback.
- New material or recording.
- One primary call to action.

Middle section:

- Today timeline.
- Due tasks.
- Active courses.
- Recent materials.
- Course progress.

Bottom section:

- Calendar.
- Support/help status.
- Certificates or achievements.
- Learning history.

### Next Action Card

Add a student next-action card that chooses one action based on priority:

1. Join a live or upcoming class.
2. Submit overdue homework.
3. Review returned feedback.
4. Continue the next lesson.
5. Open newly published material.
6. Ask for help when blocked.

This should be visible at the top of the student dashboard and mobile view.

Suggested endpoint:

```txt
GET /student/dashboard/next-action
```

Suggested response:

```ts
type StudentNextAction = {
  type:
    | 'join_session'
    | 'submit_homework'
    | 'review_feedback'
    | 'continue_lesson'
    | 'open_material'
    | 'request_help';
  title: string;
  description?: string | null;
  courseId?: number | null;
  groupId?: number | null;
  sessionId?: number | null;
  taskId?: number | null;
  materialId?: number | string | null;
  dueAt?: string | null;
  actionHref?: string | null;
};
```

### Course Learning Map

Each course should show a clear learning path:

- Modules.
- Lessons.
- Sessions.
- Materials.
- Homework.
- Recordings.
- Completion state.
- Next recommended item.

Recommended states:

- Not started.
- Available.
- In progress.
- Completed.
- Locked.
- Needs revision.

Suggested endpoint:

```txt
GET /student/courses/:courseId/map
```

### Student To-Do Center

The To-do page should become a priority center, not only a list.

Recommended groupings:

- Due today.
- Overdue.
- Needs revision.
- Waiting for instructor review.
- Upcoming.
- Completed recently.

Recommended filters:

- Course.
- Type: homework, activity, quiz, material.
- Status.
- Due date.

Suggested endpoint:

```txt
GET /student/tasks/priority
```

### Feedback Center

Students need a dedicated place to understand instructor feedback.

Include:

- Returned homework comments.
- Quiz/activity results.
- Instructor notes visible to student.
- Revision requests.
- Suggested next steps.
- Link back to the relevant course/session/task.

Suggested endpoint:

```txt
GET /student/feedback
```

### Student Progress

Progress should show both performance and behavior.

Recommended blocks:

- Course completion.
- Attendance trend.
- Homework completion rate.
- Recent grades.
- Weak topics or low-score areas.
- Certificate readiness.
- Learning streaks.

Suggested endpoints:

```txt
GET /student/progress/gradebook
GET /student/attendance/summary?courseId=&from=&to=
GET /student/dashboard/engagement
```

### Materials Library

Materials should be easy to scan and revisit.

Recommended improvements:

- Group by course, module, and session.
- Show new/unopened state.
- Show material type: PDF, video, recording, link, document.
- Support preview, open, and download consistently.
- Track whether a student has opened or completed a material.
- Include search and filters.

Suggested endpoints:

```txt
GET /student/materials?courseId=&groupBy=course
PATCH /student/materials/:materialId/seen
```

### Student Help And Support

Help should feel like a conversation, not a one-time form.

Recommended improvements:

- Support request threads.
- Status timeline.
- Attachments.
- Route to instructor, assistant, or platform support.
- Show expected response state.
- Allow students to mark a request resolved.

Suggested endpoints:

```txt
GET /student/support/requests
POST /student/support/requests
GET /student/support/requests/:requestId/messages
POST /student/support/requests/:requestId/messages
PATCH /student/support/requests/:requestId/resolve
```

### Student Engagement

Use gamification carefully. The goal is motivation, not noise.

Recommended additions:

- Attendance streak.
- Homework streak.
- Course milestone badges.
- Certificate progress.
- Weekly learning goal.
- Fast quiz feedback.
- Small success states after completing work.

Avoid:

- Excessive leaderboards.
- Decorative animations that distract from learning.
- Rewarding students only for clicks instead of meaningful progress.

### Frontend Architecture Recommendation

Continue splitting the student dashboard into reusable components:

- `StudentTodayView`
- `StudentNextActionCard`
- `StudentCourseMap`
- `StudentTodoPanel`
- `StudentProgressSummary`
- `StudentMaterialsPanel`
- `StudentFeedbackPanel`
- `StudentHelpPanel`

This will make student UX iteration faster and reduce the risk of one large dashboard file becoming difficult to maintain.

### Assistant

Focus on:

- Operational blockers.
- Missing instructors.
- Missing schedules.
- Missing meeting links.
- Student support context.
- Group readiness.

### Admin

Focus on:

- Tenant setup health.
- Course/group/session operations.
- People and permissions.
- Reports.
- Certificates.
- Platform-managed settings context.

## Modern LMS Engagement Plan

Edubot can feel as modern and engaging as leading LMS and live-learning platforms without copying their visual style directly. The goal should be to combine serious LMS operations with interactive classroom energy.

### Product Positioning

Recommended positioning:

> Edubot is a serious LMS with interactive classroom energy.

This means:

- Admin screens stay calm, operational, and efficient.
- Instructor screens become action-first teaching cockpits.
- Student screens become more visual, motivating, and progress-oriented.
- Live class screens can be more playful and interactive.

### What To Borrow From Modern LMS And Kahoot-Style Products

Borrow the behavior, not only the colors:

- Clear next action.
- Fast feedback after every action.
- Live interaction during class.
- Strong visual progress.
- Low-friction participation.
- Reward and milestone moments.
- Simple, confident screens with less competing information.

### Live Class Interaction

Add a live class mode that supports:

- Live quizzes.
- Polls.
- Quick checks.
- Timed questions.
- Discussion prompts.
- Participation tracking.
- Instant results.
- Optional leaderboards when appropriate.

This should live inside the session workflow, not as a disconnected feature.

Suggested experience:

1. Instructor opens the next session.
2. Instructor clicks **Run Class**.
3. The class screen shows meeting, materials, attendance, and activities.
4. Instructor launches a quiz, poll, or question.
5. Students respond live.
6. Instructor sees results instantly.
7. Session ends with a summary and follow-up checklist.

### Session Activity Player

Create a dedicated teaching screen for live or offline delivery.

Core blocks:

- Meeting or location.
- Attendance.
- Materials.
- Live quiz or poll.
- Activity prompt.
- Homework assignment.
- End-class summary.

This screen should feel more focused than the current session management view. It is for teaching, not configuring.

### Student Engagement

Make the student dashboard feel more like a learning app:

- Today's lesson.
- Join class.
- Due task.
- Latest feedback.
- New materials.
- Progress ring.
- Attendance streak.
- Homework streak.
- Course milestone.
- Certificate progress.

Use gamification carefully:

- Good: progress milestones, streaks, badges, quiz scores, certificates.
- Risky: excessive leaderboards, noisy animations, rewards for administrative behavior.

### Instructor Engagement

Make instructor screens feel fast and purposeful:

- Start next class.
- See class readiness.
- Mark attendance quickly.
- Launch activity or quiz.
- Review submissions.
- See students needing follow-up.
- End class with a summary.

Instructor workflows should feel energetic, but not childish. The instructor is doing professional work.

### Visual Direction

Recommended visual language:

- Light operational base.
- Orange primary action.
- Teal/success accents.
- Blue-gray surfaces.
- Compact 8px cards.
- Strong status chips.
- Meaningful icons.
- Progress bars/rings.
- Clean empty states.
- Small motion for feedback.

Useful microinteractions:

- Button hover and press states.
- Smooth tab transitions.
- Progress animation.
- Toast feedback after saves.
- Skeleton loading.
- Modal entrance animation.
- Success state after completing a workflow.

Avoid:

- Making admin screens game-like.
- Heavy dark mode as the default for teaching operations.
- Oversized decorative dashboard cards.
- Too many equal-weight metrics.
- Animation that slows classroom work.

### Backend Needs For Engagement

Live interaction requires backend support beyond static session data.

Suggested endpoints:

```txt
POST /group-sessions/:sessionId/live-activities
PATCH /group-sessions/:sessionId/live-activities/:activityId/start
PATCH /group-sessions/:sessionId/live-activities/:activityId/end
POST /student/live-activities/:activityId/responses
GET /group-sessions/:sessionId/live-activities/:activityId/results
GET /student/dashboard/engagement
GET /instructor/dashboard/next-action
```

Useful response fields:

```ts
type LiveActivity = {
  id: number;
  sessionId: number;
  type: 'quiz' | 'poll' | 'quick_check' | 'discussion';
  title: string;
  status: 'draft' | 'live' | 'ended';
  startsAt?: string | null;
  endsAt?: string | null;
  participantCount?: number;
  responseCount?: number;
};

type StudentEngagementSummary = {
  attendanceStreak?: number;
  homeworkStreak?: number;
  completedTasks: number;
  pendingTasks: number;
  progressPercent: number;
  latestAchievement?: {
    title: string;
    description?: string;
  } | null;
};
```

### Engagement Implementation Priority

1. Add instructor **Run Class** mode for sessions.
2. Add live quiz/poll activity support.
3. Add student progress and streak widgets.
4. Add session end summary and follow-up checklist.
5. Add achievement/milestone UI.
6. Add optional leaderboard only for quiz-style activities.
7. Add engagement analytics to instructor and student dashboards.

## Suggested Implementation Priority

1. Instructor dashboard next-action strip.
2. Session readiness checklist.
3. Attendance monthly overview and student history.
4. Student risk/follow-up panel.
5. Faster homework review queue.
6. Teaching notes.
7. Material visibility lifecycle.
8. Dashboard visual hierarchy cleanup.

## Acceptance Criteria

- Each role dashboard has one clear primary next action.
- Instructors can see both per-session attendance and monthly/course-level attendance.
- No raw backend status values or translation keys are visible to users.
- Materials use the shared preview modal wherever possible.
- Empty states explain whether there is no data, no access, or disabled functionality.
- Mobile views avoid wide tables where cards are more usable.
- Core workflows pass keyboard, focus, and responsive layout checks.
