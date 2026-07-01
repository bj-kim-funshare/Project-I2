# Roadmap 16: data-craft 코어 재설계 ② FE (web)

> 🚫 **비정본 — 초기 방향성 참고용(작성 시점 스냅샷)**. 진행 중 요구사항은 **지휘 세션 확인**으로 재정의됨. **착수·판단 전 반드시 지휘 확인 — 이 문서를 단독 근거로 판단 금지.** (2026-07-01 격하: 작업 모델이 지휘 오케스트레이션+세션별 계획→컨펌으로 진화. 상세=memory `feedback_roadmap_non_authoritative_command_confirm`.)

> 작성일: 2026-06-24 (개정 2026-06-26 v2) | 대상: data-craft FE 트랙 — Roadmap 15(server+DB+BE) 위임 세션 병렬, 본 세션 FE 담당·양 트랙 검증·종합·감독
>
> **현황(2026-06-26 v2) — 모노레포 전략 전면 폐기 + 위젯 시스템 재설계로 전면 재구성**(2026-06-28 현행화): 🟢8 · 🟡3 · 🔴10. 단일 출처 SPEC = `Roadmap-16-data-craft-위젯시스템-재설계-SPEC.md`. 분담: 1(DB)+2(BE)=Roadmap-15(위임 세션), 3(FE)=본 로드맵. 핵심 추가: **모노레포 전략 전면 폐기**(6 라이브 패키지→앱 `src/`)를 인프라 기초(P0)로 선행. 데이터 ⊥ 표현 ⊥ 레이아웃. 데이터타입 5(string/number/date/boolean/json) ⊥ 블록타입 41(**string9·number5·date3·boolean2·json22** — timer=number 정정·uniqueID·color=json 유지).

## 프롬프트

🟢 (진입 게이트) Roadmap 15 Phase 0 완료 확인 — 스키마 DDL + 계약타입 동결 + Roadmap-12 FE repo 점유 충돌 점검. (완료)

