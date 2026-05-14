#!/usr/bin/env bash
# branch-cleanup.sh — I2 branch cleanup utility (plan-enterprise-os #29)
#
# Usage:
#   branch-cleanup.sh --repo <path> [--repo <path> ...] --mode legacy|merged|both \
#     [--integration <branch>] [--dry-run|--apply] [--legacy-force] [--confirm-force]
#
# --mode required; --dry-run is default unless --apply is given.
# --integration auto: repo basename "Project-I2" → main, else → i-dev.
# --legacy-force + --apply requires --confirm-force (irreversibility interlock).

set -euo pipefail
export LC_ALL="${LC_ALL:-en_US.UTF-8}"

# ── Argument parsing ──────────────────────────────────────────────────────────

REPOS=()
MODE=""
INTEGRATION_OVERRIDE=""
DRY_RUN=true
APPLY=false
LEGACY_FORCE=false
CONFIRM_FORCE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)           REPOS+=("$2"); shift 2 ;;
    --mode)           MODE="$2"; shift 2 ;;
    --integration)    INTEGRATION_OVERRIDE="$2"; shift 2 ;;
    --dry-run)        DRY_RUN=true; APPLY=false; shift ;;
    --apply)          APPLY=true; DRY_RUN=false; shift ;;
    --legacy-force)   LEGACY_FORCE=true; shift ;;
    --confirm-force)  CONFIRM_FORCE=true; shift ;;
    *) echo "알 수 없는 인자: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$MODE" ]]; then
  echo "오류: --mode 필수 (legacy|merged|both)" >&2; exit 1
fi
if [[ "$MODE" != "legacy" && "$MODE" != "merged" && "$MODE" != "both" ]]; then
  echo "오류: --mode 값은 legacy, merged, both 중 하나여야 함" >&2; exit 1
