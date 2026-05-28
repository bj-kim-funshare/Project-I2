# data-craft DB 전환 검토 — PostgreSQL + TimescaleDB 도입 의견안

> 작성일: 2026-05-28 | 대상: `data-craft` 프로젝트 그룹 (특히 `data-craft-server` BE)
> 작업 방식: **전 과정 읽기 전용, 본 문서 작성만 쓰기 작업** (코드 무수정)
> 배경: 경영측이 ① DB를 MySQL → PostgreSQL 로 전환(확정), ② PostgreSQL 의 TimescaleDB 기능 활용을 요청.
> 근거: `data-craft-server` 코드 1차 증거(파일:라인 인용). 서브에이전트 3회 + advisor 4회 검증.

---

## 0. 한눈에 보는 결론

| 질문 | 결론 |
|---|---|
| **TimescaleDB 를 `data_values` 에 적용?** | ❌ **부적합.** 파티션 "축"이 워크로드와 어긋남(아래 §2·§3). |
| **그럼 TimescaleDB 자체는?** | 확장 설치는 무료·무해 → **켜두되**, `data_values` 가 아닌 **신규 시계열 영역**에만 적용. |
| **`data_values` 10억 행 스케일 정타?** | **PostgreSQL 선언적 파티셔닝 by `group_id`(또는 `company_id`)** — Timescale 무관, 평범한 PG. |
| **MySQL → PostgreSQL 순수 이전?** | 가능하나 단순치 않음. **약 25~40 인주(6~10 인월)**, 절반이 코드 외(검증·이관·롤백). |

---

## 1. 현행 DB 사용 실태

(정책 문서: [`db.md`](./db.md))

| 항목 | 현황 |
|---|---|
| **엔진** | MySQL 8.4.3 |
| **접근 방식** | `mysql2` raw SQL, **ORM 미사용** |
| **연결** | `src/config/database.ts` 단일 풀 싱글턴(connectionLimit 30). 트랜잭션은 27개 파일에서 수동 begin/commit/rollback(~214곳) |
| **스키마** | ~36 테이블(`db.sql/01-tables.sql`). 핵심은 **EAV 구조** |
| **dev/prod** | **단일 인스턴스 공유**(`data_craft_test`), 분리 없음 |
| **마이그레이션 도구** | **없음.** 손으로 쓴 `.sql` + 파일명 순서 + 운영자 규율(knex/Prisma/Flyway 전무) |
| **절차 계층** | 저장 프로시저 10개(`03-procedures.sql`, 3,222줄), 트리거 4개(`02-triggers.sql`), 스케줄 EVENT 1개(`04-events.sql`), 런타임 동적 피벗뷰 DDL |

**규모**: `data_values`(EAV 값 저장소) 현재 ~320만 행, **실질 목표 10억 행 이상**(출시 전 이미 320만 초과). 나머지 테이블은 대부분 수십~수백 행. 데이터 유입은 사용자 그리드 편집 기반(고빈도 머신 ingest 아님).

---

## 2. 시계열 데이터란 & TimescaleDB란

### 2-1. 시계열 데이터(time-series)
"시간이 주인공인 데이터" — 다음 4특징을 **모두** 만족:
1. **시간이 1차 축** (각 행에 시각, 그게 핵심 조회·정렬 기준)
2. **계속 쌓임(append)** — 과거 행을 거의 안 고침
3. **시간 범위로 조회** — "최근 N일", "시/일/월별 집계"
4. **오래되면 가치↓** — 최근 건 자주, 과거 건 압축·요약·삭제

예: 센서 측정값, 주식 시세, 서버 모니터링 메트릭, 접속/행동 로그.

### 2-2. TimescaleDB
- **PostgreSQL 확장**(`CREATE EXTENSION timescaledb`). 별도 엔진 아님.
- 핵심 개념 **하이퍼테이블**: 겉은 일반 테이블, 내부적으로 시간 기준 chunk 로 자동 분할.
- 4대 기능(전부 **하이퍼테이블 전용**): 자동 시간 파티셔닝 / Continuous Aggregates(점진 집계) / 압축(컬럼형, 90%+ 절감) / 보존 정책(TTL 자동 삭제). 대표 함수 `time_bucket()`.
- **중요**: 하이퍼테이블을 안 만들면 일반 테이블은 **순수 PostgreSQL 과 동작 동일**. 즉 확장 설치만으로는 비용·이득 모두 거의 0(곁다리: `time_bucket` 일부 함수, 유휴 백그라운드 worker).

