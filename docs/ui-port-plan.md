# OpenForum Full UI Port — Implementation Plan

Mission: port the Downloads/Replit OpenForum UI into the production Next app
**pixel-faithfully** (layout, spacing, fonts, colors, icons, AND Framer Motion),
while keeping the real Rust API, Supabase Auth, Cloudinary uploads, middleware, and
tests. Where the design needs data the backend lacks, **add the API + Supabase column**.

Locked decisions (2026-06-07): pixel-faithful · add Framer Motion · restyle
`/guidelines` `/privacy` `/terms` and drop `/shinchan`. Evidence: `docs/ui-port-audit.md`.

Execution rule: **one slice at a time, each gated by user review.** After each slice:
`pnpm --filter @openforum/web typecheck && test:run && build`; for backend slices also
`cargo fmt && cargo test && cargo build`; backend schema changes applied + verified via
`python3 scripts/apply_supabase_public_schema.py`. Do not start slice N+1 until slice N
is reviewed and approved.

---

## Slice 0 — Design-token foundation (BLOCKS everything)

Why first: every migrated + Downloads component uses shadcn tokens (`bg-primary`,
`bg-card`, `text-foreground`, `text-muted-foreground`, `text-destructive`, `font-serif`)
that resolve to nothing in prod. Defining them unbreaks a large share of all surfaces.

Work:
- Add the shadcn HSL token set to `app/globals.css` (`:root` + `.dark`):
  `--background --foreground --card --card-foreground --primary --primary-foreground
  --muted --muted-foreground --secondary --accent --border --input --ring --destructive`,
  using the agreed OpenForum hues (terracotta primary, warm paper bg).
- Extend `tailwind.config.ts` `theme.extend.colors` to map those names, add
  `fontFamily.serif = Fraunces`, and reconcile `borderRadius` toward Downloads' scale.
- Keep prod-only: reduced-motion guard, paper-noise, scrollbar, `.container-editorial`,
  `.glass`, KaTeX/highlight.js `.article-content`, named z-scale, error/success tokens.
- Verify the bespoke tokens (`bg-bg`, `text-text`, `accent`) still resolve (don't break
  the not-yet-ported surfaces during transition).
Verify: typecheck/test/build; visually spot-check detail + comments now have color.

## Slice 1 — Framer Motion + animation infra

- Confirm `framer-motion` is installed (it is, ^12.38) and add any shared variants/eases
  to match Downloads (mount-time stagger vs whileInView reconciliation).
- Fix known animation bugs: pass `index` to ArticleCard on the Profile grid; remove
  double-animation where a whileInView container wraps self-animating cards.
- Optional: add `tw-animate-css` only if we adopt shadcn Radix primitives later.

## Slice 2 — Shared components (high reuse)

ArticleCard, AuthorBadge, CategoryPill, ReadingProgress, plus button/input/tab/pill/card
primitives. Reconcile to Downloads classes (now that tokens resolve): pill `py-1.5`,
`transition-all duration-200`, active state without border; horizontal card Eye+views;
card fallback gradient. These cascade into Home/Articles/Categories/CategoryFeed/Profile.

## Slice 3 — Navbar + Footer

- Navbar: serif two-tone `Open`+*Forum* wordmark; plain (non-pill) nav links with
  `text-primary` active; padding-shrink on scroll; reconcile Write/Sign-in (keep
  auth-aware behavior). Product note: keep Categories link (prod has the page).
- Footer: prod footer is already richer than Downloads — keep it; only reconcile the
  serif wordmark and the `@csvtu.ac.in members may write` gate line if desired.

## Slice 4 — Home (/)

- Rebuild the featured zone to the Downloads layout (1 hero card + 1 below + 2 right
  stacked) replacing the single 12-col card; reconcile hero copy + accent treatment;
  decide on the extra CategoriesBar section (Downloads has none — likely remove).
- Backend (this slice or 9): expose `featured` on ArticlePreview for editor-chosen
  featured story (else featured = newest).

## Slice 5 — Articles archive (/articles)

- Match Downloads header (drop prod eyebrow/subhead/count badge), search input sizing,
  pill row, empty state, and Write-CTA banner (add gradient overlay + arrow).
- Backend (optional): `q` search param + real pagination/load-more.

## Slice 6 — Article detail (/articles/[slug])

- With tokens fixed, reconcile: Save/Share design (Downloads share-popover) vs prod
  Like+Save+Copy+Share — decide which actions to keep (likely keep Like, add the
  share popover styling); category pill data-driven from `category_detail.color`;
  Filed-under row; author bio block with real role/bio/stats.
- KEEP prod-only comments, management panel, and YouTube embed (no Downloads equivalent,
  but real product features).
- Backend (Slice 9): author `role`/`bio`/`articlesPublished`/`totalViews` on author_detail.

## Slice 7 — Categories + Category feed

- Already MATCH once tokens resolve. Minor: hover-border tint, PenSquare icon. Verify.

## Slice 8 — Auth (login / signup / error)

- Add `apps/web/public/logo.png` (copy from Downloads) and swap the bar span for the img.
- Google icon hover-scale; domain-notice copy + per-domain labels; support email line on
  the error page. KEEP prod's GitHub + email/password superset and loading/error states.

## Slice 9 — Backend: author/contributor data (enables 6, 10, 11)

Supabase: add `profiles.headline text` (freeform author title). Apply + verify via the
script. Maintain or compute `articles_published` / `total_views`.
Rust API:
- Add `role`(headline), `bio`, `articles_published`, `total_views`, `username` to the
  article `author_detail` (or a public-profile fetch path).
- `GET /api/v1/users/{id}/articles` (or `?author=` on the list) for author article grids.
- `GET /api/v1/authors` — contributors list for About (name, username, avatar, headline,
  bio, articlesPublished, totalViews), top/published authors.
- Expose `featured` on ArticlePreview (+ optional featured filter).
Tests: cargo fmt/test/build + new integration coverage.

## Slice 10 — Profile (/profile) + Public author (/authors/[id])

- Public `/authors/[id]`: match the Downloads public Profile design (hero, 3 stats with
  vertical dividers — Articles/Views/Followers, role + join meta, tabs, author article
  grid with staggered index). Privacy rule preserved (no email/roll/branch/year/drafts).
- Private `/profile` (me): keep the edit-profile form + drafts/settings tabs (prod
  superset), but restyle the hero/stats/tabs to the Downloads visual (stat dividers,
  tracking, sizes). Wire Views/Followers from Slice 9 data.

## Slice 11 — About contributors

- Add the Contributors section (3-up author cards) using `GET /api/v1/authors` from
  Slice 9; fix data-driven stats (authorCount, categoryCount); reconcile copy deltas.

## Slice 12 — 404 + policy pages + cleanup

- Restyle `app/not-found.tsx` to the Downloads not-found.
- Restyle `/guidelines` `/privacy` `/terms` to the design system (they already use
  token-based `EditorialInfoPage`; confirm consistency post-Slice-0).
- Remove `/shinchan` if present in prod; retire any unreferenced old components.

## Slice 13 — Full QA pass

Desktop + mobile + dark mode across every route; verify real flows (login, create,
upload, publish, like/bookmark/comment/follow, edit/delete). Confirm no old-styled
surface remains. Then deployment checklist (redeploy Rust API for new endpoints/columns
before the web app relies on them; Render DATABASE_URL on Supabase pooler).
