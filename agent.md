# OpenForum Migration Agent Notes

Last updated: 2026-06-07 (UI port complete; infra migration to Singapore in progress)

This file is the working control document for migrating the production GitHub OpenForum repo to the newer Downloads/Replit UI while preserving the real backend, auth, data, editor, and deployment behavior.

## Mission (confirmed 2026-06-07)

Port the **entire** Downloads/Replit OpenForum UI into the production Next app, **pixel-faithfully**, route by route and component by component — and wire the backend (new Rust APIs + curated Supabase schema) for any data the design needs. The Downloads/Replit UI is the visual golden source. The final production app must not look like the older GitHub OpenForum UI on any route, component, color system, spacing system, header, footer, card, form, empty state, or interaction surface.

Locked decisions (2026-06-07):
- **Fidelity: pixel-faithful.** Downloads is the law for layout/spacing/fonts/colors/icons. Where Downloads shows data prod lacks, ADD the backend API + Supabase column (do not fake it).
- **Animations: add/port Framer Motion** for full parity (framer-motion is already installed).
- **Extra prod-only routes** (`/guidelines` `/privacy` `/terms`): keep but restyle to the design system. Drop throwaway routes like `/shinchan`.

Authoritative working docs for this effort:
- `docs/ui-port-audit.md` — evidence: route-by-route Downloads-vs-prod diff + backend/DB gap list. **Root finding: a shadcn token vocabulary (`bg-primary`/`bg-card`/`text-foreground`/`font-serif`) is used by every migrated + Downloads component but is undefined in the prod Tailwind theme, so migrated surfaces are partly unstyled today — fixing the token layer is Slice 0 and unblocks everything.**
- `docs/ui-port-plan.md` — the dependency-ordered slice plan (Slice 0 tokens → 1 animation → 2 shared components → 3 nav/footer → 4 home → 5 articles → 6 detail → 7 categories → 8 auth → 9 backend author data → 10 profile/author → 11 about contributors → 12 404/policy/cleanup → 13 QA).

Execution rule: **one slice at a time, each gated by user review.** Do not start the next slice until the current one is reviewed and approved. Run web checks after each frontend slice and cargo checks + Supabase apply/verify after each backend/schema slice.

## Repo Dynamic

- Main repo: `/Users/abhaysinghsisoodiya/Documents/GitHub/OpenForum`.
- Source UI reference: `/Users/abhaysinghsisoodiya/Downloads/OpenForum`.
- Production app shape: monorepo with `apps/web` as a Next.js App Router frontend and `apps/api` as a Rust Axum backend.
- Frontend baseline: real Next app with server routes, Supabase auth flow, advanced Tiptap write experience, article pages, middleware, and tests.
- Downloads UI baseline: Vite SPA prototype with stronger editorial visuals, dark mode, Framer Motion, polished auth/write/article layouts, and mock data.
- Migration strategy: fully replace the GitHub visual presentation layer with the Downloads/Replit UI, route by route and component by component. Do not replace the production architecture with the Vite prototype.
- Styling constraint: GitHub app uses Tailwind v3 patterns. Downloads app uses a newer token style. Port tokens/classes intentionally; do not blindly copy Tailwind v4 directives.
- Component constraint: avoid importing a large shadcn/Radix surface unless a component is actually needed. Prefer existing local patterns and small custom components.
- Secrets: `supabase_creds.txt`, `new_supabase_creds.txt`, `*_creds.txt`, `Render.env`, `.env`, and `apps/web/.env.local` are local-only and gitignored. Do not commit or quote credential values. `.env.example` files (root, `apps/api`, `apps/web`) are tracked templates with placeholders only.
- Supabase note: as of 2026-06-07 the project is being migrated to a NEW Supabase project `OpenForum-New` (ref `spyonburfyoxniulledb`, region `ap-southeast-1` / Singapore) to co-locate with Render (Singapore) and Upstash Redis (Singapore). The old project (`ovvcbwzfsnnsitcfnqoc`, Sydney `ap-southeast-2`) is being retired. Schema/RLS for the new project is reproducible via `apps/api/scripts/bootstrap_new_project.sql` (manual SQL Editor run) plus SQLx migrations `0001`–`0004`. RLS is now codified in-repo (migration `0004_articles_rls.sql`), reversing the earlier "do not commit Supabase migration files" stance for the articles RLS.

