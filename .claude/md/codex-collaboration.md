# Codex Collaboration v1 — Design Doc (not yet implemented)

External LLM (Codex / GPT-5.5 / similar) integration for I2. **Design only** at v1 — no scripts or skill wiring yet. This document defines the architecture so a future implementation unit can build straight from spec.

Rationale per `README.md` §E-3: "GPT-5.5 의 토큰 비용 감소와 성능 우수 + Opus 4.7 의 성능 저하와 비용 증가가 동시에 발생하면서 협업 시스템은 필수적." External-LLM cost/quality leverage is the value proposition.

## v1 Scope

- Design philosophy + responsibility split (this doc).
- Work-packet schema + Codex execution-report schema (this doc).
- Defense-in-depth gate list (this doc).
- **Out of v1**: actual scripts, skill integration code, beta run.

A future `/plan-enterprise-os` invocation can pick this design up and implement.

## Responsibility Split (load-bearing invariant)

The split keeps Claude as the authoritative judge and Codex as a parallel executor with no final-decision authority. This avoids the failure mode where two LLMs argue about completion.

| Authority | Owner |
|---|---|
| Final PASS / "플랜 완료" declaration | Claude (main session) |
| advisor 5/6-perspective verdict | Claude (advisor) |
| `git commit` / `git push` | Claude (via `phase-executor` or `patch-confirmation`) |
| patch-note authoring | Claude (`patch-confirmation`) |
| DB structural / data work | Claude (`task-db-structure` / `task-db-data`) |
| Code execution (write capable) | **Codex** (within bounded packet scope) OR Claude (`phase-executor`) |
| Test execution / fact capture | Codex (within packet scope) |
| Self-evaluation of "task complete" | **Forbidden for Codex** — fact-only reports |

Codex is treated as a swappable backend for the `phase-executor` role with one fundamental difference: Codex cannot declare completion. Codex reports facts (commands run, exit codes, tests passed/failed, files changed); Claude reads those facts and decides.

## Work Packet Schema

Claude (the dispatching skill, e.g., `plan-enterprise`) generates a work packet for Codex. The packet is JSON with strict shape.

```json
{
  "packet_version": "1.0",
  "task_id": "plan-enterprise-<issue>-phase-<N>",
  "plan_issue": <int>,
  "phase_number": <int>,
  "phase_title": "<title>",
  "intent_ko": "<2-4 sentence Korean description>",
  "affected_files": ["path/relative/to/cwd", ...],
  "allowed_write_set": ["affected_files paths only — file glob"],
  "forbidden_paths": [".git/**", ".claude/**", "patch-note/**", ".claude/project-group/**"],
  "worktree_root": "/abs/path/to/codex/worktree",
  "base_branch": "i-dev",
  "wip_branch": "plan-enterprise-<issue>-<slug>-작업",
  "tests_required": true,
  "test_command": "<shell command — pnpm test / pytest / etc.>",
  "lock_uuid": "<UUID for this packet>",
  "expires_at": "<ISO8601>"
}
```

`allowed_write_set` and `forbidden_paths` are both verified by the gate scripts. Overlap → forbidden wins.

## Codex Execution Report Schema

After Codex executes, it produces an execution report. Fact-only — no judgments.

```json
{
  "report_version": "1.0",
  "task_id": "<echoes packet>",
  "lock_uuid": "<echoes packet>",
  "started_at": "<ISO8601>",
  "completed_at": "<ISO8601>",
  "commands_run": [
    {"command": "<verbatim>", "exit_code": <int>, "duration_ms": <int>}
  ],
  "files_changed": ["path", ...],
  "files_added": ["path", ...],
  "files_deleted": ["path", ...],
  "lines_added": <int>,
  "lines_deleted": <int>,
  "commit_sha": "<full sha or null if no commit>",
  "tests_run": {
    "command": "<verbatim>",
    "exit_code": <int>,
    "summary": "<single line — '12 passed, 0 failed' or similar>"
  },
  "notes_ko": "<observational notes — what was tried, NOT judgments of success>"
}
```

**Forbidden fields** in execution report (gate rejects):
- `task_complete`, `verdict`, `pass`, `success`, `ready_to_merge`, or any field implying judgment.

## Defense-in-depth Gates

Five sequential gates between Codex's report and Claude's acceptance. Each gate is a deterministic script with `exit 0` (pass) / `exit ≥1` (block). Located at `.claude/scripts/codex/` (future).

### Gate 1 — Work Packet Validity
`verify-codex-packet.sh` — packet JSON schema-validates, `task_id` format, `affected_files` paths exist relative to cwd, `worktree_root` is an actual git worktree, `expires_at` is in the future.

### Gate 2 — Worktree / Path Scope
`verify-codex-worktree-scope.sh` — Codex's diff stays inside `worktree_root`. No relative paths escaping (`../`), no absolute paths outside, no writes to `forbidden_paths` (case-insensitive glob match).

### Gate 3 — Allowed Write Set
`verify-codex-write-set.sh` — every file in `files_changed ∪ files_added ∪ files_deleted` is in `allowed_write_set`. Surprise files → block.

