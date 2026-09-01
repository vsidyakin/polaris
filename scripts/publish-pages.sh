#!/usr/bin/env bash
#
# Publish one branch's build into the private preview repository.
#
# WHY A SECOND REPOSITORY
# -----------------------
# A GitHub repository has exactly ONE Pages site, with ONE URL and ONE
# visibility setting, and `actions/deploy-pages` replaces the whole thing on
# every run. polaris-website's Pages site is already spoken for: main publishes
# it in public mode. So branch previews cannot live there — not in a
# subdirectory, not anywhere — without either clobbering main on every push or
# inheriting main's public visibility.
#
# They live in polaris-website-previews instead, a PRIVATE repo with Pages
# access control switched on. That is real server-side auth: GitHub bounces
# anyone without repo access and org SSO before a single byte of HTML is
# served. Unlike the SITE_PASSWORD gate, curl does not walk past it.
#
# HOW IT PUBLISHES
# ----------------
# The preview repo serves Pages from a branch — its default branch, `main` —
# not from an Actions artifact. That is the whole trick: a branch is a directory
# tree that this script can write ONE subdirectory of, leaving every other
# branch's preview untouched. An artifact deploy would replace all of it and
# previews would delete each other.
#
#   main/
#     .nojekyll        <- see the warning below; without it the site breaks
#     index.html       <- generated listing of live previews
#     README.md        <- what the repo is; served but harmless
#     matt/            <- one directory per allowlisted branch
#     steve/
#
# Note that `main` here is the PREVIEW repo's main, and has nothing to do with
# polaris-website's main. Nothing this script does can reach the production
# site.
#
# THE .nojekyll FILE IS NOT OPTIONAL. Branch-source Pages runs the tree through
# Jekyll, and Jekyll silently drops every path beginning with an underscore —
# which is precisely where Astro puts its CSS and JS bundles (_astro/). Without
# .nojekyll the preview loads as unstyled, inert HTML with 404s on every asset:
# the same symptom CLAUDE.md describes for a base-path mismatch, from a
# completely different cause. Do not remove it while chasing that bug.
#
# USAGE
#   SLUG=matt scripts/publish-pages.sh                  # publish a preview
#   SLUG=matt PRUNE=1 scripts/publish-pages.sh          # take one down
#
# ENVIRONMENT
#   SLUG           Required. Directory name for this branch's preview; also the
#                  last path segment of its URL. Must be [a-z0-9-].
#   CONTENT_REPO   Required. Push URL of the preview repo — an SSH URL when
#                  authenticating with a deploy key (recommended), or an HTTPS
#                  URL carrying a token.
#   PRUNE          Any non-empty value: delete SLUG's directory instead of
#                  publishing into it. DIST_DIR is not read.
#   DIST_DIR       Build output to publish. Default "dist".
#   WORK_DIR       Scratch clone of the preview repo. Default ".pages-content".
#   CONTENT_BRANCH Default "main". Must match Settings > Pages > Branch in the
#                  preview repo.
#   COMMIT_MESSAGE Default is generated from SLUG.
#   DRY_RUN        Any non-empty value: compose but never push. Used by
#                  scripts/test-publish-pages.sh.
#
# git picks up GIT_SSH_COMMAND from the environment, which is how the workflow
# hands over the deploy key without writing it into any config file here.

set -euo pipefail

DIST_DIR="${DIST_DIR:-dist}"
WORK_DIR="${WORK_DIR:-.pages-content}"
CONTENT_BRANCH="${CONTENT_BRANCH:-main}"
PRUNE="${PRUNE:-}"
DRY_RUN="${DRY_RUN:-}"

if [ -z "${SLUG:-}" ]; then
  echo "publish-pages: SLUG must be set." >&2
  exit 1
fi

# The slug becomes a path under the repo root. A name containing a slash or a
# dot pair could escape it and rewrite the index — or another branch's preview
# — so this is a whitelist, not a blacklist.
if ! printf '%s' "$SLUG" | grep -qE '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$'; then
  echo "publish-pages: SLUG '$SLUG' is not a safe directory name ([a-z0-9-], no leading/trailing dash)." >&2
  exit 1
fi

if [ -z "${CONTENT_REPO:-}" ]; then
  echo "publish-pages: CONTENT_REPO must be set to the preview repo's push URL." >&2
  exit 1
fi

if [ -z "$PRUNE" ] && [ ! -d "$DIST_DIR" ]; then
  echo "publish-pages: DIST_DIR '$DIST_DIR' does not exist. Did the build run?" >&2
  exit 1
fi

COMMIT_MESSAGE="${COMMIT_MESSAGE:-${PRUNE:+Remove }${PRUNE:-Publish }preview: $SLUG}"

# Committing in CI needs an identity; there is no global one on a runner.
git_c() { git -C "$WORK_DIR" -c user.name="github-actions[bot]" \
  -c user.email="41898282+github-actions[bot]@users.noreply.github.com" "$@"; }

