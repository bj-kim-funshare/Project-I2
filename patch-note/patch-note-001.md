# 아이OS — Patch Note (001)

## v001.7.0

> 통합일: 2026-05-13
> 플랜 이슈: #3 (핫픽스 phase)
> 대상: 아이OS — 모니터링 대시보드 일자별 토큰 차트

### 페이즈 결과

- **Hotfix 1 (누적 Phase 2)** — `monitoring/script.js` 의 `renderChartDayTokens()` datasets 에서 `'cache write'`, `'cache read'` 두 시리즈 제거. 남은 시리즈는 `input` (`fill: 'origin'`) + `output` (`fill: '-1'`) 2 개로 누적 영역 선 차트 유지.

### 변경 요약

- 차트가 4 시리즈 → 2 시리즈로 단순화 (input + output 만).
- `type: 'line'` / `scales.{x,y}.stacked: true` / `tooltip` / `legend` / 색상 상수 / HTML / 기타 옵션 무변경.
- 이슈 #3 의 PENDING 게이트에서 마스터 입력 `핫픽스, 선 그래프에서 캐시는 제외해줘` 로 진입.

### 영향 파일

- 수정: `monitoring/script.js` (datasets 2 줄 삭제)

### Treadmill Audit

NOT APPLICABLE — 본 변경은 시각화 datasets 토글이며, 신규 규칙 / 훅 / 에이전트 / 스킬 / 검증축 / invariant 추가 0.

### 절차상 메모

- 본 entry 는 plan-enterprise-os 핫픽스 path 의 단일 WIP (`-핫픽스1`) 안에서 코드 commit + patch-note commit 을 같은 worktree 에 묶어 진행. 새 §5 worktree 격리 규약 (v001.4.0) 적용.
- patch-note 버전 번호는 worktree 생성 시점에 main HEAD 가 v001.5.0 이었으나 dispatch 중 다른 세션이 v001.6.0 을 머지하여, 본 entry 가 v001.7.0 으로 됨 (worktree-lifecycle.md 의 patch-note 버전 race known limitation 경로 — renumber 없이 다음 빈 슬롯으로 자연 정렬).

---

## v001.6.0

> 통합일: 2026-05-13
> 플랜 이슈: #2 (핫픽스2)
> 대상: 아이OS — 이슈 lifecycle close 정합 (handoff orphan 폐기)

### 페이즈 결과

- **Phase 3 — handoff 스킬 lifecycle close 절차 추가**: pre-deploy 와 create-custom-project-skill 의 SKILL.md 에 이슈 close 단계 명시. 두 스킬 모두 자기 이슈를 자기 lifecycle 안에서 close 하도록 책임 귀속.

### 변경 요약

#### pre-deploy/SKILL.md

(본 핫픽스2 작업물 일부 — 사이클 도중 commit 이 별도 세션 브랜치에 잘못 안착했고, 그 세션이 v001.4.0 머지로 흡수해 main 에 이미 존재. 본 entry 는 사이클 audit trail 보존 목적.)

- Prior-issue lookup section 신설 — `pre-deploy: <leader> 배포 차단` title prefix 매칭으로 재호출 결정적 식별
- Branch A: 첫 호출 신규 생성 / 재호출 기존 이슈 comment append + open 유지
- Branch B: 모든 타겟 배포 성공 + prior_issue_number 존재 시 합격 보고서 comment + `gh issue close`. 부분 실패 시 open 유지
- Failure policy: lookup / comment / close 실패 케이스 명시
- Scope: 다른 스킬 이슈 close 금지 명시

#### create-custom-project-skill/SKILL.md

- Lifecycle 에 Step 10 (PENDING gate) + Step 11 (FINALIZE on `플랜 완료`) 신설
- Step 9 → "작업 완료" 보고 (mechanical creation summary, 이슈 OPEN)
- frontmatter description 갱신 — "Owns its issue lifecycle"
- Scope: "Issue lifecycle ownership" 명시

