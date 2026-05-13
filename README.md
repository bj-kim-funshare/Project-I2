# Project-I2 (아이OS)

Claude Code 위에서 동작하는 외부 프로젝트 그룹 개발 자동화 하네스. Project-I (구 아이OS) 가 자기 보수에 자원 소진되어 실패한 뒤 다시 짠 v2 시스템.

핵심 철학: **단순·모듈화·재발 방지 트레드밀 회피**.

설계 의도와 빌드 과정의 원본 문서는 git history (커밋 `489b996` 직전) 에 보존되어 있다. 본 문서는 빌드 완료 시점의 시스템 정체성을 정리한 운영 가이드다.

---

## 시스템 구성

### 18 스킬 (베이스라인 17 + utility 1)

#### 단순 스킬 (7) — sub-agent 미사용

| 스킬 | 역할 |
|------|------|
| `dev-start` | 프로젝트 그룹의 프론트엔드 dev 서버 재시작 |
| `dev-build` (utility, 2026-05-13 추가) | 프로젝트 그룹 멤버 빌드 확인 (multi-select, 모노레포 포함) — gate 아닌 master 호출 utility |
| `patch-update` | 패치노트 메이저 버전 (파일번호) +1 |
| `patch-confirmation` | 미커밋 변경을 패치노트 새 마이너 버전에 기록 + 커밋 |
| `new-project-group` | 새 프로젝트 그룹 등록 + 4 정책 영역 초기 수립 |
| `group-policy` | 기존 그룹의 4 정책 (dev/deploy/db/group) 수정 |
| `plan-roadmap` | 대규모 계획을 여러 스킬 호출 시퀀스로 로드맵화 |
| `create-custom-project-skill` | 프로젝트 그룹 전용 커스텀 스킬 신설 |

#### Sub-agent + advisor 그룹 (8)

| 스킬 | 역할 | 사용 sub-agent |
|------|------|----------------|
| `dev-merge` | GitHub PR 기반 코드 리뷰 + 머지 | bug-detector, claude-md-compliance-reviewer, code-fixer |
| `pre-deploy` | 배포 사전 검증 (이슈 → plan-enterprise 위임 또는 실 배포) | deploy-validator |
| `dev-inspection` | 비-보안 코드 결함 검수 | code-inspector |
| `dev-security-inspection` | 비-DB 보안 + 의존성 audit | security-reviewer |
| `db-security-inspection` | DB 관련 보안 (DDL/migration/ORM/config/SQL) | db-security-reviewer |
| `project-verification` | 리팩토링 기회 분석 (dead code/중복/oversize/import) | refactoring-analyzer |
| `task-db-structure` | DDL 변경 (dev→staging→prod 자동 + 롤백) | db-migration-author |
| `task-db-data` | DML 변경 (capture+forward+inverse rollback) | db-data-author |

#### 핵심 (2)

| 스킬 | 역할 |
|------|------|
| `plan-enterprise` | 외부 프로젝트 그룹의 메인 개발 절차 (이슈 + 페이즈 + 5 관점 advisor) |
| `plan-enterprise-os` | 시스템 (아이OS) 자체 작업 (6 관점 advisor, Treadmill Audit 별도) |

### 11 Sub-agent

**리뷰어 (read-only, 7)**: `bug-detector` · `claude-md-compliance-reviewer` · `code-inspector` · `security-reviewer` · `db-security-reviewer` · `refactoring-analyzer` · `deploy-validator`

**작성/실행자 (write-capable Sonnet, 4)**: `code-fixer` · `db-migration-author` · `db-data-author` · `phase-executor`

**Gate-runner (Haiku, 1, 2026-05-13)**: `gate-runner` — lint/build 명령 mechanical 실행 + JSON 보고 (dev-merge 의 lint gate, plan-enterprise per-phase lint, dev-build utility 호출)

### 모델 토폴로지 (2026-05-13 lock)

| Layer | Model | 비고 |
|-------|-------|------|
| 메인 세션 | 마스터 `/model` 자유 선택 | `settings.json` 미고정 |
| `advisor()` tool | `claude-opus-4-7` | `.claude/settings.json` `advisorModel` — API 가드: 메인 모델 이상 강도 필수 (Sonnet inversion 시도 2026-05-13 철회) |
| 7 read-only 리뷰어 (계획) | `claude-opus-4-7` | 200k 일반 (1M 아님). agent frontmatter `model:` 명시 |
| 4 write-capable 실행자 (작업) | `claude-sonnet-4-6` | agent frontmatter `model:` 명시 |
| 1 gate-runner (lint/build 실행) | `claude-haiku-4-5` | agent frontmatter `model:` 명시 (2026-05-13 추가) |

