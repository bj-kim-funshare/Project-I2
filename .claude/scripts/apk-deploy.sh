#!/usr/bin/env bash
#
# apk-deploy.sh — pre-deploy deploy_command for the data-craft-mobile-apk target.
#
# pre-deploy runs `build_command` (flutter build apk --release) first, then this
# script as `deploy_command`. By the time we run, the release APK exists at
# <repo>/build/app/outputs/flutter-apk/app-release.apk.
#
# We publish that binary to an ORPHAN `apk-deploy` branch (binary + version
# MANIFEST only — no main history inherited, so the branch holds just the
# artifacts). Master downloads/sideloads the APK from that branch.
#
# Orphan rationale: the APK is ~73MB. A from-main branch would carry the full
# source tree plus the binary every deploy; orphan keeps each commit to the
# artifact + manifest. (Retention is still a cost — see deploy.md note.)
#
# Usage:
#   apk-deploy.sh <repo-path>
# Env:
#   APK_DEPLOY_DRY_RUN=1   commit locally but skip the origin push (for validation).
#
# Exit non-zero on any failure (pre-deploy halts the deploy loop on this).

set -euo pipefail

REPO="${1:?usage: apk-deploy.sh <repo-path>}"
BRANCH="apk-deploy"
APK_REL="build/app/outputs/flutter-apk/app-release.apk"
APK="$REPO/$APK_REL"

if [[ ! -f "$APK" ]]; then
  echo "APK-DEPLOY ERROR: built APK not found at $APK (build_command must run first)." >&2
  exit 1
fi

SHA="$(git -C "$REPO" rev-parse --short HEAD)"
# Timestamp is read from the environment, not generated, so the script stays
# deterministic for callers that pin it; fall back to wall clock otherwise.
STAMP="${APK_DEPLOY_STAMP:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"
APK_SIZE="$(du -h "$APK" | cut -f1 | tr -d ' ')"

WT_PARENT="$REPO/../$(basename "$REPO")-worktrees"
WT="$WT_PARENT/$BRANCH"
mkdir -p "$WT_PARENT"

git -C "$REPO" worktree prune
# Remove any stale worktree from a previous (interrupted) run.
if git -C "$REPO" worktree list --porcelain | grep -qF "worktree $(cd "$WT_PARENT" && pwd)/$BRANCH" 2>/dev/null; then
  git -C "$REPO" worktree remove --force "$WT" 2>/dev/null || true
fi
rm -rf "$WT"

git -C "$REPO" fetch origin "$BRANCH" 2>/dev/null || true

if git -C "$REPO" show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
  # Branch already exists on origin — check it out and update in place.
  git -C "$REPO" worktree add -B "$BRANCH" "$WT" "origin/$BRANCH"
  FIRST_PUSH=0
else
  # First deploy — create a fresh orphan branch (no parent, empty tree).
  # Clear any stale LOCAL apk-deploy left by an interrupted prior first-run
  # (never pushed, so discardable) to keep orphan creation idempotent.
  git -C "$REPO" branch -D "$BRANCH" 2>/dev/null || true
  git -C "$REPO" worktree add --orphan -b "$BRANCH" "$WT"
  # Orphan worktree starts with the working tree populated from HEAD; clear it
  # so the branch contains ONLY the artifact + manifest.
  git -C "$WT" rm -rf . >/dev/null 2>&1 || true
  FIRST_PUSH=1
fi

cp "$APK" "$WT/app-release.apk"
cat > "$WT/MANIFEST" <<EOF
artifact: app-release.apk
source_commit: $SHA
built_at: $STAMP
apk_size: $APK_SIZE
signing: debug (no key.properties — sideload only)
EOF

git -C "$WT" add app-release.apk MANIFEST
if git -C "$WT" diff --cached --quiet; then
  echo "APK-DEPLOY: no change vs current apk-deploy (same artifact) — skipping commit."
  git -C "$REPO" worktree remove --force "$WT"
  exit 0
fi

git -C "$WT" commit -q -m "apk: $SHA $STAMP (release, debug-signed, $APK_SIZE)"

if [[ "${APK_DEPLOY_DRY_RUN:-0}" == "1" ]]; then
  echo "APK-DEPLOY DRY-RUN: committed to local $BRANCH ($SHA), push skipped."
else
  if [[ "$FIRST_PUSH" == "1" ]]; then
    git -C "$WT" push -u origin "$BRANCH"
  else
    git -C "$WT" push origin "$BRANCH"
  fi
  echo "APK-DEPLOY: published app-release.apk ($APK_SIZE) to origin/$BRANCH ($SHA)."
fi

git -C "$REPO" worktree remove --force "$WT"
git -C "$REPO" worktree prune