머지 시 v001.4.0 의 worktree 격리 변경과 같은 파일에서 자동 양측 보존 (ort strategy) — 두 변경의 hunk 가 겹치지 않아 conflict 없이 통합.

### 영향 파일

- `.claude/skills/pre-deploy/SKILL.md`
- `.claude/skills/create-custom-project-skill/SKILL.md`
- `patch-note/patch-note-001.md` (본 entry)

### Treadmill Audit

| Q | 답 |
|---|---|
| Q1 재발 사고? | YES — handoff 스킬 이슈 누적 / close 책임 부재 |
| Q2 새 엣지 케이스? | pre-deploy 재호출 시 validator 가 다른 차단 발견 → 옛 이슈에 comment append + open 유지 (중복 이슈 회피). create-custom `중단` 입력 → 이슈 open 유지 |
| Q3 retire | **"handoff orphan"** 패턴 — "다른 스킬이 close 한다" 는 암묵 가정. 본 변경으로 close 권한·책임이 이슈 생성 스킬 자체에 귀속. inspection 4 스킬은 본 retire 대상 아님 (그들은 open 유지가 의도된 동작) |

### 사후 ratification 메모

본 핫픽스2 는 이슈 #2 의 Step 11 PENDING 게이트에서 마스터의 `핫픽스, ...` 입력으로 진입. 작업 절차 중 working tree 공유로 인한 cross-session 격리 부재가 노출되어 commit 이 다른 세션 브랜치에 잘못 안착하는 사고 발생. 이는 별도 사이클 (이슈 #4 v001.4.0) 에서 `git worktree` 격리 도입으로 구조적 해결됨 — 본 v001.6.0 의 머지는 그 worktree 격리 도입 후 첫 양측 보존 머지 검증 케이스.

본 핫픽스의 일부였던 메모리 `feedback_no_pre_session_collision_check.md` 는 v001.4.0 시점에 폐기됨 (Q3 retire — worktree 격리로 의미 상실). MEMORY.md 인덱스에서도 이미 제거됨.

### 커밋

- `beab4ad` hotfix(pre-deploy): 이슈 lifecycle close 절차 추가 (cherry-pick 안착, 내용은 main 에 이미 흡수됨)
- `be1fcf0` hotfix(create-custom-project-skill): lifecycle close 절차 추가
- `0567743` merge: main 통합 (worktree 격리 도입 v001.4.0 흡수, ort 자동 양측 보존)
- 본 v001.6.0 entry 작성 commit (`-문서-핫픽스2` WIP)

---

## v001.5.0

> 통합일: 2026-05-13
> 플랜 이슈: #3
> 대상: 아이OS — 모니터링 대시보드 일자별 토큰 차트

### 페이즈 결과

- **Phase 1** — `monitoring/script.js` 의 `renderChartDayTokens()` 를 Chart.js v4.5.1 누적 영역 선 그래프로 전환. `type: 'bar' → 'line'`, 각 dataset 에 `borderColor` (원색) + `backgroundColor` (hex8 40% 알파, 원색 + `'66'`) + `fill` 체인 (`'origin'` → `'-1'` x3) 추가. `stack: 's'` 및 `scales.{x,y}.stacked: true` 유지 (Chart.js v4 누적 영역 관용구).

### 변경 요약

- 막대 차트를 4 시리즈 누적 영역 선으로 시각화 전환.
- 누적 의미(스택)는 유지 — 마스터 sharpening 확인 (2026-05-13).
- tooltip / legend / responsive / scales.y.ticks.callback / HTML / 색상 상수 무변경.
- 마스터 요청 범위 밖 옵션 (tension / pointRadius 등) 추가 없음.

### 영향 파일

- 수정: `monitoring/script.js` (단일 함수 `renderChartDayTokens`, 10 줄 = 5 추가 / 5 삭제)

### Treadmill Audit

