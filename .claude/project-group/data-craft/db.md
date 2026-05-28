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
- 구버전 DB `data_craft_ver_001` / `data_craft_test` 는 **2026-05-28 폐기 결정** — 신규 운영 DB(`data_craft_dev` / `data_craft_production`)로 완전 이전. `DROP DATABASE` 실행 직후 본 절은 제거 예정. 회복 필요 시 동일 시점 mysqldump 백업(`~/db-backups/2026-05-28/data_craft_test.sql`, `data_craft_ver_001.sql`)에서 복원.
- 호스트 / 포트 / 계정 / 비밀번호 / 토큰 / API 키 등 시크릿은 각 저장소 `.env` 의 `DB_*`, `JWT_*`, `SMTP_*`, `TOSS_*`, `NTS_*` 변수 참조. env 는 각 저장소에서 git-tracked, **본 I2 정책 파일에는 비적재** (별도 저장소이므로 노출 방지).

## Migration

- ORM 미사용. 스키마 변경은 수동 SQL. `task-db-structure` 스킬 사용 시 `db-migration-author` 가 paired migration + rollback SQL 생성.
- DML 변경은 `task-db-data` 스킬 사용.
- `dev_prod_separation: 분리` 설정에 따라 `task-db-structure` / `task-db-data` 는 **dev → prod 순차 실행 + 환경별 master 승인 게이트 + 실패 시 자동 롤백** 모드로 동작.

## 백업 / Rollback capture 표준 (Roadmap-5 Step 2 검증 — 2026-05-28)

본 그룹 DB 는 일부 테이블 (`data_viewer_setting` 등) 에 큰 JSON BLOB 컬럼이 있어 **전체 mysqldump 가 timeout / Lost connection 발생**. 대안 패턴:

- **사전 백업 표준** (task-db-structure Phase 4 실행 전):
  - `mysqldump --routines --triggers --events --no-data --no-create-info --skip-add-drop-table --skip-comments --no-tablespaces` — 정의 (routines / triggers / events) 만 dump. 데이터 0건이라 timeout 없음.
  - 영향 받는 컬럼의 데이터는 `mysql -BNe "SELECT ... FROM ..."` 으로 TSV 별도 백업.
  - 전체 데이터 dump 가 필요하면 `--single-transaction --quick --max-allowed-packet=1G --net-buffer-length=1M` 옵션 조합 (그래도 보장 안 됨, 분할 권고).
- **Capture rollback 한계** (`task-db-structure` Phase 4 §b2 의 `SHOW CREATE PROCEDURE` 출력):
  - `mysql -BNe` 의 출력은 줄바꿈을 literal `\n` escape 으로 변환 → 직접 `source` 시 syntax 깨짐.
  - **대안**: 위 routines mysqldump 산출물을 직접 capture rollback 으로 사용 (정확한 DELIMITER 보존).
  - skill spec 의 `rollback.<env_or_label>.sql` 명세는 본 그룹에서는 routines mysqldump 로 대체.
- **MySQL DDL = implicit commit** 이라 dry-run `BEGIN/ROLLBACK` 무효 — task-db-structure Phase 4 §c dry-run 단계는 본 그룹에서는 best-effort 도 의미 적어 master 게이트가 critical (혹은 master 결정으로 skip).

## Connection

- `data-craft-server` 가 `mysql2` 패키지로 직접 연결. 풀 설정 / 트랜잭션 패턴은 server 코드 참조.
- FE 측 (data-craft / data-craft-mobile / data-craft-ai-preview) 은 직접 DB 접속하지 않고 `data-craft-server` REST API 경유.
- 환경별 차등 시크릿 운영은 dev.md §"env 환경별 차등 변수 표준 — BE 페어 패턴" 참조.
