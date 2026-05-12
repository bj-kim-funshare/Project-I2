#!/usr/bin/env bash
# I2 statusline — minimal v1.
# Reads Claude Code's statusline JSON from stdin, emits 3 colored lines.
# Spec: https://code.claude.com/docs/ko/statusline
#
# Registration (in .claude/settings.json):
#   "statusLine": {
#     "type": "command",
#     "command": "$CLAUDE_PROJECT_DIR/.claude/scripts/statusline.sh",
#     "padding": 1,
#     "refreshInterval": 15
#   }

set -u

input=$(cat)

# Safe jq extraction with defaults.
get() { jq -r "$1 // \"$2\"" <<< "$input" 2>/dev/null || echo "$2"; }
getnum() { jq -r "$1 // 0" <<< "$input" 2>/dev/null | cut -d. -f1; }

MODEL=$(get '.model.display_name' '?')
EFFORT=$(get '.effort.level' '')
PCT=$(getnum '.context_window.used_percentage')
COST=$(get '.cost.total_cost_usd' '0')
DURATION_MS=$(getnum '.cost.total_duration_ms')
LINES_ADD=$(getnum '.cost.total_lines_added')
LINES_DEL=$(getnum '.cost.total_lines_removed')
RL_5H=$(get '.rate_limits.five_hour.used_percentage' '')
RL_7D=$(get '.rate_limits.seven_day.used_percentage' '')

# ANSI colors.
RESET=$'\033[0m'
DIM=$'\033[2m'
BOLD=$'\033[1m'
RED=$'\033[31m'
GREEN=$'\033[32m'
YELLOW=$'\033[33m'
BLUE=$'\033[34m'
MAGENTA=$'\033[35m'
CYAN=$'\033[36m'

# Helpers.
fmt_duration() {
  local ms=$1
  local s=$(( ms / 1000 ))
  local h=$(( s / 3600 ))
  local m=$(( (s % 3600) / 60 ))
  local rs=$(( s % 60 ))
  if [ $h -gt 0 ]; then printf "%dh%02dm" $h $m
  elif [ $m -gt 0 ]; then printf "%dm%02ds" $m $rs
  else printf "%ds" $rs
  fi
}

fmt_cost() { printf "%.2f" "$1"; }

# Context window color by percentage.
pct_color() {
  local p=$1
  if [ "$p" -ge 85 ]; then printf '%s' "$RED"
  elif [ "$p" -ge 60 ]; then printf '%s' "$YELLOW"
  else printf '%s' "$GREEN"
  fi
}

# Git info (best-effort; cwd-based).
GIT_BRANCH=""
GIT_DIRTY=""
if command -v git >/dev/null 2>&1; then
  GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
  if [ -n "$GIT_BRANCH" ]; then
    if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
      GIT_DIRTY="*"
    fi
  fi
fi

CWD_BASE=$(basename "$PWD")

# Build effort badge.
EFFORT_BADGE=""
case "$EFFORT" in
  low)    EFFORT_BADGE="${DIM}low${RESET}" ;;
  medium) EFFORT_BADGE="${DIM}med${RESET}" ;;
  high)   EFFORT_BADGE="${BOLD}high${RESET}" ;;
  *)      EFFORT_BADGE="" ;;
esac

# Rate limit badge.
rl_badge() {
  local label=$1
  local pct=$2
  [ -z "$pct" ] && { echo ""; return; }
  local color
  if [ "$pct" -ge 80 ]; then color=$RED
  elif [ "$pct" -ge 50 ]; then color=$YELLOW
  else color=$GREEN
  fi
  printf '%s%s %d%%%s' "$color" "$label" "$pct" "$RESET"
}

RL5_BADGE=$(rl_badge "5h" "$RL_5H")
RL7_BADGE=$(rl_badge "7d" "$RL_7D")

# Line 1: model + effort + ctx % + cost + duration.
PCT_COLOR=$(pct_color "$PCT")
LINE1=$(printf '%s%s%s' "$CYAN" "$MODEL" "$RESET")
[ -n "$EFFORT_BADGE" ] && LINE1+=" ${EFFORT_BADGE}"
LINE1+=" │ ctx ${PCT_COLOR}${PCT}%${RESET}"
LINE1+=" │ \$$(fmt_cost "$COST")"
LINE1+=" │ ${DIM}$(fmt_duration "$DURATION_MS")${RESET}"

# Line 2: cwd + git + lines.
LINE2=$(printf '%s%s%s' "$MAGENTA" "$CWD_BASE" "$RESET")
if [ -n "$GIT_BRANCH" ]; then
  LINE2+=" │ ${BLUE}⎇ ${GIT_BRANCH}${GIT_DIRTY}${RESET}"
fi
if [ "$LINES_ADD" -gt 0 ] || [ "$LINES_DEL" -gt 0 ]; then
  LINE2+=" │ ${GREEN}+${LINES_ADD}${RESET} ${RED}-${LINES_DEL}${RESET}"
fi

# Line 3: rate limits + token usage hint.
LINE3=""
if [ -n "$RL5_BADGE" ] || [ -n "$RL7_BADGE" ]; then
  [ -n "$RL5_BADGE" ] && LINE3+="$RL5_BADGE"
  [ -n "$RL7_BADGE" ] && { [ -n "$LINE3" ] && LINE3+=" │ "; LINE3+="$RL7_BADGE"; }
else
  LINE3+="${DIM}rate-limit: n/a${RESET}"
fi

# Output. Claude Code reads up to ~5 lines.
printf '%s\n' "$LINE1"
printf '%s\n' "$LINE2"
[ -n "$LINE3" ] && printf '%s\n' "$LINE3"
