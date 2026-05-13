# Sub-agent dispatch prompt budget

## Purpose

Sub-agent dispatch prompt bodies must stay within a token budget. The immediate
consequence of exceeding it is automatic routing to the 1M context tier, which the
Sonnet 1M extra-usage billing guard blocks for write-capable agents
(`phase-executor`, `code-fixer`, `db-migration-author`, `db-data-author`).
The secondary consequence is that sub-agent isolation — the design rationale that
protects the main session's context and distributes cost — is defeated when the
dispatching session pre-assembles and inlines large context bundles.

## Token budget

| Threshold | Value |
|---|---|
| Recommended prompt body | 5 k – 15 k tokens |
| Absolute hard cap | 100 k tokens |

**Byte heuristic** (for agents without a token counter):

- English / code ≈ 4 bytes per token → absolute hard cap 100k tokens ≈ 400 KB
- Korean ≈ 2 bytes per token → absolute hard cap 100k tokens ≈ 200 KB

Measure only the dispatch prompt body (the text sent to the agent), not the
agent's own system prompt.

## Forbidden anti-patterns

Do not inline any of the following directly in the dispatch prompt body:

1. **Full PR diff** — can exceed 50 k tokens for a mid-sized PR.
2. **Full policy file contents** — e.g., `group-policy.md`, `deploy.md`, skill SKILL.md bodies.
3. **Accumulated prior-phases summary** — grows unboundedly across phases; pass the plan issue number instead.
4. **Per-repo scope object collections** — JSON arrays of every file/table/migration enumerated in a workspace scan.
5. **Advisor output inlined verbatim** — advisor findings should be written to a permanent document first.
6. **Prior-round findings JSON inlined verbatim** — e.g., a `code-inspector` or `security-reviewer` result blob from the previous dispatch round.

## Required alternative patterns

Choose one of three:

### A — Permanent document + identifier

Save the intermediate context to a durable location (GitHub issue body, `plan.md`,
audit md under `.claude/inspection-runs/`, patch-note md). Pass only the identifier
to the sub-agent: issue number (`#N`), PR number, or leader name. The sub-agent
calls `gh issue view`, `gh pr diff`, or `Read` on the saved path.

### B — Path + identifiers only

Pass only the worktree or repo path plus identifiers. The sub-agent fetches what it
needs directly via `Read`, `Glob`, `Grep`, `gh issue view N`, `gh pr diff`,
or `gh pr view --json reviews,comments`. Nothing is pre-fetched by the dispatcher.

### C — Small structured JSON inline (≤ 15 k tokens)

When intermediate data is genuinely compact structured JSON and cannot be stored
durably (e.g., a 50-row schema diff), inlining is acceptable — but only when the
entire prompt body stays well under the recommended 15 k token target.

## Self-defense contract (write-capable agents)

Write-capable agents (`phase-executor`, `code-fixer`, `db-migration-author`,
`db-data-author`) MUST estimate prompt body size on entry using the byte heuristic
above. If the estimate exceeds the absolute hard cap 100k tokens, immediately return:

```json
{
  "error": "prompt_body_exceeds_budget",
  "policy": ".claude/md/sub-agent-prompt-budget.md",
  "action": "dispatcher must convert inline context to file paths and re-dispatch"
}
```

Halt without performing any work. Do not attempt a partial execution.

## Dispatcher responsibility (main session)

Before assembling a dispatch prompt:

1. Gauge the approximate prompt body length using the byte heuristic.
2. If a large bundle (diff, summary, findings, scope collection) would be inlined,
   write it to a permanent document first and pass only the path or identifier.
3. Never accumulate prior-phase summaries across phases by inlining each phase's
   output into the next dispatch. Use the plan issue body or a `plan.md` as the
   accumulation point.
