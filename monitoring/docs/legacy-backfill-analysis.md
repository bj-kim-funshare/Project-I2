# 구버전 아이OS 모니터링 데이터 백필 호환성 분석

작성일: 2026-05-20 | 관련 이슈: plan-enterprise-os #43

---

## 요약

구버전 아이OS (Project-I) 의 raw JSONL 세션 파일이 3개 디렉토리에 총 706개 파일로 온전히 보존되어 있다. 이 파일들은 현재 아이OS (Project-I2) 의 `collect.py` 가 사용하는 JSONL 스키마와 동일한 `usage` / `timestamp` / `costUSD` 구조를 가지며, PRICING 테이블에도 관련 모델이 이미 등재되어 있다. 따라서 `collect.py` 의 입력 소스 목록(`SESSION_DIRS`)에 3개 디렉토리를 추가하는 것만으로 2026년 4월 초부터 현재까지의 토큰·비용·모델·시간 축 데이터를 시간 단위로 완전 복원할 수 있다. 이 변경은 영구적이며, 이후 매 `collect.py` 실행마다 구버전 데이터가 자동 포함된다.

---

## 백필 원천 인벤토리

| # | 경로 | JSONL 파일 수 | 비고 |
|---|------|-------------|------|
| 1 | `~/.claude/projects/-Users-starbox-Documents-GitHub-Project-I` | 704 | Project-I 메인 저장소 세션 |
| 2 | `~/.claude/projects/-Users-starbox-Documents-GitHub-Project-I--claude-worktrees-elastic-visvesvaraya-b7dda5` | 1 | Project-I worktree (elastic-visvesvaraya) |
| 3 | `~/.claude/projects/-Users-starbox-Documents-GitHub-Project-I--claude-worktrees-sweet-mahavira-e1a1bf` | 1 | Project-I worktree (sweet-mahavira) |

- 파일 수는 2026-05-20 직접 실측값 (`ls *.jsonl | wc -l`).
- 이슈 본문 기재 수(704개)는 메인 디렉토리 기준이며, worktree 2개 포함 시 총 706개.
- Project-I2 현재 디렉토리(`-Users-starbox-Documents-GitHub-Project-I2`)는 별도 집계 중이며 백필 대상이 아님.

---

## 호환성 평가표

| 항목 | 구버전 (Project-I) | 현재 (Project-I2) | 복원 가능성 | 근거 |
|------|-------------------|-------------------|------------|------|
| 토큰 5종 + messages + cost_usd | raw JSONL `usage` 필드에 동일 구조 | 동일 | 완전 복원 | `collect.py:34-40` PRICING 및 usage 파싱 로직이 스키마 버전과 무관하게 동일 필드명 사용 |
| 모델 축 (opus-4-6 / sonnet-4-6) | JSONL `model` 필드에 동일 문자열 | PRICING 테이블에 `claude-opus-4-6`, `claude-sonnet-4-6` 모두 등재됨 | 완전 복원 | `collect.py:34-40` PRICING dict에 두 모델 키 존재 확인 |
| 시간/일/시 축 | JSONL `timestamp` (ISO 8601) | 동일 파싱 | 완전 복원 | `collect.py:646` timestamp 파싱은 표준 ISO 포맷 처리; 구버전 JSONL 도 동일 포맷 사용 |
| 세션 축 (JSONL 파일명 = UUID) | UUID 기반 파일명 | 동일 | 완전 복원 | 디렉토리만 다를 뿐 파일명 UUID 충돌 없음 — 다른 저장소 경로 → 다른 디렉토리 |
| 스킬 축 | 구버전 어휘 (페르소나명·구 스킬명) | I2 17개 스킬명 | 표시만 복원 (어휘 불일치) | `collect.py:646,1031` `attributionSkill` 은 `.get()` 안전 처리이므로 미지 스킬명도 그대로 출력됨 |
| 페르소나·프로젝트그룹 별도 축 | `by_persona` / `by_group` 축 존재 | 폐기됨 | 추출 불가 | I2 `collect.py` 에 `by_persona` / `by_group` 집계 코드 없음 |

---

## 대시보드 표시 안내

현재 대시보드의 **스킬 축(`by_skill`)** 에서 2026년 4월 초 ~ 5월 초 구간 데이터를 볼 경우, 라벨은 구버전 어휘(구 페르소나명, 구 스킬명)로 표시된다. 예를 들어 `project-lead`, `code-architect`, `deploy-manager` 등 Project-I 시절 페르소나 이름이나 구 스킬명이 그대로 나타날 수 있다.

이는 데이터 오류가 아니라 구버전 JSONL 의 `attribution.skill` 값이 원래 그 어휘를 담고 있기 때문이다. `collect.py:1031` 의 `.get()` 처리로 인해 현재 I2 17개 스킬 목록에 없는 이름도 그대로 집계되어 대시보드에 표시된다.

**페르소나·프로젝트그룹 별도 집계 축은 I2 에서 폐기**되었으며, 현재 대시보드에서는 해당 차원의 분포를 직접 조회할 수 없다.

---

## 폐기 축 데이터 참조 안내

구버전의 `by_persona` / `by_group` 분포(페르소나별·프로젝트그룹별 토큰·비용 집계)가 필요한 경우, 구버전 aggregate 파일을 직접 열어 확인해야 한다.

- **파일 경로**: `/Users/starbox/Documents/GitHub/Project-I/monitoring/data/aggregate.json`
- **크기**: 약 357 KB
- **스키마**: Project-I schema 2.0, 주 단위 집계
- **범위**: 2026-W15(2026-04-08) ~ 2026-W19(2026-05-12 11:43)
- **5축**: `by_model` / `by_terminal` / `by_skill` / `by_persona` / `by_group`

이 파일은 Project-I 저장소 내부에 있으며, I2 모니터링 파이프라인에서 자동으로 참조하지 않는다.

---

## 재실행 가능성 (영구 통합)

Phase 2 에서 `collect.py` 의 `SESSION_DIR` (단일 경로)를 `SESSION_DIRS` (리스트, 4개 디렉토리)로 확장하면, 이후 **매번 `collect.py` 실행 시마다 구버전 디렉토리가 자동 포함**된다. 별도의 백필 스크립트나 1회성 가져오기 단계가 없으며, 구버전 디렉토리가 부재하는 환경(다른 머신 등)에서는 silently skip 처리로 오류 없이 동작할 예정이다.

본 백필은 1회성 마이그레이션이 아니라 **영구적인 입력 소스 통합**이다. Project-I 저장소와 그 worktree 디렉토리가 머신에 존재하는 한, `collect.py` 실행 결과에는 항상 구버전 이력이 포함된다.
