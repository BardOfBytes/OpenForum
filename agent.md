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

Phase 0 and the main frontend/backend migration slices are complete. The project now has the Supabase public schema applied remotely, frontend theme/dark-mode foundations, migrated article browsing/detail experience, backend article mutation endpoints, public profile/follow-state endpoints, article social-state endpoints, and frontend article/comment/action controls. Articles and public author profiles should be publicly readable, while writing, editing, deleting, commenting, liking, bookmarking, following, profile changes, and moderation require authenticated CSVTu users. The migration is still in progress: write cover-image/edit-flow polish, final browser QA, deployment env confirmation, and production smoke testing remain.

Resolved local blockers:
- The earlier local CSS/static preview issue was reported as fixed by the user.
- Production web builds now skip remote API fetches during `next build`, so unavailable DNS for `openforum-api.onrender.com` no longer pollutes or risks the build.

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

### Phase 1C: Public Article Detail Access

- Updated `apps/web/src/middleware.ts` so published article detail routes are public.
- Kept protected route behavior for `/write`, `/profile`, and `/search`.

### Resolved Product Decisions

- Authentication is student-only. Allowed domains are `@csvtu.ac.in` and `@students.csvtu.ac.in`.
- Published articles are public.
- Article creation, rewrite/editing, updating, deletion, comments, likes, bookmarks, follows, and profile changes require authentication.
- Public profiles should expose only display name, avatar, bio, follower count, and published-article stats/articles.
- Public profiles must not expose private fields such as email, roll number, auth provider, bookmarks, drafts, or internal account metadata.
- Comments follow a YouTube-style access model:
  - public readers can read articles and comments.
  - only authenticated CSVTu users can create comments.
  - comment authors can edit/delete their own comments.
  - editors/admins can hide/delete any comment for moderation.
  - no approval queue is required for launch unless abuse becomes a problem.
- Role model:
  - every valid CSVTu user can write and comment.
  - editors/admins exist only for moderation, emergency control, and platform maintenance.
  - normal users must never be able to edit/delete another user's article or comment.
- Data/API strategy:
  - the frontend should use the Rust API as the main gateway for product behavior.
  - Supabase should provide Auth, Postgres, and RLS as the database/security foundation.
  - direct browser access to Supabase tables should not be used for core product flows.
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

Next:
- Debug local CSS/static asset loading before continuing UI polish:
  - Verify `globals.css` is imported and compiled.
  - Verify `/_next/static/css/*` requests are not being blocked or routed through middleware incorrectly.
  - Clear/rebuild `.next` if the dev cache is stale.
  - Confirm the navbar logo has explicit intrinsic dimensions so it cannot dominate the page if utility CSS fails.
- Finish the home page with the Downloads-style editorial hierarchy while preserving real article data.
- Polish About, Guidelines, Privacy, and Terms pages with the new visual system.
- Upgrade login/signup toward the Downloads split-screen editorial design.
- Continue write page migration:
  - Cover image drag/drop polish.
  - Sticky topbar and publish controls.
  - Subtitle/summary handling if the backend contract supports it.
  - Writing stats/read-time surface.
  - Preserve the current advanced Tiptap features.
- Add or polish profile pages once API/profile contracts are clear.
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
- Review profile fetch/update flow and decide whether Supabase REST remains the best path or direct Postgres is cleaner.
- Add editor/admin moderation endpoints for hiding/deleting any comment.
- Add backend tests for explicit auth domain rejection and RLS-compatible data access.

### Phase 4: Frontend API Integration

Status: in progress.

Done:
- Article listing and article detail still use real server-side data.
- Article action buttons now call real like/bookmark endpoints.
- Article comments UI now reads public comments and posts authenticated comments.
- Article authors/editors/admins now get inline article edit/delete controls on detail pages.
- Comment authors now get inline comment edit/delete controls.

TODO:
- Deploy or run the updated Rust API where the web app points, otherwise the new article/comment controls will hit missing endpoints.
- Connect profile pages to real profile/article/follow data.
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

## Finalized Product Rules

- Public article reading is open to everyone.
- Public profile pages expose only display name, avatar, bio, follower count, and published-article stats/articles.
- Writing, commenting, liking, bookmarking, following, and profile edits require authenticated CSVTu users.
- All valid CSVTu users can write and comment.
- Editors/admins are reserved for moderation and emergency control.
- Comment authors can edit/delete their own comments.
- Editors/admins can hide/delete any comment.
- There is no comment approval queue for launch.
- The frontend should talk to the Rust API for core product behavior.
- Supabase remains the Auth/Postgres/RLS foundation, not the browser-facing product API for core flows.

## Remaining Deployment Steps

1. Finish write/edit flow polish:
   - cover image drag/drop UX.
   - full article edit route or `/write?slug=...` flow.
2. Implement editor/admin comment moderation:
   - hide/delete any comment.
   - UI controls visible only to editor/admin roles.
3. Run end-to-end local smoke test:
   - login.
   - create article.
   - upload image.
   - publish.
   - like/bookmark/comment/follow.
   - edit/delete article and comment.
4. Deploy updated Rust API to Render and smoke test new endpoints.
5. Deploy updated web app to Vercel and run production QA.

## Working Rules For Future Agent Work

- Use the GitHub Next app as the base. The Downloads app is a design reference, not the replacement runtime.
- Preserve the advanced Tiptap editor unless a change explicitly improves it.
- Keep edits scoped to the active migration phase.
- Do not commit or print secrets.
- Prefer real data paths over mock data.
- Route core product behavior through the Rust API. Do not add direct browser-to-Supabase table access for articles, comments, profiles, likes, bookmarks, follows, uploads, or moderation.
- Keep Supabase RLS enabled and treat it as a security backstop even when the Rust API is the primary gateway.
- Public profile UI must never expose private account data. Show only display name, avatar, bio, follower count, and published-article stats/articles.
- Preserve the comment policy: public read, authenticated CSVTu commenting, author edit/delete, editor/admin moderation, no approval queue for launch.
- Preserve the role policy: all valid CSVTu users can write/comment; editors/admins are only for moderation and emergency control.
- When adding moderation features, enforce permissions in the Rust API first, then reflect them in the frontend UI.
- After visible frontend changes, run typecheck, tests, and build when practical.
- After backend or database changes, verify both schema behavior and application behavior.
- Keep this file updated whenever a phase starts, completes, or changes direction.
