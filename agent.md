# OpenForum Migration Agent Notes

Last updated: 2026-06-05

This file is the working control document for migrating the production GitHub OpenForum repo toward the newer Downloads/Replit UI while preserving the real backend, auth, data, editor, and deployment behavior.

## Repo Dynamic

- Main repo: `/Users/abhaysinghsisoodiya/Documents/GitHub/OpenForum`.
- Source UI reference: `/Users/abhaysinghsisoodiya/Downloads/OpenForum`.
- Production app shape: monorepo with `apps/web` as a Next.js App Router frontend and `apps/api` as a Rust Axum backend.
- Frontend baseline: real Next app with server routes, Supabase auth flow, advanced Tiptap write experience, article pages, middleware, and tests.
- Downloads UI baseline: Vite SPA prototype with stronger editorial visuals, dark mode, Framer Motion, polished auth/write/article layouts, and mock data.
- Migration strategy: migrate UI and UX selectively into the GitHub Next app. Do not replace the production architecture with the Vite prototype.
- Styling constraint: GitHub app uses Tailwind v3 patterns. Downloads app uses a newer token style. Port tokens/classes intentionally; do not blindly copy Tailwind v4 directives.
- Component constraint: avoid importing a large shadcn/Radix surface unless a component is actually needed. Prefer existing local patterns and small custom components.
- Secrets: `supabase_creds.txt` and `Render.env` are local-only and ignored. Do not commit or quote credential values.
- Supabase note: schema has already been applied directly to the existing project. Do not commit Supabase migration files for this migration unless that decision changes.

## Current Status

Phase 0 and the first frontend migration slices are complete. The project now has the Supabase public schema applied remotely, frontend theme/dark-mode foundations, migrated article browsing/detail experience, backend article mutation endpoints, and frontend article/comment action controls. Articles should be publicly readable, while writing, editing, deleting, profile changes, and social actions require authenticated CSVTu users. The migration is still in progress: local CSS/static loading needs debugging, write page polish, profile/social screens, current-user interaction state, and full deployment verification remain.

Current local blocker:
- The local dev preview at `localhost:3000` showed the raw `/icon.png` logo at full size, which indicates the CSS/static asset pipeline was not loading correctly in the browser. The dev server has been stopped. Fixing this should be the first next task before more visual QA.

## Completed Work

### Phase 0: Audit, Safety, Database Foundation

- Reviewed the Downloads implementation plan and identified stale/risky assumptions.
- Confirmed the production GitHub repo should remain the source of truth.
- Added local secret files to `.gitignore`: `supabase_creds.txt`, `Render.env`.
- Created `scripts/apply_supabase_public_schema.py` to apply schema from local Supabase credentials without exposing secrets.
- Created `supabase/migrations/002_create_openforum_public_schema.sql`.
- Applied and verified the public Supabase schema remotely via the pooler connection.
- Verified remote tables: `profiles`, `articles`, `bookmarks`, `likes`, `comments`, `follows`.
- Verified RLS policy counts:
  - `profiles`: 3
  - `articles`: 5
  - `bookmarks`: 3
  - `likes`: 3
  - `comments`: 4
  - `follows`: 3

### Phase 1A: Frontend UI Foundation

- Added dark-mode design tokens in `apps/web/src/app/globals.css`.
- Added theme bootstrapping and toggle components:
  - `apps/web/src/components/theme/ThemeScript.tsx`
  - `apps/web/src/components/theme/ThemeToggle.tsx`
- Updated `apps/web/src/app/layout.tsx` to avoid theme hydration mismatch.
- Added theme toggle support to `apps/web/src/components/layout/Navbar.tsx`.
- Migrated major hardcoded light-mode surfaces to token-based styling:
  - Login
  - Signup
  - Auth error
  - Write shell
  - Write form
  - Article editor
  - Slash command menu
  - Code block language UI
- Removed an unused `Image` import from `apps/web/src/components/layout/Footer.tsx`.

### Phase 1B: Article Browse And Detail UI

- Added a real-data article explorer at `apps/web/src/components/articles/ArticlesExplorer.tsx`.
- Added category filter pills at `apps/web/src/components/articles/CategoryPill.tsx`.
- Added article reading progress at `apps/web/src/components/articles/ReadingProgress.tsx`.
- Added article share/copy/bookmark action UI at `apps/web/src/components/articles/ArticleActions.tsx`.
- Updated `apps/web/src/app/articles/page.tsx` to render the new explorer while keeping server-side article fetching.
- Updated `apps/web/src/app/articles/[slug]/page.tsx` with reading progress and action controls.
- Confirmed legacy redirects already exist for older route shapes such as `/feed`, `/article/[slug]`, and `/category/[slug]`.

