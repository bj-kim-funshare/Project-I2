# Roadmap 6: data-craft MySQL → PostgreSQL / TimescaleDB 마이그레이션

> 작성일: 2026-05-29 | 대상: data-craft 그룹 DB 엔진 전환(MySQL→PostgreSQL) + TimescaleDB 도입 — dev 선구축 후 prod 2단계 컷오버

## 프롬프트

1️⃣ 🔴 /plan-enterprise-os — task-db-structure 범위에 스케줄 잡(MySQL EVENT ↔ PostgreSQL pg_cron / TimescaleDB background job) 포함 확장. 현 EVENT v3-후보 제외 해소 → "데이터 제외 전 DB 작업 = task-db-structure 단일 스킬" 원칙 완결. (I-OS, main)

1️⃣ 🔴 /group-policy data-craft — [정책 수정] db.md engine mysql→postgresql + psql dev/prod 연결·DB명 확정. 소스 MySQL 좌표는 별도 보존. 이 시점부터 prod DB 작업 동결.

🔴 (master ad-hoc) [선행 완료 게이트] task-db-structure spec 에 EVENT/스케줄잡 scope 명시 확인 + db.md engine=postgresql 확정 확인. 둘 충족 시 DEV-1 착수. (DEV-1 의 task-db-structure 는 #1 머지에 종속)

🔴 /plan-enterprise data-craft — [DEV-1 인벤토리] 소스 MySQL 전 객체(테이블·컬럼·인덱스·제약·프로시저·함수·트리거·이벤트) 완전 열거(mysqldump --routines --triggers --events, out-of-band) + psql 매핑 issue. 누락 0 = information_schema 카운트 ↔ 인벤토리 자동 대조(기계 검증); advisor 는 매핑 품질.

🔴 /task-db-structure data-craft — [DEV-1 dev] psql dev DB 생성 + CREATE EXTENSION timescaledb + 스키마·인덱스·제약·프로시저·함수·트리거·스케줄잡(EVENT 대체) 구축(PSM→PL/pgSQL). prod 게이트 보류.

🔴 (master ad-hoc) [DEV-1 구조 검증 게이트] dev psql information_schema(tables/routines/triggers)+스케줄잡 카운트 ↔ 인벤토리 대조 — 구조 누락 0(ETL/앱 전).

🔴 /plan-enterprise data-craft — [DEV-1 dev] MySQL→psql 데이터 ETL(pgloader/커스텀, BLOB 테이블별 추출). transform 서 데이터 위생(zero-date·중복키·죽은 컬럼) + prod 규모 샘플 ETL 소요 측정→다운타임 창. 패리티·집계 스팟체크.

🔴 /plan-enterprise data-craft — [DEV-1 dev] data-craft-server mysql2→pg 전면 전환($N·ON CONFLICT·RETURNING·날짜함수·식별자) + dev 검증.

🔴 /dev-build data-craft — [DEV-1 게이트] 빌드 통과 + 앱 정상.

🔴 /patch-confirmation data-craft — [push] DEV-1 origin 푸시.

🔴 /plan-enterprise data-craft — [전략] dev psql 실데이터 프로파일링 → 하이퍼테이블 대상·시간컬럼·chunk_time_interval·공간파티셔닝·retention/compression·폐기뷰→연속집계 매핑 issue. advisor. ※대상 없으면 Timescale 중단.

🔴 /task-db-structure data-craft — [DEV-2 dev] create_hypertable + 연속집계·retention·compression + 과거 refresh. prod 게이트 보류.

🔴 /plan-enterprise data-craft — [DEV-2 dev] 연속집계 대체 쿼리 서버 조정 + dev 검증. (불필요시 skip)

🔴 /patch-confirmation data-craft — [push] DEV-2 origin 푸시.

🔴 (master ad-hoc) [PROD-1 컷오버 진입 게이트] 다운타임 창 수용 + prod MySQL 백업 갱신 + prod psql 연결·환경변수 확인 + 윈도우 진입 결정.

🔴 /task-db-structure data-craft — [PROD-1 prod] 스키마·루틴·스케줄잡 prod psql 적용(prod 게이트 승인). MySQL read-only 폴백.

🔴 /plan-enterprise data-craft — [PROD-1 prod] 데이터 ETL prod 적용(다운타임 창). 실패 시 MySQL 복귀.

🔴 /pre-deploy data-craft — [PROD-1 prod] data-craft-server(psql) 빌드+deploy_command 실행(데이터 적재 후 정상 연결).

🔴 /patch-confirmation data-craft — [push] prod 컷오버 origin 푸시.

🔴 /task-db-structure data-craft — [PROD-2 prod] hypertable 변환 + 연속집계·정책 prod 적용(대체로 무중단) + 정합성 검증. (← PROD-1 안정화 소킹 N일 경과 후)

🔴 /pre-deploy data-craft — [PROD-2 prod] 연속집계 대체 앱 변경 있으면 배포(없으면 skip).

🔴 /patch-confirmation data-craft — [push] PROD-2 origin 푸시.

🔴 /group-policy data-craft — [종료] db.md 전환기 단서(MySQL 폴백) 제거.

🔴 (master ops gate) [종료] MySQL retention 경과 + 백업 확인 후 최종 DROP DATABASE(mysql CLI out-of-band).

---

## 로드맵 설명

**목표**: data-craft 그룹 DB를 MySQL → PostgreSQL로 전환하고, 이후 시계열 부분집합에 TimescaleDB를 도입한다. dev에서 전체(Postgres + Timescale)를 먼저 구축·검증한 뒤, prod는 2단계로 컷오버한다 — ① PostgreSQL 전환 + 안정화 소킹, ② TimescaleDB 적용.

**배경**: 경영진이 psql 이전 + TimescaleDB 사용을 명령. 사전에 MySQL 뷰 기반 시스템(프로시저·BE·DB·실제 뷰)을 모두 제거(Roadmap-5)했고 dev/prod DB 분리를 완료한 상태에서 시작.

**핵심 결정**:
- MySQL을 리팩토링하지 않는다 — 버릴 엔진을 다듬는 대신 구조 보존 lift-and-shift로 "엔진 교체"와 "시계열 재설계"를 분리.
- 전략 수립을 DEV-1 뒤에 둔다 — psql에 실데이터가 들어간 뒤 프로파일링해 하이퍼테이블 대상 결정(없으면 전략 게이트에서 Timescale 중단).
- prod 컷오버를 2단계로 — Postgres가 prod에서 입증된 뒤에야 Timescale 적용해 실패 원인을 한쪽으로 좁힌다.

**선행 종속성**: 선행 두 프롬프트(plan-enterprise-os EVENT 확장, group-policy db.md 전환)는 상호 독립이라 병렬(1️⃣). 단 DEV-1의 task-db-structure는 #1(EVENT 확장) 머지에 종속 — 선행 완료 게이트에서 둘 다 충족 확인 후 DEV-1 착수. #1이 지연되면 DEV-1 전체가 대기.

**구조적 제약 (스킬 모델과의 마찰, 로드맵 반영됨)**:
1. (선행 #1로 해소) task-db-structure가 EVENT를 범위에 포함하도록 확장 → MySQL EVENT는 PostgreSQL pg_cron / Timescale background job으로 task-db-structure가 일괄 처리.
2. db.md의 engine은 전역 단일 필드라 dev=psql/prod=mysql 혼재 불가 → 선행 #2로 engine 전환 시점부터 prod DB 작업을 PROD 컷오버까지 동결. 소스 MySQL 연결 좌표는 인벤토리/ETL용으로 별도 보존.
3. cross-engine 벌크 이전은 task-db-data(동일 엔진 DML) 범위 밖 → MySQL→psql ETL은 plan-enterprise(pgloader/커스텀). 큰 JSON BLOB 테이블은 전체 mysqldump가 timeout이므로 테이블별 추출.

**검증("하나도 빠짐없이")**: advisor가 아니라 기계적으로 보증 — information_schema 객체 카운트(tables/routines/triggers + 스케줄잡)와 인벤토리 항목 수 자동 대조(구조 구축 직후 게이트). advisor는 매핑 품질을 검증.

**의도된 트레이드오프**: dev에서 1+2(Postgres+Timescale)를 함께 구축하는 것은 Timescale이 실제 채택될 때만 wall-clock 이득. PROD-1 소킹에서 "Postgres 단독으로 충분"하다 판명되면 DEV-2(hypertable 구축)는 사후적으로 투기적 작업이 된다. 전략 게이트의 중단절은 "시계열 테이블 0"만 커버하며 "Postgres만으로 충분"은 커버하지 않는다 — 이 트레이드오프를 인지하고 진행.

**롤백/안전**: prod 컷오버 후 MySQL을 read-only 폴백으로 N일 보존. 데이터 ETL 실패 시 MySQL 복귀. prod 다운타임 창은 DEV-1에서 prod 규모 샘플 ETL 소요로 사전 산정. 전환기 동안 prod DB 작업 동결.

**종료**: 안정화 소킹 + retention 경과 후 백업 확인하에 구 MySQL DB 최종 DROP(mysql CLI out-of-band — db.md engine이 psql이라 스킬 접근 불가). data-craft 선례(구버전 DB 2026-05-28 폐기)와 동일 패턴.