## Non-Negotiable UI Migration Rules

- Downloads/Replit UI is the source of truth for visual design.
- The production Next app must keep its architecture: App Router, Supabase Auth, Rust API, Cloudinary, protected routes, middleware, tests, and deployment shape.
- The old GitHub UI should be treated as implementation scaffolding only. Do not preserve old GitHub visual styling for convenience.
- Every route should eventually be visually replaced, including:
  - `/`
  - `/articles`
  - `/articles/[slug]`
  - `/categories`
  - `/categories/[slug]`
  - `/about`
  - `/login`
  - `/signup`
  - `/auth/error`
  - `/profile`
  - `/authors/[id]`
  - `/write`
  - static policy/guideline pages
  - all empty/loading/error/unauthorized states
- Shared visual components should come from or match the Downloads UI:
  - Navbar
  - Footer
  - ArticleCard
  - AuthorBadge
  - CategoryPill
  - ReadingProgress
  - auth shell
  - write/editor shell
  - profile surfaces
  - buttons, inputs, tabs, pills, cards, modals, and state banners
- Real production data must remain real. Do not copy mock articles/authors from Downloads into production data paths.
- If the Downloads UI needs data the current backend does not expose cleanly, first adapt with the least-awkward real data available, then document the backend/API gap for a later UI-contract polish pass.
- Frontend core behavior must continue to use the Rust API. Do not add browser-to-Supabase table access for articles, comments, profiles, likes, bookmarks, follows, uploads, or moderation.
- Keep visual parity over incremental local style preferences. If a choice differs from Downloads, document why or avoid the difference.

## Current Status

Phase 0 and the main backend/data migration slices are complete. The project now has the Supabase public schema applied remotely, frontend theme/dark-mode foundations, backend article mutation endpoints, public profile/follow-state endpoints, article social-state endpoints, and frontend article/comment/action controls. Articles and public author profiles should be publicly readable, while writing, editing, deleting, commenting, liking, bookmarking, following, profile changes, and moderation require authenticated CSVTu users.

The frontend migration direction changed from selective UI polish to complete Downloads/Replit parity on 2026-06-06. The app currently contains a mix of migrated Downloads-style surfaces and older GitHub surfaces. Treat that mix as transitional and incomplete.

2026-06-05 update: Implemented editor/admin comment moderation. Added explicit moderator hide/delete API routes, soft-hide schema columns for comments, public comment reads that exclude hidden comments, frontend controls visible only to editor/admin users, and preserved author-only edit/delete for own comments. No approval queue was added.

2026-06-05 update: Completed the first write/edit polish slice. `/write?slug=...` now loads an existing article into the rich editor for authorized authors/editors/admins, article detail controls link into that full editor, and the write form has explicit cover image drag/drop, browse upload, URL paste, preview, replace, and remove UX.

2026-06-05 update: Completed live Supabase comment moderation schema application and verification through the Supabase pooler. Verified `public.comments` has `is_hidden`, `hidden_at`, `hidden_by`, and `idx_comments_visible_article_id`.

2026-06-05 update: Local smoke testing found `.env` and `Render.env` still point `DATABASE_URL` at the legacy Neon host, while the active schema/data target is Supabase Postgres. The running API returns 502 for article list against Neon. Before Render deployment, update Render `DATABASE_URL` to the Supabase Postgres/pooler connection string.

2026-06-05 update: Fixed Rust API startup for Supabase Postgres/pooler deployments. API-owned SQLx migrations are now opt-in via `OPENFORUM_RUN_API_MIGRATIONS=true`, because the Supabase schema is managed externally. Postgres service queries now use non-persistent SQLx statements so Supabase transaction pooler does not fail with prepared statement collisions. Local Supabase-backed API smoke checks now pass for `/health` and `/api/v1/articles?per_page=1`.

2026-06-05 update: Corrected local `.env` and `Render.env` to use the Supabase transaction pooler `DATABASE_URL` with `statement-cache-capacity=0` and `OPENFORUM_RUN_API_MIGRATIONS=false`. Verified the API starts directly from `.env`; `/health` and `/api/v1/articles?per_page=1` return 200.

