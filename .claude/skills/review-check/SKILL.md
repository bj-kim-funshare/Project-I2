---
name: review-check
description: Aggregate routine-flagged 주의/경고 reviews across selected member repos of a project group and author a plan-enterprise prompt document that resolves them. Master multi-selects member repos via AskUserQuestion, the skill queries GitHub closed issues for routine signature-marker review comments, filters to issues whose latest routine review status ∈ {주의, 경고}, and writes a single Korean markdown document under .claude/review-check-output/ ready to paste into /plan-enterprise. The generated prompt explicitly requires the downstream plan-enterprise run to post a 재리뷰 요청 comment on each resolved issue at completion so the next routine run re-evaluates. Read-only against GitHub — no PR / commit / label mutation. No WIP / no merge (output is gitignored).
---

# review-check

Companion skill to the daily multi-perspective review routines under `.claude/cloud-routines/`. Routines post 안전 / 주의 / 경고 reviews to closed issues using signature markers (`<!-- review-check-routine:<repo>:multi-perspective sha=<SHA> -->`). This skill consumes those reviews, surfaces the 주의 / 경고 backlog, and prepares the corrective `/plan-enterprise` prompt document for master.

## Invocation

```
/review-check <leader-name>
```

`<leader-name>` required. The skill loads the leader's member repos from `.claude/project-group/<leader>/Index.md` (and / or `dev.md`), presents them via `AskUserQuestion` (multiSelect), then queries each selected repo's closed issues for routine review comments.

## Pre-conditions

1. 베이스 브랜치 정렬 — `.claude/md/branch-alignment.md` Entry verification. 본 스킬 컨텍스트 = 아이OS (스킬이 동작하는 cwd 는 Project-I2 이며 산출물도 본 repo 의 gitignored 폴더에 쌓임).
2. `.claude/project-group/<leader>/` exists.
3. cwd is the Project-I2 repo.
4. Current branch = `main`.
5. `gh` CLI installed and authenticated for each member repo's GitHub remote.

## Procedure

### Step 1 — Argument parsing

Leader name required. Failure → `"그룹 <leader> 미등록 — /new-project-group 먼저 실행"`.

### Step 2 — Member repo enumeration

Read `.claude/project-group/<leader>/Index.md` (primary) and `dev.md` (secondary) to enumerate member repos. For each member resolve:
- `name` (display label)
- `cwd` (absolute path on disk)
- `github_slug` (`<owner>/<repo>` — derive from `gh -C <cwd> repo view --json owner,name --jq '.owner.login + "/" + .name'` if Index.md does not record it)

If 0 members → `"그룹 <leader> 에 멤버 리포 없음 — Index.md 점검 필요"`.

### Step 3 — Master multi-select

Issue ONE `AskUserQuestion` with `multiSelect: true`:
- Each option: label = `<name>`, description = `cwd: <abs-path>`
- 0 selected → `"선택된 리포 없음 — 종료"`.

### Step 4 — Collect routine review comments

For each selected repo:

```bash
gh issue list --repo <github_slug> --state closed --limit 200 \
  --json number,title,url,closedAt
```

For each issue, fetch comments:

```bash
gh issue view <N> --repo <github_slug> --json comments \
  --jq '.comments[] | {body, createdAt}'
```

Identify routine review comments by signature prefix `<!-- review-check-routine:<repo-slug>:multi-perspective`. For each issue, retain only the **latest** signature-marker comment. Parse its "리뷰 결과" line.

### Step 5 — Filter and parse

Keep issues where the latest routine review result ∈ {주의, 경고}.

From each kept issue's review comment body, parse the `## 권장 방안` section bullets — each line in the form `- (<관점> / <상태>) <finding 요약> → <권장 방안>`. Collect tuples `(repo, issue_number, issue_title, status, [(perspective, severity, finding, recommendation), ...])`.

If 0 issues remain → `"주의·경고 리뷰가 달린 클로즈 이슈 없음 — 종료"`.

### Step 6 — Compose enterprise prompt document

```bash
mkdir -p .claude/review-check-output
```

Output path: `.claude/review-check-output/<leader>-$(date +%Y%m%d-%H%M).md`.

Write the document directly via the Write tool (main session — `.claude/review-check-output/` is gitignored, no WIP needed). Document template:

````markdown
# review-check — <leader> — <YYYY-MM-DD HH:MM KST>

## 대상 리포 (master 선택)
- <repo-name> (<github_slug>)
- ...

## 수집된 주의 / 경고 이슈

| 리포 | 이슈# | 제목 | 상태 | 리뷰 시각 | 이슈 URL |
|---|---|---|---|---|---|
| ... | ... | ... | 주의 / 경고 | ... | ... |

---

## /plan-enterprise <leader> 호출용 프롬프트

> 아래 블록 전체를 `/plan-enterprise <leader>` 의 인자로 전달하세요.

