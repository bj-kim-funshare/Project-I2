---
name: review-check
description: Aggregate routine-flagged 주의/경고 reviews across selected member repos of a project group, maintain a per-repo safe-list of routine-confirmed 안전 issues at `.routine-state/safe-issues.json` on each member repo's `i-dev` branch (cross-repo WIP write), and author a plan-enterprise prompt document that resolves the 주의/경고 backlog. Master multi-selects member repos via AskUserQuestion, the skill queries each repo's closed issues (excluding safe-list numbers), parses routine signature-marker comments, appends 안전 issues to that repo's safe-list and removes entries whose `marker_sha` no longer matches current HEAD (= code changed → re-evaluation needed). Safe-list updates commit on per-repo WIP branches off `i-dev` and merge back to `i-dev`. The Korean output document under `.claude/review-check-output/` (gitignored) contains a `/plan-enterprise` prompt that — at downstream plan completion — must post a 재리뷰 요청 comment on each resolved issue so the next routine run re-evaluates. Read-only against GitHub for issue / PR / label state; the only mutations are (1) safe-list file commits on member repos' i-dev branches and (2) the local output document.
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
6. 선택된 각 멤버 리포의 로컬 cwd 가 존재하고 git 저장소이며 `i-dev` 브랜치가 (로컬 또는 원격에) 존재. `i-dev` 부재 시 본 스킬은 해당 리포에 대해 안전-리스트 갱신을 skip 하고 enterprise prompt 생성만 진행 (`/plan-enterprise <leader>` 의 사전 bootstrap 단계로 처리 위임).

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

### Step 4 — Per-repo safe-list 로드

선택된 각 멤버 리포에 대해 그 리포 cwd 에서 다음 수행:

```bash
cd <member.cwd>
git fetch origin i-dev 2>/dev/null
```

`origin/i-dev` 가 존재하면 그 ref 의 `.routine-state/safe-issues.json` 을 `git show origin/i-dev:.routine-state/safe-issues.json` 으로 읽어 JSON 파싱. 파일 부재 또는 `i-dev` 부재 시 빈 객체로 fallback:

```json
{"repo": "<member-name>", "safe_issues": []}
```

각 멤버 리포별 safe-list 를 메모리에 보관 (`safe_list[<member-name>]`).

### Step 5 — Closed 이슈 수집 + safe-list 제외

각 선택된 리포의 `<github_slug>` 로:

```bash
gh issue list --repo <github_slug> --state closed --limit 500 \
  --json number,title,url,closedAt
```

후보에서 `safe_list[<member-name>].safe_issues[].number` 제외. 남은 후보 각 이슈에 대해:

```bash
gh issue view <N> --repo <github_slug> --json comments \
  --jq '.comments[] | {body, createdAt}'
```

시그니처 마커 (`<!-- review-check-routine:<repo-slug>:multi-perspective sha=<SHA>`) 가진 가장 최근 코멘트 1건 추출 → "리뷰 결과" + `sha=` 값 파싱.

### Step 6 — 분류 + safe-list 갱신 작업 결정

각 후보 이슈를 다음 세 부류로 분류:

| 부류 | 판정 기준 | 처리 |
|---|---|---|
| 신규 안전 | 마커 있음 + 결과 = 안전 + 리스트 미등록 | safe-list 에 `{number, marker_sha, confirmed_at}` append (델타 마킹) |
| 안전 유효성 갱신 | 리스트에 있는데 현재 마커가 없거나 결과 ≠ 안전 또는 marker_sha 불일치 | safe-list 에서 해당 항목 제거 (델타 마킹) |
| 주의/경고 | 마커 있음 + 결과 ∈ {주의, 경고} | enterprise prompt 대상에 포함 + 권장방안 파싱 |
| 그 외 (마커 없음 / 평가 불가) | — | skip |

리포 별 델타 (append 또는 제거) 가 1건 이상이면 safe-list 갱신 commit 대상으로 표시.

### Step 7 — Safe-list 갱신 (per-repo WIP 머지)

델타가 있는 멤버 리포 각각:

```bash
cd <member.cwd>
git worktree prune
wip="review-check-safe-list-$(date +%Y%m%d-%H%M)"
wt="../$(basename "$(pwd)")-worktrees/${wip}"
git worktree add -b "${wip}" "${wt}" origin/i-dev
# wt 안에서 .routine-state/safe-issues.json 갱신 (없으면 신규 작성)
mkdir -p "${wt}/.routine-state"
# JSON write (jq 로 in-place 갱신 권장)
git -C "${wt}" add .routine-state/safe-issues.json
git -C "${wt}" commit -m "review-check: safe-issues 갱신 (+N 안전 확정, -M 무효화)"
git -C "${wt}" push origin "${wip}"
cd <member.cwd>
git checkout i-dev
git pull --ff-only origin i-dev 2>/dev/null || true
git merge --no-ff "${wip}"
git push origin i-dev
git worktree remove "${wt}"
git branch -d "${wip}"
```

`i-dev` 부재 시: 해당 리포 safe-list 갱신 skip + 사용자 보고에 "<repo>: i-dev 부재 — bootstrap 프롬프트 (`.claude/cloud-routines/bootstrap-safe-issues-prompt.md`) 로 사전 작업 필요" 라고 명시.

### Step 8 — Enterprise prompt 문서 작성

기존 Step 6 의 작성 로직 그대로 (`.claude/review-check-output/<leader>-<YYYYMMDD-HHMM>.md` 생성). 다만 산출 문서 본문에 추가 섹션 한 줄 — "안전-리스트 갱신 결과: <repo>: +N / -M" 형식 요약 표.

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

