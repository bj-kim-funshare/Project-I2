---
name: dev-start
description: Restart a frontend dev server for a registered project group. Kills any process on the configured port, clears caches, starts the dev command fresh in background, waits for the port to listen, then reports. Fails fast on any error — no retries, no log investigation, no fallback recovery.
---

# dev-start

Restart the frontend dev server(s) for a registered project group.

## Invocation

```
/dev-start <leader-name> [<target-name>]
```

Parse rule: tokens are whitespace-separated. First token = leader name (Latin or Hangul-phonetic, as set by `new-project-group`). Second token, if present, = single target name to restart (otherwise all targets in the manifest are restarted sequentially). Leader name will never be I-OS-related — OS-side work is handled by `plan-enterprise-os`, not by this skill.

## Prerequisites

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
- `dev_command`: the exact shell command to start the dev server (e.g., `pnpm dev`, `npm run dev`, `vite`).
- `port`: the port the dev server is expected to bind. Used for both kill-prior and readiness polling.
- `cache_paths`: zero or more paths to delete before starting. Resolved relative to `cwd`. Missing paths are skipped silently.

## Procedure

For each target (sequential — never parallel; port collisions and resource contention defeat the purpose):

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

After every target succeeds, output a single table to the user (Korean, per language separation rule):

```
### /dev-start 완료 — <leader>

| 멤버 | 포트 | 상태 | PID | 캐시 정리 |
|------|------|------|-----|-----------|
| <name> | <port> | ✅ http://localhost:<port> | <pid> | <paths> |
```

Then halt. No "next skill" suggestion, no follow-up prompt.

## Failure policy

Any failure — manifest missing, malformed YAML, target not found, kill error, cache rm error, dev command not found, port timeout — produces an immediate Korean report to the user with:

1. Which target failed.
2. Which step failed.
3. The exact error text (verbatim, not paraphrased).

Then halt. Do not retry. Do not investigate logs. Do not attempt alternatives. Do not suggest fixes beyond the literal failure. The user re-invokes `/dev-start` after addressing the cause.

### Specific failure messages

| Cause | Output |
|---|---|
| `.claude/project-group/<leader>/` does not exist | `"그룹 <leader> 미등록 — /new-project-group 먼저 실행"` |
| Directory exists but `dev.md` missing | `"그룹 <leader> 에 dev 설정 없음 — /group-policy 먼저 실행"` |
| Manifest YAML parse failure | `"<leader>/dev.md YAML 파싱 실패: <error>"` |
| Specified target name not in manifest | `"<leader>/dev.md 에 타겟 '<target>' 없음. 사용 가능: <list>"` |
| Step failure (1–4) | `"<member> / <step>: <verbatim error>"` |

## Scope (v1)

In scope:
- Frontend dev server restart (single or all targets).
- Port-based kill, cache wipe, background start, readiness polling, table report.
- Fail-fast on every error path.

Out of scope:
- Backend dev servers (separate skill if ever needed).
- Wizards or first-run setup (lives in `group-policy`).
- Persistence beyond the manifest (the manifest is the source of truth).
- Hot-reload, log streaming, process supervision after startup. Once the port listens, the skill exits; the background process continues independently.
- Recovery, retry, or auto-investigation of failures.
