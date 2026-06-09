# Roadmap 6: data-craft prod PostgreSQL 컷오버 (PROD-1)

> 작성일: 2026-06-09 | 대상: data-craft 프로덕션을 MySQL → PostgreSQL 로 컷오버 (배포 + 결제 데이터 마이그레이션 중심)

## 프롬프트

1️⃣ 🔴 /task-db-structure data-craft, prod 빌드 DDL 교정 — 소스 빌드 DDL(run1-tables.up.sql·run2-routines.up.sql)을 현 dev psql 실상태와 일치: 릴레이션 3테이블/SP 2개/sp_manage_data_group sync 블록 제거, billing_anchor_day(smallint, CHECK 1~31)·client.business_number 부분 unique·data_values HASH(group_id) 8파티션 반영

1️⃣ 🔴 /group-policy data-craft, 컷오버용 그룹 정책 전반 갱신 — **db.md** 연결정보(connection_style)를 레거시 MySQL DB_* → prod PostgreSQL PG_* 기준으로 보정, **deploy.md** 배포 env_management/deploy_command 에 PG_* 주입·단일 psql 엔진 반영(DB_ENGINE 잔재 정리), 그 외 **dev.md/group.md** 도 컷오버로 바뀔 정책 있으면 함께 보정

🔴 /plan-enterprise data-craft, **BE prod psql 좌표 `_PROD` 분기** — `constant.ts` 의 `PG` 객체(HOST/USER/PASSWORD)를 `resolveDbName` 처럼 `NODE_ENV` 분기(`PG_HOST_PROD`/`PG_USER_PROD`/`PG_PASSWORD_PROD` 페어 + `*_PROD_NOT_CONFIGURED` throw 가드)로 전환, `PG_PORT` 단일 유지, `.env`/`.env.example` 에 `PG_*_PROD` 키 + `DB_NAME_PROD=postgres`(prod psql DB명) 추가. 미반영 시 prod BE 가 dev psql 로 오접속 → **프롬프트 5(배포) 전 필수 선행**, 프롬프트 3·4(데이터 이관)와 독립이라 병렬 가능. (group-policy 프롬프트 2 에서 발견된 선행 코드 갭)

🔴 /task-db-data data-craft, prod MySQL→psql **일반 데이터 이관** changeset 작성 — **pre-flight 게이트(이관 차단): 소스 prod MySQL 에서 `SELECT count(*) FROM (SELECT value_id, group_id FROM data_values GROUP BY 1,2 HAVING count(*)>1) t` = 0 확인, 0 아니면 이관 중단. prod psql 은 `data_values` 파티션 PK `(value_id, group_id)` 를 강제하므로 중복쌍 존재 시 벌크 로드가 중도 실패함(dev `data_values_pkey` 는 INVALID·비강제였으나 prod 빌드 DDL 은 올바르게 강제 — 프롬프트 1 발견).** 엔진변환(uuid·enum 대소문자·smallint 0/1·jsonb·timestamp·IDENTITY 재설정) + column_type 오분류 등 prod 데이터 호환 교정 + 릴레이션 테이블 제외. (결제는 다음 프롬프트로 분리)

🔴 /task-db-data data-craft, **결제 전용 마이그레이션** changeset 작성 — billing_anchor_day 를 payment_history 첫 결제일(day)에서 파생 + billing_info 암호화(billing_key/카드) 보존 검증 + 이관 후 활성구독 전건 결제 대사(reconciliation). 실패 시 롤백 게이트

🔴 /pre-deploy data-craft, FE/BE(psql 단일엔진) prod 배포 — PG_* 환경 검증 + 배포. 컷오버 다운타임 윈도우 내, 일반·결제 이관 및 대사 통과 후 기동

🔴 /patch-update data-craft, PROD-1 컷오버 결과 patch-note 기록 (MySQL→psql 전환·결제 마이그레이션·배포)

🔴 /task-db-data data-craft, dev psql 새로고침 — dev 전체 삭제 후 prod psql 데이터 복사. 컷오버 안정화 후 별도 진행

---

## 로드맵 설명

### 목표
data-craft 프로덕션을 **MySQL → PostgreSQL 로 단일 컷오버**한다. 마스터 확정 핵심 2가지: **① prod 배포 ② 결제 데이터 마이그레이션을 제대로** 한다. 나머지는 이 둘을 안전하게 떠받치는 절차.

### 배경
- `#220`(DEV-1, ~2026-06-01)로 dev 앱 계층이 MySQL→psql 포팅됨. `#258`(2026-06-09)로 BE 코드가 mysql2 의존 0·단일 pg 엔진화됨(`grep mysql2 src/`=0, tsc 0, 전 라우트 psql 0 pg-crash).
- prod 는 MySQL(`211.211.222.105:3306`)에 **동결**된 채 그동안 dev DB 가 드리프트: data_values **재파티션(HASH group_id 8)**, **릴레이션 3테이블 cleanup**, **billing_anchor_day 추가**, **client.business_number 부분 unique**.
- 따라서 이관 = "엔진 변환(MySQL→psql) + 스키마/데이터 드리프트 반영"의 **두 겹 마이그레이션**.