### Gate 4 — TDD Flow (when applicable)
`verify-codex-tdd-flow.sh` — if `tests_required: true` in packet, the report must show `tests_run.exit_code: 0` AND at least one test was modified or added (signal: tests weren't faked). For non-TDD tasks, gate is skipped.

### Gate 5 — Report Fact-Only Discipline
`verify-codex-report-discipline.sh` — execution report contains no forbidden judgment fields. `task_id` and `lock_uuid` match the packet. Required factual fields all present.

## Integration with Existing Skills

### `plan-enterprise` — Codex as phase-executor alternative

Phase dispatch in `plan-enterprise` Step 7a is currently `Task subagent_type: phase-executor`. With Codex enabled, the dispatcher checks a per-invocation flag (e.g., `/plan-enterprise <leader> --codex <description>`) and routes to a Codex packet build instead.

The 5-step main-session verification ritual (`plan-enterprise` Step 7c) extends with:
- Run all 5 codex gates against the execution report.
- Any gate fail → re-dispatch (with feedback) OR halt for master. Iteration cap remains 3 per phase.

advisor's per-phase scope is unchanged — advisor still runs only at plan + completion (per master's 2026-05-12 lock).

### `dev-merge` — Codex hotfix executor alternative

Future v1.1 enhancement: when `dev-merge` would dispatch `code-fixer` for hotfix iterations, master can opt into Codex via flag (e.g., `--codex-fixer`). Same gate stack applies.

### `task-db-*` — explicitly excluded from v1

DB work involves credentials, live database execution, and high-risk operations. v1 keeps `task-db-structure` / `task-db-data` Claude-only. Codex integration deferred until the bounded-executor model has run successfully on code work for a meaningful period.

## Worktree Isolation Model

Each Codex packet runs in its own git worktree under a path predictable from the packet's `task_id`. The dispatcher:

1. Creates worktree: `git worktree add -b <wip_branch> /tmp/codex-worktrees/<task_id> i-dev`.
2. Writes packet to `/tmp/codex-worktrees/<task_id>/.codex-packet.json`.
3. Hands worktree path to Codex.
4. Codex works inside the worktree, commits to `wip_branch`, pushes.
5. Dispatcher reads execution report, runs gates.
6. On all-pass: dispatcher merges `wip_branch` back via the normal WIP merge (after Claude's own verification).
7. Dispatcher removes the worktree: `git worktree remove /tmp/codex-worktrees/<task_id>`.

Worktree isolation prevents Codex from accidentally touching the main checkout's state (other in-flight work, `.claude/` content, etc.) — gate 2 enforces this structurally.

## Lock Coverage

Each packet carries `lock_uuid`. Worktree creation acquires a file lock at `/tmp/codex-locks/<task_id>.lock`. Concurrent packets with the same `task_id` → lock fail → halt. Used to prevent double dispatch of the same phase.

Lock release on packet completion (success OR failure). Crash recovery: locks older than `expires_at` are reclaimable.

## Open Questions (resolve in implementation unit)

- Codex tool stack: which Codex variant (web UI, API, IDE plugin)? v1 design assumes API-callable variant with shell execution capability.
- Authentication: where do Codex credentials live? Probably an env var per group-policy `env_management` rule.
- Cost attribution: monitoring's `attributionSkill` axis is Claude-native. Codex runs produce no JSONL entries in `~/.claude/projects/`. Need a separate log path (likely `.claude/state/codex-runs/`) for Codex monitoring — but `.claude/state/` was abolished (§D-10). Pick a new home, document.
- Retry policy: gate failure → re-dispatch with the same packet or a new packet (different lock_uuid)? Per phase iteration cap of 3 in `plan-enterprise`.
- Codex side prompts: what's the prompt Claude generates for Codex? Likely the packet JSON + Korean intent + the worktree path. Lock format in implementation unit.
- net-positive Q3 (Treadmill Audit): adding Codex integration introduces a 5-gate verifier stack. What gets retired? Possibly: the per-phase advisor consideration master ruled out (which doesn't exist). Or: implicit Claude-only assumption. Document the Q3 answer when implementing.

## v1 Implementation Path

When master decides to implement (separate `/plan-enterprise-os` invocation):

1. Create `.claude/scripts/codex/` with the 5 gate scripts.
2. Create `.claude/agents/codex-packet-builder.md` — Claude-side agent that converts phase metadata into a packet.
3. Extend `plan-enterprise` with `--codex` flag and the gate-stack integration.
4. Add a small `monitoring/scripts/codex-collect.py` if Codex runs need separate tracking.
5. Beta scope: one phase of one plan-enterprise invocation, master observing.
6. Iterate based on beta findings.

## References

- Project-I prep (Phase 1): `Project-I/.agents/scripts/verify-codex-*.sh` (8 scripts) — read-only reference, conservative adapt only.
- Project-I plan doc: `Project-I/temp/plans/2026-05-08_codex-joyful-origami.md` — original design rationale.
- Project-I B-026 ordinance: discarded (no ordinance system in I2); core invariants ported here.
- Master directive (`README.md` §E-3): GPT-5.5 / Opus pricing shift justifies the collaboration system.