---

## 3. TimescaleDB 적용 평가 — `data_values` 는 ❌

### 3-1. 결정적 발견 (코드 1차 증거)
`data_values` 전 질의 사이트(프로시저·트리거·TS) 전수 조사:

| 발견 | 증거 |
|---|---|
| **읽기가 `created_at`(시간)으로 필터/정렬하는 곳 = 0건** | 전 읽기 WHERE 가 `group_id`/`column_id`/`row_num`/`is_deleted`. 정렬은 `row_num`/`seq` |
| **`created_at` 은 수정 시마다 `NOW()` 로 덮어써짐** | `03-procedures.sql:310,333,385,1686,1753`. `updated_at` 컬럼 부재 → `created_at` 이 "셀 last-write 시각" 역할 겸함(증거: `getColumnCellStats` 가 MIN/MAX(created_at) 을 `earliest/latest_at` 로 노출, `dataViewerColumnStats.service.ts:33`) |
| **append-only 아님 — update/delete 빈번** | 소프트삭제 플립·값편집·물리삭제·복원 다수. `BEFORE UPDATE` 트리거 존재(`02-triggers.sql:153`) |
| **파티션 해시키 `group_id` 도 트리거가 변경** | `02-triggers.sql:34` |

### 3-2. 왜 부적합인가 (3단 논리)
1. **현 월단위 파티션도 이미 읽기를 가속 못 함.** 읽기가 `created_at` 을 안 거니 `RANGE(to_days(created_at))` 가지치기 미발동. 실제로 도움 주는 건 `SUBPARTITION BY HASH(group_id)` 뿐 → **기존부터 1차 파티션 축이 잘못됨.**
2. **TimescaleDB 는 시간 컬럼을 1차 파티션 키로 강제**(`create_hypertable`). space 파티션은 secondary 만 가능 → `group_id` 1차 불가. 시간 술어 없는 질의는 모든 시간 chunk 를 훑음(시간 지날수록 악화).
3. **압축 이점도 닫힘.** Timescale 압축은 "append-mostly + 불변 시간키" 전제인데, `data_values` 는 update/delete 빈번 + `created_at` 이 수정마다 변함(의도된 설계) → chunk 간 행 이동·압축 무력화.

→ **요지: 엔진을 바꿀 게 아니라 파티션 축을 시간 → `group_id` 로 바꿔야 함.**

### 3-3. 진짜 해법 (10억 행 스케일)
- **PG 선언적 `HASH(group_id)` 파티셔닝** → `group_id` 조회가 즉시 1개 파티션으로 가지치기.
- 또는 **`LIST(company_id)` 멀티테넌트 파티션**(격리·백업·감사 유리, 대형 테넌트는 hash 서브파티션 병행).
- + `(group_id, row_num, is_deleted)` 등 질의 키 인덱스 정비.
- 이 모두 **평범한 PostgreSQL** 로 가능, Timescale 불필요.

### 3-4. TimescaleDB 의 올바른 자리 (경영 의도 보존)
확장은 **켜두되**, `data_values` 는 하이퍼테이블로 만들지 말고, Timescale 은 **신규 시계열 워크로드**에 신규 하이퍼테이블로 도입:
- 셀/그리드 **편집 이력 이벤트**(불변 append) → 활동 분석·감사
- **사용자 행동 로그**(클릭스트림)
- **빌링/구독 메트릭**(일·월 추세, continuous aggregate)
- **운영 모니터링 메트릭**(I-OS `monitoring/` 연계 가능)

> 핵심 구분: **"표 안의 셀 값"(`data_values`)은 시계열 아님. "표에 일어난 일의 기록"(편집이력·로그·메트릭)이 시계열** → 후자가 Timescale 자리.

### 3-5. (별도 검토, 한 줄)
10억 행 규모에서는 엔진/파티션보다 **EAV 데이터 모델 자체**가 성능 지배 변수가 될 수 있음 — 본 검토 범위 밖, 별도 모델링 검토 권고.

---

## 4. MySQL → PostgreSQL 순수 이전 검토

> 범위: TimescaleDB·모델 개편 제외, 현 구축물(스키마·트리거·프로시저·이벤트·앱 쿼리)을 1:1 이전.

