#!/usr/bin/env bash
#
# Exercise scripts/publish-pages.sh against a throwaway local bare repo.
#
# The failures this guards against are the silent ones: one preview deleting
# another, a stale file surviving a rebuild, or a missing .nojekyll quietly
# costing every _astro/ asset. None of those make a deploy go red — someone
# just finds a broken page hours later.
#
# Run: bash scripts/test-publish-pages.sh
# No network, no credentials, nothing outside its own temp directory.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

REMOTE="$TMP/remote.git"
git init --quiet --bare "$REMOTE"

pass=0
fail=0
ok()   { echo "  ok    $1"; pass=$((pass + 1)); }
bad()  { echo "  FAIL  $1"; fail=$((fail + 1)); }
check()        { [ -e "$TMP/work/$1" ] && ok "$1" || bad "$1 is missing"; }
check_absent() { [ -e "$TMP/work/$1" ] && bad "$1 should be gone" || ok "$1 absent"; }
check_grep()   { grep -q "$2" "$TMP/work/$1" && ok "$3" || bad "$3"; }

make_dist() {
  rm -rf "$TMP/dist"
  mkdir -p "$TMP/dist/_astro"
  echo "$1" > "$TMP/dist/index.html"
  echo "css for $1" > "$TMP/dist/_astro/app.css"
}

run() {
  SLUG="$1" \
  PRUNE="${2:-}" \
  DIST_DIR="$TMP/dist" \
  WORK_DIR="$TMP/work" \
  CONTENT_REPO="$REMOTE" \
    bash "$HERE/scripts/publish-pages.sh" > "$TMP/log" 2>&1 || {
      echo "  FAIL  publish-pages exited non-zero for '$1'"; cat "$TMP/log"; exit 1
    }
}

# Expect a non-zero exit, i.e. the script refused.
refuses() {
  local label="$1"; shift
  # Defaults first, caller's assignments last — with env(1) the later one wins,
  # which is what lets a case override CONTENT_REPO to empty.
  if env DIST_DIR="$TMP/dist" WORK_DIR="$TMP/work" CONTENT_REPO="$REMOTE" "$@" \
     bash "$HERE/scripts/publish-pages.sh" >/dev/null 2>&1; then
    bad "$label was allowed"
  else
    ok "$label refused"
  fi
}

echo "1. first publish creates the branch, the preview and the scaffolding"
make_dist "MATT"
run matt
check "matt/index.html"
check "matt/_astro/app.css"
check "index.html"
check ".nojekyll"    # Jekyll would drop _astro/ without this
check_grep "index.html" ">matt<" "index lists matt"

echo "2. a second preview does not disturb the first"
make_dist "STEVE"
run steve
check "matt/index.html"
check "steve/index.html"
check_grep "matt/index.html" "MATT" "matt's preview is untouched"
check_grep "index.html" ">steve<" "index lists steve"

echo "3. republishing a branch replaces it — stale files do not linger"
rm -rf "$TMP/dist"; mkdir -p "$TMP/dist"
echo "MATT-SLIM" > "$TMP/dist/index.html"
run matt
check_absent "matt/_astro/app.css"
check_grep "matt/index.html" "MATT-SLIM" "matt rebuilt"
check "steve/index.html"
check ".nojekyll"

echo "4. pruning one preview leaves the others standing"
run matt 1
check_absent "matt"
check "steve/index.html"
check_grep "index.html" ">steve<" "index still lists steve"
grep -q ">matt<" "$TMP/work/index.html" && bad "index still lists matt" || ok "index dropped matt"

echo "5. pruning the last preview leaves a valid, empty index"
run steve 1
check_absent "steve"
check "index.html"
check ".nojekyll"
check_grep "index.html" "No previews are published" "index says it is empty"

echo "6. unsafe slugs are refused"
refuses "a slug with a slash"        SLUG="preview/matt"
refuses "a traversing slug"          SLUG=".."
refuses "a slug with a dot"          SLUG="matt.2"
refuses "an uppercase slug"          SLUG="Matt"
refuses "an empty slug"              SLUG=""
refuses "a missing CONTENT_REPO"     SLUG="matt" CONTENT_REPO=""

echo
echo "$pass passed, $fail failed"
[ "$fail" -eq 0 ]
