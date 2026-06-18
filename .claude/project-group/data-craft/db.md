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

- **DEV·PROD 모두 PostgreSQL 라이브**: dev 는 PostgreSQL 라이브 가동 — 앱 드라이버 mysql2→pg 전환(#220) + data_values `HASH(group_id)` 재파티션 + 빌드 DDL psql 정합(#239) 완료. **prod 도 PROD-1 컷오버 완료(2026-06-11, #301)로 PostgreSQL 라이브** — `engine: postgresql` 이 dev·prod 양 환경과 일치한다. 후속 TimescaleDB 도입 여부는 별도 결정(본 status 범위 외 — 현 EAV 현재상태 그리드는 하이퍼테이블 타깃 없음으로 도입 보류 결론).
- **PROD 컷오버 완료 (Roadmap-6 PROD-1, 2026-06-11)**: prod 를 MySQL → PostgreSQL 로 단일 컷오버 완료. prod DB 대상 `task-db-structure` / `task-db-data` 실행은 운영 데이터이므로 **master 승인 게이트 + 실행 전 라이브 상태 직접 확인**을 엄격히 따른다(보수적 운영 게이트 유지). 레거시 prod MySQL 은 롤백 안전망으로 일정 기간 보존(아래 §소스 MySQL).
- **prod psql 연결 계약 (PG_*_PROD 페어)**: 컷오버 후 prod psql 은 dev psql 과 **호스트/계정/비밀번호가 다르다**(dev=`127.0.0.1`/`starbox`, prod=사설망 호스트/`postgres`). 따라서 접속 좌표도 dev.md §"env 페어 패턴" 을 따라 환경별 차등 변수로 운영한다: `PG_HOST`/`PG_HOST_PROD`, `PG_USER`/`PG_USER_PROD`, `PG_PASSWORD`/`PG_PASSWORD_PROD` (`NODE_ENV==='production'` 분기, 미설정 시 `*_PROD_NOT_CONFIGURED` throw). `PG_PORT` 는 양 환경 동일(5432)이라 단일 유지. DB명은 `DB_NAME`/`DB_NAME_PROD` 페어이며 **prod psql DB명 = `data_craft_production`**(2026-06-16 prod 실측 확정 — 같은 호스트의 `postgres` DB 는 앱 스키마 0의 maintenance DB). ✅ **PG 좌표 `_PROD` 분기 구현 완료(2026-06-16 실측, 과거 "선행 코드 갭" 해소)**: `data-craft-server/src/config/constant.ts` 의 `resolvePgCoord(prodKey, devKey, devDefault)` 가 `NODE_ENV==='production'` 일 때 `PG_HOST_PROD`/`PG_USER_PROD`/`PG_PASSWORD_PROD` 를 채택(미설정 시 `{KEY}_NOT_CONFIGURED` throw, dev 사일런트 회귀 차단)하고 `PG` 객체 HOST/USER/PASSWORD 가 전부 이를 사용한다. 즉 prod BE 가 prod psql 에 정상 접속하며 배포 전 PG 좌표 선행 코드작업은 불필요하다.
- **소스 MySQL 접속 좌표 별도 보존**: 인벤토리/ETL 용도로 기존 MySQL(dev=`data_craft_dev` / prod=`data_craft_production`, `mysql2`, `DB_*`) 접속 정보를 각 저장소 `.env` 의 기존 변수 + `~/db-backups` 백업으로 유지한다. psql 컷오버 후에도 MySQL 을 read-only 폴백으로 일정 기간 보존(롤백 대비).

## 핵심 정책

- **환경별 DB 분리** — dev = `data_craft_dev`(psql), prod (`NODE_ENV=production`) = `data_craft_production`(psql, 컷오버 완료 — DB명은 레거시 MySQL 과 동일 `data_craft_production` 유지, 2026-06-16 prod 실측 확정). **접속 좌표(호스트/계정/비밀번호)는 dev·prod 가 서로 다르므로 환경별 차등 변수로 운영**한다(위 §전환 상태 "prod psql 연결 계약" 의 `PG_*`/`PG_*_PROD` 페어 참조). `PG_PORT` 만 양 환경 동일(5432)이라 단일. (레거시 MySQL 기준의 "호스트/계정/비밀번호 공유, DB명만 분기" 가정은 컷오버로 폐기.)
- `.env` 의 `DB_NAME` (dev fallback = `data_craft_dev`) / `DB_NAME_PROD` (prod 전용 = psql `data_craft_production`) 페어로 운영 — dev.md §"env 환경별 차등 변수 표준 — BE 페어 패턴" 정합. prod 환경에서 `DB_NAME_PROD` 미설정 시 `DB_NAME_PROD_NOT_CONFIGURED` 식별자로 즉시 throw (사일런트 dev 회귀 차단). 동일 `_PROD` 페어·throw-가드 패턴을 `PG_HOST`/`PG_USER`/`PG_PASSWORD` 좌표에도 확장 완료(`resolvePgCoord`, 위 §전환 상태 — 구현됨).
- 구버전 DB `data_craft_ver_001` / `data_craft_test` 는 **2026-05-28 폐기 결정** — 신규 운영 DB(`data_craft_dev` / `data_craft_production`)로 완전 이전. `DROP DATABASE` 실행 직후 본 절은 제거 예정. 회복 필요 시 동일 시점 mysqldump 백업(`~/db-backups/2026-05-28/data_craft_test.sql`, `data_craft_ver_001.sql`)에서 복원.
- 호스트 / 포트 / 계정 / 비밀번호 / 토큰 / API 키 등 시크릿은 각 저장소 `.env` 의 `PG_*`(+`PG_*_PROD`, psql 접속 좌표), `DB_NAME`/`DB_NAME_PROD`(DB명), `JWT_*`, `SMTP_*`, `TOSS_*`, `NTS_*` 변수 참조. 레거시 `DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASSWORD`(MySQL 좌표)는 롤백 윈도우 동안 read-only 보존 후 폐기. env 는 각 저장소에서 git-tracked, **본 I2 정책 파일에는 비적재** (별도 저장소이므로 노출 방지 — 실제 prod psql 좌표값은 정책 파일이 아닌 `data-craft-server/.env` 에 기재).

## Migration

- ORM 미사용. 스키마 변경은 수동 SQL. `task-db-structure` 스킬(v4 — DDL / 루틴 / 스케줄 잡) 사용 시 `db-migration-author` 가 paired migration + rollback SQL 생성.
- DML 변경은 `task-db-data` 스킬 사용.
- `dev_prod_separation: 분리` 설정에 따라 `task-db-structure` / `task-db-data` 는 **dev → prod 순차 실행 + 환경별 master 승인 게이트 + 실패 시 자동 롤백** 모드로 동작. 컷오버 완료(2026-06-11) 후 prod 는 평시 운영 psql 타깃이며, prod 게이트는 운영 데이터인 만큼 **master 승인 + 실행 전 라이브 상태 직접 확인**을 엄격히 따른다(보수적 게이트 유지).
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
- **접속 좌표 (psql)**: `PG_HOST`/`PG_PORT`/`PG_USER`/`PG_PASSWORD` + DB명 `resolveDbName()`(`DB_NAME`/`DB_NAME_PROD`). 컷오버 후 prod 좌표는 `PG_HOST_PROD`/`PG_USER_PROD`/`PG_PASSWORD_PROD` 페어(NODE_ENV 분기). 풀 설정·타입파서·`?`→`$n` translatePlaceholders 어댑터는 server `config/` 코드 참조. ✅ PG 좌표 `_PROD` 분기는 `constant.ts` 의 `resolvePgCoord` 로 **구현 완료**(2026-06-16 실측, 과거 "선행 코드 갭" 해소).
- FE 측 (data-craft / data-craft-mobile / data-craft-ai-preview) 은 직접 DB 접속하지 않고 `data-craft-server` REST API 경유.
- 환경별 차등 시크릿 운영은 dev.md §"env 환경별 차등 변수 표준 — BE 페어 패턴" 참조.

## pre-deploy DB 드리프트 게이트 psql 인가 (2026-06-17 신규 — 마스터 명시)

`dev_prod_separation: 분리` 환경에서 dev 에만 적용된 미배포 스키마 변경을 안고 코드 배포가 나가는 것을 막기 위해, `pre-deploy` 가 배포 빌드 **이전**에 dev psql 과 prod psql 의 라이브 스키마를 대조한다(판정·결과 처리 상세는 deploy.md §"배포 전 DB 드리프트 게이트").

- **psql 사용 인가 범위 확장**: 본 게이트를 위해 `pre-deploy` 컨텍스트는 dev/prod psql 에 대한 **읽기전용 스키마 introspection** 목적의 psql 호출을 인가받는다. 기존 `Bash(psql *)` 인가는 CLAUDE.md 주석상 `task-db-structure`/`task-db-data` 한정이었으나, pre-deploy 의 드리프트 게이트(`.claude/scripts/db-drift-check.sh`)는 SELECT-only 스키마 카탈로그 조회(`information_schema`, `pg_catalog`, `pg_get_functiondef`)만 수행하며 DDL/DML 을 실행하지 않는다. 안전장치: ① 읽기전용 쿼리만, ② prod 미접속 시 block(배포 차단)으로 안전 측 실패, ③ 좌표는 `data-craft-server/.env` 의 `PG_*`/`PG_*_PROD`·`DB_NAME`/`DB_NAME_PROD` 에서 로드(정책 파일 비적재). 본 인가는 Workstream C 에서 `.claude/settings.json` + CLAUDE.md 주석에 반영된다.
- **접속 좌표**: dev = `PG_HOST`/`PG_USER`/`PG_PASSWORD` + `DB_NAME`(`data_craft_dev`), prod = `PG_HOST_PROD`/`PG_USER_PROD`/`PG_PASSWORD_PROD` + `DB_NAME_PROD`(`data_craft_production`). 양 환경 `PG_PORT`=5432. (2026-06-17 실측: dev 127.0.0.1:5432·prod 사설망 호스트:5432 양쪽 이 머신에서 TCP 도달 확인.)
- **지문 정규화**: 거짓양성 억제를 위해 시퀀스 현재값, 파티션 자동생성 child(예: `data_values` HASH(group_id) 8 서브파티션), 통계/스토리지 메타는 지문에서 제외하고 DDL 구조(테이블·컬럼·타입·제약·루틴 정의) 표면만 비교. 첫 실측에서 dev==prod(현재 동기 가정)여야 정상.

## 관리자 콘솔 DB 상호작용 (Roadmap-7 신규 — 마스터 명시)

- **DB 인스턴스는 dev 1 / prod 1 유지** — 관리자용 별도 DB 인스턴스 신설 없음. 관리자 전용 테이블만 기존 data-craft DB 에 추가한다.
- **신규 테이블 2종**:
  - `user_events` — 사용자 행동/결제 분석 이벤트. **인입은 배포되는 data-craft 본체**(FE 계측 + data-craft-server 인입 엔드포인트)가 담당하고 관리자 콘솔은 읽기만 한다. dev psql + (Roadmap-6 PROD-1 빌드 DDL 편입으로) prod psql 양쪽. RANGE(created_at) 월별 + HASH 파티션(`data_values` 패턴 재활용). 로그인/비로그인 분리(`auth_state`/`user_id`/`anon_id`).
  - `admin_email_verification` — 관리자 고정 단일 계정 2단계 로그인의 이메일 인증번호(code/expiry/attempt). **dev psql 전용**(prod 빌드 제외).
- **`data-craft-admin-server` 는 pg 풀 2개**: ① **고정 dev psql 인증 풀**(`admin_email_verification` — 데이터 토글과 무관, 로그인은 항상 고정 dev 연결), ② **dev/prod 런타임 토글 데이터 풀**(프로모션 CRUD·`user_events` 읽기, `PG_*`/`PG_*_PROD` 재활용). ⚠️ 인증 코드를 토글된 prod psql 에 쓰지 말 것(보안 사고). prod 토글의 전제였던 `constant.ts` `PG_*_PROD` 분기는 구현 완료(2026-06-16 실측) — 코드 차단 요인 해소됨.
- **프로모션 테이블 4종**(`promotion`/`client_promotion`/`promotion_audit_log`/`promotion_business_lock`)은 스키마 무변경 — 관리자 콘솔이 토글 데이터 풀로 직접 CRUD(쓰기 전 `setPromotionAuditContext()` 호출 → 감사 트리거).
- **admin 도메인 명명 규약 + 드리프트 게이트 마커 (최중요)**: 관리/admin 전용 객체(테이블·제약·루틴)는 `admin_` 접두 명명 규약을 따른다. 이들은 **dev psql 전용·prod 미적재**가 설계 원칙이며, 이 `admin_` 규약이 **`pre-deploy` DB 드리프트 게이트의 admin 도메인 마커**(서비스 스키마 한정 비교에서 제외하는 기준)다. 예: `admin_email_verification`, `admin_promotion_audit`, `admin_internal_company_id`. 대조: `user_events` 는 admin 콘솔이 읽기만 하나 data-craft 본체가 인입하는 **서비스 테이블**(dev+prod 양쪽)이라 `admin_` 접두가 아니며 드리프트 비교 대상으로 유지된다.