2026-06-06 update: User confirmed the intended migration target is exact UI parity with the Downloads/Replit OpenForum app and a complete visual replacement of the old GitHub frontend. Future frontend agents should migrate the UI comprehensively, not selectively.

2026-06-06 update: Started the complete UI migration phase. Added/continued Downloads-style tokens, navbar/footer, article cards, author badge, category pills, homepage hierarchy, articles archive, About page, Categories page, public profile/author article grids, and the auth split-screen shell while preserving real API/auth/data behavior.

2026-06-06 update: Started the next route-by-route parity step for `/articles/[slug]`. Added a Downloads-style article detail reader wrapper around the real article detail data, reading progress, social actions, author controls, rendered rich body, comments, moderation, CTA, and related articles.

2026-06-06 update: Continued `/articles/[slug]` nested control parity. Restyled article comments, author comment edit/delete controls, editor/admin hide/delete controls, and article management controls to match the Downloads reader surface while preserving existing API behavior and permissions.

2026-06-06 update: Completed the first `/categories/[slug]` CategoryFeed parity pass. Added a Downloads-style CategoryFeed component with matching header, back link, article grid, and empty/error states while preserving real category/article data from the Rust API.

2026-06-06 update: Continued auth parity. Replaced `/auth/error` with a Downloads-style centered auth error experience, preserving real CSVTu domain messaging and Supabase callback error reasons.

2026-06-06 update: Continued profile parity. Replaced the authenticated `/profile` shell with the Downloads-style profile hero, avatar, stats row, tabbed published/drafts/settings content, and migrated profile edit form while preserving the existing Rust API `/api/v1/users/me` read/update behavior and authored article filtering.

2026-06-06 update: Continued public author parity. Replaced `/authors/[id]` with a Downloads-style public profile hero, avatar, stats row, tabs, author article grid, and sign-in-only drafts empty state. Removed branch/year from the public author UI to preserve the finalized public-profile privacy rule; public stats now use published article count, follower count, read time, and primary category.

2026-06-07 update: Continued `/write` parity. Ported remaining Downloads Write visual cues onto the existing production WriteForm while preserving the advanced Tiptap editor, Cloudinary cover upload, draft autosave/restore, and `/write?slug=...` edit flow: pill-style category select with chevron, `#`-prefixed tag chips, and a sticky bottom stats footer (words / chars vs 10k limit with over-limit warning / read time / last-saved). Skipped adding a separate subtitle/deck field because the production API derives `excerpt` from the body and has no subtitle column; recorded as a UI-contract gap.

2026-06-07 note: Reviewed `/guidelines`, `/privacy`, `/terms`. They render via `components/pages/EditorialInfoPage.tsx`, which is already fully token-based and visually consistent with the migrated Downloads design system (`container-editorial`, `font-heading`, `text-accent`, radial gradient hero, rounded accent closing card). The Downloads reference app has no dedicated policy pages. Left these pages unchanged; the earlier "retire EditorialInfoPage" TODO is stale relative to its current migrated state.

2026-06-07 update: Added the article subtitle/deck as a real first-class field end-to-end (per user request, replacing the earlier "skip subtitle" decision). DB: added `subtitle text NOT NULL DEFAULT ''` to `public.articles` (supabase migration 002 inline + idempotent ALTER, new API migration `0002_add_article_subtitle.sql`) and applied + verified it live via the pooler (`articles.subtitle=True`). Backend: added `subtitle` to `Article`, `NewArticle`, `UpdateArticle`, both Postgres row structs, the detail SELECT, INSERT, and UPDATE (renumbered binds), and the in-memory service. Fallback rule: on create/update, a blank/whitespace subtitle falls back to the article excerpt (the preview) so the detail deck is never empty — enforced in the Rust routes layer and mirrored in the Write UI. Frontend: added `subtitle` to `ArticleDetail`/`ApiArticle`/`mapDetail`, a serif-italic subtitle textarea under the title on `/write` (with draft autosave/restore + edit prefill), and the article detail page renders `subtitle || excerpt` as the deck. Added a backend integration test for explicit-subtitle storage and blank→excerpt fallback. `ArticlePreview`/cards still use `excerpt` only. Note: this is a backend schema/contract change — redeploy the Rust API before the web app relies on the new field in production.

