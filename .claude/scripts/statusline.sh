#!/usr/bin/env bash
# I2 statusline — v1.3 (L3 multi-line + isMeta/제어 키워드 필터).
# Reads Claude Code's statusline JSON from stdin, emits colored lines.
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
# Line layout (master directive 2026-05-13):
#   L1 — Identity + limits: model · effort · 5h · 7d · ⏱ duration
#   L2 — Activity + cost: ctx% bar · git split · session lines · cost · tokens
#   L3 — Last user prompt: 💬 (max 5 lines × 105 display-units/line — CJK=2, ASCII=1; wraps; isMeta + 제어 키워드 제외)
#
# Mandatory items (always shown with placeholder fallback):
#   📊 ctx% / 🧠 effort / 🕐 5h / 📅 7d
#
# Excluded vs old I-OS statusline (deprecated systems):
#   - Persona, leader sibling, plan state, wake/bg/shell counts.

set -uo pipefail

input=$(cat)

# ── Colors ─────────────────────────────────────────────────────────────────
CYAN=$'\033[36m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; RED=$'\033[31m'
BLUE=$'\033[34m'; MAGENTA=$'\033[35m'; DIM=$'\033[2m'; BOLD=$'\033[1m'; RESET=$'\033[0m'

# ── JSON extract helpers ───────────────────────────────────────────────────
jget() { jq -r "$1 // \"$2\"" <<<"$input" 2>/dev/null || echo "$2"; }
jnum() { jq -r "$1 // 0" <<<"$input" 2>/dev/null | cut -d. -f1; }
jraw() { jq -r "$1 // empty" <<<"$input" 2>/dev/null; }

MODEL=$(jget '.model.display_name' '?')
EFFORT=$(jget '.effort.level' '')
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

# JSONL session log path — used to read last user prompt directly (no hook needed).
SESSION_JSONL="$HOME/.claude/projects/-Users-starbox-Documents-GitHub-Project-I2/${SESSION_ID}.jsonl"

# Ephemeral state for token Δ tracking (future v1.3 — base file written by skill-trigger hook).
STATE_DIR="/tmp/i2-statusline-${USER:-default}"
mkdir -p "$STATE_DIR" 2>/dev/null
PREV_FILE="$STATE_DIR/prev-${SESSION_ID}.txt"
BASE_FILE="$STATE_DIR/base-${SESSION_ID}.txt"

# ── Helpers ────────────────────────────────────────────────────────────────

fmt_duration() {
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
  if [ "$n" -ge 1000000 ]; then awk -v n="$n" 'BEGIN{printf "%.1fM", n/1000000}'
  elif [ "$n" -ge 1000 ]; then awk -v n="$n" 'BEGIN{printf "%.1fK", n/1000}'
  else printf '%s' "$n"; fi
}

iso_to_epoch() {
  local v=$1
  [ -z "$v" ] && { echo ""; return; }
  case "$v" in
    ''|*[!0-9]*) echo "" ;;
    *) echo "$v" ;;
  esac
}

fmt_reset_hm() {
  local target now diff h m
  target=$(iso_to_epoch "$1")
  [ -z "$target" ] && { echo ""; return; }
  now=$(date +%s); diff=$((target - now))
  [ "$diff" -le 0 ] && { echo "0h0m"; return; }
  h=$((diff / 3600)); m=$(((diff % 3600) / 60))
  echo "${h}h${m}m"
}

fmt_reset_dhm() {
  local target now diff d h m
  target=$(iso_to_epoch "$1")
  [ -z "$target" ] && { echo ""; return; }
  now=$(date +%s); diff=$((target - now))
  [ "$diff" -le 0 ] && { echo "0d0h0m"; return; }
  d=$((diff / 86400)); h=$(((diff % 86400) / 3600)); m=$(((diff % 3600) / 60))
  echo "${d}d${h}h${m}m"
}

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

# ── Git working-tree counts ────────────────────────────────────────────────
GIT_BRANCH=""; GIT_DIRTY=""; GIT_ADD=0; GIT_MOD=0; GIT_DEL=0
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

