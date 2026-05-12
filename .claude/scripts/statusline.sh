#!/usr/bin/env bash
# I2 statusline — v1.1 (rich).
# Reads Claude Code's statusline JSON from stdin, emits 4 colored lines.
# Spec: https://code.claude.com/docs/ko/statusline
#
# Registration (in .claude/settings.json):
#   "statusLine": {
#     "type": "command",
#     "command": "$CLAUDE_PROJECT_DIR/.claude/scripts/statusline.sh",
#     "padding": 1,
#     "refreshInterval": 15
#   }
#
# What v1.1 adds over v1.0:
#   - ctx% text bar (▓▓░░░░░░░░)
#   - git working-tree split (untracked / modified / deleted)
#   - rate-limit reset countdown (5h: h+m, 7d: d+h+m)
#   - total tokens (K/M abbreviated)
#   - cc-version, vim mode, sub-agent name conditional badges
#   - Δ tokens since last skill trigger (when state file present)
#
# Excluded vs old I-OS statusline:
#   - Persona display (§D-1 페르소나 폐기)
#   - Leader sibling branch (그룹 manifest 기반 재구성 deferred)
#   - Plan state (deprecated .claude/state/ — needs new state home)
#   - Wake/bg/shell counts (bg-work.sh / locks/shell-running 폐기)
#   - Last user prompt (requires record-last-user-prompt.sh hook — not yet set up)

set -uo pipefail

input=$(cat)