### 4-1. 3계층 분해
| 계층 | 내용 | 성격 |
|---|---|---|
| **A. 표면 SQL** | 343 쿼리 사이트: `?`→`$n`, 백틱→`"`, `CAST(... SIGNED)`→`::int`, `insertId`→`RETURNING`(27), `ON DUPLICATE`→`ON CONFLICT`(5), 백틱식별자 848줄, `CAST` 116, `NOW()` 121 등 | 양 많음·위험 낮음 |
| **B. 스키마** | 타입 리매핑 + ON UPDATE 대체 + 파티셔닝 재구성 | 중간 |
| **C. 절차 계층** | 프로시저 10·트리거 4·이벤트 1 PL/pgSQL 재작성 | **위험·공수 집중** |

### 4-2. 스키마(계층 B) 주요 변환
| 구문 | 건수 | PG 처리 |
|---|---|---|
| `AUTO_INCREMENT` | 16 | `GENERATED AS IDENTITY` |
| `int unsigned` | 60 | unsigned 없음 → `int`/`bigint`(+CHECK) |
| `ENUM` | 4 | `CREATE TYPE ... AS ENUM` 또는 CHECK |
| `JSON` | 20 | `jsonb` |
| `binary(16)` UUID | 7 | 네이티브 `uuid` |
| `tinyint(1)` | 7 | `boolean` |
| **`ON UPDATE CURRENT_TIMESTAMP`** | **13** | **PG 미지원 → 테이블마다 BEFORE UPDATE 트리거 신규**(객체 증식) |
| CHARSET/COLLATE `utf8mb4_0900_ai_ci` | 44 | §4-6 정렬 의미차 |
| FK | 19 | 직접 포팅 |
| 생성컬럼·FULLTEXT·CHECK | 0 | 없음 |

### 4-3. 절차 계층(계층 C) — 비용 핵심
프로시저 10개 난이도: **HIGH 7 · MEDIUM-HIGH 1 · MEDIUM 1 · LOW 1.**

겹치는 MySQL 전용 구문: `SIGNAL SQLSTATE` 51 → `RAISE`; `DECLARE ... HANDLER` 19 → `EXCEPTION`; 커서 루프 5 → `FOR ... LOOP`; `PREPARE/EXECUTE` 5조 → `EXECUTE format()`; `ROW_COUNT()`/`LAST_INSERT_ID()` 9 → `GET DIAGNOSTICS`/`RETURNING INTO`; `CREATE TEMPORARY TABLE` 10; 중첩 `CALL` 9; `GET_LOCK`/`RELEASE_LOCK` 22.

**최고위험 3대 군집:**
1. **런타임 동적 피벗뷰 생성기 ("구조적 절벽")** — 프로시저 3·4·5·7·8·10 이 `vw_col_rel_*`/`vw_grp_rel_*`/`vw_pivot_group_*` 뷰를 실행 중 동적 생성. **검증: 정적 CREATE VIEW 0개**(파일 끝 58개 뷰는 전부 mysqldump 아티팩트 `/*!50001 ... VIEW */`, group_id별·한국어 컬럼별 산출물; 뷰 이름은 `relation_view_name` 에 저장돼 앱이 동적 참조). 난점: 한국어 백틱 별칭→PG `"..."` 인코딩, `CONCAT`+`PREPARE`→`EXECUTE format(%I,%L)`. 평균 HIGH 의 1.5~2배 가중.
2. **`data_values` 파티셔닝 + 월별 이벤트** — `PARTITION BY RANGE(to_days(created_at)) SUBPARTITION BY HASH(group_id)` 는 PG 1:1 대응 없음 → 선언적 2단 파티셔닝 수동 구성. `to_days()`·`INFORMATION_SCHEMA.PARTITIONS` 재작성. **PG 에 이벤트 스케줄러 없음** → `pg_cron`/앱 cron.
3. **`GET_LOCK`(문자열키) → `pg_advisory_lock`(정수키)** — 22곳 문자열 키(`'lock_bulk_values_<group>'`). PG 는 정수만 → 해싱 필수 → **해시 충돌 = 거짓 락 공유 = 동시성 버그**. 64비트 해시 + 충돌 감시 필요.

**트랜잭션 제어**: 프로시저 내부 `START TRANSACTION/COMMIT/ROLLBACK`(4곳) → PG 는 FUNCTION 불가, **10개 전부 PROCEDURE 로** 포팅(중첩 CALL 컨텍스트 영향).

**트리거**: PG 는 함수+`CREATE TRIGGER` 2단계 구조. `NOT REGEXP`→`!~`(POSIX).

### 4-4. 앱 코드
343 사이트 `?`→`$1,$2` + **mysql2 결합 타입(`RowDataPacket`/`ResultSetHeader`) 제거(536 TS 파일 파급)** + 연결 계층(`acquireTimeout` 등 mysql2 전용 옵션 제거).