# ── Token total + Δ ────────────────────────────────────────────────────────
TOTAL_TOK=$((TOTAL_IN + TOTAL_OUT))
DELTA_DISPLAY=""
if [ -f "$BASE_FILE" ]; then
  BASE_IN=0; BASE_OUT=0; BASE_SKILL=""
  IFS='|' read -r BASE_IN BASE_OUT BASE_SKILL < "$BASE_FILE" 2>/dev/null || true
  [ -z "$BASE_IN" ] && BASE_IN=0
  [ -z "$BASE_OUT" ] && BASE_OUT=0
  DELTA=$(( TOTAL_TOK - BASE_IN - BASE_OUT ))
  [ "$DELTA" -lt 0 ] && DELTA=0
  if [ -n "$BASE_SKILL" ]; then DELTA_DISPLAY=" · Δ +$(fmt_tokens "$DELTA")@${BASE_SKILL}"
  else DELTA_DISPLAY=" · Δ +$(fmt_tokens "$DELTA")"; fi
fi
printf '%s|%s\n' "$TOTAL_IN" "$TOTAL_OUT" > "$PREV_FILE" 2>/dev/null || true

# ── Effort + version + ext badges ──────────────────────────────────────────
case "$EFFORT" in
  max)    EFFORT_BADGE="🧠 ${BOLD}${RED}max${RESET}"      ;;
  xhigh)  EFFORT_BADGE="🧠 ${BOLD}${RED}xhigh${RESET}"    ;;
  high)   EFFORT_BADGE="🧠 ${BOLD}${YELLOW}high${RESET}"  ;;
  medium) EFFORT_BADGE="🧠 ${GREEN}medium${RESET}"        ;;
  low)    EFFORT_BADGE="🧠 ${DIM}low${RESET}"             ;;
  "")     EFFORT_BADGE="🧠 ${DIM}default${RESET}"         ;;
  *)      EFFORT_BADGE="🧠 ${DIM}${EFFORT}${RESET}"       ;;
esac

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

# ── Last user prompt (from session JSONL) ──────────────────────────────────
LAST_PROMPT=""
if [ -f "$SESSION_JSONL" ] && command -v python3 >/dev/null 2>&1; then
  LAST_PROMPT=$(python3 - "$SESSION_JSONL" <<'PY' 2>/dev/null
import json, re, sys, unicodedata
from pathlib import Path

path = Path(sys.argv[1])
try:
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
except Exception:
    sys.exit(0)

LINE_WIDTH = 105
MAX_LINES = 5

for line in reversed(lines):
    line = line.strip()
    if not line:
        continue
    try:
        d = json.loads(line)
    except json.JSONDecodeError:
        continue
    if d.get("type") != "user":
        continue
    if d.get("isMeta") is True:
        continue
    if d.get("userType") != "external":
        continue
    msg = d.get("message") or {}
    content = msg.get("content", "")

    if isinstance(content, list):
        # Skip tool_result-only blocks; extract text blocks.
        text_parts = []
        for b in content:
            if not isinstance(b, dict):
                continue
            if b.get("type") == "text":
                text_parts.append(b.get("text", ""))
        if not text_parts:
            continue
        text = " ".join(text_parts)
    else:
        text = str(content)

    # Skip command/system output records (they share type=user but aren't master prompts).
    if text.startswith(("<local-command-", "<system-reminder>")):
        continue
    if text.startswith("<command-"):
        # Slash-skill messages: extract user-supplied args if present.
        m = re.search(r'<command-args>(.*?)</command-args>', text, re.DOTALL)
        if m:
            extracted = m.group(1).strip()
            if extracted:
                text = extracted
            else:
                m2 = re.search(r'<command-name>(.*?)</command-name>', text, re.DOTALL)
                if m2:
                    text = m2.group(1).strip()
                else:
                    continue
        else:
            m2 = re.search(r'<command-name>(.*?)</command-name>', text, re.DOTALL)
            if m2:
                text = m2.group(1).strip()
            else:
                continue
    if not text.strip():
        continue

    # Normalize whitespace.
    text = " ".join(text.split())

    # Skip skill control keywords — master inputs but not statusline-worthy.
    if text == "플랜 완료" or text == "중단":
        continue
    if text == "핫픽스" or text.startswith("핫픽스 "):
        continue

    # Display width: East Asian wide/fullwidth chars (Korean/Chinese/Japanese, fullwidth ASCII) count as 2.
    def cwidth(ch):
        return 2 if unicodedata.east_asian_width(ch) in ("W", "F") else 1

    # Wrap to LINE_WIDTH (display-weight) × up to MAX_LINES.
    wrapped = []
    cur = ""
    cur_w = 0
    for ch in text:
        w = cwidth(ch)
        if cur_w + w > LINE_WIDTH:
            wrapped.append(cur)
            cur = ch
            cur_w = w
        else:
            cur += ch
            cur_w += w
    if cur:
        wrapped.append(cur)

    if len(wrapped) > MAX_LINES:
        wrapped = wrapped[:MAX_LINES]
        last = wrapped[-1]
        target_w = LINE_WIDTH - 3  # "..." consumes 3 display units
        truncated = ""
        tw = 0
        for ch in last:
            w = cwidth(ch)
            if tw + w > target_w:
                break
            truncated += ch
            tw += w
        wrapped[-1] = truncated + "..."

    sys.stdout.write("\n".join(wrapped))
    break
PY
)
fi

