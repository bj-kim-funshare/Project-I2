# 데이터 크래프트 초정밀 분석 — 커버리지 및 방법론

> 분석일: 2026-05-28 | 대상: `data-craft`(앱·모노레포) + `data-craft-server`(BE) 2종 | 작업 방식: **전 과정 읽기 전용, 본 보고서 작성만 쓰기 작업**

---

## ⚠️ 먼저 — "분석 총 3회 시행" 지시의 해석 (마스터 확인 요망)

본 분석은 마스터 지시 **"분석을 총 3회 시행"** 을 **동일 sweep 3회 반복이 아니라 3가지 분석 렌즈의 순차 적용**으로 해석해 수행했습니다.

- **Pass 1 — 버그 클래스**: 로직 오류, null/undefined, off-by-one, 비동기 레이스, 에러 핸들링 누락, 타입 구멍, 리소스 누수
- **Pass 2 — UI/UX**: 빈/에러/로딩 상태, 막다른 흐름, 파괴적 동작 확인, 포커스/키보드 트랩, a11y, 다크모드 회귀, 반응형, 인지된 버벅임
- **Pass 3 — 파일 간 관계 / 계약 드리프트**: import 무결성, FE↔서버 API 계약 불일치, 상태/이벤트 결합, 명칭-동작 불일치

총 **626,878 LOC / 5,350개 파일** 규모에서 동일 sweep 3회는 같은 발견을 중복 산출하는 비용 낭비라는 어드바이저 판단(어드바이저 검증 1·2회차)에 따른 재해석입니다. 추가로 **Pass 1.5 횡단 grep sweep**(체계적 결함 클래스 전수 집계)을 더해 4단계로 수행했습니다. 만약 마스터 의도가 문자 그대로의 "동일 sweep 3회" 였다면 재지시 시 추가 sweep 을 디스패치합니다.

---

## 정직한 커버리지 선언

573k LOC(앱) + 54k LOC(서버) × 3렌즈는 사람이 한 세션에서 한 줄씩 읽는 것이 물리적으로 불가능합니다. 본 분석이 실제로 보장하는 것은 다음과 같습니다.

1. **전 파일 열거**: 5,350개 소스 파일 전체를 manifest 로 집계.
2. **파티션 분할 + 읽기 전용 서브에이전트 sweep**: 코드베이스를 16개 스코프로 분할해 각 스코프를 Pass별 read-only opus 서브에이전트가 읽고 분석.
3. **3개 뷰어 패키지 중복 제거**: `fs-data-viewer`(정본)를 정밀 분석하고, 포크 형제(`fs-sub-data-viewer`·`fs-external-data-viewer`)는 정본과의 **diff 부분만** 검토(파일명 ~1,095개 공유, 내용은 ~860개 분기 / 형제당 ~43k 변경 라인).
4. **체계적 결함은 횡단 grep 으로 전수 집계**(Pass 1.5).
5. **검증**: 어드바이저 5회 + 어드바이징 서브에이전트 5회로 발견 사항을 실제 코드 대조 검증(전체 **0건 완전 반증**).

### 스코프별 실제 분석 깊이 (3단계 솔직 표기)

| 스코프 | 전체 읽음 | 샘플링(시그니처/핫패스/훅 중심) | 에이전트 판단상 clean |
|---|---|---|---|
| SRV-A (controllers/routes/middlewares/schemas) | 전부 | — | — |
| SRV-B (services/models/utils/config) | 진입/config/utils + 고위험 서비스·모델 전부 | aggregation/paging/builder 등 grep 트리아지 | — |
| APP-A (entities/shared) | 로직 보유 파일 전부 | — | vendored shadcn·i18n·타입·배럴 제외 |
| APP-B (features) | .ts/.tsx 전부 | — | — |
| APP-C (widgets/pages/app) | 모든 훅 + app/ 전체 + 위젯 콜백 훅 | 시그니처 grep 전수 + 대표 컴포넌트 | 나머지 프레젠테이션 컴포넌트 |
| DCV-1 (viewer app/entities/pages) | 로직 보유 파일 전부 | — | 순수 타입/재export/상수 파일 |
| DCV-2 (viewer shared) | ~150 파일 sweep | — | — |
| DCV-3 (viewer features) | 305 파일 / 38k LOC | — | — |
| DCV-4 (cell-renderers) | 버그 취약 표면(파서/에디터/오버레이/검증) | — | **315 중 ~35 정독, 나머지 280 에이전트 판단 clean** |
| DCV-5 (dashboard/grid-table/sub) | 6개 디렉터리 전부 | — | — |
| DCV-6 (kanban/gantt/calendar/header) | 22k LOC | — | — |
| DCV-7 (dialogs/column-tooling/badges) | ~110 파일 전부 | — | — |
| SUB/EXT-DIFF (형제 포크 4스코프) | 형제 전용 파일 전부 + 경계 파일 semantic diff | ~820~860 분기 파일 diff 스캔 | reflow/rename 노이즈 |
| PKG-A (fs-api/fs-data-link) | 전부 | — | — |
| PKG-B (relation/file/explorer×3/shared) | 전부 | — | — |

> "에이전트 판단상 clean" 칸은 서브에이전트가 시그니처 grep 후 정독 없이 "결함 없음"으로 판정한 부분으로, **검증된 커버리지가 아니라 에이전트 판단**임을 명시합니다(특히 DCV-4 의 280개 파일).

---

## 산출물 구성 (영역 × 종류)

| 파일 | 내용 |
|---|---|
| `00-coverage-method.md` | 본 문서 — 방법론·커버리지·해석 플래그 |
| `01-summary-by-severity.md` | 심각도별 롤업 + 최우선 콜아웃 |
| `02-systemic-classes.md` | 횡단 결함 클래스(Pass 1.5) + 다크모드 카탈로그 |
| `10-app-fe-bugs.md` | 앱 FE 버그 클래스 |
| `11-app-fe-uiux.md` | 앱 FE UI/UX |
| `20-fs-data-viewer-bugs.md` | 정본 뷰어 버그 클래스 |
| `21-fs-data-viewer-uiux.md` | 정본 뷰어 UI/UX |
| `23-viewer-siblings.md` | 형제 뷰어 포크 회귀(버그+UI) |
| `30-other-packages.md` | fs-api / fs-data-link / file-attachment 등 |
| `40-server-bugs.md` | 서버 버그 클래스 |
| `50-cross-repo-contract.md` | FE↔서버 계약·import·결합 드리프트 |
| `90-verification-log.md` | 어드바이저 5 + 서브에이전트 5 검증 원장 |

---

## 분석 모수 요약

- 총 소스: **5,350 파일 / 626,878 LOC** (`.d.ts` 제외, node_modules/dist/build 제외)
- 앱 `src/`: entities 117 · features 201 · pages 47 · shared 159 · widgets 352
- 워크스페이스 패키지 11개 (뷰어 3종이 LOC 의 ~78% 차지 → 중복 제거 전략 핵심)
- 서버: controllers 31 · services 83 · models 50 · routes 26 (208개 라우트 등록) · schemas 4
- 발견 총계: **78건 actionable** (critical 0, block 2, high 21, medium 43, low 12) — 원시 79건에서 SYS-003 benign 제외, UX-5-002 는 검증 결과 high→low 하향 반영
