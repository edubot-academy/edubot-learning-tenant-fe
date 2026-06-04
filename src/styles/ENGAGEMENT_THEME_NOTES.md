# EduBot Engagement Theme Guardrails

This PR introduces a **Phase 1 CSS-only visual overlay** for student and instructor learning surfaces.

The current implementation uses `body:has(...)` selectors to avoid touching route logic, API calls, permissions, or React component behavior in this PR. That is acceptable for validating the QuestLMS-inspired visual direction, but it should not become the long-term styling architecture.

## Current scope

The theme is intended only for learning/teaching surfaces such as:

- `.student-workspace-grid`
- `.student-progress-summary`
- `.student-today-sessions-section`
- `.course-action-grid`
- `.course-context-strip`

Tenant/company operations pages should remain clean and professional, outside the engagement styling.

## Follow-up architecture rules

1. Add an explicit `.engagement-theme` class to student/instructor dashboard shells.
2. Replace `body:has(...)` selectors with wrapper-based selectors.
3. Introduce proper dashboard components:
   - `TenantDashboardShell`
   - `DashboardPageHeader`
   - `Card`
   - `Button`
   - `StatCard`
   - `HeroCard`
   - `TaskCard`
4. Replace broad selectors like `button:not(...)` with explicit reusable variants:
   - `.primary-button`
   - `.secondary-button`
   - `.ghost-button`
   - `.danger-button`
   - `.icon-button`
5. Keep tenant/company operations outside the engagement wrapper.
6. Split student and instructor tone only when component structure exists:
   - `.engagement-theme--student`
   - `.engagement-theme--instructor`

## Merge expectation

This PR may be merged as a controlled visual experiment if Vercel passes and visual QA is acceptable.

The next PR should focus on componentization, not additional CSS overlay layers.
