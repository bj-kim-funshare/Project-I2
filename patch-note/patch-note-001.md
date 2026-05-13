# 아이OS — Patch Note (001)

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
