# Roadmap 16: data-craft 코어 재설계 ② FE (web)

> 작성일: 2026-06-24 | 대상: data-craft 코어 재설계 FE 트랙 (data-craft monorepo) — Roadmap 15(server)와 repo-격리 병렬, 15 Phase0 이후 진입
>
> **현황(2026-06-25)**: 🟢2 · 🔴3 — 진입게이트 통과 + **R16① 뷰어 통합 완결**(#458): 추출 8증분→#486 collapse(단일 패키지)→**#487 sub/external 통일·4패키지 삭제**. 단일 FsDataViewer/FsDataViewerExplorer가 own/sub/external 전 역할(게이팅 prop). E-namespace cross-package DTS 문제 구조적 제거. 다음=**R16② view-mode 팬아웃**. 프리셋/prod 미착수. 상세 ↓ 진척 현황+아키텍처 결정 섹션. **R15(server)는 별도 세션 병렬 위임 — 본(R16) 세션이 양 트랙 검증·종합·감독.** ⚠️#487 컴파일 불가시 동작은 시각 검증 권장.

## 프롬프트

🟢 (진입 게이트) Roadmap 15 Phase 0 완료 확인 — 스키마 DDL + fs-api 계약타입(columnType 5번째 enum·row_id·cells JSON 형태·widget_preset/permission/company_setting 응답) 동결. + Roadmap-12(monorepo refactor) FE repo 점유 충돌 점검(완료/격리 후 진입).

🟢 /plan-enterprise data-craft — 뷰어 통합(work_repo=data-craft): fs-data-viewer + fs-sub-data-viewer + fs-external-data-viewer → **단일 뷰어** ✅ **완결(#458, #459~#487)**. 끝구조 달성: fs-viewer-core 추출→collapse(단일 패키지·#486)→sub/external 4패키지 삭제(#487). 단일 FsDataViewer/FsDataViewerExplorer가 own/sub/external 전 역할을 게이팅 prop(gridOnly·subGridConfig·columnMenuMode·externalMode·dataTypeFilter)으로 수행. ★FE 최대 선결 — 완료.

🔴 /plan-enterprise data-craft — view-mode 팬아웃: 통합 1모델 → 단일목적 위젯 분할(grid/kanban/gantt/calendar/card/chart…). 통일 렌더링타입 체계(=데이터 렌더타입) + 3-프로퍼티(properties/column_properties/row_properties) 위젯 렌더. **이 통일로 단일 뷰어가 전 뷰모드/타입 위젯 보유 → sub/external의 '위젯 부재' 차이 소멸(패키지 삭제 가능).**

🔴 /plan-enterprise data-craft — 프리셋·즐겨찾기 시스템(그린필드): widget_preset(15 Phase0 동결 스키마) 기반 폼·설정·즐겨찾기 통합 UI. 생성 2경로(기존위젯 등록·커스텀 제작), 복사/연결.

🔴 (조율 컷오버 합류) FE prod 배포 — Roadmap 15 조율 컷오버 창에 합류(DB→BE→FE 순). /pre-deploy data-craft (FE 타겟).

## 진척 현황 (2026-06-25 검증)

> #458 i-dev git log + dev 대조. 진입게이트 3에이전트 재검증 PASS.

- 🟢 **진입 게이트** — R15 Phase0(계약동결+신스키마 additive) ✅ + R12/#342 격리(i-dev 미머지, #458이 추월) ✅. 양 서브체크 PASS → R16 진입 가능. (가드레일: #342 절대 i-dev 머지 금지.)
- 🟢 **뷰어 통합(#458) — 완결**. ① 추출 8증분(#459~#483: print·shared·grid/lib·prerequisites·E-namespace 난관·cell-keyboard). ② **#486 collapse**: 소비자그래프 검증(core 소비자=fs-data-viewer 단 하나)→1-소비자 core 군더더기→fs-viewer-core 325파일 fs-data-viewer 흡수·core 삭제·단일 패키지화(배럴 6 병합·E-namespace DTS 문제 구조적 제거). ③ **#487 sub/external 통일·삭제**: FsDataViewer/FsDataViewerExplorer 게이팅 prop(gridOnly·subGridConfig·columnMenuMode·externalMode·dataTypeFilter)으로 sub/external 흡수→루트앱 재지정→**4패키지 삭제**(advisor BLOCK 2회[배럴 flat표면·explorer 회귀]→정정→PASS). 매 증분 독립 gate 0 errors. **핵심 교훈**=[[project_data_craft_enamespace_consumer_assembly]] + 1-소비자 추출은 끝구조서 역행(collapse로 정정). ⚠️ 컴파일 불가시 동작(sub 제한메뉴·external 4타입·form/general 필터·subGridConfig·design-mode Setting)은 시각 검증 권장. 다음 R16=view-mode 팬아웃.
- 🔴 **view-mode 팬아웃** — 미착수.
- 🔴 **프리셋·즐겨찾기** — 미착수.
- 🔴 **FE prod 배포** — prod 대상, 범위 밖.

---

## 로드맵 설명

**★ 진입 게이트: 본 로드맵은 Roadmap 15 Phase 0(스키마 DDL + fs-api 계약타입 동결) 완료 후 착수. 그 전 시작 금지.**

### 목표
data-craft(FE monorepo) 코어 재설계 — "데이터=순수데이터, 위젯이 표시 결정" FE 구현. 뷰어/서브/외부 3포크를 **단일 뷰어로 통합(끝 구조: sub/external 패키지 삭제·모드화)** → view-mode 팬아웃(단일목적 위젯) → 통일 렌더링타입·3-프로퍼티 위젯 → 프리셋/즐겨찾기(그린필드).

### 15와의 관계 (병렬·repo 경계)
data-craft(FE)와 data-craft-server(15)는 별도 repo·별도 i-dev → repo-격리 병렬. 16은 15 Phase0의 동결 계약(fs-api 타입)을 입력으로 받아 15 구현과 나란히 진행, 마지막에 15 조율 컷오버 창에 FE 배포로 수렴(DB→BE→FE).

### 16 내부는 직렬 (왜)
모든 작업이 data-craft 단일 repo·동일 i-dev → 병렬 프롬프트는 add/add 충돌(15와 동일 사유, ROADMAP-SPLIT-REVIEW RBC-3). 따라서 내부 직렬: 뷰어통합(최대 선결, 431k LOC 3포크→1모델)→팬아웃→프리셋(F4 순서).

### 위험·메모
- Roadmap-12(atomic monorepo refactor)가 동일 data-craft repo 통합브랜치 점유 가능 → 동시 대수술 금지(12 완료/격리 후 진입). 진입 게이트에 점검.
- 뷰어 3포크 통합(431k LOC, 공유 타입 diverge)은 대규모 — plan-enterprise 페이즈 분할 필수.
- 프리셋은 BE widget_preset 스키마(15 Phase0 동결)에 의존 → 그 전 셀파싱/프리셋 재작업 착수 금지.

### 아키텍처 결정 — sub/external = 삭제 (2026-06-25 마스터 확정·코드 검증)
- **검증 결과**: 3 뷰어 패키지는 동일 엔진·동일 데이터모델(cell/column/row/grid·GridContext, near-mirror 복사본). 실제 차이 = (a) 지원 타입 게이팅(`DISABLE_CELL_STYLE_TYPES` 등 allowlist 패키지별 상이), (b) sub/external이 **그리드-전용 서브셋**(칸반/간트/캘린더/대시보드 뷰 위젯·페이지 부재, 라우터 `viewMode='grid'` 하드코딩) — **둘 다 *지원 범위* 차이이지 아키텍처 차이 아님.** (잔여 부채: sub/external 자체 보유 `dual-widget-*-checks`가 core와 갈라짐 → 통합 시 core로 reconcile.)
- **결정**: 끝 구조 = **뷰어 1개**(통일 렌더링타입으로 전 뷰모드/타입 위젯 보유) + sub/external = 그 뷰어의 **모드/바인딩 설정 호출**. **fs-sub-data-viewer·fs-external-data-viewer 패키지 삭제.**
- **로드맵 영향**: 기존 "sub/external을 core로 마이그레이션(암묵 phase5/6)" 틀 **폐기** → **"통일 뷰어로 사용처 라우팅 + 패키지 삭제"**. 이로써 dev-only 자동진행의 '천장'(sub/external 별도 마이그·3뷰어 런타임 검증)이 **제거됨**.
- **제품 확인됨**: sub/external 맥락이 통일 후 전 뷰모드 획득(현재 그리드 전용) = **의도된 기능 확장**(마스터 확정).

### 아키텍처 결정 — fs-viewer-core 폐기·fs-data-viewer로 흡수 (2026-06-25 마스터 확정·소비자그래프 검증)
- **검증 결과**: `fs-viewer-core` 소비자 = `fs-data-viewer` **단 하나(314 import)**. sub/external은 core를 한 번도 채택 안 함(각자 독립 사본). 즉 "3포크→공유 core" 중복제거 전제는 **실현된 적 없음** — core는 처음부터 1-소비자 패키지.
- **결정**: 뷰어 1개 끝구조에서 **1-소비자 core = 군더더기 간접층**(패키지 경계 + tsup DTS + shim 유지비, 중복제거 이득 0). 게다가 **그 cross-package 경계가 E-namespace TS2724 난관의 원인**. → **fs-viewer-core를 fs-data-viewer로 흡수(단일 패키지) 후 core 패키지 삭제.** 내부 경계 소멸로 E-namespace류 DTS 문제 영구 제거.
- **로드맵 영향**: 기존 "fs-data-viewer→core 추출"(#459~#483, 7증분) 방향 **반전** → **collapse(core 325파일 fs-data-viewer 흡수·shim 294 삭제·import 재지정·core 삭제)**. 추출 증분은 엔진 표면 정리로 유효했으나 끝구조는 단일 패키지. 진짜 중복제거 이득 = **sub/external 삭제**.
- **collapse 규모(검증)**: core 325파일 이동·shim 294삭제·import 재작성 ~20·배럴 병합 ~6(e-namespace/entities·features·shared index/viewer.types)·config 5(vite alias·package.json dep). 루트앱은 `fs_data_viewer` 메인엔트리만 import(subpath 0)→소비자 무영향. 경계제거가 semi-atomic(부분 collapse는 빌드 깨짐) → 이동+재지정+config 일괄.

### 검증 이력
적대검토 워크플로(ROADMAP-SPLIT-REVIEW.md) FE 관점(RBC-4·F3·F4·F5) + advisor-fallback PASS(advisor 과부하로 프로토콜 대체, 동일 권위 — 5관점+진입게이트/컷오버/Roadmap-12 점검 통과).