### Phase 1D: Downloads UI Migration Slice

- Migrated the home hero toward the Downloads editorial hierarchy: latest issue badge, large Fraunces headline, and read/write CTAs.
- Added `apps/web/src/components/home/HomeFeed.tsx` for interactive category filtering on the home page using real article data instead of mock data.
- Migrated login/signup into a shared split-screen editorial auth frame at `apps/web/src/components/auth/AuthFrame.tsx`.
- Polished the write shell with a sticky OpenForum Studio topbar, draft status, reading stats, and stronger metadata layout while preserving the existing advanced Tiptap editor.
- Added a protected `/profile` route with current-user profile loading/updating through `/api/v1/users/me`.
- Updated the navbar so authenticated users can open their profile without being signed out unexpectedly.

### Phase 1C: Public Article Detail Access

- Updated `apps/web/src/middleware.ts` so published article detail routes are public.
- Kept protected route behavior for `/write`, `/profile`, and `/search`.

### Resolved Product Decisions

- Authentication is student-only. Allowed domains are `@csvtu.ac.in` and `@students.csvtu.ac.in`.
- Published articles are public.
- Article creation, rewrite/editing, updating, deletion, comments, likes, bookmarks, follows, and profile changes require authentication.
- GitHub OAuth is acceptable only when the GitHub account exposes an allowed school email. Many students may need Google OAuth because GitHub accounts often use personal email addresses.
- Google Sheets and Google Drive providers should be removed from the production path.
- No old data migration is required. OpenForum is starting fresh on the new schema.
- Supabase migration files should not be pushed for this migration.
- Social/article interaction features should work end to end, not remain as static UI placeholders.

### Phase 2A: Supabase RLS Hardening

- Tightened profile insert/update policies so `profiles.email` must match the authenticated Supabase JWT email.
- Kept RLS enabled on every public table.
- Re-applied the public schema to the live Supabase project and verified expected table/policy counts.

### Phase 3A: Cloudinary Delivery URL Optimization

- Confirmed the API uses a custom Rust signed upload implementation through `reqwest`, not an official Cloudinary SDK.
- Upload-time transformation already existed with `c_limit,w_1600,h_1600,q_auto:good`.
- Updated Cloudinary upload responses to return optimized delivery URLs containing `f_auto/q_auto`.
- Added API test coverage that asserts returned Cloudinary URLs include `/image/upload/f_auto/q_auto/`.

### Phase 3B: Provider Cleanup

- Removed Google Sheets and Google Drive from compiled backend modules.
- Simplified API configuration so Postgres/Supabase and Cloudinary are required directly.
- Simplified API startup so it always initializes Postgres article storage and Cloudinary uploads.
- Replaced the old Sheets-backed integration test harness with an explicit in-memory article backend.
- Updated backend env examples and deployment docs to remove Google provider setup.

## Verification So Far

- `pnpm --filter @openforum/web typecheck` passed.
- `pnpm --filter @openforum/web test:run` passed.
- `pnpm --filter @openforum/web build` passed after allowing network access.
- `cargo test` passed for the Rust API.
- `cargo build` passed for the Rust API.
- `python3 scripts/apply_supabase_public_schema.py` applied and verified the live Supabase schema.
- Dev smoke test by HTTP:
  - `/` returned 200.
  - `/login` returned 200.
  - `/auth/error` returned 200.
  - `/write` returned 307 to login while unauthenticated, which is expected.

## Phase-Wise TODO

### Phase 1: Frontend UI Migration

Status: in progress.

Done:
- Theme/dark-mode foundation.
- Auth/write/editor token cleanup.
- Article archive and article detail polish.
- Home hero/feed migration with real-data category filtering.
- Split-screen auth page migration for login/signup.
- First profile page surface backed by the Rust API.
- Write shell polish while preserving advanced editor features.

Next:
- Debug local CSS/static asset loading before continuing UI polish:
  - Verify `globals.css` is imported and compiled.
  - Verify `/_next/static/css/*` requests are not being blocked or routed through middleware incorrectly.
  - Clear/rebuild `.next` if the dev cache is stale.
  - Confirm the navbar logo has explicit intrinsic dimensions so it cannot dominate the page if utility CSS fails.
- Finish remaining home page details after browser QA, if the Downloads reference still has gaps.
- Polish About, Guidelines, Privacy, and Terms pages with the new visual system.
- Continue write page migration:
  - Cover image drag/drop polish.
  - Subtitle/summary handling if the backend contract supports it.
  - Preserve the current advanced Tiptap features.
- Continue profile polish:
  - public author profile pages.
  - follow state/count display.
  - richer author article tabs.
