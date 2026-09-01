# Mersive Polaris website

Astro 7 static site, converted from the single-file POC now kept at
`archive/mersive-website-poc-v1.95.html`. Every hash route (`#/platform/how`) is
now a real pre-rendered page (`/platform/how`).

## Ruled facts — READ BEFORE TOUCHING PRODUCT, PRICING OR CAPABILITY COPY

**`src/data/rulings.ts` outranks every source document.** Read it first.

The site is assembled from a PRD, two released data sheets, a firmware spec, a
third-party device assessment, an ISO certificate, a SOC report and 45 ported
blog posts. **Those sources contradict each other.** When they do, Damian rules,
and his rulings live in `rulings.ts` with their dates. A ruling is not a source
document and does not defer to one — it is the decision about what the site says
when the documents disagree.

Three rules follow from that:

1. **Import the constant; never retype the value.** `TIERS.shares`,
   `WARRANTY.short`, and so on. A fact typed by hand into a page is a fact that
   will drift.
2. **If a source document contradicts a ruling, the ruling wins.** Record the
   contradiction in `Website/Reports/Datasheet reconciliation` so the document
   can be corrected. Do not quietly follow the document.
3. **If you find a conflict `rulings.ts` does not cover, ASK DAMIAN.** Do not
   pick the plausible answer. Guessing is what this file exists to prevent.

Currently ruled, in brief — the file carries the reasoning and the exact wording:

- **Essentials runs the same software as Pro.** Not a reduced build, not a
  feature tier, not a licence gate. Every capability difference traces to a
  hardware limit of the Mini chassis, and there are only two: memory sets the
  share ceiling (**5 Essentials / 10 Pro**), and **no USB input** means no
  Polaris Link and no true wireless BYOM, because both need a USB host for the
  room camera and mic. Never present a *software* capability as Pro-only.
- **Warranty: full warranty while on subscription.** The released data sheets'
  "Limited 3-year manufacturer's warranty" is dated and the sheets are to be
  reissued. "Life of the product" is wrong and must never appear — it survives
  cancellation and is an obligation nobody approved.

**Why this section exists.** On 12 Aug 2026 two agents worked this repo without
coordination. A USB spec regression that had been reverted came back within two
hours, and a warranty term appeared in a printable spec sheet matching neither
the site nor the released PDFs. Rulings made in conversation do not survive; only
rulings in version control do.

## Hardware facts — HARDWARE.md is the master record

**`HARDWARE.md` at repo root is the master record for all hardware and lifecycle
facts. Never hand-write a hardware value into a page. Change HARDWARE.md first,
then `src/data/hardware.ts`, then let pages render from it. A hardware number that
appears in a page but not in HARDWARE.md is a defect.**

`src/data/hardware.ts` is the typed export the site renders from and mirrors
HARDWARE.md exactly; each file names the other at the top so drift is obvious on
review. If the two disagree, HARDWARE.md is right and the export is the bug.

Three things in it that are easy to get wrong:

- **Requirement and as-built are different facts.** A requirement of "Wi-Fi 5 or
  newer" and an as-built Wi-Fi 6 radio are both true and mean different things to a
  reader. `HwRow` carries `req` and `built` separately. Never average them, never
  silently pick one, never drop the conflict.
- **Confidentiality is a hard rule.** Both PRDs are stamped confidential. BOM cost
  caps, volumes, NRE, initial order quantities, shipping schedules and supplier
  terms must never appear in HARDWARE.md or on any page. Technical values are
  publishable; commercial terms are not. **Public copy cites "Mersive hardware
  requirement, rev. Nov 2024", never a PRD version number** — precise internal
  citations stay inside HARDWARE.md.
- **Lead with the invariants, not the parts list.** The product promise is that a
  unit bought in year 8 behaves identically to one bought in year 1 and drops into
  the same estate. `INVARIANTS` renders first and `SILICON` second, on every
  surface. A page that opens with a parts table has inverted the story, and the
  parts are the half that is designed to change.

The one sentence about the 10-year lifecycle is `LIFECYCLE.canonical`, used
verbatim everywhere. It carries a bracketed placeholder until Damian rules whether
the ten years run from launch or from purchase; the bracket is part of the sentence
and a surface that drops it publishes a firmer commitment than the approved one.

## Development

### Overall development pipeline

1. Damian is the project owner and the primary contributor. We want maximum
   flexibility and speed for Damian to iterate on this project. Speed here means
   fewer round-trips and fewer questions — not skipped verification. There will
   be other contributors as well.
2. Claude Cowork is the primary interface that project contributors will be
   using to make edits to this project.
3. Given 1 & 2, all changes that Damian asks his Claude Agent to make take place
   on `main`, and are committed, pushed, and built so that he can immediately
   preview the updated website.
4. Everyone else works on their own branch. Their agent merges `main` into that
   branch, resolves conflicts with them, commits, and pushes the branch to
   GitHub — but the agent never merges into or pushes `main`. The branch
   reaches `main` one of two ways, the human's choice:
   - **Manual merge** — a git-fluent contributor merges their branch into
     `main` and pushes it themselves, from their own command line, outside of
     Claude.
   - **Pull request** — the agent helps open a PR, and Damian reviews and
     merges it. This is the expected path for contributors who don't drive git
     directly (e.g. designers).
5. The point of 4 is that conflicts get resolved by other contributors on their
   own branches, so Damian never has to handle them. He picks up everyone
   else's work by pulling `main` and by reviewing pull requests into it.
6. **Matt Guidone (GitHub `mattguidone`) is the one exception to 4.** He drives
   git himself, so his agent performs **no git operation of any kind** unless he
   asks for it in so many words — no sync, no commit, no push, no branch
   creation. Everything else in this file still applies to his sessions: the
   ruled facts, the conventions, and verification before he commits. See
   "Workflow — Matt".

### Identity

