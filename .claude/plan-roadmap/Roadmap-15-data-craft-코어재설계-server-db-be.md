# Roadmap 15: data-craft 코어 재설계 ① 계약동결 + server (DB+BE)

> 작성일: 2026-06-24 (개정 2026-06-26 v2) | 대상: data-craft 코어 서비스 스키마 재설계 — server(DB+BE) 직렬 트랙 (FE = Roadmap 16 별도, 본 로드맵 Phase 0 이후 병렬). **분담: 1(DB)+2(BE) = 본 로드맵(위임 세션), 3(FE) = Roadmap-16.**
>
> **현황(2026-06-28 현행화·v2 2026-06-26 작성)**: 🟢10 · 🟡4 · 🔴2 — Phase 0 부분완료·데이터변환 dev완료·흡수 M1+M2 완료·BE cutover 부분완료(#485)·SP/트리거 dual-write+option-id 완료·**D8 block_type enum dev완료(6eea8e3)**·**⑥ page_section/정수격자 dev완결(스키마 c9da662 + 백필 1567cce)**·**프리셋 ⑤④ DDL+계약 dev완료(a3eb20c)·⑦ 계약완료(no-DDL)**·**⑨ file_group soft-delete DDL dev완료(0f1e0c6)·⑩ 관리주기 계약완료(no-DDL, 인프라 기존)**. **2026-06-26 추가: Roadmap-16 FE 위젯 재설계가 유입한 BE 슬라이스 8단위(④~⑪) 편성** — D8(기존) + company_setting 폼락해제·page_widget.preset_id·page_section/정수격자·widget_preset 3계층·recent-usage 조회·file-group·관리주기 D1·교차repo 드리프트체크. 상세 ↓.

## 프롬프트

> **★ 실행 규약(위젯 BE 슬라이스 ④~⑪ 공통)**: 프롬프트는 **스코프 포인터**. 각 🔴 실행 시 ① FE 설계 SPEC(`/Users/starbox/Documents/GitHub/Project-I2/.claude/plan-roadmap/Roadmap-16-data-craft-위젯시스템-재설계-SPEC.md`) 해당 § + `data-craft-server/docs/db-audit/REDESIGN-SPEC.md` 정독, ② 스킬 자체 plan+advisor로 상세·수용기준 도출, ③ 미명세분(⑥ area→격자 알고리즘·⑧ recent-usage 3줄 계약 등) 실행 전 보완.

🟢 (ad-hoc) Roadmap-5(data-craft-view-removal-cud-policy) 완료/흡수 확인 — §3 data_viewer_setting/_column_setting 제거·폼 폐지가 Roadmap-5와 직접 중첩. (확인 완료·충돌 0.) Roadmap-12(monorepo refactor)는 FE라 16에서 점검(완료/격리).

**— Phase 0 : 계약 동결 (★Roadmap 16 진입 게이트) —**

🟡 /task-db-structure data-craft — 신 스키마 DDL 설계 + dev/staging 적용(prod는 최종 컷오버 보류): `client→company` 전 스키마 리네임(data-craft-admin-server FK 포함)·컬럼추가(seq·is_required·parent_group_id·parent_row_id 등)·신규 4테이블(permission / company_setting / widget_preset / data_row) + SP·트리거 재작성(비-삼킴 계약 · created_at 정정 · JSON·5타입 검증). REDESIGN-SPEC §3·§8·§9·§11 + REDESIGN-VERIFICATION 보강(다형성 owner FK 분해·**form-type 강제수단**[→④에서 신 모델 위해 일반화]) 반영.

🟢 /plan-enterprise data-craft — fs-api 계약 타입 동결(work_repo=data-craft, packages/fs-api, 타입-only·i-dev 머지): columnType 5번째 enum(JSON) · rowField(row_num→row_id) · cells 값 JSON 직렬화 · widget_preset/permission/company_setting 응답 타입. (#456 CLOSED — **5 dataType 동결**; 41 블록타입 계약은 별건=R16 P1 소유.)

**— 구현 (코드 = i-dev 머지 / prod DB·배포만 컷오버 보류) —**

🟡 /plan-enterprise data-craft — BE 콜사이트 cutover(work_repo=data-craft-server, i-dev): raw SQL 708건·SP호출 41곳 신스키마 정렬(테이블 리네임 · value_data→data JSON 마샬링 · row_num→row_id) + 서버 계산 엔드포인트(집계·차트 + 캐싱/무효화) + 페이지 read/write 권한 강제. **부분완료(#485 CLOSED)**: client→company 정렬 + SP 비-삼킴 호출자 적응 dev 머지(e79dbfe). **잔여**: value_data→data·row_num→row_id 읽기-스위치(dual-write 완료로 해금) · 서버계산 캐싱 · 페이지권한.

🟢 /task-db-structure data-craft — **D8 (Roadmap-16 FE 위젯 재설계 유입, 2026-06-26) — dev 완료(6eea8e3)**: `block_type_enum`(41 native PG enum) 신설 + `data_column.block_type`(Not Null) 추가 + coarse 백필(column_type 1→number·2→text·3→date·4→switch). dev psql 적용·검증 통과(라이브 enum 41 라벨 byte-exact·2,193행 NULL 0·분포 text1592/number493/date77/switch31). **41 영문 id 정본 = 명령세션 마스터 확정(byte verbatim 박제, ⚠️button 분해→automation)** — 문자10·버튼12·특수13·확장6. **매핑(마스터확정): timer=number·color/uniqueID=json — 분포 string9/number5/date3/boolean2/json22.** [⚠️ **파생/계산 7종**(rowID·uniqueID·lastUpdate·log·formula·quickFormula·dualBlock)=셀값 미저장·coarse 백필 비대상] **이연**: ⑪ 드리프트체크는 fs-api `ALL_BLOCK_TYPE_IDS` 미구현(R16 P1)이라 R16 P1 단위로 이연(R16 P1=41 정본 verbatim 소비). **coarse=dev 임시·provisional**(fine 백필=prod 재인코딩 게이트서 viewer_type 실데이터). **권고: 마스터가 41 정본을 SPEC §B 영문ID로 박제 → D8·R16 P1·⑪ 단일출처화.**

**— 위젯 시스템 BE 슬라이스 (Roadmap-16 FE 재설계 유입, 2026-06-26 적대검증 도출) —**
> 전부 additive 스키마+BE 엔드포인트(i-dev 머지·prod는 조율 컷오버 합류). 신 위젯 모델이 완료된 R15 작업(company_setting 폼락·preset_id 부재·page_section 미편성)과 충돌하는 부분을 정합.

🟡 /task-db-structure data-craft (+task-db-data) — **④ company_setting 폼락 해제 — DDL dev완료(a3eb20c)**: 폼락 3종(generated col `preset_widget_type` + CHECK `chk_company_setting_preset_form` + 복합 FK) DROP → 단순 FK(preset_id→widget_preset(id), 임의 widget_type 허용). data-preserving·reversible(5행 intact). ★`uq_widget_preset_id_widget_type`는 rollback 의존이라 컷오버 전까지 DROP 금지. **잔여**: **흡수 폼 29행(M1 c240ff2) 재처리 = task-db-data — ⚠️변환 UNDEFINED-pending**(R16③/⑦ favorites=즐겨찾기 최상위 위젯 의미 미존재→설계 확정 후 정의; 현 5 company_setting+29 widget_preset form은 폼락 해제로 유효 유지).

🟢 /task-db-structure data-craft — **⑤ page_widget.preset_id + 참조해소 계약 — DDL+계약 dev완료(a3eb20c)**: `page_layout_widget.preset_id`(bigint null·FK→widget_preset(id)·부분index) ADD. 207행 무영향. **계약 박제**(plan.md): copy(properties 인라인·preset_id NULL) vs reference(preset_id→config[properties/columnProperties/rowProperties] 병합, style은 page_widget 자체) 배타·로컬편집 금지=app-level(properties NOT NULL이라 DB XOR 부적합, 편집=복사전환). **잔여: BE 참조해소 구현=⑦(plan-enterprise)**.

🟢 /task-db-structure +task-db-data data-craft — **⑥ page_section/정수격자 — dev 완결(스키마 c9da662 + 백필 1567cce)**: SPEC §7·§3.5. **스키마(ADDITIVE)**: `page_section` 신설(section_id PK·layout_id FK→page_layout·height·col_grid_count 100·row_grid_count 70·style·seq·정책4) + `page_layout_widget` 격자좌표 5컬럼 ADD(section_id FK·start_x·start_y·width·height, nullable·ck NOT VALID). **백필(task-db-data, exec dml-…-122ebf)**: area→100×70 격자 도출(경계-차분·prefix-strip·isRowSplit·section_id=type1.area_id 재사용) 구현·적재 — page_section **173행**·위젯 **207행** 좌표 백필. **0-based 확정(R16 FE)**. 대사 전수 통과(위젯207·NULL0·in-bounds0·진성겹침0·containment R-2 2쌍 documented·col100/row70). **★R-1 수정**: 정본 A.2.1 `cum+w>100` 직역=float-near-100 유령줄바꿈(반복소수 4섹션 사일런트 좌표손상, in-bounds/겹침 미포착) → `>100+1e-9` epsilon 가드. 마스터 확정 **D2=1/섹션-area·layout_id FK**(무손실). **이연(컷오버·파괴적)**: `page_layout_widget→page_widget` 리네임·area DROP·NOT NULL/VALIDATE 승격·1섹션/페이지 collapse·R-2 부모위젯 재배치(BE 708 SQL 보호). **R16①의 선행 요건 — 스키마+좌표 데이터 제공 완료.**

🟢 /plan-enterprise data-craft (BE) — **⑦ widget_preset 3계층 — 계약 완료(no-DDL, a3eb20c plan.md)**: widget_preset 스키마(owner_user_id XOR owner_company_id) **이미 3계층 충분 → DDL 불요**. 계약 박제: 나만의(owner_user_id·복사+참조)·사용자(owner_company_id·참조전용·로컬편집금지)·최근사용(파생·복사전용). **잔여: BE 프리셋 CRUD + 참조해소(⑤ 계약 구현) = plan-enterprise**(work_repo=data-craft-server).

🟢 /plan-enterprise data-craft — **⑧ recent-usage 조회 엔드포인트**(work_repo=data-craft-server, **BE-only·DDL無**): 동일 위젯타입+동일 그룹의 최근 적용 config 조회(조합 스코프·회사 범위·같은/다른 페이지). **계약 3줄 선확정**(스코프=조합/회사·그룹키=properties 내 group 바인딩·dedup/order 규칙). page_widget 현재행 파생(신 로그 X)·복사전용 적용용.

🟢 /task-db-structure data-craft (+BE) — **⑨ file-group — soft-delete DDL dev완료(0f1e0c6)**: ★탐색 결과 file_group 테이블·file(1:N)·fileApi CRUD·fs-api FileGroup 동결 **이미 존재**. data_group 동격 1급화의 유일 gap = soft-delete 부재 → `file_group`에 `is_deleted`(smallint NOT NULL DEFAULT 0)·`deleted_at`(timestamp null) ADD(56행 무영향). 계층/description 제외(R16 미명세·투기적, 마스터 ①). **잔여: BE soft-delete 채택(hard→soft)=plan-enterprise**(현 hard-delete 유지). (R16 ⑤⑦⑨⑩ 의존 — 스키마 제공.)

🟢 /plan-enterprise data-craft (BE) — **⑩ 관리주기 D1 — 계약완료(no-DDL, 인프라 기존, 0f1e0c6 plan.md)**: ★탐색 결과 인프라 **이미 완비** → DDL 불요. `page_list.management_cycle`(varchar10 enum none/daily/weekly/monthly/yearly/page-cycle·fs-api ManagementCycle 동결)·위젯별 옵션 `page_layout_widget.properties.dataMode`(jsonb single/page-cycle)·**동작 기준 `data_values.created_at`**(트리거 trg_protect_created_at_data_values 보호·인덱스 data_values_idx_group_created). **잔여: D1 확장(전 위젯 적용·BE 시간필터 엔드포인트 cycleKey 범위계산·FE 옵션 UI)=plan-enterprise BE/FE**. SPEC §D1 커스텀 주기 미명세(enum이 daily~yearly 커버). (R16 관리주기 단위 의존.)

🟢 /plan-enterprise data-craft — **⑪ 교차repo 드리프트체크**: DB blockType enum labels ↔ fs-api `ALL_BLOCK_TYPE_IDS` 41목록 byte 일치 검증(생성/CI 체크). 공유 패키지 불가(별도 repo)·이미 3중 드리프트 전력(ViewerType) → 자동 가드. [fs-api 41목록 정본=R16 P1] (소형 단위.)

**— 조율 컷오버 (prod 단일 유지보수 창) —**

🔴 (ad-hoc) prod 형태 재인코딩 검증 게이트 — prod psql 읽기전용 introspection으로 text→JSON 타입충실 변환·option-id 발급·area→정수격자 도출·timer MM:SS→초를 prod 실분포에 dry-run(REDESIGN-SPEC §12 필수 게이트). 통과 = prod 적용 인가.

🟡 /task-db-data data-craft — 데이터 마이그레이션 dev/staging 적용(prod 컷오버 보류): data_row 전수발급 → text→JSON 셀 변환(타입충실) → option-id 발급·라벨박제 제거 → 색 전역화·dangling drop → 폼→widget_preset 흡수. **부분완료(M1 c240ff2·M2 30ad0b1·option-id 180행 03f57b7 dev머지)**. 잔여: 라벨박제 제거(BE cutover 동반) + **신규(④/⑥ 동반): 폼29행 재처리·area→격자·timer "MM:SS"→초.**

🔴 (조율 컷오버) prod 대상 순서대로 (재)실행: `/task-db-structure data-craft`(prod DDL: Phase0+D8+④⑤⑥⑦⑨⑩ 일괄 — ⑧=BE-only DDL無·⑪=CI체크 제외) → `/task-db-data data-craft`(prod 데이터 마이그: text→JSON·option-id·④폼29행·⑥area→격자·timer→초) → `/pre-deploy data-craft`(BE prod 배포·서버 git pull). **단일 창 일괄.** FE(Roadmap 16)는 본 컷오버 창 합류(DB→BE→FE).

## 진척 현황 (2026-06-26 v2)

> 11에이전트 포렌식 + 게이트 재검증 + 2026-06-26 ultracode 적대검증 기준. dev psql(data_craft_dev)·i-dev·문서 대조.

- 🟢 **선행 Roadmap-5 흡수** — §3 객체 DISJOINT, 충돌 0. Roadmap-12(atomic monorepo refactor)는 #458이 추월·격리(i-dev 미머지) — 단, R16 P0가 모노레포 전면 폐기로 12를 사실상 흡수/무효화(별도 추적).
- 🟡 **Phase 0 DDL** — 신규4테이블·additive컬럼·SP 비-삼킴·client→company 리네임 dev적용·i-dev머지(b6abfde). 미착수: 레거시 DROP만(흡수+cutover 후 보류).
- 🟢 **Phase 0 fs-api 계약동결** — #456 CLOSED(5 dataType·CellData·RowId·permission/company_setting/widget_preset 타입). 41 블록타입 계약은 별건(R16 P1).
- 🟡 **BE 콜사이트 cutover** — 부분완료(#485, e79dbfe). 잔여: value_data→data 읽기-스위치·캐싱·페이지권한.
- 🟡 **데이터 마이그레이션** — data_row·text→JSON·M1 흡수 trio(c240ff2)·M2 색전역화+dangling drop(30ad0b1)·option-id 180행(03f57b7) dev머지. 잔여: 라벨박제 제거. ⚠️커버리지: 82 select 중 18만 option_list → ~64컬럼 = **셀 라벨에서 도출 확정**(master 2026-06-26; distinct 셀값→옵션 생성, 정제 1패스[오타/더티값] 동반).
- 🟢 **SP/트리거 dual-write + option-id 인프라** — e6cd2cf/b6dbf4e/03f57b7. 행동검증 통과.
- 🟡 **위젯 시스템 BE 슬라이스 D8·④~⑪ (2026-06-26 유입)** — **D8 dev완료(6eea8e3)**: block_type_enum 41 + data_column.block_type Not Null + coarse 백필. 41 영문 id 마스터확정 박제·⑪ R16 P1 이연·SPEC §B 박제 권고. **⑥ dev완결(스키마 c9da662 + 백필 1567cce)**: page_section 신설 + 위젯 격자 5컬럼 ADD, area→100×70 격자 도출 백필(page_section 173·위젯 207, 0-based, 경계-차분+epsilon 가드[R-1 사일런트손상 수정], 대사 전수통과), D2=1/섹션 layout_id FK 마스터확정. **프리셋 ⑤④⑦ dev완료(a3eb20c)**: ⑤ page_layout_widget.preset_id ADD+참조해소 계약·④ company_setting 폼락 3종 DROP→단순 FK(data-preserving)·⑦ 3계층 계약(owner XOR 충분, no-DDL). **⑨⑩ dev완료(0f1e0c6)**: ⑨ file_group soft-delete(is_deleted+deleted_at ADD, 테이블 기존)·⑩ 관리주기 계약(no-DDL, management_cycle/created_at/dataMode 인프라 기존). **잔여 미착수**: ④ 폼29 재처리(task-db-data, 변환 UNDEFINED-pending R16③/⑦)·⑤⑦ BE 참조해소+프리셋 CRUD·⑧ recent-usage(3줄 계약 마스터확정)·⑨ BE soft-delete 채택·⑩ D1 확장·⑪ 드리프트체크 = **전부 plan-enterprise BE**(또는 task-db-data ④폼29).
- 🟢 **위젯 BE 슬라이스 대거 완료(2026-06-28)** — ⑤ preset_id 참조해소·⑦ widget_preset CRUD·⑧ recent-usage(#495)·⑨ soft-delete 채택·⑩ 관리주기 capability·⑪ 드리프트체크(#498)·D8-BE ①③ blockType serve(#505)·⑥-BE 격자저장(#508) 전부 dev머지. **#7 BE cutover Phase0(읽기헬퍼 3함수 fn_cell_data_to_text/numeric/date) dev완료(run13·80c4d59)** → 다음 #7 서브플랜1(whereclause). ⑩ wiring=FE 이미 작동 moot·②#8b 수식=prior 100% 변환 moot. 잔여=#7 서브플랜1~6·④폼29(R16③ 대기)·#4 rename/DROP(최종·#7 후).
- 🔴 **prod 형태 재인코딩 게이트 / 조율 컷오버** — prod 대상, 범위 밖.

---

## 로드맵 설명

**★ 진입 게이트: Roadmap 16(FE)은 본 로드맵 Phase 0(계약동결) 완료 후 착수.** (완료됨.)

### 목표
data-craft 코어 서비스 스키마를 확정 설계서(REDESIGN-SPEC v2)대로 재구축하는 **server(DB+BE) 트랙**. 5 데이터타입 vs 41 렌더링타입 분리, EAV 셀 text→JSON, 폼·뷰어설정 테이블 제거, 권한 단일 permission, 프리셋(widget_preset), SP/트리거 비-삼킴. **+ 2026-06-26: Roadmap-16 FE 위젯 재설계가 요구하는 BE 슬라이스(④~⑪) 합류.**

### 분담·경계
종합·적대 검토(ROADMAP-SPLIT-REVIEW) 결론: DB+BE는 둘 다 data-craft-server·동일 i-dev·raw SQL 708건 강결합 → 분할 경계=repo(server[DB+BE]=본 로드맵 / FE=Roadmap 16). 1+2=본 로드맵(위임 세션), 3=R16(본 세션 감독). FE는 별도 repo라 Phase 0 이후 staggered 병렬.

### 위젯 시스템 BE 슬라이스 (2026-06-26 ultracode 적대검증 도출)
R16 FE 위젯 재설계가 BE에 요구하는 것 + 신 모델이 완료된 R15 작업과 충돌하는 정합:
- **충돌 정합**: company_setting 폼락(④, 사용자설정 임의위젯과 충돌·폼29행 재처리)·page_widget.preset_id 부재(⑤, REFERENCE 미정의)·page_section/정수격자 미편성(⑥, area→격자 마이그 미명세).
- **신규 BE**: widget_preset 3계층(⑦)·recent-usage 조회(⑧, 조합스코프)·file-group(⑨)·D1 관리주기(⑩).
- **드리프트 가드**: 41목록 DB enum↔fs-api 교차repo 체크(⑪, 공유 패키지 불가·fs-api 정본=R16 P1).
- 전부 additive → i-dev 머지·조율 컷오버 합류. 각 단위 실행 전 미명세분 보완(⑥ area→격자 알고리즘·⑧ 3줄 계약·⑤ override 정책=기본 금지).
- ⚠️ 파생/계산 블록 7종(rowID·uniqueID·lastUpdate·log·formula·quickFormula·dualBlock)은 셀값 미저장 → D8 dataType/백필 명목, 셀 마이그 비대상(가상/파생 열 개념). uniqueID는 재설계서 (열ID+행ID+그룹ID) 조합 구조 json.

### prod 깨짐 방지 (컷오버 전략)
코드(fs-api·BE)는 i-dev 정상 머지하되 prod 보류 = prod DB 적용 + BE prod 배포. prod 변경 전체를 마지막 단일 조율 컷오버 창으로 묶음. ④~⑩ DDL은 컷오버 prod DDL 일괄에 포함(⑧ BE-only·⑪ CI체크 제외).

### 위험·메모
- 3.2M셀 text→JSON 일괄변환 다운타임 → 온라인 백필 검토. text→JSON 타입충실 변환 함수 필수. 모든 dev 실측=합성 시드, prod 재인코딩 게이트 통과 전 '확정' 아님.
- ④ company_setting 폼락 해제는 M1 흡수 폼 29행에 영향 → task-db-data capture+rollback 필수. ⑥ page_section은 R16① 선행 요건(R15⑥ 먼저 — FE가 막힘 방지 위해 우선).

### 검증 이력
ROADMAP-SPLIT-REVIEW + advisor 2-라운드 PASS(v1) + 2026-06-26 ultracode 적대검증(FE↔BE 렌즈, R15/교차 PASS) — company_setting/preset_id/page_section CRIT를 ④⑤⑥ 단위로 반영, ④ +task-db-data·⑪ /plan-enterprise·파생7블록 FLAG 정련.

### 2026-06-28 현행화
BE 슬라이스 ⑤⑦⑧⑨⑩⑪ 완료(#495/#498)+D8-BE①③(#505)·⑥-BE(#508)·#7 BE cutover Phase0(읽기헬퍼) 완료·#7 서브플랜1~6 잔존(★신선한 컨텍스트 권장·force-complete 금지·런타임 테스트 필수). #4 rename/DROP=최종(#7 후 보조)·④폼29=R16③ 대기. 코어 DBML v2 작성(data_craft_dev introspection).
