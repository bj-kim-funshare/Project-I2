---
engine: mysql
framework: raw-sql
dev_prod_separation: 분리
env_management: git-tracked
migration_approach: 수동 SQL (ORM 미사용)
connection_style: DB_* 환경변수
---

# data-craft — db 환경 규정

## 핵심 정책

- **환경별 DB 분리** — dev = `data_craft_dev`, prod (`NODE_ENV=production`) = `data_craft_production`. 호스트 / 포트 / 계정 / 비밀번호 등 나머지 접속 정보는 두 환경이 공유하며, **DB명만 환경별로 분기**한다.
- `.env` 의 `DB_NAME` (dev fallback) / `DB_NAME_PROD` (prod 전용) 페어로 운영 — dev.md §"env 환경별 차등 변수 표준 — BE 페어 패턴" 정합. prod 환경에서 `DB_NAME_PROD` 미설정 시 `DB_NAME_PROD_NOT_CONFIGURED` 식별자로 즉시 throw (사일런트 dev 회귀 차단).
- 기존 `data_craft_ver_001`, `data_craft_test` 는 **보존 (폐기 아님)** — 참조 / 회복 용도로 남기되 신규 작업에서는 사용하지 않는다.
- 호스트 / 포트 / 계정 / 비밀번호 / 토큰 / API 키 등 시크릿은 각 저장소 `.env` 의 `DB_*`, `JWT_*`, `SMTP_*`, `TOSS_*`, `NTS_*` 변수 참조. env 는 각 저장소에서 git-tracked, **본 I2 정책 파일에는 비적재** (별도 저장소이므로 노출 방지).

## Migration

- ORM 미사용. 스키마 변경은 수동 SQL. `task-db-structure` 스킬 사용 시 `db-migration-author` 가 paired migration + rollback SQL 생성.
- DML 변경은 `task-db-data` 스킬 사용.
- `dev_prod_separation: 분리` 설정에 따라 `task-db-structure` / `task-db-data` 는 **dev → prod 순차 실행 + 환경별 master 승인 게이트 + 실패 시 자동 롤백** 모드로 동작.

## Connection

- `data-craft-server` 가 `mysql2` 패키지로 직접 연결. 풀 설정 / 트랜잭션 패턴은 server 코드 참조.
- FE 측 (data-craft / data-craft-mobile / data-craft-ai-preview) 은 직접 DB 접속하지 않고 `data-craft-server` REST API 경유.
- 환경별 차등 시크릿 운영은 dev.md §"env 환경별 차등 변수 표준 — BE 페어 패턴" 참조.
