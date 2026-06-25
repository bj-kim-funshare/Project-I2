# Roadmap 16: data-craft 코어 재설계 ② FE (web)

> 작성일: 2026-06-24 | 대상: data-craft 코어 재설계 FE 트랙 (data-craft monorepo) — Roadmap 15(server)와 repo-격리 병렬, 15 Phase0 이후 진입
>
> **현황(2026-06-25)**: 🟢1 · 🟡1 · 🔴3 — 진입게이트 통과·#458 phase 4c까지. view-mode/프리셋/prod 미착수. 상세 ↓ 진척 현황 섹션.

## 프롬프트

🟢 (진입 게이트) Roadmap 15 Phase 0 완료 확인 — 스키마 DDL + fs-api 계약타입(columnType 5번째 enum·row_id·cells JSON 형태·widget_preset/permission/company_setting 응답) 동결. + Roadmap-12(monorepo refactor) FE repo 점유 충돌 점검(완료/격리 후 진입).

🟡 /plan-enterprise data-craft — 뷰어 3포크 통합(work_repo=data-craft): fs-data-viewer(212k)+fs-sub-data-viewer(110k)+fs-external-data-viewer(109k) → 공유 1모델(GridContext). own/sub/external = group_id 바인딩 차이로 흡수(§7). ★FE 최대 선결.

🔴 /plan-enterprise data-craft — view-mode 팬아웃: 통합 1모델 → 단일목적 위젯 분할(grid/kanban/gantt/calendar/card/chart…). 통일 렌더링타입 체계(=데이터 렌더타입) + 3-프로퍼티(properties/column_properties/row_properties) 위젯 렌더.

🔴 /plan-enterprise data-craft — 프리셋·즐겨찾기 시스템(그린필드): widget_preset(15 Phase0 동결 스키마) 기반 폼·설정·즐겨찾기 통합 UI. 생성 2경로(기존위젯 등록·커스텀 제작), 복사/연결.

🔴 (조율 컷오버 합류) FE prod 배포 — Roadmap 15 조율 컷오버 창에 합류(DB→BE→FE 순). /pre-deploy data-craft (FE 타겟).

## 진척 현황 (2026-06-25 검증)

> #458 i-dev git log + dev 대조. 진입게이트 3에이전트 재검증 PASS.

- 🟢 **진입 게이트** — R15 Phase0(계약동결+신스키마 additive) ✅ + R12/#342 격리(i-dev 미머지, #458이 추월) ✅. 양 서브체크 PASS → R16 진입 가능. (가드레일: #342 절대 i-dev 머지 금지.)
- 🟡 **뷰어 3포크 통합(#458)** — phase 1~4c i-dev 머지(fs-viewer-core 185파일·fs-data-viewer 177 re-export); phase 4d 캡처(미머지 WIP, ae85a2608); widgets층·sub/external(phase5/6) 흡수 미착수.
- 🔴 **view-mode 팬아웃** — 미착수.
- 🔴 **프리셋·즐겨찾기** — 미착수.
- 🔴 **FE prod 배포** — prod 대상, 범위 밖.

---

## 로드맵 설명

**★ 진입 게이트: 본 로드맵은 Roadmap 15 Phase 0(스키마 DDL + fs-api 계약타입 동결) 완료 후 착수. 그 전 시작 금지.**

### 목표
data-craft(FE monorepo) 코어 재설계 — "데이터=순수데이터, 위젯이 표시 결정" FE 구현. 뷰어/서브/외부 3포크를 공유 1모델로 통합 → view-mode 팬아웃(단일목적 위젯) → 통일 렌더링타입·3-프로퍼티 위젯 → 프리셋/즐겨찾기(그린필드).

### 15와의 관계 (병렬·repo 경계)
data-craft(FE)와 data-craft-server(15)는 별도 repo·별도 i-dev → repo-격리 병렬. 16은 15 Phase0의 동결 계약(fs-api 타입)을 입력으로 받아 15 구현과 나란히 진행, 마지막에 15 조율 컷오버 창에 FE 배포로 수렴(DB→BE→FE).

### 16 내부는 직렬 (왜)
모든 작업이 data-craft 단일 repo·동일 i-dev → 병렬 프롬프트는 add/add 충돌(15와 동일 사유, ROADMAP-SPLIT-REVIEW RBC-3). 따라서 내부 직렬: 뷰어통합(최대 선결, 431k LOC 3포크→1모델)→팬아웃→프리셋(F4 순서).

### 위험·메모
- Roadmap-12(atomic monorepo refactor)가 동일 data-craft repo 통합브랜치 점유 가능 → 동시 대수술 금지(12 완료/격리 후 진입). 진입 게이트에 점검.
- 뷰어 3포크 통합(431k LOC, 공유 타입 diverge)은 대규모 — plan-enterprise 페이즈 분할 필수.
- 프리셋은 BE widget_preset 스키마(15 Phase0 동결)에 의존 → 그 전 셀파싱/프리셋 재작업 착수 금지.

### 검증 이력
적대검토 워크플로(ROADMAP-SPLIT-REVIEW.md) FE 관점(RBC-4·F3·F4·F5) + advisor-fallback PASS(advisor 과부하로 프로토콜 대체, 동일 권위 — 5관점+진입게이트/컷오버/Roadmap-12 점검 통과).
