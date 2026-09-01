// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

/* Deploy target.
   Unset -> the production shape: served from the domain root, canonical URLs on
   www.mersive.com. The GitHub Pages preview sets both vars (see
   .github/workflows/deploy.yml) so the site can live under a subdirectory. */
/* `||` not `??`: an env var set to "" must fall back, not become base: ''. */
const site = process.env.SITE_URL || 'https://www.mersive.com';
const base = process.env.BASE_PATH || '/';

// https://astro.build/config
export default defineConfig({
  // Static output: every route below src/pages/ is pre-rendered to HTML.
  output: 'static',
  site,
  /* Astro rewrites its own emitted URLs (bundled JS/CSS, image assets) to sit
     under this prefix. Hand-written href="/…" in markup is NOT its concern —
     `pnpm rebase` handles those after the build. */
  base,
  trailingSlash: 'ignore',
  build: {
    // /platform/how -> /platform/how/index.html, so links have no .html suffix.
    format: 'directory',
  },
  // Device codenames that shipped in earlier POC builds, kept reachable.
  redirects: {
    '/products/stick': '/products/launch',
    '/products/element': '/products/launch',
    '/products/toggle': '/products/link',
    '/products/tablet': '/products/host',
    '/compare': '/compare/hub',
    // "Work at Mersive" and the open-roles listing merged into /careers.
    '/resources/hiring': '/careers',
    '/home': '/',

    /* Retired blog posts, from the 12 Aug 2026 blog review deck. Each of these
       was assessed HARMFUL — legacy Solstice naming, a dated news hook, or a
       duplicate of another post — and each redirects to the page that now owns
       the intent, so the inbound links and any accumulated authority land
       somewhere current rather than on a 404.

       Retired, not deleted: the copy is in git history, and the deck's own
       recommendation for each is recorded in
       Website/Reports/Blog deck actions (45 existing posts).md. */

    // "How Solstice Digital Signage Can Support the Return to the Office" — a
    // 2021 return-to-office hook wrapped around a legacy product name. The
    // evergreen signage guide published today owns this intent.
    '/resources/blog/digital-signage-rto': '/resources/blog/digital-signage-for-business',

    // "Why We Built the Mersive Collaboration Suite" duplicated "Introducing the
    // Mersive Collaboration Suite" — the deck's instruction was to consolidate
    // the two into one platform story with lineage and redirects. The surviving
    // post is the rewritten launch story.
    '/resources/blog/why-we-built-suite': '/resources/blog/introducing-suite',

    // "Mersive Solstice Takes Home Two Awards from InfoComm 2018" — an eight-
    // year-old award announcement. Archived from the active blog per the deck;
    // the hub is the honest destination, not a product page it never described.
    '/resources/blog/infocomm-2018-awards': '/resources/blog',

    // "Mersive Solstice at the University of Warwick" — the same customer is a
    // full case study with stats and scale, which is strictly the better page.
    '/resources/blog/warwick': '/resources/cases/warwick',
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