# ── Colors ────────────────────────────────────────────────────────────────
CYAN=$'\033[36m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; RED=$'\033[31m'
BLUE=$'\033[34m'; MAGENTA=$'\033[35m'; DIM=$'\033[2m'; BOLD=$'\033[1m'; RESET=$'\033[0m'

# ── JSON extract helpers ──────────────────────────────────────────────────
jget() { jq -r "$1 // \"$2\"" <<<"$input" 2>/dev/null || echo "$2"; }
jnum() { jq -r "$1 // 0" <<<"$input" 2>/dev/null | cut -d. -f1; }
jraw() { jq -r "$1 // empty" <<<"$input" 2>/dev/null; }

MODEL=$(jget '.model.display_name' '?')
EFFORT=$(jget '.effort.level' '')
CC_VERSION=$(jraw '.version')
VIM_MODE=$(jraw '.vim.mode')
AGENT_NAME=$(jraw '.agent.name')
PCT=$(jnum '.context_window.used_percentage')
TOTAL_IN=$(jnum '.context_window.total_input_tokens')
TOTAL_OUT=$(jnum '.context_window.total_output_tokens')
COST=$(jget '.cost.total_cost_usd' '0')
DURATION_MS=$(jnum '.cost.total_duration_ms')
LINES_ADD=$(jnum '.cost.total_lines_added')
LINES_DEL=$(jnum '.cost.total_lines_removed')
SESSION_ID=$(jget '.session_id' 'noid')
RL_5H=$(jraw '.rate_limits.five_hour.used_percentage' | cut -d. -f1)
RL_7D=$(jraw '.rate_limits.seven_day.used_percentage' | cut -d. -f1)
RESET_5H=$(jraw '.rate_limits.five_hour.resets_at')
RESET_7D=$(jraw '.rate_limits.seven_day.resets_at')

# Per-session token-delta state. Tracks total tokens at last skill trigger for Δ display.
# Lives under /tmp (session-scoped, ephemeral). Survives statusline refreshes but not reboots.
STATE_DIR="/tmp/i2-statusline-${USER:-default}"
mkdir -p "$STATE_DIR" 2>/dev/null
PREV_FILE="$STATE_DIR/prev-${SESSION_ID}.txt"
BASE_FILE="$STATE_DIR/base-${SESSION_ID}.txt"

# ── Helpers ────────────────────────────────────────────────────────────────

fmt_duration_short() {
  local ms=$1 s h m rs
  s=$(( ms / 1000 ))
  h=$(( s / 3600 ))
  m=$(( (s % 3600) / 60 ))
  rs=$(( s % 60 ))
  if [ $h -gt 0 ]; then printf "%dh%02dm" $h $m
  elif [ $m -gt 0 ]; then printf "%dm%02ds" $m $rs
  else printf "%ds" $rs
  fi
}

fmt_cost() { printf "%.2f" "$1" 2>/dev/null || echo "0.00"; }

fmt_tokens() {
  local n=$1
  if [ "$n" -ge 1000000 ]; then
    awk -v n="$n" 'BEGIN{printf "%.1fM", n/1000000}'
  elif [ "$n" -ge 1000 ]; then
    awk -v n="$n" 'BEGIN{printf "%.1fK", n/1000}'
  else
    printf '%s' "$n"
  fi
}

# ISO8601 reset target → "Xh Ym" or "Xd Yh Zm".
fmt_reset_hm() {
  local target=$1 now diff h m
  [ -z "$target" ] && { echo ""; return; }
  target=$(date -j -f "%Y-%m-%dT%H:%M:%S" "${target%%.*}" "+%s" 2>/dev/null || \
           date -d "$target" "+%s" 2>/dev/null || echo "")
  [ -z "$target" ] && { echo ""; return; }
  now=$(date +%s); diff=$((target - now))
  [ "$diff" -le 0 ] && { echo "0h0m"; return; }
  h=$((diff / 3600)); m=$(((diff % 3600) / 60))
  echo "${h}h${m}m"
}

fmt_reset_dhm() {
  local target=$1 now diff d h m
  [ -z "$target" ] && { echo ""; return; }
  target=$(date -j -f "%Y-%m-%dT%H:%M:%S" "${target%%.*}" "+%s" 2>/dev/null || \
           date -d "$target" "+%s" 2>/dev/null || echo "")
  [ -z "$target" ] && { echo ""; return; }
  now=$(date +%s); diff=$((target - now))
  [ "$diff" -le 0 ] && { echo "0d0h0m"; return; }
  d=$((diff / 86400)); h=$(((diff % 86400) / 3600)); m=$(((diff % 3600) / 60))
  echo "${d}d${h}h${m}m"
}

# Context bar — 10 cells, ▓ filled / ░ empty.
ctx_bar() {
  local p=$1 filled empty bar=""
  filled=$((p / 10)); empty=$((10 - filled))
  [ $filled -lt 0 ] && filled=0; [ $filled -gt 10 ] && filled=10
  [ $empty -lt 0 ] && empty=0; [ $empty -gt 10 ] && empty=10
  if [ $filled -gt 0 ]; then printf -v f "%${filled}s" ""; bar="${f// /▓}"; fi
  if [ $empty -gt 0 ]; then printf -v e "%${empty}s" ""; bar="${bar}${e// /░}"; fi
  printf '%s' "$bar"
}

pct_color() {
  local p=$1
  if [ "$p" -ge 90 ]; then printf '%s' "$RED"
  elif [ "$p" -ge 70 ]; then printf '%s' "$YELLOW"
  else printf '%s' "$GREEN"; fi
}

rl_color() {
  local p=$1
  [ -z "$p" ] && { printf '%s' "$DIM"; return; }
  if [ "$p" -ge 80 ]; then printf '%s' "$RED"
  elif [ "$p" -ge 50 ]; then printf '%s' "$YELLOW"
  else printf '%s' "$GREEN"; fi
}

count_color() {
  local n=$1 yellow_at=$2 red_at=$3
  if [ "$n" -le 0 ]; then printf '%s' "$DIM"
  elif [ "$n" -ge "$red_at" ]; then printf '%s' "$RED"
  elif [ "$n" -ge "$yellow_at" ]; then printf '%s' "$YELLOW"
  else printf '%s' "$GREEN"; fi
}

# ── Git working-tree counts (porcelain parse, cached) ──────────────────────
GIT_BRANCH=""
GIT_DIRTY=""
GIT_ADD=0
GIT_MOD=0
GIT_DEL=0
if command -v git >/dev/null 2>&1 && git rev-parse --git-dir >/dev/null 2>&1; then
  GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
  PORCELAIN=$(git status --porcelain 2>/dev/null || echo "")
  if [ -n "$PORCELAIN" ]; then
    GIT_DIRTY="*"
    while IFS= read -r line; do
      x=${line:0:1}; y=${line:1:1}
      if [ "$x" = "?" ] && [ "$y" = "?" ]; then GIT_ADD=$((GIT_ADD+1))
      elif [ "$x" = "D" ] || [ "$y" = "D" ]; then GIT_DEL=$((GIT_DEL+1))
      elif [ "$x" = "A" ] && [ "$y" = " " ]; then GIT_ADD=$((GIT_ADD+1))
      else GIT_MOD=$((GIT_MOD+1))
      fi
    done <<<"$PORCELAIN"
  fi
fi

CWD_BASE=$(basename "$PWD")

# ── Token Δ tracking ───────────────────────────────────────────────────────
# Records cumulative (input+output) tokens at every refresh; if a base file is
# present, computes Δ since base. Base file is written by an external skill
# trigger hook (not yet implemented in I2 — future v1.2 addition).
TOTAL_TOK=$((TOTAL_IN + TOTAL_OUT))
DELTA_DISPLAY=""
if [ -f "$BASE_FILE" ]; then
  BASE_IN=0; BASE_OUT=0; BASE_SKILL=""
  IFS='|' read -r BASE_IN BASE_OUT BASE_SKILL < "$BASE_FILE" 2>/dev/null || true
  [ -z "$BASE_IN" ] && BASE_IN=0
  [ -z "$BASE_OUT" ] && BASE_OUT=0
  DELTA=$(( TOTAL_TOK - BASE_IN - BASE_OUT ))
  [ "$DELTA" -lt 0 ] && DELTA=0
  if [ -n "$BASE_SKILL" ]; then
    DELTA_DISPLAY=" · Δ +$(fmt_tokens "$DELTA")@${BASE_SKILL}"
  else
    DELTA_DISPLAY=" · Δ +$(fmt_tokens "$DELTA")"
  fi
fi
printf '%s|%s\n' "$TOTAL_IN" "$TOTAL_OUT" > "$PREV_FILE" 2>/dev/null || true

# ── Effort badge (필수 표기 — empty 시 'default' 로 표시) ─────────────────
case "$EFFORT" in
  max)    EFFORT_BADGE=" · 🧠 ${BOLD}${RED}max${RESET}"      ;;
  xhigh)  EFFORT_BADGE=" · 🧠 ${BOLD}${RED}xhigh${RESET}"    ;;
  high)   EFFORT_BADGE=" · 🧠 ${BOLD}${YELLOW}high${RESET}"  ;;
  medium) EFFORT_BADGE=" · 🧠 ${GREEN}medium${RESET}"        ;;
  low)    EFFORT_BADGE=" · 🧠 ${DIM}low${RESET}"             ;;
  "")     EFFORT_BADGE=" · 🧠 ${DIM}default${RESET}"         ;;
  *)      EFFORT_BADGE=" · 🧠 ${DIM}${EFFORT}${RESET}"       ;;