# ── Compose 3 lines ────────────────────────────────────────────────────────

PCT_COLOR=$(pct_color "$PCT")
ADD_COLOR=$(count_color "$GIT_ADD" 5 20)
MOD_COLOR=$(count_color "$GIT_MOD" 5 20)
DEL_COLOR=$(count_color "$GIT_DEL" 3 10)
SES_COLOR=$(rl_color "$RL_5H")
WK_COLOR=$(rl_color "$RL_7D")
DUR_FMT=$(fmt_duration "$DURATION_MS")
COST_FMT=$(fmt_cost "$COST")
TOK_FMT=$(fmt_tokens "$TOTAL_TOK")
CTX_BAR=$(ctx_bar "$PCT")

# Line 1 — Identity + limits: model · effort · 5h · 7d · ⏱ duration · ext badges
# (cwd / git branch 표기는 마스터 지시로 제거 — 2026-05-12)
LINE1=$(printf '%s%s%s · %s' "$CYAN" "$MODEL" "$RESET" "$EFFORT_BADGE")
LINE1+=" · ${SES_COLOR}🕐 5h ${SES_DISPLAY}${RESET}"
LINE1+=" · ${WK_COLOR}📅 7d ${WK_DISPLAY}${RESET}"
LINE1+=" · ${DIM}⏱ ${DUR_FMT}${RESET}"
[ -n "$EXT_BADGES" ] && LINE1+="${EXT_BADGES}"

# Line 2 — Activity + cost: ctx% bar · git split · session lines · cost · tokens
LINE2=$(printf '%s📊 %d%%%s %s%s%s' "$PCT_COLOR" "$PCT" "$RESET" "$DIM" "$CTX_BAR" "$RESET")
LINE2+=" · ${ADD_COLOR}➕ ${GIT_ADD}${RESET}"
LINE2+=" · ${MOD_COLOR}~ ${GIT_MOD}${RESET}"
LINE2+=" · ${DEL_COLOR}➖ ${GIT_DEL}${RESET}"
if [ "$LINES_ADD" -gt 0 ] || [ "$LINES_DEL" -gt 0 ]; then
  LINE2+=" · ${GREEN}📝 +${LINES_ADD}${RESET}/${RED}-${LINES_DEL}${RESET}"
fi
LINE2+=" · 💰 \$${COST_FMT}"
LINE2+=" · 🪙 ${TOK_FMT}${DELTA_DISPLAY}"

# Line 3 — Last user prompt (always shown; empty placeholder when unavailable).
if [ -n "$LAST_PROMPT" ]; then
  LINE3="💬 ${LAST_PROMPT}"
else
  LINE3="${DIM}💬 (no prompt)${RESET}"
fi

# Output.
printf '%s\n' "$LINE1"
printf '%s\n' "$LINE2"
printf '%s\n' "$LINE3"