- Run a complete mobile and dark-mode visual pass.

### Phase 2: Supabase Database And Data

Status: schema applied remotely, hardening in progress, application wiring not complete.

Done:
- Public schema created and verified in the existing Supabase project.
- Supabase Auth already exists in the project.

Next:
- Verify RLS behavior with anon and authenticated tokens, not only table/policy existence.
- Ensure profile insert/update policies bind `profiles.email` to the actual Supabase JWT email.
- Keep public read grants limited to published articles and public profile/comment/social read surfaces.
- Run Supabase database advisors if Supabase CLI or plugin access is available.
- Confirm final environment variable names for local, Render, and Vercel deployments.
- Document canonical source of truth for data after migration: Supabase Postgres.

### Phase 3: Backend API Migration

Status: in progress.

Goals:
- Make Supabase/Postgres the primary article/profile data path.
- Keep the Rust Axum API as the orchestrator.
- Remove legacy Google Sheets and Google Drive providers.

Done:
- Removed `ARTICLES_PROVIDER=sheets` and `STORAGE_PROVIDER=drive` branches from production code.
- Made Postgres/Supabase and Cloudinary the only supported production data/storage path.
- Deleted legacy Google Sheets and Google Drive service modules.
- Updated backend deployment docs and env examples for Postgres/Supabase + Cloudinary.
- Updated Postgres article list/detail reads to join `public.profiles` for real author names and avatars.
- Added article `PATCH` and `DELETE` endpoints against the Postgres/Supabase schema.
- Added like/bookmark/comment/follow API endpoints.
- Added backend integration coverage for article update/delete and social flows.

TODO:
- Add API response fields or a state endpoint for initial current-user social state:
  - whether the current user liked the article.
  - whether the current user bookmarked the article.
  - whether the current user follows the author.
- Review profile fetch/update flow and decide whether Supabase REST remains the best path or direct Postgres is cleaner.
- Add backend tests for explicit auth domain rejection and RLS-compatible data access.

### Phase 4: Frontend API Integration

Status: in progress.

Done:
- Article listing and article detail still use real server-side data.
- Article action buttons now call real like/bookmark endpoints.
- Article comments UI now reads public comments and posts authenticated comments.
- Article authors/editors/admins now get inline article edit/delete controls on detail pages.
- Comment authors now get inline comment edit/delete controls.
- Current-user profile page now reads/updates through the authenticated Rust API.

TODO:
- Fix the local CSS/static loading issue before relying on browser screenshots for UI acceptance.
- Deploy or run the updated Rust API where the web app points, otherwise the new article/comment controls will hit missing endpoints.
- Add public author profile pages and follow UI backed by real profile/article/follow data.
- Verify publish/edit/delete flows from `/write` against the selected backend provider.
- Decide whether article editing should remain inline on detail pages or move into a full `/write?slug=...` / edit route using the richer editor.
- Improve empty, loading, and error states for all API-backed screens.
- Ensure unauthenticated, unauthorized, and non-CSVTu-domain users see clear states.

### Phase 5: Verification And Deployment

Status: pending.

TODO:
- Run web checks after each frontend slice:
  - `pnpm --filter @openforum/web typecheck`
  - `pnpm --filter @openforum/web test:run`
  - `pnpm --filter @openforum/web build`
- Run backend checks after API work:
  - `cargo test`
  - `cargo build`
- Verify end-to-end flows:
  - Login with Supabase Auth.
  - Create article.
  - Upload cover image.
  - Publish article.
  - View article detail.
  - Like/bookmark/comment/follow.
  - Logout and public/blocked route behavior.
- Perform visual QA on desktop and mobile.
- Verify dark mode across all main routes.
- Confirm Render/Vercel environment variables and deployment settings.
- Check production logs after first deploy.

## Open Decisions

- Should public profile pages expose full profile information or only display name, avatar, bio, and published-article stats?
- Should comments be public-readable with hidden/deleted moderation states, or should moderation be added before public release?
- Should student-only write access require any extra role gate beyond allowed email domain, such as `writer`, `editor`, or `admin`?
- Should the Data API remain enabled for public schema tables, or should the app rely only on the Rust API after backend integration is complete?

## Working Rules For Future Agent Work

- Use the GitHub Next app as the base. The Downloads app is a design reference, not the replacement runtime.
- Preserve the advanced Tiptap editor unless a change explicitly improves it.
- Keep edits scoped to the active migration phase.
- Do not commit or print secrets.
- Prefer real data paths over mock data.
- After visible frontend changes, run typecheck, tests, and build when practical.
- After backend or database changes, verify both schema behavior and application behavior.
- Keep this file updated whenever a phase starts, completes, or changes direction.
