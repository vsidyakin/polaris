# Mersive Polaris website

The marketing site for Mersive Polaris, built with [Astro](https://astro.build)
and [Tailwind CSS](https://tailwindcss.com). Output is fully static: 57
pre-rendered pages, no server required.

## Getting started

```sh
pnpm install
pnpm dev          # http://localhost:4321
```

## Commands

| Command        | Action                                              |
| :------------- | :-------------------------------------------------- |
| `pnpm dev`     | Start the dev server                                 |
| `pnpm build`   | Build the static site to `./dist/`                   |
| `pnpm preview` | Serve the built output locally                       |
| `pnpm check`   | Type-check components, pages and templates           |

## Project structure

```
src/
├── pages/         one .astro file per route — the path is the URL
├── layouts/       BaseLayout: <head>, SEO, header, footer, overlays
├── components/    header, footer, search, CTA band, placeholder blocks
├── data/          nav tree, SEO copy, comparison matrices, TCO inputs, imagery
├── lib/           build-time HTML-fragment builders shared across pages
├── scripts/       client-side behaviour (site-wide, per-page, easter eggs)
└── styles/        Tailwind theme tokens and the component layer
public/            static assets served as-is
```

Astro renders everything under `src/pages/` at build time, so `/platform/how`
resolves to `dist/platform/how/index.html` with its own `<title>` and meta
description.

`AGENTS.md` documents the conventions and the few sharp edges worth knowing
before making changes.

## Deploying

`pnpm build` produces a static `dist/` directory that any static host will
serve. Set `site` in `astro.config.mjs` to the production origin so canonical
URLs and Open Graph tags resolve correctly.

Pushing to `main` deploys the shared preview site through
`.github/workflows/deploy.yml`.

## Branch previews

Named branches build to their own private preview, so work can be shown to a
reviewer without merging anything to `main`:

| Branch   | Preview                                                          |
| :------- | :--------------------------------------------------------------- |
| `matt`   | https://congenial-spoon-5wyvp46.pages.github.io/matt/             |
| `steve`  | https://congenial-spoon-5wyvp46.pages.github.io/steve/            |
| `john`   | https://congenial-spoon-5wyvp46.pages.github.io/john/             |
| `damian` | https://congenial-spoon-5wyvp46.pages.github.io/damian/           |
| *all*    | https://congenial-spoon-5wyvp46.pages.github.io/                  |

A branch's link works once that branch has been pushed and built at least once;
until then it 404s.

**How it works.** Pushing an allowlisted branch runs
`.github/workflows/preview.yml`, which builds the site with the base path set to
`/<branch>` and pushes the result into a directory of that name in a **second
repository**, `Mersive-Technologies/polaris-website-previews`. That repo's `main`
*is* its served tree — GitHub Pages is pointed straight at it — so the push is
the deploy. Each publish rewrites only its own directory, so previews cannot
overwrite one another.

**Why a second repository.** A repository gets exactly one Pages site, with one
URL and one visibility setting, and a deploy replaces the whole site. This
repo's Pages site belongs to `main` and is public. Previews hosted here would
therefore either be wiped by every deploy to `main` or be forced to share its
public visibility — so they live next door instead, in a private repo with Pages
access control switched on. GitHub requires repo access and org SSO before
serving any of it, which is real authentication rather than the password gate on
the shared preview site.

Nothing in the preview pipeline can touch production: `preview.yml` holds no
write permission on this repository and contains no Pages action at all.

**Which branches.** `.github/preview-branches.txt`, read from the branch being
pushed — add a name there and push, no merge to `main` required. Deleting a
branch takes its preview down automatically.

The "Branch previews" section of `AGENTS.md` covers the setup and the sharp
edges, `scripts/publish-pages.sh` documents the publish itself, and
`scripts/test-publish-pages.sh` checks it.
