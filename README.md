# EduBot Learning Tenant FE

Frontend tenant workspace for EduBot Learning. The app lets tenant users manage learning operations across courses, groups, sessions, attendance, homework, certificates, members, settings, and student-facing work.

## Tech Stack

- React 19
- TypeScript
- Vite
- React Router
- Axios
- Tailwind CSS and custom app CSS
- Vitest with jsdom

## Requirements

- Node.js `22.13+` recommended.
- npm.
- EduBot Learning backend API reachable from the browser.

The current local Node version may still run the project, but dependency installation can show an engine warning below Node `22.13`.

## Environment

Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

Set the backend API base URL:

```bash
VITE_API_BASE_URL=http://localhost:3000
```

## Setup

```bash
npm install
```

## Scripts

```bash
npm run dev
```

Starts the Vite dev server.

```bash
npm run test
```

Runs Vitest tests in jsdom.

```bash
npm run lint
```

Runs ESLint.

```bash
npm run build
```

Runs TypeScript no-emit checks for app and config files, then builds with Vite.

```bash
npm run preview
```

Serves the production build locally.

## App Areas

- Auth: login, profile loading, sign-out, and expired-session handling.
- Tenant context: tenant loading, tenant switching, active tenant persistence, retryable tenant-load errors.
- Overview: tenant dashboard, setup progress, quick actions, activity, and feature-aware stats.
- Courses: tenant catalog, group detail, session summary, group roster, student progress filters.
- Sessions: group/session management, generated sessions, enrollments, live meetings, materials, activities, insights.
- Attendance: session roster attendance, filters, bulk marking, save flow.
- Homework: assignment lists, creation/editing/deletion, review roster, submission review.
- Certificates: tenant branding, course rules, registry, issue/approve/reject/revoke/regenerate flows.
- Members: tenant member listing, invitations, invite links, role changes, removals.
- Settings: tenant profile, logo upload, appearance, access context, platform-managed values, feature flags.
- Student workspace: learner dashboard, homework/activity submissions, file upload, quiz attempts.

## Project Structure

```text
src/app              Route tree and top-level app composition
src/components       Shared UI components
src/features         Feature modules by workspace area
src/lib              Shared helpers
src/services         API client and endpoint wrappers
src/styles           App-wide CSS
src/types            Domain model types
public               Static app assets
```

## Versioning

Releases follow Semantic Versioning. See [CHANGELOG.md](./CHANGELOG.md) for versioning rules, release notes, and the current first release entry.

## Generated Files

Do not commit generated output:

- `dist`
- `node_modules`
- `.env`
- `*.tsbuildinfo`
- generated `vite.config.js`
- generated `vite.config.d.ts`

The build script uses TypeScript no-emit checks to avoid generating root-level TypeScript build artifacts.

## Security Notes

- The frontend expects authentication and tenant authorization to be enforced by the backend.
- Bearer tokens are stored in `sessionStorage`; legacy local token values are cleared on new login and sign-out.
- Active tenant IDs are stored locally for workspace convenience and sent through the `X-Company-Id` header.
- Keep `.env` local and use `.env.example` for documented defaults only.

## Verification Baseline

Before releasing or handing off changes, run:

```bash
npm run test
npm run lint
npm run build
```