Establish who is making the request **at the start of the session, before doing
anything** — not just before a git operation. Identity decides which workflow
applies, and one of the three workflows below forbids git entirely, so working
it out only when you are about to commit is already too late. Check in this
order and stop at the first that gives an answer:

1. The Windows/macOS/Linux user profile path in use. Damian's will contain
   either "damian" or "dblazy"; Matt's will contain "matt" or "mguidone"
2. The system user name. Damian's will contain either "damian" or "dblazy";
   Matt's will contain "matt" or "mguidone"
3. The authenticated GitHub user (`gh auth status`, or `git config user.email`
   if it was set by the human rather than by a previous agent run). Damian's
   GitHub user name is dblazy; Matt's is mattguidone (mguidone@mersive.com)

Do **not** infer identity from `git log` authors. Past commits were made by agents
on behalf of a human and carry that human's name regardless of who is asking now.

If none of the checks return a usable answer, or they disagree, **ask the human
who they are before touching git.** Never guess.

Set the commit identity for every session before committing:

```sh
git config user.name  "Claude (Cowork agent for <Human Name>)"
# Email pattern: [first initial][last name]@mersive.com — Steve Long = slong@mersive.com
git config user.email "<human>@mersive.com"
```

There is no global git identity in agent environments; commits fail without this.

**Matt is the exception here too.** On his sessions, do not set or change the
git identity, and do not attribute commits to Claude: when he asks for a commit,
it is authored as him (`Matt Guidone <mguidone@mersive.com>`), with no agent
name in `user.name`, no `Co-Authored-By` trailer and no "Generated with Claude"
line. He configures his own identity; leave `git config` alone.

### Sync before every change — no exceptions

No matter what the human asks for, integrate the latest `main` before starting
the work — not once per conversation, but before every new task. Sessions and
terminals share this checkout, other contributors push while you work, and a
fetch from earlier in the session is already stale. On Damian's workflow this
is step 2 (`git pull origin main`); on the everyone-else workflow it is steps
2–4 (pull the branch, then merge `origin/main`, resolving conflicts with the
human). Re-run the sync whenever the conversation has been idle or the human
has been working outside Claude since the last one, and always re-check which
branch is checked out before committing — the human may have moved HEAD from
their own terminal.

**This does not apply to Matt.** A pull is a git operation, and on his sessions
git operations are his to run. Do not fetch, pull or merge on his behalf. If
being out of date looks like it matters — the file you are about to edit is one
another contributor has been changing, or the task depends on something that may
have landed on `main` — say so and let him decide; do not sync and then tell
him. Reading local state (`git status`, `git log`, `git diff`) is fine and is
often the right way to check before editing.

### Workflow — Damian

1. Switch to `main`; confirm you are on it.
2. `git pull origin main`.
3. Check for open pull requests into `main`:
   `git ls-remote "$REPO" 'refs/pull/*/merge'` (see "Credentials" for `$REPO`).
   Each `refs/pull/<N>/merge` ref is an open PR that GitHub can merge cleanly;
   a conflicted PR has no merge ref, so the repo's Pull requests page on GitHub
   is the source of truth. Match `refs/pull/<N>/head` SHAs against
   `refs/heads/*` to name the source branch. If any PR is pending, tell Damian
   and offer to walk him through each one: fetch the PR head, summarise the
   diff against `main`, and on his approval merge it —
   `git fetch "$REPO" refs/pull/<N>/head && git merge --no-ff FETCH_HEAD` —
   then verify (see "Verification") and push `main`. GitHub marks the PR
   merged automatically. Merging deploys, like any push to `main`. If the
   merge conflicts: stop and walk Damian through each conflict, ask how to
   resolve it, apply his decision — never auto-resolve — and verify before
   pushing.
4. On merge conflict (from the pull): stop. Walk the human through each
   conflict, ask how to resolve it, apply their decision. Never auto-resolve.
5. Make the requested changes.
6. Verify before committing — see "Verification" below.
7. Run `git status` and read it. Stage with `git add -A` **only if** everything
   listed is either a file you changed or something the human explicitly asked
   you to include. If anything unexpected is there — files you didn't touch,
   deletions you didn't make, untracked files you don't recognise — stop and
   show the human before staging.
8. Commit with a message describing the request and what changed.
9. `git push origin main`. This deploys — see "Verification".
10. Summarise what you did, then tell Damian how to see it:
   - **Locally:** `pnpm preview` for the plain build, or `pnpm preview:pages`
     to see exactly what Pages serves — that one is gated, password `preview`.
   - **On GitHub Pages:** the URL in "Deployment" below. The deploy runs on
     push and takes a couple of minutes; the repo's Actions tab shows when it
     has finished. The live gate password is the `SITE_PASSWORD` repo secret —
     you cannot read it and must not guess at it. Damian has it.

### Workflow — everyone else

Everyone except Damian and Matt. If the human is Matt, skip this section
entirely and use "Workflow — Matt" below.

1. Ask which branch to work on, or use the branch they named earlier in the
   session. It must not be `main`. If the branch doesn't exist yet, create it
   from up-to-date `main` and confirm the name with the human first.
2. `git pull origin <branch>` (skip if the branch is new and local-only).
3. Bring in Damian's latest: `git fetch origin && git merge origin/main`. This
   is where conflicts surface — that is by design, so Damian never has to
   resolve them.
4. On merge conflict: stop and walk the human through it, as above.
5. Make the requested changes.
6. Verify before committing — see "Verification" below.
7. Run `git status` and read it. Stage with `git add -A` **only if** everything
   listed is either a file you changed or something the human explicitly asked
   you to include. If anything unexpected is there — files you didn't touch,
   deletions you didn't make, untracked files you don't recognise — stop and
   show the human before staging.
8. Commit with a descriptive message.
9. Push the branch: `git push "$REPO" <branch>` (see "Credentials" for
   `$REPO`). **Never merge into `main` and never push `main` on this path,
   under any circumstance.** Pages only deploys `main`, so pushing a branch
   deploys nothing.
