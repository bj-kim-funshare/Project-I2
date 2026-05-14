---
name: dev-start
description: Restart a frontend dev server for a registered project group. Kills any process on the configured port, clears caches, starts the dev command fresh in background, waits for the port to listen, then reports. Fails fast on any error — no retries, no log investigation, no fallback recovery.
---

# dev-start

Restart the frontend dev server(s) for a registered project group.

## Invocation

```
/dev-start <leader-name>
```

Parse rule: 단일 토큰 — leader name only. I-OS-side work goes through plan-enterprise-os.

## Prerequisites

- 베이스 브랜치 정렬 — `.claude/md/branch-alignment.md` Entry verification 절차 수행. 본 스킬 컨텍스트 = external.

The project-group manifest must exist:

- `.claude/project-group/<leader>/dev.md`

This manifest is produced by the `group-policy` skill (dev section). If it is absent, `dev-start` halts and tells the user to run `/new-project-group` or `/group-policy` first.

## Manifest contract

`.claude/skills/dev-start` declares this format; `group-policy` must emit conformant manifests.

`dev.md` carries YAML frontmatter with a `targets` array, then free-form Korean notes after the frontmatter for human reference.

```yaml
---
targets:
  - name: <member-name>
    cwd: <absolute-path>
    role: FE | BE            # FE = frontend (dev-start 의 기동 대상), BE = backend (dev-start 미기동, dev-build 등 다른 스킬은 정상 사용)
    type: project | monorepo   # dev-build 가 모노레포 선택 UI 노출에 사용. dev-start 의 multiSelect 라벨에도 [monorepo] 인디케이터로 노출.
    dev_command: <shell-command-line>
    port: <integer>
    cache_paths:
      - <path-relative-to-cwd>
      - ...
---

(human notes follow)
```

Field semantics:
- `cwd`: absolute path to the member's project root. The dev command runs from here.
- `role`: `FE` or `BE` (closed choice). dev-start only starts FE targets. BE targets remain in the manifest and are available to other skills (dev-build, etc.) but are excluded from dev-start's startup sequence.
- `type`: `project` or `monorepo` (closed choice). dev-build uses this to expose monorepo selection sub-cards; dev-start uses it to append a `[monorepo]` indicator on the multiSelect option label.
- `dev_command`: the exact shell command to start the dev server (e.g., `pnpm dev`, `npm run dev`, `vite`).
- `port`: the port the dev server is expected to bind. Used for both kill-prior and readiness polling.
- `cache_paths`: zero or more paths to delete before starting. Resolved relative to `cwd`. Missing paths are skipped silently.

## Procedure

### 0. Filter and select targets

Load `.claude/project-group/<leader>/dev.md` → `targets[]`. Filter to entries where `role: FE` → `fe_targets[]`.

- **0개** — `"<leader> FE 타겟 없음 — 종료"` 출력 후 halt.
- **1개** — 카드 없이 자동 선택. `selected_targets = fe_targets`.
- **2개 이상** — `AskUserQuestion` (multiSelect):
  - 질문 문구: `"<leader> — 기동할 FE 타겟 선택 (복수 선택 가능)"`
  - 옵션 라벨: `<name>` (해당 타겟의 `type` 필드가 `monorepo` 이면 `<name> [monorepo]`)
  - 0개 선택 → `"선택된 타겟 없음 — 종료"` 출력 후 halt.
  - 1개 이상 선택 → `selected_targets = <선택된 항목>`.

For each *selected* target (sequential — never parallel; port collisions and resource contention defeat the purpose):

### 1. Kill any prior process on the target port

```bash
pids=$(lsof -ti :"$port" 2>/dev/null || true)
if [ -n "$pids" ]; then kill -9 $pids; fi
```

`kill -9` is deliberate: dev servers, not production. Graceful shutdown adds latency and edge cases the skill is explicitly opting out of.

### 2. Clear caches

For each path in `cache_paths`:

```bash
rm -rf "$cwd/$path"
```

Missing paths produce no error. Read failures (permission, etc.) halt the skill.

### 3. Start the dev server in background

Invoke Bash with `run_in_background: true`:

```bash
cd "$cwd" && $dev_command
```

The Bash tool's `run_in_background` flag is required. Do not route through a wrapper script — the harness's built-in background tracking depends on the direct invocation.

### 4. Wait for port readiness

Poll every 0.5 seconds for up to 15 seconds total:

```bash
deadline=$(( $(date +%s) + 15 ))
while [ "$(date +%s)" -lt "$deadline" ]; do
  if [ -n "$(lsof -ti :"$port" 2>/dev/null)" ]; then break; fi
  sleep 0.5
done
[ -n "$(lsof -ti :"$port" 2>/dev/null)" ] || { echo "포트 $port 15초 내 listen 실패"; exit 1; }
```

15s ceiling is a deliberate ceiling, not a target. Slower starts indicate a problem the user should know about, not something the skill should silently tolerate.

## Reporting

After every target succeeds, dispatch `completion-reporter` with:
- `skill_type: "dev-start"`
- `moment: "skill_finalize"`
- `data`: assemble per `.claude/md/completion-reporter-contract.md` §6 `dev-start` `skill_finalize` schema. Required: `leader`, `result_summary`, `targets[]` (each: `{name, port, pid, cache_paths_cleared[]}`).

Relay the agent's response verbatim to master. Then halt. No "next skill" suggestion, no follow-up prompt.

## Failure policy

Any failure — manifest missing, malformed YAML, target not found, kill error, cache rm error, dev command not found, port timeout — dispatches `completion-reporter` with:
- `skill_type: "dev-start"`
- `moment: "skill_finalize.blocked"`
- `data`: assemble per `.claude/md/completion-reporter-contract.md` §6 `dev-start` `skill_finalize.blocked` schema. Required: `leader`, `block_reason`, `failed_target`, `failed_step`; optional: `error_detail` (verbatim error text).

Relay the agent's response verbatim to master. Then halt. Do not retry. Do not investigate logs. Do not attempt alternatives. Do not suggest fixes beyond the literal failure. The user re-invokes `/dev-start` after addressing the cause.

### Specific failure messages

| Cause | Output |
|---|---|
| `.claude/project-group/<leader>/` does not exist | `"그룹 <leader> 미등록 — /new-project-group 먼저 실행"` |
| Directory exists but `dev.md` missing | `"그룹 <leader> 에 dev 설정 없음 — /group-policy 먼저 실행"` |
| Manifest YAML parse failure | `"<leader>/dev.md YAML 파싱 실패: <error>"` |
| Step failure (1–4) | `"<member> / <step>: <verbatim error>"` |
| FE 후보 0 (전체 BE 또는 매니페스트 비어있음) | `"<leader> FE 타겟 없음 — 종료"` |
| multiSelect 0 선택 | `"선택된 타겟 없음 — 종료"` |

## Scope (v1)

In scope:
- Frontend dev server restart (multi-select, role=FE filtered).
- Port-based kill, cache wipe, background start, readiness polling, table report.
- Fail-fast on every error path.

Out of scope:
- Backend dev servers (excluded from dev-start by manifest role=BE filter — buildable via dev-build).
- Wizards or first-run setup (lives in `group-policy`).
- Persistence beyond the manifest (the manifest is the source of truth).
- Hot-reload, log streaming, process supervision after startup. Once the port listens, the skill exits; the background process continues independently.
- Recovery, retry, or auto-investigation of failures.
