# OpenForum UI Port — Audit Findings (2026-06-07)

Evidence base for the full Downloads→GitHub UI port. Produced from a route-by-route
diff of `/Users/abhaysinghsisoodiya/Downloads/OpenForum/artifacts/openforum-web/src`
(reference, Vite SPA) vs `apps/web/src` (production, Next App Router) plus a backend
contract + target-data audit.

## THE ROOT-CAUSE FINDING: token-system schism

Production defines a **bespoke token vocabulary** in `apps/web/tailwind.config.ts` +
`app/globals.css`: `bg-bg`, `bg-bg-elevated`, `bg-surface`, `text-text`,
`text-text-secondary/tertiary`, `text-accent`, `accent-hover/light/subtle`,
`border-border`, `border-border-light`, `success/warning/error`, `font-heading`
(Fraunces), `font-body` (DM Sans). Tailwind v3.

Downloads + every "already-migrated" prod component is written against the
**shadcn vocabulary**: `bg-primary`, `text-primary`, `primary-foreground`, `bg-card`,
`bg-background`, `text-foreground`, `text-muted-foreground`, `bg-muted`,
`text-destructive`, `ring-ring`, `font-serif`. Tailwind v4 `@theme inline` HSL tokens.

A grep for `--foreground|--primary|--card|--muted-foreground|--background|--destructive`
across prod config returns **nothing**. So migrated surfaces (ArticleDetailExperience,
ArticleComments, ArticleCard, AuthorBadge, CategoryPill, HomeFeed, Categories*,
CategoryFeed*, AuthFrame, AuthErrorExperience, Profile bits) reference colors/fonts
that resolve to **nothing** in prod — they are partly unstyled today. `border-border`
overlaps both and is the only token that happens to resolve.

**Implication:** the foundation slice (add the shadcn token layer to prod's theme so
the Downloads vocabulary resolves to the right hues/fonts) must come FIRST; it
silently fixes a large fraction of every other surface.

Token value deltas to reconcile when bridging:
- primary/accent: Downloads `hsl(16 61% 52%)`=#cf623a vs prod accent #d4613c (close).
- background: Downloads #fcfaf8 vs prod #f6f5f0 (prod warmer/darker).
- card: Downloads #f9f8f5 vs prod bg-elevated #fffffe (prod cards pop more).
- border: Downloads #e7e6e4 (subtle) vs prod #d1cfc8 (heavier).
- radius: Downloads base 0.375rem (lg=6px/xl=10px) vs prod (lg=12px/xl=16px) — prod ~2x rounder.
- fontSize scale: prod has a custom modular scale; Downloads uses Tailwind defaults → same `text-4xl` etc. render different px.
- prod-only: paper-noise body texture, custom scrollbar, `.container-editorial`,
  `.glass`, reduced-motion guard, named z-scale, KaTeX/highlight.js `.article-content`
  (prod has NO `@tailwindcss/typography` `prose`; Downloads DOES).

Decision for the port: introduce the shadcn token names as the working vocabulary
(so Downloads classNames port verbatim), mapped to the agreed OpenForum hues. Keep
prod-only robustness (reduced-motion, KaTeX/code, error/loading states).

## Per-surface status (12 of 16 surfaces diffed; 4 hit a session limit — inferred)

| Surface | Status | Biggest gap |
|---|---|---|
| Global tokens | PARTIAL | shadcn tokens undefined in prod (root cause above) |
| Navbar | PARTIAL | serif two-tone wordmark; plain (non-pill) nav links; Home link; scroll padding-shrink; Write as text link |
| Footer | PARTIAL | prod footer is RICHER (social/address/3-col) than Downloads; Downloads is simpler. Mostly keep prod; only reconcile serif wordmark + gate line if desired |
| Home (/) | PARTIAL | token schism on feed/cards; featured zone layout differs (Downloads=1 hero+below+2 right; prod=single 12-col card); extra CategoriesBar section; hero copy |
| Articles (/articles) | PARTIAL | extra eyebrow+subhead+count badge prod added; pill/search padding; empty-state + CTA banner (missing gradient overlay) |
| Article detail | PARTIAL | token schism breaks colors; Downloads share-popover + Save/Share only vs prod Like+Save+Copy+Share; author role/bio/stats; synthetic pull-quote; prod adds comments/management/video (keep) |
| Categories | MATCH* | *only because it assumes shadcn tokens resolve; minor hover-border tint |
| Category feed | MATCH* | *same token caveat; minor PenSquare icon add |
| About | PARTIAL | MISSING Contributors section (3-up author cards); copy deltas; data-driven stats off (authorCount caps at 2) |
| Auth login/signup | PARTIAL | logo.png missing in prod (uses bar); prod adds GitHub+email/password (superset, keep); Google icon hover-scale; domain notice copy |
| Auth error | PARTIAL | logo.png; per-domain descriptive labels; support email line |
| Profile (/profile) | PARTIAL | CONCEPT: Downloads /profile/:username is PUBLIC; prod /profile is PRIVATE me-account. Stats: Downloads Articles/Views/Followers vs prod Articles/Branch/Year. Stat dividers; role/join meta; grid stagger index lost |
| Public author /authors/[id] | (not diffed) | infer: same Downloads Profile design; needs author role/bio/stats + author-articles filter |
| Write (/write) | (not diffed) | already heavily migrated this session (subtitle, pill category, sticky footer); reconcile tokens + toolbar/bubble-menu parity |
| not-found 404 | (not diffed) | small; restyle to Downloads not-found |
| Shared components | (not diffed) | ArticleCard/AuthorBadge/CategoryPill/ReadingProgress all token-schism dependent; horizontal card drops Eye/views |