10. Ask the human how their branch should reach `main`, or follow the
    preference they've already stated:
    - **They merge manually** — a git-fluent contributor's own step, outside
      of Claude. Remind them of the sequence (pull `main`, merge the branch,
      push `main`) and stop there.
    - **Pull request** — offer to open one; the human can also explicitly ask
      ("create the PR") at any point in the session, and then it needs no
      further confirmation. api.github.com is unreachable from agent
      environments, so create it through the browser: with Claude in Chrome
      connected and the human's approval, open
      `https://github.com/Mersive-Technologies/polaris-website/compare/main...<branch>?expand=1`,
      fill in a title and summary, and submit on their behalf. Without browser
      access, give the human that link — one click finishes it. Later pushes
      to the same branch update the PR automatically.
11. Summarise what you did: the branch name, the PR (or the link to create
    it), that review and merging are Damian's step when a PR is used, and how
    to preview locally: `pnpm preview`, or `pnpm preview:pages` (password
    `preview`). Pages only deploys `main`, so the branch will not appear at
    the Pages URL until merged.

### Workflow — Matt

For Matt Guidone (GitHub `mattguidone`, mguidone@mersive.com) only. **The agent
runs no git command that changes anything, ever, unless Matt asks for that
command in the message he is currently sending.** He drives git himself and
wants the working tree exactly as he left it.

1. Do not sync. No `git fetch`, no `git pull`, no `git merge`, no branch
   creation, no checkout, no switching branches. Whatever branch is checked out
   is the branch you work on — do not change it, and do not suggest changing it
   as a step you will take.
2. Make the requested changes.
3. Verify — `pnpm check && pnpm build`, per "Verification". This part is not
   optional and is not a git operation; it stays.
4. Stop there. Do not `git add`, do not `git commit`, do not `git push`, do not
   `git stash`, do not open a PR. Leave everything unstaged and uncommitted.
5. Summarise what changed, which files, and that it is uncommitted and ready for
   him to review. Do not append "shall I commit?" to every turn — he will say so
   when he wants it. If the change is one where committing before going further
   is genuinely worth flagging (a large refactor about to be built on, say),
   mention it once and move on.

**When he does ask.** "Commit this", "push it", "pull main" and the like are
explicit instructions: carry out exactly what he asked and nothing adjacent.
Committing is not permission to push; pushing is not permission to open a PR;
"pull" is not permission to merge `main` into the branch. Do the named
operation, report the result, stop. The standing prohibitions still hold: never
push `main`, never merge into `main` — his branch reaches `main` by his own
merge or by a PR Damian reviews, exactly as in "Workflow — everyone else"
step 10.

Before any commit he asks for, run `git status` and read it, per step 7 of the
other workflows — stage only what you changed or what he named, and show him
anything unexpected instead of sweeping it in with `git add -A`. Commits are
authored as Matt, with no Claude attribution anywhere in them; see "Identity".

**Read-only git is fine and is often the right move.** `git status`,
`git log`, `git diff`, `git show`, `git branch` — use them freely to understand
the tree before editing. The rule is about commands that write: to the index, to
history, to the working tree, or to the remote.

### Verification

Before every commit, run:

```sh
pnpm check     # astro check — types and template errors
pnpm build     # must complete without error
```

If either fails, fix it or stop and report — do not commit a broken build. This is
not optional: the frontmatter caveat below fails *silently* at build time, and
`pnpm check` is the only thing that catches it.

**On the Damian workflow this is not a formality.** `.github/workflows/deploy.yml`
publishes every push to `main`, so a commit that builds badly reaches the live
preview site within minutes, with no review step in between.

If `pnpm` or `node_modules` is unavailable in your environment, say so and ask the
human to run the build; do not commit unverified changes.

### Line endings

`.gitattributes` sets `* text=auto`, so the repo stores LF and each checkout gets
native endings. This is settled — do not "fix" line endings, add `core.autocrlf`,
or renormalize. A `git status` showing many files modified with identical
insertion and deletion counts would mean something reverted that rule; report it
rather than committing around it.

The repo also lives inside a Dropbox folder. Dropbox writes conflicted-copy files
when two machines edit at once; `.gitignore` excludes them. If you see one, it
means someone else was editing the same file — tell the human rather than
resolving it yourself.

### Credentials

Remote git operations (fetch, pull, push) use the credential in
`github_token.txt`, in the parent directory of `polaris-website`.

The file does not contain a bare token: it is a single line holding a
credentialed base URL of the form `https://<user>:<token>@github.com`, with no
repo path. To use it, append the repo path:

```sh
URL=$(tr -d '[:space:]' < ../github_token.txt)
REPO="${URL%/}/Mersive-Technologies/polaris-website.git"

# fetch (both workflows)
git fetch "$REPO" '+refs/heads/*:refs/remotes/origin/*'

# push your own branch (everyone-else workflow)
git push "$REPO" <branch>

# push main (Damian's workflow only)
git push "$REPO" main

# list open, cleanly-mergeable PRs into main (Damian's workflow)
git ls-remote "$REPO" 'refs/pull/*/merge'
```

Do not treat the file's contents as a bare token — used that way, GitHub
rejects it as an invalid credential.

The pull-request flow is git-native on purpose: agent environments can reach
github.com but not api.github.com, so the REST API is unavailable. Do not try
to reach it another way. PRs are created through the browser (or by the
human), and read and merged through the pull refs above.

- Read it only at the moment of a remote operation. Fetch and pull are permitted
  on the Damian and everyone-else workflows, for every contributor on them — and
  on Matt's only when he has just asked for one, since on his workflow no remote
  operation happens unprompted. On the everyone-else path, push is permitted
  only for the contributor's own branch — never `main`. Pushing `main`
  (including PR merges) stays exclusive to Damian's workflow.