### 4-5. 코드 외 워크스트림 (전체의 약 50%)
- **(a) 검증 체계 부재 — 최대 실존 위험.** 프로시저 단위 테스트 없음 → HIGH 7개를 자동검증 없이 포팅 = 비즈니스 로직 무결성 리스크. 포팅과 동시에 회귀 검증 체계 신규 구축.
- **(b) 데이터 이관.** 타입 강제변환(`binary(16)`→`uuid` 등) + 행수/체크섬 검증. 1B 행 환경 초기 적재만 며칠.
- **(c) dev/prod 공유 = 컷오버 선결조건.** db.md `공유` → 안전한 병행운영 불가 → **이전 전 `분리` 전환 또는 shadow PG 인스턴스**.
- **(d) 롤백 한계.** 마이그레이션 프레임워크 부재 → MySQL 복귀 절차 미정의 → "롤백은 듀얼라이트 보존 기간 내에서만 가능" 명시.

### 4-6. 호환성 미세 체크리스트
- **Collation** `utf8mb4_0900_ai_ci`(악센트·대소문자 무시) → PG 기본 case-sensitive → **ICU collation + 한국어 정렬(`ORDER BY value_data`) 검증**.
- **REGEXP → POSIX** 트리거 4곳 패턴별 1:1 매핑 확인.
- **JSON 함수 의미차** `JSON_EXTRACT($.a.b)` vs jsonb `->`/`->>` 29곳 전수 점검.
- `DEFINER` 절(68객체) 제거 → `SECURITY DEFINER`/`OWNER`+`GRANT`.

### 4-7. 공수 추정 (의사결정용, ±50%)
| 워크스트림 | 대략 |
|---|---|
| A. 표면 SQL + mysql2 타입 제거 | 4~6 인주 |
| B. 스키마 + 타입 + ON UPDATE 트리거 13 | 2~3 인주 |
| C. 프로시저 10(HIGH 7) + 트리거 4 + 이벤트 1 | 14~21 인주 |
| D. 회귀 검증 체계 신규 구축 | 4~8 인주 |
| E. 데이터 이관 + 컷오버 + 검증 | 4~6 인주 |
| **합계** | **약 25~40 인주 (≈6~10 인월)** |

가정: 1인 환산, 테스트 인프라 0 시작, 검증·이관이 지배 변수.

---

## 5. 종합 권고

1. **TimescaleDB**: `data_values` 적용 ❌(축 불일치·압축 충돌). 확장은 켜두고 **신규 시계열 영역**(편집이력·행동로그·빌링/모니터링 메트릭)에만 도입.
2. **`data_values` 10억 행 정타**: **PG 선언적 파티셔닝 by `group_id`/`company_id`** (평범한 PG, Timescale 무관).
3. **MySQL → PG 이전**: 실현 가능하나 **6~10 인월**, 절반이 코드 외. 위험 집중 3곳(동적 피벗뷰 생성기 / 파티션+이벤트 / advisory lock)에 버퍼.
4. **선결 2건**: (a) 회귀 검증 체계 신규 구축, (b) db.md `분리` 전환 또는 shadow 인스턴스.
5. **실행 매핑**: I-OS `task-db-structure`(스키마·프로시저 DDL 포팅 페이즈) + `plan-enterprise`(앱 쿼리 전환) + `plan-roadmap`(전체 단계화). 본 문서는 분석/의견 단계.

---

## 부록 — 핵심 증거 파일

| 영역 | 경로 |
|---|---|
| 연결/트랜잭션 | `data-craft-server/src/config/database.ts` |
| 스키마 + 파티셔닝 | `data-craft-server/db.sql/01-tables.sql`(파티셔닝 :135-139) |
| 트리거 4 | `data-craft-server/db.sql/02-triggers.sql` |
| 프로시저 10 (3,222줄) | `data-craft-server/db.sql/03-procedures.sql` |
| 스케줄 EVENT | `data-craft-server/db.sql/04-events.sql` |
| `created_at`=NOW() on update | `03-procedures.sql:310,333,385,1686,1753` |
| 셀 통계 MIN/MAX(created_at) | `data-craft-server/src/services/dataViewerColumnStats.service.ts:33` |
| 집계 엔진 | `data-craft-server/src/models/aggregation/*` |
| cron 잡 | `data-craft-server/src/index.ts:30-130` |
