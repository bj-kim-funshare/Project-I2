---
engine: postgresql
framework: raw-sql
dev_prod_separation: 분리
env_management: git-tracked
migration_approach: 수동 SQL (ORM 미사용)
connection_style: DB_* 환경변수
---

# data-craft — db 환경 규정

## 전환 상태 (Roadmap-6 — 2026-05-29)

- **engine 전환 진행 중**: MySQL → PostgreSQL (+ 후속 TimescaleDB 도입). dev 선구축 후 prod 2단계 컷오버(PostgreSQL 전환 → 안정화 소킹 → TimescaleDB 적용). 본 `engine: postgresql` 은 전환 타깃을 선언한다.
- **prod DB 작업 동결**: db.md `engine` 은 전역 단일 필드라 "dev=psql / prod=mysql" 혼재를 표현할 수 없다. 따라서 PROD 컷오버(Roadmap-6 PROD-1) 완료 전까지 **prod DB 대상 `task-db-structure` / `task-db-data` 실행을 동결**한다 — 전환 기간 DB 작업은 dev(psql) 대상만. prod 는 기존 MySQL 이 계속 가동한다.
- **소스 MySQL 접속 좌표 별도 보존**: 인벤토리/ETL 용도로 기존 MySQL(dev=`data_craft_dev` / prod=`data_craft_production`, `mysql2`, `DB_*`) 접속 정보를 각 저장소 `.env` 의 기존 변수 + `~/db-backups` 백업으로 유지한다. psql 컷오버 후에도 MySQL 을 read-only 폴백으로 일정 기간 보존(롤백 대비).

## 핵심 정책

- **환경별 DB 분리** — dev = `data_craft_dev`, prod (`NODE_ENV=production`) = `data_craft_production`. **DB명·env 페어·접속 패턴은 engine 전환과 무관하게 유지**한다 — 호스트 / 포트 / 계정 / 비밀번호는 두 환경이 공유하고 **DB명만 환경별로 분기**, engine 만 mysql → postgresql.
- `.env` 의 `DB_NAME` (dev fallback) / `DB_NAME_PROD` (prod 전용) 페어로 운영 — dev.md §"env 환경별 차등 변수 표준 — BE 페어 패턴" 정합. prod 환경에서 `DB_NAME_PROD` 미설정 시 `DB_NAME_PROD_NOT_CONFIGURED` 식별자로 즉시 throw (사일런트 dev 회귀 차단).
- 구버전 DB `data_craft_ver_001` / `data_craft_test` 는 **2026-05-28 폐기 결정** — 신규 운영 DB(`data_craft_dev` / `data_craft_production`)로 완전 이전. `DROP DATABASE` 실행 직후 본 절은 제거 예정. 회복 필요 시 동일 시점 mysqldump 백업(`~/db-backups/2026-05-28/data_craft_test.sql`, `data_craft_ver_001.sql`)에서 복원.
- 호스트 / 포트 / 계정 / 비밀번호 / 토큰 / API 키 등 시크릿은 각 저장소 `.env` 의 `DB_*`, `JWT_*`, `SMTP_*`, `TOSS_*`, `NTS_*` 변수 참조. env 는 각 저장소에서 git-tracked, **본 I2 정책 파일에는 비적재** (별도 저장소이므로 노출 방지).

## Migration

- ORM 미사용. 스키마 변경은 수동 SQL. `task-db-structure` 스킬(v4 — DDL / 루틴 / 스케줄 잡) 사용 시 `db-migration-author` 가 paired migration + rollback SQL 생성.
- DML 변경은 `task-db-data` 스킬 사용.
- `dev_prod_separation: 분리` 설정에 따라 `task-db-structure` / `task-db-data` 는 **dev → prod 순차 실행 + 환경별 master 승인 게이트 + 실패 시 자동 롤백** 모드로 동작. **단, 전환 기간 중 prod 게이트는 위 "prod DB 작업 동결" 에 따라 PROD 컷오버 전까지 미승인** — dev(psql) 만 실행.
- cross-engine 벌크 이전(MySQL → psql)은 `task-db-data`(동일 엔진 DML) 범위 밖 — `plan-enterprise`(pgloader / 커스텀 ETL) 로 수행.

## 백업 / Rollback capture 표준

- **psql 타깃 (전환 후)**: `task-db-structure` v4 가 PostgreSQL capture 로 `rollback.<env_or_label>.sql` 생성 — `pg_dump`(스키마), `pg_get_functiondef`(루틴), 스케줄 잡은 `cron.job` / `timescaledb_information.jobs` 조회. **전환 후 일반 DDL 은 트랜잭션 가능(dry-run ROLLBACK 유효)** 하나, **루틴·스케줄 잡(EVENT/pg_cron/Timescale job)은 PostgreSQL 에서도 best-effort** — task-db-structure v4 Phase 4 §c 주석 참조.
- **소스 MySQL (전환기 보존 — 인벤토리/ETL/롤백용)**: 본 그룹 MySQL 은 일부 테이블 (`data_viewer_setting` 등) 에 큰 JSON BLOB 컬럼이 있어 **전체 mysqldump 가 timeout / Lost connection 발생**. 대안 패턴:
  - 정의만 dump: `mysqldump --routines --triggers --events --no-data --no-create-info --skip-add-drop-table --skip-comments --no-tablespaces` — 데이터 0건이라 timeout 없음.
  - 영향 컬럼 데이터는 `mysql -BNe "SELECT ... FROM ..."` 으로 TSV 별도 백업.
  - 전체 데이터 dump 필요 시 `--single-transaction --quick --max-allowed-packet=1G --net-buffer-length=1M` 조합 (보장 안 됨, 분할 권고).
  - `mysql -BNe` 출력은 줄바꿈을 literal `\n` escape 으로 변환 → 직접 `source` 시 syntax 깨짐. 대안: 위 routines mysqldump 산출물을 직접 capture rollback 으로 사용 (DELIMITER 보존).
  - MySQL DDL = implicit commit 이라 dry-run `BEGIN/ROLLBACK` 무효 — 소스 MySQL 작업 시 master 게이트가 critical (전환 후 psql 일반 DDL 은 이 한계 해소).

## Connection

- **전환 후**: `data-craft-server` 가 `pg` 패키지로 PostgreSQL 직접 연결. 드라이버 전환(`mysql2` → `pg`)은 Roadmap-6 DEV-1 앱 계층 작업에서 수행하며, 전환 완료 전 현행 코드는 `mysql2` 로 동작한다. 풀 설정 / 트랜잭션 패턴은 server 코드 참조.
- FE 측 (data-craft / data-craft-mobile / data-craft-ai-preview) 은 직접 DB 접속하지 않고 `data-craft-server` REST API 경유.
- 환경별 차등 시크릿 운영은 dev.md §"env 환경별 차등 변수 표준 — BE 페어 패턴" 참조.