- Never print, echo, log, or paste it into a message, commit, or file.
- Never write it into `.git/config`, a remote URL that persists, or any file
  inside the repo.
- If a command containing the token would appear in output, redact it.
- If the token is missing, expired, or rejected: stop and tell the human. Do not
  attempt another auth method.


## Commands

| Command        | Action                                     |
| :------------- | :----------------------------------------- |
| `pnpm dev`           | Dev server on http://localhost:4321                     |
| `pnpm build`         | Static build to `./dist/`                               |
| `pnpm preview`       | Serve the built output                                  |
| `pnpm check`         | `astro check` — types and template errors               |
| `pnpm build:pages`   | Build for the GitHub Pages preview (reads `BASE_PATH`)  |
| `pnpm preview:pages` | Build + serve what Pages serves (gate password `preview`) |
| `pnpm build:prod`    | Production build for www.mersive.com — clears all four env vars, so no gate and no crawler blocking |
| `pnpm check:indexable` | Assert `dist/` carries only the suppression its target expects — none, for production |
| `pnpm verify:prod`   | `build:prod` + `check:indexable` + `check:blocked` — the pre-launch check |

## Layout

```
src/
  pages/            one .astro per route; the file path IS the URL
  layouts/          BaseLayout.astro — head, SEO, chrome, slot
  components/       header, footer, search, CTA band, placeholder blocks…
    JsonLd.astro    serialises one schema.org @graph into the head
  data/             content and config extracted from the POC (nav, SEO copy,
                    comparison matrices, TCO inputs, icon sets, imagery)
    routes.ts       ROUTES — the registry every other data file is keyed to
    seo.ts          TITLES, DESC, OG_IMAGE — one entry per route, no exceptions
    schema.ts       JSON-LD: sitewide nodes, per-route nodes, buildGraph()
    page-titles.ts  short <h1>-style names; feeds breadcrumbs and search
    jobs.ts         the open-roles roster, fetched from Rippling once per build
  lib/
    base.ts         withBase() — the one module here that also ships to the browser
    blocks.ts       shared HTML-fragment builders used by several pages
    pages/*.ts      per-page markup builders (see "Frontmatter caveat")
    rippling.ts     the ATS client: fetch, dedupe by UUID, normalise
    sanitize-html.ts  allowlist sanitiser for the ATS's rich text
  scripts/
    site.ts         loaded on every page: nav, search, reveals, price mode
    pages/*.ts      page-specific behaviour, imported by the page that needs it
    eggs/           the Mission Control launcher and eight canvas games
  styles/
    global.css      Tailwind theme tokens + core component layer
    pages.css       deep-page component families (.ind-, .cnv-, .fx-, .dxt-…)
    games.css       easter-egg chrome; hand-written, no Tailwind
```

## Conventions

**Routes.** Adding a page is never just adding a file. Work the whole list:

1. Create `src/pages/<path>.astro`. The file path IS the URL.
2. Add the route to `ROUTES` in `src/data/routes.ts`. That array is the registry
   everything else keys off — the search index, the pink review page-ID chips,
   and the `Route` union type that the metadata files below are typed against.
3. Add a `TITLES` **and** a `DESC` entry in `src/data/seo.ts`. Both are required;
   see "SEO and structured data" below for why the build will stop you otherwise.
4. Add a `PAGE_TITLES` entry in `src/data/page-titles.ts` — the short human name,
   not the SEO title. It feeds breadcrumbs (visible and structured) and search.
5. Add the route to a `NAV` menu in `src/data/nav.ts` if it should be navigable.
   A route absent from `NAV` still builds and is still indexed; it just gets a
   two-level breadcrumb instead of three.
6. Consider a `src/data/schema.ts` entry. Optional — every page already gets
   `Organization`, `WebSite`, `WebPage` and `BreadcrumbList` without any work.
   Add one only when the page is genuinely a `Product`, `FAQPage`, `Blog` and so
   on. Nothing here is required for a page to be correct.
7. `pnpm check && pnpm build`, per "Verification".

**SEO and structured data.** There is no per-page SEO component to drop in, and
adding one would be a mistake: head content has to sit lexically inside
`BaseLayout.astro`'s `<head>`, because Astro has no equivalent of Svelte's
`<svelte:head>` teleport. `BaseLayout` *is* the SEO component. It resolves
everything from the route key a page already passes, so a correct page needs no
SEO markup of its own.

It emits, for every route: `<title>`, meta description, canonical, the full
Open Graph and Twitter card set, and one JSON-LD `@graph` via `JsonLd.astro`.

Copy lives in `src/data/seo.ts`, structured data in `src/data/schema.ts`. Both
are keyed by route and typed against the `Route` union rather than `string`:

```ts
export const TITLES: Record<Route, string> = { … };   // every route, required
export const SCHEMA: Partial<Record<Route, object[]>> = { … };  // opt-in
```

That distinction is the point. `Record<Route, string>` means a route added to
`ROUTES` without title and description copy is a `pnpm check` failure, not a page
that silently ships a duplicate. It used to be `Record<string, string>`, and the
result was 29 pages inheriting the home page's description without anyone
noticing. Do not loosen these back to `string` to make an error go away — the
error is the feature. Add the copy.

`Partial<Record<Route, …>>` in `schema.ts` is the opposite case: per-route
structured data is genuinely optional, but a mistyped key is still caught.

Three rules when touching either file:

- **Structured data must describe what the page actually shows.** Markup that
  claims more than the rendered page delivers is what gets a site's rich results
  pulled. This is why no `Product` node carries `offers`: the MSRP figures on the
  product pages are still marked pending committee sign-off, and a price in
  JSON-LD is a price Google will surface. Add offers when the numbers are final.
- **Never invent facts to fill a schema slot.** `Organization` has no postal
  address or `contactPoint` because none is published anywhere on the site.
  A plausible-looking wrong address in the entity graph is worse than an absent
  one. Fill them in when marketing confirms the wording, not before.
