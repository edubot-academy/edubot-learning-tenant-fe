# Localization Implementation Plan

Last updated: 2026-05-13.

This document defines the task plan for adding Kyrgyz, Russian, and English localization across the EduBot learning apps.

Important product decision: Kyrgyz (`ky`) is the default language. English (`en`) and Russian (`ru`) are supported alternatives.

## Reviewed Apps

The localization rollout covers three connected projects:

| App | Path | Stack | Current localization state |
| --- | --- | --- | --- |
| Shared backend | `../backend` | NestJS, TypeORM | Company locale exists and defaults to `ky`; certificate and AI/course language fields exist; API does not yet have a central request locale service. |
| Main platform frontend | `../frontend` | Vite, React, JavaScript | Many user-facing strings are hardcoded, mostly Kyrgyz with some English/Russian mixed in; language dropdown markup exists in the header but localization is not wired. |
| Tenant learning frontend | `.` | Vite, React, TypeScript | Tenant locale is available through `activeTenant.locale`; no i18n layer yet; tenant API client sends `X-Company-Id`. |

## Goals

- Make the main platform frontend and tenant learning frontend available in `ky`, `ru`, and `en`.
- Use professional, consistent, education-focused Kyrgyz copy as the primary product language.
- Keep the shared backend language contract simple so the tenant frontend and the main platform can evolve independently.
- Avoid backend-owned UI wording unless the same text is required by both platforms or generated outside the frontend.
- Preserve tenant context, role permissions, feature flags, and existing workflows.
- Keep both frontend apps consistent on language codes, storage keys, API headers, and tenant locale handling.

## Language Policy

Supported languages:

- `ky`: Kyrgyz, default and primary product language.
- `ru`: Russian.
- `en`: English.

Default language resolution order:

- User-selected language from local storage.
- Tenant or company locale when the current view is tenant-scoped.
- Browser language when it is one of `ky`, `ru`, or `en`.
- Default fallback: `ky`.

Fallback behavior:

- Missing `ru` or `en` translations should fall back to `ky`.
- Missing keys must be visible in development and caught by tests or review before release.
- Backend enum values must remain stable machine keys; frontend translates labels locally.

## Backend Contract

The shared backend should provide stable data and locale-sensitive generated content, not frontend UI copy.

Frontend responsibilities:

- Translate navigation, buttons, labels, empty states, validation hints, page titles, statuses, and workflow copy.
- Send the selected language to the backend with `Accept-Language`.
- Translate backend enum values such as course status, attendance status, certificate status, and roles.
- Send tenant scope as `X-Company-Id` where the endpoint requires company isolation.

Backend responsibilities:

- Store tenant default locale as `ky`, `ru`, or `en`.
- Use `Accept-Language` for backend-generated messages, emails, certificates, AI-generated content, and exported documents.
- Return stable codes for statuses, roles, feature flags, and validation error identifiers when practical.
- Avoid returning translated UI labels that are only used by this frontend.
- Allow `Accept-Language` in CORS headers for both frontend apps.

Existing backend facts to preserve:

- `Company.locale` already exists with default `ky`.
- Company create/update DTOs accept `locale`, but currently allow any string up to 16 characters; this should be restricted to `ky`, `ru`, and `en`.
- Backend CORS currently allows `Content-Type`, `Authorization`, `X-CSRF-Token`, `X-Company-Id`, and `X-Tenant-Id`; add `Accept-Language`.
- Company isolation already resolves tenant scope from `X-Company-Id`, `X-Tenant-Id`, body, query, and inferred resources.
- Certificate PDF copy already has language-aware logic and should remain backend-owned because PDFs are generated server-side.
- AI chat/settings fields already support `ru`, `ky`, and `en`; align defaults to the selected or tenant language instead of falling back to Russian.
- Course `languageCode` currently exists separately from UI locale. Keep it as course content language, not application interface language.

## App Connection Setup

### Local Development

Backend:

- Runs on `http://localhost:3000`.
- Must allow local frontend origins `http://localhost:5173`, `http://localhost:5174`, `http://localhost:5175`, and `http://localhost:5176`.
- Must allow request headers: `Content-Type`, `Authorization`, `X-CSRF-Token`, `X-Company-Id`, `X-Tenant-Id`, and `Accept-Language`.

Main platform frontend:

- Path: `../frontend`.
- API base URL is selected by `VITE_REACT_APP_ENV`.
- Existing mappings:
  - `localhost` -> `http://localhost:3000`
  - `staging` -> `https://api.staging.learning.edubot.it.com`
  - `production` -> `https://api.learning.edubot.it.com`
- Auth token storage key: `auth_token`.
- User storage key: `user`.

Tenant learning frontend:

- Path: `.`.
- API base URL comes from `VITE_API_BASE_URL`, defaulting to `http://localhost:3000`.
- Auth token storage key: `edubot_tenant_token`.
- Active tenant storage key: `edubot_active_tenant_id`.
- Tenant scope header: `X-Company-Id`.

Shared localization storage:

- Use one language key across both frontends: `edubot_locale`.
- Allowed values: `ky`, `ru`, `en`.
- Do not share auth token keys between the two frontends.
- Do not use URL language prefixes unless both apps adopt the same routing strategy.

### Staging And Production

Backend environment variables to coordinate:

- `FRONTEND_URL`: main platform frontend URL.
- `TENANT_FRONTEND_URL`: tenant frontend URL.
- `TENANT_APP_URL`: tenant app URL when different from `TENANT_FRONTEND_URL`.
- `CORS_ORIGINS`: comma-separated explicit origins.
- `CORS_ORIGIN_PATTERNS` or `TENANT_CORS_ORIGIN_PATTERNS`: wildcard tenant domains.

Required behavior:

- Main platform and tenant frontend must send the same `Accept-Language` semantics.
- Tenant frontend must continue sending `X-Company-Id`.
- Main platform should send `X-Company-Id` only for tenant-scoped endpoints or CRM integration calls that require it.
- Backend must not infer UI language from tenant scope alone when the user explicitly selected a language.

## Cross-App Language Resolution

Use the same shared language contract in both frontend apps, with different tenant-default behavior by app:

- User-selected language from `edubot_locale`.
- Tenant locale as a runtime fallback in the tenant learning frontend.
- Browser language when it is one of `ky`, `ru`, or `en`.
- Default fallback: `ky`.

Main platform details:

- Public marketing, catalog, auth, cart, favorites, profile, and generic dashboard pages use user-selected language first, then browser language, then `ky`.
- Company admin pages use the main app user's UI language. They display and edit `company.locale` as tenant settings data, but `company.locale` does not decide or change the main app UI language.
- Course content language (`course.languageCode`) must not override UI language.

Tenant frontend details:

- Tenant-hosted views use user-selected language first, then `activeTenant.locale`, then browser language, then `ky`.
- Query tenant override and hostname tenant resolution must not change a user-selected language.
- Tenant settings can update tenant default locale, but should not overwrite the user's explicit language choice.

## Copy Standards

Kyrgyz text must be written in a formal, clear, and professional tone.

- Prefer direct instructional wording.
- Use consistent LMS terminology across all modules.
- Avoid casual phrasing, slang, mixed Russian-Kyrgyz constructions, and overly literal English translations.
- Keep button text short and action-oriented.
- Use respectful, neutral wording for errors and empty states.
- Use the same term for the same product concept everywhere.

Recommended Kyrgyz terminology:

| English concept | Kyrgyz term |
| --- | --- |
| Learning workspace | Окуу мейкиндиги |
| Dashboard / Overview | Жалпы көрүнүш |
| Course | Курс |
| Courses | Курстар |
| Group | Топ |
| Groups | Топтор |
| Session | Сабак |
| Sessions | Сабактар |
| Attendance | Катышуу |
| Homework | Үй тапшырмасы |
| Certificate | Сертификат |
| Members | Катышуучулар |
| Settings | Жөндөөлөр |
| Student / Learner | Окуучу |
| Instructor | Окутуучу |
| Sign in | Кирүү |
| Sign out | Чыгуу |
| Save | Сактоо |
| Cancel | Жокко чыгаруу |
| Create | Түзүү |
| Update | Жаңыртуу |
| Delete | Өчүрүү |
| Submit | Жөнөтүү |
| Search | Издөө |
| Loading | Жүктөлүүдө |
| Empty state | Маалымат жок |
| Feature disabled | Функция өчүрүлгөн |

Example professional Kyrgyz UI copy:

- `Кирүү`
- `Окуу мейкиндигине кириңиз`
- `Окуу мейкиндиги даярдалууда`
- `Курстар жүктөлүүдө`
- `Азырынча тапшырма жок`
- `Жаңы сабактар, тапшырмалар жана материалдар дайындалганда ушул жерде көрүнөт.`
- `Бул функция учурда платформа администратору тарабынан өчүрүлгөн.`
- `Өзгөртүүлөрдү сактоо мүмкүн болгон жок. Кайра аракет кылыңыз.`

## Implementation Tasks

### 1. Add Localization Dependencies

Tasks:

- Add `i18next` and `react-i18next` to both frontend apps.
- Decide whether to use bundled JSON resources first or lazy-loaded locale files.
- Keep the initial setup small and compatible with Vite.

Acceptance criteria:

- Both frontend apps initialize with `ky` as the default language.
- Both builds work without changing existing routing behavior.

### 2. Create I18n Foundation

Tasks:

- Add `src/i18n/config.ts` in the tenant frontend.
- Add the equivalent `src/i18n/config.js` or `src/i18n/config.ts` in the main frontend.
- Add locale files under `src/i18n/locales/{ky,ru,en}/common.json` in both frontend apps.
- Configure supported languages: `ky`, `ru`, `en`.
- Configure fallback language: `ky`.
- Disable natural-language keys; use stable semantic keys.
- Add a typed helper for supported language codes.
- Keep translation key names aligned across apps for shared concepts such as auth, navigation, tenant/company, courses, and certificates.

Acceptance criteria:

- `t('navigation.courses')` resolves in all supported languages.
- Missing translations fall back to Kyrgyz.
- Invalid language codes are ignored.

### 3. Add Language State And Sync

Tasks:

- Add the shared language store key `edubot_locale`.
- Add a `useLocale` or `LocaleProvider` helper.
- Resolve tenant app language from user override, tenant locale when available, browser language, then `ky`. Main platform language does not use `company.locale` as a fallback.
- Sync `document.documentElement.lang` with the active language.
- Send `Accept-Language` from both Axios request interceptors.
- Keep existing auth token storage separate: main app uses `auth_token`, tenant app uses `edubot_tenant_token`.

Acceptance criteria:

- Manual language choice persists across reloads.
- Tenant locale is used by the tenant learning frontend when the user has not selected a language.
- API requests include the selected language.

### 4. Add Language Switcher

Tasks:

- Wire the existing language dropdown location in the main platform header.
- Add a compact language selector in the tenant app shell or settings page.
- Show full language names as `Кыргызча`, `Русский`, `English` in expanded/settings selectors; the tenant shell menu may use compact labels `KG`, `RU`, `US` by product choice.
- Keep the control accessible with a label.
- Do not add unsupported tenant/company-level language changes unless saving to tenant/company settings is already supported.

Acceptance criteria:

- Users can switch between `ky`, `ru`, and `en`.
- The interface updates without a full page reload.
- The selected language does not break tenant or company switching.

### 5. Translate Shared Shell

Tasks:

- Translate tenant app navigation labels in `appNavigation`.
- Translate main platform header, sidebar, footer, user menu, search, cart/favorites labels, and role dashboard navigation.
- Translate sidebar labels, tenant switcher labels, mobile navigation labels, and sign-out actions.
- Translate document titles and route titles.
- Translate shared loading, empty, and error states.
- Translate modal button labels where shared components own the text.

Acceptance criteria:

- Both app shells have no hardcoded user-facing English text.
- Route titles use the active language.
- Mobile and desktop navigation use the same translation keys.

### 6. Translate Auth Flows

Tasks:

- Translate login, signup, password reset, and account setup screens across both frontend apps.
- Translate auth form labels, placeholders, validation messages, success messages, and errors.
- Keep tenant-specific names untranslated.
- Review Kyrgyz auth copy carefully for clarity and trust.

Acceptance criteria:

- A user can complete login, reset, and setup flows in Kyrgyz.
- Error messages are professional and actionable.
- Toast messages match page-level error wording.

### 7. Translate Student Experience

Tasks:

- Translate student dashboard sections, stats, action cards, tasks, materials, attendance, homework, and certificates.
- Translate empty states with clear learner-facing guidance.
- Translate progress and due-date labels.
- Keep course titles, group names, material titles, and instructor names as backend data.

Acceptance criteria:

- Student-facing Kyrgyz copy is polished and consistent.
- Empty states explain what will appear and when.
- Status labels are translated from stable enum keys.

### 8. Translate Staff Workflows

Tasks:

- Translate Overview, Courses, Groups, Sessions, Attendance, Homework, Certificates, Members, and Settings.
- Translate main platform instructor, assistant, admin, company, catalog, course builder, cart, favorites, profile, leaderboard, and analytics surfaces.
- Translate forms, filters, tabs, tables, cards, status badges, and confirmation modals.
- Translate operational readiness messages and disabled-state explanations.
- Keep backend-provided entity names unchanged.

Acceptance criteria:

- Staff, admin, instructor, assistant, and company users can operate current workflows in Kyrgyz.
- Russian and English translations cover the same key set.
- No workflow depends on English-only labels.

### 9. Localize Formatting

Tasks:

- Update date, time, number, and percent formatting helpers to accept the active language.
- Use `ky-KG`, `ru-RU`, and `en-US` or `en` formatting intentionally.
- Keep tenant timezone behavior unchanged.
- Check certificate dates, session dates, attendance dates, and dashboard stats.

Acceptance criteria:

- Dates and numbers follow the selected language.
- Timezone handling remains tenant-aware.
- Formatting changes do not alter stored backend values.

### 10. Improve Settings Locale Field

Tasks:

- Replace free-text locale input with a supported-language select where tenant locale is edited.
- Save only `ky`, `ru`, or `en`.
- Make `ky` the default visible option.
- Explain that tenant locale is the default language for users who have not chosen their own language.

Acceptance criteria:

- Invalid tenant locale values cannot be submitted from the UI.
- Existing tenant locale data still displays safely.
- Tenant locale changes do not overwrite a user-selected language unless explicitly chosen.

### 11. Add Translation Quality Checks

Tasks:

- Add a script or test that verifies all locale files have the same keys.
- Add tests for language resolution priority.
- Add tests for shared navigation labels in all languages.
- Add review checklist items for Kyrgyz copy quality.

Acceptance criteria:

- CI or local tests catch missing translation keys.
- Navigation and shared shell translation behavior is covered.
- Reviewers have a repeatable Kyrgyz copy checklist.

### 12. Release QA

Tasks:

- Test Kyrgyz, Russian, and English across desktop and mobile.
- Test light and dark themes.
- Test login, tenant switching, student dashboard, staff overview, course/group/session workflows, attendance, homework, certificates, members, and settings.
- Check long Kyrgyz strings for layout overflow.
- Check buttons, tabs, cards, table headers, mobile navigation, and modals.

Acceptance criteria:

- Kyrgyz is production-ready as the default language.
- Russian and English have complete key coverage.
- No visible hardcoded English remains in the primary workflows of either frontend app.
- Layout remains stable with longer Kyrgyz and Russian strings.

### 13. Backend Locale Infrastructure

Tasks:

- Add a central supported-locale helper in the backend, for example `SUPPORTED_LOCALES = ['ky', 'ru', 'en']`.
- Add a request locale resolver that reads `Accept-Language`, normalizes regional codes such as `ky-KG`, `ru-RU`, and `en-US`, and falls back to `ky`.
- Add `Accept-Language` to backend CORS `allowedHeaders`.
- Restrict company `locale` DTO validation to `ky`, `ru`, and `en`.
- Normalize existing invalid company locale values to `ky`, `ru`, or `en` through migration or service-level cleanup.
- Add `req.locale` or a request-scoped helper only if multiple backend services need it; otherwise pass resolved locale explicitly.
- Return stable validation error codes where practical so frontends can translate messages consistently.

Acceptance criteria:

- Backend accepts `Accept-Language` from both frontend apps.
- Company locale cannot be saved as unsupported free text.
- Backend-generated emails, certificates, AI prompts, and exports have a clear locale source.
- Existing tenant/company APIs remain backward compatible.

### 14. Main Platform Frontend Setup

Tasks:

- Add the same i18n foundation used by the tenant frontend.
- Wire `edubot_locale` into the existing header language menu.
- Add `Accept-Language` in `src/shared/api/client.js`.
- Keep existing CSRF and bearer-token behavior unchanged.
- Replace hardcoded header navigation labels, search copy, dashboard labels, and shared UI labels first.
- Replace mixed-language text in company, admin, instructor, student, course, cart, favorite, profile, and certificate pages incrementally.
- Treat `course.languageCode` as content metadata only.
- Treat `company.locale` as tenant settings data in the main app. Do not use it to decide main app UI language.

Acceptance criteria:

- The main platform language switcher works and persists across reloads.
- Main platform API requests include `Accept-Language`.
- Header, auth, public catalog, and company/admin shell are available in Kyrgyz, Russian, and English.
- No existing auth, cart, favorites, or CSRF behavior regresses.

### 15. Tenant Frontend Setup

Tasks:

- Add the i18n foundation to this tenant frontend.
- Use `activeTenant.locale` as the tenant default language when no user override exists.
- Add `Accept-Language` in `src/services/api.ts`.
- Keep `X-Company-Id` behavior unchanged.
- Replace the tenant Settings free-text locale input with a supported-language select.
- Translate app shell, auth, student dashboard, staff workflows, certificates, members, and settings.

Acceptance criteria:

- Tenant-hosted domains use tenant locale by default.
- User-selected language overrides tenant locale.
- Tenant API requests include both `X-Company-Id` and `Accept-Language` when applicable.
- Tenant locale editing only permits `ky`, `ru`, and `en`.

### 16. Cross-App Integration Tests

Tasks:

- Add backend tests for locale parsing and company locale validation.
- Add main frontend tests for language resolution, header switcher behavior, and `Accept-Language`.
- Add tenant frontend tests for tenant locale fallback, user override, and `Accept-Language` plus `X-Company-Id`.
- Add translation key parity tests in both frontend apps.
- Add a manual integration checklist for local, staging, and production app connections.

Acceptance criteria:

- Missing locale keys fail local tests.
- Unsupported locale values cannot be saved through backend DTOs.
- Both frontend apps send the same selected language to the shared backend.
- Tenant-scoped requests still include the correct company header.

## App Connection Checklist

Before shipping localization, verify:

- Backend local URL: `http://localhost:3000`.
- Main platform local frontend: usually `http://localhost:5173`.
- Tenant frontend local URL: use the next available Vite port, commonly `http://localhost:5174`.
- Backend CORS allows both frontend origins.
- Backend CORS allows `Accept-Language`.
- Main platform API base URL resolves from `VITE_REACT_APP_ENV`.
- Tenant frontend API base URL resolves from `VITE_API_BASE_URL`.
- Main platform auth still works with `auth_token`, cookie auth, and CSRF.
- Tenant frontend auth still works with `edubot_tenant_token`.
- Tenant frontend still sends `X-Company-Id`.
- Main platform company/tenant admin pages display and edit `company.locale`.
- Tenant frontend settings display and edit `activeTenant.locale`.
- Certificate generation still uses explicit certificate language where selected.
- AI chat/course generation uses explicit content language or course language, not the UI locale by accident.

## Suggested Translation Key Structure

Use semantic keys grouped by product area:

```json
{
  "navigation": {
    "overview": "Жалпы көрүнүш",
    "courses": "Курстар",
    "groups": "Топтор",
    "sessions": "Сабактар"
  },
  "actions": {
    "save": "Сактоо",
    "cancel": "Жокко чыгаруу",
    "signOut": "Чыгуу"
  },
  "states": {
    "loadingWorkspace": "Окуу мейкиндиги даярдалууда",
    "featureDisabled": "Функция өчүрүлгөн"
  }
}
```

Rules:

- Do not use English phrases as translation keys.
- Do not translate backend entity names.
- Keep keys stable even if wording changes.
- Prefer full-sentence translations for empty states and validation messages.

## Rollout Order

Recommended order:

- Backend: supported locale helper, CORS `Accept-Language`, DTO validation, request locale resolver.
- Shared frontend foundation: dependencies, config, language resolution, request header in both apps.
- Main platform shell: header language switcher, public navigation, auth, search, user menu.
- Tenant frontend shell: navigation, layout, document titles, shared states.
- Tenant auth screens.
- Tenant student dashboard.
- Tenant staff overview.
- Tenant Courses, Groups, Sessions.
- Tenant Attendance and Homework.
- Tenant Certificates.
- Tenant Members and Settings.
- Main platform admin/company/instructor/student surfaces.
- Formatting, tests, cross-app connection QA, and final copy review.

## Open Decisions

- Whether the main platform will share the same locale key names or keep separate frontend translation files.
- Whether backend validation errors will return stable error codes for frontend translation.
- Whether generated certificates should use tenant locale, selected user locale, or explicit certificate language.
- Whether user profile locale should be added later as a backend preference.
- Whether the backend should persist per-user UI locale in addition to tenant/company locale.
- Whether public marketing pages should honor browser language before `edubot_locale` when no user is signed in.