NOT APPLICABLE — 본 변경은 단일 시각화 옵션 토글이며, 신규 규칙 / 훅 / 에이전트 / 스킬 / 검증축 / invariant 추가 0.

### 절차상 메모

- 본 entry 는 v001.4.0 worktree 격리 머지 이후 가장 먼저 도입되는 doc WIP — 새 §5 패턴 (`git worktree add ../Project-I2-worktrees/<wip> main`) 의 plan-enterprise-os doc WIP 첫 dogfood.
- 본 계획의 code WIP (`-작업`) 는 worktree 격리 도입 직전 구 패턴으로 진행되어 다른 세션의 동시 commit 1 건 (`e862889`, 이슈 #2 핫픽스2 부분 1/3) 이 같은 branch 에 박힘. 해당 commit 은 origin/main 에 함께 push 되어 정합성 유지 (이슈 #2 의 후속 진행에서 정상 추적 가능).

---

## v001.4.0

> 통합일: 2026-05-13
> 플랜 이슈: #4
> 대상: 아이OS — 모든 write 스킬에 git worktree 격리 강제

### 배경

빌드 직후 24 시간 내 다중-세션 충돌 3회 이상 발생. 한 세션의 `git checkout` 이 같은 working tree 의 단일 HEAD 를 mutate 하여 다른 세션의 WIP 위에 commit 박힘 / 메인 working tree 의 미커밋 edit 손실 / phase-executor declared affected_files 위반 등. 원인은 cwd 가 아니라 **single working tree 의 single HEAD**. 해결: `git worktree add` 로 WIP 마다 독립 working tree + HEAD 부여.

### 페이즈 결과

- **Phase 1** — `.claude/md/worktree-lifecycle.md` 신설. 정확한 충돌 메커니즘, 경로 규약 (`../{repo}-worktrees/<wip>`), create/dispatch/merge/remove 시퀀스, prune 정책, 잔존 race 명시, "다른 세션의 worktree 는 이 세션의 관심사가 아니다" 원칙.
- **Phase 2** — CLAUDE.md §5 WIP & merge protocol 을 4 단계 → 5 단계로 격상. 1 단계 = WIP worktree + branch (working-tree-level isolation). 절차 본문은 worktree-lifecycle.md 참조.
- **Phase 3 (load-bearing)** — 4 개 write-capable sub-agent (phase-executor, code-fixer, db-migration-author, db-data-author) 에 `worktree_cwd` 입력 추가. 모든 git 호출이 `git -C <worktree_cwd>` 형식. code-fixer 의 `git checkout` 제거.
- **Phase 4** — plan-enterprise + plan-enterprise-os SKILL.md 갱신. Step 6 / 7 / 9 / 10 / HOTFIX 경로에 worktree 절차 주입. 메인 세션 검증 ritual 에 `git fetch origin <wip_branch>` 추가.
- **Phase 5** — task-db-structure + task-db-data SKILL.md 갱신. Phase 1 dispatch 에 worktree_cwd, Phase 3 WIP 블록을 worktree add 패턴으로, Phase 5 머지 후 worktree remove.
- **Phase 6** — dev-merge SKILL.md 갱신. from-branch (이미 존재) 위에 worktree add (no -b), code-fixer dispatch 3 곳에 worktree_cwd, conflict-PENDING rebase 를 `git -C <wt_from>` 으로.
- **Phase 7** — group-policy / new-project-group / plan-roadmap SKILL.md 갱신. 메인 세션이 worktree 절대경로로 Write/Edit, `git -C <wt>` 로 commit/push, 머지 후 remove. group-policy "유지 4" no-op 분기는 worktree 생성 전 halt.
- **Phase 8** — create-custom-project-skill / patch-update / patch-confirmation SKILL.md 갱신. patch-confirmation 은 메인 cwd 미커밋 변경을 `git stash push -u → git -C <wt> stash pop` 으로 worktree 이동하는 7 단계 절차 명시.
- **Phase 9 (post-advisor BLOCK)** — entry ritual 의 `git worktree list # report unrelated leftovers to master` 안티-패턴 제거. worktree-lifecycle.md + 9 SKILL.md 정리. 다른 세션의 worktree 는 본 세션의 관심사가 아님을 본문에 명시.

### 영향 파일

- 신규: `.claude/md/worktree-lifecycle.md`
- 수정: `CLAUDE.md`, `.claude/agents/phase-executor.md`, `.claude/agents/code-fixer.md`, `.claude/agents/db-migration-author.md`, `.claude/agents/db-data-author.md`
- 수정: `.claude/skills/{plan-enterprise, plan-enterprise-os, task-db-structure, task-db-data, dev-merge, group-policy, new-project-group, plan-roadmap, create-custom-project-skill, patch-update, patch-confirmation}/SKILL.md` (총 11)
- 메모리 retire: `~/.claude/projects/.../memory/feedback_no_pre_session_collision_check.md` 삭제 + `MEMORY.md` 인덱스 정리

### Treadmill Audit

- **Q1 재발성**: PASS — 24 시간 내 3 회 이상 충돌 사고.
- **Q2 새 엣지 케이스**:
  - worktree dir stale (수동 삭제) → `git worktree prune` 으로 투명 정리.
  - patch-confirmation 의 git stash race (메인 cwd 단일 stash 저장소, 동시 호출 시 stash 섞임) → worktree 로 해소 안 됨. §5 4 단계 + 마스터 복구. SKILL.md 본문에 명시.
  - Korean 경로 (`-작업`, `-문서`) — macOS APFS 정상 동작 확인 (본 v001.4.0 WIP B 가 첫 dogfood, `git worktree add` 성공).
  - worktree-lifecycle.md 의 `push -u origin` "optional" 표현 — 실제로는 dispatcher 가 mandatory 사용. 후속 fix 후보.
- **Q3 trade-out 폐기**: PASS — `feedback_no_pre_session_collision_check.md` 메모리 삭제 + `MEMORY.md` 인덱스 한 줄 제거. worktree 격리가 도입되어 "다른 세션 사전 회피 금지" 의 보호 대상 (사전 회피) 자체가 의미를 잃음.

### 잔존 known limitations

- patch-confirmation 의 git stash race (위 Q2 참조).
- patch-note 버전 번호 race (두 세션이 동시에 v001.K+1.0 산출 시 머지에서 충돌; §5 4 단계로 한쪽을 .K+2.0 으로 renumber). worktree-lifecycle.md 명시.
- worktree-lifecycle.md 의 `push -u origin` "optional" 표현 정리 (단어 한 줄 수정 후보).

### 다음 사이클 후보

- 본 v001.4.0 의 dogfood 일주일 운영 후 결함 수집 → 마이크로 fix 패치 (예: lifecycle md `optional` 표현 정리)
- 다중 세션 실 운영 검증 (두 세션 동시 write 스킬 호출 → 양측 머지 시 충돌 없이 양측 보존)

## v001.3.0

> 통합일: 2026-05-13
> 플랜 이슈: #2 (핫픽스 phase)
> 대상: 마스터 머신 사용자 환경 설정

### 페이즈 결과

- **Phase 2 — Claude Code 시작 시 기본 effort xhigh→medium**: `~/.claude/settings.json:147` `effortLevel` 키 값 변경. 이슈 #2 PENDING 게이트에서 마스터 핫픽스 입력으로 진입.

### 변경 요약

- **변경 위치**: `~/.claude/settings.json` line 147
- **변경**: `"effortLevel": "xhigh"` → `"effortLevel": "medium"`
- **영향 범위**: 모든 프로젝트의 Claude Code 메인 세션 — Project-I2 의 `.claude/settings.json` 에는 effort 키가 없어 글로벌 값을 상속하므로 본 변경이 즉시 적용됨. 본 레포 sub-agent 들은 별도로 frontmatter `effort: medium` 으로 이미 고정되어 영향 없음.

### 영향 파일

- `~/.claude/settings.json` — **untracked**, 본 레포 git 추적 밖. 변경 검증은 마스터 머신에서만 가능. 향후 독자가 git blame 으로 변경 출처를 못 찾는 이유.

### Treadmill Audit

NOT APPLICABLE — 신규 규칙/훅/에이전트/스킬/검증축/invariant 추가 0. 단일 설정 값 변경.

### 절차상 비대칭

- 코드 변경 origin push 0 (변경 자체가 레포 밖)
- 패치노트 origin push 1 (본 v001.3.0 entry 가 main 으로 머지·push 됨)

### 사후 ratification 메모

본 핫픽스는 이슈 #2 의 Step 11 PENDING 게이트에서 마스터가 `핫픽스, claude 시작 시 기본 effort가 지금 xhigh인데 medium으로 바꿔줘` 입력으로 진입. plan-enterprise-os 스킬 v1 spec 의 hotfix path 적용 (WIP `-문서-핫픽스1` 명명은 향후 컨벤션 시드).

### 커밋

- 본 v001.3.0 패치노트 작성 자체가 단일 commit (`-문서-핫픽스1` WIP, 그 후 main 머지 commit)

---

## v001.2.0

> 통합일: 2026-05-13
> 플랜 이슈: #2
> 대상: 아이OS (monitoring 페이지)

### 페이즈 결과

- **Phase 1 — 다크테마 + 중앙정렬 + 고정 grid**: `monitoring/styles.css` 401줄 재작성 + `monitoring/script.js` 31줄 보강. 마스터 스크린샷 피드백 (라이트테마 / 풀폭 늘어남 / 빈 4번째 열 / KPI 카드 정렬) 4종 결함을 Project-I monitoring CSS 벤치마킹으로 일괄 해소.

### 변경 요약

- CSS 변수 다크 팔레트 (`--bg #0b0d12`, `--surface #141821`, `--accent #7c3aed`, …) — Project-I 토큰과 1:1 매핑
- `.layout { max-width: 1480px; margin: 0 auto; }` — 풀폭 늘어남 해소
- KPI grid `repeat(4, 1fr)` 고정, 차트 grid `repeat(3, 1fr)` 고정 + `.wide { grid-column: span 3; }` — `auto-fit` 의 빈 4번째 열 제거
- KPI 카드 `min-height: 168px` 통일, `dt::before` 마커로 non-cache(●) / cache(▣) 색상 구분
- `Chart.defaults.color / borderColor / tooltip` 다크 정합 — Chart.js 6 인스턴스 일괄 적용
- 다크 BG 친화 팔레트: `input #3b82f6`, `cache #9b59b6`, `positive #10b981`
- 반응형 1280px → 2-col, 800px → 1-col

### 영향 파일

- `monitoring/styles.css`
- `monitoring/script.js`

### Treadmill Audit

NOT APPLICABLE — 신규 규칙/훅/에이전트/스킬/검증축/invariant 추가 0. 순수 시각 정합 수정.

### 사후 ratification 메모

작업 commit `acb2b9d` 가 마스터 스크린샷 피드백 직후 선행 실행됨. 본 plan-enterprise-os 호출은 사후 ratification — 마스터가 `/plan-enterprise-os` 인자로 push 직접 위임 → Step 4 ExitPlanMode 생략. advisor 계획/완료 6 관점 모두 PASS.

### 커밋

- `acb2b9d` style: monitoring 다크테마 + 중앙정렬 + 고정 grid
- `d616640` merge: monitoring 다크테마 polish (이슈 #2 phase 1)
- 본 v001.2.0 패치노트 작성 자체가 추가 1 커밋 (`-문서` WIP)

---

## v001.1.0

> 통합일: 2026-05-12
> 본 버전 = I2 초기 하네스 빌드 (9시간 점진 검증 세션) 의 전체 결과

### 하이라이트

Project-I (구 아이OS) 가 자기 보수에 자원 소진되어 실패한 뒤, v2 시스템을 처음부터 다시 짜는 단일 세션 빌드. 마스터의 점진 검증 빌드 모드 (1 단위 설명 → advisor 검증 → 함께 구축) 로 진행. 결과적으로 외부 product 개발에 집중하는 단순·모듈·재발-방지-트레드밀-회피 하네스가 출범.

### 시스템 구성 신규 등록

#### 베이스라인 17 스킬

- **단순 (7)**: dev-start / patch-update / patch-confirmation / new-project-group / group-policy / plan-roadmap / create-custom-project-skill
- **sub-agent + advisor (8)**: dev-merge / pre-deploy / dev-inspection / dev-security-inspection / db-security-inspection / project-verification / task-db-structure / task-db-data
- **핵심 (2)**: plan-enterprise / plan-enterprise-os

#### Sub-agent 11

- **리뷰어 (read-only, 7)**: bug-detector / claude-md-compliance-reviewer / code-inspector / security-reviewer / db-security-reviewer / refactoring-analyzer / deploy-validator
- **작성/실행자 (write-capable Sonnet, 4)**: code-fixer / db-migration-author / db-data-author / phase-executor

#### 공용 절차

- `.claude/md/inspection-procedure.md` — 4 inspection 스킬 (dev-inspection / dev-security-inspection / db-security-inspection / project-verification) 공유

### 핵심 설계 결정 (마스터 lock)

- **이슈 = source of truth**: plan-* 가 로컬 plan 문서 미작성, GitHub Issue 가 단일 source
- **report-only + plan-enterprise 위임**: pre-deploy / 4 inspection 자동 수정 X, 이슈 생성 후 hand-off
- **advisor `BLOCK:` 토큰 contract**: 모호한 prose 해석 회피
- **WIP `-작업` / `-문서` 분리** + dev-merge / pre-deploy / task-db-* 의 carve-out 명시
- **i-dev 부트스트랩 carve-out**: 첫 사용 스킬이 main 에서 lazy 분기
- **scope 모드 = `version | today`** (`all` 드롭 — silent truncation 회피)
- **언어 분리**: 영문 spec / 한국어 사용자 보고·patch-note·git·이슈
- **plan-enterprise-os 6 관점 advisor** (Treadmill Audit 별도 승격)
- **task-db-structure / task-db-data 모든 환경 (dev→staging→prod)** 마스터 게이트 4개 + dry-run + auto-rollback
- **task-db-data 논리적 inverse DML 롤백** (no concurrent writers 전제)
- **dev-security ↔ db-security 엄격 분할** (DB 관련 = db-security)
- **2 reviewer + 1 fixer = 3 sub-agent** (dev-merge — Claude 공식 5-agent literal 대신 철학 적용)
- **메인 세션 페이즈별 5-단계 검증 ritual** (per-phase advisor 없이도 silent pass 방지)

### 후속 시스템 (§F-3 블록)

- **monitoring v1 minimal** — `monitoring/` at repo root. 3 축 (모델/스킬/세션) + 일자별 토큰 집계 + 비용 추정. 외부 의존 0, ~/.claude/projects/.../jsonl 만 읽음. collect.py + serve.py + 대시보드. 향후 polish (Chart.js / 세션별 비용 분배) 별도 단위.
- **statusline v1** — `.claude/scripts/statusline.sh` + settings.json 등록. 3 줄 색상 출력 (모델/ctx%/비용 + cwd/git/lines + rate-limits). 페르소나/UUID 시스템 제거, 구버전 455 줄 → 125 줄.
- **codex 협업 v1 design (구현 보류)** — `.claude/md/codex-collaboration.md`. Final PASS = Claude 단독 invariant + 5 defense-in-depth gates (packet/worktree/write-set/TDD/report-discipline). 구현은 다음 plan-enterprise-os 1 invocation 으로.

### 메모리 시스템

- `project_history.md` — I2 origin / Project-I 실패 컨텍스트
- `feedback_no_prevention_treadmill.md` — net-positive 3 질문 (영구)
- `feedback_incremental_verified_build.md` — 점진 빌드 모드 (확장 시 적용)
- `feedback_advisor_per_unit.md` — 빌드 세션 한정 advisor 의무, sunset 완료 (마스터 빌드-완료 시그널 시점에 폐기)

### 검증 결과

- frontmatter 무결성 100% (17 skill folder == name / 11 agent file == name / description 누락 0 / tools 누락 0)
- skill ↔ agent cross-reference 100% (모든 참조 실존 agent)
- skill ↔ skill cross-reference 100%
- inspection-procedure 패턴 실 소비자 4 (dev-inspection / dev-security-inspection / db-security-inspection / project-verification)
- 토큰 예산: 항상 로드 컨텍스트 29.9k / §F-1 목표 50k 한참 아래, free space 970k (97%)
- monitoring smoke test: 15 세션 / 1207 messages / ~$1044.89 집계, /api/refresh 200
- statusline 합성 JSON 입력 smoke test 통과

### 영향 파일

- `CLAUDE.md`
- `README.md` (재작성)
- `patch-note/patch-note-001.md` (본 파일)
- `.claude/` 전체 (rules/.gitkeep, hooks/.gitkeep, scripts/{statusline.sh,.gitkeep}, md/{inspection-procedure.md, codex-collaboration.md}, skills/{17 SKILL.md}, agents/{11 agent.md}, settings.json)
- `monitoring/` 전체 (scripts/collect.py, scripts/serve.py, index.html, script.js, styles.css, README.md, data/.gitkeep)
- `.gitignore`

총 ~36 파일, ~5,200 줄 (런타임 산출물 aggregate.json 제외).

### 커밋

1. `19e23be` feat: .claude/ 골격 + CLAUDE.md 본본
2. `ef37bfd` feat: 17 스킬 + 11 sub-agent + inspection-procedure 공용 절차
3. `52b6f64` feat: patch-note 부트스트랩 (001)
4. `f210bdd` docs: README 정식 재작성 (빌드 완료 운영 가이드)
5. `9db0454` feat: monitoring v1 minimal — 3축 토큰 추적 대시보드
6. `af935b8` feat: statusline v1 — 3 줄 색상 출력
7. `93843f8` feat: codex 협업 v1 design doc (구현 보류)

(본 v001.1.0 패치노트 작성 자체가 8번째 커밋이 된다.)

### v1 명시 제한 (의식적 deferral)

- lint / build / test 게이트 — §D-23 폐지, 마스터 재설계 논의 예정
- `all` 스코프 모드 — 4 inspection 스킬 모두 미제공
- DB 엔진 — MySQL / PostgreSQL 만
- DB 자격증명 — env var 만 (secret-manager 통합 deferred)
- DB 보호 테이블 (`protected_tables`) — db.md 스키마 미설정
- DML 동시 writer 안전성 — capture-and-rollback 은 no-concurrent-writers 전제
- monitoring polish (Chart.js / 세션별 비용 분배 / 다중 프로젝트) — 별도 단위
- codex 협업 구현 — design only, 다음 plan-enterprise-os 로 진입 가능

### 다음 사이클 후보

- WIP 머지 시스템 검증 (실제 plan-enterprise 1 회 호출로 i-dev 부트스트랩 + 페이즈 실행 + advisor 통과 + 패치노트 자동 작성 end-to-end)
- new-project-group 으로 실 그룹 1 개 등록 (data-craft 등)
- monitoring polish v2 (그래프 / 비용 분배 / 가격표 동기화)
- codex 협업 구현 (5 gate scripts + codex-packet-builder agent + plan-enterprise --codex)
- lint / build / test 게이트 재설계 논의 (§D-23)