- **Computed paths need `withBase()`.** `OG_IMAGE` is a rooted path, so it goes
  through `withBase()` before being resolved against `Astro.site` — a bare
  `/og-default.png` resolved against the site URL drops the base and 404s under
  `PAGES_MODE=public`. The same trap as everything in "The base-path split".

`JsonLd.astro` rewrites every `<` in the serialised JSON as a Unicode escape
before it reaches the page. Leave that in: the HTML parser ends a `<script>`
block at the first literal closing script tag regardless of the JSON around it,
so any copy that ever carries inline markup would break the page and open an
injection hole. Nothing in the current copy triggers it, which is exactly why it
would be easy to remove and expensive to have removed.

`public/og-default.png` is a placeholder card, generated rather than designed.
Replacing it with real artwork is a design task nobody has done yet; keep the
1200×630 dimensions when it happens, since they are declared in the head.

**Styling.** Tailwind v4, configured entirely in CSS. Design tokens are `@theme`
entries in `global.css`, so `text-bright`, `bg-surface-4`, `border-line` and
friends are real utilities. Repeated POC component classes (`.card`, `.ph`,
`.cnv-door`…) are defined once in `@layer components` with `@apply`; use plain
utilities for new one-off markup.

**Raw HTML.** Pages emit shared fragments with `<Fragment set:html={...} />`
because the POC's builders return HTML strings and `{expr}` would escape them.
These builders run at build time and do not reach the browser. `src/lib/base.ts`
is the one exception in that directory: it is imported by client scripts too.

**Frontmatter caveat.** Astro's frontmatter scanner mis-reads a template literal
nested inside a `${}` span, silently treating the whole file as markup. Page
builders that do this live in `src/lib/pages/*.ts` and get imported. Keep
frontmatter free of nested template literals.

**Careers, and the one route that is not in the registry.** `/careers` lists the
open roles and `/careers/<slug>` is one pre-rendered page per role, both built
from Mersive's Rippling ATS at build time. `src/lib/rippling.ts` documents the two
endpoints and why it uses both; `src/data/jobs.ts` performs the single fetch.

Four things here are easy to get wrong:

- **The board returns one row per location.** A role open in two states arrives
  twice under the same UUID. `dedupe()` collapses those into one role carrying
  both locations. Bypass it and the same posting appears on the page twice.
- **Job pages break the "work the whole list" rule above,** and they have to: the
  set of roles changes with the ATS, not with the repo, so they cannot be in
  `ROUTES` and get no `TITLES`, `DESC` or `PAGE_TITLES` entry. They pass
  `route="careers"` plus a `child` prop to `BaseLayout`, which extends the
  canonical and the breadcrumb by one level and suppresses the parent's `SCHEMA`
  entry. Because there is no registry copy to fall back on, BaseLayout **throws**
  if a `child` page omits `title` or `description` — that throw is the equivalent
  of the `Record<Route, string>` guard, so do not soften it into a fallback.
- **The descriptions are somebody else's HTML.** Rippling returns rich text
  carrying its editor's inline styling and font stack.
  `src/lib/sanitize-html.ts` reduces it to an allowlist — every attribute dropped
  except a validated `href` — so `.job-body` in `pages.css` styles it by element.
  Keep it an allowlist: unknown tags must never reach the page.
- **The fetch fails soft, and that is deliberate.** No egress, a Rippling outage
  or a shape change leaves `JOBS` empty with `JOBS_REACHABLE === false`, and the
  page says it could not read the listing rather than claiming nothing is open.
  The build still succeeds — a careers page must not be able to block a deploy of
  the other 62 pages. Watch the build log for `[rippling]` warnings.

The listing is therefore only as fresh as the last deploy: a role filled today
stays up until the next push. Both pages say so and link to the live board. A
scheduled rebuild in `deploy.yml` would close that gap and has not been added yet.

No credential is involved. Both endpoints are public — the same ones behind
`ats.rippling.com/mersive-technologies/jobs` — so there is nothing to store and
nothing to rotate. Do not add an API token to `rippling.ts`.

Applications never touch this site: every posting links out to Rippling, and no
résumé, form field or EEOC answer is collected on mersive.com. Keep it that way,
and do not reach for an iframe.

**Easter eggs.** `src/scripts/eggs/runtime.ts` is deliberately one large module:
the games are a dense graph of mutually-recursive draw/update functions that the
POC declared in one scope. Sprite sheets and level maps are in `eggs/data.ts`.
Entry points are published on `window` because the overlay markup and the
solar-system SVG carry inline handlers.

**Review chrome.** The gold POC banner (`components/PocBar.astro`) and the pink
page-ID chips (`initReviewIds` in `scripts/site.ts`) are temporary. Delete both
at production launch.

**The yellow 404 box on the home page.** A temporary link into `/404`, which has no inbound links by design. Delete `.tmpbox` and its markup in `pages/index.astro` at launch.

**Yellow placeholder highlights.** `initVerifyFlags` in `scripts/site.ts` wraps
every bracketed `[…]` note on the page in `<mark class="vflag">` so unverified
copy is impossible to miss in review. Also temporary — delete it and the
`.vflag` rule in `global.css` at production launch.

**The dev panel — the switch that hides all of the above.** A small tab on the
right edge of every page, **armed with Ctrl+Alt+M and invisible until then**.
"Production preview" hides every piece of review chrome at once — the `[…]`
highlights, the page-ID chips, the POC banner, the pre-launch bands, the 404
box, the `T6` / `OPEN` / `GATED` status chips above each `<h1>` — so the page
can be read as the production site; the four pieces are also switchable one at
a time. It also opens Mission Control, or any of the seven
games directly, from pages that have no Polaris star, and previews the seasonal
effects below. Every group collapses. State persists per browser in
`localStorage` under `polaris-dev-panel`.