# ---------------------------------------------------------------------------
# Clone the branch that is currently being served, or start it the first time.
# ---------------------------------------------------------------------------
fetch_content() {
  rm -rf "$WORK_DIR"
  if git ls-remote --exit-code --heads "$CONTENT_REPO" "$CONTENT_BRANCH" >/dev/null 2>&1; then
    # Shallow: a full site per commit is a lot of history and none of it is
    # needed here. Pushing onto a shallow clone is fine.
    git clone --quiet --depth 1 --branch "$CONTENT_BRANCH" --single-branch \
      "$CONTENT_REPO" "$WORK_DIR"
    echo "publish-pages: cloned '$CONTENT_BRANCH'."
  else
    mkdir -p "$WORK_DIR"
    git -C "$WORK_DIR" init --quiet
    git -C "$WORK_DIR" checkout --quiet -b "$CONTENT_BRANCH"
    git -C "$WORK_DIR" remote add origin "$CONTENT_REPO"
    echo "publish-pages: '$CONTENT_BRANCH' does not exist yet — creating it."
    echo "publish-pages: after this run, set Settings > Pages > Source to"
    echo "               'Deploy from a branch' -> $CONTENT_BRANCH / (root)."
  fi
}

# ---------------------------------------------------------------------------
# Replace this branch's directory. Nothing else in the tree is touched.
# ---------------------------------------------------------------------------
compose() {
  if [ -n "$PRUNE" ]; then
    rm -rf "${WORK_DIR:?}/${SLUG:?}"
    echo "publish-pages: removed $SLUG/."
    return
  fi

  # Replace wholesale rather than copying over the top, so files deleted since
  # the last build actually disappear from the preview.
  rm -rf "${WORK_DIR:?}/${SLUG:?}"
  mkdir -p "$WORK_DIR/$SLUG"
  # -a preserves the tree; the trailing /. copies contents, not the directory.
  cp -a "$DIST_DIR/." "$WORK_DIR/$SLUG/"
  echo "publish-pages: copied $DIST_DIR -> $SLUG/."
}

# ---------------------------------------------------------------------------
# Jekyll would eat _astro/. See the warning in the header before touching this.
# ---------------------------------------------------------------------------
write_nojekyll() {
  touch "$WORK_DIR/.nojekyll"
}

# ---------------------------------------------------------------------------
# Regenerate the root index from what is actually on disk.
# ---------------------------------------------------------------------------
write_index() {
  local slugs=() path name
  for path in "$WORK_DIR"/*/; do
    [ -d "$path" ] || continue
    name="$(basename "$path")"
    [ "$name" = ".git" ] && continue
    slugs+=("$name")
  done

  {
    cat <<'HTML'
<!doctype html>
<meta charset="utf-8">
<meta name="robots" content="noindex, nofollow">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Polaris branch previews</title>
<style>
  body { margin: 0; padding: 3rem 1.5rem; background: #0b0a13; color: #c9d1d9;
         font: 16px/1.6 ui-sans-serif, system-ui, -apple-system, sans-serif; }
  main { max-width: 40rem; margin: 0 auto; }
  h1 { font-size: 1.5rem; margin: 0 0 .5rem; color: #fff; }
  .dek { color: #8b949e; margin: 0 0 2rem; }
  ul { list-style: none; padding: 0; margin: 0; }
  li { border-top: 1px solid #21262d; }
  li:last-child { border-bottom: 1px solid #21262d; }
  a  { display: block; padding: .9rem .25rem; color: #9d8cff;
       text-decoration: none; font-weight: 600; }
  a:hover { background: #12101d; }
  .empty { color: #8b949e; font-style: italic; }
  .note { margin-top: 2.5rem; font-size: .85rem; color: #6e7681; }
</style>
<main>
<h1>Polaris branch previews</h1>
<p class="dek">One build per allowlisted branch, rebuilt on every push.</p>
HTML

    if [ ${#slugs[@]} -eq 0 ]; then
      echo '<p class="empty">No previews are published right now.</p>'
    else
      echo '<ul>'
      for name in "${slugs[@]}"; do
        # Slugs are [a-z0-9-] by construction, but this is generated markup and
        # an unescaped name would be an injection point if that ever loosened.
        name="$(printf '%s' "$name" | sed 's/&/\&amp;/g; s/</\&lt;/g; s/>/\&gt;/g; s/"/\&quot;/g')"
        printf '<li><a href="./%s/">%s</a></li>\n' "$name" "$name"
      done
      echo '</ul>'
    fi

    cat <<'HTML'
<p class="note">Private: GitHub requires repo access and org SSO before serving
any of this. Branches are listed in .github/preview-branches.txt in
polaris-website.</p>
</main>
HTML
  } > "$WORK_DIR/index.html"

  if [ ${#slugs[@]} -eq 0 ]; then
    echo "publish-pages: no previews published."
  else
    echo "publish-pages: index lists ${#slugs[@]} preview(s): ${slugs[*]}."
  fi
}

# ---------------------------------------------------------------------------
# Commit and push. On rejection, start over from the new remote state — another
# branch published while this job was working, and its files must survive.
# ---------------------------------------------------------------------------
publish() {
  local attempt
  for attempt in 1 2 3; do
    fetch_content
    compose
    write_nojekyll
    write_index

    git_c add --all
    if git_c diff --cached --quiet; then
      echo "publish-pages: nothing changed; the published site is already correct."
      return 0
    fi
    git_c commit --quiet -m "$COMMIT_MESSAGE"

    if [ -n "$DRY_RUN" ]; then
      echo "publish-pages: DRY_RUN set — composed but not pushed."
      return 0
    fi

    if git_c push --quiet origin "HEAD:$CONTENT_BRANCH"; then
      echo "publish-pages: pushed to $CONTENT_BRANCH (attempt $attempt)."
      return 0
    fi

    echo "publish-pages: push rejected — another preview published first. Recomposing (attempt $attempt/3)."
    sleep $(( attempt * 3 ))
  done

  echo "::error::publish-pages: could not push $CONTENT_BRANCH after 3 attempts." >&2
  exit 1
}

publish
echo "publish-pages: done."