```
<leader> 리포의 클로즈 이슈에 게시된 routine 다관점 리뷰 (주의 / 경고) 사항을 해결한다.

### 대상 이슈 및 권장방안

- #<N> (<github_slug>) — <리뷰 제목>: <상태>
  - (<관점> / <severity>) <finding 요약> → <권장 방안>
  - ...

- #<N2> ...

### 작업 완료 시 필수 동작 (반드시 누락 금지)

플랜 완료 직전 (Step 11 PENDING gate 도달 시점) 본 플랜이 해결한 각 대상 이슈에 대해 다음 코멘트를 반드시 추가한다:

`gh issue comment <N> --repo <github_slug> --body "재리뷰 요청 — 본 이슈의 routine 발 주의/경고 사항을 plan-enterprise #<본-플랜-이슈번호> 로 반영 완료. 다음 routine 실행에서 재평가 바랍니다."`

이 코멘트는 다음 routine 실행에서 본 이슈를 재리뷰 대상으로 다시 포함시키는 트리거이므로 누락하지 말 것. 코멘트가 게시된 후 플랜 완료 처리.
```
````

### Step 7 — Completion report

Dispatch `completion-reporter` with:
- `skill_type: "review-check"`
- `moment: "skill_finalize"`
- `data`:
  - `leader`
  - `selected_repos[]` (each `{name, github_slug}`)
  - `qualifying_issue_count`
  - `status_breakdown` (e.g., `{주의: N, 경고: M}`)
  - `output_file` (absolute path)
  - `result_summary` (one Korean sentence)

Relay verbatim to master.

End of skill invocation.

## 완료 후 HEAD 복원

`.claude/md/branch-alignment.md` "Exit restoration" 절차 수행. 베이스 = `main`. 본 스킬은 WIP / 머지 없음 — HEAD 이동 자체가 없으므로 실질 동작 없으나 절차 형식 보존.

## WIP / 머지

본 스킬은 commit 을 생성하지 않는다. 출력 파일은 gitignored 폴더 `.claude/review-check-output/` 에 작성되며 휘발성으로 다룬다. 마스터가 산출 문서를 사용한 뒤 직접 폐기 또는 보관 결정.

CLAUDE.md §2 (main-session read-only) 와의 정합: 본 스킬의 Step 6 Write 동작은 `.claude/review-check-output/` (gitignored, untracked) 만 대상으로 한다. tracked state (commit / branch / tracked file) 변경이 없으므로 §2 의 "sub-agent 경유 쓰기" 의무가 비적용되며, 본 스킬은 main 세션 직접 Write 를 carve-out 으로 채택한다. 본 carve-out 은 출력 폴더 gitignore 가 유지되는 동안에만 유효 — 향후 산출물을 tracked 로 전환할 경우 sub-agent 경유 변경이 함께 필요.

## Failure policy

| Cause | Output |
|---|---|
| `.claude/project-group/<leader>/` 부재 | `"그룹 <leader> 미등록 — /new-project-group 먼저 실행"` |
| cwd 가 Project-I2 아님 | `"review-check 는 Project-I2 리포 cwd 에서만 호출 가능. 현재: <cwd>"` |
| 멤버 리포 enumerate 결과 0건 | `"그룹 <leader> 에 멤버 리포 없음 — Index.md 점검 필요"` |
| 마스터가 multiSelect 에서 0건 선택 | `"선택된 리포 없음 — 종료"` |
| `gh` CLI 미설치 / 미인증 | `"gh CLI 미설치 또는 미인증."` |
| `gh issue list` / `view` 실패 | `"GitHub 조회 실패: <error>. 권한 / 네트워크 확인."` |
| 주의·경고 이슈 0건 | `"주의·경고 리뷰가 달린 클로즈 이슈 없음 — 종료"` |
| 출력 파일 작성 실패 | `"출력 파일 작성 실패: <error>."` |

## Scope (v1)

In scope:
- 멤버 리포 multiSelect 기반 routine 리뷰 코멘트 수집
- 시그니처 마커 기반 routine review 식별 + 최신 1건 채택
- 주의 / 경고 상태 이슈 필터링 + 권장방안 파싱
- `/plan-enterprise <leader>` 호출용 프롬프트 문서 작성
- 산출 문서에 "재리뷰 요청 코멘트 게시" 필수 동작 명시
- 산출 폴더 `.claude/review-check-output/` gitignored (휘발성 산출물)

Out of scope (v1):
- routine 본문 자체의 발행 / 갱신 (`.claude/cloud-routines/*.md` 는 별도 관리)
- plan-enterprise 직접 실행 (마스터가 산출 프롬프트를 복사하여 `/plan-enterprise` 수동 호출)
- 이슈 상태 / 라벨 / 코멘트 mutation (read-only)
- 다중 leader 동시 처리 (한 invocation 당 1 leader)
- 동일 leader 의 반복 invocation 캐싱 (매 호출 fresh fetch)
- 산출 폴더 자동 정리 / 만료 (마스터 책임)