2026-06-07 update: User shifted OpenForum to a new Supabase database. Applied the full `supabase/migrations/002_create_openforum_public_schema.sql` schema to the new project using `new_supabase_creds.txt` via `scripts/apply_supabase_public_schema.py new_supabase_creds.txt`. Verified tables (`profiles`, `articles`, `bookmarks`, `likes`, `comments`, `follows`), RLS policy counts, comment moderation columns/index, `profiles.headline=True`, `articles.subtitle=True`, and the article list contract query. Also verified the Supabase REST Data API returns HTTP 200 JSON arrays for all six public tables with the new publishable key. Updated local secret env files (`.env`, `Render.env`, `apps/web/.env.local`) to point at the new Supabase project and pooler URL with `OPENFORUM_RUN_API_MIGRATIONS=false`; do not quote or commit the credential values.

2026-06-07 update: Resolved new Supabase Security Advisor warnings for `public.rls_auto_enable()`. The advisor flagged that `PUBLIC`/anon and signed-in users could execute a `SECURITY DEFINER` function. Revoked `EXECUTE` from `PUBLIC`, `anon`, and `authenticated`, leaving privileged execution available to service/admin roles. Added the idempotent revoke block to `supabase/migrations/002_create_openforum_public_schema.sql` and extended `scripts/apply_supabase_public_schema.py` to verify `Unsafe public SECURITY DEFINER functions: 0`.

2026-06-07 update: **UI port complete.** All 13 slices done — every route now uses the Downloads/Replit design system. Final polish pass: auth pages use the written "OpenForum" wordmark only (logo.png is favicon-only, no logo image on auth screens); hero section de-cluttered (removed vertical line + decorative circle, softened the radial glow, reduced font weight, made the category slider visible on first load by dropping the full-viewport min-height); removed redundant `pt-24` from every page `<main>` (the Navbar already renders an `h-16` spacer — the double-spacing source); added the "Your ideas deserve a platform" CTA banner to `/categories` and `/categories/[slug]` and widened the CTA→footer gap (`mb-16`) on home/categories/about; added a share popover (Copy link + Share on X via inline `XIcon` SVG, since lucide-react has no Twitter/X export) to article actions; added a mobile-nav close (✕) button and raised the header to `z-overlay` while the menu is open so the hamburger isn't trapped under the overlay.

2026-06-07 update: **CI fixes.** Resolved `clippy::collapsible_if` (collapsed nested `if` into `&&` let-chains) and the follow-on `cargo fmt --check` failure (rustfmt wants `{` on its own line for multi-line let-chains). Hardened `.github/workflows/ci.yml`: pinned `dtolnay/rust-toolchain@1.93.0` (matches local; let-chains need a recent toolchain), bumped Node 18→20, added `pnpm install --frozen-lockfile`, and reordered the production deploy so Render (backend) ships before Vercel (frontend) since the web app depends on the API's endpoints.

2026-06-07 update: **502 root cause fixed (prepared-statement cross-wiring).** The Supabase transaction pooler (`:6543`) was reusing cached prepared-statement plans across the `get_posts` and `count_posts` queries, producing alternating "supplies N parameters, but prepared statement requires M" and "invalid length: expected 16 bytes, found 8" / "no rows returned" decode errors. The existing guard in `apps/api/src/main.rs` only disabled the statement cache when `DATABASE_URL` contained the literal `pooler.supabase.com`; broadened it to also detect `:6543`, `supabase.co:6543`, and `pgbouncer=true`, so `statement_cache_capacity(0)` is applied for the actual pooler URL. Verified the local API returns 200 on `/api/v1/articles`.

2026-06-07 update: **Missing `SUPABASE_SERVICE_KEY`.** `apps/api/src/routes/users.rs` reads `SUPABASE_SERVICE_KEY` for PostgREST profile calls but it was absent from `Render.env` (present only in root `.env`, and as the legacy JWT). Added it (new `sb_secret_` format) to `Render.env` and switched root `.env` to the new format too. Standardized on new-format keys (`sb_publishable_` / `sb_secret_`) across all env files.