Nothing else in the site depends on it, and it is four things to delete
together at launch: `components/DevPanel.astro`, `scripts/dev-panel.ts`,
`styles/dev-panel.css` (plus its `@import` in `global.css`), and the
`<DevPanel />` line in `BaseLayout.astro`. The `window.eggLaunch` stub added to
`initEasterEggLoader` in `scripts/site.ts` can go with them; the games ship
either way, so nothing breaks if it stays.

**`scripts/seasonal.ts` is not on that list and must not go with it.** It holds
the seven holiday effects — snow, fireworks, lanterns, hearts, shamrocks, bats,
leaves — as a free-standing canvas module that imports nothing from the
panel and styles its own overlay. The panel is only a way to look at them; the
site has no date trigger yet, so nothing starts one on its own. Shipping one for
real is a `setSeason("snow")` call behind whatever decides the season.

Two things about it are load-bearing rather than stylistic. It is rendered
**first** in `<body>`, and its state restore is an `is:inline` script, because
the attributes have to be on `<html>` before the POC banner parses or a
production preview flashes the banner it is meant to be hiding. And its CSS is
deliberately **unlayered**: Tailwind's `@layer components` loses to unlayered
rules in the cascade, and `.tmpbox` is an Astro-scoped style, so layered
suppression rules would not win.

**September early publish — Route and Engage.** Both ship Q1 2027 and come out of
the early publish. Every mention carries the `al-flag` class (the `SHIPS Q1 2027`
chip, the banner on `products/route`, and the nav entries labelled `· Q1 2027` in
`data/nav.ts`). Grep `al-flag` to find them all; both product pages,
`products/route` and `products/engage`, are removed wholesale along with their
route and nav entries.

The class name is historical — the two were one product called Active Learning
until 25 Aug 2026, when it was renamed Route and polling split out as Engage. The
flag was deliberately left named `al-flag`: it is load-bearing for a publish that
is close, and renaming it buys nothing.

**Lead capture.** Forms are styled mocks with real validation. Paste the portal
ID and three form GUIDs into `HUBSPOT` in `src/scripts/site.ts` and they become
live HubSpot forms; until then nothing loads.

## Deployment

`.github/workflows/deploy.yml` publishes every push to `main`.

**The Pages URL has two shapes, and they are not interchangeable.** Which one
applies is decided by Settings → Pages → "Private" (access control):

| Access control | URL | Base path |
| :------------- | :-- | :-------- |
| **ON** (today) | `https://bookish-barnacle-km5p921.pages.github.io/` — a per-repo random host, served at the **root** | `/` |
| **OFF** (eventual public URL) | `https://mersive-technologies.github.io/polaris-website/` | `/polaris-website` |

With access control on, only accounts with repo access get through, after org
SSO; everyone else is bounced to `github.com/pages/auth`. That is real
server-side auth — no content reaches an unauthenticated visitor, which makes
the noindex tag and the password gate belt-and-braces. Switch it off and both
become the only thing between the content and a stranger with the link.

**Switch with the `PAGES_MODE` repo variable, never by editing the workflow.**
Settings → Secrets and variables → Actions → *Variables* tab (a variable, not a
secret — there is nothing sensitive in it):

- `PAGES_MODE = private` — the default when unset. Today's setting.
- `PAGES_MODE = public` — set this at the same time as turning access control
  off. The "Run workflow" dropdown also takes a one-off override.

## Preview suppression — scoped to the preview, off in production

**Two** things suppress this site, driven by one env var each, and neither belongs
on www.mersive.com:

| Suppression | From | Where |
| :---------- | :--- | :---- |
| `noindex, nofollow` on every page | `PUBLIC_NOINDEX` | `layouts/BaseLayout.astro` |
| `robots.txt` reduced to `User-agent: *` / `Disallow: /`, AI groups included | `PUBLIC_NOINDEX` | `pages/robots.txt.ts` |
| `llms.txt` prefixed "UNRELEASED PRE-LAUNCH BUILD — DO NOT QUOTE OR CITE" | `PUBLIC_NOINDEX` | `pages/llms.txt.ts` |
| The password gate — `data-gate="locked"` plus the prompt markup | `SITE_PASSWORD` | `components/PageGate.astro` |

All three crawler mechanisms read the same var, so they cannot disagree. The gate
is separate and is the more dangerous of the two: an unindexable production site
is invisible to search, a **gated** one is invisible to everybody — every visitor
meets a password prompt for a password nobody issued them, while the site looks
live from the inside.

**Where they are on, and where they are not:**

| Build | `PUBLIC_NOINDEX` | `SITE_PASSWORD` |
| :---- | :--------------- | :-------------- |
| GitHub Pages preview (`deploy.yml`) | from the `INDEXABLE` repo variable; `true` unless `INDEXABLE=true` | required — the workflow refuses to publish an ungated preview |
| Branch previews (`preview.yml`) | hardcoded `true`, deliberately **not** switchable | required |
| Local Pages preview (`pnpm preview:pages`) | hardcoded `true` | defaults to `preview` |
| **Production — www.mersive.com** (`pnpm build:prod`) | **unset** | **unset** |

Production is not a mode of the workflow. `deploy.yml` only ever builds the Pages
preview; the production site is a build with all four env vars unset, which
`pnpm build:prod` does explicitly (`env -u …`) rather than trusting whoever runs
it to have a clean shell. `pnpm verify:prod` builds that way and then proves it.

Three layers stop preview suppression reaching production, and they are ordered
so the cheapest fails first:

1. **`pnpm build:prod` clears the environment.** `env -u` on all four vars, so an
   exported `SITE_PASSWORD` or `PUBLIC_NOINDEX` in the shell cannot leak in.