## 안전-리스트 갱신 결과

| 리포 | +안전 확정 | -무효화 | 비고 |
|---|---|---|---|
| <repo-name> | +N | -M | |
| ... | | | i-dev 부재 — skip |

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

### Step 9 — Completion report

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
  - `safe_list_updates[]` (each `{repo, appended, removed, wip_branch_or_skipped}`)

Relay verbatim to master.

End of skill invocation.

## 완료 후 HEAD 복원

`.claude/md/branch-alignment.md` "Exit restoration" 절차 수행. 베이스 = `main`. 본 스킬은 Project-I2 cwd 에서 WIP / 머지 없음 — HEAD 이동 자체가 없으므로 실질 동작 없으나 절차 형식 보존.

## WIP / 머지

본 스킬은 두 종류의 쓰기를 수행한다:

1. **Cross-repo safe-list 갱신** — 각 선택된 멤버 리포의 cwd 에서 그 리포의 `i-dev` 에서 분기한 WIP (`review-check-safe-list-<timestamp>`) 로 `.routine-state/safe-issues.json` 만 commit 후 `i-dev` 에 머지하고 push. 한 호출에서 여러 리포에 델타가 있으면 각 리포별 독립 WIP. CLAUDE.md §5 외부 프로젝트 통합 브랜치 (i-dev) 정책 준수. 델타 0 인 리포는 WIP 생성하지 않음.
2. **Enterprise prompt 출력** — Project-I2 cwd 의 gitignored `.claude/review-check-output/` 폴더에 main 세션 직접 Write. tracked state 비변경.

CLAUDE.md §2 (main-session read-only) 와의 정합:
- 1번 cross-repo safe-list 갱신은 §5 표준 WIP+머지 사이클 (worktree 생성 / 분기 / commit / push / `git merge --no-ff` / 충돌 처리 / 정리) 을 sub-agent 없이 main 세션이 직접 수행한다. 동작 자체는 §5 사이클 전체이지만, 변경 대상은 `.routine-state/safe-issues.json` 1 파일이며 내용은 코드 로직이 아닌 routine state catalog (안전 확정 이슈 번호 누적 / 무효화) 의 JSON read-modify-write 이다. 본 cross-repo 쓰기를 §2 carve-out 으로 채택하는 의미적 범위 한정은 다음 세 가지 — (a) 변경 파일이 `.routine-state/safe-issues.json` 단일 파일에 한정, (b) 변경 내용이 JSON state catalog 갱신에 한정, (c) 코드 / 스킬 / 에이전트 / 기타 룰 파일 변경 없음 — 이 세 조건이 모두 유지되는 동안만 유효. 추가 파일을 함께 변경하거나 코드 로직이 끼어들기 시작하면 sub-agent 경유로 환원할 것.
- 2번 출력 문서는 gitignored untracked 폴더 대상이라 기존 carve-out 그대로 적용.

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
| 멤버 리포 cwd 가 git 저장소 아님 | `"<repo> cwd 가 git 저장소 아님 — Index.md 의 경로 점검 필요"` |
| 멤버 리포의 `i-dev` 부재 | (해당 리포 safe-list 갱신만 skip, 보고에 명시. 전체 halt 아님) |
| Safe-list JSON 파싱 실패 | `"<repo>/.routine-state/safe-issues.json 파싱 실패 — 수동 점검 필요"` |
| 멤버 리포 WIP 머지 충돌 | `"<repo> i-dev 머지 충돌 — 양측 보존 불가 시 마스터 결정 필요: <files>"` |

## Scope (v1)

In scope:
- 멤버 리포 multiSelect 기반 routine 리뷰 코멘트 수집
- 시그니처 마커 기반 routine review 식별 + 최신 1건 채택
- 주의 / 경고 상태 이슈 필터링 + 권장방안 파싱
- `/plan-enterprise <leader>` 호출용 프롬프트 문서 작성
- 산출 문서에 "재리뷰 요청 코멘트 게시" 필수 동작 명시
- 산출 폴더 `.claude/review-check-output/` gitignored (휘발성 산출물)
- 각 선택된 멤버 리포의 `i-dev` 브랜치 `.routine-state/safe-issues.json` 안전-리스트 cross-repo 관리
- 신규 안전 확정 / `marker_sha` 변동 시 안전-리스트 자동 append / 제거
- 멤버 리포별 독립 WIP 머지 (델타 0 인 리포는 WIP 생성 없음)

Out of scope (v1):
- routine 본문 자체의 발행 / 갱신 (`.claude/cloud-routines/*.md` 는 별도 관리)
- plan-enterprise 직접 실행 (마스터가 산출 프롬프트를 복사하여 `/plan-enterprise` 수동 호출)
- 이슈 상태 / 라벨 / 코멘트 mutation (read-only)
- 다중 leader 동시 처리 (한 invocation 당 1 leader)
- 동일 leader 의 반복 invocation 캐싱 (매 호출 fresh fetch)
- 산출 폴더 자동 정리 / 만료 (마스터 책임)
- 멤버 리포의 `i-dev` 자동 lazy-create (부재 시 skip + bootstrap 프롬프트 사용 안내)
- 라우틴 종류별 namespacing (현재는 multi-perspective 단일 — 향후 다른 routine kind 추가 시 파일명 분리 검토)
- Safe-list 의 백업 / 만료 정책 (마스터 책임)