fi
if [[ ${#REPOS[@]} -eq 0 ]]; then
  echo "오류: --repo 필수" >&2; exit 1
fi

# Interlock: --legacy-force + --apply without --confirm-force → abort (exit 2)
if $LEGACY_FORCE && $APPLY && ! $CONFIRM_FORCE; then
  echo "거부: --legacy-force --apply 동시 사용 시 --confirm-force 필수 (비가역 작업 보호)" >&2
  exit 2
fi

RUN_LABEL="dry-run"
$APPLY && RUN_LABEL="apply"

# ── Fixed protection list ─────────────────────────────────────────────────────
# i-dev-001 and dev are here unconditionally — never matched as legacy even if they
# look ambiguous. Master confirms staleness manually before any deletion.
FIXED_PROTECTED="main master i-dev i-dev-001 dev gh-pages develop"

# ── Protection helpers ────────────────────────────────────────────────────────

# Newline-separated string of active protect entries for current repo.
# Set by build_protect_list before each repo's mode run.
PROTECT_LIST=""
PROTECT_REASONS=""  # parallel newline-separated list of reasons

build_protect_list() {
  local repo="$1" integration="$2"
  PROTECT_LIST=""
  PROTECT_REASONS=""

  # Fixed list
  local f
  for f in $FIXED_PROTECTED; do
    PROTECT_LIST="${PROTECT_LIST}${f}"$'\n'
    PROTECT_REASONS="${PROTECT_REASONS}protected-list"$'\n'
  done

  # Integration branch (only if not already in fixed list)
  if ! is_protected "$integration"; then
    PROTECT_LIST="${PROTECT_LIST}${integration}"$'\n'
    PROTECT_REASONS="${PROTECT_REASONS}integration"$'\n'
  fi

  # Current HEAD branch
  local head_branch
  head_branch=$(git -C "$repo" symbolic-ref --short HEAD 2>/dev/null || true)
  if [[ -n "$head_branch" ]] && ! is_protected "$head_branch"; then
    PROTECT_LIST="${PROTECT_LIST}${head_branch}"$'\n'
    PROTECT_REASONS="${PROTECT_REASONS}checked-out"$'\n'
  fi

  # Active worktree branches
  local wt_branch
  while IFS= read -r wt_branch; do
    if [[ -n "$wt_branch" ]] && ! is_protected "$wt_branch"; then
      PROTECT_LIST="${PROTECT_LIST}${wt_branch}"$'\n'
      PROTECT_REASONS="${PROTECT_REASONS}active-worktree"$'\n'
    fi
  done < <(git -C "$repo" worktree list --porcelain 2>/dev/null \
            | awk '/^branch refs\/heads\//{print substr($2,12)}')
}

is_protected() {
  local b="$1" entry
  while IFS= read -r entry; do
    [[ "$entry" == "$b" ]] && return 0
  done <<< "$PROTECT_LIST"
  return 1
}

protect_reason() {
  local b="$1" entry reason
  local -a entries reasons
  while IFS= read -r entry; do entries+=("$entry"); done <<< "$PROTECT_LIST"
  while IFS= read -r reason; do reasons+=("$reason"); done <<< "$PROTECT_REASONS"
  local i
  for i in "${!entries[@]}"; do
    [[ "${entries[$i]}" == "$b" ]] && echo "${reasons[$i]}" && return
  done
  echo "unknown"
}

# ── Integration branch detection ──────────────────────────────────────────────

integration_for_repo() {
  local repo="$1"
  if [[ -n "$INTEGRATION_OVERRIDE" ]]; then
    echo "$INTEGRATION_OVERRIDE"
  elif [[ "$(basename "$repo")" == "Project-I2" ]]; then
    echo "main"
  else
    echo "i-dev"
  fi
}

# ── Commit info ───────────────────────────────────────────────────────────────

branch_last_commit() {
  local repo="$1" branch="$2"
  git -C "$repo" log -1 --format='%h %ai' "$branch" 2>/dev/null || echo "unknown"
}

# ── Legacy mode regexes ───────────────────────────────────────────────────────
# Matches Project-I era patterns. i-dev-001 and dev are in FIXED_PROTECTED and
# are blocked before regex evaluation regardless of naming similarity.

branch_matches_legacy() {
  local b="$1"
  [[ "$b" =~ ^wip/enterprise- ]] && return 0
  [[ "$b" =~ ^archive/stash- ]] && return 0
  [[ "$b" =~ ^enterprise-[0-9]+-(s[0-9]+-p[0-9]+|hotfix-[0-9]+)$ ]] && return 0
  return 1
}

# ── Merged mode filter ────────────────────────────────────────────────────────
# I2 WIP branch naming convention.

branch_matches_merged_filter() {
  local b="$1"
  [[ "$b" =~ (-작업|-문서|-핫픽스[0-9]+-(작업|문서))$ ]]
}

# ── Worktree path lookup for a branch ────────────────────────────────────────

worktree_path_for_branch() {
  local repo="$1" branch="$2"
  git -C "$repo" worktree list --porcelain 2>/dev/null \
    | awk -v br="refs/heads/$branch" '
        /^worktree /{wt=$2}
        /^branch /{if($2==br)print wt}
      '
}

# ── Legacy mode ───────────────────────────────────────────────────────────────

run_legacy_mode() {
  local repo="$1" integration="$2"

  build_protect_list "$repo" "$integration"

  local del_targets=() del_last=()
  local report_only=() report_reasons=()
  local protected_branches=() protected_reasons=()

  while IFS= read -r branch; do
    [[ -z "$branch" ]] && continue

    # Protection check before pattern matching
    if is_protected "$branch"; then
      protected_branches+=("$branch")
      protected_reasons+=("$(protect_reason "$branch")")
      continue
    fi

    if ! branch_matches_legacy "$branch"; then
      continue  # Not a legacy candidate — skip silently
    fi

    # Active worktree check: without --legacy-force, treat as protected
    local wt_path
    wt_path=$(worktree_path_for_branch "$repo" "$branch")
    if [[ -n "$wt_path" ]] && ! $LEGACY_FORCE; then
      protected_branches+=("$branch")
      protected_reasons+=("active-worktree")
      continue
    fi

    # Merged check
    local is_merged=false
    local merged_list
    merged_list=$(git -C "$repo" for-each-ref \
                    --format='%(refname:short)' \
                    --merged="$integration" refs/heads/ 2>/dev/null)
    while IFS= read -r mb; do
      [[ "$mb" == "$branch" ]] && is_merged=true && break
    done <<< "$merged_list"

    if $is_merged; then
      del_targets+=("$branch")
      del_last+=("$(branch_last_commit "$repo" "$branch")")
    else
      report_only+=("$branch")
      report_reasons+=("not merged into $integration")
    fi
  done < <(git -C "$repo" for-each-ref --format='%(refname:short)' refs/heads/ 2>/dev/null)

  local del_count=${#del_targets[@]}
  local rpt_count=${#report_only[@]}
  local prt_count=${#protected_branches[@]}

  printf '\n=== 삭제 대상 (count: %d) ===\n' "$del_count"
  local i
  for i in "${!del_targets[@]}"; do
    printf '  %s  (last commit: %s)\n' "${del_targets[$i]}" "${del_last[$i]}"
  done

  if $APPLY && [[ $del_count -gt 0 ]]; then
    printf '\n--- 삭제 실행 결과 ---\n'
    for i in "${!del_targets[@]}"; do
      local b="${del_targets[$i]}"

      # Worktree removal when --legacy-force
      if $LEGACY_FORCE; then
        local wt_p
        wt_p=$(worktree_path_for_branch "$repo" "$b")
        if [[ -n "$wt_p" ]]; then
          if git -C "$repo" worktree remove --force "$wt_p" 2>/tmp/bc_err; then
            printf '  [worktree removed] %s\n' "$wt_p"
          else
            printf '  [worktree remove 실패] %s — %s\n' "$wt_p" "$(cat /tmp/bc_err 2>/dev/null || true)"
          fi
        fi
        if git -C "$repo" branch -D "$b" 2>/tmp/bc_err; then
          printf '  [성공 -D] %s\n' "$b"
        else
          printf '  [실패 -D] %s — %s\n' "$b" "$(cat /tmp/bc_err 2>/dev/null || true)"
        fi
      else
        if git -C "$repo" branch -d "$b" 2>/tmp/bc_err; then
          printf '  [성공 -d] %s\n' "$b"
        else
          printf '  [실패 -d] %s — %s\n' "$b" "$(cat /tmp/bc_err 2>/dev/null || true)"
        fi
      fi
    done
  fi

  printf '\n=== 보고만 (미머지, count: %d) ===\n' "$rpt_count"
  for i in "${!report_only[@]}"; do
    printf '  %s  (reason: %s)\n' "${report_only[$i]}" "${report_reasons[$i]}"
  done

  printf '\n=== 보호됨 (count: %d) ===\n' "$prt_count"
  for i in "${!protected_branches[@]}"; do
    printf '  %s  (reason: %s)\n' "${protected_branches[$i]}" "${protected_reasons[$i]}"
  done

  printf '\n총계: 삭제 %d / 보고 %d / 보호 %d\n' "$del_count" "$rpt_count" "$prt_count"
}

# ── Merged mode ───────────────────────────────────────────────────────────────

run_merged_mode() {
  local repo="$1" integration="$2"

  build_protect_list "$repo" "$integration"

  local del_targets=() del_last=()
  local report_only=() report_reasons=()
  local protected_branches=() protected_reasons=()

  while IFS= read -r branch; do
    [[ -z "$branch" ]] && continue

    # Protection check first
    if is_protected "$branch"; then
      protected_branches+=("$branch")
      protected_reasons+=("$(protect_reason "$branch")")
      continue
    fi

    # I2 naming filter
    if branch_matches_merged_filter "$branch"; then
      del_targets+=("$branch")
      del_last+=("$(branch_last_commit "$repo" "$branch")")
    else
      report_only+=("$branch")
      report_reasons+=("not merged into $integration")
    fi
  done < <(git -C "$repo" for-each-ref \
              --format='%(refname:short)' \
              --merged="$integration" \
              refs/heads/ 2>/dev/null)

  local del_count=${#del_targets[@]}
  local rpt_count=${#report_only[@]}
  local prt_count=${#protected_branches[@]}

  printf '\n=== 삭제 대상 (count: %d) ===\n' "$del_count"
  local i
  for i in "${!del_targets[@]}"; do
    printf '  %s  (last commit: %s)\n' "${del_targets[$i]}" "${del_last[$i]}"
  done

  if $APPLY && [[ $del_count -gt 0 ]]; then
    printf '\n--- 삭제 실행 결과 ---\n'
    for i in "${!del_targets[@]}"; do
      local b="${del_targets[$i]}"
      if git -C "$repo" branch -d "$b" 2>/tmp/bc_err; then
        printf '  [성공] %s\n' "$b"
      else
        printf '  [실패] %s — %s\n' "$b" "$(cat /tmp/bc_err 2>/dev/null || true)"
      fi
    done
  fi

  printf '\n=== 보고만 (미머지, count: %d) ===\n' "$rpt_count"
  for i in "${!report_only[@]}"; do
    printf '  %s  (reason: %s)\n' "${report_only[$i]}" "${report_reasons[$i]}"
  done

  printf '\n=== 보호됨 (count: %d) ===\n' "$prt_count"
  for i in "${!protected_branches[@]}"; do
    printf '  %s  (reason: %s)\n' "${protected_branches[$i]}" "${protected_reasons[$i]}"
  done

  printf '\n총계: 삭제 %d / 보고 %d / 보호 %d\n' "$del_count" "$rpt_count" "$prt_count"
}

# ── Main loop ─────────────────────────────────────────────────────────────────

for repo in "${REPOS[@]}"; do
  if [[ ! -d "$repo" ]]; then
    echo "오류: repo 경로가 존재하지 않음: $repo" >&2
    continue
  fi
  if ! git -C "$repo" rev-parse --git-dir >/dev/null 2>&1; then
    echo "오류: git 저장소가 아님: $repo" >&2
    continue
  fi

  local_integration=$(integration_for_repo "$repo")

  printf '[repo: %s] [mode: %s] [integration: %s] [%s]\n' \
    "$repo" "$MODE" "$local_integration" "$RUN_LABEL"

  if [[ "$MODE" == "legacy" || "$MODE" == "both" ]]; then
    run_legacy_mode "$repo" "$local_integration"
  fi

  if [[ "$MODE" == "merged" || "$MODE" == "both" ]]; then
    run_merged_mode "$repo" "$local_integration"
  fi
done