🟢 /plan-enterprise data-craft — 뷰어 통합 ✅ 완결(#458, #459~#487): fs-viewer-core collapse(#486 단일패키지)→sub/external 4패키지 삭제(#487). 게이팅 prop으로 own/sub/external 통합.

🟢 /plan-enterprise data-craft — R16② P1 통일 렌더링타입 레지스트리 토대 ✅(#488 P1a + #489 P1b RegistryCellRenderer 오케스트레이션 동등 dispatcher).

**━━ 2026-06-26 v2 전면 재구성: 모노레포 폐기 + 위젯 시스템 재설계 ━━**
> SPEC §A~E(요구 원문)·§F(데이터모델)·§G(영향). 직렬(단일 data-craft repo·동일 i-dev → 병렬=add/add 충돌). 적대검증(2026-06-26) 반영: 매핑정정·collapse 페이즈작업·shape호환표 선행·R15 의존마커.
>
> **★ 실행 규약(모든 🔴 프롬프트 공통)**: 프롬프트는 **스코프 포인터**이지 완전 구현계획이 아님. 각 프롬프트를 /skill로 실행 시 실행세션은 ① 단일출처 **SPEC 전문**(`/Users/starbox/Documents/GitHub/Project-I2/.claude/plan-roadmap/Roadmap-16-data-craft-위젯시스템-재설계-SPEC.md`)의 해당 §를 **정독**, ② work repo(data-craft)를 Explore해 현 코드에 근거, ③ plan-enterprise 자체 plan+advisor 게이트로 단위별 상세·수용기준 도출. `[R15 …의존]` 마커는 그 R15 단위 i-dev 완료를 선확인.

🟢 /plan-enterprise data-craft — **[P0 인프라] 모노레포 전략 전면 폐기·단일 앱화**: 6 라이브 패키지를 의존성 역순(fs-data-link → fs-file-attachment → fs-data-viewer-explorer → fs-data-viewer → fs-shared → fs-api) 앱 `src/` 흡수 + 죽은 스텁 4종 삭제 + config 정리(vite alias·tsconfig paths·pnpm-workspace.yaml·turbo.json·package.json workspace dep) + 스크립트명 보존(typecheck:all/lint/build·build:packages 폐기). **페이즈별 필수 작업(적대검증)**: [H1] tsconfig.app strict 델타(verbatimModuleSyntax·erasableSyntaxOnly·noUnused*) — `entities/grid-mode.types.ts` 문자열 `enum FsViewerMode`→const-object+union(phase4 RED 방지·~75파일 사용처)·verbatim type-import 정합(phase2-6); [H2] `manualChunks chunk-data-viewer` 함수형 재작성(빈청크→메인병합 회귀 방지); [H3] Tailwind v4 `@source "!../../packages/*/dist/**"` 가드 제거 + 9 styles.css side-effect import + viewer 297 `--fs-*` 토큰 앱 전역 CSS 흡수·dedupe; [M2] import 코드모드 4형태(named·inline `import('fs_…')` 11·side-effect CSS 9·subpath `fs_data_viewer/entities` 1); [M3] build:packages(turbo)·pnpm-workspace.yaml·alias·@source는 **최종페이즈 일괄 해체**(중간페이즈는 build:packages 선행 유지). cross-package DTS(E-namespace) 영구 소멸. 외부 소비자 0·vite src alias 검증됨.

🟢 /group-policy data-craft — **[P0 정책·게이트 정합]** 모노레포 폐기 반영: dev.md `lint_command`·빌드게이트 단일앱 정합(`build:packages` 선행 폐기·스크립트명 보존시 무변경) + frontmatter `type: monorepo`→`type: project` + "기타"절(dev-build 모노레포 선택 UI 비대상) + `.claude/scripts/` monorepo 가정 점검. **[M1 고지]** `pr-ci.yml` 1개월째 깨짐(ERR_PNPM_BAD_PM_VERSION: workflow v10 vs packageManager pnpm@10.22.0) → green baseline=로컬 plan-enterprise 게이트뿐, merge-to-main 관련 CI 수정 사안이나 **master 무시 지시(2026-06-26) — CI 수정 우선순위 제외**(스크립트 수정으론 미해소·로컬 게이트가 안전망). (★본 세션 후속: 진부화 게이트 메모리 갱신 — typecheck:all fresh-worktree·build:packages 선행·prod-build-only export gap·pnpm10 pre/post.)

🟢 /plan-enterprise data-craft — **[P1 데이터모델] 데이터타입(5)↔블록타입(41) 단일 계약 + dataType-level 호환 helper**: 흡수된 fs-api 위치(앱 `src/`)에 `ALL_BLOCK_TYPE_IDS`(41)·`BlockTypeId`·`BLOCK_TYPE_LABELS`(한)·`BLOCK_TYPE_CATEGORY`(문자10/버튼12/특수13/확장6)·`BLOCK_TYPE_TO_DATA_TYPE`(**timer=number**·uniqueID/color=json·분포 string9/number5/date3/boolean2/json22). "기능→블록" 용어 통일. additive·런타임0. [DB **D8**=Roadmap-15, 동일 41목록 정합·드리프트 금지][교차repo 드리프트체크=R15⑪]

🟢 /plan-enterprise data-craft — **[P1.5 shape 호환표]** 41블록 json-22 shape 규격 + 2층(shape) 호환표 = **마이그레이션 기능의 선행 필수**. 적대검증: dataType-level만으론 손상(single→multi=스칼라→배열·json↔json shape 상이·conversion-catalog `listTargetTypes`가 json 22중 13 제외). json-22 shape 규격(vote DSL·formula 리터럴|AST·dualBlock 합성·user/multi 배열·document 객체 등) + shape-compat 게이트 정의. SPEC §F "같은 dataType=무변경 즉시" 규칙은 shape-compat 선행으로 정정(SPEC 편집 별도). [⚠️ **파생/계산 블록 7종**(rowID·uniqueID·lastUpdate·log·formula·quickFormula·dualBlock)=셀값 미저장 → dataType 명목·셀 마이그 비대상, **가상/파생 열 개념** 명시(④ 블록/렌더러·마이그 단위가 계산열을 변환데이터로 오인 방지).]

🟢 /plan-enterprise data-craft — **① 디자인 모드 시스템**(SPEC §C·§D2-7·§E): 디자인모드 토글·헤더 말풍선 아이콘박스(위젯추가/높이/세로확장+나만의디자인 바로가기)·3탭 설정 모달 셸(위젯설정/위젯디자인/배경[위젯별 격자내부])·플로팅 컨트롤바 제거·1섹션 고정 페이지·격자 100×70(격자열 폐기)·호버 백막+드래그(좌상)/설정(우상). (위젯 자체 디자인모드 설정+설정 드로어 항목+그리드 열메뉴 → 전부 모달로 이관.) [page_section/정수격자 스키마=R15⑥ 선행 필요]

🟡 /plan-enterprise data-craft — **② 나만의 디자인(즐겨찾기 프리셋)**: 복사·참조 둘 다 지원. 말풍선 바로가기서 즐겨찾기 위젯설정 목록 조회·신규 생성. [BE widget_preset 3계층=R15⑦·preset_id 참조계약=R15⑤ 의존]

🟡 /plan-enterprise data-craft — **③ 사용자 설정 + 최근 사용 설정**: 사용자설정=참조전용(즐겨찾기 최상위 위젯 등록·권한 기존 철학)[company_setting 일반화=R15④·preset_id=R15⑤ 의존]. 최근사용=복사전용(조합 스코프: 동일 위젯·동일 그룹, 회사 범위·같은/다른 페이지)[recent-usage 조회=R15⑧ 의존].

🟡 /plan-enterprise data-craft — **④ 블록(블록 위젯)**(SPEC §A1·§B): 레지스트리 41-블록 재정렬(기존 P1c dispatch 이행 흡수)+블록 위젯/렌더러+문서 위젯→블록 흡수(셀로도·독립 위젯으로도). 블록타입=열당 1개(data_column 단일출처), 열타입변경=마이그 기능(ColumnTypeChangeDialog 재사용·shape호환표 게이트). [D8=R15 선행] **수용기준**: 41블록 전등록(P1a/P1b 토대 위)·dispatch 6소비처 이행·UniversalCellRenderer 오케스트레이션 동등·파생7블록 read-only·문서 셀/독립 양형·열당1블록 불변식.

🔴 /plan-enterprise data-craft — **⑤ 디자인 위젯**(SPEC §A2): 신규 2종 + 텍스트·이미지(GIF,기업 공용 파일그룹)·동영상(공용 파일그룹)·탭·바로가기(버튼 분해)+블록별 위젯디자인 탭 내용. [BE 파일그룹=R15⑨ 의존]

🔴 /plan-enterprise data-craft — **⑥ 자동화 위젯**(SPEC §A3·§B): 불러오기 위젯(기존 버튼 분해 — 데이터 불러오기 액션) + 자동화 블록(특수 §B '자동화(버튼)'). **버튼 3분해 경계**: 바로가기(⑤=네비)·불러오기(⑥=데이터 액션)·자동화블록(셀). SPEC 버튼분해 정의 정독.

🔴 /plan-enterprise data-craft — **⑦ 보드 위젯**(SPEC §A4): 그리드·캘린더·칸반·간트(→타임라인 개명)·피드(텍스트/긴텍스트/문서 1개+이미지 보유 그룹만)·갤러리(파일그룹 기반)·폼(보드로 흡수). 통일 엔진(#458) 재사용. [갤러리 BE 파일그룹=R15⑨ 의존]

🔴 /plan-enterprise data-craft — **⑧ 차트 위젯**(SPEC §A5): 기존 대시보드 뷰 분해·종류 유지·읽기전용 — 막대/꺾은선/파이/산점도/카드/게이지/멤버.

🔴 /plan-enterprise data-craft — **⑨ 파일 위젯**(SPEC §A6): 파일 업로더·상세 파일 업로더(파일그룹 기반, 흡수된 fs-file-attachment 재사용). [BE 파일그룹=R15⑨ 의존]

🔴 /plan-enterprise data-craft — **⑩ 탐색기 위젯**(SPEC §A7·§D9): 데이터 탐색기·파일 탐색기(파일그룹). 뷰어/서브/폼/일반 구분 폐지·탭 없음·데이터그룹 동등. [파일탐색기 BE 파일그룹=R15⑨ 의존]

🔴 /plan-enterprise data-craft — **관리주기(D1) 연동**(SPEC §D1): 전 위젯(차트·파일 포함) 위젯별 관리주기 옵션(단일 데이터 vs 페이지 관리주기 연동; 페이지 비활성 시 단일 고정). **관리주기 동작 기준 = 데이터 밸류의 `created_at`**(켜진 위젯=현 주기 창 created_at 셀만 표시). [BE D1=R15⑩ 의존]

🔴 /plan-enterprise data-craft — **마이그레이션**(SPEC §G7): 기존 페이지/위젯/열→신 모델, D8 블록타입 Not Null 백필 정합, 기존 위젯→신 위젯타입 매핑. **shape-compat 게이트 준수(P1.5 선행 필수).** **수용기준**: 위젯→신타입 매핑표·shape-compat 통과 셀만 변환·파생7블록 제외·역마이그 동반·R15 데이터 마이그와 정합.

🔴 /plan-enterprise data-craft — **세부 조정·통합 테스트**: 전 항목 진행 후 각 위젯/블록/모달/프리셋 세부 조정 + 동작 시각 검증(정적 게이트 한계 보완 — 마스터 "전부 진행 후 각 항목별 세부 조정 및 테스트").

🔴 (조율 컷오버 합류) /pre-deploy data-craft (FE) — Roadmap 15 조율 컷오버 창 합류(DB→BE→FE).

## 진척 현황 (2026-06-26 v2)

- 🟢 **진입 게이트** — R15 Phase0(계약동결+신스키마 additive) ✅ + R12/#342 격리 ✅.
- 🟢 **뷰어 통합(#458) — 완결**. ① 추출 8증분(#459~#483) ② #486 collapse(fs-viewer-core 흡수·단일 패키지·E-namespace DTS 구조적 제거) ③ #487 sub/external 통일·4패키지 삭제. 핵심 교훈=[[project_data_craft_enamespace_consumer_assembly]].
- 🟢 **R16② P1 레지스트리 토대** — #488 P1a + #489 P1b. 미소비 토대. advisor PASS·gate 0 errors.
- 🟢 **P0~P1.5 + ① 완료(2026-06-28)** — 모노레포 폐기(#494)·정책정합·P1 계약(#496)·P1.5 shape(#497)·① 디자인모드(셸 #499 + ①' 격자 컷오버 #506~509 + ★재구축 1+2+3 #510 헤더+→모달·#511 격자 셀 편집·#512 컨트롤바제거+호버설정 = 마스터 3지적 교정). ⚠️통합 화면검토 대기(런타임 미검증).
- 🟡 **②③④ 토대만(2026-06-28)** — ②-1(#502 widget_preset CRUD FE)·③-1(#503 recent-usage FE)·④a(#504 blockTypeMapping/PasswordRenderer/Registry) 안전토대·미소비. 본체(②-2~5·③본체·④b dispatch전환[화면검증]/④c 마이그게이트)·⑤~ 미착수.
- 🟠 **위젯 시스템 전면 재설계 + 모노레포 폐기(2026-06-26 v2)** — SPEC 명문화 완료. 신 시퀀스(collapse→정책→계약→shape호환표→신10단계→관리주기→마이그→세부조정→컷오버) 미착수. P1c(dispatch 이행)는 "④ 블록" 단위에 흡수.
- 🔴 **FE prod 배포** — prod 대상, 범위 밖(컷오버 합류).

---

## 로드맵 설명

**★ 진입 게이트: 본 로드맵은 Roadmap 15 Phase 0(계약동결) 완료 후 착수.** (완료됨.)

### 목표 (2026-06-26 v2 재정의)
data-craft(FE) 코어 재설계 — "데이터=순수데이터(5타입), 표시는 블록(41 렌더링타입)이 결정". **모노레포 전략 전면 폐기**(6 라이브 패키지→앱 src·단일 앱화·cross-package DTS 영구 소멸) 위에 위젯 시스템 전면 재설계: 41 블록·통일 레지스트리·블록/디자인/자동화/보드/차트/파일/탐색기 위젯·1섹션 페이지·격자·3탭 설정 모달·3계층 프리셋. 상세 = SPEC.

### 분담 (마스터 2026-06-26 확정)
- **R15 = DB+BE(위임 세션, 단일 로드맵)**: 데이터층 + 본 FE가 의존하는 BE 슬라이스 — D8·company_setting 일반화④·page_widget.preset_id⑤·page_section/격자⑥·widget_preset 3계층⑦·recent-usage 조회⑧·file-group⑨·D1⑩·드리프트체크⑪.
- **R16 = FE(본 세션)**: 모노레포 폐기 + 위젯/페이지/모달/프리셋 FE. "구축하면서 BE 추가 구축"=각 단위가 R15에 BE 추가 요구 → 위임 핸드오프(프롬프트 [R15 의존] 마커).

### 모노레포 폐기(P0) 근거
6 라이브(fs-api·fs-shared·fs-data-link·fs-data-viewer·fs-data-viewer-explorer·fs-file-attachment) + 죽은 스텁 4. fs-api는 범용 FE SDK라 fs-data-viewer로 못 접음 → 전 패키지를 앱 src로 흡수(단일 앱). FE 사용처 완전 통일+cross-package DTS 소멸. 단 **FE↔BE는 별도 repo라 규약 통일**(D8 enum↔fs-api 계약, 드리프트체크 R15⑪로 강제). 정책 파급(dev.md·게이트·type·scripts·CI)=정책 정합 단위.

### 적대검증(2026-06-26 ultracode) 핵심 반영
- 매핑정정 timer=date→number(셀이 "MM:SS"→초 계산); uniqueID·color=json 유지(재설계가 구조화: uniqueID=열ID+행ID+그룹ID 조합·color=확장성).
- 마이그 규칙: "같은 dataType=무변경 즉시"는 거짓(listTargetTypes 13/22 제외·single→multi 변환) → **shape 호환표(P1.5)가 마이그 선행 필수**.
- collapse "단계별 green" 단언 거짓 → 페이즈작업 H1-H3·M1-M3 명시(특히 FsViewerMode enum phase4 RED·Tailwind 스캔행·CI 1개월 깨짐).
- 신 모델이 완료된 R15 작업과 충돌(company_setting 폼락·preset_id 부재·page_section 미편성) → R15 신규 단위 ④⑤⑥로 해소(위임).

### 직렬 이유·완료 토대 재사용
단일 repo·동일 i-dev → 직렬. 완료분(뷰어통합·단일패키지·레지스트리 토대)은 폐기 아님 — 보드 위젯 통일 엔진·41블록 렌더링 토대로 재사용.

### 검증 이력
ROADMAP-SPLIT-REVIEW FE 관점 + advisor-fallback PASS(v1) + 2026-06-26 ultracode 3렌즈 적대검증(데이터모델·collapse·FE↔BE) — CRIT/HIGH 전부 로드맵 단위·FLAG로 반영.

### 2026-06-28 현행화
P0~① 완료(① 재구축 1+2+3·마스터 3지적[헤더+→모달/위젯전체차지→격자/컨트롤바제거] 교정·화면검토 대기)·②③④ 토대만·⑤~ 미착수. ①' 격자 컷오버는 라이브 대시보드 격자 알고리즘 재사용(#509).