### 마스터 확정 결정 (잠김)
1. **다운타임 무제한** — 시간 신경 안 씀.
2. **결제 기준일 = 각 고객 첫 결제일(payment_history.MIN(paid_at)의 day)** 에서 파생(plan_expires_at 드리프트 회피).
3. **dev 데이터 변경(seats·subdomain 등) prod 미반영** — dev 는 컷오버 후 어차피 전삭제.
4. **MySQL 보존 후 폐기** — 첫 결제 갱신(~1개월) 정상 확인 후.
5. **리허설 없음** — 배포 후 **QA 가 배포환경 테스트**.
6. **dev 새로고침** — prod 안착 즉시 dev 전삭제 → prod 데이터 복사(별도 작업).

### 컷오버 실행 순서 (수동 오케스트레이션 — 프롬프트 산출물 활용)
프롬프트(1~4)는 **산출물(교정 DDL·연결정보·일반/결제 이관 changeset)을 작성**하고, 실제 prod 실행은 다운타임 윈도우에서 운영으로 오케스트레이션한다:
1. 프롬프트 1·2 산출물 준비(병렬 그룹 1).
2. **신규 prod PostgreSQL 인스턴스 신설** + 교정 DDL(프롬프트 1)로 **빈 스키마 빌드**.
3. **AWS FE/BE 셧다운 + 자동복구(오토스케일/헬스체크 재기동) 차단** → 모든 쓰기(API+스케줄러) 정지. MySQL·새 psql 은 셧다운 대상서 **제외(살림)**, 점검 페이지 노출.
4. **별도 호스트(꺼지지 않는 bastion/로컬)** 에서 프롬프트 3(일반)·4(결제) 이관 실행: MySQL→psql.
5. **결제 대사 게이트**(프롬프트 4) — 활성구독 전건 다음청구일·금액·상태 대조. **실패 시 롤백**(MySQL 복귀, AWS 옛 스택 재기동).
6. 프롬프트 5 배포(psql 기동, PG_* 설정).
7. **QA 배포환경 테스트** → 이상 없으면 서비스 오픈(자동복구 재활성).
8. 프롬프트 6: patch-note 로 컷오버 기록.
9. MySQL N일 보존(롤백 안전망) → 정상 확인 후 폐기.
10. 프롬프트 7: dev 새로고침.

### 위험 / 주의
- **결제가 최대 리스크**(프롬프트 4 로 격리): anchor 파생 정확성 + 암호화(billing_info: billing_key/카드) 보존(깨지면 자동결제 전멸) + 대사. dev 는 **테스트 회사 1개**(funshare: DONE 54건·1,504만원, 현재 free·anchor=null)뿐이라 prod 다양성(여러 고객·월/연·프로모션·앵커일) 미검증 → **QA 가 배포 후 검증**으로 대체.
- **이관 호스트·타깃 psql 은 AWS 셧다운 대상서 제외**해야 함(같이 꺼지면 소스/타깃 소실).
- **dev 새로고침(프롬프트 7)**: 실고객 PII·결제정보가 dev 로 유입 → 마스터 "상관없음" 결정. 단 **암호화 키가 dev/prod 다르면 복사된 billing_key 는 dev 에서 복호화 불가**(결제 기능 dev 테스트만 영향, 나머지 정상) — 키 정책만 확인.
- prod 실제 스키마/데이터는 **이관 시점에 prod MySQL 에서 직접 덤프**해 드리프트 확정(git 이력 `db.sql/`은 참조용).

### 병렬/순서
- **그룹 1**(병렬): 프롬프트 1(소스 DDL 교정, data-craft-server 의 .sql) ↔ 프롬프트 2(db.md·deploy.md, Project-I2) — 서로 다른 파일/레포라 독립.
- **BE PG_*_PROD 분기 코드**(그룹 1 다음 신규 프롬프트): prod psql(사설호스트/`postgres`)이 dev(127.0.0.1/`starbox`)와 좌표가 달라 `constant.ts` PG 단일변수로는 환경 분기 불가 — group-policy(프롬프트 2)에서 발견. data-craft-server **코드** 작업이라 데이터 이관(3·4, task-db-data changeset)과 **독립·병렬 가능**하나, **배포(5) 전 반드시 완료**(미반영 시 prod BE 가 dev psql 로 오접속).
- 이후 순차: 일반 이관(3) → 결제 이관(4, payment_history 적재 후 anchor 파생) → 배포(5) → 기록(6) → dev 새로고침(7). 5·7 사이에 위 컷오버 운영 절차가 끼어든다.

### 산출물 매핑
- 프롬프트 1 → `task-db-structure`(DDL 교정 파일). 프롬프트 2 → `group-policy`(db.md·deploy.md). 프롬프트 3·4·7 → `task-db-data`(일반/결제 이관·새로고침 changeset). 프롬프트 5 → `pre-deploy`(검증+배포). 프롬프트 6 → `patch-update`(patch-note). *DDL/DML 의 prod 실행과 AWS·QA·폐기는 운영 단계로 본 로드맵 설명의 실행 순서를 따름.*