**Effort 정책 (2026-05-13 lock)**: 12 sub-agent 전부 `effort: medium`. 각 agent frontmatter 의 `effort:` 필드로 선언 (Claude Code 공식 지원 필드, 값 `low`/`medium`/`high`/`xhigh`/`max`). 새 sub-agent 추가 시 명시적 예외 락이 없으면 동일.

상세는 `CLAUDE.md` §4 참조.

### 공용 절차

`.claude/md/inspection-procedure.md` — 4 inspection 패턴 스킬 (dev-inspection / dev-security-inspection / db-security-inspection / project-verification) 의 공통 절차. pre-conditions, scope 수집, sub-agent dispatch, GitHub 이슈 생성, 보고를 표준화.

---

## 디렉토리 구조

```
.claude/
├── rules/                   # 항상 로드되는 경량 룰 (현재 비어있음)
├── md/                      # 조건부 로드 특화 룰 + 공용 절차
│   └── inspection-procedure.md
├── skills/                  # 18 스킬
│   └── {skill-name}/SKILL.md
├── agents/                  # 12 sub-agent
│   └── {agent-name}.md
├── scripts/                 # .sh 통합 (현재 비어있음)
├── hooks/                   # rules 조건 일치 시 md 로드 트리거 (현재 비어있음)
├── project-group/{leader}/  # 그룹 등록 시 lazy-create
│   ├── Index.md
│   ├── dev.md / deploy.md / db.md / group.md
│   └── patch-note/patch-note-NNN.md
└── plan-roadmap/            # 로드맵 작성 시 lazy-create
    └── Roadmap-{N}-{title}.md

patch-note/                  # 아이OS 자체 패치노트 (루트)
└── patch-note-001.md

CLAUDE.md                    # 항상 로드되는 8 hard rules + 폴더 맵
README.md                    # 본 문서
```

---

## 핵심 설계 패턴

빌드 과정에서 정착된 일관 패턴:

### 1. 이슈 = source of truth (plan-* 스킬)

`plan-enterprise` / `plan-enterprise-os` 는 로컬 plan 문서를 만들지 않는다. ExitPlanMode 직후 GitHub 이슈 생성 → 조사자료 / 계획 / 페이즈 분할 / advisor 검증 / 페이즈 결과 / 최종 결과 를 모두 이슈 본문 + 코멘트에 기록.

### 2. "report-only + plan-enterprise 위임" (검증 스킬)

`pre-deploy` / 4 inspection 스킬은 findings 가 발견되면 직접 수정하지 않는다. GitHub 이슈를 생성하고 halt. 마스터가 `/plan-enterprise <leader> #N` 으로 이슈 해결 작업을 시작.

이 패턴이 자동 수정의 위험 (특히 main 브랜치 / prod 환경) 을 구조적으로 차단.

### 3. advisor `BLOCK:` 토큰 contract

advisor 의 prose 응답에서 `BLOCK: <reason>` 으로 시작하는 라인이 있으면 dispatcher 가 halt. 모호한 prose 해석으로 인한 silent pass 방지.

### 4. WIP `-작업` / `-문서` 분리

코드 작업 WIP 과 문서 작업 WIP 을 절대 하나로 합치지 않음. plan-enterprise 는 두 WIP (작업 → 문서) 순차 머지 패턴.

예외: `dev-merge` / `pre-deploy` — PR 기반 또는 운영 작업이라 nested WIP 무의미. (`task-db-*` 는 2026-05-13 에 PR 단계 폐기 + WIP→i-dev 자동 머지 + `plan.md` audit doc 으로 전환됨 — `-작업` WIP 사용.) 각 spec 에 carve-out 또는 변경 사항 명시.

### 5. i-dev 부트스트랩 carve-out

기본 작업 브랜치는 `i-dev`. 미존재 시 첫 사용 스킬이 `main` HEAD 에서 자동 분기. 사용자가 보면 새 브랜치 등장을 인지할 수 있도록 부트스트랩 사실을 보고에 명시.

### 6. scope 모드 (`version` | `today`)

4 inspection 스킬 공유:
- `version`: 마지막 `patch-confirmation` 커밋 이후 (없으면 patch-note-001 생성 커밋, 없으면 첫 커밋) → HEAD 까지
- `today`: 머신 로컬 자정 이후

`all` 모드는 폐기 (silent file truncation 위험).

### 7. 언어 분리 (CLAUDE.md §1)

- **영문**: CLAUDE.md / .claude/ 하위 (rules, md, skills, agents, scripts, hooks) 모든 spec 본문
- **한국어**: 사용자 보고, git 커밋 메시지, 이슈 제목·본문, PR 제목·본문, patch-note 콘텐츠

---

## 자주 쓰는 호출 흐름

