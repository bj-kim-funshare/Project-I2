---
engine: postgresql
framework: raw-sql
dev_prod_separation: 분리
env_management: git-tracked
migration_approach: 수동 SQL (ORM 미사용)
connection_style: PG_* 환경변수
---

# data-craft — db 환경 규정

## 전환 상태 (DEV 전환 완료 2026-06-02 · PROD 컷오버 진행 — Roadmap-6 PROD-1)

- **DEV 전환 완료**: dev 는 PostgreSQL 라이브 가동 — 앱 드라이버 mysql2→pg 전환(#220) + data_values `HASH(group_id)` 재파티션 + 빌드 DDL psql 정합(#239) 완료. prod 는 아직 MySQL 로 **PROD 컷오버 대기**. `engine: postgresql` 은 이제 dev 라이브와 일치한다(prod 와는 전역 단일 필드 한계로 불일치). 후속 TimescaleDB 도입 여부는 별도 결정(본 status 범위 외 — 현 EAV 현재상태 그리드는 하이퍼테이블 타깃 없음으로 도입 보류 결론). prod 컷오버는 **Roadmap-6 (PROD-1)** 로 구동.
- **PROD 컷오버 진행 (Roadmap-6 PROD-1)**: prod 를 MySQL → PostgreSQL 로 단일 컷오버하는 작업이 진행 중이다. prod DB 대상 임의의 `task-db-structure` / `task-db-data` 실행은 여전히 **컷오버 다운타임 윈도우 한정**으로만 운영 오케스트레이션을 통해 수행한다(전환 기간 평시 DB 작업은 dev(psql) 대상만). `engine: postgresql` 은 컷오버 후 prod 까지 일치하게 된다(현재는 전역 단일 필드라 dev=psql/prod=mysql 혼재를 못 담아 dev 기준).
- **prod psql 연결 계약 (PG_*_PROD 페어)**: 컷오버 후 prod psql 은 dev psql 과 **호스트/계정/비밀번호가 다르다**(dev=`127.0.0.1`/`starbox`, prod=사설망 호스트/`postgres`). 따라서 접속 좌표도 dev.md §"env 페어 패턴" 을 따라 환경별 차등 변수로 운영한다: `PG_HOST`/`PG_HOST_PROD`, `PG_USER`/`PG_USER_PROD`, `PG_PASSWORD`/`PG_PASSWORD_PROD` (`NODE_ENV==='production'` 분기, 미설정 시 `*_PROD_NOT_CONFIGURED` throw). `PG_PORT` 는 양 환경 동일(5432)이라 단일 유지. DB명은 `DB_NAME`/`DB_NAME_PROD` 페어이며 **prod psql DB명 = `postgres`**(레거시 MySQL 의 `data_craft_production` 에서 변경). ⚠️ **선행 코드 갭**: `data-craft-server/src/config/constant.ts` 의 `PG` 객체는 현재 host/user/password 를 단일 변수로만 읽어 NODE_ENV 분기가 없다(`resolveDbName()` 만 DB명 분기). 배포(프롬프트 5) 전 PG 좌표 `_PROD` 분기를 추가하는 **BE 코드 작업이 선행 필수** — 미반영 시 prod BE 가 dev psql 로 접속한다. group-policy 범위 밖(코드) → 별도 plan-enterprise 프롬프트.
- **소스 MySQL 접속 좌표 별도 보존**: 인벤토리/ETL 용도로 기존 MySQL(dev=`data_craft_dev` / prod=`data_craft_production`, `mysql2`, `DB_*`) 접속 정보를 각 저장소 `.env` 의 기존 변수 + `~/db-backups` 백업으로 유지한다. psql 컷오버 후에도 MySQL 을 read-only 폴백으로 일정 기간 보존(롤백 대비).

## 핵심 정책

- **환경별 DB 분리** — dev = `data_craft_dev`(psql), prod (`NODE_ENV=production`) = `postgres`(psql, 컷오버 후 — 레거시 MySQL 은 `data_craft_production`). 컷오버 완료 전까지는 dev=psql / prod=mysql 혼재. **컷오버 후 접속 좌표(호스트/계정/비밀번호)는 dev·prod 가 서로 다르므로 환경별 차등 변수로 운영**한다(위 §전환 상태 "prod psql 연결 계약" 의 `PG_*`/`PG_*_PROD` 페어 참조). `PG_PORT` 만 양 환경 동일(5432)이라 단일. (레거시 MySQL 기준의 "호스트/계정/비밀번호 공유, DB명만 분기" 가정은 컷오버로 폐기.)
- `.env` 의 `DB_NAME` (dev fallback = `data_craft_dev`) / `DB_NAME_PROD` (prod 전용 = psql `postgres`) 페어로 운영 — dev.md §"env 환경별 차등 변수 표준 — BE 페어 패턴" 정합. prod 환경에서 `DB_NAME_PROD` 미설정 시 `DB_NAME_PROD_NOT_CONFIGURED` 식별자로 즉시 throw (사일런트 dev 회귀 차단). 동일 `_PROD` 페어·throw-가드 패턴을 `PG_HOST`/`PG_USER`/`PG_PASSWORD` 좌표에도 확장한다(코드 선행 필요 — 위 §전환 상태).
- 구버전 DB `data_craft_ver_001` / `data_craft_test` 는 **2026-05-28 폐기 결정** — 신규 운영 DB(`data_craft_dev` / `data_craft_production`)로 완전 이전. `DROP DATABASE` 실행 직후 본 절은 제거 예정. 회복 필요 시 동일 시점 mysqldump 백업(`~/db-backups/2026-05-28/data_craft_test.sql`, `data_craft_ver_001.sql`)에서 복원.
- 호스트 / 포트 / 계정 / 비밀번호 / 토큰 / API 키 등 시크릿은 각 저장소 `.env` 의 `PG_*`(+`PG_*_PROD`, psql 접속 좌표), `DB_NAME`/`DB_NAME_PROD`(DB명), `JWT_*`, `SMTP_*`, `TOSS_*`, `NTS_*` 변수 참조. 레거시 `DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASSWORD`(MySQL 좌표)는 롤백 윈도우 동안 read-only 보존 후 폐기. env 는 각 저장소에서 git-tracked, **본 I2 정책 파일에는 비적재** (별도 저장소이므로 노출 방지 — 실제 prod psql 좌표값은 정책 파일이 아닌 `data-craft-server/.env` 에 기재).

## Migration

- ORM 미사용. 스키마 변경은 수동 SQL. `task-db-structure` 스킬(v4 — DDL / 루틴 / 스케줄 잡) 사용 시 `db-migration-author` 가 paired migration + rollback SQL 생성.
- DML 변경은 `task-db-data` 스킬 사용.
- `dev_prod_separation: 분리` 설정에 따라 `task-db-structure` / `task-db-data` 는 **dev → prod 순차 실행 + 환경별 master 승인 게이트 + 실패 시 자동 롤백** 모드로 동작. **단, 전환 기간 중 prod 게이트는 컷오버 다운타임 윈도우 한정**으로만 운영 오케스트레이션을 통해 승인한다(평시 DB 작업은 dev(psql) 대상만 — 위 §전환 상태 "PROD 컷오버 진행").
- **connection_style = `PG_* 환경변수`(비표준)**: 표준값(`DATABASE_URL`/`DB_* 환경변수`)이 아니므로 `task-db-structure`/`task-db-data` 의 Phase 4 자동 접속은 custom 확인 카드를 띄운다. **단 그 카드는 `DATABASE_URL`/`DB_* 환경변수`/`중단` 3선택뿐이라 PG_* 로 직접 매핑할 경로가 없다** — 즉 psql 단일엔진 DML 을 스킬 자동접속으로 돌리려면 카드에서 `중단` 후 운영 수동 psql 실행이 현재 우회법이다(task-db-* 의 `PG_* 환경변수` 표준 지원은 별도 후속). 컷오버 일반/결제 이관(Roadmap-6 프롬프트 3·4)은 어차피 cross-engine 이라 별도 호스트에서 운영 수동 실행하므로 실질 영향 없음.
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

- **단일 pg 엔진 (dev 라이브)**: `data-craft-server` 가 `pg` 패키지로 PostgreSQL 직접 연결. 드라이버 전환(`mysql2`→`pg`)은 #220, **mysql2 의존·dual-engine·`DB_ENGINE` 토글 완전 제거는 #258** 에서 완료(`grep mysql2 src/`=0, 단일 pg 엔진). prod 는 컷오버 전까지 별도 MySQL 인스턴스가 가동하나 BE 코드 자체엔 MySQL 경로가 없다 — prod 배포 = psql 단일 엔진 BE 가 prod psql 에 접속.
- **접속 좌표 (psql)**: `PG_HOST`/`PG_PORT`/`PG_USER`/`PG_PASSWORD` + DB명 `resolveDbName()`(`DB_NAME`/`DB_NAME_PROD`). 컷오버 후 prod 좌표는 `PG_HOST_PROD`/`PG_USER_PROD`/`PG_PASSWORD_PROD` 페어(NODE_ENV 분기). 풀 설정·타입파서·`?`→`$n` translatePlaceholders 어댑터는 server `config/` 코드 참조. ⚠️ PG 좌표 `_PROD` 분기는 `constant.ts` 에 **아직 미구현**(위 §전환 상태 선행 코드 갭).
- FE 측 (data-craft / data-craft-mobile / data-craft-ai-preview) 은 직접 DB 접속하지 않고 `data-craft-server` REST API 경유.
- 환경별 차등 시크릿 운영은 dev.md §"env 환경별 차등 변수 표준 — BE 페어 패턴" 참조.
