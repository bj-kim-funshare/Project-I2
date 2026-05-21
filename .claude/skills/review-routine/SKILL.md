---
name: review-routine
description: Manual local trigger for the same multi-perspective closed-issue review that the Claude Desktop cloud routines (.claude/cloud-routines/<repo>-review.md) execute on schedule. Master invokes /review-routine <leader>, multi-selects member repos via AskUserQuestion, and the main session sequentially reviews each repo's closed issues under the same 3-condition selection + 5-perspective rubric + 안전/주의/경고 status + signature-marker dedup + comment-posting contract as the cloud routines. Read-only against code; only mutation is `gh issue comment` per qualifying issue. Useful for ad-hoc reviews, repos where cloud routines are not yet set up, and pre-cron validation. Same safe-list fetch (`.routine-state/safe-issues.json` on each member repo i-dev) as the cloud routines, ensuring safe-confirmed issues are excluded.
---

# review-routine

Manual on-demand counterpart of the daily Claude Desktop cloud routines under `.claude/cloud-routines/`. Same selection / review / posting contract — only the execution mode differs (local main session, master-triggered, no cron).

## Invocation

```
/review-routine <leader-name>
```

`<leader-name>` required. The skill loads the leader's member repos from `.claude/project-group/<leader>/Index.md`, presents them via `AskUserQuestion` (multiSelect), then runs the review pipeline sequentially per selected repo.

## Pre-conditions

1. 베이스 브랜치 정렬 — `.claude/md/branch-alignment.md` Entry verification 절차 수행. 본 스킬 컨텍스트 = 아이OS.
2. `.claude/project-group/<leader>/` exists.
3. cwd is the Project-I2 repo.
4. Current branch = `main`.
5. `gh` CLI installed and authenticated for each selected member repo's GitHub remote.
6. 각 선택 멤버 리포의 로컬 cwd 가 존재하고 git 저장소. (`i-dev` 부재 시 안전-리스트는 빈 집합으로 fallback — cloud routine 과 동일 동작.)

## Procedure

### Step 1 — Argument parsing

`<leader-name>` 필수. 부재 시 → `"그룹 <leader> 미등록 — /new-project-group 먼저 실행"`.

### Step 2 — Member repo enumeration

`.claude/project-group/<leader>/Index.md` 를 읽어 멤버 리포 enumerate. 각 멤버 resolve:
- `name` (display label)
- `cwd` (absolute path on disk)
- `github_slug` — `gh -C <cwd> repo view --json owner,name --jq '.owner.login + "/" + .name'` 으로 동적 추출 (cloud routine 와 달리 owner 하드코딩 안 함)

0 members → `"그룹 <leader> 에 멤버 리포 없음 — Index.md 점검 필요"`.

### Step 3 — Master multi-select

ONE `AskUserQuestion` with `multiSelect: true`:
- Each option: label = `<name>`, description = `cwd: <abs-path> · github: <github_slug>`
- 0 selected → `"선택된 리포 없음 — 종료"`.

### Step 4 — Per-repo execution loop

각 선택된 리포에 대해 순차 수행 (병렬 아님):

#### Step 4-a — Safe-list fetch

```bash
gh api repos/<github_slug>/contents/.routine-state/safe-issues.json?ref=i-dev \
  --jq '.content' 2>/dev/null | base64 -d 2>/dev/null | jq -r '.safe_issues[].number'
```

→ `SAFE_NUMBERS` 집합 (404 / `i-dev` 부재 시 빈 집합 fallback, 본 스킬 halt 아님).

#### Step 4-b — 후보 수집 + safe 제외

```bash
gh issue list --repo <github_slug> --state closed --limit 500 \
  --json number,title,url,closedAt
```

후보에서 `SAFE_NUMBERS` 제외.

#### Step 4-c — 각 후보 이슈마다 3 조건 OR 평가

```bash
gh issue view <N> --repo <github_slug> --json comments \
  --jq '.comments[] | {body, createdAt}'
```