### 새 프로젝트 그룹 등록
```
/new-project-group <leader> <name>=<path>,...
→ 4 정책 영역 (dev/deploy/db/group) 마스터 입력
→ Index.md + 정책 4개 + patch-note-001.md 생성
```

### 일반 개발 작업
```
/plan-enterprise <leader> <plan description>
→ Explore 탐색 → 페이즈 분할 → advisor 계획 검증 → ExitPlanMode
→ 이슈 생성 → WIP 분기 → phase-executor 순차 → advisor 완료 검증
→ 패치노트 작성 → i-dev 머지
```

### dev → i-dev 머지
```
/dev-merge <from-branch> i-dev
→ PR 생성 → 리뷰어 2 (compliance + bug-detector) 병렬
→ findings ≥ 80 confidence 시 code-fixer 핫픽스 (max 3 iter)
→ 클린 시 merge commit (--no-ff)
```

### 배포
```
/pre-deploy <leader> [<target-name>,...]
→ deploy-validator 검증
→ block findings → 이슈 생성 → plan-enterprise 위임
→ clean → build + deploy 순차 (환경별)
```

### 검수
```
/dev-inspection <leader> [version|today]
/dev-security-inspection <leader> [version|today]
/db-security-inspection <leader> [version|today]
/project-verification <leader> [version|today]
```
모두 동일 패턴: 발견 시 이슈 → plan-enterprise 위임.

### DB 작업
```
/task-db-structure <leader> [<issue#>]  # DDL
/task-db-data <leader> [<issue#>]       # DML
```
환경별 마스터 게이트 (dev → staging → prod), dry-run, auto-rollback.

### 시스템 자체 작업
```
/plan-enterprise-os <plan description>
→ 6 관점 advisor (Treadmill Audit 포함)
→ patch-note/patch-note-NNN.md (루트) 에 결과 기록
```

### 패치노트
```
/patch-update <아이OS|<leader>>       # 메이저 (파일번호) +1
/patch-confirmation <아이OS|<leader>>  # 미커밋 변경을 새 마이너 버전에 기록
```

### 메타
```
/create-custom-project-skill <leader> <description>
→ .claude/skills/{leader}-{slug}/SKILL.md 신설

/plan-roadmap [<existing-N>] <description>
→ .claude/plan-roadmap/Roadmap-{N}-{title}.md 신설/수정
```

---

## 알아둘 v1 제한

빌드 과정에서 의식적으로 v1 scope 밖으로 둔 항목:

- **lint / build / test 게이트**: §D-23 폐지 (마스터와 재설계 논의 예정)
- **`all` 모드**: 4 inspection 스킬 모두 `version` / `today` 만
- **DB 엔진**: MySQL / PostgreSQL 만 (SQLite / Mongo 등 미지원)
- **DB 자격증명**: 환경 변수만 (`${ENV_UPPER}_DATABASE_URL`)
- **DB 보호 테이블 (`protected_tables`)**: db.md 스키마 미설정
- **DML 동시 writer 안전성**: capture-and-rollback 은 no-concurrent-writers 전제
- **부트스트랩 의무**: `patch-note/patch-note-001.md` 자동 생성 X (마스터 수동)
- **모니터링 / 스테이터스라인 / 코덱스 협업**: §F-3 후속 블록 — 메인 빌드 이후

---

## 메모리 시스템

`~/.claude/projects/-Users-starbox-Documents-GitHub-Project-I2/memory/`:

- `project_history.md` — Project-I (구 아이OS) 실패 / I2 origin
- `feedback_no_prevention_treadmill.md` — net-positive 3 질문 의무 (영구)
- `feedback_incremental_verified_build.md` — 점진 빌드 모드 (시스템 확장 시 적용)

CLAUDE.md §6 의 "no prevention treadmill" 가 시스템 정체성의 핵심. 새 룰/훅/에이전트/스킬/검증축 추가 전 3 질문 (재발? 새 엣지케이스? 폐기 1건?) 의무 통과.

---

## 빌드 정보

- 빌드 세션: 2026-05-12 (9 시간)
- 산출물: 18 스킬 + 12 sub-agent + 1 공용 절차 + CLAUDE.md + patch-note 부트스트랩
- 총 코드량: 약 4,100 줄 / 29 md 파일
- 빌드 패턴: 마스터 1 단위 설명 → AI advisor 검증 → 함께 구축 (점진 검증 빌드)
- 검증 통과: frontmatter 무결성 100%, cross-reference 100%, 토큰 예산 50k 목표 ✓ (실측 30k)

## 참고

- CLAUDE.md — 8 hard rules + 폴더 맵 (모든 에이전트 공통)
- `.claude/md/inspection-procedure.md` — 4 inspection 스킬 공용 절차 상세
- Project-I (구) 위치: `/Users/starbox/Documents/GitHub/Project-I` (read-only, 보수·비판 참조용)