2026-06-07 update: **Redis recreated.** The old Upstash DB (`just-adder-70742`) was auto-deleted after 14 days of free-tier inactivity (NXDOMAIN), causing `Failed to connect to Redis` warnings (rate limiter degrades to allow-all, cache bypassed — non-fatal). Created a new free Singapore Upstash DB (`humble-cub-112144`, `ap-southeast-1`, native `rediss://...:6379`, eviction on), verified AUTH/SET/GET/DEL round-trip, and updated `UPSTASH_REDIS_URL`/`UPSTASH_REDIS_TOKEN` in `Render.env` and root `.env`.

2026-06-07 update: **Supabase migration to Singapore applied.** Created a new Supabase project `OpenForum-New` (`spyonburfyoxniulledb`, `ap-southeast-1`) so DB + API + Redis are all Singapore-local (old project was Sydney `ap-southeast-2`; Supabase cannot change region in place). Updated all real env files (`Render.env`, root `.env`, `apps/web/.env.local`) to the new project's pooler URL, Supabase URL, publishable key, service key, and JWT secret (same DB password, URL-encoded). Applied `supabase/migrations/002_create_openforum_public_schema.sql` to the new project and verified all app tables, RLS policy counts, public REST table access, `profiles.headline`, `articles.subtitle`, and the article list contract query. Resolved the externally-added `public.rls_auto_enable()` Security Advisor warnings by revoking `EXECUTE` from `PUBLIC`, `anon`, and `authenticated`; the schema verifier reports `Unsafe public SECURITY DEFINER functions: 0`. Remaining manual steps: re-configure Google OAuth provider + redirect URLs + Google Cloud callback for the new project, optionally migrate old data, then paste `Render.env` into Render and redeploy.

2026-06-07 update: **Env example files corrected.** `apps/api/.env.example` now lists all vars the API actually reads (added `SUPABASE_SERVICE_KEY`, `ARTICLES_PROVIDER`, `STORAGE_PROVIDER`) and documents that dotenvy finds the repo-root `.env` (no separate `apps/api/.env` needed). Added a new `apps/web/.env.example` (client-safe `NEXT_PUBLIC_` vars only, with an explicit warning never to put the service key there).

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

### Phase 1: Complete Downloads/Replit Frontend UI Migration

Status: in progress. Re-grounded 2026-06-07 by a full route-by-route audit (`docs/ui-port-audit.md`) into a dependency-ordered slice plan (`docs/ui-port-plan.md`). Execute slices in order, each gated by user review. The earlier "selectively migrated" surfaces below are real but were authored against shadcn tokens that don't resolve in prod yet — Slice 0 (token foundation) fixes that and is the prerequisite for the rest.

Done:
- Theme/dark-mode foundation.
- Downloads-style global color token mapping.
- Downloads-style Navbar and Footer.
- Downloads-style ArticleCard, AuthorBadge, and CategoryPill components.
- Homepage hierarchy migrated toward the Downloads Home page.
- Article archive migrated toward the Downloads Articles page.
- Article detail reader shell migrated toward the Downloads ArticleDetail page while retaining real comments, moderation, article actions, and rich article body rendering.
- Article detail nested comments/actions/management controls partially restyled to match the Downloads reader surface.
- About page migrated toward the Downloads About page using real article/category data.
- Categories page migrated toward the Downloads Categories page using real category snapshots.
- Category detail feed migrated toward the Downloads CategoryFeed page using real category articles.
- Profile and author article grids now use the Downloads-style article card.
- Auth shell migrated toward the Downloads split-screen Auth page.
- Auth error page migrated toward the Downloads AuthError page.
- Authenticated profile page migrated toward the Downloads Profile page with real profile data, authored article grid, and a settings tab for profile edits.
- Public author page migrated toward the Downloads Profile page while preserving public-profile privacy limits.
- Write cover-image drag/drop and `/write?slug=...` edit flow completed while preserving the advanced production Tiptap editor.
- Write visual shell ported toward the Downloads Write page (pill category select, `#` tag chips, sticky bottom stats footer with over-limit warning) while preserving the production editor, Cloudinary upload, draft autosave/restore, and edit flow.
- Reviewed `/guidelines`, `/privacy`, `/terms`: already token-based and visually consistent via `EditorialInfoPage`; no change needed (Downloads has no policy pages).

