# Roadmap 15: data-craft 코어 재설계 ① 계약동결 + server (DB+BE)

> 작성일: 2026-06-24 | 대상: data-craft 코어 서비스 스키마 재설계 — server(DB+BE) 직렬 트랙 (FE = Roadmap 16 별도, 본 로드맵 Phase 0 이후 병렬)
>
> **현황(2026-06-25)**: 🟢2 · 🟡2 · 🔴3 — Phase 0 부분완료(계약동결·신스키마 additive)·데이터변환 dev완료. BE cutover·리네임/DROP·prod 미착수. 상세 ↓ 진척 현황 섹션.

## 프롬프트

🟢 (ad-hoc) Roadmap-5(data-craft-view-removal-cud-policy) 완료/흡수 확인 — §3 data_viewer_setting/_column_setting 제거·폼 폐지가 Roadmap-5와 직접 중첩. 진입 전 5의 완료/흡수 여부 확인(중복작업·트랙 충돌 방지). Roadmap-12(monorepo refactor)는 FE라 16에서 점검.

**— Phase 0 : 계약 동결 (★Roadmap 16 진입 게이트) —**

🟡 /task-db-structure data-craft — 신 스키마 DDL 설계 + dev/staging 적용(prod는 최종 컷오버 보류): `client→company` 전 스키마 리네임(data-craft-admin-server FK 포함)·컬럼추가(seq·is_required·parent_group_id·parent_row_id 등)·신규 4테이블(permission / company_setting / widget_preset / data_row) + SP·트리거 재작성(비-삼킴 계약 · created_at 정정 · JSON·5타입 검증). REDESIGN-SPEC §3·§8·§9·§11 + REDESIGN-VERIFICATION 보강권고(다형성 owner FK 분해·form-type 강제수단) 반영.

🟢 /plan-enterprise data-craft — fs-api 계약 타입 동결(work_repo=data-craft, packages/fs-api, **타입-only·구현 전·i-dev 머지**): columnType 5번째 enum(JSON) · rowField(row_num→row_id) · cells 값 JSON 직렬화 형태 · widget_preset/permission/company_setting 응답 타입. FE↔BE 공유 계약의 단일 소스 → 이 동결이 Roadmap 16 진입 게이트.

**— 구현 (코드 = i-dev 머지 / prod DB·배포만 컷오버 보류) —**

🔴 /plan-enterprise data-craft — BE 콜사이트 cutover(work_repo=data-craft-server, i-dev): raw SQL 708건·SP호출 41곳 신스키마 정렬(테이블 리네임 · value_data→data JSON 마샬링 · row_num→row_id) + 서버 계산 엔드포인트(집계·차트 + 캐싱/무효화 모델) + 데이터 쓰기 경로 페이지 read/write 권한 강제(현행 company_id-only → 페이지권한).

🔴 (ad-hoc) prod 형태 재인코딩 검증 게이트 — prod psql 읽기전용 introspection으로 text→JSON 타입충실 변환 · option-id 발급 · area→정수격자 도출을 prod 실분포에 dry-run(REDESIGN-SPEC §12 필수 게이트, dev=합성시드). 통과 = prod 적용 인가. (db.md pre-deploy 읽기전용 psql 인가 패턴 재활용)

🟡 /task-db-data data-craft — 데이터 마이그레이션 dev/staging 적용(prod는 컷오버 보류): data_row 전수발급(group_id+row_num distinct = 첫 도미노) → text→JSON 셀 변환(타입충실) → option-id 발급·라벨 박제 제거 → 캘린더/간트 색 전역화·dangling-ref drop → 폼 인스턴스(라이브 170행)→widget_preset 흡수. capture+rollback 동반.

**— 조율 컷오버 (prod 단일 유지보수 창) —**

🔴 (조율 컷오버) prod 대상 순서대로 (재)실행: `/task-db-structure data-craft`(prod DDL 적용) → `/task-db-data data-craft`(prod 데이터 마이그) → `/pre-deploy data-craft`(BE prod 배포·서버 git pull). **단일 창에서 일괄·조각내기 금지.** FE(Roadmap 16)는 본 컷오버 창에 합류 배포(DB→BE→FE 순).

## 진척 현황 (2026-06-25 검증 — dev 전용 goal 범위)

> 11에이전트 포렌식 + 3에이전트 게이트 재검증 기준. dev psql(data_craft_dev)·i-dev·문서 대조.

