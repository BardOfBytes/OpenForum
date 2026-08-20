# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

OpenForum — a student-only editorial/journalism platform for CSVTU (`@csvtu.ac.in` / `@students.csvtu.ac.in`). Monorepo: `apps/web` (Next.js App Router frontend) + `apps/api` (Rust Axum backend), backed by Supabase (Auth + Postgres + RLS), Upstash Redis (cache + rate limiting), and Cloudinary (image uploads).

**Read `agent.md` before doing non-trivial work here.** It is the living control document for an in-progress UI migration (porting a Downloads/Replit design reference into this production app) and tracks locked product decisions, phase status, and known gaps. Update it when a phase starts, completes, or changes direction — do not let it go stale.

## Commands

Root (turborepo + pnpm workspaces):
```
pnpm dev              # run web + api dev servers in parallel (pnpm --parallel)
pnpm dev:web          # next dev --port 3000
pnpm dev:api          # cargo watch -x run (apps/api)
pnpm build            # build all
pnpm lint             # apps/web only (next lint)
pnpm typecheck        # apps/web only (tsc --noEmit)
pnpm test:web         # vitest --run (apps/web)
pnpm test:api         # cargo test (apps/api)
```
Or via `Makefile`: `make dev` (pnpm dev + cargo run concurrently), `make build`, `make test` (cargo test only), `make docker-up`/`make docker-down` (local Redis + API container).

Single test:
- Rust: `cd apps/api && cargo test <test_name>` (integration tests live in `apps/api/tests/api_integration.rs`)
- Web: `cd apps/web && pnpm vitest run <path-or-name-pattern>`

After any frontend change: `pnpm --filter @openforum/web typecheck && pnpm --filter @openforum/web test:run && pnpm --filter @openforum/web build`.
After any backend/schema change: `cd apps/api && cargo test && cargo build`, plus verify the Supabase schema if it changed (see below).

## Architecture

**Frontend (`apps/web`)** — Next.js 14 App Router, Tailwind, Tiptap rich-text editor for `/write`, Framer Motion. Route structure under `src/app/`; shared UI in `src/components/{ui,layout,articles,authors,auth,editor,theme,pages,categories,home}`. `src/lib/api/*` wraps calls to the Rust API; `src/lib/supabase/{client,server}.ts` are the only places Supabase Auth is touched directly. `middleware.ts` refreshes the Supabase session on every request (uses `getUser()`, never `getSession()`, to force server-side validation) and redirects unauthenticated users away from protected routes (`/write`, `/profile`, `/search`) and authenticated users away from auth routes.

**Backend (`apps/api`)** — Rust Axum API, the orchestration layer for all core product behavior (articles, comments, likes, bookmarks, follows, uploads, moderation). Structure: `routes/` (handlers: `articles`, `users`, `upload`, `health`), `services/` (`articles` trait + `articles_postgres` impl, `cache` for Redis, `cloudinary` for signed uploads), `middleware/` (`auth` = JWT extractor, `rate_limit`), `models/` (`article`, `user`), `state.rs` (shared `AppState`), `config.rs` (env-driven config, fails fast on missing required vars).

- **Auth**: `middleware/auth.rs` validates Supabase-issued JWTs via RS256/JWKS (cached 1h in-memory, fetched from `{NEXT_PUBLIC_SUPABASE_URL}/auth/v1/.well-known/jwks.json`), with an HS256 fallback via `AXUM_JWT_SECRET` for local/integration testing. Enforces the CSVTu email-domain allowlist and resolves a `UserRole` (`reader`/`writer`/`editor`/`admin`) from JWT claims. Use the `AuthUser` extractor for protected handlers, `OptionalAuthUser` for routes that behave differently when a bearer token is present.
- **Data path**: Postgres/Supabase is the only supported article/profile storage (`ArticlesService::postgres(...)` in `main.rs`); Google Sheets/Drive providers were removed. **Do not add browser-to-Supabase table access for articles, comments, profiles, likes, bookmarks, follows, uploads, or moderation** — that must go through the Rust API. Supabase RLS stays enabled as a security backstop regardless.
- **Supabase transaction pooler gotcha**: connecting through Supavisor/PgBouncer (`:6543`, `pooler.supabase.com`, `pgbouncer=true`) cross-wires sqlx's cached prepared statements between queries. `main.rs` detects pooler URLs and sets `statement_cache_capacity(0)`. If you see "invalid length" or "no rows returned" decode errors against Postgres, check this first.
- **Migrations**: SQLx migrations in `apps/api/migrations/` are opt-in via `OPENFORUM_RUN_API_MIGRATIONS=true` — the Supabase schema is normally managed externally via `supabase/migrations/` and applied with `scripts/apply_supabase_public_schema.py`. Don't assume `cargo run` migrates the DB.

**Product rules (locked, do not relitigate without explicit user direction):**
- Public article reading is open to everyone; writing, editing, deleting, commenting, liking, bookmarking, following, and profile edits require an authenticated CSVTu user.
- Every valid CSVTu user can write and comment; `editor`/`admin` roles exist only for moderation and emergency control, never for gatekeeping normal authoring.
- Comments: public read, authenticated create, author can edit/delete own, editor/admin can hide/delete any, no approval queue.
- Public profile pages expose only display name, avatar, bio, follower count, and published-article stats/articles — never email, roll number, auth provider, bookmarks, drafts, or other internal fields.
- GitHub OAuth is only acceptable when it exposes an allowed school email (many students use personal email on GitHub, so Google OAuth matters too).

## Working conventions

- Secrets (`*_creds.txt`, `Render.env`, `.env`, `apps/web/.env.local`) are local-only and gitignored — never commit or print values. The tracked `.env.example` files (root, `apps/api`, `apps/web`) are templates only.
- When touching the UI, the Downloads/Replit reference app (`/Users/abhaysinghsisoodiya/Downloads/OpenForum`) is the visual source of truth per the active migration (`agent.md`, `docs/ui-port-plan.md`, `docs/ui-port-audit.md`) — pixel-faithful porting, one slice at a time, gated by user review. The GitHub app's *architecture* (App Router, Supabase Auth, Rust API, Cloudinary, middleware, tests, deployment shape) is never replaced, only its visual layer.
- Prefer existing local component patterns over pulling in a large shadcn/Radix surface.
- When adding moderation or permission logic, enforce it in the Rust API first, then reflect it in the frontend.