Next:
- Continue route-by-route visual replacement from Downloads:
  - `/articles/[slug]`: perform browser QA and final micro-polish for comments/action/management spacing after comparing against the Downloads reader page.
  - `/categories/[slug]`: browser QA against the Downloads CategoryFeed page and adjust spacing/card counts if needed.
  - `/login` and `/signup`: browser QA the split-screen auth screens against Downloads while preserving real Supabase OAuth/email flows.
  - `/auth/error`: browser QA the migrated Downloads-style auth error state.
  - `/profile`: browser QA the migrated Downloads-style authenticated profile page; later replace adapted Branch/Year stats with richer backend-provided profile stats if the final UI requires Views/Followers.
  - `/authors/[id]`: browser QA the migrated Downloads-style public author page and verify follow/sign-in states.
  - `/write`: browser QA the migrated Write shell (header save/publish, toolbar, cover, bottom stats footer) on desktop/mobile/dark.
  - `/guidelines`, `/privacy`, `/terms`: visuals already migrated via `EditorialInfoPage`; only browser QA remains.
- Remove or retire old GitHub-only visual components once no longer referenced:
  - `components/ui/Card.tsx`
  - `components/pages/EditorialInfoPage.tsx`
  - older home/category helper components that duplicate Downloads surfaces.
- Build a visual parity checklist against `/Users/abhaysinghsisoodiya/Downloads/OpenForum/artifacts/openforum-web/src`.
- Run desktop/mobile/dark-mode browser QA after each major page group.
- Do not call the UI migration complete until no old GitHub-styled route remains.

Known backend/API gaps likely needed after visual parity:
- Homepage-ready aggregate payload: featured/latest/category counts in one request.
- Category archive counts/metadata in one request instead of per-category fanout.
- Author/contributor list for the About page.
- Richer public profile stats matching Downloads profile surfaces.
- Draft article listing/state for the authenticated profile tabs if drafts become visible outside `/write`.
- Search/filter/sort endpoints for archive UI.
- Image variants sized for hero, card, avatar, and detail layouts.
- Optional view/trending analytics if final UI exposes them.

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
- Update local `.env` and Render `DATABASE_URL` away from legacy Neon and onto Supabase Postgres/pooler. Completed 2026-06-05. Both include `statement-cache-capacity=0` and `OPENFORUM_RUN_API_MIGRATIONS=false`.
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
- Add editor/admin moderation endpoints for hiding/deleting any comment. Completed 2026-06-05.
- Add backend tests for explicit auth domain rejection and RLS-compatible data access.

### Phase 4: Frontend API Integration

Status: in progress.

Done:
- Article listing and article detail still use real server-side data.
- Article action buttons now call real like/bookmark endpoints.
- Article comments UI now reads public comments and posts authenticated comments.
- Article authors/editors/admins now get inline article edit/delete controls on detail pages.
- Comment authors now get inline comment edit/delete controls.
- Editors/admins now get inline comment hide/delete moderation controls.

TODO:
- Deploy or run the updated Rust API where the web app points, otherwise the new article/comment controls will hit missing endpoints.
- Connect profile pages to real profile/article/follow data.
- Verify publish/edit/delete flows from `/write` against the selected backend provider.
- Decide whether article editing should remain inline on detail pages or move into a full `/write?slug=...` / edit route using the richer editor. Initial full `/write?slug=...` flow completed 2026-06-05; inline quick edit remains available for now.
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

New-Supabase-project (Singapore) cutover, in order:
1. Configure Auth on the new project: enable Google provider (client ID/secret), set Site URL + redirect URLs (`https://openforum-web.vercel.app`, `http://localhost:3000`), and add the new callback `https://spyonburfyoxniulledb.supabase.co/auth/v1/callback` to Google Cloud Console authorized redirect URIs.
2. (Optional) Migrate old Sydney data via `pg_dump`/`pg_restore` if existing content must be preserved (fresh-start is acceptable per product rules).
3. Run end-to-end local smoke test against the new project:
   - login, create article, upload image, publish, like/bookmark/comment/follow, edit/delete article and comment.
4. Paste the updated `Render.env` into Render's environment (new Supabase + new Redis values) and redeploy the Rust API; smoke test endpoints.
5. Update Vercel env vars to the new Supabase URL + publishable key, then deploy the web app and run production QA.
8. After the new project is verified, retire/pause the old Sydney project and rotate any secrets exposed during setup (DB password, service key, Redis token).

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