## Framer Motion
- Prod ALREADY has framer-motion ^12.38 installed and uses it (HeroSection word reveal,
  HomeFeed/ArticleGrid stagger, Navbar brand-morph + mobile overlay, card entrances,
  ReadingProgress spring, About/Categories/CategoryFeed entrances). In several places
  prod is MORE animated than Downloads (prod uses whileInView scroll-trigger; Downloads
  uses mount-time delay). Main fixes: (a) pass `index` to ArticleCard on Profile grid
  (stagger lost), (b) avoid double-animation where a whileInView container wraps cards
  that also self-animate, (c) reconcile mount-vs-scroll trigger to match Downloads feel.
- Downloads also relies on `tw-animate-css` + shadcn Radix enter/exit utilities that
  prod lacks; only matters if we adopt shadcn Radix primitives (dialog/popover/dropdown).

## Backend / API gaps the Downloads design needs (with real data)
- **author role/title** (e.g. "Professor of Literature"): no freeform column. `profiles.role`
  is an enum (reader/writer/editor/admin), not a title. Need a `headline`/`title` column
  OR map enum to a label. Needed by: ArticleDetail bio, About contributors, public Profile.
- **author bio on article**: `article.author_detail` returns only {id,name,avatar_url}.
  `profiles.bio` exists but isn't on author_detail. Add bio (and role) to author_detail,
  or fetch the public profile by author.id on the detail page.
- **author articlesPublished + totalViews counters**: `profiles.articles_published` /
  `total_views` columns EXIST but are never maintained or returned. Either maintain them
  (triggers) or compute COUNT(articles)/SUM(views) per author on the fly. Needed by:
  ArticleDetail bio stats, About contributor cards, public Profile stats (Views).
- **followers_count**: column exists; public profile already derives follower_count live
  from `follows`. OK.
- **list authors / contributors endpoint**: NONE exists (only GET /users/{id} single).
  About's Contributors grid needs e.g. `GET /api/v1/authors` (top/published authors with
  name, username, avatar, role, bio, articlesPublished, totalViews).
- **author filter on articles list**: `GET /api/v1/articles` supports only category/page/
  per_page. Profile + public author grids filter client-side over per_page=50 (breaks past
  50). Add `author` query param OR `GET /api/v1/users/{id}/articles`.
- **featured flag exposure**: `articles.featured` column exists but is never read/written.
  Home + About "featured/notable" selection currently = newest. To match Downloads
  editor-chosen featured, expose `featured` on ArticlePreview + a featured filter/sort.
- **username on author_detail / profile select**: `profiles.username` exists but
  PROFILE_SELECT never reads it. Downloads links to /profile/:username; prod links by id.
  Surface username if we adopt username URLs (optional; id links are fine).
- **search endpoint**: archive search is client-side over the loaded page only. Optional:
  add `q` query param to articles list for full-archive search.
- **pagination consumption**: articles list returns page/per_page/total but the explorer
  renders only the first page (silent truncation on big archives). Wire load-more/pagination.
- **categories entity** (optional, fully data-driven categories): no categories table;
  the 7-entry CATEGORY_CATALOG lives only in `lib/categories.ts` (name/slug/color/desc).
  A `categories` table + list endpoint would make Categories/filters fully backend-driven.
  Not required for parity; the static catalog is an acceptable match.

## Supabase / DB column work implied
- `profiles.headline` (or `title`) text — freeform author role/title for bylines/bios.
  (DB already has: bio, avatar_url, username, articles_published, total_views,
  followers_count, role enum, created_at — most just need to be SELECTed/maintained/exposed.)
- Maintain `articles_published` / `total_views` (triggers) OR compute on read.
- Everything else the design needs already has a column; the gap is API exposure, not schema.

## Product reconciliations to confirm with the user
- Navbar links: Downloads = Home/Articles/About (no Categories). Prod has a Categories
  page + link. Keep Categories (prod has the page) → minor divergence from Downloads nav.
- Auth: keep prod's GitHub + email/password superset (Downloads is Google-only)?
  (Likely yes — real auth must stay.)
- Profile: keep prod's PRIVATE /profile (me, with edit form) AND make public author
  /authors/[id] match the Downloads public Profile design. Two surfaces, one design family.
- Categories taxonomy stays the 7 CSVTU categories (not Downloads' 10 generic).
- Drop /shinchan. Keep + restyle /guidelines /privacy /terms.
