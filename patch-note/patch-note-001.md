# 아이OS — Patch Note (001)

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