시그니처 마커 prefix = `<!-- review-check-routine:<repo-name>:multi-perspective` (cloud routine 와 정확히 동일 마커 사용 — 즉 본 스킬과 cloud routine 의 시그니처 마커는 호환).

3 조건 (OR):
1. 미리뷰: 시그니처 마커가 어느 코멘트에도 없음
2. 미해결: 최근 시그니처 마커 코멘트의 "리뷰 결과" 가 주의 또는 경고
3. 재리뷰 요청: 최근 시그니처 마커 코멘트보다 나중에 작성된 코멘트 중 본문에 "재리뷰" 키워드 포함이 1건 이상

#### Step 4-d — 대상 이슈 리뷰

각 대상 이슈에 대해:
- 이슈 본문에서 메인 작업 페이즈 + 핫픽스 전체의 커밋 SHA / PR / 머지 정보 추출
- `gh pr view`, `gh pr diff`, `git -C <member.cwd> show <SHA>` 등 읽기 전용 수단으로 변경 검토 (어떤 변경도 가하지 말 것)
- 5 관점 리뷰 — main 세션이 직접 분석 수행:
  - 의도 부합: 이슈 명령 / 페이즈 설명과 실제 변경 일치?
  - 로직 정합: 페이즈 분할 / 핫픽스 순서 합리적 + 누락 없음?
  - 보안: 인증 / 입력 검증 / 시크릿 노출 / 권한 / 의존성?
  - 성능 및 리소스: 비효율 / N+1 / 누수 / 무한루프?
  - 유지보수성: 명명 / 구조 / 중복 / 폐기 누락 / 회귀 위험?
- 각 관점 finding 을 안전 / 주의 / 경고 로 태그
- 이슈 전체 상태: 안전 (모두 안전) / 주의 (주의만) / 경고 (경고 1건+)

#### Step 4-e — Dedup 검사

다음 셋 모두 참이면 본 이슈 코멘트 작성 생략:
- 선정 사유가 조건 2 단독 (1, 3 미해당)
- 최근 시그니처 마커 코멘트의 `sha=` 값 = 현재 평가 대상 SHA (= 이슈 최신 머지 커밋)
조건 1 또는 3 으로 선정된 이슈는 dedup 무시.

#### Step 4-f — 코멘트 게시

```bash
gh issue comment <N> --repo <github_slug> --body-file <tmp>
```

본문 형식 (Markdown):

```
<!-- review-check-routine:<repo-name>:multi-perspective sha=<평가-대상-SHA> -->

# <리뷰 제목>

**리뷰 결과**: <안전 / 주의 / 경고>

## 총평
<한 단락 — 안전 / 주의 / 경고 모두 필수>

## 권장 방안
<주의·경고 finding 마다 1:1 매핑. 안전 단독이면 본 섹션 생략.>
- (<관점> / <severity>) <finding 요약> → <권장 방안>
- ...
```

### Step 5 — Per-repo report

각 리포 처리 종료 시 main 세션 보고에 누적:
- `<github_slug>`: 처리 후보 N건 / 신규 코멘트 게시 M건 / dedup 생략 K건 / safe 제외 S건

### Step 6 — Completion report

Dispatch `completion-reporter` with:
- `skill_type: "review-routine"`
- `moment: "skill_finalize"`
- `data`:
  - `leader`
  - `selected_repos[]` (각 `{name, github_slug}`)
  - `per_repo_summary[]` (각 `{github_slug, candidates, posted, deduped, safe_excluded}`)
  - `result_summary` (한 줄 한국어)

Relay agent's response verbatim.

End of skill invocation.

## 완료 후 HEAD 복원

`.claude/md/branch-alignment.md` "Exit restoration" 절차 수행. 베이스 = `main`. 본 스킬은 commit / 머지 없음 — HEAD 이동 자체가 없으므로 실질 동작 없으나 절차 형식 보존.

## WIP / 머지