- 🟢 **선행 Roadmap-5 흡수** — R5(closed 2026-06-11)와 §3 객체 DISJOINT(R5=SQL VIEW/릴레이션3테이블, R15 §3=뷰어세팅+폼 테이블), 충돌 0. 조치 불필요.
- 🟡 **Phase 0 DDL** — 신규4테이블·additive컬럼·created_at SP정정(P0a~P0d) dev적용·i-dev머지 ✅. 미착수: SP 비-삼킴(P0c-ii, sp_manage_data_group 여전히 사일런트 삼킴)·client→company 전스키마 리네임·레거시 DROP.
- 🟢 **Phase 0 fs-api 계약동결** — #456 CLOSED, DataType 5종·CellData·CellFormulaSpec(재귀AST)·RowId·permission/company_setting/widget_preset 타입 전부 동결·export·additive.
- 🔴 **BE 콜사이트 cutover** — src/ 무변경(옛 테이블 활성: value_data 205·row_num 541·role 78…), advisor BLOCK(#4 리네임과 얽힘·강제완료 금지).
- 🔴 **prod 형태 재인코딩 게이트** — prod 대상이라 현 dev-only goal 범위 밖.
- 🟡 **데이터 마이그레이션** — data_row 전수발급(142,038)·row_id 100%·text→JSON 99.995%·value_data 100% 보존 dev✅. 미착수: option-id 발급·라벨박제 제거·색 전역화·폼→widget_preset 흡수·permission/company_setting/widget_preset 적재(현 0행).
- 🔴 **조율 컷오버(prod)** — prod 대상, 범위 밖.

---

## 로드맵 설명

**★ 진입 게이트: Roadmap 16(FE)은 본 로드맵 Phase 0(① 스키마 DDL + ② fs-api 계약타입 동결) 완료 후에만 착수한다. 그 전 16 시작 금지.**

### 목표
data-craft 코어 서비스 스키마를 확정 설계서(`data-craft-server/docs/db-audit/REDESIGN-SPEC.md` v2)대로 재구축하는 **server(DB+BE) 트랙**. "데이터는 순수 데이터, 위젯이 표시 결정" 원칙 — 5 데이터타입(string/number/date/boolean/JSON) vs 43 렌더링타입 분리, EAV 셀 text→JSON, 폼·뷰어설정 테이블 제거(위젯 properties로 흡수), 권한 4→2 단일 permission 테이블, 프리셋(widget_preset) 시스템, SP/트리거 비-삼킴 재작성.

### 왜 이 경계·순서인가 (검토 근거)
종합·적대 검토(`docs/db-audit/ROADMAP-SPLIT-REVIEW.md`) 결론: DB작업과 BE 앱코드는 **둘 다 data-craft-server·동일 i-dev**에 거주하고 raw SQL로 스키마에 708건 강결합 → "DB ∥ 웹BE" 병렬은 동일 브랜치 동시변경+의존 역행으로 깨짐(critical). 그래서 **분할 경계 = repo**(server[DB+BE] = 본 로드맵 직렬 / FE = Roadmap 16). FE는 별도 repo라 본 로드맵 Phase 0 계약동결 이후 staggered 병렬.

### prod 깨짐 방지 (컷오버 전략)
코드(fs-api 타입·BE 콜사이트)는 i-dev 정상 머지하되, **"prod 보류" = prod DB 적용 + BE prod 배포에 한정**. prod 변경 전체(DDL·데이터·BE배포)를 **마지막 단일 조율 컷오버 창**으로 묶는다 — rename·DROP 중심 설계라 expand/contract 대신 유지보수 창 채택(task-db-structure/task-db-data가 각자 prod까지 자동 롤아웃하면 신스키마-구코드 깨짐 창 발생, 이를 차단). prod DDL/데이터 적용은 마지막 컷오버 프롬프트가 prod 대상 (재)실행으로 수행.

### 주요 결정·반영
- client→company 리네임은 **전 스키마**(비코어·data-craft-admin-server FK 포함) 전파.
- created_at 정정: SP UPDATE경로 created_at 5곳 제거(updated_at은 set_updated_at 트리거 자동), protect 트리거 유지 = 안전망(REDESIGN-SPEC §11, 8파티션 실측 HOLDS).
- 검증 보강권고(REDESIGN-VERIFICATION §12): widget_preset owner_id 다형성 → owner_user_id+owner_company_id+CHECK 분해 / company_setting.preset_id form-type 강제(복합UNIQUE+FK+CHECK) / data_values FK0 유지(의도)·비-삼킴은 재작성 시 확실 제거.

### 위험·메모
- (실행 메모) 3.2M셀 text→JSON 일괄변환 = 유지보수 창 다운타임 길 수 있음 → task-db-data 실행 시 **온라인 백필(신규 컬럼 이중기록) 후 창에서 짧은 전환** 검토.
- text→JSON: 라이브 ~70%가 평문 스칼라/수식이라 bare `::jsonb` 캐스팅 불가 → 타입충실 변환 함수 필수(naive to_jsonb = 타입 박제 = §1 원칙4 위반).
- 모든 dev 실측은 합성 시드 — **prod 형태 재인코딩 검증 게이트 통과 전 마이그 '확정' 아님**(REDESIGN-SPEC §0·§12).

### 검증 이력
적대검토 워크플로(`ROADMAP-SPLIT-REVIEW.md`) + advisor 2-라운드(BLOCK 2건[컷오버 순서·fs-api 계약 소유] 해소 후 PASS). 본 로드맵 골격은 그 PASS 버전.