2. **`BaseLayout` throws at build time** if `SITE_PASSWORD` is set while the
   canonical origin is `www.mersive.com`. Keyed on the origin, not a flag: if the
   pages tell browsers they live at www.mersive.com, they are production whatever
   built them. Astro reads `.env` into `import.meta.env` but not `process.env`, so
   the shell and CI are the only ways in, and both hit this. To exercise the gate
   locally, use `pnpm preview:pages` — it sets a non-production `SITE_URL`.
3. **`pnpm check:indexable` reads what actually shipped.**
   `scripts/check-indexable.py` walks `dist/` and infers the target the same way,
   from the canonicals. On a production build it fails on: the gate on any page,
   `Disallow: /`, any `noindex` outside `src/data/held.ts`, a missing `Sitemap:`
   line, or the `llms.txt` do-not-quote preamble. In **any** build it fails when
   the crawler mechanisms disagree in either direction — blocked `robots.txt` with
   no `noindex` tags, or `noindex` tags with a permissive `robots.txt` — since
   whichever one a given crawler honours would otherwise decide the outcome alone.
   It runs inside `pnpm verify`.

The guard warns without failing when a non-production build is crawlable:
legitimate if `INDEXABLE` was set on purpose, but it puts a second copy of the
site in search results competing with production. Note it does not exempt held
pages from the gate check — a hold suppresses discovery, never access.

### The `INDEXABLE` repo variable

Settings → Secrets and variables → Actions → *Variables* tab:

| `INDEXABLE` | Result |
| :---------- | :----- |
| unset / anything but `true` | `robots.txt` says `Disallow: /`, every page carries `noindex, nofollow`. The default. |
| `true` | `robots.txt` allows and advertises the sitemap; no `noindex` on any page. |

Kept separate from `PAGES_MODE` on purpose: "public URL, still noindexed" is a
useful state — a link for reviewers outside the org before content is signed off.
It fails closed, so only an exact `true` enables indexing and a typo can
under-expose but never over-expose. The build log prints `INDEXING = ALLOWED` or
`BLOCKED` on every run. The "Run workflow" dropdown takes a one-off override.

This used to be welded shut: `PUBLIC_NOINDEX` was hardcoded in the workflow's
`env:` block, where workflow-level env wins over anything resolved into
`$GITHUB_ENV`. Flipping `PAGES_MODE` to `public` therefore produced a site that
was world-readable and *still* emitted `noindex` on every page — the worst shape
a launch bug takes, because nothing errors, nothing looks broken, the site is up,
and it can never be indexed. Do not move `PUBLIC_NOINDEX` back up to that block.

### Two exclusions that are NOT preview blocking — leave them alone

Both survive launch, by design, and `check:indexable` exempts them:

- **Held pages.** `src/data/held.ts` noindexes and disallows a page
  independently of `PUBLIC_NOINDEX`, because a hold has to outlive the preview.
  `solutions/government` is held on Damian's 13–14 Aug 2026 ruling. Releasing it
  is deleting its entry, not a launch step.
- **The permanent `Disallow` lines** in the production state of `robots.txt`: the
  archived POC snapshot, the six redirect stubs, the four retired blog posts.
  Ordinary production hygiene — those are not destinations.

Full pre-launch sequence: `Website/Reports/Pre-launch engineering note (Aug 2026).md`.

The workflow resolves `SITE_URL` and `BASE_PATH` from it, fails closed on an
unrecognised value, and warns in the log when it builds in public mode. After
`configure-pages` it compares what it built against what GitHub reports and
warns on a mismatch — that warning is the early sign the setting was flipped
without updating the variable.

**The symptom of getting this wrong** is distinctive: the page loads and the
password gate appears correctly styled, but everything behind it is unstyled and
inert, and `_astro/*` 404s. The gate looks fine because its CSS is inlined in
the HTML; nothing else is. If you see that, the base path does not match how
Pages is serving the site.

Four env vars shape a build. Unset, they give the production site: root paths,
canonical URLs on www.mersive.com, indexable, no gate.

| Var             | Where it comes from                                      |
| :-------------- | :------------------------------------------------------- |
| `SITE_URL`      | derived from `PAGES_MODE` by the workflow                 |
| `BASE_PATH`     | derived from `PAGES_MODE` by the workflow                 |
| `PUBLIC_NOINDEX`| derived from `INDEXABLE` by the workflow; `true` unless `INDEXABLE=true` |
| `SITE_PASSWORD` | the `SITE_PASSWORD` repo secret. **Preview only** — `deploy.yml` and `preview.yml` fail without it; production must not have it at all, and `BaseLayout` throws if it does |

`pnpm build:prod` clears all four, so the production shape is a command rather
than four things to remember.

**The password gate is a speed bump, not access control.** `PageGate.astro`
renders a password prompt and BaseLayout ships `<html data-gate="locked">`, so
the page is hidden before first paint and stays hidden with JS off. What it does
not do is protect content: it only hides it from the rendered view, and View
Source or `curl` walks straight past it. On this deploy that does not matter,
because GitHub's access control already stops unauthenticated requests before
any HTML is served. The gate is a second, weaker lock behind a real one — useful
if you want to keep the site closed to someone who *does* have repo access, and
close to pointless otherwise.

Only a salted SHA-256 of the password is built in, so a leaked deploy does not
hand over a password someone may have reused. Rotating it means changing the
repo secret and re-running the workflow. The unlock is remembered in
`localStorage`, so reviewers enter it once per browser.

The workflow fails if `SITE_PASSWORD` is missing rather than publishing an
ungated preview. Set it under Settings → Secrets and variables → Actions.

**It is preview-only, and production enforces that.** The gate exists to keep an
unfinished build off the open web; it has no role at www.mersive.com, where the
whole point is that anyone can read the site. `BaseLayout` throws if
`SITE_PASSWORD` is set on a build whose canonical origin is www.mersive.com, and
`pnpm check:indexable` fails if the gate reaches a production `dist/` by any other
route — see "Preview suppression" above. There is no state in which production and
the gate are both correct, so do not add an env var to reconcile them.