esac
VERSION_SUFFIX=""
[ -n "$CC_VERSION" ] && VERSION_SUFFIX=" · ${DIM}cc${CC_VERSION}${RESET}"

# Optional vim / agent badges
EXT_BADGES=""
[ -n "$VIM_MODE" ] && EXT_BADGES="${EXT_BADGES} ${DIM}[vim:${VIM_MODE}]${RESET}"
[ -n "$AGENT_NAME" ] && EXT_BADGES="${EXT_BADGES} ${YELLOW}[agent:${AGENT_NAME}]${RESET}"

# ── Rate-limit displays ────────────────────────────────────────────────────
SES_RESET_FMT=$(fmt_reset_hm "$RESET_5H")
WK_RESET_FMT=$(fmt_reset_dhm "$RESET_7D")

if [ -n "$RL_5H" ]; then
  if [ -n "$SES_RESET_FMT" ]; then SES_DISPLAY="${RL_5H}% (${SES_RESET_FMT})"
  else SES_DISPLAY="${RL_5H}%"; fi
else
  SES_DISPLAY="n/a"
fi
if [ -n "$RL_7D" ]; then
  if [ -n "$WK_RESET_FMT" ]; then WK_DISPLAY="${RL_7D}% (${WK_RESET_FMT})"
  else WK_DISPLAY="${RL_7D}%"; fi
else
  WK_DISPLAY="n/a"
fi

# ── Compose lines ──────────────────────────────────────────────────────────

PCT_COLOR=$(pct_color "$PCT")
ADD_COLOR=$(count_color "$GIT_ADD" 5 20)
MOD_COLOR=$(count_color "$GIT_MOD" 5 20)
DEL_COLOR=$(count_color "$GIT_DEL" 3 10)
SES_COLOR=$(rl_color "$RL_5H")
WK_COLOR=$(rl_color "$RL_7D")
DUR_FMT=$(fmt_duration_short "$DURATION_MS")
COST_FMT=$(fmt_cost "$COST")
TOK_FMT=$(fmt_tokens "$TOTAL_TOK")
CTX_BAR=$(ctx_bar "$PCT")

# Line 1 — Identity: cwd · git branch · model · effort · cc-version · (badges)
LINE1=$(printf '%s%s%s' "$MAGENTA" "$CWD_BASE" "$RESET")
if [ -n "$GIT_BRANCH" ]; then
  LINE1+=" · ${BLUE}⎇ ${GIT_BRANCH}${GIT_DIRTY}${RESET}"
fi
LINE1+=" · ${CYAN}${MODEL}${RESET}${EFFORT_BADGE}${VERSION_SUFFIX}${EXT_BADGES}"

# Line 2 — Activity: ctx bar · git split · session lines
LINE2=$(printf '%s📊 %d%%%s %s%s%s' "$PCT_COLOR" "$PCT" "$RESET" "$DIM" "$CTX_BAR" "$RESET")
LINE2+=" · ${ADD_COLOR}➕ ${GIT_ADD}${RESET}"
LINE2+=" · ${MOD_COLOR}~ ${GIT_MOD}${RESET}"
LINE2+=" · ${DEL_COLOR}➖ ${GIT_DEL}${RESET}"
if [ "$LINES_ADD" -gt 0 ] || [ "$LINES_DEL" -gt 0 ]; then
  LINE2+=" · ${GREEN}📝 +${LINES_ADD}${RESET}/${RED}-${LINES_DEL}${RESET}"
else
  LINE2+=" · ${DIM}📝 none${RESET}"
fi

# Line 3 — Cost: duration · cost · tokens · delta
LINE3=$(printf '%s⏱ %s%s' "$DIM" "$DUR_FMT" "$RESET")
LINE3+=" · 💰 \$${COST_FMT}"
LINE3+=" · 🪙 ${TOK_FMT}${DELTA_DISPLAY}"

# Line 4 — Rate limits with reset countdowns
LINE4="${SES_COLOR}🕐 5h ${SES_DISPLAY}${RESET} · ${WK_COLOR}📅 7d ${WK_DISPLAY}${RESET}"

# Output. Claude Code reads up to ~5 lines.
printf '%s\n' "$LINE1"
printf '%s\n' "$LINE2"
printf '%s\n' "$LINE3"
printf '%s\n' "$LINE4"