본 스킬은 commit 을 생성하지 않는다. 변경 대상은 외부 GitHub state (이슈 코멘트) 1종뿐 — `gh issue comment` 로 mutation 하지만 로컬 repo state 비변경. CLAUDE.md §2 (main-session read-only) 와의 정합: 본 스킬의 mutation 은 외부 GitHub API 호출이며 로컬 파일 / 커밋 / 브랜치 변경 없음. 기존 `dev-merge` (`gh pr create` / `gh pr merge`) / `pre-deploy` Branch B 등에서 이미 적용되어 온 "로컬 repo state 비변경 + 외부 GitHub API 호출만" 패턴을 본 스킬도 동일하게 따른다. §2 의 공식 carve-out 신설은 본 SKILL.md 의 책임 범위 밖이며, 향후 CLAUDE.md §2 갱신이 필요해지면 별도 plan-enterprise-os 로 처리.

## Cloud routine 과의 관계

| 항목 | Cloud routine | review-routine (본 스킬) |
|---|---|---|
| 트리거 | cron (`30 6,18 * * *` UTC) | master 수동 (`/review-routine <leader>`) |
| 실행 위치 | Claude Desktop 클라우드 | 로컬 Claude Code 메인 세션 |
| 대상 단위 | 1 리포 (routine 당) | N 리포 (multiSelect) |
| 시그니처 마커 | 동일 | 동일 (양측 코멘트 호환) |
| 안전-리스트 fetch | 동일 (i-dev 의 `.routine-state/safe-issues.json`) | 동일 |
| 3 조건 OR | 동일 | 동일 |
| 5 관점 리뷰 | 동일 | 동일 |
| Dedup | 동일 | 동일 |
| 코멘트 포맷 | 동일 | 동일 |

마커 호환성으로 양측 결과가 누적되어 `/review-check` 의 안전-리스트 갱신 흐름과 자연스럽게 연동.

## Failure policy

| Cause | Output |
|---|---|
| `.claude/project-group/<leader>/` 부재 | `"그룹 <leader> 미등록 — /new-project-group 먼저 실행"` |
| cwd 가 Project-I2 아님 | `"review-routine 은 Project-I2 리포 cwd 에서만 호출 가능. 현재: <cwd>"` |
| 멤버 리포 enumerate 결과 0건 | `"그룹 <leader> 에 멤버 리포 없음 — Index.md 점검 필요"` |
| 마스터가 multiSelect 에서 0건 선택 | `"선택된 리포 없음 — 종료"` |
| `gh` CLI 미설치 / 미인증 | `"gh CLI 미설치 또는 미인증."` |
| 멤버 리포 cwd 가 git 저장소 아님 | `"<repo> cwd 가 git 저장소 아님 — Index.md 의 경로 점검 필요"` |
| `gh issue list` / `view` 실패 | `"<github_slug> GitHub 조회 실패: <error>. 다음 리포로 진행 또는 중단 마스터 결정."` |
| `gh issue comment` 실패 | (해당 이슈만 skip, per-repo report 에 실패 1건 기록, 다른 이슈 / 리포는 계속) |

## Scope (v1)

In scope:
- 1 leader 당 N 멤버 리포 multiSelect
- 멤버 리포별 `gh -C <cwd> repo view` 로 owner 동적 추출
- 안전-리스트 fetch (i-dev 의 `.routine-state/safe-issues.json`)
- Closed 이슈에 대한 3 조건 OR 평가
- 5 관점 main-세션 리뷰 + 코멘트 게시
- Cloud routine 과 시그니처 마커 / 코멘트 포맷 완전 호환

Out of scope (v1):
- 자동 cron / 스케줄링 (cloud routine 영역)
- 라우틴 사양 문서 자동 생성 (별도 작업)
- 다중 leader 동시 처리 (1 invocation = 1 leader)
- 병렬 리포 실행 (순차 sequential)
- 안전-리스트 갱신 — `/review-check` 전담, 본 스킬은 read-only
- 14일 윈도우 / 별도 시간 필터링 — cloud routine 의 "오픈+안전 만 제외" 단순 모델 따름
- Sub-agent dispatch (v1 main 세션 직접 수행, 향후 비용 / 병렬 필요 시 v2 에서 검토)