**The base-path split.** Pages are authored for the domain root — roughly 280
literal `href="/platform/how"` links, inherited from the POC. Two mechanisms put
them under a subdirectory, and which one applies depends on how the path is
produced:

- *Computed* paths — the search index, hrefs assembled inside client scripts —
  go through `withBase()` in `src/lib/base.ts`. Write new ones this way.
- *Literal* `href="/…"` in markup is left alone in source and rewritten in
  `dist/` by `scripts/rebase-html.mjs` after the build. It also patches the
  meta-refresh target and canonical in Astro's `redirects` stubs, which Astro
  emits without the base applied.

Keeping literals canonical means the day this moves to www.mersive.com, the move
is deleting three env vars — not reverting 280 links.

**Moving to a custom domain.** Point a DNS CNAME at
`mersive-technologies.github.io`, add `public/CNAME` containing the hostname, set
`SITE_URL` to it, and drop `BASE_PATH` from the workflow (base becomes `/`, and
`rebase-html.mjs` no-ops).

## Branch previews

Named branches get their own private preview build, so a contributor can send a
reviewer a link to their own work without merging anything to `main`:

```
https://<preview-host>.pages.github.io/<branch>/
```

`.github/workflows/preview.yml` builds it, `scripts/publish-pages.sh` publishes
it. Production is untouched: `deploy.yml` and the `main` Pages site are not
involved in any of this.

**Which branches: `.github/preview-branches.txt`.** One branch name per line,
matched exactly. The workflow reads the copy of that file **on the branch being
pushed**, not the one on `main` — so adding your own name and pushing is the
whole procedure; nobody has to merge anything first. Deleting a branch takes its
preview down automatically, as does running the workflow with the `prune` input.

**Why the previews are in a second repository.** A repository has exactly one
Pages site, one URL and one visibility setting, and `actions/deploy-pages`
replaces the whole site on every run. This repo's Pages site belongs to `main`,
in public mode. Previews in the same repo would therefore either be wiped by
every deploy to `main` or be forced to share its public visibility — there is no
third option, and no per-branch Pages site exists to reach for
(`actions/deploy-pages` has a `preview` input, but its own description says it
is alpha and not available to the public).

So previews live in **`Mersive-Technologies/polaris-website-previews`**, private,
with Pages access control ON. That is real server-side auth: GitHub requires repo
access and org SSO before serving anything. It is a different and much stronger
thing than the `SITE_PASSWORD` gate, which hides the rendered page but not the
HTML. Both apply to a preview; only the first one actually protects it.

**`.nojekyll` is load-bearing.** The previews repo serves Pages from a branch,
so GitHub runs the tree through Jekyll, and Jekyll silently discards every path
beginning with an underscore — including `_astro/`, which is all of Astro's CSS
and JS. `publish-pages.sh` writes `.nojekyll` at the root on every publish. If a
preview ever renders unstyled and inert with `_astro/*` 404ing, check for that
file before assuming the base-path bug described above: the symptom is identical
and the cause is not.

**Changing the publish logic.** `scripts/test-publish-pages.sh` runs
`publish-pages.sh` against a throwaway local repo and asserts the things that
otherwise fail silently — one preview not deleting another, stale files actually
disappearing on rebuild, `.nojekyll` surviving, unsafe branch names being
refused. It needs no network and no credentials. Run it after touching either
script.

### One-time setup

Only a repo admin can do these, and the workflow fails with an explicit message
until they are done:

1. **`polaris-website-previews` → Settings → Pages**: Source = *Deploy from a
   branch* → `main` / `(root)`; access control = **Private**. That repo's `main`
   is the served tree itself — it holds `.nojekyll`, the generated index and one
   directory per preview, and it is already seeded, so this can be set before
   the first preview runs. It has nothing to do with this repo's `main`.
2. **A deploy key**, so this repo can push to that one. Generate with
   `ssh-keygen -t ed25519 -N "" -f preview_key -C "polaris-website preview publisher"`.
   Add `preview_key.pub` to *polaris-website-previews* → Settings → Deploy keys,
   **with write access ticked**. Add the private key `preview_key` to
   *polaris-website* → Settings → Secrets and variables → Actions → Secrets, named
   `PREVIEW_DEPLOY_KEY`. Delete both local files afterwards. (`PREVIEW_TOKEN`, a
   fine-grained PAT with Contents: Read and write, is supported as a fallback —
   but it expires and dies with the account that made it, so prefer the key.)
Nothing else. The previews host —
`https://congenial-spoon-5wyvp46.pages.github.io` — is hardcoded in
`preview.yml`, the same way `deploy.yml` hardcodes the main site's Pages host.
Access control hands out a random per-repo hostname, but it is stable once
assigned. Override it with a `PREVIEW_SITE_URL` repo variable if the previews
repo is ever recreated and gets a new slug.

That the host is served at the **root** is what makes a preview's base path
`/<branch>`. It is root-served *because* access control is on; turn that off and
the site moves to `mersive-technologies.github.io/polaris-website-previews/`,
at which point every asset 404s until `BASE_PATH` gains that prefix too. The
privacy setting and the URL shape are the same switch.

`SITE_PASSWORD` is already set for `deploy.yml` and is reused; nothing to do.

**Disk.** Each preview is a full site build — currently ~42 MB, mostly blog
imagery — and that branch keeps history. Git deduplicates identical files across
commits and branches, so a second branch and a rebuild of an unchanged page cost
almost nothing, but growth is not zero. The history there is disposable; the
previews repo's README has the squash command.

**Editing the workflow.** `.github/workflows/` needs the `workflow` scope, which
the credential used for automated commits does not have. An agent can write
`preview.yml` or `deploy.yml`, but a human has to commit and push it — that
constraint is why the `INDEXABLE` change to `deploy.yml` spent a while as a patch
file rather than a commit.
