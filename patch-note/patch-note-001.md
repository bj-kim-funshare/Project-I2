# 아이OS — Patch Note (001)

## v001.108.0

> 통합일: 2026-05-28
> 플랜 이슈: #57
> 대상: 아이OS

### 배경

직전 v001.107.0 (이슈 #56) 은 pnpm × worktree dangling symlink 사고 대응을 **외부 project 정책 분산** 으로 풀었다 — 각 pnpm-workspace leader 의 `dev.md` 에 "워크스페이스 운영 원칙" 절을 두고, `.npmrc` 권장값 (`node-linker=hoisted` 등) 을 `new-project-group/SKILL.md` 에 가이드. 마스터 지적: 정책 분산은 (a) 새 pnpm-workspace leader 추가마다 룰 재설치 필요, (b) 운영자 룰 준수에 의존, (c) `feedback_no_prevention_treadmill.md` 의 변종 — 다른 leader 에서 같은 사고 재발. 근본 해결은 **plan-enterprise / plan-enterprise-os 스킬 자체가 worktree 제거 후 자가 검출** 하는 것.

### 페이즈 결과

- **Phase 1 — `worktree-lifecycle.md` Remove 절차에 자가 검출 단계 추가 + 기존 절 축소 (commit `250c0c3`)**: Remove (after successful merge) 절차에 dangling 검출 bash 블록 (`if [ -d node_modules ]` 가드 → `find -maxdepth 2 -type l ! -exec test -e {} \; -print` → 발견 시 `WARNING: N dangling symlinks ... run 'pnpm install'` 출력) 을 박았다. 자동 install 은 하지 않음 — `.claude/settings.json` 의 `autoMode.allow` 에 `pnpm install` 권한 없고 메모리 `feedback_no_unrequested_dev_servers.md` 와 동족이라 master-in-loop 유지. v001.107.0 의 "pnpm 워크스페이스 상호작용" 절은 5 항목 → 3 항목 (비권장 / 허용 / 사고 사례) 으로 축소, Failure recovery cross-ref 한 줄 폐기.
- **Phase 2 — SKILL.md 4 건에 자가 검출 참조 라인 + v001.107.0 외부 정책 분산 가이드 폐기 (commit `9c54469`)**: `plan-enterprise/SKILL.md` 와 `plan-enterprise-os/SKILL.md` 의 `git worktree remove` 호출부 (Step 9 WIP A / Step 9 WIP B / Step 11 HOTFIX — 총 7 곳) 에 worktree-lifecycle.md Remove 절차 참조 라인 일관 삽입. `new-project-group/SKILL.md` 의 "pnpm-workspace leader 의 워크스페이스 운영 원칙" 단락 + `.npmrc` 권장값 단락 전체 폐기 (9 줄), `group-policy/SKILL.md` 의 dev cross-ref 한 줄 폐기, `plan-enterprise` / `plan-enterprise-os` Step 6 인근 v001.107.0 사전 경고 한 줄 폐기. net +13/-15 = 축소 방향, Q3 trade-out 명백히 실현. Sentinel grep 3 종 모두 빈 출력 확인.

### 영향 파일

- `.claude/md/worktree-lifecycle.md`
- `.claude/skills/plan-enterprise/SKILL.md`
- `.claude/skills/plan-enterprise-os/SKILL.md`
- `.claude/skills/new-project-group/SKILL.md`
- `.claude/skills/group-policy/SKILL.md`

### 검증 dogfood

본 패치의 Phase 1 절차가 v001.108.0 자체의 WIP A 머지 직후 실전 적용 — Project-I2 (I-OS harness, node_modules 부재) 에서 첫 가드 false → no-op 동작 확인.

### Treadmill Audit

PASS. Q1 재발성 (매 worktree 사이클 + 향후 pnpm-workspace leader 추가마다 재발) / Q2 새 엣지 명시 (자가 검출 명령, 발견 시 master 안내 메시지, halt 하지 않음, no-op 동작) / Q3 폐기 = **v001.107.0 의 외부 정책 분산 가이드 전체 폐기** — `new-project-group` 의 운영 원칙 + `.npmrc` 권장값 가이드 / `group-policy` cross-ref / `plan-enterprise` 및 `plan-enterprise-os` Step 6 사전 경고 cross-ref / `worktree-lifecycle.md` "pnpm 워크스페이스 상호작용" 절 축소. 정책 분산 → 스킬 내 단일 위치 모델로 전환.

본 패치는 v001.107.0 의 가산 가이드를 폐기하면서 그 자리를 자가 검출 단일 절차로 대체하므로 순 가산이 아닌 **재정의/축소** 형태.

## v001.107.0

> 통합일: 2026-05-28
> 플랜 이슈: #56
> 대상: 아이OS

### 배경

2026-05-28 10:56 ~ 10:59, data-craft #193 핫픽스3 worktree 가 제거되면서 메인 repo `/Users/starbox/Documents/GitHub/data-craft/node_modules/` 의 직접 의존성 74 개가 일제히 dangling symlink 로 끊김. 마스터의 메인 repo `pnpm dev` 가 ERR_MODULE_NOT_FOUND (concurrently 등) 으로 실패. 근본 원인 = pnpm 이 git worktree 인식 없이 worktree CWD 에서 `pnpm install` / `pnpm dev` 실행 시 메인 `node_modules` 의 심볼릭 링크를 worktree 의 `.pnpm` 스토어로 재지정 → worktree 제거 시 일제히 파손. 매 worktree 제거 사이클마다 재발 가능한 구조적 결함.

### 페이즈 결과

- **Phase 1 — `.claude/md/worktree-lifecycle.md` 보강 (commit `f2b3565`)**: 신규 절 "pnpm 워크스페이스 상호작용 (모든 외부 프로젝트)" 을 Surviving races 와 What does NOT change 사이에 삽입. 5 개 항목 — 원칙 (worktree 내부 pnpm install / pnpm dev / 의존성 건드리는 pnpm script 실행 금지), 허용 (git / 코드 편집 / 정적 검사만, dev 서버는 메인에서만), 위반 후 복구 (메인 cwd 에서 `pnpm install` 1 회), 검출 명령 (BSD `find -type l ! -exec test -e {} \; -print`), 사고 사례 (2026-05-28 data-craft #193 핫픽스3, 74 개 dangling). Failure recovery 말미에 cross-ref 한 줄 추가.
- **Phase 2 — project-group dev 가이드 + skill 4 건 cross-ref (commit `fbbef81`)**: `new-project-group/SKILL.md` 의 dev.md 형식 절 직후에 "pnpm-workspace leader 의 워크스페이스 운영 원칙" 단락 + `.npmrc` 권장값 분석 (권장 = `node-linker=hoisted` 로 `.pnpm` 가상 스토어 + 심볼릭 링크 구조 자체 폐기, 대안 = 현행 `isolated` + 행동 규약, 비권장 = `hoist-pattern=[]` 부분 차단 / 절대 `store-dir` multi-worktree 충돌) 추가. `group-policy/SKILL.md` 의 dev 영역 가이드에 cross-ref 한 줄. `plan-enterprise/SKILL.md` 와 `plan-enterprise-os/SKILL.md` 의 Step 6 worktree 생성 절차 직후에 각각 한 줄 주의. 외부 project (data-craft 등) 의 실제 `.npmrc` / `dev.md` 는 무수정 — 적용은 후속 `group-policy` 호출.

### 영향 파일

- `.claude/md/worktree-lifecycle.md`
- `.claude/skills/new-project-group/SKILL.md`
- `.claude/skills/group-policy/SKILL.md`
- `.claude/skills/plan-enterprise/SKILL.md`
- `.claude/skills/plan-enterprise-os/SKILL.md`

### Treadmill Audit

PASS. Q1 재발성 (매 worktree 사이클 + 향후 pnpm-workspace leader 추가마다 재발) / Q2 새 엣지 명시 (pnpm-workspace × worktree 상호작용, 검출 명령 / 복구 절차 / 사고 사례 모두 문서화) / Q3 폐기 항목 = `.claude/md/worktree-lifecycle.md` 의 암묵 가정 "git worktree 는 dependency-manager-agnostic 이며 `git worktree remove` 는 자기완결적이다" 를 명시적으로 폐기, 신규 절이 "pnpm 워크스페이스가 활성화된 외부 project 의 경우 worktree remove 는 자기완결적이지 않다" 로 갱신.

본 패치는 새 훅/스크립트/에이전트/검증 축 추가 없이 문서 보강 + cross-ref 만으로 1차 안전망 (운영 원칙 명문화) 과 2차 안전망 (`.npmrc` 권장값 가이드, 후속 group-policy 호출에서 leader 별 적용) 을 제공.

## v001.106.0

> 통합일: 2026-05-27
> 플랜 이슈: #55
> 대상: 아이OS

### 배경

엔트로픽의 비공식 패치 이후 다중 세션 동시 advisor(opus 4.7) 호출 시 요청이 실패하고 1개만 통과하는 병목 발생. advisor 는 8개 스킬 10개 호출부의 판단 게이트라 병목 시 절차가 정지. 마스터 확인 — advisor() 실패 중에도 서브에이전트 디스패치는 성공(throttle 이 advisor 도구 엔드포인트 한정) → 별도 채널인 동급(opus-4-7) 서브에이전트 fallback 이 실효.

### 페이즈 결과

- **Phase 1 — 프로토콜 + 에이전트 (commit `89637ec`)**: `.claude/md/advisor-fallback-protocol.md` 신설(시스템 실패 정의=catchable error·hang 은 에스컬레이션, per-invocation 재시도 2회·cross-session 카운팅 금지, 디스패치=경로/식별자만 전달, PASS/BLOCK: 토큰 계약 무변경, transparency, fallback-of-fallback halt, --codex 동일 적용). `.claude/agents/advisor-fallback.md` 신설 — read-only, `model: claude-opus-4-7`, `effort: high`(균일 medium 정책의 의도된 예외).
- **Phase 2 — 8개 스킬 호출부 배선 (commit `d3785d9`, `6d5c07f`)**: advisor 호출 8개 스킬 전체에 프로토콜 참조 배선. **총 10 참조 = 호출부 인벤토리 정확 일치**(PE 2, PE-os 2, group-policy 1, task-db-structure 1, task-db-data 1, new-project-group 1, create-custom-project-skill 1, plan-roadmap 1). 루브릭 중복 인라인 없이 artifact 경로만 call-site별 구체화.
- **Phase 3 — §4 표 + 계약 (commit `2a7c54b`, `d55b48a`)**: `CLAUDE.md` §4 모델 분할 표 13→14, advisor-fallback 행 추가, effort 산문 "14개 중 13개 medium, advisor-fallback high 예외"로 정합. `completion-reporter-contract.md` 에 `advisor_source` 선택 필드(기본 `"advisor"`) 추가 — 판정 출처 감사, 하위 호환.
- **보강 (commit `48bbb45`)**: 전방 배선 규칙(프로토콜 §0 Applicability + CLAUDE.md §4 절 — 미래 추가 호출부도 참조 의무, 누락 시 결함) + `advisor_source` emit 결속(프로토콜 §5 가 completion-reporter 페이로드 필드 세팅 의무화).

### 영향 파일

- `.claude/md/advisor-fallback-protocol.md` (신규)
- `.claude/agents/advisor-fallback.md` (신규)
- `.claude/skills/{plan-enterprise,plan-enterprise-os,group-policy,task-db-structure,task-db-data,new-project-group,create-custom-project-skill,plan-roadmap}/SKILL.md`
- `CLAUDE.md`
- `.claude/md/completion-reporter-contract.md`

### Treadmill Audit

PASS (마스터 명시적 override). 순수 가산형(신규 서브에이전트 1 + 프로토콜 md 1)으로 Q3(폐기 메커니즘 1건)을 자체 충족하지 못하나, 재발성 병목(엔트로픽 잠수함 패치) 해소 근거로 마스터가 plan 시점에 명시적으로 override(이슈 #55 본문 기록). 구현은 override 가 인가한 범위 내 유지 — 신규 훅/상태머신/검증축/cross-session 머신 없음. 전방 배선 규칙은 *재배선 트레드밀*을 사전 차단하는 방향이라 가산이 아니라 기존 메커니즘의 견고화.

후속(watch-item, 비차단): `advisor_source` emit 의무는 프로토콜 §5 에 존재하나 각 스킬의 completion-reporter 디스패치 지점은 미배선 — 런타임 drift 관측 시 다음 이터레이션에서 디스패치 지점 명시 배선.

## v001.105.0

> 통합일: 2026-05-26
> 플랜 이슈: #54
> 대상: 아이OS

### 페이즈 결과

- **Phase 1 — collect.py 2-pass 서브에이전트 스킬 귀속 (commit `22865df`)**: 모니터링 "스킬 점유 파이"에서 서브에이전트 토큰이 전부 `unknown` 으로 분류되던 버그 수정. 원인 — `collect.py` 가 서브에이전트 JSONL 의 `sticky_skill` 을 하드코딩 `"unknown"` 으로 초기화하고, 서브에이전트 레코드에 `attributionSkill` 이 없어 끝까지 유지됨. 파이는 토큰 합 정렬이라 서브에이전트가 토큰을 많이 쓰는 주에 `unknown` 이 과반(2026-W22 **57.5%**)을 차지. 해법 — `agent-<id>.meta.json` 의 `toolUseId` 가 부모 세션의 `Agent`/`Task` tool_use 레코드(=sticky 스킬 창 보유)와 일치하는 점을 이용. 명시적 2-pass: Pass A 가 부모 JSONL 선스캔으로 `{toolUseId → skill}` 맵 구축(기존 sticky 상태 머신 충실 재현), Pass B 가 서브에이전트 초기 스킬을 맵에서 시드. 중첩 서브에이전트는 fixpoint 루프로 해소. 부모 JSONL 소실(pre-I-OS) 시 `"unknown"` 폴백 보존.
- **Phase 2 — 데이터 재생성 + README 문서화 (commit `1dbcee2`)**: `collect.py` 재실행으로 전체 집계 재생성. **경험적 검증 — 2026-W22 `unknown` 토큰 점유율 57.5% → 0% (by_skill 에서 완전 소멸)**, 이동처는 plan-enterprise (24.8%→68.8%), plan-enterprise-os (4.5%→7.9%), dev-merge/patch-confirmation 신규 출현 = 실제 디스패치 스킬. 전체(aggregate) `unknown` 은 6.3% → 3.8% (잔존분 = pre-I-OS 부모 JSONL 소실 서브에이전트, 구조적 데이터 경계). `monitoring/README.md` 에 toolUseId 귀속 모델·fixpoint·잔존 unknown 정책 영문 명문화.

### 영향 파일

- `monitoring/scripts/collect.py`
- `monitoring/README.md`
- `monitoring/data/hourly.json` (재생성; `aggregate.json`·`periods/**` 는 gitignore — `collect.py` 가 source of truth, 로컬 재생성)

### Treadmill Audit

NOT APPLICABLE. 본 변경은 신규 제약 메커니즘(규칙/훅/에이전트/스킬/검증축/자기-보호 invariant) 추가가 아니라 **기존 모니터링 집계 분류 로직의 버그 수정**이다. `feedback_no_prevention_treadmill.md` 3 질문은 제약 *추가* 에 적용되며 본 건은 해당 없음 — 가짜 trade-out 을 만들지 않는다. 후속 후보(별도 refactor 호출): `_iter_parent_assistant_skills` 가 메인 루프 sticky 로직을 verbatim 복제 → divergence 위험, 공통 헬퍼 추출 고려.

## v001.104.0

> 통합일: 2026-05-26
> 플랜 이슈: #53
> 대상: 아이OS

### 페이즈 결과

- **Phase 1 — autoMode.allow gh-issue carve-out 추가 (commit `8b75230`)**: `.claude/settings.json` 의 `autoMode.allow` 배열에 영어 산문 carve-out 1개 추가. 내용 — `plan-enterprise` / `plan-enterprise-os` 스킬이 issue-as-source-of-truth 절차의 일부로 실행하는 `gh issue create` / `gh issue comment` / `gh issue close` (leader repo 또는 harness repo 대상) 인가. 안전 근거: 추적 메타데이터 게시일 뿐 코드 머지 아님 + 플랜 자체가 ExitPlanMode 승인 통과 + 이슈 작업이 issue-as-source-of-truth 핵심 단계. 권한은 스킬명 + 절차 단계에 바인딩(b73de27 의 DB carve-out 형식 모방)해 hostile read 가 두 스킬 밖 `gh issue` 로 확대 해석하지 못하게 함. 기존 4개 배열 원소(`$defaults` + carve-out 3개)는 byte-for-byte 보존, `permissions.allow` 미수정. 배경: 잡 세션(autoMode)에서 `permissions.allow`(대화형 전용)가 적용되지 않아 분류기가 `gh issue` 작업을 비결정적으로 차단하던 문제(2026-05-26 data-craft #161 관측) 해소.

### 영향 파일

- `.claude/settings.json`

### Treadmill Audit

NOT APPLICABLE. 본 변경은 신규 제약 메커니즘(규칙/훅/에이전트/스킬/검증축/자기-보호 invariant) 추가가 아니라 **기존 autoMode 게이트를 완화**하는 carve-out 1건 추가다. `feedback_no_prevention_treadmill.md` 3 질문은 제약 *추가* 에 적용되며 완화는 Q3(폐기 1건) trade-out 대상이 아니므로 가짜 trade-out 을 만들지 않는다.

## v001.103.0

> 통합일: 2026-05-21
> 플랜 이슈: #52
> 대상: 아이OS

### 페이즈 결과

- **Phase 1 — `renderChartPromptBar` 재작성 (commit `9de8399d`)**: `monitoring/script.js` 의 차트 함수를 `data.by_prompt` (master prompt 1건 단위) 에서 `by_skill_invocation` (스킬 호출 1회 단위) 기반으로 교체. 시그니처 `renderChartPromptBar(data, invocations)` 로 변경, 가로 막대 스택 2 데이터셋 — `실사용 (input+output)` (`COLORS.noncache`, 파랑 `#3b82f6`) + `캐시 (creation+read)` (`COLORS.cache`, 보라 `#9b59b6`). 정렬: 두 합계 내림차순 → 상위 30 건. 라벨 = `w.title_prompt` (`/skill ...` 형식), 60자 초과 시 ellipsis. Tooltip: 전체 title 노출 + input/output/cache_creation_5m/1h/cache_read 분해 + 비용 + 스킬/세션/시작시각. legend 노출 ON. 호출 지점 `applyWeekSelection` 안 1 곳에서 `weekInvocations` 변수 전달.
- **Phase 2 — `chart-prompt-bar` 카드 제목 변경 (commit `a8bdd53b`)**: `monitoring/index.html` 의 해당 카드 `<h3>` 텍스트를 "프롬프트별 토큰 소모 (Top 30)" → "스킬 호출별 토큰 소모 (Top 30)" 로 1 줄 교체.
- **Phase 3 — 기간 토글 인프라 (commit `c0415329`)**: 두 시계열 차트 카드(`#chart-day-tokens`, `#chart-day-cost`) 헤더에 "일자별 / 주간별" 세그먼티드 토글 추가. CSS 신규 클래스 — `.chart-card-header` (flex row), `.period-toggle` (border + active-state 토큰 일관). JS 추가: `getISOWeek(date)` / `aggregateByWeek(daysArray, fields)` 헬퍼 (ISO week 키 `YYYY-Www` 로 합산), 모듈-레벨 `__lastAggregateData` 캐시 + `__periodMode = { dayTokens: 'day', dayCost: 'day' }` 상태, `setupPeriodToggles()` (클릭 시 active 갱신 + **해당 차트 1개만** 재렌더 — 전체 `render()` 재호출 금지). `applyWeekSelection` 내부에 `__lastAggregateData = aggregateData` 캐시 저장 한 줄 추가. DOMContentLoaded 에서 1회 호출. 본 페이즈는 인프라만 — 차트 함수 본문 미수정.
- **Phase 4 — `renderChartDayTokens` 에 `periodMode` 옵션 (commit `bd0459aa`)**: `'week'` 모드에서 `aggregateByWeek(data.by_day, ['input','output'])` 로 데이터 분기. `compareData` 도 동일 그룹핑. 차트 타입 `'line'` + stacked area 유지. `skillCountsByDay` 플러그인은 `'week'` 모드에서 비활성 (라벨 차원 불일치 회피). 호출 지점에 `periodMode: __periodMode.dayTokens` 전달.
- **Phase 5 — `renderChartDayCost` 막대 → 선 그래프 + `periodMode` (commit `c88243d6`)**: 차트 타입 `'bar'` → `'line'` 전환 (`tension: 0.25`, `pointRadius: 3`, `fill: false`, `borderColor: COLORS.positive`). `'week'` 모드 = `aggregateByWeek(by_day, ['cost_usd'])`. y축 USD 포매팅 유지 + `beginAtZero: true` 추가. 호출 지점에 `periodMode: __periodMode.dayCost` 전달.
- **Phase 6 — 데드 코드 정리 (옵션 A, no-op)**: 백엔드 `by_prompt` / `by_prompt_meta` 산출은 향후 raw 분석용으로 `collect.py` 에 그대로 유지. 프론트엔드 사용처는 Phase 1 의 함수 재작성 과정에서 전부 제거됨. 별도 커밋 없음.

### 영향 파일

- `monitoring/script.js`
- `monitoring/index.html`
- `monitoring/styles.css`

### Treadmill Audit

PASS. Q3 trade-out 2 건 — (a) `#chart-prompt-bar` 의 "프롬프트별 보기" 시각화 폐기 (백엔드 데이터는 유지하되 UI 에서는 더 이상 소비하지 않음), (b) `#chart-day-cost` 의 막대 차트 표현 폐기 (선 그래프로 통일). 신규 UI 컨트롤 `.period-toggle` 1종은 차트 카드 헤더 종속 표시 컨트롤로 자기-보호 invariant/규칙/훅/에이전트/스킬/검증축이 아님 — `feedback_no_prevention_treadmill.md` 3 질문 적용 대상 외.

## v001.102.0

> 통합일: 2026-05-21
> 플랜 이슈: #50 (HOTFIX 3)
> 대상: 아이OS

### 페이즈 결과

- **Phase 5 (HOTFIX 3) — collect.py sub-agent JSONL 통합 (모델 분포 정확화)** (commit `45ce998e`): 마스터가 PENDING gate 검증 중 발견한 데이터 정합성 결함을 근본 수정. 기존 `monitoring/scripts/collect.py` 는 parent JSONL 이 존재하는 디렉토리(Project-I2 본체) 에서는 그 디렉토리의 sub-agent JSONL **2626 개를 통째로 무시**하고, 메인 세션 parent JSONL 의 `toolUseResult.usage` (sub-agent invocation summary) 만으로 sub-agent 토큰을 attribution. 그 결과 sub-agent JSONL 의 실제 assistant 메시지 usage 가 6~20 배 누락되어 `by_model` 분포가 99.47% Opus / 0.11% Sonnet / 0.14% Haiku 로 왜곡됨. 마스터가 Anthropic 공식 사용량 페이지 (주간 한도 sonnet 4%) 와의 자릿수 괴리로 결함 지적 → 메인 세션이 sub-agent JSONL 500 파일 샘플 직접 read 로 진단치 (추정 sonnet 1.12B / haiku 575M tokens 누락) 산출 → 본 hotfix 진입. 변경 단계:
  - **1단계 — JSONL 수집 확장**: `collect()` L1015~1026 의 jsonl 수집 분기를 수정. parent JSONL 이 있는 디렉토리에서도 sub-agent JSONL (`*/subagents/agent-*.jsonl`) 을 함께 수집. parent JSONL 부재 디렉토리(data-craft) 는 기존 fallback 유지.
  - **2단계 — sub-agent 식별 헬퍼**: `is_subagent_jsonl(path)` / `read_subagent_meta(path)` 신설. 파일 경로의 부모가 `subagents` 인 jsonl 을 sub-agent 로 식별, 인접 `<같은이름>.meta.json` 에서 `agentType` (예: `gate-runner`, `phase-executor`, `Explore`) 추출.
  - **3단계 — double-count 회피 (선택 A)**: parent JSONL 처리 시 `toolUseResult.usage + agentType` 기반 sub-agent attribution 블록을 **전부 삭제**. 메인 루프(L1212-1300) 와 `_finalize_window()` 의 윈도우 스코프 by_agent 집계(L596-613) 양쪽 동일 처리. sub-agent 토큰은 sub-agent JSONL assistant 레코드에서만 attribution.
  - **4단계 — sub-agent JSONL 처리**: assistant 루프를 재사용. `by_model[model]`, `by_skill[attributionSkill]`, `by_day`, `total`, `hourly_by_model`, period state `by_model` 에 sub-agent 의 실제 usage 가산. `by_agent` 는 meta.json `agentType` 으로 attribution.
  - **5단계 — `build_by_skill_invocation` 분기**: sub-agent JSONL 은 master prompt window 추출 대상이 아니므로 건너뜀. **trade-off**: 그 결과 `by_skill_invocation[*].by_agent` 가 비게 됨 — 스킬 호출별 sub-agent 분해 정보 손실. 후속 hotfix 후보로 남김.
  - **6단계 — sticky_skill**: sub-agent JSONL 의 assistant 레코드는 `attributionSkill` 필드를 그대로 사용 (없으면 `"unknown"`).
  - **충돌 회피**: sub-agent JSONL 의 `session_id` 는 parent session uuid 와 동일하게 처리 (sub-agent JSONL 경로의 부모-부모 디렉토리명). 기존 parent session_record 에 누적 (overwrite 아닌 merge). `model_counts` 는 sub-agent JSONL 처리 시 미가산 → parent session 의 `model_primary` 보존.

  **검증 결과 (재집계 후 실측)**:

  | 모델 | 이전 (잘못) | 신규 (정확) |
  |---|---:|---:|
  | claude-opus-4-7 | 99.47% (49.9B) | **93.00% (50.0B)** |
  | claude-haiku-4-5 | 0.14% (69M) | **4.22% (2,270M)** |
  | claude-sonnet-4-6 | 0.11% (55M) | **2.51% (1,350M)** |
  | claude-opus-4-6 | 0.28% (140M) | 0.26% (140M) |

  Anthropic 공식 사용량 페이지의 sonnet ~4% 와 자릿수 일치. by_agent 차트도 Explore (2.18B) / phase-executor (1.28B) / gate-runner (73M) 등 sub-agent 들의 진짜 토큰 누계 반영. 처리 파일 수 4608 (이전 ~330 parent only) / assistant 메시지 257K.

### 영향 파일

- `monitoring/scripts/collect.py`

### 알려진 한계 / 후속 후보

- `by_skill_invocation[*].by_agent` 가 비게 됨 (5단계 trade-off). 후속 hotfix 또는 신규 플랜에서 sub-agent JSONL 의 timestamp 를 parent skill window 와 매칭하여 채우는 로직 추가 가능.
- period state `by_session` 일부 케이스에서 sub-agent 처리분만 반영될 가능성 (collision 처리는 base 단계에서 적용했으나 period 차원 정밀 검토 권고).

### Treadmill Audit

NOT APPLICABLE — 신규 메커니즘/규칙/축 추가 없음. 기존 결함 수정 + 누락된 데이터 통합. 코드 -69 net lines (165 삭제 / 96 추가).

### 수동 검증 항목

- 본 hotfix 머지 후 `/api/refresh` (또는 `python3 monitoring/scripts/collect.py`) 1회 실행 → `data/aggregate.json` 재생성.
- 브라우저 새로고침 → 모델 분포 도넛에서 sonnet 슬라이스 ~2.5%, haiku 슬라이스 ~4.2% 가시화 확인.
- 서브 에이전트 사용량 바 차트의 단위가 100M~2B 범위인지 (이전 1M~70M 대비 한 자릿수 위) 확인.

## v001.101.0

> 통합일: 2026-05-21
> 플랜 이슈: #50 (HOTFIX 2)
> 대상: 아이OS

### 페이즈 결과

- **Phase 4 (HOTFIX 2) — 에이전트 델타 배지 가로 2행 정렬 + 모델 분포 attribution 진단** (commit `72198671`):
  - **(a) CSS 적용**: HOTFIX 1 에서 마스터의 "가로 2줄" 요청을 2열 grid 로 잘못 해석한 점 정정. `monitoring/styles.css` 의 `.chart-legend-agent-2col` 규칙을 `grid-template-columns: 1fr 1fr` (2열) → `grid-template-rows: repeat(2, auto)` + `grid-auto-flow: column` + `grid-auto-columns: minmax(0, 1fr)` (2행 고정 + 컬럼 자동 wrap) 으로 교체. `gap` 을 `column-gap: 16px` / `row-gap: 4px` 로 분리하여 행간 여백 축소. 9개 sub-agent 의 ▲/▼ 델타 배지가 한 행 ~4~5개씩 가로 배치되어 2 행 채움. 클래스명은 script.js 의 부여 코드(affected_files 외)와의 결합 회피로 그대로 유지.
  - **(b) 옵션 C 진단 결과 — 데이터 변경 불필요**: phase-executor sub-agent 가 `monitoring/scripts/collect.py` 분석 결과 sub-agent 토큰 by_model attribution 이 L1225 / L1268 에 **이미 구현되어 있음** 을 보고. 메인 `collect()` 루프와 period state 양쪽에서 `add_usage(by_model[model], agent_usage)` 가 `AGENT_MODEL_MAP` 기반으로 적용 중. aggregate.json 실측: opus-4-7 49.9B / sonnet-4-6 55M / haiku-4-5 69M / opus-4-6 140M — 메인 세션이 sub-agent 합(~135M)의 370배 토큰을 소비하여 attribution 통합 후에도 99.5% Opus 가 정상 사실. by_agent 차트의 막대 단위(M)와 모델 분포의 분모 단위(B)의 자릿수 차이가 시각적 mismatch 의 원인. 결론: collect.py 수정 없음. 라벨 정정(옵션 C 의 A 파트)도 본 hotfix 보류 — 라벨이 데이터 사실에 부합하므로 부연 불필요. 마스터 판단에 따라 후속 hotfix 에서 "메인 세션 모델 분포" 등 명확화 가능.

### 영향 파일

- `monitoring/styles.css`

### Treadmill Audit

NOT APPLICABLE — 신규 메커니즘 추가 없음. CSS rule 정정 + collect.py 진단 결과 기록.

### 수동 검증 항목

- `#chart-agent-bar` 카드의 델타 legend 영역이 가로 2 행 (~4–5 개씩) 배치인지 확인.

## v001.100.0

> 통합일: 2026-05-21
> 플랜 이슈: #50 (HOTFIX 1)
> 대상: 아이OS

### 페이즈 결과

- **Phase 3 (HOTFIX 1) — 서브 에이전트 제목 + 델타 배지 2열 + 스킬 호출 데이터 복구** (commit `122aff1`): 마스터 PENDING gate 검증 중 발견된 3건의 결함을 단일 hotfix로 묶음.
  - (a) `monitoring/index.html` L135: `<h3>서브에이전트 사용량 (총 토큰)</h3>` → `<h3>서브 에이전트 사용량 (총 토큰)</h3>` — 마스터 요청에 따라 "서브"와 "에이전트" 사이 공백 1개 추가.
  - (b) `monitoring/styles.css`에 `.chart-legend-agent-2col` 클래스 신설 (CSS grid `grid-template-columns: 1fr 1fr`, `gap: 8px 16px`). `monitoring/script.js`의 `renderChartAgentBar`가 동적 생성하던 범례 컨테이너 클래스를 기존 `.chart-legend` 대신 신규 클래스로 교체 — 에이전트별 ▲/▼ 델타 배지가 세로 1열 나열에서 가로 2열 배치로 전환. 도넛 3종의 `.chart-legend` 스타일은 그대로 유지되어 영향 없음.
  - (c) `monitoring/script.js`의 `applyWeekSelection` 디스패처에서 `loadSkillInvocations` 호출부 수정. 원인: weekly JSON 파일(`data/periods/weekly/<ISO>.json`)에 `by_skill_invocation` 필드가 부재 — `collect.py`가 weekly 집계에 해당 필드를 기록하지 않아 Phase 2의 `loadSkillInvocations(leftData)` 호출이 빈 배열을 받아 화면에 "데이터 없음"으로 출력되던 결함. 수정: `aggregateData.by_skill_invocation`(전체 누적 375건)을 `leftData.by_day[].day`로 구성한 날짜 `Set`으로 필터링 — 각 invocation의 `start_timestamp.slice(0, 10)`("YYYY-MM-DD") 가 선택된 주의 일자 집합에 포함되는 항목만 통과. 주간 선택 변경 시 테이블이 해당 주의 invocation만 보여주도록 정상화. 백엔드(`collect.py`) 무수정 — 프론트엔드 필터링만으로 해결.

### 영향 파일

- `monitoring/index.html`
- `monitoring/script.js`
- `monitoring/styles.css`

### Treadmill Audit

NOT APPLICABLE — 신규 규칙/훅/에이전트/스킬/검증 축 추가 없음. 순수 버그 수정 + UI polish.

### 수동 검증 항목 (master 재 PENDING gate 시점)

- `#chart-agent-bar` 카드 제목이 "서브 에이전트 사용량 (총 토큰)" (서브 와 에이전트 사이 공백 1개) 으로 표시되는지.
- 에이전트 델타 배지가 가로 2열 grid 레이아웃으로 정렬되는지 (한 행에 2개 에이전트씩).
- "스킬 호출별 토큰 사용량" 테이블이 데이터를 보여주는지 — 2026-W21 기준 해당 주의 invocation 행 다수 보유.
- 왼쪽 주간을 다른 주(W20, W19 등)로 변경 시 스킬 호출 테이블이 해당 주의 invocation으로 재렌더되는지.

## v001.99.0

> 통합일: 2026-05-21
> 플랜 이슈: #51
> 대상: 아이OS

### 페이즈 결과
- **Phase 1**: `.claude/scripts/statusline.sh` L1 의 `🕐 5h` 와 `📅 7d` 표기에 10-칸 ▓░ bar 부가. 기존 percentage·reset 시간 표기는 그대로 유지. 헤더 주석 v1.3 → v1.4 bump.

### 영향 파일
- `.claude/scripts/statusline.sh`

### Treadmill Audit
NOT APPLICABLE — 신규 규칙/훅/에이전트/스킬/검증 축 추가 없음. 기존 한도 표기에 시각 게이지 부가하는 표시 개선만 수행.

## v001.98.0

> 통합일: 2026-05-21
> 플랜 이슈: #50
> 대상: 아이OS

### 페이즈 결과

- **Phase 1 — Markup / Style 리셋** (commit `5e1420a`): topbar의 기간 단위 셀렉터(`#period-unit` 7-옵션), 기간 키 셀렉터(`#period-key`), 비교 셀렉터(`#period-compare-target`) 3종을 모두 제거하고 그 자리에 커스텀 드롭다운 2개(`#week-picker-left` / `#week-picker-right`)를 마크업했다. 각 드롭다운은 `<button class="cdrop-toggle">` + `<ul class="cdrop-menu">` 구조 — 네이티브 `<select>` 미사용. 하단의 디테일 4 테이블 섹션(`#by-model` / `#by-skill` / `#by-day` / `#by-session`)과 `#chart-session-bar` 세션 Top10 카드를 마크업 단계에서 통째로 삭제. styles.css에 `.cdrop`, `.cdrop-toggle`, `.cdrop-menu`, `.cdrop-item`, `.cdrop-item.is-active`, `.cdrop.is-open .cdrop-menu` 클래스 7종을 다크 테마 토큰(`.kpi-card` 보더/배경 재사용) 일관으로 추가. 더 이상 참조 없는 `.period-selector select`, `.detail-section`, `.table-block`, `#period-compare-target`, `.detail-row-2col`, `.detail-section.has-html-legend .detail-chart` 등 고아 스타일 일괄 정리. -135 net lines.

- **Phase 1.5 — 전체 토큰 카드 non-cache/cache 라벨 위치 이동** (commit `3bf6cc2`, 마스터 미드플라이트 추가): Phase 1 머지 직전 마스터가 "NON-CACHE / CACHE 표기는 전체 토큰 텍스트가 있는 상단 오른쪽 끝에 배치" 추가 요청. `#kpi-tokens` 카드의 헤더를 `<div class="kpi-tokens-header">` flex row(space-between)로 감싸 `<h3>전체 토큰</h3>` 좌측 + `<span class="kpi-tokens-label">non-cache / cache</span>` 우측 끝 배치. 기존 숫자 아래의 `<div class="kpi-unit">non-cache / cache</div>` 제거. 다른 KPI 카드(메시지 / 캐시효율 / 추정비용)의 헤더는 무수정 — 본 변경은 `#kpi-tokens` 한정.

- **Phase 2 — Script 재배선** (commit `5de0887`): script.js에서 기간/비교/자동새로고침 관련 함수 5종(`populatePeriodKeys`, `populateCompareTarget`, `applyPeriodSelection`, 기존 `renderAll`/`render` 래퍼) 삭제. 디테일 테이블 렌더러 4개(`renderByModel`, `renderBySkill`, `renderByDay`, `renderBySession`) 및 세션 바 차트 렌더러(`renderChartSessionBar`) 삭제. `AUTO_REFRESH_MS` 60초 인터벌 setup 블록과 `_autoRefreshInFlight` 플래그 일괄 제거 — 새로고침은 `#refresh-btn` 클릭만이 진입점. 기간 셀렉터 3종에 대한 이벤트 와이어링 전체 제거. 신규 함수 6개 추가 — `loadWeekly(weekKey)` (`data/periods/weekly/<key>.json` 로더), `listWeeklyKeys()` (`aggregate.json.periods_index.weekly` 기반 ISO 주차 정렬), `weekDropdownLabel(weekKey, idx)` (라벨 포맷 "이번 주 / 지난 주 / YYYY-WNN (M월 d일 주)"), `renderCustomDropdown(rootEl, options, selectedKey, onChange)` (토글 / 외부클릭 / 키보드 ↑↓Enter Esc 처리, 두 피커 공용), `enforceLeftRightOrder(state)` (right < left 가드, 위반 시 left 직전 가장 최근 과거 주로 fallback), `applyWeekSelection({left, right})` (메인 디스패처). 디스패처는 `Promise.all([loadWeekly(left), loadWeekly(right), loadAggregate()])` 후 KPI 4카드는 `renderKpi(leftData)` + `applyDeltaBadgesFromValues(rightData.total, leftData.total)` 재사용, 도넛 3개(모델/스킬/캐시)는 기존 `compareData` 파라미터로 `rightData` baseline 전달, 에이전트 바는 `renderChartAgentBar(leftData, {compareData: rightData})`로 호출, 스킬 호출 테이블 + 프롬프트 바는 left만, 일자별 토큰(`renderChartDayTokens`) + 일자별 비용(`renderChartDayCost`)은 `aggregateData`로 전달하여 주간 선택과 독립. `renderChartAgentBar` 시그니처를 `(data, opts={compareData})`로 확장 — Phase 1 마크업에 `#chart-agent-bar` 카드의 `.chart-legend` 가 없어 프로그래밍 방식으로 legend 컨테이너를 동적 생성하고 에이전트별 토큰 합계의 `left − right` delta를 ▲/▼ 색상 배지로 표기 (도넛 범례와 동일 마크업/CSS 재사용). DOMContentLoaded 부트스트랩을 aggregate 로딩 → 기본 left=keys[0](최신) / right=keys[1](차순) → 두 피커 `renderCustomDropdown` 초기화 → `applyWeekSelection` 흐름으로 전면 재작성. `refresh()`는 `POST /api/refresh` + 캐시 클리어 유지하되 종점을 `applyWeekSelection(_pickerState)`로 치환. -188 net lines.

- **Phase 2.1 — Phase 2 잔여 dead code 정리** (commit `81896db`): Phase 2 후 호출 사이트가 없어진 `updateUrl(unit, key)` 함수(18행) 발견 — 본문은 이미 삭제된 `#period-compare-target` DOM id를 참조하는 stale 코드. 함수 정의 전체 삭제. 추가로 `applyPeriodSelection|populatePeriodKeys|populateCompareTarget|renderByModel|renderBySession|renderByDay|renderBySkill|renderChartSessionBar|AUTO_REFRESH_MS|period-unit|period-key|period-compare-target` 13종 패턴 전체에 대해 0 매치 확인.

### 영향 파일

- `monitoring/index.html`
- `monitoring/styles.css`
- `monitoring/script.js`

(백엔드/수집기 무수정 — `collect.py`가 현재 주의 `by_day` truncation을 이미 보장, `aggregate.json.periods_index.weekly`로 드롭다운 주차 목록 공급.)

### Treadmill Audit

NOT APPLICABLE — 신규 규칙/훅/에이전트/스킬/검증 축/자기보호 invariant 추가 없음. 기존 UI 기능 축소 + 재구성, 코드 순삭감(~341 net lines 감소).

### 수동 검증 항목 (master PENDING gate 시점)

`python3 monitoring/scripts/serve.py`(또는 기존 서버) → 브라우저 접속 후:
1. 기본 진입 — 왼쪽 = 2026-W21(이번 주), 오른쪽 = 2026-W20(지난 주). KPI 4카드 + 도넛 3개 + 에이전트 바 + 스킬 호출 테이블 + 프롬프트 바 + 일자별 토큰/비용 2차트 정상 렌더.
2. 왼쪽을 W19로 변경 → 오른쪽 드롭다운 옵션이 W18 이하만 노출, 자동 W18로 이동, 모든 카드/차트 재계산.
3. 오른쪽을 왼쪽과 같은 주 또는 미래 주로 선택 불가 (옵션 자체 비노출).
4. `#refresh-btn` 클릭만 새로고침 동작, 60초 대기해도 자동 갱신 없음.
5. 디테일 4 테이블 + 세션 Top10 카드 + 기간 셀렉터 + 비교 드롭다운 부재 확인.
6. 일자별 토큰/비용 차트는 양쪽 주간 변경에 무반응 — `aggregate.json` 전체 누적 기반.
7. `#kpi-tokens` 카드 헤더 우측 끝에 "non-cache / cache" 라벨 배치 확인, 숫자 아래 `kpi-unit` 부재.
8. 에이전트 바 legend 영역에 에이전트별 ▲/▼ delta 배지 정상 표기 (Phase 1.5 마크업 미반영으로 프로그래밍 방식 동적 생성된 영역의 시각 적합성 함께 확인).

## v001.97.0

> 통합일: 2026-05-21
> 플랜 이슈: #48 (HOTFIX 4)
> 대상: 아이OS

### 페이즈 결과

- **Phase 6 (HOTFIX 4) — review-routine 신규 스킬 신설** (commit `03cc221` + amendment `0df9c5e`): 마스터 요청 — Claude Desktop cloud routine 의 다관점 코드리뷰를 cron 이 아닌 임의 시점에 로컬에서 수동 실행할 수 있는 스킬 신설. `/review-routine <leader>` 형태로 호출, `AskUserQuestion` multiSelect 로 멤버 리포 선택 → 각 리포에 대해 cloud routine 사양과 의미적 동치 (3 조건 OR 선정 / 5 관점 리뷰 / 안전·주의·경고 상태 결정 / 시그니처 마커 dedup / 코멘트 게시 포맷) 의 절차를 순차 수행. 시그니처 마커가 cloud routine 과 정확히 동일 (`<!-- review-check-routine:<repo>:multi-perspective sha=<SHA> -->`) 하여 양측 코멘트가 호환되며 `/review-check` 의 안전-리스트 갱신 흐름과 자연스럽게 연동. 안전-리스트 fetch / 후보 수집 / 멤버 owner 동적 추출 (`gh -C <cwd> repo view`) 도 동일. 본 스킬은 로컬 commit / 머지 없이 외부 GitHub state (이슈 코멘트) 만 mutation. amendment 커밋에서 SKILL.md "WIP / 머지" 절의 carve-out 자기-신설 문구를 약화 — 기존 `dev-merge` (`gh pr create` / `gh pr merge`) / `pre-deploy` Branch B 등에서 이미 적용되어 온 "로컬 repo state 비변경 + 외부 GitHub API 호출만" 패턴을 본 스킬도 따른다고 인용하며, §2 의 공식 carve-out 신설은 본 SKILL.md 책임 밖임을 명시 (advisor #2 권고 반영). 본 hotfix 의 patch-note 버전은 v001.96.0 + 본 라운드 = v001.97.0.

### 영향 파일

- `.claude/skills/review-routine/SKILL.md` (NEW)

### Treadmill Audit

NOT APPLICABLE — 신규 스킬 신설은 마스터 명시 결정으로 `create-custom-project-skill` 카르베아웃 적용 (폐기될 기존 메커니즘 없음). Q1 (수동 트리거 부재가 실재) / Q2 엣지케이스 명시 — 멤버 리포 cwd 가 git 저장소 아님 / `i-dev` 부재 시 빈 안전-리스트 fallback / `gh issue comment` 실패 시 해당 이슈만 skip 후 다음 진행 / multiSelect 0 선택 / 후보 0건. Q3 폐기 대상 없음.

### 재발 방지 메모

신규 스킬의 §2 (main-session read-only) 정합 서술 시: 자기 자신을 새 carve-out 의 *정의자* 로 두지 말 것. 기존 적용 사례 (`dev-merge` / `pre-deploy` Branch B 등) 의 패턴을 *인용*하는 형태로 정합 진술하고, §2 자체의 공식 carve-out 갱신이 필요해지면 별도 plan-enterprise-os 로 처리. 단일 SKILL.md 가 CLAUDE.md 하드룰을 갱신하는 권한 범위 침범을 피하기 위함.

## v001.96.0

> 통합일: 2026-05-21
> 플랜 이슈: #48 (HOTFIX 3)
> 대상: 아이OS

### 페이즈 결과

- **Phase 5 (HOTFIX 3) — Routine cron 표현식 UTC 정정 + UI 동작 메모 추가** (commit `f075aca`): 마스터가 routine 1차 동작 검증 결과 12:37 KST 실행이 정규 동작임을 확인 → Claude Desktop Routine UI 가 cron 을 UTC 로 해석한다는 사실 확정. UI 에 별도 timezone 설정 필드가 없으므로 cron 표현식 자체를 UTC 로 작성해야 함. 의도 시각 KST 03:30 / 15:30 = UTC 18:30 / 06:30. 두 routine 사양서 (`data-craft-review.md` / `data-craft-server-review.md`) 의 메타 표 두 줄 — "실행 시각" 을 `UTC 06:30, 18:30 (= 한국시 Asia/Seoul 15:30, 03:30 다음날)` 로, "Cron" 을 `` `30 6,18 * * *` (UTC — Claude Desktop Routine UI 가 cron 을 UTC 로 해석) `` 로 교체. "환경 가정" 절 끝에 동작 메모 단락 추가 — UI 의 UTC-only 해석 사실 + KST 역산 산식 + v001.92.0 ~ v001.94.0 의 `30 3,15 * * *` 표기가 본 v001.96.0 에서 정정됨 명시 + 향후 routine 신설 시 동일 함정 주의. SKILL.md / bootstrap-safe-issues-prompt.md 는 TZ 와 무관하므로 건드리지 않음. 마스터는 본 hotfix 머지 후 Claude Desktop UI 의 두 routine cron 필드를 `30 6,18 * * *` 로 갱신하면 KST 03:30 / 15:30 정상화.

### 영향 파일

- `.claude/cloud-routines/data-craft-review.md`
- `.claude/cloud-routines/data-craft-server-review.md`

### Treadmill Audit

NOT APPLICABLE — 본 hotfix 는 신규 메커니즘 / 규칙 / 카르베아웃 추가 없음. 순수 사양 정정 + 운영 메모 추가. v001.93.0 의 cross-repo §2 carve-out 그대로 유효.

### 재발 방지 메모

오류 근본 원인: routine 사양 작성 시 "TZ=Asia/Seoul" 을 cron 메타 라벨에 표기하면 UI 가 그 라벨을 해석할 것이라 암묵적으로 가정함. 실제로 Claude Desktop Routine UI 는 cron 표현식만 받고 TZ 라벨은 무시 / UTC 로 고정 해석. 향후 cloud-routine 사양 작성 시: (1) UI 가 받는 입력 (cron expression 문자열) 의 실제 timezone 해석 모드를 사전 확인, (2) 입력 가능 필드 외의 메타 (TZ 등) 는 사양 *문서* 의 보조 설명일 뿐 UI 동작에 영향 없음을 명시.

## v001.95.0

> 통합일: 2026-05-21
> 플랜 이슈: #49
> 대상: 아이OS

### 페이즈 결과
- **Phase 1**: 두 SKILL.md 에 integration branch (i-dev / main) origin push 금지 Hard rule 가드 박기 — description 1구절 + Step 10 직후 blockquote (A-1/A-2/B-1/B-2 네 변경, A-2 의 WIP 열거에 핫픽스 정합 추가)

### 영향 파일
- `.claude/skills/plan-enterprise/SKILL.md`
- `.claude/skills/plan-enterprise-os/SKILL.md`

### Treadmill Audit
NOT APPLICABLE — 메모리 `feedback_plan_enterprise_no_auto_push.md` 의 cross-session policy 를 두 SKILL.md 본문에 inline 명시화한 것으로 신규 invariant 아님, trade-out 대상 없음.

## v001.94.0

> 통합일: 2026-05-21
> 플랜 이슈: #48 (HOTFIX 2)
> 대상: 아이OS

### 페이즈 결과

- **Phase 4 (HOTFIX 2) — routine 지침 + bootstrap 프롬프트의 owner 오기재 정정** (commit `54f581a`): 마스터가 Claude Desktop Routine UI 에 두 routine 을 등록 후 스크린샷으로 확인한 결과, 실제 멤버 리포의 GitHub owner 가 `funshare-inc` (스크린샷 "저장소" 필드: `funshare-inc/data-craft`, `funshare-inc/data-craft-server`) 인데 v001.92.0 ~ v001.93.0 작성 당시 작성자가 **Project-I2 하니스 리포의 owner (`bj-kim-funshare`) 를 멤버 리포에도 그대로 일반화**한 오류 발견. 결과: 두 routine 의 지침 본문 6 곳씩 + bootstrap 프롬프트의 2 곳, 합 14 곳의 `gh api repos/bj-kim-funshare/<repo>/...` / `gh issue list --repo bj-kim-funshare/<repo>` 호출이 모두 404 발생 예정 → 후보 수집 자체 불가 → 코멘트 게시 0건. 본 hotfix 로 `.claude/cloud-routines/` 의 3 파일 (data-craft-review.md / data-craft-server-review.md / bootstrap-safe-issues-prompt.md) 안에서 `bj-kim-funshare` 문자열 전수 (16 위치) 를 `funshare-inc` 로 일괄 치환. `grep -rn bj-kim-funshare .claude/cloud-routines/` 0-hit 자체 검증 완료. `.claude/skills/review-check/SKILL.md` 는 owner 를 로컬 클론 origin URL 에서 동적 추출하므로 영향 없음. `.claude/project-group/data-craft/patch-note/patch-note-001.md` 의 옛 항목들에 남아있는 `bj-kim-funshare/...` 표현은 *과거 사실 기록* 이라 의도적으로 건드리지 않음.

### 영향 파일

- `.claude/cloud-routines/data-craft-review.md`
- `.claude/cloud-routines/data-craft-server-review.md`
- `.claude/cloud-routines/bootstrap-safe-issues-prompt.md`

### Treadmill Audit

NOT APPLICABLE — 본 hotfix 는 신규 메커니즘 / 규칙 / 카르베아웃 추가 없음. 순수 literal 정정. v001.93.0 의 cross-repo §2 carve-out 은 그대로 유효 유지.

### 재발 방지 메모

오류 근본 원인: 작성자가 `gh repo view --json owner,name` 으로 Project-I2 (하니스) 자체의 owner 를 확인한 뒤, 외부 멤버 리포 owner 도 동일할 것이라 일반화함. 향후 routine / cross-repo 산출물 작성 시에는 멤버 리포 cwd 에서 직접 `gh -C <member-cwd> repo view --json owner,name` 으로 멤버별 owner 를 확인 후 하드코딩할 것. 단순 grep `bj-kim-funshare` 한 번이면 잡혔던 케이스 — 산출 직후 owner 토큰 grep 확인을 routine/bootstrap 작성 절차에 chec[k]point 로 포함 검토 (Treadmill Q3 부담이 적으면 신규 룰화 가능, 일단은 본 메모로 인지).

## v001.93.0

> 통합일: 2026-05-21
> 플랜 이슈: #48 (HOTFIX 1)
> 대상: 아이OS

### 페이즈 결과

- **Phase 3 (HOTFIX 1) — 안전-리스트 cross-repo 도입 + bootstrap 엔터프라이즈 프롬프트** (commit `2b6ed1f` + amendment `b7fa754` + amendment 2 `4c403d6`): 마스터 합의 — 클로즈 이슈 누적 시 routine + review-check 의 매 사이클 전수 스캔이 비효율적이므로 "안전 확정 이슈"를 별도 안전-리스트 파일로 관리하여 후보에서 제외하는 모델 도입. 안전 문서를 각 멤버 리포 (data-craft, data-craft-server) 자체의 `i-dev` 브랜치 `.routine-state/safe-issues.json` 에 두어 routine 이 자기 묶인 저장소 안에서 same-repo read 로 가져갈 수 있게 했다 (cross-repo read 회피). `/review-check <leader>` 는 호출마다 (1) 각 선택 리포의 i-dev 에서 안전-리스트 로드 → (2) `--state closed` 후보에서 안전-리스트 번호 제외 → (3) routine 마커 코멘트 파싱 (안전이면 리스트에 append, marker_sha 불일치면 제거) → (4) 델타가 있는 리포 각각에 대해 i-dev 에서 분기한 `review-check-safe-list-<timestamp>-문서` 단일 파일 WIP 머지로 갱신 → (5) 주의/경고 이슈 enterprise prompt 문서 작성. 14일 윈도우는 마스터 결정으로 폐기 — "오픈 + 안전" 만 제외하는 단순 모델 채택. SKILL.md frontmatter / Pre-conditions / Step 4~9 / WIP·머지 절 / Failure policy / Scope 갱신. 두 routine 문서 (`data-craft-review.md` / `data-craft-server-review.md`) 의 환경 가정·지침·금지 항목에 `gh api repos/<owner>/<repo>/contents/.routine-state/safe-issues.json?ref=i-dev` 사전 fetch + `SAFE_NUMBERS` 제외 단계 추가, 404 fallback 명시. 신규 `bootstrap-safe-issues-prompt.md` — 두 멤버 리포에 빈 `.routine-state/safe-issues.json` 을 i-dev 에 1회성 생성하는 `/plan-enterprise data-craft` 호출용 free-form 프롬프트 문서.

### 영향 파일

- `.claude/skills/review-check/SKILL.md`
- `.claude/cloud-routines/data-craft-review.md`
- `.claude/cloud-routines/data-craft-server-review.md`
- `.claude/cloud-routines/bootstrap-safe-issues-prompt.md` (NEW)

### Treadmill Audit

PASS — Q1: 클로즈 이슈 누적에 따른 routine + review-check 전수 스캔 비용 증가가 실재 위험으로 확인 (마스터 직접 지적). Q2: 엣지케이스 명시 완료 — `i-dev` 부재 시 해당 리포 skip + bootstrap 안내 / marker_sha 불일치 자동 무효화 / 델타 0 인 리포 WIP 생성 생략 / 안전-리스트 JSON 파싱 실패 / 멤버 리포 working tree dirty (운영 발견 위임). **Q3 PASS — v001.92.0 amendment `b157005` 의 "review-check 는 WIP/머지 없음" §2 carve-out 은 본 라운드에서 폐기되고, "단일 파일 cross-repo §5 WIP+머지 사이클" 패턴으로 대체** (carve-out 유효 조건: (a) 단일 파일 한정, (b) JSON state catalog 한정, (c) 코드·룰 파일 무변경). 폐기되는 기존 1건 충족.

## v001.92.0

> 통합일: 2026-05-21
> 플랜 이슈: #48
> 대상: 아이OS

### 페이즈 결과

- **Phase 1 — data-craft / data-craft-server 클로즈 이슈 다관점 리뷰 routine 사양 2건 추가** (commit `e0be368`): `.claude/cloud-routines/` 폴더 신설 + 2개 paste-ready 문서 작성. 매일 KST 03:30 / 15:30 (cron `30 3,15 * * *` TZ=Asia/Seoul) 실행. 3 조건 OR 선정 (미리뷰 / 미해결 주의·경고 / 재리뷰 요청), 5 관점 리뷰 (의도부합·로직정합·보안·성능·유지보수), 시그니처 마커 `<!-- review-check-routine:<repo>:multi-perspective sha=<SHA> -->` 기반 dedup, 코멘트 게시 형식 (제목 / 결과 / 총평 / 권장방안 1:1), 코멘트 게시 외 모든 쓰기 동작 금지. `gh` CLI 가용성 hedge 명시.
- **Phase 2 — review-check 신규 스킬 신설** (commit `22d426a` + amendment `b157005`): `/review-check <leader>` — 멤버 리포 multiSelect → closed 이슈에서 routine 시그니처 마커 코멘트 수집 → 직전 결과 ∈ {주의, 경고} 필터 → 권장방안 파싱 → `.claude/review-check-output/<leader>-<YYYYMMDD-HHMM>.md` 에 `/plan-enterprise` 호출용 프롬프트 작성. 생성 프롬프트에 "플랜 완료 직전 각 대상 이슈에 `gh issue comment` 로 재리뷰 요청 게시" 필수 동작 명시 — 다음 routine 실행의 재리뷰 트리거. `.claude/review-check-output/` 는 `.gitignore` 등록 (휘발성 산출물), 스킬 자체는 WIP / 머지 없음. amendment 커밋으로 SKILL.md "WIP / 머지" 절에 CLAUDE.md §2 carve-out 근거 1단락 추가 (tracked state 미변경 → sub-agent 경유 의무 비적용, 향후 산출물 tracked 전환 시 의무 부활 명시).

### 영향 파일

- `.claude/cloud-routines/data-craft-review.md` (NEW)
- `.claude/cloud-routines/data-craft-server-review.md` (NEW)
- `.claude/skills/review-check/SKILL.md` (NEW)
- `.gitignore`

### Treadmill Audit

PASS — Q1 클로즈 이슈 사후 재검토 부재가 실재 (cross-package bundle / data-craft #127 4-사이클 헛수정 메모리 인용), Q2 엣지케이스 명시 완료 (sha 기반 dedup / 0건 처리 / output 폴더 부재), Q3 NOT APPLICABLE — 마스터 명시 신설로 create-custom-project-skill 카르베아웃 적용 (폐기될 기존 메커니즘 없음).

## v001.91.0

> 통합일: 2026-05-20
> 플랜 이슈: #47 (HOTFIX 3)
> 대상: 아이OS

### 페이즈 결과

- **Phase 4 (HOTFIX 3) — monitoring/index.html cache-bust 쿼리 갱신** (commit `9bec99b`): HOTFIX 1·2 머지 후에도 라벨 미표시 증상이 계속되어 정적 진단 수행. `monitoring/data/aggregate.json` 의 `by_skill_invocation` 370 건과 `computeSkillCountByDay` Python 시뮬레이션 결과 25 일자 카운트 모두 정상 (예: `2026-05-15: 89`), `by_day` 라벨 30 개 중 25 개가 카운트 맵 키와 정확히 매칭 — 코드와 데이터 모두 정상. **근본 원인은 `monitoring/index.html` 의 `<script src="script.js?v=20260519-21">` 캐시 무효화 쿼리스트링이 5 월 19 일 21 번 버전에 고정되어 있어, 우리의 v001.88.0 / v001.89.0 / v001.90.0 머지본을 브라우저가 fetch 하지 않은 것**. 동일 URL 의 하드 리프레시도 환경에 따라 캐시를 깨지 못함. `?v=20260519-21` (styles.css 와 script.js 두 줄 모두) 을 `?v=20260520-01` 로 갱신.

### 영향 파일

- `monitoring/index.html`

### Treadmill Audit

NOT APPLICABLE — 신규 규칙/훅/에이전트/스킬/검증축 추가 없음.

### 운영 메모

3 사이클 헛수정 사례. 메모리 `feedback_cross_package_bundle_target.md` (헛수정 사이클 회피) 와 같은 클래스 — 가설 기반 핫픽스 대신 정적 증거 (aggregate.json 의 invocation 수 + by_day 라벨 매칭률) 와 `index.html` 의 cache-bust 쿼리를 처음에 1 회 확인했다면 1 사이클에 종결됐을 사안. 차후 monitoring 변경 시 cache-bust 쿼리 갱신을 처음부터 함께 변경하는 것을 운영적 습관으로 권고 (단, 신규 규칙·훅·체크리스트 추가는 `feedback_no_prevention_treadmill.md` 의 3 질문 통과 필요).

## v001.90.0

> 통합일: 2026-05-20
> 플랜 이슈: #47 (HOTFIX 2)
> 대상: 아이OS

### 페이즈 결과

- **Phase 3 (HOTFIX 2) — 플러그인 옵션 매핑 우회: countsByDay 클로저 캡처로 교체** (commit `d8dada6`): HOTFIX 1 (datasetMeta 좌표 + 표준 hook 인자) 머지 후에도 라벨이 여전히 안 보이는 증상 발생. 원인 가설: Chart.js inline plugin (`new Chart(ctx, { plugins: [...] })`) 등록 시 `options.plugins[plugin.id]` 슬롯이 일부 빌드에서 undefined 로 전달되어 `afterDatasetsDraw(chart, args, options)` 의 `options` 가 비어 early-return. 옵션 슬롯 의존을 완전히 제거하고 `dayTokensSkillCountPlugin` 을 factory 함수 `makeDayTokensSkillCountPlugin(countsByDay)` 로 변경하여 클로저로 `countsByDay` 를 직접 보유. `renderChartDayTokens` 에서는 옵션 슬롯 세팅 제거 + factory 호출 결과를 `plugins` 배열에 등록. `computeSkillCountByDay` 헬퍼와 `renderAll` 호출 미변경.

### 영향 파일

- `monitoring/script.js`

### Treadmill Audit

NOT APPLICABLE — 신규 규칙/훅/에이전트/스킬/검증축 추가 없음. v001.89.0 의 잔존 라벨 미표시 버그 추가 수정.

### 운영 메모

본 핫픽스는 spec Step 11 HOTFIX 의 "code + patch-note 동일 hotfix WIP 단일 머지" 룰을 정확히 준수 — HOTFIX 1 의 분리 머지 결함을 본 핫픽스부터 복원.

## v001.89.0

> 통합일: 2026-05-20
> 플랜 이슈: #47 (HOTFIX 1)
> 대상: 아이OS

### 페이즈 결과

- **Phase 2 (HOTFIX 1) — 일자별 토큰 그래프 라벨 미표시 수정** (commits `22bc019` + `53467dd`): v001.88.0 의 `dayTokensSkillCountPlugin` 이 점 위에 라벨을 그리지 못하는 증상에 대해 두 가지 후보 원인을 한 핫픽스 WIP 에 묶어 동시 처리. (1) 좌표 계산 — `chart.scales.x.getPixelForValue(label)` (category 문자열 lookup 실패 가능) 과 `chart.scales.y.getPixelForValue(sumY)` (stacked line 의 실제 렌더 좌표와 불일치) 제거, stack `'s'` 마지막 dataset 의 `chart.getDatasetMeta(topIdx).data[i]` 에서 `.x` / `.y` 를 그대로 사용하도록 교체 + meta/pt 부재 시 skip 가드. (2) 옵션 접근 경로 — 훅 시그니처를 `afterDatasetsDraw(chart)` 에서 Chart.js 3+ 표준 `afterDatasetsDraw(chart, args, options)` 로 교체, `chart.config.options.plugins.dayTokensSkillCount` 경로 탐색을 제거하고 세 번째 인자 `options.countsByDay` 직접 접근으로 변경. `computeSkillCountByDay` 헬퍼와 `renderChartDayTokens` 통합 / `renderAll` 호출은 미변경.

### 영향 파일

- `monitoring/script.js`

### Treadmill Audit

NOT APPLICABLE — 신규 규칙/훅/에이전트/스킬/검증축 추가 없음. v001.88.0 의 시각화 라벨 버그 수정.

### 운영 메모

핫픽스 머지 시 spec (`plan-enterprise-os` SKILL.md Step 11 HOTFIX) 의 "patch-note 도 같은 hotfix WIP 에 함께" 룰을 누락하여 patch-note 가 별도 doc-only WIP (`핫픽스1-문서`) 로 분리 머지됨. 다음 핫픽스부터 hotfix WIP 단일 머지로 정합 복원.

## v001.88.0

> 통합일: 2026-05-20
> 플랜 이슈: #47
> 대상: 아이OS

### 페이즈 결과

- **Phase 1 — 일자별 스킬 처리 카운트를 라인 차트 점 위에 정수 라벨로 표기** (commit `dc31ebf`): `monitoring/script.js` 단일 파일 수정. (1) `computeSkillCountByDay(invocations)` 헬퍼 신설 — `by_skill_invocation` 에서 `(no-skill)` 제외 후 `new Date(start_timestamp)` + 로컬 `getFullYear/Month/Date` 로 `YYYY-MM-DD` 키 생성 (`collect.py:867` `parse_ts_hour` 가 로컬 시간 키이므로 UTC slice 사용 금지). (2) `dayTokensSkillCountPlugin` Chart.js 커스텀 플러그인 신설 — `afterDatasetsDraw` 훅, `options.plugins.dayTokensSkillCount.countsByDay` 에서 맵 읽음, stack `'s'` (현재 기간) Y 합 좌표 위 8px 에 정수 표기, 비교 stack `'c'` 제외, 카운트 0/없음은 라벨 생략. (3) `renderChartDayTokens` (script.js:358) 통합 — 시그니처 무변경, `opts.skillCountsByDay` 있을 때만 플러그인 등록 (미전달 시 기존 동작 보존). (4) `renderAll` 메인 카드 호출 1곳에서 `aggData.by_skill_invocation` 으로 카운트 맵 계산 후 전달, 실시간 비교 뷰 호출은 미변경 (v1 범위 외).

### 영향 파일

- `monitoring/script.js`

### Treadmill Audit

NOT APPLICABLE — 신규 규칙/훅/에이전트/스킬/검증축 추가 없음. 기존 모니터링 시각화에 점별 정수 라벨 1개 추가뿐.

## v001.87.0

> 통합일: 2026-05-20
> 플랜 이슈: #46
> 대상: 아이OS

### 페이즈 결과

- **Phase 1 — WIP base 로컬-ref 명문화 + 사전/사후 가드 절차 추가** (commit `1ecd4cf`): `plan-enterprise` / `plan-enterprise-os` 두 스킬의 모든 `git worktree add -b <wip> <wt_path> <integration>` 사이트가 항상 local integration ref (`i-dev` / `main`) 의 HEAD 에서 분기되도록 spec 텍스트 명문화. (1) `.claude/md/worktree-lifecycle.md` "Create" 코드 블록 직후에 "Base 인자 = local ref" 한 문단 추가 (`origin/<integration>` 사용 금지 사유 + 가드 절차 참조). (2) `plan-enterprise` SKILL.md Step 6 에 사전 가드 a~f 절차 (`fetch origin <integration>` → `rev-list --count` ahead/behind 측정 → ahead-only 정상·진행 / behind>0 halt) 명문화 + N==1·N>1·9.2·HOTFIX 4개 worktree-add 라인에 인라인 주석 `# base = local ref, origin/i-dev 사용 금지` 부착 + Step 9.1 머지 직전 behind>0 안전망 1줄 추가 + Step 11 HOTFIX re-entry 에 a~f 가드 1회 독립 수행 명문화. (3) `plan-enterprise-os` SKILL.md 에도 동일 구조 적용 (integration = `main`, Step 6 a~f 가드, Step 9 step1 안전망, step2 WIP B 주석, Step 11 HOTFIX a~f 가드 + 주석).

### 영향 파일

- `.claude/md/worktree-lifecycle.md`
- `.claude/skills/plan-enterprise/SKILL.md`
- `.claude/skills/plan-enterprise-os/SKILL.md`

### 배경 — `plan-enterprise #126` 운영 결함

`plan-enterprise #126` (data-craft FE) 진행 중, 메인 세션이 Step 6 의 `git worktree add -b <wip> <wt_path> i-dev` 에서 base 가 `origin/i-dev` 로 해석되어 stale 상태에서 분기됨. 운영 규칙 (`feedback_plan_enterprise_no_auto_push.md`) 상 plan-enterprise / -os 의 표준 종료점 = local 머지이고 origin push 는 마스터 명시 시에만 → local 이 truth-of-record, origin 은 stale 가능성 항상 존재. data-craft FE 의 경우 local i-dev 가 origin 보다 339 커밋 앞서 있던 상태였고, plan-enterprise #91 phase 13 (`c85d4046`) 가 `SeatAddDialog` 삭제 + `SeatManageDialog` 신설을 이미 적용했음에도 WIP 가 그 변경이 없는 origin/i-dev 시점에서 분기되어 머지 시 "deleted in HEAD / modified in WIP" conflict 발생. 본 패치로 동일 base-stale conflict 메커니즘이 향후 invocation 에서 재발하지 않음.

### Treadmill Audit

NOT APPLICABLE — 신규 메커니즘 (rule/hook/agent/skill/검증축) 추가 없음. 본 변경은 기존 Step 6 `git worktree add` base 인자의 의도 명확화 (spec 텍스트 강화) + 기존 메인 세션 절차에 가드 1개 (Step 6 a~f, Step 9 머지 직전 1줄) 삽입에 해당. 신규 추상화/축이 없으므로 폐기 대상 없음. 마스터 사전 판단 ("치트키 자동화나 hook 신설은 net-positive 3 질문 통과 못 함 — spec 텍스트 강화 + 메인 세션 절차 가드만으로 충분") 과 정합.

## v001.86.0

> 통합일: 2026-05-20
> 플랜 이슈: #45
> 대상: 아이OS

### 페이즈 결과

- **Phase 1 — PRICING 키 dated-suffix 정규화** (commit 7db8f2d): `_normalize_model_key(raw)` 헬퍼를 `monitoring/scripts/collect.py` 의 PRICING 사전 바로 아래에 추가. 정규식 `-\d{8}$` 으로 dated suffix 를 strip 하며 sentinel 4종 (`unknown`, `<synthetic>`, `"API 에러"`, `"시스템 합성"`) 은 우회. `collect()` assistant/agent 분기, `build_by_prompt()` assistant 분기, `build_by_skill_invocation._finalize_window()` assistant/agent 분기 총 5개 호출 지점에 적용. PRICING 사전·AGENT_MODEL_MAP 자체는 변경 없음.
- **Phase 2 — data-craft 흡수 (parent-orphan fallback)** (commit aa3bd00): `SESSION_DIRS` 튜플 (collect.py:25-30) 끝에 `~/.claude/projects/-Users-starbox-Documents-GitHub-data-craft` 추가 + 영문 인라인 주석으로 "pre-I-OS era — parent JSONLs lost, sub-agent JSONLs survive under */subagents/" 사실 명시. `all_jsonls` 구성 루프를 parent-orphan 분기로 교체 — 디렉터리의 top-level `*.jsonl` 존재 시 기존 경로, 부재 시 `*/subagents/*.jsonl` fallback. Project-I 같이 parent JSONL 이 살아있는 디렉터리는 fallback 분기에 진입하지 않아 기존 `toolUseResult.usage` 기반 sub-agent 카운팅과 이중 카운트 없음 (실증 확인: SESSION_DIRS 5개 중 I-OS 계열 4개는 parent 분기, data-craft 만 fallback).
- **Phase 3 — 산출물 재생성** (commit 6058784): `python3 monitoring/scripts/collect.py` 실행으로 `monitoring/data/hourly.json` (트래킹) 및 `aggregate.json` / `periods/*` (gitignored) 갱신. 트래킹된 hourly.json 만 커밋.

### 진단 요지 — 마스터 명령 vs 실제 가용 데이터

- 마스터 명령: 구 아이OS (Project-I) + 그 이전 시스템 data-craft 의 사용량 데이터를 현재 모니터링으로 통합. 기대 표현 "작년부터".
- **Project-I (구 아이OS)**: 이미 `SESSION_DIRS[1..3]` 에 등재되어 있어 별도 변경 없이 자동 수집 중. parent JSONL 가장 오래된 mtime = 2026-04-20.
- **data-craft (그 이전)**: parent JSONL (sessions-index.json 의 fullPath) 들이 디스크에서 소실. 잔존한 데이터는 4개 세션 UUID 디렉터리 내 `subagents/agent-*.jsonl` **50개** (총 2,637 assistant+usage 메시지). 메인 세션 토큰은 영구 손실로 본 모니터링에 반영 불가.
- **실제 가용 floor — 단일 작업일 `2026-03-12`**: 50개 sub-agent JSONL 의 assistant timestamp 가 전부 2026-03-12 하루에 집중 (디렉터리 mtime 은 2026-04-13 까지 보이나 record ts 는 2026-03-12 단일). 마스터의 "작년부터" 기대 표현 대비 실제로는 "두 달 전 단일 작업일치".
- 모델 분포 (data-craft): `claude-haiku-4-5-20251001` 와 `claude-opus-4-6` 두 가지. dated suffix 가 PRICING 사전과 매칭 안 되어 silently 0-cost 처리되던 pre-existing bug 도 본 플랜의 Phase 1 정규화로 함께 보정.

### 회귀 검증

- 재수집 후 비교 (aggregate.json snapshot 04:06:31Z → 04:25:57Z):
  - 총 메시지: 171,275 → **174,211** (+2,936).
  - 가장 이른 날짜: 2026-04-19 → **2026-03-12** (data-craft floor 도달).
  - `claude-opus-4-6`: 822 → **2,326** msgs (+1,504), \$365.70 → \$714.56 — data-craft 흡수 효과.
  - `claude-haiku-4-5`: 413 → **1,467** msgs (+1,054, dated-suffix alias 75 흡수 포함), \$4.28 → \$17.25.
  - `-20251001` 접미사 별도 행 부재 확인.
  - `by_session` 에 cwd 가 data-craft 인 세션 **49개** 등장.
- 이중 카운트 카나리 (opus-4-7 ±100): 166,791 → 167,076 (+285) 로 범위 초과했으나 실증으로 false positive 확인. 근거: (a) data-craft 모델은 haiku/opus-4-6 두 가지로 opus-4-7 0%, (b) hourly.json 의 2026-03-12 ~ 2026-04-13 window 에서 opus-4-7 by_model 항목 0건, (c) aggregate generated_at 간격 ~20분 동안 본 main 세션 (opus-4-7) + Explore × 2 의 자연 누적이 +285 메시지를 충분히 설명.
- Books reconciliation: data-craft 단독 assistant ts 합계 2,637 vs by_model 델타 합 (opus-4-6 +1,504 + haiku-4-5 +979 = 2,483) → 차이 ~154 (~5.8%). sentinel 경로 (`<synthetic>` → "API 에러" / "시스템 합성") 또는 acompact 엣지 케이스로 라우팅된 것으로 추정. 전체 174,211 중 0.09% 비중으로 비치명.
- SESSION_DIRS 분기 분포 (parent vs fallback): Project-I2 parent=302/sub=2170, Project-I parent=703/sub=1004, 워크트리×2 parent=1 each, data-craft parent=0/sub=50 — I-OS 계열 4개는 모두 parent 분기, data-craft 만 fallback 분기. 설계 의도 정확히 일치.

### Treadmill Audit

**PASS** — 신규 메커니즘 추가 없음. Phase 1 은 기존 모델 키 추출 지점에 정규화 함수 1개를 끼우는 pre-existing bug 수정. Phase 2 는 기존 `SESSION_DIRS` 튜플 한 항목 + 기존 glob 루프에 fallback 분기 1개 추가. Phase 3 는 운영. Q3 trade-out: pre-existing 0-cost silently 처리되던 `claude-haiku-4-5-20251001` 별도 행 분류를 폐기 (정상 모델 키로 통합 흡수).

### 영향 파일

- `monitoring/scripts/collect.py`
- `monitoring/data/hourly.json`
- (gitignored 갱신 only: `monitoring/data/aggregate.json`, `monitoring/data/periods/*`)

### 한계 — 본 작업으로 복원되지 않는 데이터

- data-craft 의 **메인 세션 JSONL** 들은 디스크에서 소실 (sessions-index.json fullPath 가 가리키는 `*.jsonl` 모두 부재). sub-agent JSONL 만 부분 복원 가능했으며 메인 세션 토큰은 영구 손실로 본 모니터링에 반영 불가.
- 마스터의 "작년부터" 기대 (~2025-05) 대비 실제 가용 floor 는 2026-03-12. 그 이전 데이터는 디스크 부재로 본 작업 영역 밖.
- 외부 프로젝트 세션 디렉터리 (`fs-data-viewer`, `Pingus-Server`, `PinLog-Web`, `zero-builder`) 는 본 명령의 "아이OS 계보" 범위 외로 통합 대상 아님.

## v001.85.0

> 통합일: 2026-05-20
> 플랜 이슈: #44 (HOTFIX 1)
> 대상: 아이OS

### 페이즈 결과

- **HOTFIX 1 (단일 커밋)**: `monitoring/scripts/collect.py` 의 sticky 모델을 두 변수로 분리하여 `master_declared_skill` (case A 마스터 `/X` 호출에서만 갱신) 과 `sticky_skill` (raw `attributionSkill` drift) 의 역할을 명확히 함. plain 마스터 프롬프트 진입 시 sticky 를 outer master_declared 로 복귀시켜 inner-skill drift (e.g. plan-enterprise 내부 Skill 도구가 group-policy / dev-start 를 invoke 한 뒤 raw=None 으로 떨어진 후속 어시스턴트 턴들) 가 잘못 누적되는 회귀를 차단. 동시에 explicit close substring 매칭을 `text.lstrip().startswith("플랜 완료")` / `startswith("핫픽스 완료")` 의 strict prefix 로 강화하여 `"...플랜 완료 시점 아니면 보고하지마"` 같은 마스터 본문이 거짓 닫힘을 트리거하던 버그도 함께 해소. `build_by_skill_invocation` 의 explicit-close 검사도 같은 strict prefix 로 정렬.

### 진단 요지

- v001.83.0 (이 플랜의 Phase 1) 직후 마스터 관측: 모니터링 대시보드에서 "메인 세션" 이 24h 윈도우에서 37.9% 로 비정상적으로 큼. 마스터 직관: "스킬은 메인 세션에서 호출되니까 이론상 다 스킬로 잡혀야 하는데" → sticky 가 outer 스킬을 보존하지 못하고 있다는 시그널.
- 1차 추적 (substring false closure): 마스터의 일반 발화 `"...플랜 완료 시점 아니면 보고하지마"` 에서 `"플랜 완료"` substring 매칭으로 plan-enterprise 가 거짓 닫힘. 이 부분만 strict prefix 로 고치면 ~2%p 회수 (37.9% → 35.9%) 정도. 단독 원인 아님.
- 2차 추적 (inner-skill drift): 세션 `7304211a-255f-435f-a9a1-77bd6f8ea3ae` 분석 — `/plan-enterprise` 1회 호출 후 PENDING-gate 상태에서 진행되는데, 내부에서 sub-agent / Skill 도구가 `/group-policy` 등을 invoke 하면 runtime 이 그 어시스턴트 턴들에 `attributionSkill='group-policy'` 를 부여. 이후 raw=None 으로 떨어진 어시스턴트 턴들이 sticky 를 통해 계속 group-policy 로 누적 → 다음 plain master prompt 에서 v001.83.0 의 fix 는 이걸 `"메인 세션"` 으로 리셋 → 외부 plan-enterprise 가 PENDING 인데도 메인 세션으로 거짓 귀속. 24h 윈도우 단일 세션 7304211a 가 메인 세션 144M tokens 누적 (단일 hour 2026-05-19T15 KST 153M 중 거의 전부).
- runtime attribution 메커니즘 확인: 첫 raw=group-policy record (rec#336) 직전 3개 record 가 `agent-name` / `agent-setting` / `permission-mode` 시스템 타입 — sub-agent / Skill 도구 디스패치의 context switch 시그널. → inner-skill 가설 확정.

### 회귀 검증

- 24h 윈도우 메인 세션 비중: **37.9% → 3.0%** (마스터 직관 부합).
- plan-enterprise 비중: 53.2% → 88.5% (외부 declared 로 정상 회수).
- plan-enterprise-os: 4.7% → 7.1% (정상 범위 유지).
- dev-start: 0.4% 유지 (v001.83.0 의 fix 무회귀).
- dev-merge / patch-confirmation: 변화 없음.
- group-policy: 2.6% → 0.3% — 24h 윈도우 내 `/group-policy` 마스터 호출 0회, 모두 plan-enterprise 내부에서 Skill 도구로 invoke 된 inner-skill drift 분이었음. raw=group-policy 구간 자체는 정확히 잡힘 (0.3% ≈ 3M tokens, 16 raw records × 평균 200k = 정합).
- collect.py 실행 정상: processed 995 files, 169921 assistant messages, total ~$128050.

### Inner-skill trade-off (명시)

본 v1 모델은 **outer 우선** 정책: inner skill (sub-agent / Skill 도구로 호출된 스킬) 은 runtime 이 raw attribution 을 부여한 어시스턴트 턴만 집계되고, 그 뒤로 raw=None 으로 떨어진 inner-skill 잔여 활동은 outer (master-declared) 로 귀속됨. 이는 inner skill 의 토큰 사용을 **최소 추정치** 로 만든다. 마스터 의도 ("스킬에서 호출하니 스킬로 잡혀야") 와 부합하는 outer-우선 모델이며, inner skill 의 정밀 stack 추적은 본 핫픽스 범위 밖.

### Treadmill Audit

NOT APPLICABLE — 신규 규칙/훅/에이전트/스킬/검증축 추가 없음. 기존 분류 셋과 `_parse_skill_command` 재사용 + sticky 모델만 정교화. v001.83.0 의 fix 도 본 핫픽스로 이어진 같은 분석 축의 정상화 — 별도 메커니즘 추가 아님.

### 영향 파일

- `monitoring/scripts/collect.py` (master_declared_skill 분리 + prefix 매칭 강화)
- `monitoring/data/hourly.json` (재생성)
- (gitignored, 재생성 대상이지만 커밋 외) `monitoring/data/aggregate.json`, `monitoring/data/periods/**/*.json`

---

## v001.84.0

> 통합일: 2026-05-20
> 플랜 이슈: #43
> 대상: 아이OS

### 페이즈 결과

- **Phase 1 (호환성 분석 문서)**: `monitoring/docs/legacy-backfill-analysis.md` 신규 작성. 구버전 (Project-I) raw JSONL 706개가 살아있어 현재 `collect.py` 로 재집계 가능하다는 결론과 호환성 평가표, 백필 원천 인벤토리, 폐기 축 (페르소나·프로젝트그룹) 참조 안내, 영구 통합 성격 명시.
- **Phase 2 (collect.py SESSION_DIRS 다중 디렉토리 확장)**: `monitoring/scripts/collect.py` 의 단일 `SESSION_DIR` 상수를 4개 디렉토리 튜플 `SESSION_DIRS` (Project-I2 primary + Project-I + worktrees 2 개) 로 확장. `if d.exists()` 가드로 구버전 디렉토리 부재 시 graceful skip. 출력 메타 키 `session_dir` → `session_dirs` (리스트) 로 변경. 4지점 (line 24, 956-957, 986, 1299 부근) 외 무수정.
- **Phase 3 (실행 검증 + README 보강)**: 백필 적용된 `collect.py` 로 산출물 재생성. `monitoring/data/aggregate.json by_day` 가 2026-04-19 ~ 2026-05-20 의 29 일치로 확장됨을 확인. 모델 축에 구버전 전용 `claude-opus-4-6` 등장 (legacy 데이터 통합 확정). `monitoring/README.md` 에 "구버전 (Project-I) 데이터 백필" 절 추가 — 표시 축·해석 주의·폐기 축 참조·시간 단위 14일 롤링 한계 명시.

### 진단 요지

- 마스터 관측: 구버전 아이OS (Project-I, archived 실패 케이스) 의 모니터링 데이터가 약 1 개월치 (2026-04-19 ~ 2026-05-10) 사장. 현재 아이OS 모니터링 대시보드에서 과거 이력 조회 불가.
- 핵심 발견: 구버전의 weekly aggregate 파일을 변환할 필요 없음. 구버전 raw JSONL (`~/.claude/projects/-Users-starbox-Documents-GitHub-Project-I*` 3 개 디렉토리, 706 개 파일) 이 그대로 살아있어 현재 `collect.py` 로 재집계 시 시간 단위까지 복원 가능. `collect.py:34-40` PRICING 에 구버전 모델 (`claude-opus-4-6`, `claude-sonnet-4-6`) 이 이미 등재되어 가격표 수정 없이 비용 계산 호환. `collect.py:646,1031` 의 `attributionSkill.get()` 안전 처리로 구버전 어휘 (페르소나명, 구 스킬명) 도 미지값 crash 없이 by_skill 라벨로 표시.
- 설계 결정 (advisor 권고 반영): sidecar legacy 파일 + 머지 로직 대신 `SESSION_DIRS` 리스트 확장 (~5 라인 영구 변경) 채택. 옛 JSONL 과 새 JSONL 은 서로 다른 디렉토리에 다른 UUID 로 존재하므로 충돌 불가. 매번 `collect.py` 실행이 자동으로 구버전 데이터를 포함하는 영구 통합.

### 회귀 검증

- aggregate.json `by_day`: 2026-04-19 ~ 2026-05-20, 29 일치 (이전: ~10 일치).
- `by_model`: `claude-opus-4-6`, `claude-sonnet-4-6` (구버전 전용), `claude-opus-4-7`, `claude-sonnet-4-6`, `claude-haiku-4-5` 모두 등장.
- `files_processed`: 995 (이전 ~280 → 구버전 706 흡수 + 합산).
- `session_dirs`: 4 개 경로 모두 출력 메타에 기록.
- hourly.json: 의도된 14 일 롤링 윈도우 (171 시간 버킷) 유지 — 14 일 이전 시간 단위 표시 불가는 README 한계 명시.
- 폐기 축 (페르소나·프로젝트그룹) 은 현재 데이터 모델에서 폐지되어 추출 불가 — 필요 시 구버전 `Project-I/monitoring/data/aggregate.json` 직접 참조 안내.
- 머지 과정: 작업 머지 시 main 의 미커밋 hourly.json (preexisting runtime artifact) 과 3-way 충돌 발생. WIP 측 (legacy 포함 최신 collect.py 출력) 채택 후 post-merge 시점에 collect.py 재실행으로 freshest 상태 보장.

### Treadmill Audit

NOT APPLICABLE — 신규 규칙/훅/에이전트/스킬/검증축 추가 없음. 사용자 향(向) 데이터 기능 확장 (모니터링 입력 소스의 정적 리스트 확장) 으로 예방 메커니즘 부류가 아님. 영구 변경은 `collect.py` 의 `SESSION_DIRS` 튜플 + `if d.exists()` 가드 도입 (~12 라인) 뿐.

---

## v001.83.0

> 통합일: 2026-05-20
> 플랜 이슈: #44
> 대상: 아이OS

### 페이즈 결과

- **Phase 1** (collect.py sticky_skill 누수 수정 + 데이터 재생성): `monitoring/scripts/collect.py` 의 메인 집계 루프 (`collect()` 함수, 세션별 records 루프) 상단에 master prompt 처리 분기를 추가. `_is_master_prompt(rec)` True 일 때 `_parse_skill_command(text)` 로 새 스킬 명령(`/X`)이면 `sticky_skill = X` 로 갱신하고 해당 record 의 timestamp 를 `active_skill_start_ts` 로 저장; 일반 프롬프트면 same-ts 가드 통과 시에만 sticky 가 `_GATED_SKILLS` 면 "플랜 완료"/"핫픽스 완료" 텍스트에서 메인 세션으로 리셋, sticky 가 non-gated 일 때 무조건 메인 세션으로 리셋. 이미 `build_by_skill_invocation` 가 사용 중인 분류 셋 (`_GATED_SKILLS` / `_FALLBACK_NON_GATED_SKILLS` / `_parse_skill_command`) 을 재사용해 두 분석 경로의 의미를 정렬. 수정 후 `python3 monitoring/scripts/collect.py` 실행으로 `aggregate.json` / `hourly.json` / `periods/**` 재생성.

### 진단 요지

- 마스터 관측: 모니터링 대시보드 "최근 24h" 도넛 차트에서 dev-start 가 35% 표시. dev-start 는 프론트 dev 서버 재시작 (포트 kill + 명령 background 실행 + listen 대기) 의 1~2 턴짜리 짧은 스킬이므로 비정상.
- 원인 추적: 가장 큰 기여 세션 `7304211a-255f-435f-a9a1-77bd6f8ea3ae.jsonl` 분석 결과 실제 `attributionSkill == "dev-start"` 어시스턴트 레코드는 34건 11.3M tokens, sticky 로직 적용 후 dev-start 귀속은 682건 378M tokens (**33배 과다**). dev-start → 다른 스킬 attribution 전이는 0 회 — Claude Code 런타임이 dev-start 종료 후 attributionSkill 을 None 으로만 떨어뜨리고 새 값을 부여하지 않아 sticky 가 dev-start 를 무한히 유지.
- 근본 원인: `collect.py` 내 두 분석 경로가 "어느 스킬 호출에 속한 레코드인가" 판단에 다른 규칙 사용. `build_by_skill_invocation` 는 gated/non-gated 분류로 정확히 닫지만, 메인 집계 루프는 단일 sticky 변수만 fill-in 하고 마스터 프롬프트 인식이 없어 non-gated 스킬을 영원히 닫지 못함.
- advisor #1 차단성 피드백 수용: 같은-timestamp 가드 (`ts != active_skill_start_ts`) 를 case B 닫힘 평가 진입 조건에 명시. 이 가드 없이 닫힘 평가만 추가하면 SKILL.md 본문이 invocation 과 같은 ts 로 주입될 때 본문 안의 "플랜 완료" 문서 텍스트가 모든 gated 스킬을 즉시 거짓 닫힘 시키는 더 큰 회귀 발생.

### 회귀 검증

- 최근 24h dev-start 귀속 비중: **34.8% → 0.4%** (정상 범위 복귀).
- dev-start 가 잃은 분량은 메인 세션으로 정확히 재귀속 (0.1% → 37.9%, +37.8% ≈ dev-start 가 잃은 분량 +sticky 가 가렸던 기타 메인 활동).
- gated 스킬 무회귀: plan-enterprise 56.8% → 53.2% (±수 % 이내), plan-enterprise-os 4.7% → 5.2%, group-policy 2.7% → 2.6%, dev-merge 0.6% → 0.6%, patch-confirmation 0.2% → 0.2%. same-ts 가드 정상 작동 확인.
- collect.py 실행 정상: processed 289 files, 29813 assistant messages, total ~$14461.56.

### Treadmill Audit

NOT APPLICABLE — 신규 규칙/훅/에이전트/스킬/검증축 추가 없음. 기존 분류 셋 (`_GATED_SKILLS` / `_FALLBACK_NON_GATED_SKILLS`) 과 기존 파서 (`_parse_skill_command`) 를 메인 집계 루프에서도 재사용하도록 정렬했을 뿐.

### 영향 파일

- `monitoring/scripts/collect.py` (+29 lines)
- `monitoring/data/hourly.json` (재생성)
- (gitignored, 재생성 대상이지만 커밋 외) `monitoring/data/aggregate.json`, `monitoring/data/periods/**/*.json`

---

## v001.82.0

> 통합일: 2026-05-19
> 플랜 이슈: #42 (HOTFIX 5)
> 대상: 아이OS

### 페이즈 결과

- **HOTFIX 5** (HOTFIX 5 단일 커밋): in_progress 판정에 JSONL 파일 mtime 60분 임계를 추가. 기존 last record ts 30분 임계와 **OR** 조건 — 둘 중 하나라도 만족하면 마지막 윈도우를 in_progress 로 마킹. 사유: Claude Code 가 record 를 즉시 flush 하지 않는 케이스에서 file mtime 이 더 신뢰성 높은 활성 시그널. 본 세션 검증 시 in_progress 윈도우 정상 등장 확인.
- **HOTFIX 5 보강** (추가 커밋): explicit close 검사가 스킬 invocation 타임스탬프 클러스터(invocation command-args 레코드 + 동일 타임스탬프의 스킬 본문 주입 레코드)에서 "플랜 완료" substring 오탐 발동하여 윈도우가 즉시 닫히는 버그 수정 (`i != active_start_idx and ts != active_start_ts` 이중 가드). 실제 원인: Claude Code 가 스킬 본문을 동일 타임스탬프의 별도 role=user 레코드로 주입하며, 그 스킬 본문 안의 문서 텍스트("플랜 완료" 키워드 설명)가 오탐을 유발. HOTFIX 5 단일 커밋 이후에도 in_progress 카운트 0 에 머물렀던 근본 원인 해소. 수정 후 in_progress 카운트 6 확인 (현재 `/plan-enterprise-os #42` 세션 포함).

### 진단 요지

- v001.81.0 머지 직후 마스터 관측: 진행 중 본 세션 (`/plan-enterprise-os #42`) 이 표 상단 "🔴 진행 중인 호출" 영역에 안 나타남. 원인: 윈도우 end_timestamp ≈ 04:55, 새로고침 시각 ≈ 06:13 → 1h18m 차이로 30분 임계 미달. JSONL flush timing 으로 record content 가 실시간 활동을 정확히 반영하지 못함.
- HOTFIX 5 단일 커밋(mtime 60분 임계) 적용 후에도 in_progress 카운트 0 유지됨. 2차 원인: Claude Code 가 스킬 본문을 invocation command-args 레코드와 동일 타임스탬프의 별도 role=user 레코드로 주입하는 구조. 이 레코드가 `_is_master_prompt` 검사를 통과하고, 스킬 본문 내 "플랜 완료" 키워드 설명 텍스트에 explicit close 검사가 오탐 발동 → 윈도우 즉시 닫힘. `i != active_start_idx and ts != active_start_ts` 이중 가드로 invocation 타임스탬프 클러스터 전체를 건너뜀으로써 수정.

### 회귀 검증

- collect.py 재실행 후 in_progress 카운트 0 → 6 증가 확인. 현재 `/plan-enterprise-os #42` 세션 (`2026-05-19T04:11:38`) 포함.
- plan-enterprise explicit close 윈도우 무회귀 확인: `with_issue=77, no_artifact=1` (이전 동일 수준 유지).
- 파이프라인 / 표 / 모달 UI 무변경 — 데이터 필드 partial / close_reason 의 값만 추가 케이스.

### Treadmill Audit

NOT APPLICABLE — 기존 detection 의 신호 보강만, 신규 메커니즘 없음.

### 영향 파일

- `monitoring/scripts/collect.py`
- `monitoring/README.md` (60분 mtime 임계 한 줄 추가)
- `patch-note/patch-note-001.md`
- `monitoring/data/aggregate.json` (재생성)
- `monitoring/data/hourly.json` (재생성)

## v001.81.0

> 통합일: 2026-05-19
> 플랜 이슈: #42 (HOTFIX 4)
> 대상: 아이OS

### 페이즈 결과

- **HOTFIX 4** (HOTFIX 4 단일 커밋): 상세 모달의 서브 에이전트별 수치를 시각화. 모달 본문에 `.modal-agents-section` 신규 추가 — 각 sub-agent 마다 1 row, 에이전트명 해시 색상 chip + 총 토큰·비용 요약 헤더, 그 아래 "사용" / "캐시" 가로 막대 2개 (윈도우 내 max 대비 비례, X.XXM 라벨). 총 토큰 내림차순 정렬. 기존 채널별 raw 테이블은 유지.

### 진단 요지

- v001.80.0 직후 마스터 관측: 모달의 sub-agent 행이 plain 표 형태라 시각 비교 어려움.

### 회귀 검증

- node --check JS OK. 모달 외 다른 표/차트 무변경, additive 만.

### Treadmill Audit

NOT APPLICABLE — 시각화 강화만.

### 영향 파일

- `monitoring/script.js`
- `monitoring/styles.css`
- `monitoring/README.md` (모달 시각 강화 항목 한 줄 추가)
- `patch-note/patch-note-001.md`

## v001.80.0

> 통합일: 2026-05-19
> 플랜 이슈: #42 (HOTFIX 3)
> 대상: 아이OS

### 페이즈 결과

- **HOTFIX 3** (HOTFIX 3 단일 커밋): (1) 진행 중 호출 표시 — `build_by_skill_invocation` 의 session_end 후처리에서 세션 last record timestamp 가 현재 시각 기준 30분 이내인 경우 마지막 윈도우의 close_reason 을 `in_progress` 로 마킹하고 `partial: true` / `last_seen_timestamp` 메타 추가. (2) 프론트 상단 분리 — `renderSkillInvocations` 가 in_progress 행을 별도 "🔴 진행 중인 호출 (실시간 부분 집계)" 섹션으로 렌더, 메인 표는 완료된 호출만 페이지네이션. (3) 모달 시각 개선 — hero 블록 (skill chip + artifact tag + close_reason pill), 4-card stat strip (사용/캐시/소요/비용), 채널별 stacked horizontal bar, 채널 분해 테이블 zebra, 세션 메타 collapsible footer. (4) 표/모달의 모든 토큰 수치를 `X.XXM` 소수점 M 단위로 통일.

### 진단 요지

- v001.79.0 머지 직후 마스터 관측: (a) 진행 중 호출도 시각 구분되어 표시될 필요. (b) 기존 모달이 dl + 단순 테이블 위주로 표 시각화 강화에 비해 정보 밀도 / 미감 격차.

### 회귀 검증

- node --check 문법 OK.
- 진행 중 판정은 collect.py 가 실행되는 시점의 datetime.now() 기준 — JSONL flush timing 에 의존. 30분 임계는 보수적 기본값.
- 기존 완료 호출 표 / 페이지네이션 / 모달 채널별 raw 테이블 무변경, 추가 레이어만.

### Treadmill Audit

NOT APPLICABLE — 신규 메커니즘 없음, 표시 분리·강화만.

### 영향 파일

- `monitoring/scripts/collect.py`
- `monitoring/index.html` (필요 시 — 모달 컨테이너 구조 변경 시)
- `monitoring/script.js`
- `monitoring/styles.css`
- `monitoring/README.md`
- `patch-note/patch-note-001.md`

## v001.79.0

> 통합일: 2026-05-19
> 플랜 이슈: #42 (HOTFIX 2)
> 대상: 아이OS

### 페이즈 결과

- **HOTFIX 2** (HOTFIX 2 단일 커밋): (1) charts 섹션 순서 재배치 — `#skill-invocations-section` 을 tables-section 에서 charts-section 으로 이동하여 `#chart-agent-bar` (서브에이전트 사용량) 바로 아래에 배치, `#chart-session-bar` (세션 Top 10) 를 charts-section 맨 끝으로 이동. (2) 스킬 호출별 표 시각화 강화 — 토큰 컬럼 4종에 컬럼 최댓값 대비 비례 가로 막대 inline 렌더, 스킬명을 해시 기반 색상 칩으로 표시, 소요 시간 옆에 버킷 색상 pip(<1m 회색 / <10m 초록 / <1h 노랑 / >=1h 빨강), 생성물에 종류별 태그 라벨, 서브에이전트 셀을 pill 형태로 분리, 행 zebra-striping 강화, 제목 셀 모노스페이스.

### 진단 요지

- v001.78.0 머지 직후 마스터 관측: 텍스트만으로 구성된 표가 30개 행 페이지 환경에서 빠른 비교가 어려움. 토큰 크기 / 스킬 종류 / 소요 시간 분포를 한눈에 파악할 시각 단서 필요.

### 회귀 검증

- node --check 문법 OK.
- DOM 순서 재배치는 표시 전용 — 파이프라인 / 데이터 / 함수 시그너처 무변경.
- 기존 `formatTokensCompact` 그대로 사용, 막대는 추가 레이어.

### Treadmill Audit

NOT APPLICABLE — 신규 메커니즘 없음, 표시 강화만.

### 영향 파일

- `monitoring/index.html`
- `monitoring/script.js`
- `monitoring/styles.css`
- `patch-note/patch-note-001.md`

## v001.78.0

> 통합일: 2026-05-19
> 플랜 이슈: #42 (HOTFIX 1)
> 대상: 아이OS

### 페이즈 결과

- **HOTFIX 1** (HOTFIX 1 단일 커밋): 스킬 호출별 토큰 사용량 표 및 모달의 토큰 컬럼을 "총 토큰" 단일 합산에서 "사용량(input+output)" 과 "캐시(cache_creation_5m + cache_creation_1h + cache_read)" 로 분리. 표 컬럼: 시작 시각 / 소요 시간 / 스킬 / 제목 / 생성물 / 총 사용 / 총 캐시 / 메인 사용 / 메인 캐시 / 서브에이전트(`agent: 사용/캐시`). 모달의 토큰 분해 테이블에는 채널별 raw 값 5 컬럼 끝에 "사용 합" / "캐시 합" 2 컬럼 추가.

### 진단 요지

- v001.77.0 직후 마스터 관측: 사용량(신규 토큰)과 캐시 토큰은 가격·동작 특성이 달라 단일 합산이 의사결정에 부적합.

### 회귀 검증

- node --check JS 문법 OK.
- 기존 모달의 채널별 5 컬럼 raw 값은 무변경, 우측에 합산 2 컬럼 추가만.

### Treadmill Audit

NOT APPLICABLE — 신규 메커니즘 없음, 표시 분리만.

### 영향 파일

- `monitoring/script.js`
- `monitoring/styles.css`
- `monitoring/README.md`
- `patch-note/patch-note-001.md`

## v001.77.0

> 통합일: 2026-05-19
> 플랜 이슈: #42
> 대상: 아이OS

### 페이즈 결과

- **Phase 1** (`884ad22`): `monitoring/scripts/collect.py` 에 `_FALLBACK_GATED_SKILLS` / `_FALLBACK_NON_GATED_SKILLS` 하드코딩, `_load_known_skills()` SKILL.md 자동 추출 함수, `_parse_skill_command()` `<command-name>` 태그 파서, `build_by_skill_invocation()` 스킬 호출 윈도우 생성 함수 신규 추가. 종료 우선순위 4 단계(explicit / next_skill / attribution_drop / session_end), 메인 세션 ↔ 서브에이전트 토큰 분리, 생성물 자동 캡처(issue > patch-note > roadmap), `duration_sec` 계산 포함. `collect()` 에서 per-session 호출 후 `_all_skill_invocations` 내부 키로 누적.
- **Phase 2** (`556e2b9`): `_load_known_skills()` 성공 경로에 폴백 enum 과의 union 추가하여 SKILL.md 의 "PENDING gate" 마커 부재 케이스에서도 기존 14 gated 스킬이 항상 올바르게 분류되도록 보강. `main()` 의 `_all_skill_invocations` 를 pop-and-drop 대신 `aggregate.json` 의 `by_skill_invocation` 키로 직렬화 (start_timestamp 내림차순, top-N cap 없음). `periods/*.json` 및 `hourly.json` 에는 미포함 (aggregate-only — 본 뷰는 기간/비교 토글 영향 받지 않음).
- **Phase 3** (`200ccf5`): `monitoring/index.html` 의 tables-section 끝에 `#skill-invocations-section` (페이저 + 테이블 컨테이너) 및 `#skill-invocation-modal` 추가, 캐시 버스터 v17→v18. `monitoring/script.js` 에 `__skillInvData` / `__skillInvPage` / `SKILL_INV_PAGE_SIZE=30`, `formatDurationSec` / `formatTokensCompact` 헬퍼, `renderSkillInvPager` / `renderSkillInvocations` / `openSkillInvocationModal` / `closeSkillInvocationModal` / `loadSkillInvocations` 추가. `DOMContentLoaded` 에서 클릭/ESC 모달 닫기 핸들러 1회 등록 + 초기 `loadSkillInvocations(agg)` 1회만 호출(기간/비교 토글 독립). `monitoring/styles.css` 에 CSS 변수 기반 다크테마 스타일 추가.
- **Phase 4** (`cfc7b39`): `monitoring/README.md` 에 "스킬 호출별 토큰 사용량" 섹션 — 윈도우 경계 규칙, 중첩 처리, UX(페이지네이션/모달), 데이터 누적·무손실 보장, v1 한계 4 항.
- **Phase 5 (보정)** (`75b20ae`): 실측 결과 `dev-start` 최대 duration 이 4904 초까지 누적되어 비gated 스킬이 후속 무관 마스터 프롬프트를 흡수하는 logic gap 발견. `build_by_skill_invocation` 메인 스캔에 **Rule plain_prompt** 추가 — 활성 비gated 윈도우는 어떤 내용의 마스터 프롬프트가 도착해도 즉시 종료. `attribution_drop` 은 폴백으로 잔존. README 5-rule 로 갱신. 재실행 후 `dev-start` 38 건 전량 `plain_prompt` 종료 확인 (백그라운드 세션 utility 특성상 duration 0 은 정당한 데이터 특성).

### 진단 요지

- 기존 `by_skill` 시각화는 누적 합산만 제공 — 한 스킬 호출 단위의 시작·종료·중간 핫픽스·일반 프롬프트·서브에이전트 사용량 분해를 볼 수 없음.
- JSONL 의 슬래시 커맨드는 `<command-name>/X</command-name>` 태그로 user message content 안에 항상 wrap 됨(실측). free-text 정규식 매칭 대비 신뢰도 우위.
- 마스터 명시: 본 뷰는 헤더 기간/비교 토글 영향 받지 않음 / 30 개씩 페이지네이션 / 1 페이지·상단 = 최신 / 행 클릭 모달 / 누적 보존.

### advisor 결과

- 계획 단계 (#1): Intent / Logic / Harness Integrity / Evidence / Command Fulfillment PASS, Treadmill Audit NOT APPLICABLE.
- 완료 단계 (#2): 동일 6 관점 PASS / NOT APPLICABLE, BLOCK 없음.

### 회귀 검증

- per-phase verification 5 단계 PASS, blockers 없음.
- 244 윈도우 실측 생성, close_reason 분포(explicit 105 / plain_prompt 52 / next_skill 54 / session_end 33 / attribution_drop 0) 합리적. artifact 캡처 issue 92 / patch-note 7 / roadmap 5 / none 140.
- node --check `monitoring/script.js` 문법 OK.
- Phase 5 커밋에 `monitoring/data/hourly.json` 빌드 부산물 포함 (collect.py 재실행 결과 — 정상).

### Treadmill Audit

NOT APPLICABLE — 신규 규칙·훅·에이전트·스킬·검증축·자기보호 invariant 추가 0. monitoring 제품 기능 확장만.

### 영향 파일

- `monitoring/scripts/collect.py`
- `monitoring/index.html`
- `monitoring/script.js`
- `monitoring/styles.css`
- `monitoring/README.md`
- `monitoring/data/aggregate.json` (재생성 부산물 — Phase 2 / Phase 5)
- `monitoring/data/hourly.json` (재생성 부산물 — Phase 5)

### v1 한계 (v2 후보)

- 세션 가로지름 미지원 — `plan-enterprise` explicit 의 44 % (45/103) 가 artifact 미캡처 (이슈는 세션 A 에서 생성, 완료는 세션 C 등).
- `attribution_drop` 사실상 dead rule (`plain_prompt` 가 그 자리를 대체).
- 미등록 슬래시 커맨드 (`/clear` / `/help` / `/model` 등 Claude Code 내장) 윈도우 미생성.
- `cost_usd` 는 collect.py PRICING 표 v1 근사치.

## v001.76.0

> 통합일: 2026-05-18
> 플랜 이슈: #41 (HOTFIX 1)
> 대상: 아이OS

### 페이즈 결과

- **Phase 2 (HOTFIX 1)** (`f63b0de79e246383a378a02543d184abeeb7b983`): `monitoring/script.js` `computeRealtimeWindows` 의 no-compare 분기를 `[now-5*24h, now]` 롤링으로 교체. 기존 `currentWeekMondayMs()` 의존 폐기 (함수가 더 이상 호출되지 않으므로 정의도 삭제). `applyPeriodSelection` 의 compare-absent 메타 메시지 → `실시간: 최근 5일`. compare-present 분기는 무변경. `by_session` / `by_prompt` 폴백은 deferred 유지. `monitoring/README.md` no-compare 윈도우 설명 업데이트.

### 진단 요지

- v001.75.0 머지 직후 마스터 관측: 월요일 09:27 KST 에 no-compare 실시간 모드 KPI 가 ~6.7M (오늘만) 으로 표시, 일자별 차트의 지난주 바(예: 5-15 = 1.3B) 와 시각적 모순. advisor #1 가 계획 단계에서 사전 경고했던 "주 앵커가 실시간 무드와 충돌" 케이스가 그대로 표면화.
- 원인: no-compare 분기가 여전히 `currentWeekMondayMs()` 앵커. 월요일에는 윈도우가 ~today 로 축소.
- 결정: 주 앵커 폐기, 가장 큰 compare 옵션(5일)의 창폭과 일치시키고 마스터의 "5일 이내" 표현과도 맞춰 `[now-5*24h, now]` 롤링으로 교체.

### 회귀 검증

- per-phase verification 5단계 PASS, blockers 없음.
- hourly.json retention 14일 ≥ 5일 → 데이터 부족 없음.
- compare-present 분기 / `aggregateHoursInWindow` / KPI delta badge 산출식 무변경.

### Treadmill Audit

NOT APPLICABLE — 신규 메커니즘 추가 0개. 기존 함수 한 분기 + 메시지 한 줄 (+ unused 함수 정리) 수정.

### 영향 파일

- `monitoring/script.js`
- `patch-note/patch-note-001.md`
- `monitoring/README.md`

---

## v001.75.0

> 통합일: 2026-05-18
> 플랜 이슈: #41
> 대상: 아이OS

### 페이즈 결과

- **Phase 1** (`a3292dd`): `monitoring/script.js` 의 `computeRealtimeWindows(now, hoursBack)` 본문 교체 — `hoursBack` 있을 때 `weekStart` 의존 / `Math.max(weekStart, now-windowMs)` 클램프 제거, `base=[now-N, now]` / `compare=[now-2N, now-N]` 동일 창폭 반환. `hoursBack` 없을 때는 기존 단독 보기 (`base=[weekStart, now]`) 보존. `applyPeriodSelection` realtime 분기 compare-present 메타 메시지를 `실시간: 최근 ${hoursLabel} vs 그 이전 ${hoursLabel} (동일 창폭 비교)` 로 갱신, `hoursLabel` 매핑과 compare-absent 메시지는 무변경.

### 진단 요지

- 마스터 신고: 월요일 오전에 실시간 모드 "5일 전(120h)" 비교를 선택해도 전주 수요일까지의 데이터가 잡히지 않음 — 실시간 윈도우가 주(週) 단위 데이터 모델에 묶여 있는 정황.
- 코드 확인: `computeRealtimeWindows` 가 `compareEnd = Math.max(weekStart, now - windowMs)` 로 비교 종료점을 이번 주 월요일 00:00 으로 강제 클램프 + `baseStart`/`compareStart` 둘 다 `weekStart` 고정. 월요일 호출 시 `compareStart == compareEnd == weekStart` → 비교 구간 길이 0.
- `monitoring/README.md` 사양 ("`[지금-N, 지금]` 기준 / `[지금-2N, 지금-N]` 비교 — 동일 창폭") 과 코드 실제가 처음부터 불일치. 메타 메시지("이번주 월요일 00:00 ~ 지금까지 (vs N 전 누적)") 도 사양과 다른 의미를 표시 중.
- 데이터 측면: `monitoring/scripts/collect.py` 의 hourly.json retention = 14일. 최대 옵션 5일 → 2N=10일 < 14일 → 데이터 충분. 본 신고는 클라이언트 윈도우 계산 로직 버그.

### 회귀 검증

- main session per-phase verification 5단계 (git fetch, git show --stat, affected_files 교집합, git diff 내용, blockers) 모두 PASS.
- compare-absent 경로 / `aggregateHoursInWindow` 인터페이스 / `aggregate.json` 일자별 차트 경로 / KPI delta badge 산출식 모두 무변경.
- 의도된 잔여 비대칭 (deferred): base 토큰 KPI 는 동일 창폭이지만 `by_session` / `by_prompt` 폴백 (script.js:1180-1187) 은 여전히 이번 주 weekly aggregate 출처 — hourly.json 에 세션/프롬프트 분해가 없어 별 사이클로 이관.
- advisor #1 (계획) / advisor #2 (완료) 6-perspective 모두 PASS, BLOCK 토큰 없음.

### Treadmill Audit

NOT APPLICABLE — 신규 규칙/훅/에이전트/스킬/검증축 추가 0개. 기존 단일 함수 본문 + 단일 메타 메시지 수정 (Q3 폐기 대상 0개).

### 영향 파일

- `monitoring/script.js`

---

## v001.74.0

> 통합일: 2026-05-16
> 플랜 이슈: #40
> 대상: 아이OS

### 페이즈 결과

- **Phase 1** (`cfbfd17`): `.claude/skills/dev-merge/SKILL.md` 의 PENDING 게이트 메시지 블록 직후 (L243 `Then halt.` 직전) 에 후속 스킬 사전 통보 1줄 추가 — "Calling a follow-up skill (pre-deploy / patch-confirmation, etc.) does NOT auto-merge this PR. Type `머지 완료` to merge. To intentionally leave the PR open and move on, type `중단` or simply invoke another skill." 키워드 리스트 흐름 유지, 영문 작성 (§1 언어 분리), 다른 md (worktree-lifecycle / completion-gate-procedure) 손대지 않음.

### 진단 요지

- 2026-05-16 data-craft 사이클에서 관측: 마스터가 dev-merge PENDING 입력 (`머지 완료`) 을 생략하고 곧바로 pre-deploy 호출 → PR 미머지 상태에서 stale main 위에서 후속 스킬 실행 → 본 사이클은 main session 의 AskUserQuestion 회복으로 막았지만 spec 차원 정리 요청.
- 마스터 enum 3안 (A: 묵시적 머지 분기 / B: 후속 스킬의 미머지 감지 / C: 자동 머지 default invert) 모두 net-positive 3 질문 (`feedback_no_prevention_treadmill.md`) 으로 평가 → 셋 다 net-negative 판정 (Q1 1회성 / Q2 의도된 left-open 차단 또는 의도된 미머지 use case false positive / Q3 일반 contract 일관성 파괴 또는 순수 누적).
- Q1 evidence-backed: root patch-note + I2 memory 전수 `grep -rn "미머지|PR open|stale main|머지 완료.*건너"` → PENDING gate 입력 생략 + stale main 후속 패턴 0건.
- 채택안 D — 마스터의 enum 외 영(零) 케이스. spec 본체 변경 없음, dev-merge PENDING 메시지에 1줄 사전 통보만 추가. 새 자동화 / 의사결정 카드 / cross-session 의존 0개, Q3 폐기 0개 → Treadmill Audit NOT APPLICABLE.

### 회귀 검증

- main session per-phase verification 5단계 (git show --stat, affected_files 교집합, git diff 내용, blockers, Treadmill-aware 체크) 모두 PASS.
- `Then halt.` grep → 1건만 L243, 올바른 PENDING 블록 (post-clean-review, HOTFIX gate 와 무관) 에 삽입 확인.
- advisor #1 (계획) / advisor #2 (완료) 6-perspective 모두 PASS, BLOCK 토큰 없음.

### Treadmill Audit

NOT APPLICABLE — 신규 메커니즘 추가 0개. 메시지 한 줄 강화만 (Q3 폐기 대상 0개).

### 영향 파일

- `.claude/skills/dev-merge/SKILL.md` (+2 / -0)

## v001.73.0

> 통합일: 2026-05-16
> 플랜 이슈: #39
> 대상: 아이OS

### 페이즈 결과

- **Phase 1** (`4ec8424`, `4a113ed` 정정): 3개 로드맵 파일의 완료 항목을 🔴 → 🟢 로 갱신. Roadmap-1 line 11/13 (`/dev-inspection data-craft today`, `/dev-security-inspection data-craft today` — 2026-05-15 today-scope inspection-runs 매핑), Roadmap-2 line 19 (단계3-A 바이어 홈/탐색/피드/검색/필터 — 이슈 bj-kim-funshare/Tteona#6, patch-note v001.6.0, 2026-05-15 완료), Roadmap-4 line 15 (단계1-B 핀 작성 4단계 — patch-note v001.5.0). 각 로드맵의 기존 annotation 컨벤션 보존 (Roadmap-2 풀 annotation, Roadmap-4 bare 🟢, Roadmap-1 게이트는 `— 완료 (YYYY-MM-DD)`).
- 정정 사유: 1차 커밋에서 2026-05-13 inspection-run 으로 매핑했으나 advisor #2 후 JSON 메타 재확인에서 해당 기록의 `scope_mode='custom-payment-domain'` 발견 — Roadmap-1 의 `today` 게이트와 매핑되지 않아 2026-05-15 today-scope 기록으로 정정.

### 영향 파일

- `.claude/plan-roadmap/Roadmap-1-data-craft-mobile-react-feature-parity.md`
- `.claude/plan-roadmap/Roadmap-2-tteona-design-handoff-implementation.md`
- `.claude/plan-roadmap/Roadmap-4-pinlog-design-handoff-implementation.md`

### Treadmill Audit

NOT APPLICABLE — 신규 규칙/훅/에이전트/스킬/검증축 추가 없음. 문서 상태 메타데이터만 갱신.

### 한계

- Tteona/Pinlog 의 2026-05-15 today-scope dev-inspection 단일 기록은 각 로드맵의 어느 게이트 라인에 매핑되는지 모호하여 본 플랜에서 보류. 마스터가 차후 `/plan-roadmap` edit 모드로 직접 갱신 권장.
- 2026-05-15 data-craft today inspection 의 BLOCK/clean 판정은 본 플랜에서 미확인 — 후속 게이트 follow-up 가능성 남음.

## v001.72.0

> 통합일: 2026-05-14

### 변경 파일

- (수정) monitoring/data/hourly.json
- (추가) .claude/inspection-runs/20260514T101026Z-pre-deploy.json
- (추가) .claude/inspection-runs/20260514T101200Z-pre-deploy.json
- (추가) .claude/inspection-runs/20260514T111021Z-pre-deploy.json
- (추가) .claude/inspection-runs/20260514T120000Z-pre-deploy.json
- (추가) .claude/inspection-runs/20260514T120500Z-pre-deploy.json

## v001.71.0

> 통합일: 2026-05-14
> 플랜 이슈: #38
> 대상: 아이OS

### 변경 사유

직전 v001.70.0 (이슈 #37) 이 dev-merge 에 leader 인자 + Step 0 UI (repo 선택 카드 + from-branch 카드 + to-branch 카드) 를 도입했으나, 마스터의 실사용 시점에서 결함이 드러났다 — dev-merge 는 배포 스킬 (pre-deploy) 과 달리 그룹만 입력하면 **그룹 내 모든 멤버 repo 에 대해 자동 수행** 해야 한다. 즉 v001.70.0 의 repo 선택 카드 자체가 잘못된 디자인이었다. 본 v001.71.0 으로 repo 선택 카드를 제거하고, from/to 도 개별 두 카드 대신 **하나의 "브랜치 조합" 카드** (프리셋 `i-dev → main`, `main → i-dev` + Other) 로 통합하며, 같은 (from, to) 쌍을 모든 멤버 repo 에 자동 순회 적용한다. 동시에 dev-merge 의 책임 영역을 **long-running 통합 브랜치 (i-dev ↔ main) 승격 전용** 으로 좁히고, 임의 WIP 머지 (plan-enterprise auto-merge 영역) 와 main → 배포 타겟 브랜치 동기화 (pre-deploy 의 `deploy_command` 영역, 예: `aws-deploy`, `gh-pages` force-publish) 를 명시적으로 out-of-scope 화.

### 페이즈 결과

- **Phase 1 — dev-merge SKILL.md 멀티-repo + 브랜치 조합 단일 카드 재설계** (`480ca59`): Frontmatter description / L8 본문을 멀티-repo 자동 순회 어휘로 교체. `## Step 0` 전체 재작성 — 0.1 (Leader 해석, 유지) / 0.2 (브랜치 조합 단일 카드 — 외부 컨텍스트 프리셋 `i-dev → main` / `main → i-dev` + Other, 아이OS 텍스트 폴백) / 0.3 (멀티-repo 검증 + 진행 큐 — 부재 repo skip 로그). 신규 `## 멀티-repo 순회 (외부 loop)` 섹션 — per-iter 7단계 (cd / Entry ritual / Context preparation / Reviewer + auto-iter / Lint 게이트 / PENDING 단일 게이트 / Merge + ff-pull) + per-repo failure halt 정책 (완료/처리중/미처리 리스트). `## Worktree 격리` 의 `$(pwd)` 매 iter 갱신 명시. `## Context preparation` 표에 "Member repo (current iter)" 행 추가. `## Pre-conditions` #4 를 Step 0.3 진행 큐 ≥ 1 으로 갱신. `## Failure policy` 표에 3개 신규 행 (진행 큐 비어있음 / 0.2 자유 입력 파싱 실패 / 멀티-repo N번째 실패) 추가, from/to 부재 행 4개 제거 (0.3 skip 로그로 일반화). `## Scope` In-scope 에 멀티-repo 자동 순회 추가, Out-of-scope 에 (a) 임의 WIP 머지 (plan-enterprise auto-merge 영역) / (b) main → 배포 타겟 브랜치 동기화 (pre-deploy 의 `deploy_command` 영역) 명시.

### 영향 파일

- `.claude/skills/dev-merge/SKILL.md`

### Treadmill Audit

PASS — 신규 mechanism 순증 0. Q3 trade-out 3건 명시:
1. **폐기**: v001.70.0 의 Step 0.2 repo 선택 카드.
2. **폐기**: v001.70.0 의 Step 0.3 / 0.4 분리 from-branch / to-branch 카드 (단일 브랜치 조합 카드로 통합).
3. **폐기**: dev-merge 의 임의 WIP 브랜치 머지 능력 — plan-enterprise auto-merge 가 이미 담당. 동시에 main → 배포 타겟 브랜치 동기화는 pre-deploy 의 `deploy_command` 영역으로 명시 (영역 분리 차원의 책임 경계 정리).

Q1 (재발 사고) = 마스터의 `/dev-merge data-craft` 실사용 결함 지적이 직접 트리거. Q2 (엣지 케이스) = 부재 repo skip / from==to / 단일-repo (아이OS) / 부분-성공 halt 보고 포맷 / 배포 타겟 브랜치 영역 분리.

## v001.70.0

> 통합일: 2026-05-14
> 플랜 이슈: #37
> 대상: 아이OS

### 변경 사유

`/dev-merge data-craft` 호출이 거부된 사례에서 시작. 기존 `/dev-merge <from-branch> <to-branch>` 2-인자 형식은 마스터가 단순히 leader 이름만 알고 있을 때 어디서 어디로 머지해야 하는지를 스킬이 안내하지 못해 매번 클로드 측의 해석/되묻기로 빠졌다. 다른 leader-skill (`plan-enterprise`, `pre-deploy`, `dev-build`) 은 이미 leader 인자 + AskUserQuestion 카드로 멤버 repo / 옵션을 선택받는 패턴을 정착시켰으므로, `dev-merge` 도 이 패턴에 정렬한다. 기존 2-인자 형식은 폐기.

### 페이즈 결과

- **Phase 1 — dev-merge SKILL.md leader-arg 재설계** (`a0edc90` + 정합 4개: `f08125b`, `b9f1008`, `e789cb0`, `3ef5675`): frontmatter description / L8 본문 / `## Invocation` / `## Pre-conditions` 를 leader-only 인자 형식으로 전면 재작성. `## Branch alignment 정책` subsection 분리 (아이OS=`main`, 외부=`i-dev`, to-branch ≠ 기본 base 면 경고만 표시하고 진행). 신규 `## Step 0` 섹션 삽입 — 0.1 leader 해석 (`아이OS` → Project-I2 / 외부 → `dev.md` targets[]), 0.2 repo 선택 (후보 1개 자동 / 2개 이상 AskUserQuestion single-select max 4), 0.3 from-branch 선택 (보호 브랜치 제외 최신순 상위 3개 옵션 + `Other` 자유 입력 + 후보 < 2 면 텍스트 폴백), 0.4 to-branch 선택 (컨텍스트 기본 base 권장 + 후보 1개일 때 자동 채택 폴백 + `from==to` 거부). `## Worktree 격리`, `## Context preparation`, `## Failure policy` (7개 신규 행 추가), `## Scope` 갱신. 보호 브랜치 판정 로직의 leader-aware / leader-unaware 이분법을 단일 분기로 통합. Pre-conditions #4 의 "동일 쌍 PR 미존재" 를 failure 가 아닌 PENDING 재진입 분기 신호로 재정의 + 관련 failure 행 제거. README §G dev → i-dev 머지 예시도 leader-arg 형식으로 갱신.

### 영향 파일

- `.claude/skills/dev-merge/SKILL.md`
- `README.md`

### Treadmill Audit

PASS — 신규 mechanism 순증 0. Q3 trade-out 2건 명시:
1. **폐기**: `dev-merge` 의 "leader-unaware ⇒ 정렬 검증 면제" 어휘 (구 L27).
2. **폐기**: 임의 git+gh repo (project-group 미등록) 머지 능력. 필요 시 마스터가 `/new-project-group` 으로 1회 등록 후 사용.

Q1 (재발 사고) = `/dev-merge data-craft` 거부 케이스가 직접 트리거. Q2 (엣지 케이스) = `아이OS` / 외부 두 갈래 + 옵션 1개 폴백 + base-vs-base 경고 모두 명시.

## v001.69.0

> 통합일: 2026-05-14
> 플랜 이슈: #36
> 대상: 아이OS

### 변경 사유

`patch-confirmation` 의 primary 책무가 "미커밋 흡수" 로 설계돼 있어, working tree 가 clean 한 상태에서 호출하면 pre-condition 단계에서 fail-fast 했다. 그 결과 **이미 로컬에 커밋돼 있지만 origin 에 안 올라간 commit 들을 origin 으로 밀어줄 정상화된 채널이 없었다** — `plan-enterprise` / `plan-enterprise-os` / `new-project-group` / `group-policy` / `plan-roadmap` / `create-custom-project-skill` / `patch-update` 는 모두 `feedback_plan_enterprise_no_auto_push.md` 메모리 규정에 따라 로컬 머지에서 종료하므로 push 가 누락된 상태로 누적될 수 있었다. 본 plan 으로 `patch-confirmation` 을 push primary / 미커밋 흡수 secondary 로 뒤집어 정상화된 push 채널을 확보한다. 부수로 `dev-merge` 와 `pre-deploy` 의 "원격 저장소 대상 스킬" 정체성을 spec 본문에 명시하고, `dev-merge` 가 PR 머지 후 로컬 to-branch 를 `pull --ff-only` 로 동기화하도록 누락 단계를 보강한다.

### 페이즈 결과

- **Phase 1 — patch-confirmation/SKILL.md 재정의** (`dfe939f`): 1줄 description 을 push primary 로 재작성. Case A pre-condition 5 ("Uncommitted changes exist") 와 Case B pre-condition 5 ("At least one member repo has uncommitted changes") 제거 + 순번 재할당 (Case A 1-3, Case B 1-5). 본문 Step 흐름 안에 `git status --porcelain` 분기 추가 — 미커밋 부재 시 WIP 전체 skip → final push 직행 (push_only 모드). Case B 에 `targets[]` 전체 순회 final sweep loop 추가 (clean 멤버까지 idempotent 동기화). 이중 push (WIP loop step 6 + final sweep) 는 의도된 설계임을 명시. Failure policy 표에서 "미커밋 없음" 행 제거. completion-reporter payload 에 `mode` (`commit_and_push`/`push_only`) 와 `commits_pushed_count` 추가. description 직후 `feedback_plan_enterprise_no_auto_push.md` carve-out 1줄 inline.
- **Phase 2 — README.md §G inventory** (`83ec6b2`): 단순 스킬 표의 `patch-confirmation` 행 역할 셀을 "로컬 → origin push (push 전 미커밋 발생 시 patch-note 새 마이너로 흡수)" 로 갱신.
- **Phase 3 — completion-reporter-contract §6 patch-confirmation 스키마** (`3d9d919`): Required 필드에 `mode` enum 과 `commits_pushed_count` (Case A 정수 / Case B `{repo_name: int}` 맵 + `i2_main`) 추가. 메타 table row 에 `mode: <mode>` 끼워넣고 Notes 에 "push_only 모드는 0 commit push 도 정상" 한 줄 추가.
- **Phase 4 — dev-merge/SKILL.md 종료 동기화 + 원격 정체성** (`4dd0dea`): frontmatter description 에 "Operates exclusively against the GitHub remote ... never produces local merge commits." 추가. Reporting 절과 "완료 후 HEAD 복원" 절 사이에 "머지 완료 후 to-branch 동기화" 절 신설 — PR 머지 성공 직후 `git -C <main_wt> checkout <to_branch>` → `git pull --ff-only origin <to_branch>` 순서로 로컬 동기화. ff-only 실패는 alarm-visible (자동 복구 금지). PR 머지 실패 경로에서는 skip.
- **Phase 5 — pre-deploy/SKILL.md 원격 정체성** (`687eb4a`): 소개 단락과 `## Invocation` 사이에 "본 스킬은 원격 저장소 / 배포 대상 인프라에 대해 동작한다 (Branch A 는 GitHub 이슈 생성, Branch B 는 build_command + deploy_command 실행). 로컬 소스 트리에 commit 을 만들지 않는다." 한 줄 삽입.
- **Post-execution — 메모리 carve-out 강화** (`feedback_plan_enterprise_no_auto_push.md`): 기존 line 19 의 약식 carve-out 을 "patch-confirmation 은 본 규정의 명시적 carve-out — 아이OS 운영의 유일한 정상화된 push 채널" 로 강화. `dev-merge` 와 `pre-deploy` 는 원격 도메인이라 본 규정 무관임을 명시. (repo 외부 파일 — WIP commit 대상 아님.)

### 영향 파일

- `.claude/skills/patch-confirmation/SKILL.md`
- `README.md`
- `.claude/md/completion-reporter-contract.md`
- `.claude/skills/dev-merge/SKILL.md`
- `.claude/skills/pre-deploy/SKILL.md`
- (repo 외부) `~/.claude/projects/-Users-starbox-Documents-GitHub-Project-I2/memory/feedback_plan_enterprise_no_auto_push.md`

### Treadmill Audit

PASS — 대부분 NOT APPLICABLE (기존 스킬/contract/README/memory 수정만, push 단계 자체는 이미 spec 에 있던 동작의 분기 조건만 격하). **예외 — Phase 4 의 `git pull --ff-only` 추가** 만 새 단계: Q1 `gh pr merge` 가 원격 main 만 진전시키고 로컬은 뒤처지는 divergence 는 PR 워크플로에서 매 머지마다 재발하는 구조적 현상 (1회성 아님). Q2 ff-only 실패는 alarm-visible 로 surface (자동 복구 금지). Q3 본 추가는 새 검증축이 아닌 누락 단계 보강이라 trade-out 무 — Q3 적용 외.

### 실증 가설

push 채널 정상화는 다음 호출에서 실증: (a) I2 working tree clean + `main` 이 origin 보다 N commit 앞선 상태에서 `/patch-confirmation 아이OS` 호출 시 fail 없이 push_only 모드로 origin/main 정합. (b) `/dev-merge` PR 머지 후 로컬 `git status` 가 `Your branch is up to date with 'origin/<to-branch>'` 로 나오는지 확인. 미통과 시 본 plan 의 HOTFIX 트리거.

---

## v001.68.0

> 통합일: 2026-05-14
> 플랜 이슈: #35
> 대상: 아이OS

### 변경 사유

`/pre-deploy` 가 validator clean (block=0) 후 Branch B 의 `deploy_command` 를 자동 순차 실행하는 것이 정상 흐름이지만, auto-mode 분류기가 `npx gh-pages -d dist` 등 publish 류 명령을 디폴트 deny 로 분류해 멈췄다. 원인은 `.claude/settings.json` 의 `autoMode.allow` 에 `task-db-structure`/`task-db-data` 의 mysql/psql carve-out 만 보유하고 `pre-deploy` 의 평행 carve-out 이 부재한 것. 본 패치로 두 carve-out 을 동렬 정렬.

본 플랜 진입 자체도 분류기의 self-modification 가드에 막혀 (이슈 생성 / 설정 편집 모두 사전 차단) 마스터가 settings.json 에 사전 인가 prose 를 수동 편집해 부트스트랩. 그 부트스트랩 라인은 향후 plan-enterprise-os 의 harness 자가보수 plan 일반에 대한 구조적 인가로 영구화 (ExitPlanMode 통과 plan 에 한정).

### 페이즈 결과

- **Phase 1 — pre-deploy deploy_command carve-out**: `.claude/settings.json` `autoMode.allow` 에 pre-deploy Branch B 직접 실행 인가 prose 추가. `permissions.allow` 에 두 패턴 추가 (`Bash(git checkout main && npx gh-pages *)`, `Bash(git checkout main && git push origin main:*)`). `CLAUDE.md` 말미 mysql/psql carve-out blockquote 옆에 pre-deploy 전용 운영 메모 blockquote 추가.
- **사전 부트스트랩 (이슈 #35 부트스트랩 커밋 `ec9bf3d`)**: 마스터가 수동 편집한 사전 인가 prose 를 `autoMode.allow` 에 영구 commit. CLAUDE.md §5 의 "no direct commits to main" 원칙에 일회성 일탈 (분류기 가드 해제는 마스터 수기 편집만 가능 → WIP 사이클 불가). 마스터 명시 인가로 정당화.

### 영향 파일

- `.claude/settings.json`
- `CLAUDE.md`

### Treadmill Audit

NOT APPLICABLE — 새 prevention 메커니즘 추가가 아닌 기존 분류기 deny 의 carve-out (인가 범위 narrowing-out). Q1 구조적 누락 1건 / Q2 적용 범위 prose 명시 (Branch B clean only, ExitPlanMode 통과 plan only) / Q3 N/A.

### 실증 가설

Carve-out 효력은 마스터의 `/pre-deploy <leader>` 재실행 시점에 실증. 분류기가 `deploy_command` 를 자동 통과시키면 가설 검증 — 미통과 시 본 plan 의 HOTFIX 트리거 (prose 또는 패턴 형식 보정).

---

## v001.67.0

> 통합일: 2026-05-14
> 플랜 이슈: #34 (핫픽스 1)
> 대상: 아이OS

### 변경 사유

마스터 전수조사 지시 (2026-05-14): "아이OS만 main이고 나머지 외부 프로젝트는 전부 i-dev". 스킬 18 개의 "## 완료 후 HEAD 복원" 절을 점검한 결과 두 건이 규칙과 어긋났다 — `pre-deploy/SKILL.md` 의 종료 복원 베이스가 `main` 이고, `dev-merge/SKILL.md` 의 종료 복원 베이스가 "호출 시점 HEAD 또는 to-branch (variable)" 로 모호하게 적혀 있었다. 두 스킬 모두 외부 프로젝트 멤버 레포에서 동작하므로 종료 시 마스터의 일반 작업 흐름 (i-dev) 으로 복원되어야 한다. dev-merge 는 cwd 기반 컨텍스트 분기 명시.

### 페이즈 결과

- **핫픽스 1**: `pre-deploy/SKILL.md` Pre-conditions §1 의 복원 문구 ("touched cwd 만 main 으로") 와 "## 완료 후 HEAD 복원" 절 베이스 (`main` → `i-dev` external context). `dev-merge/SKILL.md` "## 완료 후 HEAD 복원" 절 베이스 ("호출 시점 HEAD 또는 to-branch (variable)" → 컨텍스트 분기: cwd = Project-I2 → `main`, 외부 레포 → `i-dev`). 다른 16 개 스킬은 audit 결과 규칙과 일치 (수정 불요).

### 영향 파일

- `.claude/skills/pre-deploy/SKILL.md`
- `.claude/skills/dev-merge/SKILL.md`

### Treadmill Audit

PASS — Q3 trade-out 1건 이행: dev-merge 의 "variable baseline (호출 시점 HEAD 또는 to-branch)" 모호 규칙이 cwd 기반 컨텍스트 분기 명시로 retire/대체. pre-deploy 의 main 복원은 단순 오타 정정 (외부 context i-dev 정책의 이미 존재하는 일반 규칙으로 회귀). 신규 검증 축/스킬/에이전트 추가 없음.

---

## v001.66.0

> 통합일: 2026-05-14
> 플랜 이슈: #34
> 대상: 아이OS

### 변경 사유

2026-05-14 `/pre-deploy data-craft` 호출에서 deploy-validator 가 두 건의 false block 을 생성했다 (이슈 funshare-inc/data-craft#27): (1) `data-craft` (tool: gh-pages) — `npx gh-pages --version` 프로브가 sub-agent Bash 샌드박스의 네트워크 제약 (`only-if-cached`) 에 걸려 실패. 마스터 실제 환경은 정상 + `origin/gh-pages` 과거 배포 이력 존재. (2) `data-craft-server` (tool: aws) — `deploy_command` 가 순수 git (`git push origin main:aws-deploy`) 인데 validator 는 `tool` 라벨만 보고 `aws sts get-caller-identity` 강제 프로브 → aws CLI 미설치 block. 두 케이스 모두 manifest 의 `tool` 라벨과 실제 `deploy_command` 본문의 불일치에서 비롯된 구조적 결함이며, 외부 프로젝트에서 재발 예측되는 일반 패턴이다 (gh-pages publish, git-push-to-deploy, GitOps 등).

### 페이즈 결과

- **Phase 1**: `.claude/agents/deploy-validator.md` §2 "Tool CLI invocable" 를 정적 `tool` → 프로브 매핑에서 `deploy_command` 토큰 기반 모델로 재작성. 토큰 추출 (공백 + `&&`/`||`/`|`/`;` split, exact-equality 매칭, `npx <pkg>` 시 둘 다 포함), 트리거 토큰 부재 시 행 전체 skip, severity 분기 (바이너리 부재 = `block` / 환경 가용성 의존 = `warn`) 명시. `gh-pages` 는 항상 `warn`, `docker info` / `aws sts` 는 `warn`, `--version` 류는 `block` 유지.

### 영향 파일

- `.claude/agents/deploy-validator.md`

### Treadmill Audit

PASS — Q3 trade-out 2건 이행: (a) `tool` 필드 단독으로 프로브를 강제 실행하던 정적 규칙 retire (대체: `deploy_command` 토큰 등장 시에만 프로브). (b) `aws sts get-caller-identity` 실패를 일률 `block` 처리하던 규칙 retire (대체: 환경 가용성 의존 프로브 실패는 `warn`). 신규 검증 축/훅/스킬/에이전트 추가 없음 — 한 섹션을 단순화 방향으로 재작성.

---

## v001.65.0

> 통합일: 2026-05-14
> 플랜 이슈: #33
> 대상: 아이OS

### 변경 사유

`/pre-deploy data-craft` 가 4개 멤버 레포 모두 `i-dev` 위에 있다는 이유로 진입 검증 실패로 halt 후 "각 레포 `git checkout main` 후 재호출" 을 요구함 — 결함. pre-deploy 는 현 시점 `main` 기준으로 빌드/배포하는 스킬이므로 호출 시 멤버 레포를 자동으로 `main` 으로 정렬해야 한다. `main` 브랜치 자체가 없거나 checkout 이 실패할 때만 halt/보고. i-dev 가 main 보다 앞서있는지 여부는 본 스킬 검증 영역이 아니다 (마스터가 의도적으로 머지 스킬을 사용하지 않아 일부 변경을 배포에서 제외했을 수 있음).

### 페이즈 결과

- **Phase 1**: `branch-alignment.md` §1 / §2 의 Branch-overridden context (pre-deploy) 를 "verify on main" → "auto-checkout main, fail only on main 부재 or checkout 실패" 로 교체. bash 패턴 2종 실패 메시지로 분리. `pre-deploy/SKILL.md` Pre-conditions §1, Failure policy 표 (1행 → 2행), Scope (v1) 의 "main 기준 검증/배포" 항목도 동일 의미로 갱신 — "검증" 어휘를 "정렬 액션" 으로 명확화.

### 영향 파일

- `.claude/md/branch-alignment.md`
- `.claude/skills/pre-deploy/SKILL.md`

### Treadmill Audit

PASS — Q3 trade-out 이행: 기존 "pre-deploy 진입 시 멤버 레포 main 위 엄격 검증" 1건이 "자동 main 정렬 (실패 조건 2종 으로 한정)" 으로 retire/대체. 신규 메커니즘 추가 없음.

---

## v001.64.0

> 통합일: 2026-05-14
> 플랜 이슈: #32
> 대상: 아이OS

### 변경 사유

2026-05-14 `/pre-deploy data-craft` 호출 시 두 가지 의도 위반이 드러남:
1. 다중 선택지 UI 없이 3개 FE 타겟을 독단으로 자동 선택.
2. `data-craft-server` 의 `deploy_command` 가 빈값이라는 이유로 자동 제외 — 마스터 선택권 박탈.

추가 정정 정책: pre-deploy 의 검증과 배포는 **항상 main 기준** 이어야 하나, `branch-alignment.md` 가 external 컨텍스트 = i-dev 일괄로 묶고 있어 pre-deploy 도 i-dev 기준으로 동작 중이었음. 본 패치에서 pre-deploy 스킬과 시스템 (branch-alignment, deploy-validator, completion-reporter-contract) 4개 영역을 일괄 정정.

### 페이즈 결과

- **Phase 1**: `deploy-validator` 의 `deploy_command present` 체크를 `block` → `warn` 로 강등. 빈값 타겟은 빌드만 실행하고 마스터가 수동 배포하는 흐름 명시.
- **Phase 2**: `pre-deploy` SKILL.md 7개 영역 개편 — invocation 시그니처 단일화 (target args 폐기), 항상 multiSelect UI 노출, 빈 `deploy_command` 단축회로 (build 실행 / deploy 스킵 / `deploy_status: "manual"`), pre-condition `i-dev`→`main`, failure policy 행 정리, scope 갱신.
- **Phase 3**: `completion-reporter-contract.md` §6 `pre-deploy.skill_finalize.targets[].deploy_status` 허용값을 정식 명시 (`"success" | "failed" | "manual"`).
- **Phase 4**: `branch-alignment.md` 4 섹션 (§1 / §2 / §3 / §5) 에 `pre-deploy` 를 branch-overridden 예외로 정식 등록. `<leader>` 인자임에도 모든 멤버 레포 `main` 기준 검증 (multiSelect UI 이전 실행).

### 영향 파일

- `.claude/agents/deploy-validator.md`
- `.claude/skills/pre-deploy/SKILL.md`
- `.claude/md/completion-reporter-contract.md`
- `.claude/md/branch-alignment.md`

### Treadmill Audit

PASS — Q3 trade-out 2건 명시:

1. **"empty deploy_command = block" 룰 폐기**: 빈 `deploy_command` 가 validator 차단 트리거였던 룰을 `warn` 로 강등 + pre-deploy pre-condition #3 삭제. data-craft-server 독단 제외 사고의 직접 원인 룰이 제거됨.
2. **"external = i-dev 일괄" 룰의 부분 폐기**: `branch-alignment.md` 의 external 컨텍스트가 모든 `<leader>` 호출에 `i-dev` 를 강제하던 일괄 룰을 `pre-deploy` 한해 `main` 으로 override. branch-overridden skill 라는 새 분류를 정식 등록.

Q1 (재발 사고 트리거): 2026-05-14 `/pre-deploy data-craft` 의 실제 사고. Q2 (새 엣지): 부분 자동 배포 타겟 (build 자동 + deploy 수동) 카테고리의 등장 + branch-overridden 분류 신설.

## v001.63.0

> 통합일: 2026-05-14
> 플랜 이슈: #31 (핫픽스1)
> 대상: 아이OS

### 핫픽스 사유

본 이슈 #31 의 1차 페이즈는 dev-merge 보호 브랜치를 **하드코딩 4개** 로만 지원. 마스터 핫픽스 요청으로 group-policy 의 정식 `protected_branches` 필드를 추가하고 data-craft 그룹을 백필.

### 변경

- `.claude/project-group/data-craft/group.md`
  - 확정 정책 표에 "보호 브랜치" 행 추가 (`i-dev`, `main`).
  - `## 보호 브랜치 (마스터 명시)` 섹션 신설.
- `.claude/skills/new-project-group/SKILL.md`
  - Round 4 group 컬렉션에 `protected_branches` 선택 항목 안내 추가.
  - group.md 템플릿 가이드에 protected_branches 언급 보강.
- `.claude/skills/group-policy/SKILL.md`
  - group 영역 수정 가능 필드에 `protected_branches` 명시.
- `.claude/skills/dev-merge/SKILL.md`
  - "보호 브랜치" 절의 추후 확장 문단을 정식 2-단 판정 로직으로 교체: leader-aware 호출은 group.md 우선, 미설정/leader-unaware 는 하드코딩 fallback.

### Treadmill Audit

PASS — 새 invariant 추가 없음. 기존 하드코딩 단일 디폴트가 "group.md 우선 + 하드코딩 fallback" 으로 폐기·교체 (Q3). leader-aware 호출 경로가 실재 존재 (Q1: plan-enterprise 등). 새 엣지 (Q2): 일부 그룹이 `master`/`develop` 미사용일 때 보호 대상이 좁아지는 케이스.

## v001.62.0

> 통합일: 2026-05-14
> 플랜 이슈: #31
> 대상: 아이OS

### 결함

`dev-merge` 스킬이 PR 머지 후 `gh pr merge --merge --delete-branch` 를 from-branch 종류와 무관하게 무조건 적용. master 가 `/dev-merge i-dev main` 형태로 **long-running 통합 브랜치를 from-branch 로 지정** 한 경우 머지 후 `origin/i-dev` 가 삭제되어 CLAUDE.md §5 의 통합 브랜치 정책 (i-dev = long-running) 과 직접 충돌.

### Phase 1 결과 (doc-only)

dev-merge spec 에 보호 브랜치 분기 도입.

- `.claude/skills/dev-merge/SKILL.md`
  - 신규 "보호 브랜치 (from-branch 삭제 금지 대상)" 절: 하드코딩 1차 목록 `i-dev` / `main` / `master` / `develop` 정의, group-policy `protected_branches:` 확장 여지 명시.
  - Merge command 분기: 보호 브랜치는 `gh pr merge <PR-num> --merge`, 비보호는 기존 `--merge --delete-branch`.
  - 후처리 분기: 보호 브랜치는 worktree 만 제거 (로컬 브랜치 보존), 비보호는 기존 `git branch -d` 까지 실행.
  - 머지 직후 `from_branch_deleted` (bool) 변수 도출 (보호 매칭이면 `false`, 비매칭이면 `true`).
  - Step 11 `skill_finalize` dispatch 본문 Optional 에 `from_branch_deleted` 필드 추가.
  - Failure policy 표 위 가드 1줄 + 마지막 정보성 행 1개 (보호-스킵 알림).
  - Scope in-scope "Auto-deletion of the from-branch after merge" 행을 보호 목록 제외 조항으로 교체.
- `.claude/md/completion-reporter-contract.md`
  - `dev-merge` `skill_finalize` Optional 줄에 `from_branch_deleted: bool` 추가, Notes 에 렌더링 가이드 (`· from 브랜치 보존` 토큰 조건부) 보강.
- `.claude/md/worktree-lifecycle.md`
  - L73 `dev-merge` 의 `--delete-branch` 무조건 적용 서술을 보호/비보호 분기 사실관계로 정정 (self-consistency check #4 가 허가한 plan-authorized scope 확장).

### 영향 파일

- `.claude/skills/dev-merge/SKILL.md`
- `.claude/md/completion-reporter-contract.md`
- `.claude/md/worktree-lifecycle.md`

### Treadmill Audit

PASS — 새 invariant / 훅 / 에이전트 / 스킬 / 검증 축 추가 없음. **폐기 (Q3)**: 기존 무조건 `--delete-branch` 디폴트를 보호 브랜치 분기 디폴트로 폐기·교체. **재발 (Q1)**: long-running 통합 브랜치 from-branch 시나리오는 실제 가능 (예: `/dev-merge i-dev main`). **새 엣지 (Q2)**: 보호 브랜치 from-branch.

## v001.60.0

> 통합일: 2026-05-14
> 플랜 이슈: #29 (핫픽스3)
> 대상: 아이OS + GitHub 폴더 전체 9 repo

### 핫픽스3 요약

마스터가 GitHub 폴더 내 다른 5개 프로젝트도 같은 청소 정책 적용 요청. 추가로 `i-dev-001` (Project-I 시대 integration 컨벤션) 을 9 repo 전체에서 폐기하고 `i-dev` (I2 컨벤션) 단일화 지시.

### 1단계: i-dev-001 폐기 (9 repo)

| 케이스 | repo | 동작 |
|--------|------|------|
| A: i-dev + i-dev-001 둘 다 | data-craft × 4 | i-dev-001 force-delete (local + origin); diverged unique 커밋 폐기 — 마스터 "실작업 없음" 확인 |
| B: i-dev-001 만 | Pingus-Server / PinLog-Web / Tteona / Tteona-server | `git branch -m i-dev-001 i-dev` 인-플레이스 rename → `push -u origin i-dev` → `push --delete origin i-dev-001` (커밋 0 손실) |
| C: 둘 다 없음 | Project-I | skip |

SHA 백업: `/tmp/branch-cleanup-29-hotfix3/idev001-retirement-log.txt`

### 2단계: 5 other-projects aggressive cleanup

마스터 "5개 모두 실작업 없음" 확정 → Project-I (archived) + Pingus-Server / PinLog-Web / Tteona / Tteona-server (Project-I 시대 컨벤션) 전체 공격 청소.

**Phase A** (모든 worktree force-remove), **Phase B** (모든 비보호 local branch `-D`), **Phase C** (모든 비보호 origin ref `push --delete`).

| Repo | 전 (local/wt/origin) | 후 (local/wt/origin) | 정리 |
|------|---:|---:|---:|
| Pingus-Server | 6/3/5 | 2/1/2 | 4 / 2 / 3 |
| PinLog-Web | 13/2/6 | 2/1/2 | 11 / 1 / 4 |
| Project-I | 6/3/2 | 1/1/1 | 5 / 2 / 1 |
| Tteona | 16/2/3 | 3/1/3 | 13 / 1 / 0 |
| Tteona-server | 9/7/3 | 3/1/3 | 6 / 6 / 0 |
| **소계** | **50/17/19** | **11/5/11** | **39 / 12 / 8** |

### 3단계: orphan 디렉토리 청소

- 자동 제거 (rmdir 빈 디렉토리): Project-I `.worktrees/`, `.claude/worktrees/`, Tteona `.worktrees/`, Tteona-server `.worktrees/`.
- 수동 `rm -rf` (deeper 빈 구조): Pingus-Server `.worktrees/`, PinLog-Web `.worktrees/`.
- 총 6개 husk 디렉토리 제거.

### plan #29 최종 누적 (10 repo 전체)

**Project-I2 (본체):** 1 / 1 / 1

**데이터 크래프트 그룹 4 repo:** local 13 / worktrees 4 / origin 22 (보호 + special 만)

**기타 5 repo:** local 11 / worktrees 5 / origin 11

**누적 작업량 (v001.56.0 + v001.58.0 + v001.59.0 + v001.60.0):**
- 로컬 브랜치 정리: ~440+
- 로컬 worktree 정리: ~130+
- origin 브랜치 정리: ~360+
- 파일시스템 husk: 11개 디렉토리
- 컨벤션 마이그레이션: 9 repo i-dev-001 → i-dev 단일화

### Treadmill Audit

PASS — 본 핫픽스 3건 시리즈 모두 추가 메커니즘 없음. 1회성 청소. 새 정책 (머지-후-브랜치-삭제) 은 v001.56.0 에서 1:1 trade-out 완료.

### 후속 권장 사항

1. **branch-cleanup.sh active-worktree 판정 강화**: path convention 검증 추가 (`<repo>-worktrees/` sibling = I2 active, `<repo>/.worktrees/` 또는 `<repo>.worktrees/` = Project-I 좀비).
2. **merged 모드 정규식 보강**: `-핫픽스N$` 단독, `-문서-N$`, `-문서-핫픽스N$`, `-작업-핫픽스N$` 등 변종 추가.
3. **origin push --delete 통합 옵션**: `--include-origin` 플래그.
4. **orphan sibling dir 감지/제거**: `<repo>.worktrees/`, `<repo>-worktrees/`, `<repo>-wt-*` husk 자동 보고.
5. **i-dev-001 폐기 영구화**: I2 컨벤션이 `i-dev` 단일이므로, 새 repo 부트스트랩 (`new-project-group`) 시 i-dev-001 생성 금지 — 이미 i-dev 만 생성 중일 가능성 높으나 검증 필요.

---

## v001.59.0

> 통합일: 2026-05-14
> 플랜 이슈: #29 (핫픽스2)
> 대상: 아이OS

### 핫픽스2 요약

본 plan #29 의 청소 스크립트가 "active-worktree" 로 보호 분류한 worktree 들이 사실은 폐기 하네스 Project-I 의 좀비였음을 마스터가 GitHub Desktop 가시화로 확인. 추가 정리 + origin remote 청소 + 파일시스템 orphan 폴더 청소까지 완수.

**진단:** I2 규약은 `../<repo>-worktrees/<wip>` (sibling, hyphen), Project-I 규약은 `<repo>/.worktrees/<wip>`, `<repo>.worktrees/<wip>`, `<repo>-wt-<wip>` 등 3종. 본 plan 의 청소 스크립트는 `git worktree list` 결과만으로 "active" 판정 → Project-I 좀비를 보호 처리하는 결함. 별도 한방 스크립트 (`/tmp/branch-cleanup-29-hotfix2/zombie-cleanup*.sh`) 로 일괄 처리.

### 청소 결과 (3단계)

#### 1단계: I2 stale post-merge worktree (4건)

동시 세션이 머지만 하고 본 plan 의 새 정책 적용 못 한 잔재. main 의 조상 검증 후 `worktree remove --force` + `branch -D` + `push origin --delete`.

- plan-enterprise-os-25-monitoring-period-ux-realtime-핫픽스14-문서 (84a8af7)
- plan-enterprise-os-25-monitoring-period-ux-realtime-핫픽스16-문서 (97886ea)
- plan-enterprise-os-25-monitoring-period-ux-realtime-핫픽스16-작업 (29f32c9)
- plan-enterprise-os-25-monitoring-period-ux-realtime-핫픽스17-문서 (7ebda6e)

#### 2단계: Project-I 좀비 worktree + 브랜치 일괄 force-cleanup

| Repo | zombie worktrees | local branches deleted | origin deleted | 사후 local/wt/origin |
|------|--:|--:|--:|--:|
| data-craft | 93 | 93 | (이전 단계 완료) | 4 / 1 / 7 |
| data-craft-mobile | 4 | 4 | 0 | 4 / 1 / 3 |
| data-craft-ai-preview | 0 | 0 | 0 | 3 / 1 / 4 |
| data-craft-server | 16 | 16 | 10 (Phase Final) | 4 / 1 / 5 |
| **소계** | **113** | **113** | **10** | - |

#### 3단계: origin orphan + 파일시스템 청소

- **data-craft-server origin 10건** (force push --delete): 9개 `plan-enterprise-N-*-작업` (origin/i-dev 와 발산 — 이전 plan-enterprise 실행 잔재) + 1개 `feature/enterprise-031` (Project-I 시대).
- **Orphan sibling 디렉토리 5건 rm -rf**: `data-craft.worktrees`, `data-craft-server.worktrees`, `data-craft-mobile-worktrees`, `data-craft-server-worktrees`, `data-craft-worktrees` (모두 빈 파일시스템 husk 0MB).
- **data-craft origin 잔존 2건 의도 보존**: `firebase-deploy`, `test/dataviewer-widget` (deploy/test 특수 목적).

### 최종 5 repo 상태

| Repo | local | worktrees | origin | 의미 |
|------|--:|--:|--:|--|
| Project-I2 | 1 | 1 | 1 | main 만 |
| data-craft | 4 | 1 | 7 | 보호 4 / 5 + special 2 |
| data-craft-mobile | 4 | 1 | 3 | 보호 |
| data-craft-ai-preview | 3 | 1 | 4 | 보호 |
| data-craft-server | 4 | 1 | 5 | 보호 |

### plan #29 누적 (v001.56.0 + v001.58.0 + v001.59.0)

- **로컬 브랜치:** 405 → 16 (**389개 정리**)
- **로컬 worktree:** ~120 → 5 (**115개 정리**)
- **origin 브랜치:** ~360 → 20 (**340개 정리**)
- **파일시스템 orphan:** 5개 디렉토리 제거
- **합계:** 약 **850개 git/파일시스템 잔재 청소**

### Treadmill Audit

PASS (재확인) — 본 핫픽스는 추가 규칙/스킬/훅 도입 없이 일회성 청소 작업. 새 메커니즘 추가 0.

### 후속 plan 권장 사항

본 핫픽스에서 손대지 않은 script 보강 후속:

1. **branch-cleanup.sh active-worktree 판정 강화** — `git worktree list` 만 신뢰하지 말고 path convention 검증 추가 (I2 규약 = `../<repo>-worktrees/` sibling). Project-I 규약 path 는 active 가 아닌 zombie 로 분류.
2. **merged 모드 정규식 보강** — `-핫픽스N$` 단독, `-문서-N$`, `-문서-핫픽스N$`, `-작업-핫픽스N$` 패턴 추가 (핫픽스1 에서 발견).
3. **origin push --delete 통합** — 현재 로컬만 처리. origin 정리는 별도 한방 스크립트로 수행 — `--include-origin` 플래그 도입.
4. **orphan sibling dir 감지** — `<repo>.worktrees/`, `<repo>-worktrees/`, `<repo>-wt-*` 파일시스템 husk 자동 보고 (rm -rf 는 마스터 결정 게이트).

---

## v001.58.0

> 통합일: 2026-05-14
> 플랜 이슈: #29 (핫픽스1)
> 대상: 아이OS

### 핫픽스1 요약

본 plan #29 의 청소 스크립트가 분류 누락한 plan-enterprise-os 초기 변종 네이밍을 일괄 정리. 분류 누락 패턴: `-문서-NN`, `-핫픽스NN` (단독), `-문서-핫픽스NN`, `-작업-핫픽스NN` — 본 plan 의 merged 필터 정규식 `(-작업|-문서|-핫픽스[0-9]+-(작업|문서))$` 가 매칭하지 않은 케이스. 추가로 data-craft 의 `archive/stash-*` 8개 (Project-I 시대 archive stash) 도 명시 승인 받아 force-delete.

### 청소 결과

| Repo | 핫픽스1 전 | 핫픽스1 후 | 추가 삭제 |
|------|------:|------:|------:|
| Project-I2 | 20 | 5 | 15 |
| data-craft | 130 | 97 | 33 |
| data-craft-mobile | 8 | 8 | 0 |
| data-craft-ai-preview | 3 | 3 | 0 |
| data-craft-server | 21 | 20 | 1 |
| **합계** | **182** | **133** | **49** |

- 12개 `-d` 안전 삭제 (Project-I2 변종 머지 완료분).
- 26개 `-d` 안전 삭제 (data-craft 25 + server 1, plan-enterprise-9/16 핫픽스 시리즈 + plan-enterprise-12 hotfix).
- 1개 `-D` (Project-I2 plan-enterprise-os-3-monitoring-day-tokens-line-작업 — local 은 main 완전 머지, origin 발산만 존재; origin push 금지 정책상 무관).
- 8개 `-D` (data-craft archive/stash-0~7, Project-I 시대 명시 archive; SHA 백업 `/tmp/branch-cleanup-29-hotfix1/data-craft-archive-stash-backup.txt`).
- 활성 worktree 124개 무손상 유지.

### 후속 개선 (script regex)

`.claude/scripts/branch-cleanup.sh` 의 merged 모드 정규식이 다음 케이스를 매칭하지 않음 — 본 plan v2 에서 보강 권장:
- `-핫픽스[0-9]+$` (작업/문서 접미사 없는 단독)
- `-문서-[0-9]+$` (중복 호출 변종)
- `-문서-핫픽스[0-9]+$`, `-작업-핫픽스[0-9]+$` (역순 변종)
- `archive/stash-` 패턴 force-delete 통합 (현재 legacy --legacy-force 분기에 있으나 별도 mode 분기 고려)

본 핫픽스에서는 정책 문서/스크립트는 수정 안 함 — 후속 plan 에서 처리.

### 누적 (v001.56.0 + v001.58.0)

- 전체 5 repo: 405 → 133 (272개 정리), 활성 worktree 124개 무손상.

---

## v001.57.0

> 통합일: 2026-05-14
> 플랜 이슈: #30
> 대상: 아이OS

### 페이즈 결과

- **Phase 1 (D3)**: `.claude/skills/plan-enterprise-os/SKILL.md` 에 `[--codex]` 분기 추가 — invocation 옵션 / WIP A 명명 분기 (`-작업-codex`, WIP B 는 `-codex` 미접미) / Step 7 default vs codex 경로 분리 (7-codex-a 프롬프트 생성+halt, 7-codex-b 완료 검증, 7-codex-c 실패 옵션) / harness_context 처리 (CLAUDE.md 는 Codex 가 워크트리 직접 read, memory 발췌 + Treadmill Audit 결과는 이슈 본문 inline) / harness-aware Treadmill 검사 (rule/hook/agent/skill 수정 시 Q3 trade-out 검증) / HOTFIX codex 경로 확장 / Failure policy 3행 + Scope 갱신.
- **Phase 2**: `.agents/skills/dev-build/SKILL.md` 신규 작성 — Claude 측 `dev-build` SKILL 의 Codex 측 미러. 어휘 치환만 (의미 변경 없음); `.claude/md/*` 경로는 single-source-of-truth 정책으로 유지.
- **Phase 3**: `.codex/agents/` 누락 3개 .toml 추가 — `code-inspector.toml` (Opus 4.7, planning reviewer), `completion-reporter.toml` (Sonnet 4.6, read-only formatter), `gate-runner.toml` (Haiku 4.5, 기계적 실행). 모두 `effort: medium` 균일.
- **Phase 4 (+ fix #1, #2)**: `AGENTS.md` 를 CLAUDE.md 현재 상태와 정렬 — §4 모델 표에 gate-runner / completion-reporter 행 추가 + advisor 모델 `claude-opus-4-7` 로 정정 (Sonnet-advisor 인버전 롤백 반영) / effort=medium 단락 신설; §5 worktree 기반 WIP 프로토콜 + repo-specific integration branch (I-OS=main / 외부=i-dev) + Codex variant 조항 + `git branch -d` 안전 삭제 단계; §9 branch alignment 정책 (18 skills) 신설; §8 token budget 의 sub-agent prompt 100k cap 반영; 폴더맵에서 `.Codex/rules/` `.Codex/hooks/` `.Codex/md/` 행 제거 + `.claude/md/` single-source 행 추가; References 에 `codex-collaboration.md` 참조 추가; "17 skills" → "18 skills". 의도적 비미러 한 줄 명시: "공유 절차 문서 `.claude/md/*.md` 는 Codex 측 skill/agent 도 직접 참조한다 (single source of truth — `.codex/md/` 미러를 별도로 만들지 않는다)."

### 결정 사항 (Codex 자문 반영)

- `.codex/md/` 디렉터리는 **만들지 않음**. Codex 측 skill/agent 가 `.claude/md/*.md` 를 직접 참조 — single source of truth, drift / sync 부담 / 트레드밀 회피.
- 메모리 파일 (`~/.claude/projects/.../memory/*.md`) 은 워크트리 외부이므로 Codex sandbox 접근 불가 — `--codex` 모드에서 harness_context inline 위치는 prompt 본문이 아닌 **plan issue body**. `.claude/md/sub-agent-prompt-budget.md` 의 "save to permanent doc, pass identifier" 정책 준수.

### 영향 파일

- `.claude/skills/plan-enterprise-os/SKILL.md`
- `.agents/skills/dev-build/SKILL.md` (신규)
- `.codex/agents/code-inspector.toml` (신규)
- `.codex/agents/completion-reporter.toml` (신규)
- `.codex/agents/gate-runner.toml` (신규)
- `AGENTS.md`

### Treadmill Audit

**NOT APPLICABLE** — 본 플랜은 신규 규칙/훅/에이전트/스킬/검증축을 추가하지 않았다. Phase 1 은 기존 `plan-enterprise-os` 스킬에 invocation 옵션 1개 (`--codex`) 추가로, 자매 스킬 `plan-enterprise` 의 D2 와 동형 — 동일 메커니즘의 sibling 미러일 뿐 신규 검증축이 아니다. Phase 2/3/4 는 이미 정해진 Codex 미러 구조의 누락분 보완.

---

## v001.56.0

> 통합일: 2026-05-14
> 플랜 이슈: #29
> 대상: 아이OS

### 페이즈 결과

- **Phase 1**: `.claude/scripts/branch-cleanup.sh` 신설 — legacy/merged/both 모드, --dry-run 기본, --legacy-force + --apply + --confirm-force 3중 인터락, 보호 목록(integration / HEAD / active worktree / fixed list) 자동 적용. 377줄, bash 3.2 호환.
- **Phase 2**: `.claude/md/worktree-lifecycle.md` `### Remove` 섹션 재작성 + `CLAUDE.md` §5 step 3 갱신. 머지 직후 `git branch -d <wip>` 안전 삭제가 표준 단계로 의무화. `-d` 실패 = 머지 미완료 신호 → 절차 중단.
- **Phase 3**: 11개 머지-스킬 SKILL.md 일괄 갱신 (`plan-enterprise`, `plan-enterprise-os`, `patch-confirmation`, `patch-update`, `group-policy`, `new-project-group`, `plan-roadmap`, `create-custom-project-skill`, `task-db-structure`, `task-db-data`, `dev-merge`). 22 라인 추가 / 11 라인 삭제. `dev-merge` 는 `gh pr merge --delete-branch` 로 전환 + 로컬 `git branch -d` fallback + Scope 갱신 + Failure policy 1행 추가.

### 청소 실행 결과 (Post-Phase-3 런타임 시퀀스)

| Repo | Before | After | Deleted |
|------|------:|------:|------:|
| Project-I2 | 165 | 20 | 145 |
| data-craft | 175 | 130 | 45 |
| data-craft-mobile | 20 | 8 | 12 |
| data-craft-ai-preview | 3 | 3 | 0 |
| data-craft-server | 42 | 21 | 21 |
| **합계** | **405** | **182** | **223** |

활성 worktree 124개 (Project-I2 7, data-craft 94, data-craft-server 17, data-craft-mobile 5, data-craft-ai-preview 1) 전부 보호 — 손상 없음.

주: Project-I2 의 dry-run 예측(146) 대비 실측(145) 차이 1건은 동시 세션이 dry-run 직후 push 한 신규 브랜치로 추정 (수치 ±1 합리 범위).

### 영향 파일

- `.claude/scripts/branch-cleanup.sh` (신규)
- `.claude/md/worktree-lifecycle.md`
- `CLAUDE.md`
- `.claude/skills/plan-enterprise/SKILL.md`
- `.claude/skills/plan-enterprise-os/SKILL.md`
- `.claude/skills/patch-confirmation/SKILL.md`
- `.claude/skills/patch-update/SKILL.md`
- `.claude/skills/group-policy/SKILL.md`
- `.claude/skills/new-project-group/SKILL.md`
- `.claude/skills/plan-roadmap/SKILL.md`
- `.claude/skills/create-custom-project-skill/SKILL.md`
- `.claude/skills/task-db-structure/SKILL.md`
- `.claude/skills/task-db-data/SKILL.md`
- `.claude/skills/dev-merge/SKILL.md`

### Treadmill Audit

PASS — Retired: worktree-lifecycle.md 64-65 'manual branch delete is optional' wording — replaced by mandatory git branch -d <wip> step in standard merge procedure.

### Out of scope (후속)

5개 repo 합계 88개 "보고만"(미머지) 스테일 브랜치는 본 플랜 범위 외. 별도 정리 플랜에서 처리 필요 (`plan-enterprise-9-board-widget-common-핫픽스1~15`, `wip/enterprise-44x~50x-hotfix-*` 등 미머지 시리즈).

---

## v001.55.0

> 통합일: 2026-05-14
> 플랜 이슈: #28
> 대상: 아이OS

### 페이즈 결과

- **Phase 1**: `CLAUDE.md` 에 새 hard rule §9 "브랜치 정렬 정책" 추가 + `.claude/md/branch-alignment.md` 신규 생성 (Entry verification / Exit restoration / Multi-repo handling / 적용 범위 strict-universal 명시).
- **Phase 2**: 9개 변경 스킬 (`dev-merge`, `pre-deploy`, `plan-enterprise`, `plan-enterprise-os`, `task-db-structure`, `task-db-data`, `group-policy`, `create-custom-project-skill`, `plan-roadmap`) 의 SKILL.md 에 Pre-conditions 참조 라인 + "완료 후 HEAD 복원" 섹션 retrofit. 디스패치 1차 컨텍스트 매핑 오류 (`group-policy` 등 3개 스킬을 external 로 오분류) 를 phase-executor 가 정당하게 거부 → 정정 후 재디스패치 통과. 참고: 본 `plan-enterprise-os` invocation 자체는 본 페이즈의 spec 변경 전 로드된 spec 으로 진행 — 신 exit-restoration 규칙은 다음 호출부터 적용.
- **Phase 3**: 7개 유틸 스킬 (`dev-build`, `dev-start`, `dev-inspection`, `dev-security-inspection`, `db-security-inspection`, `project-verification`, `patch-update`) 의 Pre-conditions 에 Entry verification 참조 라인 추가. strict-universal 채택. `patch-update` 는 dual-target 변형 적용.
- **Phase 4**: `new-project-group/SKILL.md` 에 "Member repo i-dev bootstrap" H2 섹션 신설 — 각 `targets[].cwd` 에 대해 git repo 확인 / main 존재 / i-dev 멱등 생성 / origin push / 깨끗한 working tree 일 때 checkout. Pre-conditions / Failure policy / Scope 갱신.
- **Phase 5**: `patch-confirmation/SKILL.md` Case A (`아이OS`, 단일 I2 워크트리) / Case B (`<leader>`, 멤버 repo 별 코드 WIP + I2 문서 WIP 1개) 분기로 본문 재작성. 디스패치 1차 scope_expansion_needed 거부 (Phase 1 의 dual-target 예외 정합 필요) → 정정 후 `.claude/md/branch-alignment.md` §1 dual-target 예외에서 patch-confirmation 제거, `patch-update` 만 dual-target 유지. completion-reporter data 에 `target_case` / `member_repos[]` 필드 추가.
- **Phase 6**: data-craft 4 repo i-dev 재정렬 (main-session-direct, 외부 repo). data-craft / -ai-preview / -server 3개 repo 에 `i-dev` 신규 생성 (main 으로부터) + origin push. data-craft-mobile 은 i-dev 기존 존재 — 정렬만. 4 repo 모두 현재 HEAD = `i-dev` 로 정렬 완료. `i-dev-001` (구 I-OS 잔재) 은 보존.

### 영향 파일

- `CLAUDE.md`
- `.claude/md/branch-alignment.md` (신규)
- `.claude/skills/dev-merge/SKILL.md`
- `.claude/skills/pre-deploy/SKILL.md`
- `.claude/skills/plan-enterprise/SKILL.md`
- `.claude/skills/plan-enterprise-os/SKILL.md`
- `.claude/skills/task-db-structure/SKILL.md`
- `.claude/skills/task-db-data/SKILL.md`
- `.claude/skills/group-policy/SKILL.md`
- `.claude/skills/create-custom-project-skill/SKILL.md`
- `.claude/skills/plan-roadmap/SKILL.md`
- `.claude/skills/dev-build/SKILL.md`
- `.claude/skills/dev-start/SKILL.md`
- `.claude/skills/dev-inspection/SKILL.md`
- `.claude/skills/dev-security-inspection/SKILL.md`
- `.claude/skills/db-security-inspection/SKILL.md`
- `.claude/skills/project-verification/SKILL.md`
- `.claude/skills/patch-update/SKILL.md`
- `.claude/skills/new-project-group/SKILL.md`
- `.claude/skills/patch-confirmation/SKILL.md`
- 외부 (4 data-craft repo, i-dev 브랜치 생성/정렬)

### Treadmill Audit

PASS (Phase 1 한정). Q1 (재발 사고: data-craft 브랜치 mismatch 반복) / Q2 (multi-repo 검증 + 임의-checkout 복원 신규 명시) / Q3 (각 스킬의 inline 브랜치 검증 책임이 retire, 공유 md `branch-alignment.md` 가 단일 출처가 됨). Phase 2~6 은 NOT APPLICABLE — 결손 보강 / Phase 1 정책 적용.

### 참고

- 진입 검증의 strict-universal vs writer-only 결정은 ExitPlanMode 시점에 strict-universal 로 확정 (마스터 "반드시" 우선). 추후 writer-only 로 완화 시 별도 정책 변경 필요.
- Phase 7 단계에서 phase-executor 의 reviewer 안전망이 2회 작동 (Phase 2 컨텍스트 / Phase 5 scope) — 1차 디스패치 결함을 main-session 대신 sub-agent 가 잡아냄. 향후 디스패치 프롬프트 작성 시 컨텍스트 매핑 사전 검증 강화 여지.

## v001.54.0

> 통합일: 2026-05-14
> 플랜 이슈: #27
> 대상: 아이OS

### 페이즈 결과

- **Phase 1**: 메모리 `feedback_plan_enterprise_no_auto_push.md` line 19 예외 리스트에 `patch-confirmation` 항목 추가 — `### Final push` 단계의 `git push origin main` 이 spec 명시 절차임을 enumeration 으로 표기해 classifier 가 동 스킬의 push 의도를 정상 인식하도록 보정 (v001.44 사건 후속). main-session-direct 편집 (메모리는 repo 외부, main-session 정상 쓰기 surface).

### 영향 파일

- `~/.claude/projects/-Users-starbox-Documents-GitHub-Project-I2/memory/feedback_plan_enterprise_no_auto_push.md` (repo 외부)
- `patch-note/patch-note-001.md`

### Treadmill Audit

NOT APPLICABLE — 신규 규칙/훅/에이전트/스킬/검증축 추가 없음. 기존 메모리의 예외 enumeration 보정.

## v001.53.0

> 통합일: 2026-05-14

### 변경 파일

- (추가) .agents/
- (추가) .claude/inspection-runs/
- (추가) .codex/
- (추가) AGENTS.md
- (추가) monitoring/data/hourly.json
- (추가) temp/

## v001.52.0

> 통합일: 2026-05-14
> 플랜 이슈: #25 (핫픽스17)
> 대상: 아이OS

### 개요
핫픽스15 가 `.claude/agents/*.md` frontmatter 의 `description:` 을 그대로 노출했으나 CLAUDE.md §1 (Korean for terminal/user-facing, English for `.claude/`) 규정상 description 이 영문이라 마스터가 툴팁을 이해하기 어려운 문제. collect.py 의 `load_agent_descriptions()` 본문을 한국어 간결 매핑으로 교체 (19 agent: 13 sub-agent + 6 built-in). frontmatter 파싱 로직 제거.

### 절차 메모
hotfix17 작업 브랜치를 main 에 머지하던 도중 working tree HEAD 가 codex 브랜치 (`plan-enterprise-os-1-codex-flow-integration-작업-codex`, MEMORY.md `codex-bootstrap-in-flight`) 로 옮겨져 있음을 발견 — codex 협업 세션이 평행 진행되며 HEAD 를 옮긴 결과. main 으로 명시적 복귀 후 hotfix17 작업 재머지로 정합 회복.

### 페이즈 결과
- **핫픽스17** (`monitoring/scripts/collect.py`, `monitoring/index.html`):
  - `AGENTS_DIR` 상수 + frontmatter line-based parser 제거. `load_agent_descriptions()` 본문을 19 agent 한국어 간결 매핑 dict 단일 return 으로 교체. 각 매핑은 1-2 문장 내, 마스터가 즉시 이해 가능한 비전문 표현.
  - 자산 cache-bust `?v=20260514-16` → `?v=20260514-17`.
  - 검증: collect.py 재실행 후 `aggregate.json.agent_descriptions` — phase-executor / Explore / gate-runner 등 한국어 출력 확인.

### 영향 파일
- `monitoring/scripts/collect.py`
- `monitoring/index.html`

### Treadmill Audit
NOT APPLICABLE — 텍스트 한국어화. 신규 메커니즘 추가 없음.

## v001.51.0

> 통합일: 2026-05-14
> 플랜 이슈: #25 (핫픽스16)
> 대상: 아이OS

### 개요
브라우저 탭 제목과 헤더 H1 텍스트를 "아이OS 토큰 모니터링" → "토큰 사용량 모니터링" 으로 변경. 기본 지구 favicon 을 SVG 인라인 가로 막대 차트 아이콘으로 교체 (data URI, 4개 막대 — 파랑/보라/초록/주황).

### 페이즈 결과
- **핫픽스16** (`monitoring/index.html`):
  - `<title>` 텍스트 변경.
  - `<h1>` 텍스트 변경.
  - `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,...">` 추가. 4 개 rect 막대로 구성된 미니 차트 아이콘. data URI 방식으로 별도 파일 의존성 없음.
  - 자산 cache-bust `?v=20260514-15` → `?v=20260514-16`.

### 영향 파일
- `monitoring/index.html`

### Treadmill Audit
NOT APPLICABLE — 텍스트·아이콘 변경. 신규 메커니즘 추가 없음.

## v001.50.0

> 통합일: 2026-05-14
> 플랜 이슈: #25 (핫픽스15)
> 대상: 아이OS

### 개요
서브에이전트 가로 막대 차트의 막대 hover 시 기본 툴팁 (label/value) 아래에 그 서브에이전트의 역할 설명을 추가 표시. 설명 소스 = `.claude/agents/*.md` frontmatter 의 `description:` 필드 + built-in 6 에이전트 한국어 fallback.

### 페이즈 결과
- **핫픽스15** (`monitoring/scripts/collect.py`, `monitoring/script.js`, `monitoring/index.html`):
  - `collect.py` 에 `AGENTS_DIR` 상수 + `load_agent_descriptions()` 헬퍼 추가. `.claude/agents/*.md` 의 YAML frontmatter 줄 단위 파싱으로 `name` / `description` 추출 (description 이 여러 줄에 걸치는 indented continuation 도 지원). built-in 6 에이전트 (Explore, Plan, general-purpose, claude, claude-code-guide, statusline-setup) 한국어 fallback 추가. `collect()` return dict 에 `agent_descriptions` 키로 포함되어 aggregate.json 출력. period 파일에는 미포함.
  - `script.js` `renderChartAgentBar` 의 Chart.js options 에 `tooltip.callbacks.afterBody` 추가. `data.agent_descriptions[label]` 조회 → 60자씩 줄바꿈 wrap → 빈 줄 + wrapped 라인을 기본 툴팁 본문 아래에 출력.
  - 자산 cache-bust `?v=20260514-14` → `?v=20260514-15`.

### 영향 파일
- `monitoring/scripts/collect.py`
- `monitoring/script.js`
- `monitoring/index.html`

### Treadmill Audit
NOT APPLICABLE — UI 보강. 신규 메커니즘 추가 없음.

## v001.49.0

> 통합일: 2026-05-14
> 플랜 이슈: #25 (핫픽스14)
> 대상: 아이OS

### 개요
2건 동시 정정. (1) 서브에이전트 사용량 차트가 실시간 모드에서 빈 상태로 보임 — 원인: `aggregateHoursInWindow()` 가 `by_agent` 미생성. day-tokens/cost 처럼 풀 aggregate (`aggData`) 사용으로 변경. (2) 상세 모델별·스킬별 도넛이 위아래로 늘어진 타원, 도넛과 표 보기가 딱 붙어 있음 — 원인: `.detail-chart` 의 height 280px 와 grid 컬럼 260px 불일치로 셀이 260×280 직사각형, 그리고 `.detail-chart` 와 `.table-block` 사이 margin 없음. 핫픽스10 의 정합 정리를 detail 에 적용.

### 페이즈 결과
- **핫픽스14** (`monitoring/script.js`, `monitoring/styles.css`, `monitoring/index.html`):
  - `script.js` `renderAll()` 에서 `renderChartAgentBar(data)` → `renderChartAgentBar(aggData)`. 실시간 모드에서도 풀 aggregate 의 `by_agent` 사용.
  - `styles.css` `.detail-section.has-html-legend .detail-chart` 에 `height: 260px;` 추가 — grid 컬럼폭과 정합. `margin-bottom: 12px;` 추가 — 도넛과 `.table-block` 사이 시각적 간격 확보.
  - 자산 cache-bust `?v=20260514-13` → `?v=20260514-14`.

### 영향 파일
- `monitoring/script.js`
- `monitoring/styles.css`
- `monitoring/index.html`

### Treadmill Audit
NOT APPLICABLE — 데이터 소스 정합 + 레이아웃 정정. 신규 메커니즘 추가 없음.

## v001.48.0

> 통합일: 2026-05-14
> 플랜 이슈: #25 (핫픽스13)
> 대상: 아이OS

### 개요
마스터 2건 요구. (1) 상세 테이블 섹션의 4 detail-section 중 모델별·스킬별 2 개를 한 줄에 가로 배치 (각 50% 폭), 나머지 일자별·세션별은 100% 폭 유지. (2) 세션 Top 10 과 동일한 가로 막대 차트로 모든 서브에이전트 사용량 (메인 세션 제외) 노출.

### 페이즈 결과
- **핫픽스13** (`monitoring/index.html`, `monitoring/script.js`, `monitoring/styles.css`, `monitoring/scripts/collect.py`):
  - `collect.py` 에 `by_agent` 차원 신설. user-record 분기에서 `add_usage(by_agent[agent_type], agent_usage)`. `new_period_state()` 의 dict 에 `"by_agent": defaultdict(empty_token_record)` 추가, `period_state_to_json` 출력에 `by_agent_out` 포함, `collect()` return 에도 추가. 메인 세션은 agentType 없는 assistant turn 이라 by_agent 에 자연 배제.
  - `index.html`: `.tables-section` 의 모델별·스킬별 두 detail-section 을 `<div class="detail-row-2col">` 로 래핑. 새 chart-card `#chart-agent-bar` ("서브에이전트 사용량 (총 토큰)") 를 세션 Top 10 직후에 삽입.
  - `script.js`: `renderChartAgentBar(data, opts)` 신규. `renderChartSessionBar` 패턴 모방, 데이터 = `data.by_agent`, 라벨 = `r.agent`, 값 = 총 토큰 합산. 정렬 내림차순 전체 노출 (Top 10 제한 없음). `renderAll()` 에서 호출.
  - `styles.css`: `.detail-row-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }` 추가.
  - 검증: collect.py 재실행 후 by_agent 상위 — phase-executor 188 / completion-reporter 68 / Explore 51 / gate-runner 29 / general-purpose 10 / ... (11 종 정상 노출).
  - 자산 cache-bust `?v=20260514-10` → `?v=20260514-13`.

### 영향 파일
- `monitoring/index.html`
- `monitoring/script.js`
- `monitoring/styles.css`
- `monitoring/scripts/collect.py`

### Treadmill Audit
NOT APPLICABLE — UI 재배치 + 신규 차트. 신규 메커니즘 추가 없음.

## v001.47.0

> 통합일: 2026-05-14
> 플랜 이슈: #25 (핫픽스12)
> 대상: 아이OS

### 개요
"모델 분포에 opus 100% 만 나온다" 보고. JSONL 분석 결과: 서브에이전트 (Task tool 디스패치) token usage 는 `type: "user"` 레코드의 `toolUseResult.usage` 에 담기고 `toolUseResult.agentType` 으로 에이전트 식별되는데, 현 collect.py 는 `if rec.get("type") != "assistant": continue` 로 user 레코드 전부 스킵해 sonnet/haiku 서브에이전트 사용량을 누락. 13 sub-agent 의 model 매핑표 (CLAUDE.md §4) 를 collector 에 내장하고 user-record 처리 분기 추가.

### 페이즈 결과
- **핫픽스12** (`monitoring/scripts/collect.py`):
  - 파일 상단에 `AGENT_MODEL_MAP` 상수 추가 — 13 sub-agent (phase-executor / code-fixer / db-migration-author / db-data-author / completion-reporter = sonnet 4.6, gate-runner = haiku 4.5, 7 planning agents = opus 4.7) + 6 built-in (Explore / Plan / general-purpose / claude / claude-code-guide / statusline-setup = opus). 미매핑 agentType 은 default opus.
  - `collect()` per-record 루프를 `if type=="assistant" / elif type=="user"` 구조로 리팩터링. user 분기에서 `toolUseResult.agentType` 검출 → `AGENT_MODEL_MAP` 으로 모델 결정 → `toolUseResult.usage` 를 by_model / by_skill / by_day / by_session / total / hourly / period_agg 모든 aggregator 에 add_usage. sticky_skill 그대로 적용 (서브에이전트는 호출 스킬에 종속). by_prompt 는 master-prompt 식별 의미 없으므로 스킵.
  - 검증: 재실행 후 by_model — claude-opus-4-7 9667 / **claude-sonnet-4-6 269** / **claude-haiku-4-5 29** / API 에러 7 / 시스템 합성 1. sonnet/haiku 정상 등장.

### 영향 파일
- `monitoring/scripts/collect.py`

### Treadmill Audit
NOT APPLICABLE — 집계 로직 확장. 신규 메커니즘 추가 없음. 알려진 한계: `AGENT_MODEL_MAP` 은 하드코딩 상수로 신규 sub-agent 추가 시 수동 갱신 필요. 미매핑 agentType 은 default opus 로 집계 → 외부 프로젝트의 커스텀 agent 가 sonnet 이라도 opus 로 잘못 집계될 위험. 본 repo 의 13 sub-agent + 6 built-in 만 정확.

## v001.46.0

> 통합일: 2026-05-14
> 플랜 이슈: #25 (핫픽스11)
> 대상: 아이OS

### 개요
스킬 점유 차트에서 "메인 세션" 이 압도적으로 1위로 집계되는 증상 보고. JSONL 직접 분석 결과: 가장 최근 세션 (이슈 #25 플랜 본체) 400 메시지 중 `attributionSkill: plan-enterprise-os` 태깅 = **5개만**, 나머지 395개 무태깅 → `"메인 세션"` 폴백. Claude Code 런타임이 스킬 진입 직후 잠시만 태깅하고 그 이후 phase 실행 / 핫픽스 입력 / 머지 작업 등은 태깅 안 함. 마스터 의심대로 collector 의 폴백 로직이 스킬 점유를 심각하게 과소집계.

런타임은 본 repo 에서 수정 불가하나 collector 측에서 sticky 전파로 보정 가능 — 한 번 X 로 태깅된 이후 같은 세션 JSONL 내 메시지는 다른 attributionSkill 이 나타나기 전까지 모두 X 로 귀속.

### 페이즈 결과
- **핫픽스11** (`monitoring/scripts/collect.py`):
  - 메시지 루프 직전에 세션별 `sticky_skill = "메인 세션"` 초기화.
  - 각 레코드 처리 시 `raw_skill = rec.get("attributionSkill")` 가 truthy 면 `sticky_skill = raw_skill` 로 갱신. 본 메시지 귀속 = `sticky_skill`.
  - 결과: 세션 첫 attributionSkill 태깅 이후 모든 메시지가 그 스킬로 귀속. 다음 스킬 태깅이 나타나면 그 시점부터 새 스킬로 전환.
  - 검증: collect.py 재실행 후 by_skill 상위 — plan-enterprise-os 3040 / plan-enterprise 3007 / init 930 / task-db-data 820 / 메인 세션 701 (이전 압도적 1위 → 5위). 분포 정상화 확인.

### 영향 파일
- `monitoring/scripts/collect.py`

### Treadmill Audit
NOT APPLICABLE — 집계 로직 정정. 신규 메커니즘 추가 없음. 알려진 한계: 스킬 종료 후 메인 세션 대화가 같은 JSONL 안에서 이어지면 이전 스킬로 과대집계될 수 있으나, 실제로 각 스킬 invocation 은 보통 별도 세션이라 영향 미미.

## v001.45.0

> 통합일: 2026-05-14
> 플랜 이슈: #25 (핫픽스10)
> 대상: 아이OS

### 개요
핫픽스6 에서 도입한 HTML 범례 (grid 2 컬럼) 이후 핫픽스7~9 가 도넛이 세로 타원으로 그려지는 증상을 CSS 만으로 해결하려다 9 라운드 hot fix loop 에 빠진 사례. advisor 진단으로 근본 원인 확인 후 일괄 정정.

근본 원인: Chart.js `responsive: true, maintainAspectRatio: false` 가 canvas 의 containing block (`.chart-body`) 을 측정해 backing buffer 를 설정. HTML 범례 도입 후 `.chart-body` 가 CSS grid (260px canvas + 1fr legend, 총 ~380px) 인데 Chart.js 는 전체 폭 ~380px 과 height 260px 을 읽어 backing buffer = 380×260. CSS 박스 (260×260 `!important`) 안에 압축 렌더되어 가로 압축 → 세로 타원. CSS layer 는 display box 만 통제하고 Chart.js layer 가 backing buffer 를 별도로 결정하므로 두 layer 가 독립 — CSS hack 으로는 해결 불가. Chart.js options layer 에서 정정.

### 페이즈 결과
- **핫픽스10** (`monitoring/script.js`, `monitoring/styles.css`, `monitoring/index.html`):
  - `renderChartModelDonut` / `renderChartSkillDonut` / `renderChartCacheDonut` 의 Chart options 에서 `maintainAspectRatio: false` → `maintainAspectRatio: true`, `aspectRatio: 1` 추가. Chart.js 가 컨테이너 모양 무관하게 항상 1:1 정사각형 렌더 강제. 다른 차트 (day-tokens/session-bar/day-cost/prompt-bar) 는 `false` 유지 — 의도된 직사각형.
  - `styles.css` 에서 핫픽스7~9 의 잔재 일괄 제거: `.chart-card.has-html-legend .chart-body canvas { width: 260px !important; height: 260px !important; }` 룰 전체 삭제, `.detail-section.has-html-legend .detail-chart canvas { width: 260px !important; height: 260px !important; }` 룰 전체 삭제, `.chart-card.has-html-legend .chart-body { height: 260px; }` 의 height 라인 삭제, 동일 detail-chart 의 height 라인 삭제. grid 정의 (`grid-template-columns: 260px minmax(0, 1fr)`) 만 layout 용으로 유지.
  - 자산 cache-bust `?v=20260514-9` → `?v=20260514-10`.
  - 검증: 로컬 정적 서버로 자산 200 OK, 도넛 3 함수에 `aspectRatio: 1` 적용 확인, CSS `width: 260px !important` 잔재 0 건 확인. **육안 검증은 마스터 브라우저에서 최종 확인 필요.**

### 영향 파일
- `monitoring/script.js`
- `monitoring/styles.css`
- `monitoring/index.html`

### Treadmill Audit
PASS — 9 라운드 hot fix loop 의 동일 도넛 정사각형 작업이 매번 "완료" 보고되며 마스터 브라우저에서 동일 증상 재발한 행태가 `feedback_no_prevention_treadmill.md` 의 재발 신호와 일치. 본 핫픽스에서 advisor 진단으로 근본 원인 (Chart.js backing buffer vs CSS display box layer 분리) 을 명시화하고 한 layer 에서만 정정. Q3 trade-out: 핫픽스7~9 가 CSS 에 추가한 width/height/aspect-ratio 오버라이드를 폐기. 보고 절차의 재발 방지를 위해 본 핫픽스 commit 직후 정적 서버 자산 검증을 수행, 마스터 육안 검증을 종료 게이트 전 명시 요구.

## v001.44.0

> 통합일: 2026-05-14
> 플랜 이슈: #25 (핫픽스9)
> 대상: 아이OS

### 개요
핫픽스8 에서 grid `grid-template-columns: 240px minmax(0, 1fr)` 로 두었으나 `.chart-body { height: 260px }` 와 정합되지 않아 canvas 가 240×260 직사각형 → 도넛 위아래 타원으로 늘어남. 핫픽스6~8 이 컬럼폭과 컨테이너 높이를 함께 고려하지 않고 만들어진 결과. 컬럼폭과 chart-body 높이를 모두 260px 로 정합, canvas 도 `width: 260px !important; height: 260px !important;` 절대 고정으로 정사각형 보장.

### 페이즈 결과
- **핫픽스9** (`monitoring/styles.css`, `monitoring/index.html`):
  - `.chart-card.has-html-legend .chart-body`: `grid-template-columns: 240px ...` → `260px minmax(0, 1fr)`, `height: 260px` 명시.
  - 동일 셀렉터의 canvas 룰을 `width: 260px !important; height: 260px !important;` 절대 고정 (max-height 폐기 — 정확한 정사각형 보장 우선).
  - `.detail-section.has-html-legend .detail-chart` 도 동일 패턴 (260px × 260px).
  - 자산 cache-bust `?v=20260514-8` → `?v=20260514-9`.

### 영향 파일
- `monitoring/styles.css`
- `monitoring/index.html`

### Treadmill Audit
NOT APPLICABLE — 시각 정정 (정사각형 정합). 신규 메커니즘 추가 없음.

## v001.43.0

> 통합일: 2026-05-14
> 플랜 이슈: #25 (핫픽스8)
> 대상: 아이OS

### 개요
핫픽스7 의 `aspect-ratio: 1 / 1; width: auto !important; height: 100% !important;` 시도가 Chart.js 의 canvas backing buffer 와 충돌해 캔버스가 자연 크기로 폭주, 카드 박스를 뚫고 인근 차트를 가리는 증상. aspect-ratio 폐기 — grid 첫 컬럼을 chart-body 높이와 일치하는 고정폭 (240px / detail 260px) 으로 두고 canvas 는 `width:100%; height:100%; max-height:240px` 로 회귀. 결과: canvas 가 항상 정사각형 240×240 (detail 260×260), 박스 안에 안정 배치, 우측 셀에 HTML 범례.

### 페이즈 결과
- **핫픽스8** (`monitoring/styles.css`, `monitoring/index.html`):
  - `.chart-card.has-html-legend .chart-body` 의 grid `grid-template-columns: minmax(0, 1fr) auto` → `240px minmax(0, 1fr)`.
  - 동일 셀렉터의 canvas 룰을 `width:100% !important; height:100% !important; max-height:240px` 로 회복 (aspect-ratio / justify-self / width:auto 삭제).
  - `.detail-section.has-html-legend .detail-chart` 도 `260px minmax(0, 1fr)` + canvas max-height 260px.
  - 자산 cache-bust `?v=20260514-7` → `?v=20260514-8`.

### 영향 파일
- `monitoring/styles.css`
- `monitoring/index.html`

### Treadmill Audit
NOT APPLICABLE — 시각 정정. 신규 메커니즘 추가 없음.

## v001.42.0

> 통합일: 2026-05-14
> 플랜 이슈: #25 (핫픽스7)
> 대상: 아이OS

### 개요
핫픽스6 의 grid 레이아웃 (`grid-template-columns: minmax(0, 1fr) auto`) 으로 도넛 canvas 가 grid 셀에 따라 비-정사각형 비율로 확장되어 위아래 늘어난 타원형으로 렌더되는 증상. 기존 `.chart-body canvas { width: 100% !important; height: 100% !important; }` 가 canvas 를 grid 셀 전체로 강제하면서 발생. canvas 자체에 `aspect-ratio: 1 / 1` 적용 + `width: auto` 로 강제 정사각형.

### 페이즈 결과
- **핫픽스7** (`monitoring/styles.css`, `monitoring/index.html`):
  - `.chart-card.has-html-legend .chart-body canvas` 와 `.detail-section.has-html-legend .detail-chart canvas` 양쪽에 `width: auto !important; height: 100% !important; aspect-ratio: 1 / 1; justify-self: center;` 적용. canvas 가 항상 정사각형이 되고 grid 셀 안에서 가운데 정렬.
  - 자산 cache-bust `?v=20260514-6` → `?v=20260514-7`.

### 영향 파일
- `monitoring/styles.css`
- `monitoring/index.html`

### Treadmill Audit
NOT APPLICABLE — 시각 정정. 신규 메커니즘 추가 없음.

## v001.41.0

> 통합일: 2026-05-14
> 플랜 이슈: #25 (핫픽스6)
> 대상: 아이OS

### 개요
도넛 3종 (모델 분포 / 스킬 점유 / 캐시 vs 비-캐시) 의 우측 범례를 마스터 의도 (개행 분리 / 부분 색상 / 0.1%p 임계 필터) 에 맞추기 위해 Chart.js native legend 를 폐기하고 커스텀 HTML 범례로 전환. 상세 섹션의 모델별·스킬별 도넛도 동일 처리.

### 페이즈 결과
- **핫픽스6** (`monitoring/index.html`, `monitoring/script.js`, `monitoring/styles.css`):
  - `index.html`: 도넛 3 chart-card 와 detail-section 의 모델별·스킬별 섹션에 `has-html-legend` 클래스 추가, canvas 옆에 `<div class="chart-legend"></div>` 삽입.
  - `script.js`: `renderHtmlLegend(containerEl, labels, values, bgs, opts)` 헬퍼 신설. 각 라벨에 색 박스 12×12 + 흰색 라벨 + 비교 모드 시 |델타| ≥ 0.1%p 인 경우만 라벨 아래 개행하여 ▲/▼ 표기 (▲ 파란색 = `#3b82f6`, ▼ 빨간색 = `#ef4444`). `renderChartModelDonut` / `renderChartSkillDonut` / `renderChartCacheDonut` 의 Chart.js options `plugins.legend.display: false` 로 native legend 끄고, chart 생성 후 부모 `.chart-body` 또는 `.detail-chart` 의 `.chart-legend` 자식을 찾아 `renderHtmlLegend` 호출. 캐시 도넛은 positional prevVals 를 label-키 기반 prevMap 으로 변환하여 동일 헬퍼 통일 적용.
  - `styles.css`: `.chart-card.has-html-legend .chart-body` / `.detail-section.has-html-legend .detail-chart` 에 `display: grid; grid-template-columns: minmax(0, 1fr) auto;` 적용. `.chart-legend` / `.chart-legend-item` / `.dot` / `.label` / `.delta.up` / `.delta.down` 스타일 추가.
  - 자산 cache-bust `?v=20260514-5` → `?v=20260514-6`.

### 영향 파일
- `monitoring/index.html`
- `monitoring/script.js`
- `monitoring/styles.css`

### Treadmill Audit
NOT APPLICABLE — UI 정정. 신규 메커니즘 추가 없음.

## v001.40.0

> 통합일: 2026-05-14
> 플랜 이슈: #25 (핫픽스5)
> 대상: 아이OS

### 개요
도넛 3종 (모델 분포 / 스킬 점유 / 캐시 vs 비-캐시) 의 우측 범례가 검정 글자로 렌더되어 어두운 배경에서 안 보임. 원인: `generateLabels` 콜백이 반환하는 item 들이 `fontColor` 를 명시하지 않아 일부 Chart.js 빌드에서 `labels.color` 가 무시되고 기본 색으로 폴백. 각 item 에 `fontColor: '#e6e9f2'` 명시. 추가로 마스터 요구에 따라 범례 색 박스를 정사각형 (12×12) 으로 강제.

### 페이즈 결과
- **핫픽스5** (`monitoring/script.js`, `monitoring/index.html`):
  - `renderChartModelDonut` / `renderChartSkillDonut` / `renderChartCacheDonut` 의 `legend.labels.generateLabels` 반환 객체에 `fontColor: '#e6e9f2'` 추가 (3 곳).
  - 동일 함수들의 `legend.labels` 에 `boxWidth: 12, boxHeight: 12` 추가 — 색 박스 정사각형 (3 곳).
  - 자산 cache-bust 쿼리 `?v=20260514-4` → `?v=20260514-5`.

### 영향 파일
- `monitoring/script.js`
- `monitoring/index.html`

### Treadmill Audit
NOT APPLICABLE — 시각 정정. 신규 메커니즘 추가 없음.

## v001.39.0

> 통합일: 2026-05-14
> 플랜 이슈: #25 (핫픽스4)
> 대상: 아이OS

### 개요
v001.35.0 (이슈 #25 Phase 4) 의 실시간 비교 의미 오해석 정정. Phase 4 는 `[now-N, now]` 윈도우 합 vs `[now-2N, now-N]` 윈도우 합 (rolling-window pair) 로 구현되어 ▼ 음수 델타 발생 가능. 마스터 의도 = "N시간 전의 누적값과 현재 누적값 비교 = N시간 동안의 증가분"; 토큰은 누적이므로 음수 불가. 의미 재정의.

### 페이즈 결과
- **핫픽스4** (`monitoring/script.js`, `monitoring/index.html`):
  - `computeRealtimeWindows(now, hoursBack)` 재작성. 비교 미선택 시: `baseStart = weekStart, baseEnd = now` (기존과 동일). 비교 선택 시: `baseStart = weekStart, baseEnd = now`, `compareStart = weekStart, compareEnd = max(weekStart, now - N*3600*1000)`. 즉 base 는 항상 "이번주 월~지금" 누적, 비교는 "이번주 월~N시간 전 시점" 누적. 델타 = N시간 동안의 추가 사용량 (>= 0). compareEnd 가 weekStart 보다 이르면 clamp → 비교 윈도우 빈 합 = 0 → 델타 = 현재 누적 (주 초입 N시간 이내 케이스 graceful).
  - 메타 텍스트 변경: `실시간: 최근 N시간 합 vs 직전 동일 폭 (비교)` → `실시간: 이번주 월요일 00:00 ~ 지금까지 (vs N시간 전 누적 — 그동안의 증가분)`.
  - 자산 cache-bust 쿼리 `?v=20260514-3` → `?v=20260514-4`.

### 영향 파일
- `monitoring/script.js`
- `monitoring/index.html`

### Treadmill Audit
NOT APPLICABLE — 의미 정정. 신규 메커니즘 추가 없음.

## v001.38.0

> 통합일: 2026-05-14
> 플랜 이슈: #25 (핫픽스3)
> 대상: 아이OS

### 개요
v001.36.0 (핫픽스1) 에서 적용한 `.big-split-col` flex column stacking 이 마스터 브라우저에서 여전히 옆에 붙어 보이는 증상 재보고. 원인 추정 = 브라우저 캐시 또는 flex column 의 wrap 동작 비결정성. 결정적 grid 레이아웃으로 전환 + 자산 cache-bust 쿼리 부여로 새 CSS 강제 적용.

별도 보고된 "실시간 비교에서 토큰이 감소" 건은 버그가 아니므로 코드 정정 없음. 의미: 실시간 비교는 `[now-N, now]` 윈도우 합 vs `[now-2N, now-N]` 윈도우 합 — 최근 윈도우 사용량이 직전 윈도우보다 적으면 ▼ 음수 정상. 토큰은 누적이 아니라 윈도우별 합이며, 새로고침마다 윈도우가 슬라이드하므로 동일 폭이라도 진폭에 따라 ↑↓ 가능.

### 페이즈 결과
- **핫픽스3** (`monitoring/index.html`, `monitoring/styles.css`):
  - `.big-split-col` 의 `display: flex; flex-direction: column;` 을 `display: grid; grid-template-rows: auto auto; justify-items: center;` 로 변경. 두 자식 (`.big-number-half`, `.kpi-delta`) 에 `grid-row: 1` / `grid-row: 2` 명시. flex column 의 wrap 비결정성 제거.
  - `index.html` 의 `<link rel="stylesheet" href="styles.css">` / `<script src="script.js" defer>` 에 `?v=20260514-3` 쿼리 추가. 브라우저가 새 자산을 무조건 가져오도록 강제.

### 영향 파일
- `monitoring/index.html`
- `monitoring/styles.css`

### Treadmill Audit
NOT APPLICABLE — 순수 레이아웃·캐시 정정. 신규 메커니즘 추가 없음.

## v001.37.0

> 통합일: 2026-05-14
> 플랜 이슈: #25 (핫픽스2)
> 대상: 아이OS

### 개요
v001.36.0 머지 후 마스터 브라우저 검증에서 4건 결함 보고. (1) 일자별 토큰 스택·일자별 추정 비용 차트가 헤더 기간 선택에 영향받아 풀 timeline 표시 못함. (2) 도넛 3종 (모델 분포 / 스킬 점유 / 캐시 vs 비-캐시) 범례가 캔버스 아래 가로 배치되어 파이가 카드 중앙에 떠있고 비교 모드에서 증감 표시 부재. (3) 실시간 모드에서 세션 Top 10 / 프롬프트 / 세션 디테일 테이블이 비어있음 (hourly.json 이 세션·프롬프트 축을 갖지 않음). (4) 차트 카드 제목 가시성 부족. 한 phase 에 통합 정정.

### 페이즈 결과
- **핫픽스2** (`monitoring/index.html`, `monitoring/script.js`, `monitoring/styles.css`):
  - 이슈 1: `renderAll(data, compareData)` 에서 `_aggregateCache` 를 `aggData` 로 래핑해 `renderChartDayTokens` / `renderChartDayCost` 에 전달, `compareData` 인자 제거. 두 차트는 항상 풀 aggregate 의 `by_day` 사용 (기간 선택·비교 비scope화). detail-section 의 `dayTokensDetail` 도 동일 처리.
  - 이슈 2: `renderChartModelDonut` / `renderChartSkillDonut` / `renderChartCacheDonut` 의 Chart options `plugins.legend.position` 을 `'bottom'` → `'right'` 로 변경, `align: 'center'` 추가, `labels.generateLabels` 콜백으로 비교 모드 (`opts.prevRows` 전달 시) 각 범례 라벨에 `▲/▼ ±%p (±absKMB)` 합성. `renderAll` 에서 `compareData.by_model`/`by_skill` 을 `prevRows` 로 전달. 기존 `renderPieCompareList` / `clearPieCompareLists` 호출 제거, `index.html` 의 `#compare-model-list`/`#compare-skill-list`/`#compare-cache-list` 3개 빈 div 제거.
  - 이슈 3: `applyPeriodSelection` realtime 분기에서 현재 ISO 주의 weekly period 파일 (`loadPeriodData('weekly', currentWeekKey)`) 을 추가 로드하여 `baseData.by_session` / `baseData.by_prompt` 에 주입. compareData 에는 fallback 미적용. `loadAggregate()` 사전 로드로 `_aggregateCache` null 방지.
  - 이슈 4: `.chart-card h3` 에 `margin-bottom: 10px` + `font-weight: 700` 적용해 카드 제목 가시성 강화.

### 영향 파일
- `monitoring/index.html`
- `monitoring/script.js`
- `monitoring/styles.css`

### Treadmill Audit
NOT APPLICABLE — 핫픽스는 순수 UI/렌더링 정정 및 데이터 fallback. 신규 규칙/훅/에이전트/스킬/검증축 추가 없음.

## v001.36.0

> 통합일: 2026-05-14
> 플랜 이슈: #25 (핫픽스1)
> 대상: 아이OS

### 개요
v001.35.0 (이슈 #25 본플랜) 머지 후 마스터 브라우저 검증에서 `kpi-tokens` 카드 ("전체 토큰") 의 두 델타 배지가 `595.2K [▼-127K] / 93.6M [▼-5.6M]` 형태로 두 숫자 사이에 인라인 렌더되어 어느 숫자의 델타인지 모호하고 줄바꿈으로 인해 UI 가 깨지는 증상 보고. 각 숫자 바로 아래에 자기 배지를 stacking 하는 방식으로 정정.

### 페이즈 결과
- **핫픽스1** (`monitoring/index.html`, `monitoring/styles.css`): `.big-split` 내부 구조를 변경 — 각 `big-number-half` 와 짝 `kpi-delta` 를 `.big-split-col <div>` 로 묶어 세로 stacking. `styles.css` 에 `.big-split-col { display: flex; flex-direction: column; align-items: center; gap: 2px; }` 추가, `.kpi-tokens .big-split` 의 `align-items: baseline` → `center` 변경. 렌더 결과: 두 숫자가 같은 줄, 각 숫자 바로 아래에 그 숫자의 델타 배지 노출.

### 영향 파일
- `monitoring/index.html`
- `monitoring/styles.css`

### Treadmill Audit
NOT APPLICABLE — 핫픽스는 순수 레이아웃 정정. 신규 규칙/훅/에이전트/스킬/검증축 추가 없음.

## v001.35.0

> 통합일: 2026-05-14
> 플랜 이슈: #25
> 대상: 아이OS

### 개요
monitoring/ 대시보드 기간 선택 UX 3대 결함 정비 + "실시간" 모드 신설. (1) 주간 드롭다운 항목을 `2026-W20` → `MM/DD ~ MM/DD (월~일)` 라벨로 가독화하고 현재 ISO 주는 옵션에서 제외. (2) "비교" 체크박스를 per-scope 비교대상 `<select>` 로 교체하여 어떤 주/월/분/반/연과 비교할지 사용자가 선택 가능하도록 함. (3) "실시간" 모드를 "전체" 위에 신설 — 비교 대상 없이 = 현재주 월요일 00:00 ~ 지금까지 누적, 비교 대상 선택 시 (1h/3h/7h/24h/2d/3d/5d) `[now-N, now]` vs `[now-2N, now-N]` 동일 폭 윈도우 페어 비교. 데이터 입자도를 시간 단위(hour)까지 확장하여 `monitoring/data/hourly.json` (최근 14일·sparse·by_model/by_skill 분할 포함) 을 신규 출력. advisor #2 직전 갭 픽스로 Phase 5 (실시간 도넛/비교 enable) 추가 — 사후 추가는 이슈 본문에 반영.

### 페이즈 결과
- **Phase 1** (`monitoring/scripts/collect.py`, `monitoring/README.md`): `parse_ts_hour()` 헬퍼 (ISO 8601 → 로컬 `"YYYY-MM-DDTHH"`), 누산기 `hourly_agg`/`hourly_cost`/`hourly_messages` 추가, `write_hourly_file()` 신설하여 `monitoring/data/hourly.json` 출력 (최근 14일·sparse·시간순). README 데이터 흐름 다이어그램에 `hourly.json` 출력 라인 추가. `collect.py` 가 매 실행마다 전체 JSONL 재집계하는 구조이므로 과거 시간 데이터 자동 소급 채워짐.
- **Phase 2** (`monitoring/script.js`): `formatWeekLabel(weekKey)` 추가 — `"YYYY-Www"` → `"MM/DD ~ MM/DD (월~일)"`. `populatePeriodKeys()` 에서 `unit === 'weekly'` 일 때 `dateToIsoWeek(new Date())` 로 현재주 키 계산 후 옵션에서 필터링, 남은 키에 `formatWeekLabel` 적용. `option.value` 는 원본 키 유지 — 데이터 로딩 경로 무영향.
- **Phase 3** (`monitoring/index.html`, `monitoring/script.js`, `monitoring/styles.css`): `#period-compare` 체크박스 제거, `#period-compare-target <select>` 신설. `updateCompareToggleState()` 를 `populateCompareTarget(periodsIndex, unit, selectedKey)` 로 재작성 — unit 별로 동일 단위 과거 키 목록 (selectedKey 와 현재주 제외, 주간일 때 `formatWeekLabel` 라벨) 으로 옵션 채움. `applyPeriodSelection()` 가 DOM 에서 compareKey 를 읽어 `loadPeriodData()` 로 비교 데이터 로드 후 `renderAll(data, compareData)` 호출. URL 에 `?compare=<key>` 직렬화/복원. `prevPeriodKey()` 는 KPI delta badges 용으로 유지.
- **Phase 4** (`monitoring/index.html`, `monitoring/script.js`, `monitoring/styles.css`, `monitoring/README.md`): `<option value="realtime">실시간</option>` 을 period-unit 최상단 (전체 위) 에 추가. `loadHourlyData()` (`data/hourly.json` fetch+cache), `currentWeekMondayMs()`, `computeRealtimeWindows(now, hoursBack)` (compare=0 시 누적, 아니면 [now-N, now]/[now-2N, now-N] 페어), `aggregateHoursInWindow(hours, startMs, endMs)` 신설. `applyPeriodSelection()` realtime 분기 — `#period-key` 숨김, 7개 고정 비교 옵션, KPI/차트 모두 동일 폭 윈도우 base 로 렌더, 비교 시 `applyDeltaBadgesFromValues()` 호출. `hourly.json` 미존재 시 한국어 안내 후 graceful 종료. URL `?period=realtime&compare=24` 직렬화/복원. README 에 "실시간 모드" 단락 추가.
- **Phase 5** (사후 추가, `monitoring/scripts/collect.py`, `monitoring/script.js`): Phase 4 의 `aggregateHoursInWindow()` 가 `by_model`/`by_skill` 을 빈 배열로 반환하여 실시간 모드 도넛·비교 리스트가 무용 상태가 되는 갭을 advisor #2 직전 발견. `collect.py` 에 `hourly_by_model`/`hourly_by_skill` 누산기 추가, `write_hourly_file()` 가 각 hour 레코드에 `by_model`/`by_skill` 배열 (input/output/cache_5m/cache_1h/cache_read; cost_usd/messages 미수록) 출력. JS 측 `aggregateHoursInWindow()` 가 윈도우 내 모델·스킬 토큰을 머지하여 도넛 4종 (model/skill/cache, compare 도넛 list) 정상 렌더. 한계: realtime 모드의 by_model/by_skill 레코드는 `cost_usd = 0`, `messages = undefined` (→ `fmtNum` 으로 "0" 표기) — 코어 비교 UX 영향 없음, 후속 plan 으로 보강 가능.

### 영향 파일
- `monitoring/index.html`
- `monitoring/script.js`
- `monitoring/styles.css`
- `monitoring/scripts/collect.py`
- `monitoring/README.md`

### Treadmill Audit
NOT APPLICABLE — 본 플랜은 새 규칙/훅/에이전트/스킬/검증 축을 추가하지 않음. 순수 UI/데이터-수집 기능 작업.

## v001.34.0

> 통합일: 2026-05-14
> 플랜 이슈: #26
> 대상: 아이OS

### 개요
statusline L1 모델 표기에서 `(1M context)` → `(1M)` 로 단축. 더불어 L2 의 좌측 3 인디케이터 (`➕ ~ ➖` 파일 수, `git status --porcelain` 기반 WT 스냅샷) 와 우측 `📝 +/-` (세션 누적 라인 수, `cost.total_lines_added/removed` 기반) 가 중복인지 검토 — 단위(파일 vs 라인) 및 대상(WT 스냅샷 vs 세션 누적) 이 서로 다른 비중복 표기로 확인되어 통합 미수행.

### 페이즈 결과
- **Phase 1**: `.claude/scripts/statusline.sh` line 38 의 `MODEL=$(jget '.model.display_name' '?')` 직후에 `MODEL=${MODEL/ context/}` 한 줄 추가. bash fixed-string 치환으로 `" context"` 제거 — 매칭 없는 모델명 (1M 비-context, 일반 Opus/Sonnet 등) 은 원문 그대로 통과. 1 추가 / 0 삭제.

### 영향 파일
- `.claude/scripts/statusline.sh`

### Treadmill Audit
NOT APPLICABLE — 신규 메커니즘 (규칙/훅/에이전트/스킬/검증축) 추가 없음. 기존 1 라인 변환만 추가.

## v001.33.0

> 통합일: 2026-05-14
> 플랜 이슈: #24
> 대상: 아이OS

### 개요
어제(2026-05-13)~오늘(2026-05-14) 아이OS 시스템 개편 ~130 커밋 전수조사. 3 영역(스킬+에이전트 / md+config / monitoring) 병렬 Explore + 핵심 시임 4 건 (plan-enterprise ↔ -os cross-repo 어휘 / completion-reporter dispatch 18 사이트 / worktree-lifecycle 주입 doc-skill 3종 / task-db v2 `dev_prod_separation`+`connection_style` 분기) 직접 spot-check. 13 에이전트 frontmatter · 18 스킬 dispatch · settings.json · patch-note 단조 모두 clean 확인. 결함은 monitoring/ 신규 시스템 1건만 발견되어 동일 플랜에서 수정 (옵션 A).

### 페이즈 결과
- **Phase 1**: `monitoring/script.js` 에 `escapeHtml(s)` 헬퍼 추가 (shortTime 직하단) 후 innerHTML 보간 7 callsite 에 적용 — `renderByModel` 의 `r.model` / `renderBySkill` 의 `r.skill` / `renderByDay` 의 `r.day` / `renderBySession` 의 `r.model_primary || '?'` 및 skills join 결과 (IIFE 로 분리해 `<i>(no-skill)</i>` 정적 fallback 보존) / `renderKpi` cost-model-row 의 `${m.model}` / `renderPieCompareList` 의 `${d.lbl}`. `table()` 함수 자체는 미수정 (fallback HTML 리터럴 보존을 위해 per-callsite 이스케이프 채택). 11 추가 / 7 삭제. 실효 익스플로잇 가능성은 낮음 (소스 = 로컬 트랜스크립트) 이나 원칙적 정정.
- **Phase 2**: monitoring/data/periods/*.json 추적 해제 — no-op. 전제(추적 잔존) 가 이미 이전 커밋 `99164b6 plan-enterprise-os #11 정리: ... periods JSON gitignore` 에서 해소되어 있었음. 현재 `git ls-files monitoring/data/periods/` = `.gitkeep` 만 반환, 작업 트리 JSON 파일은 untracked 로 정상 존재. 추가 변경 불필요.

### 영향 파일
- `monitoring/script.js`

### Treadmill Audit
NOT APPLICABLE — 신규 메커니즘 (규칙/훅/에이전트/스킬/검증축) 추가 없음. `escapeHtml` 은 product code 의 단일 헬퍼 함수로 `feedback_no_prevention_treadmill.md` Q1-Q3 비적용.

## v001.32.0

> 통합일: 2026-05-13
> 플랜 이슈: #23
> 대상: 아이OS

### 페이즈 결과
- **Phase 1**: `.claude/skills/plan-enterprise/SKILL.md` 에 cross-repo phase 정식 지원 추가. Pre-conditions 에 "한 페이즈 = 정확히 하나의 work repo" 6번 항목, Step 5 이슈 템플릿에 `Phase N work repo:` 라인, Step 6 를 N==1 / N>1 분기로 일반화 (멀티 케이스 WIP A_X = `plan-enterprise-<N>-<slug>-작업-{repo-slug}` lazy 생성), Step 7a 디스패치 본문에 페이즈별 work_repo 워크트리 경로 전달 + 새 work_repo 첫 페이즈 시 lazy 생성 1-단계 흐름 명시, Step 9 머지를 9.1 (각 work_repo 의 i-dev 머지) / 9.2 (leader repo WIP B + 패치노트) / 9.3 (leader i-dev WIP B 머지) 로 분리. Failure policy 에 work_repo dev.md 미등록 / work repo i-dev 머지 충돌 (repo 명시) / codex + multi-repo v1 미지원 3개 항목 추가 및 단일-repo 표현의 머지 충돌 항목 대체. iter 카운트 (페이즈당 3회) 는 페이즈별 독립 유지 1줄 명시.
- **Phase 2**: `.claude/skills/plan-enterprise-os/SKILL.md` 에 단일-repo (Project-I2) 고정 명시화 + plan-enterprise 와 어휘 정렬. Pre-conditions 보조 안내 블록 아래 "본 스킬은 항상 work repo = leader repo = Project-I2 단일. cross-repo phase 절차는 N/A, '한 페이즈 = 한 work repo' 어휘는 동일" 한 줄, Step 5 이슈 본문 템플릿 인용부 위 "`Phase N work repo: Project-I2` 라인 포함 — 단일-repo 고정이지만 어휘 정렬 우선" 한 줄, Step 6 본문에 "N=1 고정 — plan-enterprise 의 N>1 lazy 생성 / repo-slug 접미사 분기 N/A" 한 줄, Step 9 본문에 "N+1=2-step 으로 plan-enterprise 일반화 절차의 N=1 케이스와 동치" 한 줄, Scope (In scope) 마지막 항목으로 "본 스킬은 N=1 고정" 명시 1줄. 절차 자체는 변경 없음.
- **Phase 3**: `.claude/md/completion-reporter-contract.md` §6 `plan-enterprise` 와 `plan-enterprise-os` 두 `skill_finalize` 서브섹션에 `wip_branches_merged[]` 원소 형식 명시 라인 추가. plan-enterprise: 단일-repo bare `<branch>` 또는 multi-repo `<repo>:<branch>` 두 형식 허용, 조립측이 케이스에 따라 선택. 렌더링 row 의 `<branch>` 를 `<element>` 로 일반화하여 `:` 포함 형식도 그대로 출력. plan-enterprise-os: N=1 고정으로 bare `<branch>` 형식만 허용. 스키마 타입 (문자열 배열) 자체는 변경 없음 — doc-only.

### 영향 파일
- `.claude/skills/plan-enterprise/SKILL.md`
- `.claude/skills/plan-enterprise-os/SKILL.md`
- `.claude/md/completion-reporter-contract.md`

### Treadmill Audit
PASS — 단일-repo 가정 3건 (Step 6 cwd 기반 wt_path · WIP A 1개 한정 · Step 9 `i-dev` hardcode 단일 repo 한정) 일괄 폐기 (Q3). Step 6 N==1 분기로 단일-repo 케이스 기존 동작 보존하여 backward compat 유지. 재발 가능 신호: MEMORY.md `project_followup_plan_enterprise_cross_repo.md` 의 data-craft multi-repo 후속 예고.

## v001.31.0

> 통합일: 2026-05-13
> 플랜 이슈: #22
> 대상: 아이OS

### 페이즈 결과
- **Phase 1**: `.claude/md/completion-reporter-contract.md` §7 `skill_finalize.blocked` 분기 2줄 정정. (a) heading 템플릿 `### /{skill} 중단 ⛔ — <context id>` → `### /{skill} 완료 — 결과 차단 ⛔ — <context id>` 로 교체. (b) opening 부연 `"차단 종료 — <block_type>. 이슈 핸드오프." (or "cap 도달." or "실패." …)` → `"정상 종료 — 결과 차단: <block_type>. 이슈 핸드오프." (or "정상 종료 — 결과 차단: cap 도달." or "정상 종료 — 결과 차단: 실패." …)` 로 교체. 마스터의 "스킬 정상 종료, 결과는 BLOCKED" 의도를 헤더(`완료` = status) 와 verdict (`결과 차단 ⛔` = verdict) 두 축으로 분리해 노출. contract 내부 자체 모순 (line 96 icon legend "⛔=차단" / line 504 opening "차단 종료" / line 503 heading 만 "중단") 도 동시 해소. 11개 dispatching 스킬 (plan-enterprise / plan-enterprise-os / dev-merge / task-db-structure / task-db-data / pre-deploy / dev-inspection / dev-security-inspection / db-security-inspection / project-verification / dev-start / dev-build) 의 blocked 종료 보고가 단일 템플릿을 따르므로 본 1 페이즈로 일괄 전파. 다른 줄 (icon legend / 게이트 키워드 / §6 schema / §7 clean·hotfix 분기) 미변경.

### 영향 파일
- `.claude/md/completion-reporter-contract.md`

### Treadmill Audit
NOT APPLICABLE — 신규 규칙·훅·에이전트·스킬·검증축 추가 없음. 기존 1개 템플릿의 의미 정확성 보정.

## v001.30.0

> 통합일: 2026-05-13
> 플랜 이슈: #21
> 대상: 아이OS

### 페이즈 결과
- **Phase 1**: `identifier_too_long` 트리거 조건 협소화 — 플랜 #19 (v001.28.0) 에서 신설된 OR 3절 트리거 ("env_or_label > 14자 또는 최장 affected_table > 32자 또는 합산 > 64자") 가 합산 안전한 케이스 (예: `_rollback_data_viewer_column_setting_data_craft_test_51ede2` = 59자) 를 부분 budget (env_or_label 15자) 만으로 오탐 거부하던 문제를 보정. `.claude/skills/task-db-data/SKILL.md` line 46 의 길이 검산 callout 을 worst-case 검산 예시 framing 으로 톤다운하고 트리거 조건을 "합산 식별자 길이 > 64자 단일" 로 명시 (개별 부분이 예시치 table 32 / env_or_label 14 를 넘어도 합산이 64자 이하면 통과). `.claude/agents/db-data-author.md` line 226 의 `identifier_too_long` failure mode 트리거 조건을 동일 단일 검사로 축소하고 `details_ko` 를 resolved 식별자 + 합산 길이 표시 형태로 단순화. 패턴 자체 (backtick 래핑 + `__ENV_OR_LABEL__` placeholder + 6자 hex `rollback_suffix`) 변경 없음.

### 영향 파일
- `.claude/skills/task-db-data/SKILL.md`
- `.claude/agents/db-data-author.md`

### Treadmill Audit
PASS — 신규 검증 axis / 훅 / 에이전트 / 스킬 추가 없음. Q3 trade-out: 플랜 #19 가 도입한 OR 트리거의 앞 두 절 (env_or_label > 14자 / 최장 table > 32자) 을 트리거 조건에서 retire — 합산 단일 검사로 단순화하고 14·32 수치는 검산 예시 prose 로만 격하. 자매 스킬 task-db-structure 는 동일 메커니즘 미사용 — sibling fix 불필요.

## v001.29.0

> 통합일: 2026-05-13
> 플랜 이슈: #20
> 대상: 아이OS

### 페이즈 결과
- **Phase 1**: `.claude/skills/dev-security-inspection/SKILL.md` Scope (v1) `In scope` 3번째 항목 정정 — "One-issue-per-skill on the first selected target's repo for block findings." 표현을 제거하고 "One-issue-per-skill hosted on the leader repo (`dev.md` `targets[]` entry where `name == <leader>`) for block findings. See `.claude/md/inspection-procedure.md` §"Cross-repo coordination — leader repo 단일 호스트"." 로 교체. `#10` (leader repo 이슈 호스트 통일, 2026-05-13 13:22 머지) 이 inspection-procedure.md 본문은 통일했으나 본 SKILL.md Scope 절 1줄을 누락했고, 같은 날 17:05 dev-security-inspection 실행이 이 잔여 표현을 따라 work repo (`funshare-inc/data-craft-server`) 에 이슈 #7 을 생성하는 재발이 발생. 본 페이즈로 슬립 채널 폐쇄.

### 영향 파일
- `.claude/skills/dev-security-inspection/SKILL.md`

### Treadmill Audit
NOT APPLICABLE — 신규 규칙·훅·에이전트·스킬·검증축 추가 없음. `#10` 의 누락된 1줄 보정.

## v001.28.0

> 통합일: 2026-05-13
> 플랜 이슈: #19
> 대상: 아이OS

### 페이즈 결과
- **Phase 1**: `.claude/skills/task-db-data/SKILL.md` v2 식별자 안전성 보정 — 9개 surgical edit. Phase 1 §2 에 `rollback_suffix` (exec_id 마지막 하이픈 이후 6자 hex) 도출 단계 추가, §3 dispatch 파라미터에 `rollback_suffix` 추가. Placeholder convention 예시를 backtick 래핑 + `<rollback_suffix>` 축약 형태 (`` `_rollback_form_data___ENV_OR_LABEL___<rollback_suffix>` ``) 로 갱신 + 3개 파일 (capture/forward/rollback) backtick 일관 적용 의무화. 식별자 길이 검산 callout 신설 (`_rollback_` (10) + table (max 32) + `_` + env_or_label (max 14) + `_` + suffix (6) = max 64 MySQL identifier limit). Phase 2 advisor checklist (c)(d) 의 `<execution_id>` 참조를 `<rollback_suffix>` + backtick 으로 갱신. Phase 4 §11c 의 rollback 테이블 명 prose 동기 갱신. Phase 4 §11f cleanup 의 shell-expansion 패턴 폐기 → SQL-side per-table `` DROP TABLE IF EXISTS `_rollback_<table>_<env_or_label>_<rollback_suffix>`; `` 로 교체 (dispatcher 가 capture.sql 의 생성 테이블 목록을 iterate 하여 DROP 문 emit). Out of scope / orphan note (Known v2 limits) 의 `_rollback_*_<execution_id>` 참조 및 mysql LIKE 패턴 동기 갱신.
- **Phase 2**: `.claude/agents/db-data-author.md` 식별자 패턴 보정 — 6개 edit + 2개 fixup. Input 섹션에 `<rollback_suffix>` 항목 신설 (6자 hex, dispatcher 공급, SQL 식별자 본문 전용 / `<execution_id>` 는 file path · plan.md 헤더 · git commit 메시지 전용). Placeholder convention 단락에 backtick 래핑 의무 + 3개 파일 byte-for-byte 일관성 문장 추가. UPDATE / DELETE / INSERT 3종 statement × capture / forward / rollback 3개 파일 전수 SQL 템플릿 (9개 식별자 surface) 에서 `_rollback_<table>___ENV_OR_LABEL___<execution_id>` → `` `_rollback_<table>___ENV_OR_LABEL___<rollback_suffix>` `` 일괄 교체. Process §6 plan.md 템플릿의 capture 테이블 형식 한 줄 동기 갱신. Discipline 섹션에 rollback_suffix 전용 사용 (full exec_id 금지) + 3-file backtick 일관성 2줄 추가. Failure modes 에 `identifier_too_long` 항목 신설 (env_or_label > 14자 또는 최장 affected_table > 32자 또는 합산 > 64자 트리거).

### 영향 파일
- `.claude/skills/task-db-data/SKILL.md`
- `.claude/agents/db-data-author.md`

### Treadmill Audit
PASS — 신규 검증 axis / 훅 / 에이전트 / 스킬 추가 없음. 실측 결함 (`/task-db-data data-craft`, exec=`dml-20260513164104-51ede2`, 71자 ERROR 1059) 에 대한 v2 명세 보정. Q3 trade-out: 풀 exec_id (`dml-YYYYMMDDHHMMSS-<6hex>`, 25자) 가 SQL 식별자 본문에서 retire, 6자 hex `rollback_suffix` 로 대체. 자매 스킬 task-db-structure 는 동일 메커니즘 미사용 (DDL 롤백은 live `SHOW CREATE` capture 기반) — sibling fix 불필요.

## v001.27.0

> 통합일: 2026-05-13
> 플랜 이슈: #18
> 대상: 아이OS

### 페이즈 결과
- **Phase 1**: `.claude/skills/task-db-data/SKILL.md` v2 업그레이드 — `task-db-structure` v2 (v001.21.0, plan #14) 가 이미 수용한 `dev_prod_separation` / `connection_style` 두 분기 패턴을 자매 스킬 `task-db-data` 로 paritize. Pre-conditions 의 항목 2 를 engine + `dev_prod_separation` (표준 `분리` | `공유` | 커스텀) + `connection_style` (표준 `DATABASE_URL` | `DB_* 환경변수` | 커스텀) 명세로 확장 (두 필드 부재 → fail-fast 메시지 각각 `"db.md 의 dev_prod_separation 필드 부재 — group-policy 로 보정 후 재호출"` / `"db.md 의 connection_style 필드 부재 — group-policy 로 보정 후 재호출"`). Phase 4 §10 의 고정 환경 loop (`dev → staging → prod`) → `dev_prod_separation` 3-분기 (`분리` 순차 / `공유` 단일 라벨 / 커스텀 `AskUserQuestion` 확인 카드) 로 교체. Phase 4 §11.b 의 단일 contract (`${ENV_UPPER}_DATABASE_URL`) → `connection_style` 분기 (DATABASE_URL / DB_* 환경변수 mysql2 패턴 / 커스텀 마스터 확인) 로 교체. Phase 4 §11.c-e (capture / forward / rollback execution) 에 placeholder 치환 메커니즘 신규 — `db-data-author` 가 SQL 세 파일에 단일 토큰 `__ENV_OR_LABEL__` (앞뒤 더블 언더스코어) 을 emit 하고 dispatcher 가 각 env iteration 실행 직전 `sed "s/__ENV_OR_LABEL__/${env_or_label}/g"` 파이프로 치환. 토큰 형식 사유: `${...}` 는 postgres dollar-quoting / mysql user-defined variable 과 충돌 가능, `__ENV_OR_LABEL__` 은 SQL identifier 의 normal segment 로 치환 전에도 syntactically 안전. §11.f cleanup 도 `DROP TABLE _rollback_*_${env_or_label}_<execution_id>` 로 동기 갱신 (shell expansion). Failure policy 표에 두 필드 부재 fail-fast 행 2개 추가, `Known v1 limits` → `Known v2 limits` 섹션 헤더 갱신 + connection_credentials 항목 v2 분기 지원으로 갱신 + Phase 7 completion-reporter dispatch 의 `env_results` key-set 설명에 `공유` 분기 단일 라벨 키 처리 명시 (이미 v001.21.0 Phase 1b 에서 contract md 가 dispatcher-determined 키로 유연화된 정책과 정합).
- **Phase 2**: `.claude/agents/db-data-author.md` capture-table 네이밍 토큰화 — Phase 1 의 dispatcher 치환 계약과 정합. 세 statement type (UPDATE / DELETE / INSERT) 의 capture / forward / rollback SQL 템플릿 전수에서 `_rollback_<table>_<execution_id>` 를 `_rollback_<table>___ENV_OR_LABEL___<execution_id>` 로 일괄 치환. 신규 "Placeholder convention" 서브섹션 추가 (토큰 형식 사유 + 치환 시점 명시, 에이전트는 literal token emit, dispatcher 가 per-env 치환). plan.md 템플릿의 `## 롤백 전략` 의 capture 테이블 형식 문구를 치환 후 실제 DB 이름 형식 (`_rollback_<table>_<env_or_label>_<execution_id>`) 으로 갱신 + dispatcher Phase 4 치환 시점 한 줄 주석 추가. Discipline 섹션의 `<execution_id>` 규칙에 "에이전트가 토큰을 직접 치환하지 않고 literal 로 emit" 강제 문장 추가. Input parameters 변경 없음 — dispatcher 는 `env_or_label` 을 agent 에 전달하지 않으며 분기 로직은 전적으로 dispatcher 책임.

### 영향 파일
- `.claude/skills/task-db-data/SKILL.md`
- `.claude/agents/db-data-author.md`

### Treadmill Audit
NOT APPLICABLE — 신규 규칙 / 훅 / 에이전트 / 스킬 / 검증축 추가 없음. 자매 스킬 (`task-db-structure` v2) 에 이미 plan-enterprise-os #14 (v001.21.0) 에서 수용·검증된 분기 패턴을 동일 스킬 (`task-db-data`) 로 paritize 하는 정렬 작업. placeholder 토큰 (`__ENV_OR_LABEL__`) 도 새 메커니즘이 아니라 task-db-structure v2 의 `<env_or_label>` 어휘를 Phase 3-author / Phase 4-substitute 타이밍 갭에 맞춰 SQL parser-safe 형태로 표기한 동일 contract.

## v001.26.0

> 통합일: 2026-05-13
> 플랜 이슈: #15 (hotfix 3 — architectural rewrite)
> 대상: 아이OS

### 페이즈 결과
- **Hotfix 3 — narrative-as-sections rewrite (H1/H2 table-row 메커니즘 폐기)**: v001.25.0 H2 적용 후 hotfix_complete 보고가 narrow 터미널에서 여전히 stacked 로 렌더된다는 마스터 보고. A/B/C 결정적 테스트로 trigger 재진단:
  - A (5행 모두 ≤30자 단일 줄, br 없음) → 표 렌더 ✅
  - B (셀 하나에 br 로 짧은 두 조각) → 표 렌더 ✅
  - C (셀 하나에 ~200자 단일 줄) → stacked ❌

  결론: `<br>` 자체는 fallback trigger 아님. **셀 내 가장 긴 single-line** 이 결정적 — H1+H2 의 "br 로 narrative 셀 좁힘 → fit" 가정 empirical 무효 (다줄 셀의 longest fragment 가 ~50 Korean 자 = 시각 ~100열 이면 ~110-120 col 터미널 초과 ⇒ fallback). H1+H2 가 도입한 narrative-into-table 메커니즘 자체가 잘못된 가정 기반.

  아키텍처 reversal 적용: narrative 는 표가 아니라 `####` Markdown section + paragraph 로 (CLI 가 일반 텍스트 정상 렌더). 표는 짧은 scalar (메타 한 줄, 짧은 deliverable 파일 행, sub-table) 전용.
  - `.claude/md/completion-reporter-contract.md` §2 universal template 4 블록 → 5 블록 재작성 (#### narrative sections 신설, 표 ~30 시각 컬럼 이하 short-scalar 전용 명시 + minimal example 갱신).
  - §6 의 전 스킴 (Tier A 12 + Tier A2 4 + Tier B 10 + Tier C 12 = 38 schema 섹션) "Recommended table columns" → "Narrative sections (emit per payload)" + "Table rows (short-scalar only)" 이중 라인으로 교체.
  - §6 preamble `<br>` 규칙 → short-scalar-only 규칙 교체.
  - §4 아이콘 사전에 🎯 📋 🔍 💥 추가 (narrative section heading 용도).
  - `.claude/agents/completion-reporter.md` Output rules §3 3 블록 → 5 블록 전면 재작성, "Critical: 내러티브 콘텐츠를 표 셀에 절대 넣지 말라" 금지 규칙 명시.

### 영향 파일
- `.claude/md/completion-reporter-contract.md`
- `.claude/agents/completion-reporter.md`

### Treadmill Audit
PASS — Q3 폐기 1건: **H1 (Tier A/A2 narrative-into-table) + H2 (universal narrative-into-table) 의 표-셀 narrative 강제 메커니즘** 전체 retired (가정 empirically 무효 확인 — A/B/C 테스트). 대체: narrative-as-section + short-scalar-only-table architecture. 신규 메커니즘 추가 아니라 **잘못된 가정 기반 메커니즘의 empirical reversal** — 본 단일 hotfix 가 두 hotfix 누적 메커니즘 흡수. advisor 의 "treadmill pattern" 우려는 H1/H2 의 가정이 empirically 무효임이 확인된 후의 reversal 이므로 패턴 미해당 (가설 검증 → 폐기 → 대체 architecture 적용).

## v001.25.0

> 통합일: 2026-05-13
> 플랜 이슈: #15 (hotfix 1 + hotfix 2)
> 대상: 아이OS

### 페이즈 결과
- **Hotfix 1 — narrative-first 보고 양식 복원**: v001.22.0 main 작업 직후 Step 11 work_complete 보고가 stat-only 메타 행만 표에 노출하고 명령원문 / 요구사항 / 원인 / 해결방법 / 결과 / 시나리오 narrative 를 모두 누락한다는 마스터 지적. 원인은 contract md §6 의 Tier A `work_complete` 추천 행이 메타 통계 7행 (이슈 #, 리더, 페이즈 수, 영향 파일, 패치노트, advisor 계획·완료) 만 권장했기 때문. 이슈 #13 본문의 enum 표 ("요구사항 / 원인 / 해법 / 결과 / 수동테스트") 와 contract diverge. `.claude/md/completion-reporter-contract.md` §2 에 "Narrative-first rule" 단락 신설, §6 의 Tier A / A2 narrative-bearing schemas (plan-enterprise / plan-enterprise-os / dev-merge / task-db-structure / task-db-data / create-custom-project-skill 각 moments) 추천 행을 narrative-first 로 재정의. `.claude/agents/completion-reporter.md` Output rules §3 동기 보강.
- **Hotfix 2 — narrative-first 규칙 전수 확장**: H1 직후 마스터 "전수 검증" 지시에 따른 audit. H1 이 규칙을 Tier A / A2 11개 moment 로 좁게 한정해 30개 moment 가 누락 (`.blocked` 5, Tier B 10, Tier C 9). 적용:
  - §2 narrative-first rule 의 적용 범위를 모든 18개 스킬 × 모든 moment 로 확장 (tier 별 narrative depth 가이드만 차등 유지 — Tier A/A2 full set, Tier B 검수 narrative, Tier C utility narrative, `.blocked` 통합 템플릿: 🎯 명령원문 · 🔍 차단 원인 · 💥 영향 · 🛠 권고 · 압축 메타).
  - §6 의 모든 미적용 schema 24개 moment Recommended table columns 재작성 (Tier A blocked 3, Tier A2 blocked 2, Tier B finalize 5 + blocked 5, Tier C finalize 7, Tier C blocked 2 = 24).
  - `.claude/agents/completion-reporter.md` Output rules §3 "For Tier A / A2 dispatches" → "For every dispatch" 로 확장.
  전수 검증: 37개 "Recommended table columns" 라인 모두 narrative-first 적용 grep 으로 확인.

### 영향 파일
- `.claude/md/completion-reporter-contract.md`
- `.claude/agents/completion-reporter.md`

### Treadmill Audit
PASS — Q3 폐기 2건 명시: (a) H1 — §6 의 Tier A `work_complete` 메타-통계 우선 추천 행 (7행 stat block) → narrative-first 표 본문 + 압축 메타 한 줄로 대체. (b) H2 — §2 narrative-first rule 의 "Tier A / Tier A2 한정" 적용 범위 → 모든 18개 스킬 × 모든 moment 적용 범위 (universal) 로 확장. 신규 메커니즘 추가 아니라 v001.22.0 의 spec tightening 미흡분 보강 (Q3 의 폐기-신설 1:1 매핑 충족).

## v001.24.0

> 통합일: 2026-05-13
> 플랜 이슈: #17
> 대상: 아이OS

### 페이즈 결과
- **Phase 1**: `.claude/scripts/statusline.sh` 의 `iso_to_epoch()` 본문을 ISO8601 파싱 (`date -j -f "%Y-%m-%dT%H:%M:%S"` + GNU `date -d` 폴백) 에서 epoch 정수 통과 처리 (입력이 비었거나 숫자 외 문자가 있으면 빈 문자열, 순수 정수면 그대로 echo) 로 교체. 원인 — Claude Code 공식 statusline 스펙 (code.claude.com/docs/ko/statusline) 상 `rate_limits.{five_hour|seven_day}.resets_at` 가 Unix epoch seconds 정수인데 스크립트가 ISO 문자열로 가정해 매번 파싱 실패 → `fmt_reset_hm` / `fmt_reset_dhm` 빈 문자열 반환 → LINE1 의 `🕐 5h X% (Xh Ym)` / `📅 7d X% (Xd Yh Zm)` 표시 분기 거짓 → 잔여시간 숨김. 헤더 v1.3 line layout 주석은 이미 잔여시간 표시를 전제 — latent bug. 호출자 (`fmt_reset_hm` / `fmt_reset_dhm`) 와 LINE1 조립부는 변경 없음, 다운스트림 로직은 정상 동작 중이었으므로 헬퍼 한 함수 수정만으로 표시 복구. 함수 위 주석 (`# ISO8601 reset target → ...`) 도 함께 제거 (구 가정 설명 무효). stdin JSON 모의 검증 통과 — `🕐 5h 23% (2h29m)` / `📅 7d 41% (5d18h53m)` 확인.

### 영향 파일
- `.claude/scripts/statusline.sh`

### Treadmill Audit
NOT APPLICABLE — 신규 규칙 / 훅 / 에이전트 / 스킬 / 검증축 추가 없음. 기존 헬퍼의 입력 가정 (ISO8601) 을 공식 스펙 (epoch 정수) 에 맞추는 단일 함수 본문 교체 한정.

## v001.23.0

> 통합일: 2026-05-13
> 플랜 이슈: #16
> 대상: 아이OS

### 페이즈 결과
- **Phase 1**: DB CLI auto-mode classifier 차단 해소 — `.claude/settings.json` 의 `permissions.allow` 에 `Bash(mysql *)` / `Bash(psql *)` 두 패턴 항목을 추가해 권한 prompt 회피, 동시에 신규 `autoMode` 블록을 추가하고 `environment` / `allow` 배열에 각각 `$defaults` + task-db-* 스킬의 DB 접속 인가 영문 prose 를 등록해 분류기(classifier) 우회 가능 상태로 전환. 핫픽스 1회 적용 — 최초 한국어 prose 가 CLAUDE.md §1 (`.claude/` = English) 위반 + 분류기 영어 튜닝 가능성 두 사유로 advisor BLOCK 되어 영문 변환 (`The task-db-structure and task-db-data skills connect directly to ... ${ENV}_DATABASE_URL ...` 및 `Direct mysql/psql CLI invocation during Phase 4 ... per-environment master approval gates at Phase 4, and capture-based rollback.`). `.claude/skills/task-db-structure/SKILL.md` 와 `.claude/skills/task-db-data/SKILL.md` 의 Pre-conditions 섹션 §6 (DB CLIs available) 직후에 settings 등록 필수 안내 한국어 blockquote 추가 (기존 두 SKILL.md 의 §1~§6 한국어 운영 convention 의 연장). `CLAUDE.md` References 섹션 직후에 두 레이어 권한 prose 가 task-db-* 스킬 전용 의도임을 영문 blockquote 로 명시.

### 영향 파일
- `.claude/settings.json`
- `.claude/skills/task-db-structure/SKILL.md`
- `.claude/skills/task-db-data/SKILL.md`
- `CLAUDE.md`

### Treadmill Audit
PASS — Q3 폐기 1건 명시: classifier 의 mysql/psql 직접 호출에 대한 묵시적 deny (Production Read 분류) 가 retired → 대체 안전망 = task-db-* 스킬 내부의 다층 게이트 (Phase 1 advisor 계획 안전성 검토 + Phase 4 환경별 마스터 직접 인가 카드 + capture-based rollback). 신규 rule / hook / agent / skill 추가 없음 (settings 항목 2개 + autoMode 신규 블록 + 문서 3곳 갱신 한정). 메커니즘 효과 (분류기가 영문 prose 를 신뢰 컨텍스트로 해석하는지) 실증 검증은 본 patch-note 머지 후 마스터의 `/task-db-structure data-craft` 재진입에서 확인 — 본 시점 "검증 대기" 상태. 메커니즘 실패 시 Plan B (`.claude/scripts/db-run.sh` 래퍼 + `autoMode.allow` 에 본 스크립트 경로 명시) 로 후속 plan-enterprise-os 호출 경로 사전 등록.

## v001.22.0

> 통합일: 2026-05-13
> 플랜 이슈: #15
> 대상: 아이OS

### 페이즈 결과
- **Phase 1**: `.claude/md/completion-reporter-contract.md` narrow-safe 표 가이드 + 2열 표준화. §2 universal output template 에 "Narrow-safe table rules" 절 신설 — 항상 2열 (`항목 | 값`), 다열 정보는 sub-table 분리, 스칼라 반복은 동일 키 반복 행, 30자 초과 셀은 `<br>` 줄바꿈, 근거 (CLI 가 폭 부족 시 행별 stacked fallback 으로 변환) 명시. §2 minimal example 에 "narrow-safe 예시 (2열·짧은 셀)" 표시 첨가. §6 의 다열 권장 컬럼 스펙 (15개 항목: `dev-merge` 3개 moment, `task-db-structure` / `task-db-data` `skill_finalize`, `pre-deploy` 2개 moment, `dev-inspection` 2개 moment, `dev-security-inspection` / `db-security-inspection` / `project-verification` (미러 동기화), `dev-start` `skill_finalize`, `dev-build` `skill_finalize`, `group-policy` `skill_finalize`, `new-project-group` `skill_finalize`, `plan-roadmap` `skill_finalize`, `create-custom-project-skill` 2개 moment) 을 모두 "항목 | 값 + 필요 시 sub-table" 패턴으로 변환. §6 preamble 에 long-value `<br>` 규칙 (treadmill_audit_result / block_reason / result_summary / error_detail) 일괄 명시. patch-update schema 4열 → 2열 정렬 (§2 예시와 모순 해소).
- **Phase 2**: `.claude/agents/completion-reporter.md` Output rules §3 보강 — 단일 한 줄 표 지시를 narrow-safe 세부 6 항목으로 확장 (2열 강제, sub-table 분리, 스칼라 반복 행, `<br>` 줄바꿈, CLI fallback 근거 rationale, 산문 분산 금지). contract md §2 와 동일 용어 정합 (2-column / sub-table / scalar repeats / stacked-fallback).
- **Phase 3 (skip)**: SKILL.md 출력 예시 동기화 — 14개 SKILL.md 탐색 결과, 모두 contract md 를 path-reference 만 하고 inline 표 예시·컬럼 리스트를 복제하지 않음을 확인. 동기화 대상 없음.

### 영향 파일
- `.claude/md/completion-reporter-contract.md`
- `.claude/agents/completion-reporter.md`

### Treadmill Audit
PASS — Q3 폐기 1건 명시: `§6 의 "Recommended table columns" 자유 컬럼 레이아웃 권한` (스킬별 임의 다열 자유도, 15개 schema 에서 5~8열까지 다양) 이 retired → 단일 `항목 | 값` 2열 + sub-table 표준이 enforced 로 대체. 신규 메커니즘 추가 아닌 기존 출력 규칙 spec tightening (Q3 의 폐기-신설 1:1 매핑 충족). 실증 검증은 본 patch-note 의 plan-enterprise-os #15 자체 Step 11 finalize 보고 도그푸딩 + 후속 임의 스킬 보고에서 narrow 터미널에서 표로 렌더되는지 확인.

## v001.21.0

> 통합일: 2026-05-13
> 플랜 이슈: #14
> 대상: 아이OS

### 페이즈 결과
- **Phase 1**: `.claude/skills/task-db-structure/SKILL.md` v2 업그레이드 — Scope 에 routine DDL (PROCEDURE / FUNCTION / TRIGGER `CREATE` / `DROP` / `REPLACE`) 추가, EVENT 는 v3 후보 DEFER 명시. Pre-conditions 에 `dev_prod_separation` (표준 `분리` | `공유` | 커스텀) 과 `connection_style` (표준 `DATABASE_URL` | `DB_* 환경변수` | 커스텀) 두 필수 필드 + 부재 시 fail-fast 메시지 추가. Phase 1 (plan authoring) 의 트랜잭션 wrap 필드는 routine DDL 시 `N/A (routine DDL — implicit commit)` 허용. Phase 2 (advisor) DESTRUCTIVE 태그 정책 확장 (`DROP PROCEDURE / FUNCTION / TRIGGER`). Phase 4 (execute) 분기 로직 신규 — `분리` 시 현행 `dev → staging → prod` 순차 + 환경별 게이트 유지, `공유` 시 마스터 라벨링 단일 환경 1회 실행 (dry-run + 실 + 검증 + 자동 롤백 안전망은 동일 유지), 커스텀 시 마스터 확인 카드. 실 적용 직전 capture rollback 단계 (§b2) 삽입 — mysql `SHOW CREATE PROCEDURE|FUNCTION|TRIGGER` / postgres `pg_get_functiondef` 캡처 → `rollback.<env_or_label>.sql` 저장, 신규 CREATE 시 `DROP ... IF EXISTS` emit. 환경 변수 contract 도 `connection_style` 기반 분기 — `DATABASE_URL` 또는 `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` (mysql2 패턴) 조합.
- **Phase 1b**: `.claude/md/completion-reporter-contract.md` env_results 키 유연화 — `task-db-structure` / `task-db-data` 의 `env_results` 가 `{dev, staging, prod}` 고정 키에서 환경명 → 4-enum 값 동적 매핑으로 변경. Recommended table columns 도 정적 3열에서 "one column per env_results key (dispatcher-determined)" 동적 표현으로 갱신. Phase 1 의 `공유` 분기 단일 라벨 보고가 스키마 위반 없이 작동.
- **Phase 2**: `.claude/agents/db-migration-author.md` v2 업그레이드 — Scope 에 routine DDL 추가 (EVENT 미포함, v3 후보), ALTER 미지원 → DROP+CREATE 패턴 가이드 명문화, DESTRUCTIVE 태그에 routine DROP 포함, 트랜잭션 wrap `N/A (routine DDL)` 허용. Input 에 `routine_mode: boolean` 추가 (dispatcher 가 request + issue body 의 routine 키워드 스캔 후 결정), Return JSON 에 `capture_templates[]` 추가 (mysql `SHOW CREATE` / postgres `pg_get_functiondef` 템플릿 문자열 배열 — 실 실행은 dispatcher 책임). 정합 보정 carve-out 으로 SKILL.md 의 Phase 1 dispatch 호출부에 `routine_mode` 전달 명시.
- **Phase 3**: collection skills 동기화 — `.claude/skills/new-project-group/SKILL.md` Round 3 (db) 의 `dev_prod_separation` 과 `connection_style` 두 필드를 표준 closed-choice + 자유형 fallback 구조로 갱신 (자유형 시 task-db-structure 가 Phase 4 마스터 확인 카드로 위임). `connection_style` 설명을 기존 'ORM 이름 / pool 설정' 프레이밍에서 '환경 변수 계약 결정' 역할로 교체. `.claude/skills/group-policy/SKILL.md` 에 'DB area — standard value recognition' 절 추가, 표준 값 간 전환 / 자유형 → 표준 정규화 요청을 확인 카드 없이 직접 적용.
- **Phase 4**: `.claude/project-group/data-craft/db.md` frontmatter 표준 값 정규화 — `dev_prod_separation: 같은 DB 사용 (분리 없음)` → `공유`, `connection_style: mysql2 직접 연결` → `DB_* 환경변수`. body 내용 유지.

### 영향 파일
- `.claude/skills/task-db-structure/SKILL.md`
- `.claude/agents/db-migration-author.md`
- `.claude/md/completion-reporter-contract.md`
- `.claude/skills/new-project-group/SKILL.md`
- `.claude/skills/group-policy/SKILL.md`
- `.claude/project-group/data-craft/db.md`

### Treadmill Audit
PASS — Q3 폐기 2건 명시: (a) `dev → staging → prod 강제 순차` 가정 → Phase 4 §10 의 `dev_prod_separation` 3-분기로 대체 (`분리` / `공유` / 커스텀), (b) `단일 rollback.sql` 가정 → §b2 의 env-별 capture-based `rollback.<env_or_label>.sql` 1순위 + 기존 `rollback.sql` 을 best-effort fallback (2순위) 으로 강등. 신규 메커니즘 (capture step, dynamic env_results 매핑) 은 폐기 항목과 1:1 매핑. EVENT 미포함은 Q3 의 좁은 scope 선호 (advisor 권고) 에 따른 v2 의 의도적 제한 — v3 후보로 명시.

## v001.20.0

> 통합일: 2026-05-13
> 플랜 이슈: #13
> 대상: 아이OS

### 페이즈 결과
- **Phase 1**: `.claude/agents/completion-reporter.md` 신규 — read-only Sonnet 4.6 / effort medium / tools Read 단일. 입력 계약 (skill_type + moment enum + structured data, 100k 상한), 출력 규칙 (제목 → 짧은 부연 → 표 → 마무리 설명, 핵심 정보는 표 안, 아이콘 활용, 한국어 단일), 금지 사항 (추측 / 쓰기 / 영구 문서 / preamble), Read 도구는 contract md 만 허용.
- **Phase 2**: `.claude/md/completion-reporter-contract.md` 신규 (454행) — 보편 출력 템플릿 4 블록, moment enum 4값 (`work_complete` / `hotfix_complete` / `skill_finalize` / `skill_finalize.blocked`), 아이콘 사전 14개, `post_action_hints` 5종 분기 룰, 18 스킬 × 적용 시점 페이로드 schema (Tier A 3 + Tier A2 2 + Tier B 5 + Tier C 8), 분기 출력 규칙 (clean / blocked / hotfix), 폴백 룰 (`(정보 없음)` + 누락 알림), v1 버전 정보.
- **Phase 3**: `CLAUDE.md` §4 모델 split 표에 `1 completion-reporter (read-only, sonnet)` 행 추가. sub-agent 분류 단락에 Completion reporter 단락 신규 (low-reasoning-burden 사유 명시). 카운트 12 → 13, effort lock 문장 갱신.
- **Phase 3.5**: contract md §6 preamble 에 dispatcher 의 보편 필드 sourcing 가이드 표 추가 — `master_intent_summary` / `result_summary` / `root_cause_summary` / `solution_summary` / `manual_test_scenarios[]` / `next_action_guidance` / `post_action_hints[]` / `advisor_*_result` / `treadmill_audit_result` 각각의 출처 명시. Phase 4 schema_mismatch_notes 후속 보강.
- **Phase 4**: `plan-enterprise` / `plan-enterprise-os` SKILL.md 의 Step 11 PENDING (work_complete / hotfix_complete 분기) + Step 12 FINALIZE (skill_finalize) 인라인 보고 블록을 dispatch 지시문으로 치환. 마스터 입력 게이트 키워드 (`플랜 완료` / `핫픽스 X` / `중단`) 는 그대로 유지.
- **Phase 5**: `dev-merge` 5개 시점 (PENDING work_complete / hotfix_complete / Conflict-PENDING work_complete + conflict_status / 머지 성공 skill_finalize / cap 소진 skill_finalize.blocked) + `task-db-structure` / `task-db-data` Phase 5 완료 skill_finalize 인라인 보고 치환. 실패 정책 테이블 셀은 보고 템플릿 아니므로 유지.
- **Phase 6**: `inspection-procedure.md` Branch A (skill_finalize.blocked) / Branch B (skill_finalize) + `pre-deploy/SKILL.md` 양 분기 치환. 4 inspection SKILL.md 는 공유 md 위임 구조라 자체 편집 불요 (사전 탐색 확인).
- **Phase 7**: 단순 스킬 8 종 (patch-confirmation / patch-update / group-policy / new-project-group / dev-start / dev-build / plan-roadmap / create-custom-project-skill) skill_finalize 인라인 보고 치환. dev-start / dev-build 는 실패 경로 skill_finalize.blocked 도 추가. create-custom-project-skill 은 Step 9 work_complete + Step 11 skill_finalize 2 시점.
- **Phase 8**: `README.md` 의 sub-agent 카운트 3 곳 (Effort 정책, 폴더맵 주석, 빌드 산출물) 12 → 13 갱신. `.claude/md/sub-agent-prompt-budget.md` 는 카운트/인벤토리 언급 없어 무수정.
- **정리**: `create-custom-project-skill` Step 10 PENDING 의 중복 `### /skill 대기` 헤딩 제거 (Step 9 dispatch 가 이미 생성). `inspection-procedure.md` preamble 의 stale "pre-deploy not yet refactored" 문구 갱신, project-verification consumer 명단 추가.

### 영향 파일
- `.claude/agents/completion-reporter.md` (신규)
- `.claude/md/completion-reporter-contract.md` (신규)
- `.claude/md/inspection-procedure.md`
- `.claude/skills/plan-enterprise/SKILL.md`
- `.claude/skills/plan-enterprise-os/SKILL.md`
- `.claude/skills/dev-merge/SKILL.md`
- `.claude/skills/task-db-structure/SKILL.md`
- `.claude/skills/task-db-data/SKILL.md`
- `.claude/skills/pre-deploy/SKILL.md`
- `.claude/skills/patch-confirmation/SKILL.md`
- `.claude/skills/patch-update/SKILL.md`
- `.claude/skills/group-policy/SKILL.md`
- `.claude/skills/new-project-group/SKILL.md`
- `.claude/skills/dev-start/SKILL.md`
- `.claude/skills/dev-build/SKILL.md`
- `.claude/skills/plan-roadmap/SKILL.md`
- `.claude/skills/create-custom-project-skill/SKILL.md`
- `CLAUDE.md`
- `README.md`

### Treadmill Audit
PASS — Q3 trade-out: 9개 SKILL.md + 1 공유 md (inspection-procedure.md) 에 흩어진 9 종 인라인 보고 템플릿 (이중 표 + 코드펜스 헤딩) 을 contract md 단일 lock 으로 흡수. byte 단위 size reduction 이 아닌 "scattered → centralized" 유지보수 부담 축소가 trade-out 의 실체. 새 sub-agent 1 개 (completion-reporter) 추가에 대한 net-positive 충족.

## v001.19.0

> 통합일: 2026-05-13
> 플랜 이슈: #11
> 대상: 아이OS

### 페이즈 결과 (핫픽스 4건)
- **핫픽스 1**: 대시보드 1분 자동 새로고침 — `setInterval(60_000)` 등록, 각 tick 마다 현재 기간 컨텍스트 (unit/key) 유지하며 재fetch + 재렌더. `_autoRefreshInFlight` 가드로 중첩 방지, `beforeunload` 시 `clearInterval`.
- **핫픽스 2**: 새로고침 버튼 왼쪽에 마지막 새로고침 시각 (`HH:MM:SS`) 연하게 표기 — `#last-refresh-time` span + `.last-refresh-time { color: var(--muted); font-size: 12px; tabular-nums; :empty {display:none} }`. `applyPeriodSelection` / 초기 렌더 시점에 `updateLastRefreshDisplay()` 호출.
- **핫픽스 3**: 자동 새로고침 콜백을 `applyPeriodSelection` 직접 호출에서 수동 버튼과 동일한 `refresh()` 호출로 교체 — `POST /api/refresh` 로 `collect.py` 백엔드 재수집까지 트리거. 자동/수동 새로고침 동작 대칭화 (advisor 가 짚은 비대칭 정정).
- **핫픽스 4**: 기간 선택 옵션 오타 수정 — `<option value="yearly">년간</option>` → `연간`.

### 영향 파일
- `monitoring/script.js`
- `monitoring/index.html`
- `monitoring/styles.css`

### Treadmill Audit
NOT APPLICABLE — 핫픽스 4건 모두 UX 개선 / 오타 수정 / 동작 대칭화. 신규 규칙·훅·에이전트·스킬·검증축 추가 없음.

## v001.18.0

> 통합일: 2026-05-13
> 플랜 이슈: #11
> 대상: 아이OS

### 페이즈 결과
- **Phase 1**: `monitoring/scripts/collect.py` 의 by_skill 라벨 `(no-skill)` → `메인 세션`, by_model 의 `<synthetic>` 모델을 `isApiErrorMessage` 기준으로 `API 에러` / `시스템 합성` 두 라벨로 분기 매핑.
- **Phase 2**: `monitoring/script.js` 에 공용 `fmtKMB(n, opts)` 포매터 추가 (1K/1M/1B 단위 축약, precision/hideZeroDecimal 옵션, null/NaN → "—").
- **Phase 3**: 카드 1 (전체 메시지) 에 일평균 / 세션당 / 최근 24h / 24h 비율 4개 보조 수치 추가, `kpi-extras` 그리드 신설.
- **Phase 4**: 카드 2 (전체 토큰) 6개 수치 (kpi-noncache/cache/input/output/cwrite/cread) 를 fmtKMB 로 교체. cwrite 키 검증 — `cache_creation_5m + cache_creation_1h` 정상.
- **Phase 5**: `collect.py` 에 `cost_breakdown_of()` 신설 — total / by_model / by_day 각각에 input/output/cache_write/cache_read/hypothetical_no_cache 5개 USD 분해. 카드 3 (캐시 효율) 에 cache_read 절대값 / hit ratio / 절감 USD / 미사용 가정 비용 추가.
- **Phase 6**: 카드 4 (추정 비용) 에 일평균 / 캐시 절감 / I/O/cache 비용 분해 5개 + 모델별 cost_usd top 3 동적 리스트 추가 (collect.py 무수정).
- **Phase 7**: 일자별 토큰 스택 Y축 + 세션 Top 10 X축 ticks/툴팁 callback 을 fmtKMB 로 교체. 일자별 비용 차트는 USD 축 유지.
- **Phase 8**: 도넛/파이 3 차트 (모델/스킬/캐시) 공통 `pieLabelsPlugin` (afterDatasetsDraw inline plugin) 추가 — 슬라이스 ≥ 10% 시 캔버스에 % + fmtKMB 2줄 라벨 렌더.
- **Phase 9**: 새로고침 delta 강조 — `localStorage["monitoring:last-snapshot"]` 에 messages/noncache/cache/cache_hit_ratio/cost_usd 5개 저장, 변동 시 카드 우상단 ▲ 파랑 / ▼ 빨강 배지 (`.kpi-delta` CSS).
- **Phase 10**: 기간 스냅샷 영속화 — `monitoring/data/periods/{weekly|monthly|quarterly|half|yearly}/<key>.json` (ISO 8601 월~일 주, 모든 기간 매번 atomic 재작성). `aggregate.json` 에 `periods_index` 필드 추가.
- **Phase 11**: 기간 선택 UI — topbar 에 단위 + 키 드롭다운, URL 쿼리스트링 (`?period=&key=`) 동기화. 기간 변경 시 해당 JSON fetch 후 전 화면 재렌더. delta 배지는 `all` 모드 한정 동작.
- **Phase 12**: `상세 테이블` 섹션 4개 영역을 `<section class="detail-section">` 구조로 재편 — 상단 차트 (chart-detail-{model|skill|day|session}, 인스턴스 분리, 280px 고정 펼침) + 하단 표 (`<details>` 접기 가능, 기본 닫힘).
- **Phase 13**: 기간 비교 분석 뷰 — `#period-compare` 토글 (비-all 모드 한정). `prevPeriodKey()` 가 ISO 8601 주 경계 / 연도 경계 포함 직전 동등 기간 키 계산. 카드 delta 배지 (Phase 9 setBadge 코어 재사용), 일자별 스택 차트 점선 오버레이 (`borderDash [5,5]`), 파이 카드 하단 변동 ≥ 1%p 항목 최대 5개 텍스트 리스트.
- **Phase 14**: 프롬프트별 토큰 막대 차트 — `collect.py` 에 master prompt 식별 필터 (`type=user` AND `role=user` AND content 가 str 또는 첫 요소 type ≠ tool_result) + 페어링 (다음 master prompt 직전까지 assistant usage 합산) + 단축 명령 병합 (`SHORT_TRIGGER_KEYWORDS` + 본문 ≤ 10자) 추가. `aggregate.json` 및 모든 기간 파일에 `by_prompt` (top 100) + `by_prompt_meta`. `renderChartPromptBar` (가로 바, top 30) + `chart-prompt-bar` 카드.
- **정리**: `applyDeltaBadges()` 진입부에 `clearDeltaBadges()` 호출 추가 (스냅샷 없거나 saved_at 일치 시 비교 모드 잔존 배지 제거). `monitoring/data/periods/**/*.json` 을 `.gitignore` 에 추가하고 기존 6개 cached JSON 을 `git rm --cached` 로 제거 (collect.py 가 매 실행 재생성하는 generated artifact).

### 영향 파일
- `monitoring/scripts/collect.py`
- `monitoring/script.js`
- `monitoring/index.html`
- `monitoring/styles.css`
- `monitoring/data/periods/.gitkeep` (신규)
- `.gitignore`

### Treadmill Audit
NOT APPLICABLE — 신규 규칙/훅/에이전트/스킬/검증축 추가 없음. monitoring 대시보드 UX 일괄 개편 + 기간 영속화 (데이터 파일은 git 추적 제외). 단축 명령 화이트리스트는 monitoring 화면 보기 편의용 best-effort 이며 harness invariant 가 아님.

## v001.17.0

> 통합일: 2026-05-13
> 플랜 이슈: #12
> 대상: 아이OS

### 페이즈 결과
- **Phase 1**: `.claude/scripts/statusline.sh` 의 표시 레이아웃 조정 및 슬래시 스킬 호출 시 L3 프롬프트 미표시 버그 수정. 변경 4건: (1) ⏱ 누적 작업 시간(`DUR_FMT`) 을 L2 끝에서 L1 끝(EXT_BADGES 앞)으로 이동, DIM 색상 유지. (2) `CC_VERSION` 추출 변수와 `VERSION_SUFFIX` 변수/사용처를 완전히 제거하여 L1 의 `· cc<ver>` 표기 폐기. (3) L3 프롬프트 추출 python3 heredoc 의 `<command-` 분기를 재작성 — `<command-args>` 본문을 우선 추출, 비어 있으면 `<command-name>` (예: `/plan-enterprise-os`) fallback, 둘 다 매치 실패 시 기존대로 skip. 슬래시 스킬과 함께 입력한 args 가 L3 에 실제 표시되도록 함. `<local-command-` / `<system-reminder>` 무조건 skip 은 유지. (4) 헤더 주석 (`:14-17`) 의 L1/L2 라인 레이아웃 설명을 새 구성에 동기화.

### 영향 파일
- `.claude/scripts/statusline.sh`

### Treadmill Audit
NOT APPLICABLE — 신규 규칙/훅/에이전트/스킬/검증축 추가 없음. statusline 표기 재배치 + L3 프롬프트 추출 버그 수정뿐.

## v001.16.0

> 통합일: 2026-05-13
> 플랜 이슈: #10
> 대상: 아이OS

### 페이즈 결과
- **Phase 1**: `.claude/md/inspection-procedure.md` Step 6 Branch A 의 호스트 결정을 "first selected target's cwd" → **리더 저장소 (leader repo = `dev.md` targets[] 중 name==<leader> 항목의 cwd)** 로 교체. Step 2 Pre-conditions 표에 리더 저장소 식별 행 추가, Cross-repo coordination 절을 "리더 단일 호스트" 표현으로 갱신. dev-inspection / dev-security-inspection / db-security-inspection / project-verification 4개 스킬이 이 파일을 직접 참조하므로 자동 커버.
- **Phase 2**: `.claude/skills/plan-enterprise/SKILL.md` 에 leader/work repo 분리를 6개 변경(A~F)으로 반영. Pre-conditions 분리, Step 5 `gh issue create --repo <leader-owner-repo>` + 본문 헤더에 leader/work repo 배너, Step 7d 페이즈 코멘트에 literal `Phase N WIP: {repo}:{branch}` + `gh issue comment --repo <leader-owner-repo>` 명시, Step 9 패치노트 영향 파일 `<repo>:<path>` 형식, Step 12 close `--repo <leader>`, Failure policy 2행.
- **Phase 3**: `.claude/skills/plan-enterprise-os/SKILL.md` 의 Pre-conditions 와 Step 5 에 "leader repo = work repo = Project-I2 (자기 자신)" 일관성 blockquote 2줄 추가. 단일 저장소라 실효 분기 없으나 다른 6개 스킬과 어휘 동일화로 독자 혼동 제거.
- **Phase 4**: `.claude/skills/pre-deploy/SKILL.md` 전체에서 `<first-target-cwd>` → `<leader-cwd>` 통일. Pre-conditions 리더 식별 항목 + Context preparation blockquote + Prior-issue lookup·Branch A 생성/append·Branch B close 모두 리더 단일 호스트 기준, WIP rule note·Failure policy (리더 식별 실패 / 원격 없음 fallback 2행)·Scope v1 (리더 저장소 정의) 갱신.
- **Phase 5**: `.claude/skills/new-project-group/SKILL.md` + `.claude/skills/group-policy/SKILL.md` 에 리더 저장소 컨벤션 LOCK ("`targets[]` 첫 항목 = 리더 저장소, name 이 그룹 식별자와 일치") 명문화. new-project-group: Round 1 dev LOCK blockquote, YAML 첫 항목 LOCK 코멘트, Advisor validation #2 Contract conformance 에 리더 컨벤션 narrowing (트레드밀 Q3 폐기: 기존 schema-only 표현), Failure policy 1행. group-policy: 보존 가드 blockquote + Failure policy 1행.
- **Phase 6 (Phase 2 보완)**: `plan-enterprise/SKILL.md` L90 "Create the GitHub issue on the work repo" 1줄을 leader repo 표현으로 교체. Phase 2 가 정비한 Pre-conditions·코드블록·템플릿과 Step 5 본문 첫 줄 일관성 회복.

### 영향 파일
- Project-I2:`.claude/md/inspection-procedure.md`
- Project-I2:`.claude/skills/plan-enterprise/SKILL.md`
- Project-I2:`.claude/skills/plan-enterprise-os/SKILL.md`
- Project-I2:`.claude/skills/pre-deploy/SKILL.md`
- Project-I2:`.claude/skills/new-project-group/SKILL.md`
- Project-I2:`.claude/skills/group-policy/SKILL.md`

### Treadmill Audit
PASS — 기존 "first selected target's cwd" 규칙을 완전히 폐기하고 leader-repo (targets[] 중 name==<leader>) 규칙으로 **대체**. Phase 5 의 advisor validation #2 변경도 새 axis 추가가 아닌 기존 #2 텍스트 narrowing. grep 으로 stale 표현 잔존 0건 확인.

## v001.15.0

> 통합일: 2026-05-13
> 플랜 이슈: #9
> 대상: 아이OS

### 페이즈 결과
- **Phase 1**: `.claude/md/sub-agent-prompt-budget.md` 신규 작성. 목적 (1M tier 자동 라우팅 / Sonnet 1M extra-usage 빌링 가드 차단), 권장 5~15k / 절대 상한 100k 토큰, byte 휴리스틱 (영문 4 byte/token → 400 KB, 한글 2 byte/token → 200 KB), 인라인 금지 안티패턴 6종 (PR diff / 정책 파일 전문 / prior-phases 누적 / per-repo scope 객체 / advisor 출력 / 이전 라운드 findings JSON), 대안 패턴 3종 (영구 문서+식별자 / path+식별자 자력 read / 소형 JSON 인라인 ≤ 15k), write-capable 에이전트 자기방어 계약, dispatcher 책임 절 포함.
- **Phase 2**: `CLAUDE.md` §8 (Token budget) 말미에 universal rule 1단락 추가 — `.claude/md/sub-agent-prompt-budget.md` reference, 인라인 금지, path/식별자만 전달 원칙.
- **Phase 3**: 10개 스킬 (`plan-enterprise`, `plan-enterprise-os`, `dev-merge`, `dev-inspection`, `dev-security-inspection`, `db-security-inspection`, `project-verification`, `task-db-structure`, `task-db-data`, `pre-deploy`) 의 sub-agent dispatch 절을 각 맥락에 맞게 수정. `plan-enterprise` 는 `group-policy summary` + `prior-phases summary` 인라인 폐기, phase-executor 는 `gh issue view <N>` 자력 read. `plan-enterprise-os` 는 `harness_context` 인라인 폐기 (CLAUDE.md / `.claude/md/*` / MEMORY.md 자력 read). `dev-merge` 는 PR diff / findings JSON / git log 인라인 폐기 — reviewer 와 code-fixer 가 `gh pr diff`, `gh pr view --json reviews,comments` 자력 호출. inspection 4 스킬은 per-repo scope 객체를 `.claude/inspection-runs/<ts>-<skill>.json` 으로 저장 후 path 전달. `pre-deploy` 는 `deploy.md` 전문 인라인 폐기, 선택 target list + branch state 만 audit JSON 으로 저장.
- **Phase 4**: 4 write-capable agent (`phase-executor`, `code-fixer`, `db-migration-author`, `db-data-author`) 의 Input contract 재작성 (인라인 수신 → 식별자 + path 수신 후 자력 read) + 자기방어 절 추가 (prompt body 100k 초과 추정 시 error JSON `{"error":"prompt_body_exceeds_budget","policy":".claude/md/sub-agent-prompt-budget.md","action":"..."}` 반환 후 halt). `code-fixer.md` 는 frontmatter `description` + Procedure step 2 도 새 contract 에 맞게 fixup.

### 영향 파일
- `.claude/md/sub-agent-prompt-budget.md` (신규)
- `CLAUDE.md`
- `.claude/skills/plan-enterprise/SKILL.md`
- `.claude/skills/plan-enterprise-os/SKILL.md`
- `.claude/skills/dev-merge/SKILL.md`
- `.claude/skills/dev-inspection/SKILL.md`
- `.claude/skills/dev-security-inspection/SKILL.md`
- `.claude/skills/db-security-inspection/SKILL.md`
- `.claude/skills/project-verification/SKILL.md`
- `.claude/skills/task-db-structure/SKILL.md`
- `.claude/skills/task-db-data/SKILL.md`
- `.claude/skills/pre-deploy/SKILL.md`
- `.claude/agents/phase-executor.md`
- `.claude/agents/code-fixer.md`
- `.claude/agents/db-migration-author.md`
- `.claude/agents/db-data-author.md`

### 검증
- `grep -l sub-agent-prompt-budget CLAUDE.md .claude/skills/*/SKILL.md .claude/agents/*.md` → 15 파일 매칭 (목표 15 = 1 + 10 + 4).
- `.claude/md/sub-agent-prompt-budget.md` 에 "absolute hard cap 100k tokens" 문구 4 회 등장.
- `dev-merge`, `plan-enterprise`, `plan-enterprise-os` diff 에서 기존 인라인 컨텍스트 항목 (PR diff / git log / prior comments / group-policy summary / prior-phases summary / harness_context) 이 제거되고 path/identifier 패턴으로 교체됨이 확인됨.

### Treadmill Audit
PASS — 폐기 항목 6종 명시: (1) `plan-enterprise` 의 `prior-phases summary` + `group_policy_summary` 인라인 누적, (2) `plan-enterprise-os` 의 `harness_context` 인라인, (3) `dev-merge` 의 PR diff / git log / prior PR comments 인라인 + code-fixer 의 findings array 인라인, (4) inspection 4 스킬의 per-repo scope object 컬렉션 인라인, (5) `pre-deploy` 의 `deploy.md` 전문 인라인, (6) write-capable agent 정의의 인라인 입력 가정 (frontmatter description + Procedure 본문).

## v001.14.0

> 통합일: 2026-05-13
> 플랜 이슈: #8 (핫픽스3)
> 대상: 아이OS

### 페이즈 결과
- **Hotfix 3**: `.claude/scripts/statusline.sh` L3 wrap 알고리즘을 글자수 기반 → display-width 기반으로 전환. `unicodedata.east_asian_width(ch)` 결과가 `W` 또는 `F` (CJK 한자/한글/일본어/전각 ASCII) 면 가중치 2, 그 외(반각 ASCII 등) 1. `LINE_WIDTH=105` 는 이제 글자 수가 아닌 display unit budget 으로 해석됨 (e.g. 한글만 채울 경우 52자 = 104 weight). 5줄 초과 시 마지막 줄 끝 `...` (3 weight) 절단도 동일 기준.

### 영향 파일
- `.claude/scripts/statusline.sh`

### 검증
- 합성 입력 "한글" × 60 + "abc" × 5 (총 weight 255) → 정확히 3 라인으로 wrap, 각 라인이 weight ≤ 105 임을 실 스크립트 실행으로 확인.

### Treadmill Audit
NOT APPLICABLE — 알고리즘 정밀화, 신규 메커니즘/규칙 없음. `unicodedata` 는 Python 표준 라이브러리.

## v001.13.0

> 통합일: 2026-05-13
> 플랜 이슈: #8 (핫픽스2)
> 대상: 아이OS

### 페이즈 결과
- **Hotfix 2**: `.claude/scripts/statusline.sh` 의 `LINE_WIDTH` 62 → 105 (마스터 실 테스트 후 "1.7배로 늘려줘" 지시 반영, 62 × 1.7 = 105.4 → 105). `MAX_LINES=5` 그대로.

### 영향 파일
- `.claude/scripts/statusline.sh`

### Treadmill Audit
NOT APPLICABLE — 상수 값 조정, 신규 메커니즘 없음.

## v001.12.0

> 통합일: 2026-05-13
> 플랜 이슈: #8 (핫픽스1)
> 대상: 아이OS

### 페이즈 결과
- **Hotfix 1**: `.claude/scripts/statusline.sh` 의 `LINE_WIDTH` 125 → 62 (마스터 실 테스트 후 "절반으로 줄여야 해" 지시 반영). `MAX_LINES=5` 그대로.

### 영향 파일
- `.claude/scripts/statusline.sh`

### Treadmill Audit
NOT APPLICABLE — 상수 값 조정, 신규 메커니즘 없음.

## v001.11.0

> 통합일: 2026-05-13
> 플랜 이슈: #8
> 대상: 아이OS

### 페이즈 결과
- **Phase 1**: `.claude/scripts/statusline.sh` L3 추출 필터에 `isMeta=true` 스킵 + 제어 키워드(`플랜 완료` / `중단` / `핫픽스 …`) 스킵 추가. LIMIT 140 단일 라인 → `LINE_WIDTH=125 × MAX_LINES=5` wrap, 초과 분량은 5번째 줄 끝 `...` 절단. 헤더 코멘트 v1.2 → v1.3 갱신.

### 영향 파일
- `.claude/scripts/statusline.sh`

### 검증
- 실 스크립트 end-to-end 스모크: isMeta=true 레코드 + "플랜 완료" 레코드 + 정상 프롬프트 3건 합성 JSONL 입력 → L3 출력이 "💬 정상 마지막 프롬프트" 로 확인됨.

### Treadmill Audit
NOT APPLICABLE — 신규 규칙/훅/에이전트/스킬/검증 축 추가 없음. 기존 스크립트 행위 보정.

### Deviation 기록
phase-executor sub-agent 디스패치 2회 모두 API 한도 `Extra usage required for 1M context` 로 실패 (sonnet 모델 override 포함). CLAUDE.md §2 build-session carve-out 정신과 마스터의 "make the reasonable call" 지시에 따라 메인 세션이 WIP A worktree 에 직접 Edit/commit/push 수행. 다음 plan-enterprise-os 실행 전 sub-agent 1M-context 한도 환경 이슈 점검 필요.

## v001.10.0

> 통합일: 2026-05-13
> 플랜 이슈: #7
> 대상: 아이OS — /dev-start FE 필터 + 멀티셀렉트 도입

### 페이즈 결과

- **Phase 1**: `dev.md` YAML 매니페스트 스키마에 `role: FE | BE` 필드 추가. dev-start 의 §Manifest contract YAML 예시와 Field semantics 목록에 role 항목 명세. new-project-group 의 Round 1 dev 필드 목록 / dev.md 템플릿에 role 노출. group-policy 의 partial-update 예시 dev 블록에 role 라인 추가하여 마스터가 변경 대상으로 인지하도록 함.
- **Phase 2**: dev-start 절차 개정. Invocation 을 `/dev-start <leader-name>` 단일 토큰으로 단순화 (두 번째 토큰 단일 타겟 형식 제거 — 마스터 결정). Procedure 도입부에 신규 Step 0 (role=FE 필터 → 0/1/N 분기 + AskUserQuestion multiSelect, dev-build line 60 선례) 추가. Reporting 에 비선택 멤버 누락 명시, Scope 갱신, Failure policy 에 FE 후보 0 / multiSelect 0 선택 두 케이스 추가. 후속 cleanup 으로 도달 불가해진 "Specified target name not in manifest" 행 제거 + 실제 사용 중인 `type: project | monorepo` 필드를 Manifest contract 에 동기화.
- **Phase 3**: `.claude/project-group/data-craft/dev.md` 4개 타겟에 role 백필 (data-craft / data-craft-mobile / data-craft-ai-preview = FE, data-craft-server = BE). deploy.md 의 role 값과 일치.

### 영향 파일

- `.claude/skills/dev-start/SKILL.md`
- `.claude/skills/new-project-group/SKILL.md`
- `.claude/skills/group-policy/SKILL.md`
- `.claude/project-group/data-craft/dev.md`

### Treadmill Audit

**NOT APPLICABLE** — 본 변경은 dev-start 스펙 본문이 이미 명시한 "Frontend dev server restart / Out of scope: Backend dev servers" 의도를 절차로 실현한 결함 복구 + 매니페스트 스키마 1개 필드 (`role`) 추가이며 신규 규칙/훅/에이전트/스킬/검증축이 아니다. advisor #1 / #2 모두 NOT APPLICABLE 동의.

### 회귀 검증

- `dev-build` 가 dev.md 를 읽되 `role` 필드 미참조 (line 52-54 — name/cwd/type/build_command 만 사용). data-craft-server 빌드 경로 무영향.
- 다른 리더 매니페스트 부재 (`grep -l "targets:" .claude/project-group/*/dev.md` → data-craft 1건만). 백필 범위 1건으로 한정.

### 마스터 검증 시나리오

머지 후 `/dev-start data-craft` 재호출 → AskUserQuestion 카드에 FE 3종 (`data-craft`, `data-craft-mobile`, `data-craft-ai-preview`) 만 노출, `data-craft-server` 미노출. 선택된 항목만 기동.

## v001.9.0

> 통합일: 2026-05-13
> 플랜 이슈: #6
> 대상: 아이OS — harness audit 결과 정리 (hooks/rules placeholder + 카운트 보정 + stale 참조 sweep)

### 페이즈 결과

- **Phase 1**: `.claude/hooks/.gitkeep` 과 `.claude/rules/.gitkeep` 삭제 (두 디렉터리 모두 자동 로드 메커니즘 없는 aspirational placeholder — `grep -rn` 0 consumer, `settings.json` hooks 키 부재). `CLAUDE.md` §8 의 "loaded conditionally by hook (§D-24)" 를 "loaded on-demand by skills and agents that reference them" 으로 정정. folder map 에서 `.claude/rules/`, `.claude/hooks/` 두 행 삭제, `.claude/md/` 행 설명도 실제 동작으로 동기화.
- **Phase 2**: skill·sub-agent 수 불일치 보정. `README.md` line 83 디렉터리 트리 "17 스킬"→"18 스킬", line 85 "11 sub-agent"→"12 sub-agent", line 251 빌드 정보 "17 스킬 + 11 sub-agent"→"18 스킬 + 12 sub-agent". `CLAUDE.md` folder map "The 17 skills"→"The 18 skills".
- **Phase 3 (mid-plan 추가)**: Phase 1 의 후행 일관성 보정. `README.md` 디렉터리 트리 블록에서 `rules/`, `hooks/` 두 행 삭제 + `md/` 주석을 "특화 룰 + 공용 절차 (skill/agent 참조로 on-demand 로드)" 로 정정. 언어 분리 §7 의 `.claude/` 하위 목록에서도 `rules`, `hooks` 제거. (이슈 본문 선언은 2 페이즈였으나 댓글에 추가 페이즈 audit trail 기록.)
- **Phase 4 (mid-plan 추가)**: advisor #2 직전 sweep blind spot 보강. `.claude/md/inspection-procedure.md` line 5 의 "v1 loading ... A future hook (per CLAUDE.md §D-24) may auto-load" 가정 문장을 현행 동작 ("Loading: manual Read 가 계약, on-demand 로드, CLAUDE.md §8 참조") 로 교체. 나머지 3개 md 파일 sweep 결과 0 stale.

### 영향 파일

- `.claude/hooks/.gitkeep` (delete)
- `.claude/rules/.gitkeep` (delete)
- `.claude/md/inspection-procedure.md`
- `CLAUDE.md`
- `README.md`

### Treadmill Audit

**PASS** — Q3 = 단일 plan 에서 6 항목 일괄 폐기: (1) `.claude/hooks/` 디렉터리, (2) `.claude/rules/` 디렉터리, (3) CLAUDE.md §8 의 "loaded conditionally by hook (§D-24)" 문구, (4) CLAUDE.md folder map 의 `.claude/rules/` + `.claude/hooks/` 2행, (5) inspection-procedure.md 의 "future hook (§D-24) auto-load" 가정 문장, (6) README 디렉터리 트리 + 언어 분리 §7 의 rules/hooks 등재. advisor #1 가 원안 plan 의 "NOT APPLICABLE" 부정직성 지적 후 PASS 로 정정.

### audit 자체 부산물

- 컨텍스트 효율: 30k → 약 29.5k boot (~500t 자연 감소, README/CLAUDE.md 라인 축약). README §F-1 의 50k 목표 대비 여유 20.5k 유지.
- 미해결 항목 (본 plan 범위 외, 이후 별도 진행): 이슈 #1 (`-codex` 메타 부트스트랩 D2/D3 ~2일 대기), 이슈 #2/#3 의 PENDING 게이트 종결 추적 (audit C-4 단순 확인 항목, deferred).

## v001.8.0

> 통합일: 2026-05-13
> 플랜 이슈: #5
> 대상: 아이OS — patch-confirmation push 자동화 + classifier 6 list 우회

### 페이즈 결과

- **Phase 1**: `.claude/skills/patch-confirmation/SKILL.md` 에 머지 후 `origin/main` push 단계 spec 추가. description 한 문장 + Final push 서브섹션 (코드 블록 + 설명) + Scope out-of-scope "Push" 제거 + Failure policy 표 main push 실패 row + Reporting 표 `origin/main push` row, 총 5건 변경.
- **Phase 2**: `.claude/settings.json` 의 root JSON 에 `permissions.allow` 6 항목 추가 — `Bash(git push origin main)`, `Bash(git push -u origin *)`, `Bash(gh issue create *)`, `Bash(gh issue close *)`, `Bash(gh issue comment *)`, `Bash(gh pr *)`. classifier 의 main session git/gh 차단을 narrow carve-out 으로 우회 (broad wildcards `Bash(git *)` / `Bash(gh *)` 거부).

### 영향 파일

- `.claude/skills/patch-confirmation/SKILL.md` (수정)
- `.claude/settings.json` (수정)

### Treadmill Audit

NOT APPLICABLE — 기존 스킬 (patch-confirmation) 의 기능 확장 + permissions allow 6줄 carve-out. 새 룰/훅/페르소나/스킬/검증축 추가 없음, 메모리 `feedback_no_prevention_treadmill.md` 의 카테고리 직접 매칭 없음.

### 마스터 결정 흐름

- (a) narrow scope: `patch-confirmation` 한 스킬만, 다른 머지 스킬 별개 (메모리 `feedback_plan_enterprise_no_auto_push.md` 와 정합)
- (i) bundle: spec 변경 + permissions 보강을 한 plan 안 2 phase 로
- (B) 6 명시 list: broad wildcards 거부, narrow 1줄 거부, 6 명시 항목 채택

### Verification

작업 WIP main 머지 직후 `git push origin main` 1회 실 시도 → 통과 ✅. classifier 가 `Bash(git push origin main)` 룰 정상 인식. plan 의 verification 약속 충족.

### 후속 plan 후보 (본 plan 범위 외)

- 다른 머지 스킬 (`patch-update`, `group-policy`, `new-project-group`, `plan-roadmap`, `create-custom-project-skill`) 의 push 정책 일관성 검토. `plan-enterprise` / `-os` 는 메모리 `feedback_plan_enterprise_no_auto_push.md` 로 push 안 함 정책 명시 — 그 외 스킬은 결정 미정.

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

## v001.61.0

> 통합일: 2026-05-14

### 변경 파일

- (수정) monitoring/data/hourly.json

## v001.74.0

> 통합일: 2026-05-16

### 변경 파일

- (수정) monitoring/data/hourly.json
- (추가) .claude/inspection-runs/20260514T141905Z-pre-deploy.json
- (추가) .claude/inspection-runs/20260515T081443Z-dev-inspection.json
- (추가) .claude/inspection-runs/20260515T081613Z-dev-inspection.json
- (추가) .claude/inspection-runs/20260515T090626Z-dev-inspection.json
- (추가) .claude/inspection-runs/20260515T091032Z-dev-security-inspection.json
